import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';

import { createToken } from '../lib/auth.js';
import { db } from '../lib/db.js';
import {
  handleOptions,
  isRecord,
  methodNotAllowed,
  setCorsHeaders,
  type ApiRequest,
  type ApiResponse,
} from '../lib/http.js';

export default async function register(request: ApiRequest, response: ApiResponse) {
  setCorsHeaders(response);
  if (handleOptions(request, response)) return;
  if (request.method !== 'POST') return methodNotAllowed(response, ['POST', 'OPTIONS']);

  if (!isRecord(request.body)) return response.status(400).json({ error: 'Enter your name, email, and password.' });
  const name = typeof request.body.name === 'string' ? request.body.name.trim() : '';
  const email = typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : '';
  const password = typeof request.body.password === 'string' ? request.body.password : '';

  if (name.length < 1 || name.length > 100) {
    return response.status(400).json({ error: 'Enter your name (up to 100 characters).' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return response.status(400).json({ error: 'Enter a valid email address.' });
  }
  if (password.length < 6 || Buffer.byteLength(password, 'utf8') > 72) {
    return response.status(400).json({ error: 'Password must be at least 6 characters and no longer than 72 bytes.' });
  }

  try {
    const existing = await db.execute({
      sql: 'SELECT id FROM users WHERE email = ? LIMIT 1',
      args: [email],
    });
    if (existing.rows.length) return response.status(409).json({ error: 'That email is already in use.' });

    const id = randomUUID();
    const passwordHash = await bcrypt.hash(password, 12);
    await db.execute({
      sql: 'INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)',
      args: [id, name, email, passwordHash],
    });

    return response.status(201).json({
      token: createToken(id),
      user: { id, name, email },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed: users.email')) {
      return response.status(409).json({ error: 'That email is already in use.' });
    }
    console.error('Registration failed:', error);
    return response.status(500).json({ error: 'Could not create your account. Please try again.' });
  }
}
