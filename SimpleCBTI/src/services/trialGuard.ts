import AsyncStorage from '@react-native-async-storage/async-storage';
import { setTrialBit } from './deviceCheck';

const INSIGHTS_USED_KEY = 'insights_used';
const TRIAL_CLAIMED_KEY = 'trial_claimed';
const TRIAL_EXPIRED_SEEN_KEY = 'trial_expired_seen';
const MAX_FREE_INSIGHTS = 20;

const API_BASE = ''; // TODO: set production API base URL

export async function getInsightsUsed(): Promise<number> {
  try {
    const val = await AsyncStorage.getItem(INSIGHTS_USED_KEY);
    return val ? parseInt(val, 10) : 0;
  } catch {
    return 0;
  }
}

export async function canGenerateInsight(isPurchased: boolean): Promise<boolean> {
  if (isPurchased) return true;
  const used = await getInsightsUsed();
  return used < MAX_FREE_INSIGHTS;
}

export async function consumeInsight(): Promise<number> {
  const used = await getInsightsUsed();
  const next = used + 1;
  await AsyncStorage.setItem(INSIGHTS_USED_KEY, String(next));

  const claimed = await isTrialClaimed();
  if (!claimed) {
    await AsyncStorage.setItem(TRIAL_CLAIMED_KEY, 'true');
    if (API_BASE) {
      setTrialBit(API_BASE).catch(() => {});
    }
  }

  return next;
}

export async function isTrialClaimed(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(TRIAL_CLAIMED_KEY);
    return val === 'true';
  } catch {
    return false;
  }
}

export async function hasSeenTrialExpired(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(TRIAL_EXPIRED_SEEN_KEY);
    return val === 'true';
  } catch {
    return false;
  }
}

export async function markTrialExpiredSeen(): Promise<void> {
  await AsyncStorage.setItem(TRIAL_EXPIRED_SEEN_KEY, 'true');
}

export { MAX_FREE_INSIGHTS };
