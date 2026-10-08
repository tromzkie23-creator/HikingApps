import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { getHikeById, type HikeHistoryItem } from '../../lib/api';
import LeafletMap, { type LeafletMapLayer } from '../../lib/leaflet-map';
import { C } from '../../lib/theme';

function getRecordedElevationGain(hike: HikeHistoryItem) {
  let gain = 0;
  for (let index = 1; index < (hike.path?.length ?? 0); index += 1) {
    const previous = hike.path?.[index - 1];
    const current = hike.path?.[index];
    if (
      previous?.altitude !== undefined &&
      previous.altitude !== null &&
      current?.altitude !== undefined &&
      current.altitude !== null
    ) {
      gain += Math.max(0, current.altitude - previous.altitude);
    }
  }
  return Math.round(gain);
}

export default function HikeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [hike, setHike] = useState<HikeHistoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [layer, setLayer] = useState<LeafletMapLayer>('Standard');

  useEffect(() => {
    let active = true;
    async function loadHike() {
      setLoading(true);
      setError('');
      try {
        const loadedHike = await getHikeById(id);
        if (!loadedHike) {
          setError('This hike could not be found in your history.');
          return;
        }
        if (active) setHike(loadedHike);
      } catch (cause) {
        console.error(`Could not load hike ${id}:`, cause);
        if (active) setError('Could not load this hike. Check your connection and try again.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadHike();
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <ActivityIndicator color={C.spruce} />
        <Text style={{ color: C.mute }}>Loading recorded hike…</Text>
      </View>
    );
  }

  if (error || !hike) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 }}>
        <Text accessibilityRole="alert" style={{ color: C.ember, textAlign: 'center' }}>{error || 'Hike is unavailable.'}</Text>
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Text style={{ color: C.spruce, fontWeight: '800' }}>Back to history</Text>
        </Pressable>
      </View>
    );
  }

  const recordedPath = hike.path ?? [];
  const elevationGain = getRecordedElevationGain(hike);
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <LeafletMap
        layer={layer}
        me={null}
        path={recordedPath}
        route={[]}
        destination={null}
        waypoints={hike.waypoints ?? []}
        follow={false}
        fit
        recenter={0}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to history"
        onPress={() => router.back()}
        style={{ position: 'absolute', top: 54, left: 16, width: 42, height: 42, borderRadius: 22, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', elevation: 4 }}>
        <Ionicons name="arrow-back" size={21} color={C.spruce} />
      </Pressable>
      <View style={{ position: 'absolute', top: 56, right: 14, flexDirection: 'row', backgroundColor: C.white, borderRadius: 12, padding: 4, elevation: 4 }}>
        {(['Standard', 'Terrain', 'Satellite'] as const).map((item) => (
          <Pressable
            key={item}
            accessibilityRole="button"
            accessibilityState={{ selected: layer === item }}
            onPress={() => setLayer(item)}
            style={{ borderRadius: 9, backgroundColor: layer === item ? C.spruce : 'transparent', paddingHorizontal: 9, paddingVertical: 8 }}>
            <Text style={{ color: layer === item ? C.white : C.ink, fontSize: 11, fontWeight: '800' }}>{item}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ position: 'absolute', left: 16, right: 16, bottom: 20, backgroundColor: C.white, borderRadius: 18, padding: 16, elevation: 4 }}>
        <Text numberOfLines={1} style={{ color: C.ink, fontSize: 19, fontWeight: '900' }}>{hike.name ?? hike.trail}</Text>
        <Text style={{ color: C.mute, marginTop: 4 }}>{hike.date} · {hike.time}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(`/create-post?hike_id=${encodeURIComponent(hike.id)}` as Href)}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.spruce, borderRadius: 11, paddingVertical: 11, marginTop: 12 }}>
          <Ionicons name="share-social-outline" size={17} color={C.white} />
          <Text style={{ color: C.white, fontWeight: '800' }}>Share to feed</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 24, marginTop: 13 }}>
          <Text style={{ color: C.spruce, fontWeight: '800' }}>{hike.km.toFixed(2)} km</Text>
          <Text style={{ color: C.spruce, fontWeight: '800' }}>{elevationGain} m gain</Text>
          <Text style={{ color: C.mute, fontSize: 12 }}>{recordedPath.length} GPS points</Text>
        </View>
        {!recordedPath.length && (
          <Text style={{ color: C.ember, fontSize: 12, marginTop: 10 }}>
            No recorded GPS path was saved for this hike.
          </Text>
        )}
      </View>
      <Text style={{ position: 'absolute', bottom: 186, alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.82)', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 3, color: '#34413A', fontSize: 10 }}>
        Tiles © Esri
      </Text>
    </View>
  );
}
