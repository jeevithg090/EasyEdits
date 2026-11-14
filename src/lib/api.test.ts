import { afterEach, describe, expect, it, vi } from 'vitest';
import { API_BASE, apiUrl, getErrorMessage, mediaUrl, postJson } from './api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiUrl', () => {
  it('defaults to the local API server', () => {
    expect(API_BASE).toBe('http://localhost:3005');
  });

  it('joins relative paths with or without a leading slash', () => {
    expect(apiUrl('/api/health')).toBe('http://localhost:3005/api/health');
    expect(apiUrl('api/health')).toBe('http://localhost:3005/api/health');
  });

  it('leaves absolute URLs untouched', () => {
    expect(apiUrl('https://cdn.example.com/v.mp4')).toBe('https://cdn.example.com/v.mp4');
  });
});

describe('mediaUrl', () => {
  it('encodes each path segment', () => {
    expect(mediaUrl('ai_images/my clip#1.mp4')).toBe(
      'http://localhost:3005/api/videos/file/ai_images/my%20clip%231.mp4',
    );
  });
});

describe('getErrorMessage', () => {
  it('prefers Error messages, then strings, then the fallback', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
    expect(getErrorMessage('plain')).toBe('plain');
    expect(getErrorMessage({}, 'fallback')).toBe('fallback');
    expect(getErrorMessage(new Error(''), 'fallback')).toBe('fallback');
  });
});

describe('postJson', () => {
  it('posts JSON and returns the parsed body', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: 1 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(postJson('/api/x', { a: 1 })).resolves.toEqual({ ok: 1 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:3005/api/x');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe('{"a":1}');
  });

  it('throws the server error message on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Nope' }), { status: 400 })),
    );
    await expect(postJson('/api/x', {})).rejects.toThrow('Nope');
  });

  it('throws a status message when the error body is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>', { status: 502 })));
    await expect(postJson('/api/x', {})).rejects.toThrow('Request failed with status 502');
  });
});
