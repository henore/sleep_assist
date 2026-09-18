import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import { shareAsync } from 'expo-sharing';
import { gzip, ungzip, InflateOptions } from 'pako';
import { SleepRecord } from '../types/sleep';

const backupSessionKey = (r: SleepRecord) => r.id ?? r.date;

const RECORDS_KEY = 'sleep_records';
const LOCALE_KEY = 'user_locale';
const CURRENT_SCHEMA_VERSION = 1;

export interface BackupData {
  format: 'SimpleCBTIBackup';
  schemaVersion: number;
  exportedAt: string;
  appVersion: string;
  sessions: SleepRecord[];
  settings: {
    locale?: string;
  };
}

export interface BackupSummary {
  recordCount: number;
  insightCount: number;
  dateRange: { from: string; to: string } | null;
}

export function buildBackupData(
  records: SleepRecord[],
  appVersion: string,
  locale: string | null,
): BackupData {
  return {
    format: 'SimpleCBTIBackup',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion,
    sessions: records,
    settings: locale ? { locale } : {},
  };
}

export function validateBackup(data: unknown): BackupData {
  if (!data || typeof data !== 'object') throw new Error('invalid');
  const obj = data as Record<string, unknown>;
  if (obj.format !== 'SimpleCBTIBackup') throw new Error('invalid_format');
  if (typeof obj.schemaVersion !== 'number') throw new Error('invalid_schema');
  if (obj.schemaVersion > CURRENT_SCHEMA_VERSION) throw new Error('newer_version');
  if (!Array.isArray(obj.sessions)) throw new Error('invalid_sessions');

  for (const s of obj.sessions) {
    if (!s || typeof s !== 'object') throw new Error('invalid_session');
    if (typeof s.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s.date))
      throw new Error('invalid_session');
    if (typeof s.bedtime !== 'string' || !Number.isFinite(Date.parse(s.bedtime)))
      throw new Error('invalid_session');
    if (
      s.wakeTime !== null &&
      (typeof s.wakeTime !== 'string' || !Number.isFinite(Date.parse(s.wakeTime)))
    )
      throw new Error('invalid_session');
    if (s.satisfaction !== null && typeof s.satisfaction !== 'number')
      throw new Error('invalid_session');
  }

  return data as BackupData;
}

export function summarizeBackup(data: BackupData): BackupSummary {
  const sessions = data.sessions;
  const dates = sessions.map((s) => s.date).sort();
  const insightCount = sessions.filter((s) => s.insight && s.insight.trim()).length;

  return {
    recordCount: sessions.length,
    insightCount,
    dateRange:
      dates.length > 0 ? { from: dates[0], to: dates[dates.length - 1] } : null,
  };
}

export function mergeRecords(
  existing: SleepRecord[],
  incoming: SleepRecord[],
): SleepRecord[] {
  const map = new Map<string, SleepRecord>();

  for (const r of existing) {
    map.set(backupSessionKey(r), r);
  }

  for (const r of incoming) {
    map.set(backupSessionKey(r), r);
  }

  const merged = Array.from(map.values());
  merged.sort((a, b) => {
    const ta = a.bedtime ? new Date(a.bedtime).getTime() : 0;
    const tb = b.bedtime ? new Date(b.bedtime).getTime() : 0;
    return ta - tb;
  });

  return merged;
}

export async function exportBackup(appVersion: string): Promise<void> {
  const raw = await AsyncStorage.getItem(RECORDS_KEY);
  const records: SleepRecord[] = raw ? JSON.parse(raw) : [];
  const locale = await AsyncStorage.getItem(LOCALE_KEY);

  const backup = buildBackupData(records, appVersion, locale);
  const json = JSON.stringify(backup);
  const compressed = gzip(json);

  const today = new Date().toISOString().slice(0, 10);
  const filename = `SimpleCBTI-backup-${today}.cbti`;
  const file = new File(Paths.cache, filename);

  try {
    file.write(new Uint8Array(compressed));

    await shareAsync(file.uri, {
      mimeType: 'application/octet-stream',
      dialogTitle: 'SimpleCBTI Backup',
    });
  } finally {
    try { file.delete(); } catch {}
  }
}

export async function pickBackupFile(): Promise<{
  backup: BackupData;
  summary: BackupSummary;
} | null> {
  const result = await File.pickFileAsync({ mimeTypes: ['*/*'] });

  if (result.canceled || !result.result) return null;

  const picked = result.result;

  try {
    const bytes = await picked.bytes();
    const json = ungzip(bytes, { to: 'string' } as InflateOptions) as unknown as string;
    const parsed = JSON.parse(json);
    const backup = validateBackup(parsed);
    const summary = summarizeBackup(backup);
    return { backup, summary };
  } finally {
    try { picked.delete(); } catch {}
  }
}

export async function applyImport(sessions: SleepRecord[]): Promise<number> {
  const raw = await AsyncStorage.getItem(RECORDS_KEY);
  const existing: SleepRecord[] = raw ? JSON.parse(raw) : [];
  const merged = mergeRecords(existing, sessions);
  await AsyncStorage.setItem(RECORDS_KEY, JSON.stringify(merged));
  return merged.length;
}
