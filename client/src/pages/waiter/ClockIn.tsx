import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Clock, CheckCircle, LogOut, UserPlus } from "lucide-react";
import Logo from "../../components/Logo";
import { apiFetch } from "../../lib/apiFetch";

const STORAGE_KEY = "tabpro_staff_session";

interface Session {
  token: string;
  staffId: string;
  venueId: string;
  name: string;
}

interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
}

interface ClockStatus {
  clockedIn: boolean;
  shiftId?: string;
  shiftName?: string;
  clockedInAt?: string;
}

type ScreenState = "resolving" | "expired" | "login" | "picker" | "pin" | "active" | "done" | "join" | "joined";

export default function ClockIn() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code");

  const [screen, setScreen] = useState<ScreenState>("resolving");
  const [session, setSession] = useState<Session | null>(null);

  // One-time scan session (born the moment the sticker is scanned; 90s TTL)
  const [sessionToken, setSessionToken] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Login fields (reuse waiter PIN login)
  const [phone, setPhone] = useState("");
  const [loginPinDigits, setLoginPinDigits] = useState(["", "", "", ""]);
  const loginPinRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Shift picker + venue PIN
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState("");
  const [venuePinDigits, setVenuePinDigits] = useState(["", "", "", ""]);
  const venuePinRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [doneMessage, setDoneMessage] = useState("");

  // Join request (waiter not on the team yet)
  const [joinName, setJoinName] = useState("");
  const [joinPin, setJoinPin] = useState("");
  const [joinedVenue, setJoinedVenue] = useState("");
  // A brand-new sticker nobody has set up yet: offer the owner to claim it.
  const [unclaimed, setUnclaimed] = useState(false);

  // ── Step 1: scanning the sticker mints a fresh 90s one-time session ───────────
  useEffect(() => {
    if (!code) {
      setError("Missing QR code data.");
      setScreen("expired");
      return;
    }
    apiFetch("/clockin/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) {
          if (/invalid clock-in sticker/i.test(data.error ?? "")) setUnclaimed(true);
          setError(data.error || "This sticker isn't recognized.");
          setScreen("expired");
          return;
        }
        setSessionToken(data.data.sessionToken);
        startCountdown(data.data.expiresIn);
        checkExistingSession();
      })
      .catch(() => {
        setError("Something went wrong reading the QR code.");
        setScreen("expired");
      });
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [code]);

  function startCountdown(seconds: number) {
    setSecondsLeft(seconds);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          // Joining has no time limit — the request needs the owner's approval anyway.
          setScreen((cur) => (["active", "done", "join", "joined"].includes(cur) ? cur : "expired"));
          setError("Your 90 seconds ran out. Scan the sticker again.");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  function checkExistingSession() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const s: Session = JSON.parse(saved);
      setSession(s);
      loadMyShifts(s);
    } else {
      setScreen("login");
    }
  }

  // ── Step 2 (if not logged in): phone + PIN login ──────────────────────────────

  const handleLoginPinInput = (val: string, idx: number) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...loginPinDigits];
    next[idx] = val;
    setLoginPinDigits(next);
    setError("");
    if (val && idx < 3) loginPinRefs.current[idx + 1]?.focus();
  };

  const handleLoginPinKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === "Backspace" && idx > 0 && !(e.target as HTMLInputElement).value) {
      loginPinRefs.current[idx - 1]?.focus();
    }
  };

  useEffect(() => {
    if (screen === "login" && loginPinDigits.join("").length === 4) handleLogin();
  }, [loginPinDigits]);

  async function handleLogin() {
    const pin = loginPinDigits.join("");
    if (!phone.trim() || pin.length !== 4) {
      setError("Enter your phone number and 4-digit PIN.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), pin }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Incorrect phone number or PIN.");
        setLoginPinDigits(["", "", "", ""]);
        setTimeout(() => loginPinRefs.current[0]?.focus(), 50);
        return;
      }
      const s: Session = data.data;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
      setSession(s);
      loadMyShifts(s);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Step 3: load shifts assigned to this staff member + their clock status ────

  async function loadMyShifts(s: Session) {
    setLoading(true);
    try {
      const res = await apiFetch("/clockin/my-shifts", {
        headers: { Authorization: `Bearer ${s.token}` },
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Could not load your shifts.");
        return;
      }
      const status: ClockStatus = data.data.status;
      if (status.clockedIn) {
        setSelectedShiftId(status.shiftId!);
        setScreen("active");
      } else {
        const myShifts: Shift[] = data.data.shifts;
        setShifts(myShifts);
        if (myShifts.length === 0) {
          setError("You have no shifts assigned. Ask your manager to add you to a shift.");
          setScreen("expired");
        } else if (myShifts.length === 1) {
          setSelectedShiftId(myShifts[0].id);
          setScreen("pin");
        } else {
          setScreen("picker");
        }
      }
    } catch {
      setError("Something went wrong loading your shifts.");
    } finally {
      setLoading(false);
    }
  }

  // ── Step 4: enter venue PIN, submit clock-in ───────────────────────────────────

  const handleVenuePinInput = (val: string, idx: number) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...venuePinDigits];
    next[idx] = val;
    setVenuePinDigits(next);
    setError("");
    if (val && idx < 3) venuePinRefs.current[idx + 1]?.focus();
  };

  const handleVenuePinKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === "Backspace" && idx > 0 && !(e.target as HTMLInputElement).value) {
      venuePinRefs.current[idx - 1]?.focus();
    }
  };

  useEffect(() => {
    if (screen === "pin" && venuePinDigits.join("").length === 4) submitClockIn();
  }, [venuePinDigits]);

  async function submitClockIn() {
    if (!session) return;
    const pin = venuePinDigits.join("");
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/clockin/clock-in", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ shiftId: selectedShiftId, pin, sessionToken }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Failed to clock in.");
        setVenuePinDigits(["", "", "", ""]);
        setTimeout(() => venuePinRefs.current[0]?.focus(), 50);
        return;
      }
      setDoneMessage("Clocked in successfully!");
      setScreen("done");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Join the team (waiter not registered yet) ────────────────────────────────

  async function submitJoin() {
    if (!joinName.trim() || !phone.trim() || !/^\d{4}$/.test(joinPin)) {
      setError("Enter your name, phone number and a 4-digit PIN.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/staff/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name: joinName.trim(), phone: phone.trim(), pin: joinPin }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Could not send your request.");
        return;
      }
      setJoinedVenue(data.data.venueName);
      setScreen("joined");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Clock out ───────────────────────────────────────────────────────────────────

  async function handleClockOut() {
    if (!session) return;
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/clockin/clock-out", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.token}` },
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Failed to clock out.");
        return;
      }
      setDoneMessage("Clocked out. See you next shift!");
      setScreen("done");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────────

  const selectedShift = shifts.find((s) => s.id === selectedShiftId);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#1C1511] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <Logo />
        </div>

        <div className="bg-white dark:bg-[#2B201B] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">

          {screen === "resolving" && (
            <div className="text-center py-6">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading clock-in…</p>
            </div>
          )}

          {screen === "expired" && unclaimed && (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center mx-auto mb-4">
                <Clock size={22} className="text-brand-500" />
              </div>
              <h1 className="text-base font-bold text-gray-900 dark:text-white mb-1">New clock-in sticker</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                This sticker isn't set up yet. If you're the owner, link it to your venue. Your team will then scan it to clock in and to join.
              </p>
              <a
                href={`/claim-sticker?code=${encodeURIComponent(code ?? "")}`}
                className="inline-flex w-full items-center justify-center bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
              >
                Set up this sticker
              </a>
              <p className="text-xs text-gray-400 mt-3">Waiters: ask your manager to set it up first.</p>
            </div>
          )}

          {screen === "expired" && !unclaimed && (
            <div className="text-center py-4">
              <Clock size={32} className="text-amber-500 mx-auto mb-3" />
              <h1 className="text-base font-bold text-gray-900 dark:text-white mb-1">Can't clock in</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{error}</p>
            </div>
          )}

          {screen === "login" && (
            <>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Clock in</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Sign in with your phone number and PIN first.
              </p>

              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Phone number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 0781234567"
                className="w-full px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-[#1C1511] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 mb-6"
              />

              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">
                4-digit PIN
              </label>
              <div className="flex gap-3 justify-center mb-4">
                {loginPinDigits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { loginPinRefs.current[i] = el; }}
                    type="password"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleLoginPinInput(e.target.value, i)}
                    onKeyDown={(e) => handleLoginPinKeyDown(e, i)}
                    className={`w-14 h-14 text-center text-2xl font-black rounded-2xl border-2 outline-none transition-all bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                      digit
                        ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20"
                        : "border-gray-200 dark:border-gray-700 focus:border-brand-400"
                    }`}
                  />
                ))}
              </div>

              {error && <p className="text-xs text-red-500 mb-3 text-center">{error}</p>}

              <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full mt-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
              >
                {loading ? "Signing in…" : "Continue"}
              </button>

              <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-800 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">New here and not on Skuzi yet?</p>
                <button
                  onClick={() => { setError(""); setScreen("join"); }}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700"
                >
                  <UserPlus size={15} /> Join the team
                </button>
              </div>
            </>
          )}

          {screen === "join" && (
            <>
              <div className="w-11 h-11 rounded-2xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center mb-4">
                <UserPlus size={20} className="text-brand-500" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Join the team</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Your manager gets your request and approves it with one tap.
              </p>

              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Your name</label>
              <input
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                placeholder="e.g. Eric"
                autoComplete="name"
                className="w-full px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-[#1C1511] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 mb-4"
              />

              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Phone number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 0781234567"
                className="w-full px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-[#1C1511] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 mb-4"
              />

              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Choose a 4-digit PIN <span className="font-normal text-gray-400">(you'll use it to log in)</span>
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={joinPin}
                onChange={(e) => { if (/^\d{0,4}$/.test(e.target.value)) setJoinPin(e.target.value); }}
                placeholder="••••"
                className="w-full px-4 py-2.5 text-center tracking-[0.6em] text-lg font-bold border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-[#1C1511] text-gray-900 dark:text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 mb-4"
              />

              {error && <p className="text-xs text-red-500 mb-3 text-center">{error}</p>}

              <button
                onClick={submitJoin}
                disabled={loading}
                className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
              >
                {loading ? "Sending…" : "Send request"}
              </button>
              <button
                onClick={() => { setError(""); setScreen("login"); }}
                className="w-full mt-2 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 py-2"
              >
                I already have an account
              </button>
            </>
          )}

          {screen === "joined" && (
            <div className="text-center py-4">
              <CheckCircle size={32} className="text-green-500 mx-auto mb-3" />
              <h1 className="text-base font-bold text-gray-900 dark:text-white mb-1">Request sent!</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Ask your manager to approve you in Skuzi{joinedVenue ? ` for ${joinedVenue}` : ""}.
                Then scan this sticker again and log in with your phone number and PIN.
              </p>
            </div>
          )}

          {screen === "picker" && (
            <>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                Which shift, {session?.name}?
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                You're assigned to more than one shift. Pick the one you're clocking into now.
              </p>
              <div className="space-y-2">
                {shifts.map((shift) => (
                  <button
                    key={shift.id}
                    onClick={() => { setSelectedShiftId(shift.id); setScreen("pin"); }}
                    className="w-full text-left flex items-center gap-3 px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/10 transition-colors"
                  >
                    <Clock size={16} className="text-brand-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{shift.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{shift.startTime} – {shift.endTime}</p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {screen === "pin" && (
            <>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                Confirm you're here
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                Enter the venue PIN posted at the venue to clock into{" "}
                <span className="font-semibold text-gray-700 dark:text-gray-300">{selectedShift?.name}</span>.
              </p>
              <p className={`text-xs font-semibold mb-4 ${secondsLeft <= 20 ? "text-red-500" : "text-gray-400"}`}>
                Session expires in {secondsLeft}s
              </p>

              <div className="flex gap-3 justify-center mb-4">
                {venuePinDigits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { venuePinRefs.current[i] = el; }}
                    type="password"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleVenuePinInput(e.target.value, i)}
                    onKeyDown={(e) => handleVenuePinKeyDown(e, i)}
                    className={`w-14 h-14 text-center text-2xl font-black rounded-2xl border-2 outline-none transition-all bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                      digit
                        ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20"
                        : "border-gray-200 dark:border-gray-700 focus:border-brand-400"
                    }`}
                  />
                ))}
              </div>

              {error && <p className="text-xs text-red-500 mb-3 text-center">{error}</p>}
              {loading && <p className="text-xs text-gray-400 text-center">Clocking in…</p>}
            </>
          )}

          {screen === "active" && (
            <div className="text-center py-2">
              <CheckCircle size={32} className="text-green-500 mx-auto mb-3" />
              <h1 className="text-base font-bold text-gray-900 dark:text-white mb-1">
                You're clocked in
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                {selectedShift?.name ? `Working: ${selectedShift.name}` : "Tap below to end your shift."}
              </p>
              {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
              <button
                onClick={handleClockOut}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
              >
                <LogOut size={14} />
                {loading ? "Ending shift…" : "End shift"}
              </button>
            </div>
          )}

          {screen === "done" && (
            <div className="text-center py-4">
              <CheckCircle size={32} className="text-green-500 mx-auto mb-3" />
              <h1 className="text-base font-bold text-gray-900 dark:text-white">{doneMessage}</h1>
              <p className="text-xs text-gray-400 mt-2">You can close this page now.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
