-- =====================================================================
-- Confirmar / cancelar una cita desde el email de recordatorio
--
-- El email de la alerta "Recordatorio de Cita 24h" (flujo n8n
-- "Alert Email Auto-Send") trae dos botones. Cada email lleva un token
-- aleatorio de 32 bytes; acá se guarda SOLO su sha256 (mismo criterio que
-- study_order_booking_tokens): si alguien lee la tabla, no puede usar los
-- enlaces.
--
-- El enlace abre una página del flujo "Appointment Email Action (noauth)".
-- El GET no toca la base; el cambio de estado lo hace el POST que la página
-- dispara sola. Así los escáneres de correo (Safe Links, Proofpoint, …),
-- que abren los enlaces con GET, no confirman ni cancelan citas.
--
--   1. appointment_action_tokens: un token por email enviado. Sirve para
--      las dos acciones hasta expires_at. Guarda la última acción usada y
--      la IP / user-agent de quien la usó, para poder explicar un cambio
--      que el paciente diga no haber hecho.
--
--   2. appointment_email_actions_cutoff_hours (system_configurations,
--      default '0'): cuántas horas antes del inicio de la cita dejan de
--      funcionar los botones. 0 = hasta la hora de la cita. Se aplica al
--      generar el token (expires_at = inicio - cutoff).
--
-- expires_at va en hora de pared de la clínica, igual que
-- appointments.start_datetime; el flujo la compara contra
-- now() AT TIME ZONE 'America/Montevideo'.
--
-- Idempotente.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.appointment_action_tokens (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id    integer NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
    alert_instance_id integer REFERENCES public.alert_instances(id) ON DELETE SET NULL,
    token_hash        varchar(64) NOT NULL UNIQUE,
    recipient_email   text,
    expires_at        timestamp NOT NULL,
    use_count         smallint NOT NULL DEFAULT 0,
    last_action       varchar(10) CHECK (last_action IN ('confirm', 'cancel')),
    last_used_at      timestamp,
    last_ip           text,
    last_user_agent   text,
    revoked_at        timestamp,
    created_at        timestamp NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.appointment_action_tokens IS
    'Tokens de los botones Confirmar/Cancelar del email de recordatorio de cita. Solo se guarda el sha256 del token.';

CREATE INDEX IF NOT EXISTS idx_appointment_action_tokens_appointment
    ON public.appointment_action_tokens (appointment_id);

INSERT INTO public.system_configurations (key, value, data_type, description, is_public)
VALUES
    ('appointment_email_actions_cutoff_hours', '0', 'number',
     'Horas antes del inicio de la cita en que dejan de funcionar los botones Confirmar/Cancelar del email. 0 = hasta la hora de la cita.',
     false)
ON CONFLICT (key) DO NOTHING;

COMMIT;
