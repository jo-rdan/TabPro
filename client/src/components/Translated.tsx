import { useEffect, useRef, type ReactNode } from "react";
import { syncPushLang, translate, useLang } from "../lib/i18n";

// Shows its children in the chosen language: every text node and the
// placeholder / aria-label / title attributes under it go through translate()
// as React draws or updates them. The English original is remembered, so
// switching language back and forth always starts from English. Anything inside
// [data-notranslate] (dish names, venue names, what people typed) is left alone.

const ATTRS = ["placeholder", "aria-label", "title"] as const;
const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "CODE"]);

// A sentence with a bold word (or a number) in the middle reaches the page as
// several text nodes: "Pay ", <b>60,000 RWF</b>, " with MoMo". Translated piece
// by piece it comes out broken, so such an element is looked up whole, with its
// inline parts numbered: "Pay <0>60,000 RWF</0> with MoMo". The translation
// keeps the same numbered parts in the same order, and each part's text goes
// back into its own place (React's nodes are only ever re-filled, never moved).
const INLINE = new Set(["B", "STRONG", "I", "EM", "SPAN", "A", "U", "SMALL", "MARK"]);
const isSentence = (el: Element) => {
  const kids = el.childNodes;
  if (kids.length < 2 || SKIP.has(el.tagName)) return false;
  for (const c of kids) {
    if (c.nodeType === 3) continue;
    if (c.nodeType !== 1 || !INLINE.has((c as Element).tagName) || !c.firstChild) return false;
    for (const g of c.childNodes) if (g.nodeType !== 3) return false;
  }
  return /[A-Za-z]/.test(el.textContent ?? "");
};
const TAG = /<(\d+)>([\s\S]*?)<\/\1>/g;
/** "a <0>b</0> c" → ["a ", "b", " c"]: text, part 0, text, part 1, text… (null if parts are out of order) */
function pieces(s: string): string[] | null {
  const out: string[] = [];
  let last = 0;
  let n = 0;
  for (const m of s.matchAll(TAG)) {
    if (Number(m[1]) !== n++) return null;
    out.push(s.slice(last, m.index), m[2]);
    last = m.index! + m[0].length;
  }
  out.push(s.slice(last));
  return out;
}

export default function Translated({ children }: { children: ReactNode }) {
  const lang = useLang();
  const root = useRef<HTMLDivElement>(null);
  const langRef = useRef(lang);
  langRef.current = lang;

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const original = new WeakMap<Node, string>(); // English as React wrote it
    const shown = new WeakMap<Node, string>(); // what we put on screen
    const attrOriginal = new WeakMap<Element, Record<string, string>>();

    const skipped = (n: Node) => {
      const p = n.nodeType === 1 ? (n as Element) : n.parentElement;
      return !p || SKIP.has(p.tagName) || !!p.closest("[data-notranslate]");
    };
    // A search box's placeholder is translated; what people type never is.
    const attrSkipped = (e: Element) => !!e.closest("[data-notranslate]");
    const doText = (n: Text) => {
      if (skipped(n)) return;
      const v = n.nodeValue ?? "";
      if (shown.get(n) !== v) original.set(n, v); // React (not us) wrote this
      const out = translate(original.get(n) ?? v, langRef.current);
      shown.set(n, out);
      if (out !== v) n.nodeValue = out;
    };
    const doAttrs = (e: Element) => {
      if (attrSkipped(e)) return;
      const saved = attrOriginal.get(e) ?? {};
      for (const a of ATTRS) {
        const v = e.getAttribute(a);
        if (v == null) continue;
        const lastOut = saved[`_${a}`];
        if (lastOut !== v) saved[a] = v;
        const out = translate(saved[a], langRef.current);
        saved[`_${a}`] = out;
        if (out !== v) e.setAttribute(a, out);
      }
      attrOriginal.set(e, saved);
    };
    // The English React wrote in this text node (it may have just changed it).
    const english = (n: Text) => {
      const v = n.nodeValue ?? "";
      if (shown.get(n) !== v) original.set(n, v);
      return original.get(n) ?? v;
    };
    const put = (n: Text, out: string) => {
      shown.set(n, out);
      if (n.nodeValue !== out) n.nodeValue = out;
    };
    const doSentence = (s: Element) => {
      // Text, part 0, text, part 1, text…: each slot holds its text nodes.
      const slots: Text[][] = [[]];
      for (const c of s.childNodes) {
        if (c.nodeType === 3) slots[slots.length - 1].push(c as Text);
        else slots.push([...(c.childNodes as NodeListOf<Text>)], []);
      }
      const src = slots.map((nodes) => nodes.map(english).join(""));
      const raw = src.map((t, i) => (i % 2 ? `<${(i - 1) / 2}>${t}</${(i - 1) / 2}>` : t)).join("");
      const key = raw.replace(/\s+/g, " ").trim();
      const out = key && !skipped(s) ? translate(key, langRef.current) : key;
      const parts = out !== key ? pieces(out) : null;
      if (!parts || parts.length !== slots.length || parts.some((p, i) => p.trim() && !slots[i].length)) {
        // Not known as a whole: each piece on its own, as before.
        slots.flat().forEach(doText);
        return;
      }
      const lead = /^\s*/.exec(raw)![0];
      const trail = /\s*$/.exec(raw)![0];
      slots.forEach((nodes, i) => {
        const text = (i === 0 ? lead : "") + parts[i] + (i === slots.length - 1 ? trail : "");
        nodes.forEach((n, j) => put(n, j === 0 ? text : ""));
      });
    };
    // The sentence a changed node belongs to (itself, or the element around it).
    const sentenceOf = (n: Node | null) => {
      for (let e = n?.nodeType === 1 ? (n as Element) : n?.parentElement, k = 0; e && k < 2; e = e.parentElement, k++) {
        if (e !== el && isSentence(e)) return e;
      }
      return null;
    };
    const walk = (n: Node) => {
      if (n.nodeType === 3) return doText(n as Text);
      if (n.nodeType !== 1) return;
      doAttrs(n as Element);
      if (isSentence(n as Element)) {
        for (const c of n.childNodes) if (c.nodeType === 1) doAttrs(c as Element);
        return doSentence(n as Element);
      }
      for (let c = n.firstChild; c; c = c.nextSibling) walk(c);
    };

    walk(el);
    syncPushLang();
    const obs = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === "attributes") { doAttrs(r.target as Element); continue; }
        const s = sentenceOf(r.target);
        if (s) doSentence(s);
        else if (r.type === "characterData") doText(r.target as Text);
        else r.addedNodes.forEach(walk);
      }
    });
    obs.observe(el, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });
    (el as any).__retranslate = () => walk(el);
    return () => obs.disconnect();
  }, []);

  // Language changed: redraw everything from the remembered English.
  useEffect(() => {
    (root.current as any)?.__retranslate?.();
  }, [lang]);

  return <div ref={root} className="contents">{children}</div>;
}
