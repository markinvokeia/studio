-- =====================================================================
-- Órdenes de laboratorio — aviso al paciente cuando la orden está lista
-- Run on: dev / staging / prod
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- Requiere: 147–150, 167, 168, 169 y 136 (occurrence_key).
-- =====================================================================
--
-- Cuando una orden entra en una etapa FINAL ("Completado") se avisa al
-- paciente. No hay motor nuevo: es una regla de alertas común y corriente,
-- LAB_ORDER_READY, que se configura en Sistema → Reglas de alertas como las
-- demás (activar/desactivar, email y/o WhatsApp, plantillas). Los envíos
-- salen por los subflujos que ya usan las otras reglas, así que respetan los
-- mismos interruptores:
--   · Email: "Alert Email Auto-Send" — alert_email_auto_send_enabled, modo
--     prueba (alert_email_test_mode_enabled / _whitelist), emails rebotados y
--     el email del responsable si el paciente es dependiente sin email.
--   · WhatsApp: "Alert WhatsApp Auto-Send" — modo prueba y el teléfono del
--     responsable para dependientes. Queda APAGADO: hace falta una plantilla
--     aprobada en YCloud. Sirve cualquier plantilla con entity_type 'patient'
--     (variables patient.name / clinic.name).
--
-- Cuándo sale: en el momento. El flujo "Lab Orders", después de cada cambio
-- de etapa, llama a lab_order_ready_alert(order_id): si la regla está activa
-- y la orden quedó en una etapa final, crea la alert_instance y devuelve los
-- datos con los que el flujo llama a los subflujos de envío (igual que el
-- Alert Scheduler). La alerta queda en /alerts: si el envío falla, sigue
-- PENDIENTE para que alguien llame al paciente.
--
-- El Alert Scheduler también evalúa la regla (es activa), pero su condición
-- (ready_date = {{TODAY}}) no encuentra nada en la corrida de las 00:00. En
-- un "Ejecutar ahora" durante el día recupera las órdenes listas HOY que no
-- tengan aviso (p. ej. si la regla se activó después). El anti-duplicado es
-- el mismo en los dos caminos: occurrence_key = ready_at (event_field), así
-- una orden no recibe dos avisos por la misma llegada a la etapa final. Si
-- vuelve a una etapa anterior y otra vez a la final, es otra ocurrencia.
--
-- Cambios:
--   1. Vista v_alert_lab_orders_ready (origen de la regla): órdenes en etapa
--      final, con ready_at / ready_date en hora de la clínica.
--   2. Plantilla de email LAB_ORDER_READY (communication_templates).
--   3. Regla LAB_ORDER_READY (categoría LAB_ORDERS), activa, solo email.
--   4. lab_order_ready_alert(order_id): crea la alerta en el momento.
--   5. lab_order_alerts_resolve: un aviso PENDIENTE (no enviado) se cierra si
--      la orden sale de la etapa final o se elimina.
--
-- Despliegue (misma ventana, en este orden):
--   1. Este script.
--   2. Reimportar "Alert Email Auto-Send" (docs/n8n-flows/Alert Email
--      Auto-Send.json): entiende reference_table 'lab_orders' y las
--      categorías sin canal propio (LAB_ORDERS) ya no bloquean el email.
--      Si la versión de n8n cambió, aplicar a mano los dos nodos
--      "Load Email Context" y "Build Email".
--   3. Reimportar "Lab Orders" (docs/n8n-flows/flow-lab-orders.json) y, en
--      los nodos "Send ready email" y "Send ready WhatsApp", elegir los
--      subflujos "Alert Email Auto-Send" y "Alert WhatsApp Auto-Send" si los
--      ids no coinciden con los de este entorno.
--   Sin el paso 3 no sale ningún aviso (la regla solo se dispara desde el
--   flujo). Con el modo prueba de email activo, solo reciben las direcciones
--   de la lista blanca.
-- =====================================================================

BEGIN;

-- ─── 1. Vista origen ─────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_alert_lab_orders_ready AS
SELECT
    o.id,
    o.patient_id,
    o.patient_name,
    o.doctor_id,
    o.doctor_name,
    o.laboratory_name,
    COALESCE(NULLIF(o.work_summary, ''), NULLIF(o.work_description, ''), '') AS work,
    o.teeth,
    o.stage_name,
    o.is_urgent,
    -- Hora de pared de la clínica (como appointments.start_datetime).
    (o.stage_entered_at AT TIME ZONE 'America/Montevideo')       AS ready_at,
    (o.stage_entered_at AT TIME ZONE 'America/Montevideo')::date AS ready_date
FROM public.v_lab_orders o
WHERE o.stage_kind = 'final';

COMMENT ON VIEW public.v_alert_lab_orders_ready IS
    '{"reference_table":"lab_orders","label":"Órdenes de laboratorio listas (en etapa final)"}';

-- ─── 2. Plantilla de email ───────────────────────────────────────────────────
-- Solo el contenido: la cabecera, el pie y el fondo los agrega "Build Email".

INSERT INTO public.communication_templates (code, name, type, category_id, subject, body_html, is_active, created_by)
SELECT 'LAB_ORDER_READY',
       'Orden de laboratorio lista',
       'EMAIL',
       c.id,
       $tpl$Tu trabajo de laboratorio está listo — {{clinic_name}}$tpl$,
       $tpl$<p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#4b1d95;">Laboratorio</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:700;color:#0c0520;">Tu trabajo ya está listo</h1>
<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#0c0520;">Hola <strong>{{recipient_name}}</strong>, te avisamos que el trabajo de laboratorio{{for_patient}} ya llegó a la clínica:</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;margin:0 0 24px;background:#faf8fd;border:1px solid #e4e0eb;border-left:3px solid #4b1d95;border-radius:12px;"><tr><td style="padding:14px 18px;vertical-align:top;border-bottom:1px solid #efedf3;"><div style="font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6d6d78;margin:0 0 3px;">Trabajo</div><div style="font-size:14px;font-weight:600;color:#0c0520;">{{lab_work}}</div></td></tr><tr><td style="padding:14px 18px;vertical-align:top;"><div style="font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6d6d78;margin:0 0 3px;">Profesional</div><div style="font-size:14px;font-weight:600;color:#0c0520;">{{lab_doctor_name}}</div></td></tr></table>
<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#0c0520;">Comunicate con nosotros para coordinar la próxima cita.</p>
<p style="margin:0 0 24px;"><a href="{{clinic_phone_link}}" style="display:inline-block;background:#4b1d95;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 22px;border-radius:10px;">Llamar a la clínica</a></p>
<p style="margin:0;font-size:12px;line-height:1.6;color:#6d6d78;">Si ya coordinaste tu cita, ignorá este mensaje.</p>$tpl$,
       true,
       (SELECT u.id FROM public.users u
        LEFT JOIN public.user_roles ur ON ur.user_id = u.id
        LEFT JOIN public.roles ro ON ro.id = ur.role_id
        ORDER BY (LOWER(TRIM(ro.name)) = 'administrador') DESC NULLS LAST, u.id
        LIMIT 1)
FROM public.alert_categories c
WHERE c.code = 'LAB_ORDERS'
  AND NOT EXISTS (SELECT 1 FROM public.communication_templates t WHERE t.code = 'LAB_ORDER_READY');

-- ─── 3. Regla ────────────────────────────────────────────────────────────────
-- Regla común (no "gestionada"): se edita en /alert-rules. Si alguien la
-- desactiva, no sale ningún aviso.

INSERT INTO public.alert_rules (
    category_id, code, name, description, priority, source_table, condition_config,
    days_before, days_after, recurrence_type, auto_send_email, auto_send_sms,
    email_template_id, is_active, created_by)
SELECT c.id,
       'LAB_ORDER_READY',
       'Orden de laboratorio lista: avisar al paciente',
       'Avisa al paciente cuando su orden de laboratorio llega a una etapa final. Sale en el momento desde el flujo Lab Orders; la condición ready_date = HOY solo sirve para que "Ejecutar ahora" recupere las de hoy sin aviso. Para WhatsApp, elegir una plantilla aprobada.',
       'MEDIUM',
       'v_alert_lab_orders_ready',
       jsonb_build_object(
           'conditions', jsonb_build_array(
               jsonb_build_object('column', 'ready_date', 'operator', '=', 'value', '{{TODAY}}')),
           'table_id_field', jsonb_build_object('name', 'id', 'type', 'integer'),
           'user_id_field', 'patient_id',
           'event_field', 'ready_at',
           'reference_table', 'lab_orders'),
       0, 0, 'DAILY', true, false,
       (SELECT t.id FROM public.communication_templates t WHERE t.code = 'LAB_ORDER_READY'),
       true,
       (SELECT u.id FROM public.users u
        LEFT JOIN public.user_roles ur ON ur.user_id = u.id
        LEFT JOIN public.roles ro ON ro.id = ur.role_id
        ORDER BY (LOWER(TRIM(ro.name)) = 'administrador') DESC NULLS LAST, u.id
        LIMIT 1)
FROM public.alert_categories c
WHERE c.code = 'LAB_ORDERS'
  AND NOT EXISTS (SELECT 1 FROM public.alert_rules ar WHERE ar.code = 'LAB_ORDER_READY');

-- ─── 4. Alerta en el momento ─────────────────────────────────────────────────
-- Devuelve una fila por alerta NUEVA (ninguna si la regla está inactiva, la
-- orden no está en una etapa final o ya tenía aviso por esta llegada), con
-- lo que el flujo necesita para llamar a los subflujos de envío.

CREATE OR REPLACE FUNCTION public.lab_order_ready_alert(p_order_id integer)
RETURNS SETOF jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_rule  public.alert_rules%ROWTYPE;
    v_order public.v_alert_lab_orders_ready%ROWTYPE;
    v_id    integer;
BEGIN
    SELECT * INTO v_rule FROM public.alert_rules r WHERE r.code = 'LAB_ORDER_READY' AND r.is_active;
    IF NOT FOUND THEN
        RETURN;
    END IF;

    SELECT * INTO v_order FROM public.v_alert_lab_orders_ready v WHERE v.id = p_order_id;
    IF NOT FOUND OR v_order.patient_id IS NULL THEN
        RETURN;
    END IF;

    -- Mismas columnas y anti-duplicado que el Alert Scheduler (modo "event"
    -- sobre ready_at: occurrence_key = to_jsonb(fila)->>'ready_at').
    INSERT INTO public.alert_instances (
        rule_id, reference_table, reference_id, patient_id, alert_date, event_date,
        title, priority, details_json, status, summary, occurrence_key)
    SELECT
        v_rule.id,
        'lab_orders',
        v_order.id::text,
        v_order.patient_id,
        v_order.ready_date,
        v_order.ready_at,
        v_rule.name,
        v_rule.priority,
        jsonb_build_object(
            'data', to_jsonb(v_order),
            'patient', jsonb_build_object(
                'full_name', u.name,
                'email', u.email,
                'phone', COALESCE(NULLIF(u.phone_number, ''), CASE WHEN u.is_dependant THEN NULLIF(r.phone_number, '') END),
                'phone_from_responsible', (NULLIF(u.phone_number, '') IS NULL AND COALESCE(u.is_dependant, false) AND NULLIF(r.phone_number, '') IS NOT NULL),
                'responsible_name', r.name,
                'document_id', u.identity_document),
            'clinic', (SELECT jsonb_build_object('name', c.name, 'address', c.address, 'phone', c.phone, 'email', c.email)
                       FROM public.clinic c ORDER BY c.id LIMIT 1)),
        'PENDING',
        format('Orden de laboratorio #%s lista: %s', v_order.id, NULLIF(v_order.work, '')),
        to_jsonb(v_order)->>'ready_at'
    FROM public.users u
    LEFT JOIN public.users r ON r.id = u.responsible_contact_id
    WHERE u.id = v_order.patient_id
    ON CONFLICT (rule_id, reference_table, reference_id, occurrence_key) DO NOTHING
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
        RETURN;
    END IF;

    RETURN NEXT jsonb_build_object(
        'id', v_id,
        'rule_id', v_rule.id,
        'patient_id', v_order.patient_id,
        'reference_table', 'lab_orders',
        'reference_id', v_order.id::text,
        'auto_send_email', COALESCE(v_rule.auto_send_email, false),
        'auto_send_sms', COALESCE(v_rule.auto_send_sms, false),
        'email_template_id', v_rule.email_template_id,
        'whatsapp_template_id', v_rule.whatsapp_template_id,
        -- Interruptor general (script 133), como "Select alert rules" del Scheduler.
        'email_auto_send_globally_enabled',
            COALESCE((SELECT LOWER(sc.value) FROM public.system_configurations sc
                      WHERE sc.key = 'alert_email_auto_send_enabled' LIMIT 1), 'false') = 'true');
END;
$$;

COMMENT ON FUNCTION public.lab_order_ready_alert(integer) IS
    'Crea la alerta LAB_ORDER_READY de una orden que llegó a una etapa final (flujo Lab Orders, después de cambiar de etapa). Devuelve la alerta nueva y los datos para despachar email/WhatsApp; nada si la regla está inactiva o ya había aviso.';

-- ─── 5. Cierre de avisos no enviados ─────────────────────────────────────────
-- Copia de 169 + LAB_ORDER_READY: si la orden cambia de etapa o se elimina,
-- el aviso que siga PENDIENTE (no se pudo enviar) ya no corresponde.

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
                               WHEN r.code IN ('LAB_STAGE_OVERDUE', 'LAB_ORDER_READY') THEN 'Cerrada: la orden cambió de etapa.'
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

-- ─── Registro de migración ────────────────────────────────────────────────────

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '174_20261113_lab-order-ready-patient-alert.sql',
    'v1',
    'Aviso al paciente al llegar la orden de laboratorio a una etapa final: vista v_alert_lab_orders_ready, plantilla y regla LAB_ORDER_READY (activa, email), lab_order_ready_alert(order) y cierre de avisos pendientes en lab_order_alerts_resolve'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;
