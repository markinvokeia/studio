-- =====================================================================
-- Índice sobre users.responsible_contact_id
--
--   La pestaña "Dependientes" de la ficha del paciente lista a los pacientes a
--   cargo de un tutor (GET /users/dependents: WHERE responsible_contact_id = $1),
--   y /users/upsert y /users/responsible verifican si un paciente ya tiene
--   dependientes antes de dejarlo pasar a dependiente. Sin índice, cada una de
--   esas consultas recorre toda la tabla users.
--
--   Parcial: solo las filas con tutor (la gran mayoría de los usuarios no tiene).
--
-- Idempotente.
-- =====================================================================

BEGIN;

CREATE INDEX IF NOT EXISTS users_responsible_contact_id_idx
    ON public.users (responsible_contact_id)
    WHERE responsible_contact_id IS NOT NULL;

INSERT INTO public.db_migrations (script_name, version_tag, notes)
VALUES (
    '145_20261029_users-responsible-contact-index.sql',
    'v1',
    'Índice parcial en users.responsible_contact_id para listar los dependientes de un tutor'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;

-- =====================================================================
-- ROLLBACK (manual, si hiciera falta)
-- =====================================================================
-- BEGIN;
-- DROP INDEX IF EXISTS public.users_responsible_contact_id_idx;
-- DELETE FROM public.db_migrations WHERE script_name = '145_20261029_users-responsible-contact-index.sql';
-- COMMIT;
