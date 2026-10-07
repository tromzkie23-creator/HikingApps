import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, View } from 'react-native';
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
  const lastLocation = useRef<Coordinate | null>(null);
  const startedAt = useRef(new Date().toISOString());

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
    const interval = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLocation = useCallback((coordinate: Coordinate) => {
    setGps('GPS active');
    if (lastLocation.current) {
      const segmentDistance = distanceInKm(lastLocation.current, coordinate);
      if (segmentDistance < 0.2) setDistance((value) => value + segmentDistance);
    }
    lastLocation.current = coordinate;
  }, []);

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
        router.replace('/(tabs)/history' as Href);
        return;
      }
      await saveHike({
        trailId: trail.id,
        distanceKm: distance,
        durationSecs: seconds,
        startedAt: startedAt.current,
      });
      Alert.alert('Hike saved', 'Your hike was saved to your Trailhead account.');
      router.replace('/(tabs)/history' as Href);
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

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.spruce }}
      contentContainerStyle={{ padding: 20, paddingTop: 56, paddingBottom: 28 }}>
      <Text style={{ color: '#BFD3B0' }}>{trail.name}</Text>
      {usingOfflineTrail && (
        <Text style={{ color: '#BFD3B0', marginTop: 8 }}>
          Using built-in trail details. Saving this hike requires an online account.
        </Text>
      )}
      <Text style={{ color: C.white, fontSize: 48, fontWeight: '800', marginTop: 5 }}>
        {hours}:{minutes}:{remainingSeconds}
      </Text>
      <Text style={{ color: C.white, fontSize: 19 }}>
        {distance.toFixed(2)} km of {trail.km} km
      </Text>
      <Text style={{ color: '#BFD3B0', marginTop: 5 }}>{gps}</Text>

      <TrailMap trail={trail} showGuide onLocation={handleLocation} />

      <View style={{ backgroundColor: C.white, borderRadius: 14, padding: 16, marginTop: 15 }}>
        <Text style={{ color: C.mute }}>Next trail waypoint</Text>
        <Text style={{ fontSize: 18, fontWeight: '700', color: C.ink, marginTop: 4 }}>
          {nextWaypoint.name}
        </Text>
        <Text style={{ color: C.ink, marginTop: 4 }}>
          {Math.max(0, nextWaypoint.km - distance).toFixed(1)} km ahead
        </Text>
      </View>
      <View style={{ marginTop: 16 }}>
        <Btn alt t={saving ? 'Saving hike…' : 'Finish hike'} onPress={() => void finishHike()} />
        {saving && <ActivityIndicator color={C.white} style={{ marginTop: 10 }} />}
      </View>
    </ScrollView>
  );
}
