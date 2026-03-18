/**
 * Animated tournament trophy badge (1st gold, 2nd silver, 3rd bronze).
 * Matches trophy-badges.html: metallic ring, water (blue/green/purple), animated wave + fish.
 * Used on profile in Trophies grid and in "Trophies & badges" pills.
 */

import React, { useEffect, useState, useId } from 'react';
import { View, Text as RNText, StyleSheet } from 'react-native';
import Svg, {
  Defs,
  RadialGradient,
  Stop,
  ClipPath,
  Circle,
  Path,
  G,
  Text,
  Rect,
  Ellipse,
} from 'react-native-svg';

const VIEWBOX = '0 0 96 96';
const CX = 48;
const CY = 46;
const R_OUTER = 44;
const R_INNER = 35; // larger inner = more water circumference

const LEFT = CX - R_INNER;   // 13
const RIGHT = CX + R_INNER;  // 83

/** Wave path keyframes (water surface): down -> up -> down — spans full inner width */
const WAVE_DOWN = `M ${LEFT} 56 Q 23 50 33 56 Q 43 62 53 56 Q 63 50 ${RIGHT} 56 L ${RIGHT} 96 L ${LEFT} 96 Z`;
const WAVE_UP = `M ${LEFT} 56 Q 23 62 33 56 Q 43 50 53 56 Q 63 62 ${RIGHT} 56 L ${RIGHT} 96 L ${LEFT} 96 Z`;

type Place = 1 | 2 | 3 | 4 | 5;

const BADGE_THEMES: Record<
  Place,
  {
    shieldGrad: { stops: [string, string, string, string] };
    waterGrad: { stops: [string, string, string] };
    waterDeep: string;
    waveFill: string;
    waveHighlight: string;
    innerStroke: string;
    textFill: string;
    waterRect: string;
  }
> = {
  1: {
    shieldGrad: { stops: ['#FFF9C4', '#FFD700', '#FFA000', '#7A4E00'] },
    waterGrad: { stops: ['#1565C0', '#0D47A1', '#062B6A'] },
    waterDeep: '#0A3A82',
    waveFill: '#1976D2',
    waveHighlight: '#42A5F5',
    innerStroke: '#FFF9C4',
    textFill: '#FFF9C4',
    waterRect: '#0A3A82',
  },
  2: {
    shieldGrad: { stops: ['#F5F5F5', '#CFD8DC', '#90A4AE', '#37474F'] },
    waterGrad: { stops: ['#1A6B3A', '#0F4A28', '#062B18'] },
    waterDeep: '#0A3320',
    waveFill: '#1B5E34',
    waveHighlight: '#4CAF73',
    innerStroke: '#ECEFF1',
    textFill: '#F5F5F5',
    waterRect: '#0A3320',
  },
  3: {
    shieldGrad: { stops: ['#FFE0B2', '#CD7F32', '#A0522D', '#4E2A0A'] },
    waterGrad: { stops: ['#4A148C', '#311B92', '#1A0950'] },
    waterDeep: '#200B50',
    waveFill: '#512DA8',
    waveHighlight: '#9575CD',
    innerStroke: '#FFE0B2',
    textFill: '#FFE0B2',
    waterRect: '#200B50',
  },
  4: {
    shieldGrad: { stops: ['#D1C4E9', '#7B68EE', '#5B4DB8', '#2C1F6B'] },
    waterGrad: { stops: ['#1A237E', '#0D1450', '#060930'] },
    waterDeep: '#0A0E40',
    waveFill: '#3949AB',
    waveHighlight: '#7986CB',
    innerStroke: '#E8E0F0',
    textFill: '#E8E0F0',
    waterRect: '#0A0E40',
  },
  5: {
    shieldGrad: { stops: ['#D7CCC8', '#8B7355', '#6B5344', '#3E3229'] },
    waterGrad: { stops: ['#3E2723', '#2C1E1A', '#1A110E'] },
    waterDeep: '#1A110E',
    waveFill: '#5D4037',
    waveHighlight: '#8D6E63',
    innerStroke: '#EFEBE9',
    textFill: '#EFEBE9',
    waterRect: '#1A110E',
  },
};

interface AnimatedTrophyBadgeProps {
  place: Place;
  size?: number;
  /** Show "GOLD" / "SILVER" / "BRONZE" label below (for large display) */
  showLabel?: boolean;
}

export function AnimatedTrophyBadge({ place, size = 56, showLabel = false }: AnimatedTrophyBadgeProps) {
  const uid = useId().replace(/:/g, '');
  const [wavePhase, setWavePhase] = useState(0);
  const [fishPhase, setFishPhase] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setWavePhase((p) => (p + 1) % 2), 400);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const t = setInterval(() => setFishPhase((p) => (p + 1) % 4), 350);
    return () => clearInterval(t);
  }, []);

  const theme = BADGE_THEMES[place];
  const placeLabel = place === 1 ? '1ST' : place === 2 ? '2ND' : place === 3 ? '3RD' : place === 4 ? '4TH' : '5TH';
  const metalLabel = place === 1 ? 'GOLD' : place === 2 ? 'SILVER' : place === 3 ? 'BRONZE' : place === 4 ? '4TH' : '5TH';

  const waveD = wavePhase === 0 ? WAVE_DOWN : WAVE_UP;
  const fishTx = fishPhase === 0 ? 0 : fishPhase === 1 ? 2 : fishPhase === 2 ? 0 : -2;
  const fishTy = fishPhase === 0 ? 0 : fishPhase === 1 ? 1 : fishPhase === 2 ? 0 : -1;

  const idShield = `shield-${place}-${uid}`;
  const idWater = `water-${place}-${uid}`;
  const idClip = `clip-${place}-${uid}`;

  return (
    <View style={{ width: size, alignItems: 'center' }}>
      <Svg width={size} height={size} viewBox={VIEWBOX}>
        <Defs>
          <RadialGradient id={idShield} cx="40%" cy="35%" r="65%">
            {theme.shieldGrad.stops.map((c, i) => (
              <Stop key={i} offset={`${i * 33}%`} stopColor={c} />
            ))}
          </RadialGradient>
          <RadialGradient id={idWater} cx="50%" cy="40%" r="60%">
            {theme.waterGrad.stops.map((c, i) => (
              <Stop key={i} offset={i === 0 ? '0%' : i === 1 ? '60%' : '100%'} stopColor={c} />
            ))}
          </RadialGradient>
          <ClipPath id={idClip}>
            <Circle cx={CX} cy={CY} r={R_INNER} />
          </ClipPath>
        </Defs>

        {/* Outer metallic ring */}
        <Circle cx={CX} cy={CY} r={R_OUTER} fill={`url(#${idShield})`} />
        <Circle cx={CX} cy={CY} r={R_OUTER} fill="none" stroke={theme.shieldGrad.stops[0]} strokeWidth={1.5} strokeOpacity={0.5} />
        <Circle cx={CX} cy={CY} r={R_INNER + 2} fill="none" stroke={theme.shieldGrad.stops[3]} strokeWidth={1} strokeOpacity={0.4} />

        {/* Inner water circle */}
        <Circle cx={CX} cy={CY} r={R_INNER} fill={`url(#${idWater})`} />

        {/* Clipped: water body + wave + fish — larger water area */}
        <G clipPath={`url(#${idClip})`}>
          <Rect x={LEFT} y={52} width={R_INNER * 2} height={44} fill={theme.waterRect} />
          <Path fill={theme.waveFill} fillOpacity={0.85} d={waveD} />
          <Path
            fill={theme.waveHighlight}
            fillOpacity={wavePhase === 0 ? 0.35 : 0.45}
            d={wavePhase === 0 ? `M ${LEFT} 56 Q 26 51 38 56 Q 50 61 62 56 Q 74 51 ${RIGHT} 56 L ${RIGHT} 59 Q 62 64 50 59 Q 38 54 ${LEFT} 59 Z` : `M ${LEFT} 56 Q 26 61 38 56 Q 50 51 62 56 Q 74 61 ${RIGHT} 56 L ${RIGHT} 59 Q 62 54 50 59 Q 38 64 ${LEFT} 59 Z`}
          />

          {/* Fish — larger, more prominent (per place: 1 bass, 2 trout, 3 catfish) */}
          <G transform={`translate(${fishTx}, ${fishTy})`}>
            {place === 1 && (
              <>
                <Ellipse cx={CX} cy={61} rx={13} ry={7} fill="#E8F5E9" fillOpacity={0.92} />
                <Path d="M 60 61 L 69 54.5 L 69 67.5 Z" fill="#C8E6C9" fillOpacity={0.9} />
                <Path d="M 44 56 Q 48 50 53 56" fill="#A5D6A7" fillOpacity={0.8} />
                <Path d="M 45 62 Q 42 66 39 63" fill="none" stroke="#A5D6A7" strokeWidth={1.2} strokeOpacity={0.7} />
                <Circle cx={40} cy={60} r={2} fill="#1A1A1A" />
                <Circle cx={39.2} cy={59.2} r={0.7} fill="rgba(255,255,255,0.7)" />
                <Path d="M 46 57.5 Q 48 61 46 64.5" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
                <Path d="M 50 57 Q 52 61 50 65" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
              </>
            )}
            {place === 2 && (
              <>
                <Ellipse cx={CX} cy={61} rx={13} ry={6.5} fill="#FFCC80" fillOpacity={0.9} />
                <Circle cx={43} cy={59.5} r={1.3} fill="#BF360C" fillOpacity={0.6} />
                <Circle cx={46} cy={57.5} r={1.1} fill="#BF360C" fillOpacity={0.5} />
                <Circle cx={51} cy={60} r={1.2} fill="#BF360C" fillOpacity={0.6} />
                <Path d="M 60 61 L 69 55 L 69 67 Z" fill="#FFB74D" fillOpacity={0.9} />
                <Path d="M 42 56.5 Q 46 51 51 56.5" fill="#FFA726" fillOpacity={0.7} />
                <Circle cx={40} cy={60.5} r={2} fill="#1A1A1A" />
                <Circle cx={39.2} cy={59.7} r={0.7} fill="rgba(255,255,255,0.7)" />
                <Path d="M 46 57 Q 48 61 46 65" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
              </>
            )}
            {place === 3 && (
              <>
                <Ellipse cx={CX} cy={62} rx={14} ry={6.5} fill="#BCAAA4" fillOpacity={0.9} />
                <Path d="M 37 62 Q 31 58 29 55" fill="none" stroke="#795548" strokeWidth={1.2} strokeLinecap="round" />
                <Path d="M 37 63 Q 31 66 29 69" fill="none" stroke="#795548" strokeWidth={1.2} strokeLinecap="round" />
                <Path d="M 60 62 L 68 56 L 69 62 L 68 68 Z" fill="#A1887F" fillOpacity={0.9} />
                <Path d="M 43 57 L 45 52 L 50 57" fill="#90A4AE" fillOpacity={0.7} />
                <Circle cx={38} cy={61} r={2.2} fill="#1A1A1A" />
                <Circle cx={37.2} cy={60.2} r={0.75} fill="rgba(255,255,255,0.7)" />
                <Ellipse cx={48} cy={64} rx={10} ry={3} fill="#D7CCC8" fillOpacity={0.4} />
              </>
            )}
            {(place === 4 || place === 5) && (
              <>
                <Ellipse cx={CX} cy={61} rx={13} ry={6} fill="#E8EAF6" fillOpacity={0.9} />
                <Path d="M 60 61 L 69 55 L 69 67 Z" fill="#C5CAE9" fillOpacity={0.9} />
                <Path d="M 44 56 Q 48 51 52 56" fill="#9FA8DA" fillOpacity={0.8} />
                <Circle cx={40} cy={60} r={2} fill="#1A1A1A" />
                <Circle cx={39.2} cy={59.2} r={0.7} fill="rgba(255,255,255,0.7)" />
              </>
            )}
          </G>
        </G>

        {/* Inner circle border */}
        <Circle cx={CX} cy={CY} r={R_INNER} fill="none" stroke={theme.innerStroke} strokeWidth={1.2} strokeOpacity={0.6} />

        {/* Rank text */}
        <Text x={CX} y={32} textAnchor="middle" fontFamily="BebasNeue_400Regular" fontSize={size > 40 ? 18 : 14} fill={theme.textFill} opacity={0.95}>
          {placeLabel}
        </Text>

        {/* Base (optional, for large badge) */}
        {size >= 48 && (
          <>
            <Rect x={38} y={88} width={20} height={5} rx={2.5} fill={`url(#${idShield})`} opacity={0.9} />
            <Rect x={41} y={86} width={14} height={4} rx={2} fill={`url(#${idShield})`} />
          </>
        )}

        {/* Shine */}
        <Ellipse cx={36} cy={32} rx={7} ry={4} fill="white" opacity={0.12} transform="rotate(-25 36 32)" />
      </Svg>
      {showLabel && size >= 60 && (
        <RNText style={[styles.metalLabel, { color: theme.shieldGrad.stops[1] }]}>{metalLabel}</RNText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  metalLabel: {
    fontFamily: 'BebasNeue_400Regular',
    fontSize: 11,
    letterSpacing: 2,
    marginTop: 4,
    textTransform: 'uppercase',
  },
});
