-- =============================================================================
-- Elimina todo lo creado por seed_demo_screenshots.sql.
-- Sólo toca filas marcadas (internal_id 'DEMO-%' / external_id 'demo-seed-%').
-- Revisar el conteo del paso 0 antes de confirmar el COMMIT.
-- =============================================================================

BEGIN;

-- 0. Qué se va a borrar
SELECT 'appointments' AS tabla, count(*) FROM appointments WHERE external_id LIKE 'demo-seed-%'
UNION ALL
SELECT 'users', count(*) FROM users WHERE internal_id LIKE 'DEMO-%';

-- 1. Citas (appointment_service_catalog / status log dependen del id de la cita)
DELETE FROM appointment_service_catalog
WHERE appointment_id IN (SELECT id FROM appointments WHERE external_id LIKE 'demo-seed-%');

DELETE FROM appointment_status_log
WHERE appointment_id IN (SELECT id FROM appointments WHERE external_id LIKE 'demo-seed-%');

-- Citas creadas a mano durante las capturas sobre pacientes demo también se van.
DELETE FROM appointments
WHERE external_id LIKE 'demo-seed-%'
   OR patient_id  IN (SELECT id FROM users WHERE internal_id LIKE 'DEMO-%')
   OR assignee_id IN (SELECT id FROM users WHERE internal_id LIKE 'DEMO-%');

-- 2. Usuarios (user_roles, calendar_users y user_communication_preferences caen por CASCADE).
--    Menores primero por la FK responsible_contact_id.
DELETE FROM users WHERE internal_id LIKE 'DEMO-PAC-%' AND is_dependant;
DELETE FROM users WHERE internal_id LIKE 'DEMO-%';

COMMIT;
