import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';

import { TrailCard } from '../../components/trail-card';
import { ApiError, getTrails } from '../../lib/api';
import { getFavoriteTrailIds, toggleFavoriteTrail } from '../../lib/favorites';
import { getOfflineTrails } from '../../lib/offline-trails';
import { C, type Trail } from '../../lib/theme';

export default function Plans() {
  const router = useRouter();
  const [trails, setTrails] = useState<Trail[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPlans = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [saved, available] = await Promise.all([getFavoriteTrailIds(), getTrails()]);
      setFavorites(saved);
      setTrails(available);
    } catch (cause) {
      try {
        setFavorites(await getFavoriteTrailIds());
        setTrails(getOfflineTrails());
        setError(cause instanceof ApiError ? 'Showing saved trails from the offline guide.' : 'Showing saved trails from this device.');
      } catch {
        setError('Could not load your saved trails. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadPlans();
  }, [loadPlans]));

  async function removeFavorite(id: string) {
    try {
      setFavorites(await toggleFavoriteTrail(id));
    } catch {
      setError('Could not update your saved trails.');
    }
  }

  const plannedTrails = trails.filter((trail) => favorites.includes(trail.id));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <FlatList
        data={plannedTrails}
        keyExtractor={(trail) => trail.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 58, paddingBottom: 28, flexGrow: 1 }}
        ListHeaderComponent={
          <View style={{ marginBottom: 18 }}>
            <Text style={{ color: C.mute, fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>YOUR SHORTLIST</Text>
            <Text style={{ color: C.spruce, fontSize: 30, fontWeight: '900', marginTop: 5 }}>Hike plans</Text>
            <Text style={{ color: C.mute, marginTop: 6 }}>Trails you have saved for your next adventure.</Text>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 220 }}>
              <ActivityIndicator color={C.spruce} />
              <Text style={{ color: C.mute }}>Loading your plans…</Text>
            </View>
          ) : plannedTrails.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: 280 }}>
              <Ionicons name="bookmark-outline" size={42} color={C.moss} />
              <Text style={{ color: C.ink, fontSize: 18, fontWeight: '800' }}>Your plans start here</Text>
              <Text style={{ color: C.mute, textAlign: 'center' }}>Tap the heart on any trail to keep it on your shortlist.</Text>
              <Pressable accessibilityRole="button" onPress={() => router.navigate('/(tabs)' as Href)}>
                <Text style={{ color: C.spruce, fontWeight: '800', padding: 10 }}>Explore trails</Text>
              </Pressable>
              {!!error && <Text accessibilityRole="alert" style={{ color: C.ember }}>{error}</Text>}
              <Pressable accessibilityRole="button" onPress={() => void loadPlans()}>
                <Text style={{ color: C.mute, padding: 6 }}>Refresh</Text>
              </Pressable>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <TrailCard
            trail={item}
            favorite
            onPress={() => router.push(`/trail/${item.id}` as Href)}
            onToggleFavorite={() => void removeFavorite(item.id)}
            compact
          />
        )}
        refreshing={loading}
        onRefresh={() => void loadPlans()}
      />
    </View>
  );
}
