import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, UrlTile, type MapType } from 'react-native-maps';
import * as Location from 'expo-location';

import { C, type Coordinate, type Trail } from './theme';

const OPENROUTESERVICE_API_KEY = 'YOUR_OPENROUTESERVICE_API_KEY';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const OPENROUTESERVICE_URL = 'https://api.openrouteservice.org/v2/directions/foot-hiking/geojson';
const OPENTOPOMAP_TILE_URL = 'https://a.tile.opentopomap.org/{z}/{x}/{y}.png';

type Layer = 'Standard' | 'Terrain' | 'Satellite';

type Destination = Coordinate & {
  name: string;
};

type RouteStep = {
  instruction: string;
  distance: number;
  duration: number;
  way_points: [number, number];
};

type HikingRoute = {
  coordinates: Coordinate[];
  distance: number;
  duration: number;
  steps: RouteStep[];
};

type TrailMapProps = {
  trail: Trail;
  showGuide?: boolean;
  onLocation?: (coordinate: Coordinate) => void;
  fullScreen?: boolean;
};

const layers: Layer[] = ['Standard', 'Terrain', 'Satellite'];

function distanceInMeters(first: Coordinate, second: Coordinate) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(second.latitude - first.latitude);
  const longitudeDelta = radians(second.longitude - first.longitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(first.latitude)) *
      Math.cos(radians(second.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 12_742_000 * Math.asin(Math.sqrt(a));
}

function formatDistance(meters: number) {
  const kilometers = meters / 1000;
  return `${kilometers.toFixed(kilometers < 1 ? 2 : 1)} km`;
}

function formatDuration(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return hours ? `${hours} hr ${remainingMinutes} min` : `${minutes} min`;
}

export function TrailMap({ trail, showGuide = false, onLocation, fullScreen = false }: TrailMapProps) {
  const mapRef = useRef<MapView>(null);
  const locationRef = useRef<Coordinate | null>(null);
  const routeRef = useRef<HikingRoute | null>(null);
  const nextStepRef = useRef(0);
  const requestedDestinationRef = useRef('');
  const lastNominatimRequestAt = useRef(0);
  const [layer, setLayer] = useState<Layer>('Terrain');
  const [query, setQuery] = useState('');
  const [destination, setDestination] = useState<Destination | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Coordinate | null>(null);
  const [hasLocation, setHasLocation] = useState(false);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [locationMessage, setLocationMessage] = useState('Getting your location…');
  const [searchMessage, setSearchMessage] = useState('');
  const [routeMessage, setRouteMessage] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [route, setRoute] = useState<HikingRoute | null>(null);
  const [nextStep, setNextStep] = useState(0);

  useEffect(() => {
    let active = true;
    let subscription: Location.LocationSubscription | undefined;

    const updateLocation = (coordinate: Coordinate) => {
      locationRef.current = coordinate;
      setCurrentLocation(coordinate);
      setHasLocation(true);
      setLocationMessage('');
      onLocation?.(coordinate);

      const activeRoute = routeRef.current;
      if (!activeRoute) return;

      let stepIndex = nextStepRef.current;
      while (stepIndex < activeRoute.steps.length - 1) {
        const step = activeRoute.steps[stepIndex];
        const endpoint = activeRoute.coordinates[step.way_points[1]];
        if (!endpoint || distanceInMeters(coordinate, endpoint) > 45) break;
        stepIndex += 1;
      }
      if (stepIndex !== nextStepRef.current) {
        nextStepRef.current = stepIndex;
        setNextStep(stepIndex);
      }
    };

    async function startLocationWatch() {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!active) return;
        if (permission.status !== 'granted') {
          setHasLocationPermission(false);
          setLocationMessage('Location permission denied. Allow location access in your phone settings.');
          return;
        }

        setHasLocationPermission(true);
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!active) return;
        updateLocation(current.coords);

        subscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 5 },
          (position) => updateLocation(position.coords)
        );
      } catch {
        if (active) setLocationMessage('Could not get your location. Check location services and try again.');
      }
    }

    void startLocationWatch();
    return () => {
      active = false;
      subscription?.remove();
    };
  }, [onLocation]);

  useEffect(() => {
    const destinationPoint = destination;
    if (!destinationPoint || !hasLocation) return;
    const currentLocation = locationRef.current;
    if (!currentLocation) return;
    const origin: Coordinate = currentLocation;
    const target: Destination = destinationPoint;

    const destinationKey = `${target.latitude},${target.longitude}`;
    if (requestedDestinationRef.current === destinationKey) return;

    if (!OPENROUTESERVICE_API_KEY || OPENROUTESERVICE_API_KEY === 'YOUR_OPENROUTESERVICE_API_KEY') {
      requestedDestinationRef.current = destinationKey;
      return;
    }

    requestedDestinationRef.current = destinationKey;
    let active = true;

    async function loadRoute() {
      try {
        const response = await fetch(OPENROUTESERVICE_URL, {
          method: 'POST',
          headers: {
            Authorization: OPENROUTESERVICE_API_KEY,
            'Content-Type': 'application/json',
            Accept: 'application/geo+json',
          },
          body: JSON.stringify({
            coordinates: [
              [origin.longitude, origin.latitude],
              [target.longitude, target.latitude],
            ],
            instructions: true,
            units: 'm',
          }),
        });

        if (response.status === 400 || response.status === 404) {
          throw new Error('No walking route was found to this destination.');
        }
        if (response.status === 401 || response.status === 403) {
          throw new Error('OpenRouteService rejected the API key. Check the key in trail-map.tsx.');
        }
        if (!response.ok) {
          throw new Error(`Route service error (${response.status}). Please try again later.`);
        }

        const data = (await response.json()) as {
          features?: {
            geometry?: { coordinates?: number[][] };
            properties?: {
              summary?: { distance?: number; duration?: number };
              segments?: { steps?: RouteStep[] }[];
            };
          }[];
        };
        const feature = data.features?.[0];
        const coordinates = feature?.geometry?.coordinates;
        const summary = feature?.properties?.summary;
        const steps = feature?.properties?.segments?.flatMap((segment) => segment.steps ?? []) ?? [];

        if (!coordinates?.length || !summary || !steps.length) {
          throw new Error('No walking route was found to this destination.');
        }

        const walkingRoute: HikingRoute = {
          coordinates: coordinates.map(([longitude, latitude]) => ({ latitude, longitude })),
          distance: summary.distance ?? 0,
          duration: summary.duration ?? 0,
          steps,
        };

        if (!active) return;
        routeRef.current = walkingRoute;
        setRoute(walkingRoute);
        setRouteMessage('');
        mapRef.current?.fitToCoordinates(
          [origin, target, ...walkingRoute.coordinates],
          { edgePadding: { top: 70, right: 55, bottom: 70, left: 55 }, animated: true }
        );
      } catch (error) {
        if (!active) return;
        requestedDestinationRef.current = '';
        setRouteMessage(
          error instanceof TypeError
            ? 'No internet connection. Connect to the internet to get a walking route.'
            : error instanceof Error
              ? error.message
              : 'Could not load the walking route. Please try again.'
        );
      }
    }

    void loadRoute();
    return () => {
      active = false;
    };
  }, [destination, hasLocation]);

  async function searchDestination() {
    const search = query.trim();
    Keyboard.dismiss();
    if (!search) {
      setSearchMessage('Enter a place name to search.');
      return;
    }

    setIsSearching(true);
    setSearchMessage('Searching the world…');
    setRouteMessage('');
    try {
      const waitMs = Math.max(0, 1000 - (Date.now() - lastNominatimRequestAt.current));
      if (waitMs > 0) await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
      lastNominatimRequestAt.current = Date.now();
      const response = await fetch(
        `${NOMINATIM_URL}?${new URLSearchParams({ format: 'jsonv2', q: search, limit: '1' }).toString()}`,
        {
          headers: {
            Accept: 'application/json',
            'Accept-Language': 'en',
            'User-Agent': 'Trailhead hiking guide/1.0',
          },
        }
      );
      if (!response.ok) throw new Error(`Search service error (${response.status}). Please try again.`);

      const results = (await response.json()) as {
        lat: string;
        lon: string;
        display_name: string;
      }[];
      const result = results[0];
      if (!result) {
        setSearchMessage('No search results. Try a nearby town, address, or landmark.');
        return;
      }

      const [latitude, longitude] = [Number(result.lat), Number(result.lon)];
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        setSearchMessage('The search service returned an invalid location. Try another search.');
        return;
      }

      const place: Destination = {
        latitude,
        longitude,
        name: result.display_name.split(',').slice(0, 3).join(','),
      };
      requestedDestinationRef.current = '';
      setDestination(place);
      setRoute(null);
      routeRef.current = null;
      nextStepRef.current = 0;
      setNextStep(0);
      setRouteMessage(hasLocation ? 'Finding a walking route…' : '');
      setSearchMessage(`Destination set: ${place.name}`);
    } catch (error) {
      setSearchMessage(
        error instanceof TypeError
          ? 'No internet connection. Connect to the internet to search places.'
          : error instanceof Error
            ? error.message
            : 'Could not search for that place. Please try again.'
      );
    } finally {
      setIsSearching(false);
    }
  }

  function centerOnMe() {
    if (!hasLocationPermission) {
      setLocationMessage('Location permission denied. Allow location access in your phone settings.');
      return;
    }
    if (!currentLocation) {
      setLocationMessage('Waiting for a GPS fix. Move to an open area and try again.');
      return;
    }
    mapRef.current?.animateToRegion(
      { ...currentLocation, latitudeDelta: 0.012, longitudeDelta: 0.012 },
      450
    );
  }

  const initialRegion = {
    latitude: trail.latitude,
    longitude: trail.longitude,
    latitudeDelta: 0.025,
    longitudeDelta: 0.025,
  };
  const missingRouteKey =
    !!destination &&
    hasLocation &&
    !route &&
    (!OPENROUTESERVICE_API_KEY || OPENROUTESERVICE_API_KEY === 'YOUR_OPENROUTESERVICE_API_KEY');
  const routeStatusMessage = missingRouteKey
    ? 'Add an OpenRouteService API key in trail-map.tsx to get walking directions.'
    : routeMessage;

  return (
    <View style={fullScreen ? styles.fullMapRoot : undefined}>
      <View style={[styles.searchRow, fullScreen && styles.fullSearchRow]}>
        <TextInput
          accessibilityLabel="Search any destination in the world"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => void searchDestination()}
          placeholder="Search any place in the world"
          placeholderTextColor={C.mute}
          returnKeyType="search"
          style={styles.searchInput}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => void searchDestination()}
          disabled={isSearching}
          style={styles.searchButton}>
          {isSearching ? (
            <ActivityIndicator color={C.white} size="small" />
          ) : (
            <Text style={styles.searchButtonText}>Search</Text>
          )}
        </Pressable>
      </View>
      {!!searchMessage && <Text style={styles.searchMessage}>{searchMessage}</Text>}

      <View style={[styles.layerRow, fullScreen && styles.fullLayerRow]}>
        {layers.map((item) => {
          const selected = item === layer;
          return (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setLayer(item)}
              style={[styles.layerButton, selected && styles.layerButtonSelected]}>
              <Text style={[styles.layerText, selected && styles.layerTextSelected]}>{item}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.mapFrame, fullScreen && styles.fullMapFrame]}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          initialRegion={initialRegion}
          mapType={(layer === 'Satellite' ? 'satellite' : 'standard') as MapType}
          showsUserLocation={hasLocationPermission}
          showsMyLocationButton={false}
          toolbarEnabled={false}
          loadingEnabled
          accessibilityLabel={`${trail.name} hiking map`}>
          {layer === 'Terrain' && (
            <UrlTile
              urlTemplate={OPENTOPOMAP_TILE_URL}
              maximumZ={17}
              tileSize={256}
              zIndex={1}
            />
          )}
          <Polyline
            coordinates={trail.path}
            strokeColor={C.moss}
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
          />
          {route && (
            <Polyline
              coordinates={route.coordinates}
              strokeColor={C.ember}
              strokeWidth={5}
              lineCap="round"
              lineJoin="round"
            />
          )}
          {trail.wps.map((waypoint, index) => (
            <Marker
              key={`${waypoint.name}-${index}`}
              coordinate={waypoint.coordinate}
              title={waypoint.name}
              description={`${waypoint.type} · ${waypoint.km} km`}
              pinColor={
                waypoint.type === 'Start'
                  ? C.spruce
                  : waypoint.type === 'Water'
                    ? '#2678C8'
                    : waypoint.type === 'Camp'
                      ? '#7657A6'
                      : C.ember
              }
            />
          ))}
          {destination && (
            <Marker
              coordinate={{ latitude: destination.latitude, longitude: destination.longitude }}
              title="Destination"
              description={destination.name}
              pinColor={C.ember}
            />
          )}
        </MapView>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Center map on my location"
          onPress={centerOnMe}
          style={styles.centerButton}>
          <Text style={styles.centerButtonText}>◎</Text>
        </Pressable>
        {fullScreen && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reset map compass to north"
            onPress={() => mapRef.current?.animateCamera({ heading: 0, pitch: 0 })}
            style={[styles.centerButton, styles.compassButton]}>
            <Text style={styles.centerButtonText}>N</Text>
          </Pressable>
        )}
      </View>

      <Text style={[styles.attribution, fullScreen && styles.fullAttribution]}>
        © OpenStreetMap contributors · Terrain © OpenTopoMap · Directions © openrouteservice.org
      </Text>
      {!!locationMessage && <Text style={styles.errorMessage}>{locationMessage}</Text>}
      {!!routeStatusMessage && <Text style={styles.errorMessage}>{routeStatusMessage}</Text>}

      {showGuide && (
        <View style={styles.guidePanel}>
          <Text style={styles.guideTitle}>Walking directions</Text>
          {route ? (
            <>
              <View style={styles.routeSummary}>
                <View>
                  <Text style={styles.summaryLabel}>DISTANCE</Text>
                  <Text style={styles.summaryValue}>{formatDistance(route.distance)}</Text>
                </View>
                <View>
                  <Text style={styles.summaryLabel}>ESTIMATED TIME</Text>
                  <Text style={styles.summaryValue}>{formatDuration(route.duration)}</Text>
                </View>
              </View>
              <Text style={styles.instructionHeading}>Turn-by-turn</Text>
              <ScrollView style={styles.instructionList} nestedScrollEnabled>
                {route.steps.map((step, index) => (
                  <View
                    key={`${index}-${step.instruction}`}
                    style={[
                      styles.instructionRow,
                      index === nextStep && styles.activeInstruction,
                    ]}>
                    <View style={[styles.stepNumber, index === nextStep && styles.activeStepNumber]}>
                      <Text
                        style={[
                          styles.stepNumberText,
                          index === nextStep && styles.activeStepNumberText,
                        ]}>
                        {index + 1}
                      </Text>
                    </View>
                    <View style={styles.instructionCopy}>
                      <Text
                        style={[
                          styles.instructionText,
                          index === nextStep && styles.activeInstructionText,
                        ]}>
                        {step.instruction}
                      </Text>
                      <Text style={styles.instructionDistance}>{formatDistance(step.distance)}</Text>
                    </View>
                    {index === nextStep && <Text style={styles.nextBadge}>NEXT</Text>}
                  </View>
                ))}
              </ScrollView>
            </>
          ) : (
            <Text style={styles.guideHint}>
              {routeStatusMessage ||
                'Search for a destination to see route distance, estimated time, and walking instructions.'}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fullMapRoot: {
    flex: 1,
    minHeight: 400,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  fullSearchRow: {
    position: 'absolute',
    top: 54,
    left: 16,
    right: 16,
    zIndex: 2,
    marginTop: 0,
  },
  searchInput: {
    flex: 1,
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.white,
    paddingHorizontal: 12,
    color: C.ink,
    fontSize: 14,
  },
  searchButton: {
    minWidth: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: C.spruce,
    paddingHorizontal: 12,
  },
  searchButtonText: {
    color: C.white,
    fontWeight: '700',
    fontSize: 13,
  },
  searchMessage: {
    color: C.mute,
    fontSize: 12,
    marginTop: 6,
  },
  layerRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    marginBottom: 9,
  },
  fullLayerRow: {
    position: 'absolute',
    top: 106,
    left: 16,
    zIndex: 2,
    marginTop: 0,
    marginBottom: 0,
  },
  layerButton: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.white,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  layerButtonSelected: {
    backgroundColor: C.moss,
    borderColor: C.moss,
  },
  layerText: {
    color: C.ink,
    fontSize: 12,
    fontWeight: '600',
  },
  layerTextSelected: {
    color: C.white,
  },
  mapFrame: {
    height: 310,
    overflow: 'hidden',
    borderRadius: 14,
    backgroundColor: '#DDE6CF',
  },
  fullMapFrame: {
    flex: 1,
    minHeight: 400,
    height: undefined,
    borderRadius: 0,
  },
  centerButton: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: C.white,
    elevation: 3,
    shadowColor: C.ink,
    shadowOpacity: 0.16,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  centerButtonText: {
    color: C.spruce,
    fontSize: 27,
    lineHeight: 32,
    fontWeight: '700',
  },
  compassButton: {
    bottom: 62,
  },
  attribution: {
    color: C.mute,
    fontSize: 9,
    marginTop: 5,
  },
  fullAttribution: {
    position: 'absolute',
    bottom: 5,
    left: 8,
    zIndex: 2,
    marginTop: 0,
    backgroundColor: 'rgba(255,255,255,0.8)',
    paddingHorizontal: 4,
  },
  errorMessage: {
    color: C.ember,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 7,
  },
  guidePanel: {
    borderRadius: 14,
    backgroundColor: C.white,
    padding: 15,
    marginTop: 15,
  },
  guideTitle: {
    color: C.spruce,
    fontSize: 17,
    fontWeight: '800',
  },
  routeSummary: {
    flexDirection: 'row',
    gap: 36,
    marginTop: 13,
    paddingBottom: 13,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  summaryLabel: {
    color: C.mute,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  summaryValue: {
    color: C.ink,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 3,
  },
  instructionHeading: {
    color: C.ink,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 5,
  },
  instructionList: {
    maxHeight: 210,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 9,
    padding: 9,
  },
  activeInstruction: {
    backgroundColor: '#EDF3E7',
  },
  stepNumber: {
    width: 25,
    height: 25,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.bg,
  },
  activeStepNumber: {
    backgroundColor: C.spruce,
  },
  stepNumberText: {
    color: C.mute,
    fontSize: 11,
    fontWeight: '700',
  },
  activeStepNumberText: {
    color: C.white,
  },
  instructionCopy: {
    flex: 1,
  },
  instructionText: {
    color: C.ink,
    fontSize: 12,
    lineHeight: 17,
  },
  activeInstructionText: {
    fontWeight: '700',
  },
  instructionDistance: {
    color: C.mute,
    fontSize: 10,
    marginTop: 3,
  },
  nextBadge: {
    color: C.spruce,
    fontSize: 9,
    fontWeight: '800',
  },
  guideHint: {
    color: C.mute,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 7,
  },
});
