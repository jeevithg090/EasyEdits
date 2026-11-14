'use strict';

const net = require('net');

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
]);

/**
 * Parse a value as an absolute http(s) URL.
 * @param {unknown} value
 * @returns {URL | null}
 */
function parseHttpUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  return url;
}

/** @param {unknown} value */
function isHttpUrl(value) {
  return parseHttpUrl(value) !== null;
}

/**
 * True for YouTube watch/short/share URLs. A scheme is optional to match what
 * users usually paste ("youtube.com/watch?v=...").
 * @param {unknown} value
 */
function isYouTubeUrl(value) {
  if (typeof value !== 'string') return false;
  const candidate = /^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
  const url = parseHttpUrl(candidate);
  return url !== null && YOUTUBE_HOSTS.has(url.hostname.toLowerCase()) && url.pathname.length > 1;
}

function isPrivateIPv4(ip) {
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

/**
 * True for http(s) URLs whose host is not obviously internal (localhost,
 * loopback, link-local or RFC1918 literals). This is a cheap guard against
 * SSRF on endpoints that fetch user-provided URLs; it does not resolve DNS.
 * @param {unknown} value
 */
function isPublicHttpUrl(value) {
  const url = parseHttpUrl(value);
  if (!url) return false;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) {
    return false;
  }
  if (net.isIPv4(host)) return !isPrivateIPv4(host);
  if (net.isIPv6(host)) {
    if (host === '::' || host === '::1') return false;
    if (/^(fc|fd|fe8|fe9|fea|feb)/.test(host)) return false;
    // IPv4-mapped addresses; URL() normalises ::ffff:127.0.0.1 to ::ffff:7f00:1
    const dotted = host.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (dotted) return !isPrivateIPv4(dotted[1]);
    const hex = host.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hex) {
      const high = parseInt(hex[1], 16);
      const low = parseInt(hex[2], 16);
      return !isPrivateIPv4(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
    }
  }
  return true;
}

/**
 * Matches yt-dlp section timestamps such as `90`, `1:30`, `01:02:03` or `12.5`.
 * @param {unknown} value
 */
function isTimestamp(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0;
  return typeof value === 'string' && /^\d{1,2}(:\d{1,2}){0,2}(\.\d+)?$/.test(value.trim());
}

module.exports = { parseHttpUrl, isHttpUrl, isYouTubeUrl, isPublicHttpUrl, isTimestamp };
