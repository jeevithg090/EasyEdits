import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  validateScriptRequest,
  buildScriptPrompt,
  parseScriptResponse,
  extractInlineImage,
  extractText,
  MAX_TOPIC_LENGTH,
} = require('../lib/scriptGenerator.cjs');

const validScript = {
  title: 'T',
  hook: 'H',
  script_body: 'B',
  cta: 'C',
  visual_cues: ['v1', '', 3, ' v2 '],
  hashtags: ['#a'],
};

describe('validateScriptRequest', () => {
  it('normalises a valid request and defaults the tone', () => {
    expect(validateScriptRequest({ category: ' Music ', topic: ' lo-fi beats ' })).toEqual({
      ok: true,
      value: { category: 'Music', topic: 'lo-fi beats', tone: 'Energetic' },
    });
  });

  it.each([
    [undefined, 'category is required'],
    [{ topic: 'x' }, 'category is required'],
    [{ category: 'Music' }, 'topic is required'],
    [{ category: 'Music', topic: '   ' }, 'topic is required'],
    [{ category: 'Music', topic: 'x'.repeat(MAX_TOPIC_LENGTH + 1) }, 'at most'],
    [{ category: 'Music', topic: 'x', tone: 'y'.repeat(41) }, 'at most'],
  ])('rejects %j', (body, message) => {
    const result = validateScriptRequest(body);
    expect(result.ok).toBe(false);
    expect(result.error).toContain(message);
  });
});

describe('buildScriptPrompt', () => {
  it('includes the category, topic and tone', () => {
    const prompt = buildScriptPrompt({ category: 'Sports', topic: 'NBA finals', tone: 'Funny' });
    expect(prompt).toContain('"Sports"');
    expect(prompt).toContain('NBA finals');
    expect(prompt).toContain('Funny');
  });
});

describe('parseScriptResponse', () => {
  it('parses JSON and cleans array fields', () => {
    expect(parseScriptResponse(JSON.stringify(validScript))).toEqual({
      title: 'T',
      hook: 'H',
      script_body: 'B',
      cta: 'C',
      visual_cues: ['v1', 'v2'],
      hashtags: ['#a'],
    });
  });

  it('accepts a fenced ```json block', () => {
    const text = '```json\n' + JSON.stringify(validScript) + '\n```';
    expect(parseScriptResponse(text).title).toBe('T');
  });

  it('defaults missing arrays to empty lists', () => {
    const { visual_cues, hashtags, ...rest } = validScript;
    void visual_cues;
    void hashtags;
    expect(parseScriptResponse(JSON.stringify(rest))).toMatchObject({
      visual_cues: [],
      hashtags: [],
    });
  });

  it.each([
    ['', 'Empty response'],
    ['not json', 'not valid JSON'],
    [JSON.stringify({ ...validScript, hook: '' }), 'missing "hook"'],
    [JSON.stringify({ title: 'only' }), 'missing "hook"'],
  ])('throws for %j', (text, message) => {
    expect(() => parseScriptResponse(text)).toThrow(message);
  });
});

describe('Gemini response helpers', () => {
  const response = {
    candidates: [
      {
        content: {
          parts: [
            { text: 'Hello ' },
            { inlineData: { mimeType: 'image/jpeg', data: 'AAA' } },
            { text: 'world' },
          ],
        },
      },
    ],
  };

  it('extracts the first inline image as a data URL', () => {
    expect(extractInlineImage(response)).toBe('data:image/jpeg;base64,AAA');
  });

  it('supports snake_case inline_data and defaults the mime type', () => {
    const snake = { candidates: [{ content: { parts: [{ inline_data: { data: 'BBB' } }] } }] };
    expect(extractInlineImage(snake)).toBe('data:image/png;base64,BBB');
  });

  it('returns null when there is no image', () => {
    expect(extractInlineImage({})).toBeNull();
  });

  it('joins text parts', () => {
    expect(extractText(response)).toBe('Hello world');
    expect(extractText(undefined)).toBe('');
  });
});
