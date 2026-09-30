-- =====================================================================
-- Teléfono repetible entre pacientes (configurable)
--
--   1. clinic_preferences.allow_duplicate_phone (boolean, default FALSE).
--      FALSE ⇒ el /users/upsert de n8n sigue BLOQUEANDO un teléfono ya usado
--      (ahora el mensaje dice quién lo tiene). TRUE ⇒ solo ADVIERTE de quién lo
--      tiene y deja guardar si la secretaria confirma (solo pacientes; doctores,
--      operadores y proveedores siguen siendo únicos).
--   2. Se elimina la unicidad del teléfono a nivel de tabla, que impedía TRUE:
--        - users_phone_number_key  UNIQUE (phone_number)
--      La unicidad pasa a validarse en n8n (/users/upsert, registro del portal,
--      alta desde WhatsApp), que ya consultaba `EXISTS` antes de escribir.
--   3. Se crean índices NO únicos sobre phone_number (crudo y normalizado a dígitos),
--      porque n8n busca por esa columna (validación de duplicados, login del portal, identificación por
--      WhatsApp).
--
-- El CORREO, el documento de identidad y el RUT SIGUEN siendo únicos (el índice
-- users_email_unique_idx no se toca): los flujos de contraseña y el login del
-- portal identifican a la persona por correo.
--
-- Los datos existentes no cambian: ya eran únicos y siguen siéndolo hasta que
-- alguien active la opción y confirme un duplicado.
--
-- ⚠ Con la opción activa, varias fichas pueden compartir teléfono. Los flujos
--   que resuelven "el paciente de este teléfono" (identificación en WhatsApp,
--   login del portal) toman ahora la ficha más antigua y activa de forma
--   determinista (ver docs/n8n-flows).
--
-- Idempotente. Depende de: 068_20260814_clinic-preferences-and-discounts.sql
-- =====================================================================

BEGIN;

ALTER TABLE public.clinic_preferences
    ADD COLUMN IF NOT EXISTS allow_duplicate_phone BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.clinic_preferences.allow_duplicate_phone IS
    'Si TRUE, un paciente puede compartir teléfono con otro: el alta solo advierte de quién lo tiene y pide confirmación. FALSE (default) ⇒ bloquea el duplicado, como hasta ahora. El correo sigue siendo único. La validación vive en n8n (/users/upsert).';

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_phone_number_key;

CREATE INDEX IF NOT EXISTS idx_users_phone_number
    ON public.users (phone_number) WHERE phone_number IS NOT NULL;

-- Las validaciones de n8n (/users/upsert, login y registro del portal) comparan el
-- teléfono normalizado a solo dígitos; sin este índice de expresión harían seq scan.
-- La expresión debe coincidir literalmente con la de las consultas.
CREATE INDEX IF NOT EXISTS idx_users_phone_digits
    ON public.users ((regexp_replace(coalesce(phone_number, ''), '\D', '', 'g')))
    WHERE phone_number IS NOT NULL;

INSERT INTO public.db_migrations (script_name, version_tag, notes)
VALUES (
    '121_20260930_allow-duplicate-phone.sql',
    'v1',
    'clinic_preferences.allow_duplicate_phone; se quita UNIQUE de users.phone_number (la unicidad pasa a n8n) y se crea índice no único'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;

-- =====================================================================
-- ROLLBACK (manual, si hiciera falta)
-- Solo funciona si NO hay teléfonos repetidos: revisar primero con
--   SELECT phone_number, count(*) FROM users WHERE phone_number IS NOT NULL GROUP BY 1 HAVING count(*) > 1;
-- =====================================================================
-- BEGIN;
-- DROP INDEX IF EXISTS public.idx_users_phone_number;
-- DROP INDEX IF EXISTS public.idx_users_phone_digits;
-- ALTER TABLE public.users ADD CONSTRAINT users_phone_number_key UNIQUE (phone_number);
-- ALTER TABLE public.clinic_preferences DROP COLUMN IF EXISTS allow_duplicate_phone;
-- DELETE FROM public.db_migrations WHERE script_name = '121_20260930_allow-duplicate-phone.sql';
-- COMMIT;
