-- =====================================================================
-- Documento de identidad por estado de cita: de advertencia a BLOQUEO
--
--   clinic_preferences.identity_document_warn_statuses (script 143) deja de
--   pedir confirmación: /appointments/update_status ahora RECHAZA (409
--   `identity_document_missing`) el cambio a cualquiera de esos estados si el
--   paciente no tiene documento de identidad. Ya no hay forma de saltearlo
--   (se quitó `acknowledge_missing_identity_document`).
--
--   Se conserva el nombre de la columna para no coordinar un rename con los
--   flujos de n8n; solo cambia su significado.
--
--   'cancelled' deja de ser configurable: bloquear una cancelación por falta
--   de documento no tiene sentido y además impediría que el paciente cancele
--   desde el portal. Se quita de los valores guardados y del CHECK.
--
-- Idempotente. Depende de: 143_20261027_identity-document-warn-statuses.sql
-- =====================================================================

BEGIN;

UPDATE public.clinic_preferences
SET identity_document_warn_statuses = array_remove(identity_document_warn_statuses, 'cancelled')
WHERE 'cancelled' = ANY (identity_document_warn_statuses);

ALTER TABLE public.clinic_preferences
    DROP CONSTRAINT IF EXISTS clinic_preferences_identity_document_warn_statuses_check;

ALTER TABLE public.clinic_preferences
    ADD CONSTRAINT clinic_preferences_identity_document_warn_statuses_check
    CHECK (identity_document_warn_statuses <@ ARRAY[
        'pending', 'scheduled', 'confirmed', 'arrived', 'arrived_late',
        'in_progress', 'completed', 'attended_late', 'no_show'
    ]::text[]);

COMMENT ON COLUMN public.clinic_preferences.identity_document_warn_statuses IS
    'Estados de cita que exigen que el paciente tenga documento de identidad: /appointments/update_status rechaza el cambio (409 identity_document_missing) si no lo tiene. Vacío ⇒ sin restricción. No admite cancelled.';

INSERT INTO public.db_migrations (script_name, version_tag, notes)
VALUES (
    '144_20261027_identity-document-status-block.sql',
    'v1',
    'identity_document_warn_statuses pasa de advertencia a bloqueo; se quita cancelled de los valores permitidos'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;

-- =====================================================================
-- ROLLBACK (manual, si hiciera falta): volver al CHECK del script 143
-- =====================================================================
-- BEGIN;
-- ALTER TABLE public.clinic_preferences DROP CONSTRAINT IF EXISTS clinic_preferences_identity_document_warn_statuses_check;
-- ALTER TABLE public.clinic_preferences ADD CONSTRAINT clinic_preferences_identity_document_warn_statuses_check
--     CHECK (identity_document_warn_statuses <@ ARRAY['pending','scheduled','confirmed','arrived','arrived_late','in_progress','completed','attended_late','no_show','cancelled']::text[]);
-- DELETE FROM public.db_migrations WHERE script_name = '144_20261027_identity-document-status-block.sql';
-- COMMIT;
