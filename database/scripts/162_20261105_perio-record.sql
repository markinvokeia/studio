-- =====================================================================
-- Periodontograma — sesión de sondaje (fase P1)
--
-- Diseño: docs/periodontograma/diseno-odontograma-y-periodontograma.md
--
--   1. perio_exams → un periodontograma (una sesión clínica propia, como
--      aesthetic_sessions): fecha, doctor, cita, tipo de examen, examen guía,
--      notas, estado CALCULADO (probing → probed → closed | void), completitud
--      e índices (stats) que recalcula perio_exam_recompute() en cada guardado.
--   2. perio_teeth → estado de cada pieza en ese examen (present, missing,
--      pontic, implant: se toma del odontograma al abrir y queda congelado),
--      movilidad, furcas por entrada y nota.
--   3. perio_sites → seis sitios por pieza sondeable (side v/i × site D/C/M):
--      profundidad de sondaje, margen gingival (recesión positiva), NIC
--      generado (= PS + MG), sangrado, supuración, placa y origen del valor.
--   4. perio_exam_events → registro de actividad (creación, cierre, borrado).
--   5. Permisos PERIO_RECORD_VIEW y PERIO_RECORD_REGISTER_SESSION, dados a los
--      roles que ya tienen los del odontograma.
--
-- Endpoints (flujo n8n "Perio Record", docs/n8n-flows/flow-perio-record.json,
-- generado por scripts/n8n/generate-perio-record-workflow.mjs):
--   GET  perio/exams?patient_id=   perio_exams_list
--   POST perio/exams/save          perio_exam_save   { exam }
--   POST perio/exams/close         perio_exam_close  { id }
--   POST perio/exams/delete        perio_exam_delete { id }
--
-- Las funciones lanzan 'PERIO:<CODIGO>|<detalle>'; el flujo lo traduce a
-- 400 { success:false, code, detail }.
--
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- Vuelta atrás: 162_20261105_perio-record_down.sql (sólo con las tablas vacías).
-- =====================================================================

BEGIN;

-- ─── 1. Exámenes ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.perio_exams (
    id             bigserial PRIMARY KEY,
    patient_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    doctor_id      uuid REFERENCES public.users(id) ON DELETE SET NULL,
    appointment_id integer,
    exam_date      date NOT NULL,
    exam_type      varchar(20) NOT NULL DEFAULT 'maintenance'
                   CHECK (exam_type IN ('initial', 'reevaluation', 'maintenance')),
    -- Examen anterior que se mostró como guía (valores "fantasma") al sondar
    guide_exam_id  bigint REFERENCES public.perio_exams(id) ON DELETE SET NULL,
    title          varchar(200) NOT NULL DEFAULT '',
    notes          text NOT NULL DEFAULT '',
    status         varchar(20) NOT NULL DEFAULT 'probing'
                   CHECK (status IN ('probing', 'probed', 'closed', 'void')),
    completeness   smallint NOT NULL DEFAULT 0,
    stats          jsonb,
    closed_at      timestamp without time zone,
    closed_by      uuid,
    voided_at      timestamp without time zone,
    voided_by      uuid,
    void_reason    text,
    created_at     timestamp without time zone NOT NULL DEFAULT NOW(),
    created_by     uuid,
    updated_at     timestamp without time zone NOT NULL DEFAULT NOW(),
    updated_by     uuid,
    deleted_at     timestamp without time zone
);

CREATE INDEX IF NOT EXISTS idx_perio_exams_patient
    ON public.perio_exams (patient_id, exam_date)
    WHERE deleted_at IS NULL;

COMMENT ON TABLE public.perio_exams IS 'Periodontograma: una sesión de sondaje del paciente. status y completeness los calcula perio_exam_recompute().';
COMMENT ON COLUMN public.perio_exams.stats IS 'Índices calculados de las piezas naturales: sitios, % sangrado, % placa, PS y NIC medios, conteos ≥4/≥5/≥6, etc.';

-- ─── 2. Piezas ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.perio_teeth (
    exam_id    bigint NOT NULL REFERENCES public.perio_exams(id) ON DELETE CASCADE,
    tooth      smallint NOT NULL CHECK (tooth / 10 BETWEEN 1 AND 4 AND tooth % 10 BETWEEN 1 AND 8),
    status     varchar(10) NOT NULL CHECK (status IN ('present', 'missing', 'pontic', 'implant')),
    mobility   smallint CHECK (mobility BETWEEN 0 AND 3),
    -- Grado por entrada de furca: {"v":2,"mp":0,"dp":1} (superiores) o {"v":1,"l":0} (inferiores)
    furcation  jsonb NOT NULL DEFAULT '{}'::jsonb,
    note       text,
    PRIMARY KEY (exam_id, tooth)
);

-- ─── 3. Sitios ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.perio_sites (
    exam_id      bigint NOT NULL,
    tooth        smallint NOT NULL,
    -- v: vestibular · i: palatino/lingual
    side         char(1) NOT NULL CHECK (side IN ('v', 'i')),
    -- D: distal · C: centro · M: mesial
    site         char(1) NOT NULL CHECK (site IN ('D', 'C', 'M')),
    pd_mm        smallint CHECK (pd_mm BETWEEN 0 AND 15),
    -- Recesión positiva (margen por debajo de la LAC), agrandamiento negativo
    gm_mm        smallint CHECK (gm_mm BETWEEN -10 AND 15),
    cal_mm       smallint GENERATED ALWAYS AS (pd_mm + gm_mm) STORED,
    bop          boolean NOT NULL DEFAULT false,
    suppuration  boolean NOT NULL DEFAULT false,
    plaque       boolean NOT NULL DEFAULT false,
    -- manual · same: "igual que antes" (valor del examen guía) · dictation
    source       varchar(10) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'same', 'dictation')),
    PRIMARY KEY (exam_id, tooth, side, site),
    FOREIGN KEY (exam_id, tooth) REFERENCES public.perio_teeth(exam_id, tooth) ON DELETE CASCADE
);

COMMENT ON COLUMN public.perio_sites.cal_mm IS 'Nivel de inserción clínica = PS + MG. Nulo mientras falte el margen.';

-- ─── 4. Actividad ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.perio_exam_events (
    id       bigserial PRIMARY KEY,
    exam_id  bigint NOT NULL REFERENCES public.perio_exams(id) ON DELETE CASCADE,
    type     varchar(40) NOT NULL,
    payload  jsonb NOT NULL DEFAULT '{}'::jsonb,
    at       timestamp without time zone NOT NULL DEFAULT NOW(),
    actor    uuid
);

CREATE INDEX IF NOT EXISTS idx_perio_exam_events_exam ON public.perio_exam_events (exam_id, at);

-- ─── Funciones ───────────────────────────────────────────────────────────────

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
    WHERE e.id = p_exam_id;
$$;

CREATE OR REPLACE FUNCTION public.perio_exams_list(p_patient_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE AS $$
    SELECT COALESCE(jsonb_agg(public.perio_exam_json(e.id) ORDER BY e.exam_date, e.created_at), '[]'::jsonb)
    FROM public.perio_exams e
    WHERE e.patient_id = p_patient_id AND e.deleted_at IS NULL;
$$;

-- Estado, completitud e índices. Nadie elige el estado: se recalcula en cada guardado.
--   probing: falta PS o MG en algún sitio de una pieza sondeable (presente o implante)
--   probed:  PS y MG completos
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
BEGIN
    SELECT e.status INTO v_status FROM public.perio_exams e WHERE e.id = p_exam_id;
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

    UPDATE public.perio_exams e
    SET status = CASE WHEN v_expected > 0 AND v_pd = v_expected AND v_gm = v_expected THEN 'probed' ELSE 'probing' END,
        completeness = CASE WHEN v_expected = 0 THEN 0 ELSE ROUND(100.0 * (v_pd + v_gm) / (2 * v_expected)) END,
        stats = v_stats
    WHERE e.id = p_exam_id;
END;
$$;

-- payload (camelCase, igual que el frontend):
-- { id?, patientId, date, title, examType, guideExamId?, doctorId?, appointmentId?, notes,
--   teeth: [{ tooth, status, mobility?, furcation?, note?,
--             sites: { v: [{ pd, gm, bop, sup, plaque, source }, ×3 D/C/M], i: [...] } }] }
-- Piezas y sitios se reemplazan enteros. Las piezas ausentes y los pónticos no llevan sitios.
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
BEGIN
    IF v_patient IS NULL THEN
        RAISE EXCEPTION 'PERIO:PATIENT_REQUIRED|';
    END IF;
    IF v_date IS NULL THEN
        RAISE EXCEPTION 'PERIO:DATE_REQUIRED|';
    END IF;

    IF v_id IS NULL THEN
        INSERT INTO public.perio_exams
            (patient_id, doctor_id, appointment_id, exam_date, exam_type, guide_exam_id, title, notes, created_by, updated_by)
        VALUES (v_patient,
                NULLIF(p_payload->>'doctorId', '')::uuid,
                NULLIF(p_payload->>'appointmentId', '')::integer,
                v_date,
                COALESCE(NULLIF(p_payload->>'examType', ''), 'maintenance'),
                NULLIF(p_payload->>'guideExamId', '')::bigint,
                COALESCE(p_payload->>'title', ''),
                COALESCE(p_payload->>'notes', ''),
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

-- Firmar y cerrar: sólo con PS y MG completos. Cerrado queda en solo lectura.
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
    IF v_status <> 'probed' THEN
        RAISE EXCEPTION 'PERIO:NOT_READY_TO_CLOSE|%', v_status;
    END IF;
    UPDATE public.perio_exams e
    SET status = 'closed', completeness = 100, closed_at = NOW(), closed_by = p_user, updated_at = NOW(), updated_by = p_user
    WHERE e.id = p_id;
    INSERT INTO public.perio_exam_events (exam_id, type, actor) VALUES (p_id, 'closed', p_user);
    RETURN public.perio_exam_json(p_id);
END;
$$;

-- Borrado lógico, sólo de exámenes sin cerrar (un examen cerrado es historia clínica)
CREATE OR REPLACE FUNCTION public.perio_exam_delete(p_id bigint, p_user uuid)
RETURNS TABLE (id bigint, deleted boolean)
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
    UPDATE public.perio_exams e SET deleted_at = NOW(), updated_at = NOW(), updated_by = p_user WHERE e.id = p_id;
    INSERT INTO public.perio_exam_events (exam_id, type, actor) VALUES (p_id, 'deleted', p_user);
    RETURN QUERY SELECT p_id, true;
END;
$$;

-- ─── 5. Permisos ─────────────────────────────────────────────────────────────

INSERT INTO public.permissions (name, description, code, module, submenu, permission_type)
VALUES
    ('Ver periodontograma', 'Ver los periodontogramas del paciente',
     'PERIO_RECORD_VIEW', 'Pacientes', 'Historia Clínica > Periodontograma', 'LECTURA'),
    ('Registrar periodontograma', 'Crear y editar periodontogramas (sondaje, firma y cierre)',
     'PERIO_RECORD_REGISTER_SESSION', 'Pacientes', 'Historia Clínica > Periodontograma', 'FUNCIONAL')
ON CONFLICT (code) DO NOTHING;

-- Cada permiso nuevo va a los roles que ya tienen su equivalente del odontograma
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT rp.role_id, p_new.id
FROM (VALUES
    ('ODONTOGRAM_VIEW',             'PERIO_RECORD_VIEW'),
    ('ODONTOGRAM_REGISTER_SESSION', 'PERIO_RECORD_REGISTER_SESSION')
) AS map(existing_code, new_code)
JOIN public.permissions p_old ON p_old.code = map.existing_code
JOIN public.role_permissions rp ON rp.permission_id = p_old.id
JOIN public.permissions p_new ON p_new.code = map.new_code
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ─── Registro de migración ────────────────────────────────────────────────────

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '162_20261105_perio-record.sql',
    'v1',
    'Periodontograma P1: perio_exams, perio_teeth, perio_sites, perio_exam_events, funciones perio_* y permisos PERIO_RECORD_*'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;
