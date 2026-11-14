'use strict';

const MAX_TOPIC_LENGTH = 500;
const MAX_TONE_LENGTH = 40;

/** JSON schema (Gemini REST dialect) for a short-form video script. */
const SCRIPT_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING', description: 'A catchy title for internal reference' },
    hook: { type: 'STRING', description: 'The first 3 seconds to grab attention' },
    script_body: { type: 'STRING', description: 'The main spoken content' },
    cta: { type: 'STRING', description: 'Call to action for the viewer' },
    visual_cues: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'List of 3-5 visual ideas or B-roll descriptions to match the audio',
    },
    hashtags: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: '5 viral hashtags',
    },
  },
  required: ['title', 'hook', 'script_body', 'cta', 'visual_cues', 'hashtags'],
};

/**
 * Validate and normalise the generator request body.
 * @param {unknown} body
 * @returns {{ ok: true, value: { category: string, topic: string, tone: string } } | { ok: false, error: string }}
 */
function validateScriptRequest(body) {
  const { category, topic, tone } = /** @type {Record<string, unknown>} */ (body || {});
  if (typeof category !== 'string' || !category.trim()) {
    return { ok: false, error: 'category is required' };
  }
  if (typeof topic !== 'string' || !topic.trim()) {
    return { ok: false, error: 'topic is required' };
  }
  if (topic.length > MAX_TOPIC_LENGTH) {
    return { ok: false, error: `topic must be at most ${MAX_TOPIC_LENGTH} characters` };
  }
  const safeTone = typeof tone === 'string' && tone.trim() ? tone.trim() : 'Energetic';
  if (safeTone.length > MAX_TONE_LENGTH) {
    return { ok: false, error: `tone must be at most ${MAX_TONE_LENGTH} characters` };
  }
  return {
    ok: true,
    value: { category: category.trim(), topic: topic.trim(), tone: safeTone },
  };
}

/**
 * @param {{ category: string, topic: string, tone: string }} input
 */
function buildScriptPrompt({ category, topic, tone }) {
  return [
    `Create a viral short-form video script (TikTok/Reels/Shorts) for the category "${category}".`,
    `Topic: "${topic}".`,
    `Tone: "${tone}".`,
    '',
    'The script should be fast-paced, engaging, and under 60 seconds spoken.',
    'Include a catchy hook, the main body content, a strong Call to Action (CTA), visual suggestions for B-roll, and relevant hashtags.',
  ].join('\n');
}

/** @param {string} description */
function buildConceptImagePrompt(description) {
  return `Generate a high quality, cinematic, 4k concept art or thumbnail background for a video about: ${description}. The style should be modern, vibrant, and suitable for social media.`;
}

const toStringArray = (value) =>
  Array.isArray(value) ? value.filter((v) => typeof v === 'string' && v.trim()).map((v) => v.trim()) : [];

/**
 * Parse the model's JSON text into a ScriptData object, throwing on bad shape.
 * Tolerates a ```json fenced block around the payload.
 * @param {string} text
 */
function parseScriptResponse(text) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Empty response from model');
  }
  const unfenced = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  let data;
  try {
    data = JSON.parse(unfenced);
  } catch {
    throw new Error('Model response was not valid JSON');
  }
  const required = ['title', 'hook', 'script_body', 'cta'];
  for (const field of required) {
    if (typeof data?.[field] !== 'string' || !data[field].trim()) {
      throw new Error(`Model response is missing "${field}"`);
    }
  }
  return {
    title: data.title.trim(),
    hook: data.hook.trim(),
    script_body: data.script_body.trim(),
    cta: data.cta.trim(),
    visual_cues: toStringArray(data.visual_cues),
    hashtags: toStringArray(data.hashtags),
  };
}

/**
 * Pull the first inline image out of a Gemini generateContent response.
 * @returns {string | null} A data URL, or null when no image is present.
 */
function extractInlineImage(response) {
  const parts = response?.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    const inline = part.inlineData || part.inline_data;
    if (inline?.data) {
      return `data:${inline.mimeType || inline.mime_type || 'image/png'};base64,${inline.data}`;
    }
  }
  return null;
}

/** Pull the concatenated text out of a Gemini generateContent response. */
function extractText(response) {
  const parts = response?.candidates?.[0]?.content?.parts || [];
  return parts
    .map((part) => (typeof part.text === 'string' ? part.text : ''))
    .join('')
    .trim();
}

module.exports = {
  SCRIPT_RESPONSE_SCHEMA,
  MAX_TOPIC_LENGTH,
  validateScriptRequest,
  buildScriptPrompt,
  buildConceptImagePrompt,
  parseScriptResponse,
  extractInlineImage,
  extractText,
};
