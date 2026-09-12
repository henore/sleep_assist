import React, { useState, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nContext, detectLocale, localeMap } from '../i18n';
import { SupportedLocale } from '../i18n/types';
import { en } from '../i18n/locales/en';

const LOCALE_KEY = 'user_locale';

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(detectLocale());

  React.useEffect(() => {
    AsyncStorage.getItem(LOCALE_KEY).then((saved) => {
      if (saved && saved in localeMap) {
        setLocaleState(saved as SupportedLocale);
      }
    });
  }, []);

  const setLocale = useCallback((l: SupportedLocale) => {
    setLocaleState(l);
    AsyncStorage.setItem(LOCALE_KEY, l);
  }, []);

  const value = useMemo(
    () => ({
      locale,
      t: localeMap[locale] ?? en,
      setLocale,
    }),
    [locale, setLocale],
  );

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}
