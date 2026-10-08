import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';

import { TrailCard } from '../../components/trail-card';
import { ApiError, getTrails } from '../../lib/api';
import { getFavoriteTrailIds, toggleFavoriteTrail } from '../../lib/favorites';
import { getOfflineTrails } from '../../lib/offline-trails';
import { C, type Trail } from '../../lib/theme';

const CHECKLIST_STORAGE_KEY = 'trailhead.plan-checklist';
const CHECKLIST_ITEMS = [
  { id: 'water', label: 'Pack enough water and electrolytes', icon: 'water-outline' },
  { id: 'sun-protection', label: 'Bring sun protection and rain gear', icon: 'sunny-outline' },
  { id: 'first-aid', label: 'Pack first aid and personal medication', icon: 'medkit-outline' },
  { id: 'phone', label: 'Charge your phone and save an offline map', icon: 'phone-portrait-outline' },
  { id: 'share-route', label: 'Share your route and return time', icon: 'people-outline' },
] as const;

function parseChecklist(raw: string | null): string[] {
  if (raw === null) return [];
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new Error('Saved checklist data has an unexpected format.');
  }
  const allowedIds = new Set<string>(CHECKLIST_ITEMS.map((item) => item.id));
  return value.filter((item): item is string => allowedIds.has(item));
}

export default function Plans() {
  const router = useRouter();
  const [trails, setTrails] = useState<Trail[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [checkedItems, setCheckedItems] = useState<string[]>([]);
  const checkedItemsRef = useRef<string[]>([]);
  const checklistWriteRef = useRef<Promise<void>>(Promise.resolve());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPlans = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setFavorites(await getFavoriteTrailIds());
    } catch (cause) {
      console.error('Could not load saved trail IDs for Plans:', cause);
      setError('Could not load your saved trails. Pull down to retry.');
    }

    try {
      const rawChecklist = await AsyncStorage.getItem(CHECKLIST_STORAGE_KEY);
      const checked = parseChecklist(rawChecklist);
      checkedItemsRef.current = checked;
      setCheckedItems(checked);
    } catch (cause) {
      console.error('Could not load the Plans packing checklist:', cause);
      setError('Could not load your saved checklist. Pull down to retry.');
    }

    try {
      setTrails(await getTrails());
    } catch (cause) {
      console.error('Could not load trails for Plans:', cause);
      setTrails(getOfflineTrails());
      setError(
        cause instanceof ApiError
          ? 'You are viewing the offline trail guide. Connect to refresh trail details.'
          : 'You are viewing saved trails from this device while offline.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadPlans();
  }, [loadPlans]));

  function updateChecklist(next: string[], previous: string[]) {
    checkedItemsRef.current = next;
    setCheckedItems(next);
    checklistWriteRef.current = checklistWriteRef.current
      .catch(() => undefined)
      .then(async () => {
        try {
          await AsyncStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(next));
        } catch (cause) {
          console.error('Could not save the Plans checklist:', cause);
          if (checkedItemsRef.current === next) {
            checkedItemsRef.current = previous;
            setCheckedItems(previous);
          }
          setError('Your checklist change could not be saved. Please try again.');
        }
      });
  }

  function toggleChecklistItem(id: string) {
    const previous = checkedItemsRef.current;
    const next = previous.includes(id)
      ? previous.filter((item) => item !== id)
      : [...previous, id];
    updateChecklist(next, previous);
  }

  function clearChecklist() {
    updateChecklist([], checkedItemsRef.current);
  }

  async function removeFavorite(id: string) {
    try {
      setFavorites(await toggleFavoriteTrail(id));
    } catch (cause) {
      console.error('Could not remove a saved trail:', cause);
      setError('Could not update your saved trails. Please try again.');
    }
  }

  const plannedTrails = trails.filter((trail) => favorites.includes(trail.id));
  const checklistProgress = `${checkedItems.length}/${CHECKLIST_ITEMS.length}`;
  const plannedDistance = plannedTrails.reduce((total, trail) => total + trail.km, 0);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <FlatList
        data={plannedTrails}
        keyExtractor={(trail) => trail.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 56, paddingBottom: 30 }}
        ListHeaderComponent={
          <View style={{ gap: 18, marginBottom: 18 }}>
            <View>
              <Text style={{ color: C.mute, fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>YOUR NEXT ADVENTURE</Text>
              <Text style={{ color: C.spruce, fontSize: 30, fontWeight: '900', marginTop: 5 }}>Hike plans</Text>
              <Text style={{ color: C.mute, marginTop: 6 }}>Keep your favorite trails close and get ready to go.</Text>
            </View>

            <View style={{ flexDirection: 'row', backgroundColor: C.spruce, borderRadius: 20, padding: 18, gap: 14 }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="compass-outline" size={24} color={C.white} />
              </View>
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <Text style={{ color: C.white, fontSize: 18, fontWeight: '900' }}>
                  {plannedTrails.length ? `${plannedTrails.length} trail${plannedTrails.length === 1 ? '' : 's'} saved` : 'Make room for adventure'}
                </Text>
                <Text style={{ color: '#E4EADF', fontSize: 12, marginTop: 4 }}>
                  {plannedTrails.length
                    ? `${plannedDistance.toFixed(1)} km of trail to explore`
                    : 'Save trails from Explore to build your shortlist.'}
                </Text>
              </View>
            </View>

            <View style={{ backgroundColor: C.white, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 16, gap: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.ink, fontSize: 17, fontWeight: '900' }}>Trail-ready checklist</Text>
                  <Text style={{ color: C.mute, fontSize: 12, marginTop: 3 }}>A few essentials before you set out</Text>
                </View>
                <View style={{ backgroundColor: '#E8EFE4', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 7 }}>
                  <Text style={{ color: C.spruce, fontWeight: '900', fontSize: 12 }}>{checklistProgress}</Text>
                </View>
              </View>
              <View style={{ height: 6, backgroundColor: '#E9EDE6', borderRadius: 4, overflow: 'hidden' }}>
                <View style={{
                  width: `${(checkedItems.length / CHECKLIST_ITEMS.length) * 100}%`,
                  height: 6,
                  backgroundColor: C.moss,
                  borderRadius: 4,
                }} />
              </View>
              {CHECKLIST_ITEMS.map((item) => {
                const checked = checkedItems.includes(item.id);
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                    onPress={() => toggleChecklistItem(item.id)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 38 }}>
                    <Ionicons
                      name={checked ? 'checkmark-circle' : 'ellipse-outline'}
                      size={23}
                      color={checked ? C.moss : C.mute}
                    />
                    <Ionicons name={item.icon} size={18} color={C.spruce} />
                    <Text style={{
                      flex: 1,
                      color: checked ? C.mute : C.ink,
                      fontSize: 13,
                      textDecorationLine: checked ? 'line-through' : 'none',
                    }}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
              {checkedItems.length > 0 && (
                <Pressable accessibilityRole="button" onPress={clearChecklist} style={{ alignSelf: 'flex-end', paddingVertical: 4 }}>
                  <Text style={{ color: C.spruce, fontSize: 12, fontWeight: '800' }}>Reset checklist</Text>
                </Pressable>
              )}
            </View>

            <View style={{ backgroundColor: '#EEF2E9', borderRadius: 18, padding: 16, gap: 9 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="information-circle-outline" size={20} color={C.spruce} />
                <Text style={{ color: C.spruce, fontWeight: '900', fontSize: 15 }}>A little planning goes a long way</Text>
              </View>
              <Text style={{ color: C.ink, fontSize: 12, lineHeight: 18 }}>Check the weather and current trail advisories, confirm permits or guide requirements, and let someone know when you expect to return.</Text>
            </View>

            {!!error && (
              <Text accessibilityRole="alert" style={{ color: C.ember, fontSize: 12 }}>{error}</Text>
            )}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: C.ink, fontSize: 19, fontWeight: '900' }}>Saved trails</Text>
              <Text style={{ color: C.mute, fontSize: 12 }}>{plannedTrails.length}</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 30 }}>
              <ActivityIndicator color={C.spruce} />
              <Text style={{ color: C.mute }}>Loading your saved trails…</Text>
            </View>
          ) : (
            <View style={{ alignItems: 'center', gap: 10, backgroundColor: C.white, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 22 }}>
              <Ionicons name="bookmark-outline" size={38} color={C.moss} />
              <Text style={{ color: C.ink, fontSize: 17, fontWeight: '900' }}>Your shortlist starts here</Text>
              <Text style={{ color: C.mute, textAlign: 'center', lineHeight: 19 }}>Tap the heart on a trail you like and it will be waiting here when you are ready to plan.</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.navigate('/(tabs)' as Href)}
                style={{ backgroundColor: C.spruce, borderRadius: 13, paddingHorizontal: 18, paddingVertical: 12, marginTop: 3 }}>
                <Text style={{ color: C.white, fontWeight: '900' }}>Explore trails</Text>
              </Pressable>
            </View>
          )
        }
        renderItem={({ item }) => (
          <TrailCard
            trail={item}
            favorite
            onPress={() => router.push(`/trail/${item.id}` as Href)}
            onToggleFavorite={() => void removeFavorite(item.id)}
            compact
          />
        )}
        refreshing={loading}
        onRefresh={() => void loadPlans()}
      />
    </View>
  );
}
