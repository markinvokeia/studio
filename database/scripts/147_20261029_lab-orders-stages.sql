-- =====================================================================
-- Órdenes de laboratorio — fase 1: etapas configurables + permisos
-- Run on: dev / staging / prod
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- =====================================================================
--
-- Contexto:
--   La clínica envía trabajos a laboratorios externos (prótesis, coronas,
--   alineadores, placas…) y no había ningún registro de esos envíos. Este
--   módulo registra cada orden y la etapa en la que está. Es el circuito de
--   la clínica QUE SOLICITA; no tiene relación con /studies ni con las
--   órdenes de estudio (clínica receptora).
--
-- Cambios:
--   1. lab_stages: etapas del circuito, configurables por la clínica.
--        kind          'initial' (exactamente una activa: ahí entra toda
--                      orden nueva) | 'intermediate' | 'final' (al menos
--                      una activa; una orden ahí ya no está pendiente).
--        overdue_days  días en la etapa a partir de los cuales la orden
--                      está atrasada. NULL = sin umbral. Nunca en finales.
--   2. lab_orders: núcleo de la orden (lo que no depende de los campos que
--      se definan en la fase 2). current_stage_id + stage_entered_at se
--      guardan en la orden para que tablero y lista no recorran el
--      historial; se actualizan en la misma transacción que el historial.
--   3. lab_order_stage_history: cada cambio de etapa (origen, destino,
--      usuario, fecha). Es la fuente de verdad de la trazabilidad. El alta
--      de la orden queda como una fila con from_stage_id NULL.
--   4. lab_stages_save(p_stages, p_user_id): guarda la configuración
--      completa en una sola transacción y la valida. La pantalla manda
--      siempre todas las etapas, en el orden en que se ven.
--   5. Las 3 etapas precargadas (si la tabla está vacía).
--   6. Permisos LAB_ORDERS_* y LAB_STAGES_CONFIG, por nombre de rol.
--
-- Errores de lab_stages_save: RAISE con el mensaje 'LAB_STAGES:<CODIGO>'
-- (y un detalle después de '|'). El flujo de n8n lo convierte en
-- { success: false, code, detail } y el frontend traduce el código.
--   NO_INITIAL / MANY_INITIAL / NO_FINAL / EMPTY_NAME / DUPLICATE_NAME /
--   INVALID_KIND / INVALID_OVERDUE / INITIAL_INACTIVE / UNKNOWN_STAGE /
--   STAGE_IN_USE (se quiso borrar una etapa con órdenes o historial) /
--   STAGE_HAS_ORDERS (se desactiva una etapa con órdenes y no se dijo a
--   qué etapa moverlas) / INVALID_MOVE_TARGET.
--
-- Etapas precargadas: los nombres van en español (iguales en es y es-ES).
-- Para una clínica en inglés, ejecutar después el bloque opcional del final.
--
-- Despliegue: aplicar ESTE script antes de importar el flujo
-- "Lab Stages" (docs/n8n-flows/flow-lab-stages.json).
-- =====================================================================

BEGIN;

-- ─── 1. Etapas ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.lab_stages (
    id            serial PRIMARY KEY,
    name          text        NOT NULL,
    color         text        NOT NULL DEFAULT '#64748b',
    sort_order    integer     NOT NULL DEFAULT 0,
    kind          text        NOT NULL DEFAULT 'intermediate',
    overdue_days  integer,
    is_active     boolean     NOT NULL DEFAULT true,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    created_by    uuid,
    updated_by    uuid,
    CONSTRAINT lab_stages_kind_chk CHECK (kind IN ('initial', 'intermediate', 'final')),
    CONSTRAINT lab_stages_overdue_chk CHECK (overdue_days IS NULL OR overdue_days > 0),
    -- Una orden en etapa final nunca está atrasada.
    CONSTRAINT lab_stages_final_no_overdue_chk CHECK (kind <> 'final' OR overdue_days IS NULL)
);

COMMENT ON TABLE public.lab_stages IS
    'Etapas del circuito de órdenes de laboratorio, configurables por la clínica (Configuración → Etapas de laboratorio).';
COMMENT ON COLUMN public.lab_stages.overdue_days IS
    'Días en la etapa a partir de los cuales la orden se marca atrasada. NULL = sin umbral; siempre NULL en etapas finales.';

-- Exactamente una inicial activa (el "al menos una" lo valida lab_stages_save).
CREATE UNIQUE INDEX IF NOT EXISTS lab_stages_one_initial_uidx
    ON public.lab_stages ((true))
    WHERE kind = 'initial' AND is_active;

CREATE UNIQUE INDEX IF NOT EXISTS lab_stages_active_name_uidx
    ON public.lab_stages (lower(btrim(name)))
    WHERE is_active;

-- ─── 2. Órdenes (núcleo) ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.lab_orders (
    id                serial PRIMARY KEY,
    patient_id        uuid        NOT NULL REFERENCES public.users(id),
    doctor_id         uuid        REFERENCES public.users(id),
    -- Laboratorio = proveedor (users) del grupo de proveedores "Laboratorio".
    laboratory_id     uuid        REFERENCES public.users(id),
    work_description  text        NOT NULL,
    current_stage_id  integer     NOT NULL REFERENCES public.lab_stages(id),
    stage_entered_at  timestamptz NOT NULL DEFAULT now(),
    is_deleted        boolean     NOT NULL DEFAULT false,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    created_by        uuid        REFERENCES public.users(id),
    updated_by        uuid        REFERENCES public.users(id)
);

COMMENT ON TABLE public.lab_orders IS
    'Trabajos enviados a laboratorios externos. current_stage_id/stage_entered_at replican la última fila de lab_order_stage_history.';

CREATE INDEX IF NOT EXISTS lab_orders_stage_idx
    ON public.lab_orders (current_stage_id, stage_entered_at)
    WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS lab_orders_patient_idx
    ON public.lab_orders (patient_id)
    WHERE NOT is_deleted;

-- ─── 3. Historial de etapas ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.lab_order_stage_history (
    id             serial PRIMARY KEY,
    lab_order_id   integer     NOT NULL REFERENCES public.lab_orders(id) ON DELETE CASCADE,
    from_stage_id  integer     REFERENCES public.lab_stages(id),
    to_stage_id    integer     NOT NULL REFERENCES public.lab_stages(id),
    changed_by     uuid        REFERENCES public.users(id),
    changed_at     timestamptz NOT NULL DEFAULT now(),
    note           text
);

CREATE INDEX IF NOT EXISTS lab_order_stage_history_order_idx
    ON public.lab_order_stage_history (lab_order_id, changed_at);
CREATE INDEX IF NOT EXISTS lab_order_stage_history_to_idx
    ON public.lab_order_stage_history (to_stage_id);
CREATE INDEX IF NOT EXISTS lab_order_stage_history_from_idx
    ON public.lab_order_stage_history (from_stage_id);

-- ─── 4. Guardar la configuración completa ────────────────────────────────────
--
-- p_stages: arreglo en el orden de la pantalla (sort_order = posición):
--   [{ "id": 3 | null, "name": "...", "color": "#hex", "kind": "...",
--      "overdue_days": 7 | null, "is_active": true,
--      "move_orders_to": 5 | null }]
-- Una etapa existente que no viene en el arreglo se borra, salvo que tenga
-- órdenes o historial (STAGE_IN_USE: hay que desactivarla).
-- Al desactivar una etapa con órdenes, "move_orders_to" dice a qué etapa
-- activa pasan (queda registrado en el historial).
-- Devuelve las etapas resultantes con in_use / orders_count.

CREATE OR REPLACE FUNCTION public.lab_stages_save(p_stages jsonb, p_user_id uuid)
RETURNS TABLE (
    id integer, name text, color text, sort_order integer, kind text,
    overdue_days integer, is_active boolean, orders_count integer, in_use boolean
)
LANGUAGE plpgsql
AS $$
#variable_conflict use_column
DECLARE
    v_item       jsonb;
    v_pos        integer := 0;
    v_id         integer;
    v_name       text;
    v_kind       text;
    v_overdue    integer;
    v_active     boolean;
    v_move_to    integer;
    v_kept       integer[] := ARRAY[]::integer[];
    v_moves      jsonb := '[]'::jsonb;
    v_move       jsonb;
    v_orders     integer;
    v_count      integer;
BEGIN
    IF p_stages IS NULL OR jsonb_typeof(p_stages) <> 'array' THEN
        RAISE EXCEPTION 'LAB_STAGES:NO_INITIAL';
    END IF;

    -- Validaciones de forma, antes de tocar nada.
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_stages) LOOP
        v_name := btrim(COALESCE(v_item->>'name', ''));
        v_kind := COALESCE(v_item->>'kind', '');
        v_overdue := NULLIF(v_item->>'overdue_days', '')::integer;
        IF v_name = '' THEN
            RAISE EXCEPTION 'LAB_STAGES:EMPTY_NAME';
        END IF;
        IF v_kind NOT IN ('initial', 'intermediate', 'final') THEN
            RAISE EXCEPTION 'LAB_STAGES:INVALID_KIND|%', v_name;
        END IF;
        IF v_overdue IS NOT NULL AND (v_overdue <= 0 OR v_kind = 'final') THEN
            RAISE EXCEPTION 'LAB_STAGES:INVALID_OVERDUE|%', v_name;
        END IF;
        IF v_kind = 'initial' AND NOT COALESCE((v_item->>'is_active')::boolean, true) THEN
            RAISE EXCEPTION 'LAB_STAGES:INITIAL_INACTIVE|%', v_name;
        END IF;
        IF NULLIF(v_item->>'id', '') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM public.lab_stages s WHERE s.id = (v_item->>'id')::integer) THEN
            RAISE EXCEPTION 'LAB_STAGES:UNKNOWN_STAGE|%', v_name;
        END IF;
    END LOOP;

    SELECT count(*) INTO v_count
    FROM jsonb_array_elements(p_stages) e
    WHERE e.value->>'kind' = 'initial' AND COALESCE((e.value->>'is_active')::boolean, true);
    IF v_count = 0 THEN RAISE EXCEPTION 'LAB_STAGES:NO_INITIAL'; END IF;
    IF v_count > 1 THEN RAISE EXCEPTION 'LAB_STAGES:MANY_INITIAL'; END IF;

    SELECT count(*) INTO v_count
    FROM jsonb_array_elements(p_stages) e
    WHERE e.value->>'kind' = 'final' AND COALESCE((e.value->>'is_active')::boolean, true);
    IF v_count = 0 THEN RAISE EXCEPTION 'LAB_STAGES:NO_FINAL'; END IF;

    SELECT min(btrim(e.value->>'name')) INTO v_name
    FROM jsonb_array_elements(p_stages) e
    WHERE COALESCE((e.value->>'is_active')::boolean, true)
    GROUP BY lower(btrim(e.value->>'name'))
    HAVING count(*) > 1
    LIMIT 1;
    IF v_name IS NOT NULL THEN RAISE EXCEPTION 'LAB_STAGES:DUPLICATE_NAME|%', v_name; END IF;

    -- Las etapas que se quitan: solo se borran si nunca se usaron.
    SELECT s.name INTO v_name
    FROM public.lab_stages s
    WHERE s.id NOT IN (
        SELECT (e.value->>'id')::integer FROM jsonb_array_elements(p_stages) e
        WHERE NULLIF(e.value->>'id', '') IS NOT NULL
    )
      AND (EXISTS (SELECT 1 FROM public.lab_orders o WHERE o.current_stage_id = s.id)
           OR EXISTS (SELECT 1 FROM public.lab_order_stage_history h
                      WHERE h.to_stage_id = s.id OR h.from_stage_id = s.id))
    LIMIT 1;
    IF v_name IS NOT NULL THEN RAISE EXCEPTION 'LAB_STAGES:STAGE_IN_USE|%', v_name; END IF;

    -- Liberar los índices únicos parciales mientras se reescribe: el orden de
    -- las filas del UPDATE no está garantizado (p. ej. cambiar cuál es la inicial).
    UPDATE public.lab_stages s SET is_active = false
    WHERE s.is_active;

    FOR v_item IN SELECT value FROM jsonb_array_elements(p_stages) LOOP
        v_pos := v_pos + 1;
        v_id := NULLIF(v_item->>'id', '')::integer;
        v_name := btrim(v_item->>'name');
        v_kind := v_item->>'kind';
        v_overdue := NULLIF(v_item->>'overdue_days', '')::integer;
        v_active := COALESCE((v_item->>'is_active')::boolean, true);
        v_move_to := NULLIF(v_item->>'move_orders_to', '')::integer;

        IF v_id IS NULL THEN
            INSERT INTO public.lab_stages (name, color, sort_order, kind, overdue_days, is_active, created_by, updated_by)
            VALUES (v_name, COALESCE(NULLIF(v_item->>'color', ''), '#64748b'), v_pos, v_kind, v_overdue, v_active, p_user_id, p_user_id)
            RETURNING lab_stages.id INTO v_id;
        ELSE
            UPDATE public.lab_stages s
            SET name = v_name,
                color = COALESCE(NULLIF(v_item->>'color', ''), s.color),
                sort_order = v_pos,
                kind = v_kind,
                overdue_days = v_overdue,
                is_active = v_active,
                updated_at = now(),
                updated_by = p_user_id
            WHERE s.id = v_id;
        END IF;
        v_kept := v_kept || v_id;

        IF NOT v_active THEN
            SELECT count(*) INTO v_orders
            FROM public.lab_orders o
            WHERE o.current_stage_id = v_id AND NOT o.is_deleted;
            IF v_orders > 0 THEN
                IF v_move_to IS NULL THEN
                    RAISE EXCEPTION 'LAB_STAGES:STAGE_HAS_ORDERS|%', v_name;
                END IF;
                v_moves := v_moves || jsonb_build_object('from', v_id, 'to', v_move_to, 'name', v_name);
            END IF;
        END IF;
    END LOOP;

    DELETE FROM public.lab_stages s WHERE NOT (s.id = ANY (v_kept));

    -- Mover órdenes de etapas desactivadas (el destino tiene que quedar activo).
    FOR v_move IN SELECT value FROM jsonb_array_elements(v_moves) LOOP
        IF NOT EXISTS (SELECT 1 FROM public.lab_stages s
                       WHERE s.id = (v_move->>'to')::integer AND s.is_active) THEN
            RAISE EXCEPTION 'LAB_STAGES:INVALID_MOVE_TARGET|%', v_move->>'name';
        END IF;

        INSERT INTO public.lab_order_stage_history (lab_order_id, from_stage_id, to_stage_id, changed_by, note)
        SELECT o.id, o.current_stage_id, (v_move->>'to')::integer, p_user_id, 'stage_deactivated'
        FROM public.lab_orders o
        WHERE o.current_stage_id = (v_move->>'from')::integer AND NOT o.is_deleted;

        UPDATE public.lab_orders o
        SET current_stage_id = (v_move->>'to')::integer,
            stage_entered_at = now(),
            updated_at = now(),
            updated_by = p_user_id
        WHERE o.current_stage_id = (v_move->>'from')::integer AND NOT o.is_deleted;
    END LOOP;

    RETURN QUERY SELECT * FROM public.lab_stages_list();
END;
$$;

-- Lectura: todas las etapas (activas e inactivas) en orden, con su uso.
-- in_use = tiene órdenes o aparece en el historial → no se puede borrar.
CREATE OR REPLACE FUNCTION public.lab_stages_list()
RETURNS TABLE (
    id integer, name text, color text, sort_order integer, kind text,
    overdue_days integer, is_active boolean, orders_count integer, in_use boolean
)
LANGUAGE sql
STABLE
AS $$
    SELECT s.id, s.name, s.color, s.sort_order, s.kind, s.overdue_days, s.is_active,
           COALESCE(oc.n, 0)::integer AS orders_count,
           (COALESCE(oc.n, 0) > 0
            OR EXISTS (SELECT 1 FROM public.lab_order_stage_history h
                       WHERE h.to_stage_id = s.id OR h.from_stage_id = s.id)) AS in_use
    FROM public.lab_stages s
    LEFT JOIN (
        SELECT o.current_stage_id, count(*) AS n
        FROM public.lab_orders o
        WHERE NOT o.is_deleted
        GROUP BY o.current_stage_id
    ) oc ON oc.current_stage_id = s.id
    ORDER BY s.is_active DESC, s.sort_order, s.id;
$$;

-- ─── 5. Etapas precargadas ───────────────────────────────────────────────────

INSERT INTO public.lab_stages (name, color, sort_order, kind, overdue_days)
SELECT v.name, v.color, v.sort_order, v.kind, v.overdue_days
FROM (VALUES
    ('Solicitud creada / Toma de impresión', '#0ea5e9', 1, 'initial',      NULL::integer),
    ('Enviado al laboratorio / En progreso', '#f59e0b', 2, 'intermediate', 7),
    ('Completado',                           '#10b981', 3, 'final',        NULL::integer)
) AS v(name, color, sort_order, kind, overdue_days)
WHERE NOT EXISTS (SELECT 1 FROM public.lab_stages);

-- ─── 6. Permisos ─────────────────────────────────────────────────────────────

INSERT INTO public.permissions (name, description, code, module, submenu, permission_type)
VALUES
    ('Ver menú Órdenes de laboratorio', 'Ver el ítem de menú Órdenes de laboratorio',
     'LAB_ORDERS_VIEW_MENU', 'lab_orders', 'lab_orders', 'view'),
    ('Ver órdenes de laboratorio', 'Ver el tablero, la lista y el detalle de las órdenes de laboratorio (también en la ficha del paciente)',
     'LAB_ORDERS_VIEW', 'lab_orders', 'lab_orders', 'view'),
    ('Crear órdenes de laboratorio', 'Registrar órdenes de laboratorio',
     'LAB_ORDERS_CREATE', 'lab_orders', 'lab_orders', 'write'),
    ('Editar órdenes de laboratorio', 'Editar los datos de una orden de laboratorio',
     'LAB_ORDERS_UPDATE', 'lab_orders', 'lab_orders', 'write'),
    ('Eliminar órdenes de laboratorio', 'Eliminar órdenes de laboratorio',
     'LAB_ORDERS_DELETE', 'lab_orders', 'lab_orders', 'write'),
    ('Cambiar etapa de órdenes de laboratorio', 'Mover órdenes entre etapas (arrastrando en el tablero o con "Mover a…")',
     'LAB_ORDERS_CHANGE_STAGE', 'lab_orders', 'lab_orders', 'write'),
    ('Configurar etapas de laboratorio', 'Crear, editar, reordenar y desactivar etapas de laboratorio y sus alertas',
     'LAB_STAGES_CONFIG', 'config', 'lab_stages', 'write')
ON CONFLICT (code) DO NOTHING;

-- Roles por nombre (los ids difieren entre clientes; el casing también).
--   Administrador: todo.
--   Recepcionista / Asistente: registran y mueven órdenes.
--   Doctor / Gerente: ven las órdenes (y las demoradas).
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
    'LAB_ORDERS_VIEW_MENU', 'LAB_ORDERS_VIEW', 'LAB_ORDERS_CREATE', 'LAB_ORDERS_UPDATE',
    'LAB_ORDERS_DELETE', 'LAB_ORDERS_CHANGE_STAGE', 'LAB_STAGES_CONFIG')
WHERE LOWER(TRIM(r.name)) = 'administrador'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
    'LAB_ORDERS_VIEW_MENU', 'LAB_ORDERS_VIEW', 'LAB_ORDERS_CREATE', 'LAB_ORDERS_UPDATE',
    'LAB_ORDERS_CHANGE_STAGE')
WHERE LOWER(TRIM(r.name)) IN ('recepcionista', 'asistente')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN ('LAB_ORDERS_VIEW_MENU', 'LAB_ORDERS_VIEW')
WHERE LOWER(TRIM(r.name)) IN ('doctor', 'gerente')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ─── Registro de migración ────────────────────────────────────────────────────

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '147_20261029_lab-orders-stages.sql',
    'v1',
    'lab_stages + lab_orders + lab_order_stage_history + lab_stages_save/list + 3 etapas precargadas + permisos LAB_ORDERS_* / LAB_STAGES_CONFIG'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;

-- ─── Opcional: clínica en inglés ─────────────────────────────────────────────
-- Ejecutar solo si la clínica usa la app en inglés y todavía no renombró las
-- etapas precargadas.
--
-- UPDATE public.lab_stages SET name = 'Request created / Impression taken'
--  WHERE name = 'Solicitud creada / Toma de impresión';
-- UPDATE public.lab_stages SET name = 'Sent to lab / In progress'
--  WHERE name = 'Enviado al laboratorio / En progreso';
-- UPDATE public.lab_stages SET name = 'Completed'
--  WHERE name = 'Completado';
