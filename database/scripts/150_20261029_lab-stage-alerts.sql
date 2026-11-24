-- =====================================================================
-- Órdenes de laboratorio — fase 4: alertas configurables por etapa
-- Run on: dev / staging / prod
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- Requiere: 147, 148 y 149.
-- =====================================================================
--
-- Qué hace:
--   Cada etapa puede tener dos alertas independientes:
--     · enter: al entrar una orden a la etapa (también el alta, que entra
--       en la inicial).
--     · dwell: por permanencia, cuando la orden lleva MÁS de
--       lab_stages.overdue_days en la etapa (el mismo umbral que la marca
--       atrasada). Una vez, o repetida cada repeat_every_days mientras siga.
--   Para cada una se eligen destinatarios (roles, usuarios, doctor de la
--   orden, quien la creó) y canales (en el sistema, email, WhatsApp) con las
--   plantillas de communication_templates.
--
-- Cómo se apoya en el motor de alertas:
--   Cada aviso es una fila de alert_instances (reference_table 'lab_orders'),
--   así aparece en /alerts con completar / posponer / ignorar y su
--   anti-duplicado (rule_id, reference_table, reference_id, occurrence_key).
--   Las reglas LAB_STAGE_ENTERED y LAB_STAGE_OVERDUE se crean INACTIVAS a
--   propósito: el Alert Scheduler genérico no las ejecuta (sus envíos
--   automáticos van al PACIENTE, y acá los destinatarios son del equipo).
--   Las instancias las crean estas funciones, llamadas por el flujo
--   "Lab Orders":
--     · lab_stage_alert_on_enter(order_id): después del alta y de cada
--       cambio de etapa. occurrence_key = 'enter:<id del historial>'.
--     · lab_stage_alerts_due(): cada hora (Schedule Trigger del flujo).
--       occurrence_key = 'dwell:<id del historial>:<k>' con k = número de
--       repetición; con "una sola vez" solo existe k = 0.
--   Las dos devuelven, por cada aviso NUEVO, un jsonb con la orden, la
--   etapa, los destinatarios (con su notification_id si hay canal en el
--   sistema) y la plantilla de email / WhatsApp, para que el flujo despache.
--
-- Cambios:
--   1. lab_stage_alerts (una fila por etapa y disparador).
--   2. lab_stages_save / lab_stages_list: cada etapa lleva "alerts"
--      { enter: {...} | null, dwell: {...} | null }. Si el item no trae la
--      clave "alerts", las alertas de esa etapa no se tocan.
--      Errores nuevos: DWELL_WITHOUT_THRESHOLD, NO_RECIPIENTS, NO_CHANNEL,
--      WHATSAPP_TEMPLATE_REQUIRED.
--   3. Categoría de alertas LAB_ORDERS y reglas LAB_STAGE_ENTERED /
--      LAB_STAGE_OVERDUE (inactivas).
--   4. notifications.type admite 'lab_order_alert'.
--   5. communication_templates.entity_type admite 'lab_order' (si tiene CHECK).
--   6. Funciones de destinatarios y emisión.
--
-- Despliegue: aplicar ESTE script y reimportar los flujos "Lab Stages" y
-- "Lab Orders" en la misma ventana.
-- =====================================================================

BEGIN;

-- ─── 1. Configuración de alertas por etapa ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.lab_stage_alerts (
    id                    serial PRIMARY KEY,
    stage_id              integer     NOT NULL REFERENCES public.lab_stages(id) ON DELETE CASCADE,
    trigger               text        NOT NULL,
    repeat_every_days     integer,
    recipient_role_ids    integer[]   NOT NULL DEFAULT '{}',
    recipient_user_ids    uuid[]      NOT NULL DEFAULT '{}',
    notify_order_doctor   boolean     NOT NULL DEFAULT false,
    notify_order_creator  boolean     NOT NULL DEFAULT false,
    channel_in_app        boolean     NOT NULL DEFAULT true,
    channel_email         boolean     NOT NULL DEFAULT false,
    channel_whatsapp      boolean     NOT NULL DEFAULT false,
    email_template_id     integer,
    whatsapp_template_id  integer,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT lab_stage_alerts_trigger_chk CHECK (trigger IN ('enter', 'dwell')),
    CONSTRAINT lab_stage_alerts_repeat_chk CHECK (repeat_every_days IS NULL OR (trigger = 'dwell' AND repeat_every_days > 0)),
    CONSTRAINT lab_stage_alerts_stage_trigger_uq UNIQUE (stage_id, trigger)
);

COMMENT ON TABLE public.lab_stage_alerts IS
    'Alertas de cada etapa de laboratorio: al entrar (enter) o por permanencia más allá de lab_stages.overdue_days (dwell).';

-- ─── 2. Guardar / listar etapas con sus alertas ──────────────────────────────

DROP FUNCTION IF EXISTS public.lab_stages_save(jsonb, uuid);
DROP FUNCTION IF EXISTS public.lab_stages_list();

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

CREATE OR REPLACE FUNCTION public.lab_stages_list()
RETURNS TABLE (
    id integer, name text, color text, sort_order integer, kind text,
    overdue_days integer, is_active boolean, orders_count integer, in_use boolean, alerts jsonb
)
LANGUAGE sql
STABLE
AS $$
    SELECT s.id, s.name, s.color, s.sort_order, s.kind, s.overdue_days, s.is_active,
           COALESCE(oc.n, 0)::integer AS orders_count,
           (COALESCE(oc.n, 0) > 0
            OR EXISTS (SELECT 1 FROM public.lab_order_stage_history h
                       WHERE h.to_stage_id = s.id OR h.from_stage_id = s.id)) AS in_use,
           public.lab_stage_alerts_json(s.id) AS alerts
    FROM public.lab_stages s
    LEFT JOIN (
        SELECT o.current_stage_id, count(*) AS n
        FROM public.lab_orders o
        WHERE NOT o.is_deleted
        GROUP BY o.current_stage_id
    ) oc ON oc.current_stage_id = s.id
    ORDER BY s.is_active DESC, s.sort_order, s.id;
$$;

-- Valida y guarda una alerta (p NULL = la etapa no tiene esa alerta).
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
        CASE WHEN p_trigger = 'dwell' THEN NULLIF(p->>'repeat_every_days', '')::integer END,
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

-- Igual que en el script 147, más las alertas de cada etapa.
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
            -- Una etapa final no tiene atraso: su alerta por permanencia se descarta.
            PERFORM public.lab_stage_alert_upsert(
                v_id, v_name, 'dwell',
                CASE WHEN v_kind = 'final' THEN NULL ELSE v_item->'alerts'->'dwell' END,
                v_overdue IS NOT NULL);
        ELSIF v_kind = 'final' OR v_overdue IS NULL THEN
            DELETE FROM public.lab_stage_alerts a WHERE a.stage_id = v_id AND a.trigger = 'dwell';
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

-- ─── 3. Categoría y reglas del motor de alertas ──────────────────────────────

INSERT INTO public.alert_categories (code, name, description, icon, color, sort_order, is_active)
SELECT 'LAB_ORDERS', 'Laboratorio', 'Órdenes de laboratorio: avisos al entrar a una etapa y por permanencia',
       'flask-conical', '#0ea5e9', 90, true
WHERE NOT EXISTS (SELECT 1 FROM public.alert_categories c WHERE c.code = 'LAB_ORDERS');

-- created_by es obligatorio: el primer administrador activo (o cualquier usuario).
INSERT INTO public.alert_rules (
    category_id, code, name, description, priority, source_table, condition_config,
    days_before, days_after, recurrence_type, auto_send_email, auto_send_sms, is_active, created_by)
SELECT c.id, r.code, r.name, r.description, r.priority, 'lab_orders',
       jsonb_build_object('managed_by', 'lab_stages', 'event_field', 'none', 'conditions', '[]'::jsonb),
       0, 0, 'DAILY', false, false, false,
       (SELECT u.id FROM public.users u
        LEFT JOIN public.user_roles ur ON ur.user_id = u.id
        LEFT JOIN public.roles ro ON ro.id = ur.role_id
        ORDER BY (LOWER(TRIM(ro.name)) = 'administrador') DESC NULLS LAST, u.id
        LIMIT 1)
FROM public.alert_categories c
CROSS JOIN (VALUES
    ('LAB_STAGE_ENTERED', 'Orden de laboratorio: entró a una etapa',
     'La crean las alertas "al entrar" de Configuración → Etapas de laboratorio (flujo Lab Orders). El Alert Scheduler no la ejecuta: dejar inactiva.', 'MEDIUM'),
    ('LAB_STAGE_OVERDUE', 'Orden de laboratorio: atrasada en su etapa',
     'La crean las alertas "por permanencia" de Configuración → Etapas de laboratorio (flujo Lab Orders, cada hora). El Alert Scheduler no la ejecuta: dejar inactiva.', 'HIGH')
) AS r(code, name, description, priority)
WHERE c.code = 'LAB_ORDERS'
  AND NOT EXISTS (SELECT 1 FROM public.alert_rules ar WHERE ar.code = r.code);

-- ─── 4 y 5. CHECKs de tipos (si existen) ─────────────────────────────────────

DO $$
DECLARE
    v_target record;
    con_name text;
    valores  text[];
BEGIN
    FOR v_target IN
        SELECT * FROM (VALUES
            ('public.notifications', 'type', 'lab_order_alert'),
            ('public.communication_templates', 'entity_type', 'lab_order')
        ) AS t(tbl, col, val)
    LOOP
        IF to_regclass(v_target.tbl) IS NULL THEN CONTINUE; END IF;

        SELECT conname INTO con_name
          FROM pg_constraint
         WHERE conrelid = v_target.tbl::regclass
           AND contype  = 'c'
           AND pg_get_constraintdef(oid) LIKE '%' || v_target.col || '%'
         ORDER BY conname
         LIMIT 1;
        IF con_name IS NULL THEN CONTINUE; END IF;

        SELECT array_agg(DISTINCT m[1]) INTO valores
          FROM pg_constraint c
          CROSS JOIN LATERAL regexp_matches(pg_get_constraintdef(c.oid), '''([^'']+)''', 'g') AS m
         WHERE c.conrelid = v_target.tbl::regclass
           AND c.conname  = con_name;

        IF v_target.val = ANY (COALESCE(valores, ARRAY[]::text[])) THEN CONTINUE; END IF;

        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', v_target.tbl, con_name);
        EXECUTE format(
            'ALTER TABLE %s ADD CONSTRAINT %I CHECK (%I IS NULL OR %I::text = ANY (ARRAY[%s]))',
            v_target.tbl, con_name, v_target.col, v_target.col,
            (SELECT string_agg(quote_literal(v), ', ') FROM unnest(COALESCE(valores, ARRAY[]::text[]) || v_target.val) AS v)
        );
        RAISE NOTICE '[lab] CHECK de %.% ampliado con %', v_target.tbl, v_target.col, v_target.val;
    END LOOP;
END $$;

-- ─── 6. Destinatarios y emisión ──────────────────────────────────────────────
--
-- p_local_now: la hora del flujo ($now de n8n, con su offset). notifications.
-- created_at guarda hora de pared, igual que "Create Bulk Notification": el
-- texto se castea a timestamp sin zona (descarta el offset). Sin él se usa la
-- hora de America/Montevideo, como el resto de los flujos.

DROP FUNCTION IF EXISTS public.lab_stage_alert_emit(integer, integer, text, text);
DROP FUNCTION IF EXISTS public.lab_stage_alert_on_enter(integer);
DROP FUNCTION IF EXISTS public.lab_stage_alerts_due();

-- Usuarios activos que reciben una alerta para una orden (sin repetidos).
CREATE OR REPLACE FUNCTION public.lab_stage_alert_recipients(p_alert_id integer, p_order_id integer)
RETURNS TABLE (user_id uuid, name text, email text, phone text)
LANGUAGE sql
STABLE
AS $$
    WITH a AS (SELECT * FROM public.lab_stage_alerts WHERE id = p_alert_id),
         o AS (SELECT * FROM public.lab_orders WHERE id = p_order_id),
         ids AS (
             SELECT ur.user_id AS uid
             FROM public.user_roles ur, a
             WHERE ur.role_id = ANY (a.recipient_role_ids) AND COALESCE(ur.is_active, true)
             UNION
             SELECT unnest(a.recipient_user_ids) FROM a
             UNION
             SELECT o.doctor_id FROM o, a WHERE a.notify_order_doctor
             UNION
             SELECT o.created_by FROM o, a WHERE a.notify_order_creator
         )
    SELECT u.id, u.name, NULLIF(btrim(u.email), ''), NULLIF(btrim(u.phone_number), '')
    FROM ids
    JOIN public.users u ON u.id = ids.uid
    WHERE COALESCE(u.is_active, true);
$$;

-- Crea la alert_instance (si es nueva) + las notificaciones del sistema y
-- devuelve el paquete para despachar. NULL si esa ocurrencia ya existía.
CREATE OR REPLACE FUNCTION public.lab_stage_alert_emit(
    p_alert_id integer, p_order_id integer, p_rule_code text, p_occurrence text, p_local_now text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_alert   public.lab_stage_alerts%ROWTYPE;
    v_order   jsonb;
    v_rule_id integer;
    v_instance integer;
    v_title   text;
    v_summary text;
    v_recipients jsonb;
    v_email_tpl jsonb;
    v_wa_tpl  jsonb;
BEGIN
    SELECT * INTO v_alert FROM public.lab_stage_alerts WHERE id = p_alert_id;
    SELECT to_jsonb(v) INTO v_order FROM public.v_lab_orders v WHERE v.id = p_order_id;
    SELECT id INTO v_rule_id FROM public.alert_rules WHERE code = p_rule_code;
    IF v_alert.id IS NULL OR v_order IS NULL OR v_rule_id IS NULL THEN
        RETURN NULL;
    END IF;

    v_title := CASE WHEN v_alert.trigger = 'enter'
        THEN format('Orden de laboratorio #%s: %s', v_order->>'id', v_order->>'stage_name')
        ELSE format('Orden de laboratorio #%s atrasada en «%s»', v_order->>'id', v_order->>'stage_name')
    END;
    v_summary := concat_ws(' · ',
        v_order->>'patient_name',
        v_order->>'work_description',
        NULLIF(v_order->>'laboratory_name', ''),
        CASE WHEN v_alert.trigger = 'dwell' THEN (v_order->>'days_in_stage') || ' días en la etapa' END);

    INSERT INTO public.alert_instances (
        rule_id, reference_table, reference_id, patient_id, alert_date, event_date,
        title, summary, priority, details_json, status, occurrence_key)
    VALUES (
        v_rule_id, 'lab_orders', v_order->>'id', (v_order->>'patient_id')::uuid, current_date,
        (v_order->>'stage_entered_at')::timestamptz AT TIME ZONE 'UTC',
        left(v_title, 300), v_summary,
        CASE WHEN v_alert.trigger = 'dwell' THEN 'HIGH' ELSE 'MEDIUM' END,
        jsonb_build_object('data', v_order, 'trigger', v_alert.trigger),
        'PENDING', p_occurrence)
    ON CONFLICT (rule_id, reference_table, reference_id, occurrence_key) DO NOTHING
    RETURNING id INTO v_instance;

    IF v_instance IS NULL THEN
        RETURN NULL;
    END IF;

    WITH r AS (SELECT * FROM public.lab_stage_alert_recipients(p_alert_id, p_order_id)),
    n AS (
        INSERT INTO public.notifications (user_id, type, status, priority, patient_id, metadata, created_at, read_at)
        SELECT r.user_id, 'lab_order_alert', 'pending', CASE WHEN v_alert.trigger = 'dwell' THEN 'HIGH' ELSE 'MEDIUM' END,
               (v_order->>'patient_id')::uuid,
               jsonb_build_object(
                   'alert_instance_id', v_instance,
                   'trigger', v_alert.trigger,
                   'lab_order_id', (v_order->>'id')::integer,
                   'patient_name', v_order->>'patient_name',
                   'work_description', v_order->>'work_description',
                   'laboratory_name', v_order->>'laboratory_name',
                   'stage_name', v_order->>'stage_name',
                   'stage_color', v_order->>'stage_color',
                   'days_in_stage', (v_order->>'days_in_stage')::integer),
               COALESCE(NULLIF(p_local_now, '')::timestamp, now() AT TIME ZONE 'America/Montevideo'), NULL
        FROM r
        WHERE v_alert.channel_in_app
        RETURNING *
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'user_id', r.user_id, 'name', r.name, 'email', r.email, 'phone', r.phone,
               'notification', (SELECT to_jsonb(n) FROM n WHERE n.user_id = r.user_id LIMIT 1))), '[]'::jsonb)
    INTO v_recipients
    FROM r;

    SELECT to_jsonb(x) INTO v_email_tpl FROM (
        SELECT ct.id, ct.subject, ct.body_html, ct.body_text
        FROM public.communication_templates ct
        WHERE ct.id = v_alert.email_template_id AND ct.type = 'EMAIL' AND ct.is_active
    ) x;
    SELECT to_jsonb(x) INTO v_wa_tpl FROM (
        SELECT ct.id, ct.code, COALESCE(ct.provider_language, 'es') AS language, ct.variables_schema
        FROM public.communication_templates ct
        WHERE ct.id = v_alert.whatsapp_template_id AND ct.type = 'WHATSAPP' AND ct.is_active
    ) x;

    RETURN jsonb_build_object(
        'alert_instance_id', v_instance,
        'trigger', v_alert.trigger,
        'title', v_title,
        'summary', v_summary,
        'order', v_order,
        'channels', jsonb_build_object(
            'in_app', v_alert.channel_in_app,
            'email', v_alert.channel_email,
            'whatsapp', v_alert.channel_whatsapp),
        'email_template', v_email_tpl,
        'whatsapp_template', v_wa_tpl,
        'whatsapp_test_mode', COALESCE((SELECT value FROM public.system_configurations
                                        WHERE key = 'whatsapp_test_mode_enabled' LIMIT 1)::boolean, false),
        'whatsapp_test_whitelist', COALESCE((SELECT value FROM public.system_configurations
                                             WHERE key = 'whatsapp_test_phone_whitelist' LIMIT 1), ''),
        'clinic_name', (SELECT c.name FROM public.clinics c ORDER BY c.id LIMIT 1),
        'recipients', v_recipients);
END;
$$;

-- Después del alta o de un cambio de etapa: la alerta "al entrar" de la
-- etapa actual, una vez por entrada (id del historial).
CREATE OR REPLACE FUNCTION public.lab_stage_alert_on_enter(p_order_id integer, p_local_now text DEFAULT NULL)
RETURNS SETOF jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_stage   integer;
    v_hist    integer;
    v_alert   integer;
    v_payload jsonb;
BEGIN
    SELECT o.current_stage_id INTO v_stage
    FROM public.lab_orders o WHERE o.id = p_order_id AND NOT o.is_deleted;
    IF v_stage IS NULL THEN RETURN; END IF;

    SELECT a.id INTO v_alert
    FROM public.lab_stage_alerts a
    WHERE a.stage_id = v_stage AND a.trigger = 'enter';
    IF v_alert IS NULL THEN RETURN; END IF;

    SELECT max(h.id) INTO v_hist
    FROM public.lab_order_stage_history h
    WHERE h.lab_order_id = p_order_id AND h.to_stage_id = v_stage;

    v_payload := public.lab_stage_alert_emit(v_alert, p_order_id, 'LAB_STAGE_ENTERED', 'enter:' || COALESCE(v_hist, 0), p_local_now);
    IF v_payload IS NOT NULL THEN RETURN NEXT v_payload; END IF;
END;
$$;

-- Cada hora: avisos por permanencia que vencieron y todavía no se emitieron.
-- Ocurrencias: entrada + N días (k = 0) y, con repetición, + k·X días.
-- Si el flujo estuvo parado, solo sale la última ocurrencia vencida.
CREATE OR REPLACE FUNCTION public.lab_stage_alerts_due(p_local_now text DEFAULT NULL)
RETURNS SETOF jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    r         record;
    v_payload jsonb;
BEGIN
    FOR r IN
        SELECT a.id AS alert_id, o.id AS order_id,
               (SELECT max(h.id) FROM public.lab_order_stage_history h
                WHERE h.lab_order_id = o.id AND h.to_stage_id = o.current_stage_id) AS hist_id,
               CASE WHEN a.repeat_every_days IS NULL THEN 0
                    ELSE floor(extract(epoch FROM (now() - o.stage_entered_at - make_interval(days => s.overdue_days)))
                               / (86400 * a.repeat_every_days))::integer
               END AS k
        FROM public.lab_stage_alerts a
        JOIN public.lab_stages s ON s.id = a.stage_id AND s.is_active AND s.kind <> 'final' AND s.overdue_days IS NOT NULL
        JOIN public.lab_orders o ON o.current_stage_id = s.id AND NOT o.is_deleted
        WHERE a.trigger = 'dwell'
          AND now() - o.stage_entered_at > make_interval(days => s.overdue_days)
        ORDER BY o.id
    LOOP
        v_payload := public.lab_stage_alert_emit(
            r.alert_id, r.order_id, 'LAB_STAGE_OVERDUE',
            'dwell:' || COALESCE(r.hist_id, 0) || ':' || r.k, p_local_now);
        IF v_payload IS NOT NULL THEN RETURN NEXT v_payload; END IF;
    END LOOP;
END;
$$;

-- ─── Registro de migración ────────────────────────────────────────────────────

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '150_20261029_lab-stage-alerts.sql',
    'v1',
    'lab_stage_alerts + alertas en lab_stages_save/list + categoría LAB_ORDERS y reglas LAB_STAGE_ENTERED/OVERDUE (inactivas) + lab_stage_alert_on_enter / lab_stage_alerts_due + notifications.type lab_order_alert'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;
