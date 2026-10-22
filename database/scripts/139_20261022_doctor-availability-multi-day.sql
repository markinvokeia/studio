-- =====================================================================
-- Disponibilidad y excepciones de doctores — varios días por regla;
-- domingo en los horarios de sede
-- Run on: dev / staging / prod
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- Depende de: 138_20261022_exception-schedules-multi-day.sql
-- =====================================================================
--
-- Contexto:
--   Mismo patrón que el script 138 (horarios de excepción de la clínica):
--   cada fila sólo podía expresar UN día, así que una agenda "lun, mié y vie
--   de 14 a 19" eran tres reglas idénticas.
--
-- Cambios:
--   1. availability_rules.days_of_week  smallint[] → 'weekly' | 'biweekly'
--      availability_rules.days_of_month smallint[] → 'monthly'
--      Backfill desde day_of_week / day_of_month, que quedan en NULL y sin
--      uso (se borran en un script posterior).
--   2. 'daily' (que siempre significó lunes a viernes) pasa a
--      weekly {1,2,3,4,5}: con varios días por regla es el mismo caso. El
--      valor sigue en el enum recurrence_type y en la función por
--      compatibilidad, pero la UI ya no lo ofrece.
--   3. chk_rule_logic reescrito sobre los arrays + rangos válidos.
--   4. availability_exceptions.dates date[] → fechas a las que aplica la
--      excepción. exception_date (NOT NULL) queda como la primera, para el
--      orden y el buscador.
--   5. get_available_users():
--        · reglas y excepciones de doctores matchean con `= ANY(array)`;
--        · clinic_schedules se compara con EXTRACT(DOW) (0=domingo), que es
--          lo que guarda la tabla (CHECK 0-6). Antes se comparaba con ISODOW
--          (domingo=7) y el horario de domingo de una sede nunca aplicaba.
--      Firma sin cambios (CREATE OR REPLACE).
--
-- clinic_schedules NO cambia de forma: sigue siendo una fila por día y rango
-- (la leen el agente de WhatsApp, el portal de pacientes y el calendario). La
-- multi-selección de días se resuelve en clinicschedules/upsert insertando una
-- fila por día.
--
-- Orden de despliegue: aplicar ESTE script y reimportar enseguida
-- All Appointment Workflows.json (availability_rules/upsert y
-- availability_exceptions/upsert escriben los arrays). Mientras tanto el flujo
-- viejo no puede guardar reglas ni excepciones de doctores (el constraint
-- nuevo lo rechaza); la lectura no se ve afectada. El frontend va después.
-- =====================================================================

BEGIN;

-- 1. availability_rules: columnas array
ALTER TABLE public.availability_rules ADD COLUMN IF NOT EXISTS days_of_week smallint[];
ALTER TABLE public.availability_rules ADD COLUMN IF NOT EXISTS days_of_month smallint[];

COMMENT ON COLUMN public.availability_rules.days_of_week IS
    'Días ISO (1=lunes..7=domingo) para recurrence=''weekly''|''biweekly''.';
COMMENT ON COLUMN public.availability_rules.days_of_month IS
    'Días del mes (1-31) para recurrence=''monthly''. Un día que el mes no tiene no aplica.';

-- El constraint viejo exige las escalares: se saca antes del backfill.
ALTER TABLE public.availability_rules DROP CONSTRAINT IF EXISTS chk_rule_logic;

UPDATE public.availability_rules
   SET days_of_week = ARRAY[day_of_week]
 WHERE recurrence IN ('weekly', 'biweekly') AND days_of_week IS NULL AND day_of_week IS NOT NULL;

UPDATE public.availability_rules
   SET days_of_month = ARRAY[day_of_month]
 WHERE recurrence = 'monthly' AND days_of_month IS NULL AND day_of_month IS NOT NULL;

-- 2. 'daily' = lunes a viernes
UPDATE public.availability_rules
   SET recurrence = 'weekly', days_of_week = '{1,2,3,4,5}'::smallint[]
 WHERE recurrence = 'daily';

UPDATE public.availability_rules
   SET day_of_week = NULL, day_of_month = NULL
 WHERE day_of_week IS NOT NULL OR day_of_month IS NOT NULL;

-- 3. Constraints de availability_rules
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'availability_rules_days_of_week_check') THEN
        ALTER TABLE public.availability_rules
            ADD CONSTRAINT availability_rules_days_of_week_check
            CHECK (days_of_week IS NULL OR days_of_week <@ '{1,2,3,4,5,6,7}'::smallint[]);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'availability_rules_days_of_month_check') THEN
        ALTER TABLE public.availability_rules
            ADD CONSTRAINT availability_rules_days_of_month_check
            CHECK (days_of_month IS NULL OR days_of_month <@ '{1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31}'::smallint[]);
    END IF;
END $$;

ALTER TABLE public.availability_rules ADD CONSTRAINT chk_rule_logic CHECK (
    (recurrence = 'daily'    AND days_of_week IS NULL                         AND days_of_month IS NULL AND biweekly_reference_date IS NULL) OR
    (recurrence = 'weekly'   AND COALESCE(cardinality(days_of_week), 0) >= 1  AND days_of_month IS NULL AND biweekly_reference_date IS NULL) OR
    (recurrence = 'biweekly' AND COALESCE(cardinality(days_of_week), 0) >= 1  AND days_of_month IS NULL AND biweekly_reference_date IS NOT NULL) OR
    (recurrence = 'monthly'  AND COALESCE(cardinality(days_of_month), 0) >= 1 AND days_of_week IS NULL  AND biweekly_reference_date IS NULL)
);

-- 4. availability_exceptions: varias fechas
ALTER TABLE public.availability_exceptions ADD COLUMN IF NOT EXISTS dates date[];

COMMENT ON COLUMN public.availability_exceptions.dates IS
    'Fechas a las que aplica la excepción del doctor. exception_date = la primera.';

UPDATE public.availability_exceptions
   SET dates = ARRAY[exception_date]
 WHERE dates IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'availability_exceptions_dates_check') THEN
        ALTER TABLE public.availability_exceptions
            ADD CONSTRAINT availability_exceptions_dates_check
            CHECK (COALESCE(cardinality(dates), 0) >= 1);
    END IF;
END $$;

-- 5. get_available_users(): arrays de doctores + domingo de clinic_schedules
CREATE OR REPLACE FUNCTION public.get_available_users(
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
    -- clinic_schedules usa 0=domingo..6=sábado (CHECK 0-6), no ISODOW.
    local_schedule_dow SMALLINT := EXTRACT(DOW FROM local_timestamp);
    local_day_of_month SMALLINT := EXTRACT(DAY FROM local_timestamp);
    -- Lunes de la semana de local_date: base de la paridad quincenal.
    local_week_monday DATE := date_trunc('week', local_timestamp)::date;

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
                  (ce.recurrence = 'once' AND local_date = ANY(ce.dates)) OR
                  (ce.recurrence <> 'once' AND local_date >= ce.date AND (ce.end_date IS NULL OR local_date <= ce.end_date) AND (
                      (ce.recurrence = 'monthly' AND local_day_of_month = ANY(ce.days_of_month)) OR
                      (ce.recurrence = 'weekly' AND local_day_of_week = ANY(ce.days_of_week)) OR
                      (ce.recurrence = 'biweekly' AND local_day_of_week = ANY(ce.days_of_week)
                          AND ((local_week_monday - date_trunc('week', ce.biweekly_reference_date)::date) / 7) % 2 = 0)
                  ))
              )
            UNION ALL
            SELECT 1 FROM public.clinic_schedules cs
            WHERE cs.day_of_week = local_schedule_dow
              AND (p_sede_id IS NULL OR cs.sede_id = p_sede_id)
              AND local_time >= cs.start_time AND local_time < cs.end_time
            AND NOT EXISTS (
                SELECT 1 FROM public.clinic_exceptions ce2
                WHERE ce2.is_open = false
                  AND (p_sede_id IS NULL OR ce2.sede_id IS NULL OR ce2.sede_id = p_sede_id)
                  AND (ce2.start_time IS NULL OR local_time >= ce2.start_time)
                  AND (ce2.end_time IS NULL OR local_time < ce2.end_time)
                  AND (
                      (ce2.recurrence = 'once' AND local_date = ANY(ce2.dates)) OR
                      (ce2.recurrence <> 'once' AND local_date >= ce2.date AND (ce2.end_date IS NULL OR local_date <= ce2.end_date) AND (
                          (ce2.recurrence = 'monthly' AND local_day_of_month = ANY(ce2.days_of_month)) OR
                          (ce2.recurrence = 'weekly' AND local_day_of_week = ANY(ce2.days_of_week)) OR
                          (ce2.recurrence = 'biweekly' AND local_day_of_week = ANY(ce2.days_of_week)
                              AND ((local_week_monday - date_trunc('week', ce2.biweekly_reference_date)::date) / 7) % 2 = 0)
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
              -- 'daily' (lunes a viernes) ya no se crea: el script 139 lo pasa a weekly {1..5}.
              (r.recurrence = 'daily' AND local_day_of_week BETWEEN 1 AND 5) OR
              (r.recurrence = 'weekly' AND local_day_of_week = ANY(r.days_of_week)) OR
              (r.recurrence = 'biweekly' AND local_day_of_week = ANY(r.days_of_week)
                  AND ((local_week_monday - date_trunc('week', r.biweekly_reference_date)::date) / 7) % 2 = 0) OR
              (r.recurrence = 'monthly' AND local_day_of_month = ANY(r.days_of_month))
          )
    ),
    applicable_exceptions AS (
        SELECT e.user_id, e.is_available FROM public.availability_exceptions e
        WHERE local_date = ANY(e.dates)
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
    'Usuarios disponibles en un instante: clínica abierta (opcionalmente sólo la sede p_sede_id), regla o excepción de disponibilidad aplicable y sin cita en curso (ignorando p_exclude_appointment_id). Reglas y excepciones multi-día (arrays). Scripts 123 + 138 + 139.';

-- ─── Registro de migración ────────────────────────────────────────────────────

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '139_20261022_doctor-availability-multi-day.sql',
    'v1',
    'availability_rules: days_of_week/days_of_month (arrays), daily -> weekly L-V; availability_exceptions: dates (array); get_available_users con = ANY y domingo de clinic_schedules (DOW)'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;

-- =====================================================================
-- ROLLBACK (manual, si hiciera falta)
--
-- ⚠️ Antes, reimportar la versión previa de All Appointment Workflows
-- (availability_rules/upsert y availability_exceptions/upsert con columnas
-- escalares) y del frontend. Una regla o excepción con varios días se reduce
-- a su PRIMER día: el resto se pierde, y las reglas 'daily' migradas quedan
-- como weekly de lunes. Después, volver a aplicar el CREATE FUNCTION de
-- 138_20261022_exception-schedules-multi-day.sql.
-- =====================================================================
-- BEGIN;
-- ALTER TABLE public.availability_rules DROP CONSTRAINT IF EXISTS chk_rule_logic;
-- UPDATE public.availability_rules SET day_of_week  = days_of_week[1]  WHERE days_of_week  IS NOT NULL;
-- UPDATE public.availability_rules SET day_of_month = days_of_month[1] WHERE days_of_month IS NOT NULL;
-- ALTER TABLE public.availability_rules ADD CONSTRAINT chk_rule_logic CHECK (
--     ((recurrence = 'daily'::recurrence_type)    AND (day_of_week IS NULL)      AND (biweekly_reference_date IS NULL)     AND (day_of_month IS NULL)) OR
--     ((recurrence = 'weekly'::recurrence_type)   AND (day_of_week IS NOT NULL)  AND (biweekly_reference_date IS NULL)     AND (day_of_month IS NULL)) OR
--     ((recurrence = 'biweekly'::recurrence_type) AND (day_of_week IS NOT NULL)  AND (biweekly_reference_date IS NOT NULL) AND (day_of_month IS NULL)) OR
--     ((recurrence = 'monthly'::recurrence_type)  AND (day_of_month IS NOT NULL) AND (day_of_week IS NULL)                 AND (biweekly_reference_date IS NULL))
-- );
-- ALTER TABLE public.availability_rules DROP CONSTRAINT IF EXISTS availability_rules_days_of_week_check;
-- ALTER TABLE public.availability_rules DROP CONSTRAINT IF EXISTS availability_rules_days_of_month_check;
-- ALTER TABLE public.availability_rules DROP COLUMN IF EXISTS days_of_week;
-- ALTER TABLE public.availability_rules DROP COLUMN IF EXISTS days_of_month;
-- UPDATE public.availability_exceptions SET exception_date = dates[1] WHERE dates IS NOT NULL;
-- ALTER TABLE public.availability_exceptions DROP CONSTRAINT IF EXISTS availability_exceptions_dates_check;
-- ALTER TABLE public.availability_exceptions DROP COLUMN IF EXISTS dates;
-- DELETE FROM public.db_migrations WHERE script_name = '139_20261022_doctor-availability-multi-day.sql';
-- COMMIT;
