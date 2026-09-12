import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../i18n';
import { useSleepStore } from '../hooks/useSleepStore';
import { useProStatus } from '../hooks/useProStatus';
import { Card } from '../components/Card';
import { StarRating } from '../components/StarRating';
import { SleepRecord } from '../types/sleep';
import { calcTimeInBed, calcSleepEfficiency, formatDuration, formatTime } from '../utils/time';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../constants/theme';
import { Translations } from '../i18n/types';

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface RecordDetail {
  date: string;
  bedtimeStr: string;
  wakeTimeStr: string;
  durationStr: string;
  efficiency: number;
  satisfaction: number;
  sleepOnsetMinutes: number | null;
  nightWakeMinutes: number | null;
  memo: string;
  insight: string;
  insightTitle: string;
  techniques: string[];
  techniqueResponses: Record<string, import('../types/sleep').TechniqueResponse>;
}

function buildDetail(r: SleepRecord): RecordDetail | null {
  if (!r.bedtime || !r.wakeTime || r.satisfaction === null) return null;
  const bed = new Date(r.bedtime);
  const wake = new Date(r.wakeTime);
  const tib = calcTimeInBed(bed, wake);
  const eff = calcSleepEfficiency(tib, r.sleepOnsetMinutes ?? 0, r.nightWakeMinutes ?? 0);
  return {
    date: r.date,
    bedtimeStr: formatTime(bed),
    wakeTimeStr: formatTime(wake),
    durationStr: formatDuration(tib),
    efficiency: eff,
    satisfaction: r.satisfaction,
    sleepOnsetMinutes: r.sleepOnsetMinutes,
    nightWakeMinutes: r.nightWakeMinutes,
    memo: r.memo,
    insight: r.insight,
    insightTitle: r.insightTitle ?? '',
    techniques: r.techniques,
    techniqueResponses: r.techniqueResponses,
  };
}

function parseDateParts(dateStr: string) {
  const [y, m, d] = dateStr.split('-');
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return {
    month: MONTH_SHORT[date.getMonth()],
    day: date.getDate(),
    weekday: WEEKDAY_SHORT[date.getDay()],
  };
}

function cutoffDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}

export function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { records, deleteRecord } = useSleepStore();
  const { isPro } = useProStatus();
  const [selectedRecord, setSelectedRecord] = useState<RecordDetail | null>(null);

  const allCompleted = useMemo(
    () =>
      records
        .filter((r) => r.wakeTime && r.satisfaction !== null)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [records],
  );

  const cutoff = cutoffDate();
  const completed = useMemo(
    () => (isPro ? allCompleted : allCompleted.filter((r) => r.date >= cutoff)),
    [allCompleted, isPro, cutoff],
  );
  const hasOlderRecords = !isPro && allCompleted.length > completed.length;

  if (allCompleted.length === 0) {
    return (
      <View style={[styles.emptyContainer, { paddingTop: insets.top }]}>
        <Text style={styles.emptyIcon}>📋</Text>
        <Text style={styles.emptyText}>{t.historyEmpty}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.header}>{t.tabHistory}</Text>
      <Text style={styles.subtitle}>{t.historySubtitle}</Text>
      <FlatList
        data={completed}
        keyExtractor={(item) => item.date}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const detail = buildDetail(item);
          if (!detail) return null;
          return (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setSelectedRecord(detail)}
            >
              <HistoryCard data={detail} t={t} />
            </TouchableOpacity>
          );
        }}
        ListFooterComponent={
          hasOlderRecords ? (
            <View style={styles.upgradeFooter}>
              <Text style={styles.upgradeIcon}>🔒</Text>
              <Text style={styles.upgradeText}>{t.historyLimited}</Text>
              <TouchableOpacity style={styles.upgradeBtn}>
                <Text style={styles.upgradeBtnText}>{t.upgradeButton}</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />
      {selectedRecord && (
        <HistoryDetailModal
          data={selectedRecord}
          onClose={() => setSelectedRecord(null)}
          onDelete={(dateKey) => {
            deleteRecord(dateKey);
            setSelectedRecord(null);
          }}
          t={t}
        />
      )}
    </View>
  );
}

/* ─── Compact list card (matches reference image) ─── */

function HistoryCard({ data, t }: { data: RecordDetail; t: Translations }) {
  const dp = parseDateParts(data.date);
  const effColor =
    data.efficiency >= 85
      ? Colors.brightGreen
      : data.efficiency >= 70
        ? Colors.amber
        : Colors.lavenderDark;

  return (
    <Card style={styles.histCard}>
      {/* Top row: date + moon + bedtime / wake / time in bed */}
      <View style={styles.topRow}>
        <View style={styles.dateCol}>
          <Text style={styles.dateMain}>{dp.month} {dp.day}</Text>
          <Text style={styles.dateSub}>{dp.weekday}</Text>
        </View>
        <View style={styles.moonCircle}>
          <Text style={styles.moonEmoji}>🌙</Text>
        </View>
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>{t.bedtime}</Text>
          <Text style={styles.statValue}>{data.bedtimeStr}</Text>
        </View>
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>{t.wakeTime}</Text>
          <Text style={styles.statValue}>{data.wakeTimeStr}</Text>
        </View>
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>{t.timeInBedLabel}</Text>
          <Text style={styles.statValue}>{data.durationStr}</Text>
        </View>
      </View>

      {/* Bottom rows: efficiency + stars, then insight */}
      <View style={styles.bottomRow}>
        <Text style={styles.effLabel}>{t.sleepEfficiency}</Text>
        <Text style={[styles.effValue, { color: effColor }]}>{data.efficiency}%</Text>
        <View style={{ flex: 1 }} />
        <StarRating value={data.satisfaction} readonly size={14} />
      </View>
      {data.insight ? (
        <View style={styles.insightRow}>
          <Text style={styles.insightIndicator}>📝 {t.dailyInsightSaved}</Text>
          <View style={{ flex: 1 }} />
          <Text style={styles.chevron}>›</Text>
        </View>
      ) : (
        <View style={styles.insightRow}>
          <View style={{ flex: 1 }} />
          <Text style={styles.chevron}>›</Text>
        </View>
      )}
    </Card>
  );
}

/* ─── Detail modal (mirrors DailyInsight CompletedView) ─── */

function HistoryDetailModal({
  data,
  onClose,
  onDelete,
  t,
}: {
  data: RecordDetail;
  onClose: () => void;
  onDelete: (dateKey: string) => void;
  t: Translations;
}) {
  const dp = parseDateParts(data.date);
  const dateStr = `${dp.weekday}, ${dp.month} ${dp.day}`;

  const effColor =
    data.efficiency >= 85
      ? Colors.brightGreen
      : data.efficiency >= 70
        ? Colors.amber
        : Colors.lavenderDark;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            {/* Date header */}
            <View style={styles.detailHeader}>
              <View style={styles.detailMoon}>
                <Text style={{ fontSize: 20 }}>🌙</Text>
              </View>
              <View>
                <Text style={styles.detailDateMain}>{dp.month} {dp.day}</Text>
                <Text style={styles.detailDateSub}>{dateStr}</Text>
              </View>
              <TouchableOpacity style={styles.closeX} onPress={onClose}>
                <Text style={styles.closeXText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Bedtime / Wake time 2-column (same as CompletedView) */}
            <View style={styles.detailTwoCol}>
              <View style={[styles.detailTimeCard, styles.detailBedCard]}>
                <Text style={styles.detailTimeIcon}>🛏️</Text>
                <Text style={styles.detailTimeLabel}>{t.bedtime}</Text>
                <Text style={styles.detailTimeValue}>{data.bedtimeStr}</Text>
              </View>
              <View style={[styles.detailTimeCard, styles.detailWakeCard]}>
                <Text style={styles.detailTimeIcon}>☀️</Text>
                <Text style={styles.detailTimeLabel}>{t.wakeTime}</Text>
                <Text style={styles.detailTimeValue}>{data.wakeTimeStr}</Text>
              </View>
            </View>

            {/* Efficiency ring (same as CompletedView) */}
            <View style={styles.detailSection}>
              <View style={styles.detailEffRow}>
                <View style={[styles.detailEffRing, { borderColor: effColor }]}>
                  <Text style={[styles.detailEffPct, { color: effColor }]}>{data.efficiency}%</Text>
                </View>
                <View style={styles.detailEffInfo}>
                  <Text style={styles.detailEffLabel}>{t.sleepEfficiency}</Text>
                  <Text style={styles.detailEffDetail}>{data.durationStr} {t.asleep}</Text>
                </View>
              </View>
            </View>

            {/* Sleep onset / Night wake details */}
            {(data.sleepOnsetMinutes != null || data.nightWakeMinutes != null) && (
              <View style={styles.detailSection}>
                {data.sleepOnsetMinutes != null && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailRowLabel}>{t.detailSleepOnset}</Text>
                    <Text style={styles.detailRowValue}>{data.sleepOnsetMinutes} {t.minutes}</Text>
                  </View>
                )}
                {data.nightWakeMinutes != null && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailRowLabel}>{t.detailNightWake}</Text>
                    <Text style={styles.detailRowValue}>{data.nightWakeMinutes} {t.minutes}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Satisfaction stars (same as CompletedView) */}
            <View style={styles.detailSection}>
              <Text style={styles.detailSatLabel}>{t.satisfactionLabel}</Text>
              <View style={styles.detailStarsRow}>
                <StarRating value={data.satisfaction} readonly size={28} />
              </View>
            </View>

            {/* Memo */}
            {data.memo ? (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionLabel}>{t.detailMemo}</Text>
                <Text style={styles.detailMemoText}>{data.memo}</Text>
              </View>
            ) : null}

            {/* AI Insight (same style as CompletedView InsightCard) */}
            {data.insight ? (
              <View style={styles.detailInsightCard}>
                <View style={styles.detailInsightHeader}>
                  <Text style={styles.detailInsightIcon}>💡</Text>
                  <Text style={styles.detailInsightTitle}>
                    {data.insightTitle || t.todaysInsight}
                  </Text>
                </View>
                <Text style={styles.detailInsightText}>{data.insight}</Text>
              </View>
            ) : null}

            {/* Delete button */}
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
                      onPress: () => onDelete(data.date),
                    },
                  ],
                );
              }}
            >
              <Text style={styles.deleteBtnText}>{t.deleteRecord}</Text>
            </TouchableOpacity>

            {/* Close button */}
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>{t.close}</Text>
            </TouchableOpacity>

            <View style={{ height: Spacing.lg }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.md,
  },
  list: {
    paddingBottom: 120,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  emptyText: {
    fontSize: FontSize.md,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 22,
  },

  /* ─── History Card (compact reference layout) ─── */
  histCard: {
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  dateCol: {
    width: 52,
  },
  dateMain: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  dateSub: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  moonCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.lavenderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moonEmoji: {
    fontSize: 14,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 9,
    color: Colors.textTertiary,
    marginBottom: 1,
  },
  statValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },

  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.lavenderLight,
    gap: Spacing.xs,
  },
  effLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  effValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  insightIndicator: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  chevron: {
    fontSize: FontSize.lg,
    color: Colors.textTertiary,
  },

  /* ─── Upgrade footer ─── */
  upgradeFooter: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  upgradeIcon: {
    fontSize: 28,
    marginBottom: Spacing.sm,
  },
  upgradeText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  upgradeBtn: {
    backgroundColor: Colors.lavenderDark,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  upgradeBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.white,
  },

  /* ─── Detail Modal (mirrors DailyInsight CompletedView) ─── */
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
    overflow: 'hidden',
  },

  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  detailMoon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.lavenderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailDateMain: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  detailDateSub: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  closeX: {
    marginLeft: 'auto',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.lavenderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeXText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },

  detailTwoCol: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  detailTimeCard: {
    flex: 1,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  detailBedCard: {
    backgroundColor: Colors.lavenderLight,
  },
  detailWakeCard: {
    backgroundColor: Colors.mutedGreenLight,
  },
  detailTimeIcon: {
    fontSize: 20,
    marginBottom: Spacing.xs,
  },
  detailTimeLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  detailTimeValue: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },

  detailSection: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },

  detailEffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  detailEffRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailEffPct: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  detailEffInfo: {
    flex: 1,
  },
  detailEffLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
    color: Colors.textPrimary,
  },
  detailEffDetail: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  detailRowLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  detailRowValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },

  detailSatLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  detailStarsRow: {
    alignItems: 'center',
  },

  detailSectionLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  detailMemoText: {
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    lineHeight: 22,
  },

  detailInsightCard: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.lavenderLight,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  detailInsightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  detailInsightIcon: {
    fontSize: 18,
    marginRight: Spacing.xs,
  },
  detailInsightTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.lavenderDark,
  },
  detailInsightText: {
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    lineHeight: 22,
  },

  deleteBtn: {
    marginTop: Spacing.lg,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    marginHorizontal: Spacing.md,
  },
  deleteBtnText: {
    fontSize: FontSize.sm,
    color: '#C45B5B',
    fontWeight: FontWeight.medium,
  },
  closeBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    marginHorizontal: Spacing.md,
  },
  closeBtnText: {
    fontSize: FontSize.md,
    color: Colors.lavenderDark,
    fontWeight: FontWeight.medium,
  },
});
