-- =====================================================================
-- Órdenes de laboratorio — fecha de entrega al enviar + datos del laboratorio
-- Run on: dev / staging / prod
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- Requiere: 147–150, 167, 169 y 170 (categorías de laboratorio).
-- =====================================================================
--
-- 1. Fecha de entrega al ENVIAR la orden (no al crearla).
--    La fecha la promete el laboratorio cuando recibe el trabajo; al crear la
--    orden todavía no se sabe. "Enviar" no es una etapa nueva ni un flag: es
--    salir de la etapa INICIAL hacia una etapa no final (el mismo momento en
--    que, desde el script 170, se exige el laboratorio).
--      - lab_order_change_stage(…, p_due_date date): al enviar, la fecha es
--        obligatoria: p_due_date o la que ya tenga la orden; sin ninguna →
--        LAB_ORDERS:DUE_DATE_REQUIRED. p_due_date anterior a hoy
--        (America/Montevideo) → LAB_ORDERS:INVALID_DUE_DATE. En cualquier otro
--        movimiento p_due_date es opcional y, si llega, también se guarda.
--      - lab_order_save: el ALTA ya no guarda due_date (se ignora si llega).
--        En la EDICIÓN la fecha solo cambia si la clave due_date viene en el
--        body (sin la clave queda la guardada) y una orden ya enviada y
--        pendiente no puede quedar sin fecha (DUE_DATE_REQUIRED).
--    Las órdenes que ya tienen fecha no cambian; al enviarlas, el modal la
--    muestra precargada para confirmarla.
--
-- 2. Datos del laboratorio en el detalle. lab_order_detail(id) suma la clave
--    `laboratory` (null si la orden no tiene laboratorio) con lo que ya guarda
--    la ficha del proveedor (users):
--      { id, name, phone_number, alternative_phone, email, address, rut,
--        categories: [{ id, name }] }   -- categorías de laboratorio (170)
--
-- Despliegue (misma ventana, en este orden):
--   1. Este script.
--   2. Reimportar "Lab Orders" (docs/n8n-flows/flow-lab-orders.json):
--      change-stage pasa due_date como 7.º argumento. Sin reimportar, enviar
--      una orden sin fecha falla con DUE_DATE_REQUIRED.
--   3. Publicar el frontend.
-- =====================================================================

BEGIN;

-- ─── 1a. Cambio de etapa con fecha de entrega ────────────────────────────────
-- La versión de 6 argumentos se reemplaza (con el default convivirían dos
-- funciones y la llamada de 6 argumentos sería ambigua).

DROP FUNCTION IF EXISTS public.lab_order_change_stage(integer, integer, uuid, integer, text, uuid);

CREATE OR REPLACE FUNCTION public.lab_order_change_stage(
    p_order_id integer,
    p_to_stage_id integer,
    p_user_id uuid,
    p_expected_from integer DEFAULT NULL,
    p_note text DEFAULT NULL,
    p_laboratory_id uuid DEFAULT NULL,
    p_due_date date DEFAULT NULL
)
RETURNS SETOF public.v_lab_orders
LANGUAGE plpgsql
AS $$
#variable_conflict use_column
DECLARE
    v_from       integer;
    v_from_kind  text;
    v_lab        uuid;
    v_due        date;
    v_to_kind    text;
    v_sending    boolean;
BEGIN
    SELECT o.current_stage_id, o.laboratory_id, o.due_date INTO v_from, v_lab, v_due
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
    SELECT s.kind INTO v_from_kind FROM public.lab_stages s WHERE s.id = v_from;

    IF p_laboratory_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_laboratory_id AND u.is_sales IS FALSE) THEN
            RAISE EXCEPTION 'LAB_ORDERS:INVALID_LABORATORY';
        END IF;
        v_lab := p_laboratory_id;
    END IF;

    IF p_due_date IS NOT NULL THEN
        IF p_due_date < (now() AT TIME ZONE 'America/Montevideo')::date THEN
            RAISE EXCEPTION 'LAB_ORDERS:INVALID_DUE_DATE';
        END IF;
        v_due := p_due_date;
    END IF;

    -- Enviar = salir de la etapa inicial hacia una no final.
    v_sending := v_from <> p_to_stage_id AND v_from_kind = 'initial' AND v_to_kind NOT IN ('initial', 'final');

    IF v_from <> p_to_stage_id THEN
        -- Se envía a algún lado: hay que saber a qué laboratorio. Una etapa
        -- final (completada, cancelada) no lo exige.
        IF v_lab IS NULL AND v_to_kind <> 'final' THEN
            RAISE EXCEPTION 'LAB_ORDERS:LABORATORY_REQUIRED';
        END IF;
        IF v_sending AND v_due IS NULL THEN
            RAISE EXCEPTION 'LAB_ORDERS:DUE_DATE_REQUIRED';
        END IF;

        INSERT INTO public.lab_order_stage_history (lab_order_id, from_stage_id, to_stage_id, changed_by, note)
        VALUES (p_order_id, v_from, p_to_stage_id, p_user_id, NULLIF(btrim(p_note), ''));

        UPDATE public.lab_orders o
        SET current_stage_id = p_to_stage_id,
            stage_entered_at = now(),
            laboratory_id = v_lab,
            due_date = v_due,
            updated_at = now(),
            updated_by = p_user_id
        WHERE o.id = p_order_id;
    ELSIF p_laboratory_id IS NOT NULL OR p_due_date IS NOT NULL THEN
        UPDATE public.lab_orders o
        SET laboratory_id = v_lab,
            due_date = v_due,
            updated_at = now(),
            updated_by = p_user_id
        WHERE o.id = p_order_id;
    END IF;

    RETURN QUERY SELECT * FROM public.v_lab_orders v WHERE v.id = p_order_id;
END;
$$;

COMMENT ON FUNCTION public.lab_order_change_stage(integer, integer, uuid, integer, text, uuid, date) IS
    'Cambia la etapa (con historial). p_laboratory_id / p_due_date se guardan en la misma operación. A una etapa no final sin laboratorio → LABORATORY_REQUIRED; al enviar (inicial → no final) sin fecha → DUE_DATE_REQUIRED; fecha pasada → INVALID_DUE_DATE.';

-- ─── 1b. Alta sin fecha de entrega; la edición no la borra sin querer ───────
-- Igual que en el script 167 salvo due_date (alta: NULL; edición: solo si la
-- clave viene, y nunca vacía en una orden enviada y pendiente).

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
            patient_id, doctor_id, laboratory_id, work_description, teeth, notes,
            current_stage_id, stage_entered_at, created_by, updated_by)
        VALUES (
            v_patient, NULLIF(p->>'doctor_id', '')::uuid, NULLIF(p->>'laboratory_id', '')::uuid, v_work,
            v_teeth, NULLIF(btrim(p->>'notes'), ''),
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

-- ─── 2. Detalle con los datos del laboratorio ────────────────────────────────

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
    'Detalle de una orden de laboratorio: fila de v_lab_orders + history + laboratory (contacto y categorías del laboratorio asignado, o null).';

-- ─── Registro de migración ────────────────────────────────────────────────────

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '172_20261113_lab-orders-send-due-date.sql',
    'v1',
    'lab_order_change_stage con p_due_date (obligatoria al enviar: DUE_DATE_REQUIRED / INVALID_DUE_DATE) + lab_order_save sin fecha en el alta + lab_order_detail con laboratory (contacto y categorías)'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;
