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
  /** Show the guarded Cancel action used by patient forms opened from custom calendar mode. */
  showCancelAction?: boolean;
  open: (patient: {
    userId: string;
    userName: string;
    userEmail?: string;
    userPhone?: string;
    initialTab?: PatientDetailTab;
    infoOnly?: boolean;
    showCancelAction?: boolean;
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
  showCancelAction: false,
  open: ({ userId, userName, userEmail, userPhone, initialTab, infoOnly, showCancelAction }) =>
    set({
      isOpen: true,
      userId,
      userName,
      userEmail,
      userPhone,
      initialTab,
      infoOnly: infoOnly ?? false,
      showCancelAction: showCancelAction ?? false,
    }),
  close: () => set({
    isOpen: false,
    userId: null,
    userName: '',
    initialTab: undefined,
    infoOnly: false,
    showCancelAction: false,
  }),
}));
