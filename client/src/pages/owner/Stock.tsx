import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Package, Plus, Minus, X, ClipboardCheck, Truck, Settings2, Trash2, Camera, PenLine } from 'lucide-react';
import type { WsEvent } from '@tabpro/shared';
import Layout from '../../components/Layout';
import Toast from '../../components/Toast';
import api from '../../lib/api';
import { useAuthStore } from '../../lib/auth';
import { useWebSocket } from '../../hooks/useWebSocket';

// Stock for bars: tracked bottles/cans go down with every order in Skuzi, up
// with deliveries, and a closing count shows what went missing. Owner only.

type Status = 'off' | 'ok' | 'low' | 'out';
type PackKind = 'crate' | 'tray' | 'box';
type Pack = { kind: PackKind; size: number } | null;
type Item = { id: string; name: string; category: string; priceRwf: number; tracked: boolean; qty: number; alertAt: number | null; pack: Pack; soldTonight: number; status: Status };
type Stock = { items: Item[]; summary: { soldTonight: number; low: number; out: number } };
type Movement = { id: string; kind: 'sale' | 'delivery' | 'count'; qtyChange: number; qtyAfter: number; expectedQty: number | null; note: string | null; createdAt: string; tableLabel: string | null };
type History = { movements: Movement[]; week: { sold: number; delivered: number; missing: number } };
type CountResult = { missing: { name: string; qty: number; valueRwf: number }[]; extra: { name: string; qty: number }[]; missingValueRwf: number };


// Owners use their own sign-in; a manager in the waiter app passes their staff
// token, so the same screens work for both.
const TokenCtx = createContext<string | undefined>(undefined);
function useReq() {
  const token = useContext(TokenCtx);
  const h = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  return {
    get: (url: string, params?: Record<string, unknown>) => api.get(url, { ...h, params }),
    post: (url: string, body?: unknown) => api.post(url, body, h),
    put: (url: string, body?: unknown) => api.put(url, body, h),
    del: (url: string) => api.delete(url, h),
  };
}

const rwf = (n: number) => `${n.toLocaleString('en-US')} RWF`;

// Stock the way staff talk ("3 crates + 4", "1 tray"), counted in single units.
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : word === 'box' ? 'es' : 's'}`;
const packWord = (kind: PackKind) => plural(2, kind).replace('2 ', '');
function stockWords(qty: number, pack: Pack) {
  if (!pack) return plural(qty, 'bottle');
  if (qty <= 0) return plural(0, pack.kind);
  const packs = Math.floor(qty / pack.size);
  const rest = qty % pack.size;
  if (packs === 0) return plural(rest, pack.kind === 'tray' ? 'can' : 'bottle');
  return rest ? `${plural(packs, pack.kind)} + ${rest}` : plural(packs, pack.kind);
}

// Phone photos are big: send a smaller JPEG (faster on mobile data).
async function shrink(file: File): Promise<Blob> {
  try {
    const img = await createImageBitmap(file);
    const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise((ok) => canvas.toBlob((b) => ok(b ?? file), 'image/jpeg', 0.85));
  } catch {
    return file;
  }
}
const time = (iso: string) => new Date(iso).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kigali' });

function emojiFor(i: { name: string; category: string }) {
  const s = `${i.category} ${i.name}`.toLowerCase();
  if (/wine|vin/.test(s)) return '🍷';
  if (/water|eau/.test(s)) return '💧';
  if (/soda|soft|fanta|coca|sprite|juice|jus/.test(s)) return '🥤';
  if (/beer|bière|primus|mützig|mutzig|skol|heineken|amstel|virunga|guinness/.test(s)) return '🍺';
  if (/whisk|vodka|gin|rum|spirit|liqueur|tequila/.test(s)) return '🥃';
  return '📦';
}

const CHIP: Record<Status, { label: string; cls: string }> = {
  ok: { label: 'OK', cls: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300' },
  low: { label: 'Low', cls: 'bg-[#FFD966] text-[#231A2C]' },
  out: { label: 'Sold out', cls: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' },
  off: { label: 'Not tracked', cls: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
};

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end md:items-center md:justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 bg-black/45" aria-label="Close" onClick={onClose} />
      <div className="relative flex max-h-[88vh] w-full flex-col rounded-t-3xl bg-white dark:bg-gray-900 md:max-w-lg md:rounded-3xl">
        <div className="flex items-center justify-between px-5 pb-3 pt-5">
          <h2 className="font-display text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto px-5 pb-6">{children}</div>
      </div>
    </div>
  );
}

function Stepper({ value, onChange, min = 0 }: { value: number; onChange: (n: number) => void; min?: number }) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" aria-label="Less" onClick={() => onChange(Math.max(min, value - 1))} className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800"><Minus size={16} /></button>
      <input
        inputMode="numeric"
        value={String(value)}
        onChange={(e) => onChange(Math.max(min, Number(e.target.value.replace(/\D/g, '') || 0)))}
        className="w-14 rounded-xl border border-gray-200 bg-white py-1.5 text-center font-display text-lg font-bold text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        aria-label="Quantity"
      />
      <button type="button" aria-label="More" onClick={() => onChange(value + 1)} className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800"><Plus size={16} /></button>
    </div>
  );
}

export default function Stock() {
  const { venues, fetchMe } = useAuthStore();
  useEffect(() => { if (!venues[0]) fetchMe(); }, []);
  const venue = venues[0];
  return <Layout>{venue && <StockPanel venueId={venue.id} venueName={venue.name} />}</Layout>;
}

/** The whole Stock screen. `token`: a manager's staff token (waiter app). */
export function StockPanel(props: { venueId: string; venueName?: string; token?: string; canEditMenu?: boolean }) {
  return <TokenCtx.Provider value={props.token}><StockScreen {...props} /></TokenCtx.Provider>;
}

function StockScreen({ venueId, venueName, token: staffToken, canEditMenu: managerEditsMenu }: { venueId: string; venueName?: string; token?: string; canEditMenu?: boolean }) {
  const req = useReq();
  const ownerToken = useAuthStore((st) => st.token);
  const [stock, setStock] = useState<Stock | null>(null);
  const [sheet, setSheet] = useState<null | 'setup' | 'delivery' | 'count' | 'photo' | 'typed'>(null);
  const [itemId, setItemId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [tab, setTab] = useState<'bar' | 'kitchen'>('bar');

  const load = useCallback(() => {
    req.get(`/stock/${venueId}`).then((r) => setStock(r.data.data)).catch(() => {});
  }, [venueId]);
  useEffect(load, [load]);
  useWebSocket({
    venueId,
    token: staffToken ?? ownerToken ?? undefined,
    enabled: !!venueId,
    onEvent: (e: WsEvent) => { if (e.type === 'stock_update' || e.type === 'new_order') load(); },
  });

  const tracked = stock?.items.filter((i) => i.tracked) ?? [];
  const item = stock?.items.find((i) => i.id === itemId) ?? null;

  return (
    <>
      <div className="mx-auto max-w-3xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-white">Stock</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Tonight{venueName ? ` · ${venueName}` : ''}</p>
          </div>
          {tab === 'bar' && tracked.length > 0 && (
            <button onClick={() => setSheet('setup')} className="flex items-center gap-1.5 rounded-full border border-gray-200 px-3.5 py-2 text-sm font-bold text-gray-700 dark:border-gray-700 dark:text-gray-200">
              <Settings2 size={16} /> Items
            </button>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-gray-100 p-1 dark:bg-gray-800" role="tablist">
          {(['bar', 'kitchen'] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded-xl py-2.5 text-sm font-extrabold transition ${tab === t ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
              {t === 'bar' ? '🍺 Bar' : '🥩 Food stock'}
            </button>
          ))}
        </div>

        {tab === 'kitchen' ? (
          <KitchenPanel venueId={venueId} onToast={setToast} />
        ) : stock === null ? (
          <div className="mt-6 h-40 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
        ) : tracked.length === 0 ? (
          <div className="mt-6 rounded-3xl border-[1.5px] border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-600 dark:bg-gray-800 dark:text-brand-300"><Package size={26} /></div>
            <h2 className="mt-4 font-display text-xl font-bold text-gray-900 dark:text-white">Track your drinks</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">Snap a delivery, or pick drinks from your menu. Every order in Skuzi takes them off, deliveries add them back, and you'll see what goes missing.</p>
            <div className="mt-5 flex flex-col items-center gap-2">
              <button onClick={() => setSheet('photo')} className="flex items-center gap-2 rounded-full bg-action px-6 py-3 font-extrabold text-action-ink"><Camera size={18} /> Snap a delivery</button>
              <button onClick={() => setSheet('setup')} className="rounded-full px-6 py-2 text-sm font-bold text-brand-600 underline dark:text-brand-300">Or choose drinks from your menu</button>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-3 gap-2.5">
              <div className="rounded-2xl border border-gray-200 bg-white p-3.5 dark:border-gray-800 dark:bg-gray-900"><p className="font-display text-2xl font-bold text-gray-900 dark:text-white">{stock.summary.soldTonight}</p><p className="text-xs font-semibold text-gray-500 dark:text-gray-400">sold tonight</p></div>
              <div className="rounded-2xl border border-gray-200 bg-white p-3.5 dark:border-gray-800 dark:bg-gray-900"><p className="font-display text-2xl font-bold text-amber-700 dark:text-amber-300">{stock.summary.low}</p><p className="text-xs font-semibold text-gray-500 dark:text-gray-400">running low</p></div>
              <div className="rounded-2xl border border-gray-200 bg-white p-3.5 dark:border-gray-800 dark:bg-gray-900"><p className="font-display text-2xl font-bold text-red-600 dark:text-red-400">{stock.summary.out}</p><p className="text-xs font-semibold text-gray-500 dark:text-gray-400">sold out</p></div>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              {tracked.map((i) => (
                <button key={i.id} onClick={() => setItemId(i.id)} className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-3.5 py-3 text-left hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900">
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-brand-50 text-xl dark:bg-gray-800" aria-hidden="true">{emojiFor(i)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-gray-900 dark:text-white">{i.name}</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">Sold {i.soldTonight} tonight</span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <span className="font-display text-lg font-bold tabular-nums text-gray-900 dark:text-white">{stockWords(i.qty, i.pack)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide ${CHIP[i.status].cls}`}>{CHIP[i.status].label}</span>
                  </span>
                </button>
              ))}
            </div>

            <div className="sticky bottom-20 mt-5 grid grid-cols-2 gap-2.5 md:bottom-4">
              <button onClick={() => setSheet('delivery')} className="flex items-center justify-center gap-2 rounded-2xl bg-action py-3.5 font-extrabold text-action-ink shadow-lg shadow-black/15"><Truck size={18} /> Delivery</button>
              <button onClick={() => setSheet('count')} className="flex items-center justify-center gap-2 rounded-2xl border-2 border-gray-900 bg-white py-3.5 font-extrabold text-gray-900 dark:border-gray-100 dark:bg-gray-900 dark:text-white"><ClipboardCheck size={18} /> Count stock</button>
            </div>
            <p className="mt-3 text-center text-xs text-gray-500 dark:text-gray-400">Stock is only right if every order goes into Skuzi, cash ones too: waiters can add them.</p>
          </>
        )}
      </div>

      {sheet === 'setup' && stock && <SetupSheet stock={stock} onClose={() => setSheet(null)} onSaved={() => { load(); setToast('Stock items saved'); }} />}
      {sheet === 'delivery' && <DeliverySheet venueId={venueId} items={tracked} onReceive={(photo) => setSheet(photo ? 'photo' : 'typed')} onClose={() => setSheet(null)} onSaved={() => { load(); setSheet(null); setToast('Delivery added'); }} />}
      {(sheet === 'photo' || sheet === 'typed') && stock && <ReceiveSheet venueId={venueId} items={stock.items} photo={sheet === 'photo'} canEditMenu={!staffToken || !!managerEditsMenu} onClose={() => setSheet(null)} onSaved={(msg) => { load(); setSheet(null); setToast(msg); }} />}
      {sheet === 'count' && <CountSheet venueId={venueId} items={tracked} onClose={() => { setSheet(null); load(); }} />}
      {item && <ItemSheet item={item} onClose={() => setItemId(null)} onChanged={load} />}
      {toast && <Toast message={toast} onDismiss={() => setToast('')} />}
    </>
  );
}

// ─── Choose items to track ────────────────────────────────────────────────────
type Draft = { tracked: boolean; qty: number; alertAt: number; pack: Pack };
const KINDS: { kind: PackKind | null; label: string }[] = [
  { kind: null, label: 'Bottles' }, { kind: 'crate', label: 'Crate' }, { kind: 'tray', label: 'Tray' }, { kind: 'box', label: 'Box' },
];
const DEFAULT_SIZE: Record<PackKind, number> = { crate: 24, tray: 24, box: 12 };

/** Bottles / Crate / Tray / Box, and how many in one. */
function PackPicker({ pack, onChange, name }: { pack: Pack; onChange: (p: Pack) => void; name: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-4 gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800" role="radiogroup" aria-label={`How ${name} comes`}>
        {KINDS.map(({ kind, label }) => {
          const on = (pack?.kind ?? null) === kind;
          return (
            <button key={label} type="button" role="radio" aria-checked={on} onClick={() => onChange(kind ? { kind, size: pack?.size ?? DEFAULT_SIZE[kind] } : null)}
              className={`rounded-lg py-1.5 text-sm font-bold ${on ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>{label}</button>
          );
        })}
      </div>
      {pack && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400">{pack.kind === 'tray' ? 'Cans or bottles' : 'Bottles'} in one {pack.kind}</p>
          <Stepper value={pack.size} min={2} onChange={(n) => onChange({ ...pack, size: Math.max(2, n) })} />
        </div>
      )}
    </div>
  );
}

function SetupSheet({ stock, onClose, onSaved }: { stock: Stock; onClose: () => void; onSaved: () => void }) {
  const req = useReq();
  const [draft, setDraft] = useState<Record<string, Draft>>(() => Object.fromEntries(stock.items.map((i) => [i.id, { tracked: i.tracked, qty: i.qty, alertAt: i.alertAt ?? (i.pack ? i.pack.size * 2 : 6), pack: i.pack }])));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (id: string, d: Draft) => setDraft({ ...draft, [id]: d });
  const samePack = (a: Pack, b: Pack) => (a?.kind ?? null) === (b?.kind ?? null) && (a?.size ?? null) === (b?.size ?? null);
  const save = async () => {
    setSaving(true); setError('');
    try {
      for (const i of stock.items) {
        const d = draft[i.id];
        if (d.tracked !== i.tracked || (d.tracked && (d.qty !== i.qty || d.alertAt !== i.alertAt || !samePack(d.pack, i.pack)))) {
          await req.put(`/stock/items/${i.id}`, d.tracked ? { tracked: true, qty: d.qty, alertAt: d.alertAt, packKind: d.pack?.kind ?? null, packSize: d.pack?.size ?? null } : { tracked: false });
        }
      }
      onSaved(); onClose();
    } catch (e: any) { setError(e?.response?.data?.error ?? 'Could not save. Try again.'); } finally { setSaving(false); }
  };
  return (
    <Sheet title="What to track" onClose={onClose}>
      <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">Switch on the drinks you want to count, and say how each one comes: single bottles, crates, trays or boxes.</p>
      <div className="flex flex-col gap-2">
        {stock.items.map((i) => {
          const d = draft[i.id];
          const size = d.pack?.size ?? 0;
          return (
            <div key={i.id} className={`rounded-2xl border px-3.5 py-3 ${d.tracked ? 'border-brand-300 bg-brand-50/50 dark:border-brand-700 dark:bg-gray-800/60' : 'border-gray-200 dark:border-gray-800'}`}>
              <label className="flex cursor-pointer items-center gap-3">
                <span className="text-xl" aria-hidden="true">{emojiFor(i)}</span>
                <span className="min-w-0 flex-1"><span className="block truncate font-bold text-gray-900 dark:text-white">{i.name}</span><span className="text-xs text-gray-500 dark:text-gray-400">{i.category}</span></span>
                <input type="checkbox" className="h-5 w-5 accent-[#BF4A1A]" checked={d.tracked} onChange={(e) => set(i.id, { ...d, tracked: e.target.checked })} />
              </label>
              {d.tracked && (
                <div className="mt-3 flex flex-col gap-3">
                  <PackPicker pack={d.pack} name={i.name} onChange={(pack) => set(i.id, { ...d, pack })} />
                  {d.pack ? (
                    <>
                      <div className="flex items-center justify-between gap-3"><p className="text-xs font-bold text-gray-500 dark:text-gray-400"><span className="capitalize">{packWord(d.pack.kind)}</span> now</p><Stepper value={Math.floor(d.qty / size)} onChange={(n) => set(i.id, { ...d, qty: n * size + (d.qty % size) })} /></div>
                      <div className="flex items-center justify-between gap-3"><p className="text-xs font-bold text-gray-500 dark:text-gray-400">+ loose</p><Stepper value={d.qty % size} onChange={(n) => set(i.id, { ...d, qty: Math.floor(d.qty / size) * size + Math.min(n, size - 1) })} /></div>
                      <div className="flex items-center justify-between gap-3"><p className="text-xs font-bold text-gray-500 dark:text-gray-400">Warn me at ({packWord(d.pack.kind)})</p><Stepper value={Math.round(d.alertAt / size)} onChange={(n) => set(i.id, { ...d, alertAt: n * size })} /></div>
                    </>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div><p className="mb-1 text-xs font-bold text-gray-500 dark:text-gray-400">Bottles now</p><Stepper value={d.qty} onChange={(n) => set(i.id, { ...d, qty: n })} /></div>
                      <div><p className="mb-1 text-xs font-bold text-gray-500 dark:text-gray-400">Warn me at</p><Stepper value={d.alertAt} onChange={(n) => set(i.id, { ...d, alertAt: n })} /></div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
      <button onClick={save} disabled={saving} className="mt-4 w-full rounded-2xl bg-action py-3.5 font-extrabold text-action-ink disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
    </Sheet>
  );
}

// ─── A delivery arrived ───────────────────────────────────────────────────────
// Snap it or type it in (any drink, even a new one); or restock a drink you
// already follow, counted in its own pack.
function DeliverySheet({ venueId, items, onReceive, onClose, onSaved }: { venueId: string; items: Item[]; onReceive: (photo: boolean) => void; onClose: () => void; onSaved: () => void }) {
  const req = useReq();
  const [qty, setQty] = useState<Record<string, number>>({}); // packs for packed drinks, else bottles
  const [supplier, setSupplier] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const lines = items.filter((i) => (qty[i.id] ?? 0) > 0).map((i) => ({ menuItemId: i.id, qty: (qty[i.id] ?? 0) * (i.pack?.size ?? 1) }));
  const save = async () => {
    setSaving(true); setError('');
    try { await req.post(`/stock/${venueId}/delivery`, { items: lines, supplier }); onSaved(); }
    catch (e: any) { setError(e?.response?.data?.error ?? 'Could not save. Try again.'); } finally { setSaving(false); }
  };
  return (
    <Sheet title="Delivery arrived" onClose={onClose}>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => onReceive(true)} className="flex items-center justify-center gap-2 rounded-2xl bg-action py-3.5 font-extrabold text-action-ink"><Camera size={18} /> Snap it</button>
        <button onClick={() => onReceive(false)} className="flex items-center justify-center gap-2 rounded-2xl border-2 border-gray-900 py-3.5 font-extrabold text-gray-900 dark:border-gray-100 dark:text-white"><PenLine size={18} /> Type it in</button>
      </div>
      {items.length > 0 && <p className="mb-2 mt-4 text-xs font-bold uppercase tracking-wider text-gray-400">Or restock a drink you follow</p>}
      <div className="flex flex-col gap-2">
        {items.map((i) => (
          <div key={i.id} className="rounded-2xl border border-gray-200 px-3.5 py-3 dark:border-gray-800">
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0"><span className="block truncate font-bold text-gray-900 dark:text-white">{emojiFor(i)} {i.name}</span><span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{i.pack ? `${i.pack.kind}s of ${i.pack.size}` : 'bottles'} · {stockWords(i.qty, i.pack)} now</span></span>
              <Stepper value={qty[i.id] ?? 0} onChange={(n) => setQty({ ...qty, [i.id]: n })} />
            </div>
            <div className="mt-2 flex gap-1.5">
              {(i.pack ? [1, 5, 10] : [1, 6, 12]).map((n) => (
                <button key={n} type="button" onClick={() => setQty({ ...qty, [i.id]: (qty[i.id] ?? 0) + n })} className="rounded-full border border-gray-200 px-2.5 py-1 text-xs font-bold text-gray-700 dark:border-gray-700 dark:text-gray-200">+{i.pack ? plural(n, i.pack.kind) : n}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {items.length > 0 && (
        <>
          <input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="From (optional), e.g. Bralirwa" className="mt-3 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white" aria-label="Supplier" />
          {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
          <button onClick={save} disabled={saving || lines.length === 0} className="mt-4 w-full rounded-2xl bg-brand-500 py-3.5 font-extrabold text-white disabled:opacity-50">{saving ? 'Adding…' : 'Add to stock'}</button>
        </>
      )}
      <p className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">Sold-out drinks come back on the menu by themselves.</p>
    </Sheet>
  );
}

// ─── Snap it or type it in → review → add ─────────────────────────────────────
// The photo fills in what it can (drink, size, pack, how many in one); the
// owner checks and fixes anything. A drink not on the menu yet is added to it.
type Reading = { drink: string | null; size: 'small' | 'medium' | 'big' | null; pack: PackKind | 'single' | null; perPack: number; packsSeen: number; menuItemId: string | null; name: string | null; priceRwf: number | null };
const SIZES = ['small', 'medium', 'big'] as const;

function ReceiveSheet({ venueId, items, photo, canEditMenu, onClose, onSaved }: { venueId: string; items: Item[]; photo: boolean; canEditMenu: boolean; onClose: () => void; onSaved: (msg: string) => void }) {
  const req = useReq();
  const [step, setStep] = useState<'snap' | 'reading' | 'review'>(photo ? 'snap' : 'review');
  const [reading, setReading] = useState<Reading | null>(null);
  const [name, setName] = useState('');
  const [size, setSize] = useState<Reading['size']>(null);
  const [pack, setPack] = useState<Pack>({ kind: 'crate', size: 24 });
  const [price, setPrice] = useState('');
  const [packs, setPacks] = useState(1);
  const [loose, setLoose] = useState(0);
  const [supplier, setSupplier] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const known = items.find((i) => i.name.trim().toLowerCase() === name.trim().toLowerCase());
  const total = packs * (pack?.size ?? 1) + loose;

  // Picking a drink from the menu brings its price and its usual pack.
  const pickName = (n: string) => {
    setName(n);
    const it = items.find((i) => i.name.trim().toLowerCase() === n.trim().toLowerCase());
    if (it) { setPrice(String(it.priceRwf)); if (it.pack) setPack(it.pack); }
  };
  const read = async (file: File) => {
    setStep('reading'); setError('');
    try {
      const fd = new FormData();
      fd.append('file', await shrink(file), 'delivery.jpg');
      const r: Reading = (await req.post(`/stock/${venueId}/photo`, fd)).data.data;
      setReading(r);
      setSize(r.size);
      const it = items.find((i) => i.id === r.menuItemId);
      setName(r.name ?? (r.drink ? [r.drink, r.size].filter(Boolean).join(' ') : ''));
      setPrice(r.priceRwf ? String(r.priceRwf) : '');
      if (r.pack === 'single') setPack(null);
      else if (r.pack) setPack({ kind: r.pack, size: r.perPack >= 2 ? r.perPack : it?.pack?.size ?? DEFAULT_SIZE[r.pack] });
      else if (it?.pack) setPack(it.pack);
      if (r.packsSeen > 0 && r.pack !== 'single') setPacks(r.packsSeen);
      setStep('review');
    } catch (e: any) {
      setError(e?.response?.data?.error ?? "Couldn't read the photo. Try again, or type it in.");
      setStep('snap');
    }
  };
  // Size chips: the same brand in that size, if the menu has it.
  const pickSize = (s: (typeof SIZES)[number]) => {
    setSize(s);
    const brand = (reading?.drink ?? name).trim().split(/\s+/)[0]?.toLowerCase();
    const it = brand ? items.find((i) => i.name.toLowerCase().includes(brand) && new RegExp(`\\b${s}\\b`, 'i').test(i.name)) : undefined;
    if (it) pickName(it.name);
    else if (brand) setName(`${(reading?.drink ?? name).trim().split(/\s+/)[0]} ${s}`);
  };
  const save = async () => {
    setSaving(true); setError('');
    try {
      const r = await req.post(`/stock/${venueId}/receive`, {
        menuItemId: known?.id, name, priceRwf: price ? Number(price) : null,
        packKind: pack?.kind ?? null, packSize: pack?.size ?? null, packs: pack ? packs : 0, loose: pack ? loose : packs, supplier,
      });
      onSaved(`${r.data.data.name}: ${r.data.data.left} in stock`);
    } catch (e: any) { setError(e?.response?.data?.error ?? 'Could not save. Try again.'); } finally { setSaving(false); }
  };
  const field = 'mt-1 w-full rounded-2xl border border-gray-200 bg-white px-3.5 py-3 text-base font-bold text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white';

  return (
    <Sheet title={step === 'review' ? 'Check and add' : 'Snap the delivery'} onClose={onClose}>
      {step === 'snap' && (
        <>
          <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">Take a photo of the crates, trays or boxes. Skuzi reads what it can, then you check.</p>
          <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-action py-4 font-extrabold text-action-ink">
            <Camera size={20} /> Take the photo
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) read(f); e.target.value = ''; }} />
          </label>
          <button onClick={() => setStep('review')} className="mt-3 w-full text-center text-sm font-bold text-brand-600 underline dark:text-brand-300">Type it in instead</button>
          {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
        </>
      )}
      {step === 'reading' && (
        <div className="py-10 text-center">
          <Camera className="mx-auto animate-pulse text-brand-500" size={30} />
          <p className="mt-2 font-bold text-gray-900 dark:text-white">Reading the photo…</p>
        </div>
      )}
      {step === 'review' && (
        <div className="flex flex-col gap-3.5">
          {reading && (
            <p className="rounded-2xl bg-brand-50 px-4 py-3 text-sm text-gray-800 dark:bg-gray-800 dark:text-gray-100">
              {reading.drink ? <>Skuzi sees <b>{reading.drink}</b>{reading.size ? <> ({reading.size})</> : null}.</> : <>Skuzi couldn't read the drink: type it below.</>}
              <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">Check everything: Skuzi can get it wrong.</span>
            </p>
          )}
          <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Drink · type it or pick from your menu
            <input list="stock-drinks" value={name} onChange={(e) => pickName(e.target.value)} placeholder="e.g. Mützig big" className={field} />
            <datalist id="stock-drinks">{items.map((i) => <option key={i.id} value={i.name} />)}</datalist>
          </label>
          <div>
            <p className="mb-1 text-xs font-bold text-gray-500 dark:text-gray-400">Size</p>
            <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Size">
              {SIZES.map((s) => (
                <button key={s} type="button" role="radio" aria-checked={size === s} onClick={() => pickSize(s)}
                  className={`rounded-xl py-2 text-sm font-bold capitalize ${size === s ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'border border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-200'}`}>{s}</button>
              ))}
            </div>
          </div>
          <div><p className="mb-1 text-xs font-bold text-gray-500 dark:text-gray-400">How it comes</p><PackPicker pack={pack} name={name || 'this drink'} onChange={setPack} /></div>
          <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Price on your menu (RWF)
            <input inputMode="numeric" value={price ? Number(price).toLocaleString('en-US') : ''} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} disabled={!canEditMenu} placeholder="e.g. 2,000" className={`${field} disabled:opacity-60`} />
            {!canEditMenu && <span className="mt-1 block font-normal">Only the owner (or a manager they allow) adds drinks or changes prices.</span>}
          </label>
          {name.trim() && (
            <p className={`rounded-xl px-3 py-2 text-xs font-semibold ${known ? 'bg-green-50 text-green-800 dark:bg-green-500/10 dark:text-green-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200'}`}>
              {known ? `On your menu as ${known.name}.` : 'Not on your menu yet: it will be added with this price.'}
            </p>
          )}
          <div className="flex items-center justify-between gap-3"><p className="text-sm font-bold text-gray-700 dark:text-gray-200">How many {pack ? packWord(pack.kind) : 'bottles'} came</p><Stepper value={packs} min={0} onChange={setPacks} /></div>
          <div className="-mt-1.5 flex justify-end gap-1.5">
            {(pack ? [5, 10, 50] : [1, 6, 12]).map((n) => (
              <button key={n} type="button" onClick={() => setPacks(packs + n)} className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 dark:border-gray-700 dark:text-gray-200">+{n}</button>
            ))}
          </div>
          {pack && <div className="flex items-center justify-between gap-3"><p className="text-sm font-bold text-gray-700 dark:text-gray-200">+ loose</p><Stepper value={loose} onChange={setLoose} /></div>}
          <p className="rounded-2xl bg-gray-50 px-4 py-3 text-center font-display text-xl font-bold text-gray-900 dark:bg-gray-800 dark:text-white">= {pack ? `${stockWords(total, pack)} · ${total} in all` : plural(total, 'bottle')}</p>
          <input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="From (optional), e.g. Bralirwa" className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white" aria-label="Supplier" />
          {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
          <button onClick={save} disabled={saving || !name.trim() || total <= 0} className="w-full rounded-2xl bg-brand-500 py-3.5 font-extrabold text-white disabled:opacity-50">{saving ? 'Adding…' : 'Add to stock'}</button>
        </div>
      )}
    </Sheet>
  );
}

// ─── Closing count ────────────────────────────────────────────────────────────
// Packed drinks: count full packs and loose bottles.
function CountSheet({ venueId, items, onClose }: { venueId: string; items: Item[]; onClose: () => void }) {
  const req = useReq();
  const [counted, setCounted] = useState<Record<string, { packs: string; loose: string }>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<CountResult | null>(null);
  const lines = items.flatMap((i) => {
    const c = counted[i.id];
    if (!c || (c.packs === '' && c.loose === '')) return [];
    return [{ menuItemId: i.id, counted: Number(c.packs || 0) * (i.pack?.size ?? 0) + Number(c.loose || 0) }];
  });
  const put = (id: string, k: 'packs' | 'loose', v: string) => setCounted({ ...counted, [id]: { ...(counted[id] ?? { packs: '', loose: '' }), [k]: v.replace(/\D/g, '') } });
  const save = async () => {
    setSaving(true); setError('');
    try { const r = await req.post(`/stock/${venueId}/count`, { items: lines }); setResult(r.data.data); }
    catch (e: any) { setError(e?.response?.data?.error ?? 'Could not save. Try again.'); } finally { setSaving(false); }
  };
  const box = 'w-14 rounded-xl border border-gray-200 bg-white py-2 text-center font-display text-lg font-bold text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white';
  if (result) {
    return (
      <Sheet title="Count saved" onClose={onClose}>
        {result.missing.length === 0 ? (
          <div className="rounded-2xl bg-green-50 p-4 text-green-800 dark:bg-green-500/10 dark:text-green-300"><p className="font-display text-lg font-bold">Everything matches ✅</p><p className="text-sm">Nothing missing.</p></div>
        ) : (
          <div className="rounded-2xl bg-red-50 p-4 text-red-800 dark:bg-red-500/10 dark:text-red-300">
            <p className="font-display text-lg font-bold">{plural(result.missing.reduce((n, m) => n + m.qty, 0), 'bottle')} missing · {rwf(result.missingValueRwf)}</p>
            {result.missing.map((m) => <p key={m.name} className="text-sm">{m.name}: {plural(m.qty, 'bottle')} missing ({rwf(m.valueRwf)})</p>)}
            <p className="mt-2 text-xs">A reason to check, not proof: a bottle can break, or a drink can be sold without going into Skuzi.</p>
          </div>
        )}
        {result.extra.length > 0 && <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">More than expected: {result.extra.map((x) => `${x.name} +${x.qty}`).join(', ')}. A delivery may not have been added.</p>}
        <button onClick={onClose} className="mt-4 w-full rounded-2xl bg-action py-3.5 font-extrabold text-action-ink">Done</button>
      </Sheet>
    );
  }
  return (
    <Sheet title="Count stock" onClose={onClose}>
      <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">Count the shelf and the fridge, and type what you see. Leave a drink empty to skip it.</p>
      <div className="flex flex-col gap-2">
        {items.map((i) => (
          <div key={i.id} className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 px-3.5 py-3 dark:border-gray-800">
            <span className="min-w-0"><span className="block truncate font-bold text-gray-900 dark:text-white">{emojiFor(i)} {i.name}</span><span className="text-xs text-gray-500 dark:text-gray-400">Skuzi expects {stockWords(i.qty, i.pack)}</span></span>
            {i.pack ? (
              <span className="flex flex-none items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-gray-400">
                <input inputMode="numeric" value={counted[i.id]?.packs ?? ''} placeholder="0" onChange={(e) => put(i.id, 'packs', e.target.value)} className={box} aria-label={`${i.name} full ${i.pack.kind}s`} />{i.pack.kind}s +
                <input inputMode="numeric" value={counted[i.id]?.loose ?? ''} placeholder="0" onChange={(e) => put(i.id, 'loose', e.target.value)} className={box} aria-label={`${i.name} loose`} />
              </span>
            ) : (
              <input inputMode="numeric" value={counted[i.id]?.loose ?? ''} placeholder={String(i.qty)} onChange={(e) => put(i.id, 'loose', e.target.value)} className={box} aria-label={`${i.name} counted`} />
            )}
          </div>
        ))}
      </div>
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
      <button onClick={save} disabled={saving || lines.length === 0} className="mt-4 w-full rounded-2xl bg-action py-3.5 font-extrabold text-action-ink disabled:opacity-50">{saving ? 'Saving…' : 'Save count'}</button>
    </Sheet>
  );
}

// ─── One item's story ─────────────────────────────────────────────────────────
function ItemSheet({ item, onClose, onChanged }: { item: Item; onClose: () => void; onChanged: () => void }) {
  const req = useReq();
  const [history, setHistory] = useState<History | null>(null);
  useEffect(() => { req.get(`/stock/items/${item.id}/history`).then((r) => setHistory(r.data.data)).catch(() => {}); }, [item.id, item.qty]);
  const line = (m: Movement) => {
    if (m.kind === 'sale') return { text: m.tableLabel ? `${m.tableLabel} · sold ${-m.qtyChange}` : `Sold ${-m.qtyChange}`, value: `${m.qtyChange}`, cls: 'text-gray-900 dark:text-white' };
    if (m.kind === 'delivery') return { text: `Delivery${m.note ? ` · ${m.note}` : ''}`, value: `+${m.qtyChange}`, cls: 'text-green-700 dark:text-green-400' };
    if (m.note === 'Starting count') return { text: `Started tracking with ${m.qtyAfter}`, value: '', cls: '' };
    if (m.qtyChange < 0) return { text: `Count · expected ${m.expectedQty}, counted ${m.qtyAfter}`, value: `${-m.qtyChange} missing`, cls: 'text-red-600 dark:text-red-400' };
    if (m.qtyChange > 0) return { text: `Count · expected ${m.expectedQty}, counted ${m.qtyAfter}`, value: `+${m.qtyChange}`, cls: 'text-gray-500' };
    return { text: `Count · matched (${m.qtyAfter})`, value: '✓', cls: 'text-green-700 dark:text-green-400' };
  };
  const stop = async () => { await req.put(`/stock/items/${item.id}`, { tracked: false }).catch(() => {}); onChanged(); onClose(); };
  return (
    <Sheet title={item.name} onClose={onClose}>
      <div className="flex items-center gap-3 rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-2xl dark:bg-gray-800" aria-hidden="true">{emojiFor(item)}</span>
        <div><p className="font-display text-3xl font-bold leading-none text-gray-900 dark:text-white">{stockWords(item.qty, item.pack)}</p><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">left · warn at {item.alertAt == null ? '—' : stockWords(item.alertAt, item.pack)} · <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-extrabold uppercase ${CHIP[item.status].cls}`}>{CHIP[item.status].label}</span></p></div>
      </div>
      {history && (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-gray-50 p-3 dark:bg-gray-800"><p className="font-display text-xl font-bold text-gray-900 dark:text-white">{history.week.sold}</p><p className="text-xs text-gray-500 dark:text-gray-400">sold this week</p></div>
            <div className="rounded-2xl bg-gray-50 p-3 dark:bg-gray-800"><p className="font-display text-xl font-bold text-gray-900 dark:text-white">{history.week.delivered}</p><p className="text-xs text-gray-500 dark:text-gray-400">delivered</p></div>
            <div className="rounded-2xl bg-gray-50 p-3 dark:bg-gray-800"><p className="font-display text-xl font-bold text-red-600 dark:text-red-400">{history.week.missing}</p><p className="text-xs text-gray-500 dark:text-gray-400">missing</p></div>
          </div>
          <p className="mb-1 mt-4 text-xs font-bold uppercase tracking-wider text-gray-400">History</p>
          <div className="divide-y divide-gray-100 rounded-2xl border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
            {history.movements.length === 0 && <p className="p-3 text-sm text-gray-500">Nothing yet.</p>}
            {history.movements.map((m) => {
              const l = line(m);
              return (
                <div key={m.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
                  <span className="min-w-0"><span className="block text-gray-800 dark:text-gray-100">{l.text}</span><span className="text-xs text-gray-400">{time(m.createdAt)}</span></span>
                  <span className={`flex-none font-bold tabular-nums ${l.cls}`}>{l.value}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
      <button onClick={stop} className="mt-4 w-full rounded-2xl border border-gray-200 py-3 text-sm font-bold text-gray-600 dark:border-gray-700 dark:text-gray-300">Stop tracking this item</button>
    </Sheet>
  );
}

// ─── Kitchen, in money ────────────────────────────────────────────────────────
type Kitchen = {
  range: 'tonight' | 'week'; soldRwf: number; spentRwf: number; profitRwf: number; spentPct: number | null;
  spends: { id: string; amountRwf: number; note: string | null; spentAt: string }[];
  categories: { all: string[]; kitchen: string[] };
};
const QUICK = ['Market', 'Butcher', 'Vegetables', 'Gas', 'Other'];

function KitchenPanel({ venueId, onToast }: { venueId: string; onToast: (m: string) => void }) {
  const req = useReq();
  const [range, setRange] = useState<'tonight' | 'week'>('week');
  const [k, setK] = useState<Kitchen | null>(null);
  const [adding, setAdding] = useState(false);
  const [editCats, setEditCats] = useState(false);
  const load = useCallback(() => { req.get(`/stock/${venueId}/kitchen`, { range }).then((r) => setK(r.data.data)).catch(() => {}); }, [venueId, range]);
  useEffect(load, [load]);
  const remove = async (id: string) => { await req.del(`/stock/${venueId}/kitchen/spend/${id}`).catch(() => {}); load(); };
  return (
    <div className="mt-4">
      <div className="flex gap-1.5">
        {(['tonight', 'week'] as const).map((r) => (
          <button key={r} onClick={() => setRange(r)} className={`rounded-full px-3.5 py-1.5 text-sm font-bold ${range === r ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'border border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300'}`}>{r === 'tonight' ? 'Tonight' : 'Last 7 days'}</button>
        ))}
      </div>
      {k === null ? <div className="mt-4 h-40 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" /> : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2.5">
            <div className="rounded-2xl border border-gray-200 bg-white p-3.5 dark:border-gray-800 dark:bg-gray-900"><p className="font-display text-xl font-bold text-gray-900 dark:text-white">{k.spentRwf.toLocaleString('en-US')}</p><p className="text-xs font-semibold text-gray-500 dark:text-gray-400">spent on food</p></div>
            <div className="rounded-2xl border border-gray-200 bg-white p-3.5 dark:border-gray-800 dark:bg-gray-900"><p className="font-display text-xl font-bold text-gray-900 dark:text-white">{k.soldRwf.toLocaleString('en-US')}</p><p className="text-xs font-semibold text-gray-500 dark:text-gray-400">food sold</p></div>
            <div className="rounded-2xl border border-gray-200 bg-white p-3.5 dark:border-gray-800 dark:bg-gray-900"><p className={`font-display text-xl font-bold ${k.profitRwf < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>{k.profitRwf.toLocaleString('en-US')}</p><p className="text-xs font-semibold text-gray-500 dark:text-gray-400">left after buying food</p></div>
          </div>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {k.soldRwf === 0 ? 'No food sold in Skuzi yet for this period. ' : ''}All amounts in RWF.
          </p>

          <button onClick={() => setAdding(true)} className="mt-4 w-full rounded-2xl bg-action py-3.5 font-extrabold text-action-ink">+ Add food you bought</button>

          <p className="mb-1 mt-5 text-xs font-bold uppercase tracking-wider text-gray-400">Spending</p>
          <div className="divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
            {k.spends.length === 0 && <p className="p-3.5 text-sm text-gray-500">Nothing logged yet. Add what you spend at the market or the butcher.</p>}
            {k.spends.map((x) => (
              <div key={x.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
                <span className="min-w-0"><span className="block font-semibold text-gray-800 dark:text-gray-100">{x.note ?? 'Food'}</span><span className="text-xs text-gray-400">{time(x.spentAt)}</span></span>
                <span className="flex items-center gap-2"><span className="font-bold tabular-nums text-gray-900 dark:text-white">{x.amountRwf.toLocaleString('en-US')}</span>
                  <button onClick={() => remove(x.id)} aria-label={`Remove ${x.note ?? 'spending'}`} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-800"><Trash2 size={15} /></button></span>
              </div>
            ))}
          </div>

          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
            Counts as food: {k.categories.kitchen.length ? k.categories.kitchen.join(', ') : 'nothing yet'} ·{' '}
            <button onClick={() => setEditCats(true)} className="font-bold text-brand-600 underline dark:text-brand-300">Change</button>
          </p>
        </>
      )}
      {adding && <SpendSheet venueId={venueId} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); onToast('Spending added'); }} />}
      {editCats && k && <CategorySheet venueId={venueId} k={k} onClose={() => setEditCats(false)} onSaved={() => { setEditCats(false); load(); }} />}
    </div>
  );
}

function SpendSheet({ venueId, onClose, onSaved }: { venueId: string; onClose: () => void; onSaved: () => void }) {
  const req = useReq();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('Market');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    setSaving(true); setError('');
    try { await req.post(`/stock/${venueId}/kitchen/spend`, { amountRwf: Number(amount), note }); onSaved(); }
    catch (e: any) { setError(e?.response?.data?.error ?? 'Could not save. Try again.'); } finally { setSaving(false); }
  };
  return (
    <Sheet title="Food spending" onClose={onClose}>
      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400" htmlFor="spend-amount">How much (RWF)</label>
      <input id="spend-amount" inputMode="numeric" autoFocus value={amount ? Number(amount).toLocaleString('en-US') : ''} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} placeholder="e.g. 85,000" className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 font-display text-2xl font-bold text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
      <p className="mb-1 mt-4 text-xs font-bold text-gray-500 dark:text-gray-400">What for</p>
      <div className="flex flex-wrap gap-1.5">
        {QUICK.map((q) => <button key={q} type="button" onClick={() => setNote(q)} className={`rounded-full px-3 py-1.5 text-sm font-bold ${note === q ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'border border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300'}`}>{q}</button>)}
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note" className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
      <button onClick={save} disabled={saving || !amount} className="mt-4 w-full rounded-2xl bg-action py-3.5 font-extrabold text-action-ink disabled:opacity-50">{saving ? 'Saving…' : 'Add'}</button>
    </Sheet>
  );
}

function CategorySheet({ venueId, k, onClose, onSaved }: { venueId: string; k: Kitchen; onClose: () => void; onSaved: () => void }) {
  const req = useReq();
  const [picked, setPicked] = useState<string[]>(k.categories.kitchen);
  const save = async () => { await req.put(`/stock/${venueId}/kitchen/categories`, { categories: picked }).catch(() => {}); onSaved(); };
  return (
    <Sheet title="What counts as food" onClose={onClose}>
      <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">Tick the menu categories made in the kitchen. Drinks stay with the bar.</p>
      <div className="flex flex-col gap-2">
        {k.categories.all.map((c) => (
          <label key={c} className="flex cursor-pointer items-center justify-between rounded-2xl border border-gray-200 px-3.5 py-3 dark:border-gray-800">
            <span className="font-bold text-gray-900 dark:text-white">{c}</span>
            <input type="checkbox" className="h-5 w-5 accent-[#BF4A1A]" checked={picked.includes(c)} onChange={(e) => setPicked(e.target.checked ? [...picked, c] : picked.filter((x) => x !== c))} />
          </label>
        ))}
      </div>
      <button onClick={save} className="mt-4 w-full rounded-2xl bg-action py-3.5 font-extrabold text-action-ink">Save</button>
    </Sheet>
  );
}
