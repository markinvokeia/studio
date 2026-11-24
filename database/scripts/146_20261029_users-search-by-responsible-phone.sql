-- =====================================================================
-- Búsqueda de pacientes por el teléfono del tutor
--
--   Un paciente dependiente (users.is_dependant, users.responsible_contact_id)
--   muchas veces no tiene teléfono propio: la clínica lo conoce por el número
--   del tutor. get_users_filtered (GET /users: búsqueda rápida, selector de
--   paciente, lista de Pacientes...) solo miraba los datos del propio usuario,
--   así que el dependiente no aparecía al buscar ese número.
--
--   Cambios en get_users_filtered:
--     1. El término también se busca en phone_number / alternative_phone del
--        tutor, solo para dependientes.
--     2. Si el término parece un teléfono (solo dígitos, espacios, +, -, ., ( )),
--        los teléfonos se comparan por dígitos y sin ceros iniciales: "099 123 456"
--        encuentra "+598 99 123 456". El ILIKE sobre el texto crudo se mantiene.
--     3. Devuelve responsible_contact_name, responsible_phone_number y
--        matched_by_responsible (true si el usuario apareció SOLO por los datos de
--        su tutor), para que la UI explique por qué aparece.
--     4. Con término de búsqueda, primero van los que coinciden por sus propios
--        datos y después los que aparecen por el tutor.
--
--   Cambia el RETURNS TABLE: DROP + CREATE (no alcanza con CREATE OR REPLACE).
--   El único llamador es el nodo "Select USERS" de Users Workflows (SELECT *):
--   las columnas nuevas llegan solas, no hay que tocar el flujo.
--
-- Idempotente. Depende de: 086_20260916_identity-document-type.sql (última
-- definición de get_users_filtered).
-- =====================================================================

BEGIN;

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
    RETURNS TABLE(id uuid, email text, phone_number text, internal_id text, name text, created_at timestamp without time zone, updated_at timestamp without time zone, is_active boolean, facebook_psid text, instagram_sender_id text, linkedin_member_id text, telegram_user_id character varying, identity_document character varying, identity_document_type character varying, password text, preferred_platform_id integer, last_login_timestamp timestamp without time zone, password_setup_token character varying, token_expiry timestamp without time zone, color color_hex, is_sales boolean, birthday date, notes text, address text, alternative_phone text, bank_account text, mutual_society_id integer, is_dependant boolean, responsible_contact_id uuid, calendar_source_id bigint, can_browse_calendars boolean, doctor_id uuid, sex sex_type, total_invoiced jsonb, total_paid jsonb, current_debt jsonb, available_balance jsonb, responsible_contact_name text, responsible_phone_number text, matched_by_responsible boolean, total bigint)
    LANGUAGE 'plpgsql'
    COST 100
    STABLE PARALLEL UNSAFE
    ROWS 1000

AS $BODY$
#variable_conflict use_column
DECLARE
    v_offset int;
    v_term   text;
    -- Dígitos del término sin ceros iniciales, solo si el término parece un teléfono
    -- (y tiene al menos 3 dígitos); NULL si no. "099 123 456" → "99123456".
    v_phone  text;
BEGIN
    v_offset := (p_page - 1) * p_limit;
    v_term   := COALESCE(btrim(p_search_term), '');
    IF v_term ~ '^[0-9\s+().-]+$' THEN
        v_phone := ltrim(regexp_replace(v_term, '\D', '', 'g'), '0');
        IF char_length(v_phone) < 3 THEN
            v_phone := NULL;
        END IF;
    END IF;

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
        r.name::text,
        COALESCE(NULLIF(r.phone_number, ''), NULLIF(r.alternative_phone, ''))::text,
        (m.tutor_match AND NOT m.own_match),
        COUNT(*) OVER()
    FROM public.users u
    -- Tutor: solo cuenta para dependientes.
    LEFT JOIN public.users r
        ON r.id = u.responsible_contact_id AND u.is_dependant IS TRUE
    CROSS JOIN LATERAL (
        SELECT
            (
                v_term = '' OR
                u.name ILIKE '%' || v_term || '%' OR
                u.email ILIKE '%' || v_term || '%' OR
                u.phone_number ILIKE '%' || v_term || '%' OR
                u.alternative_phone ILIKE '%' || v_term || '%' OR
                u.address ILIKE '%' || v_term || '%' OR
                u.id::text ILIKE '%' || v_term || '%' OR
                u.identity_document ILIKE '%' || v_term || '%' OR
                (v_phone IS NOT NULL AND (
                    regexp_replace(COALESCE(u.phone_number, ''), '\D', '', 'g') LIKE '%' || v_phone || '%' OR
                    regexp_replace(COALESCE(u.alternative_phone, ''), '\D', '', 'g') LIKE '%' || v_phone || '%'
                ))
            ) AS own_match,
            (
                v_term <> '' AND r.id IS NOT NULL AND (
                    r.phone_number ILIKE '%' || v_term || '%' OR
                    r.alternative_phone ILIKE '%' || v_term || '%' OR
                    (v_phone IS NOT NULL AND (
                        regexp_replace(COALESCE(r.phone_number, ''), '\D', '', 'g') LIKE '%' || v_phone || '%' OR
                        regexp_replace(COALESCE(r.alternative_phone, ''), '\D', '', 'g') LIKE '%' || v_phone || '%'
                    ))
                )
            ) AS tutor_match
    ) m
    LEFT JOIN LATERAL (
        SELECT
            jsonb_object_agg(sub.currency, sub.t_inv) as res_total_invoiced,
            jsonb_object_agg(sub.currency, sub.t_paid) as res_total_paid,
            jsonb_object_agg(sub.currency, sub.debt) as res_current_debt,
            jsonb_object_agg(sub.currency, sub.balance) as res_available_balance,
            BOOL_OR(sub.has_debt) as user_has_debt
        FROM (
            SELECT
                m2.currency,
                SUM(CASE WHEN m2.m_type = 'invoice' THEN ABS(m2.amount) ELSE 0 END) as t_inv,
                SUM(CASE WHEN m2.m_type = 'payment' THEN ABS(m2.amount) ELSE 0 END) as t_paid,
                CASE
                    WHEN u.is_sales THEN GREATEST(SUM(m2.amount), 0)
                    ELSE ABS(LEAST(SUM(m2.amount), 0))
                END as debt,
                CASE
                    WHEN u.is_sales THEN ABS(LEAST(SUM(m2.amount), 0))
                    ELSE GREATEST(SUM(m2.amount), 0)
                END as balance,
                CASE
                    WHEN u.is_sales THEN SUM(m2.amount) > 0
                    ELSE SUM(m2.amount) < 0
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
            ) m2
            GROUP BY m2.currency
        ) sub
    ) f ON TRUE
    WHERE
        (p_only_active IS FALSE OR u.is_active IS TRUE)
        AND (m.own_match OR m.tutor_match)
        AND (
            (p_filter_type IS NULL OR p_filter_type = '' OR p_filter_type = 'ALL')
            OR (p_filter_type = 'DOCTOR' AND EXISTS (
                SELECT 1 FROM public.user_roles ur
                JOIN public.roles rl ON ur.role_id = rl.id
                WHERE ur.user_id = u.id AND rl.name IN ('medico', 'odontologo')
            ))
            OR (p_filter_type = 'PROVEEDOR' AND u.is_sales IS FALSE)
            OR (p_filter_type = 'PACIENTE' AND EXISTS (
                SELECT 1 FROM public.user_roles ur
                JOIN public.roles rl ON ur.role_id = rl.id
                WHERE ur.user_id = u.id AND rl.name = 'paciente'
            ))
        )
        AND (
            p_only_with_debt IS FALSE OR COALESCE(f.user_has_debt, false) IS TRUE
        )
        AND (
            p_only_staff IS FALSE OR EXISTS (
                SELECT 1 FROM public.user_roles ur
                JOIN public.roles rl ON ur.role_id = rl.id
                WHERE ur.user_id = u.id
                  AND rl.name IN ('recepcionista', 'gerente', 'administrador')
            )
        )

    -- Con término: primero los que coinciden por sus propios datos.
    ORDER BY (m.tutor_match AND NOT m.own_match), u.created_at DESC
    LIMIT p_limit OFFSET v_offset;
END;
$BODY$;

ALTER FUNCTION public.get_users_filtered(text, text, timestamp without time zone, timestamp without time zone, integer, integer, boolean, boolean, boolean)
    OWNER TO postgres;

INSERT INTO public.db_migrations (script_name, version_tag, notes)
VALUES (
    '146_20261029_users-search-by-responsible-phone.sql',
    'v1',
    'get_users_filtered busca también por el teléfono del tutor (dependientes), compara teléfonos por dígitos y devuelve responsible_contact_name / responsible_phone_number / matched_by_responsible'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;

-- =====================================================================
-- ROLLBACK (manual, si hiciera falta): volver a ejecutar la sección 3 de
-- 086_20260916_identity-document-type.sql (DROP + CREATE de get_users_filtered)
-- y borrar el registro:
-- DELETE FROM public.db_migrations WHERE script_name = '146_20261029_users-search-by-responsible-phone.sql';
-- =====================================================================
