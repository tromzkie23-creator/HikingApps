import { randomUUID } from 'node:crypto';

import { requireAuth } from '../../../lib/auth.js';
import { db } from '../../../lib/db.js';
import {
  getTrailRating,
} from '../../../lib/reviews.js';
import {
  handleOptions,
  isRecord,
  methodNotAllowed,
  setCorsHeaders,
  type ApiRequest,
  type ApiResponse,
} from '../../../lib/http.js';

export default async function trailReviews(request: ApiRequest, response: ApiResponse) {
  setCorsHeaders(response);
  if (handleOptions(request, response)) return;
  if (request.method !== 'GET' && request.method !== 'POST') {
    return methodNotAllowed(response, ['GET', 'POST', 'OPTIONS']);
  }

  const trailId = request.query.id;
  if (typeof trailId !== 'string' || !trailId) return response.status(400).json({ error: 'A trail ID is required.' });

  if (request.method === 'GET') {
    try {
      const [reviews, rating] = await Promise.all([
        db.execute({
          sql: `SELECT r.id, r.rating, r.comment, r.created_at, u.name AS reviewer
                FROM reviews r JOIN users u ON u.id = r.user_id
                WHERE r.trail_id = ? ORDER BY r.created_at DESC`,
          args: [trailId],
        }),
        getTrailRating(trailId),
      ]);
      return response.status(200).json({
        reviews: reviews.rows.map((row) => ({
          id: String(row.id),
          rating: Number(row.rating),
          comment: String(row.comment),
          created_at: String(row.created_at),
          reviewer: String(row.reviewer),
        })),
        ...rating,
      });
    } catch (error) {
      console.error(`Reviews fetch failed for trail ${trailId}:`, error);
      return response.status(500).json({ error: 'Could not load trail reviews.' });
    }
  }

  const userId = requireAuth(request, response);
  if (!userId) return;
  if (!isRecord(request.body)) return response.status(400).json({ error: 'Enter a rating and review.' });

  const rating = request.body.rating;
  const comment = typeof request.body.comment === 'string' ? request.body.comment.trim() : '';
  if (!Number.isInteger(rating) || Number(rating) < 1 || Number(rating) > 5) {
    return response.status(400).json({ error: 'Rating must be a whole number from 1 to 5.' });
  }
  if (comment.length > 1000) {
    return response.status(400).json({ error: 'Review comments must be 1000 characters or fewer.' });
  }

  try {
    const trail = await db.execute({
      sql: 'SELECT id FROM trails WHERE id = ? LIMIT 1',
      args: [trailId],
    });
    if (!trail.rows.length) return response.status(404).json({ error: 'Trail not found.' });

    const id = randomUUID();
    await db.execute({
      sql: 'INSERT INTO reviews (id, user_id, trail_id, rating, comment) VALUES (?, ?, ?, ?, ?)',
      args: [id, userId, trailId, Number(rating), comment],
    });
    const ratingSummary = await getTrailRating(trailId);
    return response.status(201).json({
      review: { id, rating: Number(rating), comment, created_at: new Date().toISOString() },
      ...ratingSummary,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed: reviews.user_id, reviews.trail_id')) {
      return response.status(409).json({ error: 'You have already reviewed this trail.' });
    }
    console.error(`Review creation failed for trail ${trailId}:`, error);
    return response.status(500).json({ error: 'Could not submit your review.' });
  }
}
