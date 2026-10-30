import { create } from 'zustand';

/**
 * Global "images & files" panel — opens the patient's documents gallery
 * (custom calendar mode context menu → patient → "Imágenes y archivos").
 */
type PatientDocumentsSheetStore = {
  isOpen: boolean;
  userId: string | null;
  userName?: string;
  open: (userId: string, userName?: string) => void;
  close: () => void;
};

export const usePatientDocumentsSheet = create<PatientDocumentsSheetStore>((set) => ({
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
