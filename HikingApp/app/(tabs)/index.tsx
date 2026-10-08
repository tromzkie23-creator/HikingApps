import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';

import { ApiError, getTrails } from '../../lib/api';
import { getFavoriteTrailIds, toggleFavoriteTrail } from '../../lib/favorites';
import { C, type Trail } from '../../lib/theme';
import { TrailCard } from '../../components/trail-card';

const DIFFICULTY_FILTERS = ['All', 'Easy', 'Moderate', 'Hard', 'Under 5 km'] as const;
export default function Explore() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<(typeof DIFFICULTY_FILTERS)[number]>('All');
  const [trails, setTrails] = useState<Trail[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadExplore = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [favoriteIds, loadedTrails] = await Promise.all([getFavoriteTrailIds(), getTrails()]);
      setFavorites(favoriteIds);
      setTrails(loadedTrails);
    } catch (cause) {
      console.error('Could not load Explore trails:', cause);
      setError(cause instanceof ApiError ? cause.message : 'Could not load trails. Check your connection and try again.');
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
      const matchesQuery =
        !normalizedQuery ||
        `${trail.name} ${trail.area}`.toLowerCase().includes(normalizedQuery);
      const matchesDifficulty =
        difficultyFilter === 'All' ||
        (difficultyFilter === 'Under 5 km'
          ? trail.km < 5
          : trail.level.toLowerCase() === difficultyFilter.toLowerCase());
      return matchesQuery && matchesDifficulty;
    });
  }, [difficultyFilter, query, trails]);

  async function toggleFavorite(id: string) {
    try {
      setFavorites(await toggleFavoriteTrail(id));
    } catch (cause) {
      console.error(`Could not update favorite trail ${id}:`, cause);
      setError('Could not update saved trails. Please try again.');
    }
  }

  function clearFilters() {
    setQuery('');
    setDifficultyFilter('All');
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
                accessibilityLabel="Search trails by name or area"
                value={query}
                onChangeText={setQuery}
                placeholder="Search trails by name or area"
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
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 17, paddingBottom: 10 }}>
              {DIFFICULTY_FILTERS.map((item) => {
                const selected = difficultyFilter === item;
                return (
                  <Pressable
                    key={item}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setDifficultyFilter(item)}
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
              <Text style={{ fontSize: 18, fontWeight: '800', color: C.ink }}>Available trails</Text>
              <Text style={{ color: C.mute, fontSize: 12 }}>{filteredTrails.length} found</Text>
            </View>
            {!!error && (
              <View style={{ backgroundColor: '#FFF1EB', borderRadius: 14, padding: 14, marginBottom: 14, gap: 9 }}>
                <Text accessibilityRole="alert" style={{ color: C.ember, lineHeight: 19 }}>{error}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void loadExplore()}
                  style={{ alignSelf: 'flex-start', backgroundColor: C.white, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 }}>
                  <Text style={{ color: C.spruce, fontWeight: '800' }}>Retry</Text>
                </Pressable>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ alignItems: 'center', padding: 30, gap: 10 }}>
              <ActivityIndicator color={C.spruce} />
              <Text style={{ color: C.mute }}>Loading trails…</Text>
            </View>
          ) : error ? null : (
            <View style={{ alignItems: 'center', paddingVertical: 22, gap: 12 }}>
              <Text style={{ color: C.mute, textAlign: 'center' }}>No trails match</Text>
              <Pressable accessibilityRole="button" onPress={clearFilters}>
                <Text style={{ color: C.spruce, fontWeight: '800' }}>Clear filters</Text>
              </Pressable>
            </View>
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
