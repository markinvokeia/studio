import { create } from 'zustand';

/**
 * Global "appointment history" panel — lists every appointment of a patient
 * (custom calendar mode context menu → patient → "Historial de Citas").
 */
type PatientAppointmentsSheetStore = {
  isOpen: boolean;
  userId: string | null;
  userName?: string;
  open: (userId: string, userName?: string) => void;
  close: () => void;
};

export const usePatientAppointmentsSheet = create<PatientAppointmentsSheetStore>((set) => ({
  isOpen: false,
  userId: null,
  userName: undefined,
  open: (userId, userName) => set({ isOpen: true, userId, userName }),
  close: () => set({ isOpen: false, userId: null, userName: undefined }),
}));
