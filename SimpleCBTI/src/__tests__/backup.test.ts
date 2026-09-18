jest.mock('expo-file-system', () => ({
  File: class {},
  Paths: { cache: '/cache/' },
  EncodingType: { Base64: 'base64', UTF8: 'utf8' },
}));
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn() }));

import { gzip, ungzip } from 'pako';
import { SleepRecord } from '../types/sleep';
import {
  buildBackupData,
  validateBackup,
  summarizeBackup,
  mergeRecords,
  BackupData,
} from '../services/backup';

function makeRecord(overrides: Partial<SleepRecord> = {}): SleepRecord {
  return {
    id: '2026-09-10T23:00:00.000Z',
    date: '2026-09-10',
    bedtime: '2026-09-10T23:00:00.000Z',
    wakeTime: '2026-09-11T07:00:00.000Z',
    sleepOnsetMinutes: 15,
    nightWakeMinutes: 10,
    satisfaction: 4,
    memo: 'Slept well',
    techniques: ['MR01', 'SC01', 'CR01'],
    techniqueResponses: { MR01: 'done', SC01: 'na', CR01: 'failed' },
    insight: 'Your sleep efficiency is good.',
    insightTitle: 'Good night',
    insightFocusId: 'MR01',
    insightSource: 'openai',
    insightLocale: 'en',
    insightModel: 'gpt-4o-mini',
    insightPromptVersion: 'v2',
    ...overrides,
  };
}

describe('buildBackupData', () => {
  it('produces correct structure', () => {
    const records = [makeRecord()];
    const backup = buildBackupData(records, '1.1.0', 'ja');
    expect(backup.format).toBe('SimpleCBTIBackup');
    expect(backup.schemaVersion).toBe(1);
    expect(backup.appVersion).toBe('1.1.0');
    expect(backup.sessions).toHaveLength(1);
    expect(backup.sessions[0]).toEqual(records[0]);
    expect(backup.settings.locale).toBe('ja');
    expect(typeof backup.exportedAt).toBe('string');
  });

  it('omits locale from settings when null', () => {
    const backup = buildBackupData([], '1.0.0', null);
    expect(backup.settings).toEqual({});
  });
});

describe('validateBackup', () => {
  function validPayload(): BackupData {
    return buildBackupData([makeRecord()], '1.1.0', 'en');
  }

  it('accepts valid backup', () => {
    const data = validPayload();
    expect(() => validateBackup(data)).not.toThrow();
    const result = validateBackup(data);
    expect(result.sessions).toHaveLength(1);
  });

  it('rejects null', () => {
    expect(() => validateBackup(null)).toThrow('invalid');
  });

  it('rejects wrong format', () => {
    const data = { ...validPayload(), format: 'OtherApp' };
    expect(() => validateBackup(data)).toThrow('invalid_format');
  });

  it('rejects newer schema', () => {
    const data = { ...validPayload(), schemaVersion: 999 };
    expect(() => validateBackup(data)).toThrow('newer_version');
  });

  it('rejects missing sessions', () => {
    const data = { ...validPayload(), sessions: 'not-array' };
    expect(() => validateBackup(data)).toThrow('invalid_sessions');
  });

  it('rejects session with invalid date', () => {
    const data = validPayload();
    data.sessions[0] = { ...data.sessions[0], date: 'bad' };
    expect(() => validateBackup(data)).toThrow('invalid_session');
  });

  it('rejects session with invalid bedtime', () => {
    const data = validPayload();
    data.sessions[0] = { ...data.sessions[0], bedtime: 'not-a-date' };
    expect(() => validateBackup(data)).toThrow('invalid_session');
  });

  it('accepts session with null wakeTime (active session)', () => {
    const data = validPayload();
    data.sessions[0] = { ...data.sessions[0], wakeTime: null, satisfaction: null };
    expect(() => validateBackup(data)).not.toThrow();
  });

  it('rejects session with invalid wakeTime', () => {
    const data = validPayload();
    data.sessions[0] = { ...data.sessions[0], wakeTime: 'bad' };
    expect(() => validateBackup(data)).toThrow('invalid_session');
  });
});

describe('summarizeBackup', () => {
  it('returns correct counts and date range', () => {
    const records = [
      makeRecord({ date: '2026-09-01', insight: 'Some insight' }),
      makeRecord({ id: '2', date: '2026-09-10', insight: '' }),
      makeRecord({ id: '3', date: '2026-09-17', insight: 'Another insight' }),
    ];
    const backup = buildBackupData(records, '1.0.0', null);
    const summary = summarizeBackup(backup);
    expect(summary.recordCount).toBe(3);
    expect(summary.insightCount).toBe(2);
    expect(summary.dateRange).toEqual({ from: '2026-09-01', to: '2026-09-17' });
  });

  it('handles empty sessions', () => {
    const backup = buildBackupData([], '1.0.0', null);
    const summary = summarizeBackup(backup);
    expect(summary.recordCount).toBe(0);
    expect(summary.insightCount).toBe(0);
    expect(summary.dateRange).toBeNull();
  });
});

describe('mergeRecords', () => {
  it('adds new records', () => {
    const existing = [makeRecord({ id: 'A', date: '2026-09-01', bedtime: '2026-09-01T23:00:00.000Z' })];
    const incoming = [makeRecord({ id: 'B', date: '2026-09-10', bedtime: '2026-09-10T23:00:00.000Z' })];
    const merged = mergeRecords(existing, incoming);
    expect(merged).toHaveLength(2);
  });

  it('deduplicates by session key (backup wins)', () => {
    const existing = [makeRecord({ id: 'A', memo: 'old' })];
    const incoming = [makeRecord({ id: 'A', memo: 'new from backup' })];
    const merged = mergeRecords(existing, incoming);
    expect(merged).toHaveLength(1);
    expect(merged[0].memo).toBe('new from backup');
  });

  it('same backup imported twice does not duplicate', () => {
    const records = [
      makeRecord({ id: 'A', bedtime: '2026-09-01T23:00:00.000Z' }),
      makeRecord({ id: 'B', bedtime: '2026-09-02T23:00:00.000Z' }),
    ];
    const first = mergeRecords([], records);
    const second = mergeRecords(first, records);
    expect(second).toHaveLength(2);
  });

  it('sorts by bedtime', () => {
    const existing = [makeRecord({ id: 'C', bedtime: '2026-09-15T23:00:00.000Z' })];
    const incoming = [makeRecord({ id: 'A', bedtime: '2026-09-01T23:00:00.000Z' })];
    const merged = mergeRecords(existing, incoming);
    expect(merged[0].id).toBe('A');
    expect(merged[1].id).toBe('C');
  });

  it('preserves active session (null wakeTime)', () => {
    const existing = [makeRecord({ id: 'active', wakeTime: null, satisfaction: null })];
    const incoming = [makeRecord({ id: 'completed', bedtime: '2026-09-01T23:00:00.000Z' })];
    const merged = mergeRecords(existing, incoming);
    expect(merged).toHaveLength(2);
    const active = merged.find((r) => r.id === 'active');
    expect(active?.wakeTime).toBeNull();
  });
});

describe('insight preservation', () => {
  it('title, message, and locale survive roundtrip', () => {
    const original = makeRecord({
      insightTitle: '今日のアドバイス',
      insight: '睡眠効率が良好です。この調子を続けましょう。',
      insightFocusId: 'MR01',
      insightSource: 'openai',
      insightLocale: 'ja',
      insightModel: 'gpt-4o-mini',
      insightPromptVersion: 'v2',
    });
    const backup = buildBackupData([original], '1.1.0', 'ja');
    const validated = validateBackup(JSON.parse(JSON.stringify(backup)));
    const restored = validated.sessions[0];
    expect(restored.insightTitle).toBe('今日のアドバイス');
    expect(restored.insight).toBe('睡眠効率が良好です。この調子を続けましょう。');
    expect(restored.insightFocusId).toBe('MR01');
    expect(restored.insightSource).toBe('openai');
    expect(restored.insightLocale).toBe('ja');
    expect(restored.insightModel).toBe('gpt-4o-mini');
    expect(restored.insightPromptVersion).toBe('v2');
  });

  it('memo is preserved', () => {
    const original = makeRecord({ memo: '夢を見た。途中で目が覚めた。' });
    const backup = buildBackupData([original], '1.1.0', null);
    const validated = validateBackup(JSON.parse(JSON.stringify(backup)));
    expect(validated.sessions[0].memo).toBe('夢を見た。途中で目が覚めた。');
  });
});

describe('compression roundtrip', () => {
  it('compresses and decompresses backup data', () => {
    const backup = buildBackupData(
      [makeRecord(), makeRecord({ id: '2', date: '2026-09-11' })],
      '1.1.0',
      'ja',
    );
    const json = JSON.stringify(backup);
    const compressed = gzip(json);
    expect(compressed.length).toBeLessThan(json.length);

    const decompressedBytes = ungzip(compressed);
    const decompressed = new TextDecoder().decode(decompressedBytes);
    const restored = JSON.parse(decompressed);
    expect(restored.format).toBe('SimpleCBTIBackup');
    expect(restored.sessions).toHaveLength(2);
  });
});

describe('derived data re-calculation', () => {
  it('TIB/TST/SE can be computed from imported fields', () => {
    const record = makeRecord({
      bedtime: '2026-09-10T23:00:00.000Z',
      wakeTime: '2026-09-11T07:00:00.000Z',
      sleepOnsetMinutes: 15,
      nightWakeMinutes: 10,
    });
    const bed = new Date(record.bedtime!);
    const wake = new Date(record.wakeTime!);
    const tibMin = (wake.getTime() - bed.getTime()) / 60000;
    const tstMin = tibMin - record.sleepOnsetMinutes! - record.nightWakeMinutes!;
    const se = (tstMin / tibMin) * 100;
    expect(tibMin).toBe(480);
    expect(tstMin).toBe(455);
    expect(se).toBeCloseTo(94.79, 1);
  });
});
