-- =====================================================================
-- Auditoría: created_by / updated_by (Tier 1) + fix de audit_log.changed_by
-- Run on: dev / staging / prod
-- Idempotente: se puede correr varias veces sin efectos secundarios.
-- =====================================================================
--
-- Contexto (verificado en DEV antes de escribir esto):
--   El trigger genérico log_changes_function() ya está en uso en users,
--   roles, permissions, clinics, system_configurations, service_catalog,
--   user_roles, user_clinics, user_services, access_logs, role_permissions.
--   Depende de current_setting('app.current_user_id', true) para saber
--   quién hizo el cambio, pero ningún workflow de n8n en este repo setea
--   esa variable de sesión -> audit_log.changed_by viene NULL en el 100%
--   de las filas existentes.
--
--   Decisión: para Tier 1 NO vamos a depender de esa variable de sesión.
--   Cada workflow n8n de escritura va a mapear created_by/updated_by de
--   forma explícita (jwtPayload.userId), igual patrón ya probado en
--   reminders-upsert/sticky-notes/miscellaneous. Es el mismo esfuerzo por
--   workflow que agregar un SELECT set_config(...), pero sin depender de
--   que la query y el set_config compartan conexión/transacción, y se
--   mapea directo en el nodo Postgres de n8n sin tocar SQL crudo.
--
-- Cambios:
--   1. stamp_actor_columns(): función genérica BEFORE INSERT/UPDATE que YA
--      NO lee ninguna variable de sesión. Es solo un guardia de integridad:
--      en INSERT, si el workflow solo mandó created_by, copia ese valor a
--      updated_by; en UPDATE, fuerza created_by = OLD.created_by pase lo
--      que pase en el payload (nadie puede pisar quién creó el registro).
--      El resto del trabajo (llenar created_by/updated_by con el actor
--      real) es 100% responsabilidad de cada workflow n8n.
--   2. log_changes_function(): se modifica SOLO el cálculo de changed_by
--      para preferir NEW/OLD.updated_by / .created_by (la fila, llenada
--      por el propio workflow n8n) y caer a current_setting(...) como
--      último fallback para las tablas que no tienen esas columnas (Tier
--      2, sin tocar en este script). El diff old_value/new_value NO
--      cambia, sigue igual que hoy. Este cambio es compartido por TODAS
--      las tablas que ya usan el trigger, se benefician automáticamente
--      y no rompe nada porque hoy siempre daba NULL.
--   3. Columnas created_by/updated_by (uuid, FK a users(id) ON DELETE SET
--      NULL) + índices + los dos triggers (stamp + audit) en las tablas
--      "Tier 1": appointments, clínico (odontogramas, sesiones, historia
--      clínica, tratamientos, study orders, prescripciones) y financiero
--      (quotes, invoices, payments, cash, miscellaneous_transactions).
--   4. users: caso especial, solo columnas + trigger BEFORE (el AFTER ya
--      existe como users_audit_trigger y usa la función actualizada en 2).
--   5. invoice_allocations.created_by ya existía pero sin FK -> se agrega.
--   6. IMPORTANTE - pendiente fuera de este script: cada workflow n8n de
--      escritura sobre estas tablas necesita mapear created_by (solo en
--      INSERT) y updated_by (en todo INSERT/UPDATE) a jwtPayload.userId.
--      Sin eso, las columnas quedan NULL igual que hoy.
-- =====================================================================

BEGIN;

-- ─── 1. Función genérica: guardia de integridad (no lee sesión) ───────────

CREATE OR REPLACE FUNCTION public.stamp_actor_columns()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW.updated_by := COALESCE(NEW.updated_by, NEW.created_by);
    ELSIF TG_OP = 'UPDATE' THEN
        NEW.created_by := OLD.created_by; -- inmutable, pase lo que pase en el payload
    END IF;
    RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.stamp_actor_columns() IS
    'Guardia de integridad para created_by/updated_by: no lee sesion. En INSERT copia created_by a updated_by si el workflow no lo mando; en UPDATE impide que created_by se pise. El actor real lo mapea cada workflow n8n explicitamente.';

-- ─── 2. log_changes_function(): changed_by ahora sale primero de la fila ──

CREATE OR REPLACE FUNCTION public.log_changes_function()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$DECLARE
    v_changed_by_user_id UUID;
    v_ip_address INET;
    v_session_id UUID;

    v_record_id_jsonb JSONB := '{}'::jsonb;
    v_pk_column_name TEXT;
    v_pk_column_value JSONB;

    v_old_row_json JSON;
    v_new_row_json JSON;
    v_key TEXT;

    v_old_values_jsonb JSONB := '{}'::jsonb;
    v_new_values_jsonb JSONB := '{}'::jsonb;

BEGIN
    -- 1. Actor: primero la propia fila (created_by/updated_by, recien
    --    completados por stamp_actor_columns() si la tabla los tiene);
    --    si no existen esas columnas, cae a la variable de sesion.
    v_changed_by_user_id := COALESCE(
        (to_jsonb(CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END) ->> 'updated_by')::UUID,
        (to_jsonb(CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END) ->> 'created_by')::UUID,
        current_setting('app.current_user_id', true)::UUID
    );
    v_ip_address := current_setting('app.current_ip_address', true)::INET;
    v_session_id := current_setting('app.current_session_id', true)::UUID;

    -- 2. Construccion dinamica del record_id a partir de los argumentos del TRIGGER.
    FOR i IN 0 .. TG_NARGS - 1 LOOP
        v_pk_column_name := TG_ARGV[i];
        IF (TG_OP = 'INSERT') THEN
            v_pk_column_value := to_jsonb(NEW) -> v_pk_column_name;
        ELSE
            v_pk_column_value := to_jsonb(OLD) -> v_pk_column_name;
        END IF;
        v_record_id_jsonb := v_record_id_jsonb || jsonb_build_object(v_pk_column_name, v_pk_column_value);
    END LOOP;

    -- 3. Logica principal de auditoria (sin cambios respecto a la version anterior)
    IF (TG_OP = 'UPDATE') THEN
        v_old_row_json := to_json(OLD);
        v_new_row_json := to_json(NEW);

        FOR v_key IN SELECT json_object_keys(v_new_row_json)
        LOOP
            IF ((v_new_row_json ->> v_key) IS DISTINCT FROM (v_old_row_json ->> v_key) AND v_key <> 'updated_at') THEN
                v_old_values_jsonb := v_old_values_jsonb || jsonb_build_object(v_key, v_old_row_json -> v_key);
                v_new_values_jsonb := v_new_values_jsonb || jsonb_build_object(v_key, v_new_row_json -> v_key);
            END IF;
        END LOOP;

        IF v_new_values_jsonb <> '{}'::jsonb THEN
             INSERT INTO audit_log (table_name, record_id, operation, old_value, new_value, changed_by, ip_address, session_id)
             VALUES (TG_TABLE_NAME, v_record_id_jsonb::TEXT, 'UPDATE', v_old_values_jsonb::TEXT, v_new_values_jsonb::TEXT, v_changed_by_user_id, v_ip_address, v_session_id);
        END IF;

        RETURN NEW;

    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO audit_log (table_name, record_id, operation, old_value, new_value, changed_by, ip_address, session_id)
        VALUES (TG_TABLE_NAME, v_record_id_jsonb::TEXT, 'DELETE', to_jsonb(OLD)::TEXT, NULL, v_changed_by_user_id, v_ip_address, v_session_id);
        RETURN OLD;

    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO audit_log (table_name, record_id, operation, old_value, new_value, changed_by, ip_address, session_id)
        VALUES (TG_TABLE_NAME, v_record_id_jsonb::TEXT, 'INSERT', NULL, to_jsonb(NEW)::TEXT, v_changed_by_user_id, v_ip_address, v_session_id);
        RETURN NEW;
    END IF;

    RETURN NULL;
END;$function$;

-- ─── 3. Tier 1: columnas + indices + triggers ──────────────────────────────

DO $$
DECLARE
    v_table TEXT;
    v_tables TEXT[] := ARRAY[
        'appointments', 'sesiones', 'sesiones_clinicas', 'tratamientos_sesion',
        'patient_medical_instructions', 'patient_prescriptions', 'patient_prescription_items',
        'treatment_sequences', 'treatment_seq_steps', 'treatment_steps',
        'study_orders', 'study_order_items', 'study_order_options',
        'alergias_paciente', 'antecedentes_familiares', 'antecedentes_personales',
        'habitos_paciente', 'historial_medicamentos_paciente',
        'quotes', 'quote_items',
        'invoices', 'invoice_items', 'invoice_allocations',
        'payments', 'payment_allocations',
        'cash_sessions', 'cash_movements', 'miscellaneous_transactions'
    ];
BEGIN
    FOREACH v_table IN ARRAY v_tables LOOP
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL', v_table);
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL', v_table);

        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (created_by)', 'idx_' || v_table || '_created_by', v_table);
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (updated_by)', 'idx_' || v_table || '_updated_by', v_table);

        EXECUTE format('DROP TRIGGER IF EXISTS trg_stamp_actor ON public.%I', v_table);
        EXECUTE format('CREATE TRIGGER trg_stamp_actor BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.stamp_actor_columns()', v_table);

        EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_generic ON public.%I', v_table);
        EXECUTE format('CREATE TRIGGER trg_audit_generic AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_changes_function(''id'')', v_table);
    END LOOP;
END;
$$;

-- ─── 4. users: caso especial (ya tiene un AFTER trigger propio) ───────────

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_created_by ON public.users (created_by);
CREATE INDEX IF NOT EXISTS idx_users_updated_by ON public.users (updated_by);

DROP TRIGGER IF EXISTS trg_stamp_actor ON public.users;
CREATE TRIGGER trg_stamp_actor BEFORE INSERT OR UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.stamp_actor_columns();
-- No se crea un AFTER trigger nuevo: users_audit_trigger ya existe y usa
-- log_changes_function('id'), que quedo actualizada en el paso 2.

-- ─── 5. invoice_allocations.created_by: le faltaba la FK ──────────────────

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_invoice_allocations_created_by'
    ) THEN
        ALTER TABLE public.invoice_allocations
            ADD CONSTRAINT fk_invoice_allocations_created_by
            FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
END;
$$;

-- ─── Registro de migracion ─────────────────────────────────────────────────

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '084_20260915_audit-created-updated-by-tier1.sql',
    'v1',
    'created_by/updated_by (Tier 1: appointments + clinico + financiero) + fix log_changes_function para tomar changed_by de la fila'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;

-- =====================================================================
-- ROLLBACK (manual, si hiciera falta)
-- =====================================================================
-- BEGIN;
--
-- ALTER TABLE public.invoice_allocations DROP CONSTRAINT IF EXISTS fk_invoice_allocations_created_by;
--
-- DROP TRIGGER IF EXISTS trg_stamp_actor ON public.users;
-- ALTER TABLE public.users DROP COLUMN IF EXISTS created_by;
-- ALTER TABLE public.users DROP COLUMN IF EXISTS updated_by;
--
-- DO $$
-- DECLARE
--     v_table TEXT;
--     v_tables TEXT[] := ARRAY[
--         'appointments',
--         'odontogramas', 'hallazgos_odontograma', 'periodontogramas', 'datos_periodontograma',
--         'sesiones', 'sesiones_clinicas', 'tratamientos_sesion',
--         'patient_medical_instructions', 'patient_prescriptions', 'patient_prescription_items',
--         'treatment_sequences', 'treatment_seq_steps', 'treatment_steps',
--         'study_orders', 'study_order_items', 'study_order_options',
--         'alergias_paciente', 'antecedentes_familiares', 'antecedentes_personales',
--         'habitos_paciente', 'historial_medicamentos_paciente',
--         'quotes', 'quote_items',
--         'invoices', 'invoice_items', 'invoice_allocations',
--         'payments', 'payment_allocations',
--         'cash_sessions', 'cash_movements', 'miscellaneous_transactions'
--     ];
-- BEGIN
--     FOREACH v_table IN ARRAY v_tables LOOP
--         EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_generic ON public.%I', v_table);
--         EXECUTE format('DROP TRIGGER IF EXISTS trg_stamp_actor ON public.%I', v_table);
--         EXECUTE format('ALTER TABLE public.%I DROP COLUMN IF EXISTS created_by', v_table);
--         EXECUTE format('ALTER TABLE public.%I DROP COLUMN IF EXISTS updated_by', v_table);
--     END LOOP;
-- END;
-- $$;
--
-- DROP FUNCTION IF EXISTS public.stamp_actor_columns();
--
-- -- Restaura log_changes_function() a la version anterior (solo lee la sesion):
-- CREATE OR REPLACE FUNCTION public.log_changes_function()
--  RETURNS trigger
--  LANGUAGE plpgsql
-- AS $function$DECLARE
--     v_changed_by_user_id UUID;
--     v_ip_address INET;
--     v_session_id UUID;
--     v_record_id_jsonb JSONB := '{}'::jsonb;
--     v_pk_column_name TEXT;
--     v_pk_column_value JSONB;
--     v_old_row_json JSON;
--     v_new_row_json JSON;
--     v_key TEXT;
--     v_old_values_jsonb JSONB := '{}'::jsonb;
--     v_new_values_jsonb JSONB := '{}'::jsonb;
-- BEGIN
--     v_changed_by_user_id := current_setting('app.current_user_id', true)::UUID;
--     v_ip_address := current_setting('app.current_ip_address', true)::INET;
--     v_session_id := current_setting('app.current_session_id', true)::UUID;
--     FOR i IN 0 .. TG_NARGS - 1 LOOP
--         v_pk_column_name := TG_ARGV[i];
--         IF (TG_OP = 'INSERT') THEN
--             v_pk_column_value := to_jsonb(NEW) -> v_pk_column_name;
--         ELSE
--             v_pk_column_value := to_jsonb(OLD) -> v_pk_column_name;
--         END IF;
--         v_record_id_jsonb := v_record_id_jsonb || jsonb_build_object(v_pk_column_name, v_pk_column_value);
--     END LOOP;
--     IF (TG_OP = 'UPDATE') THEN
--         v_old_row_json := to_json(OLD);
--         v_new_row_json := to_json(NEW);
--         FOR v_key IN SELECT json_object_keys(v_new_row_json)
--         LOOP
--             IF ((v_new_row_json ->> v_key) IS DISTINCT FROM (v_old_row_json ->> v_key) AND v_key <> 'updated_at') THEN
--                 v_old_values_jsonb := v_old_values_jsonb || jsonb_build_object(v_key, v_old_row_json -> v_key);
--                 v_new_values_jsonb := v_new_values_jsonb || jsonb_build_object(v_key, v_new_row_json -> v_key);
--             END IF;
--         END LOOP;
--         IF v_new_values_jsonb <> '{}'::jsonb THEN
--              INSERT INTO audit_log (table_name, record_id, operation, old_value, new_value, changed_by, ip_address, session_id)
--              VALUES (TG_TABLE_NAME, v_record_id_jsonb::TEXT, 'UPDATE', v_old_values_jsonb::TEXT, v_new_values_jsonb::TEXT, v_changed_by_user_id, v_ip_address, v_session_id);
--         END IF;
--         RETURN NEW;
--     ELSIF (TG_OP = 'DELETE') THEN
--         INSERT INTO audit_log (table_name, record_id, operation, old_value, new_value, changed_by, ip_address, session_id)
--         VALUES (TG_TABLE_NAME, v_record_id_jsonb::TEXT, 'DELETE', to_jsonb(OLD)::TEXT, NULL, v_changed_by_user_id, v_ip_address, v_session_id);
--         RETURN OLD;
--     ELSIF (TG_OP = 'INSERT') THEN
--         INSERT INTO audit_log (table_name, record_id, operation, old_value, new_value, changed_by, ip_address, session_id)
--         VALUES (TG_TABLE_NAME, v_record_id_jsonb::TEXT, 'INSERT', NULL, to_jsonb(NEW)::TEXT, v_changed_by_user_id, v_ip_address, v_session_id);
--         RETURN NEW;
--     END IF;
--     RETURN NULL;
-- END;$function$;
--
-- DELETE FROM public.db_migrations WHERE script_name = '084_20260915_audit-created-updated-by-tier1.sql';
--
-- COMMIT;
