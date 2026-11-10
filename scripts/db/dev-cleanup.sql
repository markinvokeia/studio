-- =============================================================================
-- dev-cleanup.sql — Vacía la base de DEV de datos importados, E2E y basura.
--
-- Se pega entero en el Query Tool de pgAdmin y se ejecuta con F5. Corre en una
-- sola transacción y al final muestra los conteos antes/después. Si algo falla
-- no queda nada a medias (ejecutar ROLLBACK; antes de reintentar).
-- Para probar sin aplicar, cambiar el COMMIT del final por ROLLBACK.
--
-- Qué CONSERVA:
--   * Configuración: clínica, sedes, cajas, métodos de pago, roles/permisos,
--     plantillas, reglas de alertas, feriados (clinic_exceptions), calendarios,
--     categorías de ingresos/egresos, unidades de medida, catálogo de ayuda,
--     ajustes de nómina, db_migrations.
--   * Solo estos usuarios (con sus roles, preferencias y disponibilidad):
--       system@invokeia.com, agente-whatsapp@sistema.invokeia.invalid,
--       raidel@invokeia.com (E2E_USER), markmm82@gmail.com
--
-- Qué BORRA:
--   * Todo lo transaccional: citas, sesiones (clínicas, odontograma, estéticas,
--     periodontograma), presupuestos/órdenes/facturas/pagos, cajas abiertas y
--     movimientos, órdenes de estudio y de laboratorio, historia clínica,
--     recetas, notificaciones, recordatorios, notas, alertas disparadas,
--     conversaciones/WhatsApp, nómina, logs y auditoría.
--   * Todos los demás usuarios (pacientes importados, Etest, Dr. E2E, etc.).
--   * Catálogo de servicios, padecimientos y medicamentos (los recrea el seed).
--   * Entradas E2E de calendarios, métodos de pago, unidades de medida y
--     condiciones/superficies dentales.
--   * Reinicia los contadores de numeración (INV-, PAY-, QUO-, ORD-, CNT-).
--
-- Nota: TRUNCATE va sin CASCADE a propósito. Si una tabla que no está en la
-- lista referencia a una que sí, Postgres aborta en vez de vaciarla en silencio.
-- =============================================================================

BEGIN;
SET LOCAL lock_timeout = '15s';

-- -----------------------------------------------------------------------------
-- 0. Usuarios a conservar
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE _keep_users ON COMMIT DROP AS
SELECT id, lower(email) AS email
FROM users
WHERE lower(email) IN (
  'system@invokeia.com',
  'agente-whatsapp@sistema.invokeia.invalid',
  'raidel@invokeia.com',
  'markmm82@gmail.com'
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM _keep_users WHERE email = 'system@invokeia.com') THEN
    RAISE EXCEPTION 'No existe el usuario system@invokeia.com: abortando';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM _keep_users WHERE email = 'raidel@invokeia.com') THEN
    RAISE EXCEPTION 'No existe el usuario E2E raidel@invokeia.com: abortando';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 1. Conteo previo (tabla temporal de sesión: sobrevive al COMMIT para el resumen)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS pg_temp._counts;
CREATE TEMP TABLE _counts (tbl text PRIMARY KEY, before bigint, after bigint);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','user_roles','appointments','sesiones_clinicas','sesiones','aesthetic_sessions',
    'perio_exams','quotes','orders','invoices','payments','cash_sessions','cash_movements',
    'service_catalog','catalogo_padecimientos','catalogo_medicamentos','catalogo_condiciones_dentales',
    'catalogo_superficies_dentales','calendar_sources','payment_methods','measurement_units',
    'groups','notifications','reminders','study_orders','lab_orders','user_balances',
    'audit_log','n8n_chat_histories','alert_instances','alert_schedule_runs'
  ] LOOP
    EXECUTE format('INSERT INTO _counts(tbl, before) SELECT %L, count(*) FROM %I', t, t);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Desactivar triggers de auditoría mientras se borra (se truncan al final).
--    Se reactivan antes del COMMIT/ROLLBACK; ALTER TABLE es transaccional.
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE _audit_triggers ON COMMIT DROP AS
SELECT t.tgrelid::regclass AS tbl, t.tgname
FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
WHERE NOT t.tgisinternal
  AND t.tgenabled <> 'D'
  AND t.tgrelid::regclass::text NOT LIKE 'pg_%'
  AND (t.tgname ILIKE '%audit%' OR p.proname = 'log_changes_function');

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM _audit_triggers LOOP
    EXECUTE format('ALTER TABLE %s DISABLE TRIGGER %I', r.tbl, r.tgname);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 3. Vaciar todo lo transaccional
-- -----------------------------------------------------------------------------
TRUNCATE TABLE
  -- agenda
  appointments, appointment_service_catalog, appointment_action_tokens, appointment_status_log,
  ai_generated_appointments,
  -- sesiones clínicas / odontograma / periodontograma / estética
  sesiones, fotos_odontograma_sesion,
  sesiones_clinicas, archivos_adjuntos_sesion, tratamientos_sesion,
  odontogramas, hallazgos_odontograma, periodontogramas, datos_periodontograma,
  perio_exams, perio_teeth, perio_sites, perio_exam_events, perio_exam_amendments,
  aesthetic_sessions, aesthetic_consent_signatures, aesthetic_consents, aesthetic_layers,
  aesthetic_marks, aesthetic_photos, aesthetic_service_consents, aesthetic_session_events,
  aesthetic_session_notes,
  -- ventas y caja
  quotes, quote_items, orders, order_items, invoices, invoice_items, invoice_allocations,
  payments, payment_allocations, user_balances,
  cash_sessions, cash_session_currencies, cash_movements,
  miscellaneous_transactions, miscellaneous_attachments,
  -- tratamientos secuenciales
  treatment_sequences, treatment_seq_steps, sequence_notes, abandonment_alerts,
  -- configuración por servicio (se recrea con el catálogo)
  treatment_steps, user_services, service_aesthetic_config, service_consent_templates,
  study_order_options, group_services,
  -- órdenes de estudio y laboratorio
  study_orders, study_order_booking_tokens, study_order_events, study_order_items,
  study_order_review_items, whatsapp_order_intakes,
  lab_orders, lab_order_items, lab_order_stage_history,
  -- historia clínica y recetas
  patient_prescriptions, patient_prescription_items, historial_medicamentos_paciente,
  patient_medical_instructions, alergias_paciente, antecedentes_personales,
  antecedentes_familiares, habitos_paciente,
  catalogo_padecimientos, catalogo_medicamentos,
  -- notificaciones, recordatorios, notas, alertas disparadas
  notifications, reminders, reminder_series, sticky_notes,
  alert_instances, alert_actions, alert_schedule_runs,
  -- grupos (todos importados)
  groups, group_patients, groups_prov, group_provider,
  -- conversaciones / WhatsApp / agente
  conversations, messages, conversation_audit_logs, chat_registered, mensajes_entrada,
  mensajes_prueba, n8n_chat_histories,
  whatsapp_inbound_buffer, whatsapp_inbound_dedupe, whatsapp_conversation_messages,
  whatsapp_conversation_activity, whatsapp_agent_chat_memory,
  -- nómina (datos; se conservan ajustes, categorías, conceptos y calendario laboral)
  payroll_entries, payroll_periods, payroll_documents, payroll_honorarios,
  payroll_session_assignments, payroll_manual_adjustments, payroll_work_log,
  payroll_ausencias, payroll_portal_requests, payroll_egresos, payroll_retentions,
  payroll_family_charges, payroll_employments, payroll_employees, payroll_contracts,
  -- logs
  audit_log, access_logs, logout_log, token_blacklist, error_logs, hook_execution_log,
  log_cotizaciones_json, onboarding_progress, help_support_tickets, help_video_requests
RESTART IDENTITY;

-- -----------------------------------------------------------------------------
-- 4. Reasignar referencias a usuarios que se van, en tablas que se conservan
--    (create_uid/write_uid de roles, updated_by de configuración, etc.).
--    Columna nullable → NULL; NOT NULL → usuario __system__.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  r record;
  v_sys uuid := (SELECT id FROM _keep_users WHERE email = 'system@invokeia.com');
  n bigint;
BEGIN
  FOR r IN
    SELECT con.conrelid::regclass AS tbl, a.attname AS col, a.attnotnull AS notnull
    FROM pg_constraint con
    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
    WHERE con.contype = 'f'
      AND con.confrelid = 'public.users'::regclass
      AND con.conrelid <> 'public.users'::regclass
      AND con.confdeltype IN ('a', 'r')   -- NO ACTION / RESTRICT
  LOOP
    IF r.notnull THEN
      EXECUTE format('UPDATE %s SET %I = $1 WHERE %I NOT IN (SELECT id FROM _keep_users)', r.tbl, r.col, r.col)
        USING v_sys;
    ELSE
      EXECUTE format('UPDATE %s SET %I = NULL WHERE %I IS NOT NULL AND %I NOT IN (SELECT id FROM _keep_users)', r.tbl, r.col, r.col, r.col);
    END IF;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN RAISE NOTICE 'reasignadas % filas en %.%', n, r.tbl, r.col; END IF;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 5. Borrar usuarios (cascada: roles, preferencias, disponibilidad, calendarios…)
-- -----------------------------------------------------------------------------
UPDATE users SET responsible_contact_id = NULL, is_dependant = false, doctor_id = NULL
WHERE id IN (SELECT id FROM _keep_users);

DELETE FROM users WHERE id NOT IN (SELECT id FROM _keep_users);

-- -----------------------------------------------------------------------------
-- 6. Catálogos: servicios fuera (los recrea el seed) y restos E2E en el resto
-- -----------------------------------------------------------------------------
DELETE FROM service_catalog;   -- clinic.patient_portal_default_service_id → NULL (ON DELETE SET NULL)
SELECT setval(pg_get_serial_sequence('service_catalog', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('catalogo_padecimientos', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('catalogo_medicamentos', 'id'), 1, false);

DELETE FROM catalogo_condiciones_dentales WHERE nombre ~* '(e2e|etest)';
DELETE FROM catalogo_superficies_dentales WHERE nombre ~* '(e2e|etest)' OR codigo ~* '(e2e|etest)';
DELETE FROM calendar_sources WHERE name ~* '(e2e|etest|prueba|test)';
DELETE FROM payment_methods WHERE name ~* '(e2e|etest)';
DELETE FROM measurement_units WHERE code ~* '^e2e' OR name ~* '(e2e|etest)';

-- Numeración de documentos desde 1
UPDATE sequences SET current_counter = 1, updated_at = now();

-- -----------------------------------------------------------------------------
-- 7. Reactivar auditoría y vaciar lo que haya quedado en ella
-- -----------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM _audit_triggers LOOP
    EXECUTE format('ALTER TABLE %s ENABLE TRIGGER %I', r.tbl, r.tgname);
  END LOOP;
END $$;

TRUNCATE TABLE audit_log RESTART IDENTITY;

-- -----------------------------------------------------------------------------
-- 8. Resultado
-- -----------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tbl FROM _counts LOOP
    EXECUTE format('UPDATE _counts SET after = (SELECT count(*) FROM %I) WHERE tbl = %L', t, t);
  END LOOP;
END $$;

COMMIT;   -- cambiar por ROLLBACK para probar sin aplicar

-- Resumen (pgAdmin muestra el resultado de esta última consulta)
SELECT tbl, before, after, before - after AS removed FROM _counts ORDER BY before DESC;
