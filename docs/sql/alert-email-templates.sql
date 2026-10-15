-- Plantillas de email del auto-envío de alertas (communication_templates 7 / 9 / 8).
-- Reglas: 6 "Recordatorio de Cita 24h" -> 7, 8 "Factura próxima a vencer" -> 9,
--         10 "Cumpleaños del paciente" -> 8.
--
-- body_html guarda SOLO el contenido. La cabecera, el pie y el fondo los agrega
-- el nodo "Build Email" del flujo n8n "Alert Email Auto-Send" al enviar.
-- Variables disponibles y diseño: docs/alert-email-auto-send.md
--
-- Actualiza filas existentes (no crea). Revisar y confirmar antes de ejecutar.

BEGIN;

UPDATE public.communication_templates
SET subject = $tpl$Recordatorio de cita — {{clinic_name}}$tpl$,
    body_html = $tpl$<p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#4b1d95;">Recordatorio de cita</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:700;color:#0c0520;">Te esperamos</h1>
<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#0c0520;">Hola <strong>{{recipient_name}}</strong>, te recordamos la próxima cita{{for_patient}}:</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;margin:0 0 24px;background:#faf8fd;border:1px solid #e4e0eb;border-left:3px solid #4b1d95;border-radius:12px;"><tr><td width="50%" style="padding:14px 18px;vertical-align:top;border-bottom:1px solid #efedf3;"><div style="font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6d6d78;margin:0 0 3px;">Fecha</div><div style="font-size:14px;font-weight:600;color:#0c0520;">{{appointment_date}}</div></td><td width="50%" style="padding:14px 18px;vertical-align:top;border-bottom:1px solid #efedf3;"><div style="font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6d6d78;margin:0 0 3px;">Hora</div><div style="font-size:14px;font-weight:600;color:#0c0520;">{{appointment_time}}</div></td></tr><tr><td colspan="2" style="padding:14px 18px;vertical-align:top;border-bottom:1px solid #efedf3;"><div style="font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6d6d78;margin:0 0 3px;">Profesional</div><div style="font-size:14px;font-weight:600;color:#0c0520;">{{doctor_name}}</div></td></tr><tr><td colspan="2" style="padding:14px 18px;vertical-align:top;"><div style="font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6d6d78;margin:0 0 3px;">Lugar</div><div style="font-size:14px;font-weight:600;color:#0c0520;">{{location}}</div></td></tr></table>
<p style="margin:0 0 24px;"><a href="{{clinic_phone_link}}" style="display:inline-block;background:#4b1d95;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 22px;border-radius:10px;">Llamar a la clínica</a></p>
<p style="margin:0;font-size:12px;line-height:1.6;color:#6d6d78;">Si no podés asistir, avisanos con anticipación respondiendo este email.</p>$tpl$,
    body_text = NULL,
    updated_at = now()
WHERE id = 7 AND code = 'APPT_REMINDER_24H';

UPDATE public.communication_templates
SET subject = $tpl$Tu factura {{invoice_doc_no}} vence el {{invoice_due_date}}$tpl$,
    body_html = $tpl$<p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#4b1d95;">Aviso de vencimiento</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:700;color:#0c0520;">Tu factura está por vencer</h1>
<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#0c0520;">Hola <strong>{{recipient_name}}</strong>, te recordamos que tenés un saldo pendiente{{for_patient}}:</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;margin:0 0 24px;background:#faf8fd;border:1px solid #e4e0eb;border-left:3px solid #4b1d95;border-radius:12px;"><tr><td width="50%" style="padding:14px 18px;vertical-align:top;border-bottom:1px solid #efedf3;"><div style="font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6d6d78;margin:0 0 3px;">Factura</div><div style="font-size:14px;font-weight:600;color:#0c0520;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;">{{invoice_doc_no}}</div></td><td width="50%" style="padding:14px 18px;vertical-align:top;border-bottom:1px solid #efedf3;"><div style="font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6d6d78;margin:0 0 3px;">Vence</div><div style="font-size:14px;font-weight:600;color:#0c0520;">{{invoice_due_date}}</div></td></tr><tr><td colspan="2" style="padding:14px 18px;vertical-align:top;"><div style="font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6d6d78;margin:0 0 3px;">Saldo pendiente</div><div style="font-size:14px;font-weight:600;color:#0c0520;font-size:22px;font-weight:700;color:#4b1d95;">{{invoice_amount}}</div></td></tr></table>
<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#0c0520;">Podés abonarla en la clínica o consultarnos por otros medios de pago.</p>
<p style="margin:0 0 24px;"><a href="{{clinic_phone_link}}" style="display:inline-block;background:#4b1d95;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 22px;border-radius:10px;">Llamar a la clínica</a></p>
<p style="margin:0;font-size:12px;line-height:1.6;color:#6d6d78;">Si ya realizaste el pago, ignorá este mensaje.</p>$tpl$,
    body_text = NULL,
    updated_at = now()
WHERE id = 9 AND code = 'INV_DUE_SOON';

UPDATE public.communication_templates
SET subject = $tpl$¡Feliz cumpleaños! — {{clinic_name}}$tpl$,
    body_html = $tpl$<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;margin:0 0 20px;background:#f0eafb;border-radius:12px;"><tr><td style="padding:28px 24px;text-align:center;">
<div style="font-size:44px;line-height:1;margin:0 0 12px;">🎂</div>
<p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#4b1d95;">Feliz cumpleaños</p>
<h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:700;color:#0c0520;">¡Feliz cumpleaños{{to_patient}}!</h1>
</td></tr></table>
<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#0c0520;">Hola <strong>{{recipient_name}}</strong>, todo el equipo de <strong>{{clinic_name}}</strong> te envía un cálido saludo y los mejores deseos en este día tan especial.</p>
<p style="margin:0;font-size:12px;line-height:1.6;color:#6d6d78;">¡Que sea un gran día!</p>$tpl$,
    body_text = NULL,
    updated_at = now()
WHERE id = 8 AND code = 'PATIENT_BIRTHDAY';

COMMIT;
