import { postJson } from '../lib/api';
import type { ContentCategory, ScriptData } from '../types';

/** Generate a short-form video script via the API server. */
export async function generateVideoScript(
  category: ContentCategory,
  topic: string,
  tone: string,
): Promise<ScriptData> {
  const { script } = await postJson<{ script: ScriptData }>('/api/generator/script', {
    category,
    topic,
    tone,
  });
  return script;
}

/** Generate concept art for a script; resolves to a data URL. */
export async function generateConceptImage(description: string): Promise<string> {
  const { image } = await postJson<{ image: string }>('/api/generator/concept-image', {
    description,
  });
  return image;
}
