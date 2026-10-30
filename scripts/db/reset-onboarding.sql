-- =====================================================================
-- Resetea un entorno para que el asistente pida el onboarding desde cero.
--
-- Borra los datos de la clínica (sedes, horarios, consultorios, profesionales,
-- servicios, citas, pacientes, facturación, caja, mensajes, logs...) y deja
-- vacío el nombre de la clínica. Conserva los catálogos y la configuración del
-- sistema (roles, permisos, plantillas, secuencias, licencias, catálogo y
-- videos de ayuda) y el/los usuario(s) que van a hacer el onboarding.
--
-- Después del reset, help_onboarding_compute() da como pendientes todos los
-- pasos obligatorios del recorrido y el asistente lo anuncia al entrar.
--
-- ATENCION: IRREVERSIBLE con c_apply = true. Pensado para entornos de demo/QA. Nunca en prod.
--
-- Uso (SQL puro: pgAdmin, DBeaver o psql):
--   1. Completá la CONFIGURACIÓN de abajo.
--   2. Ejecutalo con c_apply = false (SIMULACIÓN): hace todo, muestra el
--      resultado en Mensajes y al final lo deshace con un error a propósito
--      ("SIMULACIÓN: no se cambió nada").
--   3. Si el resultado es el esperado, poné c_apply = true y ejecutalo de nuevo.
--
-- Requiere un rol con permiso para cambiar session_replication_role
-- (superusuario, o desde PG15 con GRANT SET ON PARAMETER): se borra con los
-- triggers apagados (auditoría, recálculo de saldos, pg_notify de citas) y,
-- antes de terminar, se verifica que no haya quedado ninguna referencia rota;
-- si queda alguna, se aborta y no se cambia nada.
-- =====================================================================

DO $reset$
DECLARE
    -- ===================== CONFIGURACIÓN =====================
    -- Usuarios a conservar (conservan sus roles; todo lo demás de ellos se borra).
    c_keep_emails text[] := ARRAY['system@invokeia.com'];
    -- false = simulación (no cambia nada) - true = aplicar
    c_apply boolean := false;
    -- Catálogos y configuración del sistema que no se vacían. users y
    -- user_roles se vacían salvo las filas de los usuarios conservados; el
    -- resto de las tablas de public se vacía.
    c_keep_tables text[] := ARRAY[
        -- acceso
        'roles', 'permissions', 'role_permissions', 'role_channel_permissions',
        -- configuración general
        'clinic', 'clinic_preferences', 'system_configurations', 'licenses', 'subscriptions',
        'alert_system_config', 'alert_categories', 'alert_rules', 'hook_registry',
        'calendar_color_source', 'calendar_status_display',
        -- comunicación y documentos
        'communication_templates', 'communication_channels', 'notification_categories',
        'notification_platforms', 'global_notification_settings', 'doc_print_templates',
        'medical_instruction_templates', 'prescription_templates', 'sequences',
        -- catálogos
        'miscellaneous_categories', 'lab_stages', 'mutual_societies',
        'catalogo_condiciones_dentales', 'catalogo_medicamentos', 'catalogo_padecimientos',
        'catalogo_superficies_dentales',
        'payroll_settings', 'payroll_categories', 'payroll_concepts',
        -- asistente de ayuda (el catálogo y los videos siguen sirviendo)
        'help_catalog_items', 'help_catalog_syncs', 'help_videos',
        -- infraestructura
        'db_migrations', 'databasechangeloglock', '_bk_sede_backfill_20260801'
    ];
    -- ==========================================================

    r record;
    t text;
    v_keeper text;
    v_scope text;
    v_rows bigint;
    v_problems text := '';
BEGIN
    SET LOCAL statement_timeout = 0;
    SET LOCAL lock_timeout = '15s';

    -- -------------------------------------------------------------------
    -- 1. Controles previos
    -- -------------------------------------------------------------------
    -- La base no puede ser la de n8n: se vaciarían sus flujos y credenciales.
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public'
                AND tablename IN ('workflow_entity', 'credentials_entity', 'execution_entity')) THEN
        RAISE EXCEPTION 'Esta base tiene las tablas internas de n8n en public: el reset vaciaría sus flujos y credenciales. Abortado.';
    END IF;

    CREATE TEMP TABLE _reset_keep_users ON COMMIT DROP AS
    SELECT u.id
      FROM public.users u
     WHERE lower(u.email) = ANY (SELECT lower(btrim(e)) FROM unnest(c_keep_emails) e);

    IF NOT EXISTS (SELECT 1 FROM _reset_keep_users) THEN
        RAISE EXCEPTION 'Ningún usuario de c_keep_emails existe en este entorno: no se borra nada.';
    END IF;

    -- Si el que hace el onboarding es médico, el paso "Profesionales" ya queda cumplido.
    IF EXISTS (
        SELECT 1 FROM public.user_roles ur JOIN public.roles ro ON ro.id = ur.role_id
         WHERE ur.user_id IN (SELECT id FROM _reset_keep_users)
           AND (ro.id::text = '2' OR lower(ro.name) IN ('doctor', 'médico', 'medico', 'odontólogo', 'odontologo'))
    ) THEN
        RAISE WARNING 'Un usuario conservado tiene rol de médico: el paso "Profesionales" del onboarding seguirá cumplido.';
    END IF;

    -- -------------------------------------------------------------------
    -- 2. Tablas a vaciar y claves foráneas
    -- -------------------------------------------------------------------
    CREATE TEMP TABLE _reset_wipe ON COMMIT DROP AS
    SELECT c.relname::text AS name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind IN ('r', 'p')
       AND c.relname::text <> ALL (c_keep_tables);

    -- Claves foráneas de una columna (no hay de varias columnas en el esquema;
    -- si apareciera alguna, el control del paso 5 la cubre igual).
    CREATE TEMP TABLE _reset_fks ON COMMIT DROP AS
    SELECT ch.relname::text AS child,
           ca.attname::text AS child_col,
           ca.attnotnull    AS child_notnull,
           pa.relname::text AS parent,
           pk.attname::text AS parent_col,
           format_type(pk.atttypid, pk.atttypmod) AS parent_type
      FROM pg_constraint con
      JOIN pg_class ch ON ch.oid = con.conrelid
      JOIN pg_class pa ON pa.oid = con.confrelid
      JOIN pg_attribute ca ON ca.attrelid = con.conrelid AND ca.attnum = con.conkey[1]
      JOIN pg_attribute pk ON pk.attrelid = con.confrelid AND pk.attnum = con.confkey[1]
     WHERE con.contype = 'f'
       AND con.connamespace = 'public'::regnamespace
       AND array_length(con.conkey, 1) = 1;

    CREATE TEMP TABLE _reset_report (step text, tbl text, detail text, n_rows bigint) ON COMMIT DROP;

    -- -------------------------------------------------------------------
    -- 3. Lo que se conserva deja de apuntar a lo que se borra
    --    - a un usuario borrado -> al primer usuario conservado (o NULL si se puede)
    --    - a otra fila borrada -> NULL; si la columna es obligatoria, la fila
    --      conservada se borra también (como haría ON DELETE CASCADE)
    -- -------------------------------------------------------------------
    SELECT id::text INTO v_keeper FROM _reset_keep_users ORDER BY id::text LIMIT 1;

    FOR r IN
        SELECT f.*
          FROM _reset_fks f
         WHERE (f.child = ANY (c_keep_tables) OR f.child IN ('users', 'user_roles'))
           AND f.parent IN (SELECT name FROM _reset_wipe)
    LOOP
        -- En users/user_roles sólo importan las filas que quedan.
        v_scope := CASE r.child
            WHEN 'users' THEN ' AND id IN (SELECT id FROM _reset_keep_users)'
            WHEN 'user_roles' THEN ' AND user_id IN (SELECT id FROM _reset_keep_users)'
            ELSE '' END;

        IF r.parent = 'users' THEN
            EXECUTE format(
                'UPDATE public.%I SET %I = %s WHERE %I IS NOT NULL AND %I NOT IN (SELECT id FROM _reset_keep_users)%s',
                r.child, r.child_col,
                CASE WHEN r.child_notnull THEN quote_literal(v_keeper) || '::' || r.parent_type ELSE 'NULL' END,
                r.child_col, r.child_col, v_scope);
            GET DIAGNOSTICS v_rows = ROW_COUNT;
            IF v_rows > 0 THEN
                INSERT INTO _reset_report VALUES ('reasignado', r.child, r.child_col || ' -> ' ||
                    CASE WHEN r.child_notnull THEN 'usuario conservado' ELSE 'NULL' END, v_rows);
            END IF;
        ELSIF r.child_notnull THEN
            EXECUTE format('DELETE FROM public.%I WHERE %I IS NOT NULL%s', r.child, r.child_col, v_scope);
            GET DIAGNOSTICS v_rows = ROW_COUNT;
            IF v_rows > 0 THEN
                INSERT INTO _reset_report VALUES ('borrado (dependía de ' || r.parent || ')', r.child, r.child_col, v_rows);
            END IF;
        ELSE
            EXECUTE format('UPDATE public.%I SET %I = NULL WHERE %I IS NOT NULL%s', r.child, r.child_col, r.child_col, v_scope);
            GET DIAGNOSTICS v_rows = ROW_COUNT;
            IF v_rows > 0 THEN
                INSERT INTO _reset_report VALUES ('reasignado', r.child, r.child_col || ' -> NULL', v_rows);
            END IF;
        END IF;
    END LOOP;

    -- -------------------------------------------------------------------
    -- 4. Borrado, con triggers y controles de FK apagados sólo en esta
    --    transacción (sin auditoría, sin recálculo de saldos, sin pg_notify)
    -- -------------------------------------------------------------------
    PERFORM set_config('session_replication_role', 'replica', true);

    FOR t IN SELECT name FROM _reset_wipe ORDER BY name LOOP
        IF t = 'users' THEN
            DELETE FROM public.users WHERE id NOT IN (SELECT id FROM _reset_keep_users);
        ELSIF t = 'user_roles' THEN
            DELETE FROM public.user_roles WHERE user_id NOT IN (SELECT id FROM _reset_keep_users);
        ELSE
            EXECUTE format('DELETE FROM public.%I', t);
        END IF;
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        IF v_rows > 0 THEN
            INSERT INTO _reset_report VALUES ('vaciado', t, NULL, v_rows);
        END IF;
    END LOOP;

    PERFORM set_config('session_replication_role', 'origin', true);

    -- Paso "Datos del negocio": pendiente hasta que se cargue el nombre de la clínica.
    UPDATE public.clinic SET name = '';

    -- -------------------------------------------------------------------
    -- 5. Control: ninguna referencia rota. Si hay alguna, se aborta todo.
    -- -------------------------------------------------------------------
    FOR r IN SELECT * FROM _reset_fks LOOP
        EXECUTE format(
            'SELECT count(*) FROM public.%I c WHERE c.%I IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.%I p WHERE p.%I = c.%I)',
            r.child, r.child_col, r.parent, r.parent_col, r.child_col)
        INTO v_rows;
        IF v_rows > 0 THEN
            v_problems := v_problems || format(E'\n  %s.%s -> %s: %s fila(s)', r.child, r.child_col, r.parent, v_rows);
        END IF;
    END LOOP;
    IF v_problems <> '' THEN
        RAISE EXCEPTION 'Quedaron referencias rotas; no se cambió nada:%', v_problems;
    END IF;

    -- -------------------------------------------------------------------
    -- 6. Resultado (pestaña Mensajes)
    -- -------------------------------------------------------------------
    RAISE NOTICE '== Usuarios conservados';
    FOR r IN
        SELECT u.email, string_agg(ro.name, ', ' ORDER BY ro.name) AS roles
          FROM public.users u
          LEFT JOIN public.user_roles ur ON ur.user_id = u.id
          LEFT JOIN public.roles ro ON ro.id = ur.role_id
         WHERE u.id IN (SELECT id FROM _reset_keep_users)
         GROUP BY u.email
    LOOP
        RAISE NOTICE '  % (%)', r.email, coalesce(r.roles, 'sin roles');
    END LOOP;

    RAISE NOTICE '== Cambios';
    FOR r IN SELECT * FROM _reset_report ORDER BY step, n_rows DESC, tbl LOOP
        RAISE NOTICE '  % - % %: % fila(s)', r.step, r.tbl, coalesce('(' || r.detail || ')', ''), r.n_rows;
    END LOOP;

    RAISE NOTICE '== Onboarding después del reset (pendiente = lo que el asistente va a pedir)';
    FOR r IN SELECT * FROM public.help_onboarding_compute() LOOP
        RAISE NOTICE '  % %', rpad(r.step_id, 18), CASE WHEN r.done THEN 'cumplido (' || r.item_count || ')' ELSE 'PENDIENTE' END;
    END LOOP;

    IF NOT c_apply THEN
        -- El error deshace todo lo anterior: los mensajes de arriba son la vista previa.
        RAISE EXCEPTION 'SIMULACIÓN: no se cambió nada. Para aplicarlo poné c_apply := true y ejecutalo de nuevo.';
    END IF;

    RAISE NOTICE 'APLICADO. En el navegador abrí una ventana nueva (o volvé a iniciar sesión) para que el asistente anuncie el onboarding.';
END
$reset$;
