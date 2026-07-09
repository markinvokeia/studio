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
  open: (userId, userName) => set({ isOpen: true, userId, userName }),
  close: () => set({ isOpen: false, userId: null, userName: undefined }),
}));
