import { TranslationKey } from '../i18n/types';
import { SleepRecord, Stats7d, QuestionWeights } from '../types/sleep';
import { calcTimeInBed, calcSleepEfficiency } from '../utils/time';

export type TechniqueCategory = 'MR' | 'CR' | 'SC' | 'SR';

export interface TechniqueDefinition {
  id: string;
  category: TechniqueCategory;
  labelKey: TranslationKey;
  eligibility?: (stats: Stats7d) => boolean;
}

const ONSET_ELIGIBILITY_MIN = 15;
const WASO_ELIGIBILITY_MIN = 10;

export const TECHNIQUE_DEFS: TechniqueDefinition[] = [
  { id: 'MR01', category: 'MR', labelKey: 'techMR01' },
  { id: 'MR02', category: 'MR', labelKey: 'techMR02' },
  { id: 'MR03', category: 'MR', labelKey: 'techMR03' },
  { id: 'MR04', category: 'MR', labelKey: 'techMR04' },
  { id: 'MR05', category: 'MR', labelKey: 'techMR05' },

  { id: 'CR01', category: 'CR', labelKey: 'techCR01' },
  { id: 'CR02', category: 'CR', labelKey: 'techCR02' },
  { id: 'CR03', category: 'CR', labelKey: 'techCR03' },
  { id: 'CR04', category: 'CR', labelKey: 'techCR04' },
  { id: 'CR05', category: 'CR', labelKey: 'techCR05' },
  { id: 'CR06', category: 'CR', labelKey: 'techCR06' },
  { id: 'CR07', category: 'CR', labelKey: 'techCR07' },
  { id: 'CR08', category: 'CR', labelKey: 'techCR08' },
  { id: 'CR09', category: 'CR', labelKey: 'techCR09' },
  { id: 'CR10', category: 'CR', labelKey: 'techCR10' },
  { id: 'CR11', category: 'CR', labelKey: 'techCR11' },
  { id: 'CR12', category: 'CR', labelKey: 'techCR12' },
  { id: 'CR13', category: 'CR', labelKey: 'techCR13' },
  { id: 'CR14', category: 'CR', labelKey: 'techCR14' },
  { id: 'CR15', category: 'CR', labelKey: 'techCR15' },

  { id: 'SC01', category: 'SC', labelKey: 'techSC01' },
  { id: 'SC02', category: 'SC', labelKey: 'techSC02' },
  {
    id: 'SC03', category: 'SC', labelKey: 'techSC03',
    eligibility: (s) => s.daysRecorded < 3 || s.avgSleepOnsetLatencyMin > ONSET_ELIGIBILITY_MIN,
  },
  {
    id: 'SC04', category: 'SC', labelKey: 'techSC04',
    eligibility: (s) => s.daysRecorded < 3 || s.avgSleepOnsetLatencyMin > ONSET_ELIGIBILITY_MIN,
  },
  {
    id: 'SC05', category: 'SC', labelKey: 'techSC05',
    eligibility: (s) => s.daysRecorded < 3 || s.avgWakeAfterSleepOnsetMin > WASO_ELIGIBILITY_MIN,
  },
  { id: 'SC06', category: 'SC', labelKey: 'techSC06' },
  { id: 'SC07', category: 'SC', labelKey: 'techSC07' },
  { id: 'SC08', category: 'SC', labelKey: 'techSC08' },
  { id: 'SC09', category: 'SC', labelKey: 'techSC09' },
  { id: 'SC10', category: 'SC', labelKey: 'techSC10' },
  { id: 'SC11', category: 'SC', labelKey: 'techSC11' },
  { id: 'SC12', category: 'SC', labelKey: 'techSC12' },
  { id: 'SC13', category: 'SC', labelKey: 'techSC13' },
  { id: 'SC14', category: 'SC', labelKey: 'techSC14' },

  { id: 'SR01', category: 'SR', labelKey: 'techSR01' },
  { id: 'SR02', category: 'SR', labelKey: 'techSR02' },
  { id: 'SR03', category: 'SR', labelKey: 'techSR03' },
  { id: 'SR04', category: 'SR', labelKey: 'techSR04' },
  { id: 'SR05', category: 'SR', labelKey: 'techSR05' },
  { id: 'SR06', category: 'SR', labelKey: 'techSR06' },
  { id: 'SR07', category: 'SR', labelKey: 'techSR07' },
  { id: 'SR08', category: 'SR', labelKey: 'techSR08' },
  { id: 'SR09', category: 'SR', labelKey: 'techSR09' },
  { id: 'SR10', category: 'SR', labelKey: 'techSR10' },
  { id: 'SR11', category: 'SR', labelKey: 'techSR11' },
  { id: 'SR12', category: 'SR', labelKey: 'techSR12' },
];

export const CATEGORY_LABEL_KEYS: Record<TechniqueCategory, TranslationKey> = {
  MR: 'techCatMR',
  CR: 'techCatCR',
  SC: 'techCatSC',
  SR: 'techCatSR',
};

const COOLDOWN_DAYS = 6;
const QUESTION_COUNT = 3;
const MAX_SAME_CATEGORY = 2;

function getCooldownSet(records: SleepRecord[]): Set<string> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - COOLDOWN_DAYS);
  const cutoffKey = `${cutoff.getFullYear()}-${(cutoff.getMonth() + 1).toString().padStart(2, '0')}-${cutoff.getDate().toString().padStart(2, '0')}`;
  const shown = new Set<string>();
  for (const r of records) {
    if (r.date >= cutoffKey) {
      for (const id of r.techniques) shown.add(id);
    }
  }
  return shown;
}

function pickCategory(weights: QuestionWeights): TechniqueCategory {
  const entries: [TechniqueCategory, number][] = [
    ['SR', weights.sleep_restriction],
    ['SC', weights.stimulus_control],
    ['CR', weights.cognitive_restructuring],
    ['MR', weights.mindfulness],
  ];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  if (total <= 0) return 'SC';
  let r = Math.random() * total;
  for (const [cat, w] of entries) {
    r -= w;
    if (r <= 0) return cat;
  }
  return 'MR';
}

const CATEGORY_WEIGHT_KEY: Record<TechniqueCategory, keyof QuestionWeights> = {
  SR: 'sleep_restriction',
  SC: 'stimulus_control',
  CR: 'cognitive_restructuring',
  MR: 'mindfulness',
};

export interface SelectDailyQuestionsInput {
  questionWeights: QuestionWeights;
  recentlyShownIds: Set<string>;
  stats: Stats7d;
}

export function selectDailyQuestions(input: SelectDailyQuestionsInput): string[] {
  const { questionWeights, recentlyShownIds, stats } = input;

  const eligible = TECHNIQUE_DEFS.filter(
    (t) => !t.eligibility || t.eligibility(stats),
  );

  const available: Record<TechniqueCategory, string[]> = { MR: [], CR: [], SC: [], SR: [] };
  for (const t of eligible) {
    if (!recentlyShownIds.has(t.id)) available[t.category].push(t.id);
  }

  const selected: string[] = [];
  const catCount: Record<TechniqueCategory, number> = { MR: 0, CR: 0, SC: 0, SR: 0 };

  for (let i = 0; i < QUESTION_COUNT; i++) {
    const nonEmpty = (Object.keys(available) as TechniqueCategory[]).filter(
      (c) => available[c].length > 0 && catCount[c] < MAX_SAME_CATEGORY,
    );
    if (nonEmpty.length === 0) break;

    const adjustedWeights: QuestionWeights = { ...questionWeights };
    for (const c of Object.keys(adjustedWeights) as (keyof QuestionWeights)[]) {
      const cat = Object.entries(CATEGORY_WEIGHT_KEY).find(([, v]) => v === c)?.[0] as TechniqueCategory | undefined;
      if (cat && !nonEmpty.includes(cat)) {
        adjustedWeights[c] = 0;
      }
    }

    const cat = pickCategory(adjustedWeights);
    const pool = available[cat];
    if (!pool || pool.length === 0) continue;

    const idx = Math.floor(Math.random() * pool.length);
    selected.push(pool[idx]);
    pool.splice(idx, 1);
    catCount[cat]++;
  }

  if (selected.length < QUESTION_COUNT) {
    const fallback = eligible
      .map((t) => t.id)
      .filter((id) => !selected.includes(id));
    while (selected.length < QUESTION_COUNT && fallback.length > 0) {
      const idx = Math.floor(Math.random() * fallback.length);
      selected.push(fallback[idx]);
      fallback.splice(idx, 1);
    }
  }

  return selected;
}

export function selectTechniques(count: number, records: SleepRecord[], stats?: Stats7d): string[] {
  const cooldown = getCooldownSet(records);

  const defaultWeights: QuestionWeights = {
    sleep_restriction: 30,
    stimulus_control: 30,
    cognitive_restructuring: 30,
    mindfulness: 10,
  };

  const s: Stats7d = stats ?? {
    daysRecorded: 0,
    avgTotalSleepTimeMin: 0,
    avgTimeInBedMin: 0,
    avgSleepEfficiencyPct: 0,
    avgSleepOnsetLatencyMin: 0,
    avgWakeAfterSleepOnsetMin: 0,
    avgSatisfaction: 0,
    sleepEfficiencyTrend: 'insufficient_data',
    sleepOnsetTrend: 'insufficient_data',
    wakeAfterSleepOnsetTrend: 'insufficient_data',
    sleepDurationTrend: 'insufficient_data',
    wakeTimeConsistency: 'moderate',
  };

  const weights = adjustWeightsFromRecords(defaultWeights, records);

  const result = selectDailyQuestions({
    questionWeights: weights,
    recentlyShownIds: cooldown,
    stats: s,
  });

  return result.slice(0, count);
}

function adjustWeightsFromRecords(
  base: QuestionWeights,
  records: SleepRecord[],
): QuestionWeights {
  const w: QuestionWeights = { ...base };
  const recent = records
    .filter((r) => r.wakeTime && r.satisfaction !== null)
    .slice(-7);

  if (recent.length < 2) return w;

  const wakeMins = recent
    .filter((r) => r.wakeTime)
    .map((r) => {
      const d = new Date(r.wakeTime!);
      return d.getHours() * 60 + d.getMinutes();
    });
  if (wakeMins.length >= 3) {
    const avg = wakeMins.reduce((a, b) => a + b, 0) / wakeMins.length;
    const variance = wakeMins.reduce((s, t) => s + (t - avg) ** 2, 0) / wakeMins.length;
    if (Math.sqrt(variance) > 30) w.sleep_restriction += 25;
  }

  const onsets = recent.filter((r) => r.sleepOnsetMinutes !== null);
  if (onsets.length > 0) {
    const avgOnset = onsets.reduce((s, r) => s + (r.sleepOnsetMinutes ?? 0), 0) / onsets.length;
    if (avgOnset > 20) w.stimulus_control += 25;
  }

  const wasos = recent.filter((r) => r.nightWakeMinutes !== null);
  if (wasos.length > 0) {
    const avgWaso = wasos.reduce((s, r) => s + (r.nightWakeMinutes ?? 0), 0) / wasos.length;
    if (avgWaso > 20) w.stimulus_control += 15;
  }

  const withEff = recent.filter((r) => r.bedtime && r.wakeTime && r.satisfaction !== null);
  if (withEff.length > 0) {
    const avgSat = withEff.reduce((s, r) => s + (r.satisfaction ?? 0), 0) / withEff.length;
    const avgEff =
      withEff.reduce((s, r) => {
        const tib = calcTimeInBed(new Date(r.bedtime!), new Date(r.wakeTime!));
        return s + calcSleepEfficiency(tib, r.sleepOnsetMinutes ?? 0, r.nightWakeMinutes ?? 0);
      }, 0) / withEff.length;
    if (avgSat < 3 && avgEff > 80) w.cognitive_restructuring += 25;
  }

  w.sleep_restriction = Math.min(w.sleep_restriction, 70);
  w.stimulus_control = Math.min(w.stimulus_control, 70);
  w.cognitive_restructuring = Math.min(w.cognitive_restructuring, 70);
  w.mindfulness = Math.min(w.mindfulness, 70);

  return w;
}
