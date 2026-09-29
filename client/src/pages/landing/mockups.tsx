// Illustrative product UI used on the landing page. Pure presentation — no data.
import { useEffect, useState, ReactNode } from "react";
import { Bell, Check, Plus, Search, Camera, ArrowRight, Hand, Receipt, Loader2, Star } from "lucide-react";

const fmt = (n: number) => n.toLocaleString("en-US");

export function PhoneFrame({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative rounded-[2.9rem] bg-[#0b0f0d] p-[10px] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.55)] ring-1 ring-white/10 ${className}`}>
      <div className="absolute left-1/2 top-[10px] z-20 h-[26px] w-[110px] -translate-x-1/2 rounded-b-[18px] bg-[#0b0f0d]" />
      <div className="relative h-full overflow-hidden rounded-[2.35rem] bg-[#f5f6f4]">{children}</div>
    </div>
  );
}

function VenueHeader({ table = "Table 4" }: { table?: string }) {
  return (
    <div className="flex items-center gap-2.5 bg-white px-4 pb-3 pt-9">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-[11px] font-extrabold text-white">YB</span>
      <div className="min-w-0">
        <p className="text-[13px] font-extrabold leading-tight text-gray-900">Your Bar</p>
        <p className="text-[10px] font-medium text-gray-400">{table} · open tab</p>
      </div>
    </div>
  );
}

// ─── Customer journey screens (used by the product tour) ─────────────────────

export function ScreenScan() {
  return (
    <div className="relative flex h-full flex-col items-center justify-center bg-[#0d1512]">
      <div className="absolute inset-0 opacity-40" style={{ background: "radial-gradient(circle at 50% 45%, #1d9e75 0%, transparent 60%)" }} />
      <div className="relative h-44 w-44">
        {["left-0 top-0 border-l-4 border-t-4 rounded-tl-2xl", "right-0 top-0 border-r-4 border-t-4 rounded-tr-2xl", "left-0 bottom-0 border-l-4 border-b-4 rounded-bl-2xl", "right-0 bottom-0 border-r-4 border-b-4 rounded-br-2xl"].map((c) => (
          <span key={c} className={`absolute h-10 w-10 border-emerald-300 ${c}`} />
        ))}
        <div className="absolute inset-5 grid grid-cols-7 gap-[3px] opacity-90">
          {Array.from({ length: 49 }).map((_, i) => (
            <span key={i} className={`rounded-[2px] ${[0, 1, 2, 7, 9, 14, 15, 16, 4, 5, 6, 11, 13, 18, 19, 20, 28, 29, 30, 35, 37, 42, 43, 44, 24, 26, 32, 40, 46, 22].includes(i) ? "bg-white" : "bg-white/10"}`} />
          ))}
        </div>
        <span className="lp-scanline absolute inset-x-3 h-0.5 rounded-full bg-emerald-300 shadow-[0_0_16px_4px_rgba(110,231,183,0.7)]" />
      </div>
      <p className="relative mt-8 text-[12px] font-semibold text-white/80">Point your camera at the table sticker</p>
      <p className="relative mt-1 text-[10px] text-white/40">No app needed</p>
    </div>
  );
}

const MENU = [
  { name: "Primus", cat: "Beers", price: 1500, emoji: "🍺", qty: 2 },
  { name: "Brochette", cat: "Grill", price: 3000, emoji: "🍢", qty: 1 },
  { name: "Fanta Citron", cat: "Soft drinks", price: 800, emoji: "🥤", qty: 0 },
  { name: "Chips Mayai", cat: "Kitchen", price: 2500, emoji: "🍳", qty: 0 },
];

export function ScreenMenu() {
  return (
    <div className="flex h-full flex-col">
      <VenueHeader />
      <div className="bg-white px-4 pb-3">
        <div className="flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-2 text-[11px] text-gray-400">
          <Search size={12} /> Search menu…
        </div>
        <div className="mt-2.5 flex gap-1.5">
          {["Beers", "Grill", "Soft drinks", "Kitchen"].map((c, i) => (
            <span key={c} className={`rounded-full px-2.5 py-1 text-[9.5px] font-bold ${i === 0 ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500"}`}>{c}</span>
          ))}
        </div>
      </div>
      <div className="flex-1 space-y-2 px-3 py-3">
        {MENU.map((m) => (
          <div key={m.name} className="flex items-center gap-3 rounded-2xl bg-white p-2.5 shadow-sm">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-xl">{m.emoji}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-bold text-gray-900">{m.name}</p>
              <p className="text-[11px] font-semibold text-emerald-600">{fmt(m.price)} RWF</p>
            </div>
            {m.qty ? (
              <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-gray-900 px-2 text-[11px] font-bold text-white">{m.qty}</span>
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white"><Plus size={14} /></span>
            )}
          </div>
        ))}
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between rounded-2xl bg-gray-900 px-4 py-3 text-white shadow-xl">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400 text-[10px] font-black text-gray-900">3</span>
          <span className="text-[12px] font-bold">Place order</span>
          <span className="text-[12px] font-bold">6,000 RWF</span>
        </div>
      </div>
    </div>
  );
}

export function ScreenCall() {
  return (
    <div className="flex h-full flex-col">
      <VenueHeader />
      <div className="flex-1 space-y-2.5 px-3 py-3">
        <p className="px-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Your orders</p>
        {[
          ["2 × Primus · Brochette", "Delivered", "bg-emerald-100 text-emerald-700"],
          ["1 × Fanta Citron", "Preparing", "bg-amber-100 text-amber-700"],
        ].map(([t, s, c]) => (
          <div key={t} className="flex items-center justify-between rounded-2xl bg-white p-3 shadow-sm">
            <span className="text-[11.5px] font-semibold text-gray-800">{t}</span>
            <span className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold ${c}`}>{s}</span>
          </div>
        ))}
        <div className="lp-toast mx-1 mt-4 flex items-center gap-2.5 rounded-2xl bg-gray-900 p-3 text-white shadow-xl">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-400/20"><Bell size={15} className="text-emerald-300" /></span>
          <div>
            <p className="text-[11.5px] font-bold">Alice is on her way</p>
            <p className="text-[10px] text-white/50">Your waiter was notified</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 p-3">
        <span className="flex items-center justify-center gap-1.5 rounded-2xl bg-white py-3 text-[11.5px] font-bold text-gray-900 shadow-sm ring-2 ring-emerald-400"><Hand size={14} /> Call waiter</span>
        <span className="flex items-center justify-center gap-1.5 rounded-2xl bg-gray-900 py-3 text-[11.5px] font-bold text-white"><Receipt size={14} /> Pay bill</span>
      </div>
    </div>
  );
}

export function ScreenPay() {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDone(true), 1600);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="flex h-full flex-col">
      <VenueHeader />
      <div className="mx-3 mt-3 rounded-2xl bg-white p-4 shadow-sm">
        {[["Primus", "2 × 1,500", "3,000"], ["Brochette", "1 × 3,000", "3,000"], ["Fanta Citron", "1 × 800", "800"]].map(([n, q, s]) => (
          <div key={n} className="flex justify-between py-1.5 text-[11.5px]">
            <span className="font-semibold text-gray-800">{n} <span className="font-normal text-gray-400">{q}</span></span>
            <span className="font-semibold text-gray-700">{s}</span>
          </div>
        ))}
        <div className="mt-2 flex items-end justify-between border-t border-dashed border-gray-200 pt-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total</span>
          <span className="text-[20px] font-black tracking-tight text-gray-900">6,800 <span className="text-[11px]">RWF</span></span>
        </div>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        {done ? (
          <div className="lp-pop flex flex-col items-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/40"><Check size={30} strokeWidth={3} /></span>
            <p className="mt-3 text-[14px] font-extrabold text-gray-900">Paid · 6,800 RWF</p>
            <p className="mt-1 text-[10.5px] text-gray-400">Thanks! Your tab is closed.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <Loader2 size={34} className="animate-spin text-emerald-500" />
            <p className="mt-3 text-[13px] font-extrabold text-gray-900">Approve on your phone</p>
            <p className="mt-1 text-[10.5px] text-gray-400">Enter your MoMo PIN to confirm</p>
          </div>
        )}
      </div>
      <div className="flex justify-center gap-1.5 pb-6">
        <span className="rounded-full bg-[#ffcb05] px-2.5 py-1 text-[9px] font-extrabold text-gray-900">MTN MoMo</span>
        <span className="rounded-full bg-[#e40000] px-2.5 py-1 text-[9px] font-extrabold text-white">Airtel Money</span>
      </div>
    </div>
  );
}

// ─── Owner dashboard mini-UIs (bento grid) ───────────────────────────────────

function useCountUp(target: number, run: boolean, ms = 1600) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, target, ms]);
  return v;
}

export function RevenueWidget({ active }: { active: boolean }) {
  const v = useCountUp(248500, active);
  const pts = [8, 12, 10, 18, 16, 26, 22, 34, 31, 44, 40, 56];
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${(i / (pts.length - 1)) * 300} ${70 - p}`).join(" ");
  return (
    <div>
      <p className="text-[12px] font-semibold text-gray-500">Revenue tonight</p>
      <p className="mt-1 text-4xl font-extrabold tracking-tight text-gray-900 tabular-nums">{fmt(v)} <span className="text-lg text-gray-400">RWF</span></p>
      <span className="mt-2 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">● Live</span>
      <svg viewBox="0 0 300 72" className="mt-4 h-24 w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="lp-rev" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#1D9E75" stopOpacity="0.35" />
            <stop offset="1" stopColor="#1D9E75" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${path} L 300 72 L 0 72 Z`} fill="url(#lp-rev)" />
        <path d={path} fill="none" stroke="#1D9E75" strokeWidth="2.5" strokeLinejoin="round" className={active ? "lp-draw" : ""} />
      </svg>
    </div>
  );
}

export function HeatmapWidget() {
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const lvl = (d: number, h: number) => {
    const weekend = d >= 4 ? 1.6 : 1;
    const evening = Math.exp(-Math.pow(h - 6, 2) / 5);
    return Math.min(1, evening * weekend * (0.55 + ((d * 7 + h * 3) % 5) / 10));
  };
  return (
    <div>
      <p className="text-[12px] font-semibold text-gray-500">Busy hours</p>
      <div className="mt-3 space-y-1.5">
        {days.map((d, di) => (
          <div key={di} className="flex items-center gap-1.5">
            <span className="w-3 text-[9.5px] font-bold text-gray-400">{d}</span>
            {Array.from({ length: 10 }).map((_, h) => (
              <span key={h} className="h-4 flex-1 rounded-[4px]" style={{ background: `rgba(29,158,117,${0.08 + lvl(di, h) * 0.92})` }} />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between pl-4 text-[9px] font-semibold text-gray-400"><span>2pm</span><span>7pm</span><span>11pm</span></div>
    </div>
  );
}

export function LeaderboardWidget() {
  return (
    <div>
      <p className="text-[12px] font-semibold text-gray-500">Waiter leaderboard</p>
      <div className="mt-3 space-y-2">
        {[["Alice", 312, 4.9, "from-amber-300 to-amber-500"], ["Eric", 276, 4.7, "from-gray-200 to-gray-400"], ["Grace", 241, 4.6, "from-orange-300 to-orange-500"]].map(([n, p, r, g], i) => (
          <div key={n as string} className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2">
            <span className={`flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br ${g} text-[11px] font-black text-white`}>{i + 1}</span>
            <span className="flex-1 text-[12.5px] font-bold text-gray-800">{n}</span>
            <span className="flex items-center gap-0.5 text-[11px] font-semibold text-gray-500"><Star size={11} className="fill-amber-400 text-amber-400" />{r}</span>
            <span className="w-14 text-right text-[12px] font-extrabold tabular-nums text-gray-900">{p} pts</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PayoutWidget() {
  return (
    <div className="space-y-2.5">
      {[
        ["Table 4 paid", "6,800 RWF", "+6,256 RWF sent to your MoMo", "just now"],
        ["Table 9 paid", "14,500 RWF", "+13,340 RWF sent to your MoMo", "4 min ago"],
        ["Table 2 paid", "9,000 RWF", "+8,280 RWF sent to your MoMo", "11 min ago"],
      ].map(([t, a, s, w], i) => (
        <div key={t} className="flex items-center gap-3 rounded-2xl bg-white/[0.06] p-3 ring-1 ring-white/10" style={{ opacity: 1 - i * 0.22 }}>
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-emerald-400/15"><Check size={16} className="text-emerald-300" /></span>
          <div className="min-w-0 flex-1">
            <p className="flex justify-between text-[12.5px] font-bold text-white"><span>{t}</span><span>{a}</span></p>
            <p className="flex justify-between text-[10.5px] text-white/50"><span>{s}</span><span>{w}</span></p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function MenuPhotoWidget() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative w-[44%] rotate-[-4deg] rounded-lg bg-[#fbf6ea] p-3 shadow-md ring-1 ring-black/5">
        <p className="text-center font-serif text-[11px] italic text-gray-700">— Menu —</p>
        {["Primus ....... 1500", "Mützig ....... 1800", "Brochette .... 3000", "Chips ........ 2000"].map((l) => (
          <p key={l} className="mt-1 font-mono text-[8.5px] text-gray-500">{l}</p>
        ))}
        <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-gray-900 text-white"><Camera size={13} /></span>
      </div>
      <ArrowRight size={18} className="flex-shrink-0 text-emerald-500" />
      <div className="flex-1 space-y-1.5">
        {[["Primus", "1,500"], ["Mützig", "1,800"], ["Brochette", "3,000"]].map(([n, p]) => (
          <div key={n} className="flex justify-between rounded-lg bg-white px-2.5 py-1.5 text-[10.5px] shadow-sm ring-1 ring-black/5">
            <span className="font-bold text-gray-800">{n}</span>
            <span className="font-semibold text-emerald-600">{p}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Live order feed that keeps ticking — the "alive" feeling of the dashboard.
const FEED = [
  ["Table 3", "2 × Mützig", "New"],
  ["Table 7", "Brochette, Chips", "New"],
  ["Table 1", "Wants to pay", "Bill"],
  ["Table 5", "Calling waiter", "Nudge"],
  ["Table 9", "3 × Primus", "New"],
  ["Table 2", "Paid 9,000 RWF", "Paid"],
];
const TAG: Record<string, string> = {
  New: "bg-sky-100 text-sky-700",
  Bill: "bg-violet-100 text-violet-700",
  Nudge: "bg-amber-100 text-amber-700",
  Paid: "bg-emerald-100 text-emerald-700",
};

export function OrderFeed() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((x) => x + 1), 2200);
    return () => clearInterval(t);
  }, []);
  const rows = [0, 1, 2, 3].map((i) => FEED[(n + i) % FEED.length]);
  return (
    <div className="space-y-2">
      {rows.map(([t, d, tag], i) => (
        <div key={`${n}-${i}`} className={`flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-black/5 ${i === 0 ? "lp-toast" : ""}`}>
          <span className="text-[12px] font-extrabold text-gray-900">{t}</span>
          <span className="flex-1 truncate text-[11.5px] text-gray-500">{d}</span>
          <span className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold ${TAG[tag]}`}>{tag}</span>
        </div>
      ))}
    </div>
  );
}
