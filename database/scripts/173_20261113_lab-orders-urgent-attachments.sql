-- =====================================================================
-- Órdenes de laboratorio — órdenes urgentes + adjuntos
-- Run on: dev / staging / prod
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- Requiere: 147–150, 167, 169, 170, 171 y 172.
-- =====================================================================
--
-- 1. Órdenes URGENTES.
--    - lab_orders.is_urgent (boolean, default false). Se marca al crear o al
--      editar la orden (lab_order_save, clave is_urgent; en la edición, sin la
--      clave queda como estaba). Mismo permiso que crear/editar; no notifica.
--    - v_lab_orders.is_urgent (al final).
--    - lab_orders_search / lab_orders_board: las urgentes PENDIENTES salen
--      primero (en la lista sea cual sea el orden elegido; en el tablero dentro
--      de cada columna no final) y la clave nueva urgent_only (boolean) deja
--      solo las urgentes pendientes. En una etapa final la marca se conserva
--      pero ya no ordena ni filtra.
--
-- 2. ADJUNTOS de la orden (fotos, PDF, escaneos 3D…).
--    Sin tabla nueva: se usa public.attachments, la misma de las sesiones de la
--    historia clínica, con source_name = 'lab_order' y source_id = id de la
--    orden. El archivo va a Google Drive con el subflujo "Attachements CRUD"
--    (UPLOAD / DELETE), igual que /sesiones/upsert.
--    - v_lab_orders.attachments_count (al final): para el clip de la tarjeta.
--      Usa el índice idx_attachments_source (source_name, source_id).
--    - lab_order_detail(id) suma la clave `attachments`:
--        [{ id, file_name, mime_type, web_view_link, thumbnail_link, created_at }]
--    - Los endpoints nuevos del flujo "Lab Orders" (POST
--      /lab-orders/attachments/upload, POST /lab-orders/attachments/delete y
--      GET /lab-orders/attachment) leen y escriben attachments directamente;
--      no hacen falta funciones nuevas.
--
-- Despliegue (misma ventana, en este orden):
--   1. Este script (después de 172).
--   2. Reimportar "Lab Orders" (docs/n8n-flows/flow-lab-orders.json). En los
--      nodos "Upload attachment" y "Delete attachment file" elegir el subflujo
--      "Attachements CRUD" si su id no coincide con el de este entorno.
--   3. Publicar el frontend.
--   Sin el script, el frontend ve todas las órdenes como no urgentes y sin
--   adjuntos (is_urgent / attachments no llegan en la respuesta).
-- =====================================================================

BEGIN;

-- ─── 1. Columna ───────────────────────────────────────────────────────────────

ALTER TABLE public.lab_orders
    ADD COLUMN IF NOT EXISTS is_urgent boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.lab_orders.is_urgent IS
    'Orden urgente: mientras está pendiente sale primero en la lista, el tablero y la pestaña del paciente.';

-- ─── 2. Vista: is_urgent y attachments_count al final ────────────────────────
-- Igual que en el script 170, más las dos columnas nuevas al final
-- (CREATE OR REPLACE VIEW solo agrega).

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
        AND ((s.overdue_days IS NOT NULL AND now() - o.stage_entered_at > make_interval(days => s.overdue_days))
             OR (o.due_date IS NOT NULL AND o.due_date < (now() AT TIME ZONE 'America/Montevideo')::date))) AS is_overdue,
       o.created_at,
       o.created_by,
       c.name                 AS created_by_name,
       o.updated_at,
       COALESCE(it.items, '[]'::jsonb) AS items,
       COALESCE(it.summary, o.work_description) AS work_summary,
       (s.kind <> 'final'
        AND s.overdue_days IS NOT NULL
        AND now() - o.stage_entered_at > make_interval(days => s.overdue_days)) AS is_stage_overdue,
       (s.kind <> 'final'
        AND o.due_date IS NOT NULL
        AND o.due_date < (now() AT TIME ZONE 'America/Montevideo')::date) AS is_past_due,
       CASE WHEN s.kind <> 'final' AND o.due_date IS NOT NULL
                 AND o.due_date < (now() AT TIME ZONE 'America/Montevideo')::date
            THEN (now() AT TIME ZONE 'America/Montevideo')::date - o.due_date
            ELSE 0
       END AS days_past_due,
       COALESCE(it.lab_category_ids, '{}'::uuid[]) AS lab_category_ids,
       o.is_urgent,
       (SELECT count(*)::integer
        FROM public.attachments a
        WHERE a.source_name = 'lab_order' AND a.source_id = o.id::text) AS attachments_count
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
               'notes', i.notes,
               'lab_category_id', sc.lab_category_id
           ) ORDER BY i.sort_order, i.id) AS items,
           string_agg(i.service_name || CASE WHEN i.quantity > 1 THEN ' ×' || i.quantity ELSE '' END,
                      ', ' ORDER BY i.sort_order, i.id) AS summary,
           array_remove(array_agg(DISTINCT sc.lab_category_id), NULL) AS lab_category_ids
    FROM public.lab_order_items i
    LEFT JOIN public.service_catalog sc ON sc.id = i.service_id
    WHERE i.lab_order_id = o.id
) it ON true
WHERE NOT o.is_deleted;

COMMENT ON VIEW public.v_lab_orders IS
    'Órdenes de laboratorio con nombres, etapa actual, días en la etapa, atraso (is_overdue = is_stage_overdue OR is_past_due, nunca en etapa final), servicios (items), work_summary, lab_category_ids, is_urgent y attachments_count (adjuntos en attachments con source_name lab_order).';

-- ─── 3. Alta / edición con is_urgent ─────────────────────────────────────────
-- Igual que en el script 172 más is_urgent.

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
    v_stage_kind text;
    v_due        date;
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

        -- Sin due_date: se fija al enviar la orden (lab_order_change_stage).
        INSERT INTO public.lab_orders (
            patient_id, doctor_id, laboratory_id, work_description, teeth, notes, is_urgent,
            current_stage_id, stage_entered_at, created_by, updated_by)
        VALUES (
            v_patient, NULLIF(p->>'doctor_id', '')::uuid, NULLIF(p->>'laboratory_id', '')::uuid, v_work,
            v_teeth, NULLIF(btrim(p->>'notes'), ''),
            COALESCE(NULLIF(p->>'is_urgent', '')::boolean, false),
            v_initial, now(), p_user_id, p_user_id)
        RETURNING id INTO v_id;

        INSERT INTO public.lab_order_stage_history (lab_order_id, from_stage_id, to_stage_id, changed_by)
        VALUES (v_id, NULL, v_initial, p_user_id);
    ELSE
        SELECT s.kind, o.due_date INTO v_stage_kind, v_due
        FROM public.lab_orders o
        JOIN public.lab_stages s ON s.id = o.current_stage_id
        WHERE o.id = v_id AND NOT o.is_deleted
        FOR UPDATE OF o;
        IF NOT FOUND THEN RAISE EXCEPTION 'LAB_ORDERS:NOT_FOUND'; END IF;

        IF p ? 'due_date' THEN
            v_due := NULLIF(p->>'due_date', '')::date;
        END IF;
        -- Ya enviada y pendiente: la fecha de entrega no se puede quitar.
        IF v_stage_kind = 'intermediate' AND v_due IS NULL THEN
            RAISE EXCEPTION 'LAB_ORDERS:DUE_DATE_REQUIRED';
        END IF;

        UPDATE public.lab_orders o
        SET patient_id = v_patient,
            doctor_id = NULLIF(p->>'doctor_id', '')::uuid,
            laboratory_id = NULLIF(p->>'laboratory_id', '')::uuid,
            work_description = v_work,
            teeth = CASE WHEN v_has_items OR p ? 'teeth' THEN v_teeth ELSE o.teeth END,
            due_date = v_due,
            notes = NULLIF(btrim(p->>'notes'), ''),
            -- Sin la clave queda como estaba (clientes viejos no la mandan).
            is_urgent = CASE WHEN p ? 'is_urgent'
                             THEN COALESCE(NULLIF(p->>'is_urgent', '')::boolean, false)
                             ELSE o.is_urgent END,
            updated_at = now(),
            updated_by = p_user_id
        WHERE o.id = v_id AND NOT o.is_deleted;
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

-- ─── 4. Búsqueda: urgentes primero + urgent_only ─────────────────────────────
-- Igual que en el script 171 más urgent_only y el orden.

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
            NULLIF(f->>'due_from', '')::date      AS due_from,
            NULLIF(f->>'due_to', '')::date        AS due_to,
            COALESCE((f->>'without_laboratory')::boolean, false) AS without_laboratory,
            COALESCE((f->>'pending_only')::boolean, true) AS pending_only,
            COALESCE((f->>'overdue_only')::boolean, false) AS overdue_only,
            COALESCE((f->>'urgent_only')::boolean, false) AS urgent_only,
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
          -- Urgentes que siguen pendientes (en una etapa final ya no apuran).
          AND (NOT x.urgent_only OR (v.is_urgent AND v.is_pending))
          -- Vencen en un rango (pendientes con fecha de entrega dentro de él).
          AND ((x.due_from IS NULL AND x.due_to IS NULL)
               OR (v.is_pending AND v.due_date IS NOT NULL
                   AND (x.due_from IS NULL OR v.due_date >= x.due_from)
                   AND (x.due_to IS NULL OR v.due_date <= x.due_to)))
          -- Pendientes todavía sin laboratorio.
          AND (NOT x.without_laboratory OR (v.laboratory_id IS NULL AND v.is_pending))
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
        -- Las urgentes pendientes primero, sea cual sea el orden elegido.
        (r.is_urgent AND r.is_pending) DESC,
        CASE WHEN x.sort = 'days_desc' THEN r.stage_entered_at END ASC,
        CASE WHEN x.sort = 'days_asc' THEN r.stage_entered_at END DESC,
        CASE WHEN x.sort = 'created_asc' THEN r.created_at END ASC,
        r.created_at DESC,
        r.id DESC
    LIMIT (SELECT lim FROM params) OFFSET (SELECT off FROM params);
$$;

-- ─── 5. Tablero: urgentes primero en cada columna + urgent_only ──────────────
-- Igual que en el script 171 más urgent_only y el orden.

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
            COALESCE((f->>'urgent_only')::boolean, false) AS urgent_only,
            NULLIF(f->>'due_from', '')::date      AS due_from,
            NULLIF(f->>'due_to', '')::date        AS due_to,
            COALESCE((f->>'without_laboratory')::boolean, false) AS without_laboratory,
            LEAST(GREATEST(COALESCE(NULLIF(f->>'per_column', '')::integer, 30), 1), 100) AS per_column,
            GREATEST(COALESCE(NULLIF(f->>'final_days', '')::integer, 30), 1) AS final_days
    ),
    filtered AS (
        SELECT v.*,
               row_number() OVER (
                   PARTITION BY v.current_stage_id
                   ORDER BY
                       -- Urgentes primero dentro de cada columna (no en las finales).
                       (v.is_urgent AND v.stage_kind <> 'final') DESC,
                       CASE WHEN v.stage_kind = 'final' THEN v.stage_entered_at END DESC,
                       CASE WHEN v.stage_kind <> 'final' THEN v.stage_entered_at END ASC,
                       v.id
               ) AS rn
        FROM public.v_lab_orders v, params x
        WHERE (NOT x.overdue_only OR v.is_overdue)
          AND (NOT x.urgent_only OR (v.is_urgent AND v.is_pending))
          -- Vencen en un rango (pendientes con fecha de entrega dentro de él).
          AND ((x.due_from IS NULL AND x.due_to IS NULL)
               OR (v.is_pending AND v.due_date IS NOT NULL
                   AND (x.due_from IS NULL OR v.due_date >= x.due_from)
                   AND (x.due_to IS NULL OR v.due_date <= x.due_to)))
          -- Pendientes todavía sin laboratorio.
          AND (NOT x.without_laboratory OR (v.laboratory_id IS NULL AND v.is_pending))
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

-- ─── 6. Detalle con adjuntos ──────────────────────────────────────────────────
-- Igual que en el script 172 más attachments.

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
        ), '[]'::jsonb),
        'attachments', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                       'id', a.id,
                       'file_name', a.file_name,
                       'mime_type', a.mime_type,
                       'web_view_link', a.web_view_link,
                       'thumbnail_link', a.thumbnail_link,
                       'created_at', a.created_at
                   ) ORDER BY a.created_at, a.id)
            FROM public.attachments a
            WHERE a.source_name = 'lab_order' AND a.source_id = v.id::text
        ), '[]'::jsonb),
        'laboratory', (
            SELECT jsonb_build_object(
                       'id', l.id,
                       'name', l.name,
                       'phone_number', NULLIF(btrim(l.phone_number), ''),
                       'alternative_phone', NULLIF(btrim(l.alternative_phone), ''),
                       'email', NULLIF(btrim(l.email), ''),
                       'address', NULLIF(btrim(l.address), ''),
                       'rut', NULLIF(btrim(l.rut), ''),
                       'categories', COALESCE((
                           SELECT jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name) ORDER BY lower(g.name))
                           FROM public.group_provider gp
                           JOIN public.groups_prov g
                             ON g.id = gp.group_id AND g.is_lab_category AND COALESCE(g.is_active, true)
                           WHERE gp.provider_id = l.id
                       ), '[]'::jsonb)
                   )
            FROM public.users l
            WHERE l.id = v.laboratory_id
        ))
    FROM public.v_lab_orders v
    WHERE v.id = p_order_id;
$$;

COMMENT ON FUNCTION public.lab_order_detail(integer) IS
    'Detalle de una orden de laboratorio: fila de v_lab_orders + history + attachments (adjuntos de la orden) + laboratory (contacto y categorías del laboratorio asignado, o null).';

-- ─── Registro de migración ────────────────────────────────────────────────────

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '173_20261113_lab-orders-urgent-attachments.sql',
    'v1',
    'lab_orders.is_urgent (alta/edición, urgentes primero, urgent_only en search/board) + adjuntos de la orden en attachments (source_name lab_order): attachments_count en v_lab_orders y attachments en lab_order_detail'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;
