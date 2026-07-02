import { useEffect, useState } from 'react';
import { CheckCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onDismiss: () => void;
}

export default function Toast({ message, type = 'success', duration = 4000, onDismiss }: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Animate in
    requestAnimationFrame(() => setVisible(true));

    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, []);

  const Icon = type === 'success' ? CheckCircle : Info;
  const colors = type === 'success'
    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
    : 'bg-blue-600 text-white';

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl transition-all duration-300 ${colors} ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
      }`}
      style={{ minWidth: 260, maxWidth: 360 }}
    >
      <Icon size={16} className="flex-shrink-0" />
      <p className="text-sm font-semibold flex-1">{message}</p>
      <button onClick={() => { setVisible(false); setTimeout(onDismiss, 300); }} className="opacity-60 hover:opacity-100">
        <X size={14} />
      </button>
    </div>
  );
}
