-- =====================================================================
-- Órdenes de laboratorio — la fecha de entrega es el plazo de la etapa
-- en la que se fijó (reemplaza la alerta "Si se pasa la fecha de entrega")
-- Run on: dev / staging / prod
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- Requiere: 147–150 y 167–176.
-- =====================================================================
--
-- Problema: cada etapa tenía dos avisos de atraso que se pisaban:
--   · "por permanencia": más de overdue_days en la etapa;
--   · "si se pasa la fecha de entrega" (script 169).
-- Al enviar, el modal propone entrega = hoy + overdue_days de la etapa, así
-- que los dos salían el mismo día. Y la fecha seguía contando con la orden
-- ya en la clínica ("Recibido en clínica" marcada vencida).
--
-- Qué hace:
--   1. lab_orders.due_stage_id: la etapa en la que se fijó la fecha de
--      entrega. Lo mantiene un trigger (sin cambiar lab_order_save ni
--      lab_order_change_stage):
--        · se fija o cambia la fecha  → la etapa actual;
--        · se envía (sale de la inicial) → la etapa a la que llega;
--        · en la etapa inicial o sin fecha → NULL.
--      Al salir de esa etapa la fecha deja de contar; si la orden vuelve a
--      ella, vuelve a contar (por eso el frontend pide una fecha nueva).
--   2. v_lab_orders: en la etapa de la fecha (due_applies) el atraso es la
--      fecha de entrega (is_past_due); en las demás, los días de la etapa
--      (is_stage_overdue). Columnas nuevas al final: due_stage_id, due_applies.
--   3. Un solo aviso de atraso por etapa ("por permanencia"): en la etapa de
--      la fecha sale al día siguiente de la fecha, con el texto de "entrega
--      vencida"; en las demás, pasados los días de la etapa.
--      occurrence_key = 'dwell:<historial>:due<AAAAMMDD>:<k>' con fecha, así
--      correr la fecha da un aviso nuevo. Cambiar la fecha cierra el aviso
--      pendiente.
--   4. Se eliminan las alertas 'due' de las etapas y la regla
--      LAB_ORDER_PAST_DUE queda inactiva (sus avisos pendientes se cierran).
--
-- Despliegue: este script y publicar el frontend en la misma ventana. No
-- hay flujos para reimportar ("Lab Stages", "Lab Orders" y el Alert
-- Scheduler llaman a las mismas funciones; lab_stage_alert_on_enter ya no
-- crea avisos de entrega vencida porque la regla está inactiva).
-- =====================================================================

BEGIN;

-- ─── 1. Etapa de la fecha de entrega ─────────────────────────────────────────

ALTER TABLE public.lab_orders
    ADD COLUMN IF NOT EXISTS due_stage_id integer REFERENCES public.lab_stages(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.lab_orders.due_stage_id IS
    'Etapa en la que se fijó due_date: mientras la orden está en ella, el atraso es la fecha de entrega (no overdue_days). Lo mantiene el trigger lab_order_due_stage.';

-- Órdenes existentes: la etapa a la que se enviaron por última vez.
UPDATE public.lab_orders o
SET due_stage_id = (
    SELECT h.to_stage_id
    FROM public.lab_order_stage_history h
    JOIN public.lab_stages fs ON fs.id = h.from_stage_id
    WHERE h.lab_order_id = o.id AND fs.kind = 'initial'
    ORDER BY h.id DESC
    LIMIT 1)
WHERE o.due_date IS NOT NULL AND o.due_stage_id IS NULL;

CREATE OR REPLACE FUNCTION public.lab_order_due_stage()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_kind     text;
    v_old_kind text;
BEGIN
    SELECT s.kind INTO v_kind FROM public.lab_stages s WHERE s.id = NEW.current_stage_id;

    IF NEW.due_date IS NULL OR v_kind = 'initial' THEN
        -- Sin fecha, o todavía sin enviar: la fecha no es plazo de ninguna etapa.
        NEW.due_stage_id := NULL;
    ELSIF TG_OP = 'INSERT' THEN
        NEW.due_stage_id := NEW.current_stage_id;
    ELSIF NEW.due_date IS DISTINCT FROM OLD.due_date THEN
        -- Fecha nueva (al enviar, al volver al laboratorio o editando): vale en la etapa actual.
        NEW.due_stage_id := NEW.current_stage_id;
    ELSIF NEW.current_stage_id IS DISTINCT FROM OLD.current_stage_id THEN
        SELECT s.kind INTO v_old_kind FROM public.lab_stages s WHERE s.id = OLD.current_stage_id;
        -- Enviar con la fecha que ya tenía: vale en la etapa a la que llega.
        IF v_old_kind = 'initial' THEN
            NEW.due_stage_id := NEW.current_stage_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lab_order_due_stage ON public.lab_orders;
CREATE TRIGGER lab_order_due_stage
    BEFORE INSERT OR UPDATE OF due_date, current_stage_id ON public.lab_orders
    FOR EACH ROW EXECUTE FUNCTION public.lab_order_due_stage();

-- ─── 2. Vista ────────────────────────────────────────────────────────────────
-- Igual que en el script 173; cambian is_overdue / is_stage_overdue /
-- is_past_due / days_past_due y se agregan columnas al final.

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
        AND ((NOT dl.due_applies AND s.overdue_days IS NOT NULL
              AND now() - o.stage_entered_at > make_interval(days => s.overdue_days))
             OR (dl.due_applies AND o.due_date < (now() AT TIME ZONE 'America/Montevideo')::date))) AS is_overdue,
       o.created_at,
       o.created_by,
       c.name                 AS created_by_name,
       o.updated_at,
       COALESCE(it.items, '[]'::jsonb) AS items,
       COALESCE(it.summary, o.work_description) AS work_summary,
       (s.kind <> 'final'
        AND NOT dl.due_applies
        AND s.overdue_days IS NOT NULL
        AND now() - o.stage_entered_at > make_interval(days => s.overdue_days)) AS is_stage_overdue,
       (dl.due_applies
        AND o.due_date < (now() AT TIME ZONE 'America/Montevideo')::date) AS is_past_due,
       CASE WHEN dl.due_applies
                 AND o.due_date < (now() AT TIME ZONE 'America/Montevideo')::date
            THEN (now() AT TIME ZONE 'America/Montevideo')::date - o.due_date
            ELSE 0
       END AS days_past_due,
       COALESCE(it.lab_category_ids, '{}'::uuid[]) AS lab_category_ids,
       o.is_urgent,
       (SELECT count(*)::integer
        FROM public.attachments a
        WHERE a.source_name = 'lab_order' AND a.source_id = o.id::text) AS attachments_count,
       -- Sobrante de un script 177 anterior que se revirtió en DEV: la columna no se puede
       -- quitar sin DROP VIEW (lab_order_save / lab_order_change_stage dependen de la vista).
       false                  AS stage_at_laboratory,
       o.due_stage_id,
       dl.due_applies
FROM public.lab_orders o
JOIN public.lab_stages s ON s.id = o.current_stage_id
CROSS JOIN LATERAL (
    SELECT (s.kind <> 'final' AND o.due_date IS NOT NULL AND o.due_stage_id = o.current_stage_id) AS due_applies
) dl
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
    'Órdenes de laboratorio con nombres, etapa actual, días en la etapa, atraso (is_overdue = is_stage_overdue OR is_past_due: en la etapa donde se fijó la fecha de entrega cuenta la fecha, en las demás los días de la etapa), servicios (items), work_summary, lab_category_ids, is_urgent, attachments_count, due_stage_id y due_applies.';

-- ─── 3. Sin alerta "entrega vencida" por etapa ───────────────────────────────

DELETE FROM public.lab_stage_alerts a WHERE a.trigger = 'due';

ALTER TABLE public.lab_stage_alerts DROP CONSTRAINT IF EXISTS lab_stage_alerts_trigger_chk;
ALTER TABLE public.lab_stage_alerts
    ADD CONSTRAINT lab_stage_alerts_trigger_chk CHECK (trigger IN ('enter', 'dwell'));

ALTER TABLE public.lab_stage_alerts DROP CONSTRAINT IF EXISTS lab_stage_alerts_repeat_chk;
ALTER TABLE public.lab_stage_alerts
    ADD CONSTRAINT lab_stage_alerts_repeat_chk
    CHECK (repeat_every_days IS NULL OR (trigger = 'dwell' AND repeat_every_days > 0));

COMMENT ON TABLE public.lab_stage_alerts IS
    'Alertas de cada etapa de laboratorio: al entrar (enter) o por atraso (dwell): más de lab_stages.overdue_days en la etapa o, en la etapa donde se fijó la fecha de entrega, pasada esa fecha.';

-- Listar sin 'due' (como en el script 150).
CREATE OR REPLACE FUNCTION public.lab_stage_alerts_json(p_stage_id integer)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
    SELECT jsonb_build_object(
        'enter', (SELECT to_jsonb(a) - 'id' - 'stage_id' - 'trigger' - 'created_at' - 'updated_at'
                  FROM public.lab_stage_alerts a WHERE a.stage_id = p_stage_id AND a.trigger = 'enter'),
        'dwell', (SELECT to_jsonb(a) - 'id' - 'stage_id' - 'trigger' - 'created_at' - 'updated_at'
                  FROM public.lab_stage_alerts a WHERE a.stage_id = p_stage_id AND a.trigger = 'dwell')
    );
$$;

-- Igual que en el script 169, sin la alerta 'due'.
CREATE OR REPLACE FUNCTION public.lab_stages_save(p_stages jsonb, p_user_id uuid)
RETURNS TABLE (
    id integer, name text, color text, sort_order integer, kind text,
    overdue_days integer, is_active boolean, orders_count integer, in_use boolean, alerts jsonb
)
LANGUAGE plpgsql
AS $$
#variable_conflict use_column
DECLARE
    v_item       jsonb;
    v_pos        integer := 0;
    v_id         integer;
    v_name       text;
    v_kind       text;
    v_overdue    integer;
    v_active     boolean;
    v_move_to    integer;
    v_kept       integer[] := ARRAY[]::integer[];
    v_moves      jsonb := '[]'::jsonb;
    v_move       jsonb;
    v_orders     integer;
    v_count      integer;
BEGIN
    IF p_stages IS NULL OR jsonb_typeof(p_stages) <> 'array' THEN
        RAISE EXCEPTION 'LAB_STAGES:NO_INITIAL';
    END IF;

    FOR v_item IN SELECT value FROM jsonb_array_elements(p_stages) LOOP
        v_name := btrim(COALESCE(v_item->>'name', ''));
        v_kind := COALESCE(v_item->>'kind', '');
        v_overdue := NULLIF(v_item->>'overdue_days', '')::integer;
        IF v_name = '' THEN
            RAISE EXCEPTION 'LAB_STAGES:EMPTY_NAME';
        END IF;
        IF v_kind NOT IN ('initial', 'intermediate', 'final') THEN
            RAISE EXCEPTION 'LAB_STAGES:INVALID_KIND|%', v_name;
        END IF;
        IF v_overdue IS NOT NULL AND (v_overdue <= 0 OR v_kind = 'final') THEN
            RAISE EXCEPTION 'LAB_STAGES:INVALID_OVERDUE|%', v_name;
        END IF;
        IF v_kind = 'initial' AND NOT COALESCE((v_item->>'is_active')::boolean, true) THEN
            RAISE EXCEPTION 'LAB_STAGES:INITIAL_INACTIVE|%', v_name;
        END IF;
        IF NULLIF(v_item->>'id', '') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM public.lab_stages s WHERE s.id = (v_item->>'id')::integer) THEN
            RAISE EXCEPTION 'LAB_STAGES:UNKNOWN_STAGE|%', v_name;
        END IF;
    END LOOP;

    SELECT count(*) INTO v_count
    FROM jsonb_array_elements(p_stages) e
    WHERE e.value->>'kind' = 'initial' AND COALESCE((e.value->>'is_active')::boolean, true);
    IF v_count = 0 THEN RAISE EXCEPTION 'LAB_STAGES:NO_INITIAL'; END IF;
    IF v_count > 1 THEN RAISE EXCEPTION 'LAB_STAGES:MANY_INITIAL'; END IF;

    SELECT count(*) INTO v_count
    FROM jsonb_array_elements(p_stages) e
    WHERE e.value->>'kind' = 'final' AND COALESCE((e.value->>'is_active')::boolean, true);
    IF v_count = 0 THEN RAISE EXCEPTION 'LAB_STAGES:NO_FINAL'; END IF;

    SELECT min(btrim(e.value->>'name')) INTO v_name
    FROM jsonb_array_elements(p_stages) e
    WHERE COALESCE((e.value->>'is_active')::boolean, true)
    GROUP BY lower(btrim(e.value->>'name'))
    HAVING count(*) > 1
    LIMIT 1;
    IF v_name IS NOT NULL THEN RAISE EXCEPTION 'LAB_STAGES:DUPLICATE_NAME|%', v_name; END IF;

    SELECT s.name INTO v_name
    FROM public.lab_stages s
    WHERE s.id NOT IN (
        SELECT (e.value->>'id')::integer FROM jsonb_array_elements(p_stages) e
        WHERE NULLIF(e.value->>'id', '') IS NOT NULL
    )
      AND (EXISTS (SELECT 1 FROM public.lab_orders o WHERE o.current_stage_id = s.id)
           OR EXISTS (SELECT 1 FROM public.lab_order_stage_history h
                      WHERE h.to_stage_id = s.id OR h.from_stage_id = s.id))
    LIMIT 1;
    IF v_name IS NOT NULL THEN RAISE EXCEPTION 'LAB_STAGES:STAGE_IN_USE|%', v_name; END IF;

    UPDATE public.lab_stages s SET is_active = false
    WHERE s.is_active;

    FOR v_item IN SELECT value FROM jsonb_array_elements(p_stages) LOOP
        v_pos := v_pos + 1;
        v_id := NULLIF(v_item->>'id', '')::integer;
        v_name := btrim(v_item->>'name');
        v_kind := v_item->>'kind';
        v_overdue := NULLIF(v_item->>'overdue_days', '')::integer;
        v_active := COALESCE((v_item->>'is_active')::boolean, true);
        v_move_to := NULLIF(v_item->>'move_orders_to', '')::integer;

        IF v_id IS NULL THEN
            INSERT INTO public.lab_stages (name, color, sort_order, kind, overdue_days, is_active, created_by, updated_by)
            VALUES (v_name, COALESCE(NULLIF(v_item->>'color', ''), '#64748b'), v_pos, v_kind, v_overdue, v_active, p_user_id, p_user_id)
            RETURNING lab_stages.id INTO v_id;
        ELSE
            UPDATE public.lab_stages s
            SET name = v_name,
                color = COALESCE(NULLIF(v_item->>'color', ''), s.color),
                sort_order = v_pos,
                kind = v_kind,
                overdue_days = v_overdue,
                is_active = v_active,
                updated_at = now(),
                updated_by = p_user_id
            WHERE s.id = v_id;
        END IF;
        v_kept := v_kept || v_id;

        IF v_item ? 'alerts' THEN
            PERFORM public.lab_stage_alert_upsert(v_id, v_name, 'enter', v_item->'alerts'->'enter', v_overdue IS NOT NULL);
            -- Una etapa final no tiene atraso: su alerta por permanencia se
            -- descarta. alerts.due (frontend anterior al script 177) se ignora.
            PERFORM public.lab_stage_alert_upsert(
                v_id, v_name, 'dwell',
                CASE WHEN v_kind = 'final' THEN NULL ELSE v_item->'alerts'->'dwell' END,
                v_overdue IS NOT NULL);
        ELSIF v_kind = 'final' OR v_overdue IS NULL THEN
            DELETE FROM public.lab_stage_alerts a
            WHERE a.stage_id = v_id AND a.trigger = 'dwell';
        END IF;

        IF NOT v_active THEN
            SELECT count(*) INTO v_orders
            FROM public.lab_orders o
            WHERE o.current_stage_id = v_id AND NOT o.is_deleted;
            IF v_orders > 0 THEN
                IF v_move_to IS NULL THEN
                    RAISE EXCEPTION 'LAB_STAGES:STAGE_HAS_ORDERS|%', v_name;
                END IF;
                v_moves := v_moves || jsonb_build_object('from', v_id, 'to', v_move_to, 'name', v_name);
            END IF;
        END IF;
    END LOOP;

    DELETE FROM public.lab_stages s WHERE NOT (s.id = ANY (v_kept));

    FOR v_move IN SELECT value FROM jsonb_array_elements(v_moves) LOOP
        IF NOT EXISTS (SELECT 1 FROM public.lab_stages s
                       WHERE s.id = (v_move->>'to')::integer AND s.is_active) THEN
            RAISE EXCEPTION 'LAB_STAGES:INVALID_MOVE_TARGET|%', v_move->>'name';
        END IF;

        INSERT INTO public.lab_order_stage_history (lab_order_id, from_stage_id, to_stage_id, changed_by, note)
        SELECT o.id, o.current_stage_id, (v_move->>'to')::integer, p_user_id, 'stage_deactivated'
        FROM public.lab_orders o
        WHERE o.current_stage_id = (v_move->>'from')::integer AND NOT o.is_deleted;

        UPDATE public.lab_orders o
        SET current_stage_id = (v_move->>'to')::integer,
            stage_entered_at = now(),
            updated_at = now(),
            updated_by = p_user_id
        WHERE o.current_stage_id = (v_move->>'from')::integer AND NOT o.is_deleted;
    END LOOP;

    RETURN QUERY SELECT * FROM public.lab_stages_list();
END;
$$;

-- ─── 4. Aviso de atraso: días de la etapa o fecha de entrega ───────────────
-- Igual que en el script 168, más la fecha de entrega en su etapa.
CREATE OR REPLACE FUNCTION public.alert_gen_lab_stage_overdue(p_target_date date, p_rule_id integer)
RETURNS TABLE (
    rule_id integer, reference_table text, reference_id text, user_id uuid, alert_date date,
    occurrence_key text, event_date timestamp, occurrence_mode text, title text, priority text,
    description text, details_json jsonb
)
LANGUAGE sql
STABLE
AS $$
    WITH at_t AS (
        SELECT (p_target_date::timestamp AT TIME ZONE 'America/Montevideo') AS ts
    ),
    due AS (
        SELECT a AS alert, o.id AS order_id, o.due_date, by_due.v AS by_due,
               (SELECT max(h.id) FROM public.lab_order_stage_history h
                WHERE h.lab_order_id = o.id AND h.to_stage_id = o.current_stage_id) AS hist_id,
               CASE WHEN a.repeat_every_days IS NULL THEN 0
                    WHEN by_due.v THEN (p_target_date - o.due_date - 1) / a.repeat_every_days
                    ELSE floor(extract(epoch FROM (at_t.ts - o.stage_entered_at - make_interval(days => s.overdue_days)))
                               / (86400 * a.repeat_every_days))::integer
               END AS k
        FROM public.lab_stage_alerts a
        JOIN public.lab_stages s ON s.id = a.stage_id AND s.is_active AND s.kind <> 'final'
        JOIN public.lab_orders o ON o.current_stage_id = s.id AND NOT o.is_deleted
        CROSS JOIN at_t
        -- En la etapa donde se fijó la fecha de entrega, el plazo es esa fecha.
        CROSS JOIN LATERAL (SELECT (o.due_date IS NOT NULL AND o.due_stage_id = o.current_stage_id) AS v) by_due
        WHERE a.trigger = 'dwell'
          AND CASE WHEN by_due.v THEN o.due_date < p_target_date
                   ELSE s.overdue_days IS NOT NULL
                        AND at_t.ts - o.stage_entered_at > make_interval(days => s.overdue_days)
              END
    ),
    due_rows AS (
        -- Con fecha de entrega, la fecha va en la clave: si se corre la fecha y
        -- vuelve a vencer, sale una alerta nueva.
        SELECT d.*,
               'dwell:' || COALESCE(d.hist_id, 0) || ':'
                   || CASE WHEN d.by_due THEN 'due' || to_char(d.due_date, 'YYYYMMDD') || ':' ELSE '' END
                   || d.k AS occ,
               to_jsonb(v) AS j,
               -- El texto (título, resumen, aviso) es el de "entrega vencida".
               CASE WHEN d.by_due THEN jsonb_populate_record(d.alert, '{"trigger": "due"}'::jsonb) ELSE d.alert END AS content_alert
        FROM due d
        JOIN public.v_lab_orders v ON v.id = d.order_id
    )
    SELECT p_rule_id,
           'lab_orders'::text,
           r.order_id::text,
           (r.j->>'patient_id')::uuid,
           p_target_date,
           r.occ,
           CASE WHEN r.by_due THEN r.due_date::timestamp
                ELSE (r.j->>'stage_entered_at')::timestamptz AT TIME ZONE 'UTC' END,
           'event'::text,
           c->>'title',
           c->>'priority',
           c->>'summary',
           jsonb_build_object('data', r.j, 'trigger', CASE WHEN r.by_due THEN 'due' ELSE 'dwell' END,
                              'staff_dispatch', c->'staff_dispatch')
    FROM due_rows r
    CROSS JOIN LATERAL public.lab_stage_alert_content(r.content_alert, r.j) AS c
    WHERE NOT EXISTS (
        SELECT 1 FROM public.alert_instances ai
        WHERE ai.rule_id = p_rule_id
          AND ai.reference_table = 'lab_orders'
          AND ai.reference_id = r.order_id::text
          AND ai.occurrence_key = r.occ);
$$;

COMMENT ON FUNCTION public.alert_gen_lab_stage_overdue(date, integer) IS
    'Generador de la regla LAB_STAGE_OVERDUE (Alert Scheduler): órdenes atrasadas en su etapa (más de overdue_days o, en la etapa donde se fijó la fecha de entrega, pasada esa fecha) con alerta "por permanencia" configurada.';

-- Igual que en el script 174; cambiar la fecha de entrega cierra el aviso de atraso pendiente.
CREATE OR REPLACE FUNCTION public.lab_order_alerts_resolve()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    v_deleted     boolean := NEW.is_deleted AND NOT OLD.is_deleted;
    v_moved       boolean := NEW.current_stage_id IS DISTINCT FROM OLD.current_stage_id;
    v_due_changed boolean := NEW.due_date IS DISTINCT FROM OLD.due_date;
    v_now_final   boolean;
    v_codes       text[] := ARRAY[]::text[];
BEGIN
    IF NOT (v_deleted OR v_moved OR v_due_changed) THEN
        RETURN NEW;
    END IF;

    SELECT s.kind = 'final' INTO v_now_final FROM public.lab_stages s WHERE s.id = NEW.current_stage_id;

    IF v_deleted OR v_moved THEN
        v_codes := array_append(v_codes, 'LAB_STAGE_OVERDUE');
        v_codes := array_append(v_codes, 'LAB_ORDER_READY');
    ELSIF v_due_changed THEN
        -- Se corrió la fecha de entrega: el aviso de atraso por la fecha anterior ya no vale.
        v_codes := array_append(v_codes, 'LAB_STAGE_OVERDUE');
    END IF;
    IF v_deleted OR v_due_changed OR (v_moved AND COALESCE(v_now_final, false)) THEN
        v_codes := array_append(v_codes, 'LAB_ORDER_PAST_DUE');
    END IF;
    IF v_deleted THEN
        v_codes := array_append(v_codes, 'LAB_STAGE_ENTERED');
    END IF;

    UPDATE public.alert_instances ai
    SET status = 'SUPPRESSED',
        notes = concat_ws(E'\n', NULLIF(ai.notes, ''),
                          CASE WHEN v_deleted THEN 'Cerrada: se eliminó la orden de laboratorio.'
                               WHEN v_moved AND r.code IN ('LAB_STAGE_OVERDUE', 'LAB_ORDER_READY') THEN 'Cerrada: la orden cambió de etapa.'
                               WHEN v_due_changed THEN 'Cerrada: cambió la fecha de entrega.'
                               ELSE 'Cerrada: la orden llegó a una etapa final.' END),
        updated_at = now()
    FROM public.alert_rules r
    WHERE r.id = ai.rule_id
      AND r.code = ANY (v_codes)
      AND ai.reference_table = 'lab_orders'
      AND ai.reference_id = NEW.id::text
      AND ai.status IN ('PENDING', 'SNOOZED');

    RETURN NEW;
END;
$function$;

-- ─── 5. Regla LAB_ORDER_PAST_DUE: inactiva ───────────────────────────────────

SET LOCAL invokeia.managed_alert_rules = 'on';

UPDATE public.alert_instances ai
SET status = 'SUPPRESSED',
    notes = concat_ws(E'\n', NULLIF(ai.notes, ''),
                      'Cerrada (script 177): la entrega vencida ahora la avisa el atraso de la etapa.'),
    updated_at = now()
FROM public.alert_rules r
WHERE r.id = ai.rule_id
  AND r.code = 'LAB_ORDER_PAST_DUE'
  AND ai.status IN ('PENDING', 'SNOOZED');

UPDATE public.alert_rules
SET is_active = false,
    description = 'Reemplazada (script 177): la entrega vencida la avisa la alerta "por permanencia" de la etapa en la que se fijó la fecha. No reactivar.'
WHERE code = 'LAB_ORDER_PAST_DUE';

UPDATE public.alert_categories
SET description = 'Órdenes de laboratorio: avisos al entrar a una etapa y por atraso (días en la etapa o fecha de entrega)'
WHERE code = 'LAB_ORDERS';

-- ─── Registro de migración ────────────────────────────────────────────────────

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '177_20261119_lab-orders-due-date-per-stage.sql',
    'v1',
    'lab_orders.due_stage_id (trigger lab_order_due_stage) + v_lab_orders: la fecha de entrega es el plazo de la etapa donde se fijó (due_applies) + el aviso por permanencia cubre la entrega vencida + sin alertas due por etapa, regla LAB_ORDER_PAST_DUE inactiva'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;
