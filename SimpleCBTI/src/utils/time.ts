export function formatTime(date: Date): string {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

export function calcTimeInBed(bedtime: Date, wakeTime: Date): number {
  return (wakeTime.getTime() - bedtime.getTime()) / (1000 * 60);
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
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
