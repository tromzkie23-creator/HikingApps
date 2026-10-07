import { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { ApiError, clearToken, getHikes, getSavedUser, getToken, type HikeHistoryItem, type SessionUser } from '../../lib/api';
import { Btn } from '../../lib/ui';
import { C } from '../../lib/theme';

export default function Profile() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [hikes, setHikes] = useState<HikeHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const savedUser = await getSavedUser();
      const hasToken = Boolean(await getToken());
      setUser(hasToken ? savedUser : null);
      const userHikes = await getHikes();
      setHikes(userHikes);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not load your profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile])
  );

  async function logout() {
    await clearToken();
    router.replace('/');
  }

  const totalDistance = hikes.reduce((total, hike) => total + hike.km, 0).toFixed(1);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: 60, paddingHorizontal: 20 }}>
      <Text style={{ fontSize: 28, fontWeight: '800', color: C.spruce }}>Profile</Text>
      <View style={{ backgroundColor: C.white, borderRadius: 14, padding: 20, marginVertical: 20 }}>
        {loading ? (
          <ActivityIndicator color={C.spruce} />
        ) : error ? (
          <Text accessibilityRole="alert" style={{ color: C.ember }}>{error}</Text>
        ) : (
          <>
            <Text style={{ fontSize: 20, fontWeight: '700', color: C.ink }}>
              {user?.name ?? 'Browsing as guest'}
            </Text>
            <Text style={{ color: C.mute, marginTop: 14 }}>
              {hikes.length} hikes  |  {totalDistance} km total
            </Text>
            {!user && (
              <Text style={{ color: C.mute, marginTop: 8 }}>
                Sign in when the API is available to save hikes to your account.
              </Text>
            )}
          </>
        )}
      </View>
      <Btn alt t={user ? 'Log out' : 'Back to welcome'} onPress={() => void logout()} />
    </View>
  );
}
