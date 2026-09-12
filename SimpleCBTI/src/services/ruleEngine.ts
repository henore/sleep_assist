import { Stats7d, TechniqueResponse, RuleEngineResult, FocusCategory, QuestionWeights } from '../types/sleep';
import { TechniqueCategory } from '../constants/techniques';

// --- Thresholds (named constants) ---

const EFFICIENCY_ABOVE_AVG_THRESHOLD = 3;
const EFFICIENCY_BELOW_AVG_THRESHOLD = 5;
const SLEEP_ONSET_LONG_MIN = 30;
const SLEEP_ONSET_LONGER_THAN_USUAL_OFFSET = 10;
const WASO_HIGH_MIN = 30;
const WASO_HIGHER_THAN_USUAL_OFFSET = 10;
const LOW_EFFICIENCY_PCT = 80;
const HIGH_EFFICIENCY_FOR_SATISFACTION_PCT = 85;
const LOW_SATISFACTION_THRESHOLD = 2;
const MIN_DAYS_FOR_COMPARISON = 2;

const WEIGHT_BOOST = 25;

const BASE_QUESTION_WEIGHTS: QuestionWeights = {
  sleep_restriction: 30,
  stimulus_control: 30,
  cognitive_restructuring: 30,
  mindfulness: 10,
};

const MAX_CATEGORY_WEIGHT = 70;

// --- Signals ---

export const POSITIVE_SIGNALS = {
  EFFICIENCY_ABOVE_AVG: 'sleep_efficiency_above_7d_average',
  EFFICIENCY_IMPROVING: 'sleep_efficiency_improving',
  ONSET_IMPROVING: 'sleep_onset_improving',
  WASO_IMPROVING: 'wake_after_sleep_onset_improving',
  DURATION_IMPROVING: 'sleep_duration_improving',
  SATISFACTION_IMPROVING: 'satisfaction_improving',
  WAKE_TIME_CONSISTENT: 'wake_time_consistent',
  SR_COMPLETED: 'sleep_restriction_completed',
  SC_COMPLETED: 'stimulus_control_completed',
  CR_COMPLETED: 'cognitive_restructuring_completed',
  MR_COMPLETED: 'mindfulness_completed',
} as const;

export const ATTENTION_SIGNALS = {
  EFFICIENCY_BELOW_AVG: 'sleep_efficiency_below_recent_average',
  ONSET_LONGER_THAN_USUAL: 'sleep_onset_longer_than_usual',
  ONSET_LONG: 'sleep_onset_long',
  WASO_HIGH: 'wake_after_sleep_onset_high',
  WASO_HIGHER_THAN_USUAL: 'wake_after_sleep_onset_higher_than_usual',
  LOW_EFFICIENCY: 'low_efficiency',
  WAKE_TIME_INCONSISTENT: 'wake_time_inconsistent',
  SR_NOT_COMPLETED: 'sleep_restriction_not_completed',
  SC_NOT_COMPLETED: 'stimulus_control_not_completed',
  CR_NOT_COMPLETED: 'cognitive_restructuring_not_completed',
  MR_NOT_COMPLETED: 'mindfulness_not_completed',
  LOW_SATISFACTION_GOOD_EFFICIENCY: 'low_satisfaction_despite_good_efficiency',
  EFFICIENCY_WORSENING: 'sleep_efficiency_worsening',
  ONSET_WORSENING: 'sleep_onset_worsening',
} as const;

// --- Interfaces ---

export interface TodayMetrics {
  sleepEfficiencyPct: number;
  sleepOnsetMin: number;
  wasoMin: number;
  satisfaction: number;
}

export interface ActionEntry {
  id: string;
  category: TechniqueCategory;
  result: TechniqueResponse;
}

const CATEGORY_FULL: Record<TechniqueCategory, keyof QuestionWeights> = {
  SR: 'sleep_restriction',
  SC: 'stimulus_control',
  CR: 'cognitive_restructuring',
  MR: 'mindfulness',
};

// --- Main function ---

export function evaluateSleepSession(
  today: TodayMetrics,
  actions: ActionEntry[],
  stats: Stats7d,
): RuleEngineResult {
  const positive = detectPositiveSignals(today, actions, stats);
  const attention = detectAttentionSignals(today, actions, stats);
  const recommendedFocus = determineRecommendedFocus(today, attention, stats);
  const questionWeights = computeQuestionWeights(today, stats);
  return { positiveSignals: positive, attentionSignals: attention, recommendedFocus, questionWeights };
}

// backward compat alias
export const runRuleEngine = evaluateSleepSession;

// --- Positive signal detection ---

function detectPositiveSignals(
  today: TodayMetrics,
  actions: ActionEntry[],
  stats: Stats7d,
): string[] {
  const signals: string[] = [];

  if (stats.daysRecorded >= MIN_DAYS_FOR_COMPARISON
    && today.sleepEfficiencyPct > stats.avgSleepEfficiencyPct + EFFICIENCY_ABOVE_AVG_THRESHOLD) {
    signals.push(POSITIVE_SIGNALS.EFFICIENCY_ABOVE_AVG);
  }

  if (stats.sleepEfficiencyTrend === 'improving') signals.push(POSITIVE_SIGNALS.EFFICIENCY_IMPROVING);
  if (stats.sleepOnsetTrend === 'improving') signals.push(POSITIVE_SIGNALS.ONSET_IMPROVING);
  if (stats.wakeAfterSleepOnsetTrend === 'improving') signals.push(POSITIVE_SIGNALS.WASO_IMPROVING);
  if (stats.sleepDurationTrend === 'improving') signals.push(POSITIVE_SIGNALS.DURATION_IMPROVING);

  if (stats.wakeTimeConsistency === 'good') signals.push(POSITIVE_SIGNALS.WAKE_TIME_CONSISTENT);

  for (const a of actions) {
    if (a.result === 'done') {
      signals.push(POSITIVE_SIGNALS[`${categoryShort(a.category)}_COMPLETED` as keyof typeof POSITIVE_SIGNALS] ?? `${CATEGORY_FULL[a.category]}_completed`);
    }
  }

  return signals;
}

function categoryShort(cat: TechniqueCategory): string {
  return ({ SR: 'SR', SC: 'SC', CR: 'CR', MR: 'MR' })[cat];
}

// --- Attention signal detection ---

function detectAttentionSignals(
  today: TodayMetrics,
  actions: ActionEntry[],
  stats: Stats7d,
): string[] {
  const signals: string[] = [];

  if (stats.daysRecorded >= MIN_DAYS_FOR_COMPARISON
    && today.sleepEfficiencyPct < stats.avgSleepEfficiencyPct - EFFICIENCY_BELOW_AVG_THRESHOLD) {
    signals.push(ATTENTION_SIGNALS.EFFICIENCY_BELOW_AVG);
  }

  if (today.sleepOnsetMin > SLEEP_ONSET_LONG_MIN) {
    signals.push(ATTENTION_SIGNALS.ONSET_LONG);
  }
  if (stats.daysRecorded >= MIN_DAYS_FOR_COMPARISON
    && today.sleepOnsetMin > stats.avgSleepOnsetLatencyMin + SLEEP_ONSET_LONGER_THAN_USUAL_OFFSET) {
    signals.push(ATTENTION_SIGNALS.ONSET_LONGER_THAN_USUAL);
  }

  if (today.wasoMin > WASO_HIGH_MIN) {
    signals.push(ATTENTION_SIGNALS.WASO_HIGH);
  }
  if (stats.daysRecorded >= MIN_DAYS_FOR_COMPARISON
    && today.wasoMin > stats.avgWakeAfterSleepOnsetMin + WASO_HIGHER_THAN_USUAL_OFFSET) {
    signals.push(ATTENTION_SIGNALS.WASO_HIGHER_THAN_USUAL);
  }

  if (today.sleepEfficiencyPct < LOW_EFFICIENCY_PCT) {
    signals.push(ATTENTION_SIGNALS.LOW_EFFICIENCY);
  }

  if (stats.wakeTimeConsistency === 'poor') {
    signals.push(ATTENTION_SIGNALS.WAKE_TIME_INCONSISTENT);
  }

  if (today.sleepEfficiencyPct >= HIGH_EFFICIENCY_FOR_SATISFACTION_PCT
    && today.satisfaction <= LOW_SATISFACTION_THRESHOLD) {
    signals.push(ATTENTION_SIGNALS.LOW_SATISFACTION_GOOD_EFFICIENCY);
  }

  for (const a of actions) {
    if (a.result === 'failed') {
      const catFull = CATEGORY_FULL[a.category];
      signals.push(`${catFull}_not_completed`);
    }
  }

  if (stats.sleepEfficiencyTrend === 'worsening') signals.push(ATTENTION_SIGNALS.EFFICIENCY_WORSENING);
  if (stats.sleepOnsetTrend === 'worsening') signals.push(ATTENTION_SIGNALS.ONSET_WORSENING);

  return signals;
}

// --- Recommended focus (single topic for AI) ---

function determineRecommendedFocus(
  today: TodayMetrics,
  attentionSignals: string[],
  stats: Stats7d,
): FocusCategory {
  const has = (s: string) => attentionSignals.includes(s);

  if (has(ATTENTION_SIGNALS.WAKE_TIME_INCONSISTENT)) return 'sleep_restriction';

  if (has(ATTENTION_SIGNALS.ONSET_LONG) || has(ATTENTION_SIGNALS.ONSET_LONGER_THAN_USUAL)) {
    return 'stimulus_control';
  }

  if (has(ATTENTION_SIGNALS.WASO_HIGH) || has(ATTENTION_SIGNALS.WASO_HIGHER_THAN_USUAL)) {
    return 'stimulus_control';
  }

  if (has(ATTENTION_SIGNALS.LOW_SATISFACTION_GOOD_EFFICIENCY)) return 'cognitive_restructuring';

  if (has(ATTENTION_SIGNALS.LOW_EFFICIENCY)) return 'stimulus_control';

  const failedCategories = attentionSignals
    .filter((s) => s.endsWith('_not_completed'))
    .map((s) => s.replace('_not_completed', '') as FocusCategory);
  if (failedCategories.length > 0) return failedCategories[0];

  return 'maintenance';
}

// --- Question weights ---

export function computeQuestionWeights(today: TodayMetrics, stats: Stats7d): QuestionWeights {
  const w: QuestionWeights = { ...BASE_QUESTION_WEIGHTS };

  if (stats.wakeTimeConsistency === 'poor') {
    w.sleep_restriction += WEIGHT_BOOST;
  }

  if (today.sleepOnsetMin > SLEEP_ONSET_LONG_MIN
    || (stats.daysRecorded >= MIN_DAYS_FOR_COMPARISON
      && today.sleepOnsetMin > stats.avgSleepOnsetLatencyMin + SLEEP_ONSET_LONGER_THAN_USUAL_OFFSET)) {
    w.stimulus_control += WEIGHT_BOOST;
  }

  if (today.wasoMin > WASO_HIGH_MIN
    || (stats.daysRecorded >= MIN_DAYS_FOR_COMPARISON
      && today.wasoMin > stats.avgWakeAfterSleepOnsetMin + WASO_HIGHER_THAN_USUAL_OFFSET)) {
    w.stimulus_control += WEIGHT_BOOST;
  }

  if (today.sleepEfficiencyPct >= HIGH_EFFICIENCY_FOR_SATISFACTION_PCT
    && today.satisfaction <= LOW_SATISFACTION_THRESHOLD) {
    w.cognitive_restructuring += WEIGHT_BOOST;
  }

  w.sleep_restriction = Math.min(w.sleep_restriction, MAX_CATEGORY_WEIGHT);
  w.stimulus_control = Math.min(w.stimulus_control, MAX_CATEGORY_WEIGHT);
  w.cognitive_restructuring = Math.min(w.cognitive_restructuring, MAX_CATEGORY_WEIGHT);
  w.mindfulness = Math.min(w.mindfulness, MAX_CATEGORY_WEIGHT);

  return w;
}
