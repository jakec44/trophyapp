/**
 * Friend profile preview — from friends list tap
 * Shows avatar (tap fullscreen), username, location, Message, Remove Friend
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  Pressable,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SnaggedWordmark } from '@/src/components/ui/SnaggedWordmark';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/utils/colors';
import { isValidImageUri } from '@/src/lib/imageUri';
import { useFriendsContext } from '@/src/context/FriendsContext';
import { useBottomSafePadding } from '@/src/components/ScreenContainer';

export default function FriendProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bottomPadding = useBottomSafePadding();
  const { friends, removeFriend } = useFriendsContext();
  const [fullscreenImage, setFullscreenImage] = useState(false);

  const friend = friends.find((f) => f.id === id || f.userId === id);

  const handleRemove = () => {
    Alert.alert(
      'Remove Friend',
      `Remove ${friend?.displayName ?? 'this friend'} from your friends list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            removeFriend(id);
            router.back();
          },
        },
      ]
    );
  };

  const handleMessage = () => {
    const uid = friend?.userId ?? id;
    const dname = encodeURIComponent(friend?.displayName ?? 'Friend');
    router.push(`/chat/${uid}?displayName=${dname}`);
  };

  if (!friend) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.headerBar}>
          <SnaggedWordmark />
        </View>
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>Friend not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerBar}>
        <SnaggedWordmark />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding }]}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.avatarWrap}
          onPress={() => setFullscreenImage(true)}
          activeOpacity={0.9}
        >
          {isValidImageUri(friend.avatar) ? (
            <Image source={{ uri: friend.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: colors.lightBorder, justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="person" size={40} color={colors.lightSubtext} />
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.displayName}>{friend.displayName}</Text>
        {friend.location && (
          <View style={styles.locationRow}>
            <Feather name="map-pin" size={14} color={colors.lightSubtext} />
            <Text style={styles.location}>{friend.location}</Text>
          </View>
        )}

        <View style={styles.actions}>
          <TouchableOpacity style={styles.messageBtn} onPress={handleMessage}>
            <Ionicons name="chatbubble-outline" size={20} color="#FFF" />
            <Text style={styles.messageBtnText}>Message</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.removeBtn} onPress={handleRemove}>
            <Feather name="user-minus" size={18} color={colors.lightSubtext} />
            <Text style={styles.removeBtnText}>Remove Friend</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={fullscreenImage}
        transparent
        animationType="fade"
        onRequestClose={() => setFullscreenImage(false)}
      >
        <Pressable
          style={styles.fullscreenOverlay}
          onPress={() => setFullscreenImage(false)}
        >
          {isValidImageUri(friend.avatar) ? (
            <Image
              source={{ uri: friend.avatar }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          ) : (
            <View style={[styles.fullscreenImage, { backgroundColor: colors.lightBorder, justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="person" size={64} color={colors.lightSubtext} />
            </View>
          )}
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.lightBackground,
  },
  headerBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 8,
  },
  headerSnagged: {
    fontFamily: 'Orbitron_900Black',
    fontSize: 22,
    color: '#00e5c8',
    letterSpacing: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  avatarWrap: {
    marginBottom: 16,
  },
  avatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.lightBorder,
  },
  displayName: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.lightText,
    marginBottom: 8,
    textAlign: 'center',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 28,
  },
  location: {
    fontSize: 14,
    color: colors.lightSubtext,
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  messageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.accentBlue,
  },
  messageBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.lightCard,
    borderWidth: 1,
    borderColor: colors.lightBorder,
  },
  removeBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.lightSubtext,
  },
  errorWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: colors.lightSubtext,
  },
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    width: '100%',
    height: '80%',
  },
});
