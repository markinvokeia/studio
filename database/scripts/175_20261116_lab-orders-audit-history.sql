-- =====================================================================
-- Órdenes de laboratorio — historial de cambios (auditoría)
-- Run on: dev / staging / prod
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- Requiere: 147–150, 167, 170, 172 y 173.
-- =====================================================================
--
-- El historial de ETAPAS ya existe (lab_order_stage_history). Faltaban las
-- EDICIONES de la orden y de sus servicios: laboratorio, doctor, paciente,
-- fecha de entrega, urgente, descripción, notas, piezas y servicios.
--
-- Sin tabla nueva: se reutiliza la auditoría genérica (audit_log +
-- log_changes_function), la misma que usan citas, facturas, órdenes de
-- estudio, etc. Así los cambios también se ven en Sistema → Auditoría.
--
-- 1. Trigger trg_audit_generic en lab_orders y lab_order_items.
--    El autor sale de updated_by/created_by de la fila (no se usa
--    set_config('app.current_user_id'): en una conexión del pool deja '' y
--    rompería el trigger en tablas sin columnas de autor, ver script 084).
--
-- 2. lab_order_items.created_by: quién guardó ese servicio. Es el autor de
--    los cambios de servicios cuando la orden en sí no cambió.
--
-- 3. lab_order_save reescribe los servicios SOLO si cambiaron. Antes los
--    borraba y volvía a insertar en cada guardado: con auditoría, cada
--    edición habría dejado altas y bajas idénticas.
--
-- 4. lab_order_changes(order_id): las ediciones agrupadas por guardado (todas
--    las filas de una transacción comparten changed_at), de la más nueva a la
--    más vieja:
--      [{ id, changed_at, changed_by, changed_by_name,
--         fields: [{ field, old, new }] }]
--    - field: columna de lab_orders ('laboratory_id', 'due_date', …) o
--      'items' (lista completa de servicios antes y después:
--      [{ service_name, quantity, teeth, notes }]).
--    - doctor/laboratorio/paciente llegan con el NOMBRE, no el uuid.
--    - No se listan: el alta (la cubre el historial de etapas), las columnas
--      de etapa (current_stage_id / stage_entered_at, también en el historial
--      de etapas), el borrado lógico ni las columnas técnicas.
--    - piezas (teeth) de la orden se omite cuando cambian los servicios: con
--      servicios es la unión de sus piezas, ya se ve en 'items'.
--    - Un cambio de etapa que fija laboratorio o fecha de entrega deja una
--      entrada con el mismo changed_at que la fila del historial de etapas:
--      el frontend la muestra dentro de ese movimiento.
--
-- 5. lab_order_detail suma la clave `changes` (= lab_order_changes). El flujo
--    "Lab Orders" devuelve el detalle tal cual: NO hace falta reimportarlo.
--
-- Solo se auditan los cambios desde que se aplica este script. El historial
-- de etapas anterior sigue completo.
--
-- Despliegue: este script → publicar el frontend. Sin el script el frontend
-- muestra solo el historial de etapas (como hasta ahora).
-- =====================================================================

BEGIN;

-- ─── 1 y 2. Auditoría y autor de los servicios ────────────────────────────────

ALTER TABLE public.lab_order_items ADD COLUMN IF NOT EXISTS created_by uuid;

DROP TRIGGER IF EXISTS trg_audit_generic ON public.lab_orders;
CREATE TRIGGER trg_audit_generic
    AFTER INSERT OR DELETE OR UPDATE ON public.lab_orders
    FOR EACH ROW EXECUTE FUNCTION public.log_changes_function('id');

DROP TRIGGER IF EXISTS trg_audit_generic ON public.lab_order_items;
CREATE TRIGGER trg_audit_generic
    AFTER INSERT OR DELETE OR UPDATE ON public.lab_order_items
    FOR EACH ROW EXECUTE FUNCTION public.log_changes_function('id');

-- Para buscar los servicios de una orden en audit_log sin recorrer todos.
CREATE INDEX IF NOT EXISTS idx_audit_log_lab_order_items
    ON public.audit_log (((COALESCE(new_value, old_value)::jsonb ->> 'lab_order_id')))
    WHERE table_name = 'lab_order_items';

-- ─── 3. lab_order_save: servicios solo si cambian ─────────────────────────────

CREATE OR REPLACE FUNCTION public.lab_order_save(p jsonb, p_user_id uuid)
 RETURNS SETOF v_lab_orders
 LANGUAGE plpgsql
AS $function$
#variable_conflict use_column
DECLARE
    v_id         integer := NULLIF(p->>'id', '')::integer;
    v_patient    uuid := NULLIF(p->>'patient_id', '')::uuid;
    v_work       text := NULLIF(btrim(p->>'work_description'), '');
    v_has_items  boolean := jsonb_typeof(p->'items') = 'array';
    v_items      jsonb := CASE WHEN jsonb_typeof(p->'items') = 'array' THEN p->'items' ELSE '[]'::jsonb END;
    v_item       jsonb;
    v_item_teeth smallint[];
    v_qty        integer;
    v_teeth      smallint[];
    v_initial    integer;
    v_pos        integer := 0;
    v_item_count integer;
    v_stage_kind text;
    v_due        date;
    v_items_changed boolean := false;
BEGIN
    IF v_patient IS NULL THEN RAISE EXCEPTION 'LAB_ORDERS:MISSING_PATIENT'; END IF;

    -- Servicios que tendrá la orden: los que llegan o, sin la clave, los guardados.
    IF v_has_items THEN
        v_item_count := jsonb_array_length(v_items);
    ELSE
        SELECT count(*) INTO v_item_count FROM public.lab_order_items i WHERE i.lab_order_id = v_id;
    END IF;
    IF v_work IS NULL AND v_item_count = 0 THEN RAISE EXCEPTION 'LAB_ORDERS:MISSING_WORK'; END IF;

    v_teeth := public.lab_order_teeth_from_json(p->'teeth');

    FOR v_item IN SELECT value FROM jsonb_array_elements(v_items) LOOP
        IF NOT EXISTS (SELECT 1 FROM public.service_catalog sc WHERE sc.id = NULLIF(v_item->>'service_id', '')::integer) THEN
            RAISE EXCEPTION 'LAB_ORDERS:INVALID_SERVICE';
        END IF;
        v_qty := COALESCE(NULLIF(v_item->>'quantity', '')::integer, 1);
        IF v_qty NOT BETWEEN 1 AND 99 THEN RAISE EXCEPTION 'LAB_ORDERS:INVALID_QUANTITY'; END IF;
        v_item_teeth := public.lab_order_teeth_from_json(v_item->'teeth');
        IF NOT public.lab_order_valid_teeth(v_item_teeth) THEN RAISE EXCEPTION 'LAB_ORDERS:INVALID_TEETH'; END IF;
    END LOOP;

    -- Con servicios, las piezas de la orden son la unión de las de sus servicios.
    IF v_has_items AND jsonb_array_length(v_items) > 0 THEN
        SELECT COALESCE(array_agg(DISTINCT t ORDER BY t), '{}') INTO v_teeth
        FROM jsonb_array_elements(v_items) e
        CROSS JOIN LATERAL unnest(public.lab_order_teeth_from_json(e.value->'teeth')) AS t;
    END IF;

    IF NOT public.lab_order_valid_teeth(v_teeth) THEN RAISE EXCEPTION 'LAB_ORDERS:INVALID_TEETH'; END IF;

    IF v_id IS NULL THEN
        SELECT s.id INTO v_initial
        FROM public.lab_stages s
        WHERE s.kind = 'initial' AND s.is_active
        LIMIT 1;
        IF v_initial IS NULL THEN RAISE EXCEPTION 'LAB_ORDERS:NO_INITIAL_STAGE'; END IF;

        -- Sin due_date: se fija al enviar la orden (lab_order_change_stage).
        INSERT INTO public.lab_orders (
            patient_id, doctor_id, laboratory_id, work_description, teeth, notes, is_urgent,
            current_stage_id, stage_entered_at, created_by, updated_by)
        VALUES (
            v_patient, NULLIF(p->>'doctor_id', '')::uuid, NULLIF(p->>'laboratory_id', '')::uuid, v_work,
            v_teeth, NULLIF(btrim(p->>'notes'), ''),
            COALESCE(NULLIF(p->>'is_urgent', '')::boolean, false),
            v_initial, now(), p_user_id, p_user_id)
        RETURNING id INTO v_id;

        INSERT INTO public.lab_order_stage_history (lab_order_id, from_stage_id, to_stage_id, changed_by)
        VALUES (v_id, NULL, v_initial, p_user_id);
    ELSE
        SELECT s.kind, o.due_date INTO v_stage_kind, v_due
        FROM public.lab_orders o
        JOIN public.lab_stages s ON s.id = o.current_stage_id
        WHERE o.id = v_id AND NOT o.is_deleted
        FOR UPDATE OF o;
        IF NOT FOUND THEN RAISE EXCEPTION 'LAB_ORDERS:NOT_FOUND'; END IF;

        IF p ? 'due_date' THEN
            v_due := NULLIF(p->>'due_date', '')::date;
        END IF;
        -- Ya enviada y pendiente: la fecha de entrega no se puede quitar.
        IF v_stage_kind = 'intermediate' AND v_due IS NULL THEN
            RAISE EXCEPTION 'LAB_ORDERS:DUE_DATE_REQUIRED';
        END IF;

        UPDATE public.lab_orders o
        SET patient_id = v_patient,
            doctor_id = NULLIF(p->>'doctor_id', '')::uuid,
            laboratory_id = NULLIF(p->>'laboratory_id', '')::uuid,
            work_description = v_work,
            teeth = CASE WHEN v_has_items OR p ? 'teeth' THEN v_teeth ELSE o.teeth END,
            due_date = v_due,
            notes = NULLIF(btrim(p->>'notes'), ''),
            -- Sin la clave queda como estaba (clientes viejos no la mandan).
            is_urgent = CASE WHEN p ? 'is_urgent'
                             THEN COALESCE(NULLIF(p->>'is_urgent', '')::boolean, false)
                             ELSE o.is_urgent END,
            updated_at = now(),
            updated_by = p_user_id
        WHERE o.id = v_id AND NOT o.is_deleted;
    END IF;

    -- Los servicios se reescriben solo si cambiaron (servicio, cantidad, piezas,
    -- nota u orden): si no, cada guardado dejaría en la auditoría bajas y altas iguales.
    IF v_has_items THEN
        SELECT (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                       's', i.service_id, 'q', i.quantity, 't', to_jsonb(i.teeth), 'n', i.notes)
                       ORDER BY i.sort_order, i.id), '[]'::jsonb)
            FROM public.lab_order_items i
            WHERE i.lab_order_id = v_id
        ) IS DISTINCT FROM (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                       's', NULLIF(e.value->>'service_id', '')::integer,
                       'q', COALESCE(NULLIF(e.value->>'quantity', '')::integer, 1),
                       't', to_jsonb(public.lab_order_teeth_from_json(e.value->'teeth')),
                       'n', NULLIF(btrim(e.value->>'notes'), ''))
                       ORDER BY e.ord), '[]'::jsonb)
            FROM jsonb_array_elements(v_items) WITH ORDINALITY AS e(value, ord)
        )
        INTO v_items_changed;
    END IF;

    IF v_items_changed THEN
        DELETE FROM public.lab_order_items i WHERE i.lab_order_id = v_id;
        FOR v_item IN SELECT value FROM jsonb_array_elements(v_items) LOOP
            v_pos := v_pos + 1;
            INSERT INTO public.lab_order_items (lab_order_id, service_id, service_name, quantity, teeth, notes, sort_order, created_by)
            SELECT v_id, sc.id, sc.name,
                   COALESCE(NULLIF(v_item->>'quantity', '')::integer, 1),
                   public.lab_order_teeth_from_json(v_item->'teeth'),
                   NULLIF(btrim(v_item->>'notes'), ''),
                   v_pos,
                   p_user_id
            FROM public.service_catalog sc
            WHERE sc.id = (v_item->>'service_id')::integer;
        END LOOP;
    END IF;

    RETURN QUERY SELECT * FROM public.v_lab_orders v WHERE v.id = v_id;
END;
$function$;

-- ─── 4. lab_order_changes ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.lab_order_changes(p_order_id integer)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
    WITH a AS (
        -- audit_log.changed_at es CURRENT_TIMESTAMP (inicio de la transacción) guardado
        -- sin zona en la zona de la sesión: se vuelve a timestamptz con esa misma zona.
        SELECT al.id, al.table_name, al.operation, al.changed_by,
               al.changed_at AT TIME ZONE current_setting('TimeZone') AS at,
               al.old_value::jsonb AS old_v,
               al.new_value::jsonb AS new_v
        FROM public.audit_log al
        WHERE al.table_name = 'lab_orders'
          AND al.record_id = jsonb_build_object('id', p_order_id)::text
        UNION ALL
        SELECT al.id, al.table_name, al.operation, al.changed_by,
               al.changed_at AT TIME ZONE current_setting('TimeZone'),
               al.old_value::jsonb,
               al.new_value::jsonb
        FROM public.audit_log al
        WHERE al.table_name = 'lab_order_items'
          AND (COALESCE(al.new_value, al.old_value)::jsonb ->> 'lab_order_id') = p_order_id::text
    ),
    grp AS (
        SELECT a.at,
               min(a.id) AS id,
               bool_or(a.table_name = 'lab_orders' AND a.operation = 'INSERT') AS is_create,
               -- Autor: el de la orden; si la orden no cambió, el de los servicios nuevos.
               -- (Una baja guarda al autor anterior del servicio: no sirve.)
               (array_agg(a.changed_by ORDER BY (a.table_name = 'lab_orders') DESC, a.id)
                    FILTER (WHERE a.changed_by IS NOT NULL
                              AND (a.table_name = 'lab_orders' OR a.operation = 'INSERT')))[1] AS changed_by
        FROM a
        GROUP BY a.at
    ),
    order_fields AS (
        SELECT a.at, kv.key AS field,
               (array_agg(kv.value ORDER BY a.id))[1] AS old_value,
               (array_agg(a.new_v -> kv.key ORDER BY a.id DESC))[1] AS new_value
        FROM a
        CROSS JOIN LATERAL jsonb_each(a.old_v) kv
        WHERE a.table_name = 'lab_orders'
          AND a.operation = 'UPDATE'
          AND kv.key NOT IN ('id', 'current_stage_id', 'stage_entered_at', 'is_deleted',
                             'created_at', 'created_by', 'updated_at', 'updated_by')
        GROUP BY a.at, kv.key
    ),
    item_lists AS (
        SELECT a.at,
               COALESCE(jsonb_agg(jsonb_build_object(
                            'service_name', a.old_v->>'service_name',
                            'quantity', COALESCE((a.old_v->>'quantity')::integer, 1),
                            'teeth', COALESCE(a.old_v->'teeth', '[]'::jsonb),
                            'notes', a.old_v->'notes')
                            ORDER BY (a.old_v->>'sort_order')::integer, a.id)
                        FILTER (WHERE a.operation = 'DELETE'), '[]'::jsonb) AS old_items,
               COALESCE(jsonb_agg(jsonb_build_object(
                            'service_name', a.new_v->>'service_name',
                            'quantity', COALESCE((a.new_v->>'quantity')::integer, 1),
                            'teeth', COALESCE(a.new_v->'teeth', '[]'::jsonb),
                            'notes', a.new_v->'notes')
                            ORDER BY (a.new_v->>'sort_order')::integer, a.id)
                        FILTER (WHERE a.operation = 'INSERT'), '[]'::jsonb) AS new_items
        FROM a
        WHERE a.table_name = 'lab_order_items'
          AND a.operation IN ('INSERT', 'DELETE')
        GROUP BY a.at
    ),
    fields AS (
        SELECT f.at, f.field, f.old_value, f.new_value
        FROM order_fields f
        WHERE NOT (f.field = 'teeth' AND EXISTS (
            SELECT 1 FROM item_lists il WHERE il.at = f.at AND il.old_items IS DISTINCT FROM il.new_items))
        UNION ALL
        SELECT il.at, 'items', il.old_items, il.new_items
        FROM item_lists il
        WHERE il.old_items IS DISTINCT FROM il.new_items
    ),
    named AS (
        -- Personas (doctor, laboratorio, paciente): el nombre en vez del uuid.
        SELECT f.at, f.field,
               CASE WHEN f.field IN ('doctor_id', 'laboratory_id', 'patient_id')
                    THEN (SELECT to_jsonb(u.name) FROM public.users u WHERE u.id::text = f.old_value #>> '{}')
                    ELSE f.old_value END AS old_value,
               CASE WHEN f.field IN ('doctor_id', 'laboratory_id', 'patient_id')
                    THEN (SELECT to_jsonb(u.name) FROM public.users u WHERE u.id::text = f.new_value #>> '{}')
                    ELSE f.new_value END AS new_value
        FROM fields f
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'id', g.id,
               'changed_at', g.at,
               'changed_by', g.changed_by,
               'changed_by_name', u.name,
               'fields', x.fields)
               ORDER BY g.at DESC, g.id DESC), '[]'::jsonb)
    FROM grp g
    CROSS JOIN LATERAL (
        SELECT jsonb_agg(jsonb_build_object('field', n.field, 'old', n.old_value, 'new', n.new_value)
                   ORDER BY COALESCE(array_position(ARRAY[
                       'patient_id', 'doctor_id', 'laboratory_id', 'items', 'work_description',
                       'teeth', 'due_date', 'is_urgent', 'notes'], n.field), 100), n.field) AS fields
        FROM named n
        WHERE n.at = g.at
    ) x
    LEFT JOIN public.users u ON u.id = g.changed_by
    WHERE NOT g.is_create
      AND x.fields IS NOT NULL;
$function$;

-- ─── 5. lab_order_detail + changes ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.lab_order_detail(p_order_id integer)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
    SELECT to_jsonb(v) || jsonb_build_object(
        'history', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                       'id', h.id,
                       'from_stage_id', h.from_stage_id,
                       'from_stage_name', fs.name,
                       'from_stage_color', fs.color,
                       'to_stage_id', h.to_stage_id,
                       'to_stage_name', ts.name,
                       'to_stage_color', ts.color,
                       'changed_by', h.changed_by,
                       'changed_by_name', u.name,
                       'changed_at', h.changed_at,
                       'note', h.note
                   ) ORDER BY h.changed_at DESC, h.id DESC)
            FROM public.lab_order_stage_history h
            LEFT JOIN public.lab_stages fs ON fs.id = h.from_stage_id
            JOIN public.lab_stages ts ON ts.id = h.to_stage_id
            LEFT JOIN public.users u ON u.id = h.changed_by
            WHERE h.lab_order_id = v.id
        ), '[]'::jsonb),
        'changes', public.lab_order_changes(v.id),
        'attachments', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                       'id', a.id,
                       'file_name', a.file_name,
                       'mime_type', a.mime_type,
                       'web_view_link', a.web_view_link,
                       'thumbnail_link', a.thumbnail_link,
                       'created_at', a.created_at
                   ) ORDER BY a.created_at, a.id)
            FROM public.attachments a
            WHERE a.source_name = 'lab_order' AND a.source_id = v.id::text
        ), '[]'::jsonb),
        'laboratory', (
            SELECT jsonb_build_object(
                       'id', l.id,
                       'name', l.name,
                       'phone_number', NULLIF(btrim(l.phone_number), ''),
                       'alternative_phone', NULLIF(btrim(l.alternative_phone), ''),
                       'email', NULLIF(btrim(l.email), ''),
                       'address', NULLIF(btrim(l.address), ''),
                       'rut', NULLIF(btrim(l.rut), ''),
                       'categories', COALESCE((
                           SELECT jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name) ORDER BY lower(g.name))
                           FROM public.group_provider gp
                           JOIN public.groups_prov g
                             ON g.id = gp.group_id AND g.is_lab_category AND COALESCE(g.is_active, true)
                           WHERE gp.provider_id = l.id
                       ), '[]'::jsonb)
                   )
            FROM public.users l
            WHERE l.id = v.laboratory_id
        ))
    FROM public.v_lab_orders v
    WHERE v.id = p_order_id;
$function$;

-- ─── Registro de migración ────────────────────────────────────────────────────

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '175_20261116_lab-orders-audit-history.sql',
    'v1',
    'Historial de cambios de órdenes de laboratorio: trigger de auditoría genérica en lab_orders y lab_order_items, lab_order_items.created_by, lab_order_save reescribe servicios solo si cambian, lab_order_changes(order) y clave changes en lab_order_detail'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;
