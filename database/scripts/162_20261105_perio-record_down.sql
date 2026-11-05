-- =====================================================================
-- Vuelta atrás de 162_20261105_perio-record.sql
--
-- Sólo borra si no hay ningún periodontograma registrado: un examen guardado
-- es historia clínica y no se pierde por un rollback. Con datos, aborta.
-- =====================================================================

BEGIN;

DO $$
BEGIN
    IF to_regclass('public.perio_exams') IS NOT NULL AND EXISTS (SELECT 1 FROM public.perio_exams) THEN
        RAISE EXCEPTION 'Hay periodontogramas registrados: no se revierte la migración 162';
    END IF;
END $$;

DROP FUNCTION IF EXISTS public.perio_exam_delete(bigint, uuid);
DROP FUNCTION IF EXISTS public.perio_exam_close(bigint, uuid);
DROP FUNCTION IF EXISTS public.perio_exam_save(jsonb, uuid);
DROP FUNCTION IF EXISTS public.perio_exam_recompute(bigint);
DROP FUNCTION IF EXISTS public.perio_exams_list(uuid);
DROP FUNCTION IF EXISTS public.perio_exam_json(bigint);

DROP TABLE IF EXISTS public.perio_exam_events;
DROP TABLE IF EXISTS public.perio_sites;
DROP TABLE IF EXISTS public.perio_teeth;
DROP TABLE IF EXISTS public.perio_exams;

DELETE FROM public.role_permissions rp
USING public.permissions p
WHERE rp.permission_id = p.id AND p.code IN ('PERIO_RECORD_VIEW', 'PERIO_RECORD_REGISTER_SESSION');
DELETE FROM public.permissions WHERE code IN ('PERIO_RECORD_VIEW', 'PERIO_RECORD_REGISTER_SESSION');

DELETE FROM db_migrations WHERE script_name = '162_20261105_perio-record.sql';

COMMIT;
