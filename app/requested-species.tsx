/**
 * Requested species list — shows fish species users have requested to add to the passport.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { colors } from '@/utils/colors';
import { getRequestedSpeciesList } from '@/src/lib/supabase';
import { ParticleBackground } from '@/src/components/ui/ParticleBackground';
import { SnaggedWordmark } from '@/src/components/ui/SnaggedWordmark';

export default function RequestedSpeciesScreen() {
  const router = useRouter();
  const [list, setList] = useState<{ species_name: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getRequestedSpeciesList();
      setList(data);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ParticleBackground />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Feather name="chevron-left" size={24} color={colors.lightText} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <SnaggedWordmark />
          <Text style={styles.subtitle}>Requested Species</Text>
        </View>
        <View style={styles.backBtn} />
      </View>
      <Text style={styles.description}>
        Species that users have requested to add to the passport. Most requested at top.
      </Text>
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.brightBlue} />
        </View>
      ) : list.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="inbox" size={48} color={colors.lightSubtext} />
          <Text style={styles.emptyText}>No species requested yet</Text>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item.species_name}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.speciesName}>
                {item.species_name.charAt(0).toUpperCase() + item.species_name.slice(1)}
              </Text>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{item.count}</Text>
                <Text style={styles.countLabel}>
                  {item.count === 1 ? 'request' : 'requests'}
                </Text>
              </View>
            </View>
          )}
        />
      )}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightBorder,
    backgroundColor: colors.lightCard,
  },
  backBtn: {
    width: 40,
    alignItems: 'flex-start',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: colors.lightSubtext,
    marginTop: 2,
  },
  description: {
    fontSize: 14,
    color: colors.lightSubtext,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    color: colors.lightSubtext,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.lightCard,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.lightBorder,
  },
  speciesName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.lightText,
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  countText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.brightBlue,
  },
  countLabel: {
    fontSize: 12,
    color: colors.lightSubtext,
  },
});
