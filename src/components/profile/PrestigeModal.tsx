/**
 * Prestige modal: shown when user taps level card and is eligible (level 15, prestige < 3).
 * Explains prestige, confirms, and calls prestigeNow() on confirm.
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/utils/colors';
import { MAX_PRESTIGE } from '@/src/types/gamification';

const TEAL = colors.teal;
const GOLD = colors.gold;

interface Props {
  visible: boolean;
  onClose: () => void;
  onPrestige: () => Promise<boolean>;
  currentPrestige: number;
}

export function PrestigeModal({ visible, onClose, onPrestige, currentPrestige }: Props) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<number | null>(null);
  const nextPrestige = currentPrestige + 1;

  const handlePrestige = async () => {
    setLoading(true);
    setSuccess(null);
    try {
      const ok = await onPrestige();
      if (ok) {
        setSuccess(nextPrestige);
        setTimeout(() => {
          onClose();
        }, 1400);
      }
    } catch (e) {
      console.error('[PrestigeModal] prestige failed', e);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading && !success) onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={handleClose}
      >
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()} style={styles.card}>
          {success != null ? (
            <View style={styles.successWrap}>
              <Text style={styles.successEmoji}>✨</Text>
              <Text style={styles.successTitle}>Prestige {success} Unlocked</Text>
              <Text style={styles.successSub}>Level reset to 1. Your badges & trophies stay.</Text>
            </View>
          ) : (
            <>
              <View style={styles.header}>
                <View style={styles.iconWrap}>
                  <Ionicons name="flash" size={32} color={GOLD} />
                </View>
                <Text style={styles.title}>Prestige</Text>
                <Text style={styles.subtitle}>
                  Reset your level back to 1 and gain Prestige {nextPrestige}.
                </Text>
              </View>

              <Text style={styles.body}>
                Your catches, badges, trophies, passport, and AR stay. Only level progression resets.
              </Text>

              <View style={styles.warningWrap}>
                <Ionicons name="warning" size={16} color={colors.lightSubtext} />
                <Text style={styles.warning}>This cannot be undone.</Text>
              </View>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnCancel]}
                  onPress={handleClose}
                  disabled={loading}
                >
                  <Text style={styles.btnCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrestige]}
                  onPress={handlePrestige}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#0a0a14" />
                  ) : (
                    <Text style={styles.btnPrestigeText}>Prestige Now</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: colors.lightCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,229,200,0.2)',
    padding: 24,
    maxWidth: 340,
    width: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,200,69,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: GOLD,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: colors.lightText,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  body: {
    fontSize: 14,
    color: colors.lightSubtext,
    lineHeight: 22,
    marginBottom: 16,
  },
  warningWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  warning: {
    fontSize: 12,
    color: colors.lightSubtext,
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancel: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  btnCancelText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.lightSubtext,
  },
  btnPrestige: {
    backgroundColor: GOLD,
  },
  btnPrestigeText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0a0a14',
  },
  successWrap: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  successEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: GOLD,
    letterSpacing: 0.5,
  },
  successSub: {
    fontSize: 13,
    color: colors.lightSubtext,
    marginTop: 8,
  },
});
