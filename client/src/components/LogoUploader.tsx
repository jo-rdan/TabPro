import { useRef } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import VenueLogo from './VenueLogo';
import { useCloudinaryUpload } from '../hooks/useCloudinaryUpload';

interface Props {
  venueName: string;
  currentLogoUrl?: string | null;
  onUploaded: (url: string) => void;
  /** Logo size in px. */
  size?: number;
  /** Hide the "Change logo" text link (the logo itself stays clickable). */
  hideButton?: boolean;
}

export default function LogoUploader({ venueName, currentLogoUrl, onUploaded, size = 72, hideButton = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, uploading, error } = useCloudinaryUpload();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Basic validation
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be under 5MB.');
      return;
    }

    const url = await upload(file);
    if (url) onUploaded(url);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative group cursor-pointer" onClick={() => inputRef.current?.click()} title={currentLogoUrl ? 'Change logo' : 'Upload logo'}>
        <VenueLogo logoUrl={currentLogoUrl} venueName={venueName} size={size} />
        <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          {uploading
            ? <Loader2 size={20} className="text-white animate-spin" />
            : <Upload size={18} className="text-white" />
          }
        </div>
      </div>

      {!hideButton && <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="text-xs text-brand-500 hover:text-brand-600 font-semibold disabled:opacity-50"
      >
        {uploading ? 'Uploading...' : currentLogoUrl ? 'Change logo' : 'Upload logo'}
      </button>}

      {error && <p className="text-xs text-red-500">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}
