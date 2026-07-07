import { create } from 'zustand';

/**
 * Global "account statement" panel — opens the unified patient ledger from
 * anywhere with just the patient's user_id, regardless of that patient's own
 * finance_view preference (classic/tabs users still get the consolidated
 * timeline here, since that's the entire point of this shortcut).
 */
type PatientLedgerSheetStore = {
  isOpen: boolean;
  userId: string | null;
  userName?: string;
  open: (userId: string, userName?: string) => void;
  close: () => void;
};

export const usePatientLedgerSheet = create<PatientLedgerSheetStore>((set) => ({
  isOpen: false,
  userId: null,
  userName: undefined,
  open: (userId, userName) => set({ isOpen: true, userId, userName }),
  close: () => set({ isOpen: false, userId: null, userName: undefined }),
}));
