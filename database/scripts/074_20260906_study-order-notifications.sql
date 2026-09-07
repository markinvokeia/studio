-- =============================================================================
-- Órdenes de estudio — tipos de notificación
-- =============================================================================
-- `notifications.type` tiene un CHECK con una lista cerrada de valores. Hoy
-- admite siete y hay que ampliarla por dos motivos:
--
--   1. Los dos tipos nuevos de órdenes de estudio:
--        study_order_submitted       aviso a recepción de que entró una orden
--        study_order_status_changed  aviso al derivador de que cambió su estado
--
--   2. `whatsapp_handoff_requested`, que YA está implementado en el front
--      (src/lib/types.ts y notification-card.tsx lo manejan) pero nunca se
--      agregó al CHECK. Cualquier intento de insertarlo falla hoy en silencio
--      del lado del backend. Se incluye acá para dejar la restricción alineada
--      con lo que la aplicación realmente usa.
--
-- La restricción se reconstruye leyendo la lista actual y agregando lo que
-- falte, así no se pierde ningún valor que exista en este entorno y no esté
-- previsto acá.
--
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- =============================================================================

BEGIN;

DO $$
DECLARE
    con_name  text;
    faltantes text[];
    nuevos    text[] := ARRAY[
        'study_order_submitted',
        'study_order_status_changed',
        'whatsapp_handoff_requested'
    ];
BEGIN
    IF to_regclass('public.notifications') IS NULL THEN
        RAISE EXCEPTION 'No existe public.notifications';
    END IF;

    -- El CHECK que menciona la columna `type`.
    SELECT conname INTO con_name
      FROM pg_constraint
     WHERE conrelid = 'public.notifications'::regclass
       AND contype  = 'c'
       AND pg_get_constraintdef(oid) LIKE '%type%'
     LIMIT 1;

    IF con_name IS NULL THEN
        RAISE NOTICE '[study-orders] notifications.type no tiene CHECK: no hay nada que ampliar.';
        RETURN;
    END IF;

    -- Qué falta de lo nuestro.
    SELECT array_agg(v) INTO faltantes
      FROM unnest(nuevos) AS v
     WHERE pg_get_constraintdef((SELECT oid FROM pg_constraint WHERE conname = con_name)) NOT LIKE '%' || v || '%';

    IF faltantes IS NULL THEN
        RAISE NOTICE '[study-orders] El CHECK ya admite los tipos nuevos.';
        RETURN;
    END IF;

    -- Se reconstruye a partir de los valores que ya acepta, para no perder
    -- ninguno que este entorno tenga y este script no conozca.
    EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', con_name);
    EXECUTE format(
        'ALTER TABLE public.notifications ADD CONSTRAINT %I CHECK (type::text = ANY (ARRAY[%s]))',
        con_name,
        (SELECT string_agg(quote_literal(v), ', ')
           FROM (
               SELECT DISTINCT unnest(
                   ARRAY['appointment_status_change', 'session_completed', 'new_appointment',
                         'reminder', 'appointment_rescheduled', 'appointment_reassigned',
                         'appointment_updated'] || nuevos
               ) AS v
           ) t)
    );
    RAISE NOTICE '[study-orders] CHECK de notifications.type ampliado con: %', array_to_string(faltantes, ', ');
END $$;

COMMENT ON COLUMN public.notifications.type IS
    'Tipo de notificación. La lista del CHECK tiene que seguir a la unión UnifiedNotification de src/lib/types.ts: si el front sabe renderizar un tipo y el CHECK no lo admite, el backend no puede insertarlo.';

-- -----------------------------------------------------------------------------
-- Índice para el panel: las pendientes de un usuario, lo más nuevo primero.
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_notifications_user_pending
    ON public.notifications (user_id, created_at DESC)
    WHERE status = 'pending';

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '074_20260906_study-order-notifications.sql',
    'v1',
    'Órdenes de estudio — amplía el CHECK de notifications.type con study_order_submitted, study_order_status_changed y whatsapp_handoff_requested'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;

-- =============================================================================
-- Rollback manual
-- =============================================================================
-- Ojo: volver atrás con filas de los tipos nuevos ya insertadas hace fallar el
-- ALTER. Hay que borrarlas primero (la primera línea, comentada).
-- BEGIN;
-- DELETE FROM public.notifications WHERE type LIKE 'study_order_%';
-- ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
-- ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
--     CHECK (type::text = ANY (ARRAY['appointment_status_change','session_completed',
--            'new_appointment','reminder','appointment_rescheduled',
--            'appointment_reassigned','appointment_updated']));
-- DROP INDEX IF EXISTS public.idx_notifications_user_pending;
-- DELETE FROM public.db_migrations WHERE script_name = '074_20260906_study-order-notifications.sql';
-- COMMIT;
