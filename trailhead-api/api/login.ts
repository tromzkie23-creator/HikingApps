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

export default async function login(request: ApiRequest, response: ApiResponse) {
  setCorsHeaders(response);
  if (handleOptions(request, response)) return;
  if (request.method !== 'POST') return methodNotAllowed(response, ['POST', 'OPTIONS']);
  if (!isRecord(request.body)) return response.status(400).json({ error: 'Enter your email and password.' });

  const email = typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : '';
  const password = typeof request.body.password === 'string' ? request.body.password : '';
  if (!email || !password) return response.status(400).json({ error: 'Enter your email and password.' });

  try {
    const result = await db.execute({
      sql: 'SELECT id, name, email, password_hash FROM users WHERE email = ? LIMIT 1',
      args: [email],
    });
    const user = result.rows[0];
    if (!user || typeof user.password_hash !== 'string' || !(await bcrypt.compare(password, user.password_hash))) {
      return response.status(401).json({ error: 'Incorrect email or password.' });
    }

    return response.status(200).json({
      token: createToken(String(user.id)),
      user: { id: String(user.id), name: String(user.name), email: String(user.email) },
    });
  } catch (error) {
    console.error('Login failed:', error);
    return response.status(500).json({ error: 'Could not log in. Please try again.' });
  }
}
