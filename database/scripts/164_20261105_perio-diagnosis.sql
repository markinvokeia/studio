-- =====================================================================
-- Periodontograma — diagnóstico y plan (fase P3)
--
-- Diseño: docs/periodontograma/diseno-odontograma-y-periodontograma.md
--
--   1. perio_exams.diagnosis (jsonb): clasificación AAP/EFP 2017 (caso, estadio, extensión,
--      grado), estabilidad, riesgo de Lang y Tonetti, intervalo de mantenimiento, plan por pasos
--      EFP y los datos que no salen del sondaje (dientes perdidos, pérdida ósea, edad, tabaco,
--      diabetes). Lo calcula el navegador como sugerencia; se guarda lo que el profesional
--      confirma (confirmedAt).
--   2. Estado nuevo 'diagnosed' (sondaje completo y diagnóstico confirmado). Firmar y cerrar
--      ahora lo exige.
--   3. Completitud: sondaje 90 % y diagnóstico confirmado 10 %.
--   4. perio_exam_json devuelve también diagnosis y patientBirthday (para el grado).
--
-- Sin cambios en el flujo n8n: perio/exams/save ya pasa el examen entero.
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- =====================================================================

BEGIN;

ALTER TABLE public.perio_exams ADD COLUMN IF NOT EXISTS diagnosis jsonb;
COMMENT ON COLUMN public.perio_exams.diagnosis IS 'Diagnóstico y plan confirmados por el profesional (clasificación 2017, riesgo, plan EFP). confirmedAt nulo = sin confirmar.';

ALTER TABLE public.perio_exams DROP CONSTRAINT IF EXISTS perio_exams_status_check;
ALTER TABLE public.perio_exams ADD CONSTRAINT perio_exams_status_check
    CHECK (status IN ('probing', 'probed', 'diagnosed', 'closed', 'void'));

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

-- Estado, completitud e índices. Nadie elige el estado: se recalcula en cada guardado.
--   probing:   falta PS o MG en algún sitio de una pieza sondeable (presente o implante)
--   probed:    PS y MG completos
--   diagnosed: además, diagnóstico confirmado
-- Los índices son de las piezas naturales (los implantes tienen sus propios criterios).
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
BEGIN
    SELECT e.status, NULLIF(e.diagnosis->>'confirmedAt', '') IS NOT NULL INTO v_status, v_dx
    FROM public.perio_exams e WHERE e.id = p_exam_id;
    IF v_status IS NULL OR v_status IN ('closed', 'void') THEN
        RETURN;
    END IF;

    SELECT 6 * COUNT(*) INTO v_expected
    FROM public.perio_teeth t
    WHERE t.exam_id = p_exam_id AND t.status IN ('present', 'implant');

    SELECT COUNT(s.pd_mm), COUNT(s.gm_mm) INTO v_pd, v_gm
    FROM public.perio_sites s
    JOIN public.perio_teeth t ON t.exam_id = s.exam_id AND t.tooth = s.tooth
    WHERE s.exam_id = p_exam_id AND t.status IN ('present', 'implant');

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

-- payload (camelCase, igual que el frontend): lo de 163 más diagnosis (objeto o null).
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

    IF v_id IS NULL THEN
        INSERT INTO public.perio_exams
            (patient_id, doctor_id, appointment_id, exam_date, exam_type, guide_exam_id, title, notes, diagnosis, created_by, updated_by)
        VALUES (v_patient,
                NULLIF(p_payload->>'doctorId', '')::uuid,
                NULLIF(p_payload->>'appointmentId', '')::integer,
                v_date,
                COALESCE(NULLIF(p_payload->>'examType', ''), 'maintenance'),
                NULLIF(p_payload->>'guideExamId', '')::bigint,
                COALESCE(p_payload->>'title', ''),
                COALESCE(p_payload->>'notes', ''),
                v_dx,
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

-- Firmar y cerrar: sólo con el sondaje completo y el diagnóstico confirmado. Cerrado queda en solo lectura.
CREATE OR REPLACE FUNCTION public.perio_exam_close(p_id bigint, p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
    v_status text;
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
    UPDATE public.perio_exams e
    SET status = 'closed', completeness = 100, closed_at = NOW(), closed_by = p_user, updated_at = NOW(), updated_by = p_user
    WHERE e.id = p_id;
    INSERT INTO public.perio_exam_events (exam_id, type, actor) VALUES (p_id, 'closed', p_user);
    RETURN public.perio_exam_json(p_id);
END;
$$;

-- Los exámenes que ya tenían el sondaje completo recalculan la completitud con los pesos nuevos
DO $mig$
DECLARE
    v_id bigint;
BEGIN
    FOR v_id IN SELECT e.id FROM public.perio_exams e WHERE e.status IN ('probing', 'probed', 'diagnosed') AND e.deleted_at IS NULL LOOP
        PERFORM public.perio_exam_recompute(v_id);
    END LOOP;
END
$mig$;

-- ─── Registro de migración ────────────────────────────────────────────────────

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '164_20261105_perio-diagnosis.sql',
    'v1',
    'Periodontograma P3: perio_exams.diagnosis, estado diagnosed, cierre con diagnóstico confirmado'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;
