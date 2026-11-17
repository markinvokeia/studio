-- =====================================================================
-- Motor de alertas: avisos al equipo + reglas con generador
-- (las alertas de laboratorio dejan de tener su propio motor)
-- Run on: dev / staging / prod
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- Requiere: 150 (alertas de etapas de laboratorio) y 167.
-- =====================================================================
--
-- Antes: el flujo "Lab Orders" tenía su propio Schedule Trigger (cada hora)
-- y sus propios envíos (Gmail, YCloud, push). Ahora:
--
--   1. AVISOS AL EQUIPO (genérico). Cualquier alert_instance puede llevar en
--      details_json.staff_dispatch a quién avisar y por qué canales:
--        { recipient_role_ids: [int], recipient_user_ids: [uuid],
--          channels: { in_app, email, whatsapp },
--          email_template_id?, whatsapp_template_id?,
--          notification: { type, priority, patient_id?, metadata },
--          fields: { "clave": "valor" }   -- variables de las plantillas
--          lines:  [{ label, value }] }   -- cuerpo del email sin plantilla
--      El flujo "Alert Staff Notify" la despacha: alert_staff_dispatch_claim()
--      toma las pendientes (una sola vez cada una: staff_dispatched_at),
--      crea las notificaciones del sistema y devuelve destinatarios y
--      plantillas. El flujo respeta los mismos interruptores que el envío a
--      pacientes: alert_email_auto_send_enabled, modo prueba de email y de
--      WhatsApp, emails rebotados y el canal por categoría
--      (global_notification_settings, si la categoría tiene slug).
--
--   2. REGLAS CON GENERADOR (genérico). Una regla con
--      condition_config.generator = 'alert_gen_<nombre>' no arma la consulta
--      a partir de condiciones: el Alert Scheduler llama a
--      public.alert_gen_<nombre>(target_date, rule_id), que devuelve las
--      mismas columnas que la consulta dinámica. Así una regla puede tener
--      lógica propia (repeticiones, umbrales por fila) y seguir pasando por
--      el Scheduler, su anti-duplicado y su registro de corridas.
--
--   3. REGLAS GESTIONADAS. Una regla con condition_config.managed_by la
--      configura otra pantalla (Etapas de laboratorio, recordatorios): un
--      trigger impide cambiar su configuración o borrarla desde /alert-rules
--      (ALERT_RULES:MANAGED_RULE). Se puede activar/desactivar.
--
--   4. LABORATORIO sobre lo anterior:
--      · "al entrar": lab_stage_alert_on_enter(order) crea la instancia de
--        LAB_STAGE_ENTERED con su staff_dispatch (sigue siendo inmediata, como
--        los recordatorios; la regla queda inactiva para el Scheduler).
--      · "por permanencia": LAB_STAGE_OVERDUE pasa a ser una regla ACTIVA con
--        generador alert_gen_lab_stage_overdue. Se evalúa una vez por día con
--        el Scheduler (ya no cada hora): sale el primer día que la orden ya
--        estaba atrasada a las 00:00 (America/Montevideo) y, con repetición,
--        cada X días. Una repetición nueva reemplaza la anterior sin atender.
--      · lab_stage_alerts sigue siendo la configuración (pantalla de etapas).
--      · lab_stage_alerts_due() queda como no-op hasta reimportar "Lab Orders".
--
-- Despliegue (misma ventana, en este orden):
--   1. Este script.
--   2. Importar "Alert Staff Notify" (docs/n8n-flows/flow-alert-staff-notify.json).
--   3. Reimportar "Alert Scheduler" y "Lab Orders" y, en el nodo
--      "Notify staff" de cada uno, elegir el workflow "Alert Staff Notify".
--   4. Reimportar "Alert Rules" (el botón Probar entiende los generadores).
-- =====================================================================

BEGIN;

-- ─── 1. Marca de despacho al equipo ──────────────────────────────────────────

ALTER TABLE public.alert_instances
    ADD COLUMN IF NOT EXISTS staff_dispatched_at timestamptz;

COMMENT ON COLUMN public.alert_instances.staff_dispatched_at IS
    'Cuándo "Alert Staff Notify" tomó la alerta para avisar al equipo (details_json.staff_dispatch). NULL = pendiente.';

CREATE INDEX IF NOT EXISTS alert_instances_staff_pending_idx
    ON public.alert_instances (created_at)
    WHERE staff_dispatched_at IS NULL AND details_json ? 'staff_dispatch';

-- Las alertas creadas antes de este script no se vuelven a despachar.
UPDATE public.alert_instances
SET staff_dispatched_at = COALESCE(staff_dispatched_at, created_at::timestamptz)
WHERE staff_dispatched_at IS NULL AND details_json ? 'staff_dispatch';

-- ─── 2. Despacho genérico ────────────────────────────────────────────────────
--
-- Toma las alertas PENDIENTES con staff_dispatch que nadie despachó (de los
-- últimos 7 días: una alerta vieja que quedó sin despachar no sale de golpe),
-- las marca, crea las notificaciones del sistema y devuelve un jsonb por
-- alerta para que el flujo mande email / WhatsApp.
--
-- p_local_now: la hora del flujo ($now de n8n). notifications.created_at
-- guarda hora de pared, igual que "Create Bulk Notification".

CREATE OR REPLACE FUNCTION public.alert_staff_dispatch_claim(p_local_now text DEFAULT NULL)
RETURNS SETOF jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_ai         record;
    v_spec       jsonb;
    v_now_local  timestamp := COALESCE(NULLIF(p_local_now, '')::timestamp, now() AT TIME ZONE 'America/Montevideo');
    v_notif      jsonb;
    v_recipients jsonb;
    v_email_tpl  jsonb;
    v_wa_tpl     jsonb;
    v_category   text;
    v_cfg        jsonb;
BEGIN
    SELECT jsonb_build_object(
        'email_auto_send_enabled', COALESCE(LOWER(MAX(value) FILTER (WHERE key = 'alert_email_auto_send_enabled')), 'false') = 'true',
        'email_test_mode', COALESCE(LOWER(MAX(value) FILTER (WHERE key = 'alert_email_test_mode_enabled')), 'false') = 'true',
        'email_test_whitelist', COALESCE(MAX(value) FILTER (WHERE key = 'alert_email_test_whitelist'), ''),
        'whatsapp_test_mode', COALESCE(LOWER(MAX(value) FILTER (WHERE key = 'whatsapp_test_mode_enabled')), 'false') = 'true',
        'whatsapp_test_whitelist', COALESCE(MAX(value) FILTER (WHERE key = 'whatsapp_test_phone_whitelist'), ''))
    INTO v_cfg
    FROM public.system_configurations
    WHERE key IN ('alert_email_auto_send_enabled', 'alert_email_test_mode_enabled', 'alert_email_test_whitelist',
                  'whatsapp_test_mode_enabled', 'whatsapp_test_phone_whitelist');

    FOR v_ai IN
        WITH picked AS (
            SELECT ai.id
            FROM public.alert_instances ai
            WHERE ai.staff_dispatched_at IS NULL
              AND ai.details_json ? 'staff_dispatch'
              AND ai.status = 'PENDING'
              AND ai.created_at >= (now() AT TIME ZONE 'America/Montevideo') - interval '7 days'
            ORDER BY ai.id
            FOR UPDATE SKIP LOCKED
        )
        UPDATE public.alert_instances ai
        SET staff_dispatched_at = now()
        FROM picked
        WHERE ai.id = picked.id
        RETURNING ai.*
    LOOP
        v_spec := v_ai.details_json->'staff_dispatch';

        SELECT ac.notification_category_slug INTO v_category
        FROM public.alert_rules ar
        LEFT JOIN public.alert_categories ac ON ac.id = ar.category_id
        WHERE ar.id = v_ai.rule_id;

        -- Destinatarios: usuarios activos de los roles + usuarios sueltos, sin repetidos.
        WITH ids AS (
            SELECT ur.user_id AS uid
            FROM public.user_roles ur
            WHERE ur.role_id IN (SELECT jsonb_array_elements_text(COALESCE(v_spec->'recipient_role_ids', '[]'::jsonb))::integer)
              AND COALESCE(ur.is_active, true)
            UNION
            SELECT jsonb_array_elements_text(COALESCE(v_spec->'recipient_user_ids', '[]'::jsonb))::uuid
        ),
        r AS (
            SELECT u.id AS user_id, u.name, NULLIF(btrim(u.email), '') AS email,
                   COALESCE(u.email_bounced, false) AS email_bounced,
                   NULLIF(btrim(u.phone_number), '') AS phone
            FROM ids
            JOIN public.users u ON u.id = ids.uid
            WHERE COALESCE(u.is_active, true)
        ),
        n AS (
            INSERT INTO public.notifications (user_id, type, status, priority, patient_id, metadata, created_at, read_at)
            SELECT r.user_id,
                   v_spec->'notification'->>'type',
                   'pending',
                   COALESCE(v_spec->'notification'->>'priority', v_ai.priority, 'MEDIUM'),
                   COALESCE(NULLIF(v_spec->'notification'->>'patient_id', '')::uuid, v_ai.patient_id),
                   COALESCE(v_spec->'notification'->'metadata', '{}'::jsonb)
                       || jsonb_build_object('alert_instance_id', v_ai.id),
                   v_now_local,
                   NULL
            FROM r
            WHERE COALESCE((v_spec->'channels'->>'in_app')::boolean, false)
              AND NULLIF(v_spec->'notification'->>'type', '') IS NOT NULL
            RETURNING *
        )
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
                   'user_id', r.user_id, 'name', r.name, 'email', r.email,
                   'email_bounced', r.email_bounced, 'phone', r.phone,
                   'notification', (SELECT to_jsonb(n) FROM n WHERE n.user_id = r.user_id LIMIT 1))), '[]'::jsonb)
        INTO v_recipients
        FROM r;

        SELECT to_jsonb(x) INTO v_email_tpl FROM (
            SELECT ct.id, ct.subject, ct.body_html, ct.body_text
            FROM public.communication_templates ct
            WHERE ct.id = NULLIF(v_spec->>'email_template_id', '')::integer AND ct.type = 'EMAIL' AND ct.is_active
        ) x;
        SELECT to_jsonb(x) INTO v_wa_tpl FROM (
            SELECT ct.id, ct.code, COALESCE(ct.provider_language, 'es') AS language, ct.variables_schema
            FROM public.communication_templates ct
            WHERE ct.id = NULLIF(v_spec->>'whatsapp_template_id', '')::integer AND ct.type = 'WHATSAPP' AND ct.is_active
        ) x;

        RETURN NEXT jsonb_build_object(
            'alert_instance_id', v_ai.id,
            'title', v_ai.title,
            'summary', v_ai.summary,
            'category_slug', v_category,
            'channels', COALESCE(v_spec->'channels', '{}'::jsonb),
            -- Canal por categoría: solo si la categoría tiene slug y la clínica lo apagó.
            'email_channel_enabled', v_category IS NULL OR COALESCE((
                SELECT g.is_enabled FROM public.global_notification_settings g
                WHERE g.channel_slug = 'email' AND g.category_slug = v_category LIMIT 1), true),
            'whatsapp_channel_enabled', v_category IS NULL OR COALESCE((
                SELECT g.is_enabled FROM public.global_notification_settings g
                WHERE g.channel_slug = 'whatsapp' AND g.category_slug = v_category LIMIT 1), true),
            'notification_type', v_spec->'notification'->>'type',
            'fields', COALESCE(v_spec->'fields', '{}'::jsonb),
            'lines', COALESCE(v_spec->'lines', '[]'::jsonb),
            'email_template_id', NULLIF(v_spec->>'email_template_id', '')::integer,
            'email_template', v_email_tpl,
            'whatsapp_template_id', NULLIF(v_spec->>'whatsapp_template_id', '')::integer,
            'whatsapp_template', v_wa_tpl,
            'clinic_name', (SELECT c.name FROM public.clinic c ORDER BY c.id LIMIT 1),
            'config', v_cfg,
            'recipients', v_recipients);
    END LOOP;
END;
$$;

COMMENT ON FUNCTION public.alert_staff_dispatch_claim(text) IS
    'Toma (una sola vez) las alertas PENDIENTES con details_json.staff_dispatch, crea sus notificaciones del sistema y devuelve destinatarios y plantillas para el flujo "Alert Staff Notify".';

-- ─── 3. Reglas gestionadas por otra pantalla ─────────────────────────────────
-- Se saltea con SET LOCAL invokeia.managed_alert_rules = 'on' (scripts).

CREATE OR REPLACE FUNCTION public.alert_rules_managed_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF COALESCE(current_setting('invokeia.managed_alert_rules', true), '') = 'on'
       OR NULLIF(OLD.condition_config->>'managed_by', '') IS NULL THEN
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
    END IF;
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'ALERT_RULES:MANAGED_RULE|%', OLD.code;
    END IF;
    IF NEW.condition_config IS DISTINCT FROM OLD.condition_config
       OR NEW.source_table IS DISTINCT FROM OLD.source_table
       OR NEW.code IS DISTINCT FROM OLD.code
       OR NEW.category_id IS DISTINCT FROM OLD.category_id
       OR NEW.recurrence_type IS DISTINCT FROM OLD.recurrence_type
       OR NEW.days_before IS DISTINCT FROM OLD.days_before
       OR NEW.days_after IS DISTINCT FROM OLD.days_after
       OR NEW.auto_send_email IS DISTINCT FROM OLD.auto_send_email
       OR NEW.auto_send_sms IS DISTINCT FROM OLD.auto_send_sms THEN
        RAISE EXCEPTION 'ALERT_RULES:MANAGED_RULE|%', OLD.code;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS alert_rules_managed_guard ON public.alert_rules;
CREATE TRIGGER alert_rules_managed_guard
    BEFORE UPDATE OR DELETE ON public.alert_rules
    FOR EACH ROW EXECUTE FUNCTION public.alert_rules_managed_guard();

-- ─── 4. Laboratorio ──────────────────────────────────────────────────────────

-- Título, resumen y aviso al equipo de una alerta de etapa para una orden.
CREATE OR REPLACE FUNCTION public.lab_stage_alert_content(p_alert public.lab_stage_alerts, p_order jsonb)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
    WITH o AS (SELECT p_order AS j),
    t AS (
        SELECT
            CASE WHEN p_alert.trigger = 'enter'
                 THEN format('Orden de laboratorio #%s: %s', j->>'id', j->>'stage_name')
                 ELSE format('Orden de laboratorio #%s atrasada en «%s»', j->>'id', j->>'stage_name')
            END AS title,
            COALESCE(NULLIF(j->>'work_summary', ''), NULLIF(j->>'work_description', ''), '') AS work,
            CASE WHEN p_alert.trigger = 'dwell' THEN 'HIGH' ELSE 'MEDIUM' END AS priority,
            (SELECT COALESCE(string_agg(e.value, ', ' ORDER BY e.value::integer), '')
             FROM jsonb_array_elements_text(COALESCE(j->'teeth', '[]'::jsonb)) e) AS teeth,
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
            CASE WHEN p_alert.trigger = 'dwell' THEN (t.j->>'days_in_stage') || ' días en la etapa' END),
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
                    'days_in_stage', (t.j->>'days_in_stage')::integer)),
            -- Claves de las plantillas (las mismas que antes del script 168).
            'fields', jsonb_build_object(
                'patient.name', COALESCE(t.j->>'patient_name', ''),
                'lab_order.number', COALESCE(t.j->>'id', ''),
                'lab_order.work', t.work,
                'lab_order.laboratory', COALESCE(t.j->>'laboratory_name', ''),
                'lab_order.stage', COALESCE(t.j->>'stage_name', ''),
                'lab_order.days_in_stage', COALESCE(t.j->>'days_in_stage', ''),
                'lab_order.doctor', COALESCE(t.j->>'doctor_name', ''),
                'lab_order.teeth', t.teeth,
                'lab_order.due_date', COALESCE(to_char((t.j->>'due_date')::date, 'DD/MM/YYYY'), '')),
            'lines', jsonb_build_array(
                jsonb_build_object('label', 'Paciente', 'value', COALESCE(t.j->>'patient_name', '')),
                jsonb_build_object('label', 'Trabajo', 'value', t.work),
                jsonb_build_object('label', 'Laboratorio', 'value', COALESCE(t.j->>'laboratory_name', '')),
                jsonb_build_object('label', 'Etapa', 'value',
                    format('%s (%s días)', t.j->>'stage_name', t.j->>'days_in_stage')))))
    FROM t;
$$;

-- "Al entrar": después del alta o de un cambio de etapa, la alerta de la
-- etapa actual, una vez por entrada (id del historial). Devuelve
-- { alert_instance_id } si creó una; el flujo llama luego a "Alert Staff Notify".
DROP FUNCTION IF EXISTS public.lab_stage_alert_on_enter(integer, text);
DROP FUNCTION IF EXISTS public.lab_stage_alert_emit(integer, integer, text, text, text);
DROP FUNCTION IF EXISTS public.lab_stage_alert_recipients(integer, integer);

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
BEGIN
    SELECT to_jsonb(v) INTO v_order FROM public.v_lab_orders v WHERE v.id = p_order_id;
    IF v_order IS NULL THEN RETURN; END IF;

    SELECT * INTO v_alert
    FROM public.lab_stage_alerts a
    WHERE a.stage_id = (v_order->>'current_stage_id')::integer AND a.trigger = 'enter';
    IF v_alert.id IS NULL THEN RETURN; END IF;

    SELECT id INTO v_rule_id FROM public.alert_rules WHERE code = 'LAB_STAGE_ENTERED';
    IF v_rule_id IS NULL THEN RETURN; END IF;

    SELECT max(h.id) INTO v_hist
    FROM public.lab_order_stage_history h
    WHERE h.lab_order_id = p_order_id AND h.to_stage_id = (v_order->>'current_stage_id')::integer;

    v_content := public.lab_stage_alert_content(v_alert, v_order);

    INSERT INTO public.alert_instances (
        rule_id, reference_table, reference_id, patient_id, alert_date, event_date,
        title, summary, priority, details_json, status, occurrence_key)
    VALUES (
        v_rule_id, 'lab_orders', v_order->>'id', (v_order->>'patient_id')::uuid,
        (COALESCE(NULLIF(p_local_now, '')::timestamp, now() AT TIME ZONE 'America/Montevideo'))::date,
        (v_order->>'stage_entered_at')::timestamptz AT TIME ZONE 'UTC',
        v_content->>'title', v_content->>'summary', v_content->>'priority',
        jsonb_build_object('data', v_order, 'trigger', 'enter', 'staff_dispatch', v_content->'staff_dispatch'),
        'PENDING', 'enter:' || COALESCE(v_hist, 0))
    ON CONFLICT (rule_id, reference_table, reference_id, occurrence_key) DO NOTHING
    RETURNING id INTO v_instance;

    IF v_instance IS NOT NULL THEN
        RETURN NEXT jsonb_build_object('alert_instance_id', v_instance);
    END IF;
END;
$$;

-- "Por permanencia": generador de la regla LAB_STAGE_OVERDUE (Alert Scheduler,
-- una vez por día). Devuelve las columnas de la consulta dinámica del
-- Scheduler; él crea las instancias (anti-duplicado + reemplazo de la
-- repetición anterior sin atender).
--   Atrasada el día T si a las 00:00 de T (America/Montevideo) llevaba más
--   de overdue_days en la etapa. Repetición k = días de atraso / X.
--   occurrence_key = 'dwell:<id del historial>:<k>'.
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
        SELECT a AS alert, o.id AS order_id,
               (SELECT max(h.id) FROM public.lab_order_stage_history h
                WHERE h.lab_order_id = o.id AND h.to_stage_id = o.current_stage_id) AS hist_id,
               CASE WHEN a.repeat_every_days IS NULL THEN 0
                    ELSE floor(extract(epoch FROM (at_t.ts - o.stage_entered_at - make_interval(days => s.overdue_days)))
                               / (86400 * a.repeat_every_days))::integer
               END AS k
        FROM public.lab_stage_alerts a
        JOIN public.lab_stages s ON s.id = a.stage_id AND s.is_active AND s.kind <> 'final' AND s.overdue_days IS NOT NULL
        JOIN public.lab_orders o ON o.current_stage_id = s.id AND NOT o.is_deleted
        CROSS JOIN at_t
        WHERE a.trigger = 'dwell'
          AND at_t.ts - o.stage_entered_at > make_interval(days => s.overdue_days)
    ),
    due_rows AS (
        SELECT d.*, 'dwell:' || COALESCE(d.hist_id, 0) || ':' || d.k AS occ, to_jsonb(v) AS j
        FROM due d
        JOIN public.v_lab_orders v ON v.id = d.order_id
    )
    SELECT p_rule_id,
           'lab_orders'::text,
           r.order_id::text,
           (r.j->>'patient_id')::uuid,
           p_target_date,
           r.occ,
           (r.j->>'stage_entered_at')::timestamptz AT TIME ZONE 'UTC',
           'event'::text,
           c->>'title',
           c->>'priority',
           c->>'summary',
           jsonb_build_object('data', r.j, 'trigger', 'dwell', 'staff_dispatch', c->'staff_dispatch')
    FROM due_rows r
    CROSS JOIN LATERAL public.lab_stage_alert_content(r.alert, r.j) AS c
    WHERE NOT EXISTS (
        SELECT 1 FROM public.alert_instances ai
        WHERE ai.rule_id = p_rule_id
          AND ai.reference_table = 'lab_orders'
          AND ai.reference_id = r.order_id::text
          AND ai.occurrence_key = r.occ);
$$;

COMMENT ON FUNCTION public.alert_gen_lab_stage_overdue(date, integer) IS
    'Generador de la regla LAB_STAGE_OVERDUE (Alert Scheduler): órdenes atrasadas en su etapa con alerta "por permanencia" configurada.';

-- El Schedule Trigger viejo de "Lab Orders" llama a esto cada hora hasta que
-- se reimporte el flujo: ya no hace nada (lo hace el Alert Scheduler).
DROP FUNCTION IF EXISTS public.lab_stage_alerts_due(text);
CREATE OR REPLACE FUNCTION public.lab_stage_alerts_due(p_local_now text DEFAULT NULL)
RETURNS SETOF jsonb
LANGUAGE sql
AS $$
    SELECT NULL::jsonb WHERE false;
$$;

COMMENT ON FUNCTION public.lab_stage_alerts_due(text) IS
    'Obsoleta (script 168): las alertas por permanencia las genera alert_gen_lab_stage_overdue desde el Alert Scheduler.';

-- Reglas: LAB_STAGE_OVERDUE la ejecuta el Scheduler con su generador;
-- LAB_STAGE_ENTERED sigue inactiva (la crea el flujo en el momento).
SET LOCAL invokeia.managed_alert_rules = 'on';

UPDATE public.alert_rules
SET is_active = true,
    recurrence_type = 'DAILY',
    next_execution_at = NULL,
    auto_send_email = false,
    auto_send_sms = false,
    condition_config = jsonb_build_object(
        'managed_by', 'lab_stages',
        'generator', 'alert_gen_lab_stage_overdue',
        'event_field', 'none',
        'conditions', '[]'::jsonb),
    description = 'Órdenes atrasadas en su etapa. Se configura en Configuración → Etapas de laboratorio (alerta "por permanencia"); el Alert Scheduler la evalúa una vez por día.',
    updated_at = now()
WHERE code = 'LAB_STAGE_OVERDUE';

UPDATE public.alert_rules
SET condition_config = condition_config || jsonb_build_object('managed_by', 'lab_stages'),
    description = 'Una orden entró a una etapa. Se configura en Configuración → Etapas de laboratorio (alerta "al entrar"); la crea el flujo Lab Orders en el momento, por eso queda inactiva para el Alert Scheduler.',
    updated_at = now()
WHERE code = 'LAB_STAGE_ENTERED';

-- ─── Registro de migración ────────────────────────────────────────────────────

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '168_20261109_alert-staff-dispatch.sql',
    'v1',
    'alert_instances.staff_dispatched_at + alert_staff_dispatch_claim + reglas con generador + guard de reglas gestionadas + alertas de laboratorio sobre el motor genérico (LAB_STAGE_OVERDUE activa con alert_gen_lab_stage_overdue)'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;
