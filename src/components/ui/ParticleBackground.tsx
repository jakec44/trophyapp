import { useRef, useEffect } from 'react';
import { View, StyleSheet, Animated, Easing, Dimensions } from 'react-native';

const PARTICLE_COLORS = ['#00ffc8', '#00cfff', '#0084ff', '#a855f7', '#ffffff'];
const COLOR_WEIGHTS = [0.35, 0.30, 0.20, 0.10, 0.05];
const PARTICLE_COUNT = 28;

function pickColor(): string {
  const r = Math.random();
  let cum = 0;
  for (let i = 0; i < COLOR_WEIGHTS.length; i++) {
    cum += COLOR_WEIGHTS[i];
    if (r < cum) return PARTICLE_COLORS[i];
  }
  return PARTICLE_COLORS[0];
}

type ParticleDef = {
  id: number;
  x: number;
  size: number;
  duration: number;
  /** 0–1: how far through its journey the particle already is on mount */
  startProgress: number;
  color: string;
  ty: Animated.Value;
  op: Animated.Value;
};

/**
 * Full-screen animated particle layer — deep underwater / bioluminescent feel.
 * Particles are pre-spread across the full screen height on mount so they
 * appear immediately rather than all rising from the bottom at once.
 * Place as the first child of any absolute-positioned root container.
 * `pointerEvents="none"` so it never blocks touches.
 */
export function ParticleBackground() {
  const { height: SCREEN_H } = Dimensions.get('window');
  const TRAVEL = SCREEN_H + 30;

  const particles = useRef<ParticleDef[]>([]);
  if (particles.current.length === 0) {
    particles.current = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      size: Math.random() < 0.2 ? 3 : Math.random() < 0.5 ? 2 : 1.5,
      duration: 12000 + Math.random() * 18000,
      startProgress: Math.random(), // random position in their cycle on mount
      color: pickColor(),
      ty: new Animated.Value(0),
      op: new Animated.Value(0),
    }));
  }

  useEffect(() => {
    particles.current.forEach((p) => {
      /**
       * Run one animation cycle.
       * @param prog  0 = start from bottom; 0–1 = start partway through journey
       */
      const run = (prog: number) => {
        const startY = -TRAVEL * prog;
        const remainingFraction = 1 - prog;
        const dur = p.duration * remainingFraction;

        p.ty.setValue(startY);

        // Initial opacity: already visible if mid-journey, fading if near top
        if (prog === 0) {
          p.op.setValue(0);
        } else if (prog < 0.08) {
          p.op.setValue(prog / 0.08 * 0.9);
        } else if (prog < 0.84) {
          p.op.setValue(0.7);
        } else {
          p.op.setValue(((1 - prog) / 0.16) * 0.55);
        }

        // Scale the opacity keyframes to only cover remaining journey
        const fadeInShare  = Math.max(0, Math.min(1, (0.08 - prog) / remainingFraction));
        const fadeOutStart = Math.max(0, (0.84 - prog) / remainingFraction);
        const midShare     = Math.max(0, fadeOutStart - fadeInShare);
        const fadeOutShare = Math.max(0, 1 - fadeOutStart);

        const opSeq: Animated.CompositeAnimation[] = [];
        if (fadeInShare > 0)  opSeq.push(Animated.timing(p.op, { toValue: 0.9,  duration: dur * fadeInShare,  useNativeDriver: true }));
        if (midShare > 0)     opSeq.push(Animated.timing(p.op, { toValue: 0.55, duration: dur * midShare,     useNativeDriver: true }));
        if (fadeOutShare > 0) opSeq.push(Animated.timing(p.op, { toValue: 0,    duration: dur * fadeOutShare, useNativeDriver: true }));

        Animated.parallel([
          Animated.timing(p.ty, {
            toValue: -TRAVEL,
            duration: dur,
            useNativeDriver: true,
            easing: Easing.linear,
          }),
          opSeq.length > 0 ? Animated.sequence(opSeq) : Animated.timing(p.op, { toValue: 0, duration: dur, useNativeDriver: true }),
        ]).start(({ finished }) => {
          if (finished) run(0); // loop from bottom
        });
      };

      run(p.startProgress);
    });

    return () => {
      particles.current.forEach((p) => {
        p.ty.stopAnimation();
        p.op.stopAnimation();
      });
    };
  }, [SCREEN_H, TRAVEL]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.current.map((p) => (
        <Animated.View
          key={p.id}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: `${p.x}%` as unknown as number,
            bottom: 0,
            width: p.size,
            height: p.size,
            borderRadius: p.size / 2,
            backgroundColor: p.color,
            opacity: p.op,
            transform: [{ translateY: p.ty }],
            shadowColor: p.color,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.8,
            shadowRadius: p.size * 2,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({});
