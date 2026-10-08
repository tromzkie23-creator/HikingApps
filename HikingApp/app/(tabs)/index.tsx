import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';

import {
  ApiError,
  deleteSocialPost,
  getSavedUser,
  getSocialPosts,
  getTrails,
  likeSocialPost,
  reportSocialPost,
  unlikeSocialPost,
  type SessionUser,
  type SocialPost,
} from '../../lib/api';
import { getFavoriteTrailIds, toggleFavoriteTrail } from '../../lib/favorites';
import { C, type Trail } from '../../lib/theme';
import { TrailCard } from '../../components/trail-card';
import { SocialPostCard } from '../../components/social-post-card';

const DIFFICULTY_FILTERS = ['All', 'Easy', 'Moderate', 'Hard', 'Under 5 km'] as const;
type ExploreTab = 'Feed' | 'Trails';

function TrailsList() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<(typeof DIFFICULTY_FILTERS)[number]>('All');
  const [trails, setTrails] = useState<Trail[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadExplore = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [favoriteIds, loadedTrails] = await Promise.all([getFavoriteTrailIds(), getTrails()]);
      setFavorites(favoriteIds);
      setTrails(loadedTrails);
    } catch (cause) {
      console.error('Could not load Explore trails:', cause);
      setError(cause instanceof ApiError ? cause.message : 'Could not load trails. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadExplore();
    }, [loadExplore])
  );

  const filteredTrails = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return trails.filter((trail) => {
      const matchesQuery =
        !normalizedQuery ||
        `${trail.name} ${trail.area}`.toLowerCase().includes(normalizedQuery);
      const matchesDifficulty =
        difficultyFilter === 'All' ||
        (difficultyFilter === 'Under 5 km'
          ? trail.km < 5
          : trail.level.toLowerCase() === difficultyFilter.toLowerCase());
      return matchesQuery && matchesDifficulty;
    });
  }, [difficultyFilter, query, trails]);

  async function toggleFavorite(id: string) {
    try {
      setFavorites(await toggleFavoriteTrail(id));
    } catch (cause) {
      console.error(`Could not update favorite trail ${id}:`, cause);
      setError('Could not update saved trails. Please try again.');
    }
  }

  function clearFilters() {
    setQuery('');
    setDifficultyFilter('All');
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <FlatList
        data={filteredTrails}
        keyExtractor={(trail) => trail.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 58, paddingBottom: 30 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ color: C.mute, fontSize: 12, fontWeight: '700', letterSpacing: 1.2 }}>YOUR NEXT ADVENTURE</Text>
                <Text style={{ color: C.spruce, fontSize: 30, fontWeight: '900', marginTop: 5 }}>Explore trails</Text>
              </View>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#E3EBDD', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="compass-outline" size={23} color={C.spruce} />
              </View>
            </View>
            <View style={{ marginTop: 20, flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: 15, paddingHorizontal: 14, borderWidth: 1, borderColor: C.line }}>
              <Ionicons name="search" size={19} color={C.mute} />
              <TextInput
                accessibilityLabel="Search trails by name or area"
                value={query}
                onChangeText={setQuery}
                placeholder="Search trails by name or area"
                placeholderTextColor={C.mute}
                returnKeyType="search"
                style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 10, color: C.ink, fontSize: 14 }}
              />
              {!!query && (
                <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')}>
                  <Ionicons name="close-circle" size={19} color={C.mute} />
                </Pressable>
              )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 17, paddingBottom: 10 }}>
              {DIFFICULTY_FILTERS.map((item) => {
                const selected = difficultyFilter === item;
                return (
                  <Pressable
                    key={item}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setDifficultyFilter(item)}
                    style={{
                      backgroundColor: selected ? C.spruce : C.white,
                      borderColor: selected ? C.spruce : C.line,
                      borderWidth: 1,
                      borderRadius: 22,
                      paddingHorizontal: 15,
                      paddingVertical: 9,
                    }}>
                    <Text style={{ color: selected ? C.white : C.ink, fontSize: 13, fontWeight: '700' }}>{item}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: C.ink }}>Available trails</Text>
              <Text style={{ color: C.mute, fontSize: 12 }}>{filteredTrails.length} found</Text>
            </View>
            {!!error && (
              <View style={{ backgroundColor: '#FFF1EB', borderRadius: 14, padding: 14, marginBottom: 14, gap: 9 }}>
                <Text accessibilityRole="alert" style={{ color: C.ember, lineHeight: 19 }}>{error}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void loadExplore()}
                  style={{ alignSelf: 'flex-start', backgroundColor: C.white, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 }}>
                  <Text style={{ color: C.spruce, fontWeight: '800' }}>Retry</Text>
                </Pressable>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ alignItems: 'center', padding: 30, gap: 10 }}>
              <ActivityIndicator color={C.spruce} />
              <Text style={{ color: C.mute }}>Loading trails…</Text>
            </View>
          ) : error ? null : (
            <View style={{ alignItems: 'center', paddingVertical: 22, gap: 12 }}>
              <Text style={{ color: C.mute, textAlign: 'center' }}>No trails match</Text>
              <Pressable accessibilityRole="button" onPress={clearFilters}>
                <Text style={{ color: C.spruce, fontWeight: '800' }}>Clear filters</Text>
              </Pressable>
            </View>
          )
        }
        renderItem={({ item: trail }) => (
          <TrailCard
            trail={trail}
            favorite={favorites.includes(trail.id)}
            onPress={() => router.push(`/trail/${trail.id}` as Href)}
            onToggleFavorite={() => void toggleFavorite(trail.id)}
          />
        )}
        refreshing={loading}
        onRefresh={() => void loadExplore()}
      />
    </View>
  );
}

function SocialFeed() {
  const router = useRouter();
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const pagingRef = useRef(false);
  const cursorRef = useRef<string | null>(null);
  const postsRef = useRef<SocialPost[]>([]);
  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  const loadFeed = useCallback(async (refresh = false) => {
    if (pagingRef.current && !refresh) return;
    pagingRef.current = true;
    if (refresh) setRefreshing(true);
    else if (!postsRef.current.length) setLoading(true);
    setError('');
    try {
      const [profile, page] = await Promise.all([getSavedUser(), getSocialPosts(refresh ? null : cursorRef.current)]);
      setUser(profile);
      setPosts((current) => refresh || !cursorRef.current ? page.posts : [...current, ...page.posts]);
      cursorRef.current = page.next_cursor;
      setHasMore(Boolean(page.next_cursor));
    } catch (cause) {
      console.error('Could not load hiking feed:', cause);
      setError(cause instanceof ApiError ? cause.message : 'Could not load the feed. Check your connection and retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
      pagingRef.current = false;
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadFeed(true);
  }, [loadFeed]));

  async function loadNextPage() {
    if (!hasMore || loadingMore || loading || pagingRef.current) return;
    setLoadingMore(true);
    await loadFeed(false);
  }

  async function toggleLike(post: SocialPost) {
    try {
      const result = post.liked_by_me
        ? await unlikeSocialPost(post.id)
        : await likeSocialPost(post.id);
      setPosts((current) => current.map((item) => item.id === post.id
        ? { ...item, liked_by_me: result.liked, like_count: result.like_count }
        : item));
    } catch (cause) {
      console.error(`Could not update like for post ${post.id}:`, cause);
      Alert.alert('Like not saved', cause instanceof ApiError ? cause.message : 'Please try again.');
    }
  }

  function confirmDelete(post: SocialPost) {
    Alert.alert('Delete this post?', 'This will remove your post and its comments.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteSocialPost(post.id).then(() => setPosts((current) => current.filter((item) => item.id !== post.id)))
            .catch((cause: unknown) => {
              console.error(`Could not delete post ${post.id}:`, cause);
              Alert.alert('Could not delete post', cause instanceof ApiError ? cause.message : 'Please try again.');
            });
        },
      },
    ]);
  }

  function confirmReport(post: SocialPost) {
    Alert.alert('Report this post?', 'Reports are reviewed by the Trailhead team.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Report',
        style: 'destructive',
        onPress: () => {
          void reportSocialPost(post.id, 'Reported by user')
            .then(() => Alert.alert('Report sent', 'Thanks for helping keep the community safe.'))
            .catch((cause: unknown) => {
              console.error(`Could not report post ${post.id}:`, cause);
              Alert.alert('Could not send report', cause instanceof ApiError ? cause.message : 'Please try again.');
            });
        },
      },
    ]);
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={posts}
        keyExtractor={(post) => post.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 90, flexGrow: 1 }}
        refreshing={refreshing}
        onRefresh={() => void loadFeed(true)}
        onEndReached={() => void loadNextPage()}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          error ? (
            <View style={{ backgroundColor: '#FFF1EB', borderRadius: 14, padding: 14, marginBottom: 14, gap: 8 }}>
              <Text accessibilityRole="alert" style={{ color: C.ember }}>{error}</Text>
              <Pressable accessibilityRole="button" onPress={() => void loadFeed(true)}>
                <Text style={{ color: C.spruce, fontWeight: '800' }}>Retry</Text>
              </Pressable>
            </View>
          ) : null
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ flex: 1, minHeight: 240, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <ActivityIndicator color={C.spruce} />
              <Text style={{ color: C.mute }}>Loading the hiking feed…</Text>
            </View>
          ) : !error ? (
            <View style={{ flex: 1, minHeight: 240, alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 24 }}>
              <Ionicons name="images-outline" size={42} color={C.moss} />
              <Text style={{ color: C.ink, fontSize: 18, fontWeight: '800' }}>Your feed starts here</Text>
              <Text style={{ color: C.mute, textAlign: 'center' }}>Share a photo or a recorded hike with the Trailhead community.</Text>
            </View>
          ) : null
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator color={C.spruce} style={{ padding: 16 }} /> : null}
        renderItem={({ item }) => (
          <SocialPostCard
            post={item}
            currentUserId={user?.id ?? null}
            onOpen={() => router.push(`/post/${encodeURIComponent(item.id)}` as Href)}
            onProfile={() => router.push(`/profile/${encodeURIComponent(item.user_id)}` as Href)}
            onLike={() => void toggleLike(item)}
            onComments={() => router.push(`/post/${encodeURIComponent(item.id)}` as Href)}
            onDelete={() => confirmDelete(item)}
            onReport={() => confirmReport(item)}
          />
        )}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create a post"
        onPress={() => router.push('/create-post' as Href)}
        style={{ position: 'absolute', right: 22, bottom: 20, width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: C.spruce, elevation: 6 }}>
        <Ionicons name="add" size={32} color={C.white} />
      </Pressable>
    </View>
  );
}

export default function Explore() {
  const [tab, setTab] = useState<ExploreTab>('Feed');
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 54, paddingBottom: 8 }}>
        <Text style={{ color: C.mute, fontSize: 12, fontWeight: '700', letterSpacing: 1.2 }}>TRAILHEAD COMMUNITY</Text>
        <Text style={{ color: C.spruce, fontSize: 30, fontWeight: '900', marginTop: 4 }}>Explore</Text>
        <View style={{ flexDirection: 'row', backgroundColor: '#E6EAE2', borderRadius: 13, padding: 4, marginTop: 14 }}>
          {(['Feed', 'Trails'] as const).map((item) => (
            <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: tab === item }} onPress={() => setTab(item)}
              style={{ flex: 1, alignItems: 'center', backgroundColor: tab === item ? C.white : 'transparent', borderRadius: 10, paddingVertical: 9 }}>
              <Text style={{ color: tab === item ? C.spruce : C.mute, fontWeight: '800' }}>{item}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      {tab === 'Feed' ? <SocialFeed /> : <TrailsList />}
    </View>
  );
}
