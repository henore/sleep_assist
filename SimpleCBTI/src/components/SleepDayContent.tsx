import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { StarRating } from './StarRating';
import { Translations } from '../i18n/types';
import { TechniqueResponse } from '../types/sleep';
import { TECHNIQUE_DEFS } from '../constants/techniques';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../constants/theme';

export interface SleepDayData {
  bedtimeStr: string;
  wakeTimeStr: string;
  durationStr: string;
  totalSleepStr: string;
  efficiency: number;
  satisfaction: number;
  sleepOnsetMinutes: number | null;
  nightWakeMinutes: number | null;
  memo: string;
  techniqueIds: string[];
  techniqueResponses: Record<string, TechniqueResponse>;
  insight: string;
  insightTitle: string;
  insightSource?: import('../types/sleep').InsightSource;
}

interface Props {
  data: SleepDayData;
  t: Translations;
  showInsight?: boolean;
}

export function SleepDayContent({ data, t, showInsight = true }: Props) {
  const effColor =
    data.efficiency >= 85
      ? Colors.brightGreen
      : data.efficiency >= 70
        ? Colors.amber
        : Colors.lavenderDark;

  const techs = data.techniqueIds
    .map((id) => TECHNIQUE_DEFS.find((td) => td.id === id))
    .filter(Boolean);

  return (
    <View>
      {/* SOL / WASO / Total Sleep */}
      {(data.sleepOnsetMinutes != null || data.nightWakeMinutes != null) && (
        <View style={styles.section}>
          {data.sleepOnsetMinutes != null && (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{t.detailSleepOnset}</Text>
              <Text style={styles.rowValue}>{data.sleepOnsetMinutes} {t.minutes}</Text>
            </View>
          )}
          {data.nightWakeMinutes != null && (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{t.detailNightWake}</Text>
              <Text style={styles.rowValue}>{data.nightWakeMinutes} {t.minutes}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t.detailTotalSleep}</Text>
            <Text style={styles.rowValue}>{data.totalSleepStr}</Text>
          </View>
        </View>
      )}

      {/* Satisfaction */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t.satisfactionLabel}</Text>
        <View style={styles.starsRow}>
          <StarRating value={data.satisfaction} readonly size={24} />
        </View>
      </View>

      {/* CBT-I Techniques */}
      {techs.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t.detailTechniques}</Text>
          {techs.map((tech) => {
            if (!tech) return null;
            const resp = data.techniqueResponses[tech.id];
            const mark = resp === 'done' ? '✓' : resp === 'failed' ? '×' : '－';
            const markStyle =
              resp === 'done' ? styles.techMarkDone
                : resp === 'failed' ? styles.techMarkFailed
                  : styles.techMarkNA;
            return (
              <View key={tech.id} style={styles.techRow}>
                <Text style={[styles.techMark, markStyle]}>{mark}</Text>
                <Text style={styles.techText}>{t[tech.labelKey]}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Memo */}
      {data.memo ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t.detailMemo}</Text>
          <Text style={styles.memoText}>{data.memo}</Text>
        </View>
      ) : null}

      {/* Insight */}
      {showInsight && data.insight ? (
        <View style={styles.insightBox}>
          <Text style={styles.insightBadge}>✦ {t.dailyInsightCardTitle}</Text>
          {data.insightSource === 'openai' && <Text style={styles.insightAttribution}>{t.dailyInsightAttribution}</Text>}
          <Text style={styles.insightTitle}>{data.insightTitle || t.detailInsight}</Text>
          <Text style={styles.insightText}>{data.insight}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  sectionLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  rowLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  rowValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  starsRow: {
    alignItems: 'center',
  },
  techRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 3,
  },
  techMark: {
    fontSize: FontSize.md,
    color: Colors.textTertiary,
    width: 22,
    textAlign: 'center',
  },
  techMarkDone: {
    color: Colors.mutedGreenDark,
    fontWeight: FontWeight.bold,
  },
  techMarkFailed: {
    color: Colors.blueGreyDark,
    fontWeight: FontWeight.bold,
  },
  techMarkNA: {
    color: Colors.textTertiary,
  },
  techText: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    flex: 1,
  },
  memoText: {
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  insightBox: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.lavenderLight,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  insightBadge: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.lavenderDark,
    marginBottom: Spacing.xs,
    letterSpacing: 0.5,
  },
  insightAttribution: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  insightTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.lavenderDark,
    marginBottom: Spacing.sm,
  },
  insightText: {
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
});
