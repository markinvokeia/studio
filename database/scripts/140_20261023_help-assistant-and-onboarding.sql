-- =====================================================================
-- Asistente guiado de Invoke: base de conocimiento, onboarding y soporte
-- Run on: dev / staging / prod
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- Depende de: 139_20261022_doctor-availability-multi-day.sql
-- =====================================================================
--
-- Contexto: docs/onboarding-asistente.md (plan "Onboarding guiado y base de
-- conocimiento de Invoke IA").
--
-- Cambios:
--   1. help_catalog_items — el mapa del producto publicado en la BD del cliente.
--      Lo escribe POST /help/catalog/sync con el catálogo que trae el frontend
--      desplegado (src/generated/help-catalog.json). Búsqueda full-text en
--      español sobre `search_text` (normalizado sin tildes por el workflow).
--      Si la extensión `vector` está disponible en el servidor, además se crea
--      la columna `embedding` para búsqueda semántica (fase siguiente). La
--      imagen oficial postgres:17 NO trae pgvector: en ese caso se omite y todo
--      funciona con full-text.
--   2. help_catalog_syncs — historial de publicaciones del catálogo.
--   3. onboarding_progress — hitos del recorrido: cuándo se cumplió cada paso,
--      pasos omitidos y notas del implementador. El "cumplido" NO se guarda a
--      mano: lo calcula help_onboarding_compute() mirando los datos reales.
--   4. help_onboarding_compute() — estado de cada paso del recorrido.
--   5. help_questions — cada pregunta al asistente, con su respuesta, confianza,
--      escalado y 👍/👎. Es la línea base de soporte y la cola de "preguntas sin
--      respuesta" que alimenta el catálogo.
--   6. help_videos — videos demo por caso de uso (Fase 3: tests E2E grabados).
--   7. Permisos HELP_* y su asignación por nombre de rol.
--
-- Orden de despliegue: este script → reimportar los workflows help-*.json →
-- frontend. Sin el script, el asistente no aparece (nadie tiene HELP_ASSISTANT_USE).
-- =====================================================================

BEGIN;

-- -----------------------------------------------------------------------
-- 1. Catálogo
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.help_catalog_items (
    id              text PRIMARY KEY,
    kind            text NOT NULL,
    screen_id       text,
    route           text,
    title           text NOT NULL,
    body            text NOT NULL DEFAULT '',
    search_text     text NOT NULL DEFAULT '',
    data            jsonb NOT NULL DEFAULT '{}'::jsonb,
    permissions     text[] NOT NULL DEFAULT '{}',
    status          text NOT NULL DEFAULT 'auto',
    catalog_version text NOT NULL,
    search          tsvector GENERATED ALWAYS AS (to_tsvector('spanish', search_text)) STORED,
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT help_catalog_items_kind_check
        CHECK (kind IN ('screen', 'element', 'use_case', 'journey', 'permission')),
    CONSTRAINT help_catalog_items_status_check
        CHECK (status IN ('auto', 'draft', 'validated', 'stale'))
);

COMMENT ON TABLE public.help_catalog_items IS
    'Mapa del producto (pantallas, elementos con help id, guías, pasos de onboarding, permisos). Lo publica POST /help/catalog/sync; no editar a mano: la fuente es knowledge/ en el repo del frontend.';
COMMENT ON COLUMN public.help_catalog_items.id IS
    '<kind>:<id estable>, p. ej. screen:config.sedes, element:config.sedes.field.name, use_case:onboarding.sede.';
COMMENT ON COLUMN public.help_catalog_items.search_text IS
    'title + body en minúsculas y sin tildes (lo arma el workflow de sync). Base del tsvector.';
COMMENT ON COLUMN public.help_catalog_items.status IS
    'auto = extraído del código; draft = redactado; validated = revisado por soporte/QA; stale = ya no está en el catálogo publicado.';

CREATE INDEX IF NOT EXISTS idx_help_catalog_items_search ON public.help_catalog_items USING gin (search);
CREATE INDEX IF NOT EXISTS idx_help_catalog_items_kind ON public.help_catalog_items (kind);
CREATE INDEX IF NOT EXISTS idx_help_catalog_items_screen ON public.help_catalog_items (screen_id);

-- Búsqueda semántica: sólo si el servidor tiene pgvector instalado.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
        CREATE EXTENSION IF NOT EXISTS vector;
        EXECUTE 'ALTER TABLE public.help_catalog_items ADD COLUMN IF NOT EXISTS embedding vector(1536)';
        EXECUTE 'COMMENT ON COLUMN public.help_catalog_items.embedding IS ''Embedding de search_text (1536 dims, text-embedding-3-small de OpenAI). NULL hasta que corra el job de embeddings.''';
    ELSE
        RAISE NOTICE 'pgvector no disponible: help_catalog_items queda sólo con búsqueda full-text.';
    END IF;
END $$;

-- -----------------------------------------------------------------------
-- 2. Historial de publicaciones del catálogo
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.help_catalog_syncs (
    id              bigserial PRIMARY KEY,
    catalog_version text NOT NULL,
    items_count     integer NOT NULL,
    stale_count     integer NOT NULL DEFAULT 0,
    synced_by       uuid,
    synced_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.help_catalog_syncs IS
    'Cada publicación del catálogo. La última fila es la versión vigente (GET /help/catalog/version).';

CREATE INDEX IF NOT EXISTS idx_help_catalog_syncs_synced_at ON public.help_catalog_syncs (synced_at DESC);

-- -----------------------------------------------------------------------
-- 3. Progreso del onboarding
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.onboarding_progress (
    step_id      text PRIMARY KEY,
    status       text NOT NULL DEFAULT 'pending',
    completed_at timestamptz,
    notes        text,
    updated_by   uuid,
    updated_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT onboarding_progress_status_check CHECK (status IN ('pending', 'skipped', 'done'))
);

COMMENT ON TABLE public.onboarding_progress IS
    'Hitos del recorrido de onboarding (knowledge/onboarding/journey.json). status=done lo registra GET /help/onboarding/status la primera vez que help_onboarding_compute() lo da por cumplido; skipped lo pone un implementador.';
COMMENT ON COLUMN public.onboarding_progress.completed_at IS
    'Primera vez que el paso se cumplió. Base de la métrica "tiempo hasta el mínimo operativo".';

-- -----------------------------------------------------------------------
-- 4. Estado de cada paso, mirando los datos reales
-- -----------------------------------------------------------------------
-- is_active se lee por to_jsonb(fila) para no depender de que la columna
-- exista en todas las BDs de cliente (ausente ⇒ cuenta como activo).
CREATE OR REPLACE FUNCTION public.help_onboarding_compute()
RETURNS TABLE (step_id text, done boolean, item_count bigint)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_count bigint;
BEGIN
    SELECT count(*) INTO v_count FROM public.clinic c WHERE NULLIF(btrim(c.name), '') IS NOT NULL;
    step_id := 'business'; item_count := v_count; done := v_count > 0; RETURN NEXT;

    SELECT count(*) INTO v_count FROM public.sedes s WHERE COALESCE((to_jsonb(s) ->> 'is_active')::boolean, true);
    step_id := 'sedes'; item_count := v_count; done := v_count > 0; RETURN NEXT;

    SELECT count(*) INTO v_count FROM public.clinic_schedules;
    step_id := 'schedules'; item_count := v_count; done := v_count > 0; RETURN NEXT;

    SELECT count(*) INTO v_count FROM public.calendar_sources cs WHERE COALESCE((to_jsonb(cs) ->> 'is_active')::boolean, true);
    step_id := 'calendars'; item_count := v_count; done := v_count > 0; RETURN NEXT;

    -- Médicos: rol 2 (igual que GET /users/doctors) o rol con nombre de profesional.
    SELECT count(DISTINCT u.id) INTO v_count
      FROM public.users u
      JOIN public.user_roles ur ON ur.user_id = u.id AND COALESCE((to_jsonb(ur) ->> 'is_active')::boolean, true)
      JOIN public.roles r ON r.id = ur.role_id
     WHERE (r.id::text = '2' OR lower(r.name) IN ('doctor', 'médico', 'medico', 'odontólogo', 'odontologo'))
       AND COALESCE((to_jsonb(u) ->> 'is_active')::boolean, true);
    step_id := 'doctors'; item_count := v_count; done := v_count > 0; RETURN NEXT;

    SELECT count(*) INTO v_count FROM public.availability_rules ar WHERE COALESCE((to_jsonb(ar) ->> 'is_active')::boolean, true);
    step_id := 'availability'; item_count := v_count; done := v_count > 0; RETURN NEXT;

    SELECT count(*) INTO v_count FROM public.service_catalog sc WHERE COALESCE((to_jsonb(sc) ->> 'is_active')::boolean, true);
    step_id := 'services'; item_count := v_count; done := v_count > 0; RETURN NEXT;

    SELECT count(*) INTO v_count FROM public.appointments a
     WHERE COALESCE(a.status, '') NOT IN ('cancelled', 'canceled', 'deleted');
    step_id := 'first_appointment'; item_count := v_count; done := v_count > 0; RETURN NEXT;

    -- Equipo: quien configura ya es un usuario administrativo; cuenta a partir del segundo.
    SELECT count(DISTINCT u.id) INTO v_count
      FROM public.users u
      JOIN public.user_roles ur ON ur.user_id = u.id AND COALESCE((to_jsonb(ur) ->> 'is_active')::boolean, true)
      JOIN public.roles r ON r.id = ur.role_id
     WHERE lower(r.name) ~ '(recepcion|secretar|administr|gerent)';
    step_id := 'staff'; item_count := v_count; done := v_count > 1; RETURN NEXT;

    SELECT count(*) INTO v_count FROM public.payment_methods pm WHERE COALESCE((to_jsonb(pm) ->> 'is_active')::boolean, true);
    step_id := 'payment_methods'; item_count := v_count; done := v_count > 0; RETURN NEXT;

    -- WhatsApp: cumplido cuando ya pasó al menos un mensaje por el agente.
    IF to_regclass('public.whatsapp_conversation_messages') IS NOT NULL THEN
        EXECUTE 'SELECT count(*) FROM public.whatsapp_conversation_messages' INTO v_count;
    ELSE
        v_count := 0;
    END IF;
    step_id := 'whatsapp'; item_count := v_count; done := v_count > 0; RETURN NEXT;

    SELECT count(DISTINCT u.id) INTO v_count
      FROM public.users u
      JOIN public.user_roles ur ON ur.user_id = u.id
      JOIN public.roles r ON r.id = ur.role_id
     WHERE lower(r.name) = 'paciente';
    step_id := 'patients_import'; item_count := v_count; done := v_count > 0; RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.help_onboarding_compute() IS
    'Estado de cada paso del onboarding (ids de knowledge/onboarding/journey.json) calculado desde los datos reales. Al agregar un paso al journey, agregarlo acá.';

-- -----------------------------------------------------------------------
-- 5. Preguntas al asistente
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.help_questions (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           uuid,
    channel           text NOT NULL DEFAULT 'app',
    question          text NOT NULL,
    answer            text,
    route             text,
    screen_id         text,
    use_case_id       text,
    matched_items     text[] NOT NULL DEFAULT '{}',
    confidence        numeric(4, 3),
    escalated         boolean NOT NULL DEFAULT false,
    rating            smallint,
    feedback          text,
    resolution_status text NOT NULL DEFAULT 'answered',
    catalog_version   text,
    created_at        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT help_questions_channel_check CHECK (channel IN ('app', 'whatsapp', 'web')),
    CONSTRAINT help_questions_rating_check CHECK (rating IS NULL OR rating IN (-1, 1)),
    CONSTRAINT help_questions_resolution_check CHECK (resolution_status IN ('answered', 'open', 'resolved', 'ignored'))
);

COMMENT ON TABLE public.help_questions IS
    'Preguntas al asistente (app y, en Fase 4, WhatsApp). resolution_status=open = sin buena respuesta (baja confianza, escalada o 👎): cola para completar el catálogo.';

CREATE INDEX IF NOT EXISTS idx_help_questions_created_at ON public.help_questions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_help_questions_open ON public.help_questions (created_at DESC) WHERE resolution_status = 'open';

-- -----------------------------------------------------------------------
-- 6. Videos demo (Fase 3)
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.help_videos (
    id               text PRIMARY KEY,
    use_case_id      text NOT NULL,
    title            text NOT NULL,
    url              text NOT NULL,
    locale           text NOT NULL DEFAULT 'es',
    duration_seconds integer,
    status           text NOT NULL DEFAULT 'ready',
    catalog_version  text,
    recorded_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT help_videos_status_check CHECK (status IN ('ready', 'stale', 'generating'))
);

COMMENT ON TABLE public.help_videos IS
    'Video demo narrado de cada caso de uso, generado desde su test E2E en el tenant demo. stale = el test falló tras un cambio de pantalla y hay que regenerarlo.';

CREATE INDEX IF NOT EXISTS idx_help_videos_use_case ON public.help_videos (use_case_id, locale) WHERE status = 'ready';

-- -----------------------------------------------------------------------
-- 7. Permisos
-- -----------------------------------------------------------------------
INSERT INTO public.permissions (name, description, code, module, submenu, permission_type)
VALUES
    ('Usar el asistente de ayuda',
     'Abrir el asistente de Invoke: chat de ayuda, "¿Qué es esto?" y guías paso a paso',
     'HELP_ASSISTANT_USE', 'system', 'help', 'view'),
    ('Ver el onboarding',
     'Ver la checklist de puesta en marcha de la clínica',
     'HELP_ONBOARDING_VIEW', 'system', 'help', 'view'),
    ('Gestionar el onboarding',
     'Omitir pasos del onboarding y dejar notas de implementación',
     'HELP_ONBOARDING_MANAGE', 'system', 'help', 'write'),
    ('Publicar catálogo de ayuda',
     'Publicar en la base de datos el catálogo de ayuda del frontend desplegado',
     'HELP_CATALOG_SYNC', 'system', 'help', 'write')
ON CONFLICT (code) DO NOTHING;

-- Asistente: todo el staff (cualquier rol que no sea paciente).
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE lower(r.name) <> 'paciente'
  AND p.code = 'HELP_ASSISTANT_USE'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Onboarding y publicación del catálogo: quienes configuran la clínica.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE lower(r.name) IN ('administrador', 'gerente')
  AND p.code IN ('HELP_ONBOARDING_VIEW', 'HELP_ONBOARDING_MANAGE', 'HELP_CATALOG_SYNC')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- -----------------------------------------------------------------------
-- 8. Registro de migración
-- -----------------------------------------------------------------------
INSERT INTO public.db_migrations (script_name, version_tag, notes)
VALUES (
    '140_20261023_help-assistant-and-onboarding.sql',
    'v1',
    'Asistente guiado: help_catalog_items (+embedding si hay pgvector), help_catalog_syncs, onboarding_progress, help_onboarding_compute(), help_questions, help_videos y permisos HELP_*'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;

-- =====================================================================
-- ROLLBACK (manual)
--
-- Borra el historial de preguntas y de onboarding. La extensión `vector`
-- se deja instalada (puede usarla otra cosa).
-- =====================================================================
-- BEGIN;
-- DELETE FROM public.role_permissions WHERE permission_id IN (SELECT id FROM public.permissions WHERE code LIKE 'HELP\_%');
-- DELETE FROM public.permissions WHERE code IN ('HELP_ASSISTANT_USE', 'HELP_ONBOARDING_VIEW', 'HELP_ONBOARDING_MANAGE', 'HELP_CATALOG_SYNC');
-- DROP TABLE IF EXISTS public.help_videos;
-- DROP TABLE IF EXISTS public.help_questions;
-- DROP FUNCTION IF EXISTS public.help_onboarding_compute();
-- DROP TABLE IF EXISTS public.onboarding_progress;
-- DROP TABLE IF EXISTS public.help_catalog_syncs;
-- DROP TABLE IF EXISTS public.help_catalog_items;
-- DELETE FROM public.db_migrations WHERE script_name = '140_20261023_help-assistant-and-onboarding.sql';
-- COMMIT;
