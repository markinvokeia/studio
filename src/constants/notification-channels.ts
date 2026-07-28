/**
 * Fixed logical channels for role-based SSE notification broadcast.
 * Each base role subscribes to its own channel; custom roles created per-clinic
 * fall back silently (no channel) unless added here.
 */
export const ROLE_NOTIFICATION_CHANNELS: Record<string, string> = {
  Administrador: 'admin',
  Gerente: 'gerente',
  Recepcionista: 'recepcionista',
  Doctor: 'doctor',
  Cajero: 'cajero',
};

export function getChannelsForRoles(roleNames: string[]): string[] {
  const channels = roleNames
    .map((role) => ROLE_NOTIFICATION_CHANNELS[role])
    .filter((channel): channel is string => Boolean(channel));
  return [...new Set(channels)];
}
