import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getLocales } from 'expo-localization';
import { Translations, SupportedLocale } from './types';

import { en } from './locales/en';
import { ja } from './locales/ja';
import { zhHans } from './locales/zh-Hans';
import { zhHant } from './locales/zh-Hant';
import { ko } from './locales/ko';
import { es } from './locales/es';
import { fr } from './locales/fr';
import { de } from './locales/de';
import { pt } from './locales/pt';
import { it } from './locales/it';
import { ru } from './locales/ru';
import { ar } from './locales/ar';
import { hi } from './locales/hi';
import { th } from './locales/th';
import { vi } from './locales/vi';
import { id } from './locales/id';

const localeMap: Record<SupportedLocale, Translations> = {
  en,
  ja,
  'zh-Hans': zhHans,
  'zh-Hant': zhHant,
  ko,
  es,
  fr,
  de,
  pt,
  it,
  ru,
  ar,
  hi,
  th,
  vi,
  id,
};

export const SUPPORTED_LOCALES: { code: SupportedLocale; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'zh-Hans', label: '简体中文' },
  { code: 'zh-Hant', label: '繁體中文' },
  { code: 'ko', label: '한국어' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'pt', label: 'Português' },
  { code: 'it', label: 'Italiano' },
  { code: 'ru', label: 'Русский' },
  { code: 'ar', label: 'العربية' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'th', label: 'ไทย' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'id', label: 'Bahasa Indonesia' },
];

function detectLocale(): SupportedLocale {
  try {
    const deviceLocales = getLocales();
    if (deviceLocales.length > 0) {
      const tag = deviceLocales[0].languageTag;
      const lang = deviceLocales[0].languageCode ?? '';

      if (tag.startsWith('zh-Hant') || tag.startsWith('zh-TW') || tag.startsWith('zh-HK')) {
        return 'zh-Hant';
      }
      if (tag.startsWith('zh')) {
        return 'zh-Hans';
      }
      if (lang in localeMap) {
        return lang as SupportedLocale;
      }
    }
  } catch {}
  return 'en';
}

interface I18nContextValue {
  locale: SupportedLocale;
  t: Translations;
  setLocale: (locale: SupportedLocale) => void;
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'en',
  t: en,
  setLocale: () => {},
});

export function useI18n() {
  return useContext(I18nContext);
}

export { I18nContext, detectLocale, localeMap };
export type { I18nContextValue };
