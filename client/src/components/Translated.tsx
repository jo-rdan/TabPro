import { useEffect, useRef, type ReactNode } from "react";
import { translate, useLang } from "../lib/i18n";

// Shows its children in the chosen language: every text node and the
// placeholder / aria-label / title attributes under it go through translate()
// as React draws or updates them. The English original is remembered, so
// switching language back and forth always starts from English. Anything inside
// [data-notranslate] (dish names, venue names, what people typed) is left alone.

const ATTRS = ["placeholder", "aria-label", "title"] as const;
const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "CODE"]);

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
    const walk = (n: Node) => {
      if (n.nodeType === 3) return doText(n as Text);
      if (n.nodeType !== 1) return;
      doAttrs(n as Element);
      for (let c = n.firstChild; c; c = c.nextSibling) walk(c);
    };

    walk(el);
    const obs = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === "characterData") doText(r.target as Text);
        else if (r.type === "attributes") doAttrs(r.target as Element);
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
