import { getSleepDisplayDate } from '../utils/time';
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../i18n';
import { useSleepStore } from '../hooks/useSleepStore';
import { sessionKey } from '../services/sleepStore';
import { visibleSleepHistory } from '../services/sleepHistory';
import { useProStatus } from '../hooks/useProStatus';
import { Card } from '../components/Card';
import { StarRating } from '../components/StarRating';
import { SleepDayContent, SleepDayData } from '../components/SleepDayContent';
import { SleepRecord } from '../types/sleep';
import { calcTimeInBed, calcSleepEfficiency, formatDuration, formatTime } from '../utils/time';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../constants/theme';
import { Translations } from '../i18n/types';


interface RecordDetail {
  sessionKey: string;
  date: string;
  bedtimeStr: string;
  wakeTimeStr: string;
  durationStr: string;
  totalSleepStr: string;
  efficiency: number;
  satisfaction: number;
  sleepOnsetMinutes: number | null;
  nightWakeMinutes: number | null;
  memo: string;
  insight: string;
  insightTitle: string;
  insightSource?: SleepRecord['insightSource'];
  techniques: string[];
  techniqueResponses: Record<string, import('../types/sleep').TechniqueResponse>;
}

function buildDetail(r: SleepRecord): RecordDetail | null {
  if (!r.bedtime || !r.wakeTime || r.satisfaction === null) return null;
  const bed = new Date(r.bedtime);
  const wake = new Date(r.wakeTime);
  const tib = calcTimeInBed(bed, wake);
  const sol = r.sleepOnsetMinutes ?? 0;
  const waso = r.nightWakeMinutes ?? 0;
  const eff = calcSleepEfficiency(tib, sol, waso);
  const totalSleepMin = Math.max(0, tib - sol - waso);
  return {
    sessionKey: sessionKey(r),
    date: getSleepDisplayDate(r),
    bedtimeStr: formatTime(bed),
    wakeTimeStr: formatTime(wake),
    durationStr: formatDuration(tib),
    totalSleepStr: formatDuration(totalSleepMin),
    efficiency: eff,
    satisfaction: r.satisfaction,
    sleepOnsetMinutes: r.sleepOnsetMinutes,
    nightWakeMinutes: r.nightWakeMinutes,
    memo: r.memo,
    insight: r.insight,
    insightTitle: r.insightTitle ?? '',
    insightSource: r.insightSource,
    techniques: r.techniques,
    techniqueResponses: r.techniqueResponses,
  };
}

function parseDateParts(dateStr: string, locale: string) {
  const [y, m, d] = dateStr.split('-');
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return {
    month: date.toLocaleDateString(locale, { month: 'short' }),
    day: date.getDate(),
    weekday: date.toLocaleDateString(locale, { weekday: 'short' }),
    shortDate: date.toLocaleDateString(locale, { month: 'short', day: 'numeric' }),
    fullDate: date.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' }),
  };
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
        .sort((a, b) => getSleepDisplayDate(b).localeCompare(getSleepDisplayDate(a))),
    [records],
  );

  const completed = useMemo(
    () => visibleSleepHistory(allCompleted, isPro),
    [allCompleted, isPro],
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
        keyExtractor={sessionKey}
        contentContainerStyle={styles.list}
        style={{ flex: 1 }}
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
  const { locale } = useI18n();
  const dp = parseDateParts(data.date, locale);
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
          <Text style={styles.dateMain}>{dp.shortDate}</Text>
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

      {/* Bottom rows: total sleep + efficiency + stars, then insight */}
      <View style={styles.bottomRow}>
        <Text style={styles.effLabel}>{t.detailTotalSleep}</Text>
        <Text style={styles.totalSleepValue}>{data.totalSleepStr}</Text>
        <Text style={styles.effDivider}>|</Text>
        <Text style={styles.effLabel}>{t.sleepEfficiency}</Text>
        <Text style={[styles.effValue, { color: effColor }]}>{data.efficiency}%</Text>
      </View>
      <View style={styles.insightRow}>
        <StarRating value={data.satisfaction} readonly size={14} />
        {data.techniques.length > 0 && (
          <Text style={[styles.insightIndicator, { marginLeft: Spacing.sm }]}>🧠 {t.detailTechniques}</Text>
        )}
        {data.insight ? (
          <Text style={[styles.insightIndicator, { marginLeft: Spacing.sm }]}>
            📝 {t.dailyInsightSaved}
          </Text>
        ) : null}
        <View style={{ flex: 1 }} />
        <Text style={styles.chevron}>›</Text>
      </View>
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
  const { locale } = useI18n();
  const dp = parseDateParts(data.date, locale);
  const dateStr = dp.fullDate;

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
          <ScrollView showsVerticalScrollIndicator={true} style={styles.modalScroll}>
            {/* Date header */}
            <View style={styles.detailHeader}>
              <View style={styles.detailMoon}>
                <Text style={{ fontSize: 20 }}>🌙</Text>
              </View>
              <View>
                <Text style={styles.detailDateMain}>{dp.month} {dp.day}</Text>
                <Text style={styles.detailDateSub}>{dateStr}</Text>
              </View>
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

            {/* Efficiency ring */}
            <View style={styles.detailSection}>
              <View style={styles.detailEffRow}>
                <View style={[styles.detailEffRing, { borderColor: effColor }]}>
                  <Text style={[styles.detailEffPct, { color: effColor }]}>{data.efficiency}%</Text>
                </View>
                <View style={styles.detailEffInfo}>
                  <Text style={styles.detailEffLabel}>{t.sleepEfficiency}</Text>
                  <Text style={styles.detailEffDetail}>{data.durationStr} {t.inBed}</Text>
                </View>
              </View>
            </View>

            {/* Shared content: SOL, WASO, total sleep, satisfaction, techniques, memo, insight */}
            <SleepDayContent
              data={{
                ...data,
                techniqueIds: data.techniques,
              }}
              t={t}
            />

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
                      onPress: () => onDelete(data.sessionKey),
                    },
                  ],
                );
              }}
            >
              <Text style={styles.deleteBtnText}>{t.deleteRecord}</Text>
            </TouchableOpacity>

            <View style={{ height: Spacing.sm }} />
          </ScrollView>

          {/* Fixed close button at bottom */}
          <TouchableOpacity style={styles.fixedCloseBtn} onPress={onClose}>
            <Text style={styles.fixedCloseBtnText}>{t.close}</Text>
          </TouchableOpacity>
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
  totalSleepValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginLeft: 2,
  },
  effDivider: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginHorizontal: 4,
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
    alignItems: 'center',
    padding: Spacing.md,
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    width: '100%',
    maxWidth: 400,
    flex: 1,
    marginVertical: 40,
    overflow: 'hidden',
  },
  modalScroll: {
    flex: 1,
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
  fixedCloseBtn: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.lavenderLight,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  fixedCloseBtnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.lavenderDark,
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
});
