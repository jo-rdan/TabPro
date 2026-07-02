import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../lib/auth';

export default function AuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setToken, fetchMe } = useAuthStore();

  useEffect(() => {
    const token = params.get('token');
    const redirect = params.get('redirect') || 'dashboard';

    if (!token) {
      navigate('/login');
      return;
    }

    setToken(token);
    fetchMe().then(() => {
      navigate(redirect === 'setup' ? '/setup' : '/dashboard');
    });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-500">Signing you in...</p>
      </div>
    </div>
  );
}
