/**
 * Create Group Chat screen.
 * Lets the user set a name, pick a group image, and select friends to invite.
 */
import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ParticleBackground } from '@/src/components/ui/ParticleBackground';
import { SnaggedWordmark } from '@/src/components/ui/SnaggedWordmark';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Feather from '@expo/vector-icons/Feather';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/utils/colors';
import { useAuthContext } from '@/src/context/AuthContext';
import { useFriendsContext } from '@/src/context/FriendsContext';
import { createGroupChat, uploadFileFromUri, updateGroupChatImage } from '@/src/lib/supabase';

const AVATAR_SIZE = 44;

function FriendRow({
  name,
  avatarUrl,
  selected,
  onToggle,
}: {
  name: string;
  avatarUrl?: string;
  selected: boolean;
  onToggle: () => void;
}) {
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <TouchableOpacity style={[styles.friendRow, selected && styles.friendRowSelected]} onPress={onToggle} activeOpacity={0.75}>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={styles.friendAvatar} />
      ) : (
        <View style={styles.friendAvatarFallback}>
          <Text style={styles.friendAvatarInitials}>{initials}</Text>
        </View>
      )}
      <Text style={styles.friendName} numberOfLines={1}>{name}</Text>
      <View style={[styles.checkCircle, selected && styles.checkCircleSelected]}>
        {selected && <Ionicons name="checkmark" size={14} color="#fff" />}
      </View>
    </TouchableOpacity>
  );
}

export default function CreateGroupChatScreen() {
  const router = useRouter();
  const { user } = useAuthContext();
  const { friends } = useFriendsContext();

  const [groupName, setGroupName] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  const toggleFriend = useCallback((userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }, []);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleCreate = async () => {
    if (!user?.id) return;
    if (!groupName.trim()) {
      Alert.alert('Name required', 'Please enter a group name.');
      return;
    }
    if (selectedIds.size === 0) {
      Alert.alert('Add people', 'Select at least one friend to add.');
      return;
    }
    setCreating(true);
    try {
      const group = await createGroupChat(
        groupName.trim(),
        null,
        [...selectedIds],
        user.id
      );

      // Upload image if one was picked
      if (imageUri) {
        try {
          await uploadFileFromUri(
            'media',
            `group-chats/${group.id}/logo.jpg`,
            imageUri,
            { upsert: true, contentType: 'image/jpeg' }
          );
          const { data: { publicUrl } } = await import('@/src/lib/supabase').then(m =>
            m.supabase.storage.from('media').getPublicUrl(`group-chats/${group.id}/logo.jpg`)
          );
          await updateGroupChatImage(group.id, publicUrl);
        } catch {
          // image upload failing shouldn't block the chat creation
        }
      }

      router.replace(`/group-chat/${group.id}`);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not create group chat. Try again.');
    } finally {
      setCreating(false);
    }
  };

  const canCreate = groupName.trim().length > 0 && selectedIds.size > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ParticleBackground />

      {/* Header */}
      <View style={styles.header}>
        <SnaggedWordmark />
        <Text style={styles.headerTitle}>New Group Chat</Text>
        <TouchableOpacity
          style={[styles.createBtn, !canCreate && styles.createBtnDisabled]}
          onPress={handleCreate}
          disabled={!canCreate || creating}
        >
          {creating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.createBtnTxt}>Create</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.flex} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Group image + name row */}
          <View style={styles.groupSetupRow}>
            <TouchableOpacity style={styles.imagePicker} onPress={pickImage} activeOpacity={0.8}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.groupImage} />
              ) : (
                <View style={styles.groupImagePlaceholder}>
                  <Ionicons name="camera" size={26} color={colors.lightSubtext} />
                </View>
              )}
              <View style={styles.imageEditBadge}>
                <Feather name="edit-2" size={10} color="#fff" />
              </View>
            </TouchableOpacity>

            <TextInput
              style={styles.nameInput}
              placeholder="Group name"
              placeholderTextColor={colors.lightSubtext}
              value={groupName}
              onChangeText={setGroupName}
              maxLength={60}
              returnKeyType="done"
            />
          </View>

          {/* Selected count */}
          {selectedIds.size > 0 && (
            <Text style={styles.selectedCount}>
              {selectedIds.size} member{selectedIds.size !== 1 ? 's' : ''} selected
            </Text>
          )}

          {/* Friends list */}
          <Text style={styles.sectionLabel}>Add Friends</Text>
          {friends.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={40} color={colors.lightBorder} />
              <Text style={styles.emptyText}>No friends yet</Text>
              <Text style={styles.emptySubtext}>Add friends first to create a group chat.</Text>
            </View>
          ) : (
            friends.map((f) => (
              <FriendRow
                key={f.userId ?? f.id}
                name={f.displayName}
                avatarUrl={f.avatar || undefined}
                selected={selectedIds.has(f.userId ?? f.id)}
                onToggle={() => toggleFriend(f.userId ?? f.id)}
              />
            ))
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightBackground },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.lightBorder,
  },
  headerSnagged: {
    fontFamily: 'Orbitron_900Black',
    fontSize: 22,
    color: '#00e5c8',
    letterSpacing: 2,
    marginRight: 12,
  },
  headerTitle: { flex: 1, fontSize: 19, fontWeight: '800', color: colors.lightText },
  createBtn: {
    backgroundColor: colors.accentBlue, borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 16, minWidth: 70, alignItems: 'center',
  },
  createBtnDisabled: { backgroundColor: colors.lightBorder },
  createBtnTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },

  groupSetupRow: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingHorizontal: 16, paddingVertical: 20,
    borderBottomWidth: 1, borderBottomColor: colors.lightBorder,
  },
  imagePicker: { position: 'relative' },
  groupImage: { width: 68, height: 68, borderRadius: 34 },
  groupImagePlaceholder: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: colors.lightCard,
    borderWidth: 2, borderColor: colors.lightBorder, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center',
  },
  imageEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.accentBlue,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: colors.lightBackground,
  },
  nameInput: {
    flex: 1, fontSize: 18, fontWeight: '700', color: colors.lightText,
    borderBottomWidth: 2, borderBottomColor: colors.accentBlue + '50',
    paddingVertical: 8,
  },

  selectedCount: {
    fontSize: 12, fontWeight: '600', color: colors.accentBlue,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4,
  },
  sectionLabel: {
    fontSize: 13, fontWeight: '700', color: colors.lightSubtext,
    letterSpacing: 0.3, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
  },

  friendRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.lightBorder,
  },
  friendRowSelected: { backgroundColor: colors.accentBlue + '08' },
  friendAvatar: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 },
  friendAvatarFallback: {
    width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.accentBlue + '25', justifyContent: 'center', alignItems: 'center',
  },
  friendAvatarInitials: { fontSize: 15, fontWeight: '800', color: colors.accentBlue },
  friendName: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.lightText },
  checkCircle: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: colors.lightBorder,
    justifyContent: 'center', alignItems: 'center',
  },
  checkCircleSelected: { backgroundColor: colors.accentBlue, borderColor: colors.accentBlue },

  emptyState: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '600', color: colors.lightText },
  emptySubtext: { fontSize: 13, color: colors.lightSubtext, textAlign: 'center', paddingHorizontal: 24 },
});
