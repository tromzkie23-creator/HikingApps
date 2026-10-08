import { randomUUID } from 'node:crypto';

import { requireAuth } from '../../lib/auth.js';
import { db } from '../../lib/db.js';
import {
  handleOptions,
  isRecord,
  methodNotAllowed,
  setCorsHeaders,
  type ApiRequest,
  type ApiResponse,
} from '../../lib/http.js';

const PAGE_SIZE = 10;

type PostCursor = { createdAt: string; id: string };

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

export default async function posts(request: ApiRequest, response: ApiResponse) {
  setCorsHeaders(response);
  if (handleOptions(request, response)) return;
  if (request.method !== 'GET' && request.method !== 'POST') {
    return methodNotAllowed(response, ['GET', 'POST', 'OPTIONS']);
  }

  const userId = requireAuth(request, response);
  if (!userId) return;

  if (request.method === 'GET') {
    const cursorValue = request.query.cursor;
    if (Array.isArray(cursorValue)) {
      return response.status(400).json({ error: 'The feed cursor is invalid.' });
    }
    if (cursorValue && cursorValue.length > 512) {
      return response.status(400).json({ error: 'The feed cursor is invalid.' });
    }
    const cursor = cursorValue ? readCursor(cursorValue) : null;
    if (cursorValue && !cursor) {
      return response.status(400).json({ error: 'The feed cursor is invalid.' });
    }

    try {
      const result = await db.execute({
        sql: `SELECT p.id, p.user_id, p.photo_url, p.caption, p.place_name, p.latitude, p.longitude,
                     p.suggest_hike, p.created_at, u.name AS author_name, u.avatar_url AS author_avatar_url,
                     (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id) AS like_count,
                     (SELECT COUNT(*) FROM post_comments c WHERE c.post_id = p.id) AS comment_count,
                     EXISTS (SELECT 1 FROM post_likes mine WHERE mine.post_id = p.id AND mine.user_id = ?) AS liked_by_me
              FROM posts p
              JOIN users u ON u.id = p.user_id
              ${cursor ? 'WHERE p.created_at < ? OR (p.created_at = ? AND p.id < ?)' : ''}
              ORDER BY p.created_at DESC, p.id DESC
              LIMIT ?`,
        args: cursor
          ? [userId, cursor.createdAt, cursor.createdAt, cursor.id, PAGE_SIZE + 1]
          : [userId, PAGE_SIZE + 1],
      });
      const hasMore = result.rows.length > PAGE_SIZE;
      const rows = result.rows.slice(0, PAGE_SIZE);
      const last = rows[rows.length - 1];
      return response.status(200).json({
        posts: rows.map((row) => ({
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
        })),
        next_cursor: hasMore && last
          ? encodeCursor({ createdAt: String(last.created_at), id: String(last.id) })
          : null,
      });
    } catch (error) {
      console.error(`Post feed fetch failed for user ${userId}:`, error);
      return response.status(500).json({ error: 'Could not load the hiking feed. Please try again.' });
    }
  }

  if (!isRecord(request.body)) {
    return response.status(400).json({ error: 'Enter a photo, place, and valid post details.' });
  }
  const photoUrl = typeof request.body.photo_url === 'string' ? request.body.photo_url.trim() : '';
  const caption = typeof request.body.caption === 'string' ? request.body.caption.trim() : '';
  const placeName = typeof request.body.place_name === 'string' ? request.body.place_name.trim() : '';
  const latitude = request.body.latitude;
  const longitude = request.body.longitude;
  const suggestHike = request.body.suggest_hike ?? false;
  if (!isPublicUrl(photoUrl)) {
    return response.status(400).json({ error: 'Choose a valid uploaded photo URL.' });
  }
  if (caption.length > 500) {
    return response.status(400).json({ error: 'Captions must be 500 characters or fewer.' });
  }
  if (placeName.length < 1 || placeName.length > 160) {
    return response.status(400).json({ error: 'Place name must be between 1 and 160 characters.' });
  }
  if (
    typeof latitude !== 'number' ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90
  ) {
    return response.status(400).json({ error: 'Latitude must be between -90 and 90.' });
  }
  if (
    typeof longitude !== 'number' ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    return response.status(400).json({ error: 'Longitude must be between -180 and 180.' });
  }
  if (typeof suggestHike !== 'boolean' && suggestHike !== 0 && suggestHike !== 1) {
    return response.status(400).json({ error: 'suggest_hike must be true or false.' });
  }

  const id = randomUUID();
  const createdAt = new Date().toISOString();
  try {
    await db.execute({
      sql: `INSERT INTO posts
              (id, user_id, photo_url, caption, place_name, latitude, longitude, suggest_hike, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        userId,
        photoUrl,
        caption,
        placeName,
        latitude,
        longitude,
        suggestHike === true || suggestHike === 1 ? 1 : 0,
        createdAt,
      ],
    });
    const author = await db.execute({
      sql: 'SELECT name, avatar_url FROM users WHERE id = ? LIMIT 1',
      args: [userId],
    });
    return response.status(201).json({
      post: {
        id,
        user_id: userId,
        photo_url: photoUrl,
        caption,
        place_name: placeName,
        latitude,
        longitude,
        suggest_hike: suggestHike === true || suggestHike === 1,
        created_at: createdAt,
        author: {
          name: String(author.rows[0]?.name ?? ''),
          avatar_url: author.rows[0]?.avatar_url == null ? null : String(author.rows[0].avatar_url),
        },
        like_count: 0,
        comment_count: 0,
        liked_by_me: false,
      },
    });
  } catch (error) {
    console.error(`Post creation failed for user ${userId}:`, error);
    return response.status(500).json({ error: 'Could not publish your post. Please try again.' });
  }
}
