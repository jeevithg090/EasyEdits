import express from 'express';
import request from 'supertest';
import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { createGeneratorRouter } = require('../routes/generator.cjs');

const jsonResponse = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

function buildApp({ apiKey = 'test-key', fetchImpl, rotateApiKey = vi.fn() } = {}) {
  const app = express();
  app.use(express.json());
  app.use(
    '/api/generator',
    createGeneratorRouter({
      getApiKey: () => apiKey,
      rotateApiKey,
      textModel: 'text-model',
      imageModel: 'image-model',
      fetchImpl,
    }),
  );
  return app;
}

const script = {
  title: 'T',
  hook: 'H',
  script_body: 'B',
  cta: 'C',
  visual_cues: ['v'],
  hashtags: ['#h'],
};

describe('POST /api/generator/script', () => {
  it('returns the parsed script and sends the key in a header', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, {
        candidates: [{ content: { parts: [{ text: JSON.stringify(script) }] } }],
      }),
    );

    const res = await request(buildApp({ fetchImpl }))
      .post('/api/generator/script')
      .send({ category: 'Music', topic: 'lo-fi', tone: 'Chill' });

    expect(res.status).toBe(200);
    expect(res.body.script).toEqual(script);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/text-model:generateContent',
    );
    expect(url).not.toContain('key=');
    expect(init.headers['x-goog-api-key']).toBe('test-key');
    const body = JSON.parse(init.body);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.contents[0].parts[0].text).toContain('lo-fi');
  });

  it('validates the request before calling the model', async () => {
    const fetchImpl = vi.fn();
    const res = await request(buildApp({ fetchImpl }))
      .post('/api/generator/script')
      .send({ category: 'Music' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('topic is required');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns 503 when no API key is configured', async () => {
    const res = await request(buildApp({ apiKey: '', fetchImpl: vi.fn() }))
      .post('/api/generator/script')
      .send({ category: 'Music', topic: 'x' });

    expect(res.status).toBe(503);
  });

  it('rotates the key and returns 502 when Gemini rate-limits', async () => {
    const rotateApiKey = vi.fn();
    const fetchImpl = vi.fn(async () => jsonResponse(429, { error: { message: 'quota' } }));

    const res = await request(buildApp({ fetchImpl, rotateApiKey }))
      .post('/api/generator/script')
      .send({ category: 'Music', topic: 'x' });

    expect(res.status).toBe(502);
    expect(res.body.error).toBe('quota');
    expect(rotateApiKey).toHaveBeenCalledOnce();
  });

  it('returns 502 when the model output is malformed', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, { candidates: [{ content: { parts: [{ text: 'nope' }] } }] }),
    );

    const res = await request(buildApp({ fetchImpl }))
      .post('/api/generator/script')
      .send({ category: 'Music', topic: 'x' });

    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/not valid JSON/);
  });
});

describe('POST /api/generator/concept-image', () => {
  it('returns the generated image as a data URL', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, {
        candidates: [
          { content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'QUJD' } }] } },
        ],
      }),
    );

    const res = await request(buildApp({ fetchImpl }))
      .post('/api/generator/concept-image')
      .send({ description: 'neon city' });

    expect(res.status).toBe(200);
    expect(res.body.image).toBe('data:image/png;base64,QUJD');
    expect(fetchImpl.mock.calls[0][0]).toContain('/image-model:generateContent');
  });

  it('requires a description', async () => {
    const res = await request(buildApp({ fetchImpl: vi.fn() }))
      .post('/api/generator/concept-image')
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 502 when no image comes back', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, { candidates: [{ content: { parts: [{ text: 'sorry' }] } }] }),
    );
    const res = await request(buildApp({ fetchImpl }))
      .post('/api/generator/concept-image')
      .send({ description: 'x' });
    expect(res.status).toBe(502);
  });
});
