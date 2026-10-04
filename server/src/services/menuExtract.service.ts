import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' });

// Google retires models often (and blocks old ones for new keys), so try a few
// and remember the first that answers. GEMINI_MODEL can force one.
const MODEL_CANDIDATES = [process.env.GEMINI_MODEL, 'gemini-flash-latest', 'gemini-3.8-flash'].filter(Boolean) as string[];
let workingModel: string | null = null;

const isModelGone = (err: any) => /NOT_FOUND|no longer available|not found/i.test(String(err?.message ?? err));

// Last resort: ask Google which "flash" models this key can use.
async function discoverFlashModel(): Promise<string | null> {
  try {
    const pager = await ai.models.list();
    const names: string[] = [];
    for await (const m of pager) {
      if (m.name && /flash/.test(m.name) && !/lite|image|tts|live|audio/.test(m.name)) names.push(m.name.replace(/^models\//, ''));
    }
    return names.sort().reverse()[0] ?? null;
  } catch {
    return null;
  }
}

async function generate(contents: any): Promise<string> {
  const tried = new Set<string>();
  const queue = workingModel ? [workingModel, ...MODEL_CANDIDATES] : [...MODEL_CANDIDATES];
  let discovered = false;
  while (true) {
    const model = queue.find((m) => !tried.has(m));
    if (!model) {
      if (discovered) break;
      discovered = true;
      const found = await discoverFlashModel();
      if (found && !tried.has(found)) { queue.push(found); continue; }
      break;
    }
    tried.add(model);
    try {
      const response = await ai.models.generateContent({ model, contents });
      workingModel = model;
      return response.text ?? '';
    } catch (err: any) {
      if (!isModelGone(err)) {
        console.error('[menuExtract]', err?.message ?? err);
        throw new Error('Could not read the menu right now. Try again, or add items by hand.');
      }
    }
  }
  console.error('[menuExtract] no Gemini model available; tried', [...tried].join(', '));
  throw new Error('Could not read the menu right now. Try again, or add items by hand.');
}

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
  const text = await generate([
      {
        inlineData: {
          mimeType: mimeType as any,
          data: base64Data,
        },
      },
      { text: EXTRACT_PROMPT },
    ]);

  try {
    return parseResponse(text);
  } catch {
    throw new Error('Could not parse the extracted menu. Try a clearer image.');
  }
}

export async function extractMenuFromText(text: string): Promise<ExtractedItem[]> {
  assertConfigured();
  const raw = await generate(`${EXTRACT_PROMPT}\n\nMenu text:\n${text}`);
  try {
    return parseResponse(raw);
  } catch {
    throw new Error('Could not parse the extracted menu. Try a clearer file.');
  }
}
