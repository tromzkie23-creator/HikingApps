import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { ApiError, getToken, getTrail, saveGuestHike, saveHike } from '../../lib/api';
import { Btn } from '../../lib/ui';
import { C, type Coordinate, type Trail } from '../../lib/theme';
import { TrailMap } from '../../lib/trail-map';
import { getOfflineTrail } from '../../lib/offline-trails';

function distanceInKm(first: Coordinate, second: Coordinate) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(second.latitude - first.latitude);
  const longitudeDelta = radians(second.longitude - first.longitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(first.latitude)) *
      Math.cos(radians(second.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

export default function Navigate() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [trail, setTrail] = useState<Trail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [usingOfflineTrail, setUsingOfflineTrail] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [distance, setDistance] = useState(0);
  const [gps, setGps] = useState('Waiting for GPS');
  const [saving, setSaving] = useState(false);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const [waypointName, setWaypointName] = useState('');
  const [addedWaypoints, setAddedWaypoints] = useState<string[]>([]);
  const lastLocation = useRef<Coordinate | null>(null);
  const startedAt = useRef(new Date().toISOString());

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    let active = true;
    getTrail(id)
      .then((result) => {
        if (active) {
          setTrail(result);
          setError('');
          setUsingOfflineTrail(false);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          const offlineTrail = getOfflineTrail(id);
          if (offlineTrail) {
            setTrail(offlineTrail);
            setError('');
            setUsingOfflineTrail(true);
          } else {
            setError(cause instanceof ApiError ? cause.message : 'Could not load this trail.');
          }
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(interval);
  }, [paused]);

  const handleLocation = useCallback((coordinate: Coordinate) => {
    setGps('GPS active');
    if (!pausedRef.current && lastLocation.current) {
      const segmentDistance = distanceInKm(lastLocation.current, coordinate);
      if (segmentDistance < 0.2) setDistance((value) => value + segmentDistance);
    }
    lastLocation.current = coordinate;
  }, []);

  function addWaypoint() {
    const name = waypointName.trim();
    if (!name) {
      Alert.alert('Name your waypoint', 'Enter a short label before adding a waypoint.');
      return;
    }
    setAddedWaypoints((current) => [...current, `${name} · ${distance.toFixed(2)} km`]);
    setWaypointName('');
  }

  async function finishHike() {
    if (!trail || saving) return;
    if (distance <= 0) {
      Alert.alert('No hike distance recorded', 'Walk with location enabled before saving this hike.');
      return;
    }

    setSaving(true);
    try {
      if (!(await getToken())) {
        await saveGuestHike({
          trail: trail.name,
          distanceKm: distance,
          durationSecs: seconds,
          startedAt: startedAt.current,
        });
        Alert.alert(
          'Guest hike finished',
          'Your hike was saved on this device. Sign in when the API is available to sync hikes to your account.'
        );
        router.replace('/(tabs)/profile' as Href);
        return;
      }
      await saveHike({
        trailId: trail.id,
        distanceKm: distance,
        durationSecs: seconds,
        startedAt: startedAt.current,
      });
      Alert.alert('Hike saved', 'Your hike was saved to your Trailhead account.');
      router.replace('/(tabs)/profile' as Href);
    } catch (cause) {
      const message = cause instanceof ApiError ? cause.message : 'Could not save this hike. Please try again.';
      Alert.alert('Could not save hike', message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <ActivityIndicator color={C.spruce} />
        <Text style={{ color: C.mute }}>Loading hike…</Text>
      </View>
    );
  }

  if (!trail) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text accessibilityRole="alert" style={{ color: C.ember }}>{error || 'Trail not found.'}</Text>
      </View>
    );
  }

  const nextWaypoint = trail.wps.find((waypoint) => waypoint.km > distance) ?? trail.wps[trail.wps.length - 1];
  const hours = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const remainingSeconds = String(seconds % 60).padStart(2, '0');
  const estimatedClimb = Math.min(trail.gain, Math.round((distance / trail.km) * trail.gain));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TrailMap trail={trail} fullScreen onLocation={handleLocation} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="More hike options"
        onPress={() => Alert.alert('Hike options', `${gps}${usingOfflineTrail ? '\nUsing built-in trail details.' : ''}`)}
        style={{ position: 'absolute', top: 220, right: 16, width: 43, height: 43, borderRadius: 22, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', elevation: 3 }}>
        <Ionicons name="ellipsis-horizontal" size={23} color={C.spruce} />
      </Pressable>

      <View style={{ position: 'absolute', top: 166, left: 16, right: 70, backgroundColor: C.white, borderRadius: 16, padding: 14, elevation: 4 }}>
        <Text style={{ color: C.moss, fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>ON ROUTE {paused ? '· PAUSED' : ''}</Text>
        <Text numberOfLines={1} style={{ color: C.ink, fontSize: 16, fontWeight: '800', marginTop: 5 }}>{nextWaypoint.name}</Text>
        <Text style={{ color: C.mute, fontSize: 12, marginTop: 2 }}>{Math.max(0, nextWaypoint.km - distance).toFixed(1)} km to next waypoint</Text>
      </View>

      {!!usingOfflineTrail && (
        <View style={{ position: 'absolute', top: 276, left: 16, right: 16, backgroundColor: '#FFF9E9', padding: 9, borderRadius: 10 }}>
          <Text style={{ color: C.mute, fontSize: 11 }}>Using built-in trail details. Hike data saves on this device as a guest.</Text>
        </View>
      )}

      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 24 }}>
        <View style={{ alignSelf: 'center', width: 38, height: 4, borderRadius: 3, backgroundColor: C.line, marginBottom: 12 }} />
        <Text numberOfLines={1} style={{ color: C.mute, fontSize: 12, fontWeight: '700' }}>{trail.name} · {gps}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 17 }}>
          <View>
            <Text style={{ color: C.ink, fontSize: 28, fontWeight: '900' }}>{hours}:{minutes}:{remainingSeconds}</Text>
            <Text style={{ color: C.mute, fontSize: 10 }}>MOVING TIME</Text>
          </View>
          <View>
            <Text style={{ color: C.ink, fontSize: 24, fontWeight: '900' }}>{distance.toFixed(2)} km</Text>
            <Text style={{ color: C.mute, fontSize: 10 }}>DISTANCE</Text>
          </View>
          <View>
            <Text style={{ color: C.ink, fontSize: 24, fontWeight: '900' }}>{estimatedClimb} m</Text>
            <Text style={{ color: C.mute, fontSize: 10 }}>CLIMB · EST.</Text>
          </View>
        </View>
        {!!addedWaypoints.length && (
          <Text numberOfLines={2} style={{ color: C.mute, fontSize: 11, marginBottom: 10 }}>
            Added: {addedWaypoints.join('  ·  ')}
          </Text>
        )}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Btn alt t={paused ? 'Resume' : 'Pause'} onPress={() => setPaused((current) => !current)} />
          </View>
          <View style={{ flex: 1 }}>
            <Btn t={saving ? 'Saving…' : 'Finish hike'} onPress={() => void finishHike()} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <TextInput
            accessibilityLabel="Waypoint name"
            value={waypointName}
            onChangeText={setWaypointName}
            placeholder="Add a waypoint"
            placeholderTextColor={C.mute}
            style={{ flex: 1, backgroundColor: C.bg, borderRadius: 11, paddingHorizontal: 12, color: C.ink, minHeight: 44 }}
          />
          <Pressable accessibilityRole="button" onPress={addWaypoint} style={{ flexDirection: 'row', gap: 6, backgroundColor: '#E3EBDD', borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 13 }}>
            <Ionicons name="add-circle-outline" size={18} color={C.spruce} />
            <Text style={{ color: C.spruce, fontWeight: '800', fontSize: 12 }}>Waypoint</Text>
          </Pressable>
        </View>
        {saving && <ActivityIndicator color={C.spruce} style={{ marginTop: 8 }} />}
      </View>
    </View>
  );
}
