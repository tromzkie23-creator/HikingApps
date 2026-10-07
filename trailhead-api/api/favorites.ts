import { requireAuth } from '../lib/auth.js';
import { db } from '../lib/db.js';
import {
  handleOptions,
  isRecord,
  methodNotAllowed,
  setCorsHeaders,
  type ApiRequest,
  type ApiResponse,
} from '../lib/http.js';

function getQueryString(value: string | string[] | undefined) {
  return typeof value === 'string' ? value : '';
}

export default async function favorites(request: ApiRequest, response: ApiResponse) {
  setCorsHeaders(response);
  if (handleOptions(request, response)) return;
  if (request.method !== 'GET' && request.method !== 'POST' && request.method !== 'DELETE') {
    return methodNotAllowed(response, ['GET', 'POST', 'DELETE', 'OPTIONS']);
  }

  const userId = requireAuth(request, response);
  if (!userId) return;

  if (request.method === 'GET') {
    try {
      const result = await db.execute({
        sql: 'SELECT trail_id FROM favorites WHERE user_id = ? ORDER BY created_at DESC',
        args: [userId],
      });
      return response.status(200).json({ favorites: result.rows.map((row) => String(row.trail_id)) });
    } catch (error) {
      console.error('Favorites fetch failed:', error);
      return response.status(500).json({ error: 'Could not load your favorite trails.' });
    }
  }

  const trailId = request.method === 'DELETE'
    ? getQueryString(request.query.trail_id)
    : isRecord(request.body) && typeof request.body.trail_id === 'string'
      ? request.body.trail_id
      : '';
  if (!trailId) return response.status(400).json({ error: 'A trail ID is required.' });

  try {
    if (request.method === 'POST') {
      const trail = await db.execute({
        sql: 'SELECT id FROM trails WHERE id = ? LIMIT 1',
        args: [trailId],
      });
      if (!trail.rows.length) return response.status(404).json({ error: 'Trail not found.' });

      await db.execute({
        sql: 'INSERT OR IGNORE INTO favorites (user_id, trail_id) VALUES (?, ?)',
        args: [userId, trailId],
      });
      return response.status(200).json({ trail_id: trailId, favorited: true });
    }

    await db.execute({
      sql: 'DELETE FROM favorites WHERE user_id = ? AND trail_id = ?',
      args: [userId, trailId],
    });
    return response.status(200).json({ trail_id: trailId, favorited: false });
  } catch (error) {
    console.error(`Favorite update failed for trail ${trailId}:`, error);
    return response.status(500).json({ error: 'Could not update this favorite trail.' });
  }
}
