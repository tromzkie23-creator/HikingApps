import { db } from '../../lib/db.js';
import {
  handleOptions,
  methodNotAllowed,
  setCorsHeaders,
  type ApiRequest,
  type ApiResponse,
} from '../../lib/http.js';

export default async function trails(request: ApiRequest, response: ApiResponse) {
  setCorsHeaders(response);
  if (handleOptions(request, response)) return;
  if (request.method !== 'GET') return methodNotAllowed(response, ['GET', 'OPTIONS']);

  try {
    const result = await db.execute(
      `SELECT t.id, t.name, t.area, t.km, t.gain, t.level, t.description, t.path_json, t.elevation_json,
              COALESCE(AVG(r.rating), 0) AS rating_average, COUNT(r.id) AS rating_count
       FROM trails t
       LEFT JOIN reviews r ON r.trail_id = t.id
       GROUP BY t.id
       ORDER BY t.name`
    );
    return response.status(200).json({
      trails: result.rows.map((row) => ({
        id: String(row.id),
        name: String(row.name),
        area: String(row.area),
        km: Number(row.km),
        gain: Number(row.gain),
        level: String(row.level),
        description: String(row.description),
        path: JSON.parse(String(row.path_json)),
        elevation: JSON.parse(String(row.elevation_json)),
        rating_average: Number(row.rating_average),
        rating_count: Number(row.rating_count),
      })),
    });
  } catch (error) {
    console.error('Trail list failed:', error);
    return response.status(500).json({ error: 'Could not load trails. Please try again.' });
  }
}
