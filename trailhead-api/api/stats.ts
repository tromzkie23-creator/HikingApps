import { requireAuth } from '../lib/auth.js';
import { db } from '../lib/db.js';
import {
  handleOptions,
  methodNotAllowed,
  setCorsHeaders,
  type ApiRequest,
  type ApiResponse,
} from '../lib/http.js';

export default async function stats(request: ApiRequest, response: ApiResponse) {
  setCorsHeaders(response);
  if (handleOptions(request, response)) return;
  if (request.method !== 'GET') return methodNotAllowed(response, ['GET', 'OPTIONS']);

  const userId = requireAuth(request, response);
  if (!userId) return;

  const year = new Date().getFullYear();
  try {
    const [totalsResult, monthlyResult, longestHikeResult, longestTimeResult, mostClimbResult] = await Promise.all([
      db.execute({
        sql: `SELECT COUNT(*) AS hikes,
                     COALESCE(SUM(distance_km), 0) AS distance_km,
                     COALESCE(SUM(duration_secs), 0) AS moving_time_secs,
                     COALESCE(ROUND(SUM(distance_km * 55)), 0) AS calories_estimate
              FROM hike_logs WHERE user_id = ?`,
        args: [userId],
      }),
      db.execute({
        sql: `SELECT CAST(strftime('%m', started_at) AS INTEGER) AS month,
                     SUM(distance_km) AS distance_km
              FROM hike_logs
              WHERE user_id = ? AND strftime('%Y', started_at) = ?
              GROUP BY strftime('%m', started_at)
              ORDER BY month`,
        args: [userId, String(year)],
      }),
      db.execute({
        sql: `SELECT h.distance_km, h.trail_id,
                     COALESCE(NULLIF(h.name, ''), t.name, 'Free hike') AS trail
              FROM hike_logs h LEFT JOIN trails t ON t.id = h.trail_id
              WHERE h.user_id = ? ORDER BY h.distance_km DESC, h.started_at DESC LIMIT 1`,
        args: [userId],
      }),
      db.execute({
        sql: `SELECT h.duration_secs, h.trail_id,
                     COALESCE(NULLIF(h.name, ''), t.name, 'Free hike') AS trail
              FROM hike_logs h LEFT JOIN trails t ON t.id = h.trail_id
              WHERE h.user_id = ? ORDER BY h.duration_secs DESC, h.started_at DESC LIMIT 1`,
        args: [userId],
      }),
      db.execute({
        sql: `SELECT COALESCE(ROUND(t.gain * MIN(h.distance_km / t.km, 1)), 0) AS estimated_gain_m,
                     h.trail_id, COALESCE(NULLIF(h.name, ''), t.name, 'Free hike') AS trail
              FROM hike_logs h LEFT JOIN trails t ON t.id = h.trail_id
              WHERE h.user_id = ?
              ORDER BY estimated_gain_m DESC, h.started_at DESC LIMIT 1`,
        args: [userId],
      }),
    ]);

    const totals = totalsResult.rows[0];
    const monthlyDistance = Array.from({ length: 12 }, (_, index) => ({
      month: index + 1,
      distance_km: 0,
    }));
    for (const row of monthlyResult.rows) {
      const month = Number(row.month);
      if (month >= 1 && month <= 12) monthlyDistance[month - 1].distance_km = Number(row.distance_km);
    }

    const longestHike = longestHikeResult.rows[0];
    const longestTime = longestTimeResult.rows[0];
    const mostClimb = mostClimbResult.rows[0];

    return response.status(200).json({
      year,
      lifetime: {
        hikes: Number(totals?.hikes ?? 0),
        distance_km: Number(totals?.distance_km ?? 0),
        moving_time_secs: Number(totals?.moving_time_secs ?? 0),
        calories_estimate: Number(totals?.calories_estimate ?? 0),
      },
      monthly_distance: monthlyDistance,
      personal_bests: {
        longest_hike: longestHike
          ? { distance_km: Number(longestHike.distance_km), trail_id: longestHike.trail_id === null ? '' : String(longestHike.trail_id), trail: String(longestHike.trail) }
          : null,
        most_climb: mostClimb
          ? { estimated_gain_m: Number(mostClimb.estimated_gain_m), trail_id: mostClimb.trail_id === null ? '' : String(mostClimb.trail_id), trail: String(mostClimb.trail) }
          : null,
        longest_time: longestTime
          ? { duration_secs: Number(longestTime.duration_secs), trail_id: longestTime.trail_id === null ? '' : String(longestTime.trail_id), trail: String(longestTime.trail) }
          : null,
        calories: longestHike
          ? { calories_estimate: Math.round(Number(longestHike.distance_km) * 55), trail_id: longestHike.trail_id === null ? '' : String(longestHike.trail_id), trail: String(longestHike.trail) }
          : null,
      },
    });
  } catch (error) {
    console.error('Stats fetch failed:', error);
    return response.status(500).json({ error: 'Could not load your hiking stats.' });
  }
}
