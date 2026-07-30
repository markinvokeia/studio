import { create } from 'zustand';

/**
 * Global "clinical history" panel — opens the patient's clinical sessions as a
 * fullscreen table (custom calendar mode context menu → patient → "Historia").
 */
type PatientHistorySheetStore = {
  isOpen: boolean;
  userId: string | null;
  userName?: string;
  open: (userId: string, userName?: string) => void;
  close: () => void;
};

export const usePatientHistorySheet = create<PatientHistorySheetStore>((set) => ({
  isOpen: false,
  userId: null,
  userName: undefined,
  // Deferred: `open` is typically called from a ContextMenuItem's onSelect.
  // Radix's menu and this sheet both lock document.body's pointer-events while
  // open/closing; mounting the sheet in the same tick the menu starts its
  // (animated) unmount races that lock and can leave the sheet unclosable.
  // Letting the menu finish unwinding first (next tick) avoids the overlap.
  open: (userId, userName) => setTimeout(() => set({ isOpen: true, userId, userName }), 0),
  close: () => set({ isOpen: false, userId: null, userName: undefined }),
}));
