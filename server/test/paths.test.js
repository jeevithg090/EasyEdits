import path from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { resolveInside, sanitizeFilename } = require('../lib/paths.cjs');

const BASE = path.resolve('/srv/app/downloads');

describe('resolveInside', () => {
  it('resolves plain filenames inside the base directory', () => {
    expect(resolveInside(BASE, 'video_1.mp4')).toBe(path.join(BASE, 'video_1.mp4'));
  });

  it('allows nested sub-directories', () => {
    expect(resolveInside(BASE, 'ai_images/a.jpg')).toBe(path.join(BASE, 'ai_images', 'a.jpg'));
  });

  it.each([
    ['../server.cjs'],
    ['../../etc/passwd'],
    ['ai_images/../../secret'],
    ['/etc/passwd'],
    ['C:\\Windows\\system.ini'],
    ['.'],
    [''],
    ['   '],
    ['file\0.mp4'],
  ])('rejects %j', (input) => {
    expect(resolveInside(BASE, input)).toBeNull();
  });

  it('rejects non-string input', () => {
    expect(resolveInside(BASE, undefined)).toBeNull();
    expect(resolveInside(BASE, 42)).toBeNull();
    expect(resolveInside(BASE, { filename: 'x' })).toBeNull();
  });

  it('does not treat a sibling directory with the same prefix as inside', () => {
    expect(resolveInside(BASE, '../downloads-evil/x.mp4')).toBeNull();
  });
});

describe('sanitizeFilename', () => {
  it('keeps safe names unchanged', () => {
    expect(sanitizeFilename('broll_123.mp4')).toBe('broll_123.mp4');
  });

  it('strips directories and unsafe characters', () => {
    expect(sanitizeFilename('../../etc/pass wd')).toBe('pass_wd');
    expect(sanitizeFilename('..\\..\\evil.sh')).toBe('evil.sh');
  });

  it('removes leading dots so hidden files cannot be created', () => {
    expect(sanitizeFilename('.env')).toBe('env');
  });

  it('falls back when nothing usable is left', () => {
    expect(sanitizeFilename('...', 'fallback.jpg')).toBe('fallback.jpg');
    expect(sanitizeFilename(undefined, 'fallback.jpg')).toBe('fallback.jpg');
  });

  it('limits the length', () => {
    expect(sanitizeFilename('a'.repeat(500))).toHaveLength(200);
  });
});
