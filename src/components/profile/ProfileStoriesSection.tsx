/**
 * Profile stories section.
 * - Stories are grouped by calendar day → one bubble per day (stack same-day).
 * - Blue ring  = group has at least one unviewed story.
 * - Gray ring  = all stories in the group have been viewed.
 * - Tapping a bubble opens the StoryViewerModal at the first unviewed story.
 * - Own profile: shows "Add story" when empty.
 */

import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/utils/colors';
import Feather from '@expo/vector-icons/Feather';
import type { StoryRow } from '@/src/lib/supabase';
import { isValidImageUri } from '@/src/lib/imageUri';
import { groupStoriesByDay } from '@/src/lib/storyViews';

interface ProfileStoriesSectionProps {
  stories: StoryRow[];
  isOwnProfile: boolean;
  viewedIds?: Set<string>;
  onAddStory?: () => void;
  /** Called with the group's stories array and the index to start at. */
  onGroupPress?: (groupStories: StoryRow[], startIndex: number) => void;
  /** Legacy single-story press (still supported). */
  onStoryPress?: (story: StoryRow) => void;
  /** Called with all story IDs in the group to delete the whole day. */
  onDeleteGroup?: (storyIds: string[]) => Promise<void>;
}

export function ProfileStoriesSection({
  stories,
  isOwnProfile,
  viewedIds = new Set(),
  onAddStory,
  onGroupPress,
  onStoryPress,
  onDeleteGroup,
}: ProfileStoriesSectionProps) {
  const hasStories = stories.length > 0;

  if (!hasStories) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Stories</Text>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {isOwnProfile ? 'Add your first story' : 'No stories yet'}
          </Text>
          {isOwnProfile && onAddStory && (
            <TouchableOpacity
              style={styles.addButton}
              onPress={onAddStory}
              activeOpacity={0.8}
            >
              <Feather name="camera" size={18} color="#FFFFFF" />
              <Text style={styles.addButtonText}>Add story</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  const groups = groupStoriesByDay(stories);

  return (
    <View style={styles.section}>
      <View style={styles.titleRow}>
        <Text style={styles.sectionTitle}>Stories</Text>
        {isOwnProfile && onAddStory && (
          <TouchableOpacity onPress={onAddStory} style={styles.addIconBtn} hitSlop={8}>
            <Feather name="plus-circle" size={20} color={colors.accentBlue} />
          </TouchableOpacity>
        )}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.storiesRow}
      >
        {groups.map((group) => {
          // Thumbnail = the most recent story with a valid image in this group
          const thumbStory = group.stories.find((s) => s.media_url && isValidImageUri(s.media_url));
          const uri = thumbStory?.media_url && isValidImageUri(thumbStory.media_url)
            ? thumbStory.media_url
            : null;

          // Ring is blue if ANY story in this group is unviewed
          const allViewed = group.stories.every((s) => viewedIds.has(s.id));

          // How many stories stacked today
          const stackCount = group.stories.length;

          // Find first unviewed story index (start viewer there)
          const firstUnviewedIdx = group.stories.findIndex((s) => !viewedIds.has(s.id));
          const startIdx = firstUnviewedIdx >= 0 ? firstUnviewedIdx : 0;

          const handlePress = () => {
            if (onGroupPress) {
              onGroupPress(group.stories, startIdx);
            } else if (onStoryPress && group.stories[startIdx]) {
              onStoryPress(group.stories[startIdx]);
            }
          };

          const handleDeleteGroup = () => {
            if (!onDeleteGroup) return;
            const label = formatDayLabel(group.dayKey);
            const count = group.stories.length;
            Alert.alert(
              'Delete Stories',
              `Delete all ${count} ${count === 1 ? 'story' : 'stories'} from ${label}?`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => onDeleteGroup(group.stories.map((s) => s.id)),
                },
              ]
            );
          };

          return (
            <View key={group.dayKey} style={styles.bubbleWrap}>
              <TouchableOpacity
                onPress={handlePress}
                activeOpacity={0.85}
              >
                <View style={[styles.storyRing, allViewed ? styles.ringViewed : styles.ringUnviewed]}>
                  <View style={styles.storyInner}>
                    {uri ? (
                      <Image
                        source={{ uri }}
                        style={styles.storyThumb}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[styles.storyThumb, styles.storyPlaceholder]}>
                        <Ionicons name="image-outline" size={24} color={colors.lightSubtext} />
                      </View>
                    )}
                  </View>
                </View>
                {/* Stack indicator — show count badge if >1 story that day */}
                {stackCount > 1 && (
                  <View style={[styles.stackBadge, allViewed && styles.stackBadgeViewed]}>
                    <Text style={styles.stackBadgeText}>{stackCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <View style={styles.dayRow}>
                <Text style={styles.dayLabel} numberOfLines={1}>
                  {formatDayLabel(group.dayKey)}
                </Text>
                {isOwnProfile && onDeleteGroup && (
                  <TouchableOpacity onPress={handleDeleteGroup} hitSlop={8} style={styles.dayTrash}>
                    <Ionicons name="trash-outline" size={13} color={colors.lightSubtext} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** Always show the actual date (e.g. "Feb 19") under each group; today shows date, not "Today". */
function formatDayLabel(dayKey: string): string {
  const d = new Date(dayKey + 'T12:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Blue ring when user hasn't viewed the story yet */
const RING_UNVIEWED_BLUE = '#3B82F6';
const BUBBLE_SIZE = 60;
const RING_BORDER = 2.5;
const INNER_SIZE = BUBBLE_SIZE - RING_BORDER * 2 - 2; // 2px gap inside ring

const styles = StyleSheet.create({
  section: {
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.lightText,
  },
  addIconBtn: {
    padding: 4,
  },
  empty: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: colors.lightCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.lightBorder,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: colors.lightSubtext,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.accentBlue,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  storiesRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
    paddingHorizontal: 16,
    paddingRight: 24,
    flexGrow: 0,
  },
  bubbleWrap: {
    alignItems: 'center',
    gap: 4,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    maxWidth: BUBBLE_SIZE + RING_BORDER * 2 + 4,
  },
  dayTrash: {
    padding: 2,
  },
  storyRing: {
    width: BUBBLE_SIZE + RING_BORDER * 2 + 4,
    height: BUBBLE_SIZE + RING_BORDER * 2 + 4,
    borderRadius: (BUBBLE_SIZE + RING_BORDER * 2 + 4) / 2,
    borderWidth: RING_BORDER,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringUnviewed: {
    borderColor: RING_UNVIEWED_BLUE,
  },
  ringViewed: {
    borderColor: colors.lightBorder,
  },
  storyInner: {
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    overflow: 'hidden',
    backgroundColor: colors.lightBorder,
  },
  storyThumb: {
    width: '100%',
    height: '100%',
  },
  storyPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.lightBorder,
  },
  stackBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: RING_UNVIEWED_BLUE,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: colors.lightBackground,
  },
  stackBadgeViewed: {
    backgroundColor: colors.lightSubtext,
  },
  stackBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.lightSubtext,
    flexShrink: 1,
    textAlign: 'center',
  },
});
