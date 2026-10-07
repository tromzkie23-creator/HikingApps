import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';

import { ApiError, getTrails } from '../../lib/api';
import { getFavoriteTrailIds, toggleFavoriteTrail } from '../../lib/favorites';
import { getOfflineTrails } from '../../lib/offline-trails';
import { getTrailPresentation } from '../../lib/trail-presentation';
import { C, type Trail } from '../../lib/theme';
import { TrailCard } from '../../components/trail-card';

const FILTERS = ['All trails', 'Easy', 'Moderate', 'Hard', 'Under 5 km', 'Waterfall', 'Camping', 'Views', 'Wildflowers'];

export default function Explore() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All trails');
  const [trails, setTrails] = useState<Trail[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [usingOfflineTrails, setUsingOfflineTrails] = useState(false);

  const loadExplore = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [favoriteIds, loadedTrails] = await Promise.all([getFavoriteTrailIds(), getTrails()]);
      setFavorites(favoriteIds);
      setTrails(loadedTrails);
      setUsingOfflineTrails(false);
    } catch (cause) {
      try {
        const favoriteIds = await getFavoriteTrailIds();
        setFavorites(favoriteIds);
        setTrails(getOfflineTrails());
        setUsingOfflineTrails(true);
        setError(cause instanceof ApiError ? cause.message : 'Showing built-in trails because the API is unavailable.');
      } catch {
        setError('Could not load saved trails. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadExplore();
    }, [loadExplore])
  );

  const filteredTrails = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return trails.filter((trail) => {
      const presentation = getTrailPresentation(trail);
      const matchesQuery =
        !normalizedQuery ||
        `${trail.name} ${trail.area} ${presentation.park} ${presentation.tags.join(' ')}`
          .toLowerCase()
          .includes(normalizedQuery);
      const matchesFilter =
        filter === 'All trails' ||
        trail.level.toLowerCase() === filter.toLowerCase() ||
        (filter === 'Under 5 km' && trail.km < 5) ||
        presentation.tags.some((tag) => tag.toLowerCase() === filter.toLowerCase());
      return matchesQuery && matchesFilter;
    });
  }, [filter, query, trails]);

  async function toggleFavorite(id: string) {
    try {
      setFavorites(await toggleFavoriteTrail(id));
    } catch {
      setError('Could not update saved trails. Please try again.');
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <FlatList
        data={filteredTrails}
        keyExtractor={(trail) => trail.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 58, paddingBottom: 30 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ color: C.mute, fontSize: 12, fontWeight: '700', letterSpacing: 1.2 }}>YOUR NEXT ADVENTURE</Text>
                <Text style={{ color: C.spruce, fontSize: 30, fontWeight: '900', marginTop: 5 }}>Explore trails</Text>
              </View>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#E3EBDD', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="compass-outline" size={23} color={C.spruce} />
              </View>
            </View>
            <View style={{ marginTop: 20, flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: 15, paddingHorizontal: 14, borderWidth: 1, borderColor: C.line }}>
              <Ionicons name="search" size={19} color={C.mute} />
              <TextInput
                accessibilityLabel="Search trails, parks, and peaks"
                value={query}
                onChangeText={setQuery}
                placeholder="Search trails, parks, peaks"
                placeholderTextColor={C.mute}
                returnKeyType="search"
                style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 10, color: C.ink, fontSize: 14 }}
              />
              {!!query && (
                <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')}>
                  <Ionicons name="close-circle" size={19} color={C.mute} />
                </Pressable>
              )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 17 }}>
              {FILTERS.map((item) => {
                const selected = filter === item;
                return (
                  <Pressable
                    key={item}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setFilter(item)}
                    style={{
                      backgroundColor: selected ? C.spruce : C.white,
                      borderColor: selected ? C.spruce : C.line,
                      borderWidth: 1,
                      borderRadius: 22,
                      paddingHorizontal: 15,
                      paddingVertical: 9,
                    }}>
                    <Text style={{ color: selected ? C.white : C.ink, fontSize: 13, fontWeight: '700' }}>{item}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: C.ink }}>Nearby trails</Text>
              <Text style={{ color: C.mute, fontSize: 12 }}>{filteredTrails.length} found</Text>
            </View>
            {usingOfflineTrails && (
              <Text style={{ color: C.mute, fontSize: 12, marginBottom: 12 }}>
                Offline trail guide · online account features need a connection.
              </Text>
            )}
            {!!error && usingOfflineTrails && (
              <Text accessibilityRole="alert" style={{ color: C.mute, fontSize: 12, marginBottom: 12 }}>{error}</Text>
            )}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ alignItems: 'center', padding: 30, gap: 10 }}>
              <ActivityIndicator color={C.spruce} />
              <Text style={{ color: C.mute }}>Finding trails…</Text>
            </View>
          ) : error && !trails.length ? (
            <View style={{ padding: 18, gap: 12 }}>
              <Text accessibilityRole="alert" style={{ color: C.ember }}>{error}</Text>
              <Pressable accessibilityRole="button" onPress={() => void loadExplore()}>
                <Text style={{ color: C.spruce, fontWeight: '800' }}>Try again</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={{ color: C.mute, paddingVertical: 20 }}>No trails match. Try another filter or search.</Text>
          )
        }
        renderItem={({ item: trail }) => (
          <TrailCard
            trail={trail}
            favorite={favorites.includes(trail.id)}
            onPress={() => router.push(`/trail/${trail.id}` as Href)}
            onToggleFavorite={() => void toggleFavorite(trail.id)}
          />
        )}
        refreshing={loading}
        onRefresh={() => void loadExplore()}
      />
    </View>
  );
}
