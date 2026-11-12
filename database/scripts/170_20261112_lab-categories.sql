-- =====================================================================
-- Órdenes de laboratorio — laboratorios por categoría + laboratorio al mover
-- Run on: dev / staging / prod
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- Requiere: 147–150, 167 y 169.
-- =====================================================================
--
-- Problema: el laboratorio de una orden era cualquier proveedor y nada decía
-- qué hace cada laboratorio (unos hacen prótesis fija, otros ortodoncia…).
-- Además una orden podía pasar a "Enviado al laboratorio" sin laboratorio.
--
-- Qué hace (reusa los Grupos de proveedores):
--   1. groups_prov.is_lab_category: el grupo es una CATEGORÍA DE LABORATORIO.
--      Un proveedor es laboratorio si está en al menos una categoría de
--      laboratorio activa (se asignan en su ficha, como cualquier grupo).
--   2. service_catalog.lab_category_id (opcional): la categoría de
--      laboratorio que hace ese trabajo. La escribe /services/lab-work.
--   3. v_lab_orders.lab_category_ids (al final): categorías de los servicios
--      de la orden (las que tienen). El frontend filtra el selector por la
--      categoría solo si hay exactamente una.
--   4. lab_categories_list() y lab_laboratories_search(f): opciones del
--      selector de laboratorio (solo laboratorios; con category_id, solo los
--      de esa categoría). Cada laboratorio trae sus categorías.
--   5. lab_order_change_stage(…, p_laboratory_id): se puede elegir el
--      laboratorio en el mismo cambio de etapa. Moverla a una etapa NO final
--      sin laboratorio falla con LAB_ORDERS:LABORATORY_REQUIRED (el frontend
--      abre el selector antes). A una etapa final no se exige.
--
-- Despliegue (misma ventana, en este orden):
--   1. Este script.
--   2. Reimportar "Lab Orders" (change-stage manda laboratory_id + endpoints
--      GET /lab-orders/laboratories y GET /lab-orders/lab-categories),
--      "Grupos proveedor" (is_lab_category) y "Patient Portal — Public
--      Bookable Services" (/services/lab-work guarda lab_category_id).
--   3. Publicar el frontend.
--   Después: marcar las categorías en Configuración → Grupos de proveedores y
--   asignarlas a cada laboratorio. Hasta entonces el selector no muestra
--   ningún laboratorio.
-- =====================================================================

BEGIN;

-- ─── 1. Categorías de laboratorio = grupos de proveedores marcados ───────────

ALTER TABLE public.groups_prov
    ADD COLUMN IF NOT EXISTS is_lab_category boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.groups_prov.is_lab_category IS
    'El grupo es una categoría de laboratorio: sus proveedores aparecen en el selector de laboratorio de las órdenes de laboratorio.';

CREATE INDEX IF NOT EXISTS group_provider_provider_idx ON public.group_provider (provider_id);

-- ─── 2. Categoría de cada trabajo de laboratorio ─────────────────────────────

ALTER TABLE public.service_catalog
    ADD COLUMN IF NOT EXISTS lab_category_id uuid REFERENCES public.groups_prov(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.service_catalog.lab_category_id IS
    'Trabajo de laboratorio (is_lab): categoría de laboratorio que lo hace. Opcional; filtra el selector de laboratorio de la orden.';

-- ─── 3. Vista: categorías que pide la orden ──────────────────────────────────
-- Igual que en el script 169, más lab_category_ids al final.

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
       COALESCE(it.lab_category_ids, '{}'::uuid[]) AS lab_category_ids
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
    'Órdenes de laboratorio con nombres, etapa actual, días en la etapa, atraso (is_overdue = is_stage_overdue OR is_past_due, nunca en etapa final), servicios (items), work_summary y lab_category_ids (categorías de laboratorio de sus servicios).';

-- ─── 4. Opciones del selector de laboratorio ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.lab_categories_list()
RETURNS TABLE (id uuid, name text, description text, laboratories_count integer)
LANGUAGE sql
STABLE
AS $$
    SELECT g.id, g.name, g.description,
           (SELECT count(*)::integer
            FROM public.group_provider gp
            JOIN public.users u ON u.id = gp.provider_id AND COALESCE(u.is_active, true)
            WHERE gp.group_id = g.id) AS laboratories_count
    FROM public.groups_prov g
    WHERE g.is_lab_category AND COALESCE(g.is_active, true)
    ORDER BY lower(g.name);
$$;

COMMENT ON FUNCTION public.lab_categories_list() IS
    'Categorías de laboratorio activas (grupos de proveedores con is_lab_category) y cuántos laboratorios activos tiene cada una.';

-- f: { search?, category_id?, limit? (default 50, máx. 200) }
CREATE OR REPLACE FUNCTION public.lab_laboratories_search(f jsonb)
RETURNS TABLE (id uuid, name text, phone_number text, email text, categories jsonb)
LANGUAGE sql
STABLE
AS $$
    WITH params AS (
        SELECT NULLIF(btrim(f->>'search'), '')            AS search,
               NULLIF(f->>'category_id', '')::uuid        AS category_id,
               LEAST(GREATEST(COALESCE(NULLIF(f->>'limit', '')::integer, 50), 1), 200) AS lim
    ),
    labs AS (
        SELECT u.id, u.name, u.phone_number, u.email,
               jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name) ORDER BY lower(g.name)) AS categories,
               bool_or(g.id = x.category_id) AS in_category
        FROM params x
        JOIN public.group_provider gp ON true
        JOIN public.groups_prov g ON g.id = gp.group_id AND g.is_lab_category AND COALESCE(g.is_active, true)
        JOIN public.users u ON u.id = gp.provider_id
        WHERE COALESCE(u.is_active, true)
          AND u.is_sales IS FALSE
          AND (x.search IS NULL OR unaccent(u.name) ILIKE unaccent('%' || x.search || '%'))
        GROUP BY u.id, u.name, u.phone_number, u.email
    )
    SELECT l.id, l.name, l.phone_number::text, l.email::text, l.categories
    FROM labs l, params x
    WHERE x.category_id IS NULL OR l.in_category
    ORDER BY lower(l.name)
    LIMIT (SELECT lim FROM params);
$$;

COMMENT ON FUNCTION public.lab_laboratories_search(jsonb) IS
    'Laboratorios (proveedores activos en alguna categoría de laboratorio) para el selector de la orden; con category_id, solo los de esa categoría.';

-- ─── 5. Cambio de etapa con laboratorio ──────────────────────────────────────
-- La versión de 5 argumentos se reemplaza (con el default convivirían dos
-- funciones y la llamada de 5 argumentos sería ambigua).

DROP FUNCTION IF EXISTS public.lab_order_change_stage(integer, integer, uuid, integer, text);

CREATE OR REPLACE FUNCTION public.lab_order_change_stage(
    p_order_id integer,
    p_to_stage_id integer,
    p_user_id uuid,
    p_expected_from integer DEFAULT NULL,
    p_note text DEFAULT NULL,
    p_laboratory_id uuid DEFAULT NULL
)
RETURNS SETOF public.v_lab_orders
LANGUAGE plpgsql
AS $$
#variable_conflict use_column
DECLARE
    v_from     integer;
    v_lab      uuid;
    v_to_kind  text;
BEGIN
    SELECT o.current_stage_id, o.laboratory_id INTO v_from, v_lab
    FROM public.lab_orders o
    WHERE o.id = p_order_id AND NOT o.is_deleted
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'LAB_ORDERS:NOT_FOUND'; END IF;

    IF p_expected_from IS NOT NULL AND p_expected_from <> v_from THEN
        RAISE EXCEPTION 'LAB_ORDERS:STAGE_CONFLICT';
    END IF;

    SELECT s.kind INTO v_to_kind FROM public.lab_stages s WHERE s.id = p_to_stage_id AND s.is_active;
    IF v_to_kind IS NULL THEN
        RAISE EXCEPTION 'LAB_ORDERS:INVALID_STAGE';
    END IF;

    IF p_laboratory_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_laboratory_id AND u.is_sales IS FALSE) THEN
            RAISE EXCEPTION 'LAB_ORDERS:INVALID_LABORATORY';
        END IF;
        v_lab := p_laboratory_id;
    END IF;

    IF v_from <> p_to_stage_id THEN
        -- Se envía a algún lado: hay que saber a qué laboratorio. Una etapa
        -- final (completada, cancelada) no lo exige.
        IF v_lab IS NULL AND v_to_kind <> 'final' THEN
            RAISE EXCEPTION 'LAB_ORDERS:LABORATORY_REQUIRED';
        END IF;

        INSERT INTO public.lab_order_stage_history (lab_order_id, from_stage_id, to_stage_id, changed_by, note)
        VALUES (p_order_id, v_from, p_to_stage_id, p_user_id, NULLIF(btrim(p_note), ''));

        UPDATE public.lab_orders o
        SET current_stage_id = p_to_stage_id,
            stage_entered_at = now(),
            laboratory_id = v_lab,
            updated_at = now(),
            updated_by = p_user_id
        WHERE o.id = p_order_id;
    ELSIF p_laboratory_id IS NOT NULL THEN
        UPDATE public.lab_orders o
        SET laboratory_id = v_lab,
            updated_at = now(),
            updated_by = p_user_id
        WHERE o.id = p_order_id;
    END IF;

    RETURN QUERY SELECT * FROM public.v_lab_orders v WHERE v.id = p_order_id;
END;
$$;

COMMENT ON FUNCTION public.lab_order_change_stage(integer, integer, uuid, integer, text, uuid) IS
    'Cambia la etapa (con historial). p_laboratory_id asigna el laboratorio en la misma operación; a una etapa no final sin laboratorio → LAB_ORDERS:LABORATORY_REQUIRED.';

-- ─── Registro de migración ────────────────────────────────────────────────────

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '170_20261112_lab-categories.sql',
    'v1',
    'groups_prov.is_lab_category + service_catalog.lab_category_id + v_lab_orders.lab_category_ids + lab_categories_list / lab_laboratories_search + lab_order_change_stage con p_laboratory_id y LABORATORY_REQUIRED'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;
