import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { hasSeenTrialExpired, markTrialExpiredSeen } from '../services/trialGuard';
import { checkPurchased, initBilling, markPurchased } from '../services/billing';

const INSTALL_DATE_KEY = 'install_date';
const TRIAL_DAYS = 20;

export function useProStatus() {
  const [installDate, setInstallDate] = useState<Date | null>(null);
  const [purchased, setPurchased] = useState(false);
  const [showExpiredOverlay, setShowExpiredOverlay] = useState(false);

  useEffect(() => {
    (async () => {
      await initBilling();
      const hasPurchase = await checkPurchased();
      setPurchased(hasPurchase);

      const stored = await AsyncStorage.getItem(INSTALL_DATE_KEY);
      let date: Date;
      if (stored) {
        date = new Date(stored);
      } else {
        date = new Date();
        await AsyncStorage.setItem(INSTALL_DATE_KEY, date.toISOString());
      }
      setInstallDate(date);

      if (!hasPurchase) {
        const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
        if (days >= TRIAL_DAYS) {
          const seen = await hasSeenTrialExpired();
          if (!seen) {
            setShowExpiredOverlay(true);
          }
        }
      }
    })();
  }, []);

  const dismissExpiredOverlay = useCallback(async () => {
    setShowExpiredOverlay(false);
    await markTrialExpiredSeen();
  }, []);

  const onPurchaseComplete = useCallback(async () => {
    await markPurchased();
    setPurchased(true);
  }, []);

  if (!installDate) {
    return {
      isPro: true,
      isTrialActive: true,
      trialDaysLeft: TRIAL_DAYS,
      isPurchased: false,
      showExpiredOverlay: false,
      dismissExpiredOverlay,
      onPurchaseComplete,
    };
  }

  const daysSinceInstall = Math.floor(
    (Date.now() - installDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  const isTrialActive = daysSinceInstall < TRIAL_DAYS;
  const trialDaysLeft = Math.max(0, TRIAL_DAYS - daysSinceInstall);
  const isPurchased = purchased;
  const isPro = isPurchased || isTrialActive;

  return {
    isPro,
    isTrialActive,
    trialDaysLeft,
    isPurchased,
    showExpiredOverlay,
    dismissExpiredOverlay,
    onPurchaseComplete,
  };
}
