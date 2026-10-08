import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { ApiError, getToken, saveGuestHike, saveHike, type HikeWaypoint } from '../../lib/api';
import LeafletMap, { type LeafletMapLayer } from '../../lib/leaflet-map';
import { C, type Coordinate } from '../../lib/theme';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const OPENROUTESERVICE_URL = 'https://api.openrouteservice.org/v2/directions/foot-hiking/geojson';
const OPENROUTESERVICE_API_KEY = process.env.EXPO_PUBLIC_OPENROUTESERVICE_API_KEY?.trim() ?? '';
type ScreenMode = 'ready' | 'recording' | 'summary';
type Destination = Coordinate & { name: string };
type CompletedHike = {
  id: string;
  startedAt: string;
  durationSecs: number;
  distanceKm: number;
  elevationGainM: number;
  path: Coordinate[];
  waypoints: HikeWaypoint[];
};

function distanceKm(first: Coordinate, second: Coordinate) {
  const radians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = radians(second.latitude - first.latitude);
  const longitudeDelta = radians(second.longitude - first.longitude);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(first.latitude)) *
      Math.cos(radians(second.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(value));
}

function pathDistanceMeters(points: Coordinate[]) {
  return points.slice(1).reduce((total, point, index) => {
    const segmentKm = distanceKm(points[index], point);
    return total + segmentKm * 1000;
  }, 0);
}

function directionTo(from: Coordinate, to: Coordinate) {
  const radians = Math.PI / 180;
  const y = Math.sin((to.longitude - from.longitude) * radians) * Math.cos(to.latitude * radians);
  const x =
    Math.cos(from.latitude * radians) * Math.sin(to.latitude * radians) -
    Math.sin(from.latitude * radians) *
      Math.cos(to.latitude * radians) *
      Math.cos((to.longitude - from.longitude) * radians);
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][
    Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360 / 45) % 8
  ];
}

function clock(seconds: number) {
  const hours = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const remainder = String(seconds % 60).padStart(2, '0');
  return `${hours}:${minutes}:${remainder}`;
}

function defaultHikeName(date: string) {
  return `Hike ${new Date(date).toLocaleDateString()}`;
}

export default function Record() {
  const router = useRouter();
  const routeParams = useLocalSearchParams<{
    destinationLat?: string;
    destinationLng?: string;
    destinationName?: string;
  }>();
  const initialDestination = (() => {
    const latitude = Number(routeParams.destinationLat);
    const longitude = Number(routeParams.destinationLng);
    if (!routeParams.destinationLat || !routeParams.destinationLng ||
      !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
    return { latitude, longitude, name: routeParams.destinationName || 'Shared hike location' };
  })();
  const liveLocationRef = useRef<Coordinate | null>(null);
  const pathRef = useRef<Coordinate[]>([]);
  const lastPointRef = useRef<Coordinate | null>(null);
  const recordingRef = useRef(false);
  const pausedRef = useRef(false);
  const modeRef = useRef<ScreenMode>('ready');
  const elevationGainRef = useRef(0);
  const startedAtRef = useRef('');
  const lastPlaceSearchAt = useRef(0);
  const [mode, setMode] = useState<ScreenMode>('ready');
  const [focused, setFocused] = useState(false);
  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [distance, setDistance] = useState(0);
  const [elevationGain, setElevationGain] = useState(0);
  const [path, setPath] = useState<Coordinate[]>([]);
  const [liveLocation, setLiveLocation] = useState<Coordinate | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'checking' | 'granted' | 'denied'>('checking');
  const [servicesEnabled, setServicesEnabled] = useState<boolean | null>(null);
  const [locationMessage, setLocationMessage] = useState('Requesting foreground location…');
  const [noDistanceRecorded, setNoDistanceRecorded] = useState(false);
  const [layer, setLayer] = useState<LeafletMapLayer>('Standard');
  const [recenter, setRecenter] = useState(0);
  const [search, setSearch] = useState('');
  const [searchMessage, setSearchMessage] = useState('');
  const [searching, setSearching] = useState(false);
  const [destination, setDestination] = useState<Destination | null>(initialDestination);
  const [routeOrigin, setRouteOrigin] = useState<Coordinate | null>(null);
  const [walkingRoute, setWalkingRoute] = useState<Coordinate[]>([]);
  const [routeMessage, setRouteMessage] = useState('');
  const [waypointName, setWaypointName] = useState('');
  const [waypoints, setWaypoints] = useState<HikeWaypoint[]>([]);
  const [completed, setCompleted] = useState<CompletedHike | null>(null);
  const [hikeName, setHikeName] = useState('');
  const [saving, setSaving] = useState(false);
  useFocusEffect(useCallback(() => {
    const latitude = Number(routeParams.destinationLat);
    const longitude = Number(routeParams.destinationLng);
    if (routeParams.destinationLat && routeParams.destinationLng &&
      Number.isFinite(latitude) && Number.isFinite(longitude) &&
      latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180) {
      setDestination({ latitude, longitude, name: routeParams.destinationName || 'Shared hike location' });
    }
    setFocused(true);
    let active = true;
    async function checkLocation() {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!active) return;
        if (permission.status !== 'granted') {
          setPermissionStatus('denied');
          setServicesEnabled(null);
          setLocationMessage('Location permission is denied. Allow location access in Settings to use the hiking map.');
          return;
        }
        setPermissionStatus('granted');
        const enabled = await Location.hasServicesEnabledAsync();
        if (!active) return;
        setServicesEnabled(enabled);
        setLocationMessage(enabled ? 'Finding your current location…' : 'GPS/location services are turned off.');
      } catch (error) {
        console.error('Could not request free-hike location access:', error);
        if (active) setLocationMessage('Could not check location access. Open Settings and enable location services.');
      }
    }
    void checkLocation();
    return () => {
      active = false;
      setFocused(false);
    };
  }, [routeParams.destinationLat, routeParams.destinationLng, routeParams.destinationName]));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void (async () => {
        try {
          const permission = await Location.getForegroundPermissionsAsync();
          setPermissionStatus(permission.status === 'granted' ? 'granted' : 'denied');
          const enabled = await Location.hasServicesEnabledAsync();
          setServicesEnabled(enabled);
          if (permission.status !== 'granted') {
            setLocationMessage('Location permission is denied. Allow location access in Settings to use the hiking map.');
          } else if (!enabled) {
            setLocationMessage('GPS/location services are turned off.');
          } else {
            setLocationMessage('');
          }
        } catch (error) {
          console.error('Could not refresh free-hike location access:', error);
          setLocationMessage('Could not check location access. Open Settings and enable location services.');
        }
      })();
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!focused || permissionStatus !== 'granted' || servicesEnabled !== true) return;
    let active = true;
    let subscription: Location.LocationSubscription | undefined;
    async function startLocation() {
      try {
        try {
          const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          if (!active) return;
          handlePosition(current);
        } catch (error) {
          console.error('Initial free-hike GPS fix failed; waiting for location updates:', error);
          if (active) setLocationMessage('Waiting for a GPS fix. Move to an open area or check location settings.');
        }
        if (!active) return;
        subscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 5 },
          handlePosition
        );
      } catch (error) {
        console.error('Free-hike GPS tracking failed:', error);
        if (active) setLocationMessage('Could not get GPS updates. Check that location services are enabled and retry.');
      }
    }
    function handlePosition(position: Location.LocationObject) {
      if (!active) return;
      console.log('Hike GPS update:', {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        altitude: position.coords.altitude,
      });
      if (
        position.coords.accuracy === null ||
        !Number.isFinite(position.coords.accuracy) ||
        position.coords.accuracy > 30 ||
        !Number.isFinite(position.coords.latitude) ||
        !Number.isFinite(position.coords.longitude)
      ) {
        setGpsAccuracy(null);
        setLocationMessage('Waiting for GPS accuracy within 30 m…');
        return;
      }
      const point: Coordinate = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        ...(position.coords.altitude !== null && Number.isFinite(position.coords.altitude)
          ? { altitude: position.coords.altitude }
          : {}),
      };
      setGpsAccuracy(position.coords.accuracy);
      liveLocationRef.current = point;
      setLiveLocation(point);
      setLocationMessage('');
      if (destination) setRouteOrigin((current) => current ?? point);
      if (!recordingRef.current || pausedRef.current || modeRef.current !== 'recording') return;
      const previous = lastPointRef.current;
      if (previous) {
        const segment = distanceKm(previous, point);
        setDistance((currentDistance) => currentDistance + segment);
        if (
          previous.altitude !== undefined &&
          previous.altitude !== null &&
          point.altitude !== undefined &&
          point.altitude !== null &&
          point.altitude > previous.altitude
        ) {
          elevationGainRef.current += point.altitude - previous.altitude;
          setElevationGain(elevationGainRef.current);
        }
      }
      lastPointRef.current = point;
      pathRef.current = [...pathRef.current, point];
      setPath(pathRef.current);
    }
    void startLocation();
    return () => {
      active = false;
      subscription?.remove();
    };
  }, [destination, focused, permissionStatus, servicesEnabled]);

  useEffect(() => {
    if (mode !== 'recording' || paused) return;
    const timer = setInterval(() => setSeconds((current) => current + 1), 1000);
    return () => clearInterval(timer);
  }, [mode, paused]);

  useEffect(() => {
    if (!destination || !routeOrigin) return;
    if (!OPENROUTESERVICE_API_KEY) {
      return;
    }
    const origin = routeOrigin;
    const target = destination;
    let active = true;
    async function fetchRoute() {
      setRouteMessage('Finding a foot-hiking route…');
      try {
        const response = await fetch(OPENROUTESERVICE_URL, {
          method: 'POST',
          headers: {
            Authorization: OPENROUTESERVICE_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            coordinates: [
              [origin.longitude, origin.latitude],
              [target.longitude, target.latitude],
            ],
          }),
        });
        if (!response.ok) throw new Error(`Route service returned ${response.status}.`);
        const result = (await response.json()) as {
          features?: { geometry?: { coordinates?: [number, number][] } }[];
        };
        const coordinates = result.features?.[0]?.geometry?.coordinates;
        if (!coordinates?.length) throw new Error('No foot-hiking route was found.');
        if (!active) return;
        const points = coordinates.map(([longitude, latitude]) => ({ latitude, longitude }));
        setWalkingRoute(points);
        setRouteMessage('');
      } catch (error) {
        console.error('Could not load the destination walking route:', error);
        if (active) {

          setRouteMessage(error instanceof Error ? error.message : 'Could not load the walking route.');
        }
      }
    }
    void fetchRoute();
    return () => { active = false; };
  }, [destination, routeOrigin]);

  async function openSettings() {
    try {
      await Linking.openSettings();
    } catch (error) {
      console.error('Could not open location settings:', error);
      setLocationMessage('Could not open Settings. Enable location access for Trailhead in your device settings.');
    }
  }

  function centerOnMe() {
    if (!liveLocation) {
      setLocationMessage('Waiting for a GPS fix. Move to an open area and retry.');
      return;
    }
    setRecenter((current) => current + 1);
  }

  function selectMapLayer(nextLayer: LeafletMapLayer) {
    setLayer(nextLayer);
  }

  function startHike() {
    if (!liveLocation || permissionStatus !== 'granted' || servicesEnabled !== true) {
      setLocationMessage('A current GPS location is required before starting a hike.');
      return;
    }
    const now = new Date().toISOString();
    startedAtRef.current = now;
    recordingRef.current = true;
    pausedRef.current = false;
    modeRef.current = 'recording';
    lastPointRef.current = liveLocation;
    pathRef.current = [liveLocation];
    elevationGainRef.current = 0;
    setPath(pathRef.current);
    setWaypoints([]);
    setSeconds(0);
    setDistance(0);
    setElevationGain(0);
    setPaused(false);
    setHikeName(defaultHikeName(now));
    setCompleted(null);
    if (destination) setRouteOrigin(liveLocation);
    setMode('recording');
  }

  function togglePause() {
    const nextPaused = !paused;
    pausedRef.current = nextPaused;
    if (nextPaused) lastPointRef.current = null;
    setPaused(nextPaused);
  }

  function keepRecording() {
    setNoDistanceRecorded(false);
  }

  function discardHike() {
    recordingRef.current = false;
    pausedRef.current = false;
    modeRef.current = 'ready';
    pathRef.current = [];
    lastPointRef.current = liveLocation;
    elevationGainRef.current = 0;
    setPath([]);
    setWaypoints([]);
    setDistance(0);
    setSeconds(0);
    setElevationGain(0);
    setPaused(false);
    setNoDistanceRecorded(false);
    setCompleted(null);
    setMode('ready');
  }

  function addWaypoint() {
    if (!liveLocation || mode !== 'recording') return;
    const waypoint: HikeWaypoint = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: waypointName.trim() || `Waypoint ${waypoints.length + 1}`,
      latitude: liveLocation.latitude,
      longitude: liveLocation.longitude,
      ...(liveLocation.altitude !== undefined ? { altitude: liveLocation.altitude } : {}),
      createdAt: new Date().toISOString(),
    };
    setWaypoints((items) => [...items, waypoint]);
    setWaypointName('');
  }

  function finishHike() {
    const trackedPath = [...pathRef.current];
    const recordedDistance = pathDistanceMeters(trackedPath);
    if (trackedPath.length < 2 || recordedDistance < 10) {
      setNoDistanceRecorded(true);
      return;
    }
    setNoDistanceRecorded(false);
    recordingRef.current = false;
    pausedRef.current = true;
    modeRef.current = 'summary';
    setPaused(true);
    const snapshot: CompletedHike = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      startedAt: startedAtRef.current,
      durationSecs: seconds,
      distanceKm: recordedDistance / 1000,
      elevationGainM: elevationGainRef.current,
      path: trackedPath,
      waypoints: [...waypoints],
    };
    setCompleted(snapshot);
    setHikeName(defaultHikeName(snapshot.startedAt));
    setMode('summary');
  }

  async function searchDestination() {
    const query = search.trim();
    if (!query) {
      setSearchMessage('Enter a place, address, or landmark.');
      return;
    }
    setSearching(true);
    setSearchMessage('Searching worldwide…');
    try {
      const delay = Math.max(0, 1000 - (Date.now() - lastPlaceSearchAt.current));
      if (delay) await new Promise<void>((resolve) => setTimeout(resolve, delay));
      lastPlaceSearchAt.current = Date.now();
      const response = await fetch(
        `${NOMINATIM_URL}?${new URLSearchParams({ format: 'jsonv2', q: query, limit: '1' })}`,
        {
          headers: {
            Accept: 'application/json',
            'Accept-Language': 'en',
            'User-Agent': 'Trailhead mobile hiking app/1.0',
          },
        }
      );
      if (!response.ok) throw new Error(`Place search returned ${response.status}.`);
      const results = (await response.json()) as { lat: string; lon: string; display_name: string }[];
      const result = results[0];
      if (!result) {
        setSearchMessage('No places found. Try another name or address.');
        return;
      }
      const point = { latitude: Number(result.lat), longitude: Number(result.lon) };
      if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) {
        setSearchMessage('The place search returned invalid coordinates. Try another search.');
        return;
      }
      const place = { ...point, name: result.display_name.split(',').slice(0, 3).join(',') };
      setDestination(place);
      setRouteOrigin(liveLocation);
      setWalkingRoute([]);
      setSearchMessage(`Destination set: ${place.name}`);
      setRouteMessage('');
    } catch (error) {
      console.error('Worldwide destination search failed:', error);
      setSearchMessage(error instanceof Error ? error.message : 'Could not search for that place.');
    } finally {
      setSearching(false);
    }
  }

  async function saveCompletedHike() {
    if (!completed || saving) return;
    const name = hikeName.trim();
    if (!name) {
      setSearchMessage('Give this hike a name before saving.');
      return;
    }
    setSaving(true);
    try {
      const input = {
        id: completed.id,
        name,
        distanceKm: completed.distanceKm,
        durationSecs: completed.durationSecs,
        startedAt: completed.startedAt,
        path: completed.path,
        waypoints: completed.waypoints,
      };
      if (await getToken()) {
        await saveHike(input);
      } else {
        await saveGuestHike({ ...input, pendingSync: true });
      }
      router.replace('/(tabs)/history' as Href);
    } catch (error) {
      console.error('Could not save free hike to the API:', error);
      try {
        await saveGuestHike({
          id: completed.id,
          name,
          distanceKm: completed.distanceKm,
          durationSecs: completed.durationSecs,
          startedAt: completed.startedAt,
          path: completed.path,
          waypoints: completed.waypoints,
          pendingSync: true,
        });
        setSearchMessage(
          `${error instanceof ApiError ? error.message : error instanceof Error ? error.message : 'Unknown save error.'} Your hike was saved on this phone and can be retried from History when you are signed in and online.`
        );
      } catch (storageError) {
        console.error('Could not save completed hike locally:', storageError);
        setSearchMessage('The hike could not be saved on the phone. Keep this screen open and try saving again.');
      }
    } finally {
      setSaving(false);
    }
  }

  const pace = distance >= 0.05 ? `${Math.min(seconds / 60 / distance, 99).toFixed(1)} min/km` : '—';
  const targetDistance = destination && liveLocation ? distanceKm(liveLocation, destination) : null;
  const gpsStatus =
    permissionStatus === 'denied'
      ? 'Permission denied'
      : servicesEnabled === false
        ? 'GPS is off'
        : liveLocation && gpsAccuracy !== null
          ? `GPS signal good (accuracy ${Math.round(gpsAccuracy)} m)`
          : 'Searching for GPS';
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <LeafletMap
        layer={layer}
        me={liveLocation}
        path={path}
        route={walkingRoute}
        destination={destination}
        waypoints={waypoints}
        follow={mode === 'recording' && !paused}
        fit={mode === 'summary'}
        recenter={recenter}
      />
      <Text
        accessibilityLabel="Map attribution"
        style={{
          position: 'absolute',
          bottom: mode === 'recording' ? 250 : mode === 'summary' ? 230 : 145,
          alignSelf: 'center',
          overflow: 'hidden',
          borderRadius: 5,
          backgroundColor: 'rgba(255,255,255,0.82)',
          paddingHorizontal: 6,
          paddingVertical: 3,
          color: '#34413A',
          fontSize: 10,
        }}>
        Tiles © Esri
      </Text>

      <View style={{ position: 'absolute', top: 12, left: 14, right: 14, gap: 9 }}>
        <View style={{ flexDirection: 'row', gap: 7, backgroundColor: C.white, borderRadius: 14, padding: 6, elevation: 4 }}>
          <TextInput
            accessibilityLabel="Search for any destination"
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => void searchDestination()}
            placeholder="Optional destination — search anywhere"
            placeholderTextColor={C.mute}
            returnKeyType="search"
            style={{ flex: 1, color: C.ink, paddingHorizontal: 9, minHeight: 42 }}
          />
          <Pressable accessibilityRole="button" disabled={searching} onPress={() => void searchDestination()} style={{ minWidth: 62, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: C.spruce, paddingHorizontal: 10 }}>
            {searching ? <ActivityIndicator color={C.white} /> : <Text style={{ color: C.white, fontWeight: '800' }}>Search</Text>}
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', alignSelf: 'flex-start', backgroundColor: C.white, borderRadius: 12, padding: 4, elevation: 3 }}>
          {(['Standard', 'Terrain', 'Satellite'] as const).map((item) => (
            <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: layer === item }} onPress={() => selectMapLayer(item)} style={{ borderRadius: 9, backgroundColor: layer === item ? C.spruce : 'transparent', paddingHorizontal: 11, paddingVertical: 8 }}>
              <Text style={{ color: layer === item ? C.white : C.ink, fontSize: 12, fontWeight: '800' }}>{item}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel="Center map on me" onPress={centerOnMe} style={{ position: 'absolute', top: 116, right: 17, width: 46, height: 46, borderRadius: 23, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', elevation: 4 }}>
        <Ionicons name="locate" size={22} color={C.spruce} />
      </Pressable>

      {!!gpsStatus && (
        <View style={{ position: 'absolute', top: 174, left: 14, right: 14, backgroundColor: '#FFF9E9', borderRadius: 12, padding: 10, gap: 5 }}>
          <Text accessibilityLiveRegion="polite" style={{ color: C.ink, fontSize: 12, fontWeight: '800' }}>{gpsStatus}</Text>
          {!!locationMessage && <Text accessibilityRole="alert" style={{ color: C.ember, fontSize: 12 }}>{locationMessage}</Text>}
          {!!searchMessage && <Text style={{ color: C.mute, fontSize: 11 }}>{searchMessage}</Text>}
          {!!routeMessage && <Text style={{ color: C.mute, fontSize: 11 }}>{routeMessage}</Text>}
          {!!(destination && routeOrigin && !OPENROUTESERVICE_API_KEY) && <Text style={{ color: C.mute, fontSize: 11 }}>Set EXPO_PUBLIC_OPENROUTESERVICE_API_KEY to enable foot-hiking directions.</Text>}
          {(permissionStatus === 'denied' || servicesEnabled === false || locationMessage.includes('Settings')) && (
            <Pressable accessibilityRole="button" onPress={() => void openSettings()}>
              <Text style={{ color: C.spruce, fontWeight: '900', fontSize: 12 }}>Open location settings</Text>
            </Pressable>
          )}
        </View>
      )}

      {mode === 'ready' && (
        <View style={{ position: 'absolute', left: 16, right: 16, bottom: 18, backgroundColor: C.white, borderRadius: 22, padding: 18, gap: 10, elevation: 5 }}>
          <Text style={{ color: C.ink, fontSize: 20, fontWeight: '900' }}>Go wherever the trail takes you</Text>
          <Text style={{ color: C.mute }}>Start recording from your current GPS location. No trail selection needed.</Text>
          {destination && liveLocation && targetDistance !== null && <Text style={{ color: C.spruce, fontWeight: '800' }}>{targetDistance.toFixed(1)} km {directionTo(liveLocation, destination)} to {destination.name}</Text>}
          <Pressable accessibilityRole="button" disabled={!liveLocation || permissionStatus !== 'granted' || servicesEnabled !== true} onPress={startHike} style={{ alignItems: 'center', borderRadius: 15, backgroundColor: liveLocation && permissionStatus === 'granted' && servicesEnabled === true ? C.spruce : '#A8B5AA', paddingVertical: 16 }}>
            <Text style={{ color: C.white, fontSize: 18, fontWeight: '900' }}>Start hiking</Text>
          </Pressable>
        </View>
      )}

      {mode === 'recording' && noDistanceRecorded && (
        <View style={{ position: 'absolute', left: 14, right: 14, bottom: 16, backgroundColor: C.white, borderRadius: 22, padding: 18, gap: 12, elevation: 5 }}>
          <Text style={{ color: C.ink, fontSize: 20, fontWeight: '900' }}>No distance recorded</Text>
          <Text style={{ color: C.mute }}>At least two accurate GPS points and 10 m of movement are needed to save this hike.</Text>
          <View style={{ flexDirection: 'row', gap: 9 }}>
            <Pressable accessibilityRole="button" onPress={discardHike} style={{ flex: 1, alignItems: 'center', borderRadius: 12, backgroundColor: '#E3EBDD', paddingVertical: 13 }}>
              <Text style={{ color: C.spruce, fontWeight: '900' }}>Discard</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={keepRecording} style={{ flex: 1, alignItems: 'center', borderRadius: 12, backgroundColor: C.spruce, paddingVertical: 13 }}>
              <Text style={{ color: C.white, fontWeight: '900' }}>Keep recording</Text>
            </Pressable>
          </View>
        </View>
      )}

      {mode === 'recording' && !noDistanceRecorded && (
        <View style={{ position: 'absolute', left: 14, right: 14, bottom: 16, backgroundColor: C.white, borderRadius: 22, padding: 16, gap: 11, elevation: 5 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View><Text style={{ color: C.ink, fontSize: 23, fontWeight: '900' }}>{clock(seconds)}</Text><Text style={{ color: C.mute, fontSize: 10 }}>TIME</Text></View>
            <View><Text style={{ color: C.ink, fontSize: 21, fontWeight: '900' }}>{distance.toFixed(2)} km</Text><Text style={{ color: C.mute, fontSize: 10 }}>DISTANCE</Text></View>
            <View><Text style={{ color: C.ink, fontSize: 21, fontWeight: '900' }}>{Math.round(elevationGain)} m</Text><Text style={{ color: C.mute, fontSize: 10 }}>ELEVATION</Text></View>
            <View><Text style={{ color: C.ink, fontSize: 15, fontWeight: '900' }}>{pace}</Text><Text style={{ color: C.mute, fontSize: 10 }}>PACE</Text></View>
          </View>
          {destination && liveLocation && targetDistance !== null && <Text style={{ color: C.spruce, fontWeight: '800' }}>{targetDistance.toFixed(1)} km {directionTo(liveLocation, destination)} to {destination.name}</Text>}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput accessibilityLabel="Optional waypoint name" value={waypointName} onChangeText={setWaypointName} placeholder="Waypoint name (optional)" placeholderTextColor={C.mute} style={{ flex: 1, minHeight: 42, paddingHorizontal: 11, borderRadius: 10, backgroundColor: C.bg, color: C.ink }} />
            <Pressable accessibilityRole="button" onPress={addWaypoint} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, backgroundColor: '#E3EBDD', paddingHorizontal: 11 }}>
              <Ionicons name="location-outline" size={16} color={C.spruce} /><Text style={{ color: C.spruce, fontWeight: '800' }}>Add</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', gap: 9 }}>
            <Pressable accessibilityRole="button" onPress={togglePause} style={{ flex: 1, alignItems: 'center', borderRadius: 12, backgroundColor: '#E3EBDD', paddingVertical: 13 }}><Text style={{ color: C.spruce, fontWeight: '900' }}>{paused ? 'Resume' : 'Pause'}</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={finishHike} style={{ flex: 1, alignItems: 'center', borderRadius: 12, backgroundColor: C.spruce, paddingVertical: 13 }}><Text style={{ color: C.white, fontWeight: '900' }}>Finish hike</Text></Pressable>
          </View>
        </View>
      )}

      {mode === 'summary' && completed && (
        <View style={{ position: 'absolute', left: 14, right: 14, bottom: 16, backgroundColor: C.white, borderRadius: 22, padding: 17, gap: 10, elevation: 5 }}>
          <Text style={{ color: C.ink, fontSize: 20, fontWeight: '900' }}>Hike summary</Text>
          <Text style={{ color: C.spruce, fontWeight: '800' }}>{completed.distanceKm.toFixed(2)} km  ·  {clock(completed.durationSecs)}  ·  {Math.round(completed.elevationGainM)} m gain</Text>
          <TextInput accessibilityLabel="Hike name" value={hikeName} onChangeText={setHikeName} placeholder="Name this hike" placeholderTextColor={C.mute} style={{ minHeight: 46, paddingHorizontal: 12, borderRadius: 11, backgroundColor: C.bg, color: C.ink }} />
          <Pressable accessibilityRole="button" disabled={saving} onPress={() => void saveCompletedHike()} style={{ alignItems: 'center', borderRadius: 13, backgroundColor: C.spruce, paddingVertical: 14 }}>
            {saving ? <ActivityIndicator color={C.white} /> : <Text style={{ color: C.white, fontWeight: '900' }}>Save hike</Text>}
          </Pressable>
          {!!searchMessage && <Text accessibilityRole="alert" style={{ color: C.ember, fontSize: 12 }}>{searchMessage}</Text>}
        </View>
      )}
    </View>
  );
}
