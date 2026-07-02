import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Printer, CheckCircle } from 'lucide-react';
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

function formatRwf(n: number) {
  return `${n.toLocaleString()} RWF`;
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function Receipt() {
  const { tabId } = useParams<{ tabId: string }>();
  const [bill, setBill] = useState<Bill | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get(`/tabs/${tabId}/bill`);
        setBill(res.data.data);
      } catch {
        setError('Could not load receipt. The tab may not exist.');
      } finally {
        setLoading(false);
      }
    };
    if (tabId) fetch();
  }, [tabId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0D1117]">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !bill) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0D1117]">
        <p className="text-sm text-red-500">{error || 'Receipt not found.'}</p>
      </div>
    );
  }

  const vatRate = 0.18;
  const grandTotalBeforeVAT = Math.round(bill.grandTotal / (1 + vatRate));
  const vatAmount = bill.grandTotal - grandTotalBeforeVAT;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-[#0D1117] flex flex-col items-center py-10 px-4">

      {/* Print button — hidden when printing */}
      <div className="w-full max-w-sm mb-4 flex justify-end print:hidden">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          <Printer size={15} />
          Print / Save PDF
        </button>
      </div>

      {/* Receipt card */}
      <div
        id="receipt"
        className="w-full max-w-sm bg-white dark:bg-[#161B22] border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm print:shadow-none print:border print:rounded-none"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-800 text-center">
          <p className="text-xs font-semibold text-brand-500 uppercase tracking-widest mb-1">Order Summary</p>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{bill.venueName}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{bill.tableLabel}</p>
          <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(bill.openedAt)}</p>
        </div>

        {/* Line items */}
        <div className="px-6 py-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-800">
                <th className="text-left pb-2 font-semibold">Item</th>
                <th className="text-center pb-2 font-semibold">Qty</th>
                <th className="text-right pb-2 font-semibold">Unit</th>
                <th className="text-right pb-2 font-semibold">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {bill.lineItems.map((item, i) => (
                <tr key={i}>
                  <td className="py-2 text-gray-800 dark:text-gray-200 font-medium">{item.name}</td>
                  <td className="py-2 text-center text-gray-500 dark:text-gray-400">{item.quantity}</td>
                  <td className="py-2 text-right text-gray-500 dark:text-gray-400 text-xs">
                    {item.unitPriceRwf.toLocaleString()}
                  </td>
                  <td className="py-2 text-right text-gray-800 dark:text-gray-200 font-semibold">
                    {item.subtotal.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="px-6 pb-4 border-t border-gray-100 dark:border-gray-800 space-y-2 pt-4">
          <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>Subtotal (excl. VAT 18%)</span>
            <span>{formatRwf(grandTotalBeforeVAT)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>VAT 18%</span>
            <span>{formatRwf(vatAmount)}</span>
          </div>
          <div className="flex justify-between text-base font-bold text-gray-900 dark:text-white pt-2 border-t border-gray-200 dark:border-gray-700">
            <span>Grand Total</span>
            <span>{formatRwf(bill.grandTotal)}</span>
          </div>
        </div>

        {/* EBM notice */}
        <div className="mx-6 mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4 text-center">
          <div className="flex justify-center mb-2">
            <CheckCircle size={18} className="text-amber-500" />
          </div>
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">
            Hand this summary to your cashier
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
            Your cashier will issue the official fiscal receipt via your EBM device as required by RRA.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 text-center">
          <p className="text-xs text-gray-400">Powered by TabPro</p>
          <p className="text-xs text-gray-300 dark:text-gray-600 mt-0.5">Ref: {bill.tabId.slice(0, 8).toUpperCase()}</p>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white; }
          .print\\:hidden { display: none !important; }
          #receipt { max-width: 100%; border: 1px solid #e5e7eb; }
        }
      `}</style>
    </div>
  );
}
