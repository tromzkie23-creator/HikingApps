import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  ApiError,
  createSocialPost,
  getHikes,
  saveHike,
  uploadSocialPhoto,
  type HikeHistoryItem,
} from '../lib/api';
import { C, type Coordinate } from '../lib/theme';

type PlaceResult = Coordinate & { name: string };

export default function CreatePost() {
  const router = useRouter();
  const params = useLocalSearchParams<{ hike_id?: string }>();
  const [photos, setPhotos] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [uploadedPhotos, setUploadedPhotos] = useState<Record<string, string>>({});
  const [caption, setCaption] = useState('');
  const [hikes, setHikes] = useState<HikeHistoryItem[]>([]);
  const [hikeId, setHikeId] = useState<string | null>(params.hike_id ?? null);
  const [place, setPlace] = useState<PlaceResult | null>(null);
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [hideEndpoints, setHideEndpoints] = useState(true);

  useEffect(() => {
    let active = true;
    void getHikes().then((items) => {
      if (active) setHikes(items);
    }).catch((cause: unknown) => {
      console.error('Could not load hikes for a post:', cause);
      if (active) setError(cause instanceof ApiError ? cause.message : 'Could not load your saved hikes.');
    });
    return () => { active = false; };
  }, []);

  const selectedHike = useMemo(() => hikes.find((hike) => hike.id === hikeId) ?? null, [hikeId, hikes]);

  async function selectFromLibrary() {
    setError('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: Math.max(1, 6 - photos.length),
        quality: 1,
      });
      if (result.canceled) return;
      setPhotos((current) => [...current, ...result.assets].slice(0, 6));
    } catch (cause) {
      console.error('Could not open photo library:', cause);
      setError('Could not open your photo library. Check app permissions and try again.');
    }
  }

  async function takePhoto() {
    setError('');
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setError('Allow camera access in Settings to take a photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
      if (!result.canceled) setPhotos((current) => [...current, ...result.assets].slice(0, 6));
    } catch (cause) {
      console.error('Could not capture a post photo:', cause);
      setError('Could not open the camera. Check app permissions and try again.');
    }
  }

  async function getCurrentLocation() {
    setError('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error('Allow location access to add your current place.');
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const point = { latitude: current.coords.latitude, longitude: current.coords.longitude };
      setPlace({ ...point, name: 'Current location' });
      setPlaceQuery('Current location');
      setPlaceResults([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not read your current location.');
    }
  }

  async function searchPlaces() {
    if (placeQuery.trim().length < 2 || placeQuery === 'Current location') return;
    setBusy(true);
    setError('');
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(placeQuery.trim())}`;
      const response = await fetch(url, {
        headers: { Accept: 'application/json', 'Accept-Language': 'en', 'User-Agent': 'Trailhead mobile hiking app/1.0' },
      });
      if (!response.ok) throw new Error(`Place search returned HTTP ${response.status}.`);
      const results = await response.json() as { lat: string; lon: string; display_name: string }[];
      setPlaceResults(results.flatMap((item) => {
        const latitude = Number(item.lat);
        const longitude = Number(item.lon);
        return Number.isFinite(latitude) && Number.isFinite(longitude)
          ? [{ latitude, longitude, name: item.display_name.split(',').slice(0, 3).join(',') }]
          : [];
      }));
    } catch (cause) {
      console.error('Could not search post location:', cause);
      setError(cause instanceof Error ? cause.message : 'Could not search for that place.');
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setError('');
    if (!photos.length && !selectedHike) {
      setError('Add at least one photo or attach a recorded hike.');
      return;
    }
    if (!place && !selectedHike?.path?.length) {
      setError('Choose a place or attach a hike with a recorded route.');
      return;
    }
    setBusy(true);
    try {
      if (selectedHike && !selectedHike.synced) {
        if (!selectedHike.startedAt || !selectedHike.path?.length) {
          throw new Error('This hike is only on this device and does not have a saved route to attach.');
        }
        setProgress('Syncing attached hike…');
        await saveHike({
          id: selectedHike.id,
          name: selectedHike.name ?? selectedHike.trail,
          trailId: selectedHike.trailId,
          distanceKm: selectedHike.km,
          durationSecs: selectedHike.durationSecs ?? 0,
          startedAt: selectedHike.startedAt,
          path: selectedHike.path,
          waypoints: selectedHike.waypoints ?? [],
        });
      }
      const urls: string[] = [];
      const nextUploaded = { ...uploadedPhotos };
      for (const [index, asset] of photos.entries()) {
        const key = asset.assetId ?? asset.uri;
        let url = nextUploaded[key];
        if (!url) {
          setProgress(`Preparing photo ${index + 1} of ${photos.length}…`);
          const context = ImageManipulator.manipulate(asset.uri);
          if (asset.width > 1080) context.resize({ width: 1080 });
          const processed = await context.renderAsync();
          const jpeg = await processed.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
          setProgress(`Uploading photo ${index + 1} of ${photos.length}…`);
          url = await uploadSocialPhoto(jpeg.uri);
          nextUploaded[key] = url;
          setUploadedPhotos(nextUploaded);
        }
        urls.push(url);
      }
      setProgress('Publishing your post…');
      await createSocialPost({
        photoUrls: urls,
        caption: caption.trim(),
        hikeId,
        placeName: place?.name,
        latitude: place?.latitude,
        longitude: place?.longitude,
        hideEndpoints,
      });
      router.back();
    } catch (cause) {
      console.error('Could not publish hiking post:', cause);
      setError(cause instanceof ApiError ? cause.message : 'Could not publish your post. Your caption and photos are still here; retry when ready.');
    } finally {
      setBusy(false);
      setProgress('');
    }
  }

  function fieldLabel(text: string) {
    return <Text style={{ color: C.ink, fontWeight: '800', fontSize: 15, marginBottom: 9 }}>{text}</Text>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 52, paddingBottom: 14 }}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ width: 38 }}>
          <Ionicons name="arrow-back" size={23} color={C.spruce} />
        </Pressable>
        <Text style={{ flex: 1, textAlign: 'center', color: C.spruce, fontSize: 20, fontWeight: '900' }}>Create post</Text>
        <View style={{ width: 38 }} />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 18, paddingBottom: 36, gap: 18 }}>
        {!!error && <View style={{ backgroundColor: '#FFF1EB', borderRadius: 12, padding: 12 }}><Text accessibilityRole="alert" style={{ color: C.ember }}>{error}</Text></View>}
        <View>
          {fieldLabel(`Photos (${photos.length}/6)`)}
          {!!photos.length && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 9, paddingBottom: 8 }}>
              {photos.map((photo) => (
                <View key={photo.assetId ?? photo.uri} style={{ position: 'relative' }}>
                  <Image source={{ uri: photo.uri }} style={{ width: 94, height: 94, borderRadius: 12, backgroundColor: C.line }} />
                  <Pressable accessibilityRole="button" accessibilityLabel="Remove photo" onPress={() => {
                    const key = photo.assetId ?? photo.uri;
                    setPhotos((current) => current.filter((item) => (item.assetId ?? item.uri) !== key));
                    setUploadedPhotos((current) => { const next = { ...current }; delete next[key]; return next; });
                  }} style={{ position: 'absolute', right: 4, top: 4, backgroundColor: C.white, borderRadius: 12, padding: 3 }}>
                    <Ionicons name="close" size={16} color={C.ember} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable disabled={photos.length >= 6 || busy} onPress={() => void selectFromLibrary()} style={{ flex: 1, backgroundColor: C.white, borderRadius: 12, padding: 13, alignItems: 'center', borderWidth: 1, borderColor: C.line }}>
              <Text style={{ color: C.spruce, fontWeight: '800' }}>Choose from library</Text>
            </Pressable>
            <Pressable disabled={photos.length >= 6 || busy} onPress={() => void takePhoto()} style={{ backgroundColor: C.white, borderRadius: 12, padding: 13, alignItems: 'center', borderWidth: 1, borderColor: C.line }}>
              <Ionicons name="camera-outline" size={20} color={C.spruce} />
            </Pressable>
          </View>
        </View>

        <View>
          {fieldLabel('Caption')}
          <TextInput value={caption} onChangeText={setCaption} maxLength={500} multiline placeholder="Share the moment…" placeholderTextColor={C.mute}
            style={{ minHeight: 92, backgroundColor: C.white, color: C.ink, borderRadius: 13, padding: 13, borderWidth: 1, borderColor: C.line, textAlignVertical: 'top' }} />
          <Text style={{ color: C.mute, textAlign: 'right', fontSize: 11, marginTop: 4 }}>{caption.length}/500</Text>
        </View>

        <View>
          {fieldLabel('Attach a recorded hike (optional)')}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <Pressable onPress={() => setHikeId(null)} style={{ backgroundColor: hikeId === null ? C.spruce : C.white, borderColor: C.line, borderWidth: 1, borderRadius: 18, paddingHorizontal: 13, paddingVertical: 9 }}>
              <Text style={{ color: hikeId === null ? C.white : C.ink, fontWeight: '700' }}>None</Text>
            </Pressable>
            {hikes.map((hike) => (
              <Pressable key={hike.id} onPress={() => setHikeId(hike.id)} style={{ backgroundColor: hikeId === hike.id ? C.spruce : C.white, borderColor: C.line, borderWidth: 1, borderRadius: 18, paddingHorizontal: 13, paddingVertical: 9 }}>
                <Text style={{ color: hikeId === hike.id ? C.white : C.ink, fontWeight: '700' }} numberOfLines={1}>{hike.name ?? hike.trail} · {hike.km.toFixed(1)} km</Text>
              </Pressable>
            ))}
          </ScrollView>
          {selectedHike && <Text style={{ color: C.mute, fontSize: 12, marginTop: 8 }}>The recorded stats and route will be included in your post.</Text>}
        </View>

        <View>
          {fieldLabel('Place')}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput value={placeQuery} onChangeText={(value) => { setPlaceQuery(value); setPlace(null); }} onSubmitEditing={() => void searchPlaces()}
              placeholder="Search any place" placeholderTextColor={C.mute} returnKeyType="search"
              style={{ flex: 1, backgroundColor: C.white, color: C.ink, borderRadius: 12, paddingHorizontal: 13, borderWidth: 1, borderColor: C.line }} />
            <Pressable accessibilityRole="button" onPress={() => void searchPlaces()} style={{ backgroundColor: C.spruce, borderRadius: 12, paddingHorizontal: 14, justifyContent: 'center' }}>
              <Ionicons name="search" size={20} color={C.white} />
            </Pressable>
          </View>
          <Pressable onPress={() => void getCurrentLocation()} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 10 }}>
            <Ionicons name="navigate-outline" size={18} color={C.spruce} />
            <Text style={{ color: C.spruce, fontWeight: '700' }}>Use current location</Text>
          </Pressable>
          {placeResults.map((result) => (
            <Pressable key={`${result.latitude}-${result.longitude}`} onPress={() => { setPlace(result); setPlaceQuery(result.name); setPlaceResults([]); }}
              style={{ backgroundColor: C.white, borderRadius: 10, padding: 11, marginTop: 6 }}>
              <Text style={{ color: C.ink }} numberOfLines={2}>{result.name}</Text>
            </Pressable>
          ))}
          {place && <Text style={{ color: C.moss, fontSize: 12, marginTop: 7 }}>Selected: {place.name}</Text>}
        </View>

        {!!selectedHike && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.white, borderRadius: 13, padding: 13 }}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={{ color: C.ink, fontWeight: '800' }}>Hide route endpoints</Text>
              <Text style={{ color: C.mute, fontSize: 12, marginTop: 3 }}>Trim 200 m from each end by default to protect privacy.</Text>
            </View>
            <Switch value={hideEndpoints} onValueChange={setHideEndpoints} trackColor={{ true: C.moss }} />
          </View>
        )}

        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void publish()}
          style={{ alignItems: 'center', justifyContent: 'center', backgroundColor: busy ? C.mute : C.spruce, minHeight: 50, borderRadius: 14, flexDirection: 'row', gap: 9 }}>
          {busy && <ActivityIndicator color={C.white} />}
          <Text style={{ color: C.white, fontWeight: '900', fontSize: 15 }}>{busy ? progress : 'Share to feed'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
