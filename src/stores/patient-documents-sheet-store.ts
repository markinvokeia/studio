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
  open: (userId, userName) => set({ isOpen: true, userId, userName }),
  close: () => set({ isOpen: false, userId: null, userName: undefined }),
}));
