-- =============================================================================
-- Técnicos y operadores
-- =============================================================================
-- Crea lo que hace falta para que quien EJECUTA el estudio sea alguien distinto
-- de quien lo derivó:
--
--   1. Rol 'operador'
--   2. public.appointments.technician_id   a quién le toca ejecutar la cita
--   3. get_users_filtered: filtro 'OPERADOR', para la pantalla de configuración
--   4. Permisos TECHNICIANS_* y TASKS_* y su asignación a roles
--
-- POR QUÉ UNA COLUMNA NUEVA Y NO REUSAR assignee_id
-- --------------------------------------------------
-- `appointments.assignee_id` es el odontólogo DERIVADOR — decisión explícita del
-- cliente, y es lo que hace que la cita aparezca en la agenda de quien mandó al
-- paciente. El técnico que toma la radiografía es otra persona y otra pregunta:
-- "¿qué me toca hacer hoy?". Meter los dos en la misma columna obligaría a
-- elegir cuál de las dos agendas se rompe.
--
-- `sesiones_clinicas` no cambia: su `doctor_id` pasa a significar "quién
-- registró la sesión", que es lo que ya hace hoy cuando la registra una
-- recepcionista. La columna se queda con su nombre histórico para no tocar los
-- flujos que la leen.
--
-- QUÉ VE UN TÉCNICO
-- ------------------
-- Dos caminos que se suman, no se excluyen:
--   · las citas donde technician_id es él, y
--   · las citas de los calendarios a los que tenga acceso (public.calendar_users,
--     que ya existe y ya usa Mi Consultorio).
--
-- Dependencias: public.users, public.roles, public.user_roles, public.permissions,
--               public.role_permissions, public.appointments, public.calendar_users,
--               función get_users_filtered (definida fuera de este repo)
--
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Rol operador
-- -----------------------------------------------------------------------------
-- Sin id fijo: roles.id es una secuencia y clavar un número acá chocaría con
-- cualquier rol que el cliente haya creado por su cuenta.
INSERT INTO public.roles (name, description)
SELECT 'operador', 'Técnico u operador que ejecuta los estudios y registra la sesión clínica'
 WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE name = 'operador');

-- -----------------------------------------------------------------------------
-- 2. Técnico asignado a la cita
-- -----------------------------------------------------------------------------
ALTER TABLE public.appointments
    ADD COLUMN IF NOT EXISTS technician_id uuid;

COMMENT ON COLUMN public.appointments.technician_id IS
    'Técnico u operador que ejecuta la cita. NO confundir con assignee_id, que es el odontólogo derivador: son dos personas y dos agendas distintas. Nulo mientras nadie la haya tomado.';

CREATE INDEX IF NOT EXISTS idx_appointments_technician
    ON public.appointments (technician_id, start_datetime)
    WHERE technician_id IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_appointments_technician') THEN
        ALTER TABLE public.appointments
            ADD CONSTRAINT fk_appointments_technician
            FOREIGN KEY (technician_id) REFERENCES public.users (id) ON DELETE SET NULL;
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3. get_users_filtered: filtro OPERADOR
-- -----------------------------------------------------------------------------
-- La función se reescribe entera porque no hay otra forma de agregarle una rama
-- a un CASE dentro de un cuerpo PL/pgSQL. Se parte de su definición actual leída
-- de la base y se le agrega SÓLO la rama nueva; si el cuerpo ya la tiene, no se
-- toca nada.
--
-- Ojo: esta función vive en la base y no en el repo. Si alguien la modificó a
-- mano, este bloque preserva ese cambio — reemplaza sobre lo que hay, no sobre
-- una copia congelada.
DO $$
DECLARE
    def text;
    anchor text := $anchor$            OR (p_filter_type = 'PROVEEDOR' AND u.is_sales IS FALSE)$anchor$;
    branch text := $branch$            OR (p_filter_type = 'OPERADOR' AND EXISTS (
                SELECT 1 FROM public.user_roles ur
                JOIN public.roles r ON ur.role_id = r.id
                WHERE ur.user_id = u.id AND r.name = 'operador'
            ))
$branch$;
BEGIN
    SELECT pg_get_functiondef(oid) INTO def
      FROM pg_proc WHERE proname = 'get_users_filtered' LIMIT 1;

    IF def IS NULL THEN
        RAISE NOTICE '[tecnicos] get_users_filtered no existe: la pantalla de Técnicos no va a filtrar. Revisar el flujo Users Workflows.';
        RETURN;
    END IF;

    IF position('''OPERADOR''' IN def) > 0 THEN
        RAISE NOTICE '[tecnicos] get_users_filtered ya conoce OPERADOR.';
        RETURN;
    END IF;

    IF position(anchor IN def) = 0 THEN
        RAISE EXCEPTION '[tecnicos] No se encontró el punto de anclaje en get_users_filtered. Agregar la rama OPERADOR a mano antes de seguir.';
    END IF;

    EXECUTE replace(def, anchor, branch || anchor);
    RAISE NOTICE '[tecnicos] get_users_filtered ahora acepta filter_type = OPERADOR.';
END $$;

-- -----------------------------------------------------------------------------
-- 4. Permisos
-- -----------------------------------------------------------------------------
INSERT INTO permissions (name, description, code, module, submenu, permission_type)
VALUES
    ('Ver Menú de Técnicos', 'Acceder a la configuración de técnicos y operadores',
     'TECHNICIANS_VIEW_MENU', 'business_config', 'technicians', 'view'),
    ('Ver Técnicos', 'Ver el listado de técnicos y operadores',
     'TECHNICIANS_VIEW_LIST', 'business_config', 'technicians', 'view'),
    ('Crear Técnicos', 'Dar de alta técnicos y operadores',
     'TECHNICIANS_CREATE', 'business_config', 'technicians', 'write'),
    ('Editar Técnicos', 'Editar los datos de un técnico u operador',
     'TECHNICIANS_UPDATE', 'business_config', 'technicians', 'write'),
    ('Activar/Desactivar Técnicos', 'Cambiar el estado de un técnico u operador',
     'TECHNICIANS_TOGGLE_STATUS', 'business_config', 'technicians', 'write'),
    ('Ver Mis Tareas', 'Acceder al panel de tareas asignadas',
     'TASKS_VIEW_MENU', 'dashboard', 'tasks', 'view'),
    ('Asignar Técnico a una Cita', 'Elegir qué técnico ejecuta una cita',
     'APPOINTMENTS_ASSIGN_TECHNICIAN', 'appointments', 'appointments', 'write')
ON CONFLICT (code) DO NOTHING;

-- Administrador (4), Gerente (37) y Super Admin (97): configuración completa.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM (VALUES (4), (37), (97)) AS r(id)
  CROSS JOIN permissions p
 WHERE p.code IN (
    'TECHNICIANS_VIEW_MENU', 'TECHNICIANS_VIEW_LIST', 'TECHNICIANS_CREATE',
    'TECHNICIANS_UPDATE', 'TECHNICIANS_TOGGLE_STATUS',
    'TASKS_VIEW_MENU', 'APPOINTMENTS_ASSIGN_TECHNICIAN'
 )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Recepcionista (8): asigna técnico y ve la lista, pero no da de alta usuarios.
INSERT INTO role_permissions (role_id, permission_id)
SELECT 8, p.id FROM permissions p
 WHERE p.code IN ('TECHNICIANS_VIEW_LIST', 'APPOINTMENTS_ASSIGN_TECHNICIAN')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- El operador: su panel de tareas y lo que necesita para registrar la sesión.
--
-- Los códigos de sesión clínica son CLINICAL_SESSION_*, no TIMELINE_* — TIMELINE
-- sólo tiene VIEW. Se listan los reales; un código que no exista en este entorno
-- simplemente no se asigna, y el bloque de abajo lo avisa.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM public.roles r
  CROSS JOIN permissions p
 WHERE r.name = 'operador'
   AND p.code IN (
        'TASKS_VIEW_MENU',
        -- OJO: el operador NO lleva APPOINTMENTS_ASSIGN_TECHNICIAN.
        --
        -- Ese permiso significa "asignar a cualquiera", y en el panel de tareas
        -- significa además "mirar la carga de otro". Dárselo al operador para
        -- que pudiera auto-asignarse dejaba a cualquier técnico ver la agenda de
        -- sus compañeros. Tomar una cita libre para uno mismo no lo necesita:
        -- ASSIGN_TECHNICIAN_SQL tiene una rama explícita para el caso.
        -- Ve la bandeja de órdenes para saber qué le toca, pero no crea ni anula.
        'STUDY_ORDERS_VIEW_MENU', 'STUDY_ORDERS_VIEW_ALL', 'STUDY_ORDERS_VIEW_DETAIL',
        -- Registra la sesión clínica: es el corazón de su trabajo.
        'TIMELINE_VIEW',
        'CLINICAL_SESSION_CREATE', 'CLINICAL_SESSION_UPDATE',
        'CLINICAL_SESSION_VIEW_DETAIL',
        'CLINICAL_SESSION_UPLOAD_ATTACHMENT', 'CLINICAL_SESSION_VIEW_ATTACHMENTS'
   )
ON CONFLICT (role_id, permission_id) DO NOTHING;

DO $$
DECLARE faltan text[];
BEGIN
    SELECT array_agg(c) INTO faltan
      FROM unnest(ARRAY[
            'TIMELINE_VIEW', 'CLINICAL_SESSION_CREATE', 'CLINICAL_SESSION_UPDATE',
            'CLINICAL_SESSION_VIEW_DETAIL', 'CLINICAL_SESSION_UPLOAD_ATTACHMENT',
            'CLINICAL_SESSION_VIEW_ATTACHMENTS'
       ]) AS c
     WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.code = c);
    IF faltan IS NOT NULL THEN
        RAISE NOTICE '[tecnicos] Estos permisos de sesión clínica no existen en este entorno y no se asignaron al operador: %. Si el registro de sesiones le falla, revisar acá.', array_to_string(faltan, ', ');
    END IF;
END $$;

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '076_20260908_technicians.sql',
    'v1',
    'Técnicos y operadores — rol operador, appointments.technician_id, filtro OPERADOR en get_users_filtered, permisos TECHNICIANS_*/TASKS_*'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;

-- =============================================================================
-- Rollback manual
-- =============================================================================
-- Ojo: quitar la columna borra las asignaciones de técnico que ya existan, y
-- revertir get_users_filtered hay que hacerlo a mano (este script la modifica
-- sobre lo que encuentra, así que no hay una versión "anterior" que restaurar
-- automáticamente).
-- BEGIN;
-- ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS fk_appointments_technician;
-- DROP INDEX IF EXISTS public.idx_appointments_technician;
-- ALTER TABLE public.appointments DROP COLUMN IF EXISTS technician_id;
-- DELETE FROM role_permissions WHERE permission_id IN (
--     SELECT id FROM permissions WHERE code LIKE 'TECHNICIANS_%'
--        OR code IN ('TASKS_VIEW_MENU', 'APPOINTMENTS_ASSIGN_TECHNICIAN'));
-- DELETE FROM permissions WHERE code LIKE 'TECHNICIANS_%'
--    OR code IN ('TASKS_VIEW_MENU', 'APPOINTMENTS_ASSIGN_TECHNICIAN');
-- DELETE FROM user_roles WHERE role_id IN (SELECT id FROM roles WHERE name = 'operador');
-- DELETE FROM roles WHERE name = 'operador';
-- DELETE FROM db_migrations WHERE script_name = '076_20260908_technicians.sql';
-- COMMIT;
