-- =====================================================================
-- Órdenes de laboratorio — servicios de laboratorio en cada orden
-- Run on: dev / staging / prod
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- Requiere: 147, 148, 149 y 150.
-- =====================================================================
--
-- Qué hace:
--   Una orden lleva uno o varios servicios del catálogo marcados como
--   "trabajo de laboratorio" (corona, prótesis, férula…), cada uno con su
--   cantidad, sus piezas y una nota. La descripción libre pasa a ser
--   opcional: la orden necesita al menos un servicio O una descripción, así
--   las órdenes viejas (solo descripción) siguen siendo válidas.
--
-- Cambios:
--   1. service_catalog.is_lab (default false): el servicio es un trabajo de
--      laboratorio y aparece en el selector de la orden.
--   2. lab_order_items: los servicios de cada orden. service_name es una
--      copia del nombre al guardar (la orden no cambia si se renombra el
--      servicio).
--   3. lab_orders.work_description admite NULL.
--   4. v_lab_orders: columnas nuevas al final
--        items         [{ id, service_id, service_name, quantity, teeth, notes }]
--        work_summary  "Corona veneer ×2, Férula" o, sin servicios, la
--                      descripción. Es el texto corto de tarjetas y alertas.
--   5. lab_order_save: acepta items. Sin la clave "items" no toca los
--      servicios (clientes viejos). Con servicios, las piezas de la orden son
--      la unión de las de sus servicios.
--      Errores nuevos: INVALID_SERVICE, INVALID_QUANTITY. MISSING_WORK ahora
--      es "sin servicios y sin descripción".
--   6. lab_orders_search / lab_orders_board: la búsqueda también encuentra
--      por nombre de servicio; filtro nuevo service_id.
--
-- Despliegue: aplicar ESTE script y reimportar los flujos
-- "Patient Portal — Public Bookable Services" (flag is_lab del catálogo) y
-- "Lab Orders" en la misma ventana.
-- =====================================================================

BEGIN;

-- ─── 1. Flag del catálogo ────────────────────────────────────────────────────

ALTER TABLE public.service_catalog
    ADD COLUMN IF NOT EXISTS is_lab boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.service_catalog.is_lab IS
    'Trabajo de laboratorio: el servicio se puede pedir en una orden de laboratorio.';

CREATE INDEX IF NOT EXISTS service_catalog_is_lab_idx
    ON public.service_catalog (name)
    WHERE is_lab;

-- ─── 2. Servicios de cada orden ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.lab_order_items (
    id            serial PRIMARY KEY,
    lab_order_id  integer     NOT NULL REFERENCES public.lab_orders(id) ON DELETE CASCADE,
    service_id    integer     NOT NULL REFERENCES public.service_catalog(id),
    service_name  text        NOT NULL,
    quantity      smallint    NOT NULL DEFAULT 1,
    teeth         smallint[]  NOT NULL DEFAULT '{}',
    notes         text,
    sort_order    smallint    NOT NULL DEFAULT 0,
    created_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT lab_order_items_quantity_chk CHECK (quantity BETWEEN 1 AND 99)
);

COMMENT ON TABLE public.lab_order_items IS
    'Servicios (trabajos de laboratorio) de cada orden. service_name es una copia del nombre al guardar.';

CREATE INDEX IF NOT EXISTS lab_order_items_order_idx ON public.lab_order_items (lab_order_id, sort_order);
CREATE INDEX IF NOT EXISTS lab_order_items_service_idx ON public.lab_order_items (service_id);

-- ─── 3. Descripción opcional ─────────────────────────────────────────────────

ALTER TABLE public.lab_orders ALTER COLUMN work_description DROP NOT NULL;

COMMENT ON COLUMN public.lab_orders.work_description IS
    'Descripción libre del trabajo. Opcional si la orden tiene servicios (lab_order_items).';

-- ─── 4. Vista ────────────────────────────────────────────────────────────────
-- Las columnas nuevas van al final (CREATE OR REPLACE VIEW solo agrega).

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
       o.updated_at,
       COALESCE(it.items, '[]'::jsonb) AS items,
       COALESCE(it.summary, o.work_description) AS work_summary
FROM public.lab_orders o
JOIN public.lab_stages s ON s.id = o.current_stage_id
JOIN public.users p ON p.id = o.patient_id
LEFT JOIN public.users d ON d.id = o.doctor_id
LEFT JOIN public.users l ON l.id = o.laboratory_id
LEFT JOIN public.users c ON c.id = o.created_by
LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object(
               'id', i.id,
               'service_id', i.service_id,
               'service_name', i.service_name,
               'quantity', i.quantity,
               'teeth', to_jsonb(i.teeth),
               'notes', i.notes
           ) ORDER BY i.sort_order, i.id) AS items,
           string_agg(i.service_name || CASE WHEN i.quantity > 1 THEN ' ×' || i.quantity ELSE '' END,
                      ', ' ORDER BY i.sort_order, i.id) AS summary
    FROM public.lab_order_items i
    WHERE i.lab_order_id = o.id
) it ON true
WHERE NOT o.is_deleted;

COMMENT ON VIEW public.v_lab_orders IS
    'Órdenes de laboratorio con nombres, etapa actual, días en la etapa, atraso (is_overdue nunca en etapa final), servicios (items) y work_summary (servicios o, sin ellos, la descripción).';

-- ─── 5. Alta / edición ───────────────────────────────────────────────────────
--
-- p: { id?, patient_id, doctor_id?, laboratory_id?, work_description?,
--      teeth?: [11, 21], due_date?: 'YYYY-MM-DD', notes?,
--      items?: [{ service_id, quantity?, teeth?: [11], notes? }] }
-- Sin la clave "items" los servicios de la orden no se tocan.

CREATE OR REPLACE FUNCTION public.lab_order_valid_teeth(p_teeth smallint[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT NOT EXISTS (
        SELECT 1 FROM unnest(p_teeth) t
        WHERE NOT (t BETWEEN 11 AND 18 OR t BETWEEN 21 AND 28 OR t BETWEEN 31 AND 38 OR t BETWEEN 41 AND 48
                   OR t BETWEEN 51 AND 55 OR t BETWEEN 61 AND 65 OR t BETWEEN 71 AND 75 OR t BETWEEN 81 AND 85));
$$;

-- jsonb [11, "21"] → smallint[] ordenado y sin repetidos.
CREATE OR REPLACE FUNCTION public.lab_order_teeth_from_json(p jsonb)
RETURNS smallint[]
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT COALESCE(array_agg(DISTINCT e.value::smallint ORDER BY e.value::smallint), '{}')
    FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(p) = 'array' THEN p ELSE '[]'::jsonb END) AS e(value);
$$;

CREATE OR REPLACE FUNCTION public.lab_order_save(p jsonb, p_user_id uuid)
RETURNS SETOF public.v_lab_orders
LANGUAGE plpgsql
AS $$
#variable_conflict use_column
DECLARE
    v_id         integer := NULLIF(p->>'id', '')::integer;
    v_patient    uuid := NULLIF(p->>'patient_id', '')::uuid;
    v_work       text := NULLIF(btrim(p->>'work_description'), '');
    v_has_items  boolean := jsonb_typeof(p->'items') = 'array';
    v_items      jsonb := CASE WHEN jsonb_typeof(p->'items') = 'array' THEN p->'items' ELSE '[]'::jsonb END;
    v_item       jsonb;
    v_item_teeth smallint[];
    v_qty        integer;
    v_teeth      smallint[];
    v_initial    integer;
    v_pos        integer := 0;
    v_item_count integer;
BEGIN
    IF v_patient IS NULL THEN RAISE EXCEPTION 'LAB_ORDERS:MISSING_PATIENT'; END IF;

    -- Servicios que tendrá la orden: los que llegan o, sin la clave, los guardados.
    IF v_has_items THEN
        v_item_count := jsonb_array_length(v_items);
    ELSE
        SELECT count(*) INTO v_item_count FROM public.lab_order_items i WHERE i.lab_order_id = v_id;
    END IF;
    IF v_work IS NULL AND v_item_count = 0 THEN RAISE EXCEPTION 'LAB_ORDERS:MISSING_WORK'; END IF;

    v_teeth := public.lab_order_teeth_from_json(p->'teeth');

    FOR v_item IN SELECT value FROM jsonb_array_elements(v_items) LOOP
        IF NOT EXISTS (SELECT 1 FROM public.service_catalog sc WHERE sc.id = NULLIF(v_item->>'service_id', '')::integer) THEN
            RAISE EXCEPTION 'LAB_ORDERS:INVALID_SERVICE';
        END IF;
        v_qty := COALESCE(NULLIF(v_item->>'quantity', '')::integer, 1);
        IF v_qty NOT BETWEEN 1 AND 99 THEN RAISE EXCEPTION 'LAB_ORDERS:INVALID_QUANTITY'; END IF;
        v_item_teeth := public.lab_order_teeth_from_json(v_item->'teeth');
        IF NOT public.lab_order_valid_teeth(v_item_teeth) THEN RAISE EXCEPTION 'LAB_ORDERS:INVALID_TEETH'; END IF;
    END LOOP;

    -- Con servicios, las piezas de la orden son la unión de las de sus servicios.
    IF v_has_items AND jsonb_array_length(v_items) > 0 THEN
        SELECT COALESCE(array_agg(DISTINCT t ORDER BY t), '{}') INTO v_teeth
        FROM jsonb_array_elements(v_items) e
        CROSS JOIN LATERAL unnest(public.lab_order_teeth_from_json(e.value->'teeth')) AS t;
    END IF;

    IF NOT public.lab_order_valid_teeth(v_teeth) THEN RAISE EXCEPTION 'LAB_ORDERS:INVALID_TEETH'; END IF;

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
            teeth = CASE WHEN v_has_items OR p ? 'teeth' THEN v_teeth ELSE o.teeth END,
            due_date = NULLIF(p->>'due_date', '')::date,
            notes = NULLIF(btrim(p->>'notes'), ''),
            updated_at = now(),
            updated_by = p_user_id
        WHERE o.id = v_id AND NOT o.is_deleted;
        IF NOT FOUND THEN RAISE EXCEPTION 'LAB_ORDERS:NOT_FOUND'; END IF;
    END IF;

    IF v_has_items THEN
        DELETE FROM public.lab_order_items i WHERE i.lab_order_id = v_id;
        FOR v_item IN SELECT value FROM jsonb_array_elements(v_items) LOOP
            v_pos := v_pos + 1;
            INSERT INTO public.lab_order_items (lab_order_id, service_id, service_name, quantity, teeth, notes, sort_order)
            SELECT v_id, sc.id, sc.name,
                   COALESCE(NULLIF(v_item->>'quantity', '')::integer, 1),
                   public.lab_order_teeth_from_json(v_item->'teeth'),
                   NULLIF(btrim(v_item->>'notes'), ''),
                   v_pos
            FROM public.service_catalog sc
            WHERE sc.id = (v_item->>'service_id')::integer;
        END LOOP;
    END IF;

    RETURN QUERY SELECT * FROM public.v_lab_orders v WHERE v.id = v_id;
END;
$$;

-- ─── 6. Búsqueda y tablero (por nombre de servicio + filtro service_id) ──────

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
            NULLIF(f->>'service_id', '')::integer AS service_id,
            NULLIF(btrim(f->>'search'), '')       AS search,
            NULLIF(f->>'date_from', '')::date     AS date_from,
            NULLIF(f->>'date_to', '')::date       AS date_to,
            NULLIF(f->>'entered_within_days', '')::integer AS entered_within_days,
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
          AND (x.service_id IS NULL OR EXISTS (
                   SELECT 1 FROM public.lab_order_items i
                   WHERE i.lab_order_id = v.id AND i.service_id = x.service_id))
          AND (x.date_from IS NULL OR v.created_at::date >= x.date_from)
          AND (x.date_to IS NULL OR v.created_at::date <= x.date_to)
          AND (x.entered_within_days IS NULL
               OR v.stage_entered_at >= now() - make_interval(days => x.entered_within_days))
          AND (x.search IS NULL
               OR v.patient_name ILIKE '%' || x.search || '%'
               OR v.work_description ILIKE '%' || x.search || '%'
               OR v.work_summary ILIKE '%' || x.search || '%'
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

CREATE OR REPLACE FUNCTION public.lab_orders_board(f jsonb)
RETURNS TABLE (stage_id integer, total bigint, items jsonb)
LANGUAGE sql
STABLE
AS $$
    WITH params AS (
        SELECT
            NULLIF(f->>'laboratory_id', '')::uuid AS laboratory_id,
            NULLIF(f->>'doctor_id', '')::uuid     AS doctor_id,
            NULLIF(f->>'service_id', '')::integer AS service_id,
            NULLIF(btrim(f->>'search'), '')       AS search,
            COALESCE((f->>'overdue_only')::boolean, false) AS overdue_only,
            LEAST(GREATEST(COALESCE(NULLIF(f->>'per_column', '')::integer, 30), 1), 100) AS per_column,
            GREATEST(COALESCE(NULLIF(f->>'final_days', '')::integer, 30), 1) AS final_days
    ),
    filtered AS (
        SELECT v.*,
               row_number() OVER (
                   PARTITION BY v.current_stage_id
                   ORDER BY
                       CASE WHEN v.stage_kind = 'final' THEN v.stage_entered_at END DESC,
                       CASE WHEN v.stage_kind <> 'final' THEN v.stage_entered_at END ASC,
                       v.id
               ) AS rn
        FROM public.v_lab_orders v, params x
        WHERE (NOT x.overdue_only OR v.is_overdue)
          AND (x.laboratory_id IS NULL OR v.laboratory_id = x.laboratory_id)
          AND (x.doctor_id IS NULL OR v.doctor_id = x.doctor_id)
          AND (x.service_id IS NULL OR EXISTS (
                   SELECT 1 FROM public.lab_order_items i
                   WHERE i.lab_order_id = v.id AND i.service_id = x.service_id))
          AND (v.stage_kind <> 'final'
               OR v.stage_entered_at >= now() - make_interval(days => x.final_days))
          AND (x.search IS NULL
               OR v.patient_name ILIKE '%' || x.search || '%'
               OR v.work_description ILIKE '%' || x.search || '%'
               OR v.work_summary ILIKE '%' || x.search || '%'
               OR v.laboratory_name ILIKE '%' || x.search || '%'
               OR v.id::text = x.search)
    )
    SELECT s.id,
           COUNT(o.id),
           COALESCE(jsonb_agg(to_jsonb(o) - 'rn' ORDER BY o.rn) FILTER (WHERE o.rn <= (SELECT per_column FROM params)), '[]'::jsonb)
    FROM public.lab_stages s
    LEFT JOIN filtered o ON o.current_stage_id = s.id
    WHERE s.is_active
    GROUP BY s.id, s.sort_order
    ORDER BY s.sort_order, s.id;
$$;

-- ─── Registro de migración ────────────────────────────────────────────────────

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '167_20261109_lab-order-services.sql',
    'v1',
    'service_catalog.is_lab + lab_order_items + work_description opcional + v_lab_orders.items/work_summary + lab_order_save con items + búsqueda/tablero por servicio'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;
