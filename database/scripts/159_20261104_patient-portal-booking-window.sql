-- =====================================================================
-- Portal del Paciente — hasta qué fecha puede reservar el paciente
--
--   1. clinic.patient_portal_booking_window_unit / _value → la ventana que
--      configura la clínica:
--        · 'days'   + N ⇒ hasta hoy + N días.
--        · 'months' + N ⇒ hasta el último día del mes calendario N, contando
--                         el actual como el 1. Con N = 1 sólo el mes en curso.
--      Los meses son calendario a propósito: "un mes desde hoy" sería casi lo
--      mismo que 30 días y no permitiría limitar la reserva al mes actual.
--   2. patient_portal_booking_limit_date() → última fecha reservable. La usan
--      /appointments/upsert y /appointments/upsert_noauth para rechazar del
--      lado del servidor lo que la pantalla ya no ofrece.
--
-- Notas:
--   · Default 30 días: ninguna clínica cambia de comportamiento por migrar.
--   · Sólo aplica a los pacientes. El staff agenda sin este límite.
--   · "Hoy" se calcula en America/Montevideo, la misma zona fija que usan los
--     flujos de n8n: `clinic` no tiene columna de zona horaria y la BD corre en
--     UTC, así que now()::date daría el día siguiente a partir de las 21:00.
--
-- ORDEN DE DESPLIEGUE: este script ANTES de importar los flujos. Los dos
-- webhooks de citas llaman a la función, y sin ella fallaría TODA alta de cita,
-- también las del staff.
--
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- Depende de: 122_20260930_service-booking-and-images.sql
-- =====================================================================

BEGIN;

-- -----------------------------------------------------------------------
-- 1. Configuración de la ventana
-- -----------------------------------------------------------------------
ALTER TABLE public.clinic
    ADD COLUMN IF NOT EXISTS patient_portal_booking_window_unit varchar(10) NOT NULL DEFAULT 'days';

ALTER TABLE public.clinic
    ADD COLUMN IF NOT EXISTS patient_portal_booking_window_value integer NOT NULL DEFAULT 30;

COMMENT ON COLUMN public.clinic.patient_portal_booking_window_unit  IS 'Unidad de la ventana de reserva del portal: days (desde hoy) o months (meses calendario, el actual cuenta como 1).';
COMMENT ON COLUMN public.clinic.patient_portal_booking_window_value IS 'Tamaño de la ventana: 1-365 días o 1-12 meses. months + 1 ⇒ sólo el mes en curso.';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'clinic_patient_portal_booking_window_check'
    ) THEN
        ALTER TABLE public.clinic
            ADD CONSTRAINT clinic_patient_portal_booking_window_check
            CHECK (
                (patient_portal_booking_window_unit = 'days'   AND patient_portal_booking_window_value BETWEEN 1 AND 365)
             OR (patient_portal_booking_window_unit = 'months' AND patient_portal_booking_window_value BETWEEN 1 AND 12)
            );
    END IF;
END $$;

-- -----------------------------------------------------------------------
-- 2. Última fecha reservable
--    Devuelve siempre una fecha, aunque no haya clínica activa: con el LEFT
--    JOIN cae al default y el flujo de n8n nunca se queda sin fila.
--    `p_today` existe para poder probar los bordes de mes sin tocar el reloj.
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.patient_portal_booking_limit_date(p_today date DEFAULT NULL)
RETURNS date
LANGUAGE sql
STABLE
AS $$
    SELECT CASE
             WHEN c.patient_portal_booking_window_unit = 'months' THEN
               (date_trunc('month', d.today::timestamp)
                 + make_interval(months => c.patient_portal_booking_window_value)
                 - interval '1 day')::date
             ELSE
               d.today + COALESCE(c.patient_portal_booking_window_value, 30)
           END
    FROM (
        SELECT COALESCE(p_today, (now() AT TIME ZONE 'America/Montevideo')::date) AS today
    ) d
    LEFT JOIN LATERAL (
        SELECT patient_portal_booking_window_unit, patient_portal_booking_window_value
        FROM public.clinic
        WHERE is_active IS NOT FALSE
        ORDER BY id
        LIMIT 1
    ) c ON TRUE;
$$;

COMMENT ON FUNCTION public.patient_portal_booking_limit_date(date) IS 'Última fecha que un paciente puede reservar según la ventana configurada en clinic. Inclusive.';

-- -----------------------------------------------------------------------
-- 3. Registro de migración
-- -----------------------------------------------------------------------
INSERT INTO public.db_migrations (script_name, version_tag, notes)
VALUES (
    '159_20261104_patient-portal-booking-window.sql',
    'v1',
    'Portal del Paciente — ventana de reserva configurable (días o meses calendario) y patient_portal_booking_limit_date()'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;

-- =====================================================================
-- ROLLBACK (manual) — primero reimportar los flujos anteriores
-- =====================================================================
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.patient_portal_booking_limit_date(date);
-- ALTER TABLE public.clinic DROP CONSTRAINT IF EXISTS clinic_patient_portal_booking_window_check;
-- ALTER TABLE public.clinic
--   DROP COLUMN IF EXISTS patient_portal_booking_window_unit,
--   DROP COLUMN IF EXISTS patient_portal_booking_window_value;
-- DELETE FROM public.db_migrations WHERE script_name = '159_20261104_patient-portal-booking-window.sql';
-- COMMIT;
