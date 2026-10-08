import { requireAuth } from '../../../lib/auth.js';
import { db } from '../../../lib/db.js';
import {
  handleOptions,
  methodNotAllowed,
  setCorsHeaders,
  type ApiRequest,
  type ApiResponse,
} from '../../../lib/http.js';

export default async function postLike(request: ApiRequest, response: ApiResponse) {
  setCorsHeaders(response);
  if (handleOptions(request, response)) return;
  if (request.method !== 'POST' && request.method !== 'DELETE') {
    return methodNotAllowed(response, ['POST', 'DELETE', 'OPTIONS']);
  }

  const userId = requireAuth(request, response);
  if (!userId) return;
  const postId = typeof request.query.id === 'string' ? request.query.id.trim() : '';
  if (!postId || postId.length > 100) {
    return response.status(400).json({ error: 'The post ID is invalid.' });
  }

  try {
    const existing = await db.execute({
      sql: 'SELECT id FROM posts WHERE id = ? LIMIT 1',
      args: [postId],
    });
    if (!existing.rows.length) return response.status(404).json({ error: 'Post not found.' });

    if (request.method === 'POST') {
      await db.execute({
        sql: 'INSERT OR IGNORE INTO post_likes (post_id, user_id) VALUES (?, ?)',
        args: [postId, userId],
      });
    } else {
      await db.execute({
        sql: 'DELETE FROM post_likes WHERE post_id = ? AND user_id = ?',
        args: [postId, userId],
      });
    }

    const count = await db.execute({
      sql: 'SELECT COUNT(*) AS like_count FROM post_likes WHERE post_id = ?',
      args: [postId],
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
