-- =====================================================================
-- Reconciliación del enlace receta ↔ anamnesis
--
-- PROBLEMA
--   El flujo n8n `RX Upsert — Sync Anamnesis` inserta en
--   public.historial_medicamentos_paciente incluyendo la columna
--   prescription_item_id. Si el 068 se aplicó en su primera versión —que
--   guardaba el enlace al revés, en patient_prescription_items.historial_
--   medicamento_id— esa columna no existe y el INSERT falla con
--   «column "prescription_item_id" of relation ... does not exist».
--
-- POR QUÉ EL ENLACE VA EN LA FILA DE ANAMNESIS
--   Con la FK en historial_medicamentos_paciente y ON DELETE CASCADE, borrar
--   o reeditar las líneas de una receta limpia sola las filas de anamnesis
--   que habían generado. En el sentido contrario había que emparejar filas a
--   mano tras el INSERT (row_number sobre RETURNING), que es frágil.
--
-- Columnas reales de historial_medicamentos_paciente (baseline v1):
--   id, paciente_id, medicamento_id, medicamento_texto, dosis, frecuencia,
--   fecha_inicio (NOT NULL), fecha_fin, motivo
--   → prescription_item_id es la ÚNICA que agregamos nosotros.
--
-- Idempotente y seguro tanto si el 068 está aplicado en su versión final
-- (no hace nada) como si está en la primera versión o a medias.
-- Depende de: 068.
-- =====================================================================

BEGIN;

-- -----------------------------------------------------------------------
-- 1. La columna que consume el flujo n8n
-- -----------------------------------------------------------------------
ALTER TABLE public.historial_medicamentos_paciente
    ADD COLUMN IF NOT EXISTS prescription_item_id bigint;

COMMENT ON COLUMN public.historial_medicamentos_paciente.prescription_item_id
    IS 'Línea de receta que generó esta fila. NULL ⇒ cargada manualmente en la anamnesis.';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'historial_medicamentos_paciente_prescription_item_id_fkey'
    ) THEN
        ALTER TABLE public.historial_medicamentos_paciente
            ADD CONSTRAINT historial_medicamentos_paciente_prescription_item_id_fkey
            FOREIGN KEY (prescription_item_id)
            REFERENCES public.patient_prescription_items (id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_historial_medicamentos_prescription_item
    ON public.historial_medicamentos_paciente (prescription_item_id)
    WHERE prescription_item_id IS NOT NULL;

-- -----------------------------------------------------------------------
-- 2. Restos de la primera versión del 068
--
--    patient_prescription_items.historial_medicamento_id guardaba el enlace
--    en el sentido contrario. Ya no lo usa nadie: se elimina junto con su FK
--    para que no quede una segunda fuente de verdad silenciosa.
--
--    Antes de borrarla se arrastra su contenido al nuevo enlace, por si
--    llegaron a crearse recetas con la versión anterior del flujo.
-- -----------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'patient_prescription_items'
          AND column_name  = 'historial_medicamento_id'
    ) THEN
        EXECUTE $migrate$
            UPDATE public.historial_medicamentos_paciente h
            SET prescription_item_id = i.id
            FROM public.patient_prescription_items i
            WHERE i.historial_medicamento_id = h.id
              AND h.prescription_item_id IS NULL
        $migrate$;

        ALTER TABLE public.patient_prescription_items
            DROP CONSTRAINT IF EXISTS patient_prescription_items_historial_medicamento_id_fkey;

        ALTER TABLE public.patient_prescription_items
            DROP COLUMN IF EXISTS historial_medicamento_id;
    END IF;
END $$;

-- -----------------------------------------------------------------------
-- 3. Registro de migración
-- -----------------------------------------------------------------------
INSERT INTO public.db_migrations (script_name, version_tag, notes)
VALUES (
    '070_20260819_fix-prescription-anamnesis-link.sql',
    'v1',
    'Enlace receta↔anamnesis en historial_medicamentos_paciente.prescription_item_id; retira el enlace inverso de la primera versión del 068'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;

-- =====================================================================
-- VERIFICACIÓN (ejecutar después; sólo lectura)
-- =====================================================================
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'historial_medicamentos_paciente'
-- ORDER BY ordinal_position;
--   → debe listar: id, paciente_id, medicamento_id, medicamento_texto, dosis,
--     frecuencia, fecha_inicio, fecha_fin, motivo, prescription_item_id
--
-- SELECT column_name FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'patient_prescription_items'
--   AND column_name = 'historial_medicamento_id';
--   → debe devolver 0 filas

-- =====================================================================
-- ROLLBACK (manual)
-- =====================================================================
-- BEGIN;
-- DELETE FROM public.historial_medicamentos_paciente WHERE prescription_item_id IS NOT NULL;
-- ALTER TABLE public.historial_medicamentos_paciente
--   DROP COLUMN IF EXISTS prescription_item_id;
-- DELETE FROM public.db_migrations WHERE script_name = '070_20260819_fix-prescription-anamnesis-link.sql';
-- COMMIT;
