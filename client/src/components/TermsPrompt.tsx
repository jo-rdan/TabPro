import { useState } from "react";
import { useAuthStore } from "../lib/auth";
import api from "../lib/api";
import { TermsSummary, AgreeBox } from "./VenueTermsAgree";

// Owners who joined before the in-app terms (or before a change to them) agree
// once, here. It can't be skipped: nothing changes in how Skuzi works, but we
// need their OK in writing.
export default function TermsPrompt() {
  const { venues, currentTermsVersion, fetchMe } = useAuthStore();
  const venue = venues[0];
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!venue || !currentTermsVersion || (venue.termsVersion ?? 0) >= currentTermsVersion) return null;
  const isUpdate = (venue.termsVersion ?? 0) > 0;

  const agree = async () => {
    setSaving(true);
    setError("");
    try {
      await api.post(`/venues/${venue.id}/terms`, { version: currentTermsVersion });
      await fetchMe();
    } catch (err: any) {
      setError(err?.response?.data?.error || "Couldn't save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="terms-prompt-title">
      <div className="absolute inset-0 bg-[#1C1511]/60 backdrop-blur-sm" />
      <div className="night-pop relative w-full sm:max-w-md bg-white dark:bg-[#2B201B] rounded-t-[28px] sm:rounded-[28px] border border-gray-200 dark:border-gray-800 px-5 pt-6 pb-6 shadow-2xl max-h-[92vh] overflow-y-auto">
        <p className="text-[11.5px] font-bold uppercase tracking-[0.16em] text-brand-600 dark:text-brand-300">{isUpdate ? "Our terms changed" : "One quick thing"}</p>
        <h2 id="terms-prompt-title" className="mt-1 font-display text-2xl font-bold text-gray-900 dark:text-white">Our terms, in writing</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {isUpdate ? "Please read what's new and agree to keep using Skuzi." : "Nothing changes in how Skuzi works for you. We just need your OK, once."}
        </p>
        <div className="mt-4"><TermsSummary compact /></div>
        <AgreeBox checked={checked} onChange={setChecked} />
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        <button
          onClick={agree}
          disabled={!checked || saving}
          className="mt-4 w-full rounded-xl bg-brand-500 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-600 disabled:bg-gray-200 disabled:text-gray-400 dark:disabled:bg-gray-800 dark:disabled:text-gray-500"
        >
          {saving ? "Saving…" : "Agree and continue"}
        </button>
      </div>
    </div>
  );
}
