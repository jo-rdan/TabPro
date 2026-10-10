import { useEffect, useState, FormEvent } from "react";
import { apiFetch } from "../lib/apiFetch";

// Owners' launch waitlist (linked from Skuzi's Instagram bio). Self-contained
// in the Skuzi look so it works on the live site before the rebrand ships.
const TYPES = ["Restaurant", "Bar", "Lounge", "Hotel", "Other"];

const HAND = (
  <svg viewBox="8 4 90 92" width="30" height="30" aria-hidden="true">
    <g transform="translate(48 56) rotate(-14) translate(-50 -54)" fill="none" stroke="#D9A441" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M37 55V27a5.5 5.5 0 0 1 11 0v21" /><path d="M48 46V20a5.5 5.5 0 0 1 11 0v26" /><path d="M59 46V24a5.5 5.5 0 0 1 11 0v24" />
      <path d="M70 50V34a5 5 0 0 1 10 0v24c0 18-11 30-28 30h-3c-10 0-16-4-21-10l-12-15a5.5 5.5 0 0 1 8-7.5l10 9" />
    </g>
    <g fill="none" stroke="#D9A441" strokeWidth="6" strokeLinecap="round"><path d="M77 19q6 5 7 13" /><path d="M82 10q10 7 11 21" opacity=".5" /></g>
  </svg>
);

export default function Waitlist() {
  const [form, setForm] = useState({ name: "", venueName: "", phone: "", area: "", venueType: "Restaurant" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [position, setPosition] = useState<number | null>(null);

  useEffect(() => {
    document.title = "Skuzi · Owners' waitlist";
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Figtree:wght@400;500;600;700;800&display=swap";
    document.head.appendChild(link);
    return () => { link.remove(); };
  }, []);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await apiFetch("/demo-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, source: "waitlist" }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setPosition(data.data?.position ?? 0);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again, or WhatsApp us.");
    } finally {
      setBusy(false);
    }
  };

  const input = "w-full rounded-2xl bg-[#F4EDE3] px-4 py-3.5 text-[15px] text-[#2B201B] placeholder-[#A39282] outline-none ring-1 ring-[#E3D6C6] transition focus:ring-2 focus:ring-[#A64B31]";

  return (
    <div className="min-h-screen bg-[#1C1511] text-[#F4EDE3]" style={{ fontFamily: "Figtree, system-ui, sans-serif" }}>
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[520px]" style={{ background: "radial-gradient(closest-side at 50% 10%, rgba(166,75,49,.5), transparent 70%), radial-gradient(closest-side at 75% 25%, rgba(217,164,65,.22), transparent 70%)" }} />
      <div className="relative mx-auto max-w-md px-5 pb-16 pt-10">
        <div className="flex items-center gap-2">
          {HAND}
          <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: "-0.045em" }} className="text-[28px] font-bold leading-none">skuzi</span>
        </div>

        {position === null ? (
          <>
            <p className="mt-10 text-[12px] font-extrabold uppercase tracking-[0.16em] text-[#D9A441]">For restaurant &amp; bar owners</p>
            <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: "-0.035em" }} className="mt-3 text-[40px] font-extrabold leading-[1.02]">
              Be one of the first venues on <span className="text-[#D9A441]">Skuzi.</span>
            </h1>
            <p className="mt-4 text-[16px] leading-relaxed text-[#D8CBBF]">Guests order, call their waiter and pay with MoMo from their table. You see every table and every franc, live.</p>
            <ul className="mt-5 space-y-2 text-[15px] text-[#F4EDE3]">
              {["Less waiting, more rounds ordered", "Your 92% of MoMo bills, in seconds", "Free setup. No machine. No monthly fee."].map((t) => (
                <li key={t} className="flex gap-2.5"><span className="text-[#D9A441]">✓</span>{t}</li>
              ))}
            </ul>

            <form onSubmit={submit} className="mt-8 rounded-[28px] bg-[#FFFCF7] p-5 text-[#2B201B] shadow-2xl sm:p-6">
              <p style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }} className="text-[20px] font-bold">Join the waitlist</p>
              <p className="mt-1 text-[13.5px] text-[#7A6A5F]">We'll WhatsApp you before launch. No commitment.</p>
              <div className="mt-5 space-y-3">
                <input required autoComplete="name" placeholder="Your name" value={form.name} onChange={set("name")} className={input} />
                <input required placeholder="Venue name" value={form.venueName} onChange={set("venueName")} className={input} />
                <input required type="tel" autoComplete="tel" placeholder="WhatsApp number" value={form.phone} onChange={set("phone")} className={input} />
                <input placeholder="Area, e.g. Kimihurura (optional)" value={form.area} onChange={set("area")} className={input} />
                <div>
                  <p className="mb-2 mt-1 text-[13px] font-semibold text-[#7A6A5F]">Your place is a…</p>
                  <div className="flex flex-wrap gap-2">
                    {TYPES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setForm({ ...form, venueType: t })}
                        className={`rounded-full px-4 py-2 text-[13.5px] font-semibold transition ${form.venueType === t ? "bg-[#D9A441] text-[#2B201B]" : "bg-[#F4EDE3] text-[#5C4D44] ring-1 ring-[#E3D6C6]"}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {error && <p className="mt-4 text-[13.5px] font-semibold text-[#A64B31]">{error}</p>}
              <button type="submit" disabled={busy} className="mt-6 w-full rounded-full bg-[#A64B31] py-4 text-[16px] font-extrabold text-[#F4EDE3] transition hover:bg-[#933F28] disabled:opacity-60">
                {busy ? "Joining…" : "Join the waitlist"}
              </button>
            </form>
            <p className="mt-6 text-center text-[13px] text-[#A39282]">Questions? WhatsApp <a className="font-bold text-[#D9A441]" href="https://wa.me/250781268924">+250 781 268 924</a></p>
          </>
        ) : (
          <div className="mt-16 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#5E7A55] text-[30px] font-bold">✓</div>
            <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: "-0.035em" }} className="mt-6 text-[36px] font-extrabold leading-tight">
              You're on the list{form.name ? `, ${form.name.split(" ")[0]}` : ""}!
            </h1>
            {position > 0 && <p className="mt-3 text-[18px] font-bold text-[#D9A441]">Owner #{position} on the Skuzi waitlist</p>}
            <p className="mx-auto mt-4 max-w-xs text-[15.5px] leading-relaxed text-[#D8CBBF]">
              We'll WhatsApp you before launch to set up {form.venueName || "your place"}, free.
            </p>
            <p className="mt-10 text-[13px] text-[#A39282]">Skuzi! Another round. · a product of VNT250 Ltd, Rwanda</p>
          </div>
        )}
      </div>
    </div>
  );
}
