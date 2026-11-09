import { create } from 'zustand';

export interface Toast {
  id: number;
  kind: 'info' | 'success' | 'error';
  message: string;
}

interface Toasts {
  items: Toast[];
  push: (kind: Toast['kind'], message: string) => void;
  dismiss: (id: number) => void;
}

let seq = 0;

export const useToasts = create<Toasts>((set, get) => ({
  items: [],
  push: (kind, message) => {
    const id = ++seq;
    set({ items: [...get().items.slice(-3), { id, kind, message }] });
    // Errors stay until dismissed: they carry instructions the user may need to reread.
    if (kind !== 'error') setTimeout(() => get().dismiss(id), 4500);
  },
  dismiss: (id) => set({ items: get().items.filter((t) => t.id !== id) }),
}));

export const toast = {
  info: (m: string) => useToasts.getState().push('info', m),
  success: (m: string) => useToasts.getState().push('success', m),
  error: (m: string) => useToasts.getState().push('error', m),
};
