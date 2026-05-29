-- =====================================================================
-- Licensing — tablas licenses y subscriptions, permisos y asignación a roles
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- =====================================================================

BEGIN;

-- =====================================================================
-- Función trigger: update_updated_at_column()
-- Idempotente: CREATE OR REPLACE no falla si ya existe.
-- =====================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------
-- 1. Tabla licenses (una fila por clínica — licencia activa)
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.licenses (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id   UUID        NOT NULL,
    license_key TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT licenses_clinic_id_key UNIQUE (clinic_id)
);

DROP TRIGGER IF EXISTS set_updated_at ON public.licenses;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.licenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------
-- 2. Tabla subscriptions (historial — una fila por licencia generada)
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id                UUID        NOT NULL,
    license_id               UUID        NOT NULL,
    subscription_type        TEXT        NOT NULL
                             CHECK (subscription_type IN ('monthly', 'annual', 'custom')),
    start_date               DATE        NOT NULL,
    end_date                 DATE        NOT NULL,
    max_doctors              INT         NOT NULL DEFAULT 0,
    max_receptionists        INT         NOT NULL DEFAULT 0,
    max_admins               INT         NOT NULL DEFAULT 0,
    max_super_admins         INT         NOT NULL DEFAULT 0,
    max_monthly_new_patients INT         NOT NULL DEFAULT 0,
    ai_access                TEXT        NOT NULL DEFAULT 'none'
                             CHECK (ai_access IN ('full', 'doctors_only', 'none')),
    notes                    TEXT,
    issued_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------
-- 3. Permisos
-- -----------------------------------------------------------------------
INSERT INTO permissions (name, description, code, module, submenu, permission_type)
VALUES
    ('Ver Menú de Licencias',
     'Acceder al menú de licencias en el panel de sistema',
     'LICENSING_VIEW_MENU', 'system', 'licenses', 'view'),

    ('Ver Licencia',
     'Ver la licencia activa y sus atributos',
     'LICENSING_VIEW', 'system', 'licenses', 'view'),

    ('Generar Licencia',
     'Generar y guardar una nueva licencia cifrada',
     'LICENSING_GENERATE', 'system', 'licenses', 'write'),

    ('Ver Menú de Suscripciones',
     'Acceder al menú de historial de suscripciones',
     'SUBSCRIPTIONS_VIEW_MENU', 'subscriptions', 'subscriptions', 'view'),

    ('Ver Suscripciones',
     'Consultar el historial de suscripciones',
     'SUBSCRIPTIONS_VIEW', 'subscriptions', 'subscriptions', 'view')
ON CONFLICT (code) DO NOTHING;

-- -----------------------------------------------------------------------
-- 4. Otorgar a Administrador (id=4) y Gerente (id=37)
-- -----------------------------------------------------------------------
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.id
FROM (VALUES (4), (37)) AS r(role_id)
CROSS JOIN permissions p
WHERE p.code IN (
    'LICENSING_VIEW_MENU',
    'LICENSING_VIEW',
    'LICENSING_GENERATE',
    'SUBSCRIPTIONS_VIEW_MENU',
    'SUBSCRIPTIONS_VIEW'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- -----------------------------------------------------------------------
-- 5. Registro de migración
-- -----------------------------------------------------------------------
INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '030_20260529_licensing-tables-and-permissions.sql',
    'v1',
    'Licensing — tablas licenses y subscriptions, permisos y asignación a roles'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;
