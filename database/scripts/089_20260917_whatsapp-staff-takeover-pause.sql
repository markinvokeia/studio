-- =====================================================================
-- WhatsApp Agent → pausa por intervención manual de un humano ("staff_takeover")
-- Run on: dev / staging / prod
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- =====================================================================
--
-- Contexto:
--   La migración 065_20260902_whatsapp-agent-human-handoff.sql ya dejó
--   preparadas las columnas de whatsapp_conversation_activity (agent_paused,
--   paused_reason, paused_by, paused_at) y documentó paused_reason como
--   'patient_request' | 'staff_takeover', pero solo el caso 'patient_request'
--   estaba implementado en el workflow de n8n "Whats App".
--
--   Ahora se implementa 'staff_takeover': cuando alguien del equipo le escribe
--   manualmente a un paciente desde la app de WhatsApp Business (evento YCloud
--   whatsapp.smb.message.echoes — que Meta dispara EXCLUSIVAMENTE para envíos
--   hechos a mano desde la app/dispositivo vinculado, nunca para envíos hechos
--   por la API, así que no hace falta distinguir "eco propio del bot" de
--   "mensaje humano": todo lo que llega por ese evento es de un humano), el
--   agente se pausa. El temporizador se renueva con cada mensaje humano nuevo
--   (mientras el humano siga escribiendo, el agente no vuelve a responder).
--
--   paused_by queda NULL para este caso: el evento de YCloud no identifica
--   qué usuario del staff escribió (fue hecho desde la app de WhatsApp
--   Business, fuera de nuestro panel), igual que ya pasa con 'patient_request'.
--
-- Cambios:
--   1. system_configurations.whatsapp_staff_takeover_pause_minutes (default '60')
--      — separada de whatsapp_handoff_timeout_minutes para poder configurar
--      duraciones distintas entre "el paciente pidió un humano" y "un humano
--      se metió proactivamente en la conversación".
--   2. whatsapp_conversation_activity_last_sender_check — el CHECK actual solo
--      permite 'patient' | 'bot'; se amplía a 'human' (usado por
--      Track Human Message + Pause en el workflow de n8n "Whats App").
-- =====================================================================

BEGIN;

-- ─── 1. Config: ventana de pausa por intervención manual de un humano (minutos) ─

INSERT INTO public.system_configurations (key, value, description, data_type, is_public)
SELECT
    'whatsapp_staff_takeover_pause_minutes',
    '60',
    'Minutos que el agente de WhatsApp permanece pausado desde el último mensaje que un humano del equipo le escribió manualmente a un paciente (vía app de WhatsApp Business). Se renueva con cada mensaje humano nuevo.',
    'number',
    false
WHERE NOT EXISTS (
    SELECT 1 FROM public.system_configurations WHERE key = 'whatsapp_staff_takeover_pause_minutes'
);

-- ─── 2. CHECK de last_sender: agrega 'human' a los valores permitidos ──────────

ALTER TABLE public.whatsapp_conversation_activity
    DROP CONSTRAINT IF EXISTS whatsapp_conversation_activity_last_sender_check;
ALTER TABLE public.whatsapp_conversation_activity
    ADD CONSTRAINT whatsapp_conversation_activity_last_sender_check
        CHECK (last_sender::text = ANY (ARRAY['patient'::character varying, 'bot'::character varying, 'human'::character varying]::text[]));

-- ─── Registro de migración ────────────────────────────────────────────────────

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '089_20260917_whatsapp-staff-takeover-pause.sql',
    'v1',
    'system_configurations.whatsapp_staff_takeover_pause_minutes — habilita paused_reason=staff_takeover (ya documentado en 065) para cuando un humano escribe manualmente por WhatsApp Business; amplía whatsapp_conversation_activity_last_sender_check para permitir last_sender=''human'''
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;
