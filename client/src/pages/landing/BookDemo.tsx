import { useEffect, useState, FormEvent } from "react";
import { X, Check, ArrowRight } from "lucide-react";
import { apiFetch } from "../../lib/apiFetch";
import { WAITLIST_MODE } from "../../lib/waitlistMode";

const OPEN_EVENT = "tabpro:book-demo";

// Any "Get started" button on the homepage calls this.
export function openBookDemo() {
  if (WAITLIST_MODE) { window.location.assign("/waitlist"); return; }
  window.dispatchEvent(new Event(OPEN_EVENT));
}

const TIMES = ["Morning", "Afternoon", "Evening"];

export default function BookDemo() {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", venueName: "", phone: "", area: "", bestTime: "Afternoon" });

  useEffect(() => {
    const onOpen = () => { setOpen(true); setError(""); };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await apiFetch("/demo-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setSent(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const input =
    "w-full rounded-2xl bg-[var(--bg)] px-4 py-3.5 text-[15px] text-[var(--ink)] placeholder-[var(--muted)] ring-1 ring-[var(--line)] outline-none transition focus:ring-2 focus:ring-[#A64B31]";

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="book-demo-title">
      <div className="absolute inset-0 bg-[#1C1511]/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-md overflow-hidden rounded-t-[2rem] bg-[var(--card)] px-6 pb-8 pt-7 text-[var(--ink)] ring-1 ring-[var(--line)] sm:rounded-[2rem] sm:px-8">
        <button onClick={() => setOpen(false)} aria-label="Close" className="absolute right-4 top-4 rounded-full p-2 text-[var(--muted)] transition hover:bg-[var(--bg)] hover:text-[var(--ink)]">
          <X size={18} />
        </button>

        {sent ? (
          <div className="relative py-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#5E7A55] text-[#F4EDE3]">
              <Check size={26} strokeWidth={3} />
            </div>
            <h2 className="mt-5 text-2xl font-extrabold tracking-tight">Thanks, {form.name.split(" ")[0]}!</h2>
            <p className="mx-auto mt-2 max-w-xs text-[15px] leading-relaxed text-[var(--body)]">
              We'll call you within a day to show Skuzi at {form.venueName}. Setup is free.
            </p>
            <button onClick={() => setOpen(false)} className="mt-7 rounded-full bg-[var(--ink)] px-6 py-3 text-[14px] font-bold text-[var(--bg)] transition hover:opacity-90">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="relative">
            <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--rust-ink)]">Free demo · 20 minutes</p>
            <h2 id="book-demo-title" className="mt-2 text-[28px] font-extrabold leading-tight tracking-tight">
              See Skuzi at your venue
            </h2>
            <p className="mt-2 text-[14.5px] text-[var(--body)]">We come to you, show it on your own phone, and set everything up for free.</p>

            <div className="mt-6 space-y-3">
              <input id="bd-name" required autoComplete="name" placeholder="Your name" value={form.name} onChange={set("name")} className={input} />
              <input id="bd-venue" required placeholder="Venue name" value={form.venueName} onChange={set("venueName")} className={input} />
              <input id="bd-phone" required type="tel" autoComplete="tel" placeholder="Phone (WhatsApp)" value={form.phone} onChange={set("phone")} className={input} />
              <input id="bd-area" placeholder="Area, e.g. Kimihurura (optional)" value={form.area} onChange={set("area")} className={input} />
              <div>
                <p className="mb-2 mt-1 text-[13px] font-medium text-[var(--muted)]">Best time to call</p>
                <div className="grid grid-cols-3 gap-2">
                  {TIMES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm({ ...form, bestTime: t })}
                      className={`rounded-xl py-2.5 text-[13px] font-semibold transition ${
                        form.bestTime === t ? "bg-[#D9A441] text-[#2B201B]" : "bg-[var(--bg)] text-[var(--body)] ring-1 ring-[var(--line)] hover:ring-[var(--muted)]"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {error && <p className="mt-4 text-[13px] font-semibold text-[#A64B31] dark:text-[#DCA088]">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="group relative mt-6 inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-[#A64B31] px-7 py-4 text-[15px] font-bold text-[#F4EDE3] transition hover:bg-[#933F28] disabled:opacity-60"
            >
              {busy ? "Sending…" : "Book my free demo"}
              {!busy && <ArrowRight size={17} className="transition group-hover:translate-x-1" />}
            </button>
            <p className="mt-4 text-center text-[13px] text-[var(--muted)]">No commitment · Setup and training are free</p>
          </form>
        )}
      </div>
    </div>
  );
}
