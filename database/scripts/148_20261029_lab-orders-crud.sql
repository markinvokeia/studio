-- =====================================================================
-- Órdenes de laboratorio — fase 2: datos de la orden, alta/edición,
-- cambio de etapa con historial, búsqueda y detalle
-- Run on: dev / staging / prod
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- Requiere: 147_20261029_lab-orders-stages.sql
-- =====================================================================
--
-- Cambios:
--   1. lab_orders: piezas dentales (FDI), fecha de entrega estimada y notas.
--      El laboratorio es cualquier proveedor (users con rol proveedor).
--   2. v_lab_orders: una fila por orden no eliminada con nombres (paciente,
--      doctor, laboratorio, quien la creó), la etapa actual y el cálculo de
--      atraso:
--        days_in_stage  días completos desde stage_entered_at
--        is_pending     la etapa actual no es final
--        is_overdue     lleva MÁS de overdue_days en la etapa (nunca en finales)
--   3. lab_order_save(p, user): alta (entra en la etapa inicial activa y deja
--      la primera fila del historial) o edición de datos. Nunca cambia la
--      etapa: eso es lab_order_change_stage.
--   4. lab_order_change_stage(order, to_stage, user, expected_from, note):
--      bloquea la orden, verifica que siga en la etapa que el usuario vio
--      (si se pasa expected_from) y registra el cambio en el historial.
--   5. lab_orders_search(filters): lista paginada con total_count.
--   6. lab_order_detail(id): la orden + su historial (jsonb).
--
-- Errores: RAISE 'LAB_ORDERS:<CODIGO>' — el flujo "Lab Orders" responde
-- 400 { success: false, code } y el frontend traduce el código.
--   NO_INITIAL_STAGE / NOT_FOUND / MISSING_PATIENT / MISSING_WORK /
--   INVALID_TEETH / INVALID_STAGE / STAGE_CONFLICT
--
-- Despliegue: aplicar ESTE script antes de importar el flujo
-- "Lab Orders" (docs/n8n-flows/flow-lab-orders.json).
-- =====================================================================

BEGIN;

-- ─── 1. Datos de la orden ────────────────────────────────────────────────────

ALTER TABLE public.lab_orders
    ADD COLUMN IF NOT EXISTS teeth    smallint[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS due_date date,
    ADD COLUMN IF NOT EXISTS notes    text;

COMMENT ON COLUMN public.lab_orders.teeth IS 'Piezas dentales del trabajo (numeración FDI, 11–48 y 51–85).';
COMMENT ON COLUMN public.lab_orders.due_date IS 'Fecha de entrega que prometió el laboratorio. Solo informativa: el atraso se mide por etapa.';

CREATE INDEX IF NOT EXISTS lab_orders_created_idx
    ON public.lab_orders (created_at DESC)
    WHERE NOT is_deleted;

-- ─── 2. Vista ────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_lab_orders AS
SELECT o.id,
       o.patient_id,
       p.name                 AS patient_name,
       o.doctor_id,
       d.name                 AS doctor_name,
       o.laboratory_id,
       l.name                 AS laboratory_name,
       o.work_description,
       o.teeth,
       o.due_date,
       o.notes,
       o.current_stage_id,
       s.name                 AS stage_name,
       s.color                AS stage_color,
       s.kind                 AS stage_kind,
       s.sort_order           AS stage_sort_order,
       s.overdue_days         AS stage_overdue_days,
       o.stage_entered_at,
       floor(extract(epoch FROM (now() - o.stage_entered_at)) / 86400)::integer AS days_in_stage,
       (s.kind <> 'final')    AS is_pending,
       (s.kind <> 'final'
        AND s.overdue_days IS NOT NULL
        AND now() - o.stage_entered_at > make_interval(days => s.overdue_days)) AS is_overdue,
       o.created_at,
       o.created_by,
       c.name                 AS created_by_name,
       o.updated_at
FROM public.lab_orders o
JOIN public.lab_stages s ON s.id = o.current_stage_id
JOIN public.users p ON p.id = o.patient_id
LEFT JOIN public.users d ON d.id = o.doctor_id
LEFT JOIN public.users l ON l.id = o.laboratory_id
LEFT JOIN public.users c ON c.id = o.created_by
WHERE NOT o.is_deleted;

COMMENT ON VIEW public.v_lab_orders IS
    'Órdenes de laboratorio con nombres, etapa actual, días en la etapa y atraso (is_overdue nunca en etapa final).';

-- ─── 3. Alta / edición ───────────────────────────────────────────────────────
--
-- p: { id?, patient_id, doctor_id?, laboratory_id?, work_description,
--      teeth?: [11, 21], due_date?: 'YYYY-MM-DD', notes? }

CREATE OR REPLACE FUNCTION public.lab_order_save(p jsonb, p_user_id uuid)
RETURNS SETOF public.v_lab_orders
LANGUAGE plpgsql
AS $$
#variable_conflict use_column
DECLARE
    v_id       integer := NULLIF(p->>'id', '')::integer;
    v_patient  uuid := NULLIF(p->>'patient_id', '')::uuid;
    v_work     text := NULLIF(btrim(p->>'work_description'), '');
    v_teeth    smallint[];
    v_initial  integer;
BEGIN
    IF v_patient IS NULL THEN RAISE EXCEPTION 'LAB_ORDERS:MISSING_PATIENT'; END IF;
    IF v_work IS NULL THEN RAISE EXCEPTION 'LAB_ORDERS:MISSING_WORK'; END IF;

    SELECT COALESCE(array_agg(DISTINCT t ORDER BY t), '{}')
    INTO v_teeth
    FROM jsonb_array_elements_text(COALESCE(p->'teeth', '[]'::jsonb)) AS e(value)
    CROSS JOIN LATERAL (SELECT e.value::smallint AS t) x;

    IF EXISTS (SELECT 1 FROM unnest(v_teeth) t
               WHERE NOT (t BETWEEN 11 AND 18 OR t BETWEEN 21 AND 28 OR t BETWEEN 31 AND 38 OR t BETWEEN 41 AND 48
                          OR t BETWEEN 51 AND 55 OR t BETWEEN 61 AND 65 OR t BETWEEN 71 AND 75 OR t BETWEEN 81 AND 85)) THEN
        RAISE EXCEPTION 'LAB_ORDERS:INVALID_TEETH';
    END IF;

    IF v_id IS NULL THEN
        SELECT s.id INTO v_initial
        FROM public.lab_stages s
        WHERE s.kind = 'initial' AND s.is_active
        LIMIT 1;
        IF v_initial IS NULL THEN RAISE EXCEPTION 'LAB_ORDERS:NO_INITIAL_STAGE'; END IF;

        INSERT INTO public.lab_orders (
            patient_id, doctor_id, laboratory_id, work_description, teeth, due_date, notes,
            current_stage_id, stage_entered_at, created_by, updated_by)
        VALUES (
            v_patient, NULLIF(p->>'doctor_id', '')::uuid, NULLIF(p->>'laboratory_id', '')::uuid, v_work,
            v_teeth, NULLIF(p->>'due_date', '')::date, NULLIF(btrim(p->>'notes'), ''),
            v_initial, now(), p_user_id, p_user_id)
        RETURNING id INTO v_id;

        INSERT INTO public.lab_order_stage_history (lab_order_id, from_stage_id, to_stage_id, changed_by)
        VALUES (v_id, NULL, v_initial, p_user_id);
    ELSE
        UPDATE public.lab_orders o
        SET patient_id = v_patient,
            doctor_id = NULLIF(p->>'doctor_id', '')::uuid,
            laboratory_id = NULLIF(p->>'laboratory_id', '')::uuid,
            work_description = v_work,
            teeth = v_teeth,
            due_date = NULLIF(p->>'due_date', '')::date,
            notes = NULLIF(btrim(p->>'notes'), ''),
            updated_at = now(),
            updated_by = p_user_id
        WHERE o.id = v_id AND NOT o.is_deleted;
        IF NOT FOUND THEN RAISE EXCEPTION 'LAB_ORDERS:NOT_FOUND'; END IF;
    END IF;

    RETURN QUERY SELECT * FROM public.v_lab_orders v WHERE v.id = v_id;
END;
$$;

-- ─── 4. Cambio de etapa ──────────────────────────────────────────────────────
--
-- p_expected_from: la etapa en la que el usuario vio la orden. Si otro la
-- movió mientras tanto → STAGE_CONFLICT (el tablero vuelve la tarjeta y
-- recarga). NULL = no verificar.

CREATE OR REPLACE FUNCTION public.lab_order_change_stage(
    p_order_id integer,
    p_to_stage_id integer,
    p_user_id uuid,
    p_expected_from integer DEFAULT NULL,
    p_note text DEFAULT NULL
)
RETURNS SETOF public.v_lab_orders
LANGUAGE plpgsql
AS $$
#variable_conflict use_column
DECLARE
    v_from integer;
BEGIN
    SELECT o.current_stage_id INTO v_from
    FROM public.lab_orders o
    WHERE o.id = p_order_id AND NOT o.is_deleted
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'LAB_ORDERS:NOT_FOUND'; END IF;

    IF p_expected_from IS NOT NULL AND p_expected_from <> v_from THEN
        RAISE EXCEPTION 'LAB_ORDERS:STAGE_CONFLICT';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.lab_stages s WHERE s.id = p_to_stage_id AND s.is_active) THEN
        RAISE EXCEPTION 'LAB_ORDERS:INVALID_STAGE';
    END IF;

    IF v_from <> p_to_stage_id THEN
        INSERT INTO public.lab_order_stage_history (lab_order_id, from_stage_id, to_stage_id, changed_by, note)
        VALUES (p_order_id, v_from, p_to_stage_id, p_user_id, NULLIF(btrim(p_note), ''));

        UPDATE public.lab_orders o
        SET current_stage_id = p_to_stage_id,
            stage_entered_at = now(),
            updated_at = now(),
            updated_by = p_user_id
        WHERE o.id = p_order_id;
    END IF;

    RETURN QUERY SELECT * FROM public.v_lab_orders v WHERE v.id = p_order_id;
END;
$$;

-- ─── 5. Búsqueda ─────────────────────────────────────────────────────────────
--
-- f: { stage_ids?: [1,2], laboratory_id?, doctor_id?, patient_id?, search?,
--      date_from?, date_to? (alta, 'YYYY-MM-DD', inclusive),
--      pending_only? (default true; se ignora si se filtra por etapa),
--      overdue_only?, sort?: 'created_desc' | 'created_asc' | 'days_desc' | 'days_asc',
--      limit? (default 25, máx. 200), offset? }

CREATE OR REPLACE FUNCTION public.lab_orders_search(f jsonb)
RETURNS TABLE (row_data jsonb, total_count bigint)
LANGUAGE sql
STABLE
AS $$
    WITH params AS (
        SELECT
            CASE WHEN jsonb_typeof(f->'stage_ids') = 'array' AND jsonb_array_length(f->'stage_ids') > 0
                 THEN ARRAY(SELECT jsonb_array_elements_text(f->'stage_ids')::integer) END AS stage_ids,
            NULLIF(f->>'laboratory_id', '')::uuid AS laboratory_id,
            NULLIF(f->>'doctor_id', '')::uuid     AS doctor_id,
            NULLIF(f->>'patient_id', '')::uuid    AS patient_id,
            NULLIF(btrim(f->>'search'), '')       AS search,
            NULLIF(f->>'date_from', '')::date     AS date_from,
            NULLIF(f->>'date_to', '')::date       AS date_to,
            COALESCE((f->>'pending_only')::boolean, true) AS pending_only,
            COALESCE((f->>'overdue_only')::boolean, false) AS overdue_only,
            COALESCE(NULLIF(f->>'sort', ''), 'created_desc') AS sort,
            LEAST(GREATEST(COALESCE(NULLIF(f->>'limit', '')::integer, 25), 1), 200) AS lim,
            GREATEST(COALESCE(NULLIF(f->>'offset', '')::integer, 0), 0) AS off
    ),
    filtered AS (
        SELECT v.*
        FROM public.v_lab_orders v, params x
        WHERE (x.stage_ids IS NULL OR v.current_stage_id = ANY (x.stage_ids))
          AND (x.stage_ids IS NOT NULL OR NOT x.pending_only OR v.is_pending)
          AND (NOT x.overdue_only OR v.is_overdue)
          AND (x.laboratory_id IS NULL OR v.laboratory_id = x.laboratory_id)
          AND (x.doctor_id IS NULL OR v.doctor_id = x.doctor_id)
          AND (x.patient_id IS NULL OR v.patient_id = x.patient_id)
          AND (x.date_from IS NULL OR v.created_at::date >= x.date_from)
          AND (x.date_to IS NULL OR v.created_at::date <= x.date_to)
          AND (x.search IS NULL
               OR v.patient_name ILIKE '%' || x.search || '%'
               OR v.work_description ILIKE '%' || x.search || '%'
               OR v.laboratory_name ILIKE '%' || x.search || '%'
               OR v.id::text = x.search)
    )
    SELECT to_jsonb(r), count(*) OVER ()
    FROM filtered r, params x
    ORDER BY
        CASE WHEN x.sort = 'days_desc' THEN r.stage_entered_at END ASC,
        CASE WHEN x.sort = 'days_asc' THEN r.stage_entered_at END DESC,
        CASE WHEN x.sort = 'created_asc' THEN r.created_at END ASC,
        r.created_at DESC,
        r.id DESC
    LIMIT (SELECT lim FROM params) OFFSET (SELECT off FROM params);
$$;

-- ─── 6. Detalle con historial ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.lab_order_detail(p_order_id integer)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
    SELECT to_jsonb(v) || jsonb_build_object(
        'history', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                       'id', h.id,
                       'from_stage_id', h.from_stage_id,
                       'from_stage_name', fs.name,
                       'from_stage_color', fs.color,
                       'to_stage_id', h.to_stage_id,
                       'to_stage_name', ts.name,
                       'to_stage_color', ts.color,
                       'changed_by', h.changed_by,
                       'changed_by_name', u.name,
                       'changed_at', h.changed_at,
                       'note', h.note
                   ) ORDER BY h.changed_at DESC, h.id DESC)
            FROM public.lab_order_stage_history h
            LEFT JOIN public.lab_stages fs ON fs.id = h.from_stage_id
            JOIN public.lab_stages ts ON ts.id = h.to_stage_id
            LEFT JOIN public.users u ON u.id = h.changed_by
            WHERE h.lab_order_id = v.id
        ), '[]'::jsonb))
    FROM public.v_lab_orders v
    WHERE v.id = p_order_id;
$$;

-- ─── Registro de migración ────────────────────────────────────────────────────

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '148_20261029_lab-orders-crud.sql',
    'v1',
    'lab_orders teeth/due_date/notes + v_lab_orders + lab_order_save / lab_order_change_stage / lab_orders_search / lab_order_detail'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;
