import { useState } from "react";
import QRCode from "qrcode";
import { Users } from "lucide-react";
import { apiFetch } from "../lib/apiFetch";

// "Add a friend": shows a QR on this guest's phone. A friend sitting next to
// them scans it and joins this bill. It's the only way onto someone's bill,
// so a stranger (or a photo of the table sticker) can never land on it.

export default function AddFriendButton({ tabId, className = "" }: { tabId: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const show = async () => {
    setOpen(true);
    setError("");
    try {
      const r = await apiFetch(`/tabs/${tabId}/join-code`, { method: "POST" });
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      const link = `${window.location.origin}/t/${d.data.qrCode}?join=${d.data.code}`;
      setCode(d.data.code);
      setQr(await QRCode.toDataURL(link, { margin: 1, width: 440, color: { dark: "#231A2C", light: "#FFFFFF" } }));
    } catch (e: any) {
      setError(e?.message || "Couldn't make the code. Try again.");
    }
  };

  return (
    <>
      <button
        onClick={show}
        className={`flex items-center justify-center gap-2 rounded-2xl border-2 border-gray-200 py-3 text-sm font-extrabold text-gray-800 dark:border-gray-700 dark:text-gray-100 ${className}`}
      >
        <Users size={16} /> Add a friend to this bill
      </button>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-friend-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-white p-6 text-gray-900 dark:bg-[#3B2149] dark:text-white"
          >
            <p className="text-xs font-black uppercase tracking-widest text-brand-500 dark:text-[#F2B33A]">Add a friend</p>
            <h2 id="add-friend-title" className="mt-1 text-xl font-black">Let your friend scan this</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">They open their camera and scan it. They'll order on this same bill.</p>
            <div className="mt-4 flex items-center justify-center rounded-2xl bg-white p-3 ring-1 ring-gray-200">
              {qr ? (
                <img src={qr} alt="Code to join this bill" className="h-56 w-56 max-w-full" />
              ) : error ? (
                <p className="py-10 text-center text-sm font-semibold text-red-600">{error}</p>
              ) : (
                <div className="h-56 w-56 animate-pulse rounded-xl bg-gray-100" />
              )}
            </div>
            {code && <p className="mt-2 text-center text-xs text-gray-400">Code {code}</p>}
            <button onClick={() => setOpen(false)} className="mt-4 w-full rounded-2xl bg-gray-900 py-3.5 text-base font-extrabold text-white dark:bg-white dark:text-gray-900">
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}
