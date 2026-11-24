-- =====================================================================
-- Órdenes de laboratorio — filtros rápidos: "vencen pronto" y "sin laboratorio"
-- Run on: dev / staging / prod
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- Requiere: 147–150, 167, 169 y 170.
-- =====================================================================
--
-- Para la barra de resumen de Órdenes de laboratorio (Pendientes · Atrasadas ·
-- Vencen en 7 días · Sin laboratorio): cada contador es también un filtro de
-- la lista y del tablero.
--
-- Qué hace: lab_orders_search(f) y lab_orders_board(f) aceptan tres claves
-- nuevas en el jsonb (todas opcionales; sin ellas se comportan igual que antes):
--   - due_from / due_to ('YYYY-MM-DD', inclusive): solo órdenes PENDIENTES con
--     fecha de entrega en ese rango (las sin fecha quedan afuera).
--   - without_laboratory (boolean): solo órdenes PENDIENTES sin laboratorio.
-- Los contadores se piden con la misma búsqueda (limit 1 → total_count).
--
-- Despliegue: solo este script. Los flujos de n8n ya pasan el body completo a
-- las funciones ($json.body), así que no hay que reimportar nada. El frontend
-- que usa estos filtros va después (sin el script, los filtros se ignoran y los
-- contadores "Vencen en 7 días" / "Sin laboratorio" mostrarían el total de pendientes).
-- =====================================================================

BEGIN;

-- ─── Búsqueda ─────────────────────────────────────────────────────────────────

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
        CASE WHEN x.sort = 'days_desc' THEN r.stage_entered_at END ASC,
        CASE WHEN x.sort = 'days_asc' THEN r.stage_entered_at END DESC,
        CASE WHEN x.sort = 'created_asc' THEN r.created_at END ASC,
        r.created_at DESC,
        r.id DESC
    LIMIT (SELECT lim FROM params) OFFSET (SELECT off FROM params);
$$;

-- ─── Tablero ──────────────────────────────────────────────────────────────────

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
                       CASE WHEN v.stage_kind = 'final' THEN v.stage_entered_at END DESC,
                       CASE WHEN v.stage_kind <> 'final' THEN v.stage_entered_at END ASC,
                       v.id
               ) AS rn
        FROM public.v_lab_orders v, params x
        WHERE (NOT x.overdue_only OR v.is_overdue)
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

-- ─── Registro de migración ────────────────────────────────────────────────────

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '171_20261113_lab-orders-quick-filters.sql',
    'v1',
    'lab_orders_search / lab_orders_board: due_from, due_to y without_laboratory (barra de resumen y filtros rápidos)'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;
