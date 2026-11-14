'use strict';

const express = require('express');
const {
  SCRIPT_RESPONSE_SCHEMA,
  validateScriptRequest,
  buildScriptPrompt,
  buildConceptImagePrompt,
  parseScriptResponse,
  extractInlineImage,
  extractText,
} = require('../lib/scriptGenerator.cjs');

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Routes backing the category "Generator" page (script + concept art).
 * Gemini is called from the server so the API key never reaches the browser.
 *
 * @param {object} deps
 * @param {() => string} deps.getApiKey
 * @param {() => void} [deps.rotateApiKey]
 * @param {string} deps.textModel
 * @param {string} deps.imageModel
 * @param {typeof fetch} [deps.fetchImpl]
 */
function createGeneratorRouter({
  getApiKey,
  rotateApiKey = () => {},
  textModel,
  imageModel,
  fetchImpl = fetch,
}) {
  const router = express.Router();

  async function callGemini(model, body) {
    const apiKey = getApiKey();
    if (!apiKey) {
      const error = new Error('Gemini API key is not configured on the server');
      error.status = 503;
      throw error;
    }
    const response = await fetchImpl(`${GEMINI_BASE_URL}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 429 || response.status === 403) rotateApiKey();
      const error = new Error(data?.error?.message || `Gemini request failed (${response.status})`);
      error.status = 502;
      throw error;
    }
    return data;
  }

  const sendError = (res, error, fallback) => {
    const status = error.status || 500;
    console.error(`Generator: ${fallback}:`, error.message);
    res.status(status).json({ error: status === 500 ? fallback : error.message });
  };

  router.post('/script', async (req, res) => {
    const parsed = validateScriptRequest(req.body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });

    try {
      const data = await callGemini(textModel, {
        contents: [{ parts: [{ text: buildScriptPrompt(parsed.value) }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: SCRIPT_RESPONSE_SCHEMA,
        },
      });
      const script = parseScriptResponse(extractText(data));
      res.json({ script });
    } catch (error) {
      if (!error.status) error.status = 502;
      sendError(res, error, 'Failed to generate script');
    }
  });

  router.post('/concept-image', async (req, res) => {
    const { description } = req.body || {};
    if (typeof description !== 'string' || !description.trim()) {
      return res.status(400).json({ error: 'description is required' });
    }
    if (description.length > 1000) {
      return res.status(400).json({ error: 'description must be at most 1000 characters' });
    }

    try {
      const data = await callGemini(imageModel, {
        contents: [{ parts: [{ text: buildConceptImagePrompt(description.trim()) }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      });
      const image = extractInlineImage(data);
      if (!image) {
        const error = new Error('The model did not return an image');
        error.status = 502;
        throw error;
      }
      res.json({ image });
    } catch (error) {
      sendError(res, error, 'Failed to generate image');
    }
  });

  return router;
}

module.exports = { createGeneratorRouter };
