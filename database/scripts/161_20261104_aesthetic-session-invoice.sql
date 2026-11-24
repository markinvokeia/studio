-- 161_20261104_aesthetic-session-invoice.sql
-- Factura de la sesión estética.
--
-- El cierre abría el asistente de cobro sin decir de qué sesión venía: la factura
-- quedaba suelta, la ficha no podía mostrarla y volver a tocar "Cobrar" creaba otra.
-- Se vincula igual que en sesiones_clinicas y sesiones: una factura por sesión.
--
-- 1. aesthetic_sessions.invoice_id (nullable; borrar la factura libera la sesión).
-- 2. aesthetic_session_json devuelve 'invoice' con su estado actual (definición de
--    la 160 + el campo). Lo lee de invoices, así que un pago hecho desde Ventas se
--    ve al volver a abrir la sesión. Requiere la 160.
-- 3. aesthetic_session_link_invoice:
--    - Se puede vincular con la sesión cerrada: el cierre bloquea lo clínico, no el
--      cobro. Con la sesión anulada no.
--    - La factura tiene que ser de venta y del mismo paciente.
--    - Repetir el vínculo con la misma factura no cambia nada y devuelve la sesión
--      al día: el frontend lo usa para refrescar los importes después de un pago.
--    - No toca updated_at: no es un cambio de la ficha clínica.
--
-- Va con el flujo "Aesthetic Record" (POST aesthetic/sessions/link_invoice).
-- Aplicar este script antes de importar el flujo.

BEGIN;

ALTER TABLE public.aesthetic_sessions ADD COLUMN IF NOT EXISTS invoice_id integer NULL;

COMMENT ON COLUMN public.aesthetic_sessions.invoice_id IS 'Factura de venta de esta sesión. NULL: todavía no se facturó.';

ALTER TABLE public.aesthetic_sessions DROP CONSTRAINT IF EXISTS aesthetic_sessions_invoice_id_fkey;
ALTER TABLE public.aesthetic_sessions
    ADD CONSTRAINT aesthetic_sessions_invoice_id_fkey
    FOREIGN KEY (invoice_id) REFERENCES public.invoices (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_aesthetic_sessions_invoice_id
    ON public.aesthetic_sessions (invoice_id)
    WHERE invoice_id IS NOT NULL;

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
        'invoice', (
            SELECT jsonb_build_object(
                'id', i.id::text,
                'docNo', COALESCE(NULLIF(i.doc_no, ''), i.invoice_ref),
                'total', i.total,
                'paidAmount', COALESCE(i.paid_amount, 0),
                'currency', i.currency,
                'status', i.status,
                'paymentState', i.payment_state,
                'createdAt', to_char(i.created_at, 'YYYY-MM-DD"T"HH24:MI:SS'),
                'serviceIds', COALESCE((
                    SELECT jsonb_agg(DISTINCT ii.service_id::text)
                    FROM public.invoice_items ii
                    WHERE ii.invoice_id = i.id AND ii.service_id IS NOT NULL
                ), '[]'::jsonb)
            )
            FROM public.invoices i
            WHERE i.id = s.invoice_id
        ),
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

CREATE OR REPLACE FUNCTION public.aesthetic_session_link_invoice(p_id bigint, p_invoice_id integer, p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
    v_status  varchar;
    v_patient uuid;
    v_current integer;
    v_doc_no  text;
BEGIN
    -- FOR UPDATE: dos cobros simultáneos no pueden dejar la sesión con la factura equivocada
    SELECT s.status, s.patient_id, s.invoice_id INTO v_status, v_patient, v_current
    FROM public.aesthetic_sessions s
    WHERE s.id = p_id AND s.deleted_at IS NULL
    FOR UPDATE;
    IF v_status IS NULL THEN
        RAISE EXCEPTION 'AESTHETIC:SESSION_NOT_FOUND|%', p_id;
    END IF;
    IF v_status = 'void' THEN
        RAISE EXCEPTION 'AESTHETIC:SESSION_CLOSED|void';
    END IF;

    SELECT COALESCE(NULLIF(i.doc_no, ''), i.invoice_ref) INTO v_doc_no
    FROM public.invoices i
    WHERE i.id = p_invoice_id AND i.is_sales = true AND i.user_id = v_patient;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'AESTHETIC:INVOICE_NOT_FOUND|%', p_invoice_id;
    END IF;

    IF v_current IS NOT NULL AND v_current <> p_invoice_id THEN
        RAISE EXCEPTION 'AESTHETIC:INVOICE_ALREADY_LINKED|%', v_current;
    END IF;

    IF v_current IS NULL THEN
        UPDATE public.aesthetic_sessions SET invoice_id = p_invoice_id WHERE id = p_id;
        INSERT INTO public.aesthetic_session_events (session_id, type, payload, actor)
        VALUES (p_id, 'invoice_linked', jsonb_build_object('docNo', v_doc_no), p_user);
    END IF;

    RETURN public.aesthetic_session_json(p_id);
END;
$$;

-- ─── Registro de migración ────────────────────────────────────────────────────

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '161_20261104_aesthetic-session-invoice.sql',
    'v1',
    'Ficha estética: factura vinculada a la sesión (invoice_id), su estado en el JSON y aesthetic_session_link_invoice'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;
