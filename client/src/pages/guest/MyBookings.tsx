import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import GuestShell from "../../components/guest/GuestShell";
import { guestApi, savedBookings, dayLabel } from "../../lib/guest";

// The Bookings tab: the bookings made on this phone, upcoming first.
type B = { id: string; token: string; status: string; date: string; time: string; partySize: number; startsAt: string; venue: { name: string; slug: string } };

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Waiting", cls: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300" },
  confirmed: { label: "Confirmed", cls: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300" },
  seated: { label: "Arrived", cls: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300" },
  declined: { label: "Declined", cls: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300" },
  cancelled: { label: "Cancelled", cls: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300" },
  expired: { label: "No answer", cls: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300" },
};

export default function MyBookings() {
  const [bookings, setBookings] = useState<B[] | null>(null);

  useEffect(() => {
    const saved = savedBookings();
    Promise.all(saved.map((s) => guestApi.get(`/guests/bookings/${s.id}`, { params: { t: s.token } }).then((r) => r.data.data).catch(() => null)))
      .then((list) => setBookings((list.filter(Boolean) as B[]).sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())));
  }, []);

  const now = Date.now();
  const upcoming = (bookings ?? []).filter((b) => new Date(b.startsAt).getTime() > now - 3 * 3600e3 && ["pending", "confirmed", "seated"].includes(b.status));
  const past = (bookings ?? []).filter((b) => !upcoming.includes(b));

  return (
    <GuestShell tab="bookings">
      <div className="mx-auto max-w-xl pt-6">
        <h1 className="flex items-center gap-2 font-display text-[30px] font-extrabold tracking-[-0.02em]"><CalendarDays size={26} /> Bookings</h1>
        {bookings === null ? (
          <div className="mt-4 h-20 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-900" />
        ) : bookings.length === 0 ? (
          <div className="mt-4 rounded-2xl border-[1.5px] border-dashed border-gray-200 p-6 text-center dark:border-gray-800">
            <p className="font-bold">No bookings on this phone yet</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Find a place you like and book a table in a few taps.</p>
            <Link to="/explore" className="mt-4 inline-flex min-h-[44px] items-center rounded-full bg-action px-5 text-sm font-extrabold text-white">Find a place on Explore</Link>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-2">
            {[...upcoming, ...past].map((b) => (
              <Link key={b.id} to={`/booking/${b.id}?t=${encodeURIComponent(b.token)}`}
                className={`flex items-center gap-3 rounded-2xl border-[1.5px] border-gray-200 bg-white px-4 py-3 hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 ${past.includes(b) ? "opacity-70" : ""}`}>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{b.venue.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{dayLabel(b.date, true)} · {b.time} · {b.partySize} {b.partySize === 1 ? "person" : "people"}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${STATUS[b.status]?.cls}`}>{STATUS[b.status]?.label}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </GuestShell>
  );
}
