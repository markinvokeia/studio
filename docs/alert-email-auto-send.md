# Auto-envío de email en alertas

Envío automático de email al paciente (o a su responsable) cuando el **Alert Scheduler** genera una alerta de una regla con `auto_send_email = true`. Alcance inicial: 3 reglas.

| Regla | id | Plantilla EMAIL | Cuándo envía |
|---|---|---|---|
| Recordatorio de Cita 24h | 6 | 7 `APPT_REMINDER_24H` | el día anterior a la cita (`days_before = 1`) |
| Factura próxima a vencer | 8 | 9 `INV_DUE_SOON` | 3 días antes del vencimiento (`days_before = 3`, `days_after = 0`) |
| Cumpleaños del paciente | 10 | 8 `PATIENT_BIRTHDAY` | el día del cumpleaños |

## Flujos

- **`docs/n8n-flows/Alert Email Auto-Send.json`** (nuevo): sub-flujo equivalente a *Alert WhatsApp Auto-Send*. Detalle en su sticky note.
- **`docs/n8n-flows/Alert Scheduler.json`** (modificado):
  `Should Auto-Send WhatsApp?` → `Send Alert WhatsApp` → **`Restore Alert Instances`** → **`Should Auto-Send Email?`** → **`Send Alert Email`** → `Update rule next execution`.
  `Send Alert WhatsApp` pasa a una sola salida (`continueRegularOutput`). `Success` / `Calculate metrics` registran `emails_sent` real en `alert_schedule_runs`.

Los flujos viejos (`Send Email`, `Send Email to User`, `Build Email`) **no se usan**: descargan la plantilla de GitHub en cada envío, el logo sale roto (`$execution.resumeUrl`), el chequeo de preferencias corta el flujo sin respuesta cuando no hay fila global y el error reportado es `labelIds`.

## Qué valida antes de enviar

1. Alerta existente y no `IGNORED` / `SUPPRESSED` / `SNOOZED`.
2. Plantilla `communication_templates` tipo `EMAIL` activa.
3. Destinatario: usuario activo con rol `paciente`. Email del paciente o, si es dependiente sin email válido, el del responsable. Se descartan vacíos, mal formados y `email_bounced`.
4. Preferencias:
   - **Clínica** (`global_notification_settings`, canal `email` + categoría; sin fila = deshabilitado): siempre se respeta. Es el interruptor para apagar el auto-envío de una categoría entera.
   - **Paciente** (`user_communication_preferences`): **se ignora por defecto**. Si el destinatario tenía el email apagado, se envía igual y queda `user_pref_overridden: true` en `alert_actions.action_data` (y el mensaje lo indica). Para que una regla vuelva a respetarla: `condition_config.respect_user_preferences = true`
     (`UPDATE public.alert_rules SET condition_config = condition_config || '{"respect_user_preferences": true}' WHERE id = …;`).
5. Entidad al momento del envío: cita `scheduled` / `confirmed` / `pending`; factura cobrable con `effective_residual > 0`.
6. Modo prueba (opcional): `system_configurations.alert_email_test_mode_enabled = 'true'` → solo envía a `alert_email_test_whitelist` (emails separados por coma).
7. Plantilla sin variables desconocidas (si hay alguna, no se envía).

Éxito → `alert_actions` `SEND_EMAIL`/`SUCCESS` y la alerta pasa a `COMPLETED`. Fallo → `alert_actions` `SEND_EMAIL`/`FAILED` con el motivo; la alerta queda `PENDING` para el staff.

## Variables de plantilla

`{{patient_name}}`, `{{recipient_name}}` (paciente o responsable), `{{for_patient}}` / `{{to_patient}}` (vacías si el email va al paciente; `" de Juan"` / `" a Juan"` si va al responsable), `{{clinic_name}}`, `{{clinic_address}}`, `{{clinic_phone}}`, `{{clinic_email}}`, `{{clinic_contact}}` (teléfono · email), `{{clinic_phone_link}}` (`tel:` para botones; si está vacío el botón se quita), `{{clinic_logo}}`.
Citas: `{{appointment_date}}`, `{{appointment_time}}`, `{{doctor_name}}`, `{{location}}` (sede + dirección).
Facturas: `{{invoice_doc_no}}`, `{{invoice_amount}}` (saldo pendiente), `{{invoice_due_date}}`, `{{invoice_currency}}` (alias `{{doc_no}}`, `{{currency}}`).

Si la plantilla no trae layout propio se envuelve con el layout de la clínica, con los colores del sistema de diseño: cabecera índigo (`--nav-bg`) con línea violeta, contenido blanco con borde lila y pie gris. Las plantillas 7/9/8 usan los mismos recursos que la app: etiqueta violeta en mayúsculas, tarjeta de datos con barra de acento a la izquierda y botón violeta (`--primary`).

## SQL (DEV / cliente) — requiere confirmación antes de ejecutar

1. **Plantillas 7 / 9 / 8**: [`docs/sql/alert-email-templates.sql`](sql/alert-email-templates.sql). Reemplaza `subject` y `body_html` de las filas existentes (las actuales usan `{{data.id}}`, `{{patient.full_name}}`, … y el flujo se negaría a enviarlas).

```sql
-- 2) Factura: un solo aviso, 3 días antes del vencimiento (antes: ventana -5..+5 días,
--    que con auto-envío habría mandado un email por día).
UPDATE public.alert_rules SET days_before = 3, days_after = 0, updated_at = now() WHERE id = 8;

-- 3) Modo prueba ANTES de activar (DEV tiene pacientes con emails reales).
INSERT INTO public.system_configurations (key, value, data_type, description)
VALUES
  ('alert_email_test_mode_enabled', 'true', 'boolean', 'Auto-envío de email de alertas: solo a la lista blanca'),
  ('alert_email_test_whitelist', '<emails de prueba separados por coma>', 'string', 'Emails permitidos con el modo prueba activo');

-- 4) Activar el auto-envío (también se puede desde /system/alert-rules).
UPDATE public.alert_rules SET auto_send_email = true, updated_at = now() WHERE id IN (6, 8, 10);
```

## Checklist de despliegue

1. En n8n crear la credencial **Gmail OAuth2 con la cuenta de la clínica**.
2. Importar `Alert Email Auto-Send.json` y elegir esa credencial en `Send Email (Gmail)`.
3. Importar `Alert Scheduler.json` y en `Send Alert Email` elegir el flujo *Alert Email Auto-Send* (el JSON trae el placeholder `REPLACE_WITH_ALERT_EMAIL_AUTO_SEND_ID`).
4. Ejecutar el SQL 1–3, probar con `POST /system/alert-scheduler` (MANUAL) y revisar `alert_actions` (`SEND_EMAIL`).
5. Quitar el modo prueba (`alert_email_test_mode_enabled = 'false'`) y ejecutar el SQL 4.

## Botones Confirmar / Cancelar (recordatorio de cita)

La plantilla 7 lleva dos botones que cambian el estado de la cita sin que el paciente inicie sesión.

**Por qué no es un GET directo.** Outlook Safe Links, Proofpoint, Mimecast y varios antivirus abren con GET los enlaces de los correos para revisarlos. Si ese GET confirmara o cancelara, habría citas canceladas sin que nadie haga clic. Por eso:

1. El botón abre `{WEBHOOK_URL}/webhook/appointments/email-action_noauth?t=<token>&a=confirm|cancel`.
2. Ese **GET no toca la base**: devuelve una página que, al cargarse, hace el **POST** por JavaScript y muestra el resultado. Para el paciente es un solo clic. Sin JavaScript, la página muestra un botón (formulario POST).
3. El **POST** valida el token y cambia el estado.

**Token.** 32 bytes aleatorios (base64url), uno por email y válido para las dos acciones. En `appointment_action_tokens` se guarda solo su sha256, junto con el vencimiento, la última acción usada y la IP / user-agent de quien la usó. Vence al inicio de la cita menos `appointment_email_actions_cutoff_hours` (`system_configurations`, default `0`).

**Reglas** (`Apply Email Action`, una sola sentencia que bloquea el token y la cita):

| Acción | Desde | Resultado |
|---|---|---|
| confirm | pending / scheduled | `confirmed` |
| cancel | pending / scheduled / confirmed | `cancelled`, motivo `in_time` |
| la misma acción otra vez | — | "ya estaba…", sin cambios |
| cualquier otro estado (cancelada, atendida, ausente…) | — | "no se puede desde el email" |
| token vencido / inexistente | — | "este enlace venció" / "enlace no válido" |

Cada cambio queda en `appointment_status_log` (`changed_by` = paciente, nota con la IP) y como `NOTE` en `alert_actions` de la alerta. Después se emite `calendar_changed` (la agenda se actualiza en vivo) y, si fue una cancelación, una notificación HIGH al profesional. Igual que `appointments/update_status`, **no sincroniza con Google Calendar**.

Una cita ya confirmada recibe solo el botón "Cancelar". Si la cita ya está fuera de plazo, o n8n no tiene `WEBHOOK_URL`, los botones se quitan del email. Si el token no se puede guardar, el email no se envía y queda un `SEND_EMAIL`/`FAILED`.

**Riesgo residual.** Un escáner que ejecute JavaScript (algunos sandboxes lo hacen) podría disparar el POST. Cada uso guarda IP y user-agent en `appointment_action_tokens` para poder detectarlo. Si aparece, la salida es que "Cancelar" pida un segundo clic en la página (`Render Landing`).

### Despliegue

1. Ejecutar `database/scripts/134_20261015_appointment-email-actions.sql`.
2. Importar `docs/n8n-flows/Appointment Email Action (noauth).json` y **activarlo** (es público, sin JWT).
3. Reimportar `docs/n8n-flows/Alert Email Auto-Send.json` (nodos nuevos `Store Action Token`, `Check Action Token`, `Token OK?`; volver a elegir la credencial Gmail).
4. Reejecutar `docs/sql/alert-email-templates.sql` (la plantilla 7 cambia el botón "Llamar" por Confirmar / Cancelar).
5. Probar con el modo prueba de email activo: abrir los dos enlaces y revisar `appointment_status_log`, `appointment_action_tokens` y la agenda.
