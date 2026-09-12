import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DayPhase, SleepRecord, CheckInData } from '../types/sleep';
import { getTodayKey, formatTime, calcTimeInBed, formatDuration, calcSleepEfficiency } from '../utils/time';
import { selectTechniques } from '../constants/techniques';
import { Translations } from '../i18n/types';
import { canGenerateInsight, consumeInsight } from '../services/trialGuard';
import { generateDailyInsight } from '../services/insightApi';

const STORAGE_KEY = 'sleep_records';

interface TodayState {
  phase: DayPhase;
  bedtime: Date | null;
  wakeTime: Date | null;
  record: SleepRecord | null;
  techniqueIds: string[];
  recordDate: string;
}

function getYesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}

export function useSleepStore() {
  const [today, setToday] = useState<TodayState>({
    phase: 'idle',
    bedtime: null,
    wakeTime: null,
    record: null,
    techniqueIds: [],
    recordDate: getTodayKey(),
  });
  const [records, setRecords] = useState<SleepRecord[]>([]);

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: SleepRecord[] = JSON.parse(raw);
        setRecords(parsed);

        const todayKey = getTodayKey();
        const todayRecord = parsed.find((r) => r.date === todayKey);

        if (todayRecord) {
          if (todayRecord.wakeTime && todayRecord.satisfaction !== null) {
            setToday({
              phase: 'completed',
              bedtime: todayRecord.bedtime ? new Date(todayRecord.bedtime) : null,
              wakeTime: todayRecord.wakeTime ? new Date(todayRecord.wakeTime) : null,
              record: todayRecord,
              techniqueIds: [],
              recordDate: todayKey,
            });
            return;
          } else if (todayRecord.bedtime && !todayRecord.wakeTime) {
            setToday({
              phase: 'sleeping',
              bedtime: new Date(todayRecord.bedtime),
              wakeTime: null,
              record: null,
              techniqueIds: [],
              recordDate: todayKey,
            });
            return;
          } else if (todayRecord.bedtime && todayRecord.wakeTime && todayRecord.satisfaction === null) {
            const techniqueIds = selectTechniques(3, parsed);
            setToday({
              phase: 'check_in',
              bedtime: new Date(todayRecord.bedtime),
              wakeTime: new Date(todayRecord.wakeTime),
              record: null,
              techniqueIds,
              recordDate: todayKey,
            });
            return;
          }
        }

        const yesterdayKey = getYesterdayKey();
        const yesterdayRecord = parsed.find((r) => r.date === yesterdayKey);
        if (yesterdayRecord && yesterdayRecord.bedtime && !yesterdayRecord.wakeTime) {
          setToday({
            phase: 'sleeping',
            bedtime: new Date(yesterdayRecord.bedtime),
            wakeTime: null,
            record: null,
            techniqueIds: [],
            recordDate: yesterdayKey,
          });
          return;
        }

        if (yesterdayRecord && yesterdayRecord.bedtime && yesterdayRecord.wakeTime && yesterdayRecord.satisfaction === null) {
          const techniqueIds = selectTechniques(3, parsed);
          setToday({
            phase: 'check_in',
            bedtime: new Date(yesterdayRecord.bedtime),
            wakeTime: new Date(yesterdayRecord.wakeTime),
            record: null,
            techniqueIds,
            recordDate: yesterdayKey,
          });
        }
      }
    } catch {}
  };

  const saveRecords = async (updated: SleepRecord[]) => {
    setRecords(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const recordBedtime = useCallback(async () => {
    const now = new Date();
    const key = getTodayKey();
    const newRecord: SleepRecord = {
      date: key,
      bedtime: now.toISOString(),
      wakeTime: null,
      sleepOnsetMinutes: null,
      nightWakeMinutes: null,
      satisfaction: null,
      memo: '',
      techniques: [],
      techniqueResponses: {},
      insight: '',
      insightTitle: '',
      insightFocusId: '',
    };
    const updated = records.filter((r) => r.date !== key);
    updated.push(newRecord);
    await saveRecords(updated);
    setToday({
      phase: 'sleeping',
      bedtime: now,
      wakeTime: null,
      record: null,
      techniqueIds: [],
      recordDate: key,
    });
  }, [records]);

  const recordWakeUp = useCallback(async () => {
    const now = new Date();
    const key = today.recordDate;
    const techniqueIds = selectTechniques(3, records);
    const updated = records.map((r) =>
      r.date === key ? { ...r, wakeTime: now.toISOString() } : r,
    );
    await saveRecords(updated);
    setToday((prev) => ({
      ...prev,
      phase: 'check_in',
      wakeTime: now,
      techniqueIds,
    }));
  }, [records, today.recordDate]);

  const completeCheckIn = useCallback(
    async (data: CheckInData, t: Translations, locale: string) => {
      const key = today.recordDate;
      const bedtime = today.bedtime!;
      const wakeTime = today.wakeTime!;

      const allowed = await canGenerateInsight(false);
      let insight = '';
      let insightTitle = '';
      let insightFocusId = '';

      if (allowed) {
        const result = await generateDailyInsight({
          bedtime,
          wakeTime,
          sleepOnsetMinutes: data.sleepOnsetMinutes,
          nightWakeMinutes: data.nightWakeMinutes,
          satisfaction: data.satisfaction,
          techniqueIds: today.techniqueIds,
          techniqueResponses: data.techniqueResponses,
          records,
          language: locale,
          t,
        });
        insight = result.message;
        insightTitle = result.title;
        insightFocusId = result.focusActionId;
        await consumeInsight();
      }

      const completedRecord: SleepRecord = {
        date: key,
        bedtime: bedtime.toISOString(),
        wakeTime: wakeTime.toISOString(),
        sleepOnsetMinutes: data.sleepOnsetMinutes,
        nightWakeMinutes: data.nightWakeMinutes,
        satisfaction: data.satisfaction,
        memo: data.memo,
        techniques: today.techniqueIds,
        techniqueResponses: data.techniqueResponses,
        insight,
        insightTitle,
        insightFocusId,
      };

      const updated = records.map((r) => (r.date === key ? completedRecord : r));
      await saveRecords(updated);
      setToday((prev) => ({
        ...prev,
        phase: 'completed',
        record: completedRecord,
      }));
    },
    [records, today],
  );

  const deleteRecord = useCallback(async (dateKey: string) => {
    const updated = records.filter((r) => r.date !== dateKey);
    await saveRecords(updated);
    if (today.recordDate === dateKey) {
      setToday({
        phase: 'idle',
        bedtime: null,
        wakeTime: null,
        record: null,
        techniqueIds: [],
        recordDate: getTodayKey(),
      });
    }
  }, [records, today.recordDate]);

  const getSummary = useCallback(() => {
    if (!today.bedtime || !today.wakeTime) return null;
    const record = today.record;
    if (!record) return null;
    const timeInBed = calcTimeInBed(today.bedtime, today.wakeTime);
    const efficiency = calcSleepEfficiency(
      timeInBed,
      record.sleepOnsetMinutes ?? 0,
      record.nightWakeMinutes ?? 0,
    );
    return {
      bedtimeStr: formatTime(today.bedtime),
      wakeTimeStr: formatTime(today.wakeTime),
      durationStr: formatDuration(timeInBed),
      efficiency,
      satisfaction: record.satisfaction ?? 0,
      insight: record.insight,
      insightTitle: record.insightTitle ?? '',
      insightFocusId: record.insightFocusId ?? '',
    };
  }, [today]);

  return {
    today,
    records,
    recordBedtime,
    recordWakeUp,
    completeCheckIn,
    deleteRecord,
    getSummary,
  };
}
