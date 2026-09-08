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
           NULLIF(f ->> 'patient_id', '')                       AS patient_id,
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
       -- Órdenes de un paciente concreto: lo usa el selector del diálogo de cita.
       AND (a.patient_id IS NULL OR b.patient_id = a.patient_id::uuid)
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
           -- La cita completa, no un resumen: la pestaña Citas muestra lo mismo
           -- que el panel del calendario, para no obligar a saltar de pantalla.
           coalesce((
             SELECT json_agg(json_build_object(
                      'id', a.id::text, 'start_datetime', a.start_datetime,
                      'end_datetime', a.end_datetime, 'status', a.status,
                      'calendar_source_id', a.calendar_source_id::text,
                      'calendar_name', cs.name, 'sede_name', s2.name,
                      'doctor_id', a.assignee_id::text, 'doctor_name', ad.name,
                      'summary', a.summary, 'notes', a.notes, 'color', a.color,
                      'cancellation_reason', a.cancellation_reason,
                      'cancellation_note', a.cancellation_note,
                      'created_at', a.created_at, 'updated_at', a.updated_at,
                      'imported_from_google', a.imported_from_google,
                      -- Lo necesita /appointments/update_status para propagar el
                      -- cambio a Google; sin esto, cerrar la cita desde la orden
                      -- la dejaría desincronizada en el calendario de la sede.
                      'google_event_id', a.google_event_id,
                      'quote_id', a.quote_id::text,
                      'service_ids', coalesce((SELECT json_agg(x.service_id::text)
                                                 FROM public.appointment_service_catalog x
                                                WHERE x.appointment_id = a.id), '[]'::json),
                      'services', coalesce((
                          SELECT json_agg(json_build_object(
                                   'id', sc3.id::text, 'name', sc3.name,
                                   'duration_minutes', sc3.duration_minutes)
                                 ORDER BY sc3.name)
                            FROM public.appointment_service_catalog x2
                            JOIN public.service_catalog sc3 ON sc3.id = x2.service_id
                           WHERE x2.appointment_id = a.id), '[]'::json),
                      -- La sesión clínica cierra la cita: quién la registró y
                      -- qué hizo es parte de lo que el derivador quiere ver.
                      'session', (
                          SELECT json_build_object(
                                   'id', sc4.id::text,
                                   'doctor_id', sc4.doctor_id::text,
                                   'doctor_name', sd.name,
                                   'fecha_sesion', sc4.fecha_sesion,
                                   'procedimiento_realizado', sc4.procedimiento_realizado,
                                   'diagnostico', sc4.diagnostico)
                            FROM public.sesiones_clinicas sc4
                            LEFT JOIN public.users sd ON sd.id = sc4.doctor_id
                           WHERE sc4.appointment_id = a.id
                           ORDER BY sc4.fecha_sesion DESC LIMIT 1)
                    ) ORDER BY a.start_datetime)
               FROM public.appointments a
               LEFT JOIN public.calendar_sources cs ON cs.id = a.calendar_source_id
               LEFT JOIN public.sedes s2 ON s2.id = cs.sede_id
               LEFT JOIN public.users ad ON ad.id = a.assignee_id
              WHERE a.study_order_id = so.id AND a.status <> 'deleted'
           ), '[]'::json) AS appointments,
           -- Ficha del paciente, sólo datos básicos. Nada financiero: la
           -- pestaña es para saber a quién se atiende, no cuánto debe.
           (SELECT json_build_object(
                     'id', pu.id::text, 'name', pu.name,
                     'identity_document', pu.identity_document,
                     'internal_id', pu.internal_id,
                     'email', pu.email, 'phone_number', pu.phone_number,
                     'alternative_phone', pu.alternative_phone,
                     'address', pu.address, 'birthday', pu.birthday,
                     'sex', pu.sex, 'is_active', pu.is_active,
                     'mutual_society_name', ms.name,
                     'assigned_doctor_name', pd.name)
              FROM public.users pu
              LEFT JOIN public.mutual_societies ms ON ms.id = pu.mutual_society_id
              LEFT JOIN public.users pd ON pd.id = pu.doctor_id
             WHERE pu.id = so.patient_id) AS patient,
           -- Línea de tiempo. Del más viejo al más nuevo: se lee como se leería
           -- el relato de lo que fue pasando.
           coalesce((
             SELECT json_agg(json_build_object(
                      'id', ev.id::text, 'event_type', ev.event_type,
                      'actor_id', ev.actor_id::text, 'actor_kind', ev.actor_kind,
                      'actor_name', au.name,
                      'appointment_id', ev.appointment_id::text,
                      'metadata', ev.metadata, 'created_at', ev.created_at)
                    ORDER BY ev.created_at, ev.id)
               FROM public.study_order_events ev
               LEFT JOIN public.users au ON au.id = ev.actor_id
              WHERE ev.study_order_id = so.id
           ), '[]'::json) AS events
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

/**
 * Datos de la orden que viajan en `notifications.metadata`. Se arman leyendo la
 * base y no encadenando expresiones de n8n: así la tarjeta recibe siempre lo
 * mismo, sin depender de qué devolvió el nodo anterior.
 */
const ORDER_METADATA = `
       jsonb_build_object(
           'order_id',      so.id::text,
           'order_number',  so.order_number,
           'patient_id',    so.patient_id::text,
           'patient_name',  so.patient_name,
           'doctor_id',     so.doctor_id::text,
           'doctor_name',   d.name,
           'sede_name',     se.name,
           'items_total',   (SELECT count(*) FROM public.study_order_items i
                              WHERE i.study_order_id = so.id AND i.is_cancelled = false),
           'items_summary', (SELECT string_agg(i.service_name, ', ' ORDER BY i.sort_order, i.service_name)
                               FROM public.study_order_items i
                              WHERE i.study_order_id = so.id AND i.is_cancelled = false)
       )`;

export const NOTIFY_RECEPTION_SQL = `
-- $1 = id de la orden.  $2 = qué pasó ('' = una orden nueva entró).
-- $3 = quién lo hizo, para no avisarle a quien ya lo sabe.
--
-- Una fila por persona de recepción o administración. DISTINCT porque alguien
-- con los dos roles recibiría la notificación dos veces.
--
-- RETURNING * y no sólo el user_id: lo que devuelve este nodo es EXACTAMENTE lo
-- que viaja por SSE al navegador. El cliente normaliza esa fila igual que las
-- que trae por REST, así que necesita id, type, status, metadata y created_at;
-- con sólo el user_id la normalización devuelve null y el aviso se descarta en
-- silencio — la notificación queda en la base y recién aparece al refrescar.
-- Es la convención de los flujos de citas, que ya devuelven la fila entera.
--
-- El mismo aviso sirve para tres cosas que a recepción le importan igual: entró
-- una orden nueva, el derivador anuló una que quizás ya estaban trabajando, o un
-- paciente reservó solo por el link y nadie de la clínica se enteró.
INSERT INTO public.notifications
       (user_id, type, status, priority, patient_id, metadata, created_at)
SELECT r.user_id,
       'study_order_submitted',
       'pending',
       'MEDIUM',
       so.patient_id,
${ORDER_METADATA} || jsonb_build_object('change', coalesce($2::text, '')),
       now()
  FROM public.study_orders so
  LEFT JOIN public.users d  ON d.id  = so.doctor_id
  LEFT JOIN public.sedes se ON se.id = so.preferred_sede_id
  CROSS JOIN LATERAL (
      SELECT DISTINCT u.id AS user_id
        FROM public.users u
        JOIN public.user_roles ur ON ur.user_id = u.id
        JOIN public.roles rr      ON rr.id = ur.role_id
       WHERE rr.name ILIKE ANY (ARRAY['recepcionista', 'administrador'])
         AND ur.is_active IS NOT FALSE
         AND u.is_active IS NOT FALSE
  ) r
 WHERE so.id = $1::uuid
   AND r.user_id IS DISTINCT FROM NULLIF($3::text, '')::uuid
RETURNING *;`;

export const NOTIFY_DOCTOR_SQL = `
-- $1 = id de la orden.  $2 = qué cambió, para el texto de la tarjeta.
-- $3 = quién lo hizo. Si es el propio derivador, no se le avisa: nadie necesita
--      una notificación de lo que acaba de hacer. Vacío = avisar igual.
-- Aviso de sólo lectura al derivador. El estado que se manda es el DERIVADO de
-- la vista, no el persistido: al doctor le importa "agendada" o "completada",
-- que es lo que ve la clínica, no el 'submitted' de la columna.
--
-- RETURNING * y no sólo el user_id: lo que devuelve este nodo es EXACTAMENTE lo
-- que viaja por SSE al navegador. El cliente normaliza esa fila igual que las
-- que trae por REST, así que necesita id, type, status, metadata y created_at;
-- con sólo el user_id la normalización devuelve null y el aviso se descarta en
-- silencio — la notificación queda en la base y recién aparece al refrescar.
-- Es la convención de los flujos de citas, que ya devuelven la fila entera.
INSERT INTO public.notifications
       (user_id, type, status, priority, patient_id, metadata, created_at)
SELECT so.doctor_id,
       'study_order_status_changed',
       'pending',
       'MEDIUM',
       so.patient_id,
${ORDER_METADATA} || jsonb_build_object(
           'board_status', b.board_status,
           'change',       $2::text,
           'cancellation_reason', so.cancellation_reason
       ),
       now()
  FROM public.study_orders so
  LEFT JOIN public.users d  ON d.id  = so.doctor_id
  LEFT JOIN public.sedes se ON se.id = so.preferred_sede_id
  LEFT JOIN public.v_study_orders_board b ON b.id = so.id
 WHERE so.id = $1::uuid
   AND so.doctor_id IS NOT NULL
   -- Un cambio vacío significa "no pasó nada que contar": /recompute es
   -- idempotente y se llama de más a propósito, así que sin este guard el
   -- derivador recibiría un aviso por cada recálculo que no cambió nada.
   AND coalesce($2::text, '') <> ''
   AND so.doctor_id IS DISTINCT FROM NULLIF($3::text, '')::uuid
RETURNING *;`;

export const LINK_APPOINTMENT_SQL = `
-- $1 userId (token)  $2 payload { order_id, appointment_id }
--
-- Ata una cita recién creada a su orden. Se hace en un paso aparte, DESPUÉS de
-- /appointments/upsert, en vez de agregarle la columna a ese flujo:
--   · /appointments/upsert es un monolito compartido por todo el módulo de
--     citas, con sincronización a Google Calendar y notificaciones adentro.
--     Tocarlo para esto pone en riesgo la agenda entera.
--   · El repo ya resuelve así el mismo problema con las facturas:
--     /appointments/link_invoice, invocado desde services/billing-links.ts.
--
-- Idempotente: volver a atar la misma cita a la misma orden no cambia nada.
WITH ${PERMS_CTE},
b AS (
    SELECT $2::jsonb AS body
),
v AS (
    SELECT (body ->> 'order_id')::uuid      AS order_id,
           (body ->> 'appointment_id')::int AS appointment_id
      FROM b
)
UPDATE public.appointments a
   SET study_order_id = v.order_id,
       updated_at     = now()
  FROM v
 WHERE a.id = v.appointment_id
   -- Una cita ya atada a OTRA orden no se roba.
   AND (a.study_order_id IS NULL OR a.study_order_id = v.order_id)
   AND EXISTS (
       SELECT 1 FROM public.study_orders so
        WHERE so.id = v.order_id
          AND ((SELECT can_schedule FROM perms) OR so.doctor_id = $1::uuid)
   )
RETURNING a.id::text, a.study_order_id::text;`;

export const BY_APPOINTMENT_SQL = `
-- $1 userId (token)  $2 id de la cita.
--
-- A qué orden pertenece una cita. Hace falta porque el study_order_id no viaja
-- con los datos de la cita: /appointments/upsert y Get_Appointments son
-- workflows compartidos por todo el módulo de agenda y no se tocan para esto.
-- Al abrir una cita, el selector consulta acá y muestra la orden asociada.
--
-- Devuelve vacío si la cita no tiene orden, o si el sujeto no puede verla.
WITH ${PERMS_CTE}
SELECT so.id::text        AS id,
       so.order_number    AS order_number,
       so.patient_id::text AS patient_id,
       so.patient_name    AS patient_name,
       so.doctor_id::text AS doctor_id,
       d.name             AS doctor_name,
       b.board_status     AS board_status
  FROM public.appointments a
  JOIN public.study_orders so ON so.id = a.study_order_id
  LEFT JOIN public.users d ON d.id = so.doctor_id
  LEFT JOIN public.v_study_orders_board b ON b.id = so.id
 WHERE a.id = $2::int
   AND (so.doctor_id = $1::uuid OR (SELECT can_view_all FROM perms));`;

export const RECOMPUTE_SQL = `
-- $1 userId (token)  $2 payload { id, change }
--
-- Recalcula el estado PERSISTIDO de la orden contra el estado real de sus citas.
--
-- El estado operativo (nueva / sin agendar / parcial / agendada / en curso) no
-- se toca acá: lo deriva v_study_orders_board de las citas y se corrige solo.
-- Cancelar una cita ya devuelve sus líneas a "sin agendar" sin que nadie
-- ejecute nada. Lo único que hay que persistir es el cierre, que sí es un hecho
-- con fecha: todas las líneas atendidas -> 'completed'. Y su reverso, porque si
-- la cita de una orden ya cerrada se cancela o se borra, dejar el 'completed'
-- sería mentir: vuelve a 'submitted' y se limpia completed_at.
--
-- 'draft' y 'cancelled' no se tocan nunca: son decisiones humanas y un recálculo
-- no las revierte.
--
-- El parámetro 'change' lo pone quien llama, porque quien llama es el único que
-- sabe qué pasó. Al cancelar una cita no hay transición persistida que detectar
-- -- la orden sigue 'submitted' -- y aun así el derivador tiene que enterarse.
-- Si el recálculo sí produjo una transición, esa gana sobre lo que dijo el
-- llamador. Vacío = no se notifica.
WITH ${PERMS_CTE},
b AS (
    SELECT $2::jsonb AS body
),
v AS (
    SELECT (body ->> 'id')::uuid                AS order_id,
           coalesce(body ->> 'change', '')::text AS hint
      FROM b
),
tgt AS (
    SELECT so.id, so.status
      FROM public.study_orders so, v
     WHERE so.id = v.order_id
       AND so.status IN ('submitted', 'completed')
       AND ( (SELECT can_schedule FROM perms)
             OR (SELECT can_view_all FROM perms)
             OR so.doctor_id = $1::uuid )
),
target AS (
    SELECT tgt.id,
           tgt.status AS old_status,
           CASE WHEN bo.items_total > 0 AND bo.items_completed = bo.items_total
                THEN 'completed' ELSE 'submitted' END AS new_status,
           bo.board_status
      FROM tgt
      JOIN public.v_study_orders_board bo ON bo.id = tgt.id
),
upd AS (
    UPDATE public.study_orders so
       SET status       = target.new_status,
           completed_at = CASE WHEN target.new_status = 'completed' THEN now() ELSE NULL END,
           updated_at   = now()
      FROM target
     WHERE so.id = target.id
       AND so.status IS DISTINCT FROM target.new_status
    RETURNING so.id
)
SELECT target.id::text     AS id,
       target.old_status   AS old_status,
       target.new_status   AS new_status,
       -- Es el estado ANTES de este recálculo: los CTE leen el snapshot previo
       -- a la sentencia, así que la vista todavía no ve el UPDATE de arriba. Va
       -- para diagnóstico. El estado que le llega al doctor lo re-consulta el
       -- aviso, que corre en una sentencia aparte y sí ve el resultado.
       target.board_status AS board_status_before,
       EXISTS (SELECT 1 FROM upd) AS changed,
       CASE
           WHEN EXISTS (SELECT 1 FROM upd) AND target.new_status = 'completed' THEN 'completed'
           WHEN EXISTS (SELECT 1 FROM upd)                                     THEN 'reopened'
           ELSE (SELECT hint FROM v)
       END AS change
  FROM target;`;

export const RECONCILE_SQL = `
-- Sin parámetros: corre como el sistema, desde un cron.
--
-- Red de seguridad de /recompute. Ese endpoint lo llama el front al guardar una
-- sesión clínica y al cancelar una cita, pero el front no siempre llega: la
-- pestaña se cierra, la red se corta, o alguien cambia el estado de una cita
-- desde un camino que no lo invoca. Esto barre todas las órdenes y corrige las
-- que quedaron con un estado persistido que no refleja sus citas.
--
-- Devuelve una fila por orden corregida, para que el nodo siguiente notifique.
-- Sin nada que corregir devuelve cero filas y ahí se corta la ejecución.
WITH state AS (
    SELECT o.id,
           CASE WHEN b.items_total > 0 AND b.items_completed = b.items_total
                THEN 'completed' ELSE 'submitted' END AS target
      FROM public.study_orders o
      JOIN public.v_study_orders_board b ON b.id = o.id
     WHERE o.status IN ('submitted', 'completed')
)
UPDATE public.study_orders o
   SET status       = state.target,
       completed_at = CASE WHEN state.target = 'completed' THEN now() ELSE NULL END,
       updated_at   = now()
  FROM state
 WHERE o.id = state.id
   AND o.status IS DISTINCT FROM state.target
RETURNING o.id::text AS order_id,
          CASE WHEN state.target = 'completed' THEN 'completed' ELSE 'reopened' END AS change;`;

export const BOOKING_TOKEN_SQL = `
-- $1 userId (token)  $2 payload { order_id, token_hash, expires_at, max_uses }
--
-- Genera el link con el que el paciente elige horario sin tener cuenta.
--
-- El token en claro NUNCA llega acá: se genera y se hashea en el nodo de
-- validación, y sólo el sha256 se guarda. Mismo criterio que users.login_code
-- del portal de pacientes: si alguien lee la tabla, no puede usar los links.
--
-- Generar uno nuevo revoca los anteriores de esa orden. Un link viejo circulando
-- por WhatsApp es una puerta abierta que nadie recuerda cerrar.
WITH ${PERMS_CTE},
b AS (
    SELECT $2::jsonb AS body
),
v AS (
    SELECT (body ->> 'order_id')::uuid        AS order_id,
           (body ->> 'token_hash')::text      AS token_hash,
           (body ->> 'expires_at')::timestamp AS expires_at,
           coalesce((body ->> 'max_uses')::smallint, 1) AS max_uses
      FROM b
),
allowed AS (
    SELECT so.id
      FROM public.study_orders so, v
     WHERE so.id = v.order_id
       AND so.status = 'submitted'
       -- Sin ficha de paciente no hay a nombre de quién crear la cita.
       AND so.patient_id IS NOT NULL
       AND ((SELECT can_schedule FROM perms) OR so.doctor_id = $1::uuid)
),
revoked AS (
    UPDATE public.study_order_booking_tokens bt
       SET revoked_at = now()
      FROM allowed
     WHERE bt.study_order_id = allowed.id
       AND bt.revoked_at IS NULL
    RETURNING bt.id
)
INSERT INTO public.study_order_booking_tokens
       (study_order_id, token_hash, expires_at, max_uses, created_by)
SELECT allowed.id, v.token_hash, v.expires_at, v.max_uses, $1::uuid
  FROM allowed, v
RETURNING id::text, study_order_id::text AS order_id, expires_at, max_uses;`;

export const PUBLIC_DETAIL_SQL = `
-- $1 = sha256 del token que trae el paciente en el link.
--
-- Endpoint SIN autenticación: cualquiera con el link ve esto. Por eso devuelve
-- lo mínimo para que el paciente reconozca que la orden es suya y sepa qué le
-- van a hacer: primer nombre, número de orden, estudios pendientes y la sede
-- sugerida. NO viajan documento, teléfono, mail, ni las notas clínicas del
-- derivador.
--
-- El token se valida acá y no en el flujo: vencido, revocado o agotado devuelve
-- cero filas, que el formateador traduce a 404.
WITH t AS (
    SELECT bt.study_order_id
      FROM public.study_order_booking_tokens bt
     WHERE bt.token_hash = $1::text
       AND bt.revoked_at IS NULL
       AND bt.expires_at > now()
       AND bt.used_count < bt.max_uses
)
SELECT so.id::text          AS id,
       so.order_number      AS order_number,
       -- Sólo el primer nombre: alcanza para reconocerse y no expone el resto.
       split_part(so.patient_name, ' ', 1) AS patient_first_name,
       d.name               AS doctor_name,
       so.preferred_sede_id AS preferred_sede_id,
       se.name              AS preferred_sede_name,
       (SELECT coalesce(json_agg(json_build_object(
                   'id',   i.service_id::text,
                   'name', i.service_name,
                   'duration_minutes', sc.duration_minutes
               ) ORDER BY i.sort_order), '[]'::json)
          FROM public.study_order_items i
          LEFT JOIN public.service_catalog sc ON sc.id = i.service_id
         WHERE i.study_order_id = so.id
           AND i.is_cancelled = false
           -- Sólo lo que falta agendar: si ya tiene cita, no se ofrece de nuevo.
           AND NOT EXISTS (
               SELECT 1 FROM public.appointments a
                 JOIN public.appointment_service_catalog asc2 ON asc2.appointment_id = a.id
                WHERE a.study_order_id = so.id
                  AND asc2.service_id = i.service_id
                  AND a.status NOT IN ('cancelled', 'deleted', 'no_show')
           )) AS pending_services
  FROM public.study_orders so
  JOIN t ON t.study_order_id = so.id
  LEFT JOIN public.users d  ON d.id  = so.doctor_id
  LEFT JOIN public.sedes se ON se.id = so.preferred_sede_id
 WHERE so.status = 'submitted';`;

export const PUBLIC_BOOK_SQL = `
-- $1 = sha256 del token.  $2 payload { calendar_source_id, start, end, summary }
--
-- Crea la cita que el paciente eligió, la ata a la orden, le carga los estudios
-- pendientes y consume un uso del token. Todo en una sentencia: si algo del
-- camino no da, no queda una cita a medio armar.
--
-- LIMITACIÓN CONOCIDA, la misma que /study-orders/reschedule: no empuja la cita
-- a Google Calendar. La sincronización de salida vive dentro de
-- /appointments/upsert, que es el monolito de la agenda. Si la sede sincroniza
-- con Google, la cita aparece en InvokeIA pero no en el calendario de Google
-- hasta que alguien la edite desde la agenda.
--
-- El token se valida de nuevo acá aunque el detalle ya lo haya validado: entre
-- una llamada y la otra puede haberse vencido, y el que llama es un anónimo.
WITH b AS (
    SELECT $2::jsonb AS body
),
v AS (
    SELECT (body ->> 'calendar_source_id')::bigint AS calendar_source_id,
           (body ->> 'start')::timestamp           AS starts_at,
           (body ->> 'end')::timestamp             AS ends_at,
           coalesce(NULLIF(body ->> 'summary', ''), 'Estudios') AS summary
      FROM b
),
t AS (
    SELECT bt.id, bt.study_order_id
      FROM public.study_order_booking_tokens bt
     WHERE bt.token_hash = $1::text
       AND bt.revoked_at IS NULL
       AND bt.expires_at > now()
       AND bt.used_count < bt.max_uses
     -- Bloquea la fila: dos clics simultáneos no pueden gastar el mismo uso.
     FOR UPDATE
),
o AS (
    SELECT so.id, so.patient_id, so.doctor_id, so.order_number
      FROM public.study_orders so
      JOIN t ON t.study_order_id = so.id
     WHERE so.status = 'submitted'
       AND so.patient_id IS NOT NULL
),
ins AS (
    INSERT INTO public.appointments
           (patient_id, assignee_id, start_datetime, end_datetime, status,
            calendar_source_id, study_order_id, summary, created_at, updated_at)
    SELECT o.patient_id,
           -- El doctor de la cita es el derivador, no el técnico. Decisión del
           -- cliente: es lo que hace que la cita aparezca en su agenda.
           o.doctor_id,
           v.starts_at, v.ends_at, 'scheduled',
           v.calendar_source_id, o.id,
           v.summary || ' - ' || o.order_number,
           now(), now()
      FROM o, v
     WHERE v.ends_at > v.starts_at
       AND v.starts_at > now()
       AND v.calendar_source_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.calendar_sources cs
                    WHERE cs.id = v.calendar_source_id AND cs.is_active)
    RETURNING id, study_order_id
),
svc AS (
    INSERT INTO public.appointment_service_catalog (appointment_id, service_id)
    SELECT ins.id, i.service_id
      FROM ins
      JOIN public.study_order_items i ON i.study_order_id = ins.study_order_id
     WHERE i.is_cancelled = false
       AND NOT EXISTS (
           SELECT 1 FROM public.appointments a
             JOIN public.appointment_service_catalog asc2 ON asc2.appointment_id = a.id
            WHERE a.study_order_id = ins.study_order_id
              AND asc2.service_id = i.service_id
              AND a.id <> ins.id
              AND a.status NOT IN ('cancelled', 'deleted', 'no_show')
       )
    RETURNING appointment_id
),
bump AS (
    UPDATE public.study_order_booking_tokens bt
       SET used_count   = bt.used_count + 1,
           last_used_at = now()
      FROM t, ins
     WHERE bt.id = t.id
    RETURNING bt.id
)
SELECT ins.id::text          AS appointment_id,
       o.id::text            AS order_id,
       o.order_number        AS order_number,
       (SELECT count(*) FROM svc) AS services_linked
  FROM ins, o;`;

export const LOG_EVENT_SQL = `
-- $1 payload { order_id, event_type, actor_id, actor_kind, appointment_id, metadata }
--
-- Registro de la bitácora. Un solo parámetro: el payload entero como JSON, por
-- el mismo motivo que el upsert — sin array posicional no hay desalineación
-- posible.
--
-- El actor sale SIEMPRE del token en el nodo que arma el payload, nunca del
-- cuerpo que manda el cliente. El tipo de evento se valida dos veces: contra la
-- lista cerrada del nodo y contra el CHECK de la tabla.
--
-- Nunca hace fallar la operación que lo provocó: el nodo va colgado después de
-- responder al webhook y con onError continueRegularOutput. Perder un renglón
-- del historial es malo; perder la operación es peor.
INSERT INTO public.study_order_events
       (study_order_id, event_type, actor_id, actor_kind, appointment_id, metadata)
SELECT (b.body ->> 'order_id')::uuid,
       b.body ->> 'event_type',
       NULLIF(b.body ->> 'actor_id', '')::uuid,
       coalesce(NULLIF(b.body ->> 'actor_kind', ''), 'user'),
       NULLIF(b.body ->> 'appointment_id', '')::int,
       coalesce(b.body -> 'metadata', '{}'::jsonb)
  FROM (SELECT $1::jsonb AS body) b
 WHERE coalesce(b.body ->> 'order_id', '') <> ''
   AND coalesce(b.body ->> 'event_type', '') <> ''
   AND EXISTS (SELECT 1 FROM public.study_orders so
                WHERE so.id = (b.body ->> 'order_id')::uuid)
RETURNING id::text;`;

/** Permisos de citas del sujeto del token. Espeja PERMS_CTE, otro prefijo. */
const APPT_PERMS_CTE = `
appt_perms AS (
    SELECT bool_or(p.code = 'APPOINTMENTS_ASSIGN_TECHNICIAN') AS can_assign
      FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.role_id = ur.role_id
      JOIN public.permissions p       ON p.id = rp.permission_id
     WHERE ur.user_id = $1::uuid
       AND ur.is_active IS NOT FALSE
       AND p.code = 'APPOINTMENTS_ASSIGN_TECHNICIAN'
)`;

export const ASSIGN_TECHNICIAN_SQL = `
-- $1 userId (token)  $2 payload { appointment_id, technician_id }
--
-- Asigna (o quita, con technician_id vacío) el técnico que ejecuta la cita.
--
-- Va en un endpoint aparte y no dentro de /appointments/upsert por lo mismo de
-- siempre: ese flujo es el monolito compartido de la agenda, con sync a Google y
-- notificaciones adentro. Mismo patrón que /appointments/link_invoice y
-- /study-orders/link-appointment.
--
-- Dos caminos para pasar:
--   · con APPOINTMENTS_ASSIGN_TECHNICIAN se puede asignar a cualquiera —
--     recepción repartiendo el trabajo del día;
--   · sin el permiso, uno puede asignarse A SÍ MISMO una cita libre. Es "tomar
--     la tarea", y es lo que permite que el técnico se organice sin depender de
--     que alguien le asigne cada estudio.
-- Quitarse a uno mismo también entra en el segundo caso; robarle una cita ya
-- tomada a otro, no.
WITH ${APPT_PERMS_CTE},
b AS (
    SELECT $2::jsonb AS body
),
v AS (
    SELECT (body ->> 'appointment_id')::int              AS appointment_id,
           NULLIF(body ->> 'technician_id', '')::uuid    AS technician_id
      FROM b
)
UPDATE public.appointments a
   SET technician_id = v.technician_id,
       updated_at    = now()
  FROM v
 WHERE a.id = v.appointment_id
   AND a.status NOT IN ('cancelled', 'deleted')
   -- El destinatario tiene que ser un operador de verdad. Sin esto se podría
   -- "asignar" la cita a un paciente y aparecerle en un panel que no le toca.
   AND (v.technician_id IS NULL OR EXISTS (
           SELECT 1 FROM public.user_roles ur
             JOIN public.roles r ON r.id = ur.role_id
            WHERE ur.user_id = v.technician_id
              AND ur.is_active IS NOT FALSE
              AND r.name = 'operador'
   ))
   AND (
        (SELECT can_assign FROM appt_perms)
        OR (
            -- Auto-asignarse: sólo sobre algo que no le pertenece a otro.
            coalesce(v.technician_id, $1::uuid) = $1::uuid
            AND (a.technician_id IS NULL OR a.technician_id = $1::uuid)
        )
   )
RETURNING a.id::text AS appointment_id,
          a.technician_id::text AS technician_id,
          a.study_order_id::text AS study_order_id;`;

export const TECHNICIAN_TASKS_SQL = `
-- $1 userId (token)  $2 payload { from, to, technician_id }
--
-- Las citas que le tocan a un técnico en un rango. Alimenta el panel de Tareas,
-- que es Mi Consultorio con otra fuente.
--
-- Dos caminos que SE SUMAN, como pidió el cliente:
--   · lo asignado directamente (appointments.technician_id), y
--   · lo que caiga en un calendario al que tenga acceso (public.calendar_users,
--     la misma tabla que ya usa Mi Consultorio para su selector).
-- Un técnico sin calendarios asignados ve sólo lo suyo; uno con acceso a la sala
-- ve todo lo de esa sala, esté o no repartido.
--
-- technician_id del body sólo lo respeta quien puede asignar (recepción mirando
-- la carga de otro). Sin ese permiso, se ignora y se usa el sujeto del token:
-- el panel de uno nunca puede pedir el de otro.
WITH ${APPT_PERMS_CTE},
b AS (
    SELECT $2::jsonb AS body
),
v AS (
    SELECT (body ->> 'from')::timestamp AS starts_at,
           (body ->> 'to')::timestamp   AS ends_at,
           CASE WHEN (SELECT can_assign FROM appt_perms)
                 AND coalesce(body ->> 'technician_id', '') <> ''
                THEN (body ->> 'technician_id')::uuid
                ELSE $1::uuid
           END AS subject
      FROM b
)
SELECT a.id::text                    AS appointment_id,
       a.patient_id::text            AS patient_id,
       pu.name                       AS patient_name,
       pu.email                      AS patient_email,
       pu.phone_number               AS patient_phone,
       a.assignee_id::text           AS doctor_id,
       du.name                       AS doctor_name,
       du.email                      AS doctor_email,
       a.technician_id::text         AS technician_id,
       tu.name                       AS technician_name,
       a.summary                     AS summary,
       a.description                 AS description,
       a.notes                       AS notes,
       a.status                      AS status,
       a.start_datetime              AS start_time,
       a.end_datetime                AS end_time,
       a.created_at                  AS created_at,
       a.google_event_id             AS google_event_id,
       a.calendar_source_id::text    AS calendar_source_id,
       cs.name                       AS calendar_name,
       cs.google_calendar_id         AS google_calendar_id,
       a.color                       AS color,
       a.quote_id::text              AS quote_id,
       a.study_order_id::text        AS study_order_id,
       so.order_number               AS study_order_number,
       coalesce((
         SELECT json_agg(json_build_object('id', sc.id::text, 'name', sc.name, 'price', sc.price))
           FROM public.appointment_service_catalog asc2
           JOIN public.service_catalog sc ON sc.id = asc2.service_id
          WHERE asc2.appointment_id = a.id
       ), '[]'::json)               AS services
  FROM public.appointments a
  CROSS JOIN v
  LEFT JOIN public.users pu          ON pu.id = a.patient_id
  LEFT JOIN public.users du          ON du.id = a.assignee_id
  LEFT JOIN public.users tu          ON tu.id = a.technician_id
  LEFT JOIN public.calendar_sources cs ON cs.id = a.calendar_source_id
  LEFT JOIN public.study_orders so    ON so.id = a.study_order_id
 WHERE a.status <> 'deleted'
   AND a.start_datetime >= v.starts_at
   AND a.start_datetime <= v.ends_at
   AND (
        a.technician_id = v.subject
        OR EXISTS (SELECT 1 FROM public.calendar_users cu
                    WHERE cu.user_id = v.subject
                      AND cu.calendar_source_id = a.calendar_source_id)
   )
 ORDER BY a.start_datetime;`;

export const APPOINTMENT_TECHNICIANS_SQL = `
-- $1 userId (token)  $2 payload { appointment_ids: [..] }
--
-- Qué técnico tiene asignado cada cita de una lista.
--
-- Existe por lo mismo que /study-orders/by-appointment: technician_id no viaja
-- con los datos de la cita, porque Get_Appointments es el monolito compartido de
-- la agenda y no se toca para esto. El calendario carga sus citas y después
-- pregunta acá, de una sola vez para todas las visibles.
--
-- Sólo devuelve las que TIENEN técnico: las demás se leen por ausencia y así la
-- respuesta no crece con la agenda entera.
--
-- No lleva guarda de permisos a propósito: saber quién atiende una cita es lo
-- mismo que ya muestra la agenda de la clínica, y quien llega hasta acá tiene
-- token válido y está mirando esas citas.
WITH b AS (
    SELECT $2::jsonb AS body
)
SELECT a.id::text            AS appointment_id,
       a.technician_id::text AS technician_id,
       u.name                AS technician_name
  FROM public.appointments a
  JOIN public.users u ON u.id = a.technician_id
  CROSS JOIN b
 WHERE a.technician_id IS NOT NULL
   AND a.id = ANY (
       SELECT (jsonb_array_elements_text(coalesce(b.body -> 'appointment_ids', '[]'::jsonb)))::int
   );`;
