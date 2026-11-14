'use strict';

const DEFAULT_PORT = 3005;
const DEFAULT_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'];

/**
 * Parse the port to listen on. Falls back to 3005 for missing/invalid values.
 * @param {string | undefined} value
 */
function parsePort(value) {
  const port = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : DEFAULT_PORT;
}

/**
 * Parse CORS_ORIGINS. `*` allows every origin; otherwise a comma-separated list.
 * @param {string | undefined} value
 * @returns {'*' | string[]}
 */
function parseOrigins(value) {
  if (!value || !value.trim()) return DEFAULT_ORIGINS;
  if (value.trim() === '*') return '*';
  return value
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

/**
 * Build server configuration from environment variables.
 * @param {NodeJS.ProcessEnv} env
 */
function loadConfig(env = process.env) {
  return {
    port: parsePort(env.PORT),
    corsOrigins: parseOrigins(env.CORS_ORIGINS),
    jsonLimit: env.JSON_BODY_LIMIT || '10mb',
    GEMINI_TEXT_MODEL: env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash',
    GEMINI_IMAGE_MODEL: env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image',
  };
}

module.exports = { loadConfig, parsePort, parseOrigins, DEFAULT_PORT };
