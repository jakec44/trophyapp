import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ParticleBackground } from '@/src/components/ui/ParticleBackground';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '@/utils/colors';
import { useAuthContext } from '@/src/context/AuthContext';
import {
  getUserProfile,
  updateUserProfile,
  checkUsernameAvailable,
} from '@/src/lib/supabase';
import { mediaPath } from '@/src/lib/mediaPaths';
import { uploadImageAsJpegToStorage } from '@/src/lib/supabase';
import { toFriendlyMessage } from '@/src/lib/errorMessages';
import { isValidImageUri } from '@/src/lib/imageUri';
import Feather from '@expo/vector-icons/Feather';
import { SnaggedWordmark } from '@/src/components/ui/SnaggedWordmark';
import { devLog } from '@/src/lib/env';

export default function ProfileEditScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, refreshProfile } = useAuthContext();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [bannerUri, setBannerUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      router.replace('/(tabs)/profile');
      return;
    }
    (async () => {
      const profile = await getUserProfile(user.id);
      if (profile) {
        setName(profile.name ?? profile.display_name ?? '');
        setUsername(profile.username ?? '');
        setBio(profile.bio ?? '');
        setLocation(profile.location ?? '');
        setAvatarUri(profile.avatar_url ?? null);
        setBannerUri(profile.banner_url ?? null);
      } else {
        setName(user.displayName ?? user.email?.split('@')[0] ?? '');
        setUsername(user.username ?? user.email?.split('@')[0] ?? '');
      }
      setLoading(false);
    })();
  }, [user?.id]);

  const handleChangeAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'Allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (result.canceled || !user?.id) return;
    const uri = result.assets[0].uri;
    setAvatarUri(uri);
    setSaving(true);
    try {
      const path = mediaPath.avatar(user.id);
      devLog('[MEDIA] avatar upload start', { bucket: 'media', path });
      await uploadImageAsJpegToStorage('media', path, uri);
      await updateUserProfile(user.id, { avatar_url: path });
      devLog('[MEDIA] avatar upload complete', { bucket: 'media', path });
      await refreshProfile();
    } catch (e) {
      console.error('[MEDIA] avatar upload failed:', e);
      Alert.alert('Couldn\'t update profile photo', toFriendlyMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const handleChangeBanner = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'Allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 1],
      quality: 0.8,
    });
    if (result.canceled || !user?.id) return;
    const uri = result.assets[0].uri;
    setBannerUri(uri);
    setSaving(true);
    try {
      const path = mediaPath.banner(user.id);
      devLog('[MEDIA] banner upload start', { bucket: 'media', path });
      await uploadImageAsJpegToStorage('media', path, uri);
      await updateUserProfile(user.id, { banner_url: path });
      devLog('[MEDIA] banner upload complete', { bucket: 'media', path });
      await refreshProfile();
    } catch (e) {
      console.error('[MEDIA] banner upload failed:', e);
      Alert.alert('Couldn\'t update banner', toFriendlyMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;
    const u = username.trim().toLowerCase();
    const nameVal = name.trim() || 'Angler';
    if (!u) {
      Alert.alert('Username required', 'Please enter a unique username.');
      return;
    }
    const usernameRegex = /^[a-z0-9_]{3,20}$/;
    if (!usernameRegex.test(u)) {
      Alert.alert(
        'Invalid username',
        'Use 3–20 characters: letters, numbers, and underscores only (e.g. jake_angler).'
      );
      return;
    }
    const available = await checkUsernameAvailable(u, user.id);
    if (!available) {
      Alert.alert('Username taken', 'This username is already in use. Try another.');
      return;
    }
    setSaving(true);
    try {
      await updateUserProfile(user.id, {
        name: nameVal,
        display_name: nameVal,
        username: u,
        bio: bio.trim() || null,
        location: location.trim() || null,
      });
      await refreshProfile();
      await AsyncStorage.setItem('hasSeenOnboarding', '1').catch(() => {});
      await AsyncStorage.removeItem('onboarding_needs_profile').catch(() => {});
      router.back();
    } catch (e) {
      console.error('Profile save failed:', e);
      Alert.alert('Couldn\'t update profile', toFriendlyMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ParticleBackground />
      <View style={styles.header}>
        <SnaggedWordmark />
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={styles.saveBtn}
        >
          <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity style={styles.avatarSection} onPress={handleChangeAvatar}>
          {isValidImageUri(avatarUri) ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Feather name="user" size={48} color={colors.lightSubtext} />
            </View>
          )}
          <Text style={styles.changeLabel}>Change avatar</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bannerSection} onPress={handleChangeBanner}>
          {isValidImageUri(bannerUri) ? (
            <Image source={{ uri: bannerUri }} style={styles.banner} resizeMode="cover" />
          ) : (
            <View style={styles.bannerPlaceholder}>
              <Feather name="image" size={32} color={colors.lightSubtext} />
              <Text style={styles.bannerPlaceholderText}>Add banner</Text>
            </View>
          )}
          <Text style={styles.changeLabel}>Change banner</Text>
        </TouchableOpacity>

        <View style={styles.form}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your name (can be shared)"
            placeholderTextColor={colors.lightSubtext}
          />
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="unique username (e.g. jake_angler)"
            placeholderTextColor={colors.lightSubtext}
            autoCapitalize="none"
          />
          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, styles.bioInput]}
            value={bio}
            onChangeText={setBio}
            placeholder="Tell us about yourself..."
            placeholderTextColor={colors.lightSubtext}
            multiline
            numberOfLines={3}
          />
          <Text style={styles.label}>Location</Text>
          <TextInput
            style={styles.input}
            value={location}
            onChangeText={setLocation}
            placeholder="e.g. Charleston, SC"
            placeholderTextColor={colors.lightSubtext}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightBackground },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightBorder,
  },
  headerSnaggedWrap: { padding: 8 },
  headerSnagged: {
    fontFamily: 'Orbitron_900Black',
    fontSize: 22,
    color: '#00e5c8',
    letterSpacing: 2,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.lightText },
  saveBtn: { padding: 8 },
  saveBtnText: { fontSize: 16, fontWeight: '600', color: colors.gold },
  content: { padding: 16, paddingBottom: 48 },
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.lightCard,
    borderWidth: 2,
    borderColor: colors.lightBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerSection: { marginBottom: 24 },
  banner: { width: '100%', height: 120, borderRadius: 12 },
  bannerPlaceholder: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    backgroundColor: colors.lightCard,
    borderWidth: 2,
    borderColor: colors.lightBorder,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerPlaceholderText: { fontSize: 14, color: colors.lightSubtext, marginTop: 8 },
  changeLabel: { fontSize: 14, color: colors.gold, fontWeight: '600', marginTop: 8 },
  form: { gap: 16 },
  label: { fontSize: 14, fontWeight: '600', color: colors.lightText },
  input: {
    backgroundColor: colors.lightCard,
    borderWidth: 1,
    borderColor: colors.lightBorder,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.lightText,
  },
  bioInput: { minHeight: 88, textAlignVertical: 'top' },
});
