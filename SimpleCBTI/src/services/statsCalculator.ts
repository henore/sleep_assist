import { SleepRecord, Stats7d, TrendDirection, ConsistencyLevel } from '../types/sleep';
import { calcTimeInBed, calcSleepEfficiency } from '../utils/time';

const MIN_DAYS_FOR_TREND = 4;
const TREND_THRESHOLD = 0.15;
const WAKE_CONSISTENCY_GOOD = 20;
const WAKE_CONSISTENCY_MODERATE = 40;

interface DayMetrics {
  totalSleepMin: number;
  timeInBedMin: number;
  efficiencyPct: number;
  onsetMin: number;
  wasoMin: number;
  satisfaction: number;
  wakeMinOfDay: number;
}

export function extractMetrics(r: SleepRecord): DayMetrics | null {
  if (!r.bedtime || !r.wakeTime || r.satisfaction === null) return null;
  const bed = new Date(r.bedtime);
  const wake = new Date(r.wakeTime);
  if (!Number.isFinite(bed.getTime()) || !Number.isFinite(wake.getTime()) || wake <= bed) return null;
  const tib = calcTimeInBed(bed, wake);
  const onset = r.sleepOnsetMinutes ?? 0;
  const waso = r.nightWakeMinutes ?? 0;
  const tst = Math.max(0, tib - onset - waso);
  const eff = calcSleepEfficiency(tib, onset, waso);
  return {
    totalSleepMin: tst,
    timeInBedMin: tib,
    efficiencyPct: eff,
    onsetMin: onset,
    wasoMin: waso,
    satisfaction: r.satisfaction,
    wakeMinOfDay: wake.getHours() * 60 + wake.getMinutes(),
  };
}

function trend(values: number[]): TrendDirection {
  if (values.length < MIN_DAYS_FOR_TREND) return 'insufficient_data';
  const mid = Math.floor(values.length / 2);
  const first = values.slice(0, mid);
  const second = values.slice(mid);
  const avgFirst = first.reduce((a, b) => a + b, 0) / first.length;
  const avgSecond = second.reduce((a, b) => a + b, 0) / second.length;
  const diff = avgSecond - avgFirst;
  const range = Math.max(...values) - Math.min(...values);
  if (range === 0) return 'stable';
  const ratio = Math.abs(diff) / range;
  if (ratio < TREND_THRESHOLD) return 'stable';
  return diff > 0 ? 'improving' : 'worsening';
}

function trendInverse(values: number[]): TrendDirection {
  const t = trend(values);
  if (t === 'improving') return 'worsening';
  if (t === 'worsening') return 'improving';
  return t;
}

function wakeConsistency(wakeMinutes: number[]): ConsistencyLevel {
  if (wakeMinutes.length < 3) return 'moderate';
  const avg = wakeMinutes.reduce((a, b) => a + b, 0) / wakeMinutes.length;
  const variance = wakeMinutes.reduce((s, v) => s + (v - avg) ** 2, 0) / wakeMinutes.length;
  const stdDev = Math.sqrt(variance);
  if (stdDev < WAKE_CONSISTENCY_GOOD) return 'good';
  if (stdDev < WAKE_CONSISTENCY_MODERATE) return 'moderate';
  return 'poor';
}

export function calculate7dStats(records: SleepRecord[]): Stats7d {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffKey = `${cutoff.getFullYear()}-${(cutoff.getMonth() + 1).toString().padStart(2, '0')}-${cutoff.getDate().toString().padStart(2, '0')}`;

  const recent = records
    .filter((r) => r.date >= cutoffKey)
    .sort((a, b) => a.date.localeCompare(b.date));

  return calculateSessionStats(recent);
}

// Input is already selected. Daily Insight uses seven completed sessions,
// while the legacy calendar-based caller retains its existing window.
export function calculateSessionStats(records: SleepRecord[], minTrendSamples = MIN_DAYS_FOR_TREND): Stats7d {
  const recent = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const sessionTrend = (values: number[], inverse = false): TrendDirection =>
    values.length < minTrendSamples ? 'insufficient_data' : inverse ? trendInverse(values) : trend(values);
  const metrics = recent.map(extractMetrics).filter((m): m is DayMetrics => m !== null);

  if (metrics.length === 0) {
    return {
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
  }

  const avg = (arr: number[]) => Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;

  return {
    daysRecorded: metrics.length,
    avgTotalSleepTimeMin: Math.round(avg(metrics.map((m) => m.totalSleepMin))),
    avgTimeInBedMin: Math.round(avg(metrics.map((m) => m.timeInBedMin))),
    avgSleepEfficiencyPct: avg(metrics.map((m) => m.efficiencyPct)),
    avgSleepOnsetLatencyMin: Math.round(avg(metrics.map((m) => m.onsetMin))),
    avgWakeAfterSleepOnsetMin: Math.round(avg(metrics.map((m) => m.wasoMin))),
    avgSatisfaction: avg(metrics.map((m) => m.satisfaction)),
    sleepEfficiencyTrend: sessionTrend(metrics.map((m) => m.efficiencyPct)),
    sleepOnsetTrend: sessionTrend(metrics.map((m) => m.onsetMin), true),
    wakeAfterSleepOnsetTrend: sessionTrend(metrics.map((m) => m.wasoMin), true),
    sleepDurationTrend: sessionTrend(metrics.map((m) => m.totalSleepMin)),
    wakeTimeConsistency: wakeConsistency(metrics.map((m) => m.wakeMinOfDay)),
  };
}

// date and array order are stable across edits; bedtime/wakeTime are not.
// Stored sessions are appended at Bedtime and edits never reorder that array.
export function getPreviousCompletedSessions(
  current: Pick<SleepRecord, 'id' | 'date'>, all: SleepRecord[], limit = 7,
): SleepRecord[] {
  const now = new Date();
  const today = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  const sameSession = (r: SleepRecord) => current.id ? r.id === current.id : r.date === current.date;
  const currentIndex = all.findIndex(sameSession);
  return all.map((record, index) => ({ record, index }))
    .filter(({ record: r, index }) => !sameSession(r)
      && (r.date < current.date || (r.date === current.date && currentIndex >= 0 && index < currentIndex))
      && r.date <= today && !!extractMetrics(r)
      && Date.parse(r.bedtime!) <= now.getTime() && Date.parse(r.wakeTime!) <= now.getTime())
    .sort((a, b) => b.record.date.localeCompare(a.record.date) || b.index - a.index)
    .slice(0, Math.max(0, Math.floor(limit)))
    .map(({ record }) => record);
}
