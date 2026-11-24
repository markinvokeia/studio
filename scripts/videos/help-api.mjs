/**
 * Cliente mínimo de los webhooks del asistente para los scripts (videos, job nocturno).
 *
 *   HELP_API_URL    base de n8n del cliente (la misma que NEXT_PUBLIC_API_URL), sin /webhook
 *   HELP_API_TOKEN  JWT de un usuario técnico con HELP_CATALOG_SYNC
 */

export function helpApiConfigured() {
  return Boolean(process.env.HELP_API_URL && process.env.HELP_API_TOKEN);
}

export async function helpApi(path, body, { method = 'POST' } = {}) {
  if (!helpApiConfigured()) throw new Error('Faltan HELP_API_URL y HELP_API_TOKEN');
  const url = `${process.env.HELP_API_URL.replace(/\/$/, '')}/webhook/${path.replace(/^\//, '')}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${process.env.HELP_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${data?.message ?? text}`);
  return data;
}
