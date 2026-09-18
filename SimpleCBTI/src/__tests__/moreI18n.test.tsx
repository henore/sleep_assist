import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Alert } from 'react-native';
import { I18nContext, localeMap, SUPPORTED_LOCALES } from '../i18n';
import { SupportedLocale, Translations } from '../i18n/types';
import { MoreScreen } from '../screens/MoreScreen';
import { restore } from '../services/billing';
import { generateDailyInsight } from '../services/insightApi';
import { TECHNIQUE_DEFS } from '../constants/techniques';

jest.mock('expo-localization', () => ({ getLocales: () => [] }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0 }) }));
jest.mock('../hooks/useProStatus', () => ({ useProStatus: () => ({
  isPro: true, isPurchased: false, isTrialActive: true, trialDaysLeft: 5,
  onPurchaseComplete: async () => {},
}) }));
jest.mock('../services/billing', () => ({
  PLAN_INFO: [{ id: 'simplecbti_pro_monthly', price: '$11.99' }, { id: 'six-months', price: '$55.99' }],
  purchase: jest.fn(), restore: jest.fn(async () => true),
}));
jest.mock('react-native', () => ({
  View: 'View', Text: 'Text', ScrollView: 'ScrollView', TouchableOpacity: 'TouchableOpacity',
  ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: (value: unknown) => value },
  Platform: { select: () => '' }, Linking: { openURL: jest.fn() }, Alert: { alert: jest.fn() },
}));

let renderer: ReactTestRenderer;
const screen = (locale: SupportedLocale) => (
  <I18nContext.Provider value={{ locale, t: localeMap[locale], setLocale: jest.fn() }}>
    <MoreScreen />
  </I18nContext.Provider>
);
const content = () => renderer.root.findAllByType('Text' as never)
  .map((node) => node.children.filter((c) => typeof c === 'string').join('')).join('\n');
async function press(label: string) {
  const button = renderer.root.findAllByType('TouchableOpacity' as never).find((node) =>
    node.findAllByType('Text' as never).some((text) => text.children.includes(label)));
  expect(button).toBeDefined();
  await act(async () => button!.props.onPress());
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const originalError = console.error;
  jest.spyOn(console, 'error').mockImplementation((...args) => {
    if (String(args[0]).startsWith('react-test-renderer is deprecated')) return;
    originalError(...args);
  });
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  jest.restoreAllMocks();
});

test.each(SUPPORTED_LOCALES.map(({ code }) => code))('%s: complete More dictionary, translated bodies, and matching placeholders', (locale) => {
  const copy = localeMap[locale].moreCopy;
  expect(Object.keys(copy).sort()).toEqual(Object.keys(localeMap.en.moreCopy).sort());
  for (const key of Object.keys(copy) as (keyof typeof copy)[]) {
    expect(copy[key].trim().length).toBeGreaterThan(0);
    expect(copy[key].match(/\{\w+\}/g) ?? []).toEqual(localeMap.en.moreCopy[key].match(/\{\w+\}/g) ?? []);
    if (locale !== 'en' && key.endsWith('Body')) expect(copy[key]).not.toBe(localeMap.en.moreCopy[key]);
  }
});

test.each(SUPPORTED_LOCALES.map(({ code }) => code))('%s: every More page renders the selected language', async (locale) => {
  const t = localeMap[locale];
  await act(async () => { renderer = create(screen(locale)); });
  expect(content()).toContain(t.moreCopy.subtitle);
  const pages: [string, string][] = [
    [t.proCardViewPlans, t.moreCopy.planFooter],
    [t.moreFreeVsPro, t.moreCopy.latest7Days],
    [t.moreHowToUse, t.moreCopy.howCheckInBody],
    [t.moreCBTIGuide, t.moreCopy.guideRestrictionBody],
    [t.morePrivacy, t.moreCopy.privacyExcludedBody],
    [t.moreTerms, t.moreCopy.termsRestrictionBody],
    [t.moreLanguage, t.moreLanguage],
  ];
  for (const [label, expected] of pages) {
    await press(label);
    expect(content()).toContain(expected);
    await act(async () => renderer.root.findAllByType('TouchableOpacity' as never)[0].props.onPress());
  }
});

test('language changes refresh the already open privacy page and restore alerts', async () => {
  await act(async () => { renderer = create(screen('en')); });
  await press(localeMap.en.morePrivacy);
  for (const locale of ['ja', 'fr', 'ar'] as SupportedLocale[]) {
    await act(async () => renderer.update(screen(locale)));
    expect(content()).toContain(localeMap[locale].moreCopy.privacyExcludedBody);
    expect(content()).not.toContain(localeMap.en.moreCopy.privacyExcludedBody);
  }
  await act(async () => renderer.root.findAllByType('TouchableOpacity' as never)[0].props.onPress());
  await press(localeMap.ar.moreRestorePurchases);
  expect(Alert.alert).toHaveBeenLastCalledWith(localeMap.ar.moreCopy.restoreTitle, localeMap.ar.moreCopy.restoreBody);
  jest.mocked(restore).mockResolvedValueOnce(false);
  await press(localeMap.ar.moreRestorePurchases);
  expect(Alert.alert).toHaveBeenLastCalledWith(localeMap.ar.moreCopy.restoreMissingTitle, localeMap.ar.moreCopy.restoreMissingBody);
});

test('Japanese display labels are translated, with product names preserved', () => {
  const productKeys = new Set(['tabDailyInsight', 'headerDailyInsight', 'dailyInsightCardTitle', 'detailTechniques', 'noMemo', 'moreFreeVsPro']);
  for (const key of Object.keys(localeMap.en) as (keyof Translations)[]) {
    if (key === 'moreCopy' || productKeys.has(key)) continue;
    expect(localeMap.ja[key]).not.toBe(localeMap.en[key]);
  }
});

test.each(SUPPORTED_LOCALES.filter(({ code }) => code !== 'en').map(({ code }) => code))(
  '%s: no copied English UI text except product names, symbols and shared words', (locale) => {
    const shared = new Set(['tabDailyInsight', 'headerDailyInsight', 'dailyInsightCardTitle', 'detailTechniques', 'noMemo', 'minutes', 'moreFreeVsPro']);
    if (locale === 'fr') shared.add('detailSatisfaction'); // « Satisfaction » is also French.
    if (locale === 'id') shared.add('historyDetail'); // « Detail » is also Indonesian.
    expect(Object.keys(localeMap[locale]).sort()).toEqual(Object.keys(localeMap.en).sort());
    for (const key of Object.keys(localeMap.en) as (keyof Translations)[]) {
      if (key === 'moreCopy') continue;
      const value = localeMap[locale][key];
      expect(value.trim().length).toBeGreaterThan(0);
      expect(value.match(/\{\w+\}/g) ?? []).toEqual(localeMap.en[key].match(/\{\w+\}/g) ?? []);
      if (!shared.has(key)) expect(value).not.toBe(localeMap.en[key]);
    }
  },
);

test.each(SUPPORTED_LOCALES.map(({ code }) => code))('%s: fallback action uses the selected language', async (locale) => {
  (globalThis as typeof globalThis & { __DEV__: boolean }).__DEV__ = false;
  jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Offline'));
  const t = localeMap[locale];
  const result = await generateDailyInsight({
    bedtime: new Date(2026, 8, 1, 23), wakeTime: new Date(2026, 8, 2, 7),
    sleepOnsetMinutes: 20, nightWakeMinutes: 10, satisfaction: 4,
    techniqueIds: ['SC01'], techniqueResponses: { SC01: 'done' }, records: [], language: locale, t,
  });
  const technique = TECHNIQUE_DEFS.find((item) => item.id === result.focusActionId)!;
  expect(result.source).toBe('fallback');
  expect(result.message).toContain(t[technique.labelKey]);
});
