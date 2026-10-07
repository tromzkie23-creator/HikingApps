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
      'SELECT id, name, area, km, gain, level, description, path_json, elevation_json FROM trails ORDER BY name'
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
      })),
    });
  } catch (error) {
    console.error('Trail list failed:', error);
    return response.status(500).json({ error: 'Could not load trails. Please try again.' });
  }
}
