import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' });

// Google retires models often (and blocks old ones for new keys), so try a few
// and remember the first that answers. GEMINI_MODEL can force one.
const MODEL_CANDIDATES = [process.env.GEMINI_MODEL, 'gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'].filter(Boolean) as string[];
let workingModel: string | null = null;

const isModelGone = (err: any) => /NOT_FOUND|no longer available|not found/i.test(String(err?.message ?? err));

// Ask Google which "flash" models this key can use: full models first, then
// the "lite" ones (their free allowance is larger, and they read menus fine).
async function discoverFlashModels(): Promise<string[]> {
  try {
    const pager = await ai.models.list();
    const full: string[] = [];
    const lite: string[] = [];
    for await (const m of pager) {
      if (!m.name || !/flash/.test(m.name) || /image|tts|live|audio|preview|exp/.test(m.name)) continue;
      const name = m.name.replace(/^models\//, '');
      (/lite/.test(name) ? lite : full).push(name);
    }
    return [...full.sort().reverse(), ...lite.sort().reverse()];
  } catch {
    return [];
  }
}

const isBusy = (err: any) => /UNAVAILABLE|RESOURCE_EXHAUSTED|overloaded|\b503\b|\b429\b/i.test(String(err?.message ?? err));

const isOverloaded = (err: any) => /UNAVAILABLE|overloaded|\b503\b/i.test(String(err?.message ?? err));

// Google's free tier is often briefly overloaded: wait and try again. Out of
// free allowance (RESOURCE_EXHAUSTED) won't fix itself in seconds, so move on.
async function withBusyRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isOverloaded(err) || attempt >= 2) throw err;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
}

// Tries models until one answers. A model that is gone, busy or out of free
// allowance doesn't stop us: the next one is tried, then whatever Google lists.
async function generate(contents: any): Promise<string> {
  const tried = new Set<string>();
  const queue = workingModel ? [workingModel, ...MODEL_CANDIDATES] : [...MODEL_CANDIDATES];
  let discovered = false;
  let lastReason = '';
  while (true) {
    const model = queue.find((m) => !tried.has(m));
    if (!model) {
      if (discovered) break;
      discovered = true;
      queue.push(...(await discoverFlashModels()));
      continue;
    }
    tried.add(model);
    try {
      const response = await withBusyRetry(() => ai.models.generateContent({ model, contents }));
      workingModel = model;
      return response.text ?? '';
    } catch (err: any) {
      const raw = String(err?.message ?? err);
      if (isModelGone(err)) continue;
      console.error('[menuExtract]', model, raw);
      // Google's short status (e.g. RESOURCE_EXHAUSTED) helps support without exposing anything.
      lastReason = raw.match(/"status":\s*"([A-Z_]+)"/)?.[1] ?? raw.match(/\b(4\d\d|5\d\d)\b/)?.[1] ?? 'unknown';
      if (workingModel === model) workingModel = null;
      if (isBusy(err)) continue;
      throw new Error(`Could not read the menu right now (${lastReason}). Try again, or add items by hand.`);
    }
  }
  console.error('[menuExtract] no Gemini model answered; tried', [...tried].join(', '));
  throw new Error(`Could not read the menu right now${lastReason ? ` (${lastReason})` : ''}. Try again in a minute, or add items by hand.`);
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
- Use the menu's own section headings as categories (e.g. "Brochettes", "Beers", "Soft drinks"); if there are none, use simple groups like "Food" and "Drinks"
- Keep the full item name as written, including the section word when it is part of the dish (e.g. "Brochette Chèvre")
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
