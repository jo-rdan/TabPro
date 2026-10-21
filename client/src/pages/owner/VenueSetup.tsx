import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Store, Phone } from 'lucide-react';
import Logo from '../../components/Logo';
import LogoUploader from '../../components/LogoUploader';
import api from '../../lib/api';
import { useAuthStore } from '../../lib/auth';
import { TermsSummary, AgreeBox } from '../../components/VenueTermsAgree';

export default function VenueSetup() {
  const navigate = useNavigate();
  const { fetchMe } = useAuthStore();

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [momoPayCode, setMomoPayCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [agreed, setAgreed] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Venue name is required.'); return; }
    if (momoPayCode && !/^\d{4,10}$/.test(momoPayCode)) {
      setError('A MoMo Pay code is 4 to 10 digits (or leave it empty for now).');
      return;
    }
    if (!agreed) { setError('Please tick "I agree" to the Skuzi venue terms.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/venues', {
        name: name.trim(),
        location: location.trim() || undefined,
        momoPayCode: momoPayCode || undefined,
        acceptTerms: true,
      });
      const venue = res.data.data;
      if (logoUrl && venue?.id) {
        await api.patch(`/venues/${venue.id}/logo`, { logoUrl });
      }
      await fetchMe();
      navigate('/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#2B1838] flex flex-col items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 dot-grid opacity-60 dark:opacity-100" />
      <div className="absolute inset-0 bg-radial-fade pointer-events-none" />
      <div className="relative w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <Logo size={48} className="mb-3" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Set up your venue</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 text-center">
            Takes 30 seconds. You can update everything later.
          </p>
        </div>
        <div className="bg-white dark:bg-[#3B2149] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm p-8">
          {/* Logo upload */}
          <div className="flex justify-center mb-6">
            <LogoUploader
              venueName={name || 'My Venue'}
              currentLogoUrl={logoUrl}
              onUploaded={setLogoUrl}
            />
          </div>
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Venue name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Store size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder="e.g. Chez Willy"
                className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl bg-gray-50 dark:bg-[#2B1838] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Location <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <div className="relative">
              <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder="e.g. KG 7 Ave, Kigali"
                className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl bg-gray-50 dark:bg-[#2B1838] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5" htmlFor="momo-pay-code">
              MoMo Pay code
            </label>
            <div className="relative">
              <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input id="momo-pay-code" inputMode="numeric" value={momoPayCode} onChange={(e) => setMomoPayCode(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 123456"
                className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl bg-gray-50 dark:bg-[#2B1838] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1.5">Guests pay this code straight from their bill: 100% goes to you. No code yet? Leave it empty and add it later in Plan.</p>
          </div>
          <TermsSummary />
          <AgreeBox checked={agreed} onChange={(v) => { setAgreed(v); if (v) setError(''); }} />
          {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
          <button onClick={handleSubmit} disabled={loading || !agreed}
            className="mt-4 w-full py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-colors disabled:opacity-50">
            {loading ? 'Setting up...' : 'Create my venue →'}
          </button>
        </div>
        <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-6">Free to use. Skuzi only earns when customers pay through the app.</p>
      </div>
    </div>
  );
}
