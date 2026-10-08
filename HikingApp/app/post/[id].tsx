import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import {
  ApiError,
  createSocialPostComment,
  getSocialPost,
  getSocialPostComments,
  type SocialPost,
  type SocialPostComment,
} from '../../lib/api';
import LeafletMap from '../../lib/leaflet-map';
import { Avatar } from '../../components/social-post-card';
import { C } from '../../lib/theme';

export default function PostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [post, setPost] = useState<SocialPost | null>(null);
  const [comments, setComments] = useState<SocialPostComment[]>([]);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void Promise.all([getSocialPost(id), getSocialPostComments(id)]).then(([postResult, commentResult]) => {
      if (!active) return;
      setPost(postResult.post);
      setComments(commentResult.comments);
    }).catch((cause: unknown) => {
      console.error(`Could not load post ${id}:`, cause);
      if (active) setError(cause instanceof ApiError ? cause.message : 'Could not load this post.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  async function submitComment() {
    const body = comment.trim();
    if (!body || sending) return;
    setSending(true);
    setError('');
    try {
      const result = await createSocialPostComment(id, body);
      setComments((current) => [...current, result.comment]);
      setComment('');
      setPost((current) => current ? { ...current, comment_count: current.comment_count + 1 } : current);
    } catch (cause) {
      console.error(`Could not add comment to post ${id}:`, cause);
      setError(cause instanceof ApiError ? cause.message : 'Could not add your comment. Please retry.');
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center', gap: 10 }}><ActivityIndicator color={C.spruce} /><Text style={{ color: C.mute }}>Loading post…</Text></View>;
  }
  if (!post) {
    return <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 }}>
      <Text accessibilityRole="alert" style={{ color: C.ember, textAlign: 'center' }}>{error || 'Post not found.'}</Text>
      <Pressable onPress={() => router.back()}><Text style={{ color: C.spruce, fontWeight: '800' }}>Go back</Text></Pressable>
    </View>;
  }
  const destination = { latitude: post.latitude, longitude: post.longitude, name: post.place_name };
  const photos = post.photos?.length ? post.photos : post.photo_url ? [{ id: 'legacy', photo_url: post.photo_url, position: 0 }] : [];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ height: 52, paddingHorizontal: 16, paddingTop: 5, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable accessibilityRole="button" onPress={() => router.back()}><Ionicons name="arrow-back" size={23} color={C.spruce} /></Pressable>
        <Text style={{ color: C.spruce, fontSize: 19, fontWeight: '900' }}>Post</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <Pressable onPress={() => router.push(`/profile/${encodeURIComponent(post.user_id)}` as Href)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11, gap: 10 }}>
            <Avatar name={post.author.name} uri={post.author.avatar_url} />
            <Text style={{ color: C.ink, fontWeight: '800', flex: 1 }}>{post.author.name}</Text>
            <Text style={{ color: C.mute, fontSize: 12 }}>{new Date(post.created_at).toLocaleDateString()}</Text>
          </View>
        </Pressable>
        {photos.map((photo) => <Image key={photo.id} source={{ uri: photo.photo_url }} resizeMode="cover" style={{ width: '100%', height: 340, backgroundColor: C.line }} />)}
        <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="location" size={17} color={C.ember} />
            <Text style={{ color: C.ink, fontWeight: '800', flex: 1 }}>{post.place_name}</Text>
          </View>
          {!!post.caption && <Text style={{ color: C.ink, lineHeight: 22, marginTop: 10 }}>{post.caption}</Text>}
        </View>
        {post.hike && (
          <View style={{ height: 310, marginHorizontal: 16, marginTop: 14, borderRadius: 16, overflow: 'hidden', backgroundColor: C.line }}>
            <LeafletMap layer="Standard" me={null} path={post.hike.path} route={[]} destination={destination} waypoints={[]} follow={false} fit recenter={0} />
          </View>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(`/(tabs)/record?destinationLat=${post.latitude}&destinationLng=${post.longitude}&destinationName=${encodeURIComponent(post.place_name)}` as Href)}
          style={{ marginHorizontal: 16, marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 13, paddingVertical: 13, backgroundColor: C.spruce }}>
          <Ionicons name="navigate" size={18} color={C.white} />
          <Text style={{ color: C.white, fontWeight: '900' }}>Start a hike here</Text>
        </Pressable>
        <View style={{ marginTop: 22, paddingHorizontal: 16 }}>
          <Text style={{ color: C.ink, fontSize: 17, fontWeight: '900', marginBottom: 12 }}>Comments ({comments.length})</Text>
          {comments.map((item) => (
            <View key={item.id} style={{ flexDirection: 'row', gap: 9, marginBottom: 13 }}>
              <Avatar name={item.author.name} uri={item.author.avatar_url} size={34} />
              <View style={{ flex: 1, backgroundColor: C.white, borderRadius: 12, padding: 11 }}>
                <Text style={{ color: C.ink, fontWeight: '800', fontSize: 12 }}>{item.author.name}</Text>
                <Text style={{ color: C.ink, marginTop: 4, lineHeight: 19 }}>{item.body}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={{ padding: 12, borderTopColor: C.line, borderTopWidth: 1, flexDirection: 'row', gap: 8, backgroundColor: C.white }}>
        <TextInput value={comment} onChangeText={setComment} placeholder="Add a comment…" placeholderTextColor={C.mute} maxLength={1000}
          style={{ flex: 1, minHeight: 42, maxHeight: 100, borderRadius: 22, paddingHorizontal: 15, paddingVertical: 9, backgroundColor: C.bg, color: C.ink }} />
        <Pressable accessibilityRole="button" disabled={!comment.trim() || sending} onPress={() => void submitComment()} style={{ alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }}>
          {sending ? <ActivityIndicator color={C.spruce} /> : <Ionicons name="send" size={21} color={comment.trim() ? C.spruce : C.mute} />}
        </Pressable>
      </View>
      {!!error && <Text accessibilityRole="alert" style={{ color: C.ember, backgroundColor: C.white, paddingHorizontal: 16, paddingBottom: 8 }}>{error}</Text>}
    </View>
  );
}
