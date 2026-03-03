/**
 * SubmitButton — Continue to Log button with loading state
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/utils/colors';

const BRIGHT_BLUE = colors.brightBlue;

export interface SubmitButtonProps {
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
}

export function SubmitButton({
  onPress,
  disabled = false,
  loading = false,
  loadingLabel = 'Logging…',
}: SubmitButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[styles.button, isDisabled && styles.buttonDisabled]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
    >
      {loading ? (
        <View style={styles.content}>
          <ActivityIndicator color="#FFFFFF" size="small" />
          <Text style={styles.text}>{loadingLabel}</Text>
        </View>
      ) : (
        <>
          <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
          <Text style={styles.text}>Continue to Log</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: BRIGHT_BLUE,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 0,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  text: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
