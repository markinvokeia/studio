-- =====================================================================
-- EJEMPLO: registrar el hook "Recalcular descuentos" en invoice.after_upsert
--
-- ESTO NO ES UNA MIGRACIÓN. No lleva número, no se anota en db_migrations y no
-- va en el changelog de Liquibase.
--
-- Motivo: `handler_ref` es el ID de un workflow de n8n, y ese ID lo genera cada
-- instalación al importar el workflow. Una registración exportada de un cliente
-- no significa nada en otro. Por eso 069_20260828_hooks-registry-and-permissions.sql
-- siembra el CATÁLOGO (hook_events) pero deja hook_registry vacío.
--
-- La vía normal para registrar un hook es la ventana Sistema → Customizaciones,
-- que además guarda el created_by desde el JWT. Este script existe para dos
-- casos donde la ventana no sirve:
--   · aprovisionar una instalación nueva sin entrar a la UI;
--   · probar el dispatcher antes de que los webhooks CRUD estén activos.
--
-- ANTES DE CORRER:
--   1. Aplicar 069_20260828_hooks-registry-and-permissions.sql.
--   2. Importar y ACTIVAR n8n-workflows/hook-example-invoice-recalc-discounts.json.
--   3. Abrirlo en n8n y copiar el ID de la URL:  /workflow/<ESTE-ES-EL-ID>
--   4. Pegarlo abajo en v_handler_ref.
--
-- Idempotente: re-ejecutarlo actualiza la fila existente en vez de duplicarla.
-- =====================================================================

BEGIN;

DO $$
DECLARE
    -- ⬇⬇⬇  LO ÚNICO QUE HAY QUE EDITAR  ⬇⬇⬇
    v_handler_ref  text := 'REEMPLAZAR_POR_EL_ID_DEL_WORKFLOW';
    -- ⬆⬆⬆ ------------------------------- ⬆⬆⬆

    -- Opcional: a quién se le atribuye la registración. NULL es válido y es lo
    -- que corresponde cuando la carga un script de aprovisionamiento y no una
    -- persona. Para atribuirla a alguien concreto:
    --     v_created_by := (SELECT id FROM public.users WHERE email = 'admin@clinica.com');
    v_created_by   uuid := NULL;

    v_event_code   text := 'invoice.after_upsert';
    v_registry_id  uuid;
    -- xmax = 0 distingue la fila recién insertada de la actualizada por el
    -- ON CONFLICT. Sólo se usa para el mensaje.
    v_insertada    boolean;
BEGIN
    -- --------------------------------------------------------------
    -- Guardas. Fallar acá con un mensaje claro es mucho mejor que dejar
    -- registrada una fila que apunta a un workflow inexistente: el dispatcher
    -- la ejecutaría, fallaría, y con on_error='ignore' el error quedaría
    -- enterrado en hook_execution_log sin que nadie lo mire.
    -- --------------------------------------------------------------
    IF v_handler_ref = 'REEMPLAZAR_POR_EL_ID_DEL_WORKFLOW' THEN
        RAISE EXCEPTION
            'Falta reemplazar v_handler_ref por el ID real del sub-workflow de n8n (el que aparece en la URL /workflow/<id>).';
    END IF;

    -- El mismo formato que valida el webhook hooks/registry/upsert.
    IF v_handler_ref !~ '^[A-Za-z0-9_-]{8,40}$' THEN
        RAISE EXCEPTION
            'v_handler_ref = % no parece un ID de workflow de n8n. Se espera algo como "AbCd1234EfGh".', v_handler_ref;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.hook_events WHERE code = v_event_code) THEN
        RAISE EXCEPTION
            'El evento % no existe en el catálogo. Aplicar primero 069_20260828_hooks-registry-and-permissions.sql.', v_event_code;
    END IF;

    -- --------------------------------------------------------------
    -- La registración
    --
    -- mode = 'sync'   → el flujo de facturación espera a que el recálculo
    --                   termine, así la respuesta que recibe el frontend ya
    --                   trae los totales consolidados.
    -- on_error = 'ignore' → si el recálculo falla, la factura NO se cae. Es lo
    --                   correcto para un hook 'after': la operación de negocio
    --                   ya está commiteada y no tiene sentido abortarla.
    -- --------------------------------------------------------------
    INSERT INTO public.hook_registry (
        event_code, clinic_id, name, description,
        handler_type, handler_ref,
        seq, mode, on_error, timeout_ms,
        config, log_enabled, is_active,
        created_by, updated_by
    )
    VALUES (
        v_event_code,
        NULL,                       -- aplica a toda la instalación
        'Recalcular descuentos',
        'Deja invoice_items y la cabecera de invoices coherentes con la política de descuentos de clinic_preferences. Con discount_scope = ''total'' sólo consolida la cabecera, porque el descuento ya viene prorrateado en las líneas.',
        'n8n_workflow',
        v_handler_ref,
        100,                        -- seq
        'sync',
        'ignore',
        30000,                      -- timeout_ms (orientativo: n8n no lo aplica)
        '{}'::jsonb,                -- este hook no necesita parámetros propios
        true,                       -- log_enabled
        true,                       -- is_active
        v_created_by,
        v_created_by
    )
    -- Coincide con uq_hook_registry_event_handler, que es un índice por
    -- expresión: la cláusula tiene que repetir el COALESCE tal cual.
    ON CONFLICT (event_code, handler_ref, COALESCE(clinic_id, -1)) DO UPDATE
        SET name        = EXCLUDED.name,
            description = EXCLUDED.description,
            seq         = EXCLUDED.seq,
            mode        = EXCLUDED.mode,
            on_error    = EXCLUDED.on_error,
            timeout_ms  = EXCLUDED.timeout_ms,
            config      = EXCLUDED.config,
            log_enabled = EXCLUDED.log_enabled,
            is_active   = EXCLUDED.is_active,
            updated_by  = EXCLUDED.updated_by
            -- created_by no se pisa: sigue siendo quien la registró primero.
    RETURNING id, (xmax = 0) INTO v_registry_id, v_insertada;

    RAISE NOTICE 'Hook % en % → workflow % (id de registración: %)',
        CASE WHEN v_insertada THEN 'REGISTRADO' ELSE 'ACTUALIZADO' END,
        v_event_code, v_handler_ref, v_registry_id;
END $$;

COMMIT;


-- =====================================================================
-- VERIFICACIÓN
-- =====================================================================

-- 1. La registración quedó, y el dispatcher la va a ver.
--    Esta consulta es literalmente la que corre el nodo "Buscar Hooks":
--    si acá no aparece la fila, el hook NO se va a ejecutar.
SELECT hr.seq, hr.name, hr.handler_ref, hr.mode, hr.on_error, hr.is_active
FROM public.hook_registry hr
JOIN public.hook_events   he ON he.code = hr.event_code
WHERE hr.event_code   = 'invoice.after_upsert'
  AND hr.is_active    IS TRUE
  AND he.is_active    IS TRUE
  AND hr.handler_type = 'n8n_workflow'
  AND (hr.clinic_id IS NULL OR hr.clinic_id = NULL::int)
ORDER BY hr.seq ASC, hr.created_at ASC;

-- 2. Cómo lo ve la ventana Sistema → Customizaciones (el indicador activas/total).
SELECT he.code,
       COUNT(hr.id)                             AS total,
       COUNT(hr.id) FILTER (WHERE hr.is_active) AS activas
FROM public.hook_events he
LEFT JOIN public.hook_registry hr ON hr.event_code = he.code
WHERE he.code = 'invoice.after_upsert'
GROUP BY he.code;

-- 3. Después de crear una factura desde la app: qué corrió.
SELECT executed_at, status, duration_ms, handler_ref, error_message,
       output -> 'message' AS mensaje
FROM public.hook_execution_log
WHERE event_code = 'invoice.after_upsert'
ORDER BY executed_at DESC
LIMIT 10;

-- 4. El invariante que el hook tiene que preservar SIEMPRE.
--    Debe devolver 0 filas, antes y después de que el hook corra.
SELECT i.id, i.total, COALESCE(SUM(ii.total), 0) AS suma_lineas
FROM public.invoices i
LEFT JOIN public.invoice_items ii ON ii.invoice_id = i.id
GROUP BY i.id, i.total
HAVING i.total <> COALESCE(SUM(ii.total), 0);


-- =====================================================================
-- APAGAR / DESHACER
-- =====================================================================

-- Apagar sin perder la configuración (preferible a borrar):
-- UPDATE public.hook_registry
--    SET is_active = false
--  WHERE event_code = 'invoice.after_upsert'
--    AND handler_ref = 'REEMPLAZAR_POR_EL_ID_DEL_WORKFLOW';

-- Borrar del todo. No elimina el workflow de n8n, sólo lo desengancha.
-- Las filas de hook_execution_log sobreviven con registry_id en NULL
-- (ON DELETE SET NULL) y conservan handler_ref, así que la traza histórica
-- sigue diciendo qué corrió.
-- DELETE FROM public.hook_registry
--  WHERE event_code = 'invoice.after_upsert'
--    AND handler_ref = 'REEMPLAZAR_POR_EL_ID_DEL_WORKFLOW';
