import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Printer,
  CheckCircle,
  Smartphone,
  Loader2,
  AlertCircle,
} from "lucide-react";
import api from "../lib/api";

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

type PaymentState =
  | "idle"
  | "entering_phone"
  | "waiting"
  | "success"
  | "failed";

function formatRwf(n: number) {
  return `${n.toLocaleString()} RWF`;
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Receipt() {
  const { tabId } = useParams<{ tabId: string }>();
  const [bill, setBill] = useState<Bill | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Payment state
  const [paymentState, setPaymentState] = useState<PaymentState>("idle");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [referenceId, setReferenceId] = useState("");
  const [paidTotal, setPaidTotal] = useState(0);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get(`/tabs/${tabId}/bill`);
        setBill(res.data.data);
        // If tab already closed, show success immediately
        if (res.data.data.status === "closed") {
          setPaymentState("success");
          setPaidTotal(res.data.data.grandTotal);
        }
      } catch {
        setError("Could not load receipt. The tab may not exist.");
      } finally {
        setLoading(false);
      }
    };
    if (tabId) fetch();
  }, [tabId]);

  // Poll for payment status when waiting
  useEffect(() => {
    if (paymentState !== "waiting" || !referenceId || !tabId) return;

    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/tabs/${tabId}/pay/${referenceId}`);
        const { status } = res.data.data;

        if (status === "successful") {
          setPaymentState("success");
          clearInterval(interval);
        } else if (status === "failed") {
          setPaymentState("failed");
          clearInterval(interval);
        }
      } catch {
        // Keep polling on network errors
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [paymentState, referenceId, tabId]);

  const handlePay = async () => {
    setPhoneError("");
    const cleaned = phone.trim().replace(/\s/g, "");
    if (cleaned.length < 9) {
      setPhoneError("Enter a valid MTN MoMo or Airtel Money number");
      return;
    }

    try {
      setPaymentState("waiting");
      const res = await api.post(`/tabs/${tabId}/pay`, { phone: cleaned });
      setReferenceId(res.data.data.depositId);
    } catch (err: any) {
      setPaymentState("failed");
    }
  };

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
        <p className="text-sm text-red-500">{error || "Receipt not found."}</p>
      </div>
    );
  }

  const vatRate = 0.18;
  const grandTotalBeforeVAT = Math.round(bill.grandTotal / (1 + vatRate));
  const vatAmount = bill.grandTotal - grandTotalBeforeVAT;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-[#0D1117] flex flex-col items-center py-10 px-4">
      {/* Print button */}
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
          <p className="text-xs font-semibold text-brand-500 uppercase tracking-widest mb-1">
            Order Summary
          </p>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {bill.venueName}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {bill.tableLabel}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {formatDateTime(bill.openedAt)}
          </p>
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
                  <td className="py-2 text-gray-800 dark:text-gray-200 font-medium">
                    {item.name}
                  </td>
                  <td className="py-2 text-center text-gray-500 dark:text-gray-400">
                    {item.quantity}
                  </td>
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

        {/* ─── Payment section ─────────────────────────────────────── */}

        {/* IDLE — show pay button */}
        {paymentState !== "idle" && (
          <div className="mx-6 mb-6 space-y-3">
            <button
              onClick={() => setPaymentState("entering_phone")}
              className="w-full flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              <Smartphone size={18} />
              Pay with Mobile Money
            </button>
            <p className="text-xs text-center text-gray-400">
              Your official RRA receipt will be issued at the counter
            </p>
          </div>
        )}

        {/* ENTERING PHONE */}
        {paymentState === "entering_phone" && (
          <div className="mx-6 mb-6 space-y-3">
            <p className="text-sm font-semibold text-gray-800 dark:text-white">
              Enter your MTN MoMo or Airtel Money number
            </p>
            <input
              type="tel"
              placeholder="e.g. 0781234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-[#0D1117] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {phoneError && <p className="text-xs text-red-500">{phoneError}</p>}
            <button
              onClick={handlePay}
              className="w-full bg-brand-500 hover:bg-brand-600 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              Pay {formatRwf(bill.grandTotal)}
            </button>
            <button
              onClick={() => setPaymentState("idle")}
              className="w-full text-sm text-gray-400 hover:text-gray-600 py-1"
            >
              Cancel
            </button>
          </div>
        )}

        {/* WAITING — polling */}
        {paymentState === "waiting" && (
          <div className="mx-6 mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-5 text-center">
            <Loader2
              size={28}
              className="text-brand-500 animate-spin mx-auto mb-3"
            />
            <p className="text-sm font-semibold text-gray-800 dark:text-white mb-1">
              Waiting for payment
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Check your phone and approve the Mobile Money request for{" "}
              {formatRwf(bill.grandTotal)}
            </p>
          </div>
        )}

        {/* SUCCESS */}
        {paymentState === "success" && (
          <div className="mx-6 mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl p-5 text-center">
            <CheckCircle size={28} className="text-green-500 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-800 dark:text-white mb-1">
              Payment confirmed!
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              {formatRwf(paidTotal)} received. Your official RRA receipt will be
              issued at the counter.
            </p>
          </div>
        )}

        {/* FAILED */}
        {paymentState === "failed" && (
          <div className="mx-6 mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-5 text-center">
            <AlertCircle size={28} className="text-red-500 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-800 dark:text-white mb-1">
              Payment failed
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              The payment was not completed. Please try again.
            </p>
            <button
              onClick={() => setPaymentState("idle")}
              className="text-sm text-brand-500 font-semibold hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 pb-6 text-center">
          <p className="text-xs text-gray-400">Powered by TabPro</p>
          <p className="text-xs text-gray-300 dark:text-gray-600 mt-0.5">
            Ref: {bill.tabId.slice(0, 8).toUpperCase()}
          </p>
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
