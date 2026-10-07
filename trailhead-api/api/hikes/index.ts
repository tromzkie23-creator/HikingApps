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

export default async function hikes(request: ApiRequest, response: ApiResponse) {
  setCorsHeaders(response);
  if (handleOptions(request, response)) return;
  if (request.method !== 'GET' && request.method !== 'POST') {
    return methodNotAllowed(response, ['GET', 'POST', 'OPTIONS']);
  }

  const userId = requireAuth(request, response);
  if (!userId) return;

  if (request.method === 'POST') {
    if (!isRecord(request.body)) return response.status(400).json({ error: 'Enter valid hike details.' });
    const trailId = typeof request.body.trail_id === 'string' ? request.body.trail_id : '';
    const distanceKm = Number(request.body.distance_km);
    const durationSecs = Number(request.body.duration_secs);
    const startedAt = typeof request.body.started_at === 'string' ? request.body.started_at : '';

    if (
      !trailId ||
      !Number.isFinite(distanceKm) ||
      distanceKm <= 0 ||
      distanceKm > 1000 ||
      !Number.isInteger(durationSecs) ||
      durationSecs < 0 ||
      durationSecs > 604800 ||
      !Number.isFinite(Date.parse(startedAt))
    ) {
      return response.status(400).json({ error: 'Hike details are invalid.' });
    }

    try {
      const trailResult = await db.execute({
        sql: 'SELECT id FROM trails WHERE id = ? LIMIT 1',
        args: [trailId],
      });
      if (!trailResult.rows.length) return response.status(404).json({ error: 'Trail not found.' });

      const id = randomUUID();
      const syncedAt = new Date().toISOString();
      await db.execute({
        sql: 'INSERT INTO hike_logs (id, user_id, trail_id, distance_km, duration_secs, started_at, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        args: [id, userId, trailId, distanceKm, durationSecs, new Date(startedAt).toISOString(), syncedAt],
      });
      return response.status(201).json({
        hike: {
          id,
          user_id: userId,
          trail_id: trailId,
          distance_km: distanceKm,
          duration_secs: durationSecs,
          started_at: new Date(startedAt).toISOString(),
          synced_at: syncedAt,
        },
      });
    } catch (error) {
      console.error('Hike creation failed:', error);
      return response.status(500).json({ error: 'Could not save this hike. Please try again.' });
    }
  }

  try {
    const result = await db.execute({
      sql: `SELECT h.id, h.trail_id, t.name AS trail, h.distance_km, h.duration_secs,
                   h.started_at, h.synced_at
            FROM hike_logs h
            JOIN trails t ON t.id = h.trail_id
            WHERE h.user_id = ?
            ORDER BY h.started_at DESC`,
      args: [userId],
    });
    return response.status(200).json({
      hikes: result.rows.map((row) => ({
        id: String(row.id),
        trail_id: String(row.trail_id),
        trail: String(row.trail),
        distance_km: Number(row.distance_km),
        duration_secs: Number(row.duration_secs),
        started_at: String(row.started_at),
        synced_at: String(row.synced_at),
      })),
    });
  } catch (error) {
    console.error('Hike history fetch failed:', error);
    return response.status(500).json({ error: 'Could not load your hike history. Please try again.' });
  }
}
