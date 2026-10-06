import { create } from 'zustand';
import { Owner, Venue } from '@tabpro/shared';
import api from '../lib/api';

interface AuthState {
  token: string | null;
  owner: Owner | null;
  venues: Venue[];
  /** Venue terms version owners must have agreed to (from the server). */
  currentTermsVersion: number | null;
  isLoading: boolean;
  setToken: (token: string) => void;
  fetchMe: () => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('tabpro_token'),
  owner: null,
  venues: [],
  currentTermsVersion: null,
  isLoading: false,

  setToken: (token: string) => {
    localStorage.setItem('tabpro_token', token);
    set({ token });
  },

  fetchMe: async () => {
    set({ isLoading: true });
    try {
      const res = await api.get('/auth/me');
      // The response is the owner, with their venues inside it.
      const { venues, currentTermsVersion, ...owner } = res.data.data;
      set({ owner, venues: venues ?? [], currentTermsVersion: currentTermsVersion ?? null });
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
