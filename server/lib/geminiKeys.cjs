'use strict';

/**
 * Collect Gemini API keys from the environment, in priority order, without
 * duplicates or blanks:
 *   GEMINI_API_KEYS (comma separated), GEMINI_API_KEY_1, GEMINI_API_KEY_2, GEMINI_API_KEY
 *
 * @param {NodeJS.ProcessEnv} env
 * @returns {string[]}
 */
function collectGeminiKeys(env = process.env) {
  const candidates = [
    ...(env.GEMINI_API_KEYS || '').split(','),
    env.GEMINI_API_KEY_1,
    env.GEMINI_API_KEY_2,
    env.GEMINI_API_KEY,
  ];
  const keys = [];
  for (const raw of candidates) {
    const key = (raw || '').trim();
    if (key && !keys.includes(key)) keys.push(key);
  }
  return keys;
}

/**
 * A tiny round-robin pool so a rate-limited key can be swapped for the next.
 */
class KeyPool {
  /** @param {string[]} keys */
  constructor(keys) {
    this.keys = [...keys];
    this.index = 0;
  }

  get size() {
    return this.keys.length;
  }

  /** @returns {string} The current key, or '' when the pool is empty. */
  current() {
    return this.keys[this.index] || '';
  }

  /** Advance to the next key and return it. */
  rotate() {
    if (this.keys.length === 0) return '';
    this.index = (this.index + 1) % this.keys.length;
    return this.current();
  }
}

module.exports = { collectGeminiKeys, KeyPool };
