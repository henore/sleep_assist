import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { Translations } from '../i18n/types';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../constants/theme';

interface Props {
  visible: boolean;
  onDismiss: () => void;
  onUpgrade: () => void;
  t: Translations;
}

export function TrialExpiredOverlay({ visible, onDismiss, onUpgrade, t }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.icon}>🌙</Text>
          <Text style={styles.title}>{t.trialEndTitle}</Text>
          <Text style={styles.body}>{t.trialEndBody}</Text>
          <Text style={styles.cta}>{t.trialEndCta}</Text>

          <TouchableOpacity style={styles.upgradeBtn} onPress={onUpgrade} activeOpacity={0.8}>
            <Text style={styles.upgradeBtnText}>{t.upgradeButton}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss} activeOpacity={0.7}>
            <Text style={styles.dismissBtnText}>{t.continueButton}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  icon: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  body: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  cta: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  upgradeBtn: {
    backgroundColor: Colors.lavenderDark,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    width: '100%',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  upgradeBtnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.white,
  },
  dismissBtn: {
    paddingVertical: Spacing.sm,
  },
  dismissBtnText: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    fontWeight: FontWeight.medium,
  },
});
