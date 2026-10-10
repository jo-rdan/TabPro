import { useEffect, useState } from 'react';
import { X, Printer } from 'lucide-react';
import api from '../lib/api';

interface LineItem {
  name: string;
  quantity: number;
  unitPriceRwf: number;
  subtotal: number;
}

interface Bill {
  tabId: string;
  status: string;
  tableLabel: string;
  venueName: string;
  lineItems: LineItem[];
  grandTotal: number;
  openedAt: string;
}

interface Props {
  tabId: string;
  onClose: () => void;
}

function fmt(n: number) {
  return n.toLocaleString();
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function ReceiptModal({ tabId, onClose }: Props) {
  const [bill, setBill] = useState<Bill | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/tabs/${tabId}/bill`);
        setBill(res.data.data);
      } catch {
        setError('Could not load receipt.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tabId]);

  const vatRate = 0.18;
  const grandTotalBeforeVAT = bill ? Math.round(bill.grandTotal / (1 + vatRate)) : 0;
  const vatAmount = bill ? bill.grandTotal - grandTotalBeforeVAT : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal shell */}
      <div className="relative w-full max-w-xs flex flex-col items-center">

        {/* Top toolbar */}
        <div className="w-full flex items-center justify-between mb-3 px-1">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 text-xs font-semibold text-white/80 hover:text-white transition-colors print:hidden"
          >
            <Printer size={13} />
            Print
          </button>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors print:hidden">
            <X size={18} />
          </button>
        </div>

        {/* Torn top edge */}
        <div className="w-full overflow-hidden" style={{ height: 14 }}>
          <svg viewBox="0 0 320 14" preserveAspectRatio="none" className="w-full h-full">
            <path
              d="M0,14 C10,14 10,0 20,0 C30,0 30,14 40,14 C50,14 50,0 60,0 C70,0 70,14 80,14 C90,14 90,0 100,0 C110,0 110,14 120,14 C130,14 130,0 140,0 C150,0 150,14 160,14 C170,14 170,0 180,0 C190,0 190,14 200,14 C210,14 210,0 220,0 C230,0 230,14 240,14 C250,14 250,0 260,0 C270,0 270,14 280,14 C290,14 290,0 300,0 C310,0 310,14 320,14 L320,14 L0,14 Z"
              fill="#FAF6EC"
            />
          </svg>
        </div>

        {/* Receipt body */}
        <div
          id="receipt-print"
          className="w-full"
          style={{
            background: '#FAF6EC',
            fontFamily: "'Space Mono', 'Courier New', monospace",
            color: '#241F18',
          }}
        >
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="w-5 h-5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {error && (
            <p className="text-center text-xs text-red-500 py-8">{error}</p>
          )}

          {bill && (
            <div className="px-6 py-4">
              {/* Header */}
              <div className="text-center mb-4">
                <p className="text-xs tracking-widest uppercase" style={{ color: '#6B6354', letterSpacing: '0.18em' }}>
                  Order Summary
                </p>
                <h1 className="text-xl font-bold mt-1" style={{ color: '#241F18', letterSpacing: '-0.01em' }}>
                  {bill.venueName}
                </h1>
                <p className="text-xs mt-1" style={{ color: '#6B6354' }}>{bill.tableLabel}</p>
                <p className="text-xs mt-0.5" style={{ color: '#6B6354' }}>{formatDateTime(bill.openedAt)}</p>
              </div>

              {/* Dashed divider */}
              <div style={{ borderTop: '1px dashed #D8D0BC', margin: '12px 0' }} />

              {/* Column headers */}
              <div className="flex text-xs mb-2" style={{ color: '#6B6354', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                <span style={{ flex: 1 }}>Item</span>
                <span style={{ width: 24, textAlign: 'center' }}>Qty</span>
                <span style={{ width: 56, textAlign: 'right' }}>Unit</span>
                <span style={{ width: 64, textAlign: 'right' }}>Total</span>
              </div>

              {/* Line items */}
              {bill.lineItems.map((item, i) => (
                <div key={i} className="flex items-baseline py-1.5" style={{ borderBottom: '1px dashed #D8D0BC', fontSize: 11 }}>
                  <span style={{ flex: 1, color: '#241F18', fontWeight: 600, fontSize: 11 }}>{item.name}</span>
                  <span style={{ width: 24, textAlign: 'center', color: '#6B6354', fontSize: 10 }}>×{item.quantity}</span>
                  <span style={{ width: 56, textAlign: 'right', color: '#6B6354', fontSize: 10 }}>{fmt(item.unitPriceRwf)}</span>
                  <span style={{ width: 64, textAlign: 'right', color: '#241F18', fontWeight: 700, fontSize: 11 }}>{fmt(item.subtotal)}</span>
                </div>
              ))}

              {/* Dashed divider */}
              <div style={{ borderTop: '1px dashed #D8D0BC', margin: '12px 0' }} />

              {/* Totals */}
              <div className="space-y-1.5">
                <div className="flex justify-between" style={{ fontSize: 11, color: '#6B6354' }}>
                  <span>Subtotal (excl. VAT 18%)</span>
                  <span>{fmt(grandTotalBeforeVAT)} RWF</span>
                </div>
                <div className="flex justify-between" style={{ fontSize: 11, color: '#6B6354' }}>
                  <span>VAT 18%</span>
                  <span>{fmt(vatAmount)} RWF</span>
                </div>
              </div>

              {/* Grand total */}
              <div style={{ borderTop: '2px solid #241F18', marginTop: 10, paddingTop: 8 }}>
                <div className="flex justify-between items-baseline">
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6B6354' }}>
                    Grand Total
                  </span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: '#B4452F' }}>
                    {fmt(bill.grandTotal)} RWF
                  </span>
                </div>
              </div>

              {/* EBM notice */}
              <div style={{ background: '#FFF8E1', border: '1px dashed #C08A2E', borderRadius: 8, padding: '10px 12px', marginTop: 14, textAlign: 'center' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#854F0B', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>
                  Hand to cashier
                </p>
                <p style={{ fontSize: 10, color: '#5C4516', lineHeight: 1.5 }}>
                  Cashier will issue the official fiscal receipt via EBM device as required by RRA.
                </p>
              </div>

              {/* Footer */}
              <div className="text-center mt-4">
                {/* Barcode-like decoration */}
                <p style={{ fontSize: 20, letterSpacing: 1, color: '#D8D0BC', marginBottom: 6 }}>
                  ▌▍▎▌▌▍▎▍▌▎▌▍▌▎▍▌
                </p>
                <p style={{ fontSize: 9, color: '#6B6354', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Powered by Skuzi
                </p>
                <p style={{ fontSize: 9, color: '#D8D0BC', marginTop: 2 }}>
                  Ref: {bill.tabId.slice(0, 8).toUpperCase()}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Torn bottom edge */}
        <div className="w-full overflow-hidden" style={{ height: 14 }}>
          <svg viewBox="0 0 320 14" preserveAspectRatio="none" className="w-full h-full">
            <path
              d="M0,0 C10,0 10,14 20,14 C30,14 30,0 40,0 C50,0 50,14 60,14 C70,14 70,0 80,0 C90,0 90,14 100,14 C110,14 110,0 120,0 C130,0 130,14 140,14 C150,14 150,0 160,0 C170,0 170,14 180,14 C190,14 190,0 200,0 C210,0 210,14 220,14 C230,14 230,0 240,0 C250,0 250,14 260,14 C270,14 270,0 280,0 C290,0 290,14 300,14 C310,14 310,0 320,0 L320,0 L0,0 Z"
              fill="#FAF6EC"
            />
          </svg>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #receipt-print, #receipt-print * { visibility: visible; }
          #receipt-print { position: fixed; top: 0; left: 0; width: 100%; }
        }
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap');
      `}</style>
    </div>
  );
}
