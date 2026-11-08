import { useEffect, useState } from "react";
import { Camera, Check, Copy, Plus, ScanLine } from "lucide-react";
import { apiFetch } from "../lib/apiFetch";
import QrScannerModal from "./QrScannerModal";

// A manager setting up the restaurant without the owner: menu, tables and
// stickers, the team (waiters, kitchen, cashiers) and unpaid bills, each only
// if the owner ticked it. Money stays the owner's (MoMo code, plan, reports,
// adding managers). The owner is told about every change.

type Right = "menu" | "tables" | "team" | "unpaid";
interface MenuItem { id: string; name: string; category: string; priceRwf: number; isAvailable: boolean }
interface Extracted { name: string; category: string; priceRwf: number }
interface TableRow { id: string; label: string }
interface Member { id: string; name: string; role: string; isActive: boolean }
interface OpenBill { tabId: string; tableLabel: string; total: number; phone: string | null; name: string | null; openedAt: string }

const rwf = (n: number) => `${n.toLocaleString("en-US")} RWF`;
const card = "rounded-[22px] bg-white p-4 ring-1 ring-gray-200 dark:bg-gray-800 dark:ring-0";
const input = "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white";
const primary = "h-11 rounded-xl bg-brand-500 px-4 text-sm font-extrabold text-white disabled:opacity-50";

export default function ManagerSetup({ venueId, token, rights }: { venueId: string; token: string; rights: Right[] }) {
  const can = (r: Right) => rights.includes(r);
  const auth = { Authorization: `Bearer ${token}` };
  const call = async (path: string, init: RequestInit = {}) => {
    const res = await apiFetch(path, { ...init, headers: { ...auth, ...(init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...(init.headers ?? {}) } });
    const d = await res.json().catch(() => ({ success: false }));
    if (!d.success) throw new Error(d.error || "That didn't work. Try again.");
    return d.data;
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-2xl font-bold text-gray-900 dark:text-white">Set up</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">The owner gave you these. They're told about every change. The MoMo code and the plan stay the owner's.</p>
      </div>
      {can("menu") && <MenuSection venueId={venueId} call={call} />}
      {can("tables") && <TablesSection venueId={venueId} call={call} />}
      {can("team") && <TeamSection venueId={venueId} call={call} />}
      {can("unpaid") && <UnpaidSection venueId={venueId} call={call} />}
    </div>
  );
}

type Call = (path: string, init?: RequestInit) => Promise<any>;

function MenuSection({ venueId, call }: { venueId: string; call: Call }) {
  const [items, setItems] = useState<MenuItem[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [read, setRead] = useState<Extracted[] | null>(null);
  const [adding, setAdding] = useState({ name: "", category: "Drinks", price: "" });
  const [editing, setEditing] = useState<{ id: string; price: string } | null>(null);
  const load = () => call(`/menu/${venueId}`).then((d) => setItems(d.items)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [venueId]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try { await fn(); await load(); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  const readPhoto = (file: File) => run(async () => {
    const form = new FormData();
    form.append("file", file);
    setRead(await call("/menu/extract", { method: "POST", body: form }));
  });

  return (
    <section className={card} aria-labelledby="setup-menu">
      <div className="flex items-center justify-between gap-3">
        <h3 id="setup-menu" className="text-lg font-bold text-gray-900 dark:text-white">Menu {items && <span className="text-sm font-semibold text-gray-400">· {items.length} items</span>}</h3>
        <label className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-gray-900 px-3 py-2 text-sm font-bold text-white dark:bg-white dark:text-gray-900">
          <Camera size={15} /> Snap the menu
          <input type="file" accept="image/*,application/pdf" capture="environment" className="sr-only" onChange={(e) => e.target.files?.[0] && readPhoto(e.target.files[0])} />
        </label>
      </div>
      {error && <p role="alert" className="mt-2 text-sm font-semibold text-red-600">{error}</p>}
      {busy && <p className="mt-2 text-sm text-gray-500">Working…</p>}

      {read && (
        <div className="mt-3 rounded-2xl bg-green-50 p-3 dark:bg-green-900/20">
          <p className="text-sm font-bold text-green-800 dark:text-green-300">Skuzi read {read.length} items. Check the prices, then save.</p>
          <div className="mt-2 flex max-h-72 flex-col gap-1.5 overflow-y-auto">
            {read.map((it, i) => (
              <div key={i} className="flex items-center gap-2">
                <input aria-label="Name" className={`${input} flex-1`} value={it.name} onChange={(e) => setRead(read.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))} />
                <input aria-label="Price" inputMode="numeric" className={`${input} w-28`} value={it.priceRwf || ""} onChange={(e) => setRead(read.map((r, j) => (j === i ? { ...r, priceRwf: Number(e.target.value.replace(/\D/g, "")) } : r)))} />
                <button type="button" aria-label="Remove" onClick={() => setRead(read.filter((_, j) => j !== i))} className="px-2 text-gray-400">✕</button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button className={primary} disabled={busy || read.length === 0 || read.some((r) => !r.name.trim() || !(r.priceRwf > 0))}
              onClick={() => run(async () => { await call("/menu", { method: "POST", body: JSON.stringify({ venueId, items: read.map((r) => ({ ...r, category: r.category || "Other" })) }) }); setRead(null); })}>
              Save {read.length} items
            </button>
            <button type="button" className="px-3 text-sm font-bold text-gray-500" onClick={() => setRead(null)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-col divide-y divide-gray-100 dark:divide-gray-700">
        {items?.map((it) => (
          <div key={it.id} className="flex items-center gap-2 py-2">
            <div className="min-w-0 flex-1">
              <p className={`truncate text-sm font-bold ${it.isAvailable ? "text-gray-900 dark:text-white" : "text-gray-400 line-through"}`}>{it.name}</p>
              <p className="text-xs text-gray-400">{it.category}</p>
            </div>
            {editing?.id === it.id ? (
              <>
                <input aria-label={`New price for ${it.name}`} autoFocus inputMode="numeric" className={`${input} w-24`} value={editing.price} onChange={(e) => setEditing({ id: it.id, price: e.target.value.replace(/\D/g, "") })} />
                <button aria-label="Save price" className="rounded-xl bg-green-600 p-2.5 text-white" disabled={!Number(editing.price)}
                  onClick={() => run(async () => { await call(`/menu/items/${it.id}`, { method: "PATCH", body: JSON.stringify({ name: it.name, priceRwf: Number(editing.price) }) }); setEditing(null); })}>
                  <Check size={16} />
                </button>
              </>
            ) : (
              <button className="text-sm font-bold tabular-nums text-gray-900 underline decoration-dotted dark:text-white" onClick={() => setEditing({ id: it.id, price: String(it.priceRwf) })}>{rwf(it.priceRwf)}</button>
            )}
            <button className={`rounded-lg px-2 py-1 text-xs font-bold ${it.isAvailable ? "text-gray-400" : "bg-amber-100 text-amber-800"}`}
              onClick={() => run(() => call(`/menu/items/${it.id}/toggle`, { method: "PATCH" }))}>
              {it.isAvailable ? "Sold out?" : "Sold out"}
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
        <input aria-label="New item name" placeholder="New item, e.g. Primus big" className={input} value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value })} />
        <input aria-label="Price" placeholder="Price" inputMode="numeric" className={`${input} w-28`} value={adding.price} onChange={(e) => setAdding({ ...adding, price: e.target.value.replace(/\D/g, "") })} />
        <select aria-label="Category" className={input} value={adding.category} onChange={(e) => setAdding({ ...adding, category: e.target.value })}>
          {[...new Set(["Drinks", "Food", ...(items ?? []).map((i) => i.category)])].map((c) => <option key={c}>{c}</option>)}
        </select>
        <button className={`${primary} flex items-center gap-1`} disabled={busy || !adding.name.trim() || !Number(adding.price)}
          onClick={() => run(async () => { await call("/menu", { method: "POST", body: JSON.stringify({ venueId, items: [{ name: adding.name.trim(), category: adding.category, priceRwf: Number(adding.price) }] }) }); setAdding({ ...adding, name: "", price: "" }); })}>
          <Plus size={15} /> Add
        </button>
      </div>
    </section>
  );
}

function TablesSection({ venueId, call }: { venueId: string; call: Call }) {
  const [tables, setTables] = useState<TableRow[] | null>(null);
  const [scan, setScan] = useState(false);
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => call(`/tables/${venueId}`).then(setTables).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [venueId]);

  const scanned = (c: string) => {
    setScan(false);
    setCode(c);
    apiFetch(`/tables/sticker-info?code=${encodeURIComponent(c)}`).then((r) => r.json()).then((d) => { if (d.data?.printedLabel) setLabel((cur) => cur || `Table ${d.data.printedLabel}`); }).catch(() => {});
  };
  const claim = async () => {
    setBusy(true);
    setError("");
    try {
      await call("/tables/claim-scan", { method: "POST", body: JSON.stringify({ venueId, label: label.trim(), scannedCode: code }) });
      setCode("");
      setLabel("");
      await load();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <section className={card} aria-labelledby="setup-tables">
      <div className="flex items-center justify-between gap-3">
        <h3 id="setup-tables" className="text-lg font-bold text-gray-900 dark:text-white">Tables & stickers {tables && <span className="text-sm font-semibold text-gray-400">· {tables.length}</span>}</h3>
        <button onClick={() => setScan(true)} className="flex items-center gap-1.5 rounded-xl bg-gray-900 px-3 py-2 text-sm font-bold text-white dark:bg-white dark:text-gray-900"><ScanLine size={15} /> Scan a sticker</button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm font-semibold text-red-600">{error}</p>}
      {code && (
        <div className="mt-3 flex flex-col gap-2 rounded-2xl bg-gray-50 p-3 dark:bg-gray-900">
          <p className="text-sm font-bold text-gray-900 dark:text-white">Sticker scanned. Which table is it?</p>
          <input aria-label="Table name" placeholder="e.g. Table 4, Terrace 2" className={input} value={label} onChange={(e) => setLabel(e.target.value)} />
          <div className="flex gap-2">
            <button className={primary} disabled={busy || !label.trim()} onClick={claim}>Set up this table</button>
            <button type="button" className="px-3 text-sm font-bold text-gray-500" onClick={() => setCode("")}>Cancel</button>
          </div>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {tables?.map((t) => <span key={t.id} className="rounded-full bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-200">{t.label}</span>)}
        {tables?.length === 0 && <p className="text-sm text-gray-500">No tables yet. Scan the first sticker.</p>}
      </div>
      {scan && <QrScannerModal onScanned={scanned} onClose={() => setScan(false)} />}
    </section>
  );
}

function TeamSection({ venueId, call }: { venueId: string; call: Call }) {
  const [team, setTeam] = useState<Member[] | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", role: "waiter", hasSmartphone: true });
  const [invite, setInvite] = useState<{ name: string; url: string | null } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => call(`/staff/${venueId}`).then(setTeam).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [venueId]);

  const add = async () => {
    setBusy(true);
    setError("");
    try {
      const d = await call("/staff", { method: "POST", body: JSON.stringify({ venueId, ...form, name: form.name.trim(), phone: form.phone.trim() }) });
      setInvite({ name: form.name.trim(), url: d.token ? `${window.location.origin}/invite/${d.token}` : null });
      setForm({ ...form, name: "", phone: "" });
      await load();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <section className={card} aria-labelledby="setup-team">
      <h3 id="setup-team" className="text-lg font-bold text-gray-900 dark:text-white">Team {team && <span className="text-sm font-semibold text-gray-400">· {team.filter((m) => m.isActive).length}</span>}</h3>
      {error && <p role="alert" className="mt-2 text-sm font-semibold text-red-600">{error}</p>}
      <div className="mt-3 flex flex-col gap-2">
        <input aria-label="Name" placeholder="Name" className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input aria-label="Phone" type="tel" placeholder="07XX XXX XXX" className={input} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-900">
          {(["waiter", "kitchen", "cashier"] as const).map((r) => (
            <button key={r} type="button" onClick={() => setForm({ ...form, role: r })} className={`rounded-lg py-2 text-sm font-bold capitalize ${form.role === r ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white" : "text-gray-500"}`}>{r}</button>
          ))}
        </div>
        {form.role === "waiter" && (
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={form.hasSmartphone} onChange={(e) => setForm({ ...form, hasSmartphone: e.target.checked })} className="h-4 w-4 accent-brand-500" /> Has a smartphone
          </label>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400">Only the owner adds managers.</p>
        <button className={primary} disabled={busy || !form.name.trim() || form.phone.replace(/\D/g, "").length < 9} onClick={add}>Add {form.role}</button>
      </div>
      {invite?.url && (
        <div className="mt-3 rounded-2xl bg-green-50 p-3 text-sm dark:bg-green-900/20">
          <p className="font-bold text-green-800 dark:text-green-300">Send {invite.name} this link on WhatsApp:</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="min-w-0 flex-1 select-all truncate rounded-lg bg-white px-2 py-1.5 font-mono text-xs dark:bg-gray-900">{invite.url}</span>
            <button aria-label="Copy link" className="rounded-lg bg-white p-2 dark:bg-gray-900" onClick={async () => { try { await navigator.clipboard.writeText(invite.url!); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* the link is selectable */ } }}>
              {copied ? <Check size={15} /> : <Copy size={15} />}
            </button>
          </div>
        </div>
      )}
      <div className="mt-3 flex flex-col gap-1.5">
        {team?.filter((m) => m.isActive).map((m) => (
          <div key={m.id} className="flex justify-between rounded-xl bg-gray-50 px-3 py-2 text-sm dark:bg-gray-900"><b className="text-gray-900 dark:text-white">{m.name}</b><span className="capitalize text-gray-500">{m.role}</span></div>
        ))}
      </div>
    </section>
  );
}

function UnpaidSection({ venueId, call }: { venueId: string; call: Call }) {
  const [bills, setBills] = useState<OpenBill[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { call(`/dashboard/open-bills/${venueId}`).then(setBills).catch((e) => setError(e.message)); }, [venueId]);
  return (
    <section className={card} aria-labelledby="setup-unpaid">
      <h3 id="setup-unpaid" className="text-lg font-bold text-gray-900 dark:text-white">Not paid yet {bills && <span className="text-sm font-semibold text-gray-400">· {bills.length}</span>}</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400">Bills nobody touched for hours. Call the guest if you need to.</p>
      {error && <p role="alert" className="mt-2 text-sm font-semibold text-red-600">{error}</p>}
      <div className="mt-3 flex flex-col gap-2">
        {bills?.length === 0 && <p className="text-sm text-gray-500">None forgotten.</p>}
        {bills?.map((b) => (
          <div key={b.tabId} className="flex items-center justify-between gap-3 rounded-xl bg-amber-50 px-3 py-2.5 text-sm dark:bg-amber-900/20">
            <div className="min-w-0">
              <p className="font-bold text-gray-900 dark:text-white">{b.tableLabel} · {rwf(b.total)}</p>
              {b.phone && <p className="select-all text-xs text-gray-600 dark:text-gray-300">{b.name ? `${b.name} · ` : ""}{b.phone}</p>}
            </div>
            {b.phone && <a href={`tel:${b.phone}`} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-gray-900 dark:bg-gray-900 dark:text-white">Call</a>}
          </div>
        ))}
      </div>
    </section>
  );
}
