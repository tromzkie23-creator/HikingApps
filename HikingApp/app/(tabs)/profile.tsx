import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import {
  ApiError,
  changePassword,
  clearToken,
  getSocialProfile,
  getSavedUser,
  getToken,
  getTrailStats,
  updateSocialProfile,
  uploadSocialPhoto,
  type SessionUser,
  type TrailStats,
} from '../../lib/api';
import { C } from '../../lib/theme';

const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function StatTile({ icon, label, value, unit }: { icon: ComponentProps<typeof Ionicons>['name']; label: string; value: string; unit: string }) {
  return (
    <View style={{ flex: 1, minWidth: '46%', backgroundColor: C.white, borderRadius: 17, padding: 15, borderWidth: 1, borderColor: C.line }}>
      <Ionicons name={icon} size={19} color={C.moss} />
      <Text style={{ color: C.ink, fontSize: 23, fontWeight: '900', marginTop: 12 }}>{value}</Text>
      <Text style={{ color: C.mute, fontSize: 11, marginTop: 2 }}>{unit} {label}</Text>
    </View>
  );
}

function formatMovingTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toLocaleUpperCase())
    .join('') || 'TH';
}

export default function Profile() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [stats, setStats] = useState<TrailStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', bio: '' });
  const [profileMessage, setProfileMessage] = useState('');
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordForm, setPasswordForm] = useState({
    current: '',
    next: '',
    confirmation: '',
  });

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError('');
    setSettingsError('');
    try {
      const [savedUser, token] = await Promise.all([getSavedUser(), getToken()]);
      const activeUser = token ? savedUser : null;
      setUser(activeUser);
      if (token) {
        const [profileResult, statsResult] = await Promise.allSettled([getSocialProfile(), getTrailStats()]);
        if (profileResult.status === 'fulfilled') {
          setUser(profileResult.value);
          setProfileForm({ name: profileResult.value.name, bio: profileResult.value.bio ?? '' });
        } else {
          setSettingsError(
            profileResult.reason instanceof ApiError
              ? profileResult.reason.message
              : 'Could not load your profile. Please try again.'
          );
        }
        if (statsResult.status === 'fulfilled') {
          setStats(statsResult.value);
        } else {
          setStats(null);
          setError(
            statsResult.reason instanceof ApiError
              ? statsResult.reason.message
              : 'Could not load your hiking stats. Please try again.'
          );
        }
      } else {
        setStats(null);
        setError('Sign in to view your hiking stats.');
      }
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not load your hiking stats. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadStats();
  }, [loadStats]));

  async function logout() {
    await clearToken();
    router.replace('/');
  }

  async function chooseProfilePhoto() {
    setSettingsError('');
    setProfileMessage('');
    if (!user) {
      setSettingsError('Sign in to upload a profile picture.');
      return;
    }
    setProfileBusy(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.uri) throw new Error('The image picker returned no image.');
      const context = ImageManipulator.manipulate(asset.uri);
      context.resize({ width: 512, height: 512 });
      const processedImage = await context.renderAsync();
      const jpeg = await processedImage.saveAsync({
        compress: 0.7,
        format: SaveFormat.JPEG,
      });
      const avatarUrl = await uploadSocialPhoto(jpeg.uri);
      const updatedUser = await updateSocialProfile({ avatarUrl });
      setUser(updatedUser);
      setProfileMessage('Profile picture updated.');
    } catch (cause) {
      console.error('Could not save profile photo:', cause);
      setSettingsError(cause instanceof ApiError ? cause.message : 'Could not save your photo. Please try again.');
    } finally {
      setProfileBusy(false);
    }
  }

  async function removeProfilePhoto() {
    if (!user) return;
    setProfileBusy(true);
    try {
      const updatedUser = await updateSocialProfile({ avatarUrl: null });
      setUser(updatedUser);
      setSettingsError('');
      setProfileMessage('Profile picture removed.');
    } catch (cause) {
      console.error('Could not remove profile photo:', cause);
      setSettingsError(cause instanceof ApiError ? cause.message : 'Could not remove your photo. Please try again.');
    } finally {
      setProfileBusy(false);
    }
  }

  async function saveProfileDetails() {
    setProfileMessage('');
    setSettingsError('');
    const name = profileForm.name.trim();
    const bio = profileForm.bio.trim();
    if (name.length < 1 || name.length > 100) {
      setSettingsError('Name must be between 1 and 100 characters.');
      return;
    }
    if (bio.length > 300) {
      setSettingsError('Bio must be 300 characters or fewer.');
      return;
    }
    setProfileBusy(true);
    try {
      const updatedUser = await updateSocialProfile({ name, bio: bio || null });
      setUser(updatedUser);
      setProfileForm({ name: updatedUser.name, bio: updatedUser.bio ?? '' });
      setProfileMessage('Profile updated.');
    } catch (cause) {
      setSettingsError(cause instanceof ApiError ? cause.message : 'Could not save your profile. Please try again.');
    } finally {
      setProfileBusy(false);
    }
  }

  async function submitPasswordChange() {
    setPasswordMessage('');
    setSettingsError('');
    if (!passwordForm.current || passwordForm.next.length < 6) {
      setSettingsError('Enter your current password and a new password with at least 6 characters.');
      return;
    }
    if (passwordForm.next !== passwordForm.confirmation) {
      setSettingsError('Your new password and confirmation do not match.');
      return;
    }

    setPasswordBusy(true);
    try {
      await changePassword(passwordForm.current, passwordForm.next);
      setPasswordForm({ current: '', next: '', confirmation: '' });
      setPasswordMessage('Password updated successfully.');
      setPasswordOpen(false);
    } catch (cause) {
      setSettingsError(cause instanceof ApiError ? cause.message : 'Could not change your password. Please try again.');
    } finally {
      setPasswordBusy(false);
    }
  }

  const monthlyValues = useMemo(() => stats?.monthlyDistance ?? [], [stats]);
  const maxMonthKm = Math.max(1, ...monthlyValues.map((month) => month.distanceKm));
  const peakMonthIndex = monthlyValues.reduce(
    (best, month, index, all) => month.distanceKm > (all[best]?.distanceKm ?? 0) ? index : best,
    -1
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 58, paddingBottom: 35 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text style={{ color: C.mute, fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>YOUR TRAIL STORY</Text>
          <Text style={{ color: C.spruce, fontSize: 30, fontWeight: '900', marginTop: 5 }}>Profile</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={user ? 'Log out' : 'Return to welcome'} onPress={() => void logout()} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#E3EBDD', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={user ? 'log-out-outline' : 'person-outline'} size={21} color={C.spruce} />
        </Pressable>
      </View>
      <Text style={{ color: C.mute, marginTop: 5, marginBottom: 19 }}>{user?.name ?? 'Hiking as a guest'}</Text>

      <Text style={{ color: C.ink, fontSize: 19, fontWeight: '800', marginBottom: 12 }}>Profile settings</Text>
      <View style={{ backgroundColor: C.white, borderRadius: 19, borderWidth: 1, borderColor: C.line, padding: 17 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, overflow: 'hidden', backgroundColor: '#E3EBDD', alignItems: 'center', justifyContent: 'center' }}>
            {user?.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={{ width: 72, height: 72 }} />
            ) : (
              <Text style={{ color: C.spruce, fontSize: 24, fontWeight: '900' }}>{getInitials(user?.name ?? '')}</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.ink, fontSize: 15, fontWeight: '800' }}>Profile picture</Text>
            <Text style={{ color: C.mute, fontSize: 12, marginTop: 4 }}>
              {user ? 'Your photo appears on your feed posts.' : 'Sign in to upload a profile picture.'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 14, marginTop: 9 }}>
              <Pressable
                accessibilityRole="button"
                disabled={profileBusy || !user}
                onPress={() => void chooseProfilePhoto()}>
                <Text style={{ color: user ? C.spruce : C.mute, fontWeight: '800' }}>
                  {profileBusy ? 'Uploading…' : user?.avatar_url ? 'Change photo' : 'Add photo'}
                </Text>
              </Pressable>
              {user?.avatar_url && (
                <Pressable
                  accessibilityRole="button"
                  disabled={profileBusy}
                  onPress={() => void removeProfilePhoto()}>
                  <Text style={{ color: C.ember, fontWeight: '700' }}>Remove</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>

        <View style={{ height: 1, backgroundColor: C.line, marginVertical: 17 }} />
        <Text style={{ color: C.ink, fontSize: 15, fontWeight: '800' }}>About you</Text>
        {user ? (
          <View style={{ marginTop: 12, gap: 11 }}>
            <View>
              <Text style={{ color: C.ink, fontSize: 13, fontWeight: '700', marginBottom: 6 }}>Name</Text>
              <TextInput
                accessibilityLabel="Profile name"
                value={profileForm.name}
                onChangeText={(name) => setProfileForm((form) => ({ ...form, name }))}
                maxLength={100}
                placeholder="Your name"
                placeholderTextColor={C.mute}
                autoCapitalize="words"
                style={{ borderWidth: 1, borderColor: C.line, backgroundColor: C.bg, color: C.ink, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 12 }}
              />
            </View>
            <View>
              <Text style={{ color: C.ink, fontSize: 13, fontWeight: '700', marginBottom: 6 }}>Bio</Text>
              <TextInput
                accessibilityLabel="Profile bio"
                value={profileForm.bio}
                onChangeText={(bio) => setProfileForm((form) => ({ ...form, bio }))}
                maxLength={300}
                multiline
                textAlignVertical="top"
                placeholder="Tell hikers a little about yourself"
                placeholderTextColor={C.mute}
                style={{ minHeight: 82, borderWidth: 1, borderColor: C.line, backgroundColor: C.bg, color: C.ink, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 12 }}
              />
              <Text style={{ color: C.mute, fontSize: 11, textAlign: 'right', marginTop: 4 }}>{profileForm.bio.length}/300</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={profileBusy}
              onPress={() => void saveProfileDetails()}
              style={{ backgroundColor: profileBusy ? C.mute : C.spruce, padding: 13, borderRadius: 11, alignItems: 'center' }}>
              {profileBusy ? (
                <ActivityIndicator color={C.white} />
              ) : (
                <Text style={{ color: C.white, fontWeight: '800' }}>Save profile</Text>
              )}
            </Pressable>
          </View>
        ) : (
          <Text style={{ color: C.mute, fontSize: 13, marginTop: 8 }}>Sign in to edit your name and bio.</Text>
        )}

        <View style={{ height: 1, backgroundColor: C.line, marginVertical: 17 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.ink, fontSize: 15, fontWeight: '800' }}>Password</Text>
            <Text style={{ color: C.mute, fontSize: 12, marginTop: 4 }}>
              {user ? 'Keep your account secure with a new password.' : 'Sign in to change your password.'}
            </Text>
          </View>
          {user && (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setSettingsError('');
                setPasswordMessage('');
                setPasswordOpen((open) => !open);
              }}
              style={{ paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#E3EBDD' }}>
              <Text style={{ color: C.spruce, fontWeight: '800' }}>{passwordOpen ? 'Cancel' : 'Change'}</Text>
            </Pressable>
          )}
        </View>

        {user && passwordOpen && (
          <View style={{ marginTop: 16, gap: 11 }}>
            {([
              { key: 'current', label: 'Current password', placeholder: 'Enter current password' },
              { key: 'next', label: 'New password', placeholder: 'At least 6 characters' },
              { key: 'confirmation', label: 'Confirm new password', placeholder: 'Enter it again' },
            ] as const).map((field) => (
              <View key={field.key}>
                <Text style={{ color: C.ink, fontSize: 13, fontWeight: '700', marginBottom: 6 }}>{field.label}</Text>
                <TextInput
                  accessibilityLabel={field.label}
                  value={passwordForm[field.key]}
                  onChangeText={(value) => setPasswordForm((form) => ({ ...form, [field.key]: value }))}
                  placeholder={field.placeholder}
                  placeholderTextColor={C.mute}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType={field.key === 'current' ? 'password' : 'newPassword'}
                  style={{ borderWidth: 1, borderColor: C.line, backgroundColor: C.bg, color: C.ink, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 12 }}
                />
              </View>
            ))}
            <Pressable
              accessibilityRole="button"
              disabled={passwordBusy}
              onPress={() => void submitPasswordChange()}
              style={{ backgroundColor: passwordBusy ? C.mute : C.spruce, padding: 14, borderRadius: 11, alignItems: 'center', marginTop: 2 }}>
              {passwordBusy ? (
                <ActivityIndicator color={C.white} />
              ) : (
                <Text style={{ color: C.white, fontWeight: '800' }}>Update password</Text>
              )}
            </Pressable>
          </View>
        )}
        {!!profileMessage && <Text accessibilityLiveRegion="polite" style={{ color: C.spruce, marginTop: 13 }}>{profileMessage}</Text>}
        {!!passwordMessage && <Text accessibilityLiveRegion="polite" style={{ color: C.spruce, marginTop: 13 }}>{passwordMessage}</Text>}
        {!!settingsError && <Text accessibilityRole="alert" style={{ color: C.ember, marginTop: 13 }}>{settingsError}</Text>}
      </View>

      {loading ? (
        <View style={{ padding: 35, alignItems: 'center', gap: 12 }}>
          <ActivityIndicator color={C.spruce} />
          <Text style={{ color: C.mute }}>Gathering your trail stats…</Text>
        </View>
      ) : error || !stats ? (
        <View style={{ backgroundColor: C.white, borderRadius: 16, padding: 18, gap: 12 }}>
          <Text accessibilityRole="alert" style={{ color: C.ember }}>{error || 'Stats are unavailable.'}</Text>
          <Pressable accessibilityRole="button" onPress={() => user ? void loadStats() : router.replace('/')}>
            <Text style={{ color: C.spruce, fontWeight: '800' }}>{user ? 'Try again' : 'Sign in'}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <StatTile icon="footsteps-outline" label="hikes" value={`${stats.lifetime.hikes}`} unit="" />
            <StatTile icon="navigate-outline" label="distance" value={stats.lifetime.distanceKm.toFixed(1)} unit="km" />
            <StatTile icon="time-outline" label="moving time" value={formatMovingTime(stats.lifetime.movingTimeSecs)} unit="" />
            <StatTile icon="flame-outline" label="calories · est." value={`${stats.lifetime.caloriesEstimate}`} unit="kcal" />
          </View>

          <View style={{ backgroundColor: C.white, borderRadius: 19, borderWidth: 1, borderColor: C.line, padding: 17, marginTop: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: C.ink, fontSize: 17, fontWeight: '800' }}>This year</Text>
              <Text style={{ color: C.mute, fontSize: 12 }}>{stats.year} · km</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 145, marginTop: 20, gap: 5 }}>
              {monthlyValues.map((month, index) => {
                const peak = month.distanceKm > 0 && index === peakMonthIndex;
                return (
                  <View key={month.month} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 7 }}>
                    <View style={{ width: '72%', height: Math.max(5, month.distanceKm ? (month.distanceKm / maxMonthKm) * 105 : 5), borderRadius: 6, backgroundColor: peak ? C.ember : month.distanceKm ? C.moss : '#E8ECE4' }} />
                    <Text style={{ color: peak ? C.ember : C.mute, fontSize: 9, fontWeight: peak ? '800' : '500' }}>{monthLabels[month.month - 1]}</Text>
                  </View>
                );
              })}
            </View>
            {peakMonthIndex >= 0 && (
              <Text style={{ color: C.mute, fontSize: 12, marginTop: 10 }}>
                Peak month: <Text style={{ color: C.spruce, fontWeight: '800' }}>{monthLabels[monthlyValues[peakMonthIndex].month - 1]}</Text> · {monthlyValues[peakMonthIndex].distanceKm.toFixed(1)} km
              </Text>
            )}
          </View>

          <Text style={{ color: C.ink, fontSize: 18, fontWeight: '800', marginTop: 23, marginBottom: 12 }}>Personal bests</Text>
          {[
            { icon: 'trail-sign-outline' as const, label: 'Longest hike', value: stats.personalBests.longestHike ? `${stats.personalBests.longestHike.distanceKm.toFixed(1)} km` : '—', detail: stats.personalBests.longestHike?.trail ?? 'Complete a hike to set a best' },
            { icon: 'trending-up-outline' as const, label: 'Most climb · est.', value: stats.personalBests.mostClimb ? `${stats.personalBests.mostClimb.estimatedGainM} m` : '—', detail: stats.personalBests.mostClimb?.trail ?? 'Trail elevation when available' },
            { icon: 'time-outline' as const, label: 'Longest time', value: stats.personalBests.longestTime ? formatMovingTime(stats.personalBests.longestTime.durationSecs) : '—', detail: stats.personalBests.longestTime?.trail ?? 'Complete a hike to set a best' },
            { icon: 'flame-outline' as const, label: 'Calories · est.', value: stats.personalBests.calories ? `${stats.personalBests.calories.caloriesEstimate} kcal` : '—', detail: stats.personalBests.calories?.trail ?? 'Estimated at 55 kcal per km' },
          ].map((best) => (
            <View key={best.label} style={{ backgroundColor: C.white, borderRadius: 15, borderWidth: 1, borderColor: C.line, padding: 15, marginBottom: 9, flexDirection: 'row', alignItems: 'center', gap: 13 }}>
              <Ionicons name={best.icon} size={20} color={C.moss} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.mute, fontSize: 11 }}>{best.label}</Text>
                <Text style={{ color: C.ink, fontWeight: '700', marginTop: 3 }}>{best.detail}</Text>
              </View>
              <Text style={{ color: C.spruce, fontSize: 16, fontWeight: '900' }}>{best.value}</Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}
