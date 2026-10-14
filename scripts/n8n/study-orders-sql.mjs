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


/**
 * Ahora, en la hora de pared de la clínica.
 *
 * Las columnas de fecha de este módulo son `timestamp WITHOUT time zone` y el
 * servidor corre en UTC, así que `now()` a secas guarda las 21:40 cuando en
 * Uruguay son las 18:40 — el front las lee como hora local y las muestra tres
 * horas adelantadas.
 *
 * `AT TIME ZONE` convierte el timestamptz a la hora de pared de esa zona y
 * devuelve un timestamp sin zona: exactamente lo que la columna espera. Se usa
 * el nombre de la zona y no un offset fijo para que un eventual cambio de huso
 * lo resuelva la base y no nosotros.
 *
 * Vale también para las COMPARACIONES: si un lado se mide en hora local y el
 * otro en UTC, un token vence tres horas antes de lo que dice su fecha.
 */
const NOW = `(now() AT TIME ZONE 'America/Montevideo')`;

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

/**
 * Argumentos comunes de la bandeja (lista y tablero), leídos del JSON de filtros `$2`.
 * `assigned`: '' (todos), 'me' (asignadas a quien consulta), 'none' (sin asignar) o un id.
 */
const INBOX_ARGS = `
           coalesce(f ->> 'search', '')                         AS search,
           NULLIF(f ->> 'sede_id', '')                          AS sede_id,
           coalesce(f ->> 'source', '')                         AS source,
           NULLIF(f ->> 'patient_id', '')                       AS patient_id,
           coalesce(f ->> 'assigned', '')                       AS assigned,
           coalesce((f ->> 'sla_hours')::numeric, 48)           AS sla_hours,
           NULLIF(f ->> 'date_from', '')                        AS date_from,
           NULLIF(f ->> 'date_to', '')                          AS date_to,`;

/** Filtro por bucket de la lista (`board_status` del query). El tablero no lo usa: muestra todos. */
const BUCKET_FILTER = `
       AND (a.board_status = 'all' OR CASE a.board_status
             WHEN 'new'       THEN b.board_status = 'new'
             WHEN 'pending'   THEN b.board_status IN ('new', 'unscheduled', 'partially_scheduled')
             WHEN 'overdue'   THEN (b.has_past_due_appointment
                                    OR (b.board_status IN ('new', 'unscheduled', 'partially_scheduled')
                                        AND b.hours_since_submitted > a.sla_hours))
             WHEN 'scheduled' THEN b.board_status IN ('scheduled', 'partially_scheduled')
             WHEN 'completed' THEN b.board_status = 'completed'
             WHEN 'drafts'    THEN b.status = 'draft'
             WHEN 'review'    THEN EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(so.review_items, '[]'::jsonb)) r
                                            WHERE r ->> 'status' = 'pending')
             ELSE true END)`;

/**
 * CTE `base` de la bandeja: las órdenes que ve el sujeto (alcance y permisos) con los filtros
 * aplicados. La comparten la lista y el tablero, para que las dos vistas no puedan diferir en qué
 * órdenes muestran.
 */
const inboxBaseCte = ({ withBucket }) => `
base AS (
    SELECT b.*,
           d.name  AS doctor_name,
           so.source,
           so.referring_doctor_name,
           -- Lectura de originales de la que salió (WhatsApp o importada); nulo si se cargó a mano.
           so.source_intake_id,
           -- Responsable en la clínica (migración 129).
           so.assigned_to,
           asg.name AS assigned_to_name,
           so.assigned_at,
           se.name AS preferred_sede_name,
           (b.has_past_due_appointment
            OR (b.board_status IN ('new', 'unscheduled', 'partially_scheduled')
                AND b.hours_since_submitted > a.sla_hours)) AS is_overdue,
           (SELECT string_agg(i.service_name, ', ' ORDER BY i.sort_order, i.service_name)
              FROM public.study_order_items i
             WHERE i.study_order_id = b.id AND i.is_cancelled = false) AS items_summary,
           -- Puntos que el agente de WhatsApp no tuvo claros y nadie revisó todavía.
           (SELECT count(*) FROM jsonb_array_elements(coalesce(so.review_items, '[]'::jsonb)) r
             WHERE r ->> 'status' = 'pending') AS review_pending
      FROM public.v_study_orders_board b
      CROSS JOIN args a
      LEFT JOIN public.users d  ON d.id  = b.doctor_id
      LEFT JOIN public.study_orders so ON so.id = b.id
      LEFT JOIN public.sedes se ON se.id = b.preferred_sede_id
      LEFT JOIN public.users asg ON asg.id = so.assigned_to
     WHERE
       -- Autorización: sólo con VIEW_ALL se ve la bandeja completa. Pedir
       -- scope=clinic sin el permiso devuelve igual las órdenes propias.
       -- Los borradores son de su doctor, salvo los que salen de leer los originales: los que
       -- crea el agente de WhatsApp al derivar y los que recepción importa subiendo fotos o PDF
       -- (source_intake_id). No tienen doctor y son trabajo de recepción. Las importadas quedan
       -- con source = 'portal': mirar solo source las dejaba invisibles mientras eran borrador.
       CASE WHEN a.scope = 'clinic' AND (SELECT can_view_all FROM perms)
            THEN (b.status <> 'draft' OR so.source = 'whatsapp' OR so.source_intake_id IS NOT NULL)
            -- Ficha del paciente: quien puede abrirla ve todas sus órdenes, no sólo las que derivó.
            -- Los borradores ajenos siguen fuera: todavía no son una orden.
            WHEN a.scope = 'patient' AND a.patient_id IS NOT NULL
                 AND ((SELECT can_view_patient FROM perms) OR (SELECT can_view_all FROM perms))
            THEN (b.status <> 'draft' OR so.source = 'whatsapp' OR so.source_intake_id IS NOT NULL
                  OR b.doctor_id = $1::uuid)
            ELSE b.doctor_id = $1::uuid
       END${withBucket ? BUCKET_FILTER : ''}
       AND (a.search = '' OR lower(b.patient_name) LIKE lower(a.search) || '%'
                          OR b.patient_document LIKE a.search || '%'
                          OR lower(b.order_number) LIKE lower(a.search) || '%')
       AND (a.sede_id IS NULL OR b.preferred_sede_id = a.sede_id::int)
       -- so.source y no b.source: b es la vista del tablero, que no tiene esa columna.
       -- Las derivadas de WhatsApp son las de origen whatsapp en borrador: se combinan los dos filtros.
       AND (a.source = '' OR so.source = a.source)
       -- Órdenes de un paciente concreto: lo usa el selector del diálogo de cita.
       AND (a.patient_id IS NULL OR b.patient_id = a.patient_id::uuid)
       -- Responsable: asignadas a quien consulta, sin asignar o a un usuario concreto.
       AND CASE a.assigned
             WHEN ''     THEN true
             WHEN 'me'   THEN so.assigned_to = $1::uuid
             WHEN 'none' THEN so.assigned_to IS NULL
             ELSE so.assigned_to::text = a.assigned
           END
       AND (a.date_from IS NULL OR b.submitted_at >= a.date_from::timestamp)
       AND (a.date_to   IS NULL OR b.submitted_at <  (a.date_to::timestamp + interval '1 day'))
)`;

/** Columnas de cada orden de la bandeja (fila de la lista o tarjeta del tablero). */
const inboxRowColumns = (t) => `${t}.id::text, ${t}.order_number, ${t}.doctor_id::text, ${t}.doctor_name,
                        ${t}.patient_id::text, ${t}.patient_name, ${t}.patient_document, ${t}.patient_phone,
                        ${t}.status, ${t}.board_status, ${t}.items_total, ${t}.items_scheduled, ${t}.items_completed,
                        ${t}.items_summary, ${t}.is_overdue, ${t}.hours_since_submitted,
                        ${t}.source, ${t}.referring_doctor_name, ${t}.source_intake_id::text,
                        ${t}.preferred_sede_id::text, ${t}.preferred_sede_name,
                        ${t}.submitted_at, ${t}.acknowledged_at, ${t}.completed_at, ${t}.created_at,
                        ${t}.review_pending,
                        ${t}.assigned_to::text, ${t}.assigned_to_name, ${t}.assigned_at`;

export const LIST_SQL = `
-- $1 = userId del token.  $2 = filtros como JSON.
-- Dos parámetros por el mismo motivo que el upsert: sin array posicional no hay
-- desalineación posible ni placeholders de dos dígitos.
WITH ${PERMS_WITH_PATIENT_CTE},
q AS (
    SELECT $2::jsonb AS f
),
args AS (
    SELECT coalesce(NULLIF(f ->> 'scope', ''), 'mine')          AS scope,
           coalesce(NULLIF(f ->> 'board_status', ''), 'all')    AS board_status,${INBOX_ARGS}
           coalesce(NULLIF(f ->> 'sort', ''), 'submitted_at:desc') AS sort,
           coalesce((f ->> 'limit')::int, 25)                   AS lim,
           coalesce((f ->> 'offset')::int, 0)                   AS off
      FROM q
),${inboxBaseCte({ withBucket: true })}
SELECT (SELECT count(*) FROM base) AS total,
       coalesce((
         SELECT json_agg(row_to_json(x))
           FROM (SELECT ${inboxRowColumns('b')}
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

/**
 * Columnas del tablero (vista Estados), en el orden en que avanza una orden. Es el `board_status`
 * DERIVADO de v_study_orders_board (las citas mandan), no study_orders.status.
 */
export const BOARD_COLUMNS = ['draft', 'new', 'unscheduled', 'partially_scheduled', 'scheduled',
                              'in_progress', 'completed', 'cancelled'];

export const BOARD_SQL = `
-- $1 = userId del token.  $2 = filtros como JSON.
-- Mismo alcance, permisos y filtros que GET /study-orders (comparten la CTE base); en vez de
-- paginar, agrupa por board_status: el total de cada columna y sus primeras \`limit\` tarjetas.
-- Con \`column\` devuelve solo esa columna desde \`offset\` ("cargar más").
WITH ${PERMS_WITH_PATIENT_CTE},
q AS (
    SELECT $2::jsonb AS f
),
args AS (
    SELECT coalesce(NULLIF(f ->> 'scope', ''), 'mine')          AS scope,
           coalesce(f ->> 'column', '')                         AS col,${INBOX_ARGS}
           coalesce((f ->> 'limit')::int, 25)                   AS lim,
           coalesce((f ->> 'offset')::int, 0)                   AS off
      FROM q
),${inboxBaseCte({ withBucket: false })},
ranked AS (
    SELECT b.*,
           -- Dentro de cada columna: primero las atrasadas, después las más recientes.
           row_number() OVER (PARTITION BY b.board_status
                              ORDER BY b.is_overdue DESC,
                                       coalesce(b.submitted_at, b.created_at) DESC,
                                       b.order_number DESC) AS rn
      FROM base b
)
SELECT coalesce(json_agg(json_build_object(
           'status', c.status,
           'total',  c.total,
           'items',  c.items) ORDER BY c.ord), '[]'::json) AS columns
  FROM (
    SELECT s.status, s.ord,
           (SELECT count(*) FROM base b WHERE b.board_status = s.status) AS total,
           coalesce((
             SELECT json_agg(row_to_json(x) ORDER BY x.rn)
               FROM (SELECT r.rn, ${inboxRowColumns('r')}
                       FROM ranked r
                      WHERE r.board_status = s.status
                        AND r.rn >  (SELECT off FROM args)
                        AND r.rn <= (SELECT off FROM args) + (SELECT lim FROM args)) x
           ), '[]'::json) AS items
      FROM unnest(ARRAY[${BOARD_COLUMNS.map((c) => `'${c}'`).join(', ')}]) WITH ORDINALITY AS s(status, ord)
     WHERE (SELECT col FROM args) = '' OR s.status = (SELECT col FROM args)
  ) c;`;

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
           so.source, so.referring_doctor_name, so.source_intake_id::text,
           -- Responsable en la clínica (migración 129).
           so.assigned_to::text,
           (SELECT u.name FROM public.users u WHERE u.id = so.assigned_to) AS assigned_to_name,
           so.assigned_at,
           (SELECT u.name FROM public.users u WHERE u.id = so.assigned_by) AS assigned_by_name,
           -- Orden que entro por WhatsApp: los originales (fotos o PDF) y lo que el asistente
           -- leyo de ellos, para poder comprobar que no hubo errores de lectura.
           -- También las importadas desde Invoke (channel = 'import': sin teléfono, con quién importó).
           (SELECT json_build_object(
                     'intake_id', wi.id::text,
                     'channel', wi.channel,
                     'imported_by_name', (SELECT u.name FROM public.users u WHERE u.id = wi.created_by),
                     'phone', wi.phone,
                     'received_at', wi.created_at,
                     'warnings', coalesce(wi.validation -> 'warnings', '[]'::jsonb),
                     'extraction_meta', wi.extraction_meta,
                     -- Borrador de una derivación cuyo intake ya tenía una orden del agente: al
                     -- enviarlo, la reemplaza (SUBMIT_SQL). Se avisa antes de confirmar.
                     'replaces_order_number', (
                         SELECT o2.order_number FROM public.study_orders o2
                          WHERE o2.id = wi.study_order_id AND o2.id <> so.id
                            AND o2.status IN ('draft', 'submitted')
                            AND so.status = 'draft'
                            AND wi.status = 'handed_off' AND wi.resolved_at IS NULL),
                     'files', coalesce((
                         SELECT json_agg(json_build_object(
                                  'id', at.id::text, 'file_name', at.file_name, 'mime_type', at.mime_type,
                                  'web_view_link', at.web_view_link, 'thumbnail_link', at.thumbnail_link,
                                  'created_at', at.created_at) ORDER BY at.id)
                           FROM public.attachments at
                          WHERE at.source_name = 'whatsapp_order_intake' AND at.source_id = wi.id::text
                     ), '[]'::json))
              FROM public.whatsapp_order_intakes wi
             -- La lectura de la que salió la orden: por source_intake_id o, si la orden no lo
             -- tiene (órdenes viejas o vinculadas solo desde el intake), por el intake que apunta
             -- a ella. Sin esto el tab Original desaparecía en esas órdenes, sin importar su estado.
             WHERE wi.id = coalesce(so.source_intake_id,
                                    (SELECT wi2.id FROM public.whatsapp_order_intakes wi2
                                      WHERE wi2.study_order_id = so.id
                                      ORDER BY wi2.created_at DESC LIMIT 1))) AS whatsapp,
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
           -- Lo que el agente de WhatsApp no tuvo claro al leer la orden, con su revisión
           -- (study_orders.review_items, migración 126).
           coalesce(so.review_items, '[]'::jsonb) AS review_items,
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
    -- sujeto del token. Con ese mismo permiso, without_doctor deja la orden SIN
    -- doctor derivador (el agente de WhatsApp: el doctor es opcional y el del
    -- papel sólo se guarda como texto). Sin el permiso el indicador se ignora,
    -- para que nadie pueda esconder quién creó una orden.
    SELECT CASE
             WHEN (SELECT can_create_for_doctor FROM perms)
              AND coalesce((SELECT body ->> 'doctor_id' FROM p), '') <> ''
             THEN (SELECT body ->> 'doctor_id' FROM p)::uuid
             WHEN (SELECT can_create_for_doctor FROM perms)
              AND coalesce((SELECT body ->> 'without_doctor' FROM p), '') IN ('true', 't', '1')
             THEN NULL::uuid
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
           -- source, referring_doctor_name y source_intake_id los manda sólo el
           -- agente; sin CREATE_FOR_DOCTOR se ignoran y la orden es del portal.
           CASE WHEN (SELECT can_create_for_doctor FROM perms)
                 AND body ->> 'source' = 'whatsapp' THEN 'whatsapp' ELSE 'portal' END AS source,
           CASE WHEN (SELECT can_create_for_doctor FROM perms)
                THEN NULLIF(body ->> 'referring_doctor_name', '') END AS referring_doctor_name,
           CASE WHEN (SELECT can_create_for_doctor FROM perms)
                THEN NULLIF(body ->> 'source_intake_id', '') END AS source_intake_id,
           coalesce(body -> 'items', '[]'::jsonb)   AS items
      FROM p
),
-- Foto previa de lo que se registra en el historial del chatter ("Teléfono: 099… → 098…"). El
-- CTE ve la fila como estaba antes de la sentencia, igual que \`prev\` en ASSIGN_SQL.
before AS (
    SELECT so.patient_name, so.patient_document, so.patient_phone, so.patient_email,
           so.preferred_sede_id, so.clinical_notes, so.referring_doctor_name, so.delivery_methods,
           coalesce((SELECT array_agg(i.service_name::text ORDER BY i.service_name)
                       FROM public.study_order_items i
                      WHERE i.study_order_id = so.id), ARRAY[]::text[]) AS services
      FROM public.study_orders so, vals v
     WHERE v.id IS NOT NULL
       AND so.id = v.id::uuid
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
           preferred_sede_id = v.preferred_sede_id::int,
           referring_doctor_name = coalesce(v.referring_doctor_name, so.referring_doctor_name),
           updated_by        = $1::uuid
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
            clinical_notes, preferred_sede_id, created_by,
            source, referring_doctor_name, source_intake_id)
    SELECT (SELECT doctor_id FROM resolved), v.patient_id::uuid, v.patient_name,
           v.patient_document, v.patient_email, v.patient_phone, v.regions,
           v.section_modifiers, v.texts, v.delivery_methods, v.clinical_notes,
           v.preferred_sede_id::int, $1::uuid,
           v.source, v.referring_doctor_name, v.source_intake_id::uuid
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
),
-- Campos que cambiaron al editar (solo en una edición: al crear no hay "antes"). Viaja en la
-- metadata del evento \`updated\` y el chatter lo muestra como "anterior → nuevo". Lo que no
-- se puede contar en una línea (piezas, modificadores, textos de sección) queda fuera: el evento
-- igual dice que la orden se editó.
tracked AS (
    SELECT c.ord, c.field, c.old_value, c.new_value
      FROM before b, vals v,
           LATERAL (VALUES
               (1, 'patient_name',          b.patient_name::text,          v.patient_name::text),
               (2, 'patient_document',      b.patient_document::text,      v.patient_document::text),
               (3, 'patient_phone',         b.patient_phone::text,         v.patient_phone::text),
               (4, 'patient_email',         b.patient_email::text,         v.patient_email::text),
               (5, 'preferred_sede',
                   (SELECT se.name::text FROM public.sedes se WHERE se.id = b.preferred_sede_id),
                   (SELECT se.name::text FROM public.sedes se WHERE se.id = v.preferred_sede_id::int)),
               (6, 'referring_doctor_name', b.referring_doctor_name::text,
                   coalesce(v.referring_doctor_name, b.referring_doctor_name)::text),
               -- Por etiqueta y ordenadas: marcar las mismas en otro orden no es un cambio.
               (7, 'delivery_methods',
                   (SELECT string_agg(coalesce(o.label, d.code), ', ' ORDER BY d.code)
                      FROM jsonb_array_elements_text(coalesce(b.delivery_methods, '[]'::jsonb)) AS d(code)
                      LEFT JOIN public.study_order_options o ON o.option_kind = 'delivery' AND o.code = d.code),
                   (SELECT string_agg(coalesce(o.label, d.code), ', ' ORDER BY d.code)
                      FROM jsonb_array_elements_text(v.delivery_methods) AS d(code)
                      LEFT JOIN public.study_order_options o ON o.option_kind = 'delivery' AND o.code = d.code)),
               (8, 'clinical_notes',        b.clinical_notes,              v.clinical_notes),
               (9, 'services_added', NULL::text,
                   (SELECT string_agg(n.name, ', ' ORDER BY n.name)
                      FROM (SELECT DISTINCT e ->> 'service_name' AS name
                              FROM jsonb_array_elements(v.items) AS e) n
                     WHERE n.name IS NOT NULL AND NOT (n.name = ANY (b.services)))),
               (10, 'services_removed',
                   (SELECT string_agg(o.name, ', ' ORDER BY o.name)
                      FROM unnest(b.services) AS o(name)
                     WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v.items) AS e
                                        WHERE e ->> 'service_name' = o.name)),
                   NULL::text)
           ) AS c(ord, field, old_value, new_value)
     WHERE c.old_value IS DISTINCT FROM c.new_value
       AND EXISTS (SELECT 1 FROM updated)
)
SELECT (SELECT id::text FROM target) AS id,
       (SELECT count(*) FROM items)  AS items_written,
       coalesce((SELECT jsonb_agg(jsonb_build_object('field', t.field,
                                                     'old', left(t.old_value, 300),
                                                     'new', left(t.new_value, 300)) ORDER BY t.ord)
                   FROM tracked t), '[]'::jsonb) AS changes;`;

export const SUBMIT_SQL = `
-- $1 userId (token)  $2 id
-- Sella el envío. El WHERE es el candado: una orden que ya salió de borrador,
-- o que no es del sujeto, no actualiza nada y el flujo responde 409.
--
-- Orden creada por recepción desde una DERIVACIÓN de WhatsApp (source_intake_id apunta a un
-- intake en handed_off sin resolver): enviarla resuelve la derivación y la vincula a esta
-- orden. Si el intake ya tenía una orden (la que había creado el agente, p. ej. "la orden
-- cambió" porque llegó el dorso), esta la REEMPLAZA: la anterior se anula y sus citas
-- vigentes pasan a la nueva, así no se pierde lo agendado. Todo en la misma sentencia.
-- El agente también envía con source_intake_id, pero su intake nunca está en handed_off.
--
-- Puntos a revisar BLOQUEANTES (el borrador que se crea al derivar): mientras quede alguno
-- pendiente la orden no sale. Siempre devuelve una fila: con id nulo y pending_review > 0, el
-- flujo responde 409 diciendo cuántos faltan.
WITH ${PERMS_CTE},
pending_review AS (
    SELECT 1 FROM public.study_orders so2, jsonb_array_elements(coalesce(so2.review_items, '[]'::jsonb)) r
     WHERE so2.id = $2::uuid
       AND coalesce((r ->> 'blocking')::boolean, false)
       AND r ->> 'status' = 'pending'
),
updated AS (
    UPDATE public.study_orders so
       SET status = 'submitted', submitted_at = ${NOW}
     WHERE so.id = $2::uuid
       AND so.status = 'draft'
       AND (so.doctor_id = $1::uuid OR (SELECT can_view_all FROM perms))
       AND EXISTS (SELECT 1 FROM public.study_order_items i
                    WHERE i.study_order_id = so.id AND i.is_cancelled = false)
       AND NOT EXISTS (SELECT 1 FROM pending_review)
    RETURNING so.id, so.order_number, so.doctor_id, so.patient_name, so.submitted_at, so.source_intake_id
),
intake AS (
    SELECT wi.id, wi.study_order_id AS old_order_id, u.id AS new_order_id, u.order_number
      FROM updated u
      JOIN public.whatsapp_order_intakes wi ON wi.id = u.source_intake_id
     WHERE wi.status = 'handed_off'
       AND wi.resolved_at IS NULL
),
resolved_intake AS (
    UPDATE public.whatsapp_order_intakes wi
       SET resolved_at = ${NOW},
           resolved_by = $1::uuid,
           study_order_id = i.new_order_id,
           resolution_note = coalesce(wi.resolution_note, 'Orden ' || i.order_number || ' creada desde la derivación')
      FROM intake i
     WHERE wi.id = i.id
    RETURNING wi.id
),
replaced AS (
    UPDATE public.study_orders so
       SET status = 'cancelled', cancelled_at = ${NOW},
           cancellation_reason = 'Reemplazada por la orden ' || i.order_number || ' (derivación de WhatsApp)'
      FROM intake i
     WHERE so.id = i.old_order_id
       AND so.id <> i.new_order_id
       AND so.status IN ('draft', 'submitted')
       -- Anular la orden del agente exige el mismo permiso que anularla desde la bandeja.
       AND coalesce((SELECT can_cancel FROM perms), false)
    RETURNING so.id, i.new_order_id, i.order_number AS new_order_number
),
moved AS (
    UPDATE public.appointments a
       SET study_order_id = r.new_order_id, updated_at = ${NOW}
      FROM replaced r
     WHERE a.study_order_id = r.id
       AND a.status NOT IN ('canceled', 'cancelled', 'deleted')
    RETURNING a.id
),
replaced_event AS (
    -- Bitácora de la orden anulada: queda dicho por cuál se reemplazó y cuántas citas se movieron.
    INSERT INTO public.study_order_events (study_order_id, event_type, actor_id, actor_kind, metadata)
    SELECT r.id, 'cancelled', $1::uuid, 'user',
           jsonb_build_object('reason', 'replaced', 'replaced_by_order_id', r.new_order_id::text,
                              'replaced_by_order_number', r.new_order_number,
                              'moved_appointments', (SELECT count(*) FROM moved))
      FROM replaced r
    RETURNING id
)
SELECT u.id::text, u.order_number, u.doctor_id::text, u.patient_name, u.submitted_at,
       d.name AS doctor_name,
       (SELECT count(*) FROM public.study_order_items i WHERE i.study_order_id = u.id) AS items_total,
       (SELECT count(*) FROM resolved_intake) > 0 AS resolved_handoff,
       (SELECT min(o.order_number) FROM public.study_orders o WHERE o.id IN (SELECT id FROM replaced)) AS replaced_order_number,
       (SELECT count(*) FROM moved) AS moved_appointments,
       (SELECT count(*) FROM pending_review) AS pending_review
  FROM (SELECT 1) one
  LEFT JOIN updated u ON true
  LEFT JOIN public.users d ON d.id = u.doctor_id;`;

/**
 * Registra los puntos a revisar de una orden (lo que el agente de WhatsApp no tuvo claro al
 * leerla, `buildReviewItems` de intake-lib.mjs) en `study_orders.review_items`. Lo usa el agente:
 * al crear el borrador de una derivación (bloqueantes) y al agendar una orden él solo (informativos).
 *
 * Cada punto: { id, code, field, label, value_read, confidence, detail, section_code, source, blocking, status,
 *               resolution_note, reviewed_by, reviewed_by_name, reviewed_at, created_at }.
 * `id` = los 12 primeros caracteres del md5 de code|field: el mismo punto no se agrega dos veces.
 */
export const REVIEW_ITEMS_INSERT_SQL = `
-- $1 id de la orden  $2 puntos como JSON ([{ code, field, label, value, confidence, detail }])
-- $3 bloqueantes ('true' / 'false').
WITH incoming AS (
    SELECT DISTINCT ON (item ->> 'id') item, ord
      FROM (
        SELECT jsonb_build_object(
                 'id', substr(md5(coalesce(e ->> 'code', '') || '|' || coalesce(e ->> 'field', '')), 1, 12),
                 'code', left(e ->> 'code', 40),
                 'field', left(coalesce(e ->> 'field', ''), 160),
                 'label', coalesce(NULLIF(e ->> 'label', ''), e ->> 'code'),
                 'value_read', e ->> 'value',
                 'confidence', CASE WHEN jsonb_typeof(e -> 'confidence') = 'number'
                                    THEN round((e ->> 'confidence')::numeric, 3) END,
                 'detail', e ->> 'detail',
                 -- Sección del formulario donde está el dato: el asistente muestra la advertencia en ese paso.
                 'section_code', NULLIF(e ->> 'section_code', ''),
                 -- Dónde está el dato en los originales ({ attachment_id, page, box, zone, quote }): el
                 -- asistente abre ese archivo y resalta la zona.
                 'source', CASE WHEN jsonb_typeof(e -> 'source') = 'object' THEN e -> 'source' END,
                 'blocking', $3::boolean,
                 'status', 'pending',
                 'created_at', replace(to_char(${NOW}, 'YYYY-MM-DD HH24:MI:SS'), ' ', 'T')) AS item,
               t.ord
          FROM jsonb_array_elements(coalesce(NULLIF($2::text, '')::jsonb, '[]'::jsonb)) WITH ORDINALITY AS t(e, ord)
         WHERE coalesce(e ->> 'code', '') <> ''
      ) x
     ORDER BY item ->> 'id', ord
),
upd AS (
    -- Se agrega sobre el valor de la fila al momento de actualizarla (no sobre una lectura previa):
    -- dos altas simultáneas no se pisan.
    UPDATE public.study_orders so
       SET review_items = coalesce(so.review_items, '[]'::jsonb) || coalesce((
             SELECT jsonb_agg(i.item ORDER BY i.ord)
               FROM incoming i
              WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(so.review_items, '[]'::jsonb)) x
                                 WHERE x ->> 'id' = i.item ->> 'id')), '[]'::jsonb)
     WHERE so.id = $1::uuid
    RETURNING so.order_number, jsonb_array_length(so.review_items) AS total
)
SELECT order_number, total FROM upd;`;

/**
 * Recepción marca uno o varios puntos a revisar de una orden: confirmado (la lectura estaba bien),
 * corregido (lo arregló en la orden), descartado (no aplica) o de vuelta a pendiente. Queda en cada
 * punto (quién y cuándo) y en la línea de tiempo, un evento por punto.
 *
 * Solo cambian los puntos que siguen en el estado de partida (pendientes al resolver, resueltos al
 * reabrir): un lote no pisa lo que otra persona resolvió mientras tanto. Todo o nada, en una sola
 * sentencia.
 */
export const REVIEW_ITEM_UPDATE_SQL = `
-- $1 userId (token)  $2 { order_id, item_ids: [...], status, note }
-- Mismo alcance que editar la orden: la propia o, con VIEW_ALL, cualquiera. Una orden anulada no se toca.
WITH ${PERMS_CTE},
p AS (
    SELECT $2::jsonb AS b,
           ($2::jsonb ->> 'status') = 'pending' AS reopen,
           (SELECT u.name FROM public.users u WHERE u.id = $1::uuid) AS reviewer_name
),
cur AS (
    -- La fila se bloquea antes de decidir qué puntos cambian: así se lee la versión vigente aunque
    -- otra persona acabe de marcar algo en la misma orden.
    SELECT so.id, coalesce(so.review_items, '[]'::jsonb) AS review_items
      FROM public.study_orders so, p
     WHERE so.id = (p.b ->> 'order_id')::uuid
       AND so.status <> 'cancelled'
       AND (p.b ->> 'status') IN ('pending', 'confirmed', 'corrected', 'dismissed')
       AND (so.doctor_id = $1::uuid OR (SELECT can_view_all FROM perms))
       FOR UPDATE OF so
),
target AS (
    SELECT x ->> 'id' AS id
      FROM cur c, p, jsonb_array_elements(c.review_items) x
     WHERE x ->> 'id' IN (SELECT jsonb_array_elements_text(coalesce(p.b -> 'item_ids', '[]'::jsonb)))
       AND CASE WHEN p.reopen THEN x ->> 'status' <> 'pending' ELSE x ->> 'status' = 'pending' END
),
upd AS (
    UPDATE public.study_orders so
       SET review_items = (
             SELECT jsonb_agg(CASE WHEN x ->> 'id' IN (SELECT id FROM target)
                                   THEN x || jsonb_build_object(
                                          'status', p.b ->> 'status',
                                          'resolution_note', NULLIF(trim(coalesce(p.b ->> 'note', '')), ''),
                                          'reviewed_by', CASE WHEN p.reopen THEN NULL ELSE $1::text END,
                                          'reviewed_by_name', CASE WHEN p.reopen THEN NULL ELSE p.reviewer_name END,
                                          'reviewed_at', CASE WHEN p.reopen THEN NULL
                                                              ELSE replace(to_char(${NOW}, 'YYYY-MM-DD HH24:MI:SS'), ' ', 'T') END)
                                   ELSE x END
                              ORDER BY t.ord)
               FROM jsonb_array_elements(c.review_items) WITH ORDINALITY AS t(x, ord))
      FROM cur c, p
     WHERE so.id = c.id
       AND EXISTS (SELECT 1 FROM target)
    RETURNING so.id, so.review_items
),
items AS (
    SELECT u.id AS order_id, x AS it
      FROM upd u, jsonb_array_elements(u.review_items) x
     WHERE x ->> 'id' IN (SELECT id FROM target)
),
ev AS (
    INSERT INTO public.study_order_events (study_order_id, event_type, actor_id, actor_kind, metadata)
    SELECT i.order_id, 'review_updated', $1::uuid, 'user',
           jsonb_build_object('item_id', i.it ->> 'id', 'label', i.it ->> 'label', 'value', i.it ->> 'value_read',
                              'status', i.it ->> 'status', 'note', i.it ->> 'resolution_note')
      FROM items i
    RETURNING id
)
SELECT u.id AS order_id,
       p.b ->> 'status' AS status,
       (SELECT jsonb_agg(i.it ->> 'id') FROM items i) AS item_ids,
       (SELECT count(*) FROM items) AS updated,
       (SELECT count(*) FROM jsonb_array_elements(u.review_items) y
         WHERE coalesce((y ->> 'blocking')::boolean, false) AND y ->> 'status' = 'pending') AS pending_blocking
  FROM upd u, p;`;


export const DELETE_SQL = `
-- $1 userId (token)  $2 id. Sólo borradores propios; las líneas caen por CASCADE.
-- Borrador creado al derivar desde WhatsApp: borrarlo deja la derivación resuelta como descartada
-- (los originales y la lectura quedan en el intake, para auditoría).
WITH ${PERMS_CTE},
del AS (
    DELETE FROM public.study_orders so
     WHERE so.id = $2::uuid
       AND so.status = 'draft'
       AND (so.doctor_id = $1::uuid OR (SELECT can_view_all FROM perms))
    RETURNING so.id, so.order_number, so.source_intake_id
),
resolved_intake AS (
    UPDATE public.whatsapp_order_intakes wi
       SET resolved_at = ${NOW},
           resolved_by = $1::uuid,
           resolution_note = coalesce(wi.resolution_note, 'Borrador ' || d.order_number || ' descartado sin enviar')
      FROM del d
     WHERE wi.id = d.source_intake_id
       AND wi.status = 'handed_off'
       AND wi.resolved_at IS NULL
    RETURNING wi.id
)
SELECT d.id::text, (SELECT count(*) FROM resolved_intake) > 0 AS resolved_handoff
  FROM del d;`;

export const ACKNOWLEDGE_SQL = `
-- $1 userId (token)  $2 id. Saca la orden del bucket "nuevas".
WITH ${PERMS_CTE}
UPDATE public.study_orders so
   SET acknowledged_at = ${NOW}, acknowledged_by = $1::uuid
 WHERE so.id = $2::uuid
   AND so.status = 'submitted'
   AND so.acknowledged_at IS NULL
   AND (SELECT can_acknowledge FROM perms)
RETURNING so.id::text, so.acknowledged_at;`;

/**
 * Usuario de staff de la clínica: activo y con rol recepcionista, gerente o administrador. Es el
 * mismo criterio que get_users_filtered(p_only_staff) (migraciones 032 y 121). Son quienes
 * revisan las órdenes, así que son a quienes se les puede asignar una. `u` = alias de users.
 */
const IS_STAFF_USER = `
       u.is_active IS NOT FALSE
   AND EXISTS (SELECT 1
                 FROM public.user_roles ur
                 JOIN public.roles r ON r.id = ur.role_id
                WHERE ur.user_id = u.id
                  AND ur.is_active IS NOT FALSE
                  AND lower(trim(r.name)) IN ('recepcionista', 'gerente', 'administrador'))`;

/**
 * Asignar quién revisa la orden en la clínica (o dejarla sin asignar). $3 = '' → sin asignar.
 * Solo a usuarios de staff (IS_STAFF_USER).
 * Devuelve el responsable anterior para la bitácora y para no avisar si no cambió.
 */
export const ASSIGN_SQL = `
-- $1 userId (token)  $2 id de la orden  $3 responsable nuevo ('' = sin asignar)
WITH
perms AS (
    SELECT bool_or(p.code = 'STUDY_ORDERS_VIEW_ALL') AS can_view_all,
           bool_or(p.code = 'STUDY_ORDERS_ASSIGN')   AS can_assign
      FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.role_id = ur.role_id
      JOIN public.permissions p       ON p.id = rp.permission_id
     WHERE ur.user_id = $1::uuid
       AND ur.is_active IS NOT FALSE
       AND p.code LIKE 'STUDY_ORDERS_%'
),
-- Solo a usuarios de staff (recepcionista, gerente, administrador).
assignee AS (
    SELECT u.id, u.name
      FROM public.users u
     WHERE u.id = NULLIF($3::text, '')::uuid
       AND ${IS_STAFF_USER}
),
-- Lo que había antes (el UPDATE ve la foto previa): para el evento y para saber si cambió.
prev AS (
    SELECT so.assigned_to, pu.name
      FROM public.study_orders so
      LEFT JOIN public.users pu ON pu.id = so.assigned_to
     WHERE so.id = $2::uuid
)
UPDATE public.study_orders so
   SET assigned_to = (SELECT id FROM assignee),
       assigned_at = CASE WHEN NULLIF($3::text, '') IS NULL THEN NULL ELSE ${NOW} END,
       assigned_by = CASE WHEN NULLIF($3::text, '') IS NULL THEN NULL ELSE $1::uuid END
 WHERE so.id = $2::uuid
   AND (SELECT can_assign FROM perms)
   AND (SELECT can_view_all FROM perms)
   -- Lo que ve la clínica: enviadas, o borradores que salieron de leer los originales (WhatsApp o
   -- importados). Misma regla que la bandeja (inboxBaseCte).
   AND (so.status <> 'draft' OR so.source = 'whatsapp' OR so.source_intake_id IS NOT NULL)
   -- Un id que no es un responsable válido no deja sin asignar en silencio: falla.
   AND (NULLIF($3::text, '') IS NULL OR EXISTS (SELECT 1 FROM assignee))
RETURNING so.id::text,
          so.order_number,
          so.assigned_to::text,
          (SELECT name FROM assignee)             AS assigned_to_name,
          so.assigned_at,
          (SELECT assigned_to::text FROM prev)    AS previous_assigned_to,
          (SELECT name FROM prev)                 AS previous_assigned_to_name;`;

/**
 * Aviso al nuevo responsable. No se avisa a quien se la asignó a sí mismo, ni si no cambió.
 * $1 = id de la orden.  $2 = quién asignó.  $3 = si cambió el responsable ('true'/'false').
 *
 * RETURNING *: lo que devuelve este nodo es EXACTAMENTE lo que viaja por SSE al navegador, que lo
 * normaliza igual que las notificaciones que trae por REST (necesita la fila entera).
 */
export const NOTIFY_ASSIGNEE_SQL = `
INSERT INTO public.notifications
       (user_id, type, status, priority, patient_id, metadata, created_at)
SELECT so.assigned_to,
       'study_order_assigned',
       'pending',
       'MEDIUM',
       so.patient_id,
       jsonb_build_object(
           'order_id',      so.id::text,
           'order_number',  so.order_number,
           'source',        so.source,
           'patient_id',    so.patient_id::text,
           'patient_name',  so.patient_name,
           'items_summary', (SELECT string_agg(i.service_name, ', ' ORDER BY i.sort_order, i.service_name)
                               FROM public.study_order_items i
                              WHERE i.study_order_id = so.id AND i.is_cancelled = false),
           'board_status',  b.board_status,
           'assigned_by_id',   $2::text,
           'assigned_by_name', (SELECT u.name FROM public.users u WHERE u.id = $2::uuid)
       ),
       ${NOW}
  FROM public.study_orders so
  LEFT JOIN public.v_study_orders_board b ON b.id = so.id
 WHERE so.id = $1::uuid
   AND so.assigned_to IS NOT NULL
   AND so.assigned_to IS DISTINCT FROM $2::uuid
   AND $3::boolean
RETURNING *;`;

/** A quién se puede asignar la revisión de una orden: usuarios de staff (IS_STAFF_USER). */
export const ASSIGNEES_SQL = `
-- $1 = userId del token. Quien no ve la bandeja completa no necesita la lista.
WITH me AS (
    SELECT bool_or(p.code = 'STUDY_ORDERS_VIEW_ALL') AS can_view_all
      FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.role_id = ur.role_id
      JOIN public.permissions p       ON p.id = rp.permission_id
     WHERE ur.user_id = $1::uuid
       AND ur.is_active IS NOT FALSE
       AND p.code = 'STUDY_ORDERS_VIEW_ALL'
)
SELECT coalesce(json_agg(json_build_object('id', u.id::text, 'name', u.name, 'email', u.email)
                         ORDER BY u.name), '[]'::json) AS items
  FROM public.users u
 WHERE coalesce((SELECT can_view_all FROM me), false)
   AND ${IS_STAFF_USER};`;

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
   SET status = 'cancelled', cancelled_at = ${NOW}, cancellation_reason = $3
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
       updated_at     = ${NOW}
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
           'source',        so.source,
           'referring_doctor_name', so.referring_doctor_name,
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
       ${NOW}
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
       ${NOW}
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
       updated_at     = ${NOW}
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
   -- Tres sujetos legítimos: el derivador, quien puede ver toda la bandeja, y
   -- EL TÉCNICO ASIGNADO A ESTA CITA.
   --
   -- El tercero faltaba, y por eso al operador no se le registraba la actividad:
   -- al guardar la sesión, el front pregunta acá a qué orden pertenece la cita,
   -- esto devolvía cero filas, y el recálculo —con su evento y su aviso— ni
   -- siquiera llegaba a llamarse. La sesión se guardaba y la cita se completaba,
   -- así que desde afuera parecía que sólo faltaba el renglón del historial.
   --
   -- Se resuelve por pertenencia y no dándole STUDY_ORDERS_VIEW_ALL al rol:
   -- para cerrar SU cita no hace falta poder leer la bandeja entera.
   AND (so.doctor_id = $1::uuid
        OR a.technician_id = $1::uuid
        OR (SELECT can_view_all FROM perms));`;

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
             OR so.doctor_id = $1::uuid
             -- El técnico de alguna cita de la orden. Mismo criterio que
             -- /by-appointment: quien ejecuta el estudio puede cerrar su orden.
             OR EXISTS (SELECT 1 FROM public.appointments a
                         WHERE a.study_order_id = so.id
                           AND a.technician_id = $1::uuid) )
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
           completed_at = CASE WHEN target.new_status = 'completed' THEN ${NOW} ELSE NULL END,
           updated_at   = ${NOW}
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
       completed_at = CASE WHEN state.target = 'completed' THEN ${NOW} ELSE NULL END,
       updated_at   = ${NOW}
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
       SET revoked_at = ${NOW}
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
       AND bt.expires_at > ${NOW}
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
       AND bt.expires_at > ${NOW}
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
           ${NOW}, ${NOW}
      FROM o, v
     WHERE v.ends_at > v.starts_at
       AND v.starts_at > ${NOW}
       AND v.calendar_source_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.calendar_sources cs
                    WHERE cs.id = v.calendar_source_id AND cs.is_active)
       -- Un calendario = una agenda: no se reserva encima de otra cita. Mismo
       -- criterio de ocupación que Agent_Availability2 (cualquier cita no
       -- cancelada en la ventana). Sin esto, el link público y el agente de
       -- WhatsApp podían superponer citas. Acota la carrera pero no la elimina
       -- (la sentencia ve una foto previa a su propio INSERT): quien reserva
       -- debe rechequear la disponibilidad justo antes.
       AND NOT EXISTS (
           SELECT 1 FROM public.appointments x
            WHERE x.calendar_source_id = v.calendar_source_id
              AND x.start_datetime < v.ends_at
              AND x.end_datetime   > v.starts_at
              AND x.status NOT IN ('canceled', 'cancelled', 'deleted')
       )
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
           last_used_at = ${NOW}
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
       updated_at    = ${NOW}
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
-- $1 userId (token)  $2 payload { from, to, calendar_source_id }
--
-- Las citas que le tocan a un técnico en un rango. Alimenta el panel de Tareas,
-- que es Mi Consultorio con otra fuente.
--
-- DOS MODOS EXCLUYENTES, uno por cada pestaña del panel:
--
--   · "Asignadas a mí"  (sin calendar_source_id)
--         las citas cuyo technician_id es el sujeto DEL TOKEN.
--
--   · "Mis calendarios" (con calendar_source_id)
--         todas las citas de ese calendario, estén asignadas o no.
--
-- Es uno o el otro, nunca los dos: son dos preguntas distintas y sumarlas daba
-- un resultado que no correspondía a ninguna de las dos pestañas.
--
-- El técnico sale SIEMPRE del token y nunca del body. La versión anterior lo
-- aceptaba por parámetro con una comprobación de permisos, y cuando el que
-- llamaba no tenía el permiso el valor se ignoraba en silencio y devolvía las
-- citas del propio llamador — para un administrador con acceso a todo, eso se
-- veía como "no filtra nada". Sin parámetro no hay forma de que se ignore.
--
-- El calendario tampoco se valida contra calendar_users: la pestaña sólo ofrece
-- los calendarios a los que el usuario tiene acceso, y comprobarlo acá volvería
-- a introducir un camino donde el filtro se cae en silencio. Además no expone
-- nada nuevo: la agenda de la clínica ya muestra esas citas.
WITH b AS (
    SELECT $2::jsonb AS body
),
v AS (
    SELECT (body ->> 'from')::timestamp AS starts_at,
           (body ->> 'to')::timestamp   AS ends_at,
           NULLIF(body ->> 'calendar_source_id', '')::bigint AS calendar_source_id
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
   AND CASE
         WHEN v.calendar_source_id IS NOT NULL
              THEN a.calendar_source_id = v.calendar_source_id
         ELSE a.technician_id = $1::uuid
       END
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

export const WHATSAPP_INTAKES_SQL = `
-- $1 userId (token)  $2 filtros como JSON { status: 'pending' | 'resolved' | 'all', limit, offset }
--
-- Ordenes de estudio que el agente de WhatsApp derivo a una persona (whatsapp_order_intakes en
-- handed_off). No tienen orden en Invoke: por eso no salen en la bandeja y necesitan su propia lista.
-- Solo con STUDY_ORDERS_VIEW_ALL. Trae lo necesario para resolver sin salir de la pantalla: el motivo,
-- lo que el asistente alcanzo a leer, y los originales.
WITH ${PERMS_CTE},
q AS (SELECT $2::jsonb AS f),
args AS (
    SELECT coalesce(NULLIF(f ->> 'status', ''), 'pending') AS st,
           coalesce((f ->> 'limit')::int, 25)              AS lim,
           coalesce((f ->> 'offset')::int, 0)              AS off
      FROM q
),
base AS (
    SELECT i.*
      FROM public.whatsapp_order_intakes i CROSS JOIN args a
     WHERE coalesce((SELECT can_view_all FROM perms), false)
       AND i.status = 'handed_off'
       AND CASE a.st WHEN 'pending'  THEN i.resolved_at IS NULL
                     WHEN 'resolved' THEN i.resolved_at IS NOT NULL
                     ELSE true END
)
SELECT (SELECT count(*) FROM base) AS total,
       coalesce((
         SELECT json_agg(row_to_json(x))
           FROM (SELECT b.id::text, b.phone, b.handoff_reason, b.handoff_detail, b.created_at,
                        b.resolved_at, ru.name AS resolved_by_name, b.resolution_note,
                        coalesce(b.validation -> 'patient' ->> 'name', b.extraction -> 'patient' ->> 'name') AS patient_name,
                        coalesce(b.validation -> 'patient' ->> 'document', b.extraction -> 'patient' ->> 'document') AS patient_document,
                        b.extraction -> 'doctor' ->> 'name' AS doctor_as_written,
                        (SELECT u.name FROM public.users u WHERE u.id = b.sender_user_id) AS sender_name,
                        coalesce((
                          SELECT json_agg(coalesce(s.name, e ->> 'external_id'))
                            FROM jsonb_array_elements(coalesce(b.extraction -> 'items', '[]'::jsonb)) e
                            LEFT JOIN public.service_catalog s
                              ON coalesce(s.external_id, 'id:' || s.id) = e ->> 'external_id'
                        ), '[]'::json) AS studies,
                        -- Desde so-extraction-v3 cada linea es { text, confidence }; antes, un string.
                        coalesce((
                          SELECT jsonb_agg(CASE jsonb_typeof(l) WHEN 'object' THEN l -> 'text' ELSE l END)
                            FROM jsonb_array_elements(coalesce(b.extraction -> 'unmatched_text_lines', '[]'::jsonb)) l
                        ), '[]'::jsonb) AS unmatched_lines,
                        b.study_order_id::text,
                        (SELECT o.order_number FROM public.study_orders o WHERE o.id = b.study_order_id) AS order_number,
                        (SELECT o.status FROM public.study_orders o WHERE o.id = b.study_order_id) AS order_status,
                        -- Borrador para que recepcion cree la orden sin cargar todo de nuevo: el de la
                        -- ultima lectura con la orden ya creada (incluye el dorso que llego tarde), el
                        -- que guardo el validador al derivar, o la orden que ya habia armado.
                        coalesce(b.extraction_meta -> 'late_files' -> -1 -> 'draft',
                                 b.validation -> 'draft',
                                 b.validation -> 'resolved') AS draft,
                        b.validation -> 'patient' AS validated_patient,
                        b.sender_user_id::text AS sender_user_id,
                        -- Orden que recepcion empezo desde esta derivacion y todavia no envio.
                        (SELECT json_build_object('id', o.id::text, 'order_number', o.order_number)
                           FROM public.study_orders o
                          WHERE o.source_intake_id = b.id AND o.status = 'draft'
                          ORDER BY o.created_at DESC LIMIT 1) AS draft_order,
                        coalesce((
                          SELECT json_agg(json_build_object(
                                   'id', at.id::text, 'file_name', at.file_name, 'mime_type', at.mime_type,
                                   'web_view_link', at.web_view_link, 'thumbnail_link', at.thumbnail_link)
                                 ORDER BY at.id)
                            FROM public.attachments at
                           WHERE at.source_name = 'whatsapp_order_intake' AND at.source_id = b.id::text
                        ), '[]'::json) AS files
                   FROM base b
                   LEFT JOIN public.users ru ON ru.id = b.resolved_by
                  ORDER BY b.created_at DESC
                  LIMIT (SELECT lim FROM args) OFFSET (SELECT off FROM args)) x
       ), '[]'::json) AS items;`;

export const RESOLVE_INTAKE_SQL = `
-- $1 userId (token)  $2 payload { id, note }
-- Marca como resuelta una derivacion: recepcion ya se ocupo (creo la orden a mano o hablo con el
-- paciente). Sin STUDY_ORDERS_ACKNOWLEDGE no hace nada. No toca el resto del intake: los originales
-- y la extraccion quedan intactos para auditoria.
WITH ${PERMS_CTE},
p AS (SELECT $2::jsonb AS body)
UPDATE public.whatsapp_order_intakes i
   SET resolved_at = ${NOW},
       resolved_by = $1::uuid,
       resolution_note = NULLIF(left((SELECT body ->> 'note' FROM p), 500), '')
 WHERE i.id = (SELECT body ->> 'id' FROM p)::uuid
   AND i.status = 'handed_off'
   AND i.resolved_at IS NULL
   AND coalesce((SELECT can_acknowledge FROM perms), false)
RETURNING i.id::text, i.resolved_at;`;

// ── Importar una orden desde Invoke (fotos o PDF) ────────────────────────────
// Recepción sube los originales; los lee el mismo subflujo que los de WhatsApp (modo 'import') y
// queda una orden en BORRADOR con lo dudoso como puntos a revisar. El intake (channel = 'import')
// registra la lectura y es el source_id de los originales, igual que en WhatsApp.

/**
 * Permiso para importar: crear órdenes sin doctor vinculado (CREATE_FOR_DOCTOR, el mismo que usa el
 * agente) y ver todas (VIEW_ALL: el borrador no tiene doctor y los originales solo los ve la clínica).
 */
const CAN_IMPORT = `coalesce((SELECT can_create_for_doctor AND can_view_all FROM perms), false)`;

export const IMPORT_CREATE_INTAKE_SQL = `
-- $1 userId (token)
-- Abre el intake de la importación. Sin permiso no inserta nada y el flujo responde 403.
WITH ${PERMS_CTE}
INSERT INTO public.whatsapp_order_intakes (channel, phone, created_by, status)
SELECT 'import', NULL, $1::uuid, 'extracting'
 WHERE ${CAN_IMPORT}
RETURNING id::text;`;

export const IMPORT_SAVE_MEDIA_SQL = `
-- $1 id del intake  $2 referencias de los originales guardados (JSON array)
UPDATE public.whatsapp_order_intakes
   SET media = media || coalesce(NULLIF($2::text, '')::jsonb, '[]'::jsonb)
 WHERE id = $1::uuid
   AND channel = 'import'
RETURNING id::text, jsonb_array_length(media) AS files;`;

export const IMPORT_CLOSE_SQL = `
-- $1 id del intake  $2 id del borrador creado (vacío si no se pudo crear)  $3 id del paciente (o vacío)
-- Cierra la lectura: order_created con la orden, o failed si no se pudo crear el borrador (los
-- originales quedan en el intake).
UPDATE public.whatsapp_order_intakes
   SET status         = CASE WHEN $2::text <> '' THEN 'order_created' ELSE 'failed' END,
       study_order_id = NULLIF($2::text, '')::uuid,
       patient_id     = coalesce(NULLIF($3::text, '')::uuid, patient_id)
 WHERE id = $1::uuid
   AND channel = 'import'
   AND status = 'extracting'
RETURNING id::text, status;`;

export const IMPORT_STATUS_SQL = `
-- $1 userId (token)  $2 id del intake
-- Estado de una importación, para que la pantalla espere la lectura. Solo quien importó o quien ve
-- todas. Una lectura que lleva más de 10 minutos en curso se da por fallida (el flujo se cortó).
WITH ${PERMS_CTE}
SELECT json_build_object(
         'intake_id', i.id::text,
         'status', CASE
                     WHEN i.status = 'order_created' AND o.id IS NOT NULL THEN 'done'
                     WHEN i.status = 'extracting' AND i.created_at > now() - interval '10 minutes' THEN 'processing'
                     ELSE 'failed'
                   END,
         'order_id', o.id::text,
         'order_number', o.order_number,
         'patient_name', o.patient_name,
         'items_total', (SELECT count(*) FROM public.study_order_items it
                          WHERE it.study_order_id = o.id AND it.is_cancelled = false),
         'review_pending', (SELECT count(*) FROM jsonb_array_elements(coalesce(o.review_items, '[]'::jsonb)) r
                             WHERE r ->> 'status' = 'pending'),
         'files', jsonb_array_length(i.media),
         'created_at', i.created_at) AS data
  FROM public.whatsapp_order_intakes i
  LEFT JOIN public.study_orders o ON o.id = i.study_order_id
 WHERE i.id = $2::uuid
   AND i.channel = 'import'
   AND (i.created_by = $1::uuid OR coalesce((SELECT can_view_all FROM perms), false));`;

// ── Chatter (migración 132) ──────────────────────────────────────────────────

/**
 * Permisos del chatter del sujeto del token. Leer el hilo sigue la misma regla que el detalle
 * (DETAIL_SQL); escribir y manejar seguidores pide además STUDY_ORDERS_MESSAGE.
 */
const CHATTER_PERMS_CTE = `
perms AS (
    SELECT coalesce(bool_or(p.code = 'STUDY_ORDERS_VIEW_ALL'), false) AS can_view_all,
           coalesce(bool_or(p.code = 'STUDY_ORDERS_MESSAGE'), false)  AS can_message,
           coalesce(bool_or(p.code = 'PATIENTS_VIEW_DETAIL'), false)  AS can_view_patient
      FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.role_id = ur.role_id
      JOIN public.permissions p       ON p.id = rp.permission_id
     WHERE ur.user_id = $1::uuid
       AND ur.is_active IS NOT FALSE
       AND p.code IN ('STUDY_ORDERS_VIEW_ALL', 'STUDY_ORDERS_MESSAGE', 'PATIENTS_VIEW_DETAIL')
)`;

/**
 * Quién puede seguir una orden: quien la puede abrir. Staff de la bandeja (STUDY_ORDERS_VIEW_ALL)
 * o el doctor derivador de esa orden; activos y sin el agente de WhatsApp. `doctorExpr` = el
 * doctor de la orden. Devuelve un CTE `cand(user_id)`.
 */
const followerCandidatesCte = (doctorExpr) => `
cand AS (
    SELECT DISTINCT c.user_id
      FROM (
            SELECT ur.user_id
              FROM public.user_roles ur
              JOIN public.role_permissions rp ON rp.role_id = ur.role_id
              JOIN public.permissions pp      ON pp.id = rp.permission_id
             WHERE pp.code = 'STUDY_ORDERS_VIEW_ALL'
               AND ur.is_active IS NOT FALSE
            UNION
            SELECT ${doctorExpr}
           ) c(user_id)
      JOIN public.users u ON u.id = c.user_id
     WHERE c.user_id IS NOT NULL
       AND u.is_active IS NOT FALSE
       AND NOT EXISTS (SELECT 1
                         FROM public.user_roles ur2
                         JOIN public.roles r ON r.id = ur2.role_id
                        WHERE ur2.user_id = c.user_id
                          AND lower(trim(r.name)) = 'agente_ia')
)`;

/** Seguidores de la orden `orderExpr`, en la forma que espera el front. */
const followersJson = (orderExpr) => `
coalesce((SELECT json_agg(json_build_object('id', u.id::text, 'name', u.name, 'email', u.email) ORDER BY u.name)
            FROM public.study_order_followers f
            JOIN public.users u ON u.id = f.user_id
           WHERE f.study_order_id = ${orderExpr}), '[]'::json)`;

/**
 * Adjuntos de un mensaje del chatter (`messageExpr` = su id), en la forma que espera el front. Viven
 * en public.attachments, como los originales de WhatsApp: el archivo se baja aparte, con
 * /study-orders/messages/file, que vuelve a validar el acceso.
 */
const messageAttachmentsJson = (messageExpr) => `
coalesce((SELECT json_agg(json_build_object('id', at.id::text, 'file_name', at.file_name, 'mime_type', at.mime_type) ORDER BY at.id)
            FROM public.attachments at
           WHERE at.source_name = 'study_order_message'
             AND at.source_id = ${messageExpr}::text), '[]'::json)`;

/**
 * El chatter de una orden: seguidores, mensajes (las notas solo con VIEW_ALL) y la bitácora, más
 * lo que el usuario puede hacer. Del más nuevo al más viejo, como lo pinta el panel.
 * Misma regla de acceso que DETAIL_SQL: sin acceso, cero filas (404).
 */
export const CHATTER_SQL = `
-- $1 userId (token)  $2 id de la orden
WITH ${CHATTER_PERMS_CTE},
ord AS (
    SELECT so.id, so.doctor_id
      FROM public.study_orders so
     WHERE so.id = $2::uuid
       AND (so.doctor_id = $1::uuid OR (SELECT can_view_all FROM perms)
            OR ((SELECT can_view_patient FROM perms) AND so.patient_id IS NOT NULL AND so.status <> 'draft'))
),
-- Escribir: el doctor de la orden o la clínica, con el permiso. Quien entra solo por la ficha
-- del paciente lee el hilo pero no participa.
me AS (
    SELECT coalesce((SELECT can_message FROM perms)
                    AND ((SELECT doctor_id FROM ord) = $1::uuid OR (SELECT can_view_all FROM perms)), false) AS can_write
)
SELECT json_build_object(
         'order_id',             o.id::text,
         'is_following',         EXISTS (SELECT 1 FROM public.study_order_followers f
                                          WHERE f.study_order_id = o.id AND f.user_id = $1::uuid),
         'can_post_message',     (SELECT can_write FROM me),
         -- La nota es interna de la clínica: ni la ve ni la escribe el derivador.
         'can_post_note',        (SELECT can_write FROM me) AND (SELECT can_view_all FROM perms),
         'can_manage_followers', (SELECT can_write FROM me) AND (SELECT can_view_all FROM perms),
         'followers',            ${followersJson('o.id')},
         'messages', coalesce((
             SELECT json_agg(json_build_object(
                      'id', m.id::text, 'kind', m.kind, 'body', m.body,
                      'author_id', m.author_id::text, 'author_name', au.name,
                      'created_at', m.created_at,
                      'attachments', ${messageAttachmentsJson('m.id')})
                    ORDER BY m.created_at DESC, m.id)
               FROM (SELECT * FROM public.study_order_messages sm
                      WHERE sm.study_order_id = o.id
                        AND (sm.kind = 'message' OR (SELECT can_view_all FROM perms))
                      ORDER BY sm.created_at DESC
                      LIMIT 500) m
               LEFT JOIN public.users au ON au.id = m.author_id
         ), '[]'::json),
         'events', coalesce((
             SELECT json_agg(json_build_object(
                      'id', ev.id::text, 'event_type', ev.event_type,
                      'actor_id', ev.actor_id::text, 'actor_kind', ev.actor_kind,
                      'actor_name', au.name,
                      'appointment_id', ev.appointment_id::text,
                      'metadata', ev.metadata, 'created_at', ev.created_at)
                    ORDER BY ev.created_at DESC, ev.id)
               FROM public.study_order_events ev
               LEFT JOIN public.users au ON au.id = ev.actor_id
              WHERE ev.study_order_id = o.id
         ), '[]'::json)
       ) AS data
  FROM ord o;`;

/**
 * Publica un mensaje o una nota. Quien escribe pasa a seguir la orden (como en Odoo).
 * $2 = { order_id, kind, body, attachment_count }, un solo JSON: el texto es libre y así no hay
 * array posicional que lo pueda partir. El texto puede venir vacío si el mensaje trae archivos
 * (`attachment_count` > 0): se suben después, con el id que devuelve esta consulta, y
 * MESSAGE_RESULT_SQL borra el mensaje si al final no quedó ni texto ni archivos.
 */
export const MESSAGE_POST_SQL = `
-- $1 userId (token)  $2 payload { order_id, kind, body, attachment_count }
WITH ${CHATTER_PERMS_CTE},
p AS (
    SELECT ($2::jsonb ->> 'order_id')::uuid AS order_id,
           $2::jsonb ->> 'kind'             AS kind,
           coalesce($2::jsonb ->> 'body', '') AS body,
           coalesce(($2::jsonb ->> 'attachment_count')::int, 0) AS attachment_count
),
ok AS (
    SELECT p.*
      FROM p
     WHERE (SELECT can_message FROM perms)
       AND p.kind IN ('message', 'note')
       AND (btrim(p.body) <> '' OR p.attachment_count > 0)
       AND length(btrim(p.body)) <= 5000
       -- La nota es interna de la clínica.
       AND (p.kind = 'message' OR (SELECT can_view_all FROM perms))
       AND EXISTS (SELECT 1 FROM public.study_orders so
                    WHERE so.id = p.order_id
                      AND (so.doctor_id = $1::uuid OR (SELECT can_view_all FROM perms)))
),
ins AS (
    INSERT INTO public.study_order_messages (study_order_id, author_id, kind, body, created_at)
    SELECT order_id, $1::uuid, kind, btrim(body), ${NOW}
      FROM ok
    RETURNING id, study_order_id, author_id, kind, body, created_at
),
fol AS (
    INSERT INTO public.study_order_followers (study_order_id, user_id, added_by, created_at)
    SELECT study_order_id, author_id, author_id, ${NOW}
      FROM ins
    ON CONFLICT (study_order_id, user_id) DO NOTHING
    RETURNING user_id
)
SELECT i.id::text,
       i.study_order_id::text AS order_id,
       i.kind,
       i.body,
       i.author_id::text,
       (SELECT u.name FROM public.users u WHERE u.id = $1::uuid) AS author_name,
       i.created_at,
       EXISTS (SELECT 1 FROM fol) AS started_following
  FROM ins i;`;

/**
 * Aviso a los seguidores de un mensaje nuevo. Las notas no avisan (como en Odoo) y quien
 * escribió no se avisa a sí mismo. Solo se avisa a quien HOY puede abrir la orden (su doctor o
 * la clínica): un seguidor que perdió el acceso (p. ej. el doctor anterior, si se cambió) sigue
 * en la lista pero no recibe el extracto. `attachment_count` deja que el front diga "2 adjuntos"
 * cuando el mensaje no tiene texto. `scope` le dice al front qué bandeja abrir: la de la clínica
 * o "Mis órdenes".
 *
 * RETURNING *: lo que devuelve este nodo es EXACTAMENTE lo que viaja por SSE al navegador (ver
 * NOTIFY_RECEPTION_SQL).
 */
export const NOTIFY_FOLLOWERS_SQL = `
-- $1 = id del mensaje
INSERT INTO public.notifications
       (user_id, type, status, priority, patient_id, metadata, created_at)
SELECT f.user_id,
       'study_order_message',
       'pending',
       'MEDIUM',
       so.patient_id,
       jsonb_build_object(
           'order_id',     so.id::text,
           'order_number', so.order_number,
           'source',       so.source,
           'patient_id',   so.patient_id::text,
           'patient_name', so.patient_name,
           'message_id',   m.id::text,
           'author_id',    m.author_id::text,
           'author_name',  au.name,
           'excerpt',      left(btrim(regexp_replace(m.body, '[[:space:]]+', ' ', 'g')), 200),
           'attachment_count', (SELECT count(*) FROM public.attachments at
                                 WHERE at.source_name = 'study_order_message'
                                   AND at.source_id = m.id::text),
           'scope',        CASE WHEN va.can_view_all THEN 'clinic' ELSE 'mine' END
       ),
       ${NOW}
  FROM public.study_order_messages m
  JOIN public.study_orders so          ON so.id = m.study_order_id
  JOIN public.study_order_followers f  ON f.study_order_id = m.study_order_id
  JOIN public.users u                  ON u.id = f.user_id
  LEFT JOIN public.users au            ON au.id = m.author_id
  CROSS JOIN LATERAL (
       SELECT EXISTS (SELECT 1
                        FROM public.user_roles ur
                        JOIN public.role_permissions rp ON rp.role_id = ur.role_id
                        JOIN public.permissions pp      ON pp.id = rp.permission_id
                       WHERE ur.user_id = f.user_id
                         AND ur.is_active IS NOT FALSE
                         AND pp.code = 'STUDY_ORDERS_VIEW_ALL') AS can_view_all
  ) va
 WHERE m.id = $1::uuid
   AND m.kind = 'message'
   AND f.user_id IS DISTINCT FROM m.author_id
   AND u.is_active IS NOT FALSE
   -- Misma regla que escribir en la orden: su doctor o la clínica.
   AND (f.user_id = so.doctor_id OR va.can_view_all)
RETURNING *;`;

/**
 * Cierre de /study-orders/messages/post, después de subir los archivos: el mensaje con sus
 * adjuntos tal como quedaron y cuántos no se pudieron guardar. Si el mensaje no tenía texto y no
 * se guardó ningún archivo, se borra (`deleted`): un mensaje vacío no sirve para nada.
 */
export const MESSAGE_RESULT_SQL = `
-- $1 id del mensaje  $2 cuántos archivos se mandaron
WITH att AS (
    SELECT count(*) AS stored
      FROM public.attachments at
     WHERE at.source_name = 'study_order_message'
       AND at.source_id = $1::text
),
del AS (
    DELETE FROM public.study_order_messages m
     WHERE m.id = $1::uuid
       AND btrim(m.body) = ''
       AND (SELECT stored FROM att) = 0
    RETURNING m.id
)
SELECT m.id::text,
       m.study_order_id::text AS order_id,
       m.kind,
       m.body,
       m.author_id::text,
       au.name AS author_name,
       m.created_at,
       ${messageAttachmentsJson('m.id')} AS attachments,
       greatest(coalesce($2::int, 0) - (SELECT stored FROM att), 0) AS failed_attachments,
       EXISTS (SELECT 1 FROM del) AS deleted
  FROM public.study_order_messages m
  LEFT JOIN public.users au ON au.id = m.author_id
 WHERE m.id = $1::uuid;`;

/**
 * Un adjunto del chatter, para bajarlo. Exige todo a la vez: que el archivo sea de ese mensaje,
 * que el usuario pueda leer el hilo de la orden (la regla de CHATTER_SQL) y, si es una nota,
 * STUDY_ORDERS_VIEW_ALL. Con el id de un adjunto de otro módulo no se baja nada.
 */
export const MESSAGE_FILE_SQL = `
-- $1 userId (token)  $2 id del mensaje  $3 id del adjunto
WITH ${CHATTER_PERMS_CTE}
SELECT a.drive_file_id, a.file_name, a.mime_type
  FROM public.attachments a
  JOIN public.study_order_messages m ON m.id = $2::uuid AND a.source_id = m.id::text
  JOIN public.study_orders so        ON so.id = m.study_order_id
 WHERE a.id = $3::int
   AND a.source_name = 'study_order_message'
   AND (m.kind = 'message' OR (SELECT can_view_all FROM perms))
   AND (so.doctor_id = $1::uuid OR (SELECT can_view_all FROM perms)
        OR ((SELECT can_view_patient FROM perms) AND so.patient_id IS NOT NULL AND so.status <> 'draft'));`;

/**
 * Seguir / dejar de seguir (uno mismo) y sumar / quitar a otro (solo la clínica, con VIEW_ALL).
 * A otro solo se lo puede sumar si puede abrir la orden (cand). Devuelve la lista resultante:
 * los CTE no ven lo que escriben los demás, así que se arma a mano (actuales − borrados + nuevos).
 */
export const FOLLOWERS_SQL = `
-- $1 userId (token)  $2 payload { order_id, action: follow|unfollow|add|remove, user_id }
WITH ${CHATTER_PERMS_CTE},
args AS (
    SELECT ($2::jsonb ->> 'order_id')::uuid AS order_id,
           $2::jsonb ->> 'action'           AS action,
           CASE WHEN $2::jsonb ->> 'action' IN ('follow', 'unfollow') THEN $1::uuid
                ELSE NULLIF($2::jsonb ->> 'user_id', '')::uuid END AS target
),
ord AS (
    SELECT so.id, so.doctor_id
      FROM public.study_orders so, args a
     WHERE so.id = a.order_id
       AND (so.doctor_id = $1::uuid OR (SELECT can_view_all FROM perms))
),
${followerCandidatesCte('(SELECT doctor_id FROM ord)')},
allowed AS (
    SELECT a.*
      FROM args a
     WHERE EXISTS (SELECT 1 FROM ord)
       AND (SELECT can_message FROM perms)
       AND a.target IS NOT NULL
       AND a.action IN ('follow', 'unfollow', 'add', 'remove')
       AND (a.action IN ('follow', 'unfollow') OR (SELECT can_view_all FROM perms))
       AND (a.action <> 'add' OR a.target IN (SELECT user_id FROM cand))
),
ins AS (
    INSERT INTO public.study_order_followers (study_order_id, user_id, added_by, created_at)
    SELECT order_id, target, $1::uuid, ${NOW}
      FROM allowed
     WHERE action IN ('follow', 'add')
    ON CONFLICT (study_order_id, user_id) DO NOTHING
    RETURNING user_id
),
del AS (
    DELETE FROM public.study_order_followers f
     USING allowed a
     WHERE a.action IN ('unfollow', 'remove')
       AND f.study_order_id = a.order_id
       AND f.user_id = a.target
    RETURNING f.user_id
),
cur AS (
    SELECT f.user_id
      FROM public.study_order_followers f, allowed a
     WHERE f.study_order_id = a.order_id
       AND NOT EXISTS (SELECT 1 FROM del WHERE del.user_id = f.user_id)
    UNION
    SELECT user_id FROM ins
)
SELECT (SELECT order_id::text FROM allowed) AS order_id,
       (SELECT action FROM allowed)         AS action,
       coalesce((SELECT json_agg(json_build_object('id', u.id::text, 'name', u.name, 'email', u.email) ORDER BY u.name)
                   FROM cur JOIN public.users u ON u.id = cur.user_id), '[]'::json) AS followers,
       EXISTS (SELECT 1 FROM cur WHERE cur.user_id = $1::uuid) AS is_following
 WHERE EXISTS (SELECT 1 FROM allowed);`;

/** A quién se puede sumar como seguidor de la orden (los que todavía no la siguen). Solo la clínica. */
export const FOLLOWER_CANDIDATES_SQL = `
-- $1 userId (token)  $2 id de la orden
WITH ${CHATTER_PERMS_CTE},
ord AS (
    SELECT so.id, so.doctor_id
      FROM public.study_orders so
     WHERE so.id = $2::uuid
       AND (SELECT can_view_all FROM perms)
       AND (SELECT can_message FROM perms)
),
${followerCandidatesCte('(SELECT doctor_id FROM ord)')}
SELECT coalesce(json_agg(json_build_object('id', u.id::text, 'name', u.name, 'email', u.email) ORDER BY u.name),
                '[]'::json) AS items
  FROM cand c
  JOIN public.users u ON u.id = c.user_id
 WHERE EXISTS (SELECT 1 FROM ord)
   AND NOT EXISTS (SELECT 1 FROM public.study_order_followers f
                    WHERE f.study_order_id = $2::uuid AND f.user_id = c.user_id);`;
