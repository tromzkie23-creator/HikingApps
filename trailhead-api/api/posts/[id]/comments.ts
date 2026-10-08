import { randomUUID } from 'node:crypto';

import { requireAuth } from '../../../lib/auth.js';
import { db } from '../../../lib/db.js';
import {
  handleOptions,
  isRecord,
  methodNotAllowed,
  setCorsHeaders,
  type ApiRequest,
  type ApiResponse,
} from '../../../lib/http.js';

export default async function postComments(request: ApiRequest, response: ApiResponse) {
  setCorsHeaders(response);
  if (handleOptions(request, response)) return;
  if (request.method !== 'GET' && request.method !== 'POST') {
    return methodNotAllowed(response, ['GET', 'POST', 'OPTIONS']);
  }

  const userId = requireAuth(request, response);
  if (!userId) return;
  const postId = typeof request.query.id === 'string' ? request.query.id.trim() : '';
  if (!postId || postId.length > 100) {
    return response.status(400).json({ error: 'The post ID is invalid.' });
  }

  try {
    const post = await db.execute({
      sql: 'SELECT id FROM posts WHERE id = ? LIMIT 1',
      args: [postId],
    });
    if (!post.rows.length) return response.status(404).json({ error: 'Post not found.' });

    if (request.method === 'GET') {
      const result = await db.execute({
        sql: `SELECT c.id, c.post_id, c.user_id, c.body, c.created_at,
                     u.name AS author_name, u.avatar_url AS author_avatar_url
              FROM post_comments c
              JOIN users u ON u.id = c.user_id
              WHERE c.post_id = ?
              ORDER BY c.created_at ASC, c.id ASC`,
        args: [postId],
      });
      return response.status(200).json({
        comments: result.rows.map((row) => ({
          id: String(row.id),
          post_id: String(row.post_id),
          user_id: String(row.user_id),
          body: String(row.body),
          created_at: String(row.created_at),
          author: {
            name: String(row.author_name),
            avatar_url: row.author_avatar_url === null ? null : String(row.author_avatar_url),
          },
        })),
      });
    }

    if (!isRecord(request.body)) return response.status(400).json({ error: 'Enter a comment.' });
    const body = typeof request.body.body === 'string' ? request.body.body.trim() : '';
    if (body.length < 1 || body.length > 1000) {
      return response.status(400).json({ error: 'Comments must be between 1 and 1000 characters.' });
    }
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    await db.execute({
      sql: 'INSERT INTO post_comments (id, post_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)',
      args: [id, postId, userId, body, createdAt],
    });
    const author = await db.execute({
      sql: 'SELECT name, avatar_url FROM users WHERE id = ? LIMIT 1',
      args: [userId],
    });
    return response.status(201).json({
      comment: {
        id,
        post_id: postId,
        user_id: userId,
        body,
        created_at: createdAt,
        author: {
          name: String(author.rows[0]?.name ?? ''),
          avatar_url: author.rows[0]?.avatar_url === null ? null : String(author.rows[0]?.avatar_url ?? ''),
        },
      },
    });
  } catch (error) {
    console.error(`Post comments request failed for user ${userId}:`, error);
    return response.status(500).json({ error: 'Could not load or save comments. Please try again.' });
  }
}
