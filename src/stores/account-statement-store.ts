import { create } from 'zustand';

/**
 * Global account-statement (estado de cuenta) panel. Open it from anywhere with
 * just the patient's user_id; the panel fetches and renders the full statement.
 * Callers may pass `onMutate` to refresh their own debt widgets after the user
 * collects a payment or adds a debt from inside the panel.
 */
type AccountStatementStore = {
  isOpen: boolean;
  userId: string | null;
  userName?: string;
  onMutate?: () => void;
  open: (userId: string, userName?: string, onMutate?: () => void) => void;
  close: () => void;
};

export const useAccountStatement = create<AccountStatementStore>((set) => ({
  isOpen: false,
  userId: null,
  userName: undefined,
  onMutate: undefined,
  open: (userId, userName, onMutate) => set({ isOpen: true, userId, userName, onMutate }),
  close: () => set({ isOpen: false, userId: null, userName: undefined, onMutate: undefined }),
}));
