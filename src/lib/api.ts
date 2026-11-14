/**
 * Base URL of the EasyEdits API server (server/server.cjs).
 * Configure with VITE_API_BASE_URL; defaults to the local dev server.
 */
export const API_BASE: string = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3005'
).replace(/\/+$/, '');

/**
 * Build an absolute URL for an API path or a server-relative media path.
 * Absolute http(s) URLs (e.g. signed cloud URLs) are returned unchanged.
 */
export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
}

/** URL for a file stored in the server's downloads directory. */
export function mediaUrl(filename: string): string {
  const encoded = filename
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return apiUrl(`/api/videos/file/${encoded}`);
}

/** Turn an unknown thrown value into a user-facing message. */
export function getErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  return fallback;
}

/**
 * POST JSON to the API and parse the JSON response, throwing an Error with the
 * server's `error` message when the request fails.
 */
export async function postJson<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    ...init,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    body: JSON.stringify(body),
  });

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    // Non-JSON body (e.g. a proxy error page); handled below.
  }

  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}
