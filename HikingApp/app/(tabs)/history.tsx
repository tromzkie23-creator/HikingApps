import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';

import { ApiError, getHikes, getToken, type HikeHistoryItem } from '../../lib/api';
import { C } from '../../lib/theme';
import { Btn } from '../../lib/ui';

export default function History() {
  const router = useRouter();
  const [hikes, setHikes] = useState<HikeHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [guestMode, setGuestMode] = useState(false);

  const loadHikes = useCallback(async () => {
    setLoading(true);
    setError('');
    setGuestMode(false);
    try {
      setGuestMode(!(await getToken()));
      setHikes(await getHikes());
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not load your hike history. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadHikes();
    }, [loadHikes])
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: 60, paddingHorizontal: 20 }}>
      <Text style={{ fontSize: 28, fontWeight: '800', color: C.spruce, marginBottom: 16 }}>
        Hike history
      </Text>
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 }}>
          <ActivityIndicator color={C.spruce} />
          <Text style={{ color: C.mute }}>Loading your hikes…</Text>
        </View>
      ) : error ? (
        <View style={{ paddingVertical: 24, gap: 14 }}>
          <Text accessibilityRole="alert" style={{ color: C.ember }}>{error}</Text>
          <Pressable onPress={() => void loadHikes()}>
            <Text style={{ color: C.spruce, fontWeight: '700' }}>Tap to try again</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {guestMode && (
            <View style={{ gap: 12, marginBottom: 16 }}>
              <Text style={{ color: C.mute }}>
                You can browse and track trails as a guest. Sign in to save hikes when the API is available.
              </Text>
              <Btn alt t="Back to welcome" onPress={() => router.replace('/' as Href)} />
            </View>
          )}
          <FlatList
            data={hikes}
            keyExtractor={(hike) => hike.id}
            ListEmptyComponent={<Text style={{ color: C.mute }}>No hikes yet. Pick a trail and start one.</Text>}
            renderItem={({ item: hike }) => (
              <View style={{ backgroundColor: C.white, borderRadius: 14, padding: 16, marginBottom: 12 }}>
                <Text style={{ fontSize: 17, fontWeight: '700', color: C.ink }}>{hike.trail}</Text>
                <Text style={{ color: C.mute, marginTop: 2 }}>{hike.date}</Text>
                <Text style={{ marginTop: 8, color: C.ink }}>
                  {hike.km.toFixed(1)} km  |  {hike.time}
                </Text>
                <Text style={{ marginTop: 6, color: hike.synced ? C.moss : C.ember, fontWeight: '600' }}>
                  {hike.synced ? 'Synced' : 'Saved on this phone, waiting to sync'}
                </Text>
              </View>
            )}
          />
        </>
      )}
    </View>
  );
}
