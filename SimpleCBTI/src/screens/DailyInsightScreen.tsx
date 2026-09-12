import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Animated,
  TouchableOpacity,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../components/Card';
import { StarRating } from '../components/StarRating';
import { SleepDetailOverlay } from '../components/SleepDetailOverlay';
import { useSleepStore } from '../hooks/useSleepStore';
import { useProStatus } from '../hooks/useProStatus';
import { useTypewriter } from '../hooks/useTypewriter';
import { useI18n } from '../i18n';
import { Translations } from '../i18n/types';
import { TECHNIQUE_DEFS } from '../constants/techniques';
import { TechniqueResponse } from '../types/sleep';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../constants/theme';
import { formatTime, formatDuration } from '../utils/time';
import { CheckInData } from '../types/sleep';

export function DailyInsightScreen() {
  const insets = useSafeAreaInsets();
  const store = useSleepStore();
  const { t, locale } = useI18n();
  const { today } = store;
  const { isPro } = useProStatus();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {today.phase === 'check_in' && (
          <Text style={styles.header}>{t.headerDailyInsight}</Text>
        )}

        {today.phase === 'idle' && <IdleView onBedtime={store.recordBedtime} t={t} />}
        {today.phase === 'sleeping' && (
          <SleepingView bedtime={today.bedtime!} onWakeUp={store.recordWakeUp} t={t} />
        )}
        {today.phase === 'check_in' && (
          <CheckInView
            bedtime={today.bedtime!}
            wakeTime={today.wakeTime!}
            techniqueIds={today.techniqueIds}
            onComplete={(data) => store.completeCheckIn(data, t, locale)}
            t={t}
            isPro={isPro}
          />
        )}
        {today.phase === 'completed' && (
          <CompletedView
            getSummary={store.getSummary}
            onNextBedtime={store.recordBedtime}
            t={t}
            isPro={isPro}
          />
        )}
      </ScrollView>
    </View>
  );
}

function IdleView({ onBedtime, t }: { onBedtime: () => void; t: Translations }) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <View>
      <View style={styles.appHeader}>
        <Text style={styles.appHeaderIcon}>🌙</Text>
        <View>
          <Text style={styles.appHeaderTitle}>Simple CBT-I</Text>
          <Text style={styles.appHeaderSubtitle}>{t.appSubtitle}</Text>
        </View>
      </View>

      <Card>
        <Text style={actionStyles.prompt}>{t.readyForTonight}</Text>
        <View style={actionStyles.btnWrap}>
          <HoldButton
            icon="🌙"
            label={t.bedtime}
            hint={t.longPressBedtime}
            onComplete={onBedtime}
            trackColor={Colors.lavenderLight}
            fillColor={Colors.lavender}
          />
        </View>
      </Card>

      <Card style={styles.todayRow}>
        <View style={styles.todayRowInner}>
          <Text style={styles.todayIcon}>📅</Text>
          <Text style={styles.todayLabel}>{t.today}</Text>
          <Text style={styles.todayDate}>{dateStr}</Text>
        </View>
      </Card>
    </View>
  );
}

function SleepingView({
  bedtime,
  onWakeUp,
  t,
}: {
  bedtime: Date;
  onWakeUp: () => void;
  t: Translations;
}) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    const update = () => {
      const diffMs = Date.now() - bedtime.getTime();
      if (diffMs < 0) {
        setElapsed('');
        return;
      }
      setElapsed(formatDuration(Math.floor(diffMs / 60000)));
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [bedtime]);

  return (
    <View>
      <View style={styles.appHeader}>
        <Text style={styles.appHeaderIcon}>🌙</Text>
        <View>
          <Text style={styles.appHeaderTitle}>Simple CBT-I</Text>
          <Text style={styles.appHeaderSubtitle}>{t.appSubtitle}</Text>
        </View>
      </View>

      <Card>
        <Text style={actionStyles.sessionStatus}>{t.sleepSessionActive}</Text>

        <View style={actionStyles.bedtimeDisplay}>
          <Text style={actionStyles.bedtimeIcon}>🛏️</Text>
          <View>
            <Text style={actionStyles.bedtimeLabel}>{t.bedtime}</Text>
            <Text style={actionStyles.bedtimeTime}>{formatTime(bedtime)}</Text>
          </View>
        </View>

        {elapsed ? (
          <Text style={actionStyles.elapsed}>
            {t.inBedFor} {elapsed}
          </Text>
        ) : null}

        <View style={actionStyles.btnWrap}>
          <HoldButton
            icon="☀️"
            label={t.wakeUp}
            hint={t.longPressWakeUp}
            onComplete={onWakeUp}
            trackColor={Colors.mutedGreenLight}
            fillColor={Colors.mutedGreen}
          />
        </View>
      </Card>
    </View>
  );
}

function CheckInView({
  bedtime,
  wakeTime,
  techniqueIds,
  onComplete,
  t,
  isPro,
}: {
  bedtime: Date;
  wakeTime: Date;
  techniqueIds: string[];
  onComplete: (data: CheckInData) => void;
  t: Translations;
  isPro: boolean;
}) {
  const [sleepOnset, setSleepOnset] = useState('');
  const [nightWake, setNightWake] = useState('');
  const [satisfaction, setSatisfaction] = useState(0);
  const [memo, setMemo] = useState('');
  const [techResponses, setTechResponses] = useState<Record<string, TechniqueResponse>>({});
  const [encouragement, setEncouragement] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const techniques = TECHNIQUE_DEFS.filter((td) => techniqueIds.includes(td.id));

  const handleSubmit = () => {
    const data: CheckInData = {
      sleepOnsetMinutes: parseInt(sleepOnset) || 0,
      nightWakeMinutes: parseInt(nightWake) || 0,
      satisfaction,
      memo,
      techniqueResponses: techResponses,
    };

    const messages = [t.encouragement1, t.encouragement2, t.encouragement3, t.encouragement4];
    setEncouragement(messages[Math.floor(Math.random() * messages.length)]);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    setTimeout(() => onComplete(data), 2000);
  };

  const canSubmit = sleepOnset !== '' && satisfaction > 0;

  return (
    <View>
      <Card>
        <Text style={styles.checkInTitle}>{t.morningCheckIn}</Text>
        <Text style={styles.checkInTimeRange}>
          {formatTime(bedtime)} → {formatTime(wakeTime)}
        </Text>
      </Card>

      <Card>
        <Text style={styles.fieldLabel}>{t.sleepOnsetLabel}</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.numberInput}
            keyboardType="number-pad"
            value={sleepOnset}
            onChangeText={setSleepOnset}
            placeholder="0"
            placeholderTextColor={Colors.textTertiary}
            maxLength={3}
          />
          <Text style={styles.inputUnit}>{t.minutes}</Text>
        </View>
      </Card>

      <Card>
        <Text style={styles.fieldLabel}>{t.nightWakeLabel}</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.numberInput}
            keyboardType="number-pad"
            value={nightWake}
            onChangeText={setNightWake}
            placeholder="0"
            placeholderTextColor={Colors.textTertiary}
            maxLength={3}
          />
          <Text style={styles.inputUnit}>{t.minutes}</Text>
        </View>
      </Card>

      <Card>
        <Text style={styles.fieldLabel}>{t.satisfactionLabel}</Text>
        <View style={{ marginTop: Spacing.sm }}>
          <StarRating value={satisfaction} onChange={setSatisfaction} size={36} />
        </View>
      </Card>

      <Card>
        <Text style={styles.fieldLabel}>{t.memoLabel}</Text>
        <TextInput
          style={styles.memoInput}
          value={memo}
          onChangeText={setMemo}
          placeholder={t.memoPlaceholder}
          placeholderTextColor={Colors.textTertiary}
          multiline
          maxLength={200}
        />
      </Card>

      <Card>
        <Text style={styles.fieldLabel}>{t.todaysTechniques}</Text>
        <Text style={styles.fieldHint}>{t.tapCompleted}</Text>
        {techniques.map((tech) => {
          const resp = techResponses[tech.id];
          return (
            <View key={tech.id} style={styles.techItem}>
              <Text style={styles.techLabel}>{t[tech.labelKey]}</Text>
              <View style={styles.techBtnRow}>
                <TouchableOpacity
                  style={[styles.techBtn, resp === 'done' && styles.techBtnDone]}
                  onPress={() => setTechResponses((p) => ({ ...p, [tech.id]: 'done' }))}
                >
                  <Text style={[styles.techBtnText, resp === 'done' && styles.techBtnTextActive]}>
                    ✓ {t.techResponseDone}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.techBtn, resp === 'na' && styles.techBtnNA]}
                  onPress={() => setTechResponses((p) => ({ ...p, [tech.id]: 'na' }))}
                >
                  <Text style={[styles.techBtnText, resp === 'na' && styles.techBtnTextActive]}>
                    － {t.techResponseNA}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.techBtn, resp === 'failed' && styles.techBtnFailed]}
                  onPress={() => setTechResponses((p) => ({ ...p, [tech.id]: 'failed' }))}
                >
                  <Text style={[styles.techBtnText, resp === 'failed' && styles.techBtnTextActive]}>
                    × {t.techResponseFailed}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </Card>

      <View style={{ paddingHorizontal: Spacing.md, marginTop: Spacing.sm }}>
        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit}
          style={({ pressed }) => [
            styles.submitButton,
            !canSubmit && styles.submitButtonDisabled,
            pressed && { opacity: 0.8 },
          ]}
        >
          <Text style={styles.submitButtonText}>{t.submitCheckIn}</Text>
        </Pressable>
      </View>

      {encouragement !== '' && (
        <Animated.View style={[styles.encouragement, { opacity: fadeAnim }]}>
          <Text style={styles.encouragementText}>{encouragement}</Text>
        </Animated.View>
      )}

      <View style={{ height: Spacing.xxl }} />
    </View>
  );
}

function CompletedView({
  getSummary,
  onNextBedtime,
  t,
  isPro,
}: {
  getSummary: () => {
    bedtimeStr: string;
    wakeTimeStr: string;
    durationStr: string;
    efficiency: number;
    satisfaction: number;
    insight: string;
    insightTitle: string;
    insightFocusId: string;
  } | null;
  onNextBedtime: () => void;
  t: Translations;
  isPro: boolean;
}) {
  const summary = getSummary();
  const [showDetail, setShowDetail] = useState(false);

  if (!summary) return null;

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const effColor =
    summary.efficiency >= 85
      ? Colors.brightGreen
      : summary.efficiency >= 70
        ? Colors.amber
        : Colors.lavenderDark;

  return (
    <View>
      <View style={styles.appHeader}>
        <Text style={styles.appHeaderIcon}>🌙</Text>
        <View>
          <Text style={styles.appHeaderTitle}>Simple CBT-I</Text>
          <Text style={styles.appHeaderSubtitle}>{t.appSubtitle}</Text>
        </View>
      </View>

      <Card>
        <Text style={actionStyles.prompt}>{t.readyForTonight}</Text>
        <View style={actionStyles.btnWrap}>
          <HoldButton
            icon="🌙"
            label={t.bedtime}
            hint={t.longPressBedtime}
            onComplete={onNextBedtime}
            trackColor={Colors.lavenderLight}
            fillColor={Colors.lavender}
          />
        </View>
      </Card>

      <Card style={styles.todayRow}>
        <View style={styles.todayRowInner}>
          <Text style={styles.todayIcon}>📅</Text>
          <Text style={styles.todayLabel}>{t.today}</Text>
          <Text style={styles.todayDate}>{dateStr}</Text>
        </View>
      </Card>

      <View style={styles.twoCol}>
        <Card style={[styles.timeCard, styles.bedtimeCard]}>
          <Text style={styles.timeCardIcon}>🛏️</Text>
          <Text style={styles.timeCardLabel}>{t.bedtime}</Text>
          <Text style={styles.timeCardValue}>{summary.bedtimeStr}</Text>
        </Card>
        <Card style={[styles.timeCard, styles.wakeCard]}>
          <Text style={styles.timeCardIcon}>☀️</Text>
          <Text style={styles.timeCardLabel}>{t.wakeTime}</Text>
          <Text style={styles.timeCardValue}>{summary.wakeTimeStr}</Text>
        </Card>
      </View>

      <TouchableOpacity onPress={() => setShowDetail(true)} activeOpacity={0.8}>
        <Card style={styles.efficiencyCard}>
          <View style={styles.efficiencyRow}>
            <View style={[styles.efficiencyRing, { borderColor: effColor }]}>
              <Text style={[styles.efficiencyPct, { color: effColor }]}>
                {summary.efficiency}%
              </Text>
            </View>
            <View style={styles.efficiencyInfo}>
              <Text style={styles.efficiencyLabel}>{t.sleepEfficiency}</Text>
              <Text style={styles.efficiencyDetail}>
                {summary.durationStr} {t.asleep}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </View>
        </Card>
      </TouchableOpacity>

      <Card style={styles.satisfactionCard}>
        <Text style={styles.satisfactionLabel}>{t.satisfactionLabel}</Text>
        <View style={styles.satisfactionStars}>
          <StarRating value={summary.satisfaction} readonly size={32} />
        </View>
      </Card>

      {isPro ? (
        <TouchableOpacity onPress={() => setShowDetail(true)} activeOpacity={0.8}>
          <InsightCard insight={summary.insight} insightTitle={summary.insightTitle} t={t} />
        </TouchableOpacity>
      ) : (
        <Card variant="alt" style={styles.proHintCard}>
          <Text style={styles.proHintIcon}>✨</Text>
          <Text style={styles.proHintText}>{t.insightProOnly}</Text>
          <Text style={styles.proHintButton}>{t.upgradeButton}</Text>
        </Card>
      )}

      {isPro && (
        <SleepDetailOverlay
          visible={showDetail}
          data={summary}
          onClose={() => setShowDetail(false)}
          t={t}
        />
      )}

      <View style={{ height: Spacing.xxl }} />
    </View>
  );
}

function InsightCard({ insight, insightTitle, t }: { insight: string; insightTitle: string; t: Translations }) {
  const { displayed, done, skip } = useTypewriter(insight, 25);

  return (
    <Pressable onPress={() => !done && skip()}>
      <Card style={styles.insightCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm }}>
          <Text style={styles.insightIcon}>💡</Text>
          <Text style={styles.insightTitle}>{insightTitle || t.todaysInsight}</Text>
        </View>
        <Text style={styles.insightText}>{displayed}</Text>
        {!done && <Text style={styles.insightTapHint}>{t.tapToShowAll}</Text>}
      </Card>
    </Pressable>
  );
}

function HoldButton({
  icon,
  label,
  hint,
  onComplete,
  trackColor,
  fillColor,
}: {
  icon: string;
  label: string;
  hint: string;
  onComplete: () => void;
  trackColor: string;
  fillColor: string;
}) {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePressIn = () => {
    Animated.timing(scaleAnim, {
      toValue: 0.97,
      duration: 150,
      useNativeDriver: true,
    }).start();
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: false,
    }).start();
    timerRef.current = setTimeout(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onComplete();
    }, 1000);
  };

  const handlePressOut = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
    Animated.timing(progressAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const fillWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut}>
          <View style={[holdBtnStyles.track, { backgroundColor: trackColor }]}>
            <Animated.View
              style={[holdBtnStyles.fill, { width: fillWidth, backgroundColor: fillColor }]}
            />
            <View style={holdBtnStyles.content}>
              <Text style={holdBtnStyles.icon}>{icon}</Text>
              <Text style={holdBtnStyles.label}>{label}</Text>
            </View>
          </View>
        </Pressable>
      </Animated.View>
      <Text style={holdBtnStyles.hint}>{hint}</Text>
    </View>
  );
}

const holdBtnStyles = StyleSheet.create({
  track: {
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 28,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  icon: {
    fontSize: 22,
  },
  label: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  hint: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
});

const actionStyles = StyleSheet.create({
  prompt: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  btnWrap: {
    marginTop: Spacing.lg,
  },
  sessionStatus: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  bedtimeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  bedtimeIcon: {
    fontSize: 32,
  },
  bedtimeLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  bedtimeTime: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  elapsed: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    paddingBottom: 120,
  },
  header: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 120,
  },
  bigButton: {
    width: 220,
    height: 220,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.lavenderLight,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  progressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'transparent',
  },
  progressFill: {
    height: 4,
    backgroundColor: Colors.lavenderDark,
    borderRadius: 2,
  },
  wakeButton: {
    backgroundColor: Colors.mutedGreenLight,
  },
  bigButtonIcon: {
    fontSize: 48,
    marginBottom: Spacing.sm,
  },
  bigButtonLabel: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  bigButtonHint: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
  },
  sleepCard: {
    alignItems: 'center' as const,
  },
  recordedTime: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  recordedLabel: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
  },
  checkInTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  checkInTimeRange: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.lavenderDark,
  },
  fieldLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  fieldHint: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginBottom: Spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  numberInput: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    minWidth: 80,
    borderBottomWidth: 2,
    borderBottomColor: Colors.lavenderLight,
    paddingVertical: Spacing.xs,
    textAlign: 'center',
  },
  inputUnit: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  memoInput: {
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.lavenderLight,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    minHeight: 60,
    textAlignVertical: 'top',
    marginTop: Spacing.xs,
  },
  techItem: {
    paddingVertical: Spacing.sm,
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceAlt,
    paddingHorizontal: Spacing.md,
  },
  techLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    lineHeight: 20,
  },
  techBtnRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  techBtn: {
    flex: 1,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.lavenderLight,
  },
  techBtnDone: {
    backgroundColor: Colors.mutedGreenLight,
    borderColor: Colors.mutedGreenDark,
  },
  techBtnNA: {
    backgroundColor: Colors.blueGreyLight,
    borderColor: Colors.blueGrey,
  },
  techBtnFailed: {
    backgroundColor: Colors.lavenderLight,
    borderColor: Colors.lavenderDark,
  },
  techBtnText: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontWeight: FontWeight.medium,
  },
  techBtnTextActive: {
    color: Colors.textPrimary,
    fontWeight: FontWeight.semibold,
  },
  submitButton: {
    backgroundColor: Colors.lavenderDark,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: Colors.blueGreyLight,
  },
  submitButtonText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.white,
  },
  encouragement: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
  },
  encouragementText: {
    fontSize: FontSize.md,
    color: Colors.lavenderDark,
    textAlign: 'center',
    lineHeight: 22,
  },
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  appHeaderIcon: {
    fontSize: 28,
  },
  appHeaderTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  appHeaderSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  todayRow: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  todayRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  todayIcon: {
    fontSize: 16,
  },
  todayLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    flex: 1,
  },
  todayDate: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  twoCol: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    gap: 0,
  },
  timeCard: {
    flex: 1,
    alignItems: 'center' as const,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    marginHorizontal: Spacing.xs,
  },
  bedtimeCard: {
    backgroundColor: Colors.lavenderLight,
  },
  wakeCard: {
    backgroundColor: Colors.mutedGreenLight,
  },
  timeCardIcon: {
    fontSize: 22,
    marginBottom: Spacing.xs,
  },
  timeCardLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  timeCardValue: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  efficiencyCard: {
    paddingVertical: Spacing.md,
  },
  efficiencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  efficiencyRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  efficiencyPct: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  efficiencyInfo: {
    flex: 1,
  },
  efficiencyLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
    color: Colors.textPrimary,
  },
  efficiencyDetail: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  chevron: {
    fontSize: FontSize.xl,
    color: Colors.textTertiary,
  },
  satisfactionCard: {
    paddingVertical: Spacing.md,
  },
  satisfactionLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  satisfactionStars: {
    alignItems: 'center' as const,
  },
  insightCard: {
    backgroundColor: Colors.lavenderLight,
  },
  insightTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.lavenderDark,
  },
  insightIcon: {
    fontSize: 18,
    marginRight: Spacing.xs,
  },
  insightText: {
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  insightTapHint: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: Spacing.sm,
    textAlign: 'right',
  },
  proHintCard: {
    alignItems: 'center' as const,
    paddingVertical: Spacing.lg,
  },
  proHintIcon: {
    fontSize: 24,
    marginBottom: Spacing.xs,
  },
  proHintText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  proHintButton: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.lavenderDark,
  },
});
