import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, View, Text, Pressable, StyleSheet } from 'react-native';
import { Card } from './Card';
import { useTypewriter } from '../hooks/useTypewriter';
import { Translations } from '../i18n/types';
import { Colors, FontSize, FontWeight, Spacing } from '../constants/theme';

export function InsightCard({ generating, insight, insightTitle, insightSource, t }: {
  generating: boolean; insight: string; insightTitle: string; insightSource?: import('../types/sleep').InsightSource; t: Translations;
}) {
  const [reduceMotion, setReduceMotion] = useState(true);
  const [dots, setDots] = useState(0);
  const receivedLive = useRef(false);
  useEffect(() => {
    let active = true;
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      changed = true;
      setReduceMotion(value);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active && !changed) setReduceMotion(value);
    }).catch(() => {});
    return () => { active = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    if (generating) receivedLive.current = true;
    setDots(0);
    if (!generating || reduceMotion) return;
    const timer = setInterval(() => setDots((value) => (value + 1) % 4), 500);
    return () => clearInterval(timer);
  }, [generating, reduceMotion]);
  const { displayed, done, skip } = useTypewriter(
    generating ? '' : insight, 25, receivedLive.current && !reduceMotion,
  );
  const status = generating ? 'generating' : !done ? 'typewriting' : 'complete';

  return (
    <Pressable onPress={() => !generating && !done && skip()} disabled={generating || done}>
      <Card style={styles.card}>
        <Text style={styles.heading}>✦ {t.dailyInsightCardTitle}</Text>
        {!generating && insightSource === 'openai' && <Text style={styles.subtitle}>{t.dailyInsightAttribution}</Text>}
        <View style={styles.body} testID={`insight-${status}`}>
          {generating ? (
            <Text style={styles.message} accessibilityLiveRegion="polite" accessibilityLabel={t.dailyInsightGenerating}>
              {reduceMotion ? t.dailyInsightGenerating : t.dailyInsightGenerating.replace(/…$/, '') + '.'.repeat(dots)}
            </Text>
          ) : (
            <>
              {!!insightTitle && <Text style={styles.title}>{insightTitle}</Text>}
              <View>
                <Text style={[styles.message, styles.measure]} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{insight}</Text>
                <Text style={[styles.message, styles.reveal]} accessibilityLabel={insight}>{displayed}</Text>
              </View>
              <Text style={[styles.hint, done && styles.measure]} accessible={!done}>{t.tapToShowAll}</Text>
            </>
          )}
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.lavenderLight },
  heading: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.lavenderDark, marginBottom: Spacing.xs },
  subtitle: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18, marginBottom: Spacing.md },
  body: { minHeight: 140 },
  title: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.lavenderDark, marginBottom: Spacing.sm },
  message: { fontSize: FontSize.md, color: Colors.textPrimary, lineHeight: 22 },
  hint: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: Spacing.sm, textAlign: 'right' },
  measure: { opacity: 0 },
  reveal: { position: 'absolute', top: 0, left: 0, right: 0 },
});
