-- =====================================================================
-- Órdenes de laboratorio — atraso por fecha de entrega + alerta "entrega vencida"
-- Run on: dev / staging / prod
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- Requiere: 147–150, 167 y 168.
-- =====================================================================
--
-- Problema: hasta ahora el atraso se medía SOLO por los días en la etapa
-- (lab_stages.overdue_days) y la fecha de entrega era informativa. Una orden
-- registrada tarde (o con la entrega ya vencida) no se marcaba atrasada ni
-- generaba alerta hasta cumplir los días de la etapa, aunque el laboratorio
-- ya no hubiera entregado.
--
-- Qué hace:
--   1. v_lab_orders: la orden está atrasada si se pasó de los días de la
--      etapa O si su fecha de entrega ya pasó y no está en una etapa final.
--      Columnas nuevas al final:
--        is_stage_overdue  lleva más de overdue_days en la etapa (lo de antes)
--        is_past_due       due_date < hoy (America/Montevideo), etapa no final
--        days_past_due     días desde la fecha de entrega (0 si no venció)
--      is_overdue = is_stage_overdue OR is_past_due (filtro "atrasadas",
--      tablero y marca roja lo siguen usando).
--      "Vencida" = desde el día SIGUIENTE a la fecha de entrega: el mismo día
--      todavía puede llegar.
--   2. lab_stage_alerts: disparador nuevo 'due' ("entrega vencida"), por
--      etapa como los otros dos, con destinatarios, canales y repetición
--      opcional cada X días. Las etapas finales no lo tienen.
--   3. Regla LAB_ORDER_PAST_DUE (activa, diaria, generador
--      alert_gen_lab_order_past_due): el Alert Scheduler crea la alerta el
--      primer día que la entrega está vencida (y cada X días si se repite).
--      occurrence_key = 'due:<fecha de entrega>:<k>': si se cambia la fecha
--      de entrega y vuelve a vencer, sale una alerta nueva.
--   4. lab_stage_alert_on_enter (alta y cambio de etapa, flujo Lab Orders):
--      además de la alerta "al entrar", si la orden YA tiene la entrega
--      vencida crea en el momento su alerta "entrega vencida" (no espera al
--      Scheduler del día siguiente). Sin cambios en n8n.
--   5. Las alertas que dejan de aplicar se cierran solas (status SUPPRESSED,
--      trigger en lab_orders):
--        · por permanencia: cuando la orden cambia de etapa o se elimina;
--        · entrega vencida: cuando llega a una etapa final, se cambia o
--          borra la fecha de entrega, o se elimina la orden;
--        · al entrar: cuando se elimina la orden.
--      Además se cierran las que ya estaban abiertas y no aplican.
--   6. Configuración inicial (solo la primera vez que se aplica el script):
--      cada etapa activa no final recibe una alerta "entrega vencida" con los
--      mismos destinatarios y canales que su alerta por permanencia o, si no
--      tiene, aviso en el sistema al doctor y a quien creó la orden.
--
-- Despliegue: aplicar ESTE script y publicar el frontend en la misma
-- ventana. No hay flujos para reimportar: el Alert Scheduler ejecuta la
-- regla nueva por su generador (script 168) y "Lab Orders" ya llama a
-- lab_stage_alert_on_enter y a "Alert Staff Notify".
-- lab_stages_save solo toca la alerta 'due' si el frontend manda la clave
-- alerts.due, así que un frontend viejo no la borra.
-- =====================================================================

BEGIN;

-- Primera aplicación: decide si se siembra la configuración inicial (punto 6).
CREATE TEMP TABLE _lab169_first_run ON COMMIT DROP AS
SELECT NOT EXISTS (
    SELECT 1 FROM db_migrations WHERE script_name = '169_20261112_lab-orders-due-date-overdue.sql'
) AS first_run;

-- ─── 1. Vista ────────────────────────────────────────────────────────────────
-- is_overdue cambia de expresión (mismo nombre y tipo); las columnas nuevas
-- van al final (CREATE OR REPLACE VIEW solo agrega).

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
       END AS days_past_due
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
    'Órdenes de laboratorio con nombres, etapa actual, días en la etapa, atraso (is_overdue = is_stage_overdue OR is_past_due, nunca en etapa final), servicios (items) y work_summary.';

COMMENT ON COLUMN public.lab_orders.due_date IS
    'Fecha de entrega que prometió el laboratorio. Desde el día siguiente, si la orden no llegó a una etapa final, está atrasada (v_lab_orders.is_past_due) y sale la alerta "entrega vencida".';

-- ─── 2. Disparador 'due' en la configuración de alertas ──────────────────────

ALTER TABLE public.lab_stage_alerts DROP CONSTRAINT IF EXISTS lab_stage_alerts_trigger_chk;
ALTER TABLE public.lab_stage_alerts
    ADD CONSTRAINT lab_stage_alerts_trigger_chk CHECK (trigger IN ('enter', 'dwell', 'due'));

ALTER TABLE public.lab_stage_alerts DROP CONSTRAINT IF EXISTS lab_stage_alerts_repeat_chk;
ALTER TABLE public.lab_stage_alerts
    ADD CONSTRAINT lab_stage_alerts_repeat_chk
    CHECK (repeat_every_days IS NULL OR (trigger IN ('dwell', 'due') AND repeat_every_days > 0));

COMMENT ON TABLE public.lab_stage_alerts IS
    'Alertas de cada etapa de laboratorio: al entrar (enter), por permanencia más allá de lab_stages.overdue_days (dwell) o por fecha de entrega vencida mientras la orden está en la etapa (due).';

CREATE OR REPLACE FUNCTION public.lab_stage_alerts_json(p_stage_id integer)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
    SELECT jsonb_build_object(
        'enter', (SELECT to_jsonb(a) - 'id' - 'stage_id' - 'trigger' - 'created_at' - 'updated_at'
                  FROM public.lab_stage_alerts a WHERE a.stage_id = p_stage_id AND a.trigger = 'enter'),
        'dwell', (SELECT to_jsonb(a) - 'id' - 'stage_id' - 'trigger' - 'created_at' - 'updated_at'
                  FROM public.lab_stage_alerts a WHERE a.stage_id = p_stage_id AND a.trigger = 'dwell'),
        'due',   (SELECT to_jsonb(a) - 'id' - 'stage_id' - 'trigger' - 'created_at' - 'updated_at'
                  FROM public.lab_stage_alerts a WHERE a.stage_id = p_stage_id AND a.trigger = 'due')
    );
$$;

-- Igual que en el script 150; la repetición vale para 'dwell' y 'due'.
CREATE OR REPLACE FUNCTION public.lab_stage_alert_upsert(
    p_stage_id integer, p_stage_name text, p_trigger text, p jsonb, p_has_threshold boolean
)
RETURNS void
LANGUAGE plpgsql
AS $$
#variable_conflict use_column
DECLARE
    v_roles   integer[];
    v_users   uuid[];
    v_doctor  boolean;
    v_creator boolean;
    v_in_app  boolean;
    v_email   boolean;
    v_wa      boolean;
    v_wa_tpl  integer;
BEGIN
    IF p IS NULL OR jsonb_typeof(p) <> 'object' THEN
        DELETE FROM public.lab_stage_alerts a WHERE a.stage_id = p_stage_id AND a.trigger = p_trigger;
        RETURN;
    END IF;

    IF p_trigger = 'dwell' AND NOT p_has_threshold THEN
        RAISE EXCEPTION 'LAB_STAGES:DWELL_WITHOUT_THRESHOLD|%', p_stage_name;
    END IF;

    v_roles := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p->'recipient_role_ids', '[]'::jsonb))::integer);
    v_users := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p->'recipient_user_ids', '[]'::jsonb))::uuid);
    v_doctor := COALESCE((p->>'notify_order_doctor')::boolean, false);
    v_creator := COALESCE((p->>'notify_order_creator')::boolean, false);
    v_in_app := COALESCE((p->>'channel_in_app')::boolean, false);
    v_email := COALESCE((p->>'channel_email')::boolean, false);
    v_wa := COALESCE((p->>'channel_whatsapp')::boolean, false);
    v_wa_tpl := NULLIF(p->>'whatsapp_template_id', '')::integer;

    IF cardinality(v_roles) = 0 AND cardinality(v_users) = 0 AND NOT v_doctor AND NOT v_creator THEN
        RAISE EXCEPTION 'LAB_STAGES:NO_RECIPIENTS|%', p_stage_name;
    END IF;
    IF NOT (v_in_app OR v_email OR v_wa) THEN
        RAISE EXCEPTION 'LAB_STAGES:NO_CHANNEL|%', p_stage_name;
    END IF;
    -- WhatsApp solo sale con una plantilla aprobada en Meta/YCloud.
    IF v_wa AND v_wa_tpl IS NULL THEN
        RAISE EXCEPTION 'LAB_STAGES:WHATSAPP_TEMPLATE_REQUIRED|%', p_stage_name;
    END IF;

    INSERT INTO public.lab_stage_alerts AS a (
        stage_id, trigger, repeat_every_days, recipient_role_ids, recipient_user_ids,
        notify_order_doctor, notify_order_creator, channel_in_app, channel_email, channel_whatsapp,
        email_template_id, whatsapp_template_id)
    VALUES (
        p_stage_id, p_trigger,
        CASE WHEN p_trigger IN ('dwell', 'due') THEN NULLIF(NULLIF(p->>'repeat_every_days', '')::integer, 0) END,
        v_roles, v_users, v_doctor, v_creator, v_in_app, v_email, v_wa,
        CASE WHEN v_email THEN NULLIF(p->>'email_template_id', '')::integer END,
        CASE WHEN v_wa THEN v_wa_tpl END)
    ON CONFLICT (stage_id, trigger) DO UPDATE SET
        repeat_every_days = EXCLUDED.repeat_every_days,
        recipient_role_ids = EXCLUDED.recipient_role_ids,
        recipient_user_ids = EXCLUDED.recipient_user_ids,
        notify_order_doctor = EXCLUDED.notify_order_doctor,
        notify_order_creator = EXCLUDED.notify_order_creator,
        channel_in_app = EXCLUDED.channel_in_app,
        channel_email = EXCLUDED.channel_email,
        channel_whatsapp = EXCLUDED.channel_whatsapp,
        email_template_id = EXCLUDED.email_template_id,
        whatsapp_template_id = EXCLUDED.whatsapp_template_id,
        updated_at = now();
END;
$$;

-- Igual que en el script 150, más la alerta 'due' (solo si llega alerts.due).
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
            -- Una etapa final no tiene atraso: sus alertas por permanencia y
            -- por entrega vencida se descartan.
            PERFORM public.lab_stage_alert_upsert(
                v_id, v_name, 'dwell',
                CASE WHEN v_kind = 'final' THEN NULL ELSE v_item->'alerts'->'dwell' END,
                v_overdue IS NOT NULL);
            -- Sin la clave "due" (frontend anterior al script 169) no se toca.
            IF v_kind = 'final' OR (v_item->'alerts') ? 'due' THEN
                PERFORM public.lab_stage_alert_upsert(
                    v_id, v_name, 'due',
                    CASE WHEN v_kind = 'final' THEN NULL ELSE v_item->'alerts'->'due' END,
                    true);
            END IF;
        ELSIF v_kind = 'final' OR v_overdue IS NULL THEN
            DELETE FROM public.lab_stage_alerts a
            WHERE a.stage_id = v_id
              AND (a.trigger = 'dwell' OR (v_kind = 'final' AND a.trigger = 'due'));
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

-- ─── 3. Contenido de las alertas (título, resumen, aviso al equipo) ──────────
-- Igual que en el script 168, más el disparador 'due'.

CREATE OR REPLACE FUNCTION public.lab_stage_alert_content(p_alert public.lab_stage_alerts, p_order jsonb)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
    WITH o AS (SELECT p_order AS j),
    t AS (
        SELECT
            CASE p_alert.trigger
                WHEN 'enter' THEN format('Orden de laboratorio #%s: %s', j->>'id', j->>'stage_name')
                WHEN 'due' THEN format('Orden de laboratorio #%s: entrega vencida (%s)', j->>'id',
                                       to_char((j->>'due_date')::date, 'DD/MM/YYYY'))
                ELSE format('Orden de laboratorio #%s atrasada en «%s»', j->>'id', j->>'stage_name')
            END AS title,
            COALESCE(NULLIF(j->>'work_summary', ''), NULLIF(j->>'work_description', ''), '') AS work,
            CASE WHEN p_alert.trigger IN ('dwell', 'due') THEN 'HIGH' ELSE 'MEDIUM' END AS priority,
            (SELECT COALESCE(string_agg(e.value, ', ' ORDER BY e.value::integer), '')
             FROM jsonb_array_elements_text(COALESCE(j->'teeth', '[]'::jsonb)) e) AS teeth,
            COALESCE(to_char((j->>'due_date')::date, 'DD/MM/YYYY'), '') AS due_text,
            -- Al generar para una fecha futura (Probar / Scheduler) se usa la
            -- fecha de la vista; mínimo 1 día, que es cuando sale la alerta.
            GREATEST(COALESCE((j->>'days_past_due')::integer, 0), 1) AS days_late,
            j
        FROM o
    )
    SELECT jsonb_build_object(
        'title', left(t.title, 300),
        'priority', t.priority,
        'summary', concat_ws(' · ',
            t.j->>'patient_name',
            NULLIF(t.work, ''),
            NULLIF(t.j->>'laboratory_name', ''),
            CASE p_alert.trigger
                WHEN 'dwell' THEN (t.j->>'days_in_stage') || ' días en la etapa'
                WHEN 'due' THEN format('entrega %s (%s %s de atraso)', t.due_text, t.days_late,
                                       CASE WHEN t.days_late = 1 THEN 'día' ELSE 'días' END)
            END),
        'staff_dispatch', jsonb_build_object(
            'recipient_role_ids', to_jsonb(p_alert.recipient_role_ids),
            'recipient_user_ids', to_jsonb(ARRAY(
                SELECT DISTINCT x FROM unnest(
                    p_alert.recipient_user_ids
                    || CASE WHEN p_alert.notify_order_doctor THEN ARRAY[NULLIF(t.j->>'doctor_id', '')::uuid] ELSE '{}'::uuid[] END
                    || CASE WHEN p_alert.notify_order_creator THEN ARRAY[NULLIF(t.j->>'created_by', '')::uuid] ELSE '{}'::uuid[] END
                ) AS x WHERE x IS NOT NULL)),
            'channels', jsonb_build_object(
                'in_app', p_alert.channel_in_app,
                'email', p_alert.channel_email,
                'whatsapp', p_alert.channel_whatsapp),
            'email_template_id', p_alert.email_template_id,
            'whatsapp_template_id', p_alert.whatsapp_template_id,
            'notification', jsonb_build_object(
                'type', 'lab_order_alert',
                'priority', t.priority,
                'patient_id', t.j->>'patient_id',
                'metadata', jsonb_build_object(
                    'trigger', p_alert.trigger,
                    'lab_order_id', (t.j->>'id')::integer,
                    'patient_name', t.j->>'patient_name',
                    'work_description', t.work,
                    'laboratory_name', t.j->>'laboratory_name',
                    'stage_name', t.j->>'stage_name',
                    'stage_color', t.j->>'stage_color',
                    'days_in_stage', (t.j->>'days_in_stage')::integer,
                    'due_date', t.j->>'due_date',
                    'days_past_due', CASE WHEN p_alert.trigger = 'due' THEN t.days_late END)),
            -- Claves de las plantillas (las mismas que antes, más lab_order.days_past_due).
            'fields', jsonb_build_object(
                'patient.name', COALESCE(t.j->>'patient_name', ''),
                'lab_order.number', COALESCE(t.j->>'id', ''),
                'lab_order.work', t.work,
                'lab_order.laboratory', COALESCE(t.j->>'laboratory_name', ''),
                'lab_order.stage', COALESCE(t.j->>'stage_name', ''),
                'lab_order.days_in_stage', COALESCE(t.j->>'days_in_stage', ''),
                'lab_order.doctor', COALESCE(t.j->>'doctor_name', ''),
                'lab_order.teeth', t.teeth,
                'lab_order.due_date', t.due_text,
                'lab_order.days_past_due', CASE WHEN p_alert.trigger = 'due' THEN t.days_late::text ELSE '' END),
            'lines', jsonb_build_array(
                jsonb_build_object('label', 'Paciente', 'value', COALESCE(t.j->>'patient_name', '')),
                jsonb_build_object('label', 'Trabajo', 'value', t.work),
                jsonb_build_object('label', 'Laboratorio', 'value', COALESCE(t.j->>'laboratory_name', '')),
                jsonb_build_object('label', 'Etapa', 'value',
                    format('%s (%s días)', t.j->>'stage_name', t.j->>'days_in_stage')),
                jsonb_build_object('label', 'Entrega', 'value',
                    CASE WHEN t.due_text = '' THEN '—'
                         WHEN p_alert.trigger = 'due' THEN format('%s (%s %s de atraso)', t.due_text, t.days_late,
                                                                  CASE WHEN t.days_late = 1 THEN 'día' ELSE 'días' END)
                         ELSE t.due_text END))))
    FROM t;
$$;

-- ─── 4. Generador de la regla LAB_ORDER_PAST_DUE ─────────────────────────────
-- Entrega vencida el día T si due_date < T, la orden no está en una etapa
-- final y su etapa actual tiene la alerta 'due'. Repetición k = días desde
-- el primer día vencido / X. occurrence_key = 'due:<due_date>:<k>'.
-- p_order_id: solo esa orden (lo usa lab_stage_alert_on_enter).

CREATE OR REPLACE FUNCTION public.alert_gen_lab_order_past_due(
    p_target_date date, p_rule_id integer, p_order_id integer DEFAULT NULL
)
RETURNS TABLE (
    rule_id integer, reference_table text, reference_id text, user_id uuid, alert_date date,
    occurrence_key text, event_date timestamp, occurrence_mode text, title text, priority text,
    description text, details_json jsonb
)
LANGUAGE sql
STABLE
AS $$
    WITH due AS (
        SELECT a AS alert, o.id AS order_id, o.due_date,
               CASE WHEN a.repeat_every_days IS NULL THEN 0
                    ELSE ((p_target_date - o.due_date - 1) / a.repeat_every_days)
               END AS k
        FROM public.lab_stage_alerts a
        JOIN public.lab_stages s ON s.id = a.stage_id AND s.is_active AND s.kind <> 'final'
        JOIN public.lab_orders o ON o.current_stage_id = s.id AND NOT o.is_deleted
        WHERE a.trigger = 'due'
          AND o.due_date IS NOT NULL
          AND o.due_date < p_target_date
          AND (p_order_id IS NULL OR o.id = p_order_id)
    ),
    due_rows AS (
        SELECT d.*, 'due:' || to_char(d.due_date, 'YYYY-MM-DD') || ':' || d.k AS occ, to_jsonb(v) AS j
        FROM due d
        JOIN public.v_lab_orders v ON v.id = d.order_id
    )
    SELECT p_rule_id,
           'lab_orders'::text,
           r.order_id::text,
           (r.j->>'patient_id')::uuid,
           p_target_date,
           r.occ,
           r.due_date::timestamp,
           'event'::text,
           c->>'title',
           c->>'priority',
           c->>'summary',
           jsonb_build_object('data', r.j, 'trigger', 'due', 'staff_dispatch', c->'staff_dispatch')
    FROM due_rows r
    CROSS JOIN LATERAL public.lab_stage_alert_content(r.alert, r.j) AS c
    WHERE NOT EXISTS (
        SELECT 1 FROM public.alert_instances ai
        WHERE ai.rule_id = p_rule_id
          AND ai.reference_table = 'lab_orders'
          AND ai.reference_id = r.order_id::text
          AND ai.occurrence_key = r.occ);
$$;

COMMENT ON FUNCTION public.alert_gen_lab_order_past_due(date, integer, integer) IS
    'Generador de la regla LAB_ORDER_PAST_DUE (Alert Scheduler): órdenes con la fecha de entrega vencida, no finales, cuya etapa tiene la alerta "entrega vencida".';

-- ─── 5. Al dar de alta / mover: alerta "al entrar" + entrega ya vencida ──────

CREATE OR REPLACE FUNCTION public.lab_stage_alert_on_enter(p_order_id integer, p_local_now text DEFAULT NULL)
RETURNS SETOF jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_alert    public.lab_stage_alerts%ROWTYPE;
    v_order    jsonb;
    v_hist     integer;
    v_rule_id  integer;
    v_content  jsonb;
    v_instance integer;
    v_today    date := (COALESCE(NULLIF(p_local_now, '')::timestamptz, now()) AT TIME ZONE 'America/Montevideo')::date;
BEGIN
    SELECT to_jsonb(v) INTO v_order FROM public.v_lab_orders v WHERE v.id = p_order_id;
    IF v_order IS NULL THEN RETURN; END IF;

    -- "Al entrar"
    SELECT * INTO v_alert
    FROM public.lab_stage_alerts a
    WHERE a.stage_id = (v_order->>'current_stage_id')::integer AND a.trigger = 'enter';
    SELECT id INTO v_rule_id FROM public.alert_rules WHERE code = 'LAB_STAGE_ENTERED';

    IF v_alert.id IS NOT NULL AND v_rule_id IS NOT NULL THEN
        SELECT max(h.id) INTO v_hist
        FROM public.lab_order_stage_history h
        WHERE h.lab_order_id = p_order_id AND h.to_stage_id = (v_order->>'current_stage_id')::integer;

        v_content := public.lab_stage_alert_content(v_alert, v_order);

        INSERT INTO public.alert_instances (
            rule_id, reference_table, reference_id, patient_id, alert_date, event_date,
            title, summary, priority, details_json, status, occurrence_key)
        VALUES (
            v_rule_id, 'lab_orders', v_order->>'id', (v_order->>'patient_id')::uuid,
            v_today,
            (v_order->>'stage_entered_at')::timestamptz AT TIME ZONE 'UTC',
            v_content->>'title', v_content->>'summary', v_content->>'priority',
            jsonb_build_object('data', v_order, 'trigger', 'enter', 'staff_dispatch', v_content->'staff_dispatch'),
            'PENDING', 'enter:' || COALESCE(v_hist, 0))
        ON CONFLICT (rule_id, reference_table, reference_id, occurrence_key) DO NOTHING
        RETURNING id INTO v_instance;

        IF v_instance IS NOT NULL THEN
            RETURN NEXT jsonb_build_object('alert_instance_id', v_instance);
        END IF;
    END IF;

    -- Entrega ya vencida (p. ej. una orden registrada tarde): no espera al
    -- Scheduler. Mismo occurrence_key que el generador, así no se duplica.
    SELECT id INTO v_rule_id FROM public.alert_rules WHERE code = 'LAB_ORDER_PAST_DUE' AND is_active;
    IF v_rule_id IS NOT NULL THEN
        v_instance := NULL;
        INSERT INTO public.alert_instances (
            rule_id, reference_table, reference_id, patient_id, alert_date, event_date,
            title, summary, priority, details_json, status, occurrence_key)
        SELECT g.rule_id, g.reference_table, g.reference_id, g.user_id, g.alert_date, g.event_date,
               g.title, g.description, g.priority, g.details_json, 'PENDING', g.occurrence_key
        FROM public.alert_gen_lab_order_past_due(v_today, v_rule_id, p_order_id) g
        ON CONFLICT (rule_id, reference_table, reference_id, occurrence_key) DO NOTHING
        RETURNING id INTO v_instance;

        IF v_instance IS NOT NULL THEN
            RETURN NEXT jsonb_build_object('alert_instance_id', v_instance);
        END IF;
    END IF;
END;
$$;

-- ─── 6. Cierre de alertas que dejan de aplicar ───────────────────────────────

CREATE OR REPLACE FUNCTION public.lab_order_alerts_resolve()
RETURNS trigger
LANGUAGE plpgsql
AS $$
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
                               WHEN r.code = 'LAB_STAGE_OVERDUE' THEN 'Cerrada: la orden cambió de etapa.'
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
$$;

DROP TRIGGER IF EXISTS lab_order_alerts_resolve ON public.lab_orders;
CREATE TRIGGER lab_order_alerts_resolve
    AFTER UPDATE OF current_stage_id, due_date, is_deleted ON public.lab_orders
    FOR EACH ROW EXECUTE FUNCTION public.lab_order_alerts_resolve();

-- Las que ya estaban abiertas y no aplican: por permanencia de una entrada
-- anterior (otro id de historial) o de una orden eliminada / en etapa final.
UPDATE public.alert_instances ai
SET status = 'SUPPRESSED',
    notes = concat_ws(E'\n', NULLIF(ai.notes, ''), 'Cerrada (script 169): la orden ya no estaba en esa etapa.'),
    updated_at = now()
FROM public.alert_rules r, public.lab_orders o
JOIN public.lab_stages s ON s.id = o.current_stage_id
WHERE r.id = ai.rule_id
  AND r.code = 'LAB_STAGE_OVERDUE'
  AND ai.reference_table = 'lab_orders'
  AND ai.reference_id = o.id::text
  AND ai.status IN ('PENDING', 'SNOOZED')
  AND (o.is_deleted
       OR s.kind = 'final'
       OR split_part(ai.occurrence_key, ':', 2) IS DISTINCT FROM COALESCE((
              SELECT max(h.id) FROM public.lab_order_stage_history h
              WHERE h.lab_order_id = o.id AND h.to_stage_id = o.current_stage_id), 0)::text);

-- ─── 7. Regla del motor de alertas ───────────────────────────────────────────

SET LOCAL invokeia.managed_alert_rules = 'on';

INSERT INTO public.alert_rules (
    category_id, code, name, description, priority, source_table, condition_config,
    days_before, days_after, recurrence_type, auto_send_email, auto_send_sms, is_active, created_by)
SELECT c.id, 'LAB_ORDER_PAST_DUE', 'Orden de laboratorio: entrega vencida',
       'Órdenes cuya fecha de entrega ya pasó y no llegaron a una etapa final. Se configura en Configuración → Etapas de laboratorio (alerta "entrega vencida"); el Alert Scheduler la evalúa una vez por día.',
       'HIGH', 'lab_orders',
       jsonb_build_object(
           'managed_by', 'lab_stages',
           'generator', 'alert_gen_lab_order_past_due',
           'event_field', 'none',
           'conditions', '[]'::jsonb),
       0, 0, 'DAILY', false, false, true,
       (SELECT u.id FROM public.users u
        LEFT JOIN public.user_roles ur ON ur.user_id = u.id
        LEFT JOIN public.roles ro ON ro.id = ur.role_id
        ORDER BY (LOWER(TRIM(ro.name)) = 'administrador') DESC NULLS LAST, u.id
        LIMIT 1)
FROM public.alert_categories c
WHERE c.code = 'LAB_ORDERS'
  AND NOT EXISTS (SELECT 1 FROM public.alert_rules ar WHERE ar.code = 'LAB_ORDER_PAST_DUE');

UPDATE public.alert_categories
SET description = 'Órdenes de laboratorio: avisos al entrar a una etapa, por permanencia y por entrega vencida'
WHERE code = 'LAB_ORDERS';

-- ─── 8. Configuración inicial (solo la primera vez) ──────────────────────────

INSERT INTO public.lab_stage_alerts (
    stage_id, trigger, repeat_every_days, recipient_role_ids, recipient_user_ids,
    notify_order_doctor, notify_order_creator, channel_in_app, channel_email, channel_whatsapp,
    email_template_id, whatsapp_template_id)
SELECT s.id, 'due', NULL,
       COALESCE(dw.recipient_role_ids, '{}'),
       COALESCE(dw.recipient_user_ids, '{}'),
       COALESCE(dw.notify_order_doctor, true),
       COALESCE(dw.notify_order_creator, true),
       COALESCE(dw.channel_in_app, true),
       COALESCE(dw.channel_email, false),
       COALESCE(dw.channel_whatsapp, false),
       dw.email_template_id,
       dw.whatsapp_template_id
FROM public.lab_stages s
LEFT JOIN public.lab_stage_alerts dw ON dw.stage_id = s.id AND dw.trigger = 'dwell'
WHERE s.is_active
  AND s.kind <> 'final'
  AND (SELECT first_run FROM _lab169_first_run)
  AND NOT EXISTS (SELECT 1 FROM public.lab_stage_alerts a WHERE a.stage_id = s.id AND a.trigger = 'due');

-- ─── Registro de migración ────────────────────────────────────────────────────

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '169_20261112_lab-orders-due-date-overdue.sql',
    'v1',
    'v_lab_orders: is_overdue incluye la fecha de entrega vencida (+ is_stage_overdue / is_past_due / days_past_due) + alerta de etapa "due" + regla LAB_ORDER_PAST_DUE con generador + alerta inmediata al alta/mover si ya venció + cierre automático de alertas que dejan de aplicar'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;
