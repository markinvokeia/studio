-- =====================================================================
-- Fix: complete_miscellaneous_transaction() no llenaba created_by/updated_by
-- del cash_movement que genera
-- Run on: dev / staging / prod
-- Idempotente: se puede correr varias veces sin efectos secundarios.
-- =====================================================================
--
-- Contexto (verificado en DEV con prueba E2E tras 084_...-tier1.sql):
--   Al completar una transacción miscelánea (endpoint /misc_transactions/upsert,
--   workflow n8n "Miscellaneous" -> nodo "Execute Completion") se ejecuta
--   complete_miscellaneous_transaction(p_transaction_id, p_completed_by,
--   p_cash_session_id, p_payment_method_id), que hace el UPDATE de
--   miscellaneous_transactions (correctamente stamped por trg_stamp_actor)
--   y el INSERT del cash_movement asociado.
--
--   Ese INSERT INTO cash_movements ya recibe el actor via p_completed_by
--   y lo usa para la columna user_id, pero el column list nunca incluyó
--   created_by/updated_by -> quedan NULL (trg_stamp_actor no puede
--   inventarlos: en INSERT solo copia created_by a updated_by si vinieron
--   seteados). Por eso audit_log.changed_by también quedaba NULL para esos
--   inserts de cash_movements.
--
--   Contraste: el cash_movement que genera el flujo de pago de factura
--   (Cobro Rápido) sí mapea created_by/updated_by explícitamente desde su
--   propio workflow n8n, por eso ese camino funcionaba bien.
--
-- Cambio:
--   CREATE OR REPLACE de complete_miscellaneous_transaction() agregando
--   created_by y updated_by (= p_completed_by) al INSERT INTO
--   cash_movements. Sin cambios de firma ni de comportamiento funcional
--   más allá de esas dos columnas.
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.complete_miscellaneous_transaction(
    p_transaction_id integer,
    p_completed_by uuid,
    p_cash_session_id integer,
    p_payment_method_id integer
)
 RETURNS TABLE(transaction_id integer, cash_movement_id integer, success boolean, message text)
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_transaction RECORD;
    v_cash_mov_id INTEGER;
    v_mov_type VARCHAR(20);
    v_final_amount NUMERIC(12,2);
    v_is_return BOOLEAN;
BEGIN
    -- 1. Obtener datos de la transacción
    SELECT
        mt.*,
        mc.category_type
    INTO v_transaction
    FROM miscellaneous_transactions mt
    JOIN miscellaneous_categories mc ON mt.category_id = mc.id
    WHERE mt.id = p_transaction_id;

    -- Validaciones iniciales
    IF NOT FOUND THEN
        RETURN QUERY SELECT p_transaction_id, NULL::INTEGER, false, 'Transacción no encontrada';
        RETURN;
    END IF;

    IF v_transaction.status != 'pending' THEN
        RETURN QUERY SELECT p_transaction_id, NULL::INTEGER, false,
            'La transacción no está en estado pendiente';
        RETURN;
    END IF;

    -- 2. Determinar monto base
    v_final_amount := ABS(COALESCE(v_transaction.converted_amount, v_transaction.amount));

    -- 3. Determinar tipo y signo final
    IF v_transaction.category_type = 'income' THEN
        v_mov_type := 'income';
        -- v_final_amount se queda positivo
    ELSE
        v_mov_type := 'expense';
        v_final_amount := v_final_amount * -1; -- Forzamos negativo para gastos
    END IF;

    -- Nota: v_is_return se mantiene por si el monto original era negativo
    -- o para lógica de descripción, aunque el signo final ya está controlado.
    v_is_return := (COALESCE(v_transaction.converted_amount, v_transaction.amount) < 0);

    -- 4. Actualizar registro de la transacción
    UPDATE miscellaneous_transactions
    SET
        status = 'completed',
        completed_at = NOW(),
        cash_session_id = p_cash_session_id,
        payment_method_id = p_payment_method_id,
        updated_at = NOW()
    WHERE id = p_transaction_id;

    -- 5. Insertar en movimientos de caja
    INSERT INTO cash_movements (
        cash_session_id,
        type,
        payment_method_id,
        amount,
        description,
        user_id,
        currency,
        is_sales,
        is_trx,
        source_type,
        source_id,
        created_by,
        updated_by
    ) VALUES (
        p_cash_session_id,
        v_mov_type,
        p_payment_method_id,
        v_final_amount,
        (CASE WHEN v_is_return THEN '[DEVOLUCIÓN] ' ELSE '' END) ||
        v_transaction.description ||
        CASE WHEN v_transaction.reference_number IS NOT NULL
             THEN ' (Ref: ' || v_transaction.reference_number || ')'
             ELSE '' END,
        p_completed_by,
        v_transaction.currency,
        (v_mov_type = 'income'), -- TRUE si es income (VENTA), FALSE si es expense
        true,
        'miscellaneous',
        p_transaction_id,
        p_completed_by,
        p_completed_by
    ) RETURNING id INTO v_cash_mov_id;

    RETURN QUERY SELECT
        p_transaction_id,
        v_cash_mov_id,
        true,
        'Transacción completada exitosamente.' ||
        CASE WHEN v_is_return THEN ' (Procesada como devolución)' ELSE '' END;
END;
$function$;

-- ─── Registro de migracion ─────────────────────────────────────────────────

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '085_20260915_fix-complete-misc-transaction-actor.sql',
    'v1',
    'complete_miscellaneous_transaction(): stamp created_by/updated_by (=p_completed_by) en el cash_movement generado al completar una transaccion miscelanea'
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
-- CREATE OR REPLACE FUNCTION public.complete_miscellaneous_transaction(
--     p_transaction_id integer,
--     p_completed_by uuid,
--     p_cash_session_id integer,
--     p_payment_method_id integer
-- )
--  RETURNS TABLE(transaction_id integer, cash_movement_id integer, success boolean, message text)
--  LANGUAGE plpgsql
-- AS $function$
-- DECLARE
--     v_transaction RECORD;
--     v_cash_mov_id INTEGER;
--     v_mov_type VARCHAR(20);
--     v_final_amount NUMERIC(12,2);
--     v_is_return BOOLEAN;
-- BEGIN
--     SELECT
--         mt.*,
--         mc.category_type
--     INTO v_transaction
--     FROM miscellaneous_transactions mt
--     JOIN miscellaneous_categories mc ON mt.category_id = mc.id
--     WHERE mt.id = p_transaction_id;
--
--     IF NOT FOUND THEN
--         RETURN QUERY SELECT p_transaction_id, NULL::INTEGER, false, 'Transacción no encontrada';
--         RETURN;
--     END IF;
--
--     IF v_transaction.status != 'pending' THEN
--         RETURN QUERY SELECT p_transaction_id, NULL::INTEGER, false,
--             'La transacción no está en estado pendiente';
--         RETURN;
--     END IF;
--
--     v_final_amount := ABS(COALESCE(v_transaction.converted_amount, v_transaction.amount));
--
--     IF v_transaction.category_type = 'income' THEN
--         v_mov_type := 'income';
--     ELSE
--         v_mov_type := 'expense';
--         v_final_amount := v_final_amount * -1;
--     END IF;
--
--     v_is_return := (COALESCE(v_transaction.converted_amount, v_transaction.amount) < 0);
--
--     UPDATE miscellaneous_transactions
--     SET
--         status = 'completed',
--         completed_at = NOW(),
--         cash_session_id = p_cash_session_id,
--         payment_method_id = p_payment_method_id,
--         updated_at = NOW()
--     WHERE id = p_transaction_id;
--
--     INSERT INTO cash_movements (
--         cash_session_id,
--         type,
--         payment_method_id,
--         amount,
--         description,
--         user_id,
--         currency,
--         is_sales,
--         is_trx,
--         source_type,
--         source_id
--     ) VALUES (
--         p_cash_session_id,
--         v_mov_type,
--         p_payment_method_id,
--         v_final_amount,
--         (CASE WHEN v_is_return THEN '[DEVOLUCIÓN] ' ELSE '' END) ||
--         v_transaction.description ||
--         CASE WHEN v_transaction.reference_number IS NOT NULL
--              THEN ' (Ref: ' || v_transaction.reference_number || ')'
--              ELSE '' END,
--         p_completed_by,
--         v_transaction.currency,
--         (v_mov_type = 'income'),
--         true,
--         'miscellaneous',
--         p_transaction_id
--     ) RETURNING id INTO v_cash_mov_id;
--
--     RETURN QUERY SELECT
--         p_transaction_id,
--         v_cash_mov_id,
--         true,
--         'Transacción completada exitosamente.' ||
--         CASE WHEN v_is_return THEN ' (Procesada como devolución)' ELSE '' END;
-- END;
-- $function$;
--
-- DELETE FROM public.db_migrations WHERE script_name = '085_20260915_fix-complete-misc-transaction-actor.sql';
--
-- COMMIT;
