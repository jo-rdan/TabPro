import { useEffect } from "react";
import { Printer } from "lucide-react";
import Wordmark from "../components/Wordmark";
import { useAuthStore } from "../lib/auth";
import { TERMS_CLAUSES, TERMS_DATE } from "../lib/venueTerms";

// The full Skuzi venue terms. Public, so anyone can read them before agreeing.
// A signed-in owner who agreed sees who agreed and when at the bottom.
export default function VenueTerms() {
  const { token, venues, owner, fetchMe } = useAuthStore();
  useEffect(() => {
    if (token && !owner) fetchMe();
  }, []);
  const venue = venues[0];
  const agreed = venue?.termsVersion && venue.termsAcceptedAt ? venue : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#1C1511] px-4 py-8 sm:py-12 print:bg-white print:p-0">
      <div className="mx-auto max-w-2xl overflow-hidden rounded-[28px] bg-white dark:bg-[#2B201B] border border-gray-200 dark:border-gray-800 shadow-sm print:border-0 print:shadow-none print:rounded-none">
        <div className="relative bg-[#2B201B] dark:bg-[#1C1511] px-6 pb-7 pt-6 text-[#F4EDE3] sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <Wordmark size={22} on="dark" />
            <button onClick={() => window.print()} className="print:hidden inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-[#F4EDE3] hover:bg-white/15">
              <Printer size={13} /> Print / save PDF
            </button>
          </div>
          <h1 className="mt-5 font-display text-3xl font-bold tracking-tight">Venue terms</h1>
          <p className="mt-1 text-sm text-[#D8CBBF]">Version 1 · {TERMS_DATE} · between VNT250 Ltd (TIN 156430843), which runs Skuzi, and your venue</p>
          <svg width="100%" height="8" aria-hidden="true" className="absolute bottom-0 left-0">
            <defs><pattern id="imi-terms" width="14" height="8" patternUnits="userSpaceOnUse"><path d="M0 8L7 0L14 8Z" fill="#A64B31" /></pattern></defs>
            <rect width="100%" height="8" fill="url(#imi-terms)" />
          </svg>
        </div>

        <div className="px-6 py-6 sm:px-8">
          <div className="flex flex-col gap-2 rounded-2xl bg-gray-100 dark:bg-[#231A16] px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4">
            <span className="font-display text-3xl font-bold text-brand-500 whitespace-nowrap">92 / 8</span>
            <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
              When a guest pays a bill through Skuzi by Mobile Money, your venue receives <b className="text-gray-900 dark:text-white">92%</b> on its MoMo straight away and Skuzi keeps <b className="text-gray-900 dark:text-white">8%</b>. Cash and other payments cost nothing. There is no monthly fee.
            </p>
          </div>

          <ol className="mt-6 space-y-4">
            {TERMS_CLAUSES.map((c, i) => (
              <li key={c.title} className="break-inside-avoid">
                <h2 className="text-[15px] font-bold text-gray-900 dark:text-white" style={{ fontFamily: "Figtree, sans-serif", letterSpacing: 0 }}>
                  <span className="mr-2 text-brand-500">{i + 1}</span>{c.title}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{c.text}</p>
              </li>
            ))}
          </ol>

          <div className="mt-7 border-t border-gray-200 dark:border-gray-800 pt-4 text-sm text-gray-600 dark:text-gray-400">
            {agreed ? (
              <p className="flex flex-wrap items-center justify-between gap-2">
                <span>Agreed by <b className="text-gray-900 dark:text-white">{agreed.termsAcceptedBy}</b> for <b className="text-gray-900 dark:text-white">{agreed.name}</b></span>
                <span className="font-semibold text-green-700 dark:text-green-400">
                  ✓ {new Date(agreed.termsAcceptedAt!).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} · version {agreed.termsVersion}
                </span>
              </p>
            ) : (
              <p>Owners agree to these terms in the Skuzi app by ticking "I agree" when they set up their venue.</p>
            )}
          </div>
        </div>
      </div>
      <p className="mt-6 text-center text-xs text-gray-400 print:hidden">Skuzi is a product of VNT250 Ltd, a company registered in Rwanda.</p>
    </div>
  );
}
