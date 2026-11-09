-- =====================================================================
-- Unidad de medida del servicio (fuera de la ficha estética)
--
-- La unidad de medida no es exclusiva de estética: es un atributo del servicio
-- que se va a usar en otros módulos. Hasta ahora vivía en
-- service_aesthetic_config.unit_id.
--
--   1. service_catalog.unit_id → unidad del servicio (opcional).
--      Se copia de service_aesthetic_config donde ya estaba cargada.
--   2. service_aesthetic_config.unit_id deja de ser obligatoria y queda como
--      copia de la del servicio: la configuración estética usa la del servicio.
--      Un servicio estético necesita unidad (AESTHETIC:UNIT_REQUIRED).
--   3. service_units_list() / service_unit_save(): se leen y escriben aparte del
--      upsert de servicios (catalogoservicios/upsert no cambia), igual que
--      bookable_online.
--   4. measurement_units_list() y measurement_unit_delete() cuentan como "en uso"
--      también las unidades asignadas a servicios.
--
-- Endpoints nuevos en el flujo "Aesthetic Record" (hay que reimportarlo):
--   GET  services/units          [{ service_id, unit_id }]
--   POST services/unit/save      { service_id, unit_id | null }
--
-- Idempotente. Depende de: 151, 152, 155.
-- =====================================================================

BEGIN;

-- ─── 1. Unidad del servicio ──────────────────────────────────────────────────

ALTER TABLE public.service_catalog ADD COLUMN IF NOT EXISTS unit_id integer REFERENCES public.measurement_units(id);

COMMENT ON COLUMN public.service_catalog.unit_id IS 'Unidad de medida del servicio (measurement_units). La usan la ficha estética y otros módulos.';

UPDATE public.service_catalog s
SET unit_id = c.unit_id
FROM public.service_aesthetic_config c
WHERE c.service_id = s.id AND s.unit_id IS NULL AND c.unit_id IS NOT NULL;

-- ─── 2. La configuración estética usa la unidad del servicio ────────────────

ALTER TABLE public.service_aesthetic_config ALTER COLUMN unit_id DROP NOT NULL;

COMMENT ON COLUMN public.service_aesthetic_config.unit_id IS 'Copia de service_catalog.unit_id al guardar la configuración (la vigente es la del servicio).';

DROP FUNCTION IF EXISTS public.service_aesthetic_config_list();
CREATE FUNCTION public.service_aesthetic_config_list()
RETURNS TABLE (
    service_id integer, service_name text, service_color varchar, is_active boolean, service_price numeric,
    unit_id integer, unit_code varchar, unit_symbol varchar, unit_step numeric,
    marking_tool varchar, default_quantity numeric, default_depth varchar, default_technique varchar,
    max_per_session numeric, min_interval_days integer, follow_up_days integer, follow_up_label varchar, aftercare text
)
LANGUAGE sql STABLE AS $$
    SELECT c.service_id, s.name, s.color, s.is_active, s.price::numeric,
           u.id, u.code, u.symbol, u.step,
           c.marking_tool, c.default_quantity, c.default_depth, c.default_technique,
           c.max_per_session, c.min_interval_days, c.follow_up_days, c.follow_up_label, c.aftercare
    FROM public.service_aesthetic_config c
    JOIN public.service_catalog s ON s.id = c.service_id
    JOIN public.measurement_units u ON u.id = COALESCE(s.unit_id, c.unit_id)
    ORDER BY s.name;
$$;

-- payload: { service_id, enabled, unit_id?, marking_tool, default_quantity?, default_depth?, default_technique?,
--            max_per_session?, min_interval_days?, follow_up_days?, follow_up_label?, aftercare? }
-- unit_id, si viene, pasa a ser la unidad del servicio (el formulario del servicio la puede
-- haber cambiado sin guardar todavía). Sin unit_id se usa la que ya tiene el servicio.
CREATE OR REPLACE FUNCTION public.service_aesthetic_config_save(p_payload jsonb, p_user uuid)
RETURNS TABLE (service_id integer, enabled boolean)
LANGUAGE plpgsql AS $$
DECLARE
    v_service integer := NULLIF(p_payload->>'service_id', '')::integer;
    v_unit    integer := NULLIF(p_payload->>'unit_id', '')::integer;
    v_tool    text := COALESCE(NULLIF(p_payload->>'marking_tool', ''), 'point');
BEGIN
    IF v_service IS NULL OR NOT EXISTS (SELECT 1 FROM public.service_catalog s WHERE s.id = v_service) THEN
        RAISE EXCEPTION 'AESTHETIC:SERVICE_NOT_FOUND|%', p_payload->>'service_id';
    END IF;

    IF COALESCE((p_payload->>'enabled')::boolean, true) = false THEN
        DELETE FROM public.service_aesthetic_config c WHERE c.service_id = v_service;
        RETURN QUERY SELECT v_service, false;
        RETURN;
    END IF;

    IF v_unit IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.measurement_units u WHERE u.id = v_unit) THEN
            RAISE EXCEPTION 'AESTHETIC:UNIT_NOT_FOUND|%', v_unit;
        END IF;
        UPDATE public.service_catalog s SET unit_id = v_unit WHERE s.id = v_service AND s.unit_id IS DISTINCT FROM v_unit;
    ELSE
        SELECT s.unit_id INTO v_unit FROM public.service_catalog s WHERE s.id = v_service;
        IF v_unit IS NULL THEN
            RAISE EXCEPTION 'AESTHETIC:UNIT_REQUIRED|%', v_service;
        END IF;
    END IF;
    IF v_tool NOT IN ('point', 'area', 'line') THEN
        RAISE EXCEPTION 'AESTHETIC:INVALID_TOOL|%', v_tool;
    END IF;

    INSERT INTO public.service_aesthetic_config AS c
        (service_id, unit_id, marking_tool, default_quantity, default_depth, default_technique,
         max_per_session, min_interval_days, follow_up_days, follow_up_label, aftercare, updated_at, updated_by)
    VALUES (v_service, v_unit, v_tool,
            NULLIF(p_payload->>'default_quantity', '')::numeric,
            NULLIF(p_payload->>'default_depth', ''),
            NULLIF(p_payload->>'default_technique', ''),
            NULLIF(p_payload->>'max_per_session', '')::numeric,
            NULLIF(p_payload->>'min_interval_days', '')::integer,
            NULLIF(p_payload->>'follow_up_days', '')::integer,
            NULLIF(TRIM(COALESCE(p_payload->>'follow_up_label', '')), ''),
            NULLIF(TRIM(COALESCE(p_payload->>'aftercare', '')), ''),
            NOW(), p_user)
    ON CONFLICT ON CONSTRAINT service_aesthetic_config_pkey DO UPDATE
        SET unit_id = EXCLUDED.unit_id,
            marking_tool = EXCLUDED.marking_tool,
            default_quantity = EXCLUDED.default_quantity,
            default_depth = EXCLUDED.default_depth,
            default_technique = EXCLUDED.default_technique,
            max_per_session = EXCLUDED.max_per_session,
            min_interval_days = EXCLUDED.min_interval_days,
            follow_up_days = EXCLUDED.follow_up_days,
            follow_up_label = EXCLUDED.follow_up_label,
            aftercare = EXCLUDED.aftercare,
            updated_at = NOW(),
            updated_by = p_user;

    RETURN QUERY SELECT v_service, true;
END;
$$;

-- ─── 3. Lectura y escritura de la unidad del servicio ───────────────────────

CREATE OR REPLACE FUNCTION public.service_units_list()
RETURNS TABLE (service_id integer, unit_id integer)
LANGUAGE sql STABLE AS $$
    SELECT s.id, s.unit_id FROM public.service_catalog s WHERE s.unit_id IS NOT NULL;
$$;

-- p_unit_id NULL ⇒ el servicio queda sin unidad (no si es un servicio estético)
CREATE OR REPLACE FUNCTION public.service_unit_save(p_service_id integer, p_unit_id integer)
RETURNS TABLE (service_id integer, unit_id integer)
LANGUAGE plpgsql AS $$
BEGIN
    IF p_service_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.service_catalog s WHERE s.id = p_service_id) THEN
        RAISE EXCEPTION 'AESTHETIC:SERVICE_NOT_FOUND|%', p_service_id;
    END IF;
    IF p_unit_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.measurement_units u WHERE u.id = p_unit_id) THEN
        RAISE EXCEPTION 'AESTHETIC:UNIT_NOT_FOUND|%', p_unit_id;
    END IF;
    IF p_unit_id IS NULL AND EXISTS (SELECT 1 FROM public.service_aesthetic_config c WHERE c.service_id = p_service_id) THEN
        RAISE EXCEPTION 'AESTHETIC:UNIT_REQUIRED|%', p_service_id;
    END IF;

    UPDATE public.service_catalog s SET unit_id = p_unit_id WHERE s.id = p_service_id;
    -- La copia de la configuración estética sigue a la del servicio
    UPDATE public.service_aesthetic_config c SET unit_id = p_unit_id WHERE c.service_id = p_service_id AND p_unit_id IS NOT NULL;

    RETURN QUERY SELECT p_service_id, p_unit_id;
END;
$$;

-- ─── 4. "En uso" también por los servicios ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.measurement_units_list()
RETURNS TABLE (
    id integer, code varchar, name varchar, symbol varchar, step numeric,
    is_active boolean, sort_order integer, in_use boolean
)
LANGUAGE sql STABLE AS $$
    SELECT u.id, u.code, u.name, u.symbol, u.step, u.is_active, u.sort_order,
           EXISTS (SELECT 1 FROM public.service_catalog s WHERE s.unit_id = u.id)
           OR EXISTS (SELECT 1 FROM public.service_aesthetic_config c WHERE c.unit_id = u.id)
           OR EXISTS (SELECT 1 FROM public.aesthetic_layers l WHERE l.unit_id = u.id) AS in_use
    FROM public.measurement_units u
    ORDER BY u.is_active DESC, u.sort_order, u.name;
$$;

CREATE OR REPLACE FUNCTION public.measurement_unit_delete(p_id integer)
RETURNS TABLE (id integer, deleted boolean, deactivated boolean)
LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.measurement_units u WHERE u.id = p_id) THEN
        RAISE EXCEPTION 'AESTHETIC:UNIT_NOT_FOUND|%', p_id;
    END IF;
    IF EXISTS (SELECT 1 FROM public.service_catalog s WHERE s.unit_id = p_id)
       OR EXISTS (SELECT 1 FROM public.service_aesthetic_config c WHERE c.unit_id = p_id)
       OR EXISTS (SELECT 1 FROM public.aesthetic_layers l WHERE l.unit_id = p_id) THEN
        UPDATE public.measurement_units u SET is_active = false, updated_at = NOW() WHERE u.id = p_id;
        RETURN QUERY SELECT p_id, false, true;
    ELSE
        DELETE FROM public.measurement_units u WHERE u.id = p_id;
        RETURN QUERY SELECT p_id, true, false;
    END IF;
END;
$$;

-- ─── Registro de migración ────────────────────────────────────────────────────

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '156_20261104_service-measurement-unit.sql',
    'v1',
    'service_catalog.unit_id (unidad de medida del servicio, fuera de estética) + service_units_list/service_unit_save; la configuración estética usa la unidad del servicio'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;
