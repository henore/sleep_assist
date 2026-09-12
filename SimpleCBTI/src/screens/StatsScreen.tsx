import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  Modal,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../i18n';
import { Translations } from '../i18n/types';
import { useSleepStore } from '../hooks/useSleepStore';
import { Card } from '../components/Card';
import { SleepRecord } from '../types/sleep';
import { calcTimeInBed, calcSleepEfficiency, formatDuration } from '../utils/time';
import { useProStatus } from '../hooks/useProStatus';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../constants/theme';

const SCREEN_W = Dimensions.get('window').width;

interface DayStat {
  date: string;
  label: string;
  weekday: string;
  dateLabel: string;
  sleepOnset: number;
  nightWake: number;
  actualSleep: number;
  timeInBed: number;
  efficiency: number;
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function getMonday(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}

function formatDateShort(d: Date): string {
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

function buildWeekStats(records: SleepRecord[], weekStart: Date): DayStat[] {
  const completed = records.filter(
    (r) => r.wakeTime && r.satisfaction !== null,
  );
  const byDate = new Map(completed.map((r) => [r.date, r]));
  const result: DayStat[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const key = dateKey(d);
    const label = `${d.getMonth() + 1}/${d.getDate()}`;
    const weekday = WEEKDAY_SHORT[d.getDay()];
    const dateLabel = `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
    const r = byDate.get(key);

    if (r && r.bedtime && r.wakeTime) {
      const bed = new Date(r.bedtime);
      const wake = new Date(r.wakeTime);
      const tib = calcTimeInBed(bed, wake);
      const onset = r.sleepOnsetMinutes ?? 0;
      const nw = r.nightWakeMinutes ?? 0;
      const actual = Math.max(0, tib - onset - nw);
      const eff = calcSleepEfficiency(tib, onset, nw);
      result.push({
        date: key, label, weekday, dateLabel,
        sleepOnset: onset, nightWake: nw,
        actualSleep: actual, timeInBed: tib, efficiency: eff,
      });
    } else {
      result.push({
        date: key, label, weekday, dateLabel,
        sleepOnset: 0, nightWake: 0,
        actualSleep: 0, timeInBed: 0, efficiency: 0,
      });
    }
  }
  return result;
}

function isCurrentWeek(weekStart: Date): boolean {
  const now = new Date();
  const currentMonday = getMonday(now);
  return weekStart.getTime() === currentMonday.getTime();
}

function computeAvg(stats: DayStat[]): { avgSleep: number; avgEff: number; avgOnset: number; avgWake: number } {
  const valid = stats.filter((s) => s.timeInBed > 0);
  if (valid.length === 0) return { avgSleep: 0, avgEff: 0, avgOnset: 0, avgWake: 0 };
  return {
    avgSleep: Math.round(valid.reduce((s, d) => s + d.actualSleep, 0) / valid.length),
    avgEff: Math.round(valid.reduce((s, d) => s + d.efficiency, 0) / valid.length),
    avgOnset: Math.round(valid.reduce((s, d) => s + d.sleepOnset, 0) / valid.length),
    avgWake: Math.round(valid.reduce((s, d) => s + d.nightWake, 0) / valid.length),
  };
}

function formatDelta(current: number, previous: number, suffix: string): { text: string; color: string } {
  if (previous === 0) return { text: '', color: Colors.textTertiary };
  const diff = current - previous;
  const sign = diff > 0 ? '+' : '';
  const isGood = suffix === '%' ? diff >= 0 : diff <= 0;
  return {
    text: `${sign}${diff}${suffix}`,
    color: isGood ? Colors.mutedGreenDark : Colors.lavenderDark,
  };
}

export function StatsScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { records } = useSleepStore();

  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [pickerVisible, setPickerVisible] = useState(false);

  const isCurrent = isCurrentWeek(weekStart);
  const { isPro } = useProStatus();

  const stats = useMemo(
    () => buildWeekStats(records, weekStart),
    [records, weekStart],
  );
  const hasData = stats.some((s) => s.timeInBed > 0);

  const prevWeekStart = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    return d;
  }, [weekStart]);

  const prevStats = useMemo(
    () => buildWeekStats(records, prevWeekStart),
    [records, prevWeekStart],
  );

  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return d;
  }, [weekStart]);

  const navigateWeek = useCallback((dir: -1 | 1) => {
    setWeekStart((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + dir * 7);
      const currentMonday = getMonday(new Date());
      if (next.getTime() > currentMonday.getTime()) return prev;
      return next;
    });
  }, []);

  const jumpToWeek = useCallback((monday: Date) => {
    const currentMonday = getMonday(new Date());
    if (monday.getTime() > currentMonday.getTime()) return;
    setWeekStart(monday);
    setPickerVisible(false);
  }, []);

  const showProGate = !isCurrent && !isPro;

  if (!hasData && isCurrent) {
    return (
      <View style={[styles.emptyContainer, { paddingTop: insets.top }]}>
        <Text style={styles.emptyIcon}>📊</Text>
        <Text style={styles.emptyText}>{t.statsEmpty}</Text>
      </View>
    );
  }

  const avg = computeAvg(stats);
  const prevAvg = computeAvg(prevStats);
  const effDelta = formatDelta(avg.avgEff, prevAvg.avgEff, '%');
  const sleepDelta = formatDelta(avg.avgSleep, prevAvg.avgSleep, 'm');
  const onsetDelta = formatDelta(avg.avgOnset, prevAvg.avgOnset, 'm');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.header}>{t.tabStats}</Text>

      <View style={styles.navRow}>
        <TouchableOpacity onPress={() => navigateWeek(-1)} style={styles.navArrow}>
          <Text style={styles.navArrowText}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setPickerVisible(true)}>
          <Text style={styles.navDateText}>
            {formatDateShort(weekStart)} – {formatDateShort(weekEnd)}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigateWeek(1)}
          style={styles.navArrow}
          disabled={isCurrent}
        >
          <Text style={[styles.navArrowText, isCurrent && styles.navArrowDisabled]}>›</Text>
        </TouchableOpacity>
      </View>

      {showProGate ? (
        <View style={styles.proGateContainer}>
          <Card>
            <Text style={styles.proIcon}>🔒</Text>
            <Text style={styles.proTitle}>{t.statsProTitle}</Text>
            <Text style={styles.proDesc}>{t.statsProDesc}</Text>
          </Card>
        </View>
      ) : (
        <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
          {/* Weekly Averages - 3 columns */}
          <Card>
            <Text style={styles.sectionTitle}>{t.weeklyAverages}</Text>
            <View style={styles.avgRow}>
              <View style={styles.avgCol}>
                <View style={[styles.avgRing, {
                  borderColor: avg.avgEff >= 85 ? Colors.brightGreen
                    : avg.avgEff >= 70 ? Colors.amber
                      : Colors.lavenderDark,
                }]}>
                  <Text style={[styles.avgRingText, {
                    color: avg.avgEff >= 85 ? Colors.brightGreen
                      : avg.avgEff >= 70 ? Colors.amber
                        : Colors.lavenderDark,
                  }]}>{avg.avgEff}%</Text>
                </View>
                <Text style={styles.avgLabel}>{t.sleepEfficiency}</Text>
                {effDelta.text !== '' && (
                  <>
                    <Text style={[styles.avgDelta, { color: effDelta.color }]}>{effDelta.text}</Text>
                    <Text style={styles.avgVs}>{t.vsPreviousWeek}</Text>
                  </>
                )}
              </View>

              <View style={styles.avgCol}>
                <Text style={styles.avgIcon}>🛏️</Text>
                <Text style={styles.avgValue}>{formatDuration(avg.avgSleep)}</Text>
                <Text style={styles.avgLabel}>{t.sleepTime}</Text>
                {sleepDelta.text !== '' && (
                  <>
                    <Text style={[styles.avgDelta, { color: sleepDelta.color }]}>{sleepDelta.text}</Text>
                    <Text style={styles.avgVs}>{t.vsPreviousWeek}</Text>
                  </>
                )}
              </View>

              <View style={styles.avgCol}>
                <Text style={styles.avgIcon}>⏱️</Text>
                <Text style={styles.avgValue}>{avg.avgOnset}m</Text>
                <Text style={styles.avgLabel}>{t.timeToFallAsleep}</Text>
                {onsetDelta.text !== '' && (
                  <>
                    <Text style={[styles.avgDelta, { color: onsetDelta.color }]}>{onsetDelta.text}</Text>
                    <Text style={styles.avgVs}>{t.vsPreviousWeek}</Text>
                  </>
                )}
              </View>
            </View>
          </Card>

          {/* Sleep by Day */}
          <Card>
            <Text style={styles.sectionTitle}>{t.sleepByDay}</Text>
            <DurationChart stats={stats} t={t} />
          </Card>

          {/* Sleep Efficiency Trend */}
          <Card>
            <View style={styles.trendHeader}>
              <Text style={styles.sectionTitle}>{t.sleepEfficiencyTrend}</Text>
              {effDelta.text !== '' && (
                <View style={[styles.trendBadge, {
                  backgroundColor: avg.avgEff >= prevAvg.avgEff ? Colors.brightGreenLight : Colors.lavenderLight,
                }]}>
                  <Text style={[styles.trendBadgeText, { color: effDelta.color }]}>{effDelta.text}</Text>
                  <Text style={styles.trendBadgeVs}>{t.vsLastWeek}</Text>
                </View>
              )}
            </View>
            <EfficiencyChart stats={stats} />
          </Card>

          <View style={{ height: 120 }} />
        </ScrollView>
      )}

      <MonthPickerModal
        visible={pickerVisible}
        currentWeekStart={weekStart}
        onSelect={jumpToWeek}
        onClose={() => setPickerVisible(false)}
        t={t}
      />
    </View>
  );
}

/* ─── Duration: stacked bar chart ─── */

function DurationChart({ stats, t }: { stats: DayStat[]; t: Translations }) {
  const maxMinutes = Math.max(...stats.map((s) => s.timeInBed), 60);
  const chartH = 180;
  const barW = Math.min(32, (SCREEN_W - 100) / 7 - 4);

  return (
    <View>
      <View style={styles.legendRow}>
        <LegendDot color={Colors.brightGreen} label={t.statsActualSleep} />
        <LegendDot color={Colors.lavender} label={t.statsSleepOnset} />
        <LegendDot color={Colors.amber} label={t.statsNightWake} />
      </View>

      <View style={[styles.chartArea, { height: chartH + 40 }]}>
        <View style={styles.yAxis}>
          {[0, 3, 6, 9, 12].filter((h) => h * 60 <= maxMinutes + 60).map((h) => (
            <Text
              key={h}
              style={[styles.yLabel, { bottom: (h * 60 / maxMinutes) * chartH + 16 }]}
            >
              {h}h
            </Text>
          ))}
        </View>

        <View style={styles.barsContainer}>
          {stats.map((day, i) => {
            if (day.timeInBed === 0) {
              return (
                <View key={i} style={[styles.barColumn, { width: barW + 4 }]}>
                  <View style={[styles.barStack, { height: chartH }]}>
                    <View style={styles.emptyBar} />
                  </View>
                  <Text style={styles.xLabel}>{day.weekday}</Text>
                  <Text style={styles.xDateLabel}>{day.dateLabel}</Text>
                </View>
              );
            }

            const sleepH = (day.actualSleep / maxMinutes) * chartH;
            const onsetH = (day.sleepOnset / maxMinutes) * chartH;
            const wakeH = (day.nightWake / maxMinutes) * chartH;

            return (
              <View key={i} style={[styles.barColumn, { width: barW + 4 }]}>
                <View style={[styles.barStack, { height: chartH }]}>
                  <View style={{ flex: 1 }} />
                  <View style={[styles.barSegment, { height: wakeH, backgroundColor: Colors.amber }]} />
                  <View style={[styles.barSegment, { height: sleepH, backgroundColor: Colors.brightGreen, borderTopLeftRadius: 3, borderTopRightRadius: 3 }]} />
                  <View style={[styles.barSegment, { height: onsetH, backgroundColor: Colors.lavender }]} />
                </View>
                <Text style={styles.xLabel}>{day.weekday}</Text>
                <Text style={styles.xDateLabel}>{day.dateLabel}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

/* ─── Efficiency: line chart ─── */

function EfficiencyChart({ stats }: { stats: DayStat[] }) {
  const chartH = 160;
  const chartW = SCREEN_W - 80;
  const validPoints = stats
    .map((s, i) => ({ x: i, eff: s.efficiency, has: s.timeInBed > 0, weekday: s.weekday, dateLabel: s.dateLabel }))
    .filter((p) => p.has);

  return (
    <View>
      <View style={{ width: chartW + 60, height: chartH + 50, alignSelf: 'center' }}>
        {[0, 25, 50, 75, 100].map((pct) => (
          <View key={pct} style={[styles.gridLine, { bottom: (pct / 100) * chartH + 30 }]}>
            <Text style={styles.gridLabel}>{pct}%</Text>
          </View>
        ))}

        <View style={[styles.lineChartArea, { height: chartH }]}>
          {validPoints.map((p, idx) => {
            if (idx === 0) return null;
            const prev = validPoints[idx - 1];
            const x1 = 40 + (prev.x / 6) * (chartW - 20);
            const y1 = chartH - (prev.eff / 100) * chartH;
            const x2 = 40 + (p.x / 6) * (chartW - 20);
            const y2 = chartH - (p.eff / 100) * chartH;
            const dx = x2 - x1;
            const dy = y2 - y1;
            const len = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
            return (
              <View
                key={`line-${idx}`}
                style={{
                  position: 'absolute',
                  left: x1,
                  top: y1,
                  width: len,
                  height: 2,
                  backgroundColor: Colors.brightGreen,
                  transform: [{ rotate: `${angle}deg` }],
                  transformOrigin: 'left center',
                }}
              />
            );
          })}

          {validPoints.map((p, idx) => {
            const x = 40 + (p.x / 6) * (chartW - 20);
            const y = chartH - (p.eff / 100) * chartH;
            return (
              <View
                key={idx}
                style={[
                  styles.lineDot,
                  {
                    left: x - 5,
                    top: y - 5,
                    backgroundColor: Colors.brightGreen,
                  },
                ]}
              />
            );
          })}
        </View>

        <View style={styles.xAxisLine}>
          {stats.map((s, i) => {
            const x = 40 + (i / 6) * (chartW - 20);
            return (
              <View key={i} style={{ position: 'absolute', left: x - 16, alignItems: 'center' }}>
                <Text style={styles.xLabelAbs}>{s.dateLabel}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

/* ─── Month picker modal ─── */

function MonthPickerModal({
  visible,
  currentWeekStart,
  onSelect,
  onClose,
  t,
}: {
  visible: boolean;
  currentWeekStart: Date;
  onSelect: (monday: Date) => void;
  onClose: () => void;
  t: Translations;
}) {
  const [viewDate, setViewDate] = useState(() => new Date(currentWeekStart));

  const navigateMonth = (dir: -1 | 1) => {
    setViewDate((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + dir);
      return d;
    });
  };

  const weeks = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const first = new Date(year, month, 1);
    const firstMonday = getMonday(first);
    const result: Date[] = [];
    const d = new Date(firstMonday);
    while (true) {
      result.push(new Date(d));
      d.setDate(d.getDate() + 7);
      if (d.getMonth() !== month && d.getDate() > 7) break;
    }
    return result;
  }, [viewDate]);

  const todayMonday = getMonday(new Date());

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.pickerContainer} onStartShouldSetResponder={() => true}>
          <View style={styles.pickerHeader}>
            <TouchableOpacity onPress={() => navigateMonth(-1)}>
              <Text style={styles.pickerArrow}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.pickerTitle}>
              {MONTH_NAMES[viewDate.getMonth()]} {viewDate.getFullYear()}
            </Text>
            <TouchableOpacity onPress={() => navigateMonth(1)}>
              <Text style={styles.pickerArrow}>›</Text>
            </TouchableOpacity>
          </View>

          {weeks.map((monday) => {
            const sunday = new Date(monday);
            sunday.setDate(sunday.getDate() + 6);
            const isFuture = monday.getTime() > todayMonday.getTime();
            const isSelected = monday.getTime() === currentWeekStart.getTime();

            return (
              <TouchableOpacity
                key={monday.toISOString()}
                style={[
                  styles.weekRow,
                  isSelected && styles.weekRowSelected,
                  isFuture && styles.weekRowDisabled,
                ]}
                onPress={() => !isFuture && onSelect(monday)}
                disabled={isFuture}
              >
                <Text style={[
                  styles.weekRowText,
                  isSelected && styles.weekRowTextSelected,
                  isFuture && styles.weekRowTextDisabled,
                ]}>
                  {formatDateShort(monday)} – {formatDateShort(sunday)}
                </Text>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity onPress={onClose} style={styles.pickerClose}>
            <Text style={styles.pickerCloseText}>{t.close}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

/* ─── Legend dot ─── */

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendColor, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

/* ─── Styles ─── */

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
    paddingBottom: Spacing.xs,
  },
  scrollBody: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyIcon: { fontSize: 48, marginBottom: Spacing.md },
  emptyText: {
    fontSize: FontSize.md,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Section titles
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },

  // Week navigation
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  navArrow: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: Colors.surface,
  },
  navArrowText: {
    fontSize: 24,
    fontWeight: FontWeight.medium,
    color: Colors.lavenderDark,
  },
  navArrowDisabled: {
    color: Colors.blueGreyLight,
  },
  navDateText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },

  // Weekly Averages
  avgRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  avgCol: {
    flex: 1,
    alignItems: 'center',
  },
  avgRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  avgRingText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  avgIcon: {
    fontSize: 22,
    marginBottom: Spacing.xs,
  },
  avgValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  avgLabel: {
    fontSize: 9,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 2,
  },
  avgDelta: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  avgVs: {
    fontSize: 8,
    color: Colors.textTertiary,
    textAlign: 'center',
  },

  // Trend header
  trendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  trendBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  trendBadgeText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  trendBadgeVs: {
    fontSize: 8,
    color: Colors.textTertiary,
  },

  // Pro gate
  proGateContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: Spacing.xxl,
  },
  proIcon: {
    fontSize: 40,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  proTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  proDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // Legend
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendColor: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },

  // Bar chart
  chartArea: {
    flexDirection: 'row',
    paddingLeft: 36,
  },
  yAxis: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 30,
    width: 32,
  },
  yLabel: {
    position: 'absolute',
    left: 0,
    fontSize: 9,
    color: Colors.textTertiary,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flex: 1,
    gap: 2,
    justifyContent: 'space-around',
  },
  barColumn: {
    alignItems: 'center',
  },
  barStack: {
    width: '100%',
    justifyContent: 'flex-end',
  },
  barSegment: {
    width: '100%',
  },
  emptyBar: {
    height: 2,
    width: '60%',
    backgroundColor: Colors.blueGreyLight,
    alignSelf: 'center',
    borderRadius: 1,
  },
  xLabel: {
    fontSize: 9,
    fontWeight: FontWeight.medium,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  xDateLabel: {
    fontSize: 7,
    color: Colors.textTertiary,
  },

  // Line chart
  lineChartArea: {
    position: 'relative',
    marginTop: 10,
  },
  lineDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  gridLine: {
    position: 'absolute',
    left: 36,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.lavenderLight,
    flexDirection: 'row',
    alignItems: 'center',
  },
  gridLabel: {
    position: 'absolute',
    left: -32,
    fontSize: 9,
    color: Colors.textTertiary,
  },
  xAxisLine: {
    height: 20,
    position: 'relative',
  },
  xLabelAbs: {
    fontSize: 8,
    color: Colors.textTertiary,
    textAlign: 'center',
  },

  // Month picker modal
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContainer: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    width: SCREEN_W - 48,
    maxWidth: 360,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  pickerArrow: {
    fontSize: 28,
    color: Colors.lavenderDark,
    fontWeight: FontWeight.medium,
    paddingHorizontal: Spacing.sm,
  },
  pickerTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  weekRow: {
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
  },
  weekRowSelected: {
    backgroundColor: Colors.lavenderLight,
  },
  weekRowDisabled: {
    opacity: 0.4,
  },
  weekRowText: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  weekRowTextSelected: {
    fontWeight: FontWeight.semibold,
    color: Colors.lavenderDark,
  },
  weekRowTextDisabled: {
    color: Colors.textTertiary,
  },
  pickerClose: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  pickerCloseText: {
    fontSize: FontSize.md,
    color: Colors.lavenderDark,
    fontWeight: FontWeight.medium,
  },
});
