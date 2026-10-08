import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
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
  const [elevationGain, setElevationGain] = useState(0);
  const [recordedPath, setRecordedPath] = useState<Coordinate[]>([]);
  const [liveLocation, setLiveLocation] = useState<Coordinate | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'checking' | 'granted' | 'denied'>('checking');
  const [servicesEnabled, setServicesEnabled] = useState<boolean | null>(null);
  const [locationMessage, setLocationMessage] = useState('Requesting location permission…');
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState('');
  const [mapRetryKey, setMapRetryKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [paused, setPaused] = useState(false);
  const [waypointName, setWaypointName] = useState('');
  const [addedWaypoints, setAddedWaypoints] = useState<string[]>([]);
  const pathRef = useRef<Coordinate[]>([]);
  const previousPointRef = useRef<Coordinate | null>(null);
  const elevationGainRef = useRef(0);
  const pausedRef = useRef(false);
  const savingRef = useRef(false);
  const hikeId = useRef('');
  const startedAt = useRef('');

  useEffect(() => {
    hikeId.current = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    startedAt.current = new Date().toISOString();
  }, []);

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

  const refreshLocationAccess = useCallback(async (requestPermission: boolean) => {
    try {
      const permission = requestPermission
        ? await Location.requestForegroundPermissionsAsync()
        : await Location.getForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setPermissionStatus('denied');
        setServicesEnabled(null);
        setLocationMessage('Location permission is denied. Allow Trailhead to access location to record this hike.');
        return;
      }

      setPermissionStatus('granted');
      const enabled = await Location.hasServicesEnabledAsync();
      setServicesEnabled(enabled);
      setLocationMessage(
        enabled
          ? 'Waiting for an accurate GPS fix…'
          : 'Location services are off. Turn on GPS/location services to record this hike.'
      );
    } catch (cause) {
      console.error('Could not check hike location permission or GPS services:', cause);
      setLocationMessage('Could not check location services. Open Settings and enable location for Trailhead.');
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => void refreshLocationAccess(true), 0);
    return () => clearTimeout(timeout);
  }, [refreshLocationAccess]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshLocationAccess(false);
    });
    return () => subscription.remove();
  }, [refreshLocationAccess]);

  useEffect(() => {
    if (permissionStatus !== 'granted' || servicesEnabled !== true || paused || saving) return;
    let active = true;
    let subscription: Location.LocationSubscription | undefined;

    async function startLocationWatch() {
      try {
        const enabled = await Location.hasServicesEnabledAsync();
        if (!active) return;
        setServicesEnabled(enabled);
        if (!enabled) {
          setLocationMessage('Location services are off. Turn on GPS/location services to record this hike.');
          return;
        }

        subscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 5 },
          (position) => {
            if (!active || pausedRef.current || savingRef.current) return;
            const { latitude, longitude, accuracy, altitude } = position.coords;
            if (
              accuracy === null ||
              accuracy > 30 ||
              !Number.isFinite(latitude) ||
              !Number.isFinite(longitude)
            ) {
              setLocationMessage('Waiting for GPS accuracy within 30 m…');
              return;
            }

            const point: Coordinate = {
              latitude,
              longitude,
              ...(altitude !== null && Number.isFinite(altitude) ? { altitude } : {}),
            };
            setLiveLocation(point);
            setLocationMessage('');

            const previous = previousPointRef.current;
            if (previous) {
              const segmentDistance = distanceInKm(previous, point);
              setDistance((current) => current + segmentDistance);
              if (
                previous.altitude !== undefined &&
                previous.altitude !== null &&
                point.altitude !== undefined &&
                point.altitude !== null &&
                point.altitude > previous.altitude
              ) {
                const gain = point.altitude - previous.altitude;
                elevationGainRef.current += gain;
                setElevationGain(elevationGainRef.current);
              }
            }

            previousPointRef.current = point;
            pathRef.current = [...pathRef.current, point];
            setRecordedPath(pathRef.current);
          }
        );
      } catch (cause) {
        console.error('Hike location tracking failed:', cause);
        if (active) setLocationMessage('Unable to get GPS updates. Check location settings and try again.');
      }
    }

    void startLocationWatch();
    return () => {
      active = false;
      previousPointRef.current = null;
      subscription?.remove();
    };
  }, [paused, permissionStatus, saving, servicesEnabled]);

  useEffect(() => {
    if (paused || permissionStatus !== 'granted' || servicesEnabled !== true || saving) return;
    const interval = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(interval);
  }, [paused, permissionStatus, saving, servicesEnabled]);

  useEffect(() => {
    if (!trail || mapReady || mapError) return;
    const timeout = setTimeout(() => {
      setMapError('The map is taking too long to load. Check your connection and try again.');
    }, 15000);
    return () => clearTimeout(timeout);
  }, [mapError, mapReady, trail]);

  const handleMapError = useCallback((cause: Error) => {
    console.error('Hike map rendering failed:', cause);
    setMapError('The map could not be displayed. Check your connection and try again.');
  }, []);

  const handleMapReady = useCallback(() => {
    setMapReady(true);
    setMapError('');
  }, []);

  async function openLocationSettings() {
    try {
      await Linking.openSettings();
    } catch (cause) {
      console.error('Could not open device location settings:', cause);
      setLocationMessage('Could not open Settings. Enable location services for Trailhead in your device settings.');
    }
  }

  function togglePaused() {
    const nextPaused = !paused;
    if (nextPaused) previousPointRef.current = null;
    pausedRef.current = nextPaused;
    setPaused(nextPaused);
  }

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
    if (pathRef.current.length < 2 || distance <= 0) {
      Alert.alert('No hike path recorded', 'Wait for accurate GPS updates and walk before finishing this hike.');
      return;
    }

    savingRef.current = true;
    setSaving(true);
    if (!hikeId.current) hikeId.current = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    if (!startedAt.current) startedAt.current = new Date().toISOString();
    const hikePath = [...pathRef.current];
    const hike = {
      id: hikeId.current,
      trail: trail.name,
      trailId: trail.id,
      distanceKm: distance,
      durationSecs: seconds,
      startedAt: startedAt.current,
      path: hikePath,
    };
    try {
      if (!(await getToken())) {
        await saveGuestHike({ ...hike, name: hike.trail, waypoints: [], pendingSync: true });
        Alert.alert(
          'Guest hike finished',
          'Your hike and recorded path were saved on this device.'
        );
        router.replace('/(tabs)/history' as Href);
        return;
      }
      await saveHike({ ...hike, name: hike.trail, trailId: trail.id, waypoints: [] });
      Alert.alert('Hike saved', 'Your hike was saved to your Trailhead account.');
      router.replace('/(tabs)/history' as Href);
    } catch (cause) {
      const message = cause instanceof ApiError ? cause.message : 'Could not save this hike. Please try again.';
      try {
        await saveGuestHike({ ...hike, name: hike.trail, waypoints: [], pendingSync: true });
        Alert.alert('Hike saved on this device', `${message}\n\nYour hike and path are stored locally and will retry syncing when History is opened with an internet connection.`);
        router.replace('/(tabs)/history' as Href);
      } catch (storageError) {
        console.error('Could not store the failed hike locally:', storageError);
        Alert.alert('Could not save hike', `${message}\n\nThe device could not store a local copy either. Keep this screen open and try again.`);
      }
    } finally {
      savingRef.current = false;
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
  const gps =
    permissionStatus !== 'granted'
      ? permissionStatus === 'denied' ? 'Location permission needed' : 'Checking location'
      : servicesEnabled === false
        ? 'GPS is off'
        : locationMessage
          ? 'Waiting for GPS'
          : 'GPS active';
  const needsLocationSettings = permissionStatus === 'denied' || servicesEnabled === false;
  const isPaused = paused || permissionStatus !== 'granted' || servicesEnabled !== true;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TrailMap
        trail={trail}
        fullScreen
        disableLocationTracking
        recordedPath={recordedPath}
        recordedLocation={liveLocation}
        followUser={!paused}
        mapRetryKey={mapRetryKey}
        centerButtonTop
        onMapReady={handleMapReady}
        onMapError={handleMapError}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="More hike options"
        onPress={() => Alert.alert('Hike options', `${gps}${usingOfflineTrail ? '\nUsing built-in trail details.' : ''}`)}
        style={{ position: 'absolute', top: 220, right: 16, width: 43, height: 43, borderRadius: 22, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', elevation: 3 }}>
        <Ionicons name="ellipsis-horizontal" size={23} color={C.spruce} />
      </Pressable>

      <View style={{ position: 'absolute', top: 166, left: 16, right: 70, backgroundColor: C.white, borderRadius: 16, padding: 14, elevation: 4 }}>
        <Text style={{ color: C.moss, fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>ON ROUTE {isPaused ? '· PAUSED' : ''}</Text>
        <Text numberOfLines={1} style={{ color: C.ink, fontSize: 16, fontWeight: '800', marginTop: 5 }}>{nextWaypoint.name}</Text>
        <Text style={{ color: C.mute, fontSize: 12, marginTop: 2 }}>{Math.max(0, nextWaypoint.km - distance).toFixed(1)} km to next waypoint</Text>
      </View>

      {!!(locationMessage || mapError || usingOfflineTrail) && (
        <View style={{ position: 'absolute', top: 276, left: 16, right: 16, backgroundColor: mapError ? '#FFF1EB' : '#FFF9E9', padding: 10, borderRadius: 10, gap: 7 }}>
          {!!locationMessage && <Text accessibilityRole="alert" style={{ color: C.ember, fontSize: 11 }}>{locationMessage}</Text>}
          {!!mapError && <Text accessibilityRole="alert" style={{ color: C.ember, fontSize: 11 }}>{mapError}</Text>}
          {!!usingOfflineTrail && <Text style={{ color: C.mute, fontSize: 11 }}>Using built-in trail details.</Text>}
          {needsLocationSettings && (
            <Pressable accessibilityRole="button" onPress={() => void openLocationSettings()} style={{ alignSelf: 'flex-start', paddingVertical: 3 }}>
              <Text style={{ color: C.spruce, fontWeight: '800', fontSize: 12 }}>Open location settings</Text>
            </Pressable>
          )}
          {!!mapError && (
            <Pressable accessibilityRole="button" onPress={() => { setMapError(''); setMapReady(false); setMapRetryKey((current) => current + 1); }} style={{ alignSelf: 'flex-start', paddingVertical: 3 }}>
              <Text style={{ color: C.spruce, fontWeight: '800', fontSize: 12 }}>Retry map</Text>
            </Pressable>
          )}
        </View>
      )}

      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 24 }}>
        <View style={{ alignSelf: 'center', width: 38, height: 4, borderRadius: 3, backgroundColor: C.line, marginBottom: 12 }} />
        <Text numberOfLines={1} style={{ color: C.mute, fontSize: 12, fontWeight: '700' }}>{trail.name} · {gps}{!mapReady && !mapError ? ' · Loading map…' : ''}</Text>
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
            <Text style={{ color: C.ink, fontSize: 24, fontWeight: '900' }}>{Math.round(elevationGain)} m</Text>
            <Text style={{ color: C.mute, fontSize: 10 }}>ELEV. GAIN</Text>
          </View>
        </View>
        {!!addedWaypoints.length && (
          <Text numberOfLines={2} style={{ color: C.mute, fontSize: 11, marginBottom: 10 }}>
            Added: {addedWaypoints.join('  ·  ')}
          </Text>
        )}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Btn alt t={paused ? 'Resume' : 'Pause'} onPress={togglePaused} />
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
