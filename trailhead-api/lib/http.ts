import type { IncomingMessage, ServerResponse } from 'node:http';

export type ApiRequest = IncomingMessage & {
  query: Record<string, string | string[] | undefined>;
  body: unknown;
};

export type ApiResponse = ServerResponse & {
  status(statusCode: number): ApiResponse;
  json(body: unknown): ApiResponse;
};

export function setCorsHeaders(response: ApiResponse) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export function handleOptions(request: ApiRequest, response: ApiResponse) {
  setCorsHeaders(response);
  if (request.method !== 'OPTIONS') return false;
  response.status(204).end();
  return true;
}

export function methodNotAllowed(response: ApiResponse, allowed: string[]) {
  response.setHeader('Allow', allowed.join(', '));
  return response.status(405).json({ error: 'Method not allowed.' });
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
