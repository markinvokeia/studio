export type EmailTemplateType =
  | 'email_invoice'
  | 'email_quote'
  | 'email_quote_approved'
  | 'email_quote_rejected'
  | 'email_payment'
  | 'email_appointment_reminder'
  | 'email_appointment_confirmation'
  | 'email_patient_general'
  | 'email_alert_followup'
  | 'email_cash_opening'
  | 'email_cash_closing'
  | 'email_financial_summary'
  | 'email_treatment_update'
  | 'email_password_reset';

export type SmsTemplateType =
  | 'sms_appointment_reminder'
  | 'sms_appointment_confirmation';

export interface EmailTemplateDefault {
  subject: string;
  body: string;
}

// API code used when saving to /system/communication-templates
export const EMAIL_CODE_MAP: Record<EmailTemplateType, string> = {
  email_invoice:                   'INVOICE_EMAIL',
  email_quote:                     'QUOTE_EMAIL',
  email_quote_approved:            'QUOTE_APPROVED_EMAIL',
  email_quote_rejected:            'QUOTE_REJECTED_EMAIL',
  email_payment:                   'PAYMENT_RECEIPT_EMAIL',
  email_appointment_reminder:      'APPOINTMENT_REMINDER_EMAIL',
  email_appointment_confirmation:  'APPOINTMENT_CONFIRMATION_EMAIL',
  email_patient_general:           'PATIENT_GENERAL_EMAIL',
  email_alert_followup:            'ALERT_FOLLOWUP_EMAIL',
  email_cash_opening:              'CASH_OPENING_EMAIL',
  email_cash_closing:              'CASH_CLOSING_EMAIL',
  email_financial_summary:         'FINANCIAL_SUMMARY_EMAIL',
  email_treatment_update:          'TREATMENT_UPDATE_EMAIL',
  email_password_reset:            'PASSWORD_RESET_EMAIL',
};

export const SMS_CODE_MAP: Record<SmsTemplateType, string> = {
  sms_appointment_reminder:     'APPOINTMENT_REMINDER_SMS',
  sms_appointment_confirmation: 'APPOINTMENT_CONFIRMATION_SMS',
};

// ── Shared partials ────────────────────────────────────────────────────────────

const YEAR = new Date().getFullYear();

const EMAIL_HEADER = `<div style="background:#f9fafb;padding:20px 24px;border-bottom:1px solid #e5e7eb;">
  <table style="width:100%;border-collapse:collapse;"><tr>
    <td style="vertical-align:middle;"><img src="{{clinic_logo}}" alt="{{clinic_name}}" style="height:48px;width:auto;max-width:120px;object-fit:contain;" onerror="this.style.display='none'" /></td>
    <td style="vertical-align:middle;padding-left:16px;">
      <p style="font-size:16px;font-weight:700;margin:0 0 2px;color:#111827;">{{clinic_name}}</p>
      <p style="font-size:12px;color:#6b7280;margin:0;">{{clinic_address}}</p>
    </td>
  </tr></table>
</div>`;

const EMAIL_FOOTER = `<div style="background:#f9fafb;padding:12px 24px;border-top:1px solid #e5e7eb;text-align:center;font-size:11px;color:#9ca3af;">
  <p style="margin:0;">{{clinic_name}} · {{clinic_phone}} · {{clinic_email}}</p>
  <p style="margin:4px 0 0;">© ${YEAR} InvokeIA · www.invokeia.com</p>
</div>`;

function emailShell(body: string): string {
  return `<div style="max-width:600px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1f2937;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
  ${EMAIL_HEADER}
  <div style="padding:24px;">
    ${body}
  </div>
  ${EMAIL_FOOTER}
</div>`;
}

// ── Defaults per type ──────────────────────────────────────────────────────────

const INVOICE_BODY = `<p style="font-size:18px;font-weight:700;margin:0 0 16px;color:#111827;">Nueva Factura</p>
    <p style="margin:0 0 16px;">Hola <strong>{{patient_name}}</strong>, adjuntamos el detalle de tu factura.</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:13px;">
      <tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:7px 0;color:#6b7280;width:40%;">Nro. Factura</td><td style="font-weight:600;font-family:monospace;">#{{doc_no}}</td></tr>
      <tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:7px 0;color:#6b7280;">Fecha</td><td>{{date}}</td></tr>
      <tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:7px 0;color:#6b7280;">Estado</td><td>{{status}}</td></tr>
      <tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:7px 0;color:#6b7280;">Moneda</td><td>{{currency}}</td></tr>
      <tr><td style="padding:7px 0;color:#6b7280;font-weight:600;">Total</td><td style="font-weight:700;font-size:15px;">{{currency}} {{total}}</td></tr>
    </table>
    <div style="margin-bottom:20px;">{{items_table}}</div>
    <p style="color:#6b7280;font-size:13px;margin:0;">Ante cualquier consulta no dudes en contactarnos.<br><strong>{{clinic_phone}}</strong> · {{clinic_email}}</p>`;

const QUOTE_BODY = `<p style="font-size:18px;font-weight:700;margin:0 0 16px;color:#111827;">Presupuesto</p>
    <p style="margin:0 0 16px;">Hola <strong>{{patient_name}}</strong>, adjuntamos tu presupuesto.</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:13px;">
      <tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:7px 0;color:#6b7280;width:40%;">Nro. Presupuesto</td><td style="font-weight:600;font-family:monospace;">#{{doc_no}}</td></tr>
      <tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:7px 0;color:#6b7280;">Fecha</td><td>{{date}}</td></tr>
      <tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:7px 0;color:#6b7280;">Moneda</td><td>{{currency}}</td></tr>
      <tr><td style="padding:7px 0;color:#6b7280;font-weight:600;">Total</td><td style="font-weight:700;font-size:15px;">{{currency}} {{total}}</td></tr>
    </table>
    <div style="margin-bottom:20px;">{{items_table}}</div>
    <p style="color:#6b7280;font-size:13px;margin:0;">Si tenés alguna consulta sobre este presupuesto, contactanos.<br><strong>{{clinic_phone}}</strong> · {{clinic_email}}</p>`;

const PAYMENT_BODY = `<p style="font-size:18px;font-weight:700;margin:0 0 16px;color:#111827;">Recibo de Pago</p>
    <p style="margin:0 0 16px;">Hola <strong>{{patient_name}}</strong>, confirmamos la recepción de tu pago.</p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:16px;margin-bottom:20px;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr style="border-bottom:1px solid #d1fae5;"><td style="padding:6px 0;color:#166534;width:40%;">Nro. Recibo</td><td style="font-weight:600;font-family:monospace;color:#166534;">#{{doc_no}}</td></tr>
        <tr style="border-bottom:1px solid #d1fae5;"><td style="padding:6px 0;color:#166534;">Fecha</td><td style="color:#166534;">{{date}}</td></tr>
        <tr style="border-bottom:1px solid #d1fae5;"><td style="padding:6px 0;color:#166534;">Método</td><td style="color:#166534;">{{method}}</td></tr>
        <tr><td style="padding:6px 0;color:#166534;font-weight:600;">Monto</td><td style="font-weight:700;font-size:16px;color:#15803d;">{{currency}} {{amount}}</td></tr>
      </table>
    </div>
    <p style="color:#6b7280;font-size:13px;margin:0;">Gracias por tu pago. Ante cualquier consulta: <strong>{{clinic_phone}}</strong></p>`;

const REMINDER_BODY = `<p style="font-size:18px;font-weight:700;margin:0 0 16px;color:#111827;">Recordatorio de Cita</p>
    <p style="margin:0 0 16px;">Hola <strong>{{patient_name}}</strong>, te recordamos tu próxima cita.</p>
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:16px;margin-bottom:20px;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr style="border-bottom:1px solid #dbeafe;"><td style="padding:6px 0;color:#1e40af;width:40%;">Fecha</td><td style="font-weight:600;color:#1e40af;">{{appointment_date}}</td></tr>
        <tr style="border-bottom:1px solid #dbeafe;"><td style="padding:6px 0;color:#1e40af;">Hora</td><td style="font-weight:600;color:#1e40af;">{{appointment_time}}</td></tr>
        <tr style="border-bottom:1px solid #dbeafe;"><td style="padding:6px 0;color:#1e40af;">Doctor/a</td><td style="color:#1e40af;">{{doctor_name}}</td></tr>
        <tr><td style="padding:6px 0;color:#1e40af;">Lugar</td><td style="color:#1e40af;">{{location}}</td></tr>
      </table>
    </div>
    <p style="color:#6b7280;font-size:13px;margin:0;">Si necesitás cancelar o reprogramar, contactanos con anticipación.<br><strong>{{clinic_phone}}</strong> · {{clinic_email}}</p>`;

const CONFIRMATION_BODY = `<p style="font-size:18px;font-weight:700;margin:0 0 16px;color:#111827;">Cita Confirmada</p>
    <p style="margin:0 0 16px;">Hola <strong>{{patient_name}}</strong>, tu cita ha sido confirmada.</p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:16px;margin-bottom:20px;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr style="border-bottom:1px solid #d1fae5;"><td style="padding:6px 0;color:#166534;width:40%;">Fecha</td><td style="font-weight:600;color:#166534;">{{appointment_date}}</td></tr>
        <tr style="border-bottom:1px solid #dbeafe;"><td style="padding:6px 0;color:#166534;">Hora</td><td style="font-weight:600;color:#166534;">{{appointment_time}}</td></tr>
        <tr style="border-bottom:1px solid #d1fae5;"><td style="padding:6px 0;color:#166534;">Doctor/a</td><td style="color:#166534;">{{doctor_name}}</td></tr>
        <tr><td style="padding:6px 0;color:#166534;">Lugar</td><td style="color:#166534;">{{location}}</td></tr>
      </table>
    </div>
    <p style="color:#6b7280;font-size:13px;margin:0;">Te esperamos. Ante cualquier consulta: <strong>{{clinic_phone}}</strong> · {{clinic_email}}</p>`;

const PATIENT_GENERAL_BODY = `<p style="font-size:18px;font-weight:700;margin:0 0 16px;color:#111827;">Hola, {{patient_name}}</p>
    <p style="margin:0 0 24px;color:#374151;">Te escribimos desde <strong>{{clinic_name}}</strong>.</p>
    <p style="margin:0 0 8px;color:#6b7280;font-size:13px;">Si tenés alguna consulta, no dudes en contactarnos:</p>
    <p style="margin:0;color:#6b7280;font-size:13px;"><strong>{{clinic_phone}}</strong> · {{clinic_email}}</p>`;

const QUOTE_APPROVED_BODY = `<p style="font-size:18px;font-weight:700;margin:0 0 16px;color:#111827;">Presupuesto Aprobado</p>
    <p style="margin:0 0 16px;">Hola <strong>{{patient_name}}</strong>, su presupuesto ha sido confirmado exitosamente.</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:13px;">
      <tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:7px 0;color:#6b7280;width:40%;">Nro. Presupuesto</td><td style="font-weight:600;font-family:monospace;">#{{doc_no}}</td></tr>
      <tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:7px 0;color:#6b7280;">Fecha</td><td>{{date}}</td></tr>
      <tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:7px 0;color:#6b7280;">Moneda</td><td>{{currency}}</td></tr>
      <tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:7px 0;color:#6b7280;">Tipo de cambio</td><td>{{exchange_rate}}</td></tr>
      <tr><td style="padding:7px 0;color:#6b7280;font-weight:600;">Total confirmado</td><td style="font-weight:700;font-size:15px;">{{currency}} {{total}}</td></tr>
    </table>
    <div style="margin-bottom:20px;">{{items_table}}</div>
    <p style="color:#6b7280;font-size:13px;margin:0;">Nos pondremos en contacto para coordinar las citas necesarias. Gracias por su confianza.<br><strong>{{clinic_phone}}</strong> · {{clinic_email}}</p>`;

const QUOTE_REJECTED_BODY = `<p style="font-size:18px;font-weight:700;margin:0 0 16px;color:#111827;">Respuesta al Presupuesto</p>
    <p style="margin:0 0 16px;">Hola <strong>{{patient_name}}</strong>, hemos recibido su respuesta respecto al presupuesto <strong>#{{doc_no}}</strong>.</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:13px;">
      <tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:7px 0;color:#6b7280;width:40%;">Nro. Presupuesto</td><td style="font-weight:600;font-family:monospace;">#{{doc_no}}</td></tr>
      <tr><td style="padding:7px 0;color:#6b7280;">Fecha</td><td>{{date}}</td></tr>
    </table>
    <p style="color:#6b7280;font-size:13px;margin:0 0 8px;">Lamentamos que no pueda proceder con el tratamiento propuesto en esta ocasión.</p>
    <p style="color:#6b7280;font-size:13px;margin:0;">Si tiene alguna consulta o desea considerar otras opciones, no dude en contactarnos.<br><strong>{{clinic_phone}}</strong> · {{clinic_email}}</p>`;

const CASH_OPENING_BODY = `<p style="font-size:18px;font-weight:700;margin:0 0 16px;color:#111827;">Apertura de Caja</p>
    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;padding:16px;margin-bottom:20px;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr style="border-bottom:1px solid #e0f2fe;"><td style="padding:6px 0;color:#0c4a6e;width:40%;">ID de Sesión</td><td style="font-weight:600;font-family:monospace;color:#0c4a6e;">#{{session_id}}</td></tr>
        <tr style="border-bottom:1px solid #e0f2fe;"><td style="padding:6px 0;color:#0c4a6e;">Punto de Caja</td><td style="color:#0c4a6e;">{{cash_point_name}}</td></tr>
        <tr style="border-bottom:1px solid #e0f2fe;"><td style="padding:6px 0;color:#0c4a6e;">Usuario</td><td style="color:#0c4a6e;">{{user_name}}</td></tr>
        <tr><td style="padding:6px 0;color:#0c4a6e;">Fecha de Apertura</td><td style="color:#0c4a6e;">{{opened_at}}</td></tr>
      </table>
    </div>
    <div style="margin-bottom:20px;">{{opening_table}}</div>
    <p style="color:#6b7280;font-size:13px;margin:0;">{{clinic_name}} · <strong>{{clinic_phone}}</strong></p>`;

const CASH_CLOSING_BODY = `<p style="font-size:18px;font-weight:700;margin:0 0 16px;color:#111827;">Cierre de Caja</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:13px;">
      <tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:7px 0;color:#6b7280;width:40%;">ID de Sesión</td><td style="font-weight:600;font-family:monospace;">#{{session_id}}</td></tr>
      <tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:7px 0;color:#6b7280;">Punto de Caja</td><td>{{cash_point_name}}</td></tr>
      <tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:7px 0;color:#6b7280;">Usuario</td><td>{{user_name}}</td></tr>
      <tr><td style="padding:7px 0;color:#6b7280;">Fecha de Cierre</td><td>{{closed_at}}</td></tr>
    </table>
    <div style="margin-bottom:20px;">{{movements_table}}</div>
    <div style="margin-bottom:20px;">{{currencies_table}}</div>
    <p style="color:#6b7280;font-size:13px;margin:0;">{{clinic_name}} · <strong>{{clinic_phone}}</strong></p>`;

const FINANCIAL_SUMMARY_BODY = `<p style="font-size:18px;font-weight:700;margin:0 0 16px;color:#111827;">Estado de Cuenta</p>
    <p style="margin:0 0 8px;">Estimado/a <strong>{{patient_name}}</strong>,</p>
    <p style="margin:0 0 20px;color:#6b7280;font-size:13px;">Período: {{date_from}} — {{date_to}}</p>
    <div style="margin-bottom:20px;">{{movements_table}}</div>
    <p style="color:#6b7280;font-size:13px;margin:0;">Para consultas: <strong>{{clinic_phone}}</strong> · {{clinic_email}}</p>`;

const TREATMENT_UPDATE_BODY = `<p style="font-size:18px;font-weight:700;margin:0 0 16px;color:#111827;">Actualización de Tratamiento</p>
    <p style="margin:0 0 16px;">Estimado/a <strong>{{patient_name}}</strong>,</p>
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:16px;margin-bottom:20px;">
      <p style="font-size:15px;font-weight:700;margin:0 0 12px;color:#1e40af;">{{service_name}}</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr style="border-bottom:1px solid #dbeafe;"><td style="padding:6px 0;color:#1e40af;width:40%;">Estado</td><td style="font-weight:600;color:#1e40af;">{{treatment_status}}</td></tr>
        <tr><td style="padding:6px 0;color:#1e40af;">Fecha</td><td style="color:#1e40af;">{{treatment_date}}</td></tr>
      </table>
    </div>
    <p style="color:#6b7280;font-size:13px;margin:0;">Para consultas: <strong>{{clinic_phone}}</strong> · {{clinic_email}}</p>`;

const PASSWORD_RESET_BODY = `<p style="font-size:18px;font-weight:700;margin:0 0 16px;color:#111827;">Restablecer Contraseña</p>
    <p style="margin:0 0 16px;">Hola <strong>{{user_name}}</strong>, recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>{{clinic_name}}</strong>.</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="{{reset_link}}" style="display:inline-block;background:#111827;color:#ffffff;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;">Restablecer Contraseña</a>
    </div>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:12px;margin-bottom:16px;">
      <p style="color:#6b7280;font-size:13px;margin:0;">Si no solicitaste restablecer tu contraseña, podés ignorar este mensaje. Tu cuenta permanecerá segura.</p>
    </div>
    <p style="color:#6b7280;font-size:13px;margin:0;">Consultas: <strong>{{clinic_phone}}</strong> · {{clinic_email}}</p>`;

export const EMAIL_TEMPLATE_DEFAULTS: Record<EmailTemplateType, EmailTemplateDefault> = {
  email_invoice: {
    subject: 'Factura #{{doc_no}} — {{clinic_name}}',
    body: emailShell(INVOICE_BODY),
  },
  email_quote: {
    subject: 'Presupuesto #{{doc_no}} — {{clinic_name}}',
    body: emailShell(QUOTE_BODY),
  },
  email_payment: {
    subject: 'Recibo de pago #{{doc_no}} — {{clinic_name}}',
    body: emailShell(PAYMENT_BODY),
  },
  email_appointment_reminder: {
    subject: 'Recordatorio de tu cita — {{clinic_name}}',
    body: emailShell(REMINDER_BODY),
  },
  email_appointment_confirmation: {
    subject: 'Tu cita está confirmada — {{clinic_name}}',
    body: emailShell(CONFIRMATION_BODY),
  },
  email_patient_general: {
    subject: 'Mensaje de {{clinic_name}}',
    body: emailShell(PATIENT_GENERAL_BODY),
  },
  email_alert_followup: {
    subject: 'Seguimiento — {{alert_title}} — {{clinic_name}}',
    body: [
      'Hola {{patient_name}},',
      '',
      'Nos comunicamos desde {{clinic_name}} en relación al siguiente aviso:',
      '"{{alert_title}}"',
      '',
      '{{alert_summary}}',
      '',
      'Si tenés alguna consulta, no dudes en contactarnos:',
      '{{clinic_phone}} · {{clinic_email}}',
      '',
      'Atentamente,',
      '{{clinic_name}}',
    ].join('\n'),
  },
  email_quote_approved: {
    subject: 'Presupuesto #{{doc_no}} aprobado — {{clinic_name}}',
    body: emailShell(QUOTE_APPROVED_BODY),
  },
  email_quote_rejected: {
    subject: 'Respuesta al Presupuesto #{{doc_no}} — {{clinic_name}}',
    body: emailShell(QUOTE_REJECTED_BODY),
  },
  email_cash_opening: {
    subject: 'Apertura de Caja #{{session_id}} — {{clinic_name}}',
    body: emailShell(CASH_OPENING_BODY),
  },
  email_cash_closing: {
    subject: 'Cierre de Caja #{{session_id}} — {{clinic_name}}',
    body: emailShell(CASH_CLOSING_BODY),
  },
  email_financial_summary: {
    subject: 'Estado de Cuenta — {{clinic_name}}',
    body: emailShell(FINANCIAL_SUMMARY_BODY),
  },
  email_treatment_update: {
    subject: 'Actualización de Tratamiento — {{clinic_name}}',
    body: emailShell(TREATMENT_UPDATE_BODY),
  },
  email_password_reset: {
    subject: 'Restablecer contraseña — {{clinic_name}}',
    body: emailShell(PASSWORD_RESET_BODY),
  },
};

export const SMS_TEMPLATE_DEFAULTS: Record<SmsTemplateType, string> = {
  sms_appointment_reminder:
    'Hola {{patient_name}}, te recordamos tu cita el {{appointment_date}} a las {{appointment_time}} con {{doctor_name}} en {{clinic_name}}. Consultas: {{clinic_phone}}.',
  sms_appointment_confirmation:
    'Hola {{patient_name}}, tu cita el {{appointment_date}} a las {{appointment_time}} con {{doctor_name}} en {{clinic_name}} ha sido confirmada. Consultas: {{clinic_phone}}.',
};
