-- =====================================================================
-- WhatsApp Agent → log de mensajes con timestamp real + lock de conversación
-- Run on: dev / staging / prod / todas las bases de cliente
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- =====================================================================
--
-- Contexto:
--   Un paciente escribió por una promoción y ~20s después escribió por algo
--   sin relación; el agente respondió los 2 mensajes pero de forma ambigua
--   (respuestas que no respetan el orden en que llegaron los mensajes, o que
--   no reflejan el intercambio anterior todavía en curso). Dos causas raíz:
--
--   1. El workflow "Whats App" no serializa el procesamiento por teléfono:
--      cada mensaje entrante dispara una ejecución independiente que llama
--      al agente. Si el turno del primer mensaje (tool calls, LLM) todavía
--      no terminó cuando llega el segundo, ambas ejecuciones pueden correr
--      en simultáneo — sin garantía de orden en las respuestas y sin que la
--      segunda vea todavía el intercambio de la primera en la memoria.
--
--   2. whatsapp_conversation_activity guarda una sola fila por teléfono con
--      un `transcript` de texto (últimas 20 líneas concatenadas a mano en
--      cada UPDATE). No hay forma de saber a qué hora llegó/se envió cada
--      mensaje individual — solo `last_message_at`, que refleja nada más
--      que el último evento de la fila.
--
-- Cambios:
--   1. whatsapp_conversation_messages (tabla nueva) — un registro append-only
--      por mensaje (paciente/bot/humano) con hora real, que pasa a ser la
--      fuente de verdad para reconstruir el historial de una conversación
--      (reemplaza al transcript concatenado a mano).
--   2. whatsapp_conversation_activity.processing_started_at (columna nueva)
--      — lock de procesamiento por teléfono: el nodo "Claim Batch If Latest"
--      lo setea al reclamar un lote de mensajes y arrancar el turno del
--      agente, y lo limpia al terminar. Mientras esté seteado (y no vencido),
--      otra ejecución para el mismo teléfono espera en vez de correr el
--      agente en paralelo.
--   3. system_configurations.whatsapp_agent_debounce_seconds — de paso, saca
--      de hardcodeado el "Wait (debounce)" del workflow (antes fijo en 8s)
--      para que la ventana de agrupación de mensajes sea configurable.
--   4. whatsapp_conversation_messages pasa a loguear cada mensaje entrante
--      individual (antes solo se acumulaba en whatsapp_conversation_activity
--      un texto por lote, mezclando varios mensajes seguidos del paciente en
--      una sola línea sin distinguirlos). De paso, absorbe la deduplicación
--      por wamid que hoy hace whatsapp_inbound_dedupe (índice único parcial
--      sobre wamid) — es el mismo dato, tenerlo en dos tablas era redundante.
--      whatsapp_inbound_dedupe queda deprecada (no se borra todavía).
--      whatsapp_inbound_buffer NO se toca: sigue siendo la cola operativa del
--      debounce, separada a propósito del historial permanente (retención y
--      mecanismo de agrupación son cosas distintas que pueden evolucionar
--      cada una por su lado).
--   5. whatsapp_conversation_activity.transcript queda deprecado (el workflow
--      deja de leerlo/escribirlo; whatsapp_conversation_messages es ahora la
--      fuente de verdad). No se borra la columna todavía.
-- =====================================================================

BEGIN;

-- ─── 1. Log de mensajes por conversación (hora real por mensaje) ───────────────

CREATE TABLE IF NOT EXISTS public.whatsapp_conversation_messages (
    id           bigserial PRIMARY KEY,
    phone        character varying NOT NULL,
    sender       character varying NOT NULL CHECK (sender IN ('patient', 'bot', 'human')),
    message_text text NOT NULL,
    wamid        text NULL,
    created_at   timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_conv_messages_phone_created
    ON public.whatsapp_conversation_messages (phone, created_at);

COMMENT ON TABLE public.whatsapp_conversation_messages IS
    'Log append-only de cada mensaje de una conversación de WhatsApp (paciente/bot/humano), con hora real. Fuente de verdad para reconstruir el historial; reemplaza al transcript de texto concatenado a mano en whatsapp_conversation_activity, que solo guardaba las últimas 20 líneas sin timestamp por línea.';
COMMENT ON COLUMN public.whatsapp_conversation_messages.wamid IS
    'ID del mensaje de WhatsApp (YCloud) para mensajes entrantes del paciente. NULL en mensajes salientes del bot o de un humano del staff.';

-- ─── 2. Lock de procesamiento por conversación ─────────────────────────────────

ALTER TABLE public.whatsapp_conversation_activity
    ADD COLUMN IF NOT EXISTS processing_started_at timestamp without time zone NULL;

COMMENT ON COLUMN public.whatsapp_conversation_activity.processing_started_at
    IS 'Lock de procesamiento: se setea a NOW() cuando una ejecución del workflow "Whats App" (nodo "Claim Batch If Latest") reclama el lote de mensajes pendientes de este teléfono y arranca el turno del agente; se limpia a NULL al terminar (o se considera vencido tras whatsapp_agent_lock_timeout_seconds si la ejecución se colgó). Mientras esté activo, otra ejecución para el mismo teléfono espera en vez de correr el agente en paralelo.';

-- ─── 3. Config: timeout del lock (segundos) ────────────────────────────────────

INSERT INTO public.system_configurations (key, value, description, data_type, is_public)
SELECT
    'whatsapp_agent_lock_timeout_seconds',
    '90',
    'Segundos que puede durar el lock de procesamiento de una conversación de WhatsApp (whatsapp_conversation_activity.processing_started_at) antes de considerarse vencido y liberarse solo, por si una ejecución del agente se colgó.',
    'number',
    false
WHERE NOT EXISTS (
    SELECT 1 FROM public.system_configurations WHERE key = 'whatsapp_agent_lock_timeout_seconds'
);

-- ─── 4. Config: ventana de debounce — cuánto espera el agente a que el paciente
--        termine de escribir antes de responder (segundos) ────────────────────

INSERT INTO public.system_configurations (key, value, description, data_type, is_public)
SELECT
    'whatsapp_agent_debounce_seconds',
    '30',
    'Segundos que el agente de WhatsApp espera tras el último mensaje de un paciente antes de procesar y responder, para agrupar varios mensajes seguidos en un solo turno (nodo "Wait (debounce)" del workflow "Whats App").',
    'number',
    false
WHERE NOT EXISTS (
    SELECT 1 FROM public.system_configurations WHERE key = 'whatsapp_agent_debounce_seconds'
);

-- ─── 5. whatsapp_conversation_messages absorbe la dedupe por wamid ─────────────
--        (reemplaza a whatsapp_inbound_dedupe)

CREATE UNIQUE INDEX IF NOT EXISTS uq_wa_conv_messages_wamid
    ON public.whatsapp_conversation_messages (wamid)
    WHERE wamid IS NOT NULL;

COMMENT ON INDEX public.uq_wa_conv_messages_wamid IS
    'Garantiza no procesar dos veces el mismo mensaje de WhatsApp (reintentos de entrega del webhook). El nodo "Dedupe Check" del workflow "Whats App" ahora inserta acá (ON CONFLICT (wamid) DO NOTHING) en vez de en whatsapp_inbound_dedupe.';

DO $$
BEGIN
    IF to_regclass('public.whatsapp_inbound_dedupe') IS NOT NULL THEN
        COMMENT ON TABLE public.whatsapp_inbound_dedupe IS
            'DEPRECADA: el workflow "Whats App" ya no escribe acá — la deduplicación por wamid se hace ahora en whatsapp_conversation_messages (ver uq_wa_conv_messages_wamid). Se deja la tabla para no perder el historial previo; candidata a DROP en una migración aparte una vez confirmado en producción.';
    END IF;
END $$;

-- ─── 6. Deprecar whatsapp_conversation_activity.transcript ─────────────────────
--        (whatsapp_conversation_messages pasa a ser la fuente de verdad)

COMMENT ON COLUMN public.whatsapp_conversation_activity.transcript IS
    'DEPRECADA: el workflow "Whats App" ya no la lee ni la escribe (ver whatsapp_conversation_messages). Se mantiene por ahora para no perder lo ya registrado; candidata a DROP en una migración aparte.';

-- ─── Registro de migración ────────────────────────────────────────────────────

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '091_20260921_whatsapp-conversation-messages-and-lock.sql',
    'v1',
    'whatsapp_conversation_messages (log append-only por mensaje, con timestamp real, dedupe por wamid) + whatsapp_conversation_activity.processing_started_at (lock de procesamiento por teléfono) + system_configurations.whatsapp_agent_lock_timeout_seconds + system_configurations.whatsapp_agent_debounce_seconds; deprecados whatsapp_inbound_dedupe y whatsapp_conversation_activity.transcript (sin DROP todavía)'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;

-- =====================================================================
-- Rollback manual
-- =====================================================================
-- BEGIN;
-- ALTER TABLE public.whatsapp_conversation_activity DROP COLUMN IF EXISTS processing_started_at;
-- DROP INDEX IF EXISTS public.uq_wa_conv_messages_wamid;
-- DROP TABLE IF EXISTS public.whatsapp_conversation_messages;
-- DELETE FROM public.system_configurations WHERE key = 'whatsapp_agent_lock_timeout_seconds';
-- DELETE FROM public.system_configurations WHERE key = 'whatsapp_agent_debounce_seconds';
-- DELETE FROM public.db_migrations WHERE script_name = '091_20260921_whatsapp-conversation-messages-and-lock.sql';
-- -- Ojo: esto no revierte los COMMENT de deprecación en whatsapp_inbound_dedupe
-- -- ni en whatsapp_conversation_activity.transcript (son cosméticos, no hace
-- -- falta revertirlos); tampoco reactiva su escritura en el workflow.
-- COMMIT;
