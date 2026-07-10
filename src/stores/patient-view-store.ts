import { create } from 'zustand';

type PatientDetailTab = 'info' | 'clinical' | 'financial';

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
  /** Show only the "Información" tab content: no tab strip, no quick actions. */
  infoOnly?: boolean;
  open: (patient: {
    userId: string;
    userName: string;
    userEmail?: string;
    userPhone?: string;
    initialTab?: PatientDetailTab;
    infoOnly?: boolean;
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
  infoOnly: false,
  open: ({ userId, userName, userEmail, userPhone, initialTab, infoOnly }) =>
    set({ isOpen: true, userId, userName, userEmail, userPhone, initialTab, infoOnly: infoOnly ?? false }),
  close: () => set({ isOpen: false, userId: null, userName: '', initialTab: undefined, infoOnly: false }),
}));
