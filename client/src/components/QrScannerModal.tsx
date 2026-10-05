import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

interface Props {
  onScanned: (code: string) => void;
  onClose: () => void;
}

export default function QrScannerModal({ onScanned, onClose }: Props) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const elementId = 'tabpro-qr-reader';
  const [error, setError] = useState('');
  const [started, setStarted] = useState(false);

  useEffect(() => {
    let scanner: Html5Qrcode;

    const start = async () => {
      try {
        scanner = new Html5Qrcode(elementId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText) => {
            // Extract just the code part if it's a full Skuzi URL
            const match = decodedText.match(/\/t\/([^/?#]+)/);
            const code = match ? match[1] : decodedText;
            onScanned(code);
            stop(scanner);
          },
          () => {} // suppress per-frame errors
        );
        setStarted(true);
      } catch (err: any) {
        setError('Camera access denied or unavailable. Please allow camera permissions and try again.');
      }
    };

    start();

    return () => {
      if (scannerRef.current) stop(scannerRef.current);
    };
  }, []);

  const stop = (scanner: Html5Qrcode) => {
    scanner.isScanning &&
      scanner.stop().catch(() => {}).finally(() => scanner.clear());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white dark:bg-[#2B201B] border border-gray-200 dark:border-gray-800 rounded-2xl p-5 w-full max-w-sm shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Scan QR sticker</h3>
          <button onClick={onClose}>
            <X size={18} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
          </button>
        </div>

        {/* Viewfinder */}
        <div className="rounded-xl overflow-hidden bg-black">
          <div id={elementId} className="w-full" />
        </div>

        {!started && !error && (
          <p className="text-xs text-center text-gray-400 mt-3">Starting camera…</p>
        )}

        {error && (
          <p className="text-xs text-center text-red-500 mt-3">{error}</p>
        )}

        {started && !error && (
          <p className="text-xs text-center text-gray-400 mt-3">
            Point the camera at a Skuzi QR sticker
          </p>
        )}
      </div>
    </div>
  );
}
