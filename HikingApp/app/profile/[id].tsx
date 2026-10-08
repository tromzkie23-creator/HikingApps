import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { ApiError, getPublicSocialProfile, getSocialPosts, type PublicSocialProfile, type SocialPost } from '../../lib/api';
import { Avatar } from '../../components/social-post-card';
import { C } from '../../lib/theme';

export default function PublicProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [profile, setProfile] = useState<PublicSocialProfile | null>(null);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState('');
  const pagingRef = useRef(false);

  useEffect(() => {
    let active = true;
    void Promise.all([getPublicSocialProfile(id), getSocialPosts(null, id)]).then(([profileResult, postResult]) => {
      if (!active) return;
      setProfile(profileResult.profile);
      setPosts(postResult.posts);
      setNextCursor(postResult.next_cursor);
    }).catch((cause: unknown) => {
      console.error(`Could not load public profile ${id}:`, cause);
      if (active) setError(cause instanceof ApiError ? cause.message : 'Could not load this profile.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  async function loadMore() {
    if (!nextCursor || pagingRef.current) return;
    pagingRef.current = true;
    setLoadingMore(true);
    try {
      const result = await getSocialPosts(nextCursor, id);
      setPosts((current) => [...current, ...result.posts]);
      setNextCursor(result.next_cursor);
    } catch (cause) {
      console.error(`Could not load more posts for profile ${id}:`, cause);
      setError(cause instanceof ApiError ? cause.message : 'Could not load more posts.');
    } finally {
      pagingRef.current = false;
      setLoadingMore(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ height: 56, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable accessibilityRole="button" onPress={() => router.back()}><Ionicons name="arrow-back" size={23} color={C.spruce} /></Pressable>
        <Text style={{ color: C.spruce, fontSize: 19, fontWeight: '900' }}>Hiker profile</Text>
      </View>
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}><ActivityIndicator color={C.spruce} /><Text style={{ color: C.mute }}>Loading profile…</Text></View>
      ) : error || !profile ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}><Text accessibilityRole="alert" style={{ color: C.ember, textAlign: 'center' }}>{error || 'Profile not found.'}</Text></View>
      ) : (
        <FlatList
          data={posts}
          numColumns={3}
          keyExtractor={(post) => post.id}
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore
            ? <ActivityIndicator color={C.spruce} style={{ padding: 18 }} />
            : error ? <Text accessibilityRole="alert" style={{ color: C.ember, textAlign: 'center', padding: 18 }}>{error}</Text> : null}
          contentContainerStyle={{ paddingBottom: 28 }}
          ListHeaderComponent={
            <View style={{ alignItems: 'center', paddingHorizontal: 22, paddingTop: 16, paddingBottom: 22 }}>
              <Avatar name={profile.name} uri={profile.avatar_url} size={92} />
              <Text style={{ color: C.ink, fontWeight: '900', fontSize: 23, marginTop: 12 }}>{profile.name}</Text>
              {!!profile.bio && <Text style={{ color: C.mute, textAlign: 'center', lineHeight: 21, marginTop: 7 }}>{profile.bio}</Text>}
              <View style={{ flexDirection: 'row', gap: 34, marginTop: 18 }}>
                <View style={{ alignItems: 'center' }}><Text style={{ color: C.spruce, fontSize: 18, fontWeight: '900' }}>{profile.hike_count}</Text><Text style={{ color: C.mute, fontSize: 12 }}>hikes</Text></View>
                <View style={{ alignItems: 'center' }}><Text style={{ color: C.spruce, fontSize: 18, fontWeight: '900' }}>{profile.distance_km.toFixed(1)}</Text><Text style={{ color: C.mute, fontSize: 12 }}>km hiked</Text></View>
                <View style={{ alignItems: 'center' }}><Text style={{ color: C.spruce, fontSize: 18, fontWeight: '900' }}>{profile.post_count}</Text><Text style={{ color: C.mute, fontSize: 12 }}>posts</Text></View>
              </View>
              <Text style={{ alignSelf: 'flex-start', color: C.ink, fontSize: 16, fontWeight: '900', marginTop: 24 }}>Posts</Text>
            </View>
          }
          ListEmptyComponent={<Text style={{ color: C.mute, textAlign: 'center', padding: 28 }}>No posts yet.</Text>}
          renderItem={({ item, index }) => {
            const uri = item.photos?.[0]?.photo_url || item.photo_url;
            const gap = 3;
            const cellWidth = (width - gap * 2) / 3;
            return (
              <Pressable onPress={() => router.push(`/post/${encodeURIComponent(item.id)}` as Href)}
                style={{ width: cellWidth, height: cellWidth, marginRight: index % 3 === 2 ? 0 : gap, marginBottom: gap, backgroundColor: C.line }}>
                {uri ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} /> : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="footsteps-outline" size={26} color={C.spruce} /></View>}
                {!!item.hike && <Ionicons name="map" size={17} color={C.white} style={{ position: 'absolute', right: 7, bottom: 7, textShadowColor: '#000', textShadowRadius: 4 }} />}
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}
