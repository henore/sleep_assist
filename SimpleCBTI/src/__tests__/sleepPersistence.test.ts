import { getSleepDisplayDate } from '../utils/time';
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true, default: { getItem: jest.fn(), setItem: jest.fn() },
}));
jest.mock('../services/trialGuard', () => ({
  canGenerateInsight: jest.fn(async () => true), consumeInsight: jest.fn(async () => {}),
}));
jest.mock('../services/insightApi', () => ({
  DAILY_INSIGHT_PROMPT_VERSION: 'v2',
  generateDailyInsight: jest.fn(async () => ({
    title: 'Saved title', message: 'Saved message', focusActionId: 'SC1',
    source: 'openai', model: 'test-model', promptVersion: 'v2',
  })),
}));
jest.mock('../services/reviewPrompt', () => ({ maybeRequestReview: jest.fn(async () => {}) }));

import { createSleepStore, sessionKey } from '../services/sleepStore';
import { visibleSleepHistory } from '../services/sleepHistory';
import { calculate7dStats } from '../services/statsCalculator';
import { generateDailyInsight } from '../services/insightApi';
import { en } from '../i18n/locales/en';
import { SleepRecord } from '../types/sleep';
import AsyncStorage from '@react-native-async-storage/async-storage';

function memoryStorage() {
  let raw: string | null = null;
  const storage = {
    getItem: jest.fn(async () => raw),
    setItem: jest.fn(async (_key: string, value: string) => { raw = value; }),
  };
  return {
    storage: storage as unknown as typeof AsyncStorage,
    read: () => JSON.parse(raw ?? '[]') as SleepRecord[],
    seed: (value: string) => { raw = value; },
    getItem: storage.getItem, setItem: storage.setItem,
  };
}

type Store = ReturnType<typeof createSleepStore>;
const data = { sleepOnsetMinutes: 20, nightWakeMinutes: 10, satisfaction: 4, memo: 'Keep this memo', techniqueResponses: {} };
function clock(day: number, hour: number) { jest.setSystemTime(new Date(2026, 8, day, hour)); }
async function night(store: Store, day: number) {
  clock(day, 23);
  await store.actions.recordBedtime();
  clock(day + 1, 7);
  await store.actions.recordWakeUp();
  await store.actions.completeCheckIn(data, en, 'en');
}

beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); clock(1, 12); });
afterEach(() => jest.useRealTimers());

test('TEST 1–7: Day1 + Day2, process restart, Day3, restore insight and recompute statistics', async () => {
  const disk = memoryStorage();
  let store = createSleepStore(disk.storage);
  await night(store, 1);
  expect(disk.read().map((r) => r.date)).toEqual(['2026-09-01']);
  await night(store, 2);
  expect(disk.read().map((r) => r.date)).toEqual(['2026-09-01', '2026-09-02']);
  store = createSleepStore(disk.storage);
  await store.hydrate();
  expect(store.getSnapshot().records).toEqual(disk.read());
  expect(store.getSnapshot().today.phase).toBe('completed');
  await night(store, 3);
  const before = store.getSnapshot().records;
  const stats = calculate7dStats(before);
  expect(stats.daysRecorded).toBe(3);
  expect(stats.avgTotalSleepTimeMin).toBe(450);
  expect(stats.avgTimeInBedMin).toBe(480);
  expect(stats.avgSleepEfficiencyPct).toBe(94);
  const calls = jest.mocked(generateDailyInsight).mock.calls.length;
  store = createSleepStore(disk.storage);
  await store.hydrate();
  expect(store.getSnapshot().records).toEqual(before);
  expect(store.getSnapshot().records).toHaveLength(3);
  expect(calculate7dStats(store.getSnapshot().records)).toEqual(stats);
  expect(store.getSnapshot().today.record).toMatchObject({
    date: '2026-09-03', insight: 'Saved message', insightTitle: 'Saved title',
    insightFocusId: 'SC1', insightSource: 'openai', insightModel: 'test-model',
    insightPromptVersion: 'v2', memo: data.memo,
  });
  expect(generateDailyInsight).toHaveBeenCalledTimes(calls);
});

test('TEST 8: active bedtime and check-in restore even beyond yesterday', async () => {
  const disk = memoryStorage();
  let store = createSleepStore(disk.storage);
  await night(store, 1);
  clock(2, 23);
  await store.actions.recordBedtime();
  const bedtime = store.getSnapshot().today.bedtime;
  clock(5, 7);
  store = createSleepStore(disk.storage);
  await store.hydrate();
  expect(store.getSnapshot().today.phase).toBe('sleeping');
  expect(store.getSnapshot().today.bedtime).toEqual(bedtime);
  await store.actions.recordWakeUp();
  const techniques = store.getSnapshot().today.techniqueIds;
  store = createSleepStore(disk.storage);
  await store.hydrate();
  expect(store.getSnapshot().today.phase).toBe('check_in');
  expect(store.getSnapshot().today.techniqueIds).toEqual(techniques);
  expect(generateDailyInsight).toHaveBeenCalledTimes(1);
});

test('TEST 9: edits update the same ID; same-date next bedtime does not delete a completed session', async () => {
  const disk = memoryStorage();
  const store = createSleepStore(disk.storage);
  await night(store, 1);
  const id = sessionKey(disk.read()[0]);
  await store.actions.editBedtime(new Date(2026, 8, 1, 22), en, 'en');
  await store.actions.editWakeTime(new Date(2026, 8, 2, 8), en, 'en');
  expect(disk.read()).toHaveLength(1);
  expect(sessionKey(disk.read()[0])).toBe(id);
  // Start and finish twice within the same calendar date.
  clock(2, 10);
  await store.actions.recordBedtime();
  clock(2, 11);
  await store.actions.recordWakeUp();
  await store.actions.completeCheckIn(data, en, 'en');
  clock(2, 23);
  await store.actions.recordBedtime();
  expect(disk.read()).toHaveLength(3);
  expect(new Set(disk.read().map(sessionKey)).size).toBe(3);
  await store.actions.deleteRecord(sessionKey(disk.read()[1]));
  expect(disk.read()).toHaveLength(2);
  expect(sessionKey(disk.read()[0])).toBe(id);
});

test('TEST 10: 30 days persist, Free selector exposes 7 days and Pro restores all 30', async () => {
  const disk = memoryStorage();
  let store = createSleepStore(disk.storage);
  for (let day = 1; day <= 30; day++) await night(store, day);
  clock(30, 23);
  expect(disk.read()).toHaveLength(30);
  expect(visibleSleepHistory(store.getSnapshot().records, false)).toHaveLength(7);
  expect(visibleSleepHistory(store.getSnapshot().records, true)).toHaveLength(30);
  store = createSleepStore(disk.storage);
  await store.hydrate();
  expect(store.getSnapshot().records).toHaveLength(30);
  expect(visibleSleepHistory(store.getSnapshot().records, true)).toEqual(disk.read());
});

test('delayed hydration cannot overwrite history; multiple subscribers observe the same updates', async () => {
  const disk = memoryStorage();
  const original = createSleepStore(disk.storage);
  await night(original, 1);
  const raw = JSON.stringify(disk.read());
  let resolveRead!: (value: string) => void;
  disk.getItem.mockImplementationOnce(() => new Promise((resolve) => { resolveRead = resolve; }));
  const store = createSleepStore(disk.storage);
  const history = jest.fn();
  const stats = jest.fn();
  store.subscribe(history);
  store.subscribe(stats);
  const writes = disk.setItem.mock.calls.length;
  const hydration = store.hydrate();
  const start = store.actions.recordBedtime();
  await Promise.resolve();
  expect(disk.setItem).toHaveBeenCalledTimes(writes);
  resolveRead(raw);
  await Promise.all([hydration, start]);
  expect(disk.read()).toHaveLength(2);
  expect(history).toHaveBeenCalledTimes(2);
  expect(stats).toHaveBeenCalledTimes(2);
});

test('legacy array without IDs restores previous-day completed insight without writes or API calls', async () => {
  const disk = memoryStorage();
  await night(createSleepStore(disk.storage), 1);
  const records = disk.read().map(({ id, insightSource, insightModel, insightPromptVersion, ...r }) => r);
  disk.seed(JSON.stringify(records));
  jest.clearAllMocks();
  const store = createSleepStore(disk.storage);
  await Promise.all([store.hydrate(), store.hydrate()]);
  expect(store.getSnapshot().today.record?.insight).toBe('Saved message');
  expect(disk.getItem).toHaveBeenCalledTimes(1);
  expect(disk.setItem).not.toHaveBeenCalled();
  expect(generateDailyInsight).not.toHaveBeenCalled();
  await store.actions.editWakeTime(new Date(2026, 8, 2, 8));
  expect(disk.read()).toHaveLength(1);
});

test('corrupt/read-failed storage cannot be overwritten by a new bedtime', async () => {
  const disk = memoryStorage();
  disk.seed('{invalid');
  let store = createSleepStore(disk.storage);
  await expect(store.actions.recordBedtime()).rejects.toThrow();
  expect(disk.setItem).not.toHaveBeenCalled();
  expect(store.getSnapshot().isHydrated).toBe(false);
  disk.getItem.mockRejectedValueOnce(new Error('read failed'));
  store = createSleepStore(disk.storage);
  await expect(store.actions.recordBedtime()).rejects.toThrow('read failed');
  expect(disk.setItem).not.toHaveBeenCalled();
});

test('failed writes do not publish success and a retry preserves history', async () => {
  const disk = memoryStorage();
  const store = createSleepStore(disk.storage);
  await night(store, 1);
  const before = disk.read();
  disk.setItem.mockRejectedValueOnce(new Error('write failed'));
  await expect(store.actions.recordBedtime()).rejects.toThrow('write failed');
  expect(store.getSnapshot().records).toEqual(before);
  expect(disk.read()).toEqual(before);
  await store.actions.recordBedtime();
  expect(disk.read()).toHaveLength(2);
});

test('duplicate actions serialize without duplicate sessions or check-in generation', async () => {
  const disk = memoryStorage();
  const store = createSleepStore(disk.storage);
  await Promise.all([store.actions.recordBedtime(), store.actions.recordBedtime()]);
  expect(disk.read()).toHaveLength(1);
  clock(2, 7);
  await Promise.all([store.actions.recordWakeUp(), store.actions.recordWakeUp()]);
  await Promise.all([store.actions.completeCheckIn(data, en, 'en'), store.actions.completeCheckIn(data, en, 'en')]);
  expect(generateDailyInsight).toHaveBeenCalledTimes(1);
  expect(disk.read()).toHaveLength(1);
});

test('process termination during insight generation preserves check-in; hydration never retries the API', async () => {
  const disk = memoryStorage();
  const store = createSleepStore(disk.storage);
  await store.actions.recordBedtime();
  clock(2, 7);
  await store.actions.recordWakeUp();
  let finish!: (result: Awaited<ReturnType<typeof generateDailyInsight>>) => void;
  let started!: () => void;
  const generating = new Promise<void>((resolve) => { started = resolve; });
  jest.mocked(generateDailyInsight).mockImplementationOnce(() => {
    started();
    return new Promise((resolve) => { finish = resolve; });
  });
  const pending = store.actions.completeCheckIn(data, en, 'en');
  await generating;
  expect(store.getSnapshot().generatingSessionKey).toBe(sessionKey(disk.read()[0]));
  const restarted = createSleepStore(disk.storage);
  await restarted.hydrate();
  expect(restarted.getSnapshot().generatingSessionKey).toBeNull();
  expect(restarted.getSnapshot().today.phase).toBe('completed');
  expect(restarted.getSnapshot().today.record).toMatchObject(data);
  expect(generateDailyInsight).toHaveBeenCalledTimes(1);
  finish({ title: 'Done', message: 'Saved', focusActionId: 'SC1', source: 'fallback' });
  await pending;
  expect(store.getSnapshot().generatingSessionKey).toBeNull();
  expect(disk.read()[0]).toMatchObject({ insight: 'Saved', insightSource: 'fallback' });
  const afterFallbackRestart = createSleepStore(disk.storage);
  await afterFallbackRestart.hydrate();
  expect(afterFallbackRestart.getSnapshot().today.record?.insightSource).toBe('fallback');
});

test('a rejected generation clears transient waiting state even when an unexpected error escapes', async () => {
  const disk = memoryStorage();
  const store = createSleepStore(disk.storage);
  await store.actions.recordBedtime();
  clock(2, 7);
  await store.actions.recordWakeUp();
  jest.mocked(generateDailyInsight).mockRejectedValueOnce(new Error('Unexpected failure'));
  await expect(store.actions.completeCheckIn(data, en, 'en')).rejects.toThrow('Unexpected failure');
  expect(store.getSnapshot().generatingSessionKey).toBeNull();
  expect(store.getSnapshot().today.phase).toBe('completed');
  expect(disk.read()[0].memo).toBe(data.memo);
});

test.each([false, true])('edited display date survives restart without changing identity (legacy=%s)', async (legacy) => {
  const disk = memoryStorage();
  let store = createSleepStore(disk.storage);
  await night(store, 1);
  if (legacy) {
    disk.seed(JSON.stringify(disk.read().map(({id, ...record}) => record)));
    store = createSleepStore(disk.storage);
    await store.hydrate();
  }
  const before = disk.read()[0];
  clock(12, 12);
  await store.actions.editBedtime(new Date(2026, 8, 10, 23));
  await store.actions.editWakeTime(new Date(2026, 8, 11, 7));
  const edited = disk.read()[0];
  expect(disk.read()).toHaveLength(1);
  expect(sessionKey(edited)).toBe(sessionKey(before));
  expect(edited.date).toBe(before.date);
  expect(getSleepDisplayDate(edited)).toBe('2026-09-10');
  expect(visibleSleepHistory(disk.read(), false)).toHaveLength(1);
  const restarted = createSleepStore(disk.storage);
  await restarted.hydrate();
  expect(getSleepDisplayDate(restarted.getSnapshot().records[0])).toBe('2026-09-10');
  await restarted.actions.deleteRecord(sessionKey(before));
  expect(disk.read()).toHaveLength(0);
});

test('display date follows local bedtime across midnight, with legacy fallback', () => {
  expect(getSleepDisplayDate({date:'2026-09-01',bedtime:new Date(2026,8,10,0,15).toISOString()})).toBe('2026-09-10');
  expect(getSleepDisplayDate({date:'2026-09-01',bedtime:null})).toBe('2026-09-01');
});
