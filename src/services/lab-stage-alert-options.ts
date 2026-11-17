import { API_ROUTES } from '@/constants/routes';
import { api, type ApiRequestOptions } from '@/services/api';

/** Opciones para configurar los destinatarios y plantillas de una alerta de etapa de laboratorio. */
export interface LabStageAlertOptions {
  roles: { id: number; name: string }[];
  staff: { id: string; name: string; email: string; phone: string }[];
  emailTemplates: { id: number; name: string }[];
  whatsappTemplates: { id: number; name: string; code: string; entity_type: string | null }[];
}

function rowsOf(data: unknown): any[] {
  if (Array.isArray(data)) {
    const first = data[0] as any;
    // GET /users responde [{ data, total }] (o [{ json: { data } }]).
    if (first && (Array.isArray(first.data) || Array.isArray(first.json?.data))) return first.data ?? first.json.data;
    return data.map((row) => (row as any)?.json ?? row).filter((row) => row && Object.keys(row).length > 0);
  }
  const wrapped = (data as any)?.data ?? (data as any)?.roles ?? [];
  return Array.isArray(wrapped) ? wrapped : [];
}

export async function fetchLabStageAlertOptions(options?: ApiRequestOptions): Promise<LabStageAlertOptions> {
  const [roles, staff, emailTemplates, whatsappTemplates] = await Promise.all([
    api.get(API_ROUTES.ROLES, undefined, undefined, options),
    api.get(API_ROUTES.USERS, { page: '1', limit: '500', search: '', only_active: 'true', only_staff: 'true' }, undefined, options),
    api.get(API_ROUTES.SYSTEM.COMMUNICATION_TEMPLATES, { search: '', page: '1', limit: '1000', is_active: 'true', type: 'email' }, undefined, options),
    api.get(API_ROUTES.SYSTEM.COMMUNICATION_TEMPLATES, { search: '', page: '1', limit: '1000', is_active: 'true', type: 'whatsapp' }, undefined, options),
  ]);
  const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name);
  return {
    roles: rowsOf(roles)
      .filter((r) => r.id != null && String(r.name ?? '').toLowerCase() !== 'paciente')
      .map((r) => ({ id: Number(r.id), name: String(r.name) }))
      .sort(byName),
    staff: rowsOf(staff)
      .filter((u) => u.id != null)
      .map((u) => ({ id: String(u.id), name: String(u.name ?? ''), email: u.email ?? '', phone: u.phone_number ?? '' }))
      .sort(byName),
    emailTemplates: rowsOf(emailTemplates)
      .filter((tpl) => tpl.id != null && String(tpl.type ?? 'EMAIL').toUpperCase() === 'EMAIL')
      .map((tpl) => ({ id: Number(tpl.id), name: String(tpl.name ?? tpl.code ?? tpl.id) }))
      .sort(byName),
    whatsappTemplates: rowsOf(whatsappTemplates)
      .filter((tpl) => tpl.id != null && String(tpl.type ?? 'WHATSAPP').toUpperCase() === 'WHATSAPP')
      .map((tpl) => ({ id: Number(tpl.id), name: String(tpl.name ?? tpl.code), code: String(tpl.code ?? ''), entity_type: tpl.entity_type ?? null }))
      .sort(byName),
  };
}
