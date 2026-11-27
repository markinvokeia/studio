/**
 * Aviso de seña del Portal del Paciente.
 *
 * Con `deposit_notice_enabled`, al terminar una reserva nueva desde el portal el
 * paciente ve este HTML, y el flujo `/api/public/appointment-notify` agrega el
 * mismo bloque al email "Tu cita quedó agendada". El HTML vive en
 * `communication_templates` (code `PORTAL_DEPOSIT_NOTICE`) y se edita desde
 * Configuración → Portal del Paciente.
 *
 * Es sólo un aviso: nadie cancela la cita automáticamente al vencer el plazo.
 */

export const DEPOSIT_NOTICE_TEMPLATE_CODE = 'PORTAL_DEPOSIT_NOTICE';

export const DEFAULT_DEPOSIT_HOURS = 2;
export const DEPOSIT_HOURS_MIN = 1;
/** Igual que el CHECK `clinic_patient_portal_deposit_hours_check`. */
export const DEPOSIT_HOURS_MAX = 72;

/**
 * Plantilla de partida. **Debe coincidir** con la que siembra
 * `database/scripts/181_20261127_patient-portal-deposit-notice.sql`: es lo que
 * restaura el botón "Restaurar plantilla".
 *
 * Estilos inline y sin `<style>` ni imágenes embebidas: el mismo HTML va en el
 * email, y Gmail descarta todo lo demás.
 */
export const DEFAULT_DEPOSIT_NOTICE_HTML = `<div style="max-width:560px;margin:0 auto;font-family:Georgia,'Times New Roman',serif;color:#4a2c1d;background:#f8efe7;border-radius:16px;padding:24px;">
  <p style="margin:0 0 4px;text-align:center;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#8a6a55;">{{clinic_name}}</p>
  <h2 style="margin:0 0 16px;text-align:center;font-size:24px;line-height:1.25;font-weight:700;color:#4a2c1d;">Tu lugar todavía no está reservado</h2>
  <div style="background:#ead7c7;border-radius:14px;padding:16px 18px;margin:0 0 16px;text-align:center;">
    <p style="margin:0 0 6px;font-size:18px;line-height:1.4;">Se solicita la <strong>seña del 50%</strong> para guardar tu cita del <strong>{{date}}</strong> a las <strong>{{time}}</strong>.</p>
    <p style="margin:0;font-size:15px;line-height:1.5;">Tenés hasta el <strong>{{deadline}}</strong> ({{hours}} h) para abonarla. <em>Si no la recibimos, la cita se cancela y el horario se libera.</em></p>
  </div>
  <div style="border:1px solid #d9bfa9;border-radius:14px;padding:14px 18px;margin:0 0 16px;background:#fffaf6;">
    <p style="margin:0 0 6px;font-size:16px;font-weight:700;">Banco (nombre del banco)</p>
    <p style="margin:0;font-size:15px;line-height:1.6;">Nº de cuenta: <strong>000000</strong><br>Nombre: Titular de la cuenta</p>
  </div>
  <p style="margin:0 0 4px;text-align:center;font-size:15px;">Enviá el comprobante al</p>
  <p style="margin:0 0 4px;text-align:center;font-size:26px;font-weight:700;letter-spacing:0.04em;">{{clinic_phone}}</p>
  <p style="margin:0 0 16px;text-align:center;font-size:15px;">y confirmamos tu reserva.</p>
  <p style="margin:0 0 16px;text-align:center;font-size:14px;color:#6b4c3a;">También podés abonar por: Prex · Mercado Pago</p>
  <p style="margin:0;text-align:center;font-size:18px;font-style:italic;">Desde ya, muchas gracias</p>
</div>`;

/** Variables que reemplazan tanto el portal como el flujo de n8n. */
export const DEPOSIT_NOTICE_VARIABLES = [
  'patient_name',
  'date',
  'time',
  'deadline',
  'hours',
  'clinic_name',
  'clinic_phone',
] as const;

export type DepositNoticeVariable = (typeof DEPOSIT_NOTICE_VARIABLES)[number];
export type DepositNoticeValues = Record<DepositNoticeVariable, string>;

export function isValidDepositHours(hours: number): boolean {
  return Number.isInteger(hours) && hours >= DEPOSIT_HOURS_MIN && hours <= DEPOSIT_HOURS_MAX;
}

/**
 * Hasta cuándo tiene el paciente para pagar la seña: `hours` desde que reservó,
 * pero nunca después del inicio de la cita (un turno para dentro de una hora no
 * puede tener dos horas de plazo). n8n calcula lo mismo para el email.
 */
export function getDepositDeadline(appointmentStart: Date, hours: number, bookedAt: Date = new Date()): Date {
  const byHours = new Date(bookedAt.getTime() + hours * 60 * 60_000);
  return byHours.getTime() < appointmentStart.getTime() ? byHours : appointmentStart;
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

/**
 * Reemplaza `{{variable}}` por su valor, escapado: el nombre del paciente lo
 * escribe el propio paciente y no puede inyectar HTML. Las variables
 * desconocidas se dejan tal cual, para que quien edita vea que no existen.
 */
export function renderDepositNotice(html: string, values: DepositNoticeValues): string {
  return html.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (match, key: string) =>
    key in values ? escapeHtml(values[key as DepositNoticeVariable]) : match,
  );
}
