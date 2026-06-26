import { create } from 'zustand';

/**
 * Global account-statement (estado de cuenta) panel. Open it from anywhere with
 * just the patient's user_id; the panel fetches and renders the full statement.
 */
type AccountStatementStore = {
  isOpen: boolean;
  userId: string | null;
  userName?: string;
  open: (userId: string, userName?: string) => void;
  close: () => void;
};

export const useAccountStatement = create<AccountStatementStore>((set) => ({
  isOpen: false,
  userId: null,
  userName: undefined,
  open: (userId, userName) => set({ isOpen: true, userId, userName }),
  close: () => set({ isOpen: false, userId: null, userName: undefined }),
}));
