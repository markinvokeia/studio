-- =====================================================================
-- Permiso: crear/editar citas desde el perfil del paciente
-- Run on: dev / staging / prod
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- =====================================================================
--
-- Contexto:
--   Desde el perfil del paciente ahora se puede crear una cita (menú
--   "Crear" > Agenda > Cita) y editar una existente (lápiz de la cita en
--   la línea de tiempo del historial), en las dos casos con la misma
--   tarjeta inline que usa el calendario.
--
--   Esa vía tiene su propio permiso en lugar de reusar APPOINTMENTS_CREATE
--   / APPOINTMENTS_UPDATE: así se puede dar acceso al calendario sin
--   habilitar la edición desde el perfil, o al revés.
--
-- Cambios:
--   1. permissions: PATIENTS_MANAGE_APPOINTMENTS
--   2. role_permissions: se asigna a Administrador y Recepcionista, que
--      son los roles que ya gestionan citas en el calendario.
--
-- Nota: el rol Doctor queda deliberadamente afuera, igual que con
--   APPOINTMENTS_UPDATE. Si se quiere habilitar a Gerente, agregar su
--   nombre a la lista de la sección 2 (hoy ese rol solo lee citas).
-- =====================================================================

BEGIN;

-- ─── 1. El permiso ────────────────────────────────────────────────────────────

INSERT INTO permissions (name, description, code, module, submenu, permission_type)
VALUES (
    'Gestionar Citas del Paciente',
    'Crear y editar citas desde el perfil del paciente (menú Crear y línea de tiempo del historial)',
    'PATIENTS_MANAGE_APPOINTMENTS',
    'patients',
    'patients',
    'write'
)
ON CONFLICT (code) DO NOTHING;

-- ─── 2. Asignación a roles (resueltos por nombre) ─────────────────────────────
-- Por nombre y no por id: los ids de rol difieren entre las bases de cada cliente.
-- Con LOWER porque el casing tampoco es consistente entre entornos: en DEV los
-- roles están en minúscula ('administrador') y hay scripts previos que los
-- buscaron capitalizados ('Cajero').

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE LOWER(TRIM(r.name)) IN ('administrador', 'recepcionista')
  AND p.code = 'PATIENTS_MANAGE_APPOINTMENTS'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ─── Registro de migración ────────────────────────────────────────────────────

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '069_20260908_patients-manage-appointments-permission.sql',
    'v1',
    'permissions: PATIENTS_MANAGE_APPOINTMENTS + asignación a Administrador y Recepcionista'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;
