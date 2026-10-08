import { requireAuth } from '../../lib/auth.js';
import { db } from '../../lib/db.js';
import {
  handleOptions,
  methodNotAllowed,
  setCorsHeaders,
  type ApiRequest,
  type ApiResponse,
} from '../../lib/http.js';

export default async function deletePost(request: ApiRequest, response: ApiResponse) {
  setCorsHeaders(response);
  if (handleOptions(request, response)) return;
  if (request.method !== 'DELETE') return methodNotAllowed(response, ['DELETE', 'OPTIONS']);

  const userId = requireAuth(request, response);
  if (!userId) return;
  const postId = typeof request.query.id === 'string' ? request.query.id.trim() : '';
  if (!postId || postId.length > 100) {
    return response.status(400).json({ error: 'The post ID is invalid.' });
  }

  try {
    const result = await db.execute({
      sql: 'DELETE FROM posts WHERE id = ? AND user_id = ?',
      args: [postId, userId],
    });
    if (Number(result.rowsAffected) === 0) {
      return response.status(404).json({ error: 'Post not found or you do not have permission to delete it.' });
    }
    return response.status(200).json({ deleted: true });
  } catch (error) {
    console.error(`Post deletion failed for user ${userId}:`, error);
    return response.status(500).json({ error: 'Could not delete this post. Please try again.' });
  }
}
