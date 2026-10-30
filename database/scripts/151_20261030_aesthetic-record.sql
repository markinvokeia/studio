-- =====================================================================
-- Ficha estética — sesiones con capas por servicio, unidades de medida
--
--   1. measurement_units → catálogo de unidades (unidad, ml, mg, cc…).
--      Lo administra la clínica en Catálogo de la Clínica → Unidades.
--   2. service_aesthetic_config → qué servicios se marcan en la ficha
--      estética, con qué unidad y con qué herramienta (punto o área).
--      Tabla aparte, NO columnas en service_catalog: así el alta/edición de
--      servicios (catalogoservicios/upsert) no cambia. Tener fila acá es lo
--      que hace "estético" a un servicio.
--   3. aesthetic_sessions → una sesión de la ficha (fecha, doctor, cita).
--   4. aesthetic_layers → una capa por servicio dentro de la sesión. Lote,
--      vencimiento, profundidad, técnica y notas se cargan UNA vez acá.
--      La unidad y la herramienta se copian del servicio al crear la capa:
--      si después se cambia la configuración del servicio, las sesiones
--      viejas conservan cómo se registraron.
--   5. aesthetic_marks → los puntos y áreas de cada capa. Lote, vencimiento,
--      profundidad, técnica y notas en NULL ⇒ se heredan de la capa; con
--      valor ⇒ reemplazan el de la capa sólo para esa marca. La cantidad es
--      siempre de la marca (en un área, el total aplicado en el área).
--   6. aesthetic_photos / aesthetic_consents → fotos antes/después y el
--      consentimiento firmado. Los binarios van a Google Drive (flujo n8n
--      "Aesthetic Record"), acá sólo queda la referencia — igual que
--      users.signature_* y service_catalog.image_*.
--   7. Permisos AESTHETIC_RECORD_* (se dan a los roles que ya tienen los del
--      odontograma) y CATALOG_UNITS_* (a los que ya tienen los de
--      medicamentos). La configuración estética del servicio va detrás de
--      SALES_SERVICES_UPDATE, que ya existe.
--
-- Las funciones lanzan 'AESTHETIC:<CODIGO>|<detalle>'; el flujo lo traduce a
-- 400 { success:false, code, detail }.
--
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- =====================================================================

BEGIN;

-- ─── 1. Unidades de medida ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.measurement_units (
    id          serial PRIMARY KEY,
    code        varchar(20)  NOT NULL,
    name        varchar(100) NOT NULL,
    symbol      varchar(20)  NOT NULL,
    -- Paso del campo cantidad: 1 para unidades enteras, 0.05 para ml…
    step        numeric(10,4) NOT NULL DEFAULT 1 CHECK (step > 0),
    is_active   boolean NOT NULL DEFAULT true,
    sort_order  integer NOT NULL DEFAULT 0,
    created_at  timestamp without time zone NOT NULL DEFAULT NOW(),
    updated_at  timestamp without time zone NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_measurement_units_code
    ON public.measurement_units (LOWER(code));

COMMENT ON TABLE public.measurement_units IS 'Unidades de medida de dosis (unidad, ml, mg, cc…). Se asignan a los servicios estéticos.';

INSERT INTO public.measurement_units (code, name, symbol, step, sort_order)
VALUES
    ('unit', 'Unidad',     'U',  1,    1),
    ('ml',   'Mililitro',  'ml', 0.05, 2),
    ('mg',   'Miligramo',  'mg', 0.1,  3),
    ('cc',   'Centímetro cúbico', 'cc', 0.05, 4)
ON CONFLICT ((LOWER(code))) DO NOTHING;

-- ─── 2. Configuración estética del servicio ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.service_aesthetic_config (
    service_id        integer PRIMARY KEY REFERENCES public.service_catalog(id) ON DELETE CASCADE,
    unit_id           integer NOT NULL REFERENCES public.measurement_units(id),
    marking_tool      varchar(10) NOT NULL DEFAULT 'point' CHECK (marking_tool IN ('point', 'area')),
    -- Cantidad con la que nace cada marca nueva (se puede cambiar por marca)
    default_quantity  numeric(12,4) CHECK (default_quantity IS NULL OR default_quantity > 0),
    default_depth     varchar(30),
    default_technique varchar(30),
    updated_at        timestamp without time zone NOT NULL DEFAULT NOW(),
    updated_by        uuid
);

COMMENT ON TABLE public.service_aesthetic_config IS 'Servicios que se marcan en la ficha estética: unidad de la dosis y herramienta de marcado (point = un clic, area = polígono).';

-- ─── 3. Sesiones ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.aesthetic_sessions (
    id             bigserial PRIMARY KEY,
    patient_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    doctor_id      uuid REFERENCES public.users(id) ON DELETE SET NULL,
    appointment_id integer,
    session_date   date NOT NULL,
    title          varchar(200) NOT NULL DEFAULT '',
    notes          text NOT NULL DEFAULT '',
    -- Figura sobre la que se marcaron los puntos del cuerpo
    body_figure    varchar(10) CHECK (body_figure IS NULL OR body_figure IN ('female', 'male')),
    created_at     timestamp without time zone NOT NULL DEFAULT NOW(),
    created_by     uuid,
    updated_at     timestamp without time zone NOT NULL DEFAULT NOW(),
    updated_by     uuid,
    deleted_at     timestamp without time zone
);

CREATE INDEX IF NOT EXISTS idx_aesthetic_sessions_patient
    ON public.aesthetic_sessions (patient_id, session_date)
    WHERE deleted_at IS NULL;

-- ─── 4. Capas (un servicio por sesión) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.aesthetic_layers (
    id            bigserial PRIMARY KEY,
    session_id    bigint NOT NULL REFERENCES public.aesthetic_sessions(id) ON DELETE CASCADE,
    service_id    integer REFERENCES public.service_catalog(id) ON DELETE SET NULL,
    -- Nombre del servicio al registrar (el catálogo puede renombrarse) + producto/marca libre
    service_name  varchar(255) NOT NULL DEFAULT '',
    product_name  varchar(255) NOT NULL DEFAULT '',
    unit_id       integer REFERENCES public.measurement_units(id),
    marking_tool  varchar(10) NOT NULL DEFAULT 'point' CHECK (marking_tool IN ('point', 'area')),
    lot           varchar(100),
    lot_expiry    date,
    depth         varchar(30),
    technique     varchar(30),
    notes         text,
    sort_order    integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_aesthetic_layers_session ON public.aesthetic_layers (session_id);

-- Un servicio aparece una sola vez por sesión
CREATE UNIQUE INDEX IF NOT EXISTS uq_aesthetic_layers_session_service
    ON public.aesthetic_layers (session_id, service_id)
    WHERE service_id IS NOT NULL;

-- ─── 5. Marcas (puntos y áreas) ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.aesthetic_marks (
    id          bigserial PRIMARY KEY,
    layer_id    bigint NOT NULL REFERENCES public.aesthetic_layers(id) ON DELETE CASCADE,
    kind        varchar(10) NOT NULL CHECK (kind IN ('point', 'area')),
    view        varchar(20) NOT NULL,
    -- Punto: su posición. Área: dónde va su número (centro). Relativos a la plantilla (0..1).
    x           numeric(8,6) NOT NULL,
    y           numeric(8,6) NOT NULL,
    -- Área: [[x,y], …] con al menos 3 vértices, relativos a la plantilla
    polygon     jsonb,
    zone        varchar(60),
    quantity    numeric(12,4) CHECK (quantity IS NULL OR quantity >= 0),
    -- NULL ⇒ se hereda de la capa
    lot         varchar(100),
    lot_expiry  date,
    depth       varchar(30),
    technique   varchar(30),
    notes       text,
    sort_order  integer NOT NULL DEFAULT 0,
    CONSTRAINT ck_aesthetic_marks_polygon CHECK (
        (kind = 'point' AND polygon IS NULL)
        OR (kind = 'area' AND jsonb_typeof(polygon) = 'array' AND jsonb_array_length(polygon) >= 3)
    )
);

CREATE INDEX IF NOT EXISTS idx_aesthetic_marks_layer ON public.aesthetic_marks (layer_id);

-- ─── 6. Fotos y consentimiento ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.aesthetic_photos (
    id             bigserial PRIMARY KEY,
    session_id     bigint NOT NULL REFERENCES public.aesthetic_sessions(id) ON DELETE CASCADE,
    kind           varchar(10) NOT NULL CHECK (kind IN ('before', 'after')),
    view           varchar(20) NOT NULL,
    file_name      varchar(255) NOT NULL DEFAULT '',
    mime_type      varchar(100) NOT NULL DEFAULT '',
    drive_file_id  varchar(255) NOT NULL,
    web_view_link  text,
    -- { x, y, scale, rotation, mirrored } — cómo se ubica detrás del mapa
    alignment      jsonb,
    created_at     timestamp without time zone NOT NULL DEFAULT NOW(),
    created_by     uuid
);

CREATE INDEX IF NOT EXISTS idx_aesthetic_photos_session ON public.aesthetic_photos (session_id);

CREATE TABLE IF NOT EXISTS public.aesthetic_consents (
    session_id               bigint PRIMARY KEY REFERENCES public.aesthetic_sessions(id) ON DELETE CASCADE,
    signer_name              varchar(255) NOT NULL,
    procedure                text NOT NULL DEFAULT '',
    -- Texto tal como se firmó
    text                     text NOT NULL DEFAULT '',
    allows_clinical_photos   boolean NOT NULL DEFAULT true,
    allows_marketing_photos  boolean NOT NULL DEFAULT false,
    signature_drive_file_id  varchar(255) NOT NULL,
    signature_mime_type      varchar(100) NOT NULL DEFAULT 'image/png',
    signed_at                timestamp without time zone NOT NULL,
    signed_by                uuid
);

-- ─── Funciones: unidades ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.measurement_units_list()
RETURNS TABLE (
    id integer, code varchar, name varchar, symbol varchar, step numeric,
    is_active boolean, sort_order integer, in_use boolean
)
LANGUAGE sql STABLE AS $$
    SELECT u.id, u.code, u.name, u.symbol, u.step, u.is_active, u.sort_order,
           EXISTS (SELECT 1 FROM public.service_aesthetic_config c WHERE c.unit_id = u.id)
           OR EXISTS (SELECT 1 FROM public.aesthetic_layers l WHERE l.unit_id = u.id) AS in_use
    FROM public.measurement_units u
    ORDER BY u.is_active DESC, u.sort_order, u.name;
$$;

-- payload: { id?, code, name, symbol, step?, is_active?, sort_order? }
CREATE OR REPLACE FUNCTION public.measurement_unit_save(p_payload jsonb)
RETURNS SETOF public.measurement_units
LANGUAGE plpgsql AS $$
DECLARE
    v_id     integer := NULLIF(p_payload->>'id', '')::integer;
    v_code   text := LOWER(TRIM(COALESCE(p_payload->>'code', '')));
    v_name   text := TRIM(COALESCE(p_payload->>'name', ''));
    v_symbol text := TRIM(COALESCE(p_payload->>'symbol', ''));
    v_step   numeric := COALESCE(NULLIF(p_payload->>'step', '')::numeric, 1);
BEGIN
    IF v_code = '' OR v_name = '' OR v_symbol = '' THEN
        RAISE EXCEPTION 'AESTHETIC:UNIT_REQUIRED_FIELDS|code, name, symbol';
    END IF;
    IF v_step <= 0 THEN
        RAISE EXCEPTION 'AESTHETIC:UNIT_INVALID_STEP|%', v_step;
    END IF;
    IF EXISTS (SELECT 1 FROM public.measurement_units u WHERE LOWER(u.code) = v_code AND u.id IS DISTINCT FROM v_id) THEN
        RAISE EXCEPTION 'AESTHETIC:UNIT_DUPLICATE_CODE|%', v_code;
    END IF;

    IF v_id IS NULL THEN
        RETURN QUERY
        INSERT INTO public.measurement_units (code, name, symbol, step, is_active, sort_order)
        VALUES (v_code, v_name, v_symbol, v_step,
                COALESCE((p_payload->>'is_active')::boolean, true),
                COALESCE(NULLIF(p_payload->>'sort_order', '')::integer,
                         (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM public.measurement_units)))
        RETURNING *;
    ELSE
        RETURN QUERY
        UPDATE public.measurement_units u
        SET code = v_code, name = v_name, symbol = v_symbol, step = v_step,
            is_active  = COALESCE((p_payload->>'is_active')::boolean, u.is_active),
            sort_order = COALESCE(NULLIF(p_payload->>'sort_order', '')::integer, u.sort_order),
            updated_at = NOW()
        WHERE u.id = v_id
        RETURNING u.*;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'AESTHETIC:UNIT_NOT_FOUND|%', v_id;
        END IF;
    END IF;
END;
$$;

-- Borra la unidad si nunca se usó; si está en uso la desactiva (las sesiones viejas la siguen mostrando)
CREATE OR REPLACE FUNCTION public.measurement_unit_delete(p_id integer)
RETURNS TABLE (id integer, deleted boolean, deactivated boolean)
LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.measurement_units u WHERE u.id = p_id) THEN
        RAISE EXCEPTION 'AESTHETIC:UNIT_NOT_FOUND|%', p_id;
    END IF;
    IF EXISTS (SELECT 1 FROM public.service_aesthetic_config c WHERE c.unit_id = p_id)
       OR EXISTS (SELECT 1 FROM public.aesthetic_layers l WHERE l.unit_id = p_id) THEN
        UPDATE public.measurement_units u SET is_active = false, updated_at = NOW() WHERE u.id = p_id;
        RETURN QUERY SELECT p_id, false, true;
    ELSE
        DELETE FROM public.measurement_units u WHERE u.id = p_id;
        RETURN QUERY SELECT p_id, true, false;
    END IF;
END;
$$;

-- ─── Funciones: configuración estética del servicio ─────────────────────────

CREATE OR REPLACE FUNCTION public.service_aesthetic_config_list()
RETURNS TABLE (
    service_id integer, service_name text, service_color varchar, is_active boolean,
    unit_id integer, unit_code varchar, unit_symbol varchar, unit_step numeric,
    marking_tool varchar, default_quantity numeric, default_depth varchar, default_technique varchar
)
LANGUAGE sql STABLE AS $$
    SELECT c.service_id, s.name, s.color, s.is_active,
           u.id, u.code, u.symbol, u.step,
           c.marking_tool, c.default_quantity, c.default_depth, c.default_technique
    FROM public.service_aesthetic_config c
    JOIN public.service_catalog s ON s.id = c.service_id
    JOIN public.measurement_units u ON u.id = c.unit_id
    ORDER BY s.name;
$$;

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
    IF v_tool NOT IN ('point', 'area') THEN
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

-- ─── Funciones: sesiones ─────────────────────────────────────────────────────

-- Sesión completa como jsonb (capas → marcas, fotos, consentimiento). Las claves
-- van en camelCase: es exactamente la forma de AestheticSession en el frontend.
CREATE OR REPLACE FUNCTION public.aesthetic_session_json(p_session_id bigint)
RETURNS jsonb
LANGUAGE sql STABLE AS $$
    SELECT jsonb_build_object(
        'id', s.id::text,
        'patientId', s.patient_id::text,
        'date', to_char(s.session_date, 'YYYY-MM-DD'),
        'title', s.title,
        'doctorId', s.doctor_id::text,
        'doctorName', NULLIF(TRIM(COALESCE(d.name, '')), ''),
        'appointmentId', s.appointment_id::text,
        'notes', s.notes,
        'bodyFigure', s.body_figure,
        'createdAt', to_char(s.created_at, 'YYYY-MM-DD"T"HH24:MI:SS'),
        'updatedAt', to_char(s.updated_at, 'YYYY-MM-DD"T"HH24:MI:SS'),
        'layers', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', l.id::text,
                'serviceId', l.service_id::text,
                'serviceName', COALESCE(NULLIF(sc.name, ''), l.service_name),
                'color', sc.color,
                'productName', l.product_name,
                'unitId', l.unit_id::text,
                'unitSymbol', COALESCE(u.symbol, ''),
                'unitStep', COALESCE(u.step, 1),
                'markingTool', l.marking_tool,
                'lot', l.lot,
                'lotExpiry', to_char(l.lot_expiry, 'YYYY-MM-DD'),
                'depth', l.depth,
                'technique', l.technique,
                'notes', l.notes,
                'marks', COALESCE((
                    SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                        'id', m.id::text,
                        'kind', m.kind,
                        'view', m.view,
                        'x', m.x,
                        'y', m.y,
                        'polygon', m.polygon,
                        'zone', m.zone,
                        'quantity', m.quantity,
                        'lot', m.lot,
                        'lotExpiry', to_char(m.lot_expiry, 'YYYY-MM-DD'),
                        'depth', m.depth,
                        'technique', m.technique,
                        'notes', m.notes
                    )) || jsonb_build_object('zone', m.zone, 'quantity', m.quantity)
                    ORDER BY m.sort_order, m.id)
                    FROM public.aesthetic_marks m WHERE m.layer_id = l.id
                ), '[]'::jsonb)
            ) ORDER BY l.sort_order, l.id)
            FROM public.aesthetic_layers l
            LEFT JOIN public.service_catalog sc ON sc.id = l.service_id
            LEFT JOIN public.measurement_units u ON u.id = l.unit_id
            WHERE l.session_id = s.id
        ), '[]'::jsonb),
        'photos', COALESCE((
            SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                'id', 'photo_' || p.id::text,
                'kind', p.kind,
                'view', p.view,
                'fileName', p.file_name,
                'mimeType', p.mime_type,
                'createdAt', to_char(p.created_at, 'YYYY-MM-DD"T"HH24:MI:SS'),
                'alignment', p.alignment
            )) ORDER BY p.created_at, p.id)
            FROM public.aesthetic_photos p WHERE p.session_id = s.id
        ), '[]'::jsonb),
        'consent', (
            SELECT jsonb_build_object(
                'signedAt', to_char(c.signed_at, 'YYYY-MM-DD"T"HH24:MI:SS'),
                'signerName', c.signer_name,
                'procedure', c.procedure,
                'text', c.text,
                'allowsClinicalPhotos', c.allows_clinical_photos,
                'allowsMarketingPhotos', c.allows_marketing_photos,
                'signatureFileId', 'signature_' || c.session_id::text
            )
            FROM public.aesthetic_consents c WHERE c.session_id = s.id
        )
    )
    FROM public.aesthetic_sessions s
    LEFT JOIN public.users d ON d.id = s.doctor_id
    WHERE s.id = p_session_id AND s.deleted_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.aesthetic_sessions_list(p_patient_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE AS $$
    SELECT COALESCE(jsonb_agg(public.aesthetic_session_json(s.id) ORDER BY s.session_date, s.created_at), '[]'::jsonb)
    FROM public.aesthetic_sessions s
    WHERE s.patient_id = p_patient_id AND s.deleted_at IS NULL;
$$;

-- payload (camelCase, igual que el frontend):
-- { id?, patientId, date, title, doctorId?, appointmentId?, notes, bodyFigure?,
--   layers: [{ serviceId, serviceName, productName, unitId, markingTool, lot, lotExpiry, depth, technique, notes,
--              marks: [{ kind, view, x, y, polygon?, zone, quantity, lot?, lotExpiry?, depth?, technique?, notes? }] }] }
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
            INSERT INTO public.aesthetic_marks
                (layer_id, kind, view, x, y, polygon, zone, quantity,
                 lot, lot_expiry, depth, technique, notes, sort_order)
            VALUES (v_layer_id,
                    COALESCE(NULLIF(v_mark->>'kind', ''), 'point'),
                    v_mark->>'view',
                    (v_mark->>'x')::numeric,
                    (v_mark->>'y')::numeric,
                    CASE WHEN v_mark->>'kind' = 'area' THEN v_mark->'polygon' END,
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

-- Borrado lógico: fotos y firma quedan en Drive (historia clínica)
CREATE OR REPLACE FUNCTION public.aesthetic_session_delete(p_id bigint, p_user uuid)
RETURNS TABLE (id bigint, deleted boolean)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE public.aesthetic_sessions s
    SET deleted_at = NOW(), updated_at = NOW(), updated_by = p_user
    WHERE s.id = p_id AND s.deleted_at IS NULL;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'AESTHETIC:SESSION_NOT_FOUND|%', p_id;
    END IF;
    RETURN QUERY SELECT p_id, true;
END;
$$;

-- ─── Funciones: fotos y consentimiento ──────────────────────────────────────
-- El flujo sube el binario a Drive y después llama a estas funciones; las que
-- reemplazan o quitan un archivo devuelven el drive_file_id viejo para que el
-- flujo lo borre de Drive (best-effort, como users/signature).

CREATE OR REPLACE FUNCTION public.aesthetic_photo_add(
    p_session_id bigint, p_kind text, p_view text, p_file_name text, p_mime_type text,
    p_drive_file_id text, p_web_view_link text, p_alignment jsonb, p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
    v_id bigint;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.aesthetic_sessions s WHERE s.id = p_session_id AND s.deleted_at IS NULL) THEN
        RAISE EXCEPTION 'AESTHETIC:SESSION_NOT_FOUND|%', p_session_id;
    END IF;
    INSERT INTO public.aesthetic_photos
        (session_id, kind, view, file_name, mime_type, drive_file_id, web_view_link, alignment, created_by)
    VALUES (p_session_id, p_kind, p_view, COALESCE(p_file_name, ''), COALESCE(p_mime_type, ''),
            p_drive_file_id, p_web_view_link, NULLIF(p_alignment, 'null'::jsonb), p_user)
    RETURNING id INTO v_id;

    RETURN (SELECT jsonb_strip_nulls(jsonb_build_object(
        'id', 'photo_' || p.id::text, 'kind', p.kind, 'view', p.view, 'fileName', p.file_name, 'mimeType', p.mime_type,
        'createdAt', to_char(p.created_at, 'YYYY-MM-DD"T"HH24:MI:SS'), 'alignment', p.alignment))
        FROM public.aesthetic_photos p WHERE p.id = v_id);
END;
$$;

-- Los ids de foto que ve el frontend son 'photo_<id>' (los mismos que pide aesthetic_file_get)
CREATE OR REPLACE FUNCTION public.aesthetic_photo_id(p_photo_id text)
RETURNS bigint
LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE WHEN p_photo_id ~ '^(photo_)?[0-9]+$' THEN regexp_replace(p_photo_id, '^photo_', '')::bigint END;
$$;

CREATE OR REPLACE FUNCTION public.aesthetic_photo_delete(p_id text)
RETURNS TABLE (id text, previous_drive_file_id varchar)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY DELETE FROM public.aesthetic_photos p WHERE p.id = public.aesthetic_photo_id(p_id)
        RETURNING 'photo_' || p.id::text, p.drive_file_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'AESTHETIC:PHOTO_NOT_FOUND|%', p_id;
    END IF;
END;
$$;

-- p_alignment NULL ⇒ se borra el ajuste
CREATE OR REPLACE FUNCTION public.aesthetic_photo_set_alignment(p_id text, p_alignment jsonb)
RETURNS TABLE (id text, alignment jsonb)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY UPDATE public.aesthetic_photos p
        SET alignment = NULLIF(p_alignment, 'null'::jsonb)
        WHERE p.id = public.aesthetic_photo_id(p_id)
        RETURNING 'photo_' || p.id::text, p.alignment;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'AESTHETIC:PHOTO_NOT_FOUND|%', p_id;
    END IF;
END;
$$;

-- Firma (o vuelve a firmar) el consentimiento de la sesión
CREATE OR REPLACE FUNCTION public.aesthetic_consent_save(
    p_session_id bigint, p_payload jsonb, p_drive_file_id text, p_mime_type text, p_user uuid)
RETURNS TABLE (consent jsonb, previous_drive_file_id varchar)
LANGUAGE plpgsql AS $$
DECLARE
    v_previous varchar;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.aesthetic_sessions s WHERE s.id = p_session_id AND s.deleted_at IS NULL) THEN
        RAISE EXCEPTION 'AESTHETIC:SESSION_NOT_FOUND|%', p_session_id;
    END IF;
    IF TRIM(COALESCE(p_payload->>'signerName', '')) = '' THEN
        RAISE EXCEPTION 'AESTHETIC:SIGNER_REQUIRED|';
    END IF;

    SELECT c.signature_drive_file_id INTO v_previous
    FROM public.aesthetic_consents c WHERE c.session_id = p_session_id;

    INSERT INTO public.aesthetic_consents AS c
        (session_id, signer_name, procedure, text, allows_clinical_photos, allows_marketing_photos,
         signature_drive_file_id, signature_mime_type, signed_at, signed_by)
    VALUES (p_session_id,
            TRIM(p_payload->>'signerName'),
            COALESCE(p_payload->>'procedure', ''),
            COALESCE(p_payload->>'text', ''),
            COALESCE((p_payload->>'allowsClinicalPhotos')::boolean, true),
            COALESCE((p_payload->>'allowsMarketingPhotos')::boolean, false),
            p_drive_file_id,
            COALESCE(NULLIF(p_mime_type, ''), 'image/png'),
            COALESCE(NULLIF(p_payload->>'signedAt', '')::timestamp, NOW()::timestamp),
            p_user)
    ON CONFLICT ON CONSTRAINT aesthetic_consents_pkey DO UPDATE
        SET signer_name = EXCLUDED.signer_name,
            procedure = EXCLUDED.procedure,
            text = EXCLUDED.text,
            allows_clinical_photos = EXCLUDED.allows_clinical_photos,
            allows_marketing_photos = EXCLUDED.allows_marketing_photos,
            signature_drive_file_id = EXCLUDED.signature_drive_file_id,
            signature_mime_type = EXCLUDED.signature_mime_type,
            signed_at = EXCLUDED.signed_at,
            signed_by = EXCLUDED.signed_by;

    RETURN QUERY SELECT public.aesthetic_session_json(p_session_id)->'consent', v_previous;
END;
$$;

-- Archivo a descargar: 'photo_<id>' o 'signature_<session_id>' (los ids que ve el frontend)
CREATE OR REPLACE FUNCTION public.aesthetic_file_get(p_file_id text)
RETURNS TABLE (drive_file_id varchar, mime_type varchar)
LANGUAGE sql STABLE AS $$
    SELECT p.drive_file_id, p.mime_type
    FROM public.aesthetic_photos p
    JOIN public.aesthetic_sessions s ON s.id = p.session_id AND s.deleted_at IS NULL
    WHERE p_file_id ~ '^photo_[0-9]+$' AND p.id = public.aesthetic_photo_id(p_file_id)
    UNION ALL
    SELECT c.signature_drive_file_id, c.signature_mime_type
    FROM public.aesthetic_consents c
    JOIN public.aesthetic_sessions s ON s.id = c.session_id AND s.deleted_at IS NULL
    WHERE p_file_id ~ '^signature_[0-9]+$' AND c.session_id = substring(p_file_id FROM 11)::bigint;
$$;

-- ─── 7. Permisos ─────────────────────────────────────────────────────────────

INSERT INTO public.permissions (name, description, code, module, submenu, permission_type)
VALUES
    ('Ver ficha estética', 'Ver las sesiones, fotos y consentimientos de la ficha estética del paciente',
     'AESTHETIC_RECORD_VIEW', 'Pacientes', 'Historia Clínica > Ficha estética', 'LECTURA'),
    ('Registrar sesión estética', 'Crear y editar sesiones de la ficha estética (marcas, fotos, consentimiento)',
     'AESTHETIC_RECORD_REGISTER_SESSION', 'Pacientes', 'Historia Clínica > Ficha estética', 'FUNCIONAL'),
    ('Ver listado de unidades de medida', 'Ver las unidades de medida de las dosis',
     'CATALOG_UNITS_VIEW_LIST', 'Catálogo Clínica', 'Unidades de medida', 'LECTURA'),
    ('Crear unidad de medida', 'Crear unidades de medida',
     'CATALOG_UNITS_CREATE', 'Catálogo Clínica', 'Unidades de medida', 'CREAR'),
    ('Editar unidad de medida', 'Editar unidades de medida',
     'CATALOG_UNITS_UPDATE', 'Catálogo Clínica', 'Unidades de medida', 'ACTUALIZAR'),
    ('Eliminar unidad de medida', 'Eliminar o desactivar unidades de medida',
     'CATALOG_UNITS_DELETE', 'Catálogo Clínica', 'Unidades de medida', 'ELIMINAR')
ON CONFLICT (code) DO NOTHING;

-- Cada permiso nuevo va a los roles que ya tienen su equivalente
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT rp.role_id, p_new.id
FROM (VALUES
    ('ODONTOGRAM_VIEW',              'AESTHETIC_RECORD_VIEW'),
    ('ODONTOGRAM_REGISTER_SESSION',  'AESTHETIC_RECORD_REGISTER_SESSION'),
    ('CATALOG_MEDICATIONS_VIEW_LIST','CATALOG_UNITS_VIEW_LIST'),
    ('CATALOG_MEDICATIONS_CREATE',   'CATALOG_UNITS_CREATE'),
    ('CATALOG_MEDICATIONS_UPDATE',   'CATALOG_UNITS_UPDATE'),
    ('CATALOG_MEDICATIONS_DELETE',   'CATALOG_UNITS_DELETE')
) AS map(existing_code, new_code)
JOIN public.permissions p_old ON p_old.code = map.existing_code
JOIN public.role_permissions rp ON rp.permission_id = p_old.id
JOIN public.permissions p_new ON p_new.code = map.new_code
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ─── Registro de migración ────────────────────────────────────────────────────

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '151_20261030_aesthetic-record.sql',
    'v1',
    'measurement_units + service_aesthetic_config + aesthetic_sessions/layers/marks/photos/consents + funciones + permisos AESTHETIC_RECORD_* / CATALOG_UNITS_*'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;
