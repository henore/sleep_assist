export function formatTime(date: Date): string {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

export function calcTimeInBed(bedtime: Date, wakeTime: Date): number {
  return (wakeTime.getTime() - bedtime.getTime()) / (1000 * 60);
}

export function formatDuration(minutes: number): string {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

export function calcSleepEfficiency(
  timeInBedMinutes: number,
  sleepOnsetMinutes: number,
  nightWakeMinutes: number,
): number {
  if (timeInBedMinutes <= 0) return 0;
  const sleepMinutes = Math.max(0, timeInBedMinutes - sleepOnsetMinutes - nightWakeMinutes);
  return Math.min(100, Math.max(0, Math.round((sleepMinutes / timeInBedMinutes) * 100)));
}

export function getTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}

// Display/grouping date follows the edited bedtime. record.date remains the
// original session identity/comparison anchor, including for legacy records.
export function getSleepDisplayDate(record: { bedtime: string | null; date: string }): string {
  const date = record.bedtime ? new Date(record.bedtime) : null;
  if (!date || !Number.isFinite(date.getTime())) return record.date;
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}
