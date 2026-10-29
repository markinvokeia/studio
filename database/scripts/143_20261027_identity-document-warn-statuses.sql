-- =====================================================================
-- Advertencia de documento de identidad al cambiar el estado de una cita
--
--   clinic_preferences.identity_document_warn_statuses (text[], default '{}').
--   Lista de estados de cita para los que /appointments/update_status, si el
--   paciente no tiene documento de identidad (users.identity_document vacío),
--   NO aplica el cambio y responde 409 `identity_document_missing`. El
--   frontend muestra la advertencia y, si el usuario confirma, reenvía el
--   cambio con `acknowledge_missing_identity_document: true`.
--
--   '{}' ⇒ apagado (comportamiento actual). Caso típico: '{completed}'.
--
--   Es independiente de identity_document_required (que solo afecta al
--   formulario de pacientes): aunque el alta lo exija, hay fichas viejas o
--   creadas desde WhatsApp / el portal sin documento.
--
--   Solo afecta al webhook /appointments/update_status. Los flujos que
--   escriben el estado directamente en la tabla (agente de WhatsApp,
--   acciones de email) no cambian.
--
-- Idempotente. Depende de: 068_20260814_clinic-preferences-and-discounts.sql
-- =====================================================================

BEGIN;

ALTER TABLE public.clinic_preferences
    ADD COLUMN IF NOT EXISTS identity_document_warn_statuses TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.clinic_preferences
    DROP CONSTRAINT IF EXISTS clinic_preferences_identity_document_warn_statuses_check;

ALTER TABLE public.clinic_preferences
    ADD CONSTRAINT clinic_preferences_identity_document_warn_statuses_check
    CHECK (identity_document_warn_statuses <@ ARRAY[
        'pending', 'scheduled', 'confirmed', 'arrived', 'arrived_late',
        'in_progress', 'completed', 'attended_late', 'no_show', 'cancelled'
    ]::text[]);

COMMENT ON COLUMN public.clinic_preferences.identity_document_warn_statuses IS
    'Estados de cita que, si el paciente no tiene documento de identidad, piden confirmación antes de aplicarse (/appointments/update_status responde 409 identity_document_missing salvo acknowledge_missing_identity_document=true). Vacío ⇒ sin advertencia.';

INSERT INTO public.db_migrations (script_name, version_tag, notes)
VALUES (
    '143_20261027_identity-document-warn-statuses.sql',
    'v1',
    'clinic_preferences.identity_document_warn_statuses: advertencia de documento faltante al cambiar el estado de una cita'
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
-- ALTER TABLE public.clinic_preferences DROP CONSTRAINT IF EXISTS clinic_preferences_identity_document_warn_statuses_check;
-- ALTER TABLE public.clinic_preferences DROP COLUMN IF EXISTS identity_document_warn_statuses;
-- DELETE FROM public.db_migrations WHERE script_name = '143_20261027_identity-document-warn-statuses.sql';
-- COMMIT;
