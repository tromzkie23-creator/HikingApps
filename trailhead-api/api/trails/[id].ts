import { db } from '../../lib/db.js';
import {
  handleOptions,
  methodNotAllowed,
  setCorsHeaders,
  type ApiRequest,
  type ApiResponse,
} from '../../lib/http.js';

export default async function trail(request: ApiRequest, response: ApiResponse) {
  setCorsHeaders(response);
  if (handleOptions(request, response)) return;
  if (request.method !== 'GET') return methodNotAllowed(response, ['GET', 'OPTIONS']);

  const id = request.query.id;
  if (typeof id !== 'string' || !id) return response.status(400).json({ error: 'A trail ID is required.' });

  try {
    const [trailResult, waypointResult] = await Promise.all([
      db.execute({
        sql: 'SELECT id, name, area, km, gain, level, description, path_json, elevation_json FROM trails WHERE id = ? LIMIT 1',
        args: [id],
      }),
      db.execute({
        sql: 'SELECT id, name, type, km, lat, lng FROM waypoints WHERE trail_id = ? ORDER BY km',
        args: [id],
      }),
    ]);
    const row = trailResult.rows[0];
    if (!row) return response.status(404).json({ error: 'Trail not found.' });

    return response.status(200).json({
      trail: {
        id: String(row.id),
        name: String(row.name),
        area: String(row.area),
        km: Number(row.km),
        gain: Number(row.gain),
        level: String(row.level),
        description: String(row.description),
        path: JSON.parse(String(row.path_json)),
        elevation: JSON.parse(String(row.elevation_json)),
        waypoints: waypointResult.rows.map((waypoint) => ({
          id: String(waypoint.id),
          name: String(waypoint.name),
          type: String(waypoint.type),
          km: Number(waypoint.km),
          lat: Number(waypoint.lat),
          lng: Number(waypoint.lng),
        })),
      },
    });
  } catch (error) {
    console.error(`Trail ${id} fetch failed:`, error);
    return response.status(500).json({ error: 'Could not load this trail. Please try again.' });
  }
}
