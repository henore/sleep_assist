import { getSleepDisplayDate } from '../utils/time';
import { SleepRecord } from '../types/sleep';

// Access limits are selectors only; never persist this filtered array.
export function visibleSleepHistory(records: SleepRecord[], isPro: boolean): SleepRecord[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 6);
  const key = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
  return records.filter((r) => r.wakeTime && r.satisfaction !== null && (isPro || getSleepDisplayDate(r) >= key));
}
