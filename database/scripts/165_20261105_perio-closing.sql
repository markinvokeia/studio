-- =====================================================================
-- Periodontograma — cierre (fase P4)
--
-- Diseño: docs/periodontograma/diseno-odontograma-y-periodontograma.md
--
--   1. perio_exams.invoice_id: factura de venta del periodontograma (como aesthetic_sessions,
--      script 161). Una por examen; se puede cobrar también con el examen cerrado.
--   2. perio_exams.closing (jsonb): { noCharge, nextVisit: { mode: booked|later, date, kind },
--      reportSentAt }. Lo escribe el paso Cierre con el autoguardado.
--   3. perio_exam_amendments: enmiendas de un examen cerrado (texto con el motivo); el
--      examen no se toca, se le agrega la enmienda.
--   4. Firmar y cerrar exige además cobro resuelto y próxima cita (reservada o "agendar después").
--   5. perio_exam_json devuelve invoice, closing, amendments y patientPhone.
--
-- Endpoints nuevos en el flujo n8n "Perio Record" (regenerar e importar
-- docs/n8n-flows/flow-perio-record.json):
--   POST perio/exams/link-invoice  perio_exam_link_invoice  { id, invoice_id }
--   POST perio/exams/amend         perio_exam_amend         { id, body }
--
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- =====================================================================

BEGIN;

ALTER TABLE public.perio_exams ADD COLUMN IF NOT EXISTS invoice_id integer NULL;
ALTER TABLE public.perio_exams ADD COLUMN IF NOT EXISTS closing jsonb;
COMMENT ON COLUMN public.perio_exams.invoice_id IS 'Factura de venta del periodontograma. NULL: todavía no se facturó.';
COMMENT ON COLUMN public.perio_exams.closing IS 'Cierre: noCharge (sin cobro hoy), nextVisit (booked|later, fecha, motivo) y reportSentAt.';

ALTER TABLE public.perio_exams DROP CONSTRAINT IF EXISTS perio_exams_invoice_id_fkey;
ALTER TABLE public.perio_exams
    ADD CONSTRAINT perio_exams_invoice_id_fkey
    FOREIGN KEY (invoice_id) REFERENCES public.invoices (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_perio_exams_invoice_id
    ON public.perio_exams (invoice_id)
    WHERE invoice_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.perio_exam_amendments (
    id          bigserial PRIMARY KEY,
    exam_id     bigint NOT NULL REFERENCES public.perio_exams(id) ON DELETE CASCADE,
    body        text NOT NULL CHECK (length(trim(body)) > 0),
    created_at  timestamp without time zone NOT NULL DEFAULT NOW(),
    created_by  uuid
);
CREATE INDEX IF NOT EXISTS idx_perio_exam_amendments_exam ON public.perio_exam_amendments (exam_id, created_at);

-- Examen completo, con la forma del frontend (camelCase). Los sitios van en orden D, C, M.
CREATE OR REPLACE FUNCTION public.perio_exam_json(p_exam_id bigint)
RETURNS jsonb
LANGUAGE sql STABLE AS $$
    SELECT jsonb_build_object(
        'id', e.id::text,
        'patientId', e.patient_id,
        'doctorId', e.doctor_id,
        'doctorName', d.name,
        'appointmentId', e.appointment_id::text,
        'date', to_char(e.exam_date, 'YYYY-MM-DD'),
        'examType', e.exam_type,
        'guideExamId', e.guide_exam_id::text,
        'title', e.title,
        'notes', e.notes,
        'status', e.status,
        'completeness', e.completeness,
        'stats', e.stats,
        'closedAt', e.closed_at,
        'closedByName', cb.name,
        'createdAt', e.created_at,
        'updatedAt', e.updated_at,
        'diagnosis', e.diagnosis,
        'patientBirthday', to_char(p.birthday, 'YYYY-MM-DD'),
        'patientPhone', NULLIF(TRIM(COALESCE(p.phone_number, '')), ''),
        'closing', e.closing,
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
            WHERE i.id = e.invoice_id
        ),
        'amendments', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', a.id::text,
                'body', a.body,
                'createdAt', to_char(a.created_at, 'YYYY-MM-DD"T"HH24:MI:SS'),
                'createdByName', NULLIF(TRIM(COALESCE(au.name, '')), '')
            ) ORDER BY a.created_at)
            FROM public.perio_exam_amendments a
            LEFT JOIN public.users au ON au.id = a.created_by
            WHERE a.exam_id = e.id
        ), '[]'::jsonb),
        'teeth', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'tooth', t.tooth,
                'status', t.status,
                'mobility', t.mobility,
                'furcation', t.furcation,
                'note', COALESCE(t.note, ''),
                'sites', jsonb_build_object(
                    'v', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                                'pd', s.pd_mm, 'gm', s.gm_mm, 'bop', s.bop, 'sup', s.suppuration,
                                'plaque', s.plaque, 'source', s.source)
                            ORDER BY array_position(ARRAY['D', 'C', 'M'], s.site::text)), '[]'::jsonb)
                          FROM public.perio_sites s
                          WHERE s.exam_id = t.exam_id AND s.tooth = t.tooth AND s.side = 'v'),
                    'i', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                                'pd', s.pd_mm, 'gm', s.gm_mm, 'bop', s.bop, 'sup', s.suppuration,
                                'plaque', s.plaque, 'source', s.source)
                            ORDER BY array_position(ARRAY['D', 'C', 'M'], s.site::text)), '[]'::jsonb)
                          FROM public.perio_sites s
                          WHERE s.exam_id = t.exam_id AND s.tooth = t.tooth AND s.side = 'i')
                )
            ) ORDER BY t.tooth)
            FROM public.perio_teeth t
            WHERE t.exam_id = e.id
        ), '[]'::jsonb)
    )
    FROM public.perio_exams e
    LEFT JOIN public.users d ON d.id = e.doctor_id
    LEFT JOIN public.users cb ON cb.id = e.closed_by
    LEFT JOIN public.users p ON p.id = e.patient_id
    WHERE e.id = p_exam_id;
$$;

-- payload (camelCase, igual que el frontend): lo de 164 más closing (objeto o null).
CREATE OR REPLACE FUNCTION public.perio_exam_save(p_payload jsonb, p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
    v_id      bigint := NULLIF(p_payload->>'id', '')::bigint;
    v_patient uuid := NULLIF(p_payload->>'patientId', '')::uuid;
    v_date    date := NULLIF(p_payload->>'date', '')::date;
    v_status  text;
    v_tooth   jsonb;
    v_site    jsonb;
    v_number  smallint;
    v_tstatus text;
    v_side    text;
    v_idx     integer;
    v_pd      smallint;
    v_gm      smallint;
    v_keys    text[] := ARRAY['D', 'C', 'M'];
    v_dx      jsonb := CASE WHEN jsonb_typeof(p_payload->'diagnosis') = 'object' THEN p_payload->'diagnosis' END;
    v_closing jsonb := CASE WHEN jsonb_typeof(p_payload->'closing') = 'object' THEN p_payload->'closing' END;
BEGIN
    IF v_patient IS NULL THEN
        RAISE EXCEPTION 'PERIO:PATIENT_REQUIRED|';
    END IF;
    IF v_date IS NULL THEN
        RAISE EXCEPTION 'PERIO:DATE_REQUIRED|';
    END IF;
    IF v_dx IS NOT NULL AND (
        COALESCE(v_dx->>'stage', 'I') NOT IN ('I', 'II', 'III', 'IV')
        OR COALESCE(v_dx->>'grade', 'A') NOT IN ('A', 'B', 'C')
        OR COALESCE(v_dx->>'risk', 'low') NOT IN ('low', 'moderate', 'high')
        OR COALESCE(v_dx->>'stability', 'stable') NOT IN ('stable', 'gingivitis', 'unstable')
    ) THEN
        RAISE EXCEPTION 'PERIO:INVALID_DIAGNOSIS|';
    END IF;
    IF v_closing IS NOT NULL AND COALESCE(v_closing->'nextVisit'->>'mode', 'later') NOT IN ('booked', 'later') THEN
        RAISE EXCEPTION 'PERIO:INVALID_VALUE|nextVisit';
    END IF;

    IF v_id IS NULL THEN
        INSERT INTO public.perio_exams
            (patient_id, doctor_id, appointment_id, exam_date, exam_type, guide_exam_id, title, notes, diagnosis, closing, created_by, updated_by)
        VALUES (v_patient,
                NULLIF(p_payload->>'doctorId', '')::uuid,
                NULLIF(p_payload->>'appointmentId', '')::integer,
                v_date,
                COALESCE(NULLIF(p_payload->>'examType', ''), 'maintenance'),
                NULLIF(p_payload->>'guideExamId', '')::bigint,
                COALESCE(p_payload->>'title', ''),
                COALESCE(p_payload->>'notes', ''),
                v_dx,
                v_closing,
                p_user, p_user)
        RETURNING id INTO v_id;
        INSERT INTO public.perio_exam_events (exam_id, type, actor) VALUES (v_id, 'created', p_user);
    ELSE
        SELECT e.status INTO v_status
        FROM public.perio_exams e
        WHERE e.id = v_id AND e.patient_id = v_patient AND e.deleted_at IS NULL;
        IF v_status IS NULL THEN
            RAISE EXCEPTION 'PERIO:EXAM_NOT_FOUND|%', v_id;
        END IF;
        IF v_status IN ('closed', 'void') THEN
            RAISE EXCEPTION 'PERIO:EXAM_CLOSED|%', v_status;
        END IF;
        UPDATE public.perio_exams e
        SET doctor_id = NULLIF(p_payload->>'doctorId', '')::uuid,
            appointment_id = NULLIF(p_payload->>'appointmentId', '')::integer,
            exam_date = v_date,
            exam_type = COALESCE(NULLIF(p_payload->>'examType', ''), e.exam_type),
            guide_exam_id = NULLIF(p_payload->>'guideExamId', '')::bigint,
            title = COALESCE(p_payload->>'title', ''),
            notes = COALESCE(p_payload->>'notes', ''),
            diagnosis = v_dx,
            closing = v_closing,
            updated_at = NOW(),
            updated_by = p_user
        WHERE e.id = v_id;
        DELETE FROM public.perio_teeth t WHERE t.exam_id = v_id;
    END IF;

    FOR v_tooth IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'teeth', '[]'::jsonb)) LOOP
        v_number := NULLIF(v_tooth->>'tooth', '')::smallint;
        v_tstatus := COALESCE(NULLIF(v_tooth->>'status', ''), 'present');
        IF v_number IS NULL OR v_number / 10 NOT BETWEEN 1 AND 4 OR v_number % 10 NOT BETWEEN 1 AND 8 THEN
            RAISE EXCEPTION 'PERIO:INVALID_TOOTH|%', v_tooth->>'tooth';
        END IF;
        IF v_tstatus NOT IN ('present', 'missing', 'pontic', 'implant') THEN
            RAISE EXCEPTION 'PERIO:INVALID_TOOTH_STATUS|% %', v_number, v_tstatus;
        END IF;
        IF (v_tooth->>'mobility') IS NOT NULL AND (v_tooth->>'mobility')::integer NOT BETWEEN 0 AND 3 THEN
            RAISE EXCEPTION 'PERIO:INVALID_VALUE|% movilidad', v_number;
        END IF;

        INSERT INTO public.perio_teeth (exam_id, tooth, status, mobility, furcation, note)
        VALUES (v_id, v_number, v_tstatus,
                NULLIF(v_tooth->>'mobility', '')::smallint,
                CASE WHEN jsonb_typeof(v_tooth->'furcation') = 'object' THEN v_tooth->'furcation' ELSE '{}'::jsonb END,
                NULLIF(v_tooth->>'note', ''));

        CONTINUE WHEN v_tstatus NOT IN ('present', 'implant');

        FOREACH v_side IN ARRAY ARRAY['v', 'i'] LOOP
            FOR v_idx IN 0..2 LOOP
                v_site := COALESCE(v_tooth->'sites'->v_side->v_idx, '{}'::jsonb);
                v_pd := NULLIF(v_site->>'pd', '')::smallint;
                v_gm := NULLIF(v_site->>'gm', '')::smallint;
                IF (v_pd IS NOT NULL AND v_pd NOT BETWEEN 0 AND 15) OR (v_gm IS NOT NULL AND v_gm NOT BETWEEN -10 AND 15) THEN
                    RAISE EXCEPTION 'PERIO:INVALID_VALUE|% % %', v_number, v_side, v_keys[v_idx + 1];
                END IF;
                INSERT INTO public.perio_sites (exam_id, tooth, side, site, pd_mm, gm_mm, bop, suppuration, plaque, source)
                VALUES (v_id, v_number, v_side, v_keys[v_idx + 1], v_pd, v_gm,
                        COALESCE((v_site->>'bop')::boolean, false),
                        COALESCE((v_site->>'sup')::boolean, false),
                        COALESCE((v_site->>'plaque')::boolean, false),
                        CASE WHEN v_site->>'source' IN ('manual', 'same', 'dictation') THEN v_site->>'source' ELSE 'manual' END);
            END LOOP;
        END LOOP;
    END LOOP;

    PERFORM public.perio_exam_recompute(v_id);
    RETURN public.perio_exam_json(v_id);
END;
$$;

-- Firmar y cerrar: sondaje completo, diagnóstico confirmado, cobro resuelto y próxima cita.
CREATE OR REPLACE FUNCTION public.perio_exam_close(p_id bigint, p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
    v_status  text;
    v_invoice integer;
    v_closing jsonb;
BEGIN
    SELECT e.status INTO v_status FROM public.perio_exams e WHERE e.id = p_id AND e.deleted_at IS NULL;
    IF v_status IS NULL THEN
        RAISE EXCEPTION 'PERIO:EXAM_NOT_FOUND|%', p_id;
    END IF;
    IF v_status IN ('closed', 'void') THEN
        RAISE EXCEPTION 'PERIO:EXAM_CLOSED|%', v_status;
    END IF;
    PERFORM public.perio_exam_recompute(p_id);
    SELECT e.status INTO v_status FROM public.perio_exams e WHERE e.id = p_id;
    IF v_status <> 'diagnosed' THEN
        RAISE EXCEPTION 'PERIO:NOT_READY_TO_CLOSE|%', v_status;
    END IF;
    -- Cobro resuelto (factura vinculada o "sin cobro hoy") y próxima cita (reservada o "agendar después")
    SELECT e.invoice_id, e.closing INTO v_invoice, v_closing FROM public.perio_exams e WHERE e.id = p_id;
    IF v_invoice IS NULL AND COALESCE((v_closing->>'noCharge')::boolean, false) = false THEN
        RAISE EXCEPTION 'PERIO:BILLING_PENDING|';
    END IF;
    IF COALESCE(v_closing->'nextVisit'->>'mode', '') NOT IN ('booked', 'later') THEN
        RAISE EXCEPTION 'PERIO:NEXT_VISIT_PENDING|';
    END IF;
    UPDATE public.perio_exams e
    SET status = 'closed', completeness = 100, closed_at = NOW(), closed_by = p_user, updated_at = NOW(), updated_by = p_user
    WHERE e.id = p_id;
    INSERT INTO public.perio_exam_events (exam_id, type, actor) VALUES (p_id, 'closed', p_user);
    RETURN public.perio_exam_json(p_id);
END;
$$;

-- Vincula la factura que se acaba de crear desde el cobro. Se puede con el examen cerrado: cerrar
-- traba la historia clínica, no el dinero.
CREATE OR REPLACE FUNCTION public.perio_exam_link_invoice(p_id bigint, p_invoice_id integer, p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
    v_status  varchar;
    v_patient uuid;
    v_current integer;
    v_doc_no  text;
BEGIN
    -- FOR UPDATE: dos cobros simultáneos no pueden dejar el examen con la factura equivocada
    SELECT e.status, e.patient_id, e.invoice_id INTO v_status, v_patient, v_current
    FROM public.perio_exams e
    WHERE e.id = p_id AND e.deleted_at IS NULL
    FOR UPDATE;
    IF v_status IS NULL THEN
        RAISE EXCEPTION 'PERIO:EXAM_NOT_FOUND|%', p_id;
    END IF;
    IF v_status = 'void' THEN
        RAISE EXCEPTION 'PERIO:EXAM_CLOSED|void';
    END IF;

    SELECT COALESCE(NULLIF(i.doc_no, ''), i.invoice_ref) INTO v_doc_no
    FROM public.invoices i
    WHERE i.id = p_invoice_id AND i.is_sales = true AND i.user_id = v_patient;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'PERIO:INVOICE_NOT_FOUND|%', p_invoice_id;
    END IF;

    IF v_current IS NOT NULL AND v_current <> p_invoice_id THEN
        RAISE EXCEPTION 'PERIO:INVOICE_ALREADY_LINKED|%', v_current;
    END IF;

    IF v_current IS NULL THEN
        UPDATE public.perio_exams SET invoice_id = p_invoice_id WHERE id = p_id;
        INSERT INTO public.perio_exam_events (exam_id, type, payload, actor)
        VALUES (p_id, 'invoice_linked', jsonb_build_object('docNo', v_doc_no), p_user);
    END IF;

    RETURN public.perio_exam_json(p_id);
END;
$$;

-- Enmienda de un examen cerrado: queda junto al examen, con autor y fecha
CREATE OR REPLACE FUNCTION public.perio_exam_amend(p_id bigint, p_body text, p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
    v_status text;
BEGIN
    SELECT e.status INTO v_status FROM public.perio_exams e WHERE e.id = p_id AND e.deleted_at IS NULL;
    IF v_status IS NULL THEN
        RAISE EXCEPTION 'PERIO:EXAM_NOT_FOUND|%', p_id;
    END IF;
    IF v_status <> 'closed' THEN
        RAISE EXCEPTION 'PERIO:NOT_CLOSED|%', v_status;
    END IF;
    IF length(trim(COALESCE(p_body, ''))) = 0 THEN
        RAISE EXCEPTION 'PERIO:AMENDMENT_REQUIRED|';
    END IF;
    INSERT INTO public.perio_exam_amendments (exam_id, body, created_by) VALUES (p_id, trim(p_body), p_user);
    INSERT INTO public.perio_exam_events (exam_id, type, actor) VALUES (p_id, 'amended', p_user);
    RETURN public.perio_exam_json(p_id);
END;
$$;

-- ─── Registro de migración ────────────────────────────────────────────────────

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '165_20261105_perio-closing.sql',
    'v1',
    'Periodontograma P4: factura vinculada, datos de cierre, enmiendas y cierre con cobro y próxima cita'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;
