-- =====================================================================
-- Tipo de documento de identidad: DNI y NIE (España)
--
--   1. users.identity_document_type → el CHECK pasa a aceptar también
--      'dni' (8 dígitos + letra de control) y 'nie' (X/Y/Z + 7 dígitos +
--      letra de control). La validación del formato la hace el frontend
--      (src/lib/identity-document.ts); la base solo restringe los valores.
--      Los registros existentes no cambian.
--
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- Depende de: 086_20260916_identity-document-type.sql
-- =====================================================================

BEGIN;

-- -----------------------------------------------------------------------
-- 1. Nuevos valores permitidos en users.identity_document_type
-- -----------------------------------------------------------------------
ALTER TABLE public.users
    DROP CONSTRAINT IF EXISTS users_identity_document_type_check;
ALTER TABLE public.users
    ADD CONSTRAINT users_identity_document_type_check
    CHECK (identity_document_type IN ('cedula_uy', 'cedula_ext', 'pasaporte_uy', 'pasaporte_ext', 'dni', 'nie'));

COMMENT ON COLUMN public.users.identity_document_type IS
    'Formato del documento guardado en identity_document: cedula_uy (con dígito verificador), dni y nie (España, con letra de control), cedula_ext, pasaporte_uy o pasaporte_ext (genéricos, sin checksum). Default cedula_uy para preservar los datos existentes.';

-- -----------------------------------------------------------------------
-- 2. Registro de migración
-- -----------------------------------------------------------------------
INSERT INTO public.db_migrations (script_name, version_tag, notes)
VALUES (
    '135_20261018_identity-document-type-dni-nie.sql',
    'v1',
    'users.identity_document_type acepta también dni y nie'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;

-- =====================================================================
-- ROLLBACK (manual, si hiciera falta)
-- Falla si ya hay usuarios con 'dni' o 'nie': reasignarles otro tipo antes.
-- =====================================================================
-- BEGIN;
-- ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_identity_document_type_check;
-- ALTER TABLE public.users
--     ADD CONSTRAINT users_identity_document_type_check
--     CHECK (identity_document_type IN ('cedula_uy', 'cedula_ext', 'pasaporte_uy', 'pasaporte_ext'));
-- DELETE FROM public.db_migrations WHERE script_name = '135_20261018_identity-document-type-dni-nie.sql';
-- COMMIT;
