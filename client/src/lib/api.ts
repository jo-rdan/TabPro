import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach the owner's JWT unless the caller passed its own (e.g. a waiter's
// staff token), so one phone can be signed in as both.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tabpro_token');
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally - clear token and redirect to login (owner requests only)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const usedOwnerToken = error.config?.headers?.Authorization === `Bearer ${localStorage.getItem('tabpro_token')}`;
    if (error.response?.status === 401 && usedOwnerToken) {
      localStorage.removeItem('tabpro_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
