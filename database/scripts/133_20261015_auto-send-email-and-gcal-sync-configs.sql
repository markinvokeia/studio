-- =====================================================================
-- Interruptores globales: envío automático de emails de alertas y
-- sincronización con Google Calendar
--
--   1. alert_email_auto_send_enabled (boolean, default 'false')
--      Interruptor general por encima de alert_rules.auto_send_email. El
--      Alert Scheduler solo envía el email si este valor es 'true' Y la regla
--      tiene auto_send_email = true. Con 'false' no se envía ningún email
--      automático (la alerta se genera igual y queda pendiente).
--      Se edita en Sistema → Configuración de alertas → Envío automático.
--
--   2. google_calendar_sync_mode (string, default 'none')
--        none        → no se sincroniza nada
--        from_google → solo Google → app (importa eventos nuevos y
--                      cancelaciones de los calendarios con google_calendar_id)
--        to_google   → solo app → Google (crea/actualiza/borra eventos)
--        both        → ambas direcciones
--      Lo lee "All Appointment Workflows" (sección Integración con Google
--      Calendar). Se edita en Configuración → Calendarios.
--
-- Ambas claves arrancan DESACTIVADAS. Si la clave ya existe no se toca
-- (ON CONFLICT DO NOTHING), así el script no pisa un valor elegido.
--
-- Idempotente.
-- =====================================================================

BEGIN;

INSERT INTO public.system_configurations (key, value, data_type, description, is_public)
VALUES
    ('alert_email_auto_send_enabled', 'true', 'boolean',
     'Interruptor general del envío automático de emails de alertas. Con false no se envía ningún email automático aunque la regla tenga auto_send_email.',
     false),
    ('google_calendar_sync_mode', 'none', 'string',
     'Sincronización con Google Calendar: none (no sincroniza), from_google (Google → app), to_google (app → Google), both (ambas).',
     false)
ON CONFLICT (key) DO NOTHING;

COMMIT;
