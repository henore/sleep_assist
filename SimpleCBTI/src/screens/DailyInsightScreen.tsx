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
  Alert,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../components/Card';
import { StarRating } from '../components/StarRating';
import { SleepDayContent } from '../components/SleepDayContent';
import { useSleepStore } from '../hooks/useSleepStore';
import { useProStatus } from '../hooks/useProStatus';
import { InsightCard } from '../components/InsightCard';
import { sessionKey } from '../services/sleepStore';
import { useI18n } from '../i18n';
import { Translations } from '../i18n/types';
import { buildTemplateInsight } from '../services/insightApi';
import { TECHNIQUE_DEFS } from '../constants/techniques';
import { TechniqueResponse } from '../types/sleep';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../constants/theme';
import { formatTime, formatDuration } from '../utils/time';
import { CheckInData } from '../types/sleep';

export function DailyInsightScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  const store = useSleepStore();
  const { t, locale } = useI18n();
  const { today } = store;
  const { isPro } = useProStatus();

  if (!store.isHydrated) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {store.storageError
          ? <Text accessibilityRole="alert">{t.storageLoadError}</Text>
          : <ActivityIndicator />}
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {store.storageError && (
          <Text accessibilityRole="alert">{t.storageOperationError}</Text>
        )}
        {today.phase === 'check_in' && (
          <Text style={styles.header}>{t.headerDailyInsight}</Text>
        )}

        {today.phase === 'idle' && <IdleView onBedtime={store.recordBedtime} t={t} />}
        {today.phase === 'sleeping' && (
          <SleepingView bedtime={today.bedtime!} onWakeUp={store.recordWakeUp} onEditBedtime={store.editBedtime} t={t} />
        )}
        {today.phase === 'check_in' && (
          <CheckInView
            bedtime={today.bedtime!}
            wakeTime={today.wakeTime!}
            techniqueIds={today.techniqueIds}
            onComplete={(data) => store.completeCheckIn(data, t, locale)}
            onInvalidField={(y) => scrollRef.current?.scrollTo({ y: Math.max(0, y - Spacing.md), animated: true })}
            t={t}
            isPro={isPro}
          />
        )}
        {today.phase === 'completed' && (
          <CompletedView
            generating={!!today.record && store.generatingSessionKey === sessionKey(today.record)}
            getSummary={store.getSummary}
            bedtime={today.bedtime}
            wakeTime={today.wakeTime}
            onNextBedtime={store.recordBedtime}
            onEditBedtime={(d: Date) => store.editBedtime(d, t, locale)}
            onEditWakeTime={(d: Date) => store.editWakeTime(d, t, locale)}
            t={t}
            isPro={isPro}
          />
        )}
      </ScrollView>
    </View>
  );
}

function IdleView({ onBedtime, t }: { onBedtime: () => void; t: Translations }) {
  const { locale } = useI18n();
  const now = new Date();
  const dateStr = now.toLocaleDateString(locale, {
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
  onEditBedtime,
  t,
}: {
  bedtime: Date;
  onWakeUp: () => void;
  onEditBedtime: (d: Date) => void;
  t: Translations;
}) {
  const [elapsed, setElapsed] = useState('');
  const [editing, setEditing] = useState(false);
  const [editMonth, setEditMonth] = useState('');
  const [editDay, setEditDay] = useState('');
  const [editHour, setEditHour] = useState('');
  const [editMin, setEditMin] = useState('');

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

  const startEdit = () => {
    setEditMonth((bedtime.getMonth() + 1).toString().padStart(2, '0'));
    setEditDay(bedtime.getDate().toString().padStart(2, '0'));
    setEditHour(bedtime.getHours().toString().padStart(2, '0'));
    setEditMin(bedtime.getMinutes().toString().padStart(2, '0'));
    setEditing(true);
  };

  const confirmEdit = () => {
    const mo = parseInt(editMonth);
    const d = parseInt(editDay);
    const h = parseInt(editHour);
    const m = parseInt(editMin);
    if (isNaN(mo) || isNaN(d) || mo < 1 || mo > 12 || d < 1 || d > 31) {
      Alert.alert(t.invalidDate);
      return;
    }
    if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
      Alert.alert(t.invalidTime);
      return;
    }
    const newBedtime = new Date(bedtime);
    newBedtime.setMonth(mo - 1, d);
    newBedtime.setHours(h, m, 0, 0);
    onEditBedtime(newBedtime);
    setEditing(false);
  };

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
            {editing ? (
              <View>
                <View style={actionStyles.editRow}>
                  <TextInput
                    style={actionStyles.editInputSmall}
                    keyboardType="number-pad"
                    value={editMonth}
                    onChangeText={setEditMonth}
                    maxLength={2}
                    selectTextOnFocus
                  />
                  <Text style={actionStyles.editColon}>/</Text>
                  <TextInput
                    style={actionStyles.editInputSmall}
                    keyboardType="number-pad"
                    value={editDay}
                    onChangeText={setEditDay}
                    maxLength={2}
                    selectTextOnFocus
                  />
                  <Text style={actionStyles.editSpacer}> </Text>
                  <TextInput
                    style={actionStyles.editInput}
                    keyboardType="number-pad"
                    value={editHour}
                    onChangeText={setEditHour}
                    maxLength={2}
                    selectTextOnFocus
                  />
                  <Text style={actionStyles.editColon}>:</Text>
                  <TextInput
                    style={actionStyles.editInput}
                    keyboardType="number-pad"
                    value={editMin}
                    onChangeText={setEditMin}
                    maxLength={2}
                    selectTextOnFocus
                  />
                </View>
                <View style={actionStyles.editBtnRow}>
                  <TouchableOpacity onPress={confirmEdit} style={actionStyles.editConfirm}>
                    <Text style={actionStyles.editConfirmText}>{t.confirmAction}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditing(false)} style={actionStyles.editCancel}>
                    <Text style={actionStyles.editCancelText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity onPress={startEdit} activeOpacity={0.6}>
                <Text style={actionStyles.bedtimeTime}>{formatTime(bedtime)}</Text>
                <Text style={actionStyles.editHint}>{t.tapToEdit}</Text>
              </TouchableOpacity>
            )}
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

export function CheckInView({
  bedtime,
  wakeTime,
  techniqueIds,
  onComplete,
  onInvalidField,
  t,
  isPro,
}: {
  bedtime: Date;
  wakeTime: Date;
  techniqueIds: string[];
  onComplete: (data: CheckInData) => void;
  onInvalidField: (y: number) => void;
  t: Translations;
  isPro: boolean;
}) {
  type Field = 'sleepOnset' | 'nightWake' | 'satisfaction' | 'techniques';
  const [errorField, setErrorField] = useState<Field | null>(null);
  const rootY = useRef(0);
  const fieldY = useRef<Record<Field, number>>({ sleepOnset: 0, nightWake: 0, satisfaction: 0, techniques: 0 });
  const [errorTechnique, setErrorTechnique] = useState<string | null>(null);
  const techniqueY = useRef<Record<string, number>>({});
  const onsetRef = useRef<TextInput>(null);
  const wakeRef = useRef<TextInput>(null);
  const submitting = useRef(false);
  const submitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (submitTimer.current) clearTimeout(submitTimer.current); }, []);
  const [sleepOnset, setSleepOnset] = useState('');
  const [nightWake, setNightWake] = useState('');
  const [satisfaction, setSatisfaction] = useState(0);
  const [memo, setMemo] = useState('');
  const [techResponses, setTechResponses] = useState<Record<string, TechniqueResponse>>({});
  const [encouragement, setEncouragement] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const techniques = TECHNIQUE_DEFS.filter((td) => techniqueIds.includes(td.id));

  const handleSubmit = () => {
    if (submitting.current) return;
    const validMinutes = (value: string) => /^\d{1,3}$/.test(value);
    const unanswered = techniques.find((tech) => !techResponses[tech.id]);
    const invalid: Field | null = sleepOnset !== '' && !validMinutes(sleepOnset) ? 'sleepOnset'
      : nightWake !== '' && !validMinutes(nightWake) ? 'nightWake'
      : satisfaction < 1 || satisfaction > 5 ? 'satisfaction' : unanswered ? 'techniques' : null;
    setErrorField(invalid);
    setErrorTechnique(invalid === 'techniques' ? unanswered!.id : null);
    if (invalid) {
      if (invalid === 'sleepOnset') onsetRef.current?.focus();
      if (invalid === 'nightWake') wakeRef.current?.focus();
      if (invalid === 'satisfaction' || invalid === 'techniques') Keyboard.dismiss();
      requestAnimationFrame(() => onInvalidField(rootY.current + fieldY.current[invalid] + (invalid === 'techniques' ? Spacing.sm + (techniqueY.current[unanswered!.id] ?? 0) : 0)));
      return;
    }
    submitting.current = true;
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

    submitTimer.current = setTimeout(() => onComplete(data), 2000);
  };



  return (
    <View onLayout={(event) => { rootY.current = event.nativeEvent.layout.y; }}>
      <Card>
        <Text style={styles.checkInTitle}>{t.morningCheckIn}</Text>
        <Text style={styles.checkInTimeRange}>
          {formatTime(bedtime)} → {formatTime(wakeTime)}
        </Text>
      </Card>

      <View onLayout={(event) => { fieldY.current.sleepOnset = event.nativeEvent.layout.y; }}>
      <Card>
        <Text style={styles.fieldLabel}>{t.sleepOnsetLabel}</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.numberInput}
            keyboardType="number-pad"
            ref={onsetRef}
            accessibilityLabel={t.sleepOnsetLabel}
            value={sleepOnset}
            onChangeText={(value) => { setSleepOnset(value); if (errorField === 'sleepOnset') setErrorField(null); }}
            placeholder="—"
            placeholderTextColor="#C4C4C4"
            maxLength={3}
          />
          <Text style={styles.inputUnit}>{t.minutes}</Text>
        </View>
        {errorField === 'sleepOnset' && <Text style={styles.validationError} accessibilityRole="alert" accessibilityLiveRegion="polite">{t.validationMinutes}</Text>}
      </Card>
      </View>

      <View onLayout={(event) => { fieldY.current.nightWake = event.nativeEvent.layout.y; }}>
      <Card>
        <Text style={styles.fieldLabel}>{t.nightWakeLabel}</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.numberInput}
            keyboardType="number-pad"
            ref={wakeRef}
            accessibilityLabel={t.nightWakeLabel}
            value={nightWake}
            onChangeText={(value) => { setNightWake(value); if (errorField === 'nightWake') setErrorField(null); }}
            placeholder="—"
            placeholderTextColor="#C4C4C4"
            maxLength={3}
          />
          <Text style={styles.inputUnit}>{t.minutes}</Text>
        </View>
        {errorField === 'nightWake' && <Text style={styles.validationError} accessibilityRole="alert" accessibilityLiveRegion="polite">{t.validationMinutes}</Text>}
      </Card>
      </View>

      <View onLayout={(event) => { fieldY.current.satisfaction = event.nativeEvent.layout.y; }}>
      <Card>
        <Text style={styles.fieldLabel}>{t.satisfactionLabel}</Text>
        <View style={{ marginTop: Spacing.sm }}>
          <StarRating value={satisfaction} onChange={(value) => { setSatisfaction(value); if (errorField === 'satisfaction') setErrorField(null); }} size={36} />
        </View>
        {errorField === 'satisfaction' && <Text style={styles.validationError} accessibilityRole="alert" accessibilityLiveRegion="polite">{t.validationSatisfaction}</Text>}
      </Card>
      </View>

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

      <View onLayout={(event) => { fieldY.current.techniques = event.nativeEvent.layout.y; }}>
      <Card>
        <Text style={styles.fieldLabel}>{t.todaysTechniques}</Text>
        <Text style={styles.fieldHint}>{t.tapCompleted}</Text>
        {techniques.map((tech) => {
          const resp = techResponses[tech.id];
          return (
            <View key={tech.id} style={styles.techItem} onLayout={(event) => { techniqueY.current[tech.id] = event.nativeEvent.layout.y; }}>
              <Text style={styles.techLabel}>{t[tech.labelKey]}</Text>
              <View style={styles.techBtnRow}>
                <TouchableOpacity
                  style={[styles.techBtn, resp === 'done' && styles.techBtnDone]}
                  onPress={() => { setTechResponses((p) => ({ ...p, [tech.id]: 'done' })); if (errorTechnique === tech.id) { setErrorTechnique(null); setErrorField(null); } }}
                >
                  <Text style={[styles.techBtnText, resp === 'done' && styles.techBtnTextActive]}>
                    ✓ {t.techResponseDone}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.techBtn, resp === 'na' && styles.techBtnNA]}
                  onPress={() => { setTechResponses((p) => ({ ...p, [tech.id]: 'na' })); if (errorTechnique === tech.id) { setErrorTechnique(null); setErrorField(null); } }}
                >
                  <Text style={[styles.techBtnText, resp === 'na' && styles.techBtnTextActive]}>
                    － {t.techResponseNA}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.techBtn, resp === 'failed' && styles.techBtnFailed]}
                  onPress={() => { setTechResponses((p) => ({ ...p, [tech.id]: 'failed' })); if (errorTechnique === tech.id) { setErrorTechnique(null); setErrorField(null); } }}
                >
                  <Text style={[styles.techBtnText, resp === 'failed' && styles.techBtnTextActive]}>
                    × {t.techResponseFailed}
                  </Text>
                </TouchableOpacity>
              </View>
              {errorTechnique === tech.id && <Text style={styles.validationError} accessibilityRole="alert" accessibilityLiveRegion="polite">{t.validationTechnique}</Text>}
            </View>
          );
        })}
      </Card>
      </View>

      <View style={{ paddingHorizontal: Spacing.md, marginTop: Spacing.sm }}>
        <Pressable
          onPress={handleSubmit}
          disabled={encouragement !== ''}
          style={({ pressed }) => [
            styles.submitButton,
            encouragement !== '' && styles.submitButtonDisabled,
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
  generating,
  getSummary,
  bedtime: rawBedtime,
  wakeTime: rawWakeTime,
  onNextBedtime,
  onEditBedtime,
  onEditWakeTime,
  t,
  isPro,
}: {
  generating: boolean;
  getSummary: () => {
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
    insightLocale?: string;
    insightFocusId: string;
  } | null;
  bedtime: Date | null;
  wakeTime: Date | null;
  onNextBedtime: () => void;
  onEditBedtime: (d: Date) => void;
  onEditWakeTime: (d: Date) => void;
  t: Translations;
  isPro: boolean;
}) {
  const { locale } = useI18n();
  const summary = getSummary();
  const [editingField, setEditingField] = useState<'bedtime' | 'wake' | null>(null);
  const [editMonth, setEditMonth] = useState('');
  const [editDay, setEditDay] = useState('');
  const [editHour, setEditHour] = useState('');
  const [editMin, setEditMin] = useState('');

  if (!summary) return null;

  const sessionDate = rawBedtime ?? new Date();
  const dateStr = sessionDate.toLocaleDateString(locale, {
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

  const startEdit = (field: 'bedtime' | 'wake') => {
    const d = field === 'bedtime' ? rawBedtime : rawWakeTime;
    if (!d) return;
    setEditMonth((d.getMonth() + 1).toString().padStart(2, '0'));
    setEditDay(d.getDate().toString().padStart(2, '0'));
    setEditHour(d.getHours().toString().padStart(2, '0'));
    setEditMin(d.getMinutes().toString().padStart(2, '0'));
    setEditingField(field);
  };

  const confirmEdit = () => {
    const mo = parseInt(editMonth);
    const d = parseInt(editDay);
    const h = parseInt(editHour);
    const m = parseInt(editMin);
    if (isNaN(mo) || isNaN(d) || mo < 1 || mo > 12 || d < 1 || d > 31) {
      Alert.alert(t.invalidDate);
      return;
    }
    if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
      Alert.alert(t.invalidTime);
      return;
    }
    const ref = editingField === 'bedtime' ? rawBedtime : rawWakeTime;
    if (!ref) return;
    const newDate = new Date(ref);
    newDate.setMonth(mo - 1, d);
    newDate.setHours(h, m, 0, 0);
    if (editingField === 'bedtime') {
      onEditBedtime(newDate);
    } else {
      onEditWakeTime(newDate);
    }
    setEditingField(null);
  };

  const renderTimeCard = (field: 'bedtime' | 'wake', icon: string, label: string, value: string, cardStyle: any) => {
    if (editingField === field) {
      return (
        <Card style={[styles.timeCard, cardStyle]}>
          <Text style={styles.timeCardIcon}>{icon}</Text>
          <Text style={styles.timeCardLabel}>{label}</Text>
          <View style={actionStyles.editRow}>
            <TextInput style={actionStyles.editInputCompact} keyboardType="number-pad" value={editMonth} onChangeText={setEditMonth} maxLength={2} selectTextOnFocus />
            <Text style={actionStyles.editColonSmall}>/</Text>
            <TextInput style={actionStyles.editInputCompact} keyboardType="number-pad" value={editDay} onChangeText={setEditDay} maxLength={2} selectTextOnFocus />
          </View>
          <View style={actionStyles.editRow}>
            <TextInput style={actionStyles.editInputCompact} keyboardType="number-pad" value={editHour} onChangeText={setEditHour} maxLength={2} selectTextOnFocus />
            <Text style={actionStyles.editColonSmall}>:</Text>
            <TextInput style={actionStyles.editInputCompact} keyboardType="number-pad" value={editMin} onChangeText={setEditMin} maxLength={2} selectTextOnFocus />
          </View>
          <View style={actionStyles.editBtnRow}>
            <TouchableOpacity onPress={confirmEdit} style={actionStyles.editConfirm}>
              <Text style={actionStyles.editConfirmText}>{t.confirmAction}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setEditingField(null)} style={actionStyles.editCancel}>
              <Text style={actionStyles.editCancelText}>✕</Text>
            </TouchableOpacity>
          </View>
        </Card>
      );
    }
    return (
      <TouchableOpacity onPress={() => startEdit(field)} activeOpacity={0.6} style={{ flex: 1 }}>
        <Card style={[styles.timeCard, cardStyle]}>
          <Text style={styles.timeCardIcon}>{icon}</Text>
          <Text style={styles.timeCardLabel}>{label}</Text>
          <Text style={styles.timeCardValue}>{value}</Text>
          <Text style={actionStyles.editHint}>{t.tapToEdit}</Text>
        </Card>
      </TouchableOpacity>
    );
  };

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
        {renderTimeCard('bedtime', '🛏️', t.bedtime, summary.bedtimeStr, styles.bedtimeCard)}
        {renderTimeCard('wake', '☀️', t.wakeTime, summary.wakeTimeStr, styles.wakeCard)}
      </View>

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
              {summary.durationStr} {t.inBed}
            </Text>
          </View>
        </View>
      </Card>

      <SleepDayContent data={summary} t={t} showInsight={false} />

      {isPro && (generating || summary.insight) ? (() => {
        const localeMismatch = summary.insightLocale && summary.insightLocale !== locale;
        const display = localeMismatch
          ? buildTemplateInsight(summary.efficiency, summary.insightFocusId, t)
          : { title: summary.insightTitle, message: summary.insight };
        return <InsightCard generating={generating} insight={display.message} insightTitle={display.title} insightSource={localeMismatch ? undefined : summary.insightSource} t={t} />;
      })() : !isPro ? (
        <Card variant="alt" style={styles.proHintCard}>
          <Text style={styles.proHintIcon}>✨</Text>
          <Text style={styles.proHintText}>{t.insightProOnly}</Text>
          <Text style={styles.proHintButton}>{t.upgradeButton}</Text>
        </Card>
      ) : null}

      <View style={{ height: Spacing.xxl }} />
    </View>
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
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  editInput: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    borderBottomWidth: 2,
    borderBottomColor: Colors.lavenderDark,
    width: 44,
    textAlign: 'center',
    paddingVertical: Spacing.xs,
  },
  editInputSmall: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    borderBottomWidth: 2,
    borderBottomColor: Colors.lavenderLight,
    width: 36,
    textAlign: 'center',
    paddingVertical: Spacing.xs,
  },
  editSpacer: {
    width: Spacing.sm,
  },
  editColon: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  editBtnRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  editConfirm: {
    backgroundColor: Colors.lavenderDark,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  editConfirmText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.white,
  },
  editCancel: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  editCancelText: {
    fontSize: FontSize.md,
    color: Colors.textTertiary,
  },
  editHint: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  editInputCompact: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    borderBottomWidth: 2,
    borderBottomColor: Colors.lavenderDark,
    width: 32,
    textAlign: 'center',
    paddingVertical: 2,
  },
  editColonSmall: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
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
  validationError: { color: '#A63E4B', fontSize: FontSize.sm, marginTop: Spacing.sm },
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
