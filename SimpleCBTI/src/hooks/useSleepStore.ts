import { useEffect, useSyncExternalStore } from 'react';
import { createSleepStore } from '../services/sleepStore';
import { formatTime, calcTimeInBed, formatDuration, calcSleepEfficiency } from '../utils/time';

// One source of truth for every mounted screen. A new app process hydrates once.
const sleepStore = createSleepStore();

export function useSleepStore() {
  const state = useSyncExternalStore(sleepStore.subscribe, sleepStore.getSnapshot);
  useEffect(() => { void sleepStore.hydrate().catch(() => {}); }, []);
  const { today } = state;
  const getSummary = () => {
    if (!today.bedtime || !today.wakeTime) return null;
    const record = today.record;
    if (!record) return null;
    const timeInBed = calcTimeInBed(today.bedtime, today.wakeTime);
    const sol = record.sleepOnsetMinutes ?? 0;
    const waso = record.nightWakeMinutes ?? 0;
    const efficiency = calcSleepEfficiency(timeInBed, sol, waso);
    const totalSleepMin = Math.max(0, timeInBed - sol - waso);
    return {
      bedtimeStr: formatTime(today.bedtime),
      wakeTimeStr: formatTime(today.wakeTime),
      durationStr: formatDuration(timeInBed),
      totalSleepStr: formatDuration(totalSleepMin),
      efficiency,
      satisfaction: record.satisfaction ?? 0,
      sleepOnsetMinutes: record.sleepOnsetMinutes,
      nightWakeMinutes: record.nightWakeMinutes,
      memo: record.memo,
      techniqueIds: record.techniques,
      techniqueResponses: record.techniqueResponses,
      insight: record.insight,
      insightTitle: record.insightTitle ?? '',
      insightSource: record.insightSource,
      insightLocale: record.insightLocale,
      insightFocusId: record.insightFocusId ?? '',
    };
  };
  return { ...state, ...sleepStore.actions, reload: sleepStore.reload, getSummary };
}
