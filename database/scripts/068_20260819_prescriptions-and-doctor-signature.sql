-- =====================================================================
-- Recetas Médicas + Firma del Doctor
--
--   1. Columnas de firma en public.users. El archivo vive en Google Drive
--      (igual que el logo de clínica): la BD sólo guarda la referencia.
--      Se sirve SIEMPRE por el webhook n8n GET /users/signature?user_id=…,
--      nunca por URL de Drive directa (la auth la resuelve n8n).
--   2. public.prescription_templates  → plantillas maestras de receta,
--      misma forma que medical_instruction_templates.
--   3. public.patient_prescriptions   → cabecera de la receta emitida.
--   4. public.patient_prescription_items → líneas de medicamento.
--      Cada línea puede reflejarse en la anamnesis del paciente
--      (historial_medicamentos_paciente) con su período; el enlace se guarda
--      en historial_medicamento_id para poder actualizarla/borrarla después.
--   5. Permisos PATIENT_PRESCRIPTIONS_*, PRESCRIPTION_TEMPLATES_* y
--      USER_SIGNATURE_*.
--
-- La receta guarda content_html (snapshot ya interpolado) además de las
-- líneas estructuradas: las líneas alimentan la anamnesis y las consultas,
-- el HTML garantiza que reimprimir dé exactamente el mismo documento.
--
-- Idempotente. Depende del baseline v1 (users, catalogo_medicamentos,
-- historial_medicamentos_paciente).
-- =====================================================================

BEGIN;

-- -----------------------------------------------------------------------
-- 1. Firma del doctor en public.users
-- -----------------------------------------------------------------------
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS signature_filename       varchar(255);

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS signature_mimetype       varchar(100);

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS signature_drive_file_id  varchar(255);

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS signature_web_view_link  text;

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS signature_updated_at     timestamp without time zone;

COMMENT ON COLUMN public.users.signature_filename      IS 'Nombre original del archivo de firma subido por el doctor.';
COMMENT ON COLUMN public.users.signature_mimetype      IS 'Content-Type de la firma (image/png, image/jpeg, image/webp).';
COMMENT ON COLUMN public.users.signature_drive_file_id IS 'ID del archivo de firma en Google Drive. NULL ⇒ el usuario no tiene firma cargada.';
COMMENT ON COLUMN public.users.signature_web_view_link IS 'Enlace de Drive a la firma. Sólo referencia: el front la pide por GET /users/signature.';
COMMENT ON COLUMN public.users.signature_updated_at    IS 'Última vez que se subió o reemplazó la firma.';

-- Permite listar rápido qué doctores ya tienen firma cargada.
CREATE INDEX IF NOT EXISTS idx_users_has_signature
    ON public.users (id)
    WHERE signature_drive_file_id IS NOT NULL;

-- -----------------------------------------------------------------------
-- 2. Plantillas maestras de receta
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prescription_templates (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    name         varchar(255) NOT NULL,
    description  text,
    content_html text        NOT NULL,
    is_active    boolean     NOT NULL DEFAULT true,
    created_at   timestamp without time zone NOT NULL DEFAULT now(),
    updated_at   timestamp without time zone NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.prescription_templates              IS 'Plantillas reutilizables de receta médica. content_html lleva variables {{token}} sin resolver.';
COMMENT ON COLUMN public.prescription_templates.content_html IS 'HTML con tokens: {{patient_name}}, {{medications_table}}, {{doctor_signature}}, etc.';

CREATE INDEX IF NOT EXISTS idx_prescription_templates_active
    ON public.prescription_templates (is_active, name);

-- -----------------------------------------------------------------------
-- 3. Receta emitida a un paciente (cabecera)
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patient_prescriptions (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id    uuid NOT NULL,
    doctor_id     uuid,
    doctor_name   varchar(255),
    fecha         date NOT NULL,
    template_id   uuid,
    template_name varchar(255),
    diagnostico   text,
    notas         text,
    content_html  text NOT NULL,
    created_at    timestamp without time zone NOT NULL DEFAULT now(),
    updated_at    timestamp without time zone NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.patient_prescriptions              IS 'Receta médica emitida: quién la mandó, a quién y con qué contenido.';
COMMENT ON COLUMN public.patient_prescriptions.doctor_name  IS 'Nombre del doctor denormalizado: la receta impresa no debe cambiar si el usuario se renombra.';
COMMENT ON COLUMN public.patient_prescriptions.content_html IS 'HTML final YA interpolado. Fuente de verdad al reimprimir — no se recalculan variables.';
COMMENT ON COLUMN public.patient_prescriptions.template_id  IS 'Plantilla de origen, sólo como referencia. Si se borra la plantilla la receta sobrevive.';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'patient_prescriptions_patient_id_fkey') THEN
        ALTER TABLE public.patient_prescriptions
            ADD CONSTRAINT patient_prescriptions_patient_id_fkey
            FOREIGN KEY (patient_id) REFERENCES public.users (id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'patient_prescriptions_doctor_id_fkey') THEN
        ALTER TABLE public.patient_prescriptions
            ADD CONSTRAINT patient_prescriptions_doctor_id_fkey
            FOREIGN KEY (doctor_id) REFERENCES public.users (id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'patient_prescriptions_template_id_fkey') THEN
        ALTER TABLE public.patient_prescriptions
            ADD CONSTRAINT patient_prescriptions_template_id_fkey
            FOREIGN KEY (template_id) REFERENCES public.prescription_templates (id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_patient_prescriptions_patient
    ON public.patient_prescriptions (patient_id, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_patient_prescriptions_doctor
    ON public.patient_prescriptions (doctor_id);

-- -----------------------------------------------------------------------
-- 4. Líneas de medicamento de la receta
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patient_prescription_items (
    id                       bigserial PRIMARY KEY,
    prescription_id          uuid     NOT NULL,
    orden                    smallint NOT NULL DEFAULT 0,
    medicamento_id           integer,
    medicamento_texto        varchar(255) NOT NULL,
    presentacion             varchar(120),
    dosis                    varchar(100),
    via_administracion       varchar(60),
    frecuencia               varchar(100),
    duracion_dias            integer,
    cantidad                 varchar(60),
    fecha_inicio             date,
    fecha_fin                date,
    indicaciones             text,
    registrar_en_anamnesis   boolean NOT NULL DEFAULT true
);

COMMENT ON TABLE  public.patient_prescription_items                        IS 'Medicamentos de una receta, con su posología y período.';
COMMENT ON COLUMN public.patient_prescription_items.medicamento_id         IS 'Referencia a catalogo_medicamentos. NULL si el fármaco se escribió libre.';
COMMENT ON COLUMN public.patient_prescription_items.medicamento_texto      IS 'Nombre denormalizado: la receta impresa sobrevive al borrado del catálogo.';
COMMENT ON COLUMN public.patient_prescription_items.duracion_dias          IS 'Duración del tratamiento en días. Se usa para calcular fecha_fin desde fecha_inicio.';
COMMENT ON COLUMN public.patient_prescription_items.registrar_en_anamnesis IS 'TRUE ⇒ la línea se refleja en historial_medicamentos_paciente con su período.';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'patient_prescription_items_prescription_id_fkey') THEN
        ALTER TABLE public.patient_prescription_items
            ADD CONSTRAINT patient_prescription_items_prescription_id_fkey
            FOREIGN KEY (prescription_id) REFERENCES public.patient_prescriptions (id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'patient_prescription_items_medicamento_id_fkey') THEN
        ALTER TABLE public.patient_prescription_items
            ADD CONSTRAINT patient_prescription_items_medicamento_id_fkey
            FOREIGN KEY (medicamento_id) REFERENCES public.catalogo_medicamentos (id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_patient_prescription_items_prescription
    ON public.patient_prescription_items (prescription_id, orden);

-- -----------------------------------------------------------------------
-- 4b. Enlace anamnesis ← línea de receta
--
--     El enlace vive en la fila de anamnesis, no al revés: así una sola
--     cascada limpia todo. Al editar la receta se reemplazan sus líneas, lo
--     que borra en cascada las filas de anamnesis que habían generado, y el
--     flujo n8n vuelve a insertarlas. Al borrar la receta ocurre lo mismo sin
--     ningún paso extra.
--
--     Las filas con prescription_item_id NULL son medicamentos que el usuario
--     cargó a mano en la anamnesis: no los toca nadie.
-- -----------------------------------------------------------------------
ALTER TABLE public.historial_medicamentos_paciente
    ADD COLUMN IF NOT EXISTS prescription_item_id bigint;

COMMENT ON COLUMN public.historial_medicamentos_paciente.prescription_item_id
    IS 'Línea de receta que generó esta fila. NULL ⇒ cargada manualmente en la anamnesis.';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'historial_medicamentos_paciente_prescription_item_id_fkey') THEN
        ALTER TABLE public.historial_medicamentos_paciente
            ADD CONSTRAINT historial_medicamentos_paciente_prescription_item_id_fkey
            FOREIGN KEY (prescription_item_id) REFERENCES public.patient_prescription_items (id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_historial_medicamentos_prescription_item
    ON public.historial_medicamentos_paciente (prescription_item_id)
    WHERE prescription_item_id IS NOT NULL;

-- -----------------------------------------------------------------------
-- 5. Permisos
-- -----------------------------------------------------------------------
INSERT INTO public.permissions (name, description, code, module, submenu, permission_type)
VALUES
    -- Uso clínico diario: emitir recetas al paciente
    ('Ver Recetas del Paciente',
     'Ver las recetas médicas emitidas en el historial clínico del paciente.',
     'PATIENT_PRESCRIPTIONS_VIEW',   'clinic_history', 'medical-instructions', 'view'),
    ('Crear Recetas del Paciente',
     'Emitir una receta médica a un paciente.',
     'PATIENT_PRESCRIPTIONS_CREATE', 'clinic_history', 'medical-instructions', 'create'),
    ('Editar Recetas del Paciente',
     'Modificar una receta médica ya emitida.',
     'PATIENT_PRESCRIPTIONS_UPDATE', 'clinic_history', 'medical-instructions', 'update'),
    ('Eliminar Recetas del Paciente',
     'Eliminar una receta médica emitida.',
     'PATIENT_PRESCRIPTIONS_DELETE', 'clinic_history', 'medical-instructions', 'delete'),

    -- Configuración: plantillas maestras de receta
    ('Ver Plantillas de Receta',
     'Acceder a Configuración → Plantillas de Receta.',
     'PRESCRIPTION_TEMPLATES_VIEW',   'config', 'prescription-templates', 'view'),
    ('Crear Plantillas de Receta',
     'Crear plantillas reutilizables de receta médica.',
     'PRESCRIPTION_TEMPLATES_CREATE', 'config', 'prescription-templates', 'create'),
    ('Editar Plantillas de Receta',
     'Modificar plantillas de receta médica.',
     'PRESCRIPTION_TEMPLATES_UPDATE', 'config', 'prescription-templates', 'update'),
    ('Eliminar Plantillas de Receta',
     'Eliminar plantillas de receta médica.',
     'PRESCRIPTION_TEMPLATES_DELETE', 'config', 'prescription-templates', 'delete'),

    -- Firma del doctor
    ('Subir la Propia Firma',
     'Subir o reemplazar la firma propia desde Preferencias.',
     'USER_SIGNATURE_UPLOAD', 'config', 'preferences', 'update'),
    ('Gestionar Firmas de Otros Usuarios',
     'Subir, reemplazar o borrar la firma de otro usuario desde su ficha.',
     'USER_SIGNATURE_MANAGE', 'system', 'users', 'update')
ON CONFLICT (code) DO NOTHING;

-- Administrador (4) y Gerente (37): todo.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.role_id, p.id
FROM (VALUES (4), (37)) AS r(role_id)
CROSS JOIN public.permissions p
WHERE p.code IN (
    'PATIENT_PRESCRIPTIONS_VIEW', 'PATIENT_PRESCRIPTIONS_CREATE',
    'PATIENT_PRESCRIPTIONS_UPDATE', 'PATIENT_PRESCRIPTIONS_DELETE',
    'PRESCRIPTION_TEMPLATES_VIEW', 'PRESCRIPTION_TEMPLATES_CREATE',
    'PRESCRIPTION_TEMPLATES_UPDATE', 'PRESCRIPTION_TEMPLATES_DELETE',
    'USER_SIGNATURE_UPLOAD', 'USER_SIGNATURE_MANAGE'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Doctor (2): emite recetas, usa las plantillas y gestiona su propia firma.
-- No administra plantillas ni firmas ajenas.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.role_id, p.id
FROM (VALUES (2)) AS r(role_id)
CROSS JOIN public.permissions p
WHERE p.code IN (
    'PATIENT_PRESCRIPTIONS_VIEW', 'PATIENT_PRESCRIPTIONS_CREATE',
    'PATIENT_PRESCRIPTIONS_UPDATE', 'PATIENT_PRESCRIPTIONS_DELETE',
    'PRESCRIPTION_TEMPLATES_VIEW',
    'USER_SIGNATURE_UPLOAD'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Recepcionista (8): sólo consulta.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.role_id, p.id
FROM (VALUES (8)) AS r(role_id)
CROSS JOIN public.permissions p
WHERE p.code = 'PATIENT_PRESCRIPTIONS_VIEW'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- -----------------------------------------------------------------------
-- 6. Registro de migración
-- -----------------------------------------------------------------------
INSERT INTO public.db_migrations (script_name, version_tag, notes)
VALUES (
    '068_20260819_prescriptions-and-doctor-signature.sql',
    'v1',
    'Recetas médicas — firma del doctor en users, prescription_templates, patient_prescriptions, patient_prescription_items y permisos'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;

-- =====================================================================
-- ROLLBACK (manual)
-- =====================================================================
-- BEGIN;
-- DELETE FROM public.role_permissions rp USING public.permissions p
--   WHERE rp.permission_id = p.id
--     AND (p.code LIKE 'PATIENT_PRESCRIPTIONS_%'
--       OR p.code LIKE 'PRESCRIPTION_TEMPLATES_%'
--       OR p.code LIKE 'USER_SIGNATURE_%');
-- DELETE FROM public.permissions
--   WHERE code LIKE 'PATIENT_PRESCRIPTIONS_%'
--      OR code LIKE 'PRESCRIPTION_TEMPLATES_%'
--      OR code LIKE 'USER_SIGNATURE_%';
-- DELETE FROM public.historial_medicamentos_paciente WHERE prescription_item_id IS NOT NULL;
-- ALTER TABLE public.historial_medicamentos_paciente DROP COLUMN IF EXISTS prescription_item_id;
-- DROP TABLE IF EXISTS public.patient_prescription_items;
-- DROP TABLE IF EXISTS public.patient_prescriptions;
-- DROP TABLE IF EXISTS public.prescription_templates;
-- DROP INDEX IF EXISTS public.idx_users_has_signature;
-- ALTER TABLE public.users
--   DROP COLUMN IF EXISTS signature_filename,
--   DROP COLUMN IF EXISTS signature_mimetype,
--   DROP COLUMN IF EXISTS signature_drive_file_id,
--   DROP COLUMN IF EXISTS signature_web_view_link,
--   DROP COLUMN IF EXISTS signature_updated_at;
-- DELETE FROM public.db_migrations WHERE script_name = '068_20260819_prescriptions-and-doctor-signature.sql';
-- COMMIT;
