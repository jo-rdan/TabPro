import { useState } from "react";
import { Check, Smartphone, Video, Wallet } from "lucide-react";
import GuestShell, { Hand } from "../../components/guest/GuestShell";
import { guestApi, apiError } from "../../lib/guest";

// "Become a Skuzi creator": the sign-up page creators get from a DM.
// They earn 500 RWF per new person who pays with Skuzi using their code.
export default function CreatorJoin() {
  const [form, setForm] = useState({ name: "", handle: "", phone: "", wantedCode: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: k === "wantedCode" ? e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") : e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.name.trim().length < 2) return setError("Please enter your name");
    if (form.phone.replace(/\D/g, "").length < 9) return setError("Please enter your MoMo number");
    setBusy(true); setError("");
    try {
      await guestApi.post("/creators/apply", { name: form.name.trim(), handle: form.handle.trim() || null, phone: form.phone.trim(), wantedCode: form.wantedCode || null });
      setDone(true);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  const field = "h-12 w-full rounded-2xl border-[1.5px] border-gray-200 bg-white px-4 text-[15px] font-semibold text-gray-900 outline-none placeholder:font-medium placeholder:text-gray-400 focus:border-brand-500 dark:border-[#3A2D26] dark:bg-[#1C1511] dark:text-[#F4EDE3]";
  const label = "text-xs font-extrabold uppercase tracking-[0.08em] text-brand-700 dark:text-[#D9A441]";

  return (
    <GuestShell>
      <div className="grid gap-8 pt-6 md:grid-cols-[1.1fr_1fr] md:items-start md:pt-10">
        <section>
          <p className={label}>Skuzi Creators</p>
          <h1 className="mt-2 font-display text-[38px] font-extrabold leading-[1.02] tracking-[-0.03em] md:text-[56px]">
            Earn <span className="text-brand-500 dark:text-[#D9A441]">500 RWF</span> for every person you bring.
          </h1>
          <p className="mt-3 max-w-md text-[16px] leading-relaxed text-gray-600 dark:text-gray-300">
            You already film where you eat and go out. Now every follower who pays with Skuzi using your code pays you.
          </p>

          <ol className="mt-7 flex flex-col gap-3">
            {[
              { Icon: Check, title: "Get your code", text: "Sign up here. Once approved, you get your own code, like ALINE." },
              { Icon: Video, title: "Film at a Skuzi restaurant", text: "Order and pay with Skuzi on camera. Say your code, tag @skuzi." },
              { Icon: Smartphone, title: "Followers pay with Skuzi + your code", text: "Each new person who does it earns you money." },
              { Icon: Wallet, title: "Paid to your MoMo, every month", text: "On the 1st, for everything the month before." },
            ].map(({ Icon, title, text }, i) => (
              <li key={title} className="flex gap-3.5">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[#2B201B] text-[#D9A441]"><Icon size={18} /></span>
                <div>
                  <p className="font-bold"><span className="mr-1.5 text-brand-500 dark:text-[#D9A441]">{i + 1}.</span>{title}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{text}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-7 overflow-hidden rounded-[22px] bg-[#2B201B] text-[#F4EDE3]">
            <div className="grid grid-cols-2 divide-x divide-white/10">
              <div className="p-4"><p className="text-xs text-[#D8CBBF]">Bill of 6,500 RWF or more</p><p className="font-display text-2xl font-extrabold text-[#D9A441]">500 RWF</p></div>
              <div className="p-4"><p className="text-xs text-[#D8CBBF]">Smaller bill</p><p className="font-display text-2xl font-extrabold">1.5%</p></div>
            </div>
            <p className="border-t border-white/10 px-4 py-3 text-sm text-[#D8CBBF]">100 people bring you <b className="text-[#F4EDE3]">50,000 RWF</b>. No limit.</p>
          </div>
        </section>

        <section className="rounded-[26px] border-[1.5px] border-gray-200 bg-white p-5 dark:border-[#3A2D26] dark:bg-[#2B201B] md:sticky md:top-6 md:p-7">
          {done ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <Hand className="h-14 w-14" />
              <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em]">You're on the list!</h2>
              <p className="max-w-xs text-[15px] text-gray-600 dark:text-gray-300">We'll WhatsApp you as soon as you're approved, with your code and your earnings page.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
              <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em]">Become a Skuzi creator</h2>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="cr-name" className={label}>Your name</label>
                <input id="cr-name" className={field} value={form.name} onChange={set("name")} autoComplete="name" maxLength={60} placeholder="Aline Uwase" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="cr-handle" className={label}>TikTok or Instagram</label>
                <input id="cr-handle" className={field} value={form.handle} onChange={set("handle")} maxLength={60} placeholder="@aline.eats" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="cr-phone" className={label}>MoMo number (for your payouts)</label>
                <input id="cr-phone" className={field} value={form.phone} onChange={set("phone")} type="tel" inputMode="tel" autoComplete="tel" maxLength={20} placeholder="0788 123 456" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="cr-code" className={label}>The code you'd like</label>
                <input id="cr-code" className={`${field} uppercase tracking-wider`} value={form.wantedCode} onChange={set("wantedCode")} maxLength={16} placeholder="ALINE" />
              </div>
              {error && <p role="alert" className="rounded-2xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-200">{error}</p>}
              <button type="submit" disabled={busy} className="min-h-[54px] rounded-full bg-brand-500 text-base font-extrabold text-white hover:bg-brand-600 disabled:opacity-50">
                {busy ? "Sending…" : "Sign me up"}
              </button>
              <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                Counts: people new to Skuzi who pay their bill with Skuzi and type your code. Your own number doesn't count. Paid on the 1st of each month once you've earned 5,000 RWF; smaller amounts roll over.
              </p>
            </form>
          )}
        </section>
      </div>
    </GuestShell>
  );
}
