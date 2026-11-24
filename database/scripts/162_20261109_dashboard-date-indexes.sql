-- =====================================================================
-- Índices para el Panel de Control Gerencial (flujo n8n "Dashboard Gerencial")
--
-- Las consultas del dashboard filtran por rango de fechas sobre
-- appointments.start_datetime, invoices.created_at y payments.created_at,
-- y ninguna de esas columnas tenía índice: cada tarjeta recorría la tabla
-- entera. El flujo ahora compara los rangos contra el timestamp
-- (col >= ini AND col < fin + 1) en vez de col::date BETWEEN, que es lo que
-- permite usar estos índices.
--
--   1. idx_appointments_start_datetime: rangos de citas (dashboard, y
--      también el calendario y los reportes que filtran por fecha).
--   2. idx_appointments_attended_patient: "primera visita atendida" de un
--      paciente (paciente nuevo vs recurrente) como min() por índice en vez
--      de agrupar toda la historia de citas.
--   3. idx_invoices_sales_created_at / idx_payments_sales_created_at:
--      producción y cobranza por período (solo filas de venta).
--   4. idx_invoice_items_invoice_id: FK sin índice; ventas por servicio
--      unía invoice_items con invoices recorriendo toda la tabla.
--
-- Sin CONCURRENTLY a propósito, para que el script se pueda correr entero
-- (y dentro de una transacción, como lo hacen Liquibase y los editores SQL).
-- CREATE INDEX normal bloquea las escrituras (no las lecturas) de la tabla
-- mientras se construye el índice, pero estas tablas son chicas (la mayor,
-- appointments, ~63 mil filas e índices de ~1,5 MB en DEV): la construcción
-- tarda menos de un segundo. Para una base de cliente con millones de citas,
-- correr cada CREATE INDEX con CONCURRENTLY, de a uno y fuera de transacción.
--
-- Idempotente.
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_appointments_start_datetime
  ON public.appointments (start_datetime);

CREATE INDEX IF NOT EXISTS idx_appointments_attended_patient
  ON public.appointments (patient_id, start_datetime)
  WHERE status IN ('completed', 'attended_late', 'arrived_late');

CREATE INDEX IF NOT EXISTS idx_invoices_sales_created_at
  ON public.invoices (created_at)
  WHERE is_sales;

CREATE INDEX IF NOT EXISTS idx_payments_sales_created_at
  ON public.payments (created_at)
  WHERE is_sales;

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id
  ON public.invoice_items (invoice_id);

ANALYZE public.appointments;
ANALYZE public.invoices;
ANALYZE public.payments;
ANALYZE public.invoice_items;
