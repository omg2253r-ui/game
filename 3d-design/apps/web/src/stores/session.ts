import { create } from 'zustand';
import { api } from '../lib/api';

interface Session {
  userId: string | null;
  credits: number | null;
  error: unknown;
  load: () => Promise<void>;
  setCredits: (n: number) => void;
}

export const useSession = create<Session>((set) => ({
  userId: null,
  credits: null,
  error: null,
  load: async () => {
    try {
      const me = await api.me();
      set({ userId: me.userId, credits: me.credits, error: null });
    } catch (error) {
      set({ error });
    }
  },
  setCredits: (credits) => set({ credits }),
}));
