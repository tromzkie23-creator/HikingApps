import AsyncStorage from '@react-native-async-storage/async-storage';
import { File } from 'expo-file-system';
import { fetch as expoFetch } from 'expo/fetch';
import * as SecureStore from 'expo-secure-store';

import { getOfflineTrails } from './offline-trails';
import type { Coordinate, Trail, TrailWaypoint } from './theme';

const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
export const API_BASE_URL = configuredApiBaseUrl || 'https://your-trailhead-api.vercel.app';

const TOKEN_KEY = 'trailhead.jwt';
const USER_KEY = 'trailhead.user';
const GUEST_HIKES_KEY = 'trailhead.guest-hikes';
const LOCAL_HIKES_KEY = 'trailhead.local-hikes';
const FAVORITES_KEY = 'trailhead.favorite-trails';

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  avatar_url?: string | null;
  bio?: string | null;
};

export type SocialPost = {
  id: string;
  user_id: string;
  photo_url: string;
  caption: string;
  place_name: string;
  latitude: number;
  longitude: number;
  suggest_hike: boolean;
  created_at: string;
  author: { name: string; avatar_url: string | null };
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
  photos: { id: string; photo_url: string; position: number }[];
  hike: {
    id: string;
    distance_km: number;
    duration_secs: number;
    elevation_gain_m: number;
    path: Coordinate[];
  } | null;
};

export type SocialPostComment = {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
  author: { name: string; avatar_url: string | null };
};

export type SocialProfile = SessionUser & {
  avatar_url: string | null;
  bio: string | null;
};

export type NewSocialPost = {
  photoUrls: string[];
  caption: string;
  placeName?: string;
  latitude?: number;
  longitude?: number;
  hikeId?: string | null;
  hideEndpoints: boolean;
};

export type PublicSocialProfile = {
  id: string;
  name: string;
  avatar_url: string | null;
  bio: string | null;
  hike_count: number;
  distance_km: number;
  post_count: number;
};

export type ProfileChanges = {
  name?: string;
  bio?: string | null;
  avatarUrl?: string | null;
};

export type TrailReview = {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  reviewer: string;
};

export type TrailReviewsResponse = {
  reviews: TrailReview[];
  ratingAverage: number;
  ratingCount: number;
};

export type TrailStats = {
  year: number;
  lifetime: {
    hikes: number;
    distanceKm: number;
    movingTimeSecs: number;
    caloriesEstimate: number;
  };
  monthlyDistance: { month: number; distanceKm: number }[];
  personalBests: {
    longestHike: { distanceKm: number; trailId: string; trail: string } | null;
    mostClimb: { estimatedGainM: number; trailId: string; trail: string } | null;
    longestTime: { durationSecs: number; trailId: string; trail: string } | null;
    calories: { caloriesEstimate: number; trailId: string; trail: string } | null;
  };
};

export type HikeHistoryItem = {
  id: string;
  name?: string;
  trail: string;
  trailId?: string;
  date: string;
  km: number;
  time: string;
  synced: boolean;
  startedAt?: string;
  durationSecs?: number;
  path?: Coordinate[];
  waypoints?: HikeWaypoint[];
  pendingSync?: boolean;
  elevationGainM?: number;
};

export type HikeWaypoint = Coordinate & {
  id: string;
  name: string;
  createdAt: string;
};

type PendingHike = HikeHistoryItem & {
  startedAt: string;
  path: Coordinate[];
};

function isCoordinate(value: unknown): value is Coordinate {
  if (typeof value !== 'object' || value === null) return false;
  const coordinate = value as Partial<Coordinate>;
  return (
    typeof coordinate.latitude === 'number' &&
    Number.isFinite(coordinate.latitude) &&
    typeof coordinate.longitude === 'number' &&
    Number.isFinite(coordinate.longitude) &&
    coordinate.latitude >= -90 &&
    coordinate.latitude <= 90 &&
    coordinate.longitude >= -180 &&
    coordinate.longitude <= 180 &&
    (coordinate.altitude === undefined ||
      coordinate.altitude === null ||
      (typeof coordinate.altitude === 'number' && Number.isFinite(coordinate.altitude)))
  );
}

function isHikeWaypoint(value: unknown): value is HikeWaypoint {
  return (
    isCoordinate(value) &&
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'name' in value &&
    typeof value.name === 'string' &&
    'createdAt' in value &&
    typeof value.createdAt === 'string'
  );
}

function isGuestHike(value: unknown): value is HikeHistoryItem {
  if (typeof value !== 'object' || value === null) return false;
  const hike = value as Partial<HikeHistoryItem>;
  return (
    typeof hike.id === 'string' &&
    typeof hike.trail === 'string' &&
    typeof hike.date === 'string' &&
    typeof hike.km === 'number' &&
    typeof hike.time === 'string' &&
    hike.synced === false &&
    (hike.path === undefined || (Array.isArray(hike.path) && hike.path.every(isCoordinate)))
  );
}

async function getLocalFavoriteTrailIds(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(FAVORITES_KEY);
  if (raw !== null) {
    const favorites = parseFavoriteTrailIds(raw);
    if (favorites !== null) return favorites;
    await AsyncStorage.removeItem(FAVORITES_KEY);
  }

  const legacyValue = await SecureStore.getItemAsync(FAVORITES_KEY);
  if (legacyValue === null) return [];
  const favorites = parseFavoriteTrailIds(legacyValue) ?? [];
  await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  await SecureStore.deleteItemAsync(FAVORITES_KEY);
  return favorites;
}

function parseFavoriteTrailIds(raw: string): string[] | null {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) && value.every((id) => typeof id === 'string') ? value : null;
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}

async function saveLocalFavoriteTrailIds(ids: string[]) {
  await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
  return ids;
}

type ApiTrail = {
  id: string;
  name: string;
  area: string;
  km: number;
  gain: number;
  level: string;
  description: string;
  path: Coordinate[];
  elevation: number[];
  rating_average?: number;
  rating_count?: number;
  waypoints?: {
    id: string;
    name: string;
    type: TrailWaypoint['type'];
    km: number;
    lat: number;
    lng: number;
  }[];
};

type ApiErrorBody = {
  error?: unknown;
  message?: unknown;
  protection?: { vercel_auth_enabled?: unknown };
};

function getErrorMessage(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value !== 'object' || value === null) return undefined;

  const body = value as ApiErrorBody;
  if (typeof body.message === 'string' && body.message.trim()) return body.message;
  return getErrorMessage(body.error);
}

function isVercelProtected(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const protection = (value as ApiErrorBody).protection;
  return typeof protection === 'object' && protection !== null && protection.vercel_auth_enabled === true;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  authenticated = false
): Promise<T> {
  if (API_BASE_URL.includes('your-trailhead-api')) {
    throw new ApiError(
      'Set EXPO_PUBLIC_API_BASE_URL to your deployed Trailhead API URL before using the app.'
    );
  }

  try {
    const baseUrl = new URL(API_BASE_URL);
    if (!['http:', 'https:'].includes(baseUrl.protocol) || !baseUrl.host) {
      throw new Error('Unsupported URL');
    }
  } catch {
    throw new ApiError(
      'EXPO_PUBLIC_API_BASE_URL is not a valid URL. Set it to your deployed Trailhead API origin, such as https://your-api.vercel.app.'
    );
  }

  const token = authenticated ? await getToken() : null;
  if (authenticated && !token) throw new ApiError('Please log in to continue.', 401);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    console.error('Trailhead API network request failed:', error);
    throw new ApiError(
      'Could not reach the Trailhead API. Check your internet connection and EXPO_PUBLIC_API_BASE_URL, then retry.'
    );
  }

  let responseText: string;
  try {
    responseText = await response.text();
  } catch {
    throw new ApiError('The server returned an unreadable response. Please try again.', response.status);
  }

  let body: unknown;
  try {
    body = JSON.parse(responseText);
  } catch {
    if (response.status === 404 || response.headers.get('content-type')?.includes('text/html')) {
      throw new ApiError(
        `The API returned a web page instead of JSON (HTTP ${response.status}). Check that EXPO_PUBLIC_API_BASE_URL points to the deployed Trailhead API and that its routes are deployed.`,
        response.status
      );
    }
    throw new ApiError(
      `The server returned an unreadable response (HTTP ${response.status}). Please try again.`,
      response.status
    );
  }

  if (!response.ok) {
    const message = isVercelProtected(body)
      ? 'This API is protected by Vercel Authentication. Disable Deployment Protection to use login and registration.'
      : getErrorMessage(body);
    throw new ApiError(
      message ?? `Request failed (${response.status}). Please try again.`,
      response.status
    );
  }
  return body as T;
}

export async function getToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearToken() {
  await Promise.all([SecureStore.deleteItemAsync(TOKEN_KEY), SecureStore.deleteItemAsync(USER_KEY)]);
}

async function getGuestHikes(): Promise<HikeHistoryItem[]> {
  const [legacyRaw, localRaw] = await Promise.all([
    SecureStore.getItemAsync(GUEST_HIKES_KEY),
    AsyncStorage.getItem(LOCAL_HIKES_KEY),
  ]);
  const legacyHikes = legacyRaw ? parseHikeList(legacyRaw) : [];
  const localHikes = localRaw ? parseHikeList(localRaw) : [];
  return [...localHikes, ...legacyHikes.filter((legacy) => !localHikes.some((local) => local.id === legacy.id))];
}

function parseHikeList(raw: string): HikeHistoryItem[] {
  try {
    const hikes: unknown = JSON.parse(raw);
    if (Array.isArray(hikes) && hikes.every(isGuestHike)) return hikes;
    return [];
  } catch (error) {
    if (error instanceof SyntaxError) return [];
    throw error;
  }
}

export async function saveGuestHike(input: {
  id?: string;
  name?: string;
  trail?: string;
  trailId?: string;
  distanceKm: number;
  durationSecs: number;
  startedAt: string;
  path?: Coordinate[];
  waypoints?: HikeWaypoint[];
  pendingSync?: boolean;
}) {
  const durationMinutes = Math.floor(input.durationSecs / 60);
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  const hike: HikeHistoryItem = {
    id: input.id ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: input.name ?? input.trail ?? 'Free hike',
    trail: input.name ?? input.trail ?? 'Free hike',
    trailId: input.trailId,
    date: new Date(input.startedAt).toLocaleDateString(),
    km: input.distanceKm,
    time: hours ? `${hours}h ${minutes}m` : `${minutes}m`,
    synced: false,
    startedAt: input.startedAt,
    durationSecs: input.durationSecs,
    path: input.path,
    waypoints: input.waypoints ?? [],
    pendingSync: input.pendingSync ?? false,
  };
  const hikes = await getGuestHikes();
  const updatedHikes = [hike, ...hikes.filter((savedHike) => savedHike.id !== hike.id)];
  await AsyncStorage.setItem(LOCAL_HIKES_KEY, JSON.stringify(updatedHikes.slice(0, 50)));
}

export async function getSavedUser(): Promise<SessionUser | null> {
  const raw = await SecureStore.getItemAsync(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    await SecureStore.deleteItemAsync(USER_KEY);
    return null;
  }
}

async function saveSession(response: { token: string; user: SessionUser }) {
  await Promise.all([
    SecureStore.setItemAsync(TOKEN_KEY, response.token),
    SecureStore.setItemAsync(USER_KEY, JSON.stringify(response.user)),
  ]);
  return response.user;
}

async function saveProfileSessionUser(user: SessionUser) {
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function login(email: string, password: string) {
  const response = await request<{ token: string; user: SessionUser }>('/api/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return saveSession(response);
}

export async function register(name: string, email: string, password: string) {
  const response = await request<{ token: string; user: SessionUser }>('/api/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
  return saveSession(response);
}

export async function changePassword(currentPassword: string, newPassword: string) {
  return request<{ changed: boolean }>('/api/password', {
    method: 'POST',
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  }, true);
}

export async function getSocialProfile(): Promise<SocialProfile> {
  const response = await request<{ profile: SocialProfile }>('/api/profile', {}, true);
  await saveProfileSessionUser(response.profile);
  return response.profile;
}

export async function updateSocialProfile(changes: ProfileChanges): Promise<SocialProfile> {
  const response = await request<{ profile: SocialProfile }>('/api/profile', {
    method: 'PATCH',
    body: JSON.stringify({
      ...(changes.name !== undefined ? { name: changes.name } : {}),
      ...(changes.bio !== undefined ? { bio: changes.bio } : {}),
      ...(changes.avatarUrl !== undefined ? { avatar_url: changes.avatarUrl } : {}),
    }),
  }, true);
  await saveProfileSessionUser(response.profile);
  return response.profile;
}

export async function uploadSocialPhoto(imageUri: string): Promise<string> {
  const token = await getToken();
  if (!token) throw new ApiError('Please log in to upload a photo.', 401);
  const file = new File(imageUri);
  if (!file.exists || file.size === null || file.size < 4) {
    throw new ApiError('The selected image could not be read. Please choose it again.');
  }
  if (file.size > 3 * 1024 * 1024) {
    throw new ApiError('The processed photo is larger than 3 MB. Choose a smaller image.');
  }

  let response: Response;
  try {
    response = await expoFetch(`${API_BASE_URL.replace(/\/$/, '')}/api/upload`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'image/jpeg',
      },
      body: file,
    });
  } catch (error) {
    console.error('Trailhead photo upload failed:', error);
    throw new ApiError('Could not reach the photo upload service. Check your connection and retry.');
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiError(`The photo service returned an unreadable response (HTTP ${response.status}).`, response.status);
  }
  if (!response.ok) {
    throw new ApiError(
      getErrorMessage(body) ?? `Photo upload failed (${response.status}). Please try again.`,
      response.status
    );
  }
  if (typeof body !== 'object' || body === null || !('url' in body) || typeof body.url !== 'string') {
    throw new ApiError('The photo service did not return a valid image URL.');
  }
  return body.url;
}

export async function getSocialPosts(cursor?: string | null, authorId?: string) {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  if (authorId) params.set('author_id', authorId);
  const query = params.size ? `?${params.toString()}` : '';
  return request<{ posts: SocialPost[]; next_cursor: string | null }>(`/api/posts${query}`, {}, true);
}

export async function createSocialPost(input: NewSocialPost) {
  return request<{ post: SocialPost }>('/api/posts', {
    method: 'POST',
    body: JSON.stringify({
      photo_urls: input.photoUrls,
      caption: input.caption,
      ...(input.placeName !== undefined ? { place_name: input.placeName } : {}),
      ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
      ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
      ...(input.hikeId ? { hike_id: input.hikeId } : {}),
      hide_endpoints: input.hideEndpoints,
    }),
  }, true);
}

export async function getSocialPost(postId: string) {
  return request<{ post: SocialPost }>(`/api/posts/${encodeURIComponent(postId)}`, {}, true);
}

export async function reportSocialPost(postId: string, reason: string) {
  return request<{ reported: boolean }>(`/api/posts/${encodeURIComponent(postId)}/report`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  }, true);
}

export async function getPublicSocialProfile(userId: string) {
  return request<{ profile: PublicSocialProfile }>(`/api/profile?user_id=${encodeURIComponent(userId)}`, {}, true);
}

export async function deleteSocialPost(postId: string) {
  return request<{ deleted: boolean }>(`/api/posts/${encodeURIComponent(postId)}`, {
    method: 'DELETE',
  }, true);
}

export async function likeSocialPost(postId: string) {
  return request<{ liked: boolean; like_count: number }>(
    `/api/posts/${encodeURIComponent(postId)}/like`,
    { method: 'POST' },
    true
  );
}

export async function unlikeSocialPost(postId: string) {
  return request<{ liked: boolean; like_count: number }>(
    `/api/posts/${encodeURIComponent(postId)}/like`,
    { method: 'DELETE' },
    true
  );
}

export async function getSocialPostComments(postId: string) {
  return request<{ comments: SocialPostComment[] }>(
    `/api/posts/${encodeURIComponent(postId)}/comments`,
    {},
    true
  );
}

export async function createSocialPostComment(postId: string, body: string) {
  return request<{ comment: SocialPostComment }>(
    `/api/posts/${encodeURIComponent(postId)}/comments`,
    { method: 'POST', body: JSON.stringify({ body }) },
    true
  );
}

function toTrail(row: ApiTrail): Trail {
  return {
    id: row.id,
    name: row.name,
    area: row.area,
    km: row.km,
    gain: row.gain,
    hrs: `${Math.max(1, Math.round(row.km / 1.6))}h`,
    level: row.level,
    desc: row.description,
    elev: row.elevation,
    latitude: row.path[0]?.latitude ?? 0,
    longitude: row.path[0]?.longitude ?? 0,
    path: row.path,
    ratingAverage: row.rating_average,
    ratingCount: row.rating_count,
    wps: (row.waypoints ?? []).map((waypoint) => ({
      name: waypoint.name,
      type: waypoint.type,
      km: waypoint.km,
      coordinate: { latitude: waypoint.lat, longitude: waypoint.lng },
    })),
  };
}

export async function getTrails() {
  const response = await request<{ trails: ApiTrail[] }>('/api/trails');
  return response.trails.map(toTrail);
}

export async function getTrail(id: string) {
  const response = await request<{ trail: ApiTrail }>(`/api/trails/${encodeURIComponent(id)}`);
  return toTrail(response.trail);
}

export async function getFavoriteTrailIds(): Promise<string[]> {
  return getLocalFavoriteTrailIds();
}

export async function toggleFavoriteTrail(id: string): Promise<string[]> {
  const favorites = await getFavoriteTrailIds();
  const shouldFavorite = !favorites.includes(id);
  return saveLocalFavoriteTrailIds(
    shouldFavorite ? [...favorites, id] : favorites.filter((favoriteId) => favoriteId !== id)
  );
}

export async function getTrailReviews(id: string): Promise<TrailReviewsResponse> {
  const response = await request<{
    reviews: { id: string; rating: number; comment: string; created_at: string; reviewer: string }[];
    rating_average: number;
    rating_count: number;
  }>(`/api/trails/${encodeURIComponent(id)}/reviews`);
  return {
    reviews: response.reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.created_at,
      reviewer: review.reviewer,
    })),
    ratingAverage: response.rating_average,
    ratingCount: response.rating_count,
  };
}

export async function submitTrailReview(id: string, rating: number, comment: string) {
  const response = await request<{
    review: { id: string; rating: number; comment: string; created_at: string };
    rating_average: number;
    rating_count: number;
  }>(`/api/trails/${encodeURIComponent(id)}/reviews`, {
    method: 'POST',
    body: JSON.stringify({ rating, comment }),
  }, true);
  return response;
}

export async function getTrailStats(): Promise<TrailStats> {
  if (await getToken()) {
    const response = await request<{
      year: number;
      lifetime: { hikes: number; distance_km: number; moving_time_secs: number; calories_estimate: number };
      monthly_distance: { month: number; distance_km: number }[];
      personal_bests: {
        longest_hike: { distance_km: number; trail_id: string; trail: string } | null;
        most_climb: { estimated_gain_m: number; trail_id: string; trail: string } | null;
        longest_time: { duration_secs: number; trail_id: string; trail: string } | null;
        calories: { calories_estimate: number; trail_id: string; trail: string } | null;
      };
    }>('/api/stats', {}, true);
    return {
      year: response.year,
      lifetime: {
        hikes: response.lifetime.hikes,
        distanceKm: response.lifetime.distance_km,
        movingTimeSecs: response.lifetime.moving_time_secs,
        caloriesEstimate: response.lifetime.calories_estimate,
      },
      monthlyDistance: response.monthly_distance.map((month) => ({
        month: month.month,
        distanceKm: month.distance_km,
      })),
      personalBests: {
        longestHike: response.personal_bests.longest_hike
          ? { distanceKm: response.personal_bests.longest_hike.distance_km, trailId: response.personal_bests.longest_hike.trail_id, trail: response.personal_bests.longest_hike.trail }
          : null,
        mostClimb: response.personal_bests.most_climb
          ? { estimatedGainM: response.personal_bests.most_climb.estimated_gain_m, trailId: response.personal_bests.most_climb.trail_id, trail: response.personal_bests.most_climb.trail }
          : null,
        longestTime: response.personal_bests.longest_time
          ? { durationSecs: response.personal_bests.longest_time.duration_secs, trailId: response.personal_bests.longest_time.trail_id, trail: response.personal_bests.longest_time.trail }
          : null,
        calories: response.personal_bests.calories
          ? { caloriesEstimate: response.personal_bests.calories.calories_estimate, trailId: response.personal_bests.calories.trail_id, trail: response.personal_bests.calories.trail }
          : null,
      },
    };
  }

  const hikes = await getGuestHikes();
  let trails: Trail[];
  try {
    trails = await getTrails();
  } catch {
    trails = getOfflineTrails();
  }
  const year = new Date().getFullYear();
  const monthlyDistance = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, distanceKm: 0 }));
  const durationOf = (hike: HikeHistoryItem) => hike.durationSecs ?? 0;
  for (const hike of hikes) {
    const date = hike.startedAt ? new Date(hike.startedAt) : new Date(hike.date);
    if (date.getFullYear() === year) monthlyDistance[date.getMonth()].distanceKm += hike.km;
  }
  const longest = hikes.reduce<HikeHistoryItem | null>((best, hike) => !best || hike.km > best.km ? hike : best, null);
  const longestTime = hikes.reduce<HikeHistoryItem | null>((best, hike) => !best || durationOf(hike) > durationOf(best) ? hike : best, null);
  const climb = hikes.reduce<{ hike: HikeHistoryItem; gain: number } | null>((best, hike) => {
    const trail = trails.find((item) => item.name === hike.trail);
    const gain = trail ? Math.round(trail.gain * Math.min(hike.km / trail.km, 1)) : 0;
    return gain > (best?.gain ?? 0) ? { hike, gain } : best;
  }, null);
  return {
    year,
    lifetime: {
      hikes: hikes.length,
      distanceKm: hikes.reduce((sum, hike) => sum + hike.km, 0),
      movingTimeSecs: hikes.reduce((sum, hike) => sum + durationOf(hike), 0),
      caloriesEstimate: Math.round(hikes.reduce((sum, hike) => sum + hike.km, 0) * 55),
    },
    monthlyDistance,
    personalBests: {
      longestHike: longest ? { distanceKm: longest.km, trailId: '', trail: longest.trail } : null,
      mostClimb: climb ? { estimatedGainM: climb.gain, trailId: '', trail: climb.hike.trail } : null,
      longestTime: longestTime ? { durationSecs: durationOf(longestTime), trailId: '', trail: longestTime.trail } : null,
      calories: longest ? { caloriesEstimate: Math.round(longest.km * 55), trailId: '', trail: longest.trail } : null,
    },
  };
}

export async function saveHike(input: {
  id: string;
  name: string;
  trailId?: string | null;
  distanceKm: number;
  durationSecs: number;
  startedAt: string;
  path: Coordinate[];
  waypoints: HikeWaypoint[];
}) {
  return request('/api/hikes', {
    method: 'POST',
    body: JSON.stringify({
      hike_id: input.id,
      name: input.name,
      trail_id: input.trailId ?? null,
      distance_km: input.distanceKm,
      duration_secs: input.durationSecs,
      started_at: input.startedAt,
      path_json: JSON.stringify(input.path),
      waypoints_json: JSON.stringify(input.waypoints),
    }),
  }, true);
}

export async function getHikes(): Promise<HikeHistoryItem[]> {
  const localHikes = await getGuestHikes();
  if (!(await getToken())) return localHikes;

  let response: {
    hikes: {
      id: string;
      name: string;
      trail_id: string | null;
      distance_km: number;
      duration_secs: number;
      started_at: string;
      synced_at: string;
      path_json: string | null;
      waypoints_json: string | null;
    }[];
  };
  try {
    response = await request('/api/hikes', {}, true);
  } catch (error) {
    console.error('Could not load remote hike history:', error);
    if (localHikes.length) return localHikes;
    throw error;
  }

  const savedHikes: HikeHistoryItem[] = response.hikes.map((hike) => {
    const durationMinutes = Math.floor(hike.duration_secs / 60);
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    let path: Coordinate[] = [];
    try {
      const parsed: unknown = hike.path_json ? JSON.parse(hike.path_json) : [];
      if (Array.isArray(parsed) && parsed.every(isCoordinate)) path = parsed;
    } catch (error) {
      console.error(`Could not parse recorded path for hike ${hike.id}:`, error);
    }
    let waypoints: HikeWaypoint[] = [];
    try {
      const parsed: unknown = hike.waypoints_json ? JSON.parse(hike.waypoints_json) : [];
      if (Array.isArray(parsed)) {
        waypoints = parsed.filter(isHikeWaypoint);
      }
    } catch (error) {
      console.error(`Could not parse waypoints for hike ${hike.id}:`, error);
    }
    return {
      id: hike.id,
      name: hike.name || 'Free hike',
      trailId: hike.trail_id ?? undefined,
      trail: hike.name || 'Free hike',
      date: new Date(hike.started_at).toLocaleDateString(),
      km: hike.distance_km,
      time: hours ? `${hours}h ${minutes}m` : `${minutes}m`,
      synced: Boolean(hike.synced_at),
      startedAt: hike.started_at,
      durationSecs: hike.duration_secs,
      path,
      waypoints,
    };
  });
  const syncedIds = new Set(savedHikes.map((hike) => hike.id));
  const unsyncedHikes = localHikes.filter((hike) => !syncedIds.has(hike.id));
  const pendingHikes = unsyncedHikes.filter(isPendingHike);
  const pendingIds = new Set(pendingHikes.map((hike) => hike.id));
  const remainingHikes = unsyncedHikes.filter((hike) => !pendingIds.has(hike.id));

  for (const hike of pendingHikes) {
    try {
      await saveHike({
        id: hike.id,
        name: hike.name ?? hike.trail,
        trailId: hike.trailId,
        distanceKm: hike.km,
        durationSecs: hike.durationSecs ?? 0,
        startedAt: hike.startedAt,
        path: hike.path,
        waypoints: hike.waypoints ?? [],
      });
      savedHikes.unshift({ ...hike, synced: true, pendingSync: false });
    } catch (error) {
      console.error(`Could not sync saved hike ${hike.id}:`, error);
      remainingHikes.push(hike);
    }
  }
  await AsyncStorage.setItem(LOCAL_HIKES_KEY, JSON.stringify(remainingHikes));
  return [...savedHikes, ...remainingHikes];
}

export async function getHikeById(id: string): Promise<HikeHistoryItem | null> {
  return (await getHikes()).find((hike) => hike.id === id) ?? null;
}

export async function deleteHike(id: string, synced: boolean) {
  if (synced) {
    await request<{ deleted: boolean }>('/api/hikes', {
      method: 'DELETE',
      body: JSON.stringify({ hike_id: id }),
    }, true);
  }

  const [localRaw, legacyRaw] = await Promise.all([
    AsyncStorage.getItem(LOCAL_HIKES_KEY),
    SecureStore.getItemAsync(GUEST_HIKES_KEY),
  ]);
  const remainingLocal = (localRaw ? parseHikeList(localRaw) : []).filter((hike) => hike.id !== id);
  const remainingLegacy = (legacyRaw ? parseHikeList(legacyRaw) : []).filter((hike) => hike.id !== id);
  await Promise.all([
    AsyncStorage.setItem(LOCAL_HIKES_KEY, JSON.stringify(remainingLocal)),
    remainingLegacy.length
      ? SecureStore.setItemAsync(GUEST_HIKES_KEY, JSON.stringify(remainingLegacy))
      : SecureStore.deleteItemAsync(GUEST_HIKES_KEY),
  ]);
}

function isPendingHike(hike: HikeHistoryItem): hike is PendingHike {
  return Boolean(hike.pendingSync && hike.startedAt && hike.path?.length);
}
