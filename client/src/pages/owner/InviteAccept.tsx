import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import Logo from '../../components/Logo';

type Status = 'loading' | 'set-pin' | 'success' | 'error';

export default function InviteAccept() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<Status>('loading');
  const [staffName, setStaffName] = useState('');
  const [error, setError] = useState('');
  const [staffJwt, setStaffJwt] = useState('');
  const [venueId, setVenueId] = useState('');

  // PIN state
  const [pin, setPin] = useState(['', '', '', '']);
  const [confirmPin, setConfirmPin] = useState(['', '', '', '']);
  const [pinStep, setPinStep] = useState<'enter' | 'confirm'>('enter');
  const [pinError, setPinError] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const confirmRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const accept = async () => {
      try {
        const res = await fetch(`/api/staff/invite/${token}`);
        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        const { staff, token: jwt } = data.data;
        setStaffName(staff.name);
        setStaffJwt(jwt);
        setVenueId(staff.venueId);

        localStorage.setItem('tabpro_staff_token', jwt);
        localStorage.setItem('tabpro_staff_venue', staff.venueId);
        localStorage.setItem('tabpro_staff_id', staff.id);

        setStatus('set-pin');
        setTimeout(() => inputRefs.current[0]?.focus(), 100);
      } catch (err: any) {
        setError(err.message || 'This invite link is invalid or has already been used.');
        setStatus('error');
      }
    };
    if (token) accept();
  }, [token]);

  const handlePinInput = (
    val: string,
    idx: number,
    arr: string[],
    setArr: (a: string[]) => void,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>
  ) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...arr];
    next[idx] = val;
    setArr(next);
    if (val && idx < 3) refs.current[idx + 1]?.focus();
  };

  const handlePinKeyDown = (
    e: React.KeyboardEvent,
    idx: number,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>
  ) => {
    if (e.key === 'Backspace' && idx > 0 && !(e.target as HTMLInputElement).value) {
      refs.current[idx - 1]?.focus();
    }
  };

  const handlePinSubmit = async () => {
    const pinStr = pin.join('');
    if (pinStr.length < 4) { setPinError('Enter all 4 digits'); return; }

    if (pinStep === 'enter') {
      setPinStep('confirm');
      setConfirmPin(['', '', '', '']);
      setPinError('');
      setTimeout(() => confirmRefs.current[0]?.focus(), 50);
      return;
    }

    const confirmStr = confirmPin.join('');
    if (confirmStr !== pinStr) {
      setPinError('PINs do not match. Try again.');
      setConfirmPin(['', '', '', '']);
      setTimeout(() => confirmRefs.current[0]?.focus(), 50);
      return;
    }

    setSaving(true);
    setPinError('');
    try {
      const res = await fetch('/api/staff/me/set-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffJwt}` },
        body: JSON.stringify({ pin: pinStr }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setStatus('success');
      setTimeout(() => {
        localStorage.setItem('tabpro_staff_session', JSON.stringify({ token: staffJwt, staffId: staff.id, venueId, name: staff.name }));
        window.location.href = `/waiter/orders?venueId=${venueId}&staffId=${staff.id}&token=${staffJwt}`;
      }, 1500);
    } catch (err: any) {
      setPinError(err.message || 'Failed to set PIN.');
    } finally {
      setSaving(false);
    }
  };

  const PinInputs = ({
    value, onChange, refs,
  }: {
    value: string[];
    onChange: (val: string, idx: number) => void;
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>;
  }) => (
    <div className="flex gap-3 justify-center my-6">
      {value.map((digit, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="password"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => onChange(e.target.value, i)}
          onKeyDown={(e) => handlePinKeyDown(e, i, refs)}
          className={`w-14 h-14 text-center text-2xl font-black rounded-2xl border-2 outline-none transition-all bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white ${
            digit
              ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
              : 'border-gray-200 dark:border-gray-700 focus:border-brand-400'
          }`}
        />
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0D1117] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <Logo size={48} className="mx-auto mb-6" />

        {status === 'loading' && (
          <>
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Verifying your invite...</p>
          </>
        )}

        {status === 'set-pin' && (
          <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-gray-800 rounded-2xl p-8">
            <div className="text-4xl mb-3">🔐</div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
              Welcome, {staffName}!
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {pinStep === 'enter'
                ? 'Set a 4-digit PIN to secure your account.'
                : 'Confirm your PIN to make sure you remember it.'}
            </p>

            {pinStep === 'enter' ? (
              <PinInputs
                value={pin}
                onChange={(val, idx) => handlePinInput(val, idx, pin, setPin, inputRefs)}
                refs={inputRefs}
              />
            ) : (
              <PinInputs
                value={confirmPin}
                onChange={(val, idx) => handlePinInput(val, idx, confirmPin, setConfirmPin, confirmRefs)}
                refs={confirmRefs}
              />
            )}

            {pinError && <p className="text-sm text-red-500 mb-3">{pinError}</p>}

            <button
              onClick={handlePinSubmit}
              disabled={saving || (pinStep === 'enter' ? pin.join('').length < 4 : confirmPin.join('').length < 4)}
              className="w-full py-3 rounded-2xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
            >
              {saving
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : pinStep === 'enter' ? 'Continue →' : 'Set PIN & enter app'
              }
            </button>
          </div>
        )}

        {status === 'success' && (
          <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-gray-800 rounded-2xl p-8">
            <div className="text-4xl mb-4">✅</div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white mb-2">PIN set!</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Taking you to your orders...</p>
            <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        )}

        {status === 'error' && (
          <div className="bg-white dark:bg-[#161B22] border border-red-200/70 dark:border-red-700/40 rounded-2xl p-8">
            <div className="text-4xl mb-4">❌</div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Invite not valid</h1>
            <p className="text-sm text-red-500">{error}</p>
            <p className="text-xs text-gray-400 mt-3">Ask your owner to generate a new invite link.</p>
          </div>
        )}
      </div>
    </div>
  );
}
