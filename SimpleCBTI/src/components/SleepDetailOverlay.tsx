import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { StarRating } from './StarRating';
import { Translations } from '../i18n/types';
import { TechniqueResponse } from '../types/sleep';
import { TECHNIQUE_DEFS } from '../constants/techniques';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../constants/theme';

export interface SleepDetailData {
  date?: string;
  bedtimeStr: string;
  wakeTimeStr: string;
  durationStr: string;
  efficiency: number;
  satisfaction: number;
  sleepOnsetMinutes?: number | null;
  nightWakeMinutes?: number | null;
  memo?: string;
  techniqueIds?: string[];
  techniqueResponses?: Record<string, TechniqueResponse>;
  insight?: string;
  insightTitle?: string;
  insightFocusId?: string;
}

interface Props {
  visible: boolean;
  data: SleepDetailData;
  onClose: () => void;
  onDelete?: (dateKey: string) => void;
  t: Translations;
  title?: string;
}

export function SleepDetailOverlay({ visible, data, onClose, onDelete, t, title }: Props) {
  const techs = (data.techniqueIds ?? [])
    .map((id) => TECHNIQUE_DEFS.find((td) => td.id === id))
    .filter(Boolean);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.content} onPress={(e) => e.stopPropagation()}>
          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            <Text style={styles.title}>{title ?? t.todaysDetail}</Text>

            {data.date && <Text style={styles.dateLabel}>{data.date}</Text>}

            <Row label={t.detailBedtime} value={data.bedtimeStr} />
            <Row label={t.detailWakeUp} value={data.wakeTimeStr} />
            <Row label={t.detailTimeInBed} value={data.durationStr} />
            <Row label={t.detailEfficiency} value={`${data.efficiency}%`} />

            <View style={styles.row}>
              <Text style={styles.rowLabel}>{t.detailSatisfaction}</Text>
              <StarRating value={data.satisfaction} readonly size={20} />
            </View>

            {data.sleepOnsetMinutes != null && (
              <Row label={t.detailSleepOnset} value={`${data.sleepOnsetMinutes} ${t.minutes}`} />
            )}
            {data.nightWakeMinutes != null && (
              <Row label={t.detailNightWake} value={`${data.nightWakeMinutes} ${t.minutes}`} />
            )}

            {data.memo !== undefined && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>{t.detailMemo}</Text>
                <Text style={styles.sectionText}>{data.memo || t.noMemo}</Text>
              </View>
            )}

            {techs.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>{t.detailTechniques}</Text>
                {techs.map((tech) => {
                  if (!tech) return null;
                  const resp = (data.techniqueResponses ?? {})[tech.id];
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

            {data.insight ? (
              <View style={styles.insightBox}>
                <Text style={styles.insightLabel}>{data.insightTitle || t.detailInsight}</Text>
                <Text style={styles.insightText}>{data.insight}</Text>
              </View>
            ) : null}

            {onDelete && data.date && (
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => {
                  Alert.alert(
                    t.deleteRecord,
                    t.deleteConfirm,
                    [
                      { text: t.close, style: 'cancel' },
                      {
                        text: t.deleteRecord,
                        style: 'destructive',
                        onPress: () => {
                          onDelete(data.date!);
                          onClose();
                        },
                      },
                    ],
                  );
                }}
              >
                <Text style={styles.deleteBtnText}>{t.deleteRecord}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>{t.close}</Text>
            </TouchableOpacity>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  content: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 380,
    maxHeight: '85%',
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  dateLabel: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.lavenderLight,
  },
  rowLabel: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  rowValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  section: {
    marginTop: Spacing.md,
  },
  sectionLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.textTertiary,
    marginBottom: Spacing.xs,
  },
  sectionText: {
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    lineHeight: 22,
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
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  insightBox: {
    marginTop: Spacing.md,
    backgroundColor: Colors.lavenderLight,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
  },
  insightLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.lavenderDark,
    marginBottom: Spacing.xs,
  },
  insightText: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  deleteBtn: {
    marginTop: Spacing.lg,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  deleteBtnText: {
    fontSize: FontSize.sm,
    color: '#C45B5B',
    fontWeight: FontWeight.medium,
  },
  closeBtn: {
    marginTop: Spacing.sm,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  closeBtnText: {
    fontSize: FontSize.md,
    color: Colors.lavenderDark,
    fontWeight: FontWeight.medium,
  },
});
