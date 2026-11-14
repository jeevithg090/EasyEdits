import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { createRequire } from 'node:module';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);

let app;
let downloadsDir;
const probeName = `test_probe_${process.pid}.mp4`;

beforeAll(() => {
  // Pin configuration so a developer's local server/.env cannot change the
  // results (dotenv never overrides variables that are already set).
  Object.assign(process.env, {
    GEMINI_API_KEY: '',
    GEMINI_API_KEYS: '',
    GEMINI_API_KEY_1: '',
    GEMINI_API_KEY_2: '',
    CORS_ORIGINS: 'http://localhost:3000',
  });
  // Keep module start-up logs out of the test output.
  vi.spyOn(console, 'log').mockImplementation(() => {});
  ({ app } = require('../server.cjs'));
  downloadsDir = path.join(path.dirname(require.resolve('../server.cjs')), 'downloads');
  fs.writeFileSync(path.join(downloadsDir, probeName), 'not really a video');
});

afterAll(() => {
  fs.rmSync(path.join(downloadsDir, probeName), { force: true });
  vi.restoreAllMocks();
});

describe('API server', () => {
  it('reports health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('lists downloaded videos with servable paths', async () => {
    const res = await request(app).get('/api/videos');
    expect(res.status).toBe(200);
    const probe = res.body.find((v) => v.filename === probeName);
    expect(probe).toMatchObject({ path: `/api/videos/file/${probeName}` });
  });

  it('serves downloaded files', async () => {
    const res = await request(app).get(`/api/videos/file/${probeName}`);
    expect(res.status).toBe(200);
  });

  it('returns JSON for unknown API routes', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/No route/);
  });

  it('returns 400 JSON for malformed request bodies', async () => {
    const res = await request(app)
      .post('/api/download')
      .set('Content-Type', 'application/json')
      .send('{bad json');
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  it('refuses to delete files outside the downloads folder', async () => {
    const res = await request(app).delete('/api/videos/..%2Fserver.cjs');
    expect(res.status).toBe(400);
    expect(fs.existsSync(require.resolve('../server.cjs'))).toBe(true);
  });

  it('returns 404 when deleting a missing video', async () => {
    const res = await request(app).delete('/api/videos/missing.mp4');
    expect(res.status).toBe(404);
  });

  it('rejects non-YouTube URLs and option-like input on /api/download', async () => {
    for (const url of ['--exec=id', 'https://evil.com/watch?v=1']) {
      const res = await request(app)
        .post('/api/download')
        .send({ url, startTime: '0', endTime: '10' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid YouTube URL');
    }
  });

  it('rejects malformed timestamps on /api/download', async () => {
    const res = await request(app)
      .post('/api/download')
      .send({ url: 'https://youtu.be/abc', startTime: '0; rm -rf /', endTime: '10' });
    expect(res.status).toBe(400);
  });

  it('blocks B-roll downloads from internal hosts', async () => {
    const res = await request(app)
      .post('/api/broll/download')
      .send({ url: 'http://169.254.169.254/latest/meta-data/' });
    expect(res.status).toBe(400);
  });

  it('resolves local media URLs on /api/download-cloud-video without fetching', async () => {
    const res = await request(app)
      .post('/api/download-cloud-video')
      .send({ videoUrl: `http://localhost:3005/api/videos/file/${probeName}` });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ isLocal: true, filename: probeName });
  });

  it('rejects path traversal in media filenames', async () => {
    const res = await request(app)
      .post('/api/music-video/transcribe')
      .send({ videoFilename: '../server.cjs' });
    expect(res.status).toBe(404);
  });

  it('rejects clip lists that point outside the downloads folder', async () => {
    const res = await request(app)
      .post('/api/motivational/ai-youtube-assemble')
      .send({
        clips: [{ filename: "../server.cjs' \nfile '/etc/passwd" }],
        audioFilename: probeName,
      });
    expect(res.status).toBe(400);
  });

  it('allows the dev frontend origin via CORS but not arbitrary origins', async () => {
    const allowed = await request(app).get('/api/health').set('Origin', 'http://localhost:3000');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:3000');

    const blocked = await request(app).get('/api/health').set('Origin', 'https://evil.example');
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('Gemini-only routes without a key', () => {
  it('return 503 with an actionable message', async () => {
    for (const route of ['/api/news/start-questionnaire', '/api/entertainment/suggest-scenes']) {
      const res = await request(app).post(route).send({ title: 'Inception' });
      expect(res.status).toBe(503);
      expect(res.body.error).toMatch(/GEMINI_API_KEY/);
    }
  });
});
