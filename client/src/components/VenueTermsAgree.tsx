import { Link } from "react-router-dom";
import { TERMS_SUMMARY } from "../lib/venueTerms";

// "How Skuzi works with you" + the "I agree" box. Used when a venue is set up
// and in the one-time prompt for owners who joined before.
export function TermsSummary({ compact = false }: { compact?: boolean }) {
  return (
    <div className="rounded-2xl bg-gray-100 dark:bg-[#231A16] p-4">
      {!compact && <h3 className="font-display text-[15px] font-bold text-gray-900 dark:text-white mb-1">How Skuzi works with you</h3>}
      {TERMS_SUMMARY.map((p) => (
        <div key={p.title} className="mt-2.5 flex items-start gap-2.5 text-[13.5px] leading-snug text-gray-700 dark:text-gray-300">
          <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-[13px]" style={{ background: p.tint }} aria-hidden>{p.icon}</span>
          <span><b className="text-gray-900 dark:text-white">{p.title}</b> {p.text}</span>
        </div>
      ))}
    </div>
  );
}

export function AgreeBox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={`mt-3 flex items-start gap-2.5 rounded-xl border-[1.5px] px-3 py-3 text-[13.5px] leading-snug cursor-pointer transition-colors ${checked ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20" : "border-gray-300 dark:border-gray-700"}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] flex-shrink-0 accent-[#A64B31]" />
      <span className="text-gray-800 dark:text-gray-200">
        I agree to the{" "}
        <Link to="/venue-terms" target="_blank" className="font-bold text-brand-600 dark:text-brand-300 underline underline-offset-2">
          Skuzi venue terms
        </Link>
      </span>
    </label>
  );
}
