export type DayPhase =
  | 'idle'
  | 'sleeping'
  | 'check_in'
  | 'completed';

export type TechniqueResponse = 'done' | 'na' | 'failed';

export interface SleepRecord {
  id?: string;
  date: string;
  bedtime: string | null;
  wakeTime: string | null;
  sleepOnsetMinutes: number | null;
  nightWakeMinutes: number | null;
  satisfaction: number | null;
  memo: string;
  techniques: string[];
  techniqueResponses: Record<string, TechniqueResponse>;
  insight: string;
  insightTitle: string;
  insightFocusId: string;
  insightSource?: InsightSource;
  insightModel?: string;
  insightPromptVersion?: string;
  insightLocale?: string;
}

export type TrendDirection = 'improving' | 'stable' | 'worsening' | 'insufficient_data';
export type ConsistencyLevel = 'good' | 'moderate' | 'poor';

export type FocusCategory =
  | 'sleep_restriction'
  | 'stimulus_control'
  | 'cognitive_restructuring'
  | 'mindfulness'
  | 'maintenance';

export interface QuestionWeights {
  sleep_restriction: number;
  stimulus_control: number;
  cognitive_restructuring: number;
  mindfulness: number;
}

export interface Stats7d {
  daysRecorded: number;
  avgTotalSleepTimeMin: number;
  avgTimeInBedMin: number;
  avgSleepEfficiencyPct: number;
  avgSleepOnsetLatencyMin: number;
  avgWakeAfterSleepOnsetMin: number;
  avgSatisfaction: number;
  sleepEfficiencyTrend: TrendDirection;
  sleepOnsetTrend: TrendDirection;
  wakeAfterSleepOnsetTrend: TrendDirection;
  sleepDurationTrend: TrendDirection;
  wakeTimeConsistency: ConsistencyLevel;
}

export interface RuleEngineResult {
  positiveSignals: string[];
  attentionSignals: string[];
  recommendedFocus: FocusCategory;
  questionWeights: QuestionWeights;
}

export type InsightSource = 'openai' | 'fallback';

export interface InsightResult {
  title: string;
  message: string;
  focusActionId: string;
  source: InsightSource;
  model?: string;
  promptVersion?: string;
  locale?: string;
}

export interface CheckInData {
  sleepOnsetMinutes: number;
  nightWakeMinutes: number;
  satisfaction: number;
  memo: string;
  techniqueResponses: Record<string, TechniqueResponse>;
}
