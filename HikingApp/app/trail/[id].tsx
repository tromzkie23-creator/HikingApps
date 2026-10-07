import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { ApiError, getTrail } from '../../lib/api';
import { Btn } from '../../lib/ui';
import { C, type Trail } from '../../lib/theme';
import { TrailMap } from '../../lib/trail-map';
import { getOfflineTrail } from '../../lib/offline-trails';

export default function Detail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [trail, setTrail] = useState<Trail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [usingOfflineTrail, setUsingOfflineTrail] = useState(false);

  const loadTrail = useCallback(async () => {
    setLoading(true);
    setError('');
    setUsingOfflineTrail(false);
    try {
      setTrail(await getTrail(id));
    } catch (cause) {
      const offlineTrail = getOfflineTrail(id);
      if (offlineTrail) {
        setTrail(offlineTrail);
        setUsingOfflineTrail(true);
      } else {
        setError(cause instanceof ApiError ? cause.message : 'Could not load this trail. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void loadTrail();
    }, [loadTrail])
  );

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <ActivityIndicator color={C.spruce} />
        <Text style={{ color: C.mute }}>Loading trail…</Text>
      </View>
    );
  }

  if (error || !trail) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, padding: 24, justifyContent: 'center', gap: 14 }}>
        <Text accessibilityRole="alert" style={{ color: C.ember }}>{error || 'Trail not found.'}</Text>
        <Pressable onPress={() => void loadTrail()}>
          <Text style={{ color: C.spruce, fontWeight: '700' }}>Tap to try again</Text>
        </Pressable>
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: C.mute }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ backgroundColor: C.spruce, padding: 24, paddingTop: 60 }}>
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: '#BFD3B0' }}>Back</Text>
        </Pressable>
        <Text style={{ color: C.white, fontSize: 28, fontWeight: '800', marginTop: 10 }}>{trail.name}</Text>
        <Text style={{ color: '#BFD3B0' }}>{trail.area}</Text>
        <Text style={{ color: C.white, marginTop: 12 }}>
          {trail.km} km  |  +{trail.gain} m  |  {trail.hrs}  |  {trail.level}
        </Text>
      </View>
      <View style={{ padding: 20 }}>
        {usingOfflineTrail && (
          <Text style={{ color: C.mute, marginBottom: 12 }}>
            Showing built-in trail details. Online account features are unavailable until the API is public.
          </Text>
        )}
        <Text style={{ color: C.ink, lineHeight: 22 }}>{trail.desc}</Text>
        <TrailMap trail={trail} />
        <Text style={{ fontWeight: '700', fontSize: 16, marginTop: 20 }}>Elevation</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 80, gap: 5, marginTop: 8 }}>
          {trail.elev.map((elevation, index) => (
            <View key={`${index}-${elevation}`} style={{ flex: 1, height: elevation * 0.7, backgroundColor: C.moss, borderRadius: 3 }} />
          ))}
        </View>
        <Text style={{ fontWeight: '700', fontSize: 16, marginTop: 20, marginBottom: 6 }}>Waypoints</Text>
        {trail.wps.map((waypoint) => (
          <View
            key={waypoint.name}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingVertical: 10,
              borderBottomWidth: 1,
              borderBottomColor: C.line,
            }}>
            <Text style={{ color: C.ink }}>{waypoint.name} ({waypoint.type})</Text>
            <Text style={{ color: C.mute }}>{waypoint.km} km</Text>
          </View>
        ))}
        <View style={{ gap: 12, marginTop: 24 }}>
          <Btn
            alt
            t="Download for offline use"
            onPress={() => Alert.alert('Offline maps', 'Offline trail downloads are not available yet.')}
          />
          <Btn
            t="Start hike"
            onPress={() => router.push(`/navigate/${trail.id}` as Href)}
          />
        </View>
      </View>
    </ScrollView>
  );
}
