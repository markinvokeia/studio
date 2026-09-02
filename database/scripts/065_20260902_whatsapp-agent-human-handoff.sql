-- =====================================================================
-- WhatsApp Agent → derivación a humano (human handoff)
-- Run on: dev / staging / prod
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- =====================================================================
--
-- Contexto:
--   Cuando el paciente pide hablar con una persona (o el agente detecta
--   algo que no puede resolver), el workflow de n8n "Whats App" marca la
--   conversación como pausada. Mientras esté pausada, el agente NO responde
--   los mensajes entrantes de ese teléfono. La pausa se levanta sola tras
--   una ventana configurable (system_configurations.whatsapp_handoff_timeout_minutes).
--
-- Cambios:
--   1. whatsapp_conversation_activity.agent_paused   (boolean, NOT NULL, default false)
--   2. whatsapp_conversation_activity.paused_reason  (text, nullable)   'patient_request' | 'staff_takeover'
--   3. whatsapp_conversation_activity.paused_by      (uuid, nullable, FK users.id)
--   4. whatsapp_conversation_activity.paused_at      (timestamp, nullable)
--   5. índice parcial para el barrido de auto-liberación
--   6. system_configurations.whatsapp_handoff_timeout_minutes (default '60')
-- =====================================================================

BEGIN;

-- ─── 1-4. Columnas de estado de control en whatsapp_conversation_activity ──────

ALTER TABLE public.whatsapp_conversation_activity
    ADD COLUMN IF NOT EXISTS agent_paused boolean NOT NULL DEFAULT false;

ALTER TABLE public.whatsapp_conversation_activity
    ADD COLUMN IF NOT EXISTS paused_reason text NULL;

ALTER TABLE public.whatsapp_conversation_activity
    ADD COLUMN IF NOT EXISTS paused_by uuid NULL;

ALTER TABLE public.whatsapp_conversation_activity
    ADD COLUMN IF NOT EXISTS paused_at timestamp without time zone NULL;

COMMENT ON COLUMN public.whatsapp_conversation_activity.agent_paused
    IS 'Si es true, el agente de WhatsApp no responde los mensajes entrantes de este teléfono (un humano tomó la conversación o el paciente pidió una persona).';
COMMENT ON COLUMN public.whatsapp_conversation_activity.paused_reason
    IS 'Motivo de la pausa: patient_request (el paciente pidió un humano) | staff_takeover (un usuario intervino desde el panel).';
COMMENT ON COLUMN public.whatsapp_conversation_activity.paused_by
    IS 'Usuario del staff que tomó la conversación (solo para staff_takeover).';
COMMENT ON COLUMN public.whatsapp_conversation_activity.paused_at
    IS 'Momento en que se pausó. La pausa se levanta automáticamente tras whatsapp_handoff_timeout_minutes.';

-- FK paused_by → users.id. ON DELETE SET NULL: si se elimina el usuario, la
-- conversación permanece pero deja de apuntar a él.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'whatsapp_conversation_activity'
          AND constraint_name = 'whatsapp_conversation_activity_paused_by_fkey'
    ) THEN
        ALTER TABLE public.whatsapp_conversation_activity
            ADD CONSTRAINT whatsapp_conversation_activity_paused_by_fkey
            FOREIGN KEY (paused_by) REFERENCES public.users (id)
            ON UPDATE NO ACTION ON DELETE SET NULL;
    END IF;
END $$;

-- ─── 5. Índice parcial para el barrido de auto-liberación (cron cada 15 min) ───

CREATE INDEX IF NOT EXISTS idx_wca_agent_paused
    ON public.whatsapp_conversation_activity (paused_at)
    WHERE agent_paused = true;

-- ─── 6. Config: ventana de auto-devolución al agente (minutos) ─────────────────

INSERT INTO public.system_configurations (key, value, description, data_type, is_public)
SELECT
    'whatsapp_handoff_timeout_minutes',
    '60',
    'Minutos que una conversación de WhatsApp permanece en manos de un humano antes de que el agente vuelva a responder automáticamente.',
    'number',
    false
WHERE NOT EXISTS (
    SELECT 1 FROM public.system_configurations WHERE key = 'whatsapp_handoff_timeout_minutes'
);

-- ─── Registro de migración ────────────────────────────────────────────────────

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '065_20260902_whatsapp-agent-human-handoff.sql',
    'v1',
    'whatsapp_conversation_activity: agent_paused, paused_reason, paused_by (FK users), paused_at + índice parcial; system_configurations.whatsapp_handoff_timeout_minutes'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;
