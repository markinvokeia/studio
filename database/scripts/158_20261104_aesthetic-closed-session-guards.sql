-- =====================================================================
-- Ficha estética — sesiones cerradas o anuladas de verdad inmutables, y reutilizar
-- una firma sin cambiar el permiso de fotos
--
--   1. aesthetic_consents_sign (154), aesthetic_photo_set_alignment (151) y
--      aesthetic_session_delete (151) seguían funcionando en una sesión cerrada o
--      anulada. Ahora rechazan con AESTHETIC:SESSION_CLOSED|<status>, usando
--      aesthetic_session_guard_open (155). Las sesiones anteriores al flujo guiado
--      quedaron cerradas con 155, así que tampoco se pueden alinear sus fotos.
--
--   2. Reutilizar una firma nunca cambia el permiso de fotos ya dado en la sesión.
--      Los permisos de la firma reutilizada los decide el servidor (lo que envíe el
--      cliente se ignora):
--        - la sesión ya tiene una firma: copia los de la última firma de la sesión;
--        - todavía no tiene ninguna: hereda los de la firma elegida.
--      Una firma dibujada sigue fijando el permiso con lo que indicó el paciente.
--      "Última firma" es el mismo orden que usan aesthetic_session_json() (photoConsent)
--      y aesthetic_session_recompute() (157), que decide si la foto es obligatoria.
--
-- Sólo se reemplazan estas tres funciones; no hay cambios en el flujo n8n. El frontend
-- ya no ofrece alinear fotos de sesiones cerradas: hay que desplegarlos juntos.
--
-- Idempotente. Depende de: 154 y 155.
-- =====================================================================

BEGIN;

-- ─── Firmar ─────────────────────────────────────────────────────────────────

-- Firma uno o más servicios de la sesión con una misma firma.
-- p_drive_file_id NULL ⇒ se reutiliza la firma payload.reuseSignatureId (del mismo paciente).
-- payload: { signerName, signedAt?, allowsClinicalPhotos, allowsMarketingPhotos, reuseSignatureId?,
--            consents: [{ serviceId, serviceName, title, text, templateUpdatedAt? }] }
-- allowsClinicalPhotos y allowsMarketingPhotos sólo cuentan en una firma dibujada.
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
    v_clinical  boolean := COALESCE((p_payload->>'allowsClinicalPhotos')::boolean, true);
    v_marketing boolean := COALESCE((p_payload->>'allowsMarketingPhotos')::boolean, false);
    v_last_clinical  boolean;
    v_last_marketing boolean;
BEGIN
    SELECT s.patient_id INTO v_patient
    FROM public.aesthetic_sessions s WHERE s.id = p_session_id AND s.deleted_at IS NULL;
    IF v_patient IS NULL THEN
        RAISE EXCEPTION 'AESTHETIC:SESSION_NOT_FOUND|%', p_session_id;
    END IF;
    PERFORM public.aesthetic_session_guard_open(p_session_id);
    IF TRIM(COALESCE(p_payload->>'signerName', '')) = '' THEN
        RAISE EXCEPTION 'AESTHETIC:SIGNER_REQUIRED|';
    END IF;
    IF jsonb_typeof(p_payload->'consents') IS DISTINCT FROM 'array' OR jsonb_array_length(p_payload->'consents') = 0 THEN
        RAISE EXCEPTION 'AESTHETIC:CONSENT_SERVICES_REQUIRED|';
    END IF;

    IF v_file IS NULL THEN
        -- La firma original de la que se reutiliza (si ya era reutilizada, la que ella reutilizaba).
        -- Los permisos, en cambio, son los de la firma elegida: una reutilizada puede tener otros.
        SELECT COALESCE(sig.reused_from_id, sig.id), sig.signature_drive_file_id, sig.signature_mime_type,
               sig.allows_clinical_photos, sig.allows_marketing_photos
        INTO v_reused, v_file, v_mime, v_clinical, v_marketing
        FROM public.aesthetic_consent_signatures sig
        WHERE sig.id = NULLIF(p_payload->>'reuseSignatureId', '')::bigint AND sig.patient_id = v_patient;
        IF v_reused IS NULL THEN
            RAISE EXCEPTION 'AESTHETIC:SIGNATURE_NOT_FOUND|%', p_payload->>'reuseSignatureId';
        END IF;
        v_source := 'reused';

        -- Reutilizar no cambia lo que el paciente ya decidió en esta sesión
        SELECT sig.allows_clinical_photos, sig.allows_marketing_photos
        INTO v_last_clinical, v_last_marketing
        FROM public.aesthetic_consent_signatures sig
        WHERE sig.session_id = p_session_id
        ORDER BY sig.signed_at DESC, sig.id DESC
        LIMIT 1;
        IF FOUND THEN
            v_clinical := v_last_clinical;
            v_marketing := v_last_marketing;
        END IF;
    END IF;

    INSERT INTO public.aesthetic_consent_signatures
        (session_id, patient_id, signer_name, signature_drive_file_id, signature_mime_type, source, reused_from_id,
         allows_clinical_photos, allows_marketing_photos, signed_at, signed_by)
    VALUES (p_session_id, v_patient, TRIM(p_payload->>'signerName'), v_file, v_mime, v_source, v_reused,
            v_clinical,
            v_marketing,
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

-- ─── Alinear una foto ───────────────────────────────────────────────────────

-- p_alignment NULL ⇒ se borra el ajuste
CREATE OR REPLACE FUNCTION public.aesthetic_photo_set_alignment(p_id text, p_alignment jsonb)
RETURNS TABLE (id text, alignment jsonb)
LANGUAGE plpgsql AS $$
DECLARE
    v_session bigint;
BEGIN
    SELECT p.session_id INTO v_session FROM public.aesthetic_photos p WHERE p.id = public.aesthetic_photo_id(p_id);
    IF v_session IS NULL THEN
        RAISE EXCEPTION 'AESTHETIC:PHOTO_NOT_FOUND|%', p_id;
    END IF;
    PERFORM public.aesthetic_session_guard_open(v_session);
    RETURN QUERY UPDATE public.aesthetic_photos p
        SET alignment = NULLIF(p_alignment, 'null'::jsonb)
        WHERE p.id = public.aesthetic_photo_id(p_id)
        RETURNING 'photo_' || p.id::text, p.alignment;
END;
$$;

-- ─── Borrar una sesión ──────────────────────────────────────────────────────

-- Borrado lógico: fotos y firma quedan en Drive (historia clínica).
-- Una sesión cerrada o anulada es parte de la historia clínica: no se borra.
CREATE OR REPLACE FUNCTION public.aesthetic_session_delete(p_id bigint, p_user uuid)
RETURNS TABLE (id bigint, deleted boolean)
LANGUAGE plpgsql AS $$
BEGIN
    PERFORM public.aesthetic_session_guard_open(p_id);
    UPDATE public.aesthetic_sessions s
    SET deleted_at = NOW(), updated_at = NOW(), updated_by = p_user
    WHERE s.id = p_id AND s.deleted_at IS NULL;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'AESTHETIC:SESSION_NOT_FOUND|%', p_id;
    END IF;
    RETURN QUERY SELECT p_id, true;
END;
$$;

-- ─── Registro de migración ────────────────────────────────────────────────────

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '158_20261104_aesthetic-closed-session-guards.sql',
    'v1',
    'Sesión estética: firmar, alinear fotos y borrar se rechazan en sesiones cerradas o anuladas; reutilizar una firma no cambia el permiso de fotos ya dado en la sesión'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;
