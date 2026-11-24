-- =====================================================================
-- Periodontograma — cribado PSR/BPE, solo implantes y recordatorio (fase P5)
--
-- Diseño: docs/periodontograma/diseno-odontograma-y-periodontograma.md
--
--   1. Dos tipos de examen nuevos:
--        screening  cribado PSR/BPE: un código por sextante (0–4, X excluido) en
--                   perio_exams.screening { codes: {"1".."6": código}, star: ["1",…] }
--        implants   solo implantes: se sondean los implantes y nada más
--   2. perio_exam_recompute cuenta lo que corresponde a cada tipo.
--   3. v_alert_perio_maintenance: origen para una regla de alerta de "mantenimiento
--      periodontal vence" (último periodontograma cerrado de cada paciente + intervalo del
--      diagnóstico, o la fecha de "agendar después"). La regla se crea en
--      Sistema → Reglas de alerta: origen v_alert_perio_maintenance, campo de usuario
--      patient_id, campo de evento due_date.
--
-- Sin cambios en el flujo n8n. Idempotente: se puede ejecutar varias veces.
-- =====================================================================

BEGIN;

ALTER TABLE public.perio_exams ADD COLUMN IF NOT EXISTS screening jsonb;
COMMENT ON COLUMN public.perio_exams.screening IS 'Cribado PSR/BPE: codes por sextante (1–6: 0–4 o X) y star (sextantes con *).';

ALTER TABLE public.perio_exams DROP CONSTRAINT IF EXISTS perio_exams_exam_type_check;
ALTER TABLE public.perio_exams ADD CONSTRAINT perio_exams_exam_type_check
    CHECK (exam_type IN ('initial', 'reevaluation', 'maintenance', 'screening', 'implants'));

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
        'screening', e.screening,
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

-- Estado, completitud e índices (ver 164); el cribado y el modo solo implantes cuentan lo suyo.
CREATE OR REPLACE FUNCTION public.perio_exam_recompute(p_exam_id bigint)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
    v_status   text;
    v_expected integer;
    v_pd       integer;
    v_gm       integer;
    v_stats    jsonb;
    v_dx       boolean;
    v_next     text;
    v_type     text;
    v_coded    integer;
    v_probed   text[];
BEGIN
    SELECT e.status, NULLIF(e.diagnosis->>'confirmedAt', '') IS NOT NULL, e.exam_type,
           (SELECT COUNT(*) FROM jsonb_each_text(COALESCE(e.screening->'codes', '{}'::jsonb)) c
             WHERE c.key IN ('1', '2', '3', '4', '5', '6') AND c.value IN ('0', '1', '2', '3', '4', 'X'))
    INTO v_status, v_dx, v_type, v_coded
    FROM public.perio_exams e WHERE e.id = p_exam_id;
    IF v_status IS NULL OR v_status IN ('closed', 'void') THEN
        RETURN;
    END IF;

    -- Cribado PSR/BPE: seis sextantes con su código, sin sondaje por sitio
    IF v_type = 'screening' THEN
        v_next := CASE WHEN v_coded < 6 THEN 'probing' WHEN v_dx THEN 'diagnosed' ELSE 'probed' END;
        UPDATE public.perio_exams e
        SET status = v_next,
            completeness = ROUND(90.0 * v_coded / 6) + CASE WHEN v_next = 'diagnosed' THEN 10 ELSE 0 END,
            stats = NULL
        WHERE e.id = p_exam_id;
        RETURN;
    END IF;

    -- Solo implantes: se sondean los implantes; en los demás exámenes, piezas presentes e implantes
    v_probed := CASE WHEN v_type = 'implants' THEN ARRAY['implant'] ELSE ARRAY['present', 'implant'] END;

    SELECT 6 * COUNT(*) INTO v_expected
    FROM public.perio_teeth t
    WHERE t.exam_id = p_exam_id AND t.status = ANY (v_probed);

    SELECT COUNT(s.pd_mm), COUNT(s.gm_mm) INTO v_pd, v_gm
    FROM public.perio_sites s
    JOIN public.perio_teeth t ON t.exam_id = s.exam_id AND t.tooth = s.tooth
    WHERE s.exam_id = p_exam_id AND t.status = ANY (v_probed);

    SELECT jsonb_build_object(
        'sites',     COUNT(s.pd_mm),
        'bopPct',    COALESCE(ROUND(100.0 * COUNT(*) FILTER (WHERE s.pd_mm IS NOT NULL AND s.bop) / NULLIF(COUNT(s.pd_mm), 0)), 0),
        'plaquePct', COALESCE(ROUND(100.0 * COUNT(*) FILTER (WHERE s.pd_mm IS NOT NULL AND s.plaque) / NULLIF(COUNT(s.pd_mm), 0)), 0),
        'meanPd',    ROUND(AVG(s.pd_mm)::numeric, 2),
        'meanCal',   ROUND(AVG(s.cal_mm)::numeric, 2),
        'n4',        COUNT(*) FILTER (WHERE s.pd_mm >= 4),
        'n5',        COUNT(*) FILTER (WHERE s.pd_mm >= 5),
        'n6',        COUNT(*) FILTER (WHERE s.pd_mm >= 6),
        'b4',        COUNT(*) FILTER (WHERE s.pd_mm = 4 AND s.bop),
        'b5',        COUNT(*) FILTER (WHERE s.pd_mm >= 5 AND s.bop),
        'teeth5',    COUNT(DISTINCT s.tooth) FILTER (WHERE s.pd_mm >= 5),
        'maxInterproximalCal', MAX(s.cal_mm) FILTER (WHERE s.site IN ('D', 'M'))
    ) INTO v_stats
    FROM public.perio_sites s
    JOIN public.perio_teeth t ON t.exam_id = s.exam_id AND t.tooth = s.tooth
    WHERE s.exam_id = p_exam_id AND t.status = 'present';

    v_next := CASE
        WHEN v_expected = 0 OR v_pd < v_expected OR v_gm < v_expected THEN 'probing'
        WHEN v_dx THEN 'diagnosed'
        ELSE 'probed'
    END;

    -- El sondaje pesa 90 % (profundidad y margen la mitad cada uno); el diagnóstico confirmado, 10 %
    UPDATE public.perio_exams e
    SET status = v_next,
        completeness = CASE WHEN v_expected = 0 THEN 0 ELSE ROUND(90.0 * (v_pd + v_gm) / (2 * v_expected)) END
                       + CASE WHEN v_next = 'diagnosed' THEN 10 ELSE 0 END,
        stats = v_stats
    WHERE e.id = p_exam_id;
END;
$$;

-- payload (camelCase, igual que el frontend): lo de 165 más screening (objeto o null).
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
    v_screen  jsonb := CASE WHEN jsonb_typeof(p_payload->'screening') = 'object' THEN p_payload->'screening' END;
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
    IF v_screen IS NOT NULL AND EXISTS (
        SELECT 1 FROM jsonb_each_text(COALESCE(v_screen->'codes', '{}'::jsonb)) c
        WHERE c.key NOT IN ('1', '2', '3', '4', '5', '6') OR c.value NOT IN ('0', '1', '2', '3', '4', 'X')
    ) THEN
        RAISE EXCEPTION 'PERIO:INVALID_VALUE|screening';
    END IF;
    IF v_closing IS NOT NULL AND COALESCE(v_closing->'nextVisit'->>'mode', 'later') NOT IN ('booked', 'later') THEN
        RAISE EXCEPTION 'PERIO:INVALID_VALUE|nextVisit';
    END IF;

    IF v_id IS NULL THEN
        INSERT INTO public.perio_exams
            (patient_id, doctor_id, appointment_id, exam_date, exam_type, guide_exam_id, title, notes, diagnosis, closing, screening, created_by, updated_by)
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
                v_screen,
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
            screening = v_screen,
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

-- Mantenimiento periodontal: cuándo le toca a cada paciente, a partir de su último
-- periodontograma cerrado. Si el cierre dejó "agendar después" con fecha, vale esa fecha.
CREATE OR REPLACE VIEW public.v_alert_perio_maintenance AS
SELECT DISTINCT ON (e.patient_id)
    e.id,
    e.patient_id,
    e.exam_date,
    e.exam_type,
    COALESCE((e.diagnosis->>'maintenanceMonths')::integer, 6) AS maintenance_months,
    COALESCE(
        CASE WHEN e.closing->'nextVisit'->>'mode' = 'later' THEN NULLIF(e.closing->'nextVisit'->>'date', '')::date END,
        (e.exam_date + make_interval(months => COALESCE((e.diagnosis->>'maintenanceMonths')::integer, 6)))::date
    ) AS due_date,
    e.diagnosis->>'risk' AS risk,
    e.closing->'nextVisit'->>'mode' AS next_visit_mode
FROM public.perio_exams e
WHERE e.status = 'closed' AND e.deleted_at IS NULL
ORDER BY e.patient_id, e.exam_date DESC, e.created_at DESC;

COMMENT ON VIEW public.v_alert_perio_maintenance IS
    '{"reference_table":"perio_exams","label":"Mantenimiento periodontal (último periodontograma cerrado de cada paciente)"}';

-- ─── Registro de migración ────────────────────────────────────────────────────

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '166_20261105_perio-screening-implants.sql',
    'v1',
    'Periodontograma P5: cribado PSR/BPE, modo solo implantes y v_alert_perio_maintenance'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;
