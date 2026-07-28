/**
 * Fixed logical channels for role-based SSE notification broadcast.
 * Keys are normalized (lowercased, accents stripped) because `role_name` in the DB
 * is inconsistent — only "facturador" and the new "Cajero" role were capitalized when
 * seeded (see database/scripts/seed_default_role_permissions.sql); "administrador",
 * "medico"/"médico" and "recepcionista" remain lowercase. Same pattern as DOCTOR_WORKSPACE_ROLES
 * in src/constants/roles.ts.
 */
const ROLE_NOTIFICATION_CHANNELS: Record<string, string> = {
  administrador: 'admin',
  admin: 'admin',
  gerente: 'gerente',
  recepcionista: 'recepcionista',
  medico: 'doctor',
  doctor: 'doctor',
  cajero: 'cajero',
};

function normalizeRoleName(roleName: string): string {
  return roleName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function getChannelsForRoles(roleNames: string[]): string[] {
  const channels = roleNames
    .map((role) => ROLE_NOTIFICATION_CHANNELS[normalizeRoleName(role)])
    .filter((channel): channel is string => Boolean(channel));
  return [...new Set(channels)];
}
