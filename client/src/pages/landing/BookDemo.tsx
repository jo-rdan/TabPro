import { useEffect, useState, FormEvent } from "react";
import { X, Check, ArrowRight } from "lucide-react";
import { apiFetch } from "../../lib/apiFetch";

const OPEN_EVENT = "tabpro:book-demo";

// Any "Get started" button on the homepage calls this.
export function openBookDemo() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

const TIMES = ["Morning", "Afternoon", "Evening"];

export default function BookDemo({ whatsapp }: { whatsapp: string }) {
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
    "w-full rounded-2xl bg-white/[0.06] px-4 py-3.5 text-[15px] text-white placeholder-white/35 ring-1 ring-white/10 outline-none transition focus:bg-white/[0.09] focus:ring-2 focus:ring-emerald-400";

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="book-demo-title">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-md overflow-hidden rounded-t-[2rem] bg-[#06140f] px-6 pb-8 pt-7 ring-1 ring-white/10 sm:rounded-[2rem] sm:px-8">
        <div className="lp-aurora pointer-events-none absolute -top-40 left-1/2 h-[380px] w-[600px] -translate-x-1/2 opacity-60" />
        <button onClick={() => setOpen(false)} aria-label="Close" className="absolute right-4 top-4 rounded-full p-2 text-white/50 transition hover:bg-white/10 hover:text-white">
          <X size={18} />
        </button>

        {sent ? (
          <div className="relative py-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-400 text-emerald-950">
              <Check size={26} strokeWidth={3} />
            </div>
            <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-white">Thanks, {form.name.split(" ")[0]}!</h2>
            <p className="mx-auto mt-2 max-w-xs text-[15px] leading-relaxed text-white/60">
              We'll call you within a day to show TabPro at {form.venueName}. Setup is free.
            </p>
            <button onClick={() => setOpen(false)} className="mt-7 rounded-full bg-white/10 px-6 py-3 text-[14px] font-semibold text-white transition hover:bg-white/15">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="relative">
            <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-emerald-300">Free demo · 20 minutes</p>
            <h2 id="book-demo-title" className="mt-2 text-[28px] font-extrabold leading-tight tracking-tight text-white">
              See TabPro at your venue
            </h2>
            <p className="mt-2 text-[14.5px] text-white/55">We come to you, show it on your own phone, and set everything up for free.</p>

            <div className="mt-6 space-y-3">
              <input id="bd-name" required autoComplete="name" placeholder="Your name" value={form.name} onChange={set("name")} className={input} />
              <input id="bd-venue" required placeholder="Venue name" value={form.venueName} onChange={set("venueName")} className={input} />
              <input id="bd-phone" required type="tel" autoComplete="tel" placeholder="Phone (WhatsApp)" value={form.phone} onChange={set("phone")} className={input} />
              <input id="bd-area" placeholder="Area, e.g. Kimihurura (optional)" value={form.area} onChange={set("area")} className={input} />
              <div>
                <p className="mb-2 mt-1 text-[13px] font-medium text-white/50">Best time to call</p>
                <div className="grid grid-cols-3 gap-2">
                  {TIMES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm({ ...form, bestTime: t })}
                      className={`rounded-xl py-2.5 text-[13px] font-semibold transition ${
                        form.bestTime === t ? "bg-emerald-400 text-emerald-950" : "bg-white/[0.06] text-white/70 ring-1 ring-white/10 hover:bg-white/10"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {error && <p className="mt-4 text-[13px] text-red-300">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="lp-shine group relative mt-6 inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-emerald-400 px-7 py-4 text-[15px] font-bold text-emerald-950 transition hover:bg-emerald-300 disabled:opacity-60"
            >
              {busy ? "Sending…" : "Book my free demo"}
              {!busy && <ArrowRight size={17} className="transition group-hover:translate-x-1" />}
            </button>
            <p className="mt-4 text-center text-[13px] text-white/40">
              Prefer to chat?{" "}
              <a href={whatsapp} target="_blank" rel="noreferrer" className="font-semibold text-white/70 underline decoration-white/30 underline-offset-4 hover:text-white">
                WhatsApp us
              </a>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
