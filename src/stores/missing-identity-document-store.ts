import { create } from 'zustand';

import type { AppointmentStatus } from '@/lib/types';

/**
 * Aviso de bloqueo "el paciente no tiene documento de identidad" al cambiar el
 * estado de una cita (preferencia `identity_document_warn_statuses`): el
 * backend rechaza el cambio y acá solo se explica por qué.
 *
 * Es imperativo, como `toast`: `showMissingIdentityDocumentBlock` lo abre y un
 * único `MissingIdentityDocumentDialog` montado en el layout lo muestra. Así lo
 * usan igual el hook de estados y los flujos que completan la cita al guardar
 * la sesión clínica, sin que cada pantalla monte su propio diálogo.
 */
export interface MissingIdentityDocumentNotice {
  patientName: string | null;
  status: AppointmentStatus;
}

interface MissingIdentityDocumentStore {
  notice: MissingIdentityDocumentNotice | null;
  close: () => void;
}

export const useMissingIdentityDocumentStore = create<MissingIdentityDocumentStore>((set) => ({
  notice: null,
  close: () => set({ notice: null }),
}));

export function showMissingIdentityDocumentBlock(notice: MissingIdentityDocumentNotice): void {
  useMissingIdentityDocumentStore.setState({ notice });
}
