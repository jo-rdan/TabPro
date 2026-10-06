import { useEffect, useState } from 'react';
import { QrCode, KeyRound } from 'lucide-react';
import api from '../lib/api';

// The clock-in sticker (how new waiters join and clock in) and the venue PIN.
// Lives on the Staff page so it stays reachable while the Shifts page is hidden.
export default function ClockInSetup({ venueId, onToast }: { venueId: string; onToast?: (msg: string) => void }) {
  // Skuzi ships a pre-printed blank sticker with its own permanent code. The
  // owner claims it once (by scanning it, which opens /claim-sticker?code=...,
  // or by typing the code printed on it below) and never touches it again.
  const [stickerClaimed, setStickerClaimed] = useState(false);
  const [stickerCode, setStickerCode] = useState('');
  const [claimInput, setClaimInput] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState('');
  const [showPinForm, setShowPinForm] = useState(false);
  const [pinDigits, setPinDigits] = useState(['', '', '', '']);
  const [pinSaving, setPinSaving] = useState(false);
  const [pinError, setPinError] = useState('');

  const fetchStickerStatus = async () => {
    try {
      const res = await api.get(`/clockin/sticker/${venueId}`);
      setStickerClaimed(res.data.data.claimed);
      setStickerCode(res.data.data.code || '');
    } catch { /* silent */ }
  };

  useEffect(() => { fetchStickerStatus(); }, [venueId]);

  const handleClaimSticker = async () => {
    if (!claimInput.trim()) return;
    setClaiming(true);
    setClaimError('');
    try {
      await api.post(`/clockin/claim/${venueId}`, { code: claimInput.trim() });
      setClaimInput('');
      await fetchStickerStatus();
      onToast?.('Sticker claimed! Stick it at the entrance.');
    } catch (err: any) {
      setClaimError(err?.response?.data?.error || 'Failed to claim sticker.');
    } finally {
      setClaiming(false);
    }
  };

  const handlePinDigit = (val: string, idx: number) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...pinDigits];
    next[idx] = val;
    setPinDigits(next);
    setPinError('');
  };

  const handleSavePin = async () => {
    const pin = pinDigits.join('');
    if (pin.length !== 4) {
      setPinError('Enter all 4 digits.');
      return;
    }
    setPinSaving(true);
    setPinError('');
    try {
      await api.post(`/clockin/pin/${venueId}`, { pin });
      onToast?.('Venue PIN saved');
      setShowPinForm(false);
      setPinDigits(['', '', '', '']);
    } catch (err: any) {
      setPinError(err?.response?.data?.error || 'Failed to save PIN.');
    } finally {
      setPinSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
      <div className="bg-white dark:bg-[#2B201B] border border-gray-200 dark:border-gray-800 rounded-2xl p-5 flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <QrCode size={16} className="text-brand-500" />
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Staff sticker</h3>
        </div>
        {stickerClaimed ? (
          <>
            <div className="w-full rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200/70 dark:border-green-700/40 p-3 text-center">
              <p className="text-xs font-semibold text-green-700 dark:text-green-400">Ready · code {stickerCode}</p>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
              New waiters scan it to join your team (you approve them here), and your team scans it to clock in.
            </p>
          </>
        ) : (
          <>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Skuzi gave you a sticker for your staff. Scan it with your phone camera to set it up, or type the code printed on it.
            </p>
            <div className="w-full flex gap-2">
              <input
                type="text"
                value={claimInput}
                onChange={(e) => setClaimInput(e.target.value.toUpperCase())}
                placeholder="e.g. AB3X9K"
                className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-[#1C1511] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <button
                onClick={handleClaimSticker}
                disabled={claiming || !claimInput.trim()}
                className="px-4 py-2 text-sm font-semibold bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-xl transition-colors"
              >
                {claiming ? '...' : 'Set up'}
              </button>
            </div>
            {claimError && <p className="text-xs text-red-500 mt-2">{claimError}</p>}
            <p className="text-xs text-gray-400 mt-3">Then stick it where your staff come in. It never changes.</p>
          </>
        )}
      </div>

      <div className="bg-white dark:bg-[#2B201B] border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <KeyRound size={16} className="text-brand-500" />
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Venue PIN</h3>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Waiters enter this 4-digit PIN after scanning the sticker, to confirm they're really at your venue. Put it where staff can see it but guests can't.
        </p>
        {!showPinForm ? (
          <button
            onClick={() => setShowPinForm(true)}
            className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Set / change PIN
          </button>
        ) : (
          <div>
            <div className="flex gap-2 justify-center mb-3">
              {pinDigits.map((digit, i) => (
                <input
                  key={i}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  aria-label={`PIN digit ${i + 1}`}
                  onChange={(e) => handlePinDigit(e.target.value, i)}
                  className={`w-12 h-12 text-center text-xl font-black rounded-xl border-2 outline-none transition-all bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                    digit ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-gray-200 dark:border-gray-700 focus:border-brand-400'
                  }`}
                />
              ))}
            </div>
            {pinError && <p className="text-xs text-red-500 mb-2 text-center">{pinError}</p>}
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => { setShowPinForm(false); setPinDigits(['', '', '', '']); setPinError(''); }}
                className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400 font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePin}
                disabled={pinSaving}
                className="px-3 py-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                {pinSaving ? 'Saving…' : 'Save PIN'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
