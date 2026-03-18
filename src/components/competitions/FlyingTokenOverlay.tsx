/**
 * Full-screen overlay: Trophy tokens fly from source position to target (e.g. profile tab) when user wins.
 * Uses React Native Animated (no reanimated). Call onComplete when done.
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type Position = { x: number; y: number; width: number; height: number };

interface FlyingTokenOverlayProps {
  xpFrom: Position;
  to: Position;
  xpCount?: number;
  onComplete: () => void;
}

const XP_SIZE = 24;

function FlyingXP({ from, to, index, onDone }: { from: Position; to: Position; index: number; onDone: () => void }) {
  const fromCenterX = from.x + from.width / 2;
  const fromCenterY = from.y + from.height / 2;
  const toCenterX = to.x + to.width / 2;
  const toCenterY = to.y + to.height / 2;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 520 + index * 50 + Math.random() * 80,
      useNativeDriver: true,
      delay: 150,
      easing: Easing.out(Easing.quad),
    }).start(() => onDone());
  }, []);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, toCenterX - fromCenterX],
  });
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, toCenterY - fromCenterY],
  });
  const scale = progress.interpolate({
    inputRange: [0, 0.15, 0.8, 1],
    outputRange: [0.3, 1, 1, 0.2],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [1, 1, 0],
  });

  return (
    <Animated.View
      style={[
        styles.xpToken,
        {
          left: fromCenterX - XP_SIZE / 2,
          top: fromCenterY - 10,
          transform: [{ translateX }, { translateY }, { scale }],
          opacity,
        },
      ]}
    >
      <Ionicons name="trophy" size={14} color="#000" />
    </Animated.View>
  );
}

export function FlyingTokenOverlay({
  xpFrom,
  to,
  xpCount = 5,
  onComplete,
}: FlyingTokenOverlayProps) {
  const doneCount = useRef(0);
  const checkDone = () => {
    doneCount.current++;
    if (doneCount.current >= xpCount) setTimeout(onComplete, 120);
  };

  return (
    <View style={styles.overlay} pointerEvents="none">
      {Array.from({ length: xpCount }, (_, i) => (
        <FlyingXP key={`x-${i}`} from={xpFrom} to={to} index={i} onDone={checkDone} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
    elevation: 99999,
  },
  xpToken: {
    position: 'absolute',
    width: XP_SIZE,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#00e5c8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00e5c8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 6,
    elevation: 8,
  },
});
