import { GoogleGenAI, Type } from "@google/genai";
import { ContentCategory, ScriptData } from "../types";

const apiKey = process.env.API_KEY || '';

// Initialize specific models as per guidelines
// Text: gemini-3-flash-preview
// Image: gemini-2.5-flash-image

let aiClient: GoogleGenAI | null = null;

const getClient = () => {
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
};

export const generateVideoScript = async (
  category: ContentCategory, 
  topic: string, 
  tone: string
): Promise<ScriptData> => {
  const ai = getClient();
  
  const prompt = `
    Create a viral short-form video script (TikTok/Reels/Shorts) for the category "${category}".
    Topic: "${topic}".
    Tone: "${tone}".
    
    The script should be fast-paced, engaging, and under 60 seconds spoken.
    Include a catchy hook, the main body content, a strong Call to Action (CTA), visual suggestions for B-roll, and relevant hashtags.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "A catchy title for internal reference" },
            hook: { type: Type.STRING, description: "The first 3 seconds to grab attention" },
            script_body: { type: Type.STRING, description: "The main spoken content" },
            cta: { type: Type.STRING, description: "Call to action for the viewer" },
            visual_cues: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "List of 3-5 visual ideas or B-roll descriptions to match the audio"
            },
            hashtags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "5 viral hashtags"
            }
          },
          required: ["title", "hook", "script_body", "cta", "visual_cues", "hashtags"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text) as ScriptData;

  } catch (error) {
    console.error("Error generating script:", error);
    throw error;
  }
};

export const generateConceptImage = async (
  description: string
): Promise<string> => {
  const ai = getClient();
  
  try {
    // Guidelines: Use gemini-2.5-flash-image for general image generation
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { text: `Generate a high quality, cinematic, 4k concept art or thumbnail background for a video about: ${description}. The style should be modern, vibrant, and suitable for social media.` }
        ]
      },
      config: {
        // Nano banana models do not support responseMimeType for images in the same way as text JSON
        // We just expect the response to contain the image inlineData
      }
    });

    // Iterate through parts to find the image
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
        for (const part of parts) {
            if (part.inlineData && part.inlineData.data) {
                return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
            }
        }
    }
    
    throw new Error("No image generated");

  } catch (error) {
    console.error("Error generating image:", error);
    throw error;
  }
};
