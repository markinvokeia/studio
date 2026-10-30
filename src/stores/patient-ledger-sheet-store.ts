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
  // Deferred: `open` is frequently called from a ContextMenu/DropdownMenu item's
  // onSelect. Radix's menu and this sheet both lock `document.body`'s
  // pointer-events while open/closing, and mounting the sheet in the same tick
  // the menu starts its (animated, delayed) unmount races that lock — leaving
  // pointer-events stuck at "none" and the sheet unclosable. Letting the menu
  // finish unwinding first (next tick) avoids the overlap entirely.
  open: (userId, userName) => setTimeout(() => set({ isOpen: true, userId, userName }), 0),
  close: () => set({ isOpen: false, userId: null, userName: undefined }),
}));
