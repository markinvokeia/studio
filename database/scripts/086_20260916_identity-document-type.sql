-- =====================================================================
-- Tipo de documento de identidad + obligatoriedad configurable
--
--   1. users.identity_document_type → nueva columna, uno de 4 valores
--      ('cedula_uy', 'cedula_ext', 'pasaporte_uy', 'pasaporte_ext').
--      Todos los registros existentes asumen 'cedula_uy' (comportamiento
--      actual: solo dígitos, formato de cédula uruguaya).
--   2. clinic_preferences.identity_document_required → toggle por clínica.
--      Default FALSE: preserva el comportamiento actual, donde el frontend
--      permite guardar el documento vacío (el n8n de /users/upsert ya
--      convierte '' → NULL antes del INSERT/UPDATE).
--   3. get_users_filtered se redefine (DROP + CREATE) para devolver también
--      identity_document_type — cambia el RETURNS TABLE, así que no alcanza
--      con CREATE OR REPLACE.
--
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- Depende de: 068_20260814_clinic-preferences-and-discounts.sql,
--             063_20260708_groups-many-to-many.sql (última definición de
--             get_users_filtered)
-- =====================================================================

BEGIN;

-- -----------------------------------------------------------------------
-- 1. Tipo de documento en users
-- -----------------------------------------------------------------------
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS identity_document_type VARCHAR(20)
        NOT NULL DEFAULT 'cedula_uy';

ALTER TABLE public.users
    DROP CONSTRAINT IF EXISTS users_identity_document_type_check;
ALTER TABLE public.users
    ADD CONSTRAINT users_identity_document_type_check
    CHECK (identity_document_type IN ('cedula_uy', 'cedula_ext', 'pasaporte_uy', 'pasaporte_ext'));

COMMENT ON COLUMN public.users.identity_document_type IS
    'Formato del documento guardado en identity_document: cedula_uy (con dígito verificador), cedula_ext, pasaporte_uy o pasaporte_ext (genéricos, sin checksum). Default cedula_uy para preservar los datos existentes.';

-- -----------------------------------------------------------------------
-- 2. Obligatoriedad del documento, por clínica
-- -----------------------------------------------------------------------
ALTER TABLE public.clinic_preferences
    ADD COLUMN IF NOT EXISTS identity_document_required BOOLEAN
        NOT NULL DEFAULT false;

COMMENT ON COLUMN public.clinic_preferences.identity_document_required IS
    'Si TRUE, el formulario de pacientes exige un documento de identidad no vacío. FALSE (default) ⇒ puede quedar vacío, como hoy.';

-- -----------------------------------------------------------------------
-- 3. get_users_filtered: agrega identity_document_type al resultado
-- -----------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_users_filtered(text, text, timestamp without time zone, timestamp without time zone, integer, integer, boolean, boolean, boolean);

CREATE OR REPLACE FUNCTION public.get_users_filtered(
	p_search_term text DEFAULT ''::text,
	p_filter_type text DEFAULT NULL::text,
	p_date_from timestamp without time zone DEFAULT NULL::timestamp without time zone,
	p_date_to timestamp without time zone DEFAULT NULL::timestamp without time zone,
	p_limit integer DEFAULT 100,
	p_page integer DEFAULT 1,
	p_only_with_debt boolean DEFAULT false,
	p_only_active boolean DEFAULT true,
	p_only_staff boolean DEFAULT false)
    RETURNS TABLE(id uuid, email text, phone_number text, internal_id text, name text, created_at timestamp without time zone, updated_at timestamp without time zone, is_active boolean, facebook_psid text, instagram_sender_id text, linkedin_member_id text, telegram_user_id character varying, identity_document character varying, identity_document_type character varying, password text, preferred_platform_id integer, last_login_timestamp timestamp without time zone, password_setup_token character varying, token_expiry timestamp without time zone, color color_hex, is_sales boolean, birthday date, notes text, address text, alternative_phone text, bank_account text, mutual_society_id integer, is_dependant boolean, responsible_contact_id uuid, calendar_source_id bigint, can_browse_calendars boolean, doctor_id uuid, sex sex_type, total_invoiced jsonb, total_paid jsonb, current_debt jsonb, available_balance jsonb, total bigint)
    LANGUAGE 'plpgsql'
    COST 100
    STABLE PARALLEL UNSAFE
    ROWS 1000

AS $BODY$
#variable_conflict use_column
DECLARE
    v_offset int;
BEGIN
    v_offset := (p_page - 1) * p_limit;

    RETURN QUERY
    SELECT
        u.id, u.email, u.phone_number, u.internal_id, u.name,
        u.created_at, u.updated_at, u.is_active, u.facebook_psid,
        u.instagram_sender_id, u.linkedin_member_id, u.telegram_user_id,
        u.identity_document, u.identity_document_type, u.password, u.preferred_platform_id,
        u.last_login_timestamp, u.password_setup_token, u.token_expiry,
        u.color, u.is_sales, u.birthday, u.notes, u.address,
        u.alternative_phone, u.bank_account, u.mutual_society_id,
        u.is_dependant,
        u.responsible_contact_id,
        u.calendar_source_id,
        u.can_browse_calendars,
        u.doctor_id,
        u.sex,
        COALESCE(f.res_total_invoiced, '{}'::jsonb),
        COALESCE(f.res_total_paid, '{}'::jsonb),
        COALESCE(f.res_current_debt, '{}'::jsonb),
        COALESCE(f.res_available_balance, '{}'::jsonb),
        COUNT(*) OVER()
    FROM public.users u
    LEFT JOIN LATERAL (
        SELECT
            jsonb_object_agg(sub.currency, sub.t_inv) as res_total_invoiced,
            jsonb_object_agg(sub.currency, sub.t_paid) as res_total_paid,
            jsonb_object_agg(sub.currency, sub.debt) as res_current_debt,
            jsonb_object_agg(sub.currency, sub.balance) as res_available_balance,
            BOOL_OR(sub.has_debt) as user_has_debt
        FROM (
            SELECT
                m.currency,
                SUM(CASE WHEN m.m_type = 'invoice' THEN ABS(m.amount) ELSE 0 END) as t_inv,
                SUM(CASE WHEN m.m_type = 'payment' THEN ABS(m.amount) ELSE 0 END) as t_paid,
                CASE
                    WHEN u.is_sales THEN GREATEST(SUM(m.amount), 0)
                    ELSE ABS(LEAST(SUM(m.amount), 0))
                END as debt,
                CASE
                    WHEN u.is_sales THEN ABS(LEAST(SUM(m.amount), 0))
                    ELSE GREATEST(SUM(m.amount), 0)
                END as balance,
                CASE
                    WHEN u.is_sales THEN SUM(m.amount) > 0
                    ELSE SUM(m.amount) < 0
                END as has_debt
            FROM (
                SELECT i.currency, 'invoice' as m_type, (CASE WHEN u.is_sales THEN i.total ELSE -i.total END) as amount
                FROM public.invoices i WHERE i.user_id = u.id AND i.status = 'booked' AND i.type = 'invoice'
                AND (p_date_from IS NULL OR i.created_at >= p_date_from) AND (p_date_to IS NULL OR i.created_at <= p_date_to)

                UNION ALL

                SELECT i.currency, 'credit_note' as m_type, (CASE WHEN u.is_sales THEN -i.total ELSE i.total END) as amount
                FROM public.invoices i WHERE i.user_id = u.id AND i.status = 'booked' AND i.type = 'credit_note'
                AND (p_date_from IS NULL OR i.created_at >= p_date_from) AND (p_date_to IS NULL OR i.created_at <= p_date_to)

                UNION ALL

                SELECT p.currency, 'payment' as m_type, -p.amount as amount
                FROM public.payments p WHERE p.user_id = u.id
                AND (p_date_from IS NULL OR p.created_at >= p_date_from) AND (p_date_to IS NULL OR p.created_at <= p_date_to)
            ) m
            GROUP BY m.currency
        ) sub
    ) f ON TRUE
    WHERE
        (p_only_active IS FALSE OR u.is_active IS TRUE)
        AND (
            COALESCE(p_search_term, '') = '' OR
            u.name ILIKE '%' || p_search_term || '%' OR
            u.email ILIKE '%' || p_search_term || '%' OR
            u.phone_number ILIKE '%' || p_search_term || '%' OR
            u.alternative_phone ILIKE '%' || p_search_term || '%' OR
            u.address ILIKE '%' || p_search_term || '%' OR
            u.id::text ILIKE '%' || p_search_term || '%' OR
            u.identity_document ILIKE '%' || p_search_term || '%'
        )
        AND (
            (p_filter_type IS NULL OR p_filter_type = '' OR p_filter_type = 'ALL')
            OR (p_filter_type = 'DOCTOR' AND EXISTS (
                SELECT 1 FROM public.user_roles ur
                JOIN public.roles r ON ur.role_id = r.id
                WHERE ur.user_id = u.id AND r.name IN ('medico', 'odontologo')
            ))
            OR (p_filter_type = 'PROVEEDOR' AND u.is_sales IS FALSE)
            OR (p_filter_type = 'PACIENTE' AND EXISTS (
                SELECT 1 FROM public.user_roles ur
                JOIN public.roles r ON ur.role_id = r.id
                WHERE ur.user_id = u.id AND r.name = 'paciente'
            ))
        )
        AND (
            p_only_with_debt IS FALSE OR COALESCE(f.user_has_debt, false) IS TRUE
        )
        AND (
            p_only_staff IS FALSE OR EXISTS (
                SELECT 1 FROM public.user_roles ur
                JOIN public.roles r ON ur.role_id = r.id
                WHERE ur.user_id = u.id
                  AND r.name IN ('recepcionista', 'gerente', 'administrador')
            )
        )

    ORDER BY u.created_at DESC
    LIMIT p_limit OFFSET v_offset;
END;
$BODY$;

ALTER FUNCTION public.get_users_filtered(text, text, timestamp without time zone, timestamp without time zone, integer, integer, boolean, boolean, boolean)
    OWNER TO postgres;

-- -----------------------------------------------------------------------
-- 4. Registro de migración
-- -----------------------------------------------------------------------
INSERT INTO public.db_migrations (script_name, version_tag, notes)
VALUES (
    '086_20260916_identity-document-type.sql',
    'v1',
    'Columna users.identity_document_type (cedula_uy/cedula_ext/pasaporte_uy/pasaporte_ext), clinic_preferences.identity_document_required, y get_users_filtered actualizado'
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
-- ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_identity_document_type_check;
-- ALTER TABLE public.users DROP COLUMN IF EXISTS identity_document_type;
-- ALTER TABLE public.clinic_preferences DROP COLUMN IF EXISTS identity_document_required;
-- -- Restaurar get_users_filtered a la versión de 063_20260708_groups-many-to-many.sql si hace falta.
-- DELETE FROM public.db_migrations WHERE script_name = '086_20260916_identity-document-type.sql';
-- COMMIT;
