-- =====================================================================
-- Órdenes de laboratorio — fecha en que PASÓ el cambio de etapa
-- Run on: dev / staging / prod
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- Requiere: 147–150, 167, 169, 170, 172, 173 y 175.
-- =====================================================================
--
-- "La orden 45 se envió ayer": el movimiento se registra hoy pero ocurrió
-- antes. Hasta ahora el cambio de etapa siempre quedaba con now(), así que
-- los días en la etapa, el atraso y la fecha de entrega propuesta contaban
-- desde que alguien se acordó de registrarlo.
--
-- 1. lab_order_stage_history.effective_at (timestamptz, NULL = changed_at):
--    cuándo pasó. changed_at sigue siendo cuándo se registró (y es la clave
--    con la que el frontend junta el movimiento con las ediciones del mismo
--    guardado, script 175). Solo se llena cuando el movimiento es retroactivo.
--
-- 2. lab_order_change_stage(…, p_effective_date date) — 8.º argumento:
--    - NULL o hoy (America/Montevideo) → now(), como siempre.
--    - Un día anterior → ese día a la hora actual (así "ayer" son 24 h y los
--      días en la etapa dan 1 todo el día de hoy).
--    - Futuro → LAB_ORDERS:INVALID_EFFECTIVE_DATE.
--    - Antes del día en que la orden entró a su etapa actual →
--      LAB_ORDERS:EFFECTIVE_DATE_BEFORE_STAGE. El mismo día pero a una hora
--      anterior se ajusta a la hora de entrada (no puede salir antes de entrar).
--    - stage_entered_at = la fecha efectiva: días en la etapa, atraso por
--      permanencia y alertas cuentan desde ahí.
--    - Fecha de entrega: no puede ser anterior al día EFECTIVO (antes: a hoy).
--      Una orden enviada hace días puede quedar con una entrega ya vencida:
--      queda atrasada y avisa, que es lo que pasó en la realidad.
--    - Si no cambia de etapa, p_effective_date se ignora.
--
-- 3. lab_order_detail: cada fila de `history` suma effective_at
--    (= COALESCE(effective_at, changed_at)) y se ordena por él.
--
-- Despliegue (misma ventana, en este orden):
--   1. Este script.
--   2. Reimportar "Lab Orders" (docs/n8n-flows/flow-lab-orders.json):
--      change-stage pasa effective_date como 8.º argumento. Sin reimportar,
--      la llamada de 7 argumentos sigue funcionando (8.º con default) pero la
--      fecha elegida se ignora y el movimiento queda con la hora actual.
--   3. Publicar el frontend.
-- =====================================================================

BEGIN;

-- ─── 1. Cuándo pasó ───────────────────────────────────────────────────────────

ALTER TABLE public.lab_order_stage_history ADD COLUMN IF NOT EXISTS effective_at timestamptz;

COMMENT ON COLUMN public.lab_order_stage_history.effective_at IS
    'Cuándo pasó el cambio, si se registró después (NULL = changed_at). changed_at es cuándo se registró.';

-- ─── 2. Cambio de etapa con fecha efectiva ───────────────────────────────────
-- La versión de 7 argumentos se reemplaza (con el default convivirían dos
-- funciones y la llamada de 7 argumentos sería ambigua).

DROP FUNCTION IF EXISTS public.lab_order_change_stage(integer, integer, uuid, integer, text, uuid, date);

CREATE OR REPLACE FUNCTION public.lab_order_change_stage(
    p_order_id integer,
    p_to_stage_id integer,
    p_user_id uuid,
    p_expected_from integer DEFAULT NULL,
    p_note text DEFAULT NULL,
    p_laboratory_id uuid DEFAULT NULL,
    p_due_date date DEFAULT NULL,
    p_effective_date date DEFAULT NULL
)
RETURNS SETOF public.v_lab_orders
LANGUAGE plpgsql
AS $$
#variable_conflict use_column
DECLARE
    v_from        integer;
    v_from_kind   text;
    v_entered     timestamptz;
    v_lab         uuid;
    v_due         date;
    v_to_kind     text;
    v_sending     boolean;
    v_today       date := (now() AT TIME ZONE 'America/Montevideo')::date;
    v_effective   timestamptz := now();
    v_backdated   boolean := false;
BEGIN
    SELECT o.current_stage_id, o.laboratory_id, o.due_date, o.stage_entered_at
      INTO v_from, v_lab, v_due, v_entered
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

    -- Cuándo pasó: solo cuenta si de verdad cambia de etapa.
    IF p_effective_date IS NOT NULL AND v_from <> p_to_stage_id THEN
        IF p_effective_date > v_today THEN
            RAISE EXCEPTION 'LAB_ORDERS:INVALID_EFFECTIVE_DATE';
        END IF;
        IF p_effective_date < (v_entered AT TIME ZONE 'America/Montevideo')::date THEN
            RAISE EXCEPTION 'LAB_ORDERS:EFFECTIVE_DATE_BEFORE_STAGE';
        END IF;
        IF p_effective_date < v_today THEN
            -- Ese día, a la hora de ahora; nunca antes de haber entrado a la etapa.
            v_effective := GREATEST(
                (p_effective_date + (now() AT TIME ZONE 'America/Montevideo')::time) AT TIME ZONE 'America/Montevideo',
                v_entered
            );
            v_backdated := true;
        END IF;
    END IF;

    IF p_laboratory_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_laboratory_id AND u.is_sales IS FALSE) THEN
            RAISE EXCEPTION 'LAB_ORDERS:INVALID_LABORATORY';
        END IF;
        v_lab := p_laboratory_id;
    END IF;

    IF p_due_date IS NOT NULL THEN
        -- La entrega no puede ser anterior al día en que se envió (hoy, si no es retroactivo).
        IF p_due_date < (v_effective AT TIME ZONE 'America/Montevideo')::date THEN
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

        INSERT INTO public.lab_order_stage_history (lab_order_id, from_stage_id, to_stage_id, changed_by, note, effective_at)
        VALUES (p_order_id, v_from, p_to_stage_id, p_user_id, NULLIF(btrim(p_note), ''),
                CASE WHEN v_backdated THEN v_effective END);

        UPDATE public.lab_orders o
        SET current_stage_id = p_to_stage_id,
            stage_entered_at = v_effective,
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

COMMENT ON FUNCTION public.lab_order_change_stage(integer, integer, uuid, integer, text, uuid, date, date) IS
    'Cambia la etapa (con historial). p_laboratory_id / p_due_date se guardan en la misma operación. p_effective_date: día en que pasó (retroactivo; futuro → INVALID_EFFECTIVE_DATE, antes de entrar a la etapa actual → EFFECTIVE_DATE_BEFORE_STAGE). A una etapa no final sin laboratorio → LABORATORY_REQUIRED; al enviar sin fecha → DUE_DATE_REQUIRED; entrega anterior al día efectivo → INVALID_DUE_DATE.';

-- ─── 3. lab_order_detail: history con effective_at ────────────────────────────
-- Igual que en el script 175 salvo effective_at en cada fila de history.

CREATE OR REPLACE FUNCTION public.lab_order_detail(p_order_id integer)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
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
                       'effective_at', COALESCE(h.effective_at, h.changed_at),
                       'note', h.note
                   ) ORDER BY COALESCE(h.effective_at, h.changed_at) DESC, h.id DESC)
            FROM public.lab_order_stage_history h
            LEFT JOIN public.lab_stages fs ON fs.id = h.from_stage_id
            JOIN public.lab_stages ts ON ts.id = h.to_stage_id
            LEFT JOIN public.users u ON u.id = h.changed_by
            WHERE h.lab_order_id = v.id
        ), '[]'::jsonb),
        'changes', public.lab_order_changes(v.id),
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
$function$;

-- ─── Registro de migración ────────────────────────────────────────────────────

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '176_20261117_lab-orders-effective-date.sql',
    'v1',
    'Órdenes de laboratorio: fecha efectiva del cambio de etapa (lab_order_stage_history.effective_at, 8.º argumento p_effective_date en lab_order_change_stage, stage_entered_at = fecha efectiva, entrega validada contra el día efectivo) y effective_at en el history de lab_order_detail'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;
