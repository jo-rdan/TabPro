import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Logo from "../../components/Logo";
import { apiFetch } from "../../lib/apiFetch";

const STORAGE_KEY = "tabpro_staff_session";

interface Session {
  token: string;
  staffId: string;
  venueId: string;
  name: string;
}

export default function WaiterLogin() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [pinDigits, setPinDigits] = useState(["", "", "", ""]);
  const pinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const session: Session = JSON.parse(saved);
      navigate(
        `/waiter/orders?venueId=${session.venueId}&staffId=${session.staffId}&token=${session.token}`,
        { replace: true },
      );
    }
  }, []);

  const handlePinInput = (val: string, idx: number) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...pinDigits];
    next[idx] = val;
    setPinDigits(next);
    setError("");
    if (val && idx < 3) pinRefs.current[idx + 1]?.focus();
  };

  const handlePinKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (
      e.key === "Backspace" &&
      idx > 0 &&
      !(e.target as HTMLInputElement).value
    ) {
      pinRefs.current[idx - 1]?.focus();
    }
  };

  const handleLogin = async () => {
    const pin = pinDigits.join("");
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
        setPinDigits(["", "", "", ""]);
        setTimeout(() => pinRefs.current[0]?.focus(), 50);
        return;
      }
      const session: Session = data.data;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      localStorage.setItem("tabpro_staff_token", session.token);
      localStorage.setItem("tabpro_staff_id", session.staffId);
      localStorage.setItem("tabpro_staff_venue", session.venueId);
      sessionStorage.setItem("tabpro_pin_unlocked", "1");
      navigate(
        `/waiter/orders?venueId=${session.venueId}&staffId=${session.staffId}&token=${session.token}`,
        { replace: true },
      );
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // Auto-submit when all 4 digits entered
  useEffect(() => {
    if (pinDigits.join("").length === 4) handleLogin();
  }, [pinDigits]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#1C1511] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <Logo />
        </div>

        <div className="bg-white dark:bg-[#2B201B] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
            Waiter sign in
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Enter your phone number and PIN.
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
            {pinDigits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => {
                  pinRefs.current[i] = el;
                }}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handlePinInput(e.target.value, i)}
                onKeyDown={(e) => handlePinKeyDown(e, i)}
                className={`w-14 h-14 text-center text-2xl font-black rounded-2xl border-2 outline-none transition-all bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                  digit
                    ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20"
                    : "border-gray-200 dark:border-gray-700 focus:border-brand-400"
                }`}
              />
            ))}
          </div>

          {error && (
            <p className="text-xs text-red-500 mb-3 text-center">{error}</p>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full mt-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Don't have a PIN? Ask your manager to resend your invite link.
        </p>
      </div>
    </div>
  );
}
