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
import { useI18n } from '../i18n';
import { useProStatus } from '../hooks/useProStatus';
import { Card } from '../components/Card';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../constants/theme';
import { Translations } from '../i18n/types';
import { PLAN_INFO, purchase, restore } from '../services/billing';

const APP_VERSION = '1.0.0';

type MoreView = 'menu' | 'plans' | 'freeVsPro' | 'howToUse' | 'cbtiGuide' | 'privacy' | 'terms' | 'about';

export function MoreScreen() {
  const [view, setView] = useState<MoreView>('menu');
  const insets = useSafeAreaInsets();
  const { t, locale } = useI18n();
  const { isPro, isPurchased, trialDaysLeft, isTrialActive, onPurchaseComplete } = useProStatus();
  const isJa = locale.startsWith('ja');

  const goBack = () => setView('menu');

  if (view !== 'menu') {
    return (
      <View style={[ms.container, { paddingTop: insets.top }]}>
        <TouchableOpacity style={ms.backRow} onPress={goBack} activeOpacity={0.6}>
          <Text style={ms.backText}>← {t.back}</Text>
        </TouchableOpacity>
        <ScrollView contentContainerStyle={ms.scroll} showsVerticalScrollIndicator={false}>
          {view === 'plans' && <PlansView t={t} isJa={isJa} onPurchaseComplete={onPurchaseComplete} goBack={goBack} />}
          {view === 'freeVsPro' && <FreeVsProView t={t} isJa={isJa} />}
          {view === 'howToUse' && <HowToUseView t={t} isJa={isJa} />}
          {view === 'cbtiGuide' && <CBTIGuideView t={t} isJa={isJa} />}
          {view === 'privacy' && <PrivacyView isJa={isJa} />}
          {view === 'terms' && <TermsView isJa={isJa} />}
          {view === 'about' && <AboutView />}
        </ScrollView>
      </View>
    );
  }

  const handleRestore = async () => {
    const restored = await restore();
    if (restored) {
      await onPurchaseComplete();
      Alert.alert(
        isJa ? '復元完了' : 'Restored',
        isJa ? 'Proサブスクリプションを復元しました。' : 'Your Pro subscription has been restored.',
      );
    } else {
      Alert.alert(
        isJa ? '購入が見つかりません' : 'No Purchase Found',
        isJa ? '有効なサブスクリプションが見つかりませんでした。' : 'No active subscription was found.',
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

  return (
    <View style={[ms.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={ms.scroll} showsVerticalScrollIndicator={false}>
        <View style={ms.menuHeader}>
          <Text style={ms.menuIcon}>🌙</Text>
          <Text style={ms.menuTitle}>Simple CBT-I</Text>
          <Text style={ms.menuSubtitle}>Sleep Journal & Daily Insight</Text>
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
          <MenuItem label={t.moreFreeVsPro} onPress={() => setView('freeVsPro')} />
          <MenuItem label={t.moreHowToUse} onPress={() => setView('howToUse')} />
          <MenuItem label={t.moreCBTIGuide} onPress={() => setView('cbtiGuide')} />
        </View>

        <View style={ms.menuSection}>
          <MenuItem label={t.morePrivacy} onPress={() => setView('privacy')} />
          <MenuItem label={t.moreTerms} onPress={() => setView('terms')} />
        </View>

        <View style={ms.menuSection}>
          <MenuItem label={t.moreRestorePurchases} onPress={handleRestore} />
          <MenuItem label={t.moreManageSubscription} onPress={handleManageSubscription} />
          <MenuItem label={t.moreAbout} onPress={() => setView('about')} />
        </View>

        <Text style={ms.version}>Version {APP_VERSION}</Text>
      </ScrollView>
    </View>
  );
}

function MenuItem({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={ms.menuItem} onPress={onPress} activeOpacity={0.6}>
      <Text style={ms.menuItemText}>{label}</Text>
      <Text style={ms.menuItemChevron}>›</Text>
    </TouchableOpacity>
  );
}

/* ── Plans ── */

function PlansView({
  t,
  isJa,
  onPurchaseComplete,
  goBack,
}: {
  t: Translations;
  isJa: boolean;
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
        {isJa
          ? 'Proにアップグレードして、AI Daily InsightとすべてのHistory・Statsを解放しましょう。'
          : 'Upgrade to Pro to unlock AI Daily Insights and full History & Stats.'}
      </Text>

      {PLAN_INFO.map((plan) => {
        const isMonthly = plan.id === 'simplecbti_pro_monthly';
        return (
          <Card key={plan.id} style={[ms.planCard, !isMonthly && ms.planCardHighlight]}>
            {!isMonthly && (
              <View style={ms.planBadge}>
                <Text style={ms.planBadgeText}>{isJa ? 'おすすめ' : 'Best value'}</Text>
              </View>
            )}
            <Text style={ms.planPeriod}>{isJa ? plan.periodJa : plan.period}</Text>
            <Text style={ms.planPrice}>{plan.price}</Text>
            <Text style={ms.planUnit}>
              {isMonthly
                ? isJa ? '/月' : '/month'
                : isJa ? '/6か月' : '/6 months'}
            </Text>
            {!isMonthly && (
              <Text style={ms.planSave}>
                {isJa ? '月あたり約$8.33 — 24%お得' : '~$8.33/mo — save 24%'}
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
                  {isJa ? 'このプランにする' : 'Subscribe'}
                </Text>
              )}
            </TouchableOpacity>
          </Card>
        );
      })}

      <Text style={ms.planFooter}>
        {isJa
          ? '・サブスクリプションは自動更新されます\n・いつでもキャンセル可能です\n・決済はApp Store / Google Playが処理します'
          : '• Subscriptions auto-renew\n• Cancel anytime\n• Payment is processed by App Store / Google Play'}
      </Text>

      <View style={{ height: Spacing.xxl }} />
    </View>
  );
}

/* ── Free vs Pro ── */

function FreeVsProView({ t, isJa }: { t: Translations; isJa: boolean }) {
  const rows: { label: string; free: string; pro: string; diff?: boolean }[] = [
    { label: isJa ? '睡眠記録' : 'Sleep recording', free: isJa ? '無制限' : 'Unlimited', pro: isJa ? '無制限' : 'Unlimited' },
    { label: 'Bedtime / Wake Up', free: isJa ? '無制限' : 'Unlimited', pro: isJa ? '無制限' : 'Unlimited' },
    { label: 'Morning Check-in', free: isJa ? '無制限' : 'Unlimited', pro: isJa ? '無制限' : 'Unlimited' },
    { label: isJa ? 'CBT-Iチェックイン' : 'CBT-I check-ins', free: isJa ? '無制限' : 'Unlimited', pro: isJa ? '無制限' : 'Unlimited' },
    { label: isJa ? 'CBT-Iガイド' : 'CBT-I Guide', free: '✓', pro: '✓' },
    { label: isJa ? 'メモ' : 'Optional memo', free: '✓', pro: '✓' },
    { label: 'History', free: isJa ? '直近7日' : 'Latest 7 days', pro: isJa ? '全履歴' : 'Full history', diff: true },
    { label: 'Stats', free: isJa ? '直近7日' : 'Latest 7 days', pro: isJa ? '全履歴' : 'Full history', diff: true },
    { label: 'Daily Insight', free: isJa ? '最初の20日間' : 'First 20 days', pro: isJa ? '無制限' : 'Unlimited', diff: true },
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

function HowToUseView({ t, isJa }: { t: Translations; isJa: boolean }) {
  const steps = isJa
    ? [
        { n: '1', title: 'Bedtimeを記録', desc: '寝る直前にDaily Insight画面上部の「Hold for Bedtime」を長押しします。' },
        { n: '2', title: 'Wake Upを記録', desc: '朝起きたら「Hold for Wake Up」を長押しします。' },
        { n: '3', title: 'Morning Check-in', desc: '入眠までの時間、中途覚醒時間、満足度、メモ（任意）、CBT-Iチェックイン3問を入力します。' },
        { n: '4', title: '自動計算', desc: '保存すると推定睡眠時間、睡眠効率、統計が自動更新されます。' },
        { n: '5', title: 'Daily Insight', desc: '利用可能期間中、その日のDaily Insightが生成されます。' },
        { n: '6', title: '振り返り', desc: 'HistoryとStatsで最近の睡眠傾向を確認できます。' },
      ]
    : [
        { n: '1', title: 'Record Bedtime', desc: 'Long press "Hold for Bedtime" at the top of the Daily Insight screen when you go to bed.' },
        { n: '2', title: 'Record Wake Up', desc: 'Long press "Hold for Wake Up" when you wake up in the morning.' },
        { n: '3', title: 'Morning Check-in', desc: 'Enter time to fall asleep, time awake during night, satisfaction, optional memo, and 3 CBT-I check-in questions.' },
        { n: '4', title: 'Auto Calculation', desc: 'Your estimated sleep time, sleep efficiency, and stats update automatically.' },
        { n: '5', title: 'Daily Insight', desc: 'During the available period, a Daily Insight is generated for the day.' },
        { n: '6', title: 'Review', desc: 'Check your recent sleep trends in History and Stats.' },
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

function CBTIGuideView({ t, isJa }: { t: Translations; isJa: boolean }) {
  const categories = isJa
    ? [
        {
          icon: '⏰', title: '睡眠制限', sub: 'Sleep Restriction',
          desc: '床上時間を実際の睡眠時間に近づけることで、睡眠の質を高めるアプローチです。起床時刻を一定に保ち、不必要にベッドで過ごす時間を減らします。\n\nすべての人に適しているわけではありません。大幅な変更を行う前に、医療専門家に相談してください。',
        },
        {
          icon: '🛏️', title: '刺激統制', sub: 'Stimulus Control',
          desc: 'ベッドと睡眠の結びつきを強化する方法です。眠くなってからベッドに入り、眠れないときはベッドを離れることで、「ベッド＝眠る場所」という習慣を作ります。',
        },
        {
          icon: '💭', title: '考え方を見直す', sub: 'Cognitive Restructuring',
          desc: '睡眠に関する不安や思い込みに気づき、より現実的な考え方に修正するアプローチです。「絶対に眠れない」「明日は最悪だ」といった極端な考えを和らげます。',
        },
        {
          icon: '🧘', title: 'リラックス・マインドフルネス', sub: 'Mindfulness / Relaxation',
          desc: '呼吸法やボディスキャンなど、心身の緊張を解くリラクゼーション法です。寝る前に静かな時間を作り、考えを追いかけずに流すことを練習します。',
        },
      ]
    : [
        {
          icon: '⏰', title: 'Sleep Restriction', sub: '',
          desc: 'Improves sleep quality by aligning time in bed with actual sleep time. Keep a consistent wake time and reduce unnecessary time in bed.\n\nThis may not be appropriate for everyone. Consult a healthcare professional before making significant changes.',
        },
        {
          icon: '🛏️', title: 'Stimulus Control', sub: '',
          desc: 'Strengthens the association between bed and sleep. Go to bed only when sleepy, and leave the bed if you cannot sleep, so that "bed = sleep" becomes a habit.',
        },
        {
          icon: '💭', title: 'Cognitive Restructuring', sub: '',
          desc: 'Helps you notice and revise anxious or unrealistic thoughts about sleep. Softens extreme thinking like "I will never fall asleep" or "tomorrow will be terrible."',
        },
        {
          icon: '🧘', title: 'Mindfulness / Relaxation', sub: '',
          desc: 'Relaxation techniques such as breathing exercises and body scans to release tension. Practice letting go of racing thoughts before bed.',
        },
      ];

  return (
    <View>
      <Text style={ms.pageTitle}>{t.moreCBTIGuide}</Text>
      <Text style={ms.guideIntro}>
        {isJa
          ? 'CBT-I（不眠症の認知行動療法）は、睡眠の問題に対するエビデンスに基づいたアプローチです。以下の4つの柱で構成されています。'
          : 'CBT-I (Cognitive Behavioral Therapy for Insomnia) is an evidence-based approach to sleep problems. It consists of four pillars.'}
      </Text>
      {categories.map((cat, i) => (
        <Card key={i}>
          <Text style={ms.guideIcon}>{cat.icon}</Text>
          <Text style={ms.guideCatTitle}>{cat.title}</Text>
          {cat.sub ? <Text style={ms.guideCatSub}>{cat.sub}</Text> : null}
          <Text style={ms.guideCatDesc}>{cat.desc}</Text>
        </Card>
      ))}
      <View style={{ height: Spacing.xxl }} />
    </View>
  );
}

/* ── Privacy Policy ── */

function PrivacyView({ isJa }: { isJa: boolean }) {
  return (
    <View>
      <Text style={ms.pageTitle}>{isJa ? 'プライバシーポリシー' : 'Privacy Policy'}</Text>

      <LegalSection title={isJa ? '1. 取り扱う情報' : '1. Information handled by the app'}>
        <LegalP>{isJa
          ? '本アプリでは以下の睡眠関連データを扱います：就床時刻、起床時刻、入眠潜時、中途覚醒時間、睡眠満足度、CBT-Iチェックイン回答、任意メモ、計算された睡眠時間・睡眠効率、睡眠記録から生成される統計情報。'
          : 'Simple CBT-I handles the following sleep-related data: bedtime, wake time, sleep onset latency, wake after sleep onset, sleep satisfaction, CBT-I check-in answers, optional memo, calculated sleep duration and efficiency, and statistics generated from sleep records.'}</LegalP>
      </LegalSection>

      <LegalSection title={isJa ? '2. 端末内保存' : '2. Information stored on device'}>
        <LegalP>{isJa
          ? 'すべての睡眠記録、統計、メモ、アプリ設定はAsyncStorageを使用して端末内に保存されます。アカウント登録は不要です。データはアプリを削除しない限り端末に残ります。'
          : 'All sleep records, statistics, memos, and app preferences are stored locally on your device using AsyncStorage. No account registration is required. Your data remains on your device unless you delete the app.'}</LegalP>
      </LegalSection>

      <LegalSection title={isJa ? '3. Daily InsightとAI処理' : '3. Daily Insight and AI processing'}>
        <LegalP>{isJa
          ? 'Daily Insight生成時に、以下の構造化データをAPIゲートウェイ経由でOpenAI APIへ送信します：当日の構造化された睡眠指標（在床時間、入眠潜時、中途覚醒時間、総睡眠時間、睡眠効率、満足度）、CBT-Iチェックイン結果、直近7日間の統計平均・トレンド、ルールエンジンの分析結果。'
          : 'When generating a Daily Insight, the following structured data is sent to OpenAI API via an API gateway: today\'s structured sleep metrics (time in bed, sleep onset latency, wake after sleep onset, total sleep time, sleep efficiency, satisfaction), CBT-I check-in results, 7-day statistical averages and trends, and rule engine analysis signals.'}</LegalP>
        <LegalP bold>{isJa
          ? '以下の情報はOpenAIへ送信されません：任意メモ／自由記述、過去の自由記述、全睡眠履歴、氏名・メールアドレス・電話番号等の個人識別情報。'
          : 'The following is NOT sent to OpenAI: optional memo / free-text notes, past free-text entries, full sleep history, names, email addresses, phone numbers, or other personal identifiers.'}</LegalP>
        <LegalP>{isJa
          ? 'Daily Insightは医療診断・治療・処方ではなく、睡眠習慣の振り返り支援です。'
          : 'Daily Insight is informational support for sleep habit reflection, not medical diagnosis, treatment, or prescription.'}</LegalP>
      </LegalSection>

      <LegalSection title={isJa ? '4. 外部サービス' : '4. External services'}>
        <LegalP>{isJa
          ? 'Daily Insightの生成にはOpenAI APIをAPIゲートウェイ経由で使用しています。上記の構造化された睡眠データがOpenAIにより処理されます。'
          : 'Daily Insight generation uses OpenAI API via an API gateway. The structured sleep data described above is processed by OpenAI.'}</LegalP>
      </LegalSection>

      <LegalSection title={isJa ? '5. 不正利用防止' : '5. Abuse prevention'}>
        <LegalP>{isJa
          ? '無料Daily Insightの不正な繰り返し取得を防止するため、Apple DeviceCheckのスタブ実装が含まれていますが、現時点では有効化されていません。有効化された場合、広告トラッキング目的ではなく、無料利用枠の不正防止のみを目的とします。'
          : 'Simple CBT-I includes stub support for Apple DeviceCheck to prevent abuse of the free Daily Insight trial. This feature is not currently active. When implemented, it will be used solely to prevent repeated free trial claims and API abuse, not for advertising tracking.'}</LegalP>
      </LegalSection>

      <LegalSection title={isJa ? '6. アプリ内サブスクリプション' : '6. In-app subscriptions'}>
        <LegalP>{isJa
          ? 'Simple CBT-I Proは自動更新サブスクリプションです（月額・6か月）。決済はApple App Store / Google Playが処理します。本アプリはクレジットカード番号、銀行口座情報等を直接取得・保存しません。'
          : 'Simple CBT-I Pro is available as an auto-renewing subscription (Monthly / 6 Months). Payments are processed by Apple App Store or Google Play. Simple CBT-I does not directly collect or store credit card numbers or bank account information.'}</LegalP>
      </LegalSection>

      <LegalSection title={isJa ? '7. 広告' : '7. Advertising'}>
        <LegalP>{isJa
          ? 'Simple CBT-Iは現在、サードパーティ広告を表示していません。変更がある場合は本ポリシーを更新します。'
          : 'Simple CBT-I does not currently display third-party advertising. If this changes, this policy will be updated.'}</LegalP>
      </LegalSection>

      <LegalSection title={isJa ? '8. アカウント' : '8. Accounts'}>
        <LegalP>{isJa
          ? 'Simple CBT-Iはアカウント登録を必要としません。'
          : 'Simple CBT-I does not require or support user accounts.'}</LegalP>
      </LegalSection>

      <LegalSection title={isJa ? '9. データの利用目的' : '9. Purposes of data use'}>
        <LegalP>{isJa
          ? '収集するデータは、睡眠履歴の記録・表示、統計・トレンドの計算、AI処理によるDaily Insight生成、無料トライアルの不正利用防止にのみ使用されます。'
          : 'Data is used for recording and displaying sleep history, calculating statistics and trends, generating Daily Insights via AI, and preventing abuse of free trial features.'}</LegalP>
      </LegalSection>

      <LegalSection title={isJa ? '10. データの共有・販売' : '10. Data sharing and sale'}>
        <LegalP>{isJa
          ? 'Simple CBT-Iはユーザーの個人データを広告主やサードパーティに販売しません。機能提供に必要な外部サービス以外へ睡眠データを共有しません。'
          : 'Simple CBT-I does not sell users\' personal data to advertisers or any third parties. Data is shared only with external services necessary for app functionality.'}</LegalP>
      </LegalSection>

      <LegalSection title={isJa ? '11. データの保持' : '11. Data retention'}>
        <LegalP>{isJa
          ? '睡眠記録はアプリがインストールされている限り端末内に保持されます。アプリの削除により全ローカルデータが削除されます。'
          : 'Sleep records are retained locally on your device for as long as the app is installed. Uninstalling the app removes all local data.'}</LegalP>
      </LegalSection>

      <LegalSection title={isJa ? '12. 医療に関する免責事項' : '12. Medical disclaimer'}>
        <LegalP>{isJa
          ? 'Simple CBT-Iはセルフヘルプ型の睡眠日誌です。医療診断、治療、処方、緊急医療サービスを提供するものではありません。'
          : 'Simple CBT-I is a self-help sleep journal. It does not provide medical diagnosis, treatment, prescriptions, or emergency services.'}</LegalP>
      </LegalSection>

      <LegalSection title={isJa ? '13. 子どものプライバシー' : '13. Children\'s privacy'}>
        <LegalP>{isJa
          ? 'Simple CBT-Iは13歳未満の子どもを対象としていません。'
          : 'Simple CBT-I is not intended for children under 13.'}</LegalP>
      </LegalSection>

      <LegalSection title={isJa ? '14. ポリシーの変更' : '14. Changes to this policy'}>
        <LegalP>{isJa
          ? '本ポリシーはアプリの機能変更を反映して更新される場合があります。'
          : 'This policy may be updated to reflect changes in app functionality.'}</LegalP>
      </LegalSection>

      <LegalSection title={isJa ? '15. お問い合わせ' : '15. Contact'}>
        <LegalP>{isJa
          ? '本プライバシーポリシーに関するご質問は、アプリ内のサポートまでお問い合わせください。'
          : 'For questions about this Privacy Policy, please contact us through the app.'}</LegalP>
      </LegalSection>

      <View style={{ height: Spacing.xxl }} />
    </View>
  );
}

/* ── Terms / Disclaimer ── */

function TermsView({ isJa }: { isJa: boolean }) {
  return (
    <View>
      <Text style={ms.pageTitle}>{isJa ? '利用規約・免責事項' : 'Terms of Use & Disclaimer'}</Text>

      <LegalSection title={isJa ? '1. アプリの性質' : '1. Nature of the app'}>
        <LegalP>{isJa
          ? 'Simple CBT-Iは、不眠症の認知行動療法（CBT-I）の原則に基づいたセルフヘルプ型の睡眠日誌です。'
          : 'Simple CBT-I is a self-help sleep journal based on Cognitive Behavioral Therapy for Insomnia (CBT-I) principles.'}</LegalP>
      </LegalSection>

      <LegalSection title={isJa ? '2. 医療行為ではありません' : '2. Not medical advice'}>
        <LegalP>{isJa
          ? '本アプリは以下を提供しません：医療診断、医療的治療、処方、緊急医療サービス。Daily Insightは記録された睡眠データに基づく情報提供であり、専門的な医療助言の代替ではありません。'
          : 'The app does not provide: medical diagnosis, medical treatment, prescriptions, or emergency medical services. Daily Insight is informational support, not a substitute for professional medical advice.'}</LegalP>
      </LegalSection>

      <LegalSection title={isJa ? '3. 睡眠制限について' : '3. Sleep Restriction'}>
        <LegalP>{isJa
          ? 'CBT-Iガイドで紹介される睡眠制限法は教育的情報です。すべての人に適しているわけではありません。本アプリは睡眠スケジュールを自動的に変更しません。睡眠パターンを大きく変更する前に、医療専門家にご相談ください。'
          : 'Sleep restriction techniques in the CBT-I Guide are educational information. They may not be appropriate for everyone. The app does not automatically modify your sleep schedule. Consult a healthcare professional before significantly changing your sleep patterns.'}</LegalP>
      </LegalSection>

      <LegalSection title={isJa ? '4. AI生成コンテンツ' : '4. AI-generated content'}>
        <LegalP>{isJa
          ? 'Daily Insightは記録されたデータに基づいてAIが生成します。医療的な推奨事項ではなく、参考となる提案としてお考えください。'
          : 'Daily Insights are generated by AI based on your recorded data. They should be considered supportive suggestions, not medical recommendations.'}</LegalP>
      </LegalSection>

      <LegalSection title={isJa ? '5. 医療相談' : '5. Healthcare consultation'}>
        <LegalP>{isJa
          ? '持続的または重度の睡眠の問題がある方、健康に関する懸念がある方は、適切な医療専門家にご相談ください。'
          : 'Users with persistent or severe sleep problems, or concerns about their health, should consult an appropriate healthcare professional.'}</LegalP>
      </LegalSection>

      <LegalSection title={isJa ? '6. サブスクリプション' : '6. Subscriptions'}>
        <LegalP>{isJa
          ? 'Simple CBT-I Proは自動更新サブスクリプションです。月額プラン：キャンセルしない限り毎月自動更新。6か月プラン：キャンセルしない限り6か月ごとに自動更新。デバイスのサブスクリプション管理からいつでもキャンセルできます。'
          : 'Simple CBT-I Pro is an auto-renewing subscription. Monthly: auto-renews every month unless canceled. 6 Months: auto-renews every 6 months unless canceled. Cancel anytime through your device\'s subscription management.'}</LegalP>
      </LegalSection>

      <LegalSection title={isJa ? '7. 責任の制限' : '7. Limitation of liability'}>
        <LegalP>{isJa
          ? 'Simple CBT-Iは現状のまま提供され、保証はありません。開発者はアプリの使用により生じた健康上の結果について責任を負いません。'
          : 'Simple CBT-I is provided "as is" without warranty. The developer is not liable for any health outcomes resulting from use of the app.'}</LegalP>
      </LegalSection>

      <View style={{ height: Spacing.xxl }} />
    </View>
  );
}

/* ── About ── */

function AboutView() {
  return (
    <View style={ms.aboutCenter}>
      <Text style={ms.aboutIcon}>🌙</Text>
      <Text style={ms.aboutTitle}>Simple CBT-I</Text>
      <Text style={ms.aboutSubtitle}>Sleep Journal & Daily Insight</Text>
      <Text style={ms.aboutVersion}>Version {APP_VERSION}</Text>
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
  menuItemText: { flex: 1, fontSize: FontSize.md, color: Colors.textPrimary },
  menuItemChevron: { fontSize: FontSize.lg, color: Colors.textTertiary },

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
