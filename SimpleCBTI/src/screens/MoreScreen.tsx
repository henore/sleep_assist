import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n, SUPPORTED_LOCALES, localeMap } from '../i18n';
import { SupportedLocale } from '../i18n/types';
import { useProStatus } from '../hooks/useProStatus';
import { useSleepStore } from '../hooks/useSleepStore';
import { Card } from '../components/Card';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../constants/theme';
import { Translations } from '../i18n/types';
import { PLAN_INFO, purchase, restore } from '../services/billing';
import { exportBackup, pickBackupFile, applyImport } from '../services/backup';
import appConfig from '../../app.json';

const APP_VERSION = appConfig.expo.version;

type MoreView = 'menu' | 'plans' | 'freeVsPro' | 'howToUse' | 'cbtiGuide' | 'privacy' | 'terms' | 'about' | 'language';

export function MoreScreen() {
  const [view, setView] = useState<MoreView>('menu');
  const insets = useSafeAreaInsets();
  const { t, locale, setLocale } = useI18n();
  const { isPurchased, trialDaysLeft, isTrialActive, onPurchaseComplete } = useProStatus();
  const { reload, regenerateInsight } = useSleepStore();
  const [busy, setBusy] = useState(false);

  const goBack = () => setView('menu');

  if (view !== 'menu') {
    return (
      <View style={[ms.container, { paddingTop: insets.top }]}>
        <TouchableOpacity style={ms.backRow} onPress={goBack} activeOpacity={0.6}>
          <Text style={ms.backText}>← {t.back}</Text>
        </TouchableOpacity>
        <ScrollView contentContainerStyle={ms.scroll} showsVerticalScrollIndicator={false}>
          {view === 'plans' && <PlansView t={t} onPurchaseComplete={onPurchaseComplete} goBack={goBack} />}
          {view === 'freeVsPro' && <FreeVsProView t={t} />}
          {view === 'howToUse' && <HowToUseView t={t} />}
          {view === 'cbtiGuide' && <CBTIGuideView t={t} />}
          {view === 'privacy' && <PrivacyView t={t} />}
          {view === 'terms' && <TermsView t={t} />}
          {view === 'about' && <AboutView t={t} />}
          {view === 'language' && <LanguageView locale={locale} setLocale={setLocale} goBack={goBack} regenerateInsight={regenerateInsight} />}
        </ScrollView>
      </View>
    );
  }

  const handleRestore = async () => {
    const restored = await restore();
    if (restored) {
      await onPurchaseComplete();
      Alert.alert(
        t.moreCopy.restoreTitle,
        t.moreCopy.restoreBody,
      );
    } else {
      Alert.alert(
        t.moreCopy.restoreMissingTitle,
        t.moreCopy.restoreMissingBody,
      );
    }
  };

  const handleManageSubscription = () => {
    const url = Platform.select({
      ios: 'https://apps.apple.com/account/subscriptions',
      default: 'https://play.google.com/store/account/subscriptions',
    });
    if (url) Linking.openURL(url);
  };

  const handleBackup = () => {
    Alert.alert(t.moreBackup, t.backupWarning, [
      { text: t.importCancel, style: 'cancel' },
      {
        text: t.confirmAction,
        onPress: async () => {
          setBusy(true);
          try {
            await exportBackup(APP_VERSION);
          } catch (e) {
            const detail = e instanceof Error ? e.message : String(e);
            Alert.alert(t.backupFailed, detail);
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const handleImport = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const picked = await pickBackupFile();
      if (!picked) return;

      const { backup, summary } = picked;
      const lines: string[] = [];
      if (summary.dateRange) {
        lines.push(`${t.importPeriod}: ${summary.dateRange.from} ~ ${summary.dateRange.to}`);
      }
      lines.push(`${t.importRecordCount}: ${summary.recordCount}`);
      if (summary.insightCount > 0) {
        lines.push(`${t.importInsightCount}: ${summary.insightCount}`);
      }

      Alert.alert(t.importConfirm, lines.join('\n'), [
        { text: t.importCancel, style: 'cancel' },
        {
          text: t.importButton,
          onPress: async () => {
            try {
              const count = await applyImport(backup.sessions);
              await reload();
              Alert.alert(t.importSuccess.replace('{count}', String(count)));
            } catch {
              Alert.alert(t.importFailed);
            }
          },
        },
      ]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'newer_version') {
        Alert.alert(t.importVersionError);
      } else {
        Alert.alert(t.importInvalid);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[ms.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={ms.scroll} showsVerticalScrollIndicator={false}>
        <View style={ms.menuHeader}>
          <Text style={ms.menuIcon}>🌙</Text>
          <Text style={ms.menuTitle}>Simple CBT-I</Text>
          <Text style={ms.menuSubtitle}>{t.moreCopy.subtitle}</Text>
        </View>

        <View style={ms.menuSection}>
          <MenuItem label={t.moreCBTIGuide} onPress={() => setView('cbtiGuide')} />
          <MenuItem label={t.moreHowToUse} onPress={() => setView('howToUse')} />
          <MenuItem label={t.moreFreeVsPro} onPress={() => setView('freeVsPro')} />
        </View>

        <Card style={ms.proCard}>
          <Text style={ms.proTitle}>Simple CBT-I Pro</Text>
          {isPurchased ? (
            <View style={ms.proActiveRow}>
              <View style={ms.proActiveBadge}>
                <Text style={ms.proActiveText}>{t.proCardActive}</Text>
              </View>
            </View>
          ) : (
            <>
              <Text style={ms.proDesc}>{t.proCardDesc}</Text>
              {isTrialActive && (
                <Text style={ms.proTrial}>
                  {trialDaysLeft} {t.proTrialDays}
                </Text>
              )}
              <TouchableOpacity style={ms.proBtn} activeOpacity={0.7} onPress={() => setView('plans')}>
                <Text style={ms.proBtnText}>{t.proCardViewPlans}</Text>
              </TouchableOpacity>
            </>
          )}
        </Card>

        <View style={ms.menuSection}>
          <MenuItem label={t.moreLanguage} detail={SUPPORTED_LOCALES.find(l => l.code === locale)?.label} onPress={() => setView('language')} />
        </View>

        <View style={ms.menuSection}>
          <MenuItem label={t.moreBackup} subtitle={t.moreBackupDesc} onPress={handleBackup} disabled={busy} />
          <MenuItem label={t.moreImport} subtitle={t.moreImportDesc} onPress={handleImport} disabled={busy} />
        </View>

        <View style={ms.menuSection}>
          <MenuItem label={t.morePrivacy} onPress={() => setView('privacy')} />
          <MenuItem label={t.moreTerms} onPress={() => setView('terms')} />
          <MenuItem label={t.moreRestorePurchases} onPress={handleRestore} />
          <MenuItem label={t.moreManageSubscription} onPress={handleManageSubscription} />
        </View>

        <Text style={ms.version}>{t.moreCopy.version.replace('{version}', APP_VERSION)}</Text>
      </ScrollView>
    </View>
  );
}

function MenuItem({ label, subtitle, detail, onPress, disabled }: { label: string; subtitle?: string; detail?: string; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity style={ms.menuItem} onPress={onPress} activeOpacity={0.6} disabled={disabled}>
      <View style={ms.menuItemContent}>
        <Text style={ms.menuItemText}>{label}</Text>
        {subtitle && <Text style={ms.menuItemSubtitle}>{subtitle}</Text>}
      </View>
      {detail && <Text style={ms.menuItemDetail}>{detail}</Text>}
      <Text style={ms.menuItemChevron}>›</Text>
    </TouchableOpacity>
  );
}

/* ── Plans ── */

function PlansView({
  t,
  onPurchaseComplete,
  goBack,
}: {
  t: Translations;
  onPurchaseComplete: () => Promise<void>;
  goBack: () => void;
}) {
  const [loading, setLoading] = useState<string | null>(null);

  const handlePurchase = async (sku: string) => {
    setLoading(sku);
    const ok = await purchase(sku);
    if (ok) {
      await onPurchaseComplete();
      goBack();
    }
    setLoading(null);
  };

  return (
    <View>
      <Text style={ms.pageTitle}>Simple CBT-I Pro</Text>
      <Text style={ms.plansIntro}>
        {t.moreCopy.plansIntro}
      </Text>

      {PLAN_INFO.map((plan) => {
        const isMonthly = plan.id === 'simplecbti_pro_monthly';
        return (
          <Card key={plan.id} style={[ms.planCard, !isMonthly && ms.planCardHighlight]}>
            {!isMonthly && (
              <View style={ms.planBadge}>
                <Text style={ms.planBadgeText}>{t.moreCopy.bestValue}</Text>
              </View>
            )}
            <Text style={ms.planPeriod}>{isMonthly ? t.moreCopy.monthly : t.moreCopy.sixMonths}</Text>
            <Text style={ms.planPrice}>{plan.price}</Text>
            <Text style={ms.planUnit}>
              {isMonthly
                ? t.moreCopy.monthlyUnit
                : t.moreCopy.sixMonthsUnit}
            </Text>
            {!isMonthly && (
              <Text style={ms.planSave}>
                {t.moreCopy.planSavings}
              </Text>
            )}
            <TouchableOpacity
              style={[ms.planBtn, !isMonthly && ms.planBtnHighlight]}
              activeOpacity={0.7}
              onPress={() => handlePurchase(plan.id)}
              disabled={loading !== null}
            >
              {loading === plan.id ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <Text style={ms.planBtnText}>
                  {t.moreCopy.subscribe}
                </Text>
              )}
            </TouchableOpacity>
          </Card>
        );
      })}

      <Text style={ms.planFooter}>
        {t.moreCopy.planFooter}
      </Text>

      <View style={{ height: Spacing.xxl }} />
    </View>
  );
}

/* ── Free vs Pro ── */

function FreeVsProView({ t }: { t: Translations }) {
  const rows: { label: string; free: string; pro: string; diff?: boolean }[] = [
    { label: t.moreCopy.sleepRecording, free: t.moreCopy.unlimited, pro: t.moreCopy.unlimited },
    { label: `${t.bedtime} / ${t.wakeUp}`, free: t.moreCopy.unlimited, pro: t.moreCopy.unlimited },
    { label: t.morningCheckIn, free: t.moreCopy.unlimited, pro: t.moreCopy.unlimited },
    { label: t.moreCopy.cbtiCheckIns, free: t.moreCopy.unlimited, pro: t.moreCopy.unlimited },
    { label: t.moreCopy.guideLabel, free: '✓', pro: '✓' },
    { label: t.moreCopy.memoLabel, free: '✓', pro: '✓' },
    { label: t.tabHistory, free: t.moreCopy.latest7Days, pro: t.moreCopy.fullHistory, diff: true },
    { label: t.tabStats, free: t.moreCopy.latest7Days, pro: t.moreCopy.fullHistory, diff: true },
    { label: 'AI Daily Insight', free: t.moreCopy.first20Days, pro: t.moreCopy.unlimited, diff: true },
  ];

  return (
    <View>
      <Text style={ms.pageTitle}>{t.moreFreeVsPro}</Text>

      <View style={ms.compareHeader}>
        <View style={ms.compareLabelCol} />
        <View style={ms.compareCol}>
          <Text style={ms.compareColTitle}>Free</Text>
        </View>
        <View style={[ms.compareCol, ms.compareColPro]}>
          <Text style={[ms.compareColTitle, ms.compareColTitlePro]}>Pro</Text>
        </View>
      </View>

      {rows.map((row, i) => (
        <View key={i} style={[ms.compareRow, i % 2 === 0 && ms.compareRowAlt]}>
          <View style={ms.compareLabelCol}>
            <Text style={ms.compareLabel}>{row.label}</Text>
          </View>
          <View style={ms.compareCol}>
            <Text style={[ms.compareValue, row.diff && ms.compareValueMuted]}>{row.free}</Text>
          </View>
          <View style={ms.compareCol}>
            <Text style={[ms.compareValue, row.diff && ms.compareValueHighlight]}>{row.pro}</Text>
          </View>
        </View>
      ))}

      <View style={{ height: Spacing.xxl }} />
    </View>
  );
}

/* ── How to Use ── */

function HowToUseView({ t }: { t: Translations }) {
  const steps = [
    { n: '1', title: t.moreCopy.howBedtimeTitle, desc: t.moreCopy.howBedtimeBody },
    { n: '2', title: t.moreCopy.howWakeTitle, desc: t.moreCopy.howWakeBody },
    { n: '3', title: t.moreCopy.howCheckInTitle, desc: t.moreCopy.howCheckInBody },
    { n: '4', title: t.moreCopy.howCalculationTitle, desc: t.moreCopy.howCalculationBody },
    { n: '5', title: t.moreCopy.howInsightTitle, desc: t.moreCopy.howInsightBody },
    { n: '6', title: t.moreCopy.howReviewTitle, desc: t.moreCopy.howReviewBody },
  ];

  return (
    <View>
      <Text style={ms.pageTitle}>{t.moreHowToUse}</Text>
      {steps.map((step) => (
        <Card key={step.n} style={ms.stepCard}>
          <View style={ms.stepRow}>
            <View style={ms.stepCircle}>
              <Text style={ms.stepNum}>{step.n}</Text>
            </View>
            <View style={ms.stepContent}>
              <Text style={ms.stepTitle}>{step.title}</Text>
              <Text style={ms.stepDesc}>{step.desc}</Text>
            </View>
          </View>
        </Card>
      ))}
      <View style={{ height: Spacing.xxl }} />
    </View>
  );
}

/* ── CBT-I Guide ── */

function CBTIGuideView({ t }: { t: Translations }) {
  const categories = [
    { icon: '⏰', title: t.moreCopy.guideRestrictionTitle, desc: t.moreCopy.guideRestrictionBody },
    { icon: '🛏️', title: t.moreCopy.guideStimulusTitle, desc: t.moreCopy.guideStimulusBody },
    { icon: '💭', title: t.moreCopy.guideCognitiveTitle, desc: t.moreCopy.guideCognitiveBody },
    { icon: '🧘', title: t.moreCopy.guideRelaxationTitle, desc: t.moreCopy.guideRelaxationBody },
  ];

  return (
    <View>
      <Text style={ms.pageTitle}>{t.moreCBTIGuide}</Text>
      <Text style={ms.guideIntro}>{t.moreCopy.guideSubtitle}</Text>
      <Text style={ms.guideIntro}>
        {t.moreCopy.guideIntro}
      </Text>
      {categories.map((cat, i) => (
        <Card key={i}>
          <Text style={ms.guideIcon}>{cat.icon}</Text>
          <Text style={ms.guideCatTitle}>{cat.title}</Text>
          <Text style={ms.guideCatDesc}>{cat.desc}</Text>
        </Card>
      ))}
      <View style={{ height: Spacing.xxl }} />
    </View>
  );
}

/* ── Privacy Policy ── */

function PrivacyView({ t }: { t: Translations }) {
  return (
    <View>
      <Text style={ms.pageTitle}>{t.moreCopy.privacyTitle}</Text>

      <LegalSection title={t.moreCopy.privacyDataTitle}>
        <LegalP>{t.moreCopy.privacyDataBody}</LegalP>
      </LegalSection>

      <LegalSection title={t.moreCopy.privacyLocalTitle}>
        <LegalP>{t.moreCopy.privacyLocalBody}</LegalP>
      </LegalSection>

      <LegalSection title={t.moreCopy.privacyAiTitle}>
        <LegalP>{t.moreCopy.privacyAiBody}</LegalP>
        <LegalP bold>{t.moreCopy.privacyExcludedBody}</LegalP>
        <LegalP>{t.moreCopy.privacyPurposeBody}</LegalP>
      </LegalSection>

      <LegalSection title={t.moreCopy.privacyExternalTitle}>
        <LegalP>{t.moreCopy.privacyExternalBody}</LegalP>
      </LegalSection>

      <LegalSection title={t.moreCopy.privacyAbuseTitle}>
        <LegalP>{t.moreCopy.privacyAbuseBody}</LegalP>
      </LegalSection>

      <LegalSection title={t.moreCopy.privacySubscriptionTitle}>
        <LegalP>{t.moreCopy.privacySubscriptionBody}</LegalP>
      </LegalSection>

      <LegalSection title={t.moreCopy.privacyAdsTitle}>
        <LegalP>{t.moreCopy.privacyAdsBody}</LegalP>
      </LegalSection>

      <LegalSection title={t.moreCopy.privacyAccountsTitle}>
        <LegalP>{t.moreCopy.privacyAccountsBody}</LegalP>
      </LegalSection>

      <LegalSection title={t.moreCopy.privacyUseTitle}>
        <LegalP>{t.moreCopy.privacyUseBody}</LegalP>
      </LegalSection>

      <LegalSection title={t.moreCopy.privacySharingTitle}>
        <LegalP>{t.moreCopy.privacySharingBody}</LegalP>
      </LegalSection>

      <LegalSection title={t.moreCopy.privacyRetentionTitle}>
        <LegalP>{t.moreCopy.privacyRetentionBody}</LegalP>
      </LegalSection>

      <LegalSection title={t.moreCopy.privacyMedicalTitle}>
        <LegalP>{t.moreCopy.privacyMedicalBody}</LegalP>
      </LegalSection>

      <LegalSection title={t.moreCopy.privacyChildrenTitle}>
        <LegalP>{t.moreCopy.privacyChildrenBody}</LegalP>
      </LegalSection>

      <LegalSection title={t.moreCopy.privacyChangesTitle}>
        <LegalP>{t.moreCopy.privacyChangesBody}</LegalP>
      </LegalSection>

      <LegalSection title={t.moreCopy.privacyContactTitle}>
        <LegalP>{t.moreCopy.privacyContactBody}</LegalP>
      </LegalSection>

      <View style={{ height: Spacing.xxl }} />
    </View>
  );
}

/* ── Terms / Disclaimer ── */

function TermsView({ t }: { t: Translations }) {
  return (
    <View>
      <Text style={ms.pageTitle}>{t.moreCopy.termsTitle}</Text>

      <LegalSection title={t.moreCopy.termsNatureTitle}>
        <LegalP>{t.moreCopy.termsNatureBody}</LegalP>
      </LegalSection>

      <LegalSection title={t.moreCopy.termsMedicalTitle}>
        <LegalP>{t.moreCopy.termsMedicalBody}</LegalP>
      </LegalSection>

      <LegalSection title={t.moreCopy.termsRestrictionTitle}>
        <LegalP>{t.moreCopy.termsRestrictionBody}</LegalP>
      </LegalSection>

      <LegalSection title={t.moreCopy.termsAiTitle}>
        <LegalP>{t.moreCopy.termsAiBody}</LegalP>
      </LegalSection>

      <LegalSection title={t.moreCopy.termsConsultTitle}>
        <LegalP>{t.moreCopy.termsConsultBody}</LegalP>
      </LegalSection>

      <LegalSection title={t.moreCopy.termsSubscriptionTitle}>
        <LegalP>{t.moreCopy.termsSubscriptionBody}</LegalP>
      </LegalSection>

      <LegalSection title={t.moreCopy.termsLiabilityTitle}>
        <LegalP>{t.moreCopy.termsLiabilityBody}</LegalP>
      </LegalSection>

      <View style={{ height: Spacing.xxl }} />
    </View>
  );
}

/* ── Language ── */

function LanguageView({
  locale,
  setLocale,
  goBack,
  regenerateInsight,
}: {
  locale: SupportedLocale;
  setLocale: (l: SupportedLocale) => void;
  goBack: () => void;
  regenerateInsight: (t: import('../i18n/types').Translations, locale: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const handleSelect = (code: SupportedLocale) => {
    setLocale(code);
    if (code !== locale) {
      regenerateInsight(localeMap[code], code).catch(() => {});
    }
    goBack();
  };

  return (
    <View>
      <Text style={ms.pageTitle}>{t.moreLanguage}</Text>
      <View style={ms.menuSection}>
        {SUPPORTED_LOCALES.map((item) => (
          <TouchableOpacity
            key={item.code}
            style={ms.menuItem}
            onPress={() => handleSelect(item.code)}
            activeOpacity={0.6}
          >
            <Text style={ms.menuItemText}>{item.label}</Text>
            {item.code === locale && <Text style={ms.langCheck}>✓</Text>}
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ height: Spacing.xxl }} />
    </View>
  );
}

/* ── About ── */

function AboutView({ t }: { t: Translations }) {
  return (
    <View style={ms.aboutCenter}>
      <Text style={ms.aboutIcon}>🌙</Text>
      <Text style={ms.aboutTitle}>Simple CBT-I</Text>
      <Text style={ms.aboutSubtitle}>{t.moreCopy.subtitle}</Text>
      <Text style={ms.aboutVersion}>{t.moreCopy.version.replace('{version}', APP_VERSION)}</Text>
    </View>
  );
}

/* ── Legal helpers ── */

function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={ms.legalSection}>
      <Text style={ms.legalSectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function LegalP({ children, bold }: { children: string; bold?: boolean }) {
  return <Text style={[ms.legalText, bold && ms.legalBold]}>{children}</Text>;
}

/* ── Styles ── */

const ms = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingBottom: 120 },

  backRow: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  backText: { fontSize: FontSize.md, color: Colors.lavenderDark, fontWeight: FontWeight.medium },

  menuHeader: { alignItems: 'center', paddingTop: Spacing.lg, paddingBottom: Spacing.sm },
  menuIcon: { fontSize: 40, marginBottom: Spacing.xs },
  menuTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  menuSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.xs },

  proCard: { backgroundColor: Colors.lavenderLight },
  proTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  proDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.md },
  proTrial: { fontSize: FontSize.xs, color: Colors.lavenderDark, marginBottom: Spacing.sm },
  proActiveRow: { marginTop: Spacing.xs },
  proActiveBadge: { backgroundColor: Colors.mutedGreenLight, borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, alignSelf: 'flex-start' },
  proActiveText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.mutedGreenDark },
  proBtn: { backgroundColor: Colors.lavenderDark, borderRadius: BorderRadius.md, paddingVertical: Spacing.sm + 2, alignItems: 'center' },
  proBtnText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.white },

  menuSection: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.lavenderLight,
  },
  menuItemContent: { flex: 1 },
  menuItemText: { fontSize: FontSize.md, color: Colors.textPrimary },
  menuItemSubtitle: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
  menuItemDetail: { fontSize: FontSize.sm, color: Colors.textTertiary, marginRight: Spacing.xs },
  menuItemChevron: { fontSize: FontSize.lg, color: Colors.textTertiary },
  langCheck: { fontSize: FontSize.md, color: Colors.lavenderDark, fontWeight: FontWeight.semibold },

  version: { fontSize: FontSize.xs, color: Colors.textTertiary, textAlign: 'center', marginTop: Spacing.lg },

  pageTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },

  /* Plans */
  plansIntro: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  planCard: { alignItems: 'center' as const, paddingVertical: Spacing.lg },
  planCardHighlight: { borderWidth: 2, borderColor: Colors.lavenderDark },
  planBadge: { backgroundColor: Colors.lavenderDark, borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.md, paddingVertical: 2, marginBottom: Spacing.sm },
  planBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.white },
  planPeriod: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  planPrice: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  planUnit: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.xs },
  planSave: { fontSize: FontSize.xs, color: Colors.lavenderDark, fontWeight: FontWeight.medium, marginBottom: Spacing.sm },
  planBtn: { backgroundColor: Colors.lavenderDark, borderRadius: BorderRadius.md, paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.xl, alignItems: 'center' as const, marginTop: Spacing.sm, minWidth: 180 },
  planBtnHighlight: { backgroundColor: Colors.lavenderDark },
  planBtnText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.white },
  planFooter: { fontSize: FontSize.xs, color: Colors.textTertiary, lineHeight: 18, paddingHorizontal: Spacing.lg, marginTop: Spacing.md },

  /* Compare table */
  compareHeader: { flexDirection: 'row', paddingHorizontal: Spacing.md, marginBottom: Spacing.xs },
  compareLabelCol: { flex: 2 },
  compareCol: { flex: 1, alignItems: 'center', paddingVertical: Spacing.xs },
  compareColPro: { backgroundColor: Colors.lavenderLight, borderRadius: BorderRadius.sm },
  compareColTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary },
  compareColTitlePro: { color: Colors.lavenderDark },
  compareRow: { flexDirection: 'row', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, alignItems: 'center' },
  compareRowAlt: { backgroundColor: Colors.surfaceAlt, borderRadius: BorderRadius.sm, marginHorizontal: Spacing.sm },
  compareLabel: { fontSize: FontSize.sm, color: Colors.textPrimary },
  compareValue: { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'center' },
  compareValueMuted: { color: Colors.textTertiary },
  compareValueHighlight: { color: Colors.lavenderDark, fontWeight: FontWeight.semibold },

  /* How to use */
  stepCard: { paddingVertical: Spacing.md },
  stepRow: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
  stepCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.lavenderLight, justifyContent: 'center', alignItems: 'center' },
  stepNum: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.lavenderDark },
  stepContent: { flex: 1 },
  stepTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  stepDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

  /* CBT-I Guide */
  guideIntro: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  guideIcon: { fontSize: 28, marginBottom: Spacing.xs },
  guideCatTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  guideCatSub: { fontSize: FontSize.xs, color: Colors.textTertiary, marginBottom: Spacing.sm },
  guideCatDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

  /* Legal */
  legalSection: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  legalSectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  legalText: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.sm },
  legalBold: { fontWeight: FontWeight.semibold, color: Colors.textPrimary },

  /* About */
  aboutCenter: { alignItems: 'center', paddingTop: Spacing.xxl },
  aboutIcon: { fontSize: 56, marginBottom: Spacing.md },
  aboutTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  aboutSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.xs },
  aboutVersion: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: Spacing.lg },
});
