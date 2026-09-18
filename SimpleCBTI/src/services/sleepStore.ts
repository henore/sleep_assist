import AsyncStorage from '@react-native-async-storage/async-storage';
import { CheckInData, DayPhase, InsightResult, SleepRecord } from '../types/sleep';
import { getTodayKey } from '../utils/time';
import { selectTechniques } from '../constants/techniques';
import { Translations } from '../i18n/types';
import { canGenerateInsight, consumeInsight } from './trialGuard';
import { DAILY_INSIGHT_PROMPT_VERSION, generateDailyInsight } from './insightApi';
import { maybeRequestReview } from './reviewPrompt';

const STORAGE_KEY = 'sleep_records';
export const sessionKey = (record: SleepRecord) => record.id ?? record.date;

interface TodayState {
  phase: DayPhase;
  bedtime: Date | null;
  wakeTime: Date | null;
  record: SleepRecord | null;
  techniqueIds: string[];
  recordDate: string;
}

function restoreToday(records: SleepRecord[]): TodayState {
  // Records are appended at Bedtime; edits never reorder them. Calendar date
  // is a display/grouping key, not a limit on restoring an ongoing session.
  const latest = records[records.length - 1];
  if (!latest) return {
    phase: 'idle', bedtime: null, wakeTime: null, record: null,
    techniqueIds: [], recordDate: getTodayKey(),
  };
  const phase = !latest.wakeTime ? 'sleeping'
    : latest.satisfaction === null ? 'check_in' : 'completed';
  return {
    phase,
    bedtime: latest.bedtime ? new Date(latest.bedtime) : null,
    wakeTime: latest.wakeTime ? new Date(latest.wakeTime) : null,
    record: phase === 'completed' ? latest : null,
    techniqueIds: latest.techniques,
    recordDate: latest.date,
  };
}

function insightFields(result: InsightResult): Partial<SleepRecord> {
  return {
    insight: result.message, insightTitle: result.title,
    insightFocusId: result.focusActionId, insightSource: result.source,
    insightModel: result.model,
    insightPromptVersion: result.promptVersion ?? DAILY_INSIGHT_PROMPT_VERSION,
    insightLocale: result.locale,
  };
}

function decodeRecords(raw: string | null): SleepRecord[] {
  if (raw === null) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('Invalid sleep_records format');
  // Keep the legacy array schema and all optional fields. Never overwrite an
  // unreadable store with empty defaults or silently discard invalid entries.
  for (const r of parsed) {
    if (!r || typeof r.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)
      || typeof r.bedtime !== 'string' || !Number.isFinite(Date.parse(r.bedtime))
      || (r.wakeTime !== null && (typeof r.wakeTime !== 'string' || !Number.isFinite(Date.parse(r.wakeTime))))
      || (r.satisfaction !== null && typeof r.satisfaction !== 'number')) {
      throw new Error('Invalid sleep record');
    }
  }
  return parsed;
}

export function createSleepStore(storage = AsyncStorage) {
  let state = {
    records: [] as SleepRecord[], today: restoreToday([]),
    generatingSessionKey: null as string | null,
    isHydrated: false, storageError: null as Error | null,
  };
  const listeners = new Set<() => void>();
  const publish = (next: typeof state) => {
    state = next;
    listeners.forEach((listener) => listener());
  };
  let hydration: Promise<void> | undefined;
  const hydrate = () => {
    if (!hydration) hydration = (async () => {
      try {
        const records = decodeRecords(await storage.getItem(STORAGE_KEY));
        const today = restoreToday(records);
        // Legacy check-ins did not persist their selected questions.
        if (today.phase === 'check_in' && today.techniqueIds.length === 0) {
          today.techniqueIds = selectTechniques(3, records);
        }
        publish({ ...state, records, today, isHydrated: true, storageError: null });
      } catch (error) {
        publish({ ...state, storageError: error as Error });
        throw error;
      }
    })();
    return hydration;
  };
  let queue: Promise<unknown> = Promise.resolve();
  // Serialize complete actions, including API responses. Each action reads
  // the current array after hydration and the previous durable write finish.
  const enqueue = (action: () => Promise<void>) => {
    const next = queue.then(async () => { await hydrate(); await action(); });
    queue = next.catch((error) => { publish({ ...state, storageError: error as Error }); });
    return next;
  };
  const save = async (records: SleepRecord[]) => {
    await storage.setItem(STORAGE_KEY, JSON.stringify(records));
    publish({ ...state, records, today: restoreToday(records), storageError: null });
  };
  const update = (record: SleepRecord) => save(state.records.map(
    (r) => sessionKey(r) === sessionKey(record) ? record : r,
  ));
  const latest = () => state.records[state.records.length - 1];

  // Transient presentation state only: never persisted or restored as pending.
  const whileGenerating = async (record: SleepRecord, work: () => Promise<void>) => {
    publish({ ...state, generatingSessionKey: sessionKey(record) });
    try { await work(); }
    finally { publish({ ...state, generatingSessionKey: null }); }
  };

  const editTime = (field: 'bedtime' | 'wakeTime', value: Date, t?: Translations, locale?: string) => enqueue(async () => {
    const rec = latest();
    if (!rec) return;
    const edited = { ...rec, [field]: value.toISOString() };
    // Persist the edit before requesting a new insight. The existing insight
    // survives a restart or API failure while regeneration is pending.
    await update(edited);
    if (edited.bedtime && edited.wakeTime && edited.satisfaction !== null && t && locale) {
      if (await canGenerateInsight(false)) {
        const { bedtime, wakeTime, satisfaction } = edited;
        await whileGenerating(edited, async () => {
          const result = await generateDailyInsight({
            bedtime: new Date(bedtime), wakeTime: new Date(wakeTime),
            sleepOnsetMinutes: edited.sleepOnsetMinutes ?? 0,
            nightWakeMinutes: edited.nightWakeMinutes ?? 0,
            satisfaction, techniqueIds: edited.techniques,
            techniqueResponses: edited.techniqueResponses,
            currentSession: edited, records: state.records, language: locale, t,
          });
          await update({ ...edited, ...insightFields(result) });
        });
      }
    }
  });

  const reload = () => enqueue(async () => {
    const records = decodeRecords(await storage.getItem(STORAGE_KEY));
    const today = restoreToday(records);
    if (today.phase === 'check_in' && today.techniqueIds.length === 0) {
      today.techniqueIds = selectTechniques(3, records);
    }
    publish({ ...state, records, today, isHydrated: true, storageError: null });
  });

  const actions = {
    recordBedtime: () => enqueue(async () => {
      if (state.today.phase === 'sleeping' || state.today.phase === 'check_in') return;
      const now = new Date();
      const date = getTodayKey();
      let id = now.toISOString();
      while (state.records.some((r) => sessionKey(r) === id)) id += '_';
      await save([...state.records, {
        id, date, bedtime: now.toISOString(), wakeTime: null,
        sleepOnsetMinutes: null, nightWakeMinutes: null, satisfaction: null,
        memo: '', techniques: [], techniqueResponses: {},
        insight: '', insightTitle: '', insightFocusId: '',
      }]);
    }),
    recordWakeUp: () => enqueue(async () => {
      const rec = latest();
      if (!rec || state.today.phase !== 'sleeping') return;
      await update({ ...rec, wakeTime: new Date().toISOString(), techniques: selectTechniques(3, state.records) });
    }),
    completeCheckIn: (data: CheckInData, t: Translations, locale: string) => enqueue(async () => {
      const rec = latest();
      if (!rec?.bedtime || !rec.wakeTime || state.today.phase !== 'check_in') return;
      const { bedtime, wakeTime } = rec;
      const insightRecords = state.records;
      let completed: SleepRecord = { ...rec, ...data, techniques: state.today.techniqueIds };
      await whileGenerating(rec, async () => {
        // Check-in data must survive even if the process ends during the API call.
        await update(completed);
        if (await canGenerateInsight(false)) {
          const result = await generateDailyInsight({
            bedtime: new Date(bedtime), wakeTime: new Date(wakeTime),
            ...data, techniqueIds: completed.techniques,
            currentSession: completed, records: insightRecords, language: locale, t,
          });
          completed = { ...completed, ...insightFields(result) };
          await update(completed);
          await consumeInsight();
        }
      });
      const count = state.records.filter((r) => r.wakeTime && r.satisfaction !== null).length;
      void maybeRequestReview(count, state.records).catch(() => {});
    }),
    editBedtime: (date: Date, t?: Translations, locale?: string) => editTime('bedtime', date, t, locale),
    editWakeTime: (date: Date, t?: Translations, locale?: string) => editTime('wakeTime', date, t, locale),
    deleteRecord: (key: string) => enqueue(async () => {
      await save(state.records.filter((r) => sessionKey(r) !== key));
    }),
    regenerateInsight: (t: Translations, locale: string) => enqueue(async () => {
      const rec = latest();
      if (!rec?.bedtime || !rec.wakeTime || rec.satisfaction === null) return;
      if (rec.insightLocale === locale) return;
      if (!rec.insight) return;
      if (!(await canGenerateInsight(false))) return;
      const { bedtime, wakeTime, satisfaction } = rec;
      await whileGenerating(rec, async () => {
        const result = await generateDailyInsight({
          bedtime: new Date(bedtime), wakeTime: new Date(wakeTime),
          sleepOnsetMinutes: rec.sleepOnsetMinutes ?? 0,
          nightWakeMinutes: rec.nightWakeMinutes ?? 0,
          satisfaction, techniqueIds: rec.techniques,
          techniqueResponses: rec.techniqueResponses,
          currentSession: rec, records: state.records, language: locale, t,
        });
        await update({ ...rec, ...insightFields(result) });
      });
    }),
  };
  return {
    hydrate, actions, reload, getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}
