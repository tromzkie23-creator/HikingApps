import bcrypt from 'bcryptjs';

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

export default async function changePassword(request: ApiRequest, response: ApiResponse) {
  setCorsHeaders(response);
  if (handleOptions(request, response)) return;
  if (request.method !== 'POST') return methodNotAllowed(response, ['POST', 'OPTIONS']);

  const userId = requireAuth(request, response);
  if (!userId) return;

  if (!isRecord(request.body)) {
    return response.status(400).json({ error: 'Enter your current password and a new password.' });
  }

  const currentPassword =
    typeof request.body.current_password === 'string' ? request.body.current_password : '';
  const newPassword = typeof request.body.new_password === 'string' ? request.body.new_password : '';
  if (!currentPassword || Buffer.byteLength(newPassword, 'utf8') < 6 || Buffer.byteLength(newPassword, 'utf8') > 72) {
    return response.status(400).json({ error: 'Your new password must be 6 to 72 bytes long.' });
  }
  if (currentPassword === newPassword) {
    return response.status(400).json({ error: 'Choose a new password that differs from your current one.' });
  }

  try {
    const result = await db.execute({
      sql: 'SELECT password_hash FROM users WHERE id = ? LIMIT 1',
      args: [userId],
    });
    const passwordHash = result.rows[0]?.password_hash;
    if (typeof passwordHash !== 'string' || !(await bcrypt.compare(currentPassword, passwordHash))) {
      return response.status(400).json({ error: 'Your current password is incorrect.' });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    await db.execute({
      sql: 'UPDATE users SET password_hash = ? WHERE id = ?',
      args: [newPasswordHash, userId],
    });
    return response.status(200).json({ changed: true });
  } catch (error) {
    console.error(`Password change failed for user ${userId}:`, error);
    return response.status(500).json({ error: 'Could not change your password. Please try again.' });
  }
}
