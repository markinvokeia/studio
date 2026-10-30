-- =====================================================================
-- Grupos de pacientes → soporte de doctor y external_id
--   1. groups.is_doctor    → indica si el grupo representa a un doctor.
--   2. groups.user_id       → user_id del doctor asociado (FK a users).
--   3. groups.external_id    → identificador externo para integraciones.
--   4. group_patients.external_id → identificador externo de la asociación.
--
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- =====================================================================

BEGIN;

-- -----------------------------------------------------------------------
-- 1. Columnas nuevas en public.groups
-- -----------------------------------------------------------------------
ALTER TABLE public.groups
    ADD COLUMN IF NOT EXISTS is_doctor   boolean NOT NULL DEFAULT false;

ALTER TABLE public.groups
    ADD COLUMN IF NOT EXISTS user_id     uuid;

ALTER TABLE public.groups
    ADD COLUMN IF NOT EXISTS external_id text;

-- FK groups.user_id → users.id (el doctor). ON DELETE SET NULL: si se
-- elimina el usuario, el grupo permanece pero deja de apuntar al doctor.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'groups'
          AND constraint_name = 'groups_user_id_fkey'
    ) THEN
        ALTER TABLE public.groups
            ADD CONSTRAINT groups_user_id_fkey FOREIGN KEY (user_id)
                REFERENCES public.users (id) MATCH SIMPLE
                ON UPDATE NO ACTION ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_groups_user_id
    ON public.groups USING btree (user_id ASC NULLS LAST)
    TABLESPACE pg_default;

COMMENT ON COLUMN public.groups.is_doctor
    IS 'Indica si el grupo representa a un doctor.';
COMMENT ON COLUMN public.groups.user_id
    IS 'user_id del doctor asociado al grupo (cuando is_doctor = true).';
COMMENT ON COLUMN public.groups.external_id
    IS 'Identificador externo del grupo para integraciones.';

-- -----------------------------------------------------------------------
-- 2. Columna nueva en public.group_patients
-- -----------------------------------------------------------------------
ALTER TABLE public.group_patients
    ADD COLUMN IF NOT EXISTS external_id text;

COMMENT ON COLUMN public.group_patients.external_id
    IS 'Identificador externo de la asociación grupo-paciente para integraciones.';

-- -----------------------------------------------------------------------
-- 3. Registro de migración
-- -----------------------------------------------------------------------
INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '064_20260713_groups-doctor-and-external-id.sql',
    'v1',
    'groups: is_doctor, user_id (FK users) y external_id; group_patients: external_id'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;
