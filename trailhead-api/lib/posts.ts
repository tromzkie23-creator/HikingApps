import { randomUUID } from 'node:crypto';

import { requireAuth } from './auth.js';
import { db } from './db.js';
import {
  handleOptions,
  isRecord,
  methodNotAllowed,
  setCorsHeaders,
  type ApiRequest,
  type ApiResponse,
} from './http.js';

const PAGE_SIZE = 10;

type PostCursor = { createdAt: string; id: string };
type Point = { latitude: number; longitude: number; altitude?: number | null };

function readCursor(value: string): PostCursor | null {
  try {
    const decoded: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (!isRecord(decoded)) return null;
    if (
      typeof decoded.createdAt !== 'string' ||
      !Number.isFinite(Date.parse(decoded.createdAt)) ||
      typeof decoded.id !== 'string' ||
      decoded.id.length < 1 ||
      decoded.id.length > 100
    ) {
      return null;
    }
    return { createdAt: decoded.createdAt, id: decoded.id };
  } catch {
    return null;
  }
}

function encodeCursor(cursor: PostCursor) {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

function isPublicUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.length > 0 && value.length <= 2048;
  } catch {
    return false;
  }
}

async function fetchPost(postIdValue: string, userId: string) {
  return db.execute({
    sql: `SELECT p.id, p.user_id, p.photo_url, p.caption, p.place_name, p.latitude, p.longitude,
                 p.suggest_hike, p.created_at, p.hike_id, p.hike_distance_km,
                 p.hike_duration_secs, p.hike_elevation_gain_m, p.hike_path_json,
                 p.hide_endpoints, u.name AS author_name, u.avatar_url AS author_avatar_url,
                 (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id) AS like_count,
                 (SELECT COUNT(*) FROM post_comments c WHERE c.post_id = p.id) AS comment_count,
                 EXISTS (SELECT 1 FROM post_likes mine WHERE mine.post_id = p.id AND mine.user_id = ?) AS liked_by_me
          FROM posts p
          JOIN users u ON u.id = p.user_id
          WHERE p.id = ?
          LIMIT 1`,
    args: [userId, postIdValue],
  });
}

function distanceMeters(a: Point, b: Point) {
  const radians = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * radians;
  const dLng = (b.longitude - a.longitude) * radians;
  const value = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * radians) * Math.cos(b.latitude * radians) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(value));
}

function interpolatePoint(a: Point, b: Point, ratio: number): Point {
  return {
    latitude: a.latitude + (b.latitude - a.latitude) * ratio,
    longitude: a.longitude + (b.longitude - a.longitude) * ratio,
    altitude: typeof a.altitude === 'number' && typeof b.altitude === 'number'
      ? a.altitude + (b.altitude - a.altitude) * ratio
      : undefined,
  };
}

function trimPath(points: Point[], trimMeters: number): Point[] {
  if (points.length < 2 || trimMeters <= 0) return points;
  let remaining = trimMeters;
  let start = 0;
  while (start < points.length - 1 && remaining > 0) {
    const segment = distanceMeters(points[start], points[start + 1]);
    if (segment > remaining) {
      points[start] = interpolatePoint(points[start], points[start + 1], remaining / segment);
      remaining = 0;
    } else {
      remaining -= segment;
      start += 1;
    }
  }
  points = points.slice(Math.max(0, start));
  remaining = trimMeters;
  let end = points.length - 1;
  while (end > 0 && remaining > 0) {
    const segment = distanceMeters(points[end - 1], points[end]);
    if (segment > remaining) {
      points[end] = interpolatePoint(points[end], points[end - 1], remaining / segment);
      remaining = 0;
    } else {
      remaining -= segment;
      end -= 1;
    }
  }
  return points.slice(0, end + 1);
}

function simplifyPath(points: Point[], maximum = 150): Point[] {
  if (points.length <= maximum) return points;
  return Array.from({ length: maximum }, (_, index) => points[Math.round(index * (points.length - 1) / (maximum - 1))]);
}

async function mapPost(row: Record<string, unknown>, simplifyHikePath = true) {
  const [photoResult] = await Promise.all([
    db.execute({
      sql: 'SELECT id, photo_url, position FROM post_photos WHERE post_id = ? ORDER BY position ASC',
      args: [String(row.id)],
    }),
  ]);
  const photos = photoResult.rows.map((photo) => ({
    id: String(photo.id),
    photo_url: String(photo.photo_url),
    position: Number(photo.position),
  }));
  if (!photos.length && String(row.photo_url ?? '')) {
    photos.push({ id: `${String(row.id)}-legacy`, photo_url: String(row.photo_url), position: 0 });
  }
  let hikePath: Point[] = [];
  try {
    const parsed: unknown = row.hike_path_json ? JSON.parse(String(row.hike_path_json)) : [];
    if (Array.isArray(parsed)) {
      hikePath = parsed.filter((point): point is Point =>
        isRecord(point) && typeof point.latitude === 'number' && typeof point.longitude === 'number'
      );
    }
  } catch (error) {
    console.error(`Could not parse post hike path ${String(row.id)}:`, error);
  }
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    photo_url: String(row.photo_url),
    caption: String(row.caption),
    place_name: String(row.place_name),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    suggest_hike: Number(row.suggest_hike) === 1,
    created_at: String(row.created_at),
    author: {
      name: String(row.author_name),
      avatar_url: row.author_avatar_url === null ? null : String(row.author_avatar_url),
    },
    like_count: Number(row.like_count),
    comment_count: Number(row.comment_count),
    liked_by_me: Number(row.liked_by_me) === 1,
    photos,
    hike: row.hike_id == null ? null : {
      id: String(row.hike_id),
      distance_km: Number(row.hike_distance_km ?? 0),
      duration_secs: Number(row.hike_duration_secs ?? 0),
      elevation_gain_m: Number(row.hike_elevation_gain_m ?? 0),
      path: simplifyHikePath ? simplifyPath(hikePath) : hikePath,
    },
  };
}

async function listPosts(request: ApiRequest, response: ApiResponse, userId: string) {
  const cursorValue = request.query.cursor;
  const authorIdValue = request.query.author_id;
  if (Array.isArray(authorIdValue) || (authorIdValue !== undefined && (!authorIdValue || authorIdValue.length > 100))) {
    return response.status(400).json({ error: 'The author ID is invalid.' });
  }
  if (Array.isArray(cursorValue) || (cursorValue && cursorValue.length > 512)) {
    return response.status(400).json({ error: 'The feed cursor is invalid.' });
  }
  const cursor = cursorValue ? readCursor(cursorValue) : null;
  if (cursorValue && !cursor) {
    return response.status(400).json({ error: 'The feed cursor is invalid.' });
  }

  try {
    const result = await db.execute({
      sql: `SELECT p.id, p.user_id, p.photo_url, p.caption, p.place_name, p.latitude, p.longitude,
                   p.suggest_hike, p.created_at, p.hike_id, p.hike_distance_km,
                   p.hike_duration_secs, p.hike_elevation_gain_m, p.hike_path_json,
                   p.hide_endpoints, u.name AS author_name, u.avatar_url AS author_avatar_url,
                   (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id) AS like_count,
                   (SELECT COUNT(*) FROM post_comments c WHERE c.post_id = p.id) AS comment_count,
                   EXISTS (SELECT 1 FROM post_likes mine WHERE mine.post_id = p.id AND mine.user_id = ?) AS liked_by_me
            FROM posts p
            JOIN users u ON u.id = p.user_id
            ${authorIdValue ? 'WHERE p.user_id = ?' : ''}
            ${cursor ? `${authorIdValue ? 'AND' : 'WHERE'} (p.created_at < ? OR (p.created_at = ? AND p.id < ?))` : ''}
            ORDER BY p.created_at DESC, p.id DESC
            LIMIT ?`,
      args: [
        userId,
        ...(authorIdValue ? [authorIdValue] : []),
        ...(cursor ? [cursor.createdAt, cursor.createdAt, cursor.id] : []),
        PAGE_SIZE + 1,
      ],
    });
    const hasMore = result.rows.length > PAGE_SIZE;
    const rows = result.rows.slice(0, PAGE_SIZE);
    const last = rows[rows.length - 1];
    return response.status(200).json({
      posts: await Promise.all(rows.map((row) => mapPost(row))),
      next_cursor: hasMore && last
        ? encodeCursor({ createdAt: String(last.created_at), id: String(last.id) })
        : null,
    });
  } catch (error) {
    console.error(`Post feed fetch failed for user ${userId}:`, error);
    return response.status(500).json({ error: 'Could not load the hiking feed. Please try again.' });
  }
}

async function createPost(request: ApiRequest, response: ApiResponse, userId: string) {
  if (!isRecord(request.body)) {
    return response.status(400).json({ error: 'Enter a photo, place, and valid post details.' });
  }
  const photoUrlsValue = request.body.photo_urls;
  if (photoUrlsValue !== undefined && !Array.isArray(photoUrlsValue)) {
    return response.status(400).json({ error: 'photo_urls must be a list of up to 6 image URLs.' });
  }
  const photoUrls = Array.isArray(photoUrlsValue)
    ? photoUrlsValue
    : typeof request.body.photo_url === 'string' ? [request.body.photo_url] : [];
  const caption = typeof request.body.caption === 'string' ? request.body.caption.trim() : '';
  const placeName = typeof request.body.place_name === 'string' ? request.body.place_name.trim() : '';
  const latitude = request.body.latitude;
  const longitude = request.body.longitude;
  const suggestHike = request.body.suggest_hike ?? false;
  if (photoUrls.length > 6 || photoUrls.some((url) => typeof url !== 'string' || !isPublicUrl(url))) {
    return response.status(400).json({ error: 'Choose up to 6 valid uploaded photo URLs.' });
  }
  if (caption.length > 500) {
    return response.status(400).json({ error: 'Captions must be 500 characters or fewer.' });
  }
  if (placeName.length > 160) {
    return response.status(400).json({ error: 'Place name must be 160 characters or fewer.' });
  }
  if (latitude !== undefined && (typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90)) {
    return response.status(400).json({ error: 'Latitude must be between -90 and 90.' });
  }
  if (longitude !== undefined && (typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180)) {
    return response.status(400).json({ error: 'Longitude must be between -180 and 180.' });
  }
  const hikeId = request.body.hike_id == null ? null : request.body.hike_id;
  if (hikeId !== null && (typeof hikeId !== 'string' || hikeId.length < 1 || hikeId.length > 100)) {
    return response.status(400).json({ error: 'The attached hike is invalid.' });
  }
  const hideEndpoints = request.body.hide_endpoints !== false;
  if (request.body.hide_endpoints !== undefined && typeof request.body.hide_endpoints !== 'boolean') {
    return response.status(400).json({ error: 'hide_endpoints must be true or false.' });
  }
  if (typeof suggestHike !== 'boolean' && suggestHike !== 0 && suggestHike !== 1) {
    return response.status(400).json({ error: 'suggest_hike must be true or false.' });
  }

  const id = randomUUID();
  const createdAt = new Date().toISOString();
  try {
    let hikeSnapshot: { distanceKm: number; durationSecs: number; elevationGainM: number; path: Point[] } | null = null;
    if (hikeId) {
      const hike = await db.execute({
        sql: 'SELECT distance_km, duration_secs, path_json FROM hike_logs WHERE id = ? AND user_id = ? LIMIT 1',
        args: [hikeId, userId],
      });
      const hikeRow = hike.rows[0];
      if (!hikeRow) return response.status(404).json({ error: 'That hike was not found in your account.' });
      let points: Point[] = [];
      try {
        const parsed: unknown = hikeRow.path_json ? JSON.parse(String(hikeRow.path_json)) : [];
        if (Array.isArray(parsed)) points = parsed.filter((point): point is Point =>
          isRecord(point) && typeof point.latitude === 'number' && typeof point.longitude === 'number'
        );
      } catch (error) {
        console.error(`Could not parse attached hike path ${String(hikeId)}:`, error);
      }
      const elevationGainM = points.slice(1).reduce((gain, point, index) => {
        const previous = points[index];
        return gain + (typeof point.altitude === 'number' && typeof previous.altitude === 'number'
          ? Math.max(0, point.altitude - previous.altitude) : 0);
      }, 0);
      if (hideEndpoints) points = trimPath(points, 200);
      hikeSnapshot = {
        distanceKm: Number(hikeRow.distance_km),
        durationSecs: Number(hikeRow.duration_secs),
        elevationGainM: Math.round(elevationGainM),
        path: points,
      };
    }
    const firstPhoto = String(photoUrls[0] ?? '');
    let postLatitude = typeof latitude === 'number' ? latitude : NaN;
    let postLongitude = typeof longitude === 'number' ? longitude : NaN;
    if ((!Number.isFinite(postLatitude) || !Number.isFinite(postLongitude)) && hikeSnapshot?.path.length) {
      const start = hikeSnapshot.path[0];
      postLatitude = start.latitude;
      postLongitude = start.longitude;
    }
    if (!Number.isFinite(postLatitude) || !Number.isFinite(postLongitude)) {
      return response.status(400).json({ error: 'Add a location or attach a hike with a recorded route.' });
    }
    const finalPlace = placeName || 'Hiking route';
    await db.execute({
      sql: `INSERT INTO posts
              (id, user_id, photo_url, caption, place_name, latitude, longitude, suggest_hike,
               created_at, hike_id, hike_distance_km, hike_duration_secs, hike_elevation_gain_m,
               hike_path_json, hide_endpoints)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        userId,
        firstPhoto,
        caption,
        finalPlace,
        postLatitude,
        postLongitude,
        suggestHike === true || suggestHike === 1 ? 1 : 0,
        createdAt,
        hikeId,
        hikeSnapshot?.distanceKm ?? null,
        hikeSnapshot?.durationSecs ?? null,
        hikeSnapshot?.elevationGainM ?? null,
        hikeSnapshot ? JSON.stringify(hikeSnapshot.path) : null,
        hideEndpoints ? 1 : 0,
      ],
    });
    for (const [position, url] of photoUrls.entries()) {
      await db.execute({
        sql: 'INSERT INTO post_photos (id, post_id, photo_url, position) VALUES (?, ?, ?, ?)',
        args: [randomUUID(), id, url, position],
      });
    }
    const author = await db.execute({
      sql: 'SELECT name, avatar_url FROM users WHERE id = ? LIMIT 1',
      args: [userId],
    });
    return response.status(201).json({
      post: {
        id,
        user_id: userId,
        photo_url: firstPhoto,
        caption,
        place_name: finalPlace,
        latitude: postLatitude,
        longitude: postLongitude,
        suggest_hike: suggestHike === true || suggestHike === 1,
        created_at: createdAt,
        author: {
          name: String(author.rows[0]?.name ?? ''),
          avatar_url: author.rows[0]?.avatar_url == null ? null : String(author.rows[0].avatar_url),
        },
        like_count: 0,
        comment_count: 0,
        liked_by_me: false,
        photos: photoUrls.map((photo_url, position) => ({ id: `${id}-${position}`, photo_url, position })),
        hike: hikeSnapshot ? {
          id: String(hikeId),
          distance_km: hikeSnapshot.distanceKm,
          duration_secs: hikeSnapshot.durationSecs,
          elevation_gain_m: hikeSnapshot.elevationGainM,
          path: simplifyPath(hikeSnapshot.path),
        } : null,
      },
    });
  } catch (error) {
    console.error(`Post creation failed for user ${userId}:`, error);
    return response.status(500).json({ error: 'Could not publish your post. Please try again.' });
  }
}

async function getPost(postIdValue: string, response: ApiResponse, userId: string) {
  try {
    const result = await fetchPost(postIdValue, userId);
    const row = result.rows[0];
    if (!row) return response.status(404).json({ error: 'Post not found.' });
    return response.status(200).json({ post: await mapPost(row, false) });
  } catch (error) {
    console.error(`Post detail fetch failed for user ${userId}:`, error);
    return response.status(500).json({ error: 'Could not load this post. Please try again.' });
  }
}

async function updatePost(request: ApiRequest, response: ApiResponse, postIdValue: string, userId: string) {
  if (!isRecord(request.body)) return response.status(400).json({ error: 'Enter valid post details.' });
  const updates: { column: string; value: string | number }[] = [];
  if ('photo_url' in request.body) {
    const value = typeof request.body.photo_url === 'string' ? request.body.photo_url.trim() : '';
    if (!isPublicUrl(value)) return response.status(400).json({ error: 'Choose a valid uploaded photo URL.' });
    updates.push({ column: 'photo_url', value });
  }
  if ('caption' in request.body) {
    if (typeof request.body.caption !== 'string' || request.body.caption.trim().length > 500) {
      return response.status(400).json({ error: 'Captions must be 500 characters or fewer.' });
    }
    updates.push({ column: 'caption', value: request.body.caption.trim() });
  }
  if ('place_name' in request.body) {
    const value = typeof request.body.place_name === 'string' ? request.body.place_name.trim() : '';
    if (value.length < 1 || value.length > 160) {
      return response.status(400).json({ error: 'Place name must be between 1 and 160 characters.' });
    }
    updates.push({ column: 'place_name', value });
  }
  if ('latitude' in request.body) {
    const value = request.body.latitude;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < -90 || value > 90) {
      return response.status(400).json({ error: 'Latitude must be between -90 and 90.' });
    }
    updates.push({ column: 'latitude', value });
  }
  if ('longitude' in request.body) {
    const value = request.body.longitude;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < -180 || value > 180) {
      return response.status(400).json({ error: 'Longitude must be between -180 and 180.' });
    }
    updates.push({ column: 'longitude', value });
  }
  if ('suggest_hike' in request.body) {
    const value = request.body.suggest_hike;
    if (typeof value !== 'boolean' && value !== 0 && value !== 1) {
      return response.status(400).json({ error: 'suggest_hike must be true or false.' });
    }
    updates.push({ column: 'suggest_hike', value: value === true || value === 1 ? 1 : 0 });
  }
  if (!updates.length) return response.status(400).json({ error: 'Provide at least one post field to update.' });

  try {
    const result = await db.execute({
      sql: `UPDATE posts SET ${updates.map((update) => `${update.column} = ?`).join(', ')} WHERE id = ? AND user_id = ?`,
      args: [...updates.map((update) => update.value), postIdValue, userId],
    });
    if (Number(result.rowsAffected) === 0) {
      return response.status(404).json({ error: 'Post not found or you do not have permission to edit it.' });
    }
    const updated = await fetchPost(postIdValue, userId);
    return response.status(200).json({ post: await mapPost(updated.rows[0]) });
  } catch (error) {
    console.error(`Post update failed for user ${userId}:`, error);
    return response.status(500).json({ error: 'Could not update this post. Please try again.' });
  }
}

async function deletePost(postIdValue: string, response: ApiResponse, userId: string) {
  try {
    const result = await db.execute({
      sql: 'DELETE FROM posts WHERE id = ? AND user_id = ?',
      args: [postIdValue, userId],
    });
    if (Number(result.rowsAffected) === 0) {
      return response.status(404).json({ error: 'Post not found or you do not have permission to delete it.' });
    }
    return response.status(200).json({ deleted: true });
  } catch (error) {
    console.error(`Post deletion failed for user ${userId}:`, error);
    return response.status(500).json({ error: 'Could not delete this post. Please try again.' });
  }
}

async function postLike(request: ApiRequest, response: ApiResponse, postIdValue: string, userId: string) {
  try {
    const existing = await db.execute({
      sql: 'SELECT id FROM posts WHERE id = ? LIMIT 1',
      args: [postIdValue],
    });
    if (!existing.rows.length) return response.status(404).json({ error: 'Post not found.' });

    if (request.method === 'POST') {
      await db.execute({
        sql: 'INSERT OR IGNORE INTO post_likes (post_id, user_id) VALUES (?, ?)',
        args: [postIdValue, userId],
      });
    } else {
      await db.execute({
        sql: 'DELETE FROM post_likes WHERE post_id = ? AND user_id = ?',
        args: [postIdValue, userId],
      });
    }
    const count = await db.execute({
      sql: 'SELECT COUNT(*) AS like_count FROM post_likes WHERE post_id = ?',
      args: [postIdValue],
    });
    return response.status(200).json({
      liked: request.method === 'POST',
      like_count: Number(count.rows[0]?.like_count ?? 0),
    });
  } catch (error) {
    console.error(`Post like update failed for user ${userId}:`, error);
    return response.status(500).json({ error: 'Could not update this like. Please try again.' });
  }
}

async function postComments(request: ApiRequest, response: ApiResponse, postIdValue: string, userId: string) {
  try {
    const post = await db.execute({
      sql: 'SELECT id FROM posts WHERE id = ? LIMIT 1',
      args: [postIdValue],
    });
    if (!post.rows.length) return response.status(404).json({ error: 'Post not found.' });

    if (request.method === 'GET') {
      const result = await db.execute({
        sql: `SELECT c.id, c.post_id, c.user_id, c.body, c.created_at,
                     u.name AS author_name, u.avatar_url AS author_avatar_url
              FROM post_comments c
              JOIN users u ON u.id = c.user_id
              WHERE c.post_id = ?
              ORDER BY c.created_at ASC, c.id ASC`,
        args: [postIdValue],
      });
      return response.status(200).json({
        comments: result.rows.map((row) => ({
          id: String(row.id),
          post_id: String(row.post_id),
          user_id: String(row.user_id),
          body: String(row.body),
          created_at: String(row.created_at),
          author: {
            name: String(row.author_name),
            avatar_url: row.author_avatar_url === null ? null : String(row.author_avatar_url),
          },
        })),
      });
    }

    if (!isRecord(request.body)) return response.status(400).json({ error: 'Enter a comment.' });
    const body = typeof request.body.body === 'string' ? request.body.body.trim() : '';
    if (body.length < 1 || body.length > 1000) {
      return response.status(400).json({ error: 'Comments must be between 1 and 1000 characters.' });
    }
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    await db.execute({
      sql: 'INSERT INTO post_comments (id, post_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)',
      args: [id, postIdValue, userId, body, createdAt],
    });
    const author = await db.execute({
      sql: 'SELECT name, avatar_url FROM users WHERE id = ? LIMIT 1',
      args: [userId],
    });
    return response.status(201).json({
      comment: {
        id,
        post_id: postIdValue,
        user_id: userId,
        body,
        created_at: createdAt,
        author: {
          name: String(author.rows[0]?.name ?? ''),
          avatar_url: author.rows[0]?.avatar_url === null ? null : String(author.rows[0]?.avatar_url ?? ''),
        },
      },
    });
  } catch (error) {
    console.error(`Post comments request failed for user ${userId}:`, error);
    return response.status(500).json({ error: 'Could not load or save comments. Please try again.' });
  }
}

async function reportPost(request: ApiRequest, response: ApiResponse, postIdValue: string, userId: string) {
  if (!isRecord(request.body)) return response.status(400).json({ error: 'Enter a report reason.' });
  const reason = typeof request.body.reason === 'string' ? request.body.reason.trim() : '';
  if (reason.length < 1 || reason.length > 500) {
    return response.status(400).json({ error: 'Report reason must be between 1 and 500 characters.' });
  }
  try {
    const result = await db.execute({
      sql: 'SELECT id FROM posts WHERE id = ? LIMIT 1',
      args: [postIdValue],
    });
    if (!result.rows.length) return response.status(404).json({ error: 'Post not found.' });
    await db.execute({
      sql: `INSERT INTO post_reports (id, post_id, user_id, reason, created_at)
            VALUES (?, ?, ?, ?, ?) ON CONFLICT(post_id, user_id) DO UPDATE SET reason = excluded.reason`,
      args: [randomUUID(), postIdValue, userId, reason, new Date().toISOString()],
    });
    return response.status(201).json({ reported: true });
  } catch (error) {
    console.error(`Post report failed for user ${userId}:`, error);
    return response.status(500).json({ error: 'Could not report this post. Please try again.' });
  }
}

export async function handlePosts(request: ApiRequest, response: ApiResponse) {
  setCorsHeaders(response);
  if (handleOptions(request, response)) return;

  const rewrittenPath = request.query.__posts_path;
  if (Array.isArray(rewrittenPath)) {
    return response.status(400).json({ error: 'The post route is invalid.' });
  }
  let pathname: string;
  try {
    pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
  } catch {
    return response.status(400).json({ error: 'The post route is invalid.' });
  }
  if (rewrittenPath !== undefined) pathname = rewrittenPath;
  pathname = pathname.replace(/\/+$/, '') || '/';

  let route:
    | { resource: 'collection' }
    | { resource: 'detail' | 'like' | 'comments' | 'report'; id: string };
  if (pathname === '/api/posts') {
    route = { resource: 'collection' };
  } else {
    const match = pathname.match(/^\/api\/posts\/([^/]+)(?:\/(comments|like|report))?$/);
    if (!match) return response.status(404).json({ error: 'Post route not found.' });
    let id: string;
    try {
      id = decodeURIComponent(match[1]);
    } catch {
      return response.status(400).json({ error: 'The post ID is invalid.' });
    }
    if (!id || id.length > 100 || id.includes('/')) {
      return response.status(400).json({ error: 'The post ID is invalid.' });
    }
    route = {
      resource: match[2] === 'comments' ? 'comments'
        : match[2] === 'like' ? 'like'
          : match[2] === 'report' ? 'report' : 'detail',
      id,
    };
  }

  if (route.resource === 'collection') {
    if (request.method !== 'GET' && request.method !== 'POST') {
      return methodNotAllowed(response, ['GET', 'POST', 'OPTIONS']);
    }
  } else if (route.resource === 'detail') {
    if (request.method !== 'GET' && request.method !== 'PATCH' && request.method !== 'DELETE') {
      return methodNotAllowed(response, ['GET', 'PATCH', 'DELETE', 'OPTIONS']);
    }
  } else if (route.resource === 'like') {
    if (request.method !== 'POST' && request.method !== 'DELETE') {
      return methodNotAllowed(response, ['POST', 'DELETE', 'OPTIONS']);
    }
  } else if (route.resource === 'comments') {
    if (request.method !== 'GET' && request.method !== 'POST') {
      return methodNotAllowed(response, ['GET', 'POST', 'OPTIONS']);
    }
  } else if (route.resource === 'report' && request.method !== 'POST') {
    return methodNotAllowed(response, ['POST', 'OPTIONS']);
  }

  const userId = requireAuth(request, response);
  if (!userId) return;
  if (route.resource === 'collection') {
    return request.method === 'GET'
      ? listPosts(request, response, userId)
      : createPost(request, response, userId);
  }
  if (route.resource === 'like') return postLike(request, response, route.id, userId);
  if (route.resource === 'comments') return postComments(request, response, route.id, userId);
  if (route.resource === 'report') return reportPost(request, response, route.id, userId);
  if (request.method === 'GET') return getPost(route.id, response, userId);
  if (request.method === 'PATCH') return updatePost(request, response, route.id, userId);
  return deletePost(route.id, response, userId);
}
