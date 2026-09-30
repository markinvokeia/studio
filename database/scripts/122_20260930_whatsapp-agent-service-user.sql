-- =============================================================================
-- Agente de WhatsApp — usuario de servicio y rol `agente_ia`
-- =============================================================================
-- Contexto (docs/whatsapp-ordenes-estudio-plan.md, Fase 0):
--
--   Para crear y agendar órdenes de estudio, el agente reutiliza los endpoints
--   existentes (`/study-orders/upsert`, `/submit`, ...), que autorizan con
--   `jwtAuth` y con los permisos STUDY_ORDERS_* del usuario del token. En vez de
--   duplicar ese SQL en webhooks propios, el agente actúa como un usuario más,
--   con un rol de permisos mínimos.
--
--   1. Rol `agente_ia`.
--   2. Usuario "Agente WhatsApp" (sin contraseña: no puede iniciar sesión; su
--      único acceso es el JWT que se firma con scripts/n8n/generate-agent-jwt.mjs
--      y se guarda como credencial de n8n).
--   3. Permisos del rol.
--
-- PERMISOS (y por qué cada uno)
--   STUDY_ORDERS_VIEW_DETAIL    leer el detalle de la orden que acaba de crear
--   STUDY_ORDERS_CREATE         crear la orden
--   STUDY_ORDERS_CREATE_FOR_DOCTOR  poner como derivador al doctor que figura en la
--                               orden en papel (sin esto quedaría como derivador
--                               el propio agente)
--   STUDY_ORDERS_SUBMIT         enviarla. SUBMIT_SQL exige ser el doctor de la orden
--                               O tener VIEW_ALL; como el derivador es otro usuario,
--                               hace falta VIEW_ALL
--   STUDY_ORDERS_VIEW_ALL       ver lo anterior (ver SUBMIT)
--   STUDY_ORDERS_SCHEDULE       generar el token de agendamiento y agendar
--   STUDY_ORDERS_SEARCH_PATIENT resolver/crear el paciente sin abrir el padrón
--
--   NO se le da CANCEL, ACKNOWLEDGE, DELETE ni UPDATE: anular, tomar o borrar
--   órdenes es trabajo de recepción. Si el agente necesita cancelar la cita de
--   un paciente, lo hace por los flujos de citas, no por estos permisos.
--
-- EL JWT NO CADUCA
--   Los tokens de Invoke llevan `expiresIn` como claim literal, no `exp`, y el
--   webhook `jwtAuth` de n8n sólo verifica la firma. Un JWT de servicio es, por
--   tanto, válido hasta que se rote el secreto. Para cortar el acceso del agente
--   sin rotar el secreto: desactivar el rol (user_roles.is_active = false) o el
--   usuario; los endpoints de órdenes leen los permisos de la base en cada
--   llamada, así que el efecto es inmediato.
--
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- Depende de: 071_20260906_study-orders.sql (permisos STUDY_ORDERS_*)
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Rol
-- -----------------------------------------------------------------------------
-- Sin id fijo: roles.id es una secuencia (ver 076 para el mismo criterio).
INSERT INTO public.roles (name, description)
SELECT 'agente_ia', 'Agente de WhatsApp: crea y agenda órdenes de estudio en nombre de quien escribe. Usuario de servicio, sin acceso por interfaz.'
 WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE name = 'agente_ia');

-- -----------------------------------------------------------------------------
-- 2. Usuario de servicio
-- -----------------------------------------------------------------------------
-- Sin password: no hay forma de iniciar sesión con él. El email es un dominio
-- reservado (.invalid, RFC 2606) para que nunca reciba correo real.
INSERT INTO public.users (name, email, is_active)
SELECT 'Agente WhatsApp', 'agente-whatsapp@sistema.invokeia.invalid', true
 WHERE NOT EXISTS (
     SELECT 1 FROM public.users WHERE email = 'agente-whatsapp@sistema.invokeia.invalid'
 );

INSERT INTO public.user_roles (user_id, role_id, is_active)
SELECT u.id, r.id, true
  FROM public.users u
  JOIN public.roles r ON r.name = 'agente_ia'
 WHERE u.email = 'agente-whatsapp@sistema.invokeia.invalid'
ON CONFLICT (user_id, role_id) DO UPDATE SET is_active = true;

-- -----------------------------------------------------------------------------
-- 3. Permisos del rol
-- -----------------------------------------------------------------------------
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM public.roles r
  JOIN public.permissions p ON p.code IN (
      'STUDY_ORDERS_VIEW_DETAIL',
      'STUDY_ORDERS_CREATE',
      'STUDY_ORDERS_CREATE_FOR_DOCTOR',
      'STUDY_ORDERS_SUBMIT',
      'STUDY_ORDERS_VIEW_ALL',
      'STUDY_ORDERS_SCHEDULE',
      'STUDY_ORDERS_SEARCH_PATIENT'
  )
 WHERE r.name = 'agente_ia'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4. Chequeo informativo
-- -----------------------------------------------------------------------------
DO $$
DECLARE n int;
BEGIN
    SELECT count(*) INTO n
      FROM public.role_permissions rp
      JOIN public.roles r ON r.id = rp.role_id
     WHERE r.name = 'agente_ia';
    IF n < 7 THEN
        RAISE NOTICE '[whatsapp-agent] agente_ia tiene % permisos (se esperaban 7). ¿Corrió 071_20260906_study-orders.sql?', n;
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 5. Registro de migración
-- -----------------------------------------------------------------------------
INSERT INTO public.db_migrations (script_name, version_tag, notes)
VALUES (
    '122_20260930_whatsapp-agent-service-user.sql',
    'v1',
    'Agente WhatsApp — rol agente_ia, usuario de servicio y permisos STUDY_ORDERS_* mínimos'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;

-- =============================================================================
-- Rollback manual
-- =============================================================================
-- BEGIN;
-- DELETE FROM public.user_roles
--  WHERE user_id IN (SELECT id FROM public.users WHERE email = 'agente-whatsapp@sistema.invokeia.invalid');
-- DELETE FROM public.role_permissions
--  WHERE role_id IN (SELECT id FROM public.roles WHERE name = 'agente_ia');
-- DELETE FROM public.users WHERE email = 'agente-whatsapp@sistema.invokeia.invalid';
-- DELETE FROM public.roles WHERE name = 'agente_ia';
-- DELETE FROM public.db_migrations WHERE script_name = '122_20260930_whatsapp-agent-service-user.sql';
-- COMMIT;
