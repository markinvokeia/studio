-- =====================================================================
-- Disponibilidad de doctores — get_available_users por sede, excluyendo la
-- cita que se está moviendo, y sin recorrer toda la tabla users
--
--   1. p_sede_id (opcional) → el horario de atención (clinic_schedules) y las
--      excepciones de la clínica se evalúan sólo para esa sede. Antes se
--      tomaban los horarios de TODAS las sedes, así que una sede figuraba
--      "abierta" en el horario de otra (p. ej. se ofrecían 18:30 en una sede
--      que cierra a las 18:00 porque otra cierra a las 19:00).
--      · Las excepciones con sede_id NULL siguen aplicando a todas las sedes.
--      · Con p_sede_id NULL el comportamiento es EXACTAMENTE el anterior.
--   2. p_exclude_appointment_id (opcional) → esa cita no cuenta como ocupación
--      del doctor. Sin esto, al reagendar o extender una cita el doctor
--      figuraba ocupado por la misma cita que se estaba moviendo.
--   3. Rendimiento: la consulta final partía de los ~15k usuarios y evaluaba
--      las reglas para cada uno (~70 ms por llamada). Ahora parte sólo de los
--      usuarios con alguna regla o excepción aplicable a ese instante. El
--      resultado es el mismo: un usuario sin regla ni excepción aplicable
--      nunca podía pasar el filtro.
--
-- Compatibilidad:
--   · La firma cambia de (timestamptz, text) a
--     (timestamptz, text, integer DEFAULT NULL, integer DEFAULT NULL). Las
--     llamadas existentes con dos argumentos (flujo de WhatsApp "List Available
--     Doctors", Agent_Availability2 previo) siguen funcionando sin cambios.
--   · Se hace DROP + CREATE (no CREATE OR REPLACE): agregar parámetros con
--     CREATE OR REPLACE crearía una sobrecarga, y una llamada con dos
--     argumentos quedaría ambigua entre ambas.
--   · No hay vistas ni otras funciones que dependan de ésta (verificado en
--     DEV: pg_views / pg_proc sin referencias).
--
-- Orden de despliegue: aplicar ESTE script ANTES de reimportar
-- Agent_Availability2.json y All Appointment Workflows.json (los flujos nuevos
-- llaman a la función con cuatro argumentos).
--
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- Depende de: 081_20260914_fix-exception-closure-time-window.sql
-- =====================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.get_available_users(timestamp with time zone, text);
DROP FUNCTION IF EXISTS public.get_available_users(timestamp with time zone, text, integer, integer);

CREATE FUNCTION public.get_available_users(
    utc_timestamp timestamp with time zone,
    clinic_timezone text,
    p_sede_id integer DEFAULT NULL,
    p_exclude_appointment_id integer DEFAULT NULL
)
 RETURNS TABLE(user_id uuid, user_name text, user_email text)
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
    -- 1. Convertimos el instante UTC de n8n a la hora de la clínica (ej. 13:00Z -> 10:00)
    local_timestamp TIMESTAMP := utc_timestamp AT TIME ZONE clinic_timezone;
    local_date DATE := local_timestamp::date;
    local_time TIME := local_timestamp::time;
    local_day_of_week SMALLINT := EXTRACT(ISODOW FROM local_timestamp);

    -- 2. Las citas guardan la hora local (timestamp sin zona): se comparan contra ella
    comparison_timestamp TIMESTAMP := local_timestamp;
BEGIN
    RETURN QUERY
    WITH is_clinic_open AS (
        SELECT EXISTS (
            SELECT 1 FROM public.clinic_exceptions ce
            WHERE ce.is_open = true
              AND (p_sede_id IS NULL OR ce.sede_id IS NULL OR ce.sede_id = p_sede_id)
              AND local_time >= ce.start_time AND local_time < ce.end_time
              AND (
                  (ce.recurrence = 'once' AND ce.date = local_date) OR
                  (ce.recurrence <> 'once' AND local_date >= ce.date AND (ce.end_date IS NULL OR local_date <= ce.end_date) AND (
                      (ce.recurrence = 'monthly' AND EXTRACT(DAY FROM local_date) = ce.day_of_month) OR
                      (ce.recurrence = 'weekly' AND local_day_of_week = ce.day_of_week) OR
                      (ce.recurrence = 'biweekly' AND local_day_of_week = ce.day_of_week AND (EXTRACT(WEEK FROM local_date) - EXTRACT(WEEK FROM ce.biweekly_reference_date))::int % 2 = 0)
                  ))
              )
            UNION ALL
            SELECT 1 FROM public.clinic_schedules cs
            WHERE cs.day_of_week = local_day_of_week
              AND (p_sede_id IS NULL OR cs.sede_id = p_sede_id)
              AND local_time >= cs.start_time AND local_time < cs.end_time
            AND NOT EXISTS (
                SELECT 1 FROM public.clinic_exceptions ce2
                WHERE ce2.is_open = false
                  AND (p_sede_id IS NULL OR ce2.sede_id IS NULL OR ce2.sede_id = p_sede_id)
                  AND (ce2.start_time IS NULL OR local_time >= ce2.start_time)
                  AND (ce2.end_time IS NULL OR local_time < ce2.end_time)
                  AND (
                      (ce2.recurrence = 'once' AND ce2.date = local_date) OR
                      (ce2.recurrence <> 'once' AND local_date >= ce2.date AND (ce2.end_date IS NULL OR local_date <= ce2.end_date) AND (
                          (ce2.recurrence = 'monthly' AND EXTRACT(DAY FROM local_date) = ce2.day_of_month) OR
                          (ce2.recurrence = 'weekly' AND local_day_of_week = ce2.day_of_week) OR
                          (ce2.recurrence = 'biweekly' AND local_day_of_week = ce2.day_of_week AND (EXTRACT(WEEK FROM local_date) - EXTRACT(WEEK FROM ce2.biweekly_reference_date))::int % 2 = 0)
                      ))
                  )
            )
        ) AS open
    ),
    applicable_rules AS (
        SELECT r.user_id FROM public.availability_rules r
        WHERE local_date >= r.start_date AND (r.end_date IS NULL OR local_date <= r.end_date)
          AND local_time >= r.start_time AND local_time < r.end_time
          AND (
              (r.recurrence = 'daily' AND local_day_of_week BETWEEN 1 AND 5) OR
              (r.recurrence = 'weekly' AND local_day_of_week = r.day_of_week) OR
              (r.recurrence = 'biweekly' AND local_day_of_week = r.day_of_week AND (EXTRACT(WEEK FROM local_date) - EXTRACT(WEEK FROM r.biweekly_reference_date))::int % 2 = 0) OR
              (r.recurrence = 'monthly' AND EXTRACT(DAY FROM local_date) = r.day_of_month)
          )
    ),
    applicable_exceptions AS (
        SELECT e.user_id, e.is_available FROM public.availability_exceptions e
        WHERE e.exception_date = local_date
          AND ((e.start_time IS NULL AND e.end_time IS NULL) OR (local_time >= e.start_time AND local_time < e.end_time))
    ),
    -- Sólo pueden estar disponibles los usuarios con una regla o una excepción
    -- "disponible" que aplique a este instante: se parte de ellos y no de users.
    candidates AS (
        SELECT ar.user_id FROM applicable_rules ar
        UNION
        SELECT ae.user_id FROM applicable_exceptions ae WHERE ae.is_available = true
    )
    SELECT u.id, u.name, u.email
    FROM candidates c
    JOIN public.users u ON u.id = c.user_id
    CROSS JOIN is_clinic_open
    WHERE u.is_active = true AND is_clinic_open.open = true
      AND (
        EXISTS (
            SELECT 1 FROM applicable_rules ar WHERE ar.user_id = u.id
            AND NOT EXISTS (SELECT 1 FROM applicable_exceptions ae WHERE ae.user_id = u.id AND ae.is_available = false)
        ) OR EXISTS (
            SELECT 1 FROM applicable_exceptions ae2 WHERE ae2.user_id = u.id AND ae2.is_available = true
        )
      )
      AND NOT EXISTS (
          SELECT 1 FROM public.appointments a
          WHERE a.assignee_id = u.id
            AND a.start_datetime <= comparison_timestamp
            AND a.end_datetime > comparison_timestamp
            AND a.status NOT IN ('cancelled', 'canceled', 'declined', 'no_show')
            AND (p_exclude_appointment_id IS NULL OR a.id <> p_exclude_appointment_id)
      );
END;
$function$;

COMMENT ON FUNCTION public.get_available_users(timestamp with time zone, text, integer, integer) IS
    'Usuarios disponibles en un instante: clínica abierta (opcionalmente sólo la sede p_sede_id), regla o excepción de disponibilidad aplicable y sin cita en curso (ignorando p_exclude_appointment_id). Script 123.';

-- -----------------------------------------------------------------------
-- Registro de migración
-- -----------------------------------------------------------------------
INSERT INTO public.db_migrations (script_name, version_tag, notes)
VALUES (
    '123_20261002_get-available-users-sede-and-exclusion.sql',
    'v1',
    'get_available_users: filtro opcional por sede, exclusión de la cita que se mueve y consulta partiendo de los candidatos'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;

-- =====================================================================
-- ROLLBACK (manual, si hiciera falta)
--
-- Restaura la versión exacta que estaba en DEV antes de este script
-- (la de 081_20260914_fix-exception-closure-time-window.sql).
--
-- ⚠️ ANTES de ejecutarlo, reimportar en n8n las versiones previas de
-- Agent_Availability2 y All Appointment Workflows: las nuevas llaman a la
-- función con cuatro argumentos y fallarían ("function does not exist").
-- El flujo de WhatsApp sólo usa dos argumentos y no se ve afectado.
-- =====================================================================
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.get_available_users(timestamp with time zone, text, integer, integer);
-- CREATE OR REPLACE FUNCTION public.get_available_users(utc_timestamp timestamp with time zone, clinic_timezone text)
--  RETURNS TABLE(user_id uuid, user_name text, user_email text)
--  LANGUAGE plpgsql
-- AS $function$
-- DECLARE
--     -- 1. Convertimos el instante UTC de n8n a la hora de Montevideo (ej. 13:00Z -> 10:00)
--     local_timestamp TIMESTAMP := utc_timestamp AT TIME ZONE clinic_timezone;
--     local_date DATE := local_timestamp::date;
--     local_time TIME := local_timestamp::time;
--     local_day_of_week SMALLINT := EXTRACT(ISODOW FROM local_timestamp);
--
--     -- 2. Usamos esta misma variable local para consultar las tablas "sin zona horaria"
--     comparison_timestamp TIMESTAMP := local_timestamp;
-- BEGIN
--     RETURN QUERY
--     WITH is_clinic_open AS (
--         SELECT EXISTS (
--             SELECT 1 FROM public.clinic_exceptions ce
--             WHERE ce.is_open = true
--               AND local_time >= ce.start_time AND local_time < ce.end_time
--               AND (
--                   (ce.recurrence = 'once' AND ce.date = local_date) OR
--                   (ce.recurrence <> 'once' AND local_date >= ce.date AND (ce.end_date IS NULL OR local_date <= ce.end_date) AND (
--                       (ce.recurrence = 'monthly' AND EXTRACT(DAY FROM local_date) = ce.day_of_month) OR
--                       (ce.recurrence = 'weekly' AND local_day_of_week = ce.day_of_week) OR
--                       (ce.recurrence = 'biweekly' AND local_day_of_week = ce.day_of_week AND (EXTRACT(WEEK FROM local_date) - EXTRACT(WEEK FROM ce.biweekly_reference_date))::int % 2 = 0)
--                   ))
--               )
--             UNION ALL
--             SELECT 1 FROM public.clinic_schedules cs
--             WHERE cs.day_of_week = local_day_of_week
--               AND local_time >= cs.start_time AND local_time < cs.end_time
--             AND NOT EXISTS (
--                 SELECT 1 FROM public.clinic_exceptions ce2
--                 WHERE ce2.is_open = false
--                   AND (ce2.start_time IS NULL OR local_time >= ce2.start_time)
--                   AND (ce2.end_time IS NULL OR local_time < ce2.end_time)
--                   AND (
--                       (ce2.recurrence = 'once' AND ce2.date = local_date) OR
--                       (ce2.recurrence <> 'once' AND local_date >= ce2.date AND (ce2.end_date IS NULL OR local_date <= ce2.end_date) AND (
--                           (ce2.recurrence = 'monthly' AND EXTRACT(DAY FROM local_date) = ce2.day_of_month) OR
--                           (ce2.recurrence = 'weekly' AND local_day_of_week = ce2.day_of_week) OR
--                           (ce2.recurrence = 'biweekly' AND local_day_of_week = ce2.day_of_week AND (EXTRACT(WEEK FROM local_date) - EXTRACT(WEEK FROM ce2.biweekly_reference_date))::int % 2 = 0)
--                       ))
--                   )
--             )
--         ) AS open
--     ),
--     applicable_rules AS (
--         SELECT r.user_id FROM public.availability_rules r
--         WHERE local_date >= r.start_date AND (r.end_date IS NULL OR local_date <= r.end_date)
--           AND local_time >= r.start_time AND local_time < r.end_time
--           AND (
--               (r.recurrence = 'daily' AND local_day_of_week BETWEEN 1 AND 5) OR
--               (r.recurrence = 'weekly' AND local_day_of_week = r.day_of_week) OR
--               (r.recurrence = 'biweekly' AND local_day_of_week = r.day_of_week AND (EXTRACT(WEEK FROM local_date) - EXTRACT(WEEK FROM r.biweekly_reference_date))::int % 2 = 0) OR
--               (r.recurrence = 'monthly' AND EXTRACT(DAY FROM local_date) = r.day_of_month)
--           )
--     ),
--     applicable_exceptions AS (
--         SELECT e.user_id, e.is_available FROM public.availability_exceptions e
--         WHERE e.exception_date = local_date
--           AND ((e.start_time IS NULL AND e.end_time IS NULL) OR (local_time >= e.start_time AND local_time < e.end_time))
--     )
--     SELECT u.id, u.name, u.email
--     FROM public.users u
--     CROSS JOIN is_clinic_open
--     WHERE u.is_active = true AND is_clinic_open.open = true
--       AND (
--         EXISTS (
--             SELECT 1 FROM applicable_rules ar WHERE ar.user_id = u.id
--             AND NOT EXISTS (SELECT 1 FROM applicable_exceptions ae WHERE ae.user_id = u.id AND ae.is_available = false)
--         ) OR EXISTS (
--             SELECT 1 FROM applicable_exceptions ae2 WHERE ae2.user_id = u.id AND ae2.is_available = true
--         )
--       )
--       AND NOT EXISTS (
--           SELECT 1 FROM public.appointments a
--           WHERE a.assignee_id = u.id
--             AND a.start_datetime <= comparison_timestamp
--             AND a.end_datetime > comparison_timestamp
--             AND a.status NOT IN ('cancelled', 'canceled', 'declined', 'no_show')
--       );
-- END;
-- $function$;
-- DELETE FROM public.db_migrations WHERE script_name = '123_20261002_get-available-users-sede-and-exclusion.sql';
-- COMMIT;
