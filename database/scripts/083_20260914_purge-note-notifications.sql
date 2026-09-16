-- =====================================================================
-- notifications: purgar las notificaciones generadas por notas
-- Run on: dev / staging / prod / todas las bases de cliente
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- =====================================================================
--
-- Contexto:
--   Las notas son silenciosas por contrato. La UI las ofrece como "nota
--   interna sin notificaciones" y el upsert les fuerza raise_alert =
--   false. Pero el cron de 1 minuto (flujo n8n "Reminders", nodo
--   "Get reminders") no filtraba ni por type ni por raise_alert:
--
--     WHERE status ILIKE 'pending'
--       AND start_datetime <= $1 AND end_datetime > $1
--
--   así que levantaba las notas igual y le insertaba una notificación a
--   todo el staff. En la base de DEV eso dejó 413 filas, de 6 notas,
--   repartidas en 83 usuarios, entre 2026-07-20 y 2026-09-11.
--
--   El filtro del cron ya está corregido, pero eso solo corta el flujo
--   hacia adelante: las filas ya insertadas siguen en el inbox de cada
--   usuario. Este script las saca.
--
-- ORDEN DE EJECUCIÓN: correr DESPUÉS de desplegar el flujo "Reminders"
--   corregido. Si se corre antes, el cron vuelve a insertarlas en el
--   minuto siguiente.
--
-- Alcance del borrado:
--   Se borran TODAS las notificaciones que provienen de una nota, sin
--   importar su estado. Una notificación nacida de una nota nunca debió
--   existir: que alguien ya la haya marcado leída no la convierte en
--   historial, solo significa que tuvo que sacársela de encima. Además,
--   dejar las leídas haría que la consulta de verificación nunca dé cero
--   y no se pueda saber si la limpieza corrió en cada base de cliente.
--
--   >>> Para conservar las ya leídas/completadas, descomentar la línea
--   >>> marcada con SOLO-PENDIENTES (hay dos, en el conteo y en el DELETE).
--
-- Qué NO toca:
--   - Las notificaciones de recordatorios reales (r.type = 'reminder').
--   - Las que quedaron con reminder_id NULL. La FK
--     notifications_reminder_id_fkey es ON DELETE SET NULL, así que si la
--     nota se borró no hay forma de saber si esa notificación vino de una
--     nota o de un recordatorio. En DEV es 1 sola fila. Se dejan quietas:
--     ante la duda, no se borra.
-- =====================================================================

BEGIN;

DO $$
DECLARE
    v_total       bigint;
    v_pendientes  bigint;
    v_usuarios    bigint;
    v_notas       bigint;
    v_borradas    bigint;
BEGIN
    SELECT count(*),
           count(*) FILTER (WHERE n.status = 'pending'),
           count(DISTINCT n.user_id),
           count(DISTINCT n.reminder_id)
      INTO v_total, v_pendientes, v_usuarios, v_notas
      FROM public.notifications n
      JOIN public.reminders r ON r.id = n.reminder_id
     WHERE n.type = 'reminder'
       AND r.type = 'note';
       -- AND n.status = 'pending';                      -- SOLO-PENDIENTES

    RAISE NOTICE 'Notificaciones originadas en notas: % (% pendientes), de % notas, en % usuarios',
        v_total, v_pendientes, v_notas, v_usuarios;

    IF v_total = 0 THEN
        RAISE NOTICE 'Nada para borrar: la limpieza ya corrió en esta base, o el cron nunca generó notificaciones desde notas.';
        RETURN;
    END IF;

    DELETE FROM public.notifications n
     USING public.reminders r
     WHERE r.id = n.reminder_id
       AND n.type = 'reminder'
       AND r.type = 'note';
       -- AND n.status = 'pending';                      -- SOLO-PENDIENTES

    GET DIAGNOSTICS v_borradas = ROW_COUNT;
    RAISE NOTICE 'Borradas % filas de notifications.', v_borradas;
END $$;

-- ─── Verificación ─────────────────────────────────────────────────────────────
--
-- Tras correr esto, las dos consultas de abajo tienen que dar:
--   1. cero notificaciones originadas en notas
--   2. el mismo conteo de notificaciones de recordatorios reales que antes
--      (en DEV, 89): la limpieza no se tiene que llevar nada puesto.
--
--   SELECT count(*) FROM notifications n
--     JOIN reminders r ON r.id = n.reminder_id
--    WHERE n.type = 'reminder' AND r.type = 'note';
--
--   SELECT count(*) FROM notifications n
--     JOIN reminders r ON r.id = n.reminder_id
--    WHERE n.type = 'reminder' AND r.type = 'reminder';

-- ─── Registro de migración ────────────────────────────────────────────────────

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '083_20260914_purge-note-notifications.sql',
    'v1',
    'notifications: purga de las notificaciones generadas por notas antes del fix del cron (type <> ''note'' AND raise_alert = true)'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;
