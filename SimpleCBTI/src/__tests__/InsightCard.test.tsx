import { SleepDayContent } from '../components/SleepDayContent';
jest.mock('../components/StarRating', () => ({ StarRating: () => null }));
import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { AccessibilityInfo } from 'react-native';
import { InsightCard } from '../components/InsightCard';
import { en } from '../i18n/locales/en';
import { ja } from '../i18n/locales/ja';

jest.mock('react-native', () => ({
  View: 'View', Text: 'Text', Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles },
  AccessibilityInfo: {
    isReduceMotionEnabled: jest.fn(async () => false),
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

let renderer: ReactTestRenderer;
const props = { generating: true, insight: '', insightTitle: '', t: en };
const message = 'Keep a consistent wake-up time.';
const text = () => JSON.stringify(renderer.toJSON());
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  jest.useFakeTimers();
  jest.spyOn(globalThis, 'setInterval');
  const originalError = console.error;
  jest.spyOn(console, 'error').mockImplementation((...args) => {
    if (String(args[0]).startsWith('react-test-renderer is deprecated')) return;
    originalError(...args);
  });
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false);
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test('CASE 1: the same card displays a calm 500ms dot loop throughout a 5 second wait', async () => {
  await act(async () => { renderer = create(<InsightCard {...props} />); });
  expect(renderer.root.findByProps({ testID: 'insight-generating' })).toBeTruthy();
  expect(text()).not.toContain(en.dailyInsightAttribution);
  expect(text()).toContain('Generating your Daily Insight');
  await act(async () => jest.advanceTimersByTime(500));
  expect(text()).toContain('Generating your Daily Insight.');
  await act(async () => jest.advanceTimersByTime(4500));
  expect(renderer.root.findByProps({ testID: 'insight-generating' })).toBeTruthy();
});

test('CASE 2/5: title is immediate, message uses 25ms typing; rerender does not restart; tap reveals', async () => {
  await act(async () => { renderer = create(<InsightCard {...props} />); });
  const result = { ...props, generating: false, insight: message, insightTitle: 'A steady rhythm' };
  await act(async () => renderer.update(<InsightCard {...result} />));
  expect(text()).not.toContain(en.dailyInsightGenerating);
  expect(renderer.root.findByProps({ testID: 'insight-typewriting' })).toBeTruthy();
  expect(text()).toContain(result.insightTitle);
  const revealed = () => renderer.root.findByProps({ accessibilityLabel: message }).props.children;
  await act(async () => jest.advanceTimersByTime(75));
  expect(revealed()).toBe('Kee');
  await act(async () => renderer.update(<InsightCard {...result} />));
  expect(revealed()).toBe('Kee');
  await act(async () => renderer.root.findByType('Pressable' as never).props.onPress());
  expect(revealed()).toBe(message);
  expect(renderer.root.findByProps({ testID: 'insight-complete' })).toBeTruthy();
});

test('CASE 3: a fallback with no title replaces generating and completes normally', async () => {
  await act(async () => { renderer = create(<InsightCard {...props} />); });
  await act(async () => renderer.update(<InsightCard {...props} generating={false} insight={message} />));
  await act(async () => jest.advanceTimersByTime(message.length * 25));
  expect(renderer.root.findByProps({ testID: 'insight-complete' })).toBeTruthy();
  expect(text()).not.toContain(en.dailyInsightGenerating);
  expect(text()).not.toContain('ERROR');
});

test('CASE 4: saved insight is immediately complete, including after rerenders', async () => {
  const saved = { ...props, generating: false, insight: message, insightTitle: 'Saved' };
  await act(async () => { renderer = create(<InsightCard {...saved} />); });
  expect(renderer.root.findByProps({ testID: 'insight-complete' })).toBeTruthy();
  expect(renderer.root.findByProps({ accessibilityLabel: message }).props.children).toBe(message);
  await act(async () => renderer.update(<InsightCard {...saved} />));
  expect(setInterval).not.toHaveBeenCalled();
});

test('CASE 6: Reduce Motion keeps waiting text static and reveals the full result immediately', async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(true);
  await act(async () => { renderer = create(<InsightCard {...props} t={ja} />); });
  const before = text();
  await act(async () => jest.advanceTimersByTime(5000));
  expect(text()).toBe(before);
  expect(text()).toContain(ja.dailyInsightGenerating);
  expect(setInterval).not.toHaveBeenCalled();
  await act(async () => renderer.update(<InsightCard {...props} t={ja} generating={false} insight={message} />));
  expect(renderer.root.findByProps({ testID: 'insight-complete' })).toBeTruthy();
  expect(setInterval).not.toHaveBeenCalled();
});

// Attribution must reflect the saved source, including legacy records with no source.
test.each(['openai', 'fallback', undefined] as const)('saved %s attribution agrees on Today and History', async (source) => {
  await act(async () => { renderer = create(<InsightCard {...props} generating={false} insight={message} insightSource={source} />); });
  expect(text().includes(en.dailyInsightAttribution)).toBe(source === 'openai');
  await act(async () => renderer.update(<SleepDayContent t={en} data={{
    bedtimeStr:'23:00',wakeTimeStr:'07:00',durationStr:'8h',totalSleepStr:'7h',efficiency:90,
    satisfaction:3,sleepOnsetMinutes:10,nightWakeMinutes:10,memo:'',techniqueIds:[],techniqueResponses:{},
    insight:message,insightTitle:'Saved',insightSource:source,
  }} />));
  expect(text().includes(en.dailyInsightAttribution)).toBe(source === 'openai');
});
