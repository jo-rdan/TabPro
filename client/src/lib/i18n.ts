import { useSyncExternalStore } from "react";
import { RW } from "../i18n/rw";
import { FR } from "../i18n/fr";

// Guests and staff read Skuzi in Kinyarwanda, English or French, each on their
// own phone. The screens are written in English; <Translated> swaps every
// English phrase it knows for the chosen language as it appears on screen
// (dictionaries in src/i18n). Anything not in the dictionary stays English, and
// what owners typed (dish names, venue and table names) is never touched.

export type Lang = "rw" | "en" | "fr";
export const LANGS: Lang[] = ["rw", "en", "fr"];
const KEY = "skuzi_lang";

type Dict = { exact: Record<string, string>; patterns?: [RegExp, string][] };
const DICTS: Record<Exclude<Lang, "en">, Dict> = { rw: RW, fr: FR };

function detect(): Lang {
  const prefs = typeof navigator !== "undefined" ? navigator.languages ?? [navigator.language] : [];
  for (const p of prefs) {
    const l = (p || "").toLowerCase();
    if (l.startsWith("rw") || l.startsWith("kin")) return "rw";
    if (l.startsWith("fr")) return "fr";
    if (l.startsWith("en")) return "en";
  }
  return "en";
}

function read(): Lang | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "rw" || v === "en" || v === "fr" ? v : null;
  } catch {
    return null;
  }
}

let current: Lang = read() ?? detect();
const listeners = new Set<() => void>();

export const getLang = () => current;
export function setLang(lang: Lang) {
  current = lang;
  try { localStorage.setItem(KEY, lang); } catch { /* still applied for this visit */ }
  document.documentElement.lang = lang === "rw" ? "rw" : lang;
  listeners.forEach((l) => l());
}
export function useLang(): Lang {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => current,
    () => current,
  );
}

/** One piece of on-screen English in the chosen language (unknown text stays English). */
export function translate(text: string, lang: Lang = current): string {
  if (lang === "en" || !text) return text;
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
  if (!m) return text;
  const [, lead, core, trail] = m;
  if (!core || !/[A-Za-z]/.test(core)) return text;
  const dict = DICTS[lang];
  const hit = dict.exact[core];
  if (hit !== undefined) return lead + hit + trail;
  for (const [re, out] of dict.patterns ?? []) {
    if (re.test(core)) return lead + core.replace(re, out) + trail;
  }
  if (import.meta.env.DEV) missing.add(core);
  return text;
}

// While developing: the English nobody translated yet (window.__skuziMissing).
const missing = new Set<string>();
if (import.meta.env.DEV && typeof window !== "undefined") (window as any).__skuziMissing = missing;
