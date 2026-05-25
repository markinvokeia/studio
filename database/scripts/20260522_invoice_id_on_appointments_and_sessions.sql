-- =====================================================================
-- Agrega invoice_id (nullable) a citas, sesiones clínicas y sesiones
-- Run on: dev / staging / prod
-- Idempotente: se puede correr varias veces sin efectos secundarios.
-- =====================================================================
--
-- Cambios:
--   1. appointments.invoice_id      (INTEGER, nullable)
--   2. sesiones_clinicas.invoice_id (INTEGER, nullable)
--   3. sesiones.invoice_id          (INTEGER, nullable)
--
-- Propósito:
--   Permite asociar una factura a una cita o sesión clínica/odontograma
--   para que el wizard de Cobro Rápido reutilice la factura existente
--   en lugar de crear una nueva cada vez.
-- =====================================================================

BEGIN;

-- ─── 1. appointments ──────────────────────────────────────────────────────────

ALTER TABLE public.appointments
    ADD COLUMN IF NOT EXISTS invoice_id INTEGER NULL;

COMMENT ON COLUMN public.appointments.invoice_id
    IS 'Factura vinculada a esta cita. Si existe, el Cobro Rápido la reutiliza en lugar de crear una nueva.';

ALTER TABLE public.appointments
    DROP CONSTRAINT IF EXISTS appointments_invoice_id_fkey;

ALTER TABLE public.appointments
    ADD CONSTRAINT appointments_invoice_id_fkey
    FOREIGN KEY (invoice_id)
    REFERENCES public.invoices (id)
    ON DELETE SET NULL
    ON UPDATE NO ACTION;

CREATE INDEX IF NOT EXISTS idx_appointments_invoice_id
    ON public.appointments (invoice_id)
    WHERE invoice_id IS NOT NULL;

-- ─── 2. sesiones_clinicas ─────────────────────────────────────────────────────

ALTER TABLE public.sesiones_clinicas
    ADD COLUMN IF NOT EXISTS invoice_id INTEGER NULL;

COMMENT ON COLUMN public.sesiones_clinicas.invoice_id
    IS 'Factura vinculada a esta sesión clínica. Si existe, el Cobro Rápido la reutiliza en lugar de crear una nueva.';

ALTER TABLE public.sesiones_clinicas
    DROP CONSTRAINT IF EXISTS sesiones_clinicas_invoice_id_fkey;

ALTER TABLE public.sesiones_clinicas
    ADD CONSTRAINT sesiones_clinicas_invoice_id_fkey
    FOREIGN KEY (invoice_id)
    REFERENCES public.invoices (id)
    ON DELETE SET NULL
    ON UPDATE NO ACTION;

CREATE INDEX IF NOT EXISTS idx_sesiones_clinicas_invoice_id
    ON public.sesiones_clinicas (invoice_id)
    WHERE invoice_id IS NOT NULL;

-- ─── 3. sesiones (odontograma) ────────────────────────────────────────────────

ALTER TABLE public.sesiones
    ADD COLUMN IF NOT EXISTS invoice_id INTEGER NULL;

COMMENT ON COLUMN public.sesiones.invoice_id
    IS 'Factura vinculada a esta sesión de odontograma. Si existe, el Cobro Rápido la reutiliza en lugar de crear una nueva.';

ALTER TABLE public.sesiones
    DROP CONSTRAINT IF EXISTS sesiones_invoice_id_fkey;

ALTER TABLE public.sesiones
    ADD CONSTRAINT sesiones_invoice_id_fkey
    FOREIGN KEY (invoice_id)
    REFERENCES public.invoices (id)
    ON DELETE SET NULL
    ON UPDATE NO ACTION;

CREATE INDEX IF NOT EXISTS idx_sesiones_invoice_id
    ON public.sesiones (invoice_id)
    WHERE invoice_id IS NOT NULL;

COMMIT;
