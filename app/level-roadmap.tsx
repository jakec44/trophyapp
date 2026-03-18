/**
 * Level Roadmap screen: horizontal dotted path with circles for each level.
 * Teal = achieved/current, gray = future. Prestige shown when applicable.
 * Opens when user taps their level on profile.
 */

import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ParticleBackground } from '@/src/components/ui/ParticleBackground';
import { PrestigeModal } from '@/src/components/profile/PrestigeModal';
import { LEVEL_ROADMAP, MAX_LEVEL, MAX_PRESTIGE } from '@/src/types/gamification';
import { colors } from '@/utils/colors';
import { useAuthContext } from '@/src/context/AuthContext';
import { useGamificationContext } from '@/src/context/GamificationContext';
import { prestigeNow } from '@/src/lib/supabase';

const TEAL = colors.teal;
const GOLD = colors.gold;
const GRAY = 'rgba(122,175,201,0.35)';
const GRAY_DARK = colors.textFaint;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DOT_SIZE = 44;
const CONNECTOR_WIDTH = 20;

function DottedConnector({ achieved }: { achieved: boolean }) {
  const color = achieved ? TEAL : GRAY;
  return (
    <View style={styles.connector}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.connectorDot, { backgroundColor: color }]} />
      ))}
    </View>
  );
}

export default function LevelRoadmapScreen() {
  const router = useRouter();
  const { user, refreshProfile } = useAuthContext();
  const gamification = useGamificationContext();
  const [prestigeModalVisible, setPrestigeModalVisible] = useState(false);
  const params = useLocalSearchParams<{
    level?: string;
    prestige?: string;
    xpInLevel?: string;
    xpForNext?: string;
  }>();
  const currentLevel = Math.min(MAX_LEVEL, Math.max(1, parseInt(params.level ?? '1', 10) || 1));
  const prestige = Math.min(MAX_PRESTIGE, Math.max(0, parseInt(params.prestige ?? '0', 10) || 0));
  const xpInLevel = parseInt(params.xpInLevel ?? '0', 10) || 0;
  const xpForNext = parseInt(params.xpForNext ?? '0', 10) || 0;
  const xpUntilNext = Math.max(0, xpForNext - xpInLevel);
  const isPrestigeEligible = currentLevel >= MAX_LEVEL && prestige < MAX_PRESTIGE;
  const currentTitle = LEVEL_ROADMAP[currentLevel - 1]?.title ?? '';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ParticleBackground />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={28} color={colors.lightText} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Level Roadmap</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        horizontal={false}
      >
        {/* Prestige badge when applicable */}
        {prestige > 0 && (
          <View style={styles.prestigeBanner}>
            <Text style={styles.prestigeIcon}>✨</Text>
            <Text style={styles.prestigeText}>Prestige {prestige}</Text>
          </View>
        )}

        {/* Current progress summary */}
        <View style={styles.progressCard}>
          <Text style={styles.progressTitle}>Level {currentLevel}</Text>
          <Text style={styles.progressSubtitle}>{currentTitle}</Text>
          {xpForNext > 0 ? (
            <Text style={styles.progressXp}>{xpUntilNext} XP until next level</Text>
          ) : (
            <Text style={styles.progressXp}>Max level reached</Text>
          )}
        </View>

        {/* Horizontal roadmap */}
        <View style={styles.roadmapWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.roadmapScroll}
          >
            {LEVEL_ROADMAP.map((item, index) => {
              const isAchieved = item.level <= currentLevel;
              const isCurrent = item.level === currentLevel;
              const prevAchieved = index > 0 && LEVEL_ROADMAP[index - 1].level <= currentLevel;

              return (
                <View key={item.level} style={styles.roadmapSegment}>
                  {index > 0 && <DottedConnector achieved={prevAchieved} />}
                  <View style={styles.badgeColumn}>
                    {isCurrent && (
                      <View style={styles.youMarker}>
                        <Text style={styles.youMarkerText}>You</Text>
                      </View>
                    )}
                    <View
                      style={[
                        styles.badgeCircle,
                        isAchieved && styles.badgeCircleAchieved,
                        isCurrent && styles.badgeCircleCurrent,
                      ]}
                    >
                      <Text style={styles.badgeIcon}>{item.icon}</Text>
                    </View>
                    <Text
                      style={[
                        styles.badgeLevelNum,
                        isAchieved ? styles.badgeLevelNumAchieved : styles.badgeLevelNumLocked,
                      ]}
                    >
                      {item.level}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>

        {/* Level labels - compact list */}
        <View style={styles.labelsSection}>
          <Text style={styles.labelsTitle}>Your journey</Text>
          {LEVEL_ROADMAP.map((item) => {
            const isAchieved = item.level <= currentLevel;
            const isCurrent = item.level === currentLevel;
            return (
              <View
                key={item.level}
                style={[
                  styles.labelRow,
                  isCurrent && styles.labelRowCurrent,
                ]}
              >
                <View
                  style={[
                    styles.labelDot,
                    isAchieved ? styles.labelDotAchieved : styles.labelDotLocked,
                    isCurrent && styles.labelDotCurrent,
                  ]}
                />
                <Text
                  style={[
                    styles.labelText,
                    isAchieved ? styles.labelTextAchieved : styles.labelTextLocked,
                    isCurrent && styles.labelTextCurrent,
                  ]}
                >
                  Lv {item.level} — {item.title}
                </Text>
                {isCurrent && <Text style={styles.labelYou}> ← You are here</Text>}
              </View>
            );
          })}
        </View>

        {/* Prestige CTA when eligible */}
        {isPrestigeEligible && (
          <TouchableOpacity
            style={styles.prestigeCta}
            onPress={() => setPrestigeModalVisible(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.prestigeCtaIcon}>⚡</Text>
            <Text style={styles.prestigeCtaTitle}>Ready to Prestige?</Text>
            <Text style={styles.prestigeCtaSub}>
              Reset to Level 1 and earn Prestige {prestige + 1}. Your badges & catches stay.
            </Text>
            <Text style={styles.prestigeCtaBtn}>Prestige Now</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <PrestigeModal
        visible={prestigeModalVisible}
        onClose={() => setPrestigeModalVisible(false)}
        currentPrestige={prestige}
        onPrestige={async () => {
          const result = await prestigeNow();
          if (result.status === 'success') {
            await gamification.refreshXpFromServer?.();
            refreshProfile();
            router.back();
            return true;
          }
          return false;
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.lightBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightBorder,
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: colors.lightText,
    textAlign: 'center',
  },
  headerRight: { width: 44 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  prestigeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,200,69,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,200,69,0.3)',
  },
  prestigeIcon: { fontSize: 18 },
  prestigeText: {
    fontSize: 15,
    fontWeight: '800',
    color: GOLD,
  },
  progressCard: {
    backgroundColor: colors.lightCard,
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,229,200,0.2)',
  },
  progressTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: TEAL,
  },
  progressSubtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.lightText,
    marginTop: 4,
  },
  progressXp: {
    fontSize: 14,
    color: colors.lightSubtext,
    marginTop: 8,
    fontWeight: '700',
  },
  roadmapWrap: {
    marginTop: 28,
    marginHorizontal: -16,
  },
  roadmapScroll: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: SCREEN_WIDTH,
  },
  roadmapSegment: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeColumn: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  badgeCircle: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: GRAY,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  badgeCircleAchieved: {
    backgroundColor: TEAL,
    borderColor: 'rgba(0,229,200,0.4)',
  },
  badgeCircleCurrent: {
    backgroundColor: TEAL,
    borderColor: GOLD,
    borderWidth: 3,
  },
  badgeIcon: {
    fontSize: 24,
  },
  badgeLevelNum: {
    fontSize: 12,
    fontWeight: '900',
    marginTop: 4,
  },
  badgeLevelNumLocked: {
    color: GRAY_DARK,
  },
  badgeLevelNumAchieved: {
    color: colors.lightText,
  },
  connector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: CONNECTOR_WIDTH,
    gap: 3,
  },
  connectorDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  youMarker: {
    backgroundColor: TEAL,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 4,
  },
  youMarkerText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.abyss,
  },
  youMarkerText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.abyss,
  },
  labelsSection: {
    marginTop: 48,
  },
  labelsTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.lightSubtext,
    letterSpacing: 1,
    marginBottom: 12,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  labelRowCurrent: {
    backgroundColor: 'rgba(0,229,200,0.08)',
    marginHorizontal: -12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 10,
  },
  labelDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  labelDotLocked: {
    backgroundColor: GRAY,
  },
  labelDotAchieved: {
    backgroundColor: TEAL,
  },
  labelDotCurrent: {
    backgroundColor: TEAL,
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  labelText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  labelTextLocked: {
    color: colors.lightSubtext,
    opacity: 0.8,
  },
  labelTextAchieved: {
    color: GOLD,
  },
  labelTextCurrent: {
    color: GOLD,
    fontWeight: '800',
  },
  labelYou: {
    fontSize: 12,
    fontWeight: '700',
    color: TEAL,
  },
  prestigeCta: {
    marginTop: 28,
    backgroundColor: 'rgba(255,200,69,0.12)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,200,69,0.35)',
    alignItems: 'center',
  },
  prestigeCtaIcon: { fontSize: 32, marginBottom: 8 },
  prestigeCtaTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: GOLD,
  },
  prestigeCtaSub: {
    fontSize: 13,
    color: colors.lightText,
    marginTop: 6,
    textAlign: 'center',
  },
  prestigeCtaBtn: {
    fontSize: 13,
    fontWeight: '700',
    color: TEAL,
    marginTop: 12,
  },
});
