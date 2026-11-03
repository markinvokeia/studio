-- =====================================================================
-- Ficha estética — consentimiento por servicio, con plantilla y firma reutilizable
--
-- Las clínicas tienen un consentimiento distinto para cada tratamiento, y cada
-- tratamiento aplicado tiene que quedar firmado. Hasta ahora había un único
-- consentimiento por sesión con un texto genérico (aesthetic_consents).
--
--   1. service_consent_templates → la plantilla de texto de cada servicio, con
--      variables {{patient_name}}, {{doctor_name}}, {{service_name}},
--      {{product_name}} y {{session_date}} que el frontend reemplaza al firmar.
--      Sin plantilla se usa el texto genérico de siempre.
--   2. aesthetic_consent_signatures → cada vez que el paciente firma. Una firma
--      puede cubrir varios servicios de la sesión a la vez. Guarda también los
--      permisos de fotos (clínicas / difusión), que son de la sesión.
--      source = 'reused' ⇒ no se dibujó: se usó una firma anterior del mismo
--      paciente. Apunta al MISMO archivo de Drive (no se sube otra vez) y
--      reused_from_id queda apuntando a la firma original, para auditoría.
--   3. aesthetic_service_consents → el consentimiento de cada servicio de la
--      sesión, con el texto y el título tal como se firmaron. La clave es
--      (session_id, service_id) y no la capa: las capas se recrean en cada
--      guardado de la sesión, el servicio no (es único por sesión).
--
-- Los archivos de firma ya no se borran de Drive: una firma puede estar
-- reutilizada en otros consentimientos.
--
-- aesthetic_consents (151) y aesthetic_consent_save() quedan sin uso: sus filas
-- se copian acá (una firma por sesión y un consentimiento por cada servicio de
-- la sesión, con el texto viejo). No se borran.
--
-- aesthetic_session_json() ahora devuelve 'consents' (uno por servicio con capa
-- en la sesión) y 'photoConsent' (permisos de la última firma) en lugar de
-- 'consent'. Los ids de archivo de firma pasan a ser 'consentsig_<id>'.
--
-- Endpoints nuevos en el flujo "Aesthetic Record" (hay que reimportarlo):
--   GET  services/consent-templates
--   POST services/consent-templates/save
--   POST aesthetic/consents/sign      (multipart, firma dibujada)
--   POST aesthetic/consents/reuse     (JSON, firma anterior)
--
-- Idempotente. Depende de: 151_20261030_aesthetic-record.sql, 152_20261030_aesthetic-line-marks.sql
-- =====================================================================

BEGIN;

-- ─── 1. Plantilla por servicio ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.service_consent_templates (
    service_id  integer PRIMARY KEY REFERENCES public.service_catalog(id) ON DELETE CASCADE,
    title       varchar(255) NOT NULL DEFAULT '',
    body        text NOT NULL,
    updated_at  timestamp without time zone NOT NULL DEFAULT NOW(),
    updated_by  uuid
);

COMMENT ON TABLE public.service_consent_templates IS 'Texto del consentimiento informado de cada servicio. Variables {{patient_name}}, {{doctor_name}}, {{service_name}}, {{product_name}}, {{session_date}}: las reemplaza el frontend al firmar.';

-- ─── 2. Firmas ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.aesthetic_consent_signatures (
    id                       bigserial PRIMARY KEY,
    session_id               bigint NOT NULL REFERENCES public.aesthetic_sessions(id) ON DELETE CASCADE,
    patient_id               uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    signer_name              varchar(255) NOT NULL,
    signature_drive_file_id  varchar(255) NOT NULL,
    signature_mime_type      varchar(100) NOT NULL DEFAULT 'image/png',
    source                   varchar(10) NOT NULL DEFAULT 'drawn' CHECK (source IN ('drawn', 'reused')),
    -- Firma dibujada de la que sale la imagen (siempre la original, nunca otra reutilizada)
    reused_from_id           bigint REFERENCES public.aesthetic_consent_signatures(id),
    allows_clinical_photos   boolean NOT NULL DEFAULT true,
    allows_marketing_photos  boolean NOT NULL DEFAULT false,
    signed_at                timestamp without time zone NOT NULL,
    signed_by                uuid,
    CONSTRAINT ck_aesthetic_consent_signatures_reuse CHECK ((source = 'reused') = (reused_from_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_aesthetic_consent_signatures_session
    ON public.aesthetic_consent_signatures (session_id, signed_at);
CREATE INDEX IF NOT EXISTS idx_aesthetic_consent_signatures_patient
    ON public.aesthetic_consent_signatures (patient_id, signed_at);

COMMENT ON TABLE public.aesthetic_consent_signatures IS 'Cada firma del paciente en la ficha estética. Puede cubrir varios servicios de la sesión. source=reused: misma imagen que reused_from_id (no se dibujó de nuevo).';

-- ─── 3. Consentimiento de cada servicio de la sesión ────────────────────────

CREATE TABLE IF NOT EXISTS public.aesthetic_service_consents (
    session_id           bigint NOT NULL REFERENCES public.aesthetic_sessions(id) ON DELETE CASCADE,
    service_id           integer NOT NULL,
    signature_id         bigint NOT NULL REFERENCES public.aesthetic_consent_signatures(id),
    service_name         varchar(255) NOT NULL DEFAULT '',
    -- Título y texto tal como se firmaron
    title                varchar(255) NOT NULL DEFAULT '',
    text                 text NOT NULL,
    -- Versión de la plantilla usada (su updated_at); NULL = texto genérico
    template_updated_at  timestamp without time zone,
    CONSTRAINT aesthetic_service_consents_pkey PRIMARY KEY (session_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_aesthetic_service_consents_signature
    ON public.aesthetic_service_consents (signature_id);

-- ─── Copia de los consentimientos de sesión existentes ──────────────────────

INSERT INTO public.aesthetic_consent_signatures
    (session_id, patient_id, signer_name, signature_drive_file_id, signature_mime_type, source,
     allows_clinical_photos, allows_marketing_photos, signed_at, signed_by)
SELECT c.session_id, s.patient_id, c.signer_name, c.signature_drive_file_id, c.signature_mime_type, 'drawn',
       c.allows_clinical_photos, c.allows_marketing_photos, c.signed_at, c.signed_by
FROM public.aesthetic_consents c
JOIN public.aesthetic_sessions s ON s.id = c.session_id
WHERE NOT EXISTS (SELECT 1 FROM public.aesthetic_consent_signatures x WHERE x.session_id = c.session_id);

INSERT INTO public.aesthetic_service_consents (session_id, service_id, signature_id, service_name, title, text)
SELECT l.session_id, l.service_id, sig.id, l.service_name, '', c.text
FROM public.aesthetic_consents c
JOIN public.aesthetic_layers l ON l.session_id = c.session_id AND l.service_id IS NOT NULL
JOIN LATERAL (
    SELECT x.id FROM public.aesthetic_consent_signatures x
    WHERE x.session_id = c.session_id ORDER BY x.signed_at DESC, x.id DESC LIMIT 1
) sig ON true
ON CONFLICT ON CONSTRAINT aesthetic_service_consents_pkey DO NOTHING;

-- ─── Funciones: plantillas ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.service_consent_templates_list()
RETURNS TABLE (service_id integer, title varchar, body text, updated_at text)
LANGUAGE sql STABLE AS $$
    SELECT t.service_id, t.title, t.body, to_char(t.updated_at, 'YYYY-MM-DD"T"HH24:MI:SS')
    FROM public.service_consent_templates t
    ORDER BY t.service_id;
$$;

-- payload: { service_id, title, body } — body vacío ⇒ se borra la plantilla (vuelve al texto genérico)
CREATE OR REPLACE FUNCTION public.service_consent_template_save(p_payload jsonb, p_user uuid)
RETURNS TABLE (service_id integer, title varchar, body text, updated_at text, deleted boolean)
LANGUAGE plpgsql AS $$
DECLARE
    v_service integer := NULLIF(p_payload->>'service_id', '')::integer;
    v_body    text := TRIM(COALESCE(p_payload->>'body', ''));
BEGIN
    IF v_service IS NULL OR NOT EXISTS (SELECT 1 FROM public.service_catalog sc WHERE sc.id = v_service) THEN
        RAISE EXCEPTION 'AESTHETIC:SERVICE_NOT_FOUND|%', p_payload->>'service_id';
    END IF;

    IF v_body = '' THEN
        DELETE FROM public.service_consent_templates t WHERE t.service_id = v_service;
        RETURN QUERY SELECT v_service, ''::varchar, ''::text, NULL::text, true;
        RETURN;
    END IF;

    INSERT INTO public.service_consent_templates AS t (service_id, title, body, updated_at, updated_by)
    VALUES (v_service, TRIM(COALESCE(p_payload->>'title', '')), v_body, NOW(), p_user)
    ON CONFLICT ON CONSTRAINT service_consent_templates_pkey DO UPDATE
        SET title = EXCLUDED.title, body = EXCLUDED.body, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by;

    RETURN QUERY
        SELECT t.service_id, t.title, t.body, to_char(t.updated_at, 'YYYY-MM-DD"T"HH24:MI:SS'), false
        FROM public.service_consent_templates t WHERE t.service_id = v_service;
END;
$$;

-- ─── Sesión como jsonb: 'consents' + 'photoConsent' en lugar de 'consent' ───

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
        -- Sólo los de servicios que siguen en la sesión (los de una capa quitada quedan guardados)
        'consents', COALESCE((
            SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                'serviceId', c.service_id::text,
                'serviceName', c.service_name,
                'title', c.title,
                'text', c.text,
                'templateUpdatedAt', to_char(c.template_updated_at, 'YYYY-MM-DD"T"HH24:MI:SS'),
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
        -- Los permisos de fotos son de la sesión: los de su última firma
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
        )
    )
    FROM public.aesthetic_sessions s
    LEFT JOIN public.users d ON d.id = s.doctor_id
    WHERE s.id = p_session_id AND s.deleted_at IS NULL;
$$;

-- ─── Funciones: firmar ──────────────────────────────────────────────────────

-- Firma uno o más servicios de la sesión con una misma firma.
-- p_drive_file_id NULL ⇒ se reutiliza la firma payload.reuseSignatureId (del mismo paciente).
-- payload: { signerName, signedAt?, allowsClinicalPhotos, allowsMarketingPhotos, reuseSignatureId?,
--            consents: [{ serviceId, serviceName, title, text, templateUpdatedAt? }] }
-- Volver a firmar un servicio reemplaza su consentimiento; la firma anterior queda guardada.
-- Devuelve la sesión completa.
CREATE OR REPLACE FUNCTION public.aesthetic_consents_sign(
    p_session_id bigint, p_payload jsonb, p_drive_file_id text, p_mime_type text, p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
    v_patient   uuid;
    v_file      varchar := NULLIF(p_drive_file_id, '');
    v_mime      varchar := COALESCE(NULLIF(p_mime_type, ''), 'image/png');
    v_source    varchar := 'drawn';
    v_reused    bigint;
    v_signature bigint;
    v_consent   jsonb;
    v_service   integer;
BEGIN
    SELECT s.patient_id INTO v_patient
    FROM public.aesthetic_sessions s WHERE s.id = p_session_id AND s.deleted_at IS NULL;
    IF v_patient IS NULL THEN
        RAISE EXCEPTION 'AESTHETIC:SESSION_NOT_FOUND|%', p_session_id;
    END IF;
    IF TRIM(COALESCE(p_payload->>'signerName', '')) = '' THEN
        RAISE EXCEPTION 'AESTHETIC:SIGNER_REQUIRED|';
    END IF;
    IF jsonb_typeof(p_payload->'consents') IS DISTINCT FROM 'array' OR jsonb_array_length(p_payload->'consents') = 0 THEN
        RAISE EXCEPTION 'AESTHETIC:CONSENT_SERVICES_REQUIRED|';
    END IF;

    IF v_file IS NULL THEN
        -- La firma original de la que se reutiliza (si ya era reutilizada, la que ella reutilizaba)
        SELECT COALESCE(sig.reused_from_id, sig.id), sig.signature_drive_file_id, sig.signature_mime_type
        INTO v_reused, v_file, v_mime
        FROM public.aesthetic_consent_signatures sig
        WHERE sig.id = NULLIF(p_payload->>'reuseSignatureId', '')::bigint AND sig.patient_id = v_patient;
        IF v_reused IS NULL THEN
            RAISE EXCEPTION 'AESTHETIC:SIGNATURE_NOT_FOUND|%', p_payload->>'reuseSignatureId';
        END IF;
        v_source := 'reused';
    END IF;

    INSERT INTO public.aesthetic_consent_signatures
        (session_id, patient_id, signer_name, signature_drive_file_id, signature_mime_type, source, reused_from_id,
         allows_clinical_photos, allows_marketing_photos, signed_at, signed_by)
    VALUES (p_session_id, v_patient, TRIM(p_payload->>'signerName'), v_file, v_mime, v_source, v_reused,
            COALESCE((p_payload->>'allowsClinicalPhotos')::boolean, true),
            COALESCE((p_payload->>'allowsMarketingPhotos')::boolean, false),
            COALESCE(NULLIF(p_payload->>'signedAt', '')::timestamp, NOW()::timestamp),
            p_user)
    RETURNING id INTO v_signature;

    FOR v_consent IN SELECT * FROM jsonb_array_elements(p_payload->'consents') LOOP
        v_service := NULLIF(v_consent->>'serviceId', '')::integer;
        IF v_service IS NULL OR NOT EXISTS (
            SELECT 1 FROM public.aesthetic_layers l WHERE l.session_id = p_session_id AND l.service_id = v_service
        ) THEN
            RAISE EXCEPTION 'AESTHETIC:CONSENT_SERVICE_NOT_IN_SESSION|%', v_consent->>'serviceId';
        END IF;
        IF TRIM(COALESCE(v_consent->>'text', '')) = '' THEN
            RAISE EXCEPTION 'AESTHETIC:CONSENT_TEXT_REQUIRED|%', v_service;
        END IF;

        INSERT INTO public.aesthetic_service_consents AS c
            (session_id, service_id, signature_id, service_name, title, text, template_updated_at)
        VALUES (p_session_id, v_service, v_signature,
                COALESCE(v_consent->>'serviceName', ''),
                COALESCE(v_consent->>'title', ''),
                v_consent->>'text',
                NULLIF(v_consent->>'templateUpdatedAt', '')::timestamp)
        ON CONFLICT ON CONSTRAINT aesthetic_service_consents_pkey DO UPDATE
            SET signature_id = EXCLUDED.signature_id,
                service_name = EXCLUDED.service_name,
                title = EXCLUDED.title,
                text = EXCLUDED.text,
                template_updated_at = EXCLUDED.template_updated_at;
    END LOOP;

    RETURN public.aesthetic_session_json(p_session_id);
END;
$$;

-- ─── Archivos: 'consentsig_<id>' además de los de 151 ───────────────────────

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
    WHERE p_file_id ~ '^signature_[0-9]+$' AND c.session_id = substring(p_file_id FROM 11)::bigint
    UNION ALL
    -- Una firma reutilizada se puede ver aunque la sesión donde se dibujó se haya borrado
    SELECT sig.signature_drive_file_id, sig.signature_mime_type
    FROM public.aesthetic_consent_signatures sig
    WHERE p_file_id ~ '^consentsig_[0-9]+$' AND sig.id = substring(p_file_id FROM 12)::bigint;
$$;

-- ─── Registro de migración ────────────────────────────────────────────────────

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '154_20261103_aesthetic-service-consents.sql',
    'v1',
    'service_consent_templates + aesthetic_consent_signatures + aesthetic_service_consents (consentimiento por servicio, firma reutilizable); session_json con consents/photoConsent'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;
