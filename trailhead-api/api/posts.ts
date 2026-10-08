import { handlePosts } from '../lib/posts.js';
import type { ApiRequest, ApiResponse } from '../lib/http.js';

export default function posts(request: ApiRequest, response: ApiResponse) {
  return handlePosts(request, response);
}
