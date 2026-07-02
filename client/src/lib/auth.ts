import { create } from 'zustand';
import { Owner, Venue } from '@tabpro/shared';
import api from '../lib/api';

interface AuthState {
  token: string | null;
  owner: Owner | null;
  venues: Venue[];
  isLoading: boolean;
  setToken: (token: string) => void;
  fetchMe: () => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('tabpro_token'),
  owner: null,
  venues: [],
  isLoading: false,

  setToken: (token: string) => {
    localStorage.setItem('tabpro_token', token);
    set({ token });
  },

  fetchMe: async () => {
    set({ isLoading: true });
    try {
      const res = await api.get('/auth/me');
      const { owner, venues } = res.data.data;
      set({ owner, venues });
    } catch {
      set({ token: null, owner: null, venues: [] });
      localStorage.removeItem('tabpro_token');
    } finally {
      set({ isLoading: false });
    }
  },

  logout: () => {
    localStorage.removeItem('tabpro_token');
    set({ token: null, owner: null, venues: [] });
  },
}));
