-- =============================================================================
-- Rol operador — corregir los permisos que quedaron mal en DEV
-- =============================================================================
-- Estado encontrado en DEV después de correr 076:
--
--   APPOINTMENTS_ASSIGN_TECHNICIAN     ← NO debería tenerlo
--   CLINICAL_SESSION_*                 ✓
--   TASKS_VIEW_MENU, TIMELINE_VIEW     ✓
--   (ningún STUDY_ORDERS_*)            ← SÍ debería tenerlos
--
-- Dos correcciones, y ninguna la resuelve volver a correr 076:
--
--   1. QUITAR APPOINTMENTS_ASSIGN_TECHNICIAN.
--      076 ya no lo otorga, pero un INSERT nunca borra: la fila sigue ahí. Ese
--      permiso significa "asignar a cualquiera" y, en /appointments/technician-
--      tasks, significaba además "mirar la carga de otro" — con él, cualquier
--      técnico podía ver la agenda de sus compañeros. Auto-asignarse una cita
--      libre no lo necesita: ASSIGN_TECHNICIAN_SQL tiene una rama propia.
--
--   2. AGREGAR los STUDY_ORDERS_* de lectura, que 076 sí lista pero que no
--      llegaron a aplicarse. Sin ellos el operador no ve el menú de Órdenes.
--
-- LO QUE ESTE SCRIPT NO ARREGLA (y no hace falta que arregle)
-- -----------------------------------------------------------
-- La actividad que no se registraba al guardar la sesión desde Mis Tareas NO
-- era un problema de permisos de rol, aunque lo pareciera. Se corrigió en el
-- SQL de los flujos: /study-orders/by-appointment y /study-orders/recompute
-- ahora dejan pasar también al TÉCNICO ASIGNADO a la cita, por pertenencia.
-- Cerrar la propia cita no debería exigir poder leer la bandeja entera, así que
-- la solución no es repartir STUDY_ORDERS_VIEW_ALL.
--
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Quitar el permiso de asignación
-- -----------------------------------------------------------------------------
DELETE FROM public.role_permissions rp
 USING public.roles r, public.permissions p
 WHERE rp.role_id = r.id
   AND rp.permission_id = p.id
   AND r.name = 'operador'
   AND p.code = 'APPOINTMENTS_ASSIGN_TECHNICIAN';

-- -----------------------------------------------------------------------------
-- 2. Dar los de lectura de órdenes
-- -----------------------------------------------------------------------------
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM public.roles r
  CROSS JOIN public.permissions p
 WHERE r.name = 'operador'
   AND p.code IN ('STUDY_ORDERS_VIEW_MENU', 'STUDY_ORDERS_VIEW_ALL', 'STUDY_ORDERS_VIEW_DETAIL')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. Dejar constancia de cómo quedó
-- -----------------------------------------------------------------------------
DO $$
DECLARE tiene text;
BEGIN
    SELECT string_agg(p.code, ', ' ORDER BY p.code) INTO tiene
      FROM public.role_permissions rp
      JOIN public.roles r       ON r.id = rp.role_id
      JOIN public.permissions p ON p.id = rp.permission_id
     WHERE r.name = 'operador';

    IF tiene IS NULL THEN
        RAISE NOTICE '[operador] El rol no existe o no tiene permisos. ¿Se corrió 076?';
    ELSE
        RAISE NOTICE '[operador] Permisos: %', tiene;
    END IF;
END $$;

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '078_20260909_operator-permissions.sql',
    'v1',
    'Rol operador — quita APPOINTMENTS_ASSIGN_TECHNICIAN (dejaba ver la agenda de otros técnicos) y agrega los STUDY_ORDERS_* de lectura que 076 no aplicó'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;

-- =============================================================================
-- Rollback manual
-- =============================================================================
-- Devolver APPOINTMENTS_ASSIGN_TECHNICIAN reabre el agujero descrito arriba.
-- BEGIN;
-- DELETE FROM public.role_permissions rp USING public.roles r, public.permissions p
--  WHERE rp.role_id = r.id AND rp.permission_id = p.id
--    AND r.name = 'operador' AND p.code LIKE 'STUDY_ORDERS_%';
-- DELETE FROM public.db_migrations WHERE script_name = '078_20260909_operator-permissions.sql';
-- COMMIT;
