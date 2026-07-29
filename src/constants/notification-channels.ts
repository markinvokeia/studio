/**
 * Fixed logical channels for role-based SSE notification broadcast.
 * Keys are normalized (lowercased, accents stripped) because `role_name` in the DB
 * is inconsistent in casing — e.g. "Super Admin" vs "administrador". Same pattern
 * as DOCTOR_WORKSPACE_ROLES in src/constants/roles.ts.
 */
const ROLE_NOTIFICATION_CHANNELS: Record<string, string> = {
  paciente: 'paciente',
  medico: 'medico',
  administrador: 'administrador',
  recepcionista: 'recepcionista',
  gerente: 'gerente',
  'super admin': 'super_admin',
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
