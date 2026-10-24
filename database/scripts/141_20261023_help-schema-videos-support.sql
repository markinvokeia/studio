-- =====================================================================
-- Asistente guiado — fases 1, 3 y 4: esquema de la BD en el catálogo,
-- pedidos de video y tickets de soporte
-- Run on: dev / staging / prod
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- Depende de: 140_20261023_help-assistant-and-onboarding.sql
-- =====================================================================
--
-- Cambios:
--   1. help_catalog_items.kind admite 'table'.
--   2. help_refresh_schema_items(version) — vuelca al catálogo cada tabla de
--      `public` con su comentario y sus columnas (tipo, nulabilidad, FK,
--      comentario). Lo llama POST /help/catalog/sync, así el esquema documentado
--      se actualiza en cada publicación y nunca viaja al navegador. El
--      "significado de negocio" sale de los COMMENT ON de las migraciones.
--   3. help_video_requests — pedidos de video a demanda (chat → worker de
--      scripts/videos que graba, narra y publica).
--   4. help_support_tickets — escalados del asistente con su contexto.
--   5. Permiso HELP_INSIGHTS_VIEW (panel de métricas del asistente).
--
-- Orden de despliegue: este script → reimportar n8n-workflows/help-*.json →
-- frontend.
-- =====================================================================

BEGIN;

-- -----------------------------------------------------------------------
-- 1. Tipo 'table' en el catálogo
-- -----------------------------------------------------------------------
ALTER TABLE public.help_catalog_items DROP CONSTRAINT IF EXISTS help_catalog_items_kind_check;
ALTER TABLE public.help_catalog_items ADD CONSTRAINT help_catalog_items_kind_check
    CHECK (kind IN ('screen', 'element', 'use_case', 'journey', 'permission', 'table'));

-- -----------------------------------------------------------------------
-- 2. Esquema de la BD → catálogo
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.help_refresh_schema_items(p_version text)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    v_count integer;
BEGIN
    WITH cols AS (
        SELECT c.table_name,
               string_agg(
                   c.column_name || ' ' || c.data_type
                   || CASE WHEN c.is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END
                   || COALESCE(' → ' || fk.ref_table || '.' || fk.ref_column, '')
                   || COALESCE(' — ' || col_description(format('public.%I', c.table_name)::regclass, c.ordinal_position::int), ''),
                   E'\n' ORDER BY c.ordinal_position
               ) AS columns_text,
               jsonb_agg(jsonb_build_object(
                   'name', c.column_name,
                   'type', c.data_type,
                   'nullable', c.is_nullable = 'YES',
                   'references', CASE WHEN fk.ref_table IS NULL THEN NULL ELSE fk.ref_table || '.' || fk.ref_column END,
                   'comment', col_description(format('public.%I', c.table_name)::regclass, c.ordinal_position::int)
               ) ORDER BY c.ordinal_position) AS columns_json
          FROM information_schema.columns c
          LEFT JOIN (
              SELECT kcu.table_name, kcu.column_name,
                     ccu.table_name AS ref_table, ccu.column_name AS ref_column
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
                JOIN information_schema.constraint_column_usage ccu
                  ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
               WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
          ) fk ON fk.table_name = c.table_name AND fk.column_name = c.column_name
         WHERE c.table_schema = 'public'
         GROUP BY c.table_name
    ), tables AS (
        SELECT t.table_name,
               obj_description(format('public.%I', t.table_name)::regclass, 'pg_class') AS comment
          FROM information_schema.tables t
         WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
           AND t.table_name NOT LIKE 'help\_%'
           AND t.table_name NOT IN ('db_migrations', 'databasechangelog', 'databasechangeloglock')
    ), upserted AS (
        INSERT INTO public.help_catalog_items
               (id, kind, screen_id, route, title, body, search_text, data, permissions, status, catalog_version, updated_at)
        SELECT 'table:' || t.table_name, 'table', NULL, NULL, t.table_name,
               COALESCE(t.comment || E'\n', '') || COALESCE(c.columns_text, ''),
               lower(translate(t.table_name || ' ' || replace(t.table_name, '_', ' ') || ' ' || COALESCE(t.comment, '') || ' ' || COALESCE(c.columns_text, ''),
                               'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')),
               jsonb_build_object('table', t.table_name, 'comment', t.comment, 'columns', COALESCE(c.columns_json, '[]'::jsonb)),
               '{}', CASE WHEN t.comment IS NULL THEN 'auto' ELSE 'draft' END, p_version, now()
          FROM tables t
          LEFT JOIN cols c ON c.table_name = t.table_name
        ON CONFLICT (id) DO UPDATE
            SET body = EXCLUDED.body, search_text = EXCLUDED.search_text, data = EXCLUDED.data,
                status = EXCLUDED.status, catalog_version = EXCLUDED.catalog_version, updated_at = now()
        RETURNING id
    ), staled AS (
        UPDATE public.help_catalog_items
           SET status = 'stale', updated_at = now()
         WHERE kind = 'table' AND status <> 'stale'
           AND id NOT IN (SELECT id FROM upserted)
        RETURNING id
    )
    SELECT count(*) INTO v_count FROM upserted;
    RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.help_refresh_schema_items(text) IS
    'Vuelca las tablas de public (comentario + columnas + FKs) a help_catalog_items kind=table. Lo llama POST /help/catalog/sync.';

-- -----------------------------------------------------------------------
-- 3. Pedidos de video a demanda
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.help_video_requests (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    use_case_id  text NOT NULL,
    locale       text NOT NULL DEFAULT 'es',
    requested_by uuid,
    question_id  uuid,
    status       text NOT NULL DEFAULT 'pending',
    error        text,
    video_id     text,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT help_video_requests_status_check CHECK (status IN ('pending', 'processing', 'done', 'failed'))
);

COMMENT ON TABLE public.help_video_requests IS
    'Pedidos de video de un caso de uso. Los toma el worker (pnpm videos:worker): graba el test E2E en el tenant demo, lo narra y lo publica en help_videos.';

-- Un solo pedido abierto por caso de uso e idioma.
CREATE UNIQUE INDEX IF NOT EXISTS uq_help_video_requests_open
    ON public.help_video_requests (use_case_id, locale) WHERE status IN ('pending', 'processing');

-- -----------------------------------------------------------------------
-- 4. Tickets de soporte
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.help_support_tickets (
    id          bigserial PRIMARY KEY,
    question_id uuid,
    user_id     uuid,
    channel     text NOT NULL DEFAULT 'app',
    subject     text NOT NULL,
    route       text,
    screen_id   text,
    context     jsonb NOT NULL DEFAULT '{}'::jsonb,
    status      text NOT NULL DEFAULT 'open',
    priority    text NOT NULL DEFAULT 'normal',
    assigned_to uuid,
    resolution  text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT help_support_tickets_status_check CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    CONSTRAINT help_support_tickets_priority_check CHECK (priority IN ('low', 'normal', 'high', 'critical')),
    CONSTRAINT help_support_tickets_channel_check CHECK (channel IN ('app', 'whatsapp', 'web'))
);

COMMENT ON TABLE public.help_support_tickets IS
    'Consultas que el asistente no pudo resolver (baja confianza, error del sistema o pedido de hablar con una persona), con la pantalla y el contexto. Fines de semana sólo se atienden las critical.';

CREATE INDEX IF NOT EXISTS idx_help_support_tickets_open
    ON public.help_support_tickets (created_at DESC) WHERE status IN ('open', 'in_progress');

-- -----------------------------------------------------------------------
-- 5. Permiso del panel de métricas
-- -----------------------------------------------------------------------
INSERT INTO public.permissions (name, description, code, module, submenu, permission_type)
VALUES ('Ver métricas del asistente',
        'Panel con preguntas, resolución, tickets, videos y avance del onboarding',
        'HELP_INSIGHTS_VIEW', 'system', 'help', 'view')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE lower(r.name) IN ('administrador', 'gerente')
  AND p.code = 'HELP_INSIGHTS_VIEW'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- -----------------------------------------------------------------------
-- 6. Registro de migración
-- -----------------------------------------------------------------------
INSERT INTO public.db_migrations (script_name, version_tag, notes)
VALUES (
    '141_20261023_help-schema-videos-support.sql',
    'v1',
    'Asistente: kind table + help_refresh_schema_items(), help_video_requests, help_support_tickets, permiso HELP_INSIGHTS_VIEW'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;

-- =====================================================================
-- ROLLBACK (manual)
-- =====================================================================
-- BEGIN;
-- DELETE FROM public.role_permissions WHERE permission_id IN (SELECT id FROM public.permissions WHERE code = 'HELP_INSIGHTS_VIEW');
-- DELETE FROM public.permissions WHERE code = 'HELP_INSIGHTS_VIEW';
-- DROP TABLE IF EXISTS public.help_support_tickets;
-- DROP TABLE IF EXISTS public.help_video_requests;
-- DROP FUNCTION IF EXISTS public.help_refresh_schema_items(text);
-- DELETE FROM public.help_catalog_items WHERE kind = 'table';
-- ALTER TABLE public.help_catalog_items DROP CONSTRAINT IF EXISTS help_catalog_items_kind_check;
-- ALTER TABLE public.help_catalog_items ADD CONSTRAINT help_catalog_items_kind_check
--     CHECK (kind IN ('screen', 'element', 'use_case', 'journey', 'permission'));
-- DELETE FROM public.db_migrations WHERE script_name = '141_20261023_help-schema-videos-support.sql';
-- COMMIT;
