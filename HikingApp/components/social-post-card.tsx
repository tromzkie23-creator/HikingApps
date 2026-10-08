import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { SocialPost } from '../lib/api';
import LeafletMap from '../lib/leaflet-map';
import { C } from '../lib/theme';

export function Avatar({ name, uri, size = 42 }: { name: string; uri: string | null; size?: number }) {
  return uri ? (
    <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.line }} />
  ) : (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#E3EBDD', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: C.spruce, fontWeight: '900', fontSize: size * 0.36 }}>
        {name.trim().split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '?'}
      </Text>
    </View>
  );
}

function relativeTime(value: string) {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d` : new Date(value).toLocaleDateString();
}

export function SocialPostCard({
  post,
  currentUserId,
  onOpen,
  onProfile,
  onLike,
  onComments,
  onDelete,
  onReport,
}: {
  post: SocialPost;
  currentUserId: string | null;
  onOpen: () => void;
  onProfile: () => void;
  onLike: () => void;
  onComments: () => void;
  onDelete: () => void;
  onReport: () => void;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const [photoIndex, setPhotoIndex] = useState(0);
  const photos = post.photos?.length ? post.photos : post.photo_url ? [{ id: 'legacy', photo_url: post.photo_url, position: 0 }] : [];
  const owner = currentUserId === post.user_id;
  function openMenu() {
    Alert.alert('Post options', undefined, [
      ...(owner ? [{ text: 'Delete post', style: 'destructive' as const, onPress: onDelete }] : []),
      ...(!owner ? [{ text: 'Report post', onPress: onReport }] : []),
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <View style={{ backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.line, marginBottom: 14, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`View ${post.author.name}'s profile`} onPress={onProfile}>
          <Avatar name={post.author.name} uri={post.author.avatar_url} />
        </Pressable>
        <Pressable onPress={onProfile} style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ color: C.ink, fontWeight: '800', fontSize: 14 }}>{post.author.name}</Text>
          <Text style={{ color: C.mute, fontSize: 12, marginTop: 2 }}>{relativeTime(post.created_at)}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Post options" onPress={openMenu} hitSlop={8} style={{ padding: 5 }}>
          <Ionicons name="ellipsis-horizontal" size={21} color={C.mute} />
        </Pressable>
      </View>

      {photos.length > 0 && (
        <View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => setPhotoIndex(Math.round(event.nativeEvent.contentOffset.x / (screenWidth - 40)))}>
            {photos.map((photo) => (
              <Pressable key={photo.id} onPress={onOpen}>
                <Image source={{ uri: photo.photo_url }} resizeMode="cover" style={{ width: screenWidth - 40, height: 300, backgroundColor: '#E7EAE4' }} />
              </Pressable>
            ))}
          </ScrollView>
          {photos.length > 1 && (
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5, paddingTop: 9 }}>
              {photos.map((photo, index) => <View key={photo.id} style={{ width: 6, height: 6, borderRadius: 4, backgroundColor: index === photoIndex ? C.spruce : C.line }} />)}
            </View>
          )}
        </View>
      )}

      <Pressable onPress={onOpen} style={{ paddingHorizontal: 14, paddingTop: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="location" size={15} color={C.ember} />
          <Text numberOfLines={1} style={{ flex: 1, color: C.ink, fontSize: 13, fontWeight: '700' }}>{post.place_name}</Text>
        </View>
        {!!post.caption && <Text style={{ color: C.ink, lineHeight: 21, marginTop: 9 }}>{post.caption}</Text>}
      </Pressable>

      {post.hike && (
        <Pressable accessibilityRole="button" onPress={onOpen} style={{ margin: 14, marginBottom: 0, borderRadius: 13, overflow: 'hidden', borderWidth: 1, borderColor: C.line }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 10, backgroundColor: '#F7F8F5' }}>
            <Text style={{ color: C.spruce, fontWeight: '800', fontSize: 12 }}>{post.hike.distance_km.toFixed(2)} km</Text>
            <Text style={{ color: C.spruce, fontWeight: '800', fontSize: 12 }}>{Math.floor(post.hike.duration_secs / 60)} min</Text>
            <Text style={{ color: C.spruce, fontWeight: '800', fontSize: 12 }}>{post.hike.elevation_gain_m} m ↑</Text>
          </View>
          <View pointerEvents="none" style={{ height: 150, position: 'relative' }}>
            <LeafletMap
              layer="Standard"
              me={null}
              path={post.hike.path}
              route={[]}
              destination={null}
              waypoints={[]}
              follow={false}
              fit
              recenter={0}
            />
          </View>
        </Pressable>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 22, padding: 14, paddingTop: 13 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={post.liked_by_me ? 'Unlike post' : 'Like post'} onPress={onLike} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name={post.liked_by_me ? 'heart' : 'heart-outline'} size={21} color={post.liked_by_me ? C.ember : C.ink} />
          <Text style={{ color: C.ink, fontWeight: '700', fontSize: 13 }}>{post.like_count}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onComments} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="chatbubble-outline" size={19} color={C.ink} />
          <Text style={{ color: C.ink, fontWeight: '700', fontSize: 13 }}>{post.comment_count}</Text>
        </Pressable>
      </View>
    </View>
  );
}
