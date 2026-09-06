/**
 * SQL de los workflows de órdenes de estudio.
 *
 * Reglas que valen para todo el archivo:
 *  - Parámetros posicionales ($1..$n) siempre. Nunca interpolar {{ }} dentro del
 *    SQL: varios flujos viejos del repo lo hacen y son inyectables.
 *  - $1 es SIEMPRE el sujeto del token ($json.jwtPayload.userId). El doctor de
 *    "Mis Órdenes" jamás sale de un parámetro del cliente.
 *  - La autorización se resuelve en el propio SQL contra role_permissions, que
 *    es el `assert_self_or_staff` que hoy no existe en ningún flujo del repo.
 */

/** CTE reutilizable: qué permisos STUDY_ORDERS_* tiene el sujeto del token. */
const PERMS_CTE = `
perms AS (
    SELECT bool_or(p.code = 'STUDY_ORDERS_VIEW_ALL')  AS can_view_all,
           bool_or(p.code = 'STUDY_ORDERS_CREATE_FOR_DOCTOR') AS can_create_for_doctor,
           bool_or(p.code = 'STUDY_ORDERS_CANCEL')    AS can_cancel,
           bool_or(p.code = 'STUDY_ORDERS_ACKNOWLEDGE') AS can_acknowledge,
           bool_or(p.code = 'STUDY_ORDERS_SCHEDULE') AS can_schedule
      FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.role_id = ur.role_id
      JOIN public.permissions p       ON p.id = rp.permission_id
     WHERE ur.user_id = $1::uuid
       AND ur.is_active IS NOT FALSE
       AND p.code LIKE 'STUDY_ORDERS_%'
)`;

export const OPTIONS_SQL = `
-- Catálogo del formulario. Las secciones son las categorías sembradas por
-- scripts/sql/catalogo-clinica-imagen.sql y los servicios, sus 69 hijos.
WITH secs AS (
    SELECT mc.id, mc.code, mc.name,
           row_number() OVER (ORDER BY mc.id) AS sort_order,
           (SELECT sc.color FROM public.service_catalog sc
             WHERE sc.category_id = mc.id AND sc.color IS NOT NULL LIMIT 1) AS color
      FROM public.miscellaneous_categories mc
     WHERE mc.external_id LIKE 'ci-orden:cat:%'
       AND mc.is_active
)
SELECT json_build_object(
    'sections', (
        SELECT coalesce(json_agg(json_build_object(
            'code', s.code, 'name', s.name, 'color', s.color, 'sort_order', s.sort_order,
            'services', (
                -- Se listan por CATEGORÍA, no por external_id: hay servicios que
                -- ya existían en el catálogo de la clínica con su propio
                -- external_id de una importación anterior (p.ej. PROTECTOR BUCAL,
                -- '01.9.5', con precio y facturas asociadas). Filtrar por
                -- 'ci-orden:svc:%' los dejaría fuera del formulario. Además, así
                -- un servicio que la clínica agregue a una de las 12 categorías
                -- aparece solo, sin tocar nada.
                SELECT coalesce(json_agg(json_build_object(
                    'id', sc.id::text, 'name', sc.name, 'section_code', s.code,
                    'duration_minutes', sc.duration_minutes, 'description', sc.description
                ) ORDER BY sc.name), '[]'::json)
                  FROM public.service_catalog sc
                 WHERE sc.category_id = s.id
                   AND sc.is_active
            )
        ) ORDER BY s.sort_order), '[]'::json)
          FROM secs s
    ),
    'modifiers',     (SELECT coalesce(json_agg(o ORDER BY o.sort_order), '[]'::json) FROM (
        SELECT id::text, option_kind, code, label, section_code, service_id::text, group_code, input_type, sort_order
          FROM public.study_order_options WHERE option_kind = 'modifier' AND is_active) o),
    'texts',         (SELECT coalesce(json_agg(o ORDER BY o.sort_order), '[]'::json) FROM (
        SELECT id::text, option_kind, code, label, section_code, service_id::text, group_code, input_type, sort_order
          FROM public.study_order_options WHERE option_kind = 'text' AND is_active) o),
    'region_groups', (SELECT coalesce(json_agg(o ORDER BY o.sort_order), '[]'::json) FROM (
        SELECT id::text, option_kind, code, label, section_code, service_id::text, group_code, input_type, sort_order
          FROM public.study_order_options WHERE option_kind = 'region_group' AND is_active) o),
    'delivery',      (SELECT coalesce(json_agg(o ORDER BY o.sort_order), '[]'::json) FROM (
        SELECT id::text, option_kind, code, label, section_code, service_id::text, group_code, input_type, sort_order
          FROM public.study_order_options WHERE option_kind = 'delivery' AND is_active) o)
) AS data;`;

export const LIST_SQL = `
-- $1 = userId del token.  $2 = filtros como JSON.
-- Dos parámetros por el mismo motivo que el upsert: sin array posicional no hay
-- desalineación posible ni placeholders de dos dígitos.
WITH ${PERMS_CTE},
q AS (
    SELECT $2::jsonb AS f
),
args AS (
    SELECT coalesce(NULLIF(f ->> 'scope', ''), 'mine')          AS scope,
           coalesce(NULLIF(f ->> 'board_status', ''), 'all')    AS board_status,
           coalesce(f ->> 'search', '')                         AS search,
           NULLIF(f ->> 'sede_id', '')                          AS sede_id,
           coalesce((f ->> 'sla_hours')::numeric, 48)           AS sla_hours,
           NULLIF(f ->> 'date_from', '')                        AS date_from,
           NULLIF(f ->> 'date_to', '')                          AS date_to,
           coalesce(NULLIF(f ->> 'sort', ''), 'submitted_at:desc') AS sort,
           coalesce((f ->> 'limit')::int, 25)                   AS lim,
           coalesce((f ->> 'offset')::int, 0)                   AS off
      FROM q
),
base AS (
    SELECT b.*,
           d.name  AS doctor_name,
           se.name AS preferred_sede_name,
           (b.has_past_due_appointment
            OR (b.board_status IN ('new', 'unscheduled', 'partially_scheduled')
                AND b.hours_since_submitted > a.sla_hours)) AS is_overdue,
           (SELECT string_agg(i.service_name, ', ' ORDER BY i.sort_order, i.service_name)
              FROM public.study_order_items i
             WHERE i.study_order_id = b.id AND i.is_cancelled = false) AS items_summary
      FROM public.v_study_orders_board b
      CROSS JOIN args a
      LEFT JOIN public.users d  ON d.id  = b.doctor_id
      LEFT JOIN public.sedes se ON se.id = b.preferred_sede_id
     WHERE
       -- Autorización: sólo con VIEW_ALL se ve la bandeja completa. Pedir
       -- scope=clinic sin el permiso devuelve igual las órdenes propias.
       CASE WHEN a.scope = 'clinic' AND (SELECT can_view_all FROM perms)
            THEN b.status <> 'draft'
            ELSE b.doctor_id = $1::uuid
       END
       AND (a.board_status = 'all' OR CASE a.board_status
             WHEN 'new'       THEN b.board_status = 'new'
             WHEN 'pending'   THEN b.board_status IN ('new', 'unscheduled', 'partially_scheduled')
             WHEN 'overdue'   THEN (b.has_past_due_appointment
                                    OR (b.board_status IN ('new', 'unscheduled', 'partially_scheduled')
                                        AND b.hours_since_submitted > a.sla_hours))
             WHEN 'scheduled' THEN b.board_status IN ('scheduled', 'partially_scheduled')
             WHEN 'completed' THEN b.board_status = 'completed'
             WHEN 'drafts'    THEN b.status = 'draft'
             ELSE true END)
       AND (a.search = '' OR lower(b.patient_name) LIKE lower(a.search) || '%'
                          OR b.patient_document LIKE a.search || '%'
                          OR lower(b.order_number) LIKE lower(a.search) || '%')
       AND (a.sede_id IS NULL OR b.preferred_sede_id = a.sede_id::int)
       AND (a.date_from IS NULL OR b.submitted_at >= a.date_from::timestamp)
       AND (a.date_to   IS NULL OR b.submitted_at <  (a.date_to::timestamp + interval '1 day'))
)
SELECT (SELECT count(*) FROM base) AS total,
       coalesce((
         SELECT json_agg(row_to_json(x))
           FROM (SELECT b.id::text, b.order_number, b.doctor_id::text, b.doctor_name,
                        b.patient_id::text, b.patient_name, b.patient_document, b.patient_phone,
                        b.status, b.board_status, b.items_total, b.items_scheduled, b.items_completed,
                        b.items_summary, b.is_overdue, b.hours_since_submitted,
                        b.preferred_sede_id::text, b.preferred_sede_name,
                        b.submitted_at, b.acknowledged_at, b.completed_at, b.created_at
                   FROM base b CROSS JOIN args a
                  ORDER BY
                    CASE WHEN a.sort = 'submitted_at:asc'   THEN b.submitted_at END ASC,
                    CASE WHEN a.sort = 'patient_name:asc'   THEN b.patient_name END ASC,
                    CASE WHEN a.sort = 'patient_name:desc'  THEN b.patient_name END DESC,
                    CASE WHEN a.sort = 'order_number:asc'   THEN b.order_number END ASC,
                    CASE WHEN a.sort = 'order_number:desc'  THEN b.order_number END DESC,
                    b.submitted_at DESC NULLS LAST, b.created_at DESC
                  LIMIT (SELECT lim FROM args) OFFSET (SELECT off FROM args)) x
       ), '[]'::json) AS items;`;

export const DETAIL_SQL = `
-- $1 userId (del token)  $2 id de la orden
WITH ${PERMS_CTE}
SELECT row_to_json(o) AS data
  FROM (
    SELECT so.id::text, so.order_number, so.doctor_id::text, d.name AS doctor_name,
           so.patient_id::text, so.patient_name, so.patient_document,
           so.patient_email, so.patient_phone, so.status,
           so.regions, so.section_modifiers, so.texts, so.delivery_methods,
           so.clinical_notes, so.preferred_sede_id::text, se.name AS preferred_sede_name,
           so.submitted_at, so.acknowledged_at, so.completed_at, so.cancelled_at,
           so.cancellation_reason, so.created_at, so.updated_at,
           coalesce((
             SELECT json_agg(json_build_object(
                      'id', i.id::text, 'study_order_id', i.study_order_id::text,
                      'service_id', i.service_id::text, 'service_name', i.service_name,
                      'section_code', i.section_code, 'sort_order', i.sort_order,
                      'quantity', i.quantity, 'modifiers', i.modifiers,
                      'notes', i.notes, 'is_cancelled', i.is_cancelled,
                      'is_scheduled', EXISTS (
                          SELECT 1 FROM public.appointments a
                            JOIN public.appointment_service_catalog asc2 ON asc2.appointment_id = a.id
                           WHERE a.study_order_id = so.id AND asc2.service_id = i.service_id
                             AND a.status NOT IN ('cancelled', 'deleted', 'no_show')),
                      'is_completed', EXISTS (
                          SELECT 1 FROM public.appointments a
                            JOIN public.appointment_service_catalog asc2 ON asc2.appointment_id = a.id
                           WHERE a.study_order_id = so.id AND asc2.service_id = i.service_id
                             AND a.status = 'completed')
                    ) ORDER BY i.sort_order, i.service_name)
               FROM public.study_order_items i WHERE i.study_order_id = so.id
           ), '[]'::json) AS items,
           coalesce((
             SELECT json_agg(json_build_object(
                      'id', a.id::text, 'start_datetime', a.start_datetime,
                      'end_datetime', a.end_datetime, 'status', a.status,
                      'calendar_source_id', a.calendar_source_id::text,
                      'calendar_name', cs.name, 'sede_name', s2.name,
                      'service_ids', coalesce((SELECT json_agg(x.service_id::text)
                                                 FROM public.appointment_service_catalog x
                                                WHERE x.appointment_id = a.id), '[]'::json)
                    ) ORDER BY a.start_datetime)
               FROM public.appointments a
               LEFT JOIN public.calendar_sources cs ON cs.id = a.calendar_source_id
               LEFT JOIN public.sedes s2 ON s2.id = cs.sede_id
              WHERE a.study_order_id = so.id AND a.status <> 'deleted'
           ), '[]'::json) AS appointments
      FROM public.study_orders so
      LEFT JOIN public.users d  ON d.id  = so.doctor_id
      LEFT JOIN public.sedes se ON se.id = so.preferred_sede_id
     WHERE so.id = $2::uuid
       -- Pertenencia explícita: sin VIEW_ALL sólo se abre lo propio.
       AND (so.doctor_id = $1::uuid OR (SELECT can_view_all FROM perms))
  ) o;`;

export const UPSERT_SQL = `
-- $1 = userId del token.  $2 = el payload entero como JSON.
--
-- Sólo DOS parámetros a propósito. La versión anterior usaba quince, y eso es
-- frágil de dos maneras: cualquier reordenamiento del array en queryReplacement
-- desalinea todo en silencio, y el placeholder uno es prefijo textual del
-- quince, así que cualquier capa que los sustituya con una expresión regular
-- ingenua corrompe el último. Con el payload en un solo JSON el orden deja de
-- importar y cada campo se lee por su nombre.
-- Por lo mismo, en este archivo no se escriben placeholders de dos dígitos ni
-- siquiera dentro de comentarios.
WITH ${PERMS_CTE},
p AS (
    SELECT $2::jsonb AS body
),
resolved AS (
    -- El doctor sólo puede salir del body con CREATE_FOR_DOCTOR; si no, es el
    -- sujeto del token.
    SELECT CASE
             WHEN (SELECT can_create_for_doctor FROM perms)
              AND coalesce((SELECT body ->> 'doctor_id' FROM p), '') <> ''
             THEN (SELECT body ->> 'doctor_id' FROM p)::uuid
             ELSE $1::uuid
           END AS doctor_id
),
vals AS (
    SELECT NULLIF(body ->> 'id', '')                AS id,
           NULLIF(body ->> 'patient_id', '')        AS patient_id,
           body ->> 'patient_name'                  AS patient_name,
           NULLIF(body ->> 'patient_document', '')  AS patient_document,
           NULLIF(body ->> 'patient_email', '')     AS patient_email,
           NULLIF(body ->> 'patient_phone', '')     AS patient_phone,
           coalesce(body -> 'regions', '{}'::jsonb)           AS regions,
           coalesce(body -> 'section_modifiers', '{}'::jsonb) AS section_modifiers,
           coalesce(body -> 'texts', '{}'::jsonb)             AS texts,
           coalesce(body -> 'delivery_methods', '[]'::jsonb)  AS delivery_methods,
           NULLIF(body ->> 'clinical_notes', '')    AS clinical_notes,
           NULLIF(body ->> 'preferred_sede_id', '') AS preferred_sede_id,
           coalesce(body -> 'items', '[]'::jsonb)   AS items
      FROM p
),
updated AS (
    UPDATE public.study_orders so
       SET patient_id        = v.patient_id::uuid,
           patient_name      = v.patient_name,
           patient_document  = v.patient_document,
           patient_email     = v.patient_email,
           patient_phone     = v.patient_phone,
           regions           = v.regions,
           section_modifiers = v.section_modifiers,
           texts             = v.texts,
           delivery_methods  = v.delivery_methods,
           clinical_notes    = v.clinical_notes,
           preferred_sede_id = v.preferred_sede_id::int
      FROM vals v
     WHERE v.id IS NOT NULL
       AND so.id = v.id::uuid
       AND so.status = 'draft'
       AND (so.doctor_id = $1::uuid OR (SELECT can_view_all FROM perms))
    RETURNING so.id
),
inserted AS (
    INSERT INTO public.study_orders
           (doctor_id, patient_id, patient_name, patient_document, patient_email,
            patient_phone, regions, section_modifiers, texts, delivery_methods,
            clinical_notes, preferred_sede_id, created_by)
    SELECT (SELECT doctor_id FROM resolved), v.patient_id::uuid, v.patient_name,
           v.patient_document, v.patient_email, v.patient_phone, v.regions,
           v.section_modifiers, v.texts, v.delivery_methods, v.clinical_notes,
           v.preferred_sede_id::int, $1::uuid
      FROM vals v
     WHERE v.id IS NULL
    RETURNING id
),
target AS (
    SELECT id FROM updated UNION ALL SELECT id FROM inserted
),
-- Las líneas se reemplazan enteras: es lo que hace idempotente al upsert y
-- evita tener que diffear en el cliente.
wiped AS (
    DELETE FROM public.study_order_items
     WHERE study_order_id = (SELECT id FROM target)
    RETURNING 1
),
items AS (
    INSERT INTO public.study_order_items
           (study_order_id, service_id, service_name, section_code, sort_order, quantity, modifiers, notes)
    SELECT (SELECT id FROM target),
           (e ->> 'service_id')::int,
           e ->> 'service_name',
           e ->> 'section_code',
           coalesce((e ->> 'sort_order')::smallint, 0),
           coalesce((e ->> 'quantity')::smallint, 1),
           coalesce(e -> 'modifiers', '{}'::jsonb),
           NULLIF(e ->> 'notes', '')
      FROM vals v, jsonb_array_elements(v.items) AS e
     WHERE EXISTS (SELECT 1 FROM target)
       AND (SELECT count(*) FROM wiped) >= 0
    ON CONFLICT (study_order_id, service_id) DO NOTHING
    RETURNING 1
)
SELECT (SELECT id::text FROM target) AS id,
       (SELECT count(*) FROM items)  AS items_written;`;

export const SUBMIT_SQL = `
-- $1 userId (token)  $2 id
-- Sella el envío. El WHERE es el candado: una orden que ya salió de borrador,
-- o que no es del sujeto, no actualiza nada y el flujo responde 409.
WITH ${PERMS_CTE},
updated AS (
    UPDATE public.study_orders so
       SET status = 'submitted', submitted_at = now()
     WHERE so.id = $2::uuid
       AND so.status = 'draft'
       AND (so.doctor_id = $1::uuid OR (SELECT can_view_all FROM perms))
       AND EXISTS (SELECT 1 FROM public.study_order_items i
                    WHERE i.study_order_id = so.id AND i.is_cancelled = false)
    RETURNING so.id, so.order_number, so.doctor_id, so.patient_name, so.submitted_at
)
SELECT u.id::text, u.order_number, u.doctor_id::text, u.patient_name, u.submitted_at,
       d.name AS doctor_name,
       (SELECT count(*) FROM public.study_order_items i WHERE i.study_order_id = u.id) AS items_total
  FROM updated u LEFT JOIN public.users d ON d.id = u.doctor_id;`;

export const DELETE_SQL = `
-- $1 userId (token)  $2 id. Sólo borradores propios; las líneas caen por CASCADE.
WITH ${PERMS_CTE}
DELETE FROM public.study_orders so
 WHERE so.id = $2::uuid
   AND so.status = 'draft'
   AND (so.doctor_id = $1::uuid OR (SELECT can_view_all FROM perms))
RETURNING so.id::text;`;

export const ACKNOWLEDGE_SQL = `
-- $1 userId (token)  $2 id. Saca la orden del bucket "nuevas".
WITH ${PERMS_CTE}
UPDATE public.study_orders so
   SET acknowledged_at = now(), acknowledged_by = $1::uuid
 WHERE so.id = $2::uuid
   AND so.status = 'submitted'
   AND so.acknowledged_at IS NULL
   AND (SELECT can_acknowledge FROM perms)
RETURNING so.id::text, so.acknowledged_at;`;

export const CANCEL_SQL = `
-- $1 userId (token)  $2 id  $3 motivo
--
-- Dos caminos distintos, a propósito:
--   · Con STUDY_ORDERS_CANCEL (la clínica) se puede anular en cualquier momento.
--   · El derivador puede anular lo suyo SÓLO mientras la clínica no la haya
--     tomado. Una vez tomada, alguien ya empezó a trabajarla y la baja tiene que
--     pasar por la clínica. La UI muestra el botón deshabilitado, pero la regla
--     vive acá: un botón gris no es control de acceso.
WITH ${PERMS_CTE}
UPDATE public.study_orders so
   SET status = 'cancelled', cancelled_at = now(), cancellation_reason = $3
 WHERE so.id = $2::uuid
   AND so.status IN ('draft', 'submitted')
   AND ((SELECT can_cancel FROM perms)
        OR (so.doctor_id = $1::uuid AND so.acknowledged_at IS NULL))
RETURNING so.id::text, so.order_number, so.cancelled_at;`;

export const RESCHEDULE_SQL = `
-- $1 userId (token)  $2 payload { appointment_id, order_id, start, end }
--
-- Mueve una cita de la orden en el lugar: cambia sólo start/end.
--
-- NO se usa /appointments/reschedule a propósito. Ese flujo INSERTA una cita
-- nueva y cancela la vieja, y su lista de columnas no incluye study_order_id:
-- la cita resultante quedaría desprendida de la orden y la orden volvería sola
-- a "sin agendar". Acá se edita la fila existente, así el vínculo sobrevive.
WITH ${PERMS_CTE},
b AS (
    SELECT $2::jsonb AS body
),
v AS (
    SELECT (body ->> 'appointment_id')::int AS appointment_id,
           (body ->> 'order_id')::uuid      AS order_id,
           (body ->> 'start')::timestamp    AS starts_at,
           (body ->> 'end')::timestamp      AS ends_at
      FROM b
)
UPDATE public.appointments a
   SET start_datetime = v.starts_at,
       end_datetime   = v.ends_at,
       updated_at     = now()
  FROM v
 WHERE a.id = v.appointment_id
   -- La cita tiene que ser de esa orden: sin esto, con el id de cualquier cita
   -- se podría mover la agenda entera desde este endpoint.
   AND a.study_order_id = v.order_id
   AND a.status NOT IN ('completed', 'cancelled', 'deleted')
   AND v.ends_at > v.starts_at
   AND EXISTS (
       SELECT 1 FROM public.study_orders so
        WHERE so.id = v.order_id
          AND ((SELECT can_schedule FROM perms) OR so.doctor_id = $1::uuid)
   )
RETURNING a.id::text, a.start_datetime, a.end_datetime;`;
