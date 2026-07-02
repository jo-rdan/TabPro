import { useState } from 'react';

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export function useCloudinaryUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const upload = async (file: File): Promise<string | null> => {
    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', UPLOAD_PRESET);
      formData.append('folder', 'tabpro/logos');

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        { method: 'POST', body: formData },
      );

      if (!res.ok) throw new Error('Upload failed');

      const data = await res.json();
      return data.secure_url as string;
    } catch (err: any) {
      setError('Logo upload failed. Try again.');
      return null;
    } finally {
      setUploading(false);
    }
  };

  return { upload, uploading, error };
}
