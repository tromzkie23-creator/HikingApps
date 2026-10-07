import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';

import { ApiError, getTrails } from '../../lib/api';
import { C, type Trail } from '../../lib/theme';
import { getOfflineTrails } from '../../lib/offline-trails';

const LEVELS = ['All', 'Easy', 'Moderate', 'Hard'];

export default function Trails() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState('All');
  const [trails, setTrails] = useState<Trail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [usingOfflineTrails, setUsingOfflineTrails] = useState(false);

  const loadTrails = useCallback(async () => {
    setLoading(true);
    setError('');
    setUsingOfflineTrails(false);
    try {
      setTrails(await getTrails());
    } catch (cause) {
      setTrails(getOfflineTrails());
      setUsingOfflineTrails(true);
      setError(cause instanceof ApiError ? cause.message : 'The Trailhead API is unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadTrails();
    }, [loadTrails])
  );

  const filteredTrails = trails.filter(
    (trail) =>
      `${trail.name} ${trail.area}`.toLowerCase().includes(query.toLowerCase()) &&
      (level === 'All' || trail.level === level)
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: 60, paddingHorizontal: 20 }}>
      <Text style={{ fontSize: 28, fontWeight: '800', color: C.spruce }}>Choose a trail</Text>
      {usingOfflineTrails && (
        <Text style={{ color: C.mute, marginTop: 6 }}>
          Showing built-in trails while the API is unavailable. Sign-in and hike syncing need the API.
        </Text>
      )}
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search trails"
        placeholderTextColor={C.mute}
        style={{
          backgroundColor: C.white,
          borderWidth: 1,
          borderColor: C.line,
          borderRadius: 10,
          padding: 12,
          marginVertical: 14,
        }}
      />
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
        {LEVELS.map((item) => (
          <Pressable
            key={item}
            accessibilityRole="button"
            accessibilityState={{ selected: level === item }}
            onPress={() => setLevel(item)}
            style={{
              paddingVertical: 7,
              paddingHorizontal: 14,
              borderRadius: 20,
              backgroundColor: level === item ? C.spruce : C.white,
              borderWidth: 1,
              borderColor: C.line,
            }}>
            <Text style={{ color: level === item ? C.white : C.ink }}>{item}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 }}>
          <ActivityIndicator color={C.spruce} />
          <Text style={{ color: C.mute }}>Loading trails…</Text>
        </View>
      ) : error && !usingOfflineTrails ? (
        <View style={{ paddingVertical: 24, gap: 14 }}>
          <Text accessibilityRole="alert" style={{ color: C.ember }}>{error}</Text>
          <Pressable onPress={() => void loadTrails()}>
            <Text style={{ color: C.spruce, fontWeight: '700' }}>Tap to try again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filteredTrails}
          keyExtractor={(trail) => trail.id}
          ListEmptyComponent={<Text style={{ color: C.mute }}>No trails match. Clear the search or pick another level.</Text>}
          renderItem={({ item: trail }) => (
            <Pressable
              onPress={() => router.push(`/trail/${trail.id}` as Href)}
              style={{
                backgroundColor: C.white,
                borderRadius: 14,
                padding: 16,
                marginBottom: 12,
                borderLeftWidth: 5,
                borderLeftColor: trail.level === 'Hard' ? C.ember : C.moss,
              }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: C.ink }}>{trail.name}</Text>
              <Text style={{ color: C.mute, marginTop: 2 }}>{trail.area}</Text>
              <Text style={{ color: C.ink, marginTop: 10 }}>
                {trail.km} km  |  +{trail.gain} m  |  {trail.hrs}  |  {trail.level}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
