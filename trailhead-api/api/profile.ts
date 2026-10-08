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

function isPublicUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.length > 0 && value.length <= 2048;
  } catch {
    return false;
  }
}

async function readProfile(userId: string) {
  const result = await db.execute({
    sql: 'SELECT id, name, email, avatar_url, bio FROM users WHERE id = ? LIMIT 1',
    args: [userId],
  });
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    avatar_url: row.avatar_url === null ? null : String(row.avatar_url),
    bio: row.bio === null ? null : String(row.bio),
  };
}

export default async function profile(request: ApiRequest, response: ApiResponse) {
  setCorsHeaders(response);
  if (handleOptions(request, response)) return;
  if (request.method !== 'GET' && request.method !== 'PATCH') {
    return methodNotAllowed(response, ['GET', 'PATCH', 'OPTIONS']);
  }

  const userId = requireAuth(request, response);
  if (!userId) return;

  try {
    if (request.method === 'GET') {
      const current = await readProfile(userId);
      if (!current) return response.status(404).json({ error: 'Profile not found.' });
      return response.status(200).json({ profile: current });
    }

    if (!isRecord(request.body)) return response.status(400).json({ error: 'Enter valid profile details.' });
    const updates: { sql: string; value: string | null }[] = [];
    if ('name' in request.body) {
      if (typeof request.body.name !== 'string') {
        return response.status(400).json({ error: 'Name must be text.' });
      }
      const name = request.body.name.trim();
      if (name.length < 1 || name.length > 100) {
        return response.status(400).json({ error: 'Name must be between 1 and 100 characters.' });
      }
      updates.push({ sql: 'name = ?', value: name });
    }
    if ('bio' in request.body) {
      const rawBio = request.body.bio;
      if (rawBio !== null && typeof rawBio !== 'string') {
        return response.status(400).json({ error: 'Bio must be text or null.' });
      }
      const bio = typeof rawBio === 'string' ? rawBio.trim() : null;
      if (bio !== null && bio.length > 300) {
        return response.status(400).json({ error: 'Bio must be 300 characters or fewer.' });
      }
      updates.push({ sql: 'bio = ?', value: bio });
    }
    if ('avatar_url' in request.body) {
      const rawAvatar = request.body.avatar_url;
      if (rawAvatar !== null && typeof rawAvatar !== 'string') {
        return response.status(400).json({ error: 'Avatar URL must be text or null.' });
      }
      const avatarUrl = typeof rawAvatar === 'string' ? rawAvatar.trim() : null;
      if (avatarUrl !== null && !isPublicUrl(avatarUrl)) {
        return response.status(400).json({ error: 'Avatar URL must be a valid HTTPS image URL.' });
      }
      updates.push({ sql: 'avatar_url = ?', value: avatarUrl });
    }
    if (!updates.length) return response.status(400).json({ error: 'Provide a name, bio, or avatar_url to update.' });

    await db.execute({
      sql: `UPDATE users SET ${updates.map((update) => update.sql).join(', ')} WHERE id = ?`,
      args: [...updates.map((update) => update.value), userId],
    });
    const updated = await readProfile(userId);
    if (!updated) return response.status(404).json({ error: 'Profile not found.' });
    return response.status(200).json({ profile: updated });
  } catch (error) {
    console.error(`Profile request failed for user ${userId}:`, error);
    return response.status(500).json({ error: 'Could not load or update your profile. Please try again.' });
  }
}
