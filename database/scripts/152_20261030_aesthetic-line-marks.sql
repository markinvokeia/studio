-- =====================================================================
-- Ficha estética — herramienta "línea" para los hilos tensores
--
-- Un tensor se coloca como un trazo (vertical, horizontal u oblicuo), que no
-- es ni un punto ni un área. Se agrega el tipo de marca 'line':
--
--   · aesthetic_marks.kind, aesthetic_layers.marking_tool y
--     service_aesthetic_config.marking_tool aceptan 'line'.
--   · La línea reutiliza aesthetic_marks.polygon con EXACTAMENTE 2 vértices
--     [[x1,y1],[x2,y2]] (inicio y fin, relativos a la plantilla); x/y es su
--     punto medio, donde va el número. No hace falta columna nueva.
--   · aesthetic_session_save valida la línea y guarda su trazo.
--
-- Nada más cambia: los endpoints del flujo "Aesthetic Record" pasan el jsonb
-- tal cual, así que el flujo NO se reimporta.
--
-- Idempotente. Depende de: 151_20261030_aesthetic-record.sql
-- =====================================================================

BEGIN;

ALTER TABLE public.aesthetic_marks DROP CONSTRAINT IF EXISTS aesthetic_marks_kind_check;
ALTER TABLE public.aesthetic_marks
    ADD CONSTRAINT aesthetic_marks_kind_check CHECK (kind IN ('point', 'area', 'line'));

ALTER TABLE public.aesthetic_marks DROP CONSTRAINT IF EXISTS ck_aesthetic_marks_polygon;
ALTER TABLE public.aesthetic_marks
    ADD CONSTRAINT ck_aesthetic_marks_polygon CHECK (
        (kind = 'point' AND polygon IS NULL)
        OR (kind = 'area' AND jsonb_typeof(polygon) = 'array' AND jsonb_array_length(polygon) >= 3)
        OR (kind = 'line' AND jsonb_typeof(polygon) = 'array' AND jsonb_array_length(polygon) = 2)
    );

COMMENT ON COLUMN public.aesthetic_marks.polygon IS 'area: contorno [[x,y],…] con ≥3 vértices. line: [[x1,y1],[x2,y2]] (inicio y fin). point: NULL. Relativos a la plantilla (0..1).';

ALTER TABLE public.aesthetic_layers DROP CONSTRAINT IF EXISTS aesthetic_layers_marking_tool_check;
ALTER TABLE public.aesthetic_layers
    ADD CONSTRAINT aesthetic_layers_marking_tool_check CHECK (marking_tool IN ('point', 'area', 'line'));

ALTER TABLE public.service_aesthetic_config DROP CONSTRAINT IF EXISTS service_aesthetic_config_marking_tool_check;
ALTER TABLE public.service_aesthetic_config
    ADD CONSTRAINT service_aesthetic_config_marking_tool_check CHECK (marking_tool IN ('point', 'area', 'line'));

-- payload: { service_id, enabled, unit_id, marking_tool, default_quantity?, default_depth?, default_technique? }
-- enabled = false ⇒ el servicio deja de ser estético (las sesiones viejas no cambian)
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

    IF v_unit IS NULL OR NOT EXISTS (SELECT 1 FROM public.measurement_units u WHERE u.id = v_unit) THEN
        RAISE EXCEPTION 'AESTHETIC:UNIT_NOT_FOUND|%', p_payload->>'unit_id';
    END IF;
    IF v_tool NOT IN ('point', 'area', 'line') THEN
        RAISE EXCEPTION 'AESTHETIC:INVALID_TOOL|%', v_tool;
    END IF;

    INSERT INTO public.service_aesthetic_config AS c
        (service_id, unit_id, marking_tool, default_quantity, default_depth, default_technique, updated_at, updated_by)
    VALUES (v_service, v_unit, v_tool,
            NULLIF(p_payload->>'default_quantity', '')::numeric,
            NULLIF(p_payload->>'default_depth', ''),
            NULLIF(p_payload->>'default_technique', ''),
            NOW(), p_user)
    ON CONFLICT ON CONSTRAINT service_aesthetic_config_pkey DO UPDATE
        SET unit_id = EXCLUDED.unit_id,
            marking_tool = EXCLUDED.marking_tool,
            default_quantity = EXCLUDED.default_quantity,
            default_depth = EXCLUDED.default_depth,
            default_technique = EXCLUDED.default_technique,
            updated_at = NOW(),
            updated_by = p_user;

    RETURN QUERY SELECT v_service, true;
END;
$$;

-- payload (camelCase, igual que el frontend):
-- { id?, patientId, date, title, doctorId?, appointmentId?, notes, bodyFigure?,
--   layers: [{ serviceId, serviceName, productName, unitId, markingTool, lot, lotExpiry, depth, technique, notes,
--              marks: [{ kind (point|area|line), view, x, y, polygon?, zone, quantity, lot?, lotExpiry?, depth?, technique?, notes? }] }] }
-- Las capas y marcas se reemplazan enteras (sus ids cambian en cada guardado: nada las referencia).
-- Las fotos y el consentimiento NO se tocan acá: tienen sus propios endpoints.
CREATE OR REPLACE FUNCTION public.aesthetic_session_save(p_payload jsonb, p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
    v_id       bigint := NULLIF(p_payload->>'id', '')::bigint;
    v_patient  uuid := NULLIF(p_payload->>'patientId', '')::uuid;
    v_date     date := NULLIF(p_payload->>'date', '')::date;
    v_layer    jsonb;
    v_mark     jsonb;
    v_layer_id bigint;
    v_li       integer := 0;
    v_mi       integer;
BEGIN
    IF v_patient IS NULL THEN
        RAISE EXCEPTION 'AESTHETIC:PATIENT_REQUIRED|';
    END IF;
    IF v_date IS NULL THEN
        RAISE EXCEPTION 'AESTHETIC:DATE_REQUIRED|';
    END IF;

    IF v_id IS NULL THEN
        INSERT INTO public.aesthetic_sessions
            (patient_id, doctor_id, appointment_id, session_date, title, notes, body_figure, created_by, updated_by)
        VALUES (v_patient,
                NULLIF(p_payload->>'doctorId', '')::uuid,
                NULLIF(p_payload->>'appointmentId', '')::integer,
                v_date,
                COALESCE(p_payload->>'title', ''),
                COALESCE(p_payload->>'notes', ''),
                NULLIF(p_payload->>'bodyFigure', ''),
                p_user, p_user)
        RETURNING id INTO v_id;
    ELSE
        UPDATE public.aesthetic_sessions s
        SET doctor_id = NULLIF(p_payload->>'doctorId', '')::uuid,
            appointment_id = NULLIF(p_payload->>'appointmentId', '')::integer,
            session_date = v_date,
            title = COALESCE(p_payload->>'title', ''),
            notes = COALESCE(p_payload->>'notes', ''),
            body_figure = NULLIF(p_payload->>'bodyFigure', ''),
            updated_at = NOW(),
            updated_by = p_user
        WHERE s.id = v_id AND s.patient_id = v_patient AND s.deleted_at IS NULL;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'AESTHETIC:SESSION_NOT_FOUND|%', v_id;
        END IF;
        DELETE FROM public.aesthetic_layers l WHERE l.session_id = v_id;
    END IF;

    FOR v_layer IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'layers', '[]'::jsonb)) LOOP
        v_li := v_li + 1;
        BEGIN
            INSERT INTO public.aesthetic_layers
                (session_id, service_id, service_name, product_name, unit_id, marking_tool,
                 lot, lot_expiry, depth, technique, notes, sort_order)
            VALUES (v_id,
                    NULLIF(v_layer->>'serviceId', '')::integer,
                    COALESCE(v_layer->>'serviceName', ''),
                    COALESCE(v_layer->>'productName', ''),
                    NULLIF(v_layer->>'unitId', '')::integer,
                    COALESCE(NULLIF(v_layer->>'markingTool', ''), 'point'),
                    NULLIF(v_layer->>'lot', ''),
                    NULLIF(v_layer->>'lotExpiry', '')::date,
                    NULLIF(v_layer->>'depth', ''),
                    NULLIF(v_layer->>'technique', ''),
                    NULLIF(v_layer->>'notes', ''),
                    v_li)
            RETURNING id INTO v_layer_id;
        EXCEPTION WHEN unique_violation THEN
            RAISE EXCEPTION 'AESTHETIC:DUPLICATE_SERVICE_LAYER|%', v_layer->>'serviceId';
        END;

        v_mi := 0;
        FOR v_mark IN SELECT * FROM jsonb_array_elements(COALESCE(v_layer->'marks', '[]'::jsonb)) LOOP
            v_mi := v_mi + 1;
            IF v_mark->>'kind' = 'area' AND (jsonb_typeof(v_mark->'polygon') IS DISTINCT FROM 'array' OR jsonb_array_length(v_mark->'polygon') < 3) THEN
                RAISE EXCEPTION 'AESTHETIC:INVALID_AREA|capa %, marca %', v_li, v_mi;
            END IF;
            IF v_mark->>'kind' = 'line' AND (jsonb_typeof(v_mark->'polygon') IS DISTINCT FROM 'array' OR jsonb_array_length(v_mark->'polygon') <> 2) THEN
                RAISE EXCEPTION 'AESTHETIC:INVALID_LINE|capa %, marca %', v_li, v_mi;
            END IF;
            INSERT INTO public.aesthetic_marks
                (layer_id, kind, view, x, y, polygon, zone, quantity,
                 lot, lot_expiry, depth, technique, notes, sort_order)
            VALUES (v_layer_id,
                    COALESCE(NULLIF(v_mark->>'kind', ''), 'point'),
                    v_mark->>'view',
                    (v_mark->>'x')::numeric,
                    (v_mark->>'y')::numeric,
                    CASE WHEN v_mark->>'kind' IN ('area', 'line') THEN v_mark->'polygon' END,
                    NULLIF(v_mark->>'zone', ''),
                    NULLIF(v_mark->>'quantity', '')::numeric,
                    NULLIF(v_mark->>'lot', ''),
                    NULLIF(v_mark->>'lotExpiry', '')::date,
                    NULLIF(v_mark->>'depth', ''),
                    NULLIF(v_mark->>'technique', ''),
                    NULLIF(v_mark->>'notes', ''),
                    v_mi);
        END LOOP;
    END LOOP;

    RETURN public.aesthetic_session_json(v_id);
END;
$$;


INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '152_20261030_aesthetic-line-marks.sql',
    'v1',
    'aesthetic_marks.kind / marking_tool aceptan line (tensores): polygon con 2 vértices; aesthetic_session_save y service_aesthetic_config_save actualizadas'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;
