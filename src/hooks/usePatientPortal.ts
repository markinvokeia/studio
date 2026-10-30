'use client';

import { useAuth } from '@/context/AuthContext';
import { PATIENT_PORTAL_ROLES } from '@/constants/roles';

interface UsePatientPortalResult {
  /** Tiene el rol "Paciente", con o sin roles de staff. Habilita el acceso a /my-profile. */
  hasPatientRole: boolean;
  /**
   * Su ÚNICO rol es "Paciente": queda confinado a /my-profile y no ve nada del
   * dashboard. Es el caso del paciente común que se registró por la landing.
   */
  isPatientOnly: boolean;
  /**
   * Es paciente y además parte del equipo (p. ej. una recepcionista que también
   * se atiende en la clínica). Entra por la vista de staff y puede alternar a
   * su perfil de paciente desde el menú del avatar.
   */
  isDualRole: boolean;
  /** users.id del usuario logueado — el mismo id que usa el staff en /patients. */
  patientId: string;
  patientName: string;
  patientEmail: string;
  isLoading: boolean;
}

/**
 * Resuelve cómo se comporta el portal del paciente (/my-profile) para el usuario
 * logueado.
 *
 * Los pacientes son filas de `users` con el rol "Paciente", así que `patientId`
 * es directamente `user.id` — el mismo id que reciben `PatientInfoTab`,
 * `ClinicHistoryViewer`, `PatientFinanceSection`, etc.
 */
export function usePatientPortal(): UsePatientPortalResult {
  const { user, roleNames, isLoading } = useAuth();

  const normalized = roleNames.map((role) => role.trim().toLowerCase());
  const hasPatientRole = normalized.some((role) => PATIENT_PORTAL_ROLES.includes(role));
  const hasStaffRole = normalized.some((role) => !PATIENT_PORTAL_ROLES.includes(role));

  return {
    hasPatientRole,
    isPatientOnly: hasPatientRole && !hasStaffRole,
    isDualRole: hasPatientRole && hasStaffRole,
    patientId: user?.id ?? '',
    patientName: user?.name ?? '',
    patientEmail: user?.email ?? '',
    isLoading,
  };
}
