import * as SecureStore from 'expo-secure-store';

import { getOfflineTrails } from './offline-trails';
import type { Coordinate, Trail, TrailWaypoint } from './theme';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://your-trailhead-api.vercel.app';

const TOKEN_KEY = 'trailhead.jwt';
const USER_KEY = 'trailhead.user';
const GUEST_HIKES_KEY = 'trailhead.guest-hikes';
const FAVORITES_KEY = 'trailhead.favorite-trails';

export type SessionUser = {
  id: string;
  name: string;
  email: string;
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
  trail: string;
  date: string;
  km: number;
  time: string;
  synced: boolean;
  startedAt?: string;
  durationSecs?: number;
};

function isGuestHike(value: unknown): value is HikeHistoryItem {
  if (typeof value !== 'object' || value === null) return false;
  const hike = value as Partial<HikeHistoryItem>;
  return (
    typeof hike.id === 'string' &&
    typeof hike.trail === 'string' &&
    typeof hike.date === 'string' &&
    typeof hike.km === 'number' &&
    typeof hike.time === 'string' &&
    hike.synced === false
  );
}

async function getLocalFavoriteTrailIds(): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(FAVORITES_KEY);
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (Array.isArray(value) && value.every((id) => typeof id === 'string')) return value;
    await SecureStore.deleteItemAsync(FAVORITES_KEY);
    return [];
  } catch (error) {
    if (error instanceof SyntaxError) {
      await SecureStore.deleteItemAsync(FAVORITES_KEY);
      return [];
    }
    throw error;
  }
}

async function saveLocalFavoriteTrailIds(ids: string[]) {
  await SecureStore.setItemAsync(FAVORITES_KEY, JSON.stringify(ids));
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
  } catch {
    throw new ApiError('No internet connection. Check your connection and try again.');
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
  const raw = await SecureStore.getItemAsync(GUEST_HIKES_KEY);
  if (!raw) return [];
  try {
    const hikes: unknown = JSON.parse(raw);
    if (Array.isArray(hikes) && hikes.every(isGuestHike)) return hikes;
    await SecureStore.deleteItemAsync(GUEST_HIKES_KEY);
    return [];
  } catch (error) {
    if (error instanceof SyntaxError) {
      await SecureStore.deleteItemAsync(GUEST_HIKES_KEY);
      return [];
    }
    throw error;
  }
}

export async function saveGuestHike(input: {
  trail: string;
  distanceKm: number;
  durationSecs: number;
  startedAt: string;
}) {
  const durationMinutes = Math.floor(input.durationSecs / 60);
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  const hike: HikeHistoryItem = {
    id: `${Date.now()}`,
    trail: input.trail,
    date: new Date(input.startedAt).toLocaleDateString(),
    km: input.distanceKm,
    time: hours ? `${hours}h ${minutes}m` : `${minutes}m`,
    synced: false,
    startedAt: input.startedAt,
    durationSecs: input.durationSecs,
  };
  const hikes = await getGuestHikes();
  await SecureStore.setItemAsync(GUEST_HIKES_KEY, JSON.stringify([hike, ...hikes].slice(0, 5)));
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
  if (!(await getToken())) return getLocalFavoriteTrailIds();
  const response = await request<{ favorites: string[] }>('/api/favorites', {}, true);
  return response.favorites;
}

export async function toggleFavoriteTrail(id: string): Promise<string[]> {
  const favorites = await getFavoriteTrailIds();
  const shouldFavorite = !favorites.includes(id);
  if (!(await getToken())) {
    return saveLocalFavoriteTrailIds(
      shouldFavorite ? [...favorites, id] : favorites.filter((favoriteId) => favoriteId !== id)
    );
  }

  await request<{ trail_id: string; favorited: boolean }>(
    shouldFavorite ? '/api/favorites' : `/api/favorites?trail_id=${encodeURIComponent(id)}`,
    shouldFavorite
      ? { method: 'POST', body: JSON.stringify({ trail_id: id }) }
      : { method: 'DELETE' },
    true
  );
  return getFavoriteTrailIds();
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
  trailId: string;
  distanceKm: number;
  durationSecs: number;
  startedAt: string;
}) {
  return request('/api/hikes', {
    method: 'POST',
    body: JSON.stringify({
      trail_id: input.trailId,
      distance_km: input.distanceKm,
      duration_secs: input.durationSecs,
      started_at: input.startedAt,
    }),
  }, true);
}

export async function getHikes(): Promise<HikeHistoryItem[]> {
  if (!(await getToken())) return getGuestHikes();

  const response = await request<{
    hikes: {
      id: string;
      trail: string;
      distance_km: number;
      duration_secs: number;
      started_at: string;
      synced_at: string;
    }[];
  }>('/api/hikes', {}, true);

  return response.hikes.map((hike) => {
    const durationMinutes = Math.floor(hike.duration_secs / 60);
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    return {
      id: hike.id,
      trail: hike.trail,
      date: new Date(hike.started_at).toLocaleDateString(),
      km: hike.distance_km,
      time: hours ? `${hours}h ${minutes}m` : `${minutes}m`,
      synced: Boolean(hike.synced_at),
      startedAt: hike.started_at,
      durationSecs: hike.duration_secs,
    };
  });
}
