import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { LogOut, Volume2, VolumeX } from "lucide-react";
import type { WsEvent } from "@tabpro/shared";
import { useWebSocket } from "../../hooks/useWebSocket";
import { apiFetch } from "../../lib/apiFetch";

// The kitchen screen (Bar+): food tickets only, oldest first. The chef taps
// Start (the guest sees "Preparing"), then Ready (the waiter is told to pick it
// up, the guest that it's on its way). "Not available" takes an item off the
// bill and tells the guest and the waiter.

interface Ticket {
  orderId: string;
  tabId: string;
  tableLabel: string;
  status: "new" | "preparing" | "ready";
  placedAt: string;
  items: { id: string; name: string; quantity: number }[];
}

const minutes = (iso: string, now: number) => Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));

// A short double beep for a new ticket.
function beep() {
  try {
    const ctx = new AudioContext();
    [0, 0.22].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.25, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.18);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.2);
    });
  } catch {
    /* no sound on this device */
  }
}

export default function Kitchen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const venueId = params.get("venueId") || localStorage.getItem("tabpro_staff_venue") || "";
  const token = params.get("token") || localStorage.getItem("tabpro_staff_token") || "";
  const chef = (() => {
    try {
      return (JSON.parse(localStorage.getItem("tabpro_staff_session") || "{}").name || "").split(" ")[0];
    } catch {
      return "";
    }
  })();

  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [sound, setSound] = useState(false);
  const [offItem, setOffItem] = useState<{ ticket: Ticket; item: Ticket["items"][number] } | null>(null);
  const [soldOut, setSoldOut] = useState(false);
  const seen = useRef<Set<string> | null>(null);
  const soundRef = useRef(sound);
  soundRef.current = sound;

  const auth = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    if (!venueId || !token) return;
    try {
      const res = await apiFetch(`/kitchen/${venueId}/tickets`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Could not load the tickets.");
        setTickets([]);
        return;
      }
      setError("");
      const list: Ticket[] = data.data;
      // Beep for tickets we haven't seen yet (not on the first load).
      if (seen.current && soundRef.current && list.some((t) => t.status === "new" && !seen.current!.has(t.orderId))) beep();
      seen.current = new Set(list.map((t) => t.orderId));
      setTickets(list);
    } catch {
      setError("No connection. Retrying…");
    }
  }, [venueId, token]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 30000);
    const tick = setInterval(() => setNow(Date.now()), 15000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [load]);

  useWebSocket({
    venueId,
    token: token || undefined,
    enabled: !!venueId && !!token,
    onEvent: (event: WsEvent) => {
      if (["new_order", "kitchen_update", "item_unavailable", "tab_closed"].includes(event.type)) load();
    },
  });

  const act = async (path: string, key: string, body?: unknown) => {
    setBusy(key);
    try {
      const res = await apiFetch(path, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!data.success) setError(data.error || "That didn't work. Try again.");
      await load();
    } catch {
      setError("No connection. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const signOut = () => {
    ["tabpro_staff_session", "tabpro_staff_token", "tabpro_staff_id", "tabpro_staff_venue"].forEach((k) => localStorage.removeItem(k));
    navigate("/waiter", { replace: true });
  };

  if (!venueId || !token) {
    return (
      <div className="min-h-screen bg-[#2B1838] text-white flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-display text-2xl font-bold">Sign in to see the kitchen tickets</p>
        <button onClick={() => navigate("/waiter")} className="rounded-2xl bg-[#E2602A] px-6 py-3 font-extrabold">Sign in</button>
      </div>
    );
  }

  const open = tickets?.filter((t) => t.status !== "ready") ?? [];
  const done = tickets?.filter((t) => t.status === "ready") ?? [];

  return (
    <div className="min-h-screen bg-[#2B1838] text-white">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-[#2B1838]/95 px-4 py-3 backdrop-blur sm:px-6">
        <div>
          <p className="font-display text-2xl font-bold leading-none">🔥 Kitchen</p>
          <p className="mt-1 text-sm font-semibold text-[#D9C6E6]">
            {open.length} {open.length === 1 ? "ticket" : "tickets"}
            {chef && ` · ${chef}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (!sound) beep();
              setSound(!sound);
            }}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold ${sound ? "bg-white/10 text-white" : "bg-[#FFD966] text-gray-900"}`}
          >
            {sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
            {sound ? "Sound on" : "Turn on sound"}
          </button>
          <button onClick={signOut} aria-label="Sign out" className="rounded-xl bg-white/10 p-2.5 text-white/80">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {error && <p role="alert" className="mx-4 mb-2 rounded-xl bg-red-500/15 px-4 py-2.5 text-sm font-semibold text-red-200 sm:mx-6">{error}</p>}

      <main className="px-4 pb-10 sm:px-6">
        {tickets === null ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-white/10" />)}
          </div>
        ) : open.length === 0 && done.length === 0 ? (
          <div className="mt-24 text-center">
            <p className="text-5xl">🍳</p>
            <p className="mt-3 font-display text-2xl font-bold">No food orders right now</p>
            <p className="mt-1 text-[#D9C6E6]">New ones show up here by themselves. Drinks go to the waiters.</p>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {open.map((t) => {
                const mins = minutes(t.placedAt, now);
                return (
                  <div key={t.orderId} className={`flex flex-col gap-3 rounded-2xl bg-white p-4 text-gray-900 ${t.status === "new" ? "outline outline-[3px] outline-[#FFD966]" : ""}`}>
                    <div className="flex items-center justify-between">
                      <p className="font-display text-2xl font-bold">{t.tableLabel}</p>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${mins >= 15 ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"}`}>
                        {mins < 1 ? "just now" : `${mins} min`}
                      </span>
                    </div>
                    {t.status === "preparing" && <p className="-mt-2 text-[11px] font-extrabold uppercase tracking-wider text-[#BF4A1A]">Preparing</p>}
                    <ul className="flex flex-col gap-1">
                      {t.items.map((it) => (
                        <li key={it.id} className="flex items-center gap-2 py-0.5">
                          <span className="min-w-[30px] font-display text-lg font-extrabold text-[#BF4A1A]">{it.quantity}×</span>
                          <span className="flex-1 text-[17px] font-bold">{it.name}</span>
                          <button
                            onClick={() => {
                              setSoldOut(false);
                              setOffItem({ ticket: t, item: it });
                            }}
                            className="rounded-lg px-2 py-1 text-xs font-bold text-gray-400 hover:bg-gray-100 hover:text-red-600"
                          >
                            Not available
                          </button>
                        </li>
                      ))}
                    </ul>
                    {t.status === "new" ? (
                      <button
                        onClick={() => act(`/kitchen/orders/${t.orderId}/start`, t.orderId)}
                        disabled={busy === t.orderId}
                        className="h-14 rounded-xl bg-gray-900 text-lg font-extrabold text-white active:scale-[0.98] disabled:opacity-50"
                      >
                        {busy === t.orderId ? "…" : "Start"}
                      </button>
                    ) : (
                      <button
                        onClick={() => act(`/kitchen/orders/${t.orderId}/ready`, t.orderId)}
                        disabled={busy === t.orderId}
                        className="h-14 rounded-xl bg-[#5E7A55] text-lg font-extrabold text-white active:scale-[0.98] disabled:opacity-50"
                      >
                        {busy === t.orderId ? "…" : "Ready ✓"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {done.length > 0 && (
              <>
                <p className="mt-8 mb-2 text-xs font-extrabold uppercase tracking-wider text-[#D9C6E6]">Ready · waiter told</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {done.map((t) => (
                    <div key={t.orderId} className="rounded-2xl bg-white/10 px-4 py-3">
                      <p className="font-bold">{t.tableLabel} ✓</p>
                      <p className="truncate text-sm text-[#D9C6E6]">{t.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>

      {offItem && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={() => setOffItem(null)}>
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 text-gray-900" onClick={(e) => e.stopPropagation()}>
            <p className="font-display text-xl font-bold">
              Take {offItem.item.quantity}× {offItem.item.name} off?
            </p>
            <p className="mt-1 text-sm text-gray-500">
              It comes off {offItem.ticket.tableLabel}'s bill. The guest and the waiter are told right away.
            </p>
            <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl bg-gray-50 px-3 py-3 text-sm font-semibold">
              <input type="checkbox" checked={soldOut} onChange={(e) => setSoldOut(e.target.checked)} className="h-5 w-5 accent-[#BF4A1A]" />
              Also mark it sold out (hidden from the menu until the owner turns it back on)
            </label>
            <div className="mt-4 flex gap-2">
              <button
                onClick={async () => {
                  const { item } = offItem;
                  setOffItem(null);
                  await act(`/kitchen/items/${item.id}/unavailable`, item.id, { soldOut });
                }}
                className="h-12 flex-1 rounded-xl bg-red-600 font-extrabold text-white"
              >
                Take it off
              </button>
              <button onClick={() => setOffItem(null)} className="h-12 rounded-xl border border-gray-200 px-5 font-bold text-gray-600">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
