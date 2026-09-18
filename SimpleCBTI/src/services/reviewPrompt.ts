import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import { SleepRecord } from '../types/sleep';
import { calcTimeInBed, calcSleepEfficiency } from '../utils/time';

const REVIEW_PROMPTED_KEY = 'review_prompted';
const RECORD_THRESHOLD = 7;
const STREAK_LENGTH = 7;

function getRecentCompleted(records: SleepRecord[]): SleepRecord[] {
  return records
    .filter((r) => r.bedtime && r.wakeTime && r.satisfaction !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function hasRisingStreak(values: number[]): boolean {
  if (values.length < STREAK_LENGTH) return false;
  const tail = values.slice(-STREAK_LENGTH);
  for (let i = 1; i < tail.length; i++) {
    if (tail[i] <= tail[i - 1]) return false;
  }
  return true;
}

function hasFallingStreak(values: number[]): boolean {
  if (values.length < STREAK_LENGTH) return false;
  const tail = values.slice(-STREAK_LENGTH);
  for (let i = 1; i < tail.length; i++) {
    if (tail[i] >= tail[i - 1]) return false;
  }
  return true;
}

function hasPositiveStreak(records: SleepRecord[]): boolean {
  const recent = getRecentCompleted(records);
  if (recent.length < STREAK_LENGTH) return false;

  const efficiencies: number[] = [];
  const onsets: number[] = [];
  const wasos: number[] = [];

  for (const r of recent) {
    const tib = calcTimeInBed(new Date(r.bedtime!), new Date(r.wakeTime!));
    const sol = r.sleepOnsetMinutes ?? 0;
    const waso = r.nightWakeMinutes ?? 0;
    efficiencies.push(calcSleepEfficiency(tib, sol, waso));
    onsets.push(sol);
    wasos.push(waso);
  }

  return hasRisingStreak(efficiencies)
    || hasFallingStreak(onsets)
    || hasFallingStreak(wasos);
}

export async function maybeRequestReview(completedCount: number, records: SleepRecord[]): Promise<void> {
  const qualifies = completedCount >= RECORD_THRESHOLD || hasPositiveStreak(records);
  if (!qualifies) return;

  try {
    const prompted = await AsyncStorage.getItem(REVIEW_PROMPTED_KEY);
    if (prompted === 'true') return;

    const available = await StoreReview.isAvailableAsync();
    if (!available) return;

    await AsyncStorage.setItem(REVIEW_PROMPTED_KEY, 'true');
    await StoreReview.requestReview();
  } catch {}
}
