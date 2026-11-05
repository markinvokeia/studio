-- 160_20261104_aesthetic-mark-product.sql
-- Producto por marca en la ficha estética.
--
-- Lote, vencimiento, profundidad, técnica y notas ya se podían fijar por marca
-- (NULL hereda del servicio, un valor lo reemplaza). El producto vivía sólo en
-- aesthetic_layers: si en un punto se usa otra marca comercial no había dónde
-- registrarla. Se agrega con la misma regla: NULL hereda.
--
-- Cambia sólo aesthetic_session_json y aesthetic_session_save (definiciones de
-- la 155 + el campo nuevo). El flujo "Aesthetic Record" pasa el JSON tal cual,
-- así que no hay que reimportarlo. Se puede aplicar antes o después del
-- frontend: sin este script el producto de una marca no se guarda.

BEGIN;

ALTER TABLE public.aesthetic_marks ADD COLUMN IF NOT EXISTS product_name varchar(255);

COMMENT ON COLUMN public.aesthetic_marks.product_name IS 'Producto usado en esta marca. NULL: el de la capa (servicio).';

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
                        'productName', m.product_name,
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

-- payload: como en la 155, y cada marca admite además productName?
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
                 product_name, lot, lot_expiry, depth, technique, notes, sort_order, created_at, created_by)
            VALUES (v_layer_id,
                    COALESCE(NULLIF(v_mark->>'kind', ''), 'point'),
                    v_mark->>'view',
                    (v_mark->>'x')::numeric,
                    (v_mark->>'y')::numeric,
                    CASE WHEN v_mark->>'kind' IN ('area', 'line') THEN v_mark->'polygon' END,
                    NULLIF(v_mark->>'zone', ''),
                    NULLIF(v_mark->>'quantity', '')::numeric,
                    NULLIF(TRIM(v_mark->>'productName'), ''),
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

-- ─── Registro de migración ────────────────────────────────────────────────────

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '160_20261104_aesthetic-mark-product.sql',
    'v1',
    'Ficha estética: producto por marca (NULL hereda del servicio), igual que lote y vencimiento'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;
