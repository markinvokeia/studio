import { create } from 'zustand';

type PatientDetailTab = 'clinical' | 'financial';

/**
 * Global patient quick-view. Opens the full PatientDetailSheet from anywhere
 * (quick search, links, etc.) given the patient's basic identity.
 */
type PatientViewStore = {
  isOpen: boolean;
  userId: string | null;
  userName: string;
  userEmail?: string;
  userPhone?: string;
  initialTab?: PatientDetailTab;
  open: (patient: {
    userId: string;
    userName: string;
    userEmail?: string;
    userPhone?: string;
    initialTab?: PatientDetailTab;
  }) => void;
  close: () => void;
};

export const usePatientView = create<PatientViewStore>((set) => ({
  isOpen: false,
  userId: null,
  userName: '',
  userEmail: undefined,
  userPhone: undefined,
  initialTab: undefined,
  open: ({ userId, userName, userEmail, userPhone, initialTab }) =>
    set({ isOpen: true, userId, userName, userEmail, userPhone, initialTab }),
  close: () => set({ isOpen: false, userId: null, userName: '' }),
}));
