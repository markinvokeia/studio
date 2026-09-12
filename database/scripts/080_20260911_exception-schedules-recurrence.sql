-- =====================================================================
-- Horarios de Excepción (ex "Días Feriados"): recurrencia semanal /
-- quincenal / mensual, además de la fecha puntual existente.
-- Run on: dev / staging / prod
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- =====================================================================
--
-- Contexto:
--   clinic_exceptions solo soportaba una fecha exacta por fila (feriados,
--   cierres puntuales). Se necesita poder expresar patrones recurrentes
--   ("todos los lunes cerramos a las 13h", "el día 15 de cada mes",
--   "cada 2 semanas los viernes"), igual que ya se hizo para
--   availability_rules (ver 079_20260911_doctor-availability-monthly.sql).
--
-- Cambios:
--   1. clinic_exceptions.recurrence (text, default 'once'). No se usa un
--      ENUM nuevo: 'once' no tiene relación con el enum recurrence_type
--      existente (pensado para disponibilidad de doctores, con 'daily' sin
--      sentido acá), así que se usa texto + CHECK — más simple y evita la
--      restricción de Postgres de no poder usar un valor de enum recién
--      agregado en la misma transacción (por eso esta migración cabe en
--      una sola transacción, a diferencia de la 079).
--   2. clinic_exceptions.day_of_week   (smallint, 1-7, para weekly/biweekly)
--   3. clinic_exceptions.day_of_month  (smallint, 1-31, para monthly)
--   4. clinic_exceptions.biweekly_reference_date (date, ancla de paridad,
--      igual mecanismo que availability_rules.biweekly_reference_date)
--   5. clinic_exceptions.end_date (date, nullable = recurrencia indefinida)
--   6. chk_exception_recurrence_logic: exige la combinación correcta de
--      columnas según `recurrence` (mismo patrón que chk_rule_logic).
--   7. get_available_users(): las dos referencias a clinic_exceptions
--      (apertura excepcional y cierre excepcional) pasan de comparar
--      `date = local_date` a evaluar el patrón de recurrencia completo.
--
-- Compatibilidad: las filas existentes no se tocan — quedan con
-- recurrence='once' (default) y siguen matcheando por fecha exacta.
-- =====================================================================

BEGIN;

-- 1-5. Columnas nuevas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'clinic_exceptions' AND column_name = 'recurrence'
    ) THEN
        ALTER TABLE public.clinic_exceptions ADD COLUMN recurrence text NOT NULL DEFAULT 'once';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'clinic_exceptions' AND column_name = 'day_of_week'
    ) THEN
        ALTER TABLE public.clinic_exceptions ADD COLUMN day_of_week smallint;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'clinic_exceptions' AND column_name = 'day_of_month'
    ) THEN
        ALTER TABLE public.clinic_exceptions ADD COLUMN day_of_month smallint;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'clinic_exceptions' AND column_name = 'biweekly_reference_date'
    ) THEN
        ALTER TABLE public.clinic_exceptions ADD COLUMN biweekly_reference_date date;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'clinic_exceptions' AND column_name = 'end_date'
    ) THEN
        ALTER TABLE public.clinic_exceptions ADD COLUMN end_date date;
    END IF;
END $$;

-- Rangos válidos
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clinic_exceptions_recurrence_check') THEN
        ALTER TABLE public.clinic_exceptions
            ADD CONSTRAINT clinic_exceptions_recurrence_check
            CHECK (recurrence IN ('once', 'weekly', 'biweekly', 'monthly'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clinic_exceptions_day_of_week_check') THEN
        ALTER TABLE public.clinic_exceptions
            ADD CONSTRAINT clinic_exceptions_day_of_week_check
            CHECK (day_of_week IS NULL OR (day_of_week BETWEEN 1 AND 7));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clinic_exceptions_day_of_month_check') THEN
        ALTER TABLE public.clinic_exceptions
            ADD CONSTRAINT clinic_exceptions_day_of_month_check
            CHECK (day_of_month IS NULL OR (day_of_month BETWEEN 1 AND 31));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clinic_exceptions_biweekly_reference_date_check') THEN
        ALTER TABLE public.clinic_exceptions
            ADD CONSTRAINT clinic_exceptions_biweekly_reference_date_check
            CHECK (biweekly_reference_date IS NULL OR EXTRACT(ISODOW FROM biweekly_reference_date) = 1);
    END IF;
END $$;

-- 6. chk_exception_recurrence_logic
ALTER TABLE public.clinic_exceptions DROP CONSTRAINT IF EXISTS chk_exception_recurrence_logic;

ALTER TABLE public.clinic_exceptions ADD CONSTRAINT chk_exception_recurrence_logic CHECK (
    (recurrence = 'once'     AND day_of_week IS NULL     AND day_of_month IS NULL AND biweekly_reference_date IS NULL AND end_date IS NULL) OR
    (recurrence = 'weekly'   AND day_of_week IS NOT NULL AND day_of_month IS NULL AND biweekly_reference_date IS NULL) OR
    (recurrence = 'biweekly' AND day_of_week IS NOT NULL AND day_of_month IS NULL AND biweekly_reference_date IS NOT NULL) OR
    (recurrence = 'monthly'  AND day_of_month IS NOT NULL AND day_of_week IS NULL AND biweekly_reference_date IS NULL)
);

-- 7. get_available_users(): clinic_exceptions ahora recurrence-aware
CREATE OR REPLACE FUNCTION public.get_available_users(utc_timestamp timestamp with time zone, clinic_timezone text)
 RETURNS TABLE(user_id uuid, user_name text, user_email text)
 LANGUAGE plpgsql
AS $function$
DECLARE
    -- 1. Convertimos el instante UTC de n8n a la hora de Montevideo (ej. 13:00Z -> 10:00)
    local_timestamp TIMESTAMP := utc_timestamp AT TIME ZONE clinic_timezone;
    local_date DATE := local_timestamp::date;
    local_time TIME := local_timestamp::time;
    local_day_of_week SMALLINT := EXTRACT(ISODOW FROM local_timestamp);

    -- 2. Usamos esta misma variable local para consultar las tablas "sin zona horaria"
    comparison_timestamp TIMESTAMP := local_timestamp;
BEGIN
    RETURN QUERY
    WITH is_clinic_open AS (
        SELECT EXISTS (
            SELECT 1 FROM public.clinic_exceptions ce
            WHERE ce.is_open = true
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
              AND local_time >= cs.start_time AND local_time < cs.end_time
            AND NOT EXISTS (
                SELECT 1 FROM public.clinic_exceptions ce2
                WHERE ce2.is_open = false
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
    )
    SELECT u.id, u.name, u.email
    FROM public.users u
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
      -- [PG-SENSEI: Lógica corregida para buscar citas locales]
      AND NOT EXISTS (
          SELECT 1 FROM public.appointments a
          WHERE a.assignee_id = u.id
            -- Al usar comparison_timestamp (10:00 local), los índices de tu tabla se usarán correctamente
            AND a.start_datetime <= comparison_timestamp
            AND a.end_datetime > comparison_timestamp
            AND a.status NOT IN ('cancelled', 'canceled', 'declined', 'no_show')
      );
END;
$function$;

-- ─── Registro de migración ────────────────────────────────────────────────────

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '080_20260911_exception-schedules-recurrence.sql',
    'v1',
    'clinic_exceptions: recurrence/day_of_week/day_of_month/biweekly_reference_date/end_date; get_available_users actualizada'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;
