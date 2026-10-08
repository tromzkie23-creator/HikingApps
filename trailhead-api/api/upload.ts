import { randomUUID } from 'node:crypto';

import { put } from '@vercel/blob';

import { requireAuth } from '../lib/auth.js';
import {
  handleOptions,
  methodNotAllowed,
  setCorsHeaders,
  type ApiRequest,
  type ApiResponse,
} from '../lib/http.js';

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

class UploadTooLargeError extends Error {}

async function readImage(request: ApiRequest) {
  const parsedBody = request.body;
  if (Buffer.isBuffer(parsedBody) || parsedBody instanceof Uint8Array) {
    const data = Buffer.from(parsedBody);
    if (data.length > MAX_IMAGE_BYTES) throw new UploadTooLargeError();
    return data;
  }

  if (parsedBody !== undefined && parsedBody !== null) {
    throw new Error('Expected the JPEG request body as raw binary data.');
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += bytes.length;
    if (totalBytes > MAX_IMAGE_BYTES) throw new UploadTooLargeError();
    chunks.push(bytes);
  }
  return Buffer.concat(chunks, totalBytes);
}

export default async function upload(request: ApiRequest, response: ApiResponse) {
  setCorsHeaders(response);
  if (handleOptions(request, response)) return;
  if (request.method !== 'POST') return methodNotAllowed(response, ['POST', 'OPTIONS']);

  const userId = requireAuth(request, response);
  if (!userId) return;

  const contentType = request.headers['content-type']?.split(';', 1)[0]?.trim().toLowerCase();
  if (contentType !== 'image/jpeg') {
    return response.status(415).json({ error: 'Upload a JPEG image using Content-Type: image/jpeg.' });
  }
  const contentLengthHeader = request.headers['content-length'];
  if (contentLengthHeader !== undefined) {
    const contentLength = Number(contentLengthHeader);
    if (!Number.isInteger(contentLength) || contentLength < 0) {
      return response.status(400).json({ error: 'The upload size is invalid.' });
    }
    if (contentLength > MAX_IMAGE_BYTES) {
      return response.status(413).json({ error: 'JPEG images must be 3 MB or smaller.' });
    }
  }

  try {
    const image = await readImage(request);
    if (image.length < 4 || image[0] !== 0xff || image[1] !== 0xd8 || image[2] !== 0xff ||
        image[image.length - 2] !== 0xff || image[image.length - 1] !== 0xd9) {
      return response.status(400).json({ error: 'The uploaded file is not a valid JPEG image.' });
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN && !(process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID)) {
      console.error('Image upload is not configured: connect a Vercel Blob store or set BLOB_READ_WRITE_TOKEN.');
      return response.status(503).json({ error: 'Photo uploads are not configured yet. Please try again later.' });
    }
    const blob = await put(`trailhead/${userId}/${randomUUID()}.jpg`, image, {
      access: 'public',
      contentType: 'image/jpeg',
      addRandomSuffix: false,
    });
    return response.status(201).json({ url: blob.url });
  } catch (error) {
    if (error instanceof UploadTooLargeError) {
      return response.status(413).json({ error: 'JPEG images must be 3 MB or smaller.' });
    }
    console.error(`Image upload failed for user ${userId}:`, error);
    return response.status(500).json({ error: 'Could not upload this photo. Please try again.' });
  }
}
