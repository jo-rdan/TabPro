import { useState, useEffect } from 'react';
import { Send, Users, MessageSquare, Lock, TrendingUp } from 'lucide-react';
import Layout from '../../components/Layout';
import { useAuthStore } from '../../lib/auth';
import api from '../../lib/api';

interface Campaign {
  id: string;
  message: string;
  status: string;
  sentAt: string | null;
  recipientCount: number;
  returnVisits: number;
}

export default function Campaigns() {
  const { venues, fetchMe } = useAuthStore();
  const venue = venues[0];
  const isPro = venue?.plan === 'pro' || venue?.plan === 'elite';

  useEffect(() => {
    if (!venue) fetchMe();
  }, []);

  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const maxChars = 160;

  useEffect(() => {
    const fetchData = async () => {
      if (!venue) return;
      try {
        const [audienceRes, campaignsRes] = await Promise.all([
          api.get(`/campaigns/audience/${venue.id}`),
          api.get(`/campaigns/${venue.id}`),
        ]);
        setAudienceCount(audienceRes.data.data.count);
        setCampaigns(campaignsRes.data.data);
      } catch { /* silent */ }
      finally { setLoading(false); }
    };
    fetchData();
  }, [venue]);

  const handleCreate = async () => {
    if (!message.trim() || !venue) return;
    setCreating(true);
    setError('');
    try {
      const res = await api.post('/campaigns', { venueId: venue.id, message: message.trim() });
      setCampaigns((prev) => [res.data.data, ...prev]);
      setMessage('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to create campaign.');
    } finally { setCreating(false); }
  };

  const handleSend = async (campaignId: string) => {
    if (!venue) return;
    setSending(campaignId);
    setError('');
    try {
      const res = await api.post(`/campaigns/${campaignId}/send/${venue.id}`);
      const { recipientCount } = res.data.data;
      setCampaigns((prev) =>
        prev.map((c) => c.id === campaignId ? { ...c, status: 'sent', sentAt: new Date().toISOString() } : c)
      );
      alert(`Sent to ${recipientCount} customers`);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to send campaign.');
    } finally { setSending(null); }
  };

  if (!isPro) {
    return (
      <Layout>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Campaigns</h1>
        </div>
        <div className="bg-white dark:bg-[#2B201B] border border-gray-200 dark:border-gray-800 rounded-2xl p-12 text-center">
          <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock size={20} className="text-purple-500" />
          </div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white mb-2">Pro feature</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-xs mx-auto">
            Campaigns let you send messages to every customer who has ever visited your venue. Upgrade to Pro to unlock this.
          </p>
          <a
            href="/subscription"
            className="inline-block px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            View plans →
          </a>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Campaigns</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{venue?.name} · Pro</p>
      </div>

      {/* Audience stat */}
      <div className="bg-white dark:bg-[#2B201B] border border-gray-200 dark:border-gray-800 rounded-2xl p-5 mb-5 flex items-center gap-4">
        <div className="w-10 h-10 bg-brand-50 dark:bg-brand-900/20 rounded-xl flex items-center justify-center">
          <Users size={18} className="text-brand-500" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {audienceCount ?? '—'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">customers in your audience</p>
        </div>
      </div>

      {/* Compose */}
      <div className="bg-white dark:bg-[#2B201B] border border-gray-200 dark:border-gray-800 rounded-2xl p-5 mb-5">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <MessageSquare size={15} /> New campaign
        </h2>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, maxChars))}
          placeholder="e.g. Happy Friday! Come enjoy 10% off all drinks tonight at Chez Willy 🎉"
          rows={3}
          className="w-full px-4 py-3 text-sm rounded-xl bg-gray-50 dark:bg-[#1C1511] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
        />
        <div className="flex items-center justify-between mt-2">
          <span className={`text-xs ${message.length > maxChars * 0.9 ? 'text-amber-500' : 'text-gray-400'}`}>
            {message.length}/{maxChars}
          </span>
          <button
            onClick={handleCreate}
            disabled={creating || !message.trim()}
            className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors"
          >
            {creating ? 'Saving...' : 'Save draft'}
          </button>
        </div>
        {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
      </div>

      {/* Campaign list */}
      {loading && (
        <div className="flex items-center justify-center py-10">
          <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      <div className="space-y-3">
        {campaigns.map((c) => (
          <div key={c.id} className="bg-white dark:bg-[#2B201B] border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-gray-800 dark:text-gray-200 flex-1">{c.message}</p>
              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full flex-shrink-0 ${
                c.status === 'sent'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
              }`}>
                {c.status === 'sent' ? '✓ Sent' : 'Draft'}
              </span>
            </div>
            {c.sentAt && (
              <p className="text-xs text-gray-400 mt-2">
                Sent {new Date(c.sentAt).toLocaleDateString()} at {new Date(c.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
            {c.status === 'sent' && (
              <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-1.5">
                  <Users size={13} className="text-brand-500" />
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{c.recipientCount}</span>
                  <span className="text-xs text-gray-400">delivered</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <TrendingUp size={13} className="text-green-500" />
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{c.returnVisits}</span>
                  <span className="text-xs text-gray-400">returned</span>
                  {c.recipientCount > 0 && (
                    <span className="text-xs text-green-500 font-semibold">
                      ({Math.round((c.returnVisits / c.recipientCount) * 100)}%)
                    </span>
                  )}
                </div>
              </div>
            )}
            {c.status === 'draft' && (
              <button
                onClick={() => handleSend(c.id)}
                disabled={sending === c.id}
                className="mt-3 flex items-center gap-2 text-xs px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-semibold disabled:opacity-50 transition-colors hover:opacity-90"
              >
                <Send size={13} />
                {sending === c.id ? 'Sending...' : `Send to ${audienceCount ?? '...'} customers`}
              </button>
            )}
          </div>
        ))}

        {!loading && campaigns.length === 0 && (
          <div className="text-center py-10 text-sm text-gray-400 dark:text-gray-500">
            No campaigns yet. Write your first message above.
          </div>
        )}
      </div>
    </Layout>
  );
}
