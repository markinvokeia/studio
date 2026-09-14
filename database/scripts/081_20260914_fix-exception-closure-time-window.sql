BEGIN;

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
      AND NOT EXISTS (
          SELECT 1 FROM public.appointments a
          WHERE a.assignee_id = u.id
            AND a.start_datetime <= comparison_timestamp
            AND a.end_datetime > comparison_timestamp
            AND a.status NOT IN ('cancelled', 'canceled', 'declined', 'no_show')
      );
END;
$function$;

-- ─── Registro de migración ────────────────────────────────────────────────────

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '081_20260914_fix-exception-closure-time-window.sql',
    'v1',
    'get_available_users: excepciones de cierre ahora respetan su rango horario en la rama del horario normal (antes bloqueaban el día completo)'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;
