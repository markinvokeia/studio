-- =====================================================================
-- reminders: notas y recordatorios recurrentes
-- Run on: dev / staging / prod
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- =====================================================================
--
-- Contexto:
--   Hoy una nota o un recordatorio es una fila única con un start_datetime
--   fijo. Para algo que se repite —"reunión de equipo todos los lunes",
--   "controlar el autoclave el 1 de cada mes"— hay que crearlo a mano cada
--   vez.
--
-- Decisión de diseño: MATERIALIZAR, no expandir al leer.
--   Se genera una fila real de `reminders` por ocurrencia a partir de una
--   plantilla en `reminder_series`, en vez de guardar solo la regla y
--   expandirla en cada lectura. Tres razones:
--
--   1. La constraint uq_notifications_reminder_id_user_id UNIQUE
--      (reminder_id, user_id) rompe la expansión virtual EN SILENCIO: si
--      la serie fuera un único reminders.id, solo la primera ocurrencia
--      notificaría y el resto se las tragaría el ON CONFLICT.
--   2. El contrato de `id` es UUID de punta a punta (validadores de n8n,
--      keyeo del calendario). Ocurrencias virtuales exigirían ids
--      compuestos y romperían todo eso.
--   3. status, completed_at, completed_by y color ya son por fila.
--
--   Materializando, todo aguas abajo sigue funcionando sin cambios: el
--   cron de notificaciones, el SQL del GET, el render, marcar hecho y los
--   permisos, porque cada ocurrencia es una fila normal con su propio id.
--
-- Cambios:
--   1. Tabla reminder_series (plantilla + regla)
--   2. reminders: series_id, is_series_exception, unique (series_id, start_datetime)
--   3. reminders_generate_series_occurrences(uuid, timestamp)
--   4. reminders_materialize_all(timestamp)
-- =====================================================================

BEGIN;

-- ─── 1. La plantilla y su regla ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.reminder_series (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Plantilla: se copia tal cual a cada ocurrencia.
    type              character varying NOT NULL DEFAULT 'reminder',
    calendar_id       bigint,
    title             text NOT NULL,
    description       text,
    color             character varying,
    priority          character varying NOT NULL DEFAULT 'MEDIUM',
    visibility        character varying NOT NULL DEFAULT 'clinic',
    is_all_day        boolean NOT NULL DEFAULT false,
    raise_alert       boolean NOT NULL DEFAULT false,

    -- Ancla: primera ocurrencia posible. La hora del día sale de acá.
    anchor_start      timestamp without time zone NOT NULL,
    duration_minutes  integer NOT NULL,

    -- La regla. Columnas descompuestas en vez de un RRULE RFC-5545: se consulta
    -- desde SQL sin parsear nada, y sigue el precedente de availability_rules.
    freq              character varying NOT NULL,
    rec_interval      integer NOT NULL DEFAULT 1,
    byweekday         smallint[],
    by_month_day      smallint,

    end_mode          character varying NOT NULL DEFAULT 'never',
    until_date        date,
    occurrence_count  integer,

    -- Estado
    is_active         boolean NOT NULL DEFAULT true,
    generated_until   timestamp without time zone,
    created_by        uuid REFERENCES public.users(id) ON DELETE SET NULL,
    created_at        timestamp without time zone NOT NULL DEFAULT now(),
    updated_at        timestamp without time zone NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.reminder_series IS
    'Plantilla + regla de repetición de una serie de notas/recordatorios. Las ocurrencias '
    'son filas reales de `reminders` con series_id apuntando acá.';

-- Un solo CHECK por tema, con el mismo criterio que chk_rule_logic de
-- availability_rules: cada campo auxiliar es obligatorio en su patrón y prohibido
-- en los demás, para que no queden filas medio configuradas.

ALTER TABLE public.reminder_series DROP CONSTRAINT IF EXISTS reminder_series_type_check;
ALTER TABLE public.reminder_series ADD CONSTRAINT reminder_series_type_check
    CHECK (type::text = ANY (ARRAY['note', 'reminder']));

ALTER TABLE public.reminder_series DROP CONSTRAINT IF EXISTS reminder_series_priority_check;
ALTER TABLE public.reminder_series ADD CONSTRAINT reminder_series_priority_check
    CHECK (priority::text = ANY (ARRAY['LOW', 'MEDIUM', 'HIGH']));

ALTER TABLE public.reminder_series DROP CONSTRAINT IF EXISTS reminder_series_visibility_check;
ALTER TABLE public.reminder_series ADD CONSTRAINT reminder_series_visibility_check
    CHECK (visibility::text = ANY (ARRAY['personal', 'clinic']));

ALTER TABLE public.reminder_series DROP CONSTRAINT IF EXISTS reminder_series_duration_check;
ALTER TABLE public.reminder_series ADD CONSTRAINT reminder_series_duration_check
    CHECK (duration_minutes > 0);

ALTER TABLE public.reminder_series DROP CONSTRAINT IF EXISTS reminder_series_all_day_check;
ALTER TABLE public.reminder_series ADD CONSTRAINT reminder_series_all_day_check
    CHECK (is_all_day = false OR anchor_start::time = '00:00:00');

ALTER TABLE public.reminder_series DROP CONSTRAINT IF EXISTS reminder_series_freq_logic;
ALTER TABLE public.reminder_series ADD CONSTRAINT reminder_series_freq_logic
    CHECK (
        rec_interval BETWEEN 1 AND 52
        AND (
            (freq::text = 'DAILY'
             AND byweekday IS NULL AND by_month_day IS NULL)
         OR (freq::text = 'WEEKLY'
             AND byweekday IS NOT NULL AND array_length(byweekday, 1) BETWEEN 1 AND 7
             AND byweekday <@ ARRAY[1,2,3,4,5,6,7]::smallint[]
             AND by_month_day IS NULL)
         OR (freq::text = 'MONTHLY'
             AND by_month_day BETWEEN 1 AND 31
             AND byweekday IS NULL)
        )
    );

ALTER TABLE public.reminder_series DROP CONSTRAINT IF EXISTS reminder_series_end_logic;
ALTER TABLE public.reminder_series ADD CONSTRAINT reminder_series_end_logic
    CHECK (
        (end_mode::text = 'never' AND until_date IS NULL AND occurrence_count IS NULL)
     OR (end_mode::text = 'until' AND until_date IS NOT NULL AND occurrence_count IS NULL)
     OR (end_mode::text = 'count' AND occurrence_count >= 1 AND until_date IS NULL)
    );

CREATE INDEX IF NOT EXISTS idx_reminder_series_active
    ON public.reminder_series (is_active, generated_until);

-- ─── 2. El vínculo desde las ocurrencias ──────────────────────────────────────

ALTER TABLE public.reminders
    ADD COLUMN IF NOT EXISTS series_id uuid,
    ADD COLUMN IF NOT EXISTS is_series_exception boolean NOT NULL DEFAULT false;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'reminders_series_id_fkey'
    ) THEN
        ALTER TABLE public.reminders
            ADD CONSTRAINT reminders_series_id_fkey
            FOREIGN KEY (series_id) REFERENCES public.reminder_series(id) ON DELETE SET NULL;
    END IF;
END $$;

COMMENT ON COLUMN public.reminders.is_series_exception IS
    'La ocurrencia fue editada o cancelada a mano: la regeneración de la serie no la pisa.';

-- Clave de idempotencia de la generación. No hace falta que sea parcial: en un índice
-- único los NULL son distintos entre sí, así que las filas sueltas (series_id NULL) no
-- colisionan nunca.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_reminders_series_start'
    ) THEN
        ALTER TABLE public.reminders
            ADD CONSTRAINT uq_reminders_series_start UNIQUE (series_id, start_datetime);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_reminders_series_id
    ON public.reminders (series_id) WHERE series_id IS NOT NULL;

-- ─── 3. El generador ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.reminders_generate_series_occurrences(
    p_series_id uuid,
    p_until     timestamp without time zone
) RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    s             public.reminder_series%ROWTYPE;
    v_horizon     timestamp without time zone;
    v_anchor_time time;
    v_inserted    integer := 0;
BEGIN
    -- FOR UPDATE: dos lecturas del calendario en paralelo pueden pedir generación de la
    -- misma serie. El lock más el índice único hacen la operación segura.
    SELECT * INTO s FROM public.reminder_series WHERE id = p_series_id FOR UPDATE;
    IF NOT FOUND OR NOT s.is_active THEN
        RETURN 0;
    END IF;

    -- Tope duro: un `to` hostil no puede hacer que esto genere años de filas.
    v_horizon := LEAST(p_until, (now() + interval '400 days')::timestamp);
    IF s.end_mode = 'until' THEN
        v_horizon := LEAST(v_horizon, (s.until_date + 1)::timestamp - interval '1 second');
    END IF;
    IF v_horizon < s.anchor_start THEN
        RETURN 0;
    END IF;

    v_anchor_time := s.anchor_start::time;

    WITH days AS (
        -- DAILY: cada rec_interval días desde el ancla.
        SELECT gs::date AS day
        FROM generate_series(
                 s.anchor_start::date,
                 v_horizon::date,
                 make_interval(days => s.rec_interval)
             ) AS gs
        WHERE s.freq = 'DAILY'

        UNION ALL

        -- WEEKLY: cada rec_interval semanas desde la del ancla y, dentro de cada una,
        -- los días pedidos. date_trunc('week') da lunes, que es ISODOW 1.
        SELECT (wk::date + (dw - 1)) AS day
        FROM generate_series(
                 date_trunc('week', s.anchor_start),
                 date_trunc('week', v_horizon) + interval '1 week',
                 make_interval(weeks => s.rec_interval)
             ) AS wk,
             unnest(s.byweekday) AS dw
        WHERE s.freq = 'WEEKLY'

        UNION ALL

        -- MONTHLY: cada rec_interval meses. El día se RECORTA al último del mes en vez
        -- de saltearse: un recordatorio de clínica que desaparece en febrero es peor que
        -- uno el 28. by_month_day se guarda explícito para que el ancla sobreviva.
        SELECT (mo::date + (LEAST(
                    s.by_month_day,
                    EXTRACT(DAY FROM (mo + interval '1 month' - interval '1 day'))::smallint
                ) - 1)) AS day
        FROM generate_series(
                 date_trunc('month', s.anchor_start),
                 date_trunc('month', v_horizon) + interval '1 month',
                 make_interval(months => s.rec_interval)
             ) AS mo
        WHERE s.freq = 'MONTHLY'
    ),
    ordered AS (
        SELECT (day + v_anchor_time)::timestamp AS start_dt
        FROM days
        WHERE (day + v_anchor_time)::timestamp >= s.anchor_start
          AND (day + v_anchor_time)::timestamp <= v_horizon
        GROUP BY 1
        ORDER BY 1
    ),
    limited AS (
        -- end_mode 'count' cuenta desde el ancla, no desde la ventana pedida, y por eso
        -- la generación siempre arranca en el ancla.
        SELECT start_dt FROM ordered
        LIMIT CASE WHEN s.end_mode = 'count' THEN s.occurrence_count ELSE NULL END
    ),
    inserted AS (
        INSERT INTO public.reminders (
            type, calendar_id, title, description,
            start_datetime, end_datetime,
            color, priority, status, visibility, is_all_day, raise_alert,
            created_by, series_id, is_series_exception, created_at, updated_at
        )
        SELECT
            s.type, s.calendar_id, s.title, s.description,
            l.start_dt,
            CASE
                WHEN s.is_all_day THEN l.start_dt::date + time '23:59:59'
                ELSE l.start_dt + make_interval(mins => s.duration_minutes)
            END,
            s.color, s.priority, 'pending', s.visibility, s.is_all_day,
            -- Las notas y lo de todo el día son silenciosos, igual que en el upsert.
            (s.raise_alert AND s.type = 'reminder' AND NOT s.is_all_day),
            s.created_by, s.id, false, now(), now()
        FROM limited AS l
        -- La ocurrencia que ya existe no se pisa. Es lo que protege a las canceladas a
        -- mano (status='cancelled' + is_series_exception) de resucitar en la próxima
        -- generación.
        ON CONFLICT (series_id, start_datetime) DO NOTHING
        RETURNING 1
    )
    SELECT count(*) INTO v_inserted FROM inserted;

    UPDATE public.reminder_series
       SET generated_until = GREATEST(COALESCE(generated_until, v_horizon), v_horizon),
           updated_at      = now()
     WHERE id = s.id;

    RETURN v_inserted;
END $$;

COMMENT ON FUNCTION public.reminders_generate_series_occurrences(uuid, timestamp) IS
    'Materializa las ocurrencias de una serie hasta p_until (tope duro: now + 400 días). '
    'Idempotente: se apoya en uq_reminders_series_start.';

-- ─── 4. El materializador de todas las series ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.reminders_materialize_all(
    p_until timestamp without time zone DEFAULT (now() + interval '90 days')::timestamp
) RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    r          record;
    v_total    integer := 0;
BEGIN
    FOR r IN
        SELECT id FROM public.reminder_series
         WHERE is_active
           AND (generated_until IS NULL OR generated_until < p_until)
         ORDER BY created_at
    LOOP
        v_total := v_total + public.reminders_generate_series_occurrences(r.id, p_until);
    END LOOP;

    RETURN v_total;
END $$;

COMMENT ON FUNCTION public.reminders_materialize_all(timestamp) IS
    'Recorre las series activas y las materializa hasta p_until. La usa el cron de horizonte.';

-- ─── 5. Guardar con alcance ───────────────────────────────────────────────────
--
-- Toda la lógica de series vive acá y no en nodos del canvas de n8n, a propósito: los
-- flujos se despliegan copiando JSON a mano, sin CI ni rollback, y ya se vio que derivan
-- respecto del repo. En una función versionada el cambio se revisa en el diff y se aplica
-- con una migración.
--
-- Semántica:
--   - Alta con recurrencia            → crea la serie y materializa.
--   - Edición scope='occurrence'      → toca solo esa fila y la marca is_series_exception.
--   - Edición scope='series'          → actualiza plantilla y regla, borra las futuras
--                                       pendientes NO excepción y regenera.
--   - Ítem suelto al que se le agrega recurrencia → adopta la fila como primera
--                                       ocurrencia (conserva su id, su estado y su color).
--   - Serie a la que se le saca la recurrencia    → la serie se cierra en blando, se
--                                       borran las futuras y la fila queda suelta.

CREATE OR REPLACE FUNCTION public.reminders_save(
    p_payload jsonb,
    p_actor   uuid
) RETURNS SETOF public.reminders
LANGUAGE plpgsql
AS $$
DECLARE
    v_id          uuid := NULLIF(p_payload->>'id', '')::uuid;
    v_scope       text := COALESCE(NULLIF(p_payload->>'scope', ''), 'occurrence');
    v_rec         jsonb := CASE WHEN jsonb_typeof(p_payload->'recurrence') = 'object'
                               THEN p_payload->'recurrence' ELSE NULL END;
    v_existing    public.reminders%ROWTYPE;
    v_series_id   uuid;
    v_start       timestamp := (p_payload->>'start_datetime')::timestamp;
    v_end         timestamp := NULLIF(p_payload->>'end_datetime', '')::timestamp;
    v_all_day     boolean   := COALESCE((p_payload->>'is_all_day')::boolean, false);
    v_type        text      := COALESCE(p_payload->>'type', 'reminder');
    v_raise       boolean   := COALESCE((p_payload->>'raise_alert')::boolean, false)
                               AND v_type = 'reminder' AND NOT v_all_day;
    v_horizon     timestamp := (now() + interval '90 days')::timestamp;
    v_use_series  boolean;
    v_dissolving  boolean;
BEGIN
    IF v_id IS NOT NULL THEN
        SELECT * INTO v_existing FROM public.reminders WHERE id = v_id;
    END IF;

    -- Guard de alcance, idéntico al del upsert directo: lo compartido lo edita
    -- cualquiera, lo personal solo su autor, y lo que no tiene autor es de todos.
    IF v_existing.id IS NOT NULL
       AND v_existing.visibility = 'personal'
       AND v_existing.created_by IS NOT NULL
       AND v_existing.created_by <> p_actor THEN
        RETURN;
    END IF;

    -- ── ¿Esto toca la serie, o una sola fila? ───────────────────────────────────
    --
    -- Lo decide el SCOPE, no que venga `recurrence` en el payload. El formulario hidrata
    -- la regla del ítem que se edita y la devuelve tal cual, así que al editar UNA
    -- ocurrencia el payload trae recurrencia igual; mirar eso creaba una serie nueva y
    -- duplicaba todo.
    --
    -- Se toca la serie solo si hay regla Y (se pidió alcance de serie, o el ítem todavía
    -- no pertenece a ninguna — el caso de agregarle recurrencia a un ítem suelto).
    v_use_series := v_rec IS NOT NULL
                    AND (v_scope = 'series' OR v_existing.series_id IS NULL);

    -- Sacarle la recurrencia a una serie tampoco es "una sola fila": disuelve la serie.
    -- Es la única edición sin regla que baja a la sección de serie.
    v_dissolving := v_rec IS NULL
                    AND v_scope = 'series'
                    AND v_existing.series_id IS NOT NULL;

    IF NOT v_use_series AND NOT v_dissolving THEN
        RETURN QUERY
        WITH saved AS (
        INSERT INTO public.reminders AS existing (
            id, type, calendar_id, title, description, start_datetime, end_datetime,
            color, priority, status, visibility, is_all_day, raise_alert, created_by,
            series_id, is_series_exception, completed_at, completed_by, created_at, updated_at
        ) VALUES (
            COALESCE(v_id, gen_random_uuid()), v_type,
            NULLIF(p_payload->>'calendar_id', '')::bigint,
            p_payload->>'title', NULLIF(p_payload->>'description', ''),
            v_start, v_end, p_payload->>'color',
            COALESCE(p_payload->>'priority', 'MEDIUM'),
            COALESCE(p_payload->>'status', 'pending'),
            COALESCE(p_payload->>'visibility', 'clinic'),
            v_all_day, v_raise, p_actor,
            v_existing.series_id,
            -- Editar una ocurrencia suelta de una serie la vuelve excepción: la
            -- regeneración no la puede pisar.
            (v_existing.series_id IS NOT NULL),
            CASE WHEN p_payload->>'status' = 'done' THEN now() ELSE NULL END,
            CASE WHEN p_payload->>'status' = 'done' THEN p_actor ELSE NULL END,
            now(), now()
        )
        ON CONFLICT (id) DO UPDATE
        SET type = EXCLUDED.type, calendar_id = EXCLUDED.calendar_id, title = EXCLUDED.title,
            description = EXCLUDED.description, start_datetime = EXCLUDED.start_datetime,
            end_datetime = EXCLUDED.end_datetime, color = EXCLUDED.color,
            priority = EXCLUDED.priority, status = EXCLUDED.status,
            visibility = CASE
                           WHEN existing.created_by IS NULL OR existing.created_by = p_actor
                             THEN EXCLUDED.visibility
                           ELSE existing.visibility
                         END,
            is_all_day = EXCLUDED.is_all_day, raise_alert = EXCLUDED.raise_alert,
            is_series_exception = EXCLUDED.is_series_exception,
            completed_at = CASE WHEN EXCLUDED.status = 'done'
                                THEN COALESCE(existing.completed_at, now()) ELSE NULL END,
            completed_by = CASE WHEN EXCLUDED.status = 'done'
                                THEN COALESCE(existing.completed_by, p_actor) ELSE NULL END,
            updated_at = now()
        RETURNING existing.*
        )
        SELECT * FROM saved;
        RETURN;
    END IF;

    -- ── Serie: crear o actualizar la plantilla y la regla ────────────────────────
    v_series_id := CASE WHEN v_scope = 'series' THEN v_existing.series_id ELSE NULL END;

    IF v_rec IS NULL THEN
        -- Se le sacó la recurrencia a una serie: se cierra en blando y la fila queda suelta.
        UPDATE public.reminder_series SET is_active = false, updated_at = now()
         WHERE id = v_existing.series_id;
        DELETE FROM public.reminders
         WHERE series_id = v_existing.series_id
           AND id <> v_existing.id
           AND status = 'pending'
           AND NOT is_series_exception
           AND start_datetime > now();
        UPDATE public.reminders SET series_id = NULL, is_series_exception = false WHERE id = v_existing.id;
        RETURN QUERY SELECT * FROM public.reminders WHERE id = v_existing.id;
        RETURN;
    END IF;

    INSERT INTO public.reminder_series AS s (
        id, type, calendar_id, title, description, color, priority, visibility,
        is_all_day, raise_alert, anchor_start, duration_minutes,
        freq, rec_interval, byweekday, by_month_day,
        end_mode, until_date, occurrence_count, created_by, created_at, updated_at
    ) VALUES (
        COALESCE(v_series_id, gen_random_uuid()), v_type,
        NULLIF(p_payload->>'calendar_id', '')::bigint,
        p_payload->>'title', NULLIF(p_payload->>'description', ''),
        p_payload->>'color', COALESCE(p_payload->>'priority', 'MEDIUM'),
        COALESCE(p_payload->>'visibility', 'clinic'),
        v_all_day, v_raise,
        v_start,
        GREATEST(1, COALESCE(EXTRACT(EPOCH FROM (v_end - v_start))::int / 60, 15)),
        v_rec->>'freq', COALESCE((v_rec->>'interval')::int, 1),
        CASE WHEN jsonb_typeof(v_rec->'byweekday') = 'array'
             THEN ARRAY(SELECT jsonb_array_elements_text(v_rec->'byweekday')::smallint)
             ELSE NULL END,
        NULLIF(v_rec->>'by_month_day', '')::smallint,
        COALESCE(v_rec->>'end_mode', 'never'),
        NULLIF(v_rec->>'until_date', '')::date,
        NULLIF(v_rec->>'occurrence_count', '')::int,
        p_actor, now(), now()
    )
    ON CONFLICT (id) DO UPDATE
    SET type = EXCLUDED.type, calendar_id = EXCLUDED.calendar_id, title = EXCLUDED.title,
        description = EXCLUDED.description, color = EXCLUDED.color, priority = EXCLUDED.priority,
        visibility = EXCLUDED.visibility, is_all_day = EXCLUDED.is_all_day,
        raise_alert = EXCLUDED.raise_alert, anchor_start = EXCLUDED.anchor_start,
        duration_minutes = EXCLUDED.duration_minutes, freq = EXCLUDED.freq,
        rec_interval = EXCLUDED.rec_interval, byweekday = EXCLUDED.byweekday,
        by_month_day = EXCLUDED.by_month_day, end_mode = EXCLUDED.end_mode,
        until_date = EXCLUDED.until_date, occurrence_count = EXCLUDED.occurrence_count,
        is_active = true, generated_until = NULL, updated_at = now()
    RETURNING s.id INTO v_series_id;

    -- Las futuras pendientes que no son excepción se rehacen: la regla cambió. Las
    -- pasadas y las tocadas a mano no se tocan nunca.
    DELETE FROM public.reminders
     WHERE series_id = v_series_id
       AND status = 'pending'
       AND NOT is_series_exception
       AND start_datetime > now();

    -- Un ítem suelto al que se le agrega recurrencia adopta la serie en vez de
    -- duplicarse: conserva su id, su estado y todo lo que ya tenía.
    IF v_existing.id IS NOT NULL AND v_existing.series_id IS NULL THEN
        UPDATE public.reminders
           SET series_id = v_series_id, title = p_payload->>'title',
               description = NULLIF(p_payload->>'description', ''),
               start_datetime = v_start, end_datetime = v_end,
               color = p_payload->>'color', priority = COALESCE(p_payload->>'priority', 'MEDIUM'),
               visibility = COALESCE(p_payload->>'visibility', 'clinic'),
               is_all_day = v_all_day, raise_alert = v_raise, updated_at = now()
         WHERE id = v_existing.id;
    END IF;

    PERFORM public.reminders_generate_series_occurrences(v_series_id, v_horizon);

    -- Se devuelve la ocurrencia del ancla: es la que el calendario acaba de editar.
    RETURN QUERY
    SELECT * FROM public.reminders
     WHERE series_id = v_series_id
     ORDER BY abs(EXTRACT(EPOCH FROM (start_datetime - v_start)))
     LIMIT 1;
END $$;

COMMENT ON FUNCTION public.reminders_save(jsonb, uuid) IS
    'Alta/edición de notas y recordatorios, con o sin serie. Devuelve 0 filas si el actor '
    'no tiene permiso sobre el ítem (el flujo lo traduce a 403).';

-- ─── 6. Borrar con alcance ────────────────────────────────────────────────────

-- El DROP es obligatorio, no defensivo: cambiar los nombres de las columnas de salida
-- cambia el tipo de retorno, y `CREATE OR REPLACE` lo rechaza con "cannot change return
-- type of existing function" sobre una base donde la función ya está instalada.
DROP FUNCTION IF EXISTS public.reminders_delete_scoped(uuid, text, uuid);

-- Los parámetros de salida van con prefijo `out_` a propósito. `RETURNS TABLE (id ...)`
-- crea variables plpgsql con ese nombre, y entonces cada `WHERE id = p_id` de adentro
-- queda ambiguo entre la variable y la columna — Postgres aborta con "column reference
-- "id" is ambiguous". Con el prefijo la colisión no puede existir, en vez de depender de
-- que nadie olvide calificar una columna al agregar una sentencia más adelante.
-- El nodo que la consume renombra las columnas al alias sin prefijo.
CREATE OR REPLACE FUNCTION public.reminders_delete_scoped(
    p_id    uuid,
    p_scope text,
    p_actor uuid
) RETURNS TABLE (
    out_found       bigint,
    out_removed     bigint,
    out_id          text,
    out_type        text,
    out_calendar_id text,
    out_visibility  text,
    out_created_by  text,
    out_series_id   text
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_existing public.reminders%ROWTYPE;
    v_removed  bigint := 0;
BEGIN
    SELECT * INTO v_existing FROM public.reminders WHERE id = p_id;
    IF NOT FOUND THEN
        RETURN QUERY SELECT 0::bigint, 0::bigint, p_id::text, NULL::text, NULL::text,
                            NULL::text, NULL::text, NULL::text;
        RETURN;
    END IF;

    -- Las columnas de identidad viajan en todos los casos: el nodo que empuja el evento
    -- `calendar_changed` arma los canales con `visibility` y `calendar_id`, y sin ellas
    -- publicaría en el canal equivocado o en ninguno.
    IF v_existing.visibility = 'personal'
       AND v_existing.created_by IS NOT NULL
       AND v_existing.created_by <> p_actor THEN
        RETURN QUERY SELECT 1::bigint, 0::bigint, v_existing.id::text, v_existing.type::text,
                            v_existing.calendar_id::text, v_existing.visibility::text,
                            v_existing.created_by::text, v_existing.series_id::text;
        RETURN;
    END IF;

    IF p_scope = 'series' AND v_existing.series_id IS NOT NULL THEN
        UPDATE public.reminder_series SET is_active = false, updated_at = now()
         WHERE id = v_existing.series_id;
        -- Nunca destructivo con el historial: solo las futuras pendientes que no son
        -- excepción. Las pasadas conservan su series_id como registro.
        WITH d AS (
            DELETE FROM public.reminders
             WHERE series_id = v_existing.series_id
               AND status = 'pending'
               AND NOT is_series_exception
               AND start_datetime > now()
            RETURNING 1
        ) SELECT count(*) INTO v_removed FROM d;
        RETURN QUERY SELECT 1::bigint, v_removed, v_existing.id::text, v_existing.type::text,
                            v_existing.calendar_id::text, v_existing.visibility::text,
                            v_existing.created_by::text, v_existing.series_id::text;
        RETURN;
    END IF;

    IF v_existing.series_id IS NOT NULL THEN
        -- Una ocurrencia suelta se cancela en blando: un DELETE la haría resucitar en la
        -- próxima generación, porque el índice único ya no la vería.
        UPDATE public.reminders
           SET status = 'cancelled', is_series_exception = true, updated_at = now()
         WHERE id = p_id;
        RETURN QUERY SELECT 1::bigint, 1::bigint, v_existing.id::text, v_existing.type::text,
                            v_existing.calendar_id::text, v_existing.visibility::text,
                            v_existing.created_by::text, v_existing.series_id::text;
        RETURN;
    END IF;

    DELETE FROM public.reminders WHERE id = p_id;
    RETURN QUERY SELECT 1::bigint, 1::bigint, v_existing.id::text, v_existing.type::text,
                        v_existing.calendar_id::text, v_existing.visibility::text,
                        v_existing.created_by::text, v_existing.series_id::text;
END $$;

COMMENT ON FUNCTION public.reminders_delete_scoped(uuid, text, uuid) IS
    'Borra una ocurrencia o una serie. found=0 → 404; found=1 y removed=0 → 403.';

-- ─── Registro de migración ────────────────────────────────────────────────────

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '082_20260914_reminders-recurrence.sql',
    'v1',
    'reminder_series + reminders.series_id/is_series_exception + generador y materializador de ocurrencias'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;
