import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { isHttpUrl, isYouTubeUrl, isPublicHttpUrl, isTimestamp } = require('../lib/validation.cjs');

describe('isHttpUrl', () => {
  it('accepts http and https URLs', () => {
    expect(isHttpUrl('https://example.com/a')).toBe(true);
    expect(isHttpUrl('http://example.com')).toBe(true);
  });

  it.each(['--exec=id', 'file:///etc/passwd', 'javascript:alert(1)', 'example.com', '', null, 7])(
    'rejects %j',
    (value) => {
      expect(isHttpUrl(value)).toBe(false);
    },
  );
});

describe('isYouTubeUrl', () => {
  it.each([
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ',
    'youtube.com/shorts/abc123',
    'https://m.youtube.com/watch?v=abc',
    'https://music.youtube.com/watch?v=abc',
  ])('accepts %s', (url) => {
    expect(isYouTubeUrl(url)).toBe(true);
  });

  it.each([
    'https://youtube.com.evil.com/watch?v=1',
    'https://evil.com/youtube.com/watch',
    'https://youtube.com/',
    '--exec=id',
    'ftp://youtube.com/watch?v=1',
    undefined,
  ])('rejects %j', (url) => {
    expect(isYouTubeUrl(url)).toBe(false);
  });
});

describe('isPublicHttpUrl', () => {
  it('accepts public hosts', () => {
    expect(isPublicHttpUrl('https://images.pexels.com/photo.jpg')).toBe(true);
    expect(isPublicHttpUrl('https://8.8.8.8/x')).toBe(true);
  });

  it.each([
    'http://localhost:3005/api/health',
    'http://127.0.0.1/',
    'http://10.0.0.5/',
    'http://172.16.0.1/',
    'http://192.168.1.1/',
    'http://169.254.169.254/latest/meta-data/',
    'http://[::1]/',
    'http://[fd00::1]/',
    'http://[::ffff:127.0.0.1]/',
    'http://metadata.google.internal/',
    'file:///etc/passwd',
  ])('rejects %s', (url) => {
    expect(isPublicHttpUrl(url)).toBe(false);
  });
});

describe('isTimestamp', () => {
  it.each(['0', '90', '1:30', '01:02:03', '12.5', 0, 42])('accepts %j', (value) => {
    expect(isTimestamp(value)).toBe(true);
  });

  it.each(['', 'abc', '1:2:3:4', '-5', '1;rm -rf', -1, Number.NaN, null])('rejects %j', (value) => {
    expect(isTimestamp(value)).toBe(false);
  });
});
