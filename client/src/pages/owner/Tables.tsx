import { useState, useEffect } from 'react';
import { QrCode, Plus, Copy, Check, ScanLine, X } from 'lucide-react';
import Layout from '../../components/Layout';
import { useAuthStore } from '../../lib/auth';
import api from '../../lib/api';
import Toast from '../../components/Toast';
import QrScannerModal from '../../components/QrScannerModal';

// Manual "Add table" (self-serve QR generation) is off for launch — we're doing
// pre-printed sticker binding only for now. Flip this to true to bring it back.
const ENABLE_MANUAL_TABLE_CREATION = false;

interface TableRow {
  id: string;
  label: string;
  isActive: boolean;
  qrSticker: { code: string } | null;
}

export default function Tables() {
  const { venues, fetchMe } = useAuthStore();
  const venue = venues[0];

  useEffect(() => {
    if (!venue) fetchMe();
  }, []);

  const [tables, setTables] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // ── Scan QR sticker ───────────────────────────────────────────────────────
  const [showScanner, setShowScanner] = useState(false);
  const [scanModal, setScanModal] = useState(false);
  const [scannedCode, setScannedCode] = useState('');
  const [scanLabel, setScanLabel] = useState('');
  const [scanError, setScanError] = useState('');
  const [scanCreating, setScanCreating] = useState(false);

  const handleScanned = (code: string) => {
    setScannedCode(code);
    setShowScanner(false);
    setScanModal(true);
    // Stickers carry a big printed number: name the table after it.
    api.get('/tables/sticker-info', { params: { code } })
      .then((r) => { if (r.data.data.printedLabel) setScanLabel((cur) => cur || `Table ${r.data.data.printedLabel}`); })
      .catch(() => {});
  };

  const fetchTables = async () => {
    if (!venue) return;
    try {
      const res = await api.get(`/tables/${venue.id}`);
      setTables(res.data.data);
    } catch {
      setError('Failed to load tables.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTables(); }, [venue]);

  // Tonight's accepted bookings, shown on their table.
  const [reserved, setReserved] = useState<Record<string, { name: string; partySize: number; time: string; status: string }>>({});
  useEffect(() => {
    if (!venue) return;
    api.get(`/venue-bookings/${venue.id}/tables`)
      .then((r) => {
        const map: Record<string, { name: string; partySize: number; time: string; status: string }> = {};
        for (const b of r.data.data) if (!map[b.tableId]) map[b.tableId] = b;
        setReserved(map);
      })
      .catch(() => {});
  }, [venue]);

  const handleCreate = async () => {
    if (!newLabel.trim() || !venue) return;
    setCreating(true);
    setError('');
    try {
      await api.post('/tables', { venueId: venue.id, label: newLabel.trim() });
      setNewLabel('');
      setShowForm(false);
      await fetchTables();
      setToast('Table added — assignments updated across your team');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to create table.');
    } finally {
      setCreating(false);
    }
  };

  const handleClaimScan = async () => {
    if (!scanLabel.trim() || !scannedCode || !venue) return;
    setScanCreating(true);
    setScanError('');
    try {
      await api.post('/tables/claim-scan', {
        venueId: venue.id,
        label: scanLabel.trim(),
        scannedCode,
      });
      setScanModal(false);
      setScanLabel('');
      setScannedCode('');
      await fetchTables();
      setToast('Table added — assignments updated across your team');
    } catch (err: any) {
      setScanError(err?.response?.data?.error || 'Failed to claim sticker.');
    } finally {
      setScanCreating(false);
    }
  };

  const getQrUrl = (code: string) => `${window.location.origin}/t/${code}`;

  const copyUrl = (code: string) => {
    navigator.clipboard.writeText(getQrUrl(code));
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <Layout>
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tables</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{tables.length} tables · {venue?.name}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowScanner(true)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-colors ${
              ENABLE_MANUAL_TABLE_CREATION
                ? 'border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                : 'bg-brand-500 hover:bg-brand-600 text-white'
            }`}
          >
            <ScanLine size={16} />
            Scan sticker
          </button>
          {ENABLE_MANUAL_TABLE_CREATION && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <Plus size={16} />
              Add table
            </button>
          )}
        </div>
      </div>

      {scanError && !scanModal && (
        <p className="text-sm text-red-500 mb-4">{scanError}</p>
      )}

      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      {ENABLE_MANUAL_TABLE_CREATION && showForm && (
        <div className="bg-white dark:bg-[#2B201B] border border-gray-200 dark:border-gray-800 rounded-2xl p-5 mb-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">New table</h3>
          <div className="flex gap-3">
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="e.g. Table 6, Window Booth, Bar Seat 1"
              className="flex-1 px-4 py-2.5 text-sm rounded-xl bg-gray-50 dark:bg-[#1C1511] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              onClick={handleCreate}
              disabled={creating || !newLabel.trim()}
              className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      <div className="space-y-3">
        {tables.map((table) => (
          <div key={table.id} className="bg-white dark:bg-[#2B201B] border border-gray-200 dark:border-gray-800 rounded-2xl px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <QrCode size={18} className="text-gray-500 dark:text-gray-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {table.label}
                  {reserved[table.id] && (
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-bold ${reserved[table.id].status === 'seated' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'}`}>
                      {reserved[table.id].status === 'seated' ? `${reserved[table.id].name} arrived` : `Reserved · ${reserved[table.id].name} · ${reserved[table.id].time} · ${reserved[table.id].partySize}`}
                    </span>
                  )}
                </p>
                {table.qrSticker ? (
                  <p className="text-xs text-gray-400 font-mono mt-0.5">/t/{table.qrSticker.code}</p>
                ) : (
                  <p className="text-xs text-amber-500 mt-0.5">No QR sticker</p>
                )}
              </div>
            </div>
            {table.qrSticker && (
              <button
                onClick={() => copyUrl(table.qrSticker!.code)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                {copiedCode === table.qrSticker.code ? (
                  <><Check size={13} className="text-green-500" /> Copied</>
                ) : (
                  <><Copy size={13} /> Copy URL</>
                )}
              </button>
            )}
          </div>
        ))}

        {!loading && tables.length === 0 && (
          <div className="text-center py-16 text-sm text-gray-400 dark:text-gray-500">
            No tables yet. {ENABLE_MANUAL_TABLE_CREATION ? 'Add your first table above.' : 'Scan your first sticker above.'}
          </div>
        )}
      </div>

      {/* ── Live camera scanner ──────────────────────────────────────────── */}
      {showScanner && (
        <QrScannerModal
          onScanned={handleScanned}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* ── Scan claim modal ─────────────────────────────────────────────── */}
      {scanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setScanModal(false)} />
          <div className="relative bg-white dark:bg-[#2B201B] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Name this table</h3>
              <button onClick={() => setScanModal(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <p className="text-xs text-gray-400 font-mono mb-4 truncate">Scanned: {scannedCode}</p>
            <input
              type="text"
              autoFocus
              value={scanLabel}
              onChange={(e) => setScanLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleClaimScan()}
              placeholder="e.g. Table 5, Patio Left"
              className="w-full px-4 py-2.5 text-sm rounded-xl bg-gray-50 dark:bg-[#1C1511] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 mb-3"
            />
            {scanError && <p className="text-sm text-red-500 mb-3">{scanError}</p>}
            <button
              onClick={handleClaimScan}
              disabled={scanCreating || !scanLabel.trim()}
              className="w-full py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
            >
              {scanCreating ? 'Saving...' : 'Save table'}
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}
