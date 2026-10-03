import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' });
// Overridable so a retired model can be swapped without a code change.
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

function assertConfigured() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Reading menus from photos is not switched on yet. Please add items by hand for now.');
  }
}

interface ExtractedItem {
  name: string;
  category: string;
  priceRwf: number;
}

const EXTRACT_PROMPT = `Extract all menu items from this menu. Return ONLY a valid JSON array with no other text, markdown, or explanation. Format:
[{"name": "Item name", "category": "Category", "priceRwf": 1500}]

Rules:
- Categories should be consistent groups like "Drinks", "Food", "Starters", "Desserts"
- priceRwf must be an integer (Rwandan Francs). If unclear or missing, use 0
- Include every item you can read
- Do not include any text outside the JSON array`;

function parseResponse(text: string): ExtractedItem[] {
  const clean = text.replace(/```json|```/g, '').trim();
  const items: ExtractedItem[] = JSON.parse(clean);
  return items
    .filter((i) => i.name && i.category)
    .map((i) => ({
      name: String(i.name).trim(),
      category: String(i.category).trim(),
      priceRwf: typeof i.priceRwf === 'number' ? Math.round(i.priceRwf) : 0,
    }));
}

export async function extractMenuFromImage(base64Data: string, mimeType: string): Promise<ExtractedItem[]> {
  assertConfigured();
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        inlineData: {
          mimeType: mimeType as any,
          data: base64Data,
        },
      },
      { text: EXTRACT_PROMPT },
    ],
  });

  const text = response.text ?? '';
  try {
    return parseResponse(text);
  } catch {
    throw new Error('Could not parse the extracted menu. Try a clearer image.');
  }
}

export async function extractMenuFromText(text: string): Promise<ExtractedItem[]> {
  assertConfigured();
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `${EXTRACT_PROMPT}\n\nMenu text:\n${text}`,
  });

  const raw = response.text ?? '';
  try {
    return parseResponse(raw);
  } catch {
    throw new Error('Could not parse the extracted menu. Try a clearer file.');
  }
}
