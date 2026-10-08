import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';

import { ApiError, deleteHike, getHikes, type HikeHistoryItem } from '../../lib/api';
import { C } from '../../lib/theme';

function formatDuration(seconds: number | undefined, fallback: string) {
  if (seconds === undefined) return fallback;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export default function History() {
  const router = useRouter();
  const [hikes, setHikes] = useState<HikeHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setHikes(await getHikes());
    } catch (cause) {
      console.error('Could not load hike history:', cause);
      setError(cause instanceof ApiError ? cause.message : 'Could not load hike history. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadHistory();
  }, [loadHistory]));

  function confirmDelete(hike: HikeHistoryItem) {
    const name = hike.name ?? hike.trail;
    Alert.alert(
      'Delete this hike?',
      `“${name}” will be removed from your history${hike.synced ? ' and your account' : ' on this device'}. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void removeHike(hike),
        },
      ]
    );
  }

  async function removeHike(hike: HikeHistoryItem) {
    setDeletingId(hike.id);
    setError('');
    try {
      await deleteHike(hike.id, hike.synced);
      setHikes((current) => current.filter((item) => item.id !== hike.id));
    } catch (cause) {
      console.error(`Could not delete hike ${hike.id}:`, cause);
      setError(cause instanceof ApiError ? cause.message : 'Could not delete this hike. Please try again.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <FlatList
        data={hikes}
        keyExtractor={(hike) => hike.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 58, paddingBottom: 30, flexGrow: 1 }}
        refreshing={loading}
        onRefresh={() => void loadHistory()}
        ListHeaderComponent={
          <View style={{ marginBottom: 18 }}>
            <Text style={{ color: C.mute, fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>YOUR RECORDED ROUTES</Text>
            <Text style={{ color: C.spruce, fontSize: 30, fontWeight: '900', marginTop: 5 }}>Hike history</Text>
            <Text style={{ color: C.mute, marginTop: 6 }}>Open a hike to see its recorded GPS path.</Text>
            {!!error && (
              <View style={{ backgroundColor: '#FFF1EB', borderRadius: 14, padding: 14, gap: 9, marginTop: 14 }}>
                <Text accessibilityRole="alert" style={{ color: C.ember }}>{error}</Text>
                <Pressable accessibilityRole="button" onPress={() => void loadHistory()}>
                  <Text style={{ color: C.spruce, fontWeight: '800' }}>Retry</Text>
                </Pressable>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <ActivityIndicator color={C.spruce} />
              <Text style={{ color: C.mute }}>Loading your hikes…</Text>
            </View>
          ) : !error ? (
            <View style={{ minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <Ionicons name="footsteps-outline" size={40} color={C.moss} />
              <Text style={{ color: C.ink, fontSize: 17, fontWeight: '800' }}>No hikes recorded yet</Text>
              <Text style={{ color: C.mute, textAlign: 'center' }}>Finished hikes and their paths will appear here.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: 16, marginBottom: 11, borderWidth: 1, borderColor: C.line }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`View ${item.name ?? item.trail}, ${item.km.toFixed(2)} kilometers, recorded ${item.date}`}
              onPress={() => router.push(`/hike/${encodeURIComponent(item.id)}` as Href)}
              style={{ flex: 1, padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <Text numberOfLines={1} style={{ flex: 1, color: C.ink, fontSize: 17, fontWeight: '800' }}>{item.name ?? item.trail}</Text>
                <Ionicons name="chevron-forward" size={19} color={C.mute} />
              </View>
              <Text style={{ color: C.mute, fontSize: 12, marginTop: 5 }}>
                {item.date} · {item.km.toFixed(2)} km · {formatDuration(item.durationSecs, item.time)}
              </Text>
              <Text style={{ color: item.pendingSync ? C.ember : C.spruce, fontSize: 11, fontWeight: '700', marginTop: 9 }}>
                {item.pendingSync ? 'Saved on device · will retry sync' : item.synced ? 'Synced' : 'Saved on this device'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Delete ${item.name ?? item.trail}`}
              accessibilityState={{ disabled: deletingId === item.id }}
              disabled={deletingId === item.id}
              onPress={() => confirmDelete(item)}
              hitSlop={8}
              style={{ width: 48, height: 54, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
              {deletingId === item.id
                ? <ActivityIndicator color={C.ember} />
                : <Ionicons name="trash-outline" size={20} color={C.ember} />}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Share ${item.name ?? item.trail} to feed`}
              onPress={() => router.push(`/create-post?hike_id=${encodeURIComponent(item.id)}` as Href)}
              hitSlop={8}
              style={{ width: 44, height: 54, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
              <Ionicons name="share-social-outline" size={20} color={C.spruce} />
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}
