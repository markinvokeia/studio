-- =====================================================================
-- Disponibilidad de doctor: recurrencia mensual (día fijo del mes)
-- Run on: dev / staging / prod
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- =====================================================================
--
-- Contexto:
--   Un cliente tiene una doctora que trabaja solo algunos días fijos de
--   cada mes (ej. día 5 y día 20). El modelo de availability_rules solo
--   soportaba recurrencia por día de semana (daily/weekly/biweekly), sin
--   forma de expresar "el día N de cada mes" sin recrear la regla todos
--   los meses a mano.
--
-- Cambios:
--   1. recurrence_type: nuevo valor de enum 'monthly'.
--   2. availability_rules.day_of_month (smallint, 1-31, nullable).
--   3. chk_rule_logic actualizado: 'monthly' exige day_of_month y prohíbe
--      day_of_week / biweekly_reference_date (igual patrón que los demás
--      casos de recurrencia).
--   4. get_available_users(): nueva rama para 'monthly' —
--      EXTRACT(DAY FROM local_date) = r.day_of_month. Si el día no existe
--      en un mes (ej. 31 en febrero), la regla simplemente no aplica ese
--      mes; no hay ajuste al último día del mes.
--
-- NOTA: el ALTER TYPE ... ADD VALUE va en su propia transacción porque
--   Postgres no permite usar un valor de enum recién agregado dentro de
--   la misma transacción en la que se agregó (falla con "unsafe use of
--   new value of enum type"). Por eso este script tiene dos BEGIN/COMMIT
--   separados en lugar de uno solo.
-- =====================================================================

-- ─── Transacción 1: nuevo valor de enum ───────────────────────────────────────

BEGIN;

ALTER TYPE recurrence_type ADD VALUE IF NOT EXISTS 'monthly';

COMMIT;

-- ─── Transacción 2: columna, constraint y función ─────────────────────────────

BEGIN;

-- 1. Columna day_of_month
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'availability_rules'
          AND column_name = 'day_of_month'
    ) THEN
        ALTER TABLE public.availability_rules ADD COLUMN day_of_month smallint;
    END IF;
END $$;

-- 2. Rango válido para day_of_month
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'availability_rules_day_of_month_check'
    ) THEN
        ALTER TABLE public.availability_rules
            ADD CONSTRAINT availability_rules_day_of_month_check
            CHECK (day_of_month IS NULL OR (day_of_month BETWEEN 1 AND 31));
    END IF;
END $$;

-- 3. chk_rule_logic: agregar el caso 'monthly'
ALTER TABLE public.availability_rules DROP CONSTRAINT IF EXISTS chk_rule_logic;

ALTER TABLE public.availability_rules ADD CONSTRAINT chk_rule_logic CHECK (
    (recurrence = 'daily'    AND day_of_week IS NULL     AND biweekly_reference_date IS NULL AND day_of_month IS NULL) OR
    (recurrence = 'weekly'   AND day_of_week IS NOT NULL AND biweekly_reference_date IS NULL AND day_of_month IS NULL) OR
    (recurrence = 'biweekly' AND day_of_week IS NOT NULL AND biweekly_reference_date IS NOT NULL AND day_of_month IS NULL) OR
    (recurrence = 'monthly'  AND day_of_month IS NOT NULL AND day_of_week IS NULL AND biweekly_reference_date IS NULL)
);

-- 4. get_available_users(): nueva rama para 'monthly'
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
            WHERE ce.date = local_date AND ce.is_open = true
              AND local_time >= ce.start_time AND local_time < ce.end_time
            UNION ALL
            SELECT 1 FROM public.clinic_schedules cs
            WHERE cs.day_of_week = local_day_of_week
              AND local_time >= cs.start_time AND local_time < cs.end_time
            AND NOT EXISTS (SELECT 1 FROM public.clinic_exceptions ce2 WHERE ce2.date = local_date AND ce2.is_open = false)
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
    '079_20260911_doctor-availability-monthly.sql',
    'v1',
    'recurrence_type + valor monthly; availability_rules.day_of_month; chk_rule_logic y get_available_users actualizados'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;
