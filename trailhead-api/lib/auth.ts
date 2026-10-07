import jwt from 'jsonwebtoken';
import type { ApiRequest, ApiResponse } from './http.js';

const jwtSecret: string = process.env.JWT_SECRET ?? '';
if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be configured and at least 32 characters long.');
}

export type AuthenticatedRequest = ApiRequest & {
  userId?: string;
};

export function createToken(userId: string) {
  return jwt.sign({}, jwtSecret, { subject: userId, expiresIn: '30d' });
}

export function requireAuth(
  request: ApiRequest,
  response: ApiResponse
): string | null {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) {
    response.status(401).json({ error: 'Please log in to continue.' });
    return null;
  }

  try {
    const token = authorization.slice('Bearer '.length);
    const payload = jwt.verify(token, jwtSecret);
    if (typeof payload === 'string' || !payload.sub) {
      response.status(401).json({ error: 'Your session is invalid. Please log in again.' });
      return null;
    }
    return payload.sub;
  } catch {
    response.status(401).json({ error: 'Your session has expired. Please log in again.' });
    return null;
  }
}
