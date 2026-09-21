-- =====================================================================
-- notifications.type — habilitar 'whatsapp_handoff_requested'
-- Run on: dev / staging / prod / todas las bases de cliente
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- =====================================================================
--
-- Contexto:
--   El workflow de n8n "Whats App" deriva la conversación a recepción y llama
--   al flujo "Create Bulk Notification" con type = 'whatsapp_handoff_requested'
--   (nodo "Call 'Create Bulk Notification' (Handoff)"). El frontend ya
--   renderiza ese tipo (src/lib/types.ts → WhatsappHandoffRequestedNotification,
--   notification-card.tsx, GlobalNotificationAlerts.tsx, notifications-context.tsx),
--   pero en las bases donde la constraint notifications_type_check todavía no
--   lo admite el INSERT de "Create Bulk Notification" falla con:
--
--     new row for relation "notifications" violates check constraint
--     "notifications_type_check"
--
--   En entornos donde ya corrió 074_20260906_study-order-notifications.sql
--   (rama orden-servicio) el valor ya está presente. Este script hace el mismo
--   cambio para que las ramas test/main no dependan de esa migración. Si 074 ya
--   corrió, este script no toca nada (solo registra la migración).
--
-- Cómo lo hace:
--   Lee los valores que el CHECK ya admite desde pg_get_constraintdef, le
--   agrega los que falten y reconstruye la constraint con la misma lista. Así
--   no se pierde ningún valor propio de cada entorno.
-- =====================================================================

BEGIN;

DO $$
DECLARE
    con_name text;
    valores  text[];
    nuevos   text[] := ARRAY['whatsapp_handoff_requested'];
    faltan   text[];
BEGIN
    IF to_regclass('public.notifications') IS NULL THEN
        RAISE EXCEPTION 'No existe public.notifications';
    END IF;

    -- CHECK que menciona la columna `type`.
    SELECT conname INTO con_name
      FROM pg_constraint
     WHERE conrelid = 'public.notifications'::regclass
       AND contype  = 'c'
       AND pg_get_constraintdef(oid) LIKE '%type%'
     ORDER BY conname
     LIMIT 1;

    IF con_name IS NULL THEN
        RAISE NOTICE '[handoff] notifications.type no tiene CHECK; no hay nada que ampliar.';
        RETURN;
    END IF;

    -- Valores que la constraint ya acepta.
    SELECT array_agg(DISTINCT m[1]) INTO valores
      FROM pg_constraint c
      CROSS JOIN LATERAL regexp_matches(pg_get_constraintdef(c.oid), '''([^'']+)''', 'g') AS m
     WHERE c.conrelid = 'public.notifications'::regclass
       AND c.conname  = con_name;

    -- Qué falta de lo nuevo.
    SELECT array_agg(v) INTO faltan
      FROM unnest(nuevos) AS v
     WHERE NOT (v = ANY (COALESCE(valores, ARRAY[]::text[])));

    IF faltan IS NULL THEN
        RAISE NOTICE '[handoff] El CHECK de notifications.type ya admite: %.', array_to_string(nuevos, ', ');
        RETURN;
    END IF;

    -- Se reconstruye a partir de los valores actuales + los nuevos.
    EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', con_name);
    EXECUTE format(
        'ALTER TABLE public.notifications ADD CONSTRAINT %I CHECK (type::text = ANY (ARRAY[%s]))',
        con_name,
        (SELECT string_agg(quote_literal(v), ', ') FROM unnest(valores || faltan) AS v)
    );
    RAISE NOTICE '[handoff] CHECK de notifications.type ampliado con: %', array_to_string(faltan, ', ');
END $$;

COMMENT ON COLUMN public.notifications.type IS
    'Tipo de notificación. La lista del CHECK tiene que seguir a la unión UnifiedNotification de src/lib/types.ts: si el front sabe renderizar un tipo y el CHECK no lo admite, el backend no puede insertarlo.';

-- ─── Registro de migración ────────────────────────────────────────────────────

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '090_20260921_notifications-whatsapp-handoff-type.sql',
    'v1',
    'notifications.type: agrega whatsapp_handoff_requested al CHECK (lo inserta el workflow "Whats App" al derivar la conversación a recepción)'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;

-- =====================================================================
-- Rollback manual
-- =====================================================================
-- Ojo: volver atrás con filas 'whatsapp_handoff_requested' ya insertadas
-- hace fallar el ALTER. Hay que borrarlas primero (la primera línea,
-- comentada) o pasarlas a un tipo permitido.
-- BEGIN;
-- DELETE FROM public.notifications WHERE type = 'whatsapp_handoff_requested';
-- ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
-- ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
--     CHECK (type::text = ANY (ARRAY['appointment_reassigned','appointment_rescheduled',
--            'appointment_status_change','appointment_updated','new_appointment',
--            'reminder','session_completed']));
-- DELETE FROM public.db_migrations WHERE script_name = '090_20260921_notifications-whatsapp-handoff-type.sql';
-- COMMIT;
