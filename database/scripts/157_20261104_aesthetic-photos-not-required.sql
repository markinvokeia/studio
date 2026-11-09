-- =====================================================================
-- Ficha estética — una sesión se puede cerrar sin fotos cuando no corresponden
--
-- Con 155, "Por cerrar" exigía siempre al menos una foto. Eso dejaba sin cierre
-- posible (sólo anulación) a dos casos:
--   - el paciente no autorizó fotos clínicas: la cámara queda bloqueada;
--   - tratamiento sólo corporal: las fotos de la sesión son únicamente de la cara.
--
-- Ahora el paso de fotos cuenta como cumplido si hay alguna foto, si la última
-- firma de la sesión no autoriza fotos clínicas, o si hay marcas y todas son
-- corporales. Misma regla que photoExemption() en
-- src/components/users/aesthetic-record/session-status.ts: hay que desplegarlos juntos.
--
-- Sólo se reemplaza aesthetic_session_recompute(); no hay cambios en el flujo n8n.
-- Las sesiones cerradas o anuladas conservan su estado y su completitud.
--
-- Idempotente. Depende de: 154 y 155.
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.aesthetic_session_recompute(p_session_id bigint)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
    v_closed          boolean;
    v_voided          boolean;
    v_layers          integer;
    v_consent_ok      boolean;
    v_any_mark        boolean;
    v_all_marked      boolean;
    v_any_photo       boolean;
    v_photos_declined boolean;
    v_body_only       boolean;
    v_photos_ok       boolean;
    v_status          varchar;
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

    -- La misma firma que aesthetic_session_json() devuelve como photoConsent: la última
    v_photos_declined := COALESCE((
        SELECT sig.allows_clinical_photos = false
        FROM public.aesthetic_consent_signatures sig
        WHERE sig.session_id = p_session_id
        ORDER BY sig.signed_at DESC, sig.id DESC
        LIMIT 1
    ), false);

    v_body_only := v_any_mark AND NOT EXISTS (
        SELECT 1 FROM public.aesthetic_marks m JOIN public.aesthetic_layers l ON l.id = m.layer_id
        WHERE l.session_id = p_session_id AND m.view NOT IN ('bodyFront', 'bodyBack'));

    v_photos_ok := v_any_photo OR v_photos_declined OR v_body_only;

    v_status := CASE
        WHEN v_voided THEN 'void'
        WHEN v_closed THEN 'closed'
        WHEN v_any_mark AND v_consent_ok AND v_all_marked AND v_photos_ok THEN 'ready_to_close'
        WHEN v_any_mark THEN 'in_treatment'
        WHEN v_consent_ok THEN 'consented'
        ELSE 'draft'
    END;

    UPDATE public.aesthetic_sessions s
    SET status = v_status,
        completeness = (CASE WHEN v_consent_ok THEN 25 ELSE 0 END)
                     + (CASE WHEN v_photos_ok THEN 25 ELSE 0 END)
                     + (CASE WHEN v_all_marked THEN 25 ELSE 0 END)
                     + (CASE WHEN v_closed THEN 25 ELSE 0 END)
    WHERE s.id = p_session_id;
END;
$$;

-- Las sesiones abiertas que ya estaban trabadas pasan a su estado correcto
SELECT public.aesthetic_session_recompute(s.id)
FROM public.aesthetic_sessions s
WHERE s.flow_version >= 2 AND s.closed_at IS NULL AND s.voided_at IS NULL;

-- ─── Registro de migración ────────────────────────────────────────────────────

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '157_20261104_aesthetic-photos-not-required.sql',
    'v1',
    'Sesión estética: el cierre no exige foto si el paciente no autorizó fotos clínicas o si el tratamiento es sólo corporal'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;
