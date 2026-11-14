'use strict';

const path = require('path');

/**
 * Resolve a user-supplied relative path inside `baseDir`.
 *
 * Returns the absolute path when it stays inside `baseDir`, or `null` when the
 * input is empty, not a string, absolute, contains NUL bytes, or would escape
 * the directory (e.g. `../server.cjs`). Sub-directories are allowed so that
 * values like `ai_images/foo.jpg` keep working.
 *
 * @param {string} baseDir Absolute directory that must contain the result.
 * @param {unknown} relativePath Untrusted value coming from a request.
 * @returns {string | null}
 */
function resolveInside(baseDir, relativePath) {
  if (typeof relativePath !== 'string') return null;
  const trimmed = relativePath.trim();
  if (!trimmed || trimmed.includes('\0')) return null;
  if (path.isAbsolute(trimmed) || /^[a-zA-Z]:[\\/]/.test(trimmed)) return null;

  const root = path.resolve(baseDir);
  const resolved = path.resolve(root, trimmed);
  if (resolved === root) return null;
  if (!resolved.startsWith(root + path.sep)) return null;
  return resolved;
}

/**
 * Reduce an untrusted filename to a safe single path segment.
 * Keeps letters, digits, dot, dash and underscore; everything else becomes `_`.
 *
 * @param {unknown} name
 * @param {string} [fallback]
 * @returns {string}
 */
function sanitizeFilename(name, fallback = 'file') {
  if (typeof name !== 'string') return fallback;
  const base = path.basename(name.replace(/\\/g, '/'));
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '');
  return cleaned.slice(0, 200) || fallback;
}

module.exports = { resolveInside, sanitizeFilename };
