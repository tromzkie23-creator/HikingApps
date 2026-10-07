import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';

import { TrailCard } from '../../components/trail-card';
import { ApiError, getTrails } from '../../lib/api';
import { getFavoriteTrailIds, toggleFavoriteTrail } from '../../lib/favorites';
import { getOfflineTrails } from '../../lib/offline-trails';
import { C, type Trail } from '../../lib/theme';

export default function Record() {
  const router = useRouter();
  const [trails, setTrails] = useState<Trail[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadTrails = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [available, saved] = await Promise.all([getTrails(), getFavoriteTrailIds()]);
      setTrails(available);
      setFavorites(saved);
    } catch (cause) {
      setTrails(getOfflineTrails());
      let fallbackMessage =
        cause instanceof ApiError ? 'Offline guide · recorded hikes can be saved on this device.' : 'Showing built-in trails.';
      try {
        setFavorites(await getFavoriteTrailIds());
      } catch {
        fallbackMessage = `${fallbackMessage} Saved status could not be loaded.`;
      }
      setError(fallbackMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  async function toggleFavorite(id: string) {
    try {
      setFavorites(await toggleFavoriteTrail(id));
    } catch {
      setError('Could not update saved trails.');
    }
  }

  useFocusEffect(useCallback(() => {
    void loadTrails();
  }, [loadTrails]));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <FlatList
        data={trails}
        keyExtractor={(trail) => trail.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 58, paddingBottom: 28 }}
        ListHeaderComponent={
          <View style={{ marginBottom: 18 }}>
            <Text style={{ color: C.mute, fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>MAKE IT A HIKE</Text>
            <Text style={{ color: C.spruce, fontSize: 30, fontWeight: '900', marginTop: 5 }}>Record</Text>
            <Text style={{ color: C.mute, marginTop: 6 }}>Choose a trail to start tracking your time and distance.</Text>
            {!!error && <Text style={{ color: C.mute, marginTop: 10 }}>{error}</Text>}
          </View>
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', padding: 28, gap: 10 }}>
            {loading ? <ActivityIndicator color={C.spruce} /> : <Text accessibilityRole="alert" style={{ color: C.ember }}>{error || 'No trails are available.'}</Text>}
            {!loading && <Text style={{ color: C.spruce, fontWeight: '700' }} onPress={() => void loadTrails()}>Tap to try again</Text>}
          </View>
        }
        renderItem={({ item }) => (
          <TrailCard
            trail={item}
            favorite={favorites.includes(item.id)}
            onPress={() => router.push(`/navigate/${item.id}` as Href)}
            onToggleFavorite={() => void toggleFavorite(item.id)}
          />
        )}
        refreshing={loading}
        onRefresh={() => void loadTrails()}
      />
    </View>
  );
}
