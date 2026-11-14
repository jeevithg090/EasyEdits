import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { loadConfig, parsePort, parseOrigins, DEFAULT_PORT } = require('../lib/config.cjs');
const { collectGeminiKeys, KeyPool } = require('../lib/geminiKeys.cjs');

describe('parsePort', () => {
  it('parses valid ports', () => {
    expect(parsePort('8080')).toBe(8080);
  });

  it.each([undefined, '', 'abc', '0', '70000', '-1'])('falls back for %j', (value) => {
    expect(parsePort(value)).toBe(DEFAULT_PORT);
  });
});

describe('parseOrigins', () => {
  it('defaults to the local Vite dev server', () => {
    expect(parseOrigins(undefined)).toEqual(['http://localhost:3000', 'http://127.0.0.1:3000']);
  });

  it('supports a wildcard', () => {
    expect(parseOrigins('*')).toBe('*');
  });

  it('splits, trims and strips trailing slashes', () => {
    expect(parseOrigins(' https://a.dev/ , https://b.dev ,')).toEqual([
      'https://a.dev',
      'https://b.dev',
    ]);
  });
});

describe('loadConfig', () => {
  it('applies defaults', () => {
    const config = loadConfig({});
    expect(config.port).toBe(DEFAULT_PORT);
    expect(config.jsonLimit).toBe('10mb');
    expect(config.GEMINI_TEXT_MODEL).toBe('gemini-2.5-flash');
    expect(config.GEMINI_IMAGE_MODEL).toBe('gemini-2.5-flash-image');
  });

  it('reads overrides from the environment', () => {
    const config = loadConfig({
      PORT: '4000',
      CORS_ORIGINS: 'https://app.example.com',
      JSON_BODY_LIMIT: '1mb',
      GEMINI_TEXT_MODEL: 'custom-text',
    });
    expect(config).toMatchObject({
      port: 4000,
      corsOrigins: ['https://app.example.com'],
      jsonLimit: '1mb',
      GEMINI_TEXT_MODEL: 'custom-text',
    });
  });
});

describe('collectGeminiKeys', () => {
  it('returns an empty list when nothing is configured', () => {
    expect(collectGeminiKeys({})).toEqual([]);
  });

  it('uses a single GEMINI_API_KEY', () => {
    expect(collectGeminiKeys({ GEMINI_API_KEY: 'k' })).toEqual(['k']);
  });

  it('merges all sources in priority order without blanks or duplicates', () => {
    expect(
      collectGeminiKeys({
        GEMINI_API_KEYS: 'a, b,,a',
        GEMINI_API_KEY_1: 'c',
        GEMINI_API_KEY_2: ' ',
        GEMINI_API_KEY: 'b',
      }),
    ).toEqual(['a', 'b', 'c']);
  });
});

describe('KeyPool', () => {
  it('rotates round-robin', () => {
    const pool = new KeyPool(['a', 'b', 'c']);
    expect(pool.current()).toBe('a');
    expect(pool.rotate()).toBe('b');
    expect(pool.rotate()).toBe('c');
    expect(pool.rotate()).toBe('a');
  });

  it('is safe when empty', () => {
    const pool = new KeyPool([]);
    expect(pool.size).toBe(0);
    expect(pool.current()).toBe('');
    expect(pool.rotate()).toBe('');
  });
});
