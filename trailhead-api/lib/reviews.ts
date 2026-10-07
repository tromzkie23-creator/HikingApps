import { db } from './db.js';

export async function getTrailRating(trailId: string) {
  const result = await db.execute({
    sql: 'SELECT COALESCE(AVG(rating), 0) AS rating_average, COUNT(*) AS rating_count FROM reviews WHERE trail_id = ?',
    args: [trailId],
  });
  const row = result.rows[0];
  return {
    rating_average: Number(row?.rating_average ?? 0),
    rating_count: Number(row?.rating_count ?? 0),
  };
}
