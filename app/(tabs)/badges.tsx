/**
 * Badge Collection Screen — Pokédex-style grid of species mastery badges.
 */

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';
import { ParticleBackground } from '@/src/components/ui/ParticleBackground';
import { SnaggedWordmark } from '@/src/components/ui/SnaggedWordmark';
import { BadgeCollectionGrid } from '@/src/components/profile/BadgeCollectionGrid';
import { BadgeDetailModal } from '@/src/components/profile/BadgeDetailModal';
import { colors } from '@/utils/colors';
import { useAuthContext } from '@/src/context/AuthContext';
import { useProfileDisplayItems } from '@/src/hooks/useProfileDisplayItems';
import { getBadgeCollectionItems, getUnlockCatchesForBadge, type BadgeCollectionItemData } from '@/src/lib/speciesMastery';
import type { BadgeRarity } from '@/src/types/badgeRarity';
import { RARITY_PALETTE } from '@/src/types/badgeRarity';

const RARITY_FILTERS: (BadgeRarity | 'ALL')[] = ['ALL', 'MYTHIC', 'EPIC', 'RARE', 'COMMON'];

export default function BadgesScreen() {
  const router = useRouter();
  const { user } = useAuthContext();
  const { items: displayItems, trophies: profileTrophies, save: saveDisplayItems, refresh: refreshDisplayItems } = useProfileDisplayItems(user?.id ?? null);
  const [items, setItems] = useState<BadgeCollectionItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<BadgeCollectionItemData | null>(null);
  const [unlockCatches, setUnlockCatches] = useState<import('@/src/lib/speciesMastery').UnlockCatch[]>([]);
  const [rarityFilter, setRarityFilter] = useState<BadgeRarity | 'ALL'>('ALL');

  const basePinnedIds = displayItems
    .filter((i) => i.type === 'badge' && i.badgeKey)
    .map((i) => i.badgeKey!);
  const [optimisticPin, setOptimisticPin] = useState<{ add: string[]; remove: string[] }>({ add: [], remove: [] });
  const pinnedIds = [
    ...basePinnedIds.filter((id) => !optimisticPin.remove.includes(id)),
    ...optimisticPin.add,
  ].filter((id, i, arr) => arr.indexOf(id) === i);

  useEffect(() => {
    if (!user?.id) {
      setItems([]);
      setLoading(false);
      return;
    }
    getBadgeCollectionItems(user.id).then((list) => {
      setItems(list);
      setLoading(false);
    });
  }, [user?.id]);

  const filteredItems =
    rarityFilter === 'ALL'
      ? items
      : items.filter((i) => i.rarity === rarityFilter);

  const mappedItems = filteredItems.map((i) => ({
    id: i.id,
    name: i.name,
    unlockHint: i.unlockHint,
    rarity: i.rarity,
    icon: i.icon,
    place: i.place,
    unlocked: i.unlocked,
    badgeKey: i.badgeKey,
  }));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ParticleBackground />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.lightText} />
        </TouchableOpacity>
        <SnaggedWordmark />
        <View style={styles.backBtn} />
      </View>
      <View style={styles.titleRow}>
        <Ionicons name="trophy" size={20} color={colors.gold} />
        <Text style={styles.title}>Badge Collection</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        {RARITY_FILTERS.map((r) => (
          <TouchableOpacity
            key={r}
            style={[
              styles.filterPill,
              rarityFilter === r && styles.filterPillActive,
              r !== 'ALL' && rarityFilter === r && { borderColor: RARITY_PALETTE[r as BadgeRarity].primary },
            ]}
            onPress={() => setRarityFilter(r)}
          >
            <Text
              style={[
                styles.filterPillText,
                rarityFilter === r && styles.filterPillTextActive,
                r !== 'ALL' && rarityFilter === r && { color: RARITY_PALETTE[r as BadgeRarity].primary },
              ]}
            >
              {r === 'ALL' ? 'All' : r}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.teal} />
          <Text style={styles.loadingText}>Loading badges…</Text>
        </View>
      ) : (
        <BadgeCollectionGrid
          items={mappedItems}
          pinnedIds={pinnedIds}
          onPinToggle={async (item) => {
            if (!user?.id) return;
            const badgeKey = item.badgeKey ?? item.id;
            const isPinned = pinnedIds.includes(badgeKey) || pinnedIds.includes(item.id);
            setOptimisticPin((prev) => ({
              add: isPinned ? prev.add.filter((id) => id !== badgeKey) : [...prev.add, badgeKey],
              remove: isPinned ? [...prev.remove, badgeKey] : prev.remove.filter((id) => id !== badgeKey),
            }));
            const current: Array<{ type: 'badge'; badge_key: string } | { type: 'trophy'; trophy_id: string }> = displayItems.map((i) =>
              i.type === 'badge' && i.badgeKey ? { type: 'badge' as const, badge_key: i.badgeKey } : { type: 'trophy' as const, trophy_id: i.trophyId }
            );
            const next = isPinned
              ? current.filter((x) => !(x.type === 'badge' && x.badge_key === badgeKey))
              : current.length >= 3
                ? current
                : [...current, { type: 'badge' as const, badge_key: badgeKey }];
            await saveDisplayItems(next);
            await refreshDisplayItems();
            setOptimisticPin({ add: [], remove: [] });
          }}
          onBadgeLongPress={async (item) => {
            const full = items.find((i) => i.id === item.id);
            if (full) {
              setSelected(full);
              const badgeKey = full.badgeKey ?? full.id;
              const catches = await getUnlockCatchesForBadge(user!.id, badgeKey, full.unlocked);
              setUnlockCatches(catches);
            }
          }}
          mysteryCount={12}
        />
      )}

      <BadgeDetailModal
        visible={!!selected}
        onClose={() => { setSelected(null); setUnlockCatches([]); }}
        name={selected?.name ?? ''}
        rarity={selected?.rarity ?? 'COMMON'}
        badgeKey={selected?.badgeKey ?? selected?.id}
        unlockHint={
          selected?.unlocked
            ? (selected.unlockHint.startsWith('Catch ')
              ? `How you unlocked: Logged ${selected.unlockHint.replace(/^Catch /, '').replace(/\.$/, '')}.`
              : `How you unlocked: ${selected.unlockHint}`)
            : `How to unlock: ${selected?.unlockHint ?? ''}`
        }
        unlocked={selected?.unlocked}
        unlockCatches={unlockCatches}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightBackground },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backBtn: { width: 32, alignItems: 'flex-start' },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.lightText,
  },
  filterScroll: { maxHeight: 40, marginBottom: 8 },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(122,175,201,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(122,175,201,0.25)',
  },
  filterPillActive: {
    backgroundColor: 'rgba(122,175,201,0.2)',
    borderColor: colors.teal,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(122,175,201,0.8)',
  },
  filterPillTextActive: {
    color: colors.lightText,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: colors.lightSubtext,
  },
});
