import { useEffect, useRef, useState } from "react";
import { Download, ImagePlus, Sparkles, X } from "lucide-react";
import Layout from "../../components/Layout";
import api from "../../lib/api";
import { useAuthStore } from "../../lib/auth";
import { useCloudinaryUpload } from "../../hooks/useCloudinaryUpload";
import { drawPoster, posterFile, type Vibe } from "../../lib/poster";

// The AI event planner (Max): it finds the idea from the venue's own numbers,
// the owner taps Approve, Skuzi sends it to the venue's guests and makes the
// poster. Afterwards it shows how many came.

interface Idea { name: string; offer: string; why: string; caption: string; eventAt: string; startTime: string; source: "ai" | "rules" }
interface PastEvent { id: string; name: string; eventAt: string; status: string; reached: number; came: number }
interface Brand { name: string; location: string | null; logoUrl: string | null; vibe: Vibe | null; photos: string[] }

const VIBES: { id: Vibe; label: string }[] = [
  { id: "lounge", label: "🍸 Lounge" },
  { id: "sports", label: "⚽ Sports bar" },
  { id: "family", label: "🍲 Family" },
  { id: "chill", label: "☕ Chill café" },
  { id: "club", label: "🎶 Night club" },
];

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Kigali" }).replace(" at ", " · ");
const shortDay = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Kigali" });

export default function Events() {
  const { venues, fetchMe } = useAuthStore();
  const venue = venues[0];
  useEffect(() => { if (!venue) fetchMe(); }, []);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [events, setEvents] = useState<PastEvent[]>([]);
  const [idea, setIdea] = useState<Idea | null>(null);
  const [shown, setShown] = useState<string[]>([]);
  const [thinking, setThinking] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState<Idea | null>(null);
  const [error, setError] = useState("");
  const [posterReady, setPosterReady] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const { upload, uploading } = useCloudinaryUpload();

  const load = () => venue && api.get(`/events/${venue.id}`).then((r) => { setBrand(r.data.data.brand); setEvents(r.data.data.events); }).catch((e) => setError(e?.response?.data?.error ?? "Couldn't load your events."));
  useEffect(() => { load(); }, [venue?.id]);

  const saveBrand = async (change: Partial<Pick<Brand, "vibe" | "photos">>) => {
    if (!venue) return;
    try { const r = await api.put(`/events/${venue.id}/brand`, change); setBrand(r.data.data); } catch (e: any) { setError(e?.response?.data?.error ?? "Couldn't save."); }
  };

  const findIdea = async () => {
    if (!venue) return;
    setThinking(true); setError(""); setApproved(null); setPosterReady(false);
    try {
      const r = await api.post(`/events/${venue.id}/idea`, { avoid: shown });
      const next: Idea = r.data.data.idea;
      setIdea(next);
      setShown((s) => [...s, next.name]);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? "Couldn't find an idea. Try again.");
    } finally { setThinking(false); }
  };

  const approve = async () => {
    if (!venue || !idea) return;
    setApproving(true); setError("");
    try {
      await api.post(`/events/${venue.id}/approve`, { idea });
      setApproved(idea);
      setIdea(null);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? "Couldn't plan it. Try again.");
    } finally { setApproving(false); }
  };

  // Draw the poster once an event is approved (and again if the look changes).
  useEffect(() => {
    if (!approved || !brand || !canvas.current) return;
    setPosterReady(false);
    drawPoster(canvas.current, {
      name: approved.name, offer: approved.offer, when: when(approved.eventAt),
      venueName: brand.name, location: brand.location, logoUrl: brand.logoUrl, photoUrl: brand.photos[0] ?? null, vibe: brand.vibe,
    }).then(() => setPosterReady(true));
  }, [approved, brand?.vibe, brand?.photos?.[0], brand?.logoUrl]);

  const savePoster = async () => {
    if (!canvas.current || !approved) return;
    const file = await posterFile(canvas.current, approved.name);
    if (!file) { setError("Couldn't save the poster. Try again."); return; }
    const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
    if (nav.canShare?.({ files: [file] })) {
      try { await nav.share({ files: [file], text: approved.caption }); return; } catch { /* cancelled: fall back to download */ }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url; a.download = file.name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <Layout>
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-white">Events</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Your AI event planner finds the idea, makes the poster, and sends it to your guests.</p>
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}

        {/* The idea */}
        <section className="mt-5 rounded-2xl bg-gray-900 p-5 text-white dark:bg-gray-800">
          {!idea && !thinking && (
            <>
              <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#FFD966]"><Sparkles size={15} /> AI event planner</p>
              <p className="mt-1 font-display text-2xl font-bold">Fill your quiet night</p>
              <p className="mt-1 text-sm text-white/75">It looks at your slow nights and your best sellers, and plans an event for you.</p>
              <button onClick={findIdea} className="mt-4 w-full rounded-xl bg-[#FFD966] py-3.5 text-base font-extrabold text-gray-900">Find an idea</button>
            </>
          )}
          {thinking && (
            <div className="py-6 text-center">
              <Sparkles className="mx-auto animate-pulse text-[#FFD966]" size={28} />
              <p className="mt-2 font-bold">Looking at your nights…</p>
            </div>
          )}
          {idea && !thinking && (
            <>
              <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#FFD966]"><Sparkles size={15} /> Idea for your quiet night</p>
              <p className="mt-2 text-sm text-white/80">{idea.why}</p>
              <p className="mt-3 font-display text-3xl font-bold leading-tight">{idea.name}</p>
              <p className="mt-2 text-sm font-bold">📅 {when(idea.eventAt)}</p>
              <p className="mt-1 text-sm font-bold">🎁 {idea.offer}</p>
              <p className="mt-3 rounded-xl bg-white/10 px-3 py-2.5 text-sm text-white/90">"{idea.caption}"</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button onClick={findIdea} className="rounded-xl border-2 border-white/25 py-3 text-sm font-extrabold">Another idea</button>
                <button onClick={approve} disabled={approving} className="rounded-xl bg-[#FFD966] py-3 text-sm font-extrabold text-gray-900 disabled:opacity-60">{approving ? "Planning…" : "Approve"}</button>
              </div>
              <p className="mt-2 text-center text-xs text-white/55">Approve sends it to your guests who said yes to offers, the day before at 5pm.</p>
            </>
          )}
        </section>

        {/* The poster */}
        {approved && (
          <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm font-extrabold text-green-700 dark:text-green-400">✓ {approved.name} is planned. Here's your poster:</p>
            <canvas ref={canvas} className="mt-3 aspect-[4/5] w-full max-w-full rounded-xl bg-gray-100 dark:bg-gray-800" aria-label={`Poster for ${approved.name}`} />
            <button onClick={savePoster} disabled={!posterReady} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-action py-3.5 text-base font-extrabold text-action-ink disabled:opacity-50">
              <Download size={18} /> Save or share the poster
            </button>
            <p className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">Post it on your Instagram and WhatsApp status. The caption is copied with it.</p>
          </section>
        )}

        {/* The look of the posters */}
        {brand && (
          <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="font-bold text-gray-900 dark:text-white">Your posters' look</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Your logo, your photos and your vibe, so your posters look like your place.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {VIBES.map((v) => (
                <button key={v.id} onClick={() => saveBrand({ vibe: v.id })} aria-pressed={brand.vibe === v.id}
                  className={`rounded-full px-3.5 py-2 text-sm font-bold ${brand.vibe === v.id ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900" : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200"}`}>
                  {v.label}
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {brand.photos.map((p) => (
                <div key={p} className="relative aspect-square overflow-hidden rounded-xl">
                  <img src={p} alt="Your place" className="h-full w-full object-cover" />
                  <button onClick={() => saveBrand({ photos: brand.photos.filter((x) => x !== p) })} aria-label="Remove photo"
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"><X size={14} /></button>
                </div>
              ))}
              {brand.photos.length < 5 && (
                <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-gray-300 text-xs font-bold text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  <ImagePlus size={20} /> {uploading ? "Uploading…" : "Add a photo"}
                  <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={async (e) => {
                    const f = e.target.files?.[0]; e.target.value = "";
                    if (!f) return;
                    const url = await upload(f);
                    if (url) saveBrand({ photos: [...brand.photos, url] });
                  }} />
                </label>
              )}
            </div>
            <p className="mt-2 text-xs text-gray-400">Your terrace, your food, your bar. The first photo goes on the poster.</p>
          </section>
        )}

        {/* What happened */}
        {events.length > 0 && (
          <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="font-bold text-gray-900 dark:text-white">Your events</p>
            <div className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
              {events.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{e.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{shortDay(e.eventAt)} · {e.status === "scheduled" ? "goes out the day before" : e.status === "cancelled" ? "cancelled" : `sent to ${e.reached}`}</p>
                  </div>
                  {e.status === "sent" && (
                    <p className="flex-none text-right"><span className="font-display text-2xl font-bold text-gray-900 dark:text-white">{e.came}</span><span className="block text-xs text-gray-500">came</span></p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
}
