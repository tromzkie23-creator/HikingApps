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
  if (request.method !== 'GET' && request.method !== 'POST' && request.method !== 'DELETE') {
    return methodNotAllowed(response, ['GET', 'POST', 'DELETE', 'OPTIONS']);
  }

  const userId = requireAuth(request, response);
  if (!userId) return;

  if (request.method === 'DELETE') {
    if (!isRecord(request.body)) return response.status(400).json({ error: 'Select a hike to delete.' });
    const hikeId = typeof request.body.hike_id === 'string' ? request.body.hike_id.trim() : '';
    if (!hikeId || hikeId.length > 100) {
      return response.status(400).json({ error: 'The hike ID is invalid.' });
    }
    try {
      await db.execute({
        sql: 'DELETE FROM hike_logs WHERE id = ? AND user_id = ?',
        args: [hikeId, userId],
      });
      return response.status(200).json({ deleted: true });
    } catch (error) {
      console.error(`Hike deletion failed for user ${userId}:`, error);
      return response.status(500).json({ error: 'Could not delete this hike. Please try again.' });
    }
  }

  if (request.method === 'POST') {
    if (!isRecord(request.body)) return response.status(400).json({ error: 'Enter valid hike details.' });
    const requestedId = typeof request.body.hike_id === 'string' ? request.body.hike_id : '';
    const hikeId = requestedId || randomUUID();
    const trailId = typeof request.body.trail_id === 'string' && request.body.trail_id
      ? request.body.trail_id
      : null;
    const name = typeof request.body.name === 'string' ? request.body.name.trim() : '';
    const distanceKm = Number(request.body.distance_km);
    const durationSecs = Number(request.body.duration_secs);
    const startedAt = typeof request.body.started_at === 'string' ? request.body.started_at : '';
    const pathJson = typeof request.body.path_json === 'string' ? request.body.path_json : '';
    const waypointsJson =
      typeof request.body.waypoints_json === 'string' ? request.body.waypoints_json : '[]';
    let path: unknown;
    let waypoints: unknown;
    try {
      path = JSON.parse(pathJson);
    } catch {
      return response.status(400).json({ error: 'Recorded hike path must be valid JSON.' });
    }
    try {
      waypoints = JSON.parse(waypointsJson);
    } catch {
      return response.status(400).json({ error: 'Hike waypoints must be valid JSON.' });
    }
    const validPath =
      Array.isArray(path) &&
      path.length > 0 &&
      path.length <= 5000 &&
      path.every(
        (point) =>
          isRecord(point) &&
          typeof point.latitude === 'number' &&
          Number.isFinite(point.latitude) &&
          point.latitude >= -90 &&
          point.latitude <= 90 &&
          typeof point.longitude === 'number' &&
          Number.isFinite(point.longitude) &&
          point.longitude >= -180 &&
          point.longitude <= 180
      );
    const validWaypoints =
      Array.isArray(waypoints) &&
      waypoints.length <= 1000 &&
      waypoints.every(
        (point) =>
          isRecord(point) &&
          typeof point.id === 'string' &&
          typeof point.name === 'string' &&
          point.name.length <= 120 &&
          typeof point.createdAt === 'string' &&
          Number.isFinite(Date.parse(point.createdAt)) &&
          typeof point.latitude === 'number' &&
          Number.isFinite(point.latitude) &&
          point.latitude >= -90 &&
          point.latitude <= 90 &&
          typeof point.longitude === 'number' &&
          Number.isFinite(point.longitude) &&
          point.longitude >= -180 &&
          point.longitude <= 180
      );

    if (
      hikeId.length > 100 ||
      !name ||
      name.length > 120 ||
      !Number.isFinite(distanceKm) ||
      distanceKm <= 0 ||
      distanceKm > 1000 ||
      !Number.isInteger(durationSecs) ||
      durationSecs < 0 ||
      durationSecs > 604800 ||
      !Number.isFinite(Date.parse(startedAt)) ||
      !validPath ||
      !validWaypoints
    ) {
      return response.status(400).json({ error: 'Hike details are invalid.' });
    }

    try {
      const previousHike = await db.execute({
        sql: 'SELECT id, user_id, trail_id, name, distance_km, duration_secs, started_at, path_json, waypoints_json, synced_at FROM hike_logs WHERE id = ? LIMIT 1',
        args: [hikeId],
      });
      if (previousHike.rows.length) {
        const previous = previousHike.rows[0];
        if (String(previous.user_id) !== userId) {
          return response.status(409).json({ error: 'This hike ID is already in use.' });
        }
        return response.status(200).json({
          hike: {
            id: String(previous.id),
            user_id: userId,
            trail_id: previous.trail_id === null ? null : String(previous.trail_id),
            name: String(previous.name || 'Free hike'),
            distance_km: Number(previous.distance_km),
            duration_secs: Number(previous.duration_secs),
            started_at: String(previous.started_at),
            path_json: String(previous.path_json ?? '[]'),
            waypoints_json: String(previous.waypoints_json ?? '[]'),
            synced_at: String(previous.synced_at),
          },
        });
      }
      if (trailId) {
        const trailResult = await db.execute({
          sql: 'SELECT id FROM trails WHERE id = ? LIMIT 1',
          args: [trailId],
        });
        if (!trailResult.rows.length) return response.status(404).json({ error: 'Trail not found.' });
      }

      const syncedAt = new Date().toISOString();
      await db.execute({
        sql: 'INSERT INTO hike_logs (id, user_id, trail_id, name, distance_km, duration_secs, path_json, waypoints_json, started_at, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        args: [hikeId, userId, trailId, name, distanceKm, durationSecs, pathJson, waypointsJson, new Date(startedAt).toISOString(), syncedAt],
      });
      return response.status(201).json({
        hike: {
          id: hikeId,
          user_id: userId,
          trail_id: trailId,
          name,
          distance_km: distanceKm,
          duration_secs: durationSecs,
          started_at: new Date(startedAt).toISOString(),
          path_json: pathJson,
          waypoints_json: waypointsJson,
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
      sql: `SELECT h.id, h.trail_id, COALESCE(NULLIF(h.name, ''), t.name, 'Free hike') AS name,
                   h.distance_km, h.duration_secs, h.path_json, h.waypoints_json,
                   h.started_at, h.synced_at
            FROM hike_logs h
            LEFT JOIN trails t ON t.id = h.trail_id
            WHERE h.user_id = ?
            ORDER BY h.started_at DESC`,
      args: [userId],
    });
    return response.status(200).json({
      hikes: result.rows.map((row) => ({
        id: String(row.id),
        trail_id: row.trail_id === null ? null : String(row.trail_id),
        name: String(row.name),
        distance_km: Number(row.distance_km),
        duration_secs: Number(row.duration_secs),
        path_json: row.path_json === null ? null : String(row.path_json),
        waypoints_json: row.waypoints_json === null ? null : String(row.waypoints_json),
        started_at: String(row.started_at),
        synced_at: String(row.synced_at),
      })),
    });
  } catch (error) {
    console.error('Hike history fetch failed:', error);
    return response.status(500).json({ error: 'Could not load your hike history. Please try again.' });
  }
}
