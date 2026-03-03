/**
 * Coin Shop
 * Full-featured animated shop where users spend tournament coins.
 * Categories: All · Boosts · Rings · Style · Limited
 * Features:
 *   - Spinning/glowing gold coin in header
 *   - XP Multiplier boost cards (24h / 48h)
 *   - Profile Rings 3×3 grid with gradient previews
 *   - Mythic Shift hue-rotation animation
 *   - Tournament utility items 2×3 grid
 *   - Bottom-sheet purchase confirm with spring animation
 *   - "Not enough coins" toast
 *   - Live balance update on purchase
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Modal,
  Platform,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { SnaggedWordmark } from '@/src/components/ui/SnaggedWordmark';
import { useGamificationContext } from '@/src/context/GamificationContext';
import { colors } from '@/utils/colors';

const { width: SW, height: SH } = Dimensions.get('window');
const GOLD = '#ffc845';
const GOLD_DIM = '#c8922a';
const SHEET_MAX = SH * 0.52;

// ─────────────────────────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────────────────────────

type Category = 'all' | 'boosts' | 'rings' | 'style' | 'limited';

const CATEGORIES: { id: Category; label: string; icon: string }[] = [
  { id: 'all',     label: 'All',     icon: '✦' },
  { id: 'boosts',  label: 'Boosts',  icon: '⚡' },
  { id: 'rings',   label: 'Rings',   icon: '💍' },
  { id: 'style',   label: 'Style',   icon: '✨' },
  { id: 'limited', label: 'Limited', icon: '⏰' },
];

interface ShopItem {
  id: string;
  name: string;
  description: string;
  cost: number;
  category: Category;
  tag?: string;
  duration?: string;
  icon: string;
  type: 'boost' | 'ring' | 'style' | 'tournament';
  gradient?: string[];
  mythic?: boolean;
}

const SHOP_ITEMS: ShopItem[] = [
  // Boosts
  {
    id: 'xp2x_24',
    name: 'XP Multiplier ×2',
    description: 'Double all XP earned from catches, tournaments and logbook for 24 hours.',
    cost: 200,
    category: 'boosts',
    tag: 'BEST SELLER',
    duration: '24 HOURS',
    icon: '⚡',
    type: 'boost',
    gradient: ['#ff6b35', '#ff3d00'],
  },
  {
    id: 'xp2x_48',
    name: 'XP Multiplier ×2',
    description: '48 hours of double XP. Best value for a full weekend fishing trip.',
    cost: 350,
    category: 'boosts',
    tag: 'BEST VALUE',
    duration: '48 HOURS',
    icon: '⚡',
    type: 'boost',
    gradient: ['#ff6b35', '#ff3d00'],
  },
  // Rings
  {
    id: 'ring_ocean',
    name: 'Ocean Teal',
    description: 'Classic teal ring for your profile avatar.',
    cost: 80,
    category: 'rings',
    tag: 'COMMON',
    icon: '🔵',
    type: 'ring',
    gradient: ['#00e5c8', '#00cfff'],
  },
  {
    id: 'ring_silver',
    name: 'Silver',
    description: 'Sleek silver ring.',
    cost: 80,
    category: 'rings',
    tag: 'COMMON',
    icon: '⚪',
    type: 'ring',
    gradient: ['#a8c4d4', '#d0dce8'],
  },
  {
    id: 'ring_shadow',
    name: 'Shadow',
    description: 'Dark shadow ring for stealth profiles.',
    cost: 80,
    category: 'rings',
    tag: 'COMMON',
    icon: '⚫',
    type: 'ring',
    gradient: ['#2a3a4a', '#1a2530'],
  },
  {
    id: 'ring_gold',
    name: 'Gold',
    description: 'Shiny gold ring reserved for top anglers.',
    cost: 150,
    category: 'rings',
    tag: 'RARE',
    icon: '🟡',
    type: 'ring',
    gradient: ['#ffc845', '#c8922a'],
  },
  {
    id: 'ring_fire',
    name: 'Fire',
    description: 'Blazing red-orange ring for fierce competitors.',
    cost: 150,
    category: 'rings',
    tag: 'RARE',
    icon: '🔴',
    type: 'ring',
    gradient: ['#ff4d6d', '#ff6b35'],
  },
  {
    id: 'ring_electric',
    name: 'Electric',
    description: 'Neon electric blue ring.',
    cost: 150,
    category: 'rings',
    tag: 'RARE',
    icon: '🔷',
    type: 'ring',
    gradient: ['#0084ff', '#00cfff'],
  },
  {
    id: 'ring_mythic',
    name: 'Mythic Shift',
    description: 'Animated rainbow ring that shifts through all colors.',
    cost: 500,
    category: 'rings',
    tag: 'MYTHIC',
    icon: '🌈',
    type: 'ring',
    mythic: true,
    gradient: ['#ff4d6d', '#ffc845', '#00e5c8', '#0084ff', '#ff4d6d'],
  },
  // Style
  {
    id: 'badge_pro',
    name: 'Pro Angler Badge',
    description: 'Show off a ✅ Pro badge next to your name.',
    cost: 300,
    category: 'style',
    tag: 'EXCLUSIVE',
    icon: '✅',
    type: 'style',
    gradient: ['#00e5c8', '#0084ff'],
  },
  {
    id: 'badge_legend',
    name: 'Legend Crest',
    description: 'Rare animated crest visible on leaderboards.',
    cost: 600,
    category: 'style',
    tag: 'LEGENDARY',
    icon: '🏆',
    type: 'style',
    gradient: ['#ffc845', '#ff6b35'],
  },
  // Tournament
  {
    id: 'vote_shield',
    name: 'Vote Shield',
    description: 'Block negative votes on your entry for 48 hours.',
    cost: 100,
    category: 'limited',
    tag: 'UTILITY',
    icon: '🛡️',
    type: 'tournament',
    gradient: ['#0084ff', '#0c2c45'],
  },
  {
    id: 'reentry',
    name: 'Re-Entry Token',
    description: 'Re-submit a catch to any active tournament once.',
    cost: 120,
    category: 'limited',
    tag: 'UTILITY',
    icon: '🎟️',
    type: 'tournament',
    gradient: ['#9c27b0', '#4a148c'],
  },
  {
    id: 'spotlight',
    name: 'Feed Spotlight',
    description: 'Pin your catch to the top of the feed for 24 hours.',
    cost: 150,
    category: 'limited',
    tag: 'UTILITY',
    icon: '📌',
    type: 'tournament',
    gradient: ['#ff6b35', '#ff3d00'],
  },
  {
    id: 'species_hint',
    name: 'Species Hint',
    description: 'Unlock AI species ID hints for your next 10 catches.',
    cost: 80,
    category: 'limited',
    tag: 'UTILITY',
    icon: '🔍',
    type: 'tournament',
    gradient: ['#00e5c8', '#00cfff'],
  },
  {
    id: 'pin_catch',
    name: 'Pin Catch',
    description: 'Permanently pin your biggest catch to your profile.',
    cost: 200,
    category: 'limited',
    tag: 'RARE',
    icon: '📍',
    type: 'tournament',
    gradient: ['#ffc845', '#c8922a'],
  },
  {
    id: 'trophy_react',
    name: 'Trophy Reaction',
    description: 'Send an animated 🏆 trophy reaction to any catch.',
    cost: 50,
    category: 'limited',
    tag: 'FUN',
    icon: '🏆',
    type: 'tournament',
    gradient: ['#ffc845', '#ff6b35'],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Spinning coin
// ─────────────────────────────────────────────────────────────────────────────
function SpinningCoin({ size = 28 }: { size?: number }) {
  const spin = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 2400, useNativeDriver: true })
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  return (
    <Animated.View style={{ opacity: glowOpacity }}>
      <Animated.Text style={{ fontSize: size, transform: [{ rotateY: rotate }] }}>
        💰
      </Animated.Text>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mythic ring animated border
// ─────────────────────────────────────────────────────────────────────────────
function MythicRing({ size }: { size: number }) {
  const hue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(hue, { toValue: 1, duration: 3000, useNativeDriver: false })
    ).start();
  }, []);

  const colors2 = ['#ff4d6d', '#ffc845', '#00e5c8', '#0084ff', '#a855f7', '#ff4d6d'];

  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
      <LinearGradient
        colors={colors2 as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tag colours
// ─────────────────────────────────────────────────────────────────────────────
function tagColor(tag?: string): string {
  if (!tag) return colors.textFaint;
  if (tag === 'MYTHIC') return '#a855f7';
  if (tag === 'LEGENDARY') return '#ffc845';
  if (tag === 'RARE') return '#00cfff';
  if (tag === 'EXCLUSIVE') return '#00e5c8';
  if (tag === 'BEST SELLER' || tag === 'BEST VALUE') return '#00e5c8';
  return colors.textDim;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────
export default function CoinShopScreen() {
  const router = useRouter();
  const { coins, addCoins } = useGamificationContext();

  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const [equippedRingId, setEquippedRingId] = useState<string>('ring_ocean');
  const [ownedItems, setOwnedItems] = useState<Set<string>>(new Set(['ring_ocean']));
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);

  // Bottom sheet animation
  const sheetY = useRef(new Animated.Value(SHEET_MAX)).current;
  const sheetOpacity = useRef(new Animated.Value(0)).current;
  const [sheetVisible, setSheetVisible] = useState(false);

  // Toast
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const [toastMsg, setToastMsg] = useState('');

  const openSheet = useCallback((item: ShopItem) => {
    setSelectedItem(item);
    setSheetVisible(true);
    Animated.parallel([
      Animated.spring(sheetY, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 200 }),
      Animated.timing(sheetOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  const closeSheet = useCallback(() => {
    Animated.parallel([
      Animated.timing(sheetY, { toValue: SHEET_MAX, duration: 260, useNativeDriver: true }),
      Animated.timing(sheetOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setSheetVisible(false);
      setSelectedItem(null);
    });
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    toastOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1800),
      Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  const handlePurchase = useCallback(() => {
    if (!selectedItem) return;
    if (coins < selectedItem.cost) {
      closeSheet();
      setTimeout(() => showToast('Not enough coins! 😬'), 320);
      return;
    }
    addCoins(-selectedItem.cost);
    setOwnedItems((prev) => new Set([...prev, selectedItem.id]));
    if (selectedItem.type === 'ring') {
      setEquippedRingId(selectedItem.id);
    }
    closeSheet();
    setTimeout(() => showToast(`${selectedItem.name} purchased! 🎉`), 320);
  }, [selectedItem, coins, addCoins, closeSheet, showToast]);

  const filtered = activeCategory === 'all'
    ? SHOP_ITEMS
    : SHOP_ITEMS.filter((i) => i.category === activeCategory);

  const boosts = filtered.filter((i) => i.type === 'boost');
  const rings  = filtered.filter((i) => i.type === 'ring');
  const styleItems = filtered.filter((i) => i.type === 'style');
  const tournamentItems = filtered.filter((i) => i.type === 'tournament');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.backBtn}>
          <SnaggedWordmark />
        </View>
        <LinearGradient
          colors={['#ffc845', '#ff8c00']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.titleGrad}
        >
          <Text style={styles.titleIcon}>⚓</Text>
          <View>
            <Text style={styles.titleTop}>COIN</Text>
            <Text style={styles.titleBottom}>SHOP</Text>
          </View>
        </LinearGradient>
        <TouchableOpacity
          style={styles.balancePill}
          onPress={() => {}}
          activeOpacity={0.85}
        >
          <SpinningCoin size={20} />
          <Text style={styles.balanceAmt}>{coins.toLocaleString()}</Text>
          <Text style={styles.balanceLbl}> COINS</Text>
        </TouchableOpacity>
      </View>

      {/* ── Category tabs ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsRow}
        style={styles.tabsScroll}
      >
        {CATEGORIES.map((cat) => {
          const active = activeCategory === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.tabPill, active && styles.tabPillActive]}
              onPress={() => setActiveCategory(cat.id)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabIcon]}>{cat.icon}</Text>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Content ── */}
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Featured Boosts */}
        {boosts.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="FEATURED BOOSTS" />
            {boosts.map((item) => (
              <BoostCard
                key={item.id}
                item={item}
                owned={ownedItems.has(item.id)}
                onPress={() => openSheet(item)}
              />
            ))}
          </View>
        )}

        {/* Profile Rings */}
        {rings.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="PROFILE RINGS" />
            <View style={styles.ringGrid}>
              {rings.map((item) => (
                <RingCard
                  key={item.id}
                  item={item}
                  owned={ownedItems.has(item.id)}
                  equipped={equippedRingId === item.id}
                  onPress={() => openSheet(item)}
                />
              ))}
            </View>
          </View>
        )}

        {/* Style Items */}
        {styleItems.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="STYLE" />
            <View style={styles.tournamentGrid}>
              {styleItems.map((item) => (
                <TournamentCard
                  key={item.id}
                  item={item}
                  owned={ownedItems.has(item.id)}
                  onPress={() => openSheet(item)}
                />
              ))}
            </View>
          </View>
        )}

        {/* Tournament Items */}
        {tournamentItems.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="TOURNAMENT ITEMS" />
            <View style={styles.tournamentGrid}>
              {tournamentItems.map((item) => (
                <TournamentCard
                  key={item.id}
                  item={item}
                  owned={ownedItems.has(item.id)}
                  onPress={() => openSheet(item)}
                />
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── Purchase confirm sheet ── */}
      <Modal visible={sheetVisible} transparent animationType="none" onRequestClose={closeSheet}>
        <Animated.View style={[styles.sheetOverlay, { opacity: sheetOpacity }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeSheet} activeOpacity={1} />
          <Animated.View
            style={[styles.sheet, { transform: [{ translateY: sheetY }] }]}
          >
            {selectedItem && (
              <PurchaseSheet
                item={selectedItem}
                coins={coins}
                equippedRingId={equippedRingId}
                owned={ownedItems.has(selectedItem.id)}
                onCancel={closeSheet}
                onConfirm={handlePurchase}
              />
            )}
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* ── Toast ── */}
      <Animated.View
        pointerEvents="none"
        style={[styles.toast, { opacity: toastOpacity }]}
      >
        <Text style={styles.toastText}>{toastMsg}</Text>
      </Animated.View>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionLine} />
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

function BoostCard({
  item,
  owned,
  onPress,
}: {
  item: ShopItem;
  owned: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const press = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale }], marginBottom: 12 }}>
      <TouchableOpacity
        style={styles.boostCard}
        onPress={press}
        activeOpacity={0.9}
      >
        <View style={styles.boostLeft}>
          <LinearGradient
            colors={(item.gradient ?? ['#333', '#222']) as any}
            style={styles.boostIcon}
          >
            <Text style={{ fontSize: 26 }}>{item.icon}</Text>
          </LinearGradient>
          <View style={styles.boostInfo}>
            {item.tag && (
              <Text style={[styles.boostTag, { color: tagColor(item.tag) }]}>
                {item.tag}
              </Text>
            )}
            <Text style={styles.boostName}>{item.name}</Text>
            <Text style={styles.boostDesc} numberOfLines={2}>{item.description}</Text>
            {item.duration && (
              <View style={styles.durationPill}>
                <Text style={styles.durationTxt}>{item.duration}</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.boostRight}>
          {owned ? (
            <View style={styles.ownedPill}>
              <Text style={styles.ownedTxt}>OWNED</Text>
            </View>
          ) : (
            <View style={styles.costPill}>
              <Text style={styles.costCoin}>💰</Text>
              <Text style={styles.costAmt}>{item.cost}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const RING_CELL = (SW - 32 - 16) / 3;

function RingCard({
  item,
  owned,
  equipped,
  onPress,
}: {
  item: ShopItem;
  owned: boolean;
  equipped: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const press = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.93, duration: 80, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 140, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  const ringSize = RING_CELL * 0.62;
  const isMythic = !!item.mythic;

  return (
    <Animated.View style={[styles.ringCell, { transform: [{ scale }] }]}>
      <TouchableOpacity
        style={[styles.ringCellInner, equipped && styles.ringCellEquipped]}
        onPress={press}
        activeOpacity={0.85}
      >
        {/* Equipped check */}
        {equipped && (
          <View style={styles.ringCheck}>
            <Ionicons name="checkmark" size={13} color="#fff" />
          </View>
        )}

        {/* Ring preview */}
        <View style={styles.ringPreviewWrap}>
          {isMythic ? (
            <MythicRing size={ringSize} />
          ) : (
            <LinearGradient
              colors={(item.gradient ?? ['#333']) as any}
              style={{ width: ringSize, height: ringSize, borderRadius: ringSize / 2 }}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          )}
          {/* Inner mask so it looks like a ring */}
          <View
            style={[
              styles.ringInnerMask,
              { width: ringSize * 0.62, height: ringSize * 0.62, borderRadius: (ringSize * 0.62) / 2 },
            ]}
          />
          {/* Avatar placeholder */}
          <View
            style={[
              styles.ringAvatarPlaceholder,
              { width: ringSize * 0.56, height: ringSize * 0.56, borderRadius: (ringSize * 0.56) / 2 },
            ]}
          >
            <Ionicons name="person" size={ringSize * 0.24} color="rgba(214,238,248,0.5)" />
          </View>
        </View>

        <Text style={styles.ringName}>{item.name}</Text>
        {item.tag && (
          <Text style={[styles.ringTag, { color: tagColor(item.tag) }]}>
            {item.tag}
          </Text>
        )}
        {equipped ? (
          <Text style={styles.ringEquippedTxt}>EQUIPPED</Text>
        ) : owned ? (
          <Text style={styles.ringOwnedTxt}>OWNED</Text>
        ) : (
          <View style={styles.ringCostRow}>
            <Text style={styles.ringCostCoin}>💰</Text>
            <Text style={styles.ringCostAmt}>{item.cost}</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

function TournamentCard({
  item,
  owned,
  onPress,
}: {
  item: ShopItem;
  owned: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const press = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 140, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  return (
    <Animated.View style={[styles.tournCard, { transform: [{ scale }] }]}>
      <TouchableOpacity
        style={styles.tournCardInner}
        onPress={press}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={(item.gradient ?? ['#071e30', '#0c2c45']) as any}
          style={styles.tournIconWrap}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.tournIcon}>{item.icon}</Text>
        </LinearGradient>
        <Text style={styles.tournName} numberOfLines={2}>{item.name}</Text>
        {item.tag && (
          <Text style={[styles.tournTag, { color: tagColor(item.tag) }]}>{item.tag}</Text>
        )}
        {owned ? (
          <View style={styles.ownedPill}>
            <Text style={styles.ownedTxt}>OWNED</Text>
          </View>
        ) : (
          <View style={styles.ringCostRow}>
            <Text style={styles.ringCostCoin}>💰</Text>
            <Text style={styles.ringCostAmt}>{item.cost}</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Purchase Sheet
// ─────────────────────────────────────────────────────────────────────────────
function PurchaseSheet({
  item,
  coins,
  equippedRingId,
  owned,
  onCancel,
  onConfirm,
}: {
  item: ShopItem;
  coins: number;
  equippedRingId: string;
  owned: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const canAfford = coins >= item.cost;
  const isEquipped = equippedRingId === item.id;
  const remaining = Math.max(0, coins - item.cost);

  return (
    <View style={styles.sheetContent}>
      {/* Handle */}
      <View style={styles.sheetHandle} />

      {/* Item preview */}
      <View style={styles.sheetPreview}>
        <LinearGradient
          colors={(item.gradient ?? ['#071e30', '#0c2c45']) as any}
          style={styles.sheetPreviewIcon}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.sheetPreviewEmoji}>{item.icon}</Text>
        </LinearGradient>
        <View style={styles.sheetPreviewInfo}>
          {item.tag && (
            <Text style={[styles.sheetTag, { color: tagColor(item.tag) }]}>{item.tag}</Text>
          )}
          <Text style={styles.sheetItemName}>{item.name}</Text>
          {item.duration && (
            <View style={styles.durationPill}>
              <Text style={styles.durationTxt}>{item.duration}</Text>
            </View>
          )}
        </View>
      </View>

      <Text style={styles.sheetDesc}>{item.description}</Text>

      {/* Cost row */}
      {!owned && !isEquipped && (
        <>
          <View style={styles.sheetCostRow}>
            <View>
              <Text style={styles.sheetCostLabel}>COST</Text>
              <View style={styles.sheetCostAmt}>
                <Text style={styles.sheetCostCoin}>💰</Text>
                <Text style={styles.sheetCostNum}>{item.cost}</Text>
              </View>
            </View>
            <View style={styles.sheetArrow}>
              <Ionicons name="arrow-forward" size={16} color={colors.textFaint} />
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.sheetCostLabel}>REMAINING</Text>
              <View style={styles.sheetCostAmt}>
                <Text style={styles.sheetCostCoin}>💰</Text>
                <Text style={[styles.sheetCostNum, !canAfford && styles.sheetCostRed]}>
                  {remaining.toLocaleString()}
                </Text>
              </View>
            </View>
          </View>
          {!canAfford && (
            <Text style={styles.sheetNotEnough}>Not enough coins!</Text>
          )}
        </>
      )}

      {/* Action buttons */}
      <View style={styles.sheetActions}>
        <TouchableOpacity style={styles.sheetCancel} onPress={onCancel} activeOpacity={0.8}>
          <Text style={styles.sheetCancelTxt}>Cancel</Text>
        </TouchableOpacity>
        {owned && item.type === 'ring' && !isEquipped ? (
          <TouchableOpacity style={styles.sheetEquipBtn} onPress={onConfirm} activeOpacity={0.85}>
            <LinearGradient colors={['#00e5c8', '#0084ff']} style={styles.sheetBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={styles.sheetBtnTxt}>Equip</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : owned ? (
          <View style={[styles.sheetEquipBtn, styles.sheetEquipBtnOwned]}>
            <Text style={[styles.sheetBtnTxt, { color: colors.textDim }]}>Already Owned</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.sheetBuyBtn, !canAfford && styles.sheetBuyBtnDisabled]}
            onPress={canAfford ? onConfirm : onCancel}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={canAfford ? ['#ffc845', '#ff8c00'] : ['#2a3a4a', '#1a2530']}
              style={styles.sheetBtnGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={[styles.sheetBtnTxt, { color: canAfford ? '#1a1000' : colors.textFaint }]}>
                {canAfford ? `Buy · 💰 ${item.cost}` : 'Not Enough Coins'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.abyss,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  titleGrad: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  titleIcon: { fontSize: 22 },
  titleTop: {
    fontFamily: 'Orbitron_900Black',
    fontSize: 14,
    color: '#1a1000',
    lineHeight: 16,
    letterSpacing: 2,
  },
  titleBottom: {
    fontFamily: 'Orbitron_900Black',
    fontSize: 14,
    color: '#1a1000',
    lineHeight: 16,
    letterSpacing: 2,
  },
  balancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,200,69,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,200,69,0.35)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  balanceAmt: {
    fontSize: 15,
    fontWeight: '900',
    color: GOLD,
  },
  balanceLbl: {
    fontSize: 10,
    fontWeight: '700',
    color: GOLD_DIM,
    letterSpacing: 1,
  },

  // Tabs
  tabsScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  tabsRow: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    flexShrink: 0,
  },
  tabPillActive: {
    backgroundColor: 'rgba(255,200,69,0.16)',
    borderColor: 'rgba(255,200,69,0.5)',
  },
  tabIcon: { fontSize: 13 },
  tabLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textDim,
  },
  tabLabelActive: {
    color: GOLD,
  },

  // Scroll
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },

  // Section
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    color: colors.textFaint,
  },

  // Boost card
  boostCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  boostLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    flex: 1,
  },
  boostIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  boostInfo: { flex: 1 },
  boostTag: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 3,
  },
  boostName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  boostDesc: {
    fontSize: 12,
    color: colors.textDim,
    lineHeight: 17,
    marginBottom: 8,
  },
  boostRight: {
    marginLeft: 10,
    alignItems: 'flex-end',
  },
  durationPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,229,200,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0,229,200,0.3)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  durationTxt: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.teal,
    letterSpacing: 0.8,
  },
  costPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,200,69,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,200,69,0.4)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  costCoin: { fontSize: 14 },
  costAmt: { fontSize: 14, fontWeight: '900', color: GOLD },
  ownedPill: {
    backgroundColor: 'rgba(0,229,200,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0,229,200,0.3)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  ownedTxt: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.teal,
    letterSpacing: 1,
  },

  // Ring grid
  ringGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ringCell: {
    width: RING_CELL,
  },
  ringCellInner: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    alignItems: 'center',
    gap: 6,
  },
  ringCellEquipped: {
    borderColor: colors.teal,
    backgroundColor: 'rgba(0,229,200,0.06)',
  },
  ringCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  ringPreviewWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInnerMask: {
    position: 'absolute',
    backgroundColor: colors.card,
  },
  ringAvatarPlaceholder: {
    position: 'absolute',
    backgroundColor: colors.cardHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringName: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  ringTag: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  ringEquippedTxt: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.teal,
    letterSpacing: 1,
  },
  ringOwnedTxt: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textDim,
    letterSpacing: 0.8,
  },
  ringCostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,200,69,0.12)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  ringCostCoin: { fontSize: 11 },
  ringCostAmt: { fontSize: 11, fontWeight: '800', color: GOLD },

  // Tournament / style cards (2-col grid)
  tournamentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tournCard: {
    width: (SW - 32 - 10) / 2,
  },
  tournCardInner: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    alignItems: 'center',
    gap: 8,
  },
  tournIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tournIcon: { fontSize: 26 },
  tournName: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  tournTag: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // Purchase sheet
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.trench,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.4, shadowRadius: 16 },
      android: { elevation: 24 },
    }),
  },
  sheetContent: { padding: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 24 },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginBottom: 18,
  },
  sheetPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  sheetPreviewIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sheetPreviewEmoji: { fontSize: 30 },
  sheetPreviewInfo: { flex: 1 },
  sheetTag: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 3,
  },
  sheetItemName: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 4,
  },
  sheetDesc: {
    fontSize: 13,
    color: colors.textDim,
    lineHeight: 19,
    marginBottom: 18,
  },
  sheetCostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sheetArrow: { opacity: 0.4 },
  sheetCostLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textFaint,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  sheetCostAmt: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sheetCostCoin: { fontSize: 16 },
  sheetCostNum: { fontSize: 18, fontWeight: '900', color: GOLD },
  sheetCostRed: { color: '#ff4d6d' },
  sheetNotEnough: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ff4d6d',
    textAlign: 'center',
    marginBottom: 8,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  sheetCancel: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sheetCancelTxt: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textDim,
  },
  sheetBuyBtn: {
    flex: 2,
    borderRadius: 14,
    overflow: 'hidden',
  },
  sheetBuyBtnDisabled: { opacity: 0.7 },
  sheetEquipBtn: {
    flex: 2,
    borderRadius: 14,
    overflow: 'hidden',
  },
  sheetEquipBtnOwned: {
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sheetBtnGrad: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  sheetBtnTxt: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1a1000',
  },

  // Toast
  toast: {
    position: 'absolute',
    bottom: 100,
    left: 40,
    right: 40,
    backgroundColor: 'rgba(2,11,20,0.92)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12 },
      android: { elevation: 10 },
    }),
  },
  toastText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
});
