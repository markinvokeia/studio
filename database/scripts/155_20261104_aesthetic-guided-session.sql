-- =====================================================================
-- Ficha estética — sesión guiada (Consentimiento → Fotos → Tratamiento → Cierre)
--
-- Especificación "InvokeIA · Módulo de estética — Especificación de mejoras UX".
--
--   1. aesthetic_sessions: estado CALCULADO (status + completeness), cierre
--      (closed_at/closed_by), anulación (voided_at/void_reason) y flow_version.
--        draft → consented → in_treatment → ready_to_close → closed | void
--      Nadie elige el estado: lo recalcula aesthetic_session_recompute() en cada
--      guardado, firma y foto (triggers en fotos y consentimientos).
--      flow_version = 2 ⇒ consentimiento primero: el servidor rechaza marcas de
--      un servicio sin consentimiento firmado. Las sesiones previas quedan en
--      flow_version = 1 y CERRADAS (eran registros ya guardados).
--   2. aesthetic_session_notes: notas con hora y autor durante la sesión, y
--      enmiendas (kind = 'amendment') una vez cerrada.
--   3. aesthetic_session_events: registro de actividad (firmas, fotos, notas,
--      cierre, anulación) para la trazabilidad.
--   4. aesthetic_marks.created_at / created_by: cuándo y quién puso cada marca.
--   5. aesthetic_photos.source (camera|upload|qr) y taken_at.
--   6. aesthetic_service_consents.content_sha256: hash del texto firmado.
--   7. service_aesthetic_config: dosis máxima por sesión, intervalo mínimo entre
--      aplicaciones en una zona, próxima cita sugerida e indicaciones posteriores.
--      El listado devuelve además el precio del servicio (cobro sugerido).
--
-- Endpoints nuevos en el flujo "Aesthetic Record" (hay que reimportarlo):
--   POST aesthetic/sessions/close   { id, notes? }
--   POST aesthetic/sessions/void    { id, reason }
--   POST aesthetic/notes/add        { session_id, body, kind }
--   aesthetic/photos/upload acepta además `source` (camera|upload|qr).
--
-- Idempotente. Depende de: 151, 152 y 154.
-- =====================================================================

BEGIN;

-- ─── 1. Estado de la sesión ──────────────────────────────────────────────────

ALTER TABLE public.aesthetic_sessions ADD COLUMN IF NOT EXISTS status        varchar(20);
ALTER TABLE public.aesthetic_sessions ADD COLUMN IF NOT EXISTS completeness  smallint;
ALTER TABLE public.aesthetic_sessions ADD COLUMN IF NOT EXISTS flow_version  smallint;
ALTER TABLE public.aesthetic_sessions ADD COLUMN IF NOT EXISTS closed_at     timestamp without time zone;
ALTER TABLE public.aesthetic_sessions ADD COLUMN IF NOT EXISTS closed_by     uuid;
ALTER TABLE public.aesthetic_sessions ADD COLUMN IF NOT EXISTS voided_at     timestamp without time zone;
ALTER TABLE public.aesthetic_sessions ADD COLUMN IF NOT EXISTS voided_by     uuid;
ALTER TABLE public.aesthetic_sessions ADD COLUMN IF NOT EXISTS void_reason   text;

-- Las sesiones anteriores a este flujo eran registros guardados: quedan cerradas
UPDATE public.aesthetic_sessions
SET flow_version = 1,
    status = 'closed',
    completeness = 100,
    closed_at = COALESCE(closed_at, updated_at),
    closed_by = COALESCE(closed_by, updated_by)
WHERE flow_version IS NULL;

ALTER TABLE public.aesthetic_sessions ALTER COLUMN flow_version SET DEFAULT 2;
ALTER TABLE public.aesthetic_sessions ALTER COLUMN flow_version SET NOT NULL;
ALTER TABLE public.aesthetic_sessions ALTER COLUMN status SET DEFAULT 'draft';
ALTER TABLE public.aesthetic_sessions ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.aesthetic_sessions ALTER COLUMN completeness SET DEFAULT 0;
ALTER TABLE public.aesthetic_sessions ALTER COLUMN completeness SET NOT NULL;

ALTER TABLE public.aesthetic_sessions DROP CONSTRAINT IF EXISTS ck_aesthetic_sessions_status;
ALTER TABLE public.aesthetic_sessions
    ADD CONSTRAINT ck_aesthetic_sessions_status
    CHECK (status IN ('draft', 'consented', 'in_treatment', 'ready_to_close', 'closed', 'void'));

COMMENT ON COLUMN public.aesthetic_sessions.status IS 'Calculado por aesthetic_session_recompute(): draft, consented, in_treatment, ready_to_close, closed, void. No se escribe a mano.';
COMMENT ON COLUMN public.aesthetic_sessions.flow_version IS '1 = sesión anterior al flujo guiado; 2 = consentimiento primero (el servidor bloquea marcas sin consentimiento).';

-- ─── 2. Notas con hora ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.aesthetic_session_notes (
    id          bigserial PRIMARY KEY,
    session_id  bigint NOT NULL REFERENCES public.aesthetic_sessions(id) ON DELETE CASCADE,
    body        text NOT NULL,
    -- note: durante la sesión; amendment: corrección de una sesión cerrada (no borra nada)
    kind        varchar(12) NOT NULL DEFAULT 'note' CHECK (kind IN ('note', 'amendment')),
    created_at  timestamp without time zone NOT NULL DEFAULT NOW(),
    created_by  uuid
);

CREATE INDEX IF NOT EXISTS idx_aesthetic_session_notes_session
    ON public.aesthetic_session_notes (session_id, created_at);

-- ─── 3. Registro de actividad ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.aesthetic_session_events (
    id          bigserial PRIMARY KEY,
    session_id  bigint NOT NULL REFERENCES public.aesthetic_sessions(id) ON DELETE CASCADE,
    type        varchar(40) NOT NULL,
    payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
    at          timestamp without time zone NOT NULL DEFAULT NOW(),
    actor       uuid
);

CREATE INDEX IF NOT EXISTS idx_aesthetic_session_events_session
    ON public.aesthetic_session_events (session_id, at);

-- ─── 4–6. Columnas nuevas ────────────────────────────────────────────────────

ALTER TABLE public.aesthetic_marks ADD COLUMN IF NOT EXISTS created_at timestamp without time zone;
ALTER TABLE public.aesthetic_marks ADD COLUMN IF NOT EXISTS created_by uuid;

ALTER TABLE public.aesthetic_photos ADD COLUMN IF NOT EXISTS source   varchar(10);
ALTER TABLE public.aesthetic_photos ADD COLUMN IF NOT EXISTS taken_at timestamp without time zone;
ALTER TABLE public.aesthetic_photos DROP CONSTRAINT IF EXISTS ck_aesthetic_photos_source;
ALTER TABLE public.aesthetic_photos
    ADD CONSTRAINT ck_aesthetic_photos_source CHECK (source IS NULL OR source IN ('camera', 'upload', 'qr'));

ALTER TABLE public.aesthetic_service_consents ADD COLUMN IF NOT EXISTS content_sha256 varchar(64);

CREATE OR REPLACE FUNCTION public.aesthetic_service_consent_hash()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.content_sha256 := encode(sha256(convert_to(COALESCE(NEW.title, '') || E'\n' || COALESCE(NEW.text, ''), 'UTF8')), 'hex');
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_aesthetic_service_consent_hash ON public.aesthetic_service_consents;
CREATE TRIGGER trg_aesthetic_service_consent_hash
    BEFORE INSERT OR UPDATE OF title, text ON public.aesthetic_service_consents
    FOR EACH ROW EXECUTE FUNCTION public.aesthetic_service_consent_hash();

UPDATE public.aesthetic_service_consents
SET content_sha256 = encode(sha256(convert_to(COALESCE(title, '') || E'\n' || COALESCE(text, ''), 'UTF8')), 'hex')
WHERE content_sha256 IS NULL;

-- ─── 7. Configuración estética del servicio ─────────────────────────────────

ALTER TABLE public.service_aesthetic_config ADD COLUMN IF NOT EXISTS max_per_session   numeric(12,4) CHECK (max_per_session IS NULL OR max_per_session > 0);
ALTER TABLE public.service_aesthetic_config ADD COLUMN IF NOT EXISTS min_interval_days integer CHECK (min_interval_days IS NULL OR min_interval_days > 0);
ALTER TABLE public.service_aesthetic_config ADD COLUMN IF NOT EXISTS follow_up_days    integer CHECK (follow_up_days IS NULL OR follow_up_days > 0);
ALTER TABLE public.service_aesthetic_config ADD COLUMN IF NOT EXISTS follow_up_label   varchar(120);
ALTER TABLE public.service_aesthetic_config ADD COLUMN IF NOT EXISTS aftercare         text;

-- Cambia la forma del resultado: hay que borrarla antes de recrearla
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
    JOIN public.measurement_units u ON u.id = c.unit_id
    ORDER BY s.name;
$$;

-- payload: { service_id, enabled, unit_id, marking_tool, default_quantity?, default_depth?, default_technique?,
--            max_per_session?, min_interval_days?, follow_up_days?, follow_up_label?, aftercare? }
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

-- ─── Estado calculado ────────────────────────────────────────────────────────

-- Misma regla que la tabla de estados de la especificación. Un cuarto de la
-- completitud por paso: consentimiento, fotos, tratamiento y cierre.
CREATE OR REPLACE FUNCTION public.aesthetic_session_recompute(p_session_id bigint)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
    v_closed     boolean;
    v_voided     boolean;
    v_layers     integer;
    v_consent_ok boolean;
    v_any_mark   boolean;
    v_all_marked boolean;
    v_any_photo  boolean;
    v_status     varchar;
BEGIN
    SELECT s.closed_at IS NOT NULL, s.voided_at IS NOT NULL INTO v_closed, v_voided
    FROM public.aesthetic_sessions s WHERE s.id = p_session_id;
    IF NOT FOUND THEN
        RETURN;
    END IF;

    SELECT COUNT(*) INTO v_layers FROM public.aesthetic_layers l WHERE l.session_id = p_session_id;

    v_consent_ok := v_layers > 0 AND NOT EXISTS (
        SELECT 1 FROM public.aesthetic_layers l
        WHERE l.session_id = p_session_id
          AND (l.service_id IS NULL OR NOT EXISTS (
              SELECT 1 FROM public.aesthetic_service_consents c
              WHERE c.session_id = p_session_id AND c.service_id = l.service_id)));

    v_any_mark := EXISTS (
        SELECT 1 FROM public.aesthetic_marks m JOIN public.aesthetic_layers l ON l.id = m.layer_id
        WHERE l.session_id = p_session_id);

    v_all_marked := v_layers > 0 AND NOT EXISTS (
        SELECT 1 FROM public.aesthetic_layers l
        WHERE l.session_id = p_session_id
          AND NOT EXISTS (SELECT 1 FROM public.aesthetic_marks m WHERE m.layer_id = l.id AND COALESCE(m.quantity, 0) > 0));

    v_any_photo := EXISTS (SELECT 1 FROM public.aesthetic_photos p WHERE p.session_id = p_session_id);

    v_status := CASE
        WHEN v_voided THEN 'void'
        WHEN v_closed THEN 'closed'
        WHEN v_any_mark AND v_consent_ok AND v_all_marked AND v_any_photo THEN 'ready_to_close'
        WHEN v_any_mark THEN 'in_treatment'
        WHEN v_consent_ok THEN 'consented'
        ELSE 'draft'
    END;

    UPDATE public.aesthetic_sessions s
    SET status = v_status,
        completeness = (CASE WHEN v_consent_ok THEN 25 ELSE 0 END)
                     + (CASE WHEN v_any_photo THEN 25 ELSE 0 END)
                     + (CASE WHEN v_all_marked THEN 25 ELSE 0 END)
                     + (CASE WHEN v_closed THEN 25 ELSE 0 END)
    WHERE s.id = p_session_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.aesthetic_session_guard_open(p_session_id bigint)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
    v_status varchar;
BEGIN
    SELECT s.status INTO v_status FROM public.aesthetic_sessions s WHERE s.id = p_session_id AND s.deleted_at IS NULL;
    IF v_status IS NULL THEN
        RAISE EXCEPTION 'AESTHETIC:SESSION_NOT_FOUND|%', p_session_id;
    END IF;
    IF v_status IN ('closed', 'void') THEN
        RAISE EXCEPTION 'AESTHETIC:SESSION_CLOSED|%', v_status;
    END IF;
END;
$$;

-- Fotos y consentimientos cambian el estado y quedan en el registro de actividad
CREATE OR REPLACE FUNCTION public.aesthetic_photos_after_change()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.aesthetic_session_events (session_id, type, payload, actor)
        VALUES (NEW.session_id, 'photo_added', jsonb_build_object('view', NEW.view, 'source', NEW.source), NEW.created_by);
        PERFORM public.aesthetic_session_recompute(NEW.session_id);
        RETURN NEW;
    END IF;
    -- Borrada en cascada con su sesión: no queda dónde registrarla
    IF NOT EXISTS (SELECT 1 FROM public.aesthetic_sessions s WHERE s.id = OLD.session_id) THEN
        RETURN OLD;
    END IF;
    INSERT INTO public.aesthetic_session_events (session_id, type, payload)
    VALUES (OLD.session_id, 'photo_removed', jsonb_build_object('view', OLD.view));
    PERFORM public.aesthetic_session_recompute(OLD.session_id);
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_aesthetic_photos_after_change ON public.aesthetic_photos;
CREATE TRIGGER trg_aesthetic_photos_after_change
    AFTER INSERT OR DELETE ON public.aesthetic_photos
    FOR EACH ROW EXECUTE FUNCTION public.aesthetic_photos_after_change();

CREATE OR REPLACE FUNCTION public.aesthetic_service_consents_after_change()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO public.aesthetic_session_events (session_id, type, payload, actor)
    SELECT NEW.session_id, 'consent_signed',
           jsonb_build_object('serviceId', NEW.service_id::text, 'serviceName', NEW.service_name, 'source', sig.source, 'sha256', NEW.content_sha256),
           sig.signed_by
    FROM public.aesthetic_consent_signatures sig WHERE sig.id = NEW.signature_id;
    PERFORM public.aesthetic_session_recompute(NEW.session_id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_aesthetic_service_consents_after_change ON public.aesthetic_service_consents;
CREATE TRIGGER trg_aesthetic_service_consents_after_change
    AFTER INSERT OR UPDATE ON public.aesthetic_service_consents
    FOR EACH ROW EXECUTE FUNCTION public.aesthetic_service_consents_after_change();

-- ─── Sesión como jsonb ──────────────────────────────────────────────────────

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
        'status', s.status,
        'completeness', s.completeness,
        'flowVersion', s.flow_version,
        'closedAt', to_char(s.closed_at, 'YYYY-MM-DD"T"HH24:MI:SS'),
        'closedByName', NULLIF(TRIM(COALESCE(cb.name, '')), ''),
        'voidedAt', to_char(s.voided_at, 'YYYY-MM-DD"T"HH24:MI:SS'),
        'voidReason', s.void_reason,
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
                        'notes', m.notes,
                        'createdAt', to_char(m.created_at, 'YYYY-MM-DD"T"HH24:MI:SS'),
                        'createdBy', m.created_by::text
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
                'source', p.source,
                'takenAt', to_char(COALESCE(p.taken_at, p.created_at), 'YYYY-MM-DD"T"HH24:MI:SS'),
                'createdAt', to_char(p.created_at, 'YYYY-MM-DD"T"HH24:MI:SS'),
                'alignment', p.alignment
            )) ORDER BY p.created_at, p.id)
            FROM public.aesthetic_photos p WHERE p.session_id = s.id
        ), '[]'::jsonb),
        'consents', COALESCE((
            SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                'serviceId', c.service_id::text,
                'serviceName', c.service_name,
                'title', c.title,
                'text', c.text,
                'templateUpdatedAt', to_char(c.template_updated_at, 'YYYY-MM-DD"T"HH24:MI:SS'),
                'contentSha256', c.content_sha256,
                'signatureId', sig.id::text,
                'signatureFileId', 'consentsig_' || sig.id::text,
                'signatureSource', sig.source,
                'reusedFromSignatureId', sig.reused_from_id::text,
                'signerName', sig.signer_name,
                'signedAt', to_char(sig.signed_at, 'YYYY-MM-DD"T"HH24:MI:SS'),
                'allowsClinicalPhotos', sig.allows_clinical_photos,
                'allowsMarketingPhotos', sig.allows_marketing_photos
            )) ORDER BY sig.signed_at, c.service_id)
            FROM public.aesthetic_service_consents c
            JOIN public.aesthetic_consent_signatures sig ON sig.id = c.signature_id
            WHERE c.session_id = s.id
              AND EXISTS (SELECT 1 FROM public.aesthetic_layers l WHERE l.session_id = s.id AND l.service_id = c.service_id)
        ), '[]'::jsonb),
        'photoConsent', (
            SELECT jsonb_build_object(
                'allowsClinicalPhotos', sig.allows_clinical_photos,
                'allowsMarketingPhotos', sig.allows_marketing_photos,
                'signerName', sig.signer_name,
                'signedAt', to_char(sig.signed_at, 'YYYY-MM-DD"T"HH24:MI:SS')
            )
            FROM public.aesthetic_consent_signatures sig
            WHERE sig.session_id = s.id
            ORDER BY sig.signed_at DESC, sig.id DESC
            LIMIT 1
        ),
        'sessionNotes', COALESCE((
            SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                'id', n.id::text,
                'body', n.body,
                'kind', n.kind,
                'createdAt', to_char(n.created_at, 'YYYY-MM-DD"T"HH24:MI:SS'),
                'createdByName', NULLIF(TRIM(COALESCE(nu.name, '')), '')
            )) ORDER BY n.created_at, n.id)
            FROM public.aesthetic_session_notes n
            LEFT JOIN public.users nu ON nu.id = n.created_by
            WHERE n.session_id = s.id
        ), '[]'::jsonb),
        'events', COALESCE((
            SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                'id', e.id::text,
                'type', e.type,
                'payload', e.payload,
                'at', to_char(e.at, 'YYYY-MM-DD"T"HH24:MI:SS'),
                'actorName', NULLIF(TRIM(COALESCE(eu.name, '')), '')
            )) ORDER BY e.at, e.id)
            FROM public.aesthetic_session_events e
            LEFT JOIN public.users eu ON eu.id = e.actor
            WHERE e.session_id = s.id
        ), '[]'::jsonb)
    )
    FROM public.aesthetic_sessions s
    LEFT JOIN public.users d ON d.id = s.doctor_id
    LEFT JOIN public.users cb ON cb.id = s.closed_by
    WHERE s.id = p_session_id AND s.deleted_at IS NULL;
$$;

-- ─── Guardado (autoguardado) ─────────────────────────────────────────────────

-- payload: { id?, patientId, date, title, doctorId?, appointmentId?, notes, bodyFigure?,
--   layers: [{ serviceId, serviceName, productName, unitId, markingTool, lot, lotExpiry, depth, technique, notes,
--              marks: [{ kind, view, x, y, polygon?, zone, quantity, lot?, lotExpiry?, depth?, technique?, notes?,
--                        createdAt?, createdBy? }] }] }
-- Una sesión cerrada o anulada no se guarda. En flow_version 2 una marca exige
-- el consentimiento firmado de su servicio.
CREATE OR REPLACE FUNCTION public.aesthetic_session_save(p_payload jsonb, p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
    v_id       bigint := NULLIF(p_payload->>'id', '')::bigint;
    v_patient  uuid := NULLIF(p_payload->>'patientId', '')::uuid;
    v_date     date := NULLIF(p_payload->>'date', '')::date;
    v_flow     smallint;
    v_layer    jsonb;
    v_mark     jsonb;
    v_layer_id bigint;
    v_service  integer;
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
            (patient_id, doctor_id, appointment_id, session_date, title, notes, body_figure, flow_version, status, created_by, updated_by)
        VALUES (v_patient,
                NULLIF(p_payload->>'doctorId', '')::uuid,
                NULLIF(p_payload->>'appointmentId', '')::integer,
                v_date,
                COALESCE(p_payload->>'title', ''),
                COALESCE(p_payload->>'notes', ''),
                NULLIF(p_payload->>'bodyFigure', ''),
                2, 'draft',
                p_user, p_user)
        RETURNING id INTO v_id;
        INSERT INTO public.aesthetic_session_events (session_id, type, actor) VALUES (v_id, 'created', p_user);
    ELSE
        PERFORM public.aesthetic_session_guard_open(v_id);
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

    SELECT s.flow_version INTO v_flow FROM public.aesthetic_sessions s WHERE s.id = v_id;

    FOR v_layer IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'layers', '[]'::jsonb)) LOOP
        v_li := v_li + 1;
        v_service := NULLIF(v_layer->>'serviceId', '')::integer;

        -- Consentimiento primero: sin firma del servicio no se marca
        IF v_flow >= 2 AND jsonb_array_length(COALESCE(v_layer->'marks', '[]'::jsonb)) > 0 AND (
            v_service IS NULL OR NOT EXISTS (
                SELECT 1 FROM public.aesthetic_service_consents c WHERE c.session_id = v_id AND c.service_id = v_service)
        ) THEN
            RAISE EXCEPTION 'AESTHETIC:CONSENT_REQUIRED|%', COALESCE(v_layer->>'serviceName', v_layer->>'serviceId', '');
        END IF;

        BEGIN
            INSERT INTO public.aesthetic_layers
                (session_id, service_id, service_name, product_name, unit_id, marking_tool,
                 lot, lot_expiry, depth, technique, notes, sort_order)
            VALUES (v_id,
                    v_service,
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
                 lot, lot_expiry, depth, technique, notes, sort_order, created_at, created_by)
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
                    v_mi,
                    COALESCE(NULLIF(v_mark->>'createdAt', '')::timestamp, NOW()::timestamp),
                    COALESCE(NULLIF(v_mark->>'createdBy', '')::uuid, p_user));
        END LOOP;
    END LOOP;

    PERFORM public.aesthetic_session_recompute(v_id);
    RETURN public.aesthetic_session_json(v_id);
END;
$$;

-- ─── Cierre y anulación ──────────────────────────────────────────────────────

-- payload: { notes? } (resumen editado antes de cerrar). Sólo desde "Por cerrar".
CREATE OR REPLACE FUNCTION public.aesthetic_session_close(p_id bigint, p_payload jsonb, p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
    v_status varchar;
BEGIN
    PERFORM public.aesthetic_session_guard_open(p_id);
    PERFORM public.aesthetic_session_recompute(p_id);
    SELECT s.status INTO v_status FROM public.aesthetic_sessions s WHERE s.id = p_id;
    IF v_status <> 'ready_to_close' THEN
        RAISE EXCEPTION 'AESTHETIC:NOT_READY_TO_CLOSE|%', v_status;
    END IF;

    UPDATE public.aesthetic_sessions s
    SET notes = CASE WHEN p_payload ? 'notes' THEN COALESCE(p_payload->>'notes', '') ELSE s.notes END,
        closed_at = NOW(),
        closed_by = p_user,
        updated_at = NOW(),
        updated_by = p_user
    WHERE s.id = p_id;

    INSERT INTO public.aesthetic_session_events (session_id, type, actor) VALUES (p_id, 'closed', p_user);
    PERFORM public.aesthetic_session_recompute(p_id);
    RETURN public.aesthetic_session_json(p_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.aesthetic_session_void(p_id bigint, p_reason text, p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql AS $$
BEGIN
    PERFORM public.aesthetic_session_guard_open(p_id);
    IF TRIM(COALESCE(p_reason, '')) = '' THEN
        RAISE EXCEPTION 'AESTHETIC:VOID_REASON_REQUIRED|';
    END IF;
    UPDATE public.aesthetic_sessions s
    SET voided_at = NOW(), voided_by = p_user, void_reason = TRIM(p_reason), updated_at = NOW(), updated_by = p_user
    WHERE s.id = p_id;
    INSERT INTO public.aesthetic_session_events (session_id, type, payload, actor)
    VALUES (p_id, 'voided', jsonb_build_object('reason', TRIM(p_reason)), p_user);
    PERFORM public.aesthetic_session_recompute(p_id);
    RETURN public.aesthetic_session_json(p_id);
END;
$$;

-- ─── Notas y enmiendas ───────────────────────────────────────────────────────

-- payload: { body, kind: note|amendment }. Abierta: notas; cerrada: sólo enmiendas.
CREATE OR REPLACE FUNCTION public.aesthetic_note_add(p_session_id bigint, p_payload jsonb, p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
    v_status varchar;
    v_kind   varchar := COALESCE(NULLIF(p_payload->>'kind', ''), 'note');
    v_body   text := TRIM(COALESCE(p_payload->>'body', ''));
BEGIN
    SELECT s.status INTO v_status FROM public.aesthetic_sessions s WHERE s.id = p_session_id AND s.deleted_at IS NULL;
    IF v_status IS NULL THEN
        RAISE EXCEPTION 'AESTHETIC:SESSION_NOT_FOUND|%', p_session_id;
    END IF;
    IF v_body = '' THEN
        RAISE EXCEPTION 'AESTHETIC:NOTE_REQUIRED|';
    END IF;
    IF v_kind NOT IN ('note', 'amendment') THEN
        RAISE EXCEPTION 'AESTHETIC:INVALID_NOTE_KIND|%', v_kind;
    END IF;
    IF v_status = 'void' OR (v_status = 'closed' AND v_kind <> 'amendment') OR (v_status <> 'closed' AND v_kind = 'amendment') THEN
        RAISE EXCEPTION 'AESTHETIC:SESSION_CLOSED|%', v_status;
    END IF;

    INSERT INTO public.aesthetic_session_notes (session_id, body, kind, created_by)
    VALUES (p_session_id, v_body, v_kind, p_user);
    INSERT INTO public.aesthetic_session_events (session_id, type, payload, actor)
    VALUES (p_session_id, CASE WHEN v_kind = 'amendment' THEN 'amendment_added' ELSE 'note_added' END, '{}'::jsonb, p_user);
    RETURN public.aesthetic_session_json(p_session_id);
END;
$$;

-- ─── Fotos: origen y bloqueo en sesiones cerradas ───────────────────────────

CREATE OR REPLACE FUNCTION public.aesthetic_photo_add(
    p_session_id bigint, p_kind text, p_view text, p_file_name text, p_mime_type text,
    p_drive_file_id text, p_web_view_link text, p_alignment jsonb, p_user uuid, p_source text)
RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
    v_id bigint;
    v_source varchar := NULLIF(p_source, '');
BEGIN
    PERFORM public.aesthetic_session_guard_open(p_session_id);
    IF v_source IS NOT NULL AND v_source NOT IN ('camera', 'upload', 'qr') THEN
        v_source := 'upload';
    END IF;
    INSERT INTO public.aesthetic_photos
        (session_id, kind, view, file_name, mime_type, drive_file_id, web_view_link, alignment, source, taken_at, created_by)
    VALUES (p_session_id, p_kind, p_view, COALESCE(p_file_name, ''), COALESCE(p_mime_type, ''),
            p_drive_file_id, p_web_view_link, NULLIF(p_alignment, 'null'::jsonb), v_source, NOW(), p_user)
    RETURNING id INTO v_id;

    RETURN (SELECT jsonb_strip_nulls(jsonb_build_object(
        'id', 'photo_' || p.id::text, 'kind', p.kind, 'view', p.view, 'fileName', p.file_name, 'mimeType', p.mime_type,
        'source', p.source, 'takenAt', to_char(p.taken_at, 'YYYY-MM-DD"T"HH24:MI:SS'),
        'createdAt', to_char(p.created_at, 'YYYY-MM-DD"T"HH24:MI:SS'), 'alignment', p.alignment))
        FROM public.aesthetic_photos p WHERE p.id = v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.aesthetic_photo_delete(p_id text)
RETURNS TABLE (id text, previous_drive_file_id varchar)
LANGUAGE plpgsql AS $$
DECLARE
    v_session bigint;
BEGIN
    SELECT p.session_id INTO v_session FROM public.aesthetic_photos p WHERE p.id = public.aesthetic_photo_id(p_id);
    IF v_session IS NULL THEN
        RAISE EXCEPTION 'AESTHETIC:PHOTO_NOT_FOUND|%', p_id;
    END IF;
    PERFORM public.aesthetic_session_guard_open(v_session);
    RETURN QUERY DELETE FROM public.aesthetic_photos p WHERE p.id = public.aesthetic_photo_id(p_id)
        RETURNING 'photo_' || p.id::text, p.drive_file_id;
END;
$$;

-- Estado de las sesiones abiertas que ya existían con flow_version 2 (ninguna antes de este script)
SELECT public.aesthetic_session_recompute(s.id)
FROM public.aesthetic_sessions s
WHERE s.flow_version >= 2 AND s.closed_at IS NULL AND s.voided_at IS NULL;

-- ─── Registro de migración ────────────────────────────────────────────────────

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '155_20261104_aesthetic-guided-session.sql',
    'v1',
    'Sesión estética guiada: estado calculado y completitud, cierre/anulación, notas con hora, registro de actividad, consentimiento primero validado en el servidor, origen de fotos, hash del consentimiento y dosis/intervalo/próxima cita por servicio'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;
