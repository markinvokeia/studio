-- =====================================================================
-- Portal del Paciente — aviso de seña al reservar
--
--   1. clinic.patient_portal_deposit_notice_enabled → si está activo, al
--      terminar una reserva NUEVA desde el portal el paciente ve el aviso de
--      seña y el mismo bloque se agrega al email "Tu cita quedó agendada".
--      Apagado por defecto: ninguna clínica cambia de comportamiento al migrar.
--   2. clinic.patient_portal_deposit_hours → horas que tiene el paciente para
--      abonar la seña (1-72, por defecto 2). Es sólo el texto del aviso: NO hay
--      cancelación automática, la cita la cancela recepción a mano.
--   3. communication_templates 'PORTAL_DEPOSIT_NOTICE' → el HTML del aviso.
--      Se edita desde Configuración → Portal del Paciente. Variables:
--      {{patient_name}} {{date}} {{time}} {{deadline}} {{hours}}
--      {{clinic_name}} {{clinic_phone}}. El contenido sembrado es genérico, con
--      datos bancarios de ejemplo que cada clínica reemplaza.
--      Debe coincidir con DEFAULT_DEPOSIT_NOTICE_HTML
--      (src/lib/patient-deposit-notice.ts), que es lo que restaura el botón
--      "Restaurar plantilla".
--
-- ORDEN DE DESPLIEGUE: este script ANTES de importar "Patient Portal — Public
-- Clinic Info": el flujo lee y escribe estas columnas, y sin ellas fallarían
-- GET /api/public/clinic (todo el portal) y el email de reserva.
--
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios (la
-- plantilla sólo se inserta si no existe, nunca pisa la editada).
-- Depende de: 159_20261104_patient-portal-booking-window.sql
-- =====================================================================

BEGIN;

-- -----------------------------------------------------------------------
-- 1. Configuración
-- -----------------------------------------------------------------------
ALTER TABLE public.clinic
    ADD COLUMN IF NOT EXISTS patient_portal_deposit_notice_enabled boolean NOT NULL DEFAULT FALSE;

ALTER TABLE public.clinic
    ADD COLUMN IF NOT EXISTS patient_portal_deposit_hours integer NOT NULL DEFAULT 2;

COMMENT ON COLUMN public.clinic.patient_portal_deposit_notice_enabled IS 'Muestra el aviso de seña (plantilla PORTAL_DEPOSIT_NOTICE) al reservar desde el portal y lo agrega al email de la reserva.';
COMMENT ON COLUMN public.clinic.patient_portal_deposit_hours          IS 'Horas para abonar la seña desde la reserva (1-72). Sólo informativo: no cancela citas.';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'clinic_patient_portal_deposit_hours_check'
    ) THEN
        ALTER TABLE public.clinic
            ADD CONSTRAINT clinic_patient_portal_deposit_hours_check
            CHECK (patient_portal_deposit_hours BETWEEN 1 AND 72);
    END IF;
END $$;

-- -----------------------------------------------------------------------
-- 2. Plantilla del aviso
-- -----------------------------------------------------------------------
INSERT INTO public.communication_templates (code, name, type, subject, body_html, is_active, created_by)
SELECT 'PORTAL_DEPOSIT_NOTICE',
       'Portal del Paciente — aviso de seña',
       'EMAIL',
       NULL,
       $tpl$<div style="max-width:560px;margin:0 auto;font-family:Georgia,'Times New Roman',serif;color:#4a2c1d;background:#f8efe7;border-radius:16px;padding:24px;">
  <p style="margin:0 0 4px;text-align:center;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#8a6a55;">{{clinic_name}}</p>
  <h2 style="margin:0 0 16px;text-align:center;font-size:24px;line-height:1.25;font-weight:700;color:#4a2c1d;">Tu lugar todavía no está reservado</h2>
  <div style="background:#ead7c7;border-radius:14px;padding:16px 18px;margin:0 0 16px;text-align:center;">
    <p style="margin:0 0 6px;font-size:18px;line-height:1.4;">Se solicita la <strong>seña del 50%</strong> para guardar tu cita del <strong>{{date}}</strong> a las <strong>{{time}}</strong>.</p>
    <p style="margin:0;font-size:15px;line-height:1.5;">Tenés hasta el <strong>{{deadline}}</strong> ({{hours}} h) para abonarla. <em>Si no la recibimos, la cita se cancela y el horario se libera.</em></p>
  </div>
  <div style="border:1px solid #d9bfa9;border-radius:14px;padding:14px 18px;margin:0 0 16px;background:#fffaf6;">
    <p style="margin:0 0 6px;font-size:16px;font-weight:700;">Banco (nombre del banco)</p>
    <p style="margin:0;font-size:15px;line-height:1.6;">Nº de cuenta: <strong>000000</strong><br>Nombre: Titular de la cuenta</p>
  </div>
  <p style="margin:0 0 4px;text-align:center;font-size:15px;">Enviá el comprobante al</p>
  <p style="margin:0 0 4px;text-align:center;font-size:26px;font-weight:700;letter-spacing:0.04em;">{{clinic_phone}}</p>
  <p style="margin:0 0 16px;text-align:center;font-size:15px;">y confirmamos tu reserva.</p>
  <p style="margin:0 0 16px;text-align:center;font-size:14px;color:#6b4c3a;">También podés abonar por: Prex · Mercado Pago</p>
  <p style="margin:0;text-align:center;font-size:18px;font-style:italic;">Desde ya, muchas gracias</p>
</div>$tpl$,
       TRUE,
       (SELECT u.id FROM public.users u
        LEFT JOIN public.user_roles ur ON ur.user_id = u.id
        LEFT JOIN public.roles ro ON ro.id = ur.role_id
        ORDER BY (LOWER(TRIM(ro.name)) = 'administrador') DESC NULLS LAST, u.id
        LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.communication_templates t WHERE t.code = 'PORTAL_DEPOSIT_NOTICE');

-- -----------------------------------------------------------------------
-- 3. Registro de migración
-- -----------------------------------------------------------------------
INSERT INTO public.db_migrations (script_name, version_tag, notes)
VALUES (
    '181_20261127_patient-portal-deposit-notice.sql',
    'v1',
    'Portal del Paciente — aviso de seña configurable (toggle, horas y plantilla PORTAL_DEPOSIT_NOTICE)'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;

-- =====================================================================
-- ROLLBACK (manual) — primero reimportar el flujo anterior
-- =====================================================================
-- BEGIN;
-- DELETE FROM public.communication_templates WHERE code = 'PORTAL_DEPOSIT_NOTICE';
-- ALTER TABLE public.clinic DROP CONSTRAINT IF EXISTS clinic_patient_portal_deposit_hours_check;
-- ALTER TABLE public.clinic
--   DROP COLUMN IF EXISTS patient_portal_deposit_notice_enabled,
--   DROP COLUMN IF EXISTS patient_portal_deposit_hours;
-- DELETE FROM public.db_migrations WHERE script_name = '181_20261127_patient-portal-deposit-notice.sql';
-- COMMIT;
