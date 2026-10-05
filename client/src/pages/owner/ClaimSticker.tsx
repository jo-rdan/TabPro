import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { QrCode, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../lib/auth';
import api from '../../lib/api';

// Reached by scanning a physical, pre-printed blank clock-in sticker with the
// phone's camera — the sticker's QR just encodes /claim-sticker?code=AB3X9K.
// This page binds that code to the owner's venue, once, permanently.
export default function ClaimSticker() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const code = searchParams.get('code') || '';
  const { venues, fetchMe } = useAuthStore();
  const venue = venues[0];

  const [status, setStatus] = useState<'confirm' | 'claiming' | 'success' | 'error'>('confirm');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!venue) fetchMe();
  }, []);

  const handleClaim = async () => {
    if (!venue || !code) return;
    setStatus('claiming');
    setError('');
    try {
      await api.post(`/clockin/claim/${venue.id}`, { code });
      setStatus('success');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to claim this sticker.');
      setStatus('error');
    }
  };

  if (!code) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#1C1511] px-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">This link is missing a sticker code.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#1C1511] px-4">
      <div className="w-full max-w-sm bg-white dark:bg-[#2B201B] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 text-center shadow-xl">
        {status === 'confirm' && (
          <>
            <div className="w-12 h-12 bg-brand-50 dark:bg-brand-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <QrCode size={20} className="text-brand-500" />
            </div>
            <h1 className="text-base font-bold text-gray-900 dark:text-white mb-1">Claim this sticker?</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              Code <span className="font-mono font-semibold text-gray-700 dark:text-gray-300">{code}</span>
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
              This will permanently bind this sticker to{' '}
              <span className="font-semibold">{venue?.name || 'your venue'}</span>. It can't be reassigned
              afterwards, so only do this with the sticker you're about to stick up at your entrance.
            </p>
            <button
              onClick={handleClaim}
              disabled={!venue}
              className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
            >
              Claim for {venue?.name || 'my venue'}
            </button>
          </>
        )}

        {status === 'claiming' && (
          <div className="py-4">
            <Loader2 size={36} className="text-brand-500 animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Claiming sticker...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="py-4">
            <CheckCircle size={40} className="text-green-500 mx-auto mb-4" />
            <h1 className="text-base font-bold text-gray-900 dark:text-white mb-2">Sticker claimed!</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
              Peel it off and stick it at your venue entrance. It never changes again.
            </p>
            <button
              onClick={() => navigate('/shifts')}
              className="w-full bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
            >
              Go to Shifts
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="py-4">
            <XCircle size={40} className="text-red-500 mx-auto mb-4" />
            <h1 className="text-base font-bold text-gray-900 dark:text-white mb-2">Couldn't claim it</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">{error}</p>
            <button
              onClick={() => setStatus('confirm')}
              className="w-full border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 font-semibold py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
