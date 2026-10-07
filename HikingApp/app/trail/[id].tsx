import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { ApiError, getToken, getTrail, getTrailReviews, submitTrailReview, type TrailReview } from '../../lib/api';
import { getFavoriteTrailIds, toggleFavoriteTrail } from '../../lib/favorites';
import { getOfflineTrail } from '../../lib/offline-trails';
import { formatDuration, getTrailEstimatedMinutes, getTrailPresentation } from '../../lib/trail-presentation';
import { Btn } from '../../lib/ui';
import { C, type Trail } from '../../lib/theme';
import { TrailMap } from '../../lib/trail-map';

const DETAIL_TABS = ['Overview', 'Map', 'Reviews', 'Photos'] as const;
type DetailTab = (typeof DETAIL_TABS)[number];

export default function TrailDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [trail, setTrail] = useState<Trail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [usingOfflineTrail, setUsingOfflineTrail] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>('Overview');
  const [hasSession, setHasSession] = useState(false);
  const [reviews, setReviews] = useState<TrailReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState('');
  const [ratingAverage, setRatingAverage] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [draftRating, setDraftRating] = useState(5);
  const [draftComment, setDraftComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const loadTrail = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [loadedTrail, favorites] = await Promise.all([getTrail(id), getFavoriteTrailIds()]);
      setTrail(loadedTrail);
      setFavorite(favorites.includes(id));
      setUsingOfflineTrail(false);
      setRatingAverage(loadedTrail.ratingAverage ?? 0);
      setRatingCount(loadedTrail.ratingCount ?? 0);
    } catch (cause) {
      const offlineTrail = getOfflineTrail(id);
      if (offlineTrail) {
        setTrail(offlineTrail);
        setUsingOfflineTrail(true);
        try {
          setFavorite((await getFavoriteTrailIds()).includes(id));
        } catch {
          setError('Could not load saved status. You can still view this trail.');
        }
      } else {
        setError(cause instanceof ApiError ? cause.message : 'Could not load this trail. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => {
    void loadTrail();
  }, [loadTrail]));

  const loadReviews = useCallback(async () => {
    setReviewsLoading(true);
    setReviewsError('');
    try {
      const result = await getTrailReviews(id);
      setReviews(result.reviews);
      setRatingAverage(result.ratingAverage);
      setRatingCount(result.ratingCount);
      setTrail((current) => current ? {
        ...current,
        ratingAverage: result.ratingAverage,
        ratingCount: result.ratingCount,
      } : current);
    } catch (cause) {
      setReviewsError(cause instanceof ApiError ? cause.message : 'Could not load reviews. Please try again.');
    } finally {
      setReviewsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let active = true;
    getToken().then((token) => {
      if (active) setHasSession(Boolean(token));
    }).catch(() => {
      if (active) setHasSession(false);
    });
    return () => {
      active = false;
    };
  }, []);

  async function toggleFavorite() {
    try {
      const ids = await toggleFavoriteTrail(id);
      setFavorite(ids.includes(id));
    } catch {
      setError('Could not update this saved trail.');
    }
  }

  async function submitReview() {
    if (!hasSession) {
      setReviewsError('Log in or create an account to write a review.');
      return;
    }
    setSubmittingReview(true);
    setReviewsError('');
    try {
      await submitTrailReview(id, draftRating, draftComment);
      setDraftComment('');
      await loadReviews();
    } catch (cause) {
      setReviewsError(cause instanceof ApiError ? cause.message : 'Could not submit your review. Please try again.');
    } finally {
      setSubmittingReview(false);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <ActivityIndicator color={C.spruce} />
        <Text style={{ color: C.mute }}>Loading trail…</Text>
      </View>
    );
  }

  if (error && !trail) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, padding: 24, justifyContent: 'center', gap: 14 }}>
        <Text accessibilityRole="alert" style={{ color: C.ember }}>{error || 'Trail not found.'}</Text>
        <Pressable accessibilityRole="button" onPress={() => void loadTrail()}>
          <Text style={{ color: C.spruce, fontWeight: '800' }}>Tap to try again</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Text style={{ color: C.mute }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  if (!trail) return null;
  const presentation = getTrailPresentation(trail);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 105 }}>
        <View style={{ height: 235, backgroundColor: '#DCE7D4', justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="trail-sign-outline" size={74} color={C.spruce} />
          <Text style={{ color: C.spruce, fontSize: 12, fontWeight: '800', marginTop: 10, letterSpacing: 1.2 }}>TRAILHEAD FIELD GUIDE</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={{ position: 'absolute', top: 54, left: 20, width: 42, height: 42, borderRadius: 22, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="arrow-back" size={20} color={C.spruce} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={favorite ? 'Remove from plans' : 'Save to plans'} onPress={() => void toggleFavorite()} style={{ position: 'absolute', top: 54, right: 20, width: 42, height: 42, borderRadius: 22, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={favorite ? 'heart' : 'heart-outline'} size={20} color={favorite ? C.ember : C.spruce} />
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="star" size={16} color="#D99D35" />
            <Text style={{ color: C.ink, fontWeight: '800' }}>
              {ratingCount ? ratingAverage.toFixed(1) : 'New'}
            </Text>
            <Text style={{ color: C.mute }}>({ratingCount})</Text>
            <Text style={{ color: C.mute }}>· {presentation.park}</Text>
          </View>
          <Text style={{ color: C.spruce, fontSize: 29, fontWeight: '900', marginTop: 8 }}>{trail.name}</Text>
          <Text style={{ color: C.mute, marginTop: 4 }}>{trail.area}</Text>

          <View style={{ flexDirection: 'row', backgroundColor: C.white, borderRadius: 17, paddingVertical: 16, marginTop: 19, borderWidth: 1, borderColor: C.line }}>
            {[
              { icon: 'walk-outline' as const, value: `${trail.km}`, unit: 'km' },
              { icon: 'trending-up-outline' as const, value: `${trail.gain}`, unit: 'm gain' },
              { icon: 'time-outline' as const, value: formatDuration(getTrailEstimatedMinutes(trail)), unit: 'est. time' },
            ].map((metric, index) => (
              <View key={metric.unit} style={{ flex: 1, alignItems: 'center', borderRightWidth: index < 2 ? 1 : 0, borderRightColor: C.line }}>
                <Ionicons name={metric.icon} size={17} color={C.moss} />
                <Text style={{ color: C.ink, fontSize: 16, fontWeight: '900', marginTop: 5 }}>{metric.value}</Text>
                <Text style={{ color: C.mute, fontSize: 10, marginTop: 2 }}>{metric.unit}</Text>
              </View>
            ))}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 19, borderBottomWidth: 1, borderBottomColor: C.line, marginTop: 20 }}>
            {DETAIL_TABS.map((tab) => (
              <Pressable key={tab} accessibilityRole="tab" accessibilityState={{ selected: activeTab === tab }} onPress={() => {
                setActiveTab(tab);
                if (tab === 'Reviews') void loadReviews();
              }} style={{ paddingBottom: 12, borderBottomWidth: activeTab === tab ? 2 : 0, borderBottomColor: C.spruce }}>
                <Text style={{ color: activeTab === tab ? C.spruce : C.mute, fontWeight: activeTab === tab ? '800' : '600' }}>{tab}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {usingOfflineTrail && (
            <Text style={{ color: C.mute, fontSize: 12, marginTop: 12 }}>
              Showing built-in trail details while offline.
            </Text>
          )}
          {!!error && <Text accessibilityRole="alert" style={{ color: C.ember, marginTop: 10 }}>{error}</Text>}

          {activeTab === 'Overview' && (
            <View style={{ paddingTop: 18 }}>
              <Text style={{ color: C.ink, fontSize: 18, fontWeight: '800', marginBottom: 8 }}>About this trail</Text>
              <Text style={{ color: C.mute, lineHeight: 22 }}>{trail.desc}</Text>
              <Text style={{ color: C.ink, fontSize: 18, fontWeight: '800', marginTop: 22, marginBottom: 10 }}>Trail highlights</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {presentation.tags.map((tag) => (
                  <View key={tag} style={{ backgroundColor: '#E3EBDD', borderRadius: 20, paddingHorizontal: 13, paddingVertical: 8 }}>
                    <Text style={{ color: C.spruce, fontSize: 12, fontWeight: '700' }}>{tag}</Text>
                  </View>
                ))}
              </View>
              <Text style={{ color: C.ink, fontSize: 18, fontWeight: '800', marginTop: 22, marginBottom: 8 }}>Elevation profile</Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 94, gap: 5, padding: 8, backgroundColor: C.white, borderRadius: 14 }}>
                {trail.elev.map((elevation, index) => (
                  <View key={`${index}-${elevation}`} style={{ flex: 1, height: Math.max(8, elevation * 0.65), backgroundColor: C.moss, borderRadius: 4 }} />
                ))}
              </View>
              <Text style={{ color: C.ink, fontSize: 18, fontWeight: '800', marginTop: 22, marginBottom: 8 }}>Waypoints</Text>
              {trail.wps.map((waypoint) => (
                <View key={waypoint.name} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.line }}>
                  <Text style={{ color: C.ink }}>{waypoint.name} · {waypoint.type}</Text>
                  <Text style={{ color: C.mute }}>{waypoint.km} km</Text>
                </View>
              ))}
            </View>
          )}

          {activeTab === 'Map' && (
            <View style={{ paddingTop: 16 }}>
              <TrailMap trail={trail} />
            </View>
          )}
          {activeTab === 'Reviews' && (
            <View style={{ paddingTop: 18 }}>
              <View style={{ backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 15 }}>
                <Text style={{ color: C.ink, fontSize: 16, fontWeight: '800' }}>Rate this trail</Text>
                <View style={{ flexDirection: 'row', gap: 7, marginTop: 9, marginBottom: 10 }}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Pressable key={value} accessibilityRole="button" accessibilityLabel={`${value} stars`} accessibilityState={{ selected: draftRating === value }} onPress={() => setDraftRating(value)}>
                      <Ionicons name={value <= draftRating ? 'star' : 'star-outline'} size={26} color="#D99D35" />
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  accessibilityLabel="Review comment"
                  value={draftComment}
                  onChangeText={setDraftComment}
                  placeholder="Share a few thoughts (optional)"
                  placeholderTextColor={C.mute}
                  maxLength={1000}
                  multiline
                  style={{ minHeight: 82, textAlignVertical: 'top', backgroundColor: C.bg, borderRadius: 11, padding: 12, color: C.ink }}
                />
                <Text style={{ color: C.mute, fontSize: 10, alignSelf: 'flex-end', marginTop: 4 }}>{draftComment.length}/1000</Text>
                {!hasSession && <Text style={{ color: C.mute, fontSize: 12, marginTop: 7 }}>Log in to submit your review.</Text>}
                <View style={{ marginTop: 10 }}>
                  <Btn t={submittingReview ? 'Submitting…' : 'Submit review'} onPress={() => void submitReview()} />
                </View>
              </View>
              {!!reviewsError && (
                <View style={{ gap: 8, marginTop: 12 }}>
                  <Text accessibilityRole="alert" style={{ color: C.ember }}>{reviewsError}</Text>
                  <Pressable accessibilityRole="button" onPress={() => void loadReviews()}>
                    <Text style={{ color: C.spruce, fontWeight: '700' }}>Retry loading reviews</Text>
                  </Pressable>
                </View>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 10 }}>
                <Text style={{ color: C.ink, fontSize: 17, fontWeight: '800' }}>Hiker reviews</Text>
                <Text style={{ color: C.mute }}>{ratingCount} total</Text>
              </View>
              {reviewsLoading ? (
                <ActivityIndicator color={C.spruce} style={{ padding: 22 }} />
              ) : reviews.length ? reviews.map((review) => (
                <View key={review.id} style={{ backgroundColor: C.white, borderRadius: 14, padding: 14, marginBottom: 9, borderWidth: 1, borderColor: C.line }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: C.ink, fontWeight: '800' }}>{review.reviewer}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="star" size={14} color="#D99D35" />
                      <Text style={{ color: C.ink, fontWeight: '700' }}>{review.rating}/5</Text>
                    </View>
                  </View>
                  {!!review.comment && <Text style={{ color: C.mute, lineHeight: 20, marginTop: 8 }}>{review.comment}</Text>}
                  <Text style={{ color: C.mute, fontSize: 10, marginTop: 8 }}>{new Date(review.createdAt).toLocaleDateString()}</Text>
                </View>
              )) : !reviewsError ? (
                <Text style={{ color: C.mute, textAlign: 'center', paddingVertical: 20 }}>No reviews yet. Be the first to share your experience.</Text>
              ) : null}
            </View>
          )}
          {activeTab === 'Photos' && (
            <View style={{ alignItems: 'center', paddingVertical: 45, gap: 9 }}>
              <Ionicons name="images-outline" size={34} color={C.moss} />
              <Text style={{ color: C.ink, fontWeight: '800' }}>Trail photos are coming soon</Text>
              <Text style={{ color: C.mute, textAlign: 'center' }}>Photo sharing is not connected yet.</Text>
            </View>
          )}
        </View>
      </ScrollView>
      <View style={{ position: 'absolute', left: 20, right: 20, bottom: 16 }}>
        <Btn t="Start hike" onPress={() => router.push(`/navigate/${trail.id}` as Href)} />
      </View>
    </View>
  );
}
