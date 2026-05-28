-- =====================================================================
-- Doc Print Templates — tabla, permisos y asignación a roles
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- =====================================================================

BEGIN;

-- =====================================================================
-- Función trigger: update_updated_at_column()
-- Actualiza automáticamente updated_at en cada UPDATE.
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
-- 1. Tabla
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.doc_print_templates (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    template_type VARCHAR(20) NOT NULL
                  CHECK (template_type IN ('quote','invoice','payment','credit_note','prepayment')),
    template_html TEXT        NOT NULL,
    is_active     BOOLEAN     NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger updated_at (usa la función que ya existe en la BD)
DROP TRIGGER IF EXISTS set_updated_at ON public.doc_print_templates;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.doc_print_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.doc_print_templates
    ADD CONSTRAINT doc_print_templates_template_type_key UNIQUE (template_type);

-- -----------------------------------------------------------------------
-- 2. Permisos
-- -----------------------------------------------------------------------
INSERT INTO permissions (name, description, code, module, submenu, permission_type)
VALUES
    ('Ver Plantillas de Documentos',
     'Acceder al editor de plantillas de impresión',
     'PRINT_TEMPLATES_VIEW', 'config', 'print_templates', 'view'),

    ('Editar Plantillas de Documentos',
     'Crear y modificar plantillas de impresión',
     'PRINT_TEMPLATES_EDIT', 'config', 'print_templates', 'write')
ON CONFLICT (code) DO NOTHING;

-- -----------------------------------------------------------------------
-- 3. Otorgar a Administrador (id=4) y Gerente (id=37)
-- -----------------------------------------------------------------------
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.id
FROM (VALUES (4), (37)) AS r(role_id)
CROSS JOIN permissions p
WHERE p.code IN ('PRINT_TEMPLATES_VIEW', 'PRINT_TEMPLATES_EDIT')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '029_20260528_print-templates-table-and-permissions.sql',   -- ← nombre real del archivo
    'v1',                    -- ← versión (o NULL si no aplica)
    'Doc Print Templates — tabla, permisos y asignación a roles'     -- ← ticket o nota (o NULL si no aplica)
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;
