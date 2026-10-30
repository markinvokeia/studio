-- =====================================================================
-- Horarios de Excepción — varios días por regla + paridad quincenal
-- Run on: dev / staging / prod
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- Depende de: 080_20260911_exception-schedules-recurrence.sql,
--             123_20261002_get-available-users-sede-and-exclusion.sql
-- =====================================================================
--
-- Contexto:
--   Cada fila de clinic_exceptions sólo podía expresar UN día: una fecha
--   ('once'), un día de la semana ('weekly'/'biweekly') o un día del mes
--   ('monthly'). Para cerrar, p. ej., lunes y miércoles había que cargar dos
--   reglas idénticas. Ahora una regla lleva la lista completa.
--
-- Cambios:
--   1. Columnas array (fuente de verdad desde este script):
--        · dates          date[]      → 'once'      (fechas sueltas)
--        · days_of_week   smallint[]  → 'weekly' | 'biweekly' (1=lun..7=dom)
--        · days_of_month  smallint[]  → 'monthly'   (1-31)
--      `date` se mantiene NOT NULL: para 'once' es la primera de `dates`
--      (orden de la lista); para el resto, el inicio de la recurrencia.
--   2. Backfill desde las columnas escalares day_of_week / day_of_month /
--      date. Las escalares quedan en NULL y sin uso; se borran en un script
--      posterior (se conservan por ahora para poder hacer rollback).
--   3. chk_exception_recurrence_logic reescrito sobre los arrays (al menos
--      un valor según `recurrence`) + rangos válidos de cada array.
--   4. get_available_users(): matchea con `= ANY(array)` y corrige la
--      paridad quincenal. Antes era
--        (EXTRACT(WEEK FROM fecha) - EXTRACT(WEEK FROM referencia)) % 2
--      que se invierte al cruzar un año de 53 semanas ISO (p. ej. 2026 →
--      2027: la semana 53 y la semana 1 quedaban con la misma paridad). Ahora
--      se cuenta la distancia real en semanas entre los lunes de ambas
--      fechas. Se corrige igual en availability_rules, que usa la misma
--      fórmula dentro de la función. Firma sin cambios (CREATE OR REPLACE).
--
-- Orden de despliegue: aplicar ESTE script y reimportar enseguida
-- All Appointment Workflows.json (feriados/upsert escribe los arrays).
-- Mientras tanto el flujo viejo no puede guardar excepciones (escribe las
-- escalares y el constraint nuevo lo rechaza); la lectura no se ve afectada.
-- El frontend nuevo va después.
-- =====================================================================

BEGIN;

-- 1. Columnas array
ALTER TABLE public.clinic_exceptions ADD COLUMN IF NOT EXISTS dates date[];
ALTER TABLE public.clinic_exceptions ADD COLUMN IF NOT EXISTS days_of_week smallint[];
ALTER TABLE public.clinic_exceptions ADD COLUMN IF NOT EXISTS days_of_month smallint[];

COMMENT ON COLUMN public.clinic_exceptions.dates IS
    'Fechas a las que aplica una excepción recurrence=''once''. `date` = la primera.';
COMMENT ON COLUMN public.clinic_exceptions.days_of_week IS
    'Días ISO (1=lunes..7=domingo) para recurrence=''weekly''|''biweekly''.';
COMMENT ON COLUMN public.clinic_exceptions.days_of_month IS
    'Días del mes (1-31) para recurrence=''monthly''. Un día que el mes no tiene no aplica.';

-- El constraint viejo exige las escalares: se saca antes del backfill.
ALTER TABLE public.clinic_exceptions DROP CONSTRAINT IF EXISTS chk_exception_recurrence_logic;

-- 2. Backfill (sólo filas aún sin arrays → idempotente)
UPDATE public.clinic_exceptions
   SET dates = ARRAY[date]
 WHERE recurrence = 'once' AND dates IS NULL;

UPDATE public.clinic_exceptions
   SET days_of_week = ARRAY[day_of_week]
 WHERE recurrence IN ('weekly', 'biweekly') AND days_of_week IS NULL AND day_of_week IS NOT NULL;

UPDATE public.clinic_exceptions
   SET days_of_month = ARRAY[day_of_month]
 WHERE recurrence = 'monthly' AND days_of_month IS NULL AND day_of_month IS NOT NULL;

UPDATE public.clinic_exceptions
   SET day_of_week = NULL, day_of_month = NULL
 WHERE day_of_week IS NOT NULL OR day_of_month IS NOT NULL;

-- 3. Constraints
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clinic_exceptions_days_of_week_check') THEN
        ALTER TABLE public.clinic_exceptions
            ADD CONSTRAINT clinic_exceptions_days_of_week_check
            CHECK (days_of_week IS NULL OR days_of_week <@ '{1,2,3,4,5,6,7}'::smallint[]);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clinic_exceptions_days_of_month_check') THEN
        ALTER TABLE public.clinic_exceptions
            ADD CONSTRAINT clinic_exceptions_days_of_month_check
            CHECK (days_of_month IS NULL OR days_of_month <@ '{1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31}'::smallint[]);
    END IF;
END $$;

ALTER TABLE public.clinic_exceptions ADD CONSTRAINT chk_exception_recurrence_logic CHECK (
    (recurrence = 'once'     AND COALESCE(cardinality(dates), 0) >= 1         AND days_of_week IS NULL AND days_of_month IS NULL AND biweekly_reference_date IS NULL AND end_date IS NULL) OR
    (recurrence = 'weekly'   AND COALESCE(cardinality(days_of_week), 0) >= 1  AND dates IS NULL        AND days_of_month IS NULL AND biweekly_reference_date IS NULL) OR
    (recurrence = 'biweekly' AND COALESCE(cardinality(days_of_week), 0) >= 1  AND dates IS NULL        AND days_of_month IS NULL AND biweekly_reference_date IS NOT NULL) OR
    (recurrence = 'monthly'  AND COALESCE(cardinality(days_of_month), 0) >= 1 AND dates IS NULL        AND days_of_week IS NULL  AND biweekly_reference_date IS NULL)
);

-- 4. get_available_users(): arrays + paridad quincenal por distancia real en semanas.
--    (date_trunc('week', x) = lunes de esa semana; la diferencia entre dos
--    lunes es siempre múltiplo de 7. `% 2 = 0` también vale para negativos.)
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
              (r.recurrence = 'daily' AND local_day_of_week BETWEEN 1 AND 5) OR
              (r.recurrence = 'weekly' AND local_day_of_week = r.day_of_week) OR
              (r.recurrence = 'biweekly' AND local_day_of_week = r.day_of_week
                  AND ((local_week_monday - date_trunc('week', r.biweekly_reference_date)::date) / 7) % 2 = 0) OR
              (r.recurrence = 'monthly' AND local_day_of_month = r.day_of_month)
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
    'Usuarios disponibles en un instante: clínica abierta (opcionalmente sólo la sede p_sede_id), regla o excepción de disponibilidad aplicable y sin cita en curso (ignorando p_exclude_appointment_id). Excepciones de clínica multi-día (arrays). Scripts 123 + 138.';

-- ─── Registro de migración ────────────────────────────────────────────────────

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '138_20261022_exception-schedules-multi-day.sql',
    'v1',
    'clinic_exceptions: dates/days_of_week/days_of_month (arrays) con backfill; constraint reescrito; get_available_users con = ANY y paridad quincenal por distancia en semanas'
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
-- (feriados/upsert con columnas escalares) y del frontend.
-- Una regla con varios días se reduce a su PRIMER día: el resto se pierde.
-- Después, volver a aplicar el CREATE FUNCTION de
-- 123_20261002_get-available-users-sede-and-exclusion.sql.
-- =====================================================================
-- BEGIN;
-- ALTER TABLE public.clinic_exceptions DROP CONSTRAINT IF EXISTS chk_exception_recurrence_logic;
-- UPDATE public.clinic_exceptions SET day_of_week  = days_of_week[1]  WHERE days_of_week  IS NOT NULL;
-- UPDATE public.clinic_exceptions SET day_of_month = days_of_month[1] WHERE days_of_month IS NOT NULL;
-- UPDATE public.clinic_exceptions SET date = dates[1] WHERE recurrence = 'once' AND dates IS NOT NULL;
-- ALTER TABLE public.clinic_exceptions ADD CONSTRAINT chk_exception_recurrence_logic CHECK (
--     (recurrence = 'once'     AND day_of_week IS NULL     AND day_of_month IS NULL AND biweekly_reference_date IS NULL AND end_date IS NULL) OR
--     (recurrence = 'weekly'   AND day_of_week IS NOT NULL AND day_of_month IS NULL AND biweekly_reference_date IS NULL) OR
--     (recurrence = 'biweekly' AND day_of_week IS NOT NULL AND day_of_month IS NULL AND biweekly_reference_date IS NOT NULL) OR
--     (recurrence = 'monthly'  AND day_of_month IS NOT NULL AND day_of_week IS NULL AND biweekly_reference_date IS NULL)
-- );
-- ALTER TABLE public.clinic_exceptions DROP CONSTRAINT IF EXISTS clinic_exceptions_days_of_week_check;
-- ALTER TABLE public.clinic_exceptions DROP CONSTRAINT IF EXISTS clinic_exceptions_days_of_month_check;
-- ALTER TABLE public.clinic_exceptions DROP COLUMN IF EXISTS dates;
-- ALTER TABLE public.clinic_exceptions DROP COLUMN IF EXISTS days_of_week;
-- ALTER TABLE public.clinic_exceptions DROP COLUMN IF EXISTS days_of_month;
-- DELETE FROM public.db_migrations WHERE script_name = '138_20261022_exception-schedules-multi-day.sql';
-- COMMIT;
