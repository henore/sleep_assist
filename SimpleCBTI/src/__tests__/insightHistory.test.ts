import { SleepRecord } from '../types/sleep';
import { getPreviousCompletedSessions, calculateSessionStats } from '../services/statsCalculator';
import { buildDailyInsightPayload } from '../services/insightApi';
import { evaluateSleepSession } from '../services/ruleEngine';
import { en } from '../i18n/locales/en';

const record = (day: number, efficiency = 90, overrides: Partial<SleepRecord> = {}): SleepRecord => ({
  id: `session-${day}`, date: `2026-01-${String(day).padStart(2, '0')}`,
  bedtime: `2026-01-${String(day).padStart(2, '0')}T00:00:00Z`,
  wakeTime: `2026-01-${String(day).padStart(2, '0')}T01:40:00Z`,
  sleepOnsetMinutes: 100 - efficiency, nightWakeMinutes: 0, satisfaction: 3,
  memo: 'PRIVATE NOTE', techniques: [], techniqueResponses: {}, insight: '', insightTitle: '', insightFocusId: '',
  ...overrides,
});
const evaluate = (efficiency: number, previous: SleepRecord[]) => evaluateSleepSession(
  { sleepEfficiencyPct: efficiency, sleepOnsetMin: 10, wasoMin: 10, satisfaction: 3 },
  [{ id: 'CR01', category: 'CR', result: 'done' }], calculateSessionStats(previous, 7), previous,
);

test.each([[75, []], [77, [record(2, 89), record(1, 90)]] ] as [number, SleepRecord[]][])(
  'A/B: isolated low efficiency %s stays an observation', (eff, previous) => {
    const result = evaluate(eff, previous);
    expect(result.attentionSignals).toContain('low_efficiency');
    expect(result.attentionSignals).not.toContain('repeated_low_efficiency');
    expect(result.recommendedFocus).toBe('maintenance');
    expect(result.positiveSignals).toContain('cognitive_restructuring_completed');
  },
);
test('C: two of three low-efficiency sessions influence focus', () => {
  const result = evaluate(79, [record(2, 76), record(1, 78)]);
  expect(result.attentionSignals).toContain('repeated_low_efficiency');
  expect(result.recommendedFocus).toBe('stimulus_control');
});
test.each(['sleepOnsetMin', 'wasoMin'] as const)('isolated %s preserves failed check-in focus; repetition influences focus', (key) => {
  const today = { sleepEfficiencyPct: 90, sleepOnsetMin: 10, wasoMin: 10, satisfaction: 3, [key]: 40 };
  const good = [record(2, 98), record(1, 98)];
  const actions = [{ id: 'CR01', category: 'CR' as const, result: 'failed' as const }];
  expect(evaluateSleepSession(today, actions, calculateSessionStats(good, 7), good).recommendedFocus).toBe('cognitive_restructuring');
  const repeated = good.map((r) => ({ ...r, [key === 'wasoMin' ? 'nightWakeMinutes' : 'sleepOnsetMinutes']: 40 }));
  expect(evaluateSleepSession(today, actions, calculateSessionStats(repeated, 7), repeated).recommendedFocus).toBe('stimulus_control');
});
test('D: first generation and all metric edits use the same previous sessions', () => {
  const current = record(12);
  const past = Array.from({length: 10}, (_, i) => record(i + 1));
  const payload = (session: SleepRecord, all: SleepRecord[]) => buildDailyInsightPayload({
    currentSession: session, bedtime: new Date(session.bedtime!), wakeTime: new Date(session.wakeTime!),
    sleepOnsetMinutes: session.sleepOnsetMinutes!, nightWakeMinutes: session.nightWakeMinutes!, satisfaction: 3,
    techniqueIds: [], techniqueResponses: {}, records: all, language: 'en', t: en,
  });
  const first = payload(current, [...past, {...current, satisfaction: null}]);
  for (const changes of [
    { bedtime: '2026-01-11T23:00:00Z' }, { wakeTime: '2026-01-13T01:00:00Z' },
    { sleepOnsetMinutes: 55 }, { nightWakeMinutes: 55 },
  ]) {
    const edited = { ...current, ...changes };
    expect(payload(edited, [...past, edited]).stats7d).toEqual(first.stats7d);
    expect(getPreviousCompletedSessions(edited, [...past, edited]).map((r) => r.id)).toEqual(['session-10','session-9','session-8','session-7','session-6','session-5','session-4']);
  }
  expect(JSON.stringify(first)).not.toContain('PRIVATE NOTE');
  expect(first).not.toHaveProperty('records');
});
test('E/F: completed only, strictly previous, newest seven, no future records; source remains intact', () => {
  const past = Array.from({length: 10}, (_, i) => record(i + 1));
  const current = record(12);
  const all = [...past, record(11, 90, { satisfaction: null }), current, record(13),
    record(1, 90, { id: 'corrupt-future', wakeTime: '2099-01-01T10:00:00Z' }),
    record(1, 90, { id: 'future-date', date: '2099-01-01' })];
  const snapshot = JSON.stringify(all);
  const selected = getPreviousCompletedSessions(current, all);
  expect(selected.map((r) => r.id)).toEqual(['session-10','session-9','session-8','session-7','session-6','session-5','session-4']);
  expect(JSON.stringify(all)).toBe(snapshot);
});
test('legacy date-key session is excluded after its times change', () => {
  const current = record(12, 90, { id: undefined });
  expect(getPreviousCompletedSessions(current, [record(11), {...current, bedtime: '2026-01-11T22:00:00Z'}]).map(r => r.date)).toEqual(['2026-01-11']);
});
test('same-day sessions use stable insertion order', () => {
  const first = record(12, 90, {id:'first'}), current = record(12, 90, {id:'current'}), later = record(12, 90, {id:'later'});
  expect(getPreviousCompletedSessions(current, [first,current,later]).map(r=>r.id)).toEqual(['first']);
});
test.each([0,1,2,3,4,5,6,7])('%s previous sessions: directional trends require seven', (count) => {
  const stats = calculateSessionStats(Array.from({length:count}, (_,i)=>record(i+1,80+i)),7);
  expect(stats.daysRecorded).toBe(count);
  expect(stats.sleepEfficiencyTrend).toBe(count < 7 ? 'insufficient_data' : 'improving');
});
