-- =============================================================================
-- Órdenes de estudio — Clínica Imagen
-- =============================================================================
-- 1. public.study_orders                 cabecera de la orden que manda el derivador
-- 2. public.study_order_items            una línea por servicio pedido (FK service_catalog)
-- 3. public.study_order_options          catálogo de modificadores/textos/entrega del formulario
-- 4. public.study_order_booking_tokens   links de auto-agendamiento del paciente
-- 5. public.appointments.study_order_id  columna nueva: de qué orden nació la cita
-- 6. public.v_study_orders_board         vista con el estado derivado para la bandeja
-- 7. Permisos STUDY_ORDERS_* y asignación a roles
--
-- Dependencias: public.users, public.service_catalog, public.miscellaneous_categories,
--               public.sedes, public.appointments, public.appointment_service_catalog,
--               función update_updated_at_column() (definida en 029_*.sql)
--
-- El catálogo de servicios debe estar cargado ANTES de correr esto:
--   scripts/sql/catalogo-clinica-imagen.sql  (12 categorías + 69 servicios)
-- El seed del punto 3 resuelve los servicios por service_catalog.external_id.
--
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Cabecera de la orden
-- -----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.study_orders_number_seq;

CREATE TABLE IF NOT EXISTS public.study_orders (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number        varchar(20)  NOT NULL
                        DEFAULT ('OE-' || to_char(now(), 'YYYY') || '-' ||
                                 lpad(nextval('public.study_orders_number_seq')::text, 6, '0')),
    doctor_id           uuid         NOT NULL,
    patient_id          uuid,
    patient_name        varchar(255) NOT NULL,
    patient_document    varchar(50),
    patient_email       varchar(255),
    patient_phone       varchar(50),
    status              varchar(20)  NOT NULL DEFAULT 'draft',
    regions             jsonb        NOT NULL DEFAULT '{}'::jsonb,
    section_modifiers   jsonb        NOT NULL DEFAULT '{}'::jsonb,
    texts               jsonb        NOT NULL DEFAULT '{}'::jsonb,
    delivery_methods    jsonb        NOT NULL DEFAULT '[]'::jsonb,
    clinical_notes      text,
    preferred_sede_id   integer,
    submitted_at        timestamp without time zone,
    acknowledged_at     timestamp without time zone,
    acknowledged_by     uuid,
    completed_at        timestamp without time zone,
    cancelled_at        timestamp without time zone,
    cancellation_reason text,
    created_by          uuid,
    created_at          timestamp without time zone NOT NULL DEFAULT now(),
    updated_at          timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT study_orders_order_number_key UNIQUE (order_number),
    CONSTRAINT study_orders_status_check
        CHECK (status IN ('draft', 'submitted', 'completed', 'cancelled'))
);

COMMENT ON TABLE  public.study_orders IS
    'Orden de estudio que un odontólogo derivador envía a la clínica. Reemplaza el formulario web suelto de clinicaimagen.uy/ordenes.';
COMMENT ON COLUMN public.study_orders.doctor_id IS
    'Odontólogo derivador (users.id). Es el mismo valor que va a appointments.assignee_id de las citas que genere: en Clínica Imagen el doctor de la cita es quien derivó, no el técnico que ejecuta.';
COMMENT ON COLUMN public.study_orders.patient_id IS
    'users.id del paciente. Se resuelve al crear la orden buscando por documento; si no existe se crea inline con los datos mínimos.';
COMMENT ON COLUMN public.study_orders.patient_name IS
    'Nombre tal como lo escribió el derivador. Se conserva denormalizado para que la orden impresa sobreviva a cambios en la ficha del paciente.';
COMMENT ON COLUMN public.study_orders.status IS
    'Sólo 4 estados persistidos, uno por evento humano. El avance operativo (nueva/sin agendar/agendada/parcial/en curso) se DERIVA en la vista v_study_orders_board a partir de las citas, para que no haya dos fuentes de verdad.';
COMMENT ON COLUMN public.study_orders.regions IS
    'Piezas dentarias por sección: {"RX-INTRA":["16","17"],"CONEBEAM":["36"]}. El formulario tiene un odontograma por sección, no por línea.';
COMMENT ON COLUMN public.study_orders.section_modifiers IS
    'Modificadores de alcance sección: {"CONEBEAM":{"indicacion_clinica":["est-tipo-implante"]}}. Los códigos se validan contra study_order_options.';
COMMENT ON COLUMN public.study_orders.texts IS
    'Los 14 campos de texto libre del formulario, indexados por code de study_order_options.';
COMMENT ON COLUMN public.study_orders.acknowledged_at IS
    'Cuándo la recepción tomó la orden. Es lo que la saca del bucket "nueva" en la bandeja: hace de paso de revisión previa sin necesidad de un estado persistido.';
COMMENT ON COLUMN public.study_orders.preferred_sede_id IS
    'Sede sugerida por el derivador. No obliga: la sede real sale del calendario de la cita.';

-- -----------------------------------------------------------------------------
-- 2. Líneas de la orden
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.study_order_items (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    study_order_id      uuid         NOT NULL,
    service_id          integer      NOT NULL,
    service_name        varchar(255) NOT NULL,
    section_code        varchar(30)  NOT NULL,
    sort_order          smallint     NOT NULL DEFAULT 0,
    quantity            smallint     NOT NULL DEFAULT 1,
    modifiers           jsonb        NOT NULL DEFAULT '{}'::jsonb,
    notes               text,
    is_cancelled        boolean      NOT NULL DEFAULT false,
    cancellation_reason text,
    created_at          timestamp without time zone NOT NULL DEFAULT now(),
    updated_at          timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT study_order_items_order_service_key UNIQUE (study_order_id, service_id),
    CONSTRAINT study_order_items_quantity_check CHECK (quantity > 0)
);

COMMENT ON TABLE  public.study_order_items IS
    'Un servicio pedido dentro de una orden. Apunta a service_catalog, que es el mismo catálogo que usan la agenda y la facturación.';
COMMENT ON COLUMN public.study_order_items.service_name IS
    'Nombre del servicio al momento del pedido. Denormalizado a propósito: si mañana se renombra el servicio, la orden impresa sigue diciendo lo que el doctor pidió.';
COMMENT ON COLUMN public.study_order_items.section_code IS
    'miscellaneous_categories.code de la sección del formulario (RX-INTRA, CONEBEAM, ...). Evita rearmar el agrupado con un join en cada lectura.';
COMMENT ON COLUMN public.study_order_items.modifiers IS
    'Modificadores de la línea: {"tecnica":["frankfort"],"arcada":["escaneo-superior"]}. Códigos validados contra study_order_options.';
COMMENT ON CONSTRAINT study_order_items_order_service_key ON public.study_order_items IS
    'Un servicio aparece una sola vez por orden. Es lo que hace unívoco el cruce línea<->cita vía appointment_service_catalog, y evita tener una tabla puente que se desincronice.';

-- -----------------------------------------------------------------------------
-- 3. Catálogo de opciones del formulario
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.study_order_options (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    option_kind   varchar(20)  NOT NULL,
    code          varchar(60)  NOT NULL,
    label         varchar(160) NOT NULL,
    section_code  varchar(30),
    service_id    integer,
    group_code    varchar(40),
    input_type    varchar(20)  NOT NULL DEFAULT 'checkbox',
    sort_order    smallint     NOT NULL DEFAULT 0,
    is_active     boolean      NOT NULL DEFAULT true,
    external_id   varchar(120),
    created_at    timestamp without time zone NOT NULL DEFAULT now(),
    updated_at    timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT study_order_options_external_id_key UNIQUE (external_id),
    CONSTRAINT study_order_options_kind_check
        CHECK (option_kind IN ('modifier', 'text', 'region_group', 'delivery')),
    CONSTRAINT study_order_options_input_check
        CHECK (input_type IN ('checkbox', 'radio', 'text', 'textarea', 'date'))
);

COMMENT ON TABLE  public.study_order_options IS
    'Vocabulario del formulario de orden: modificadores, campos de texto, odontogramas y medios de entrega. Se siembra desde scripts/sql/orden-mapping.json con scripts/generate-study-order-options.mjs. Estar en BD permite agregar una opción sin un deploy del front.';
COMMENT ON COLUMN public.study_order_options.section_code IS
    'Ámbito sección (miscellaneous_categories.code). NULL con service_id NULL = ámbito orden.';
COMMENT ON COLUMN public.study_order_options.service_id IS
    'Ámbito línea: el modificador sólo aplica a este servicio.';
COMMENT ON COLUMN public.study_order_options.group_code IS
    'Agrupa opciones excluyentes o afines: tecnica, arcada, espesor, borde, indicacion_clinica.';
COMMENT ON COLUMN public.study_order_options.external_id IS
    'Clave de idempotencia del seed: ci-orden:opt:<code>.';

-- Nota: las 104 piezas dentarias NO se guardan acá. Son ISO 3950, un estándar
-- internacional, y se generan en el front. Sembrarlas sería inventar catálogo.

-- -----------------------------------------------------------------------------
-- 4. Tokens de auto-agendamiento del paciente
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.study_order_booking_tokens (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    study_order_id uuid        NOT NULL,
    token_hash     varchar(64) NOT NULL,
    expires_at     timestamp without time zone NOT NULL,
    max_uses       smallint    NOT NULL DEFAULT 1,
    used_count     smallint    NOT NULL DEFAULT 0,
    last_used_at   timestamp without time zone,
    revoked_at     timestamp without time zone,
    created_by     uuid,
    created_at     timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT study_order_booking_tokens_hash_key UNIQUE (token_hash),
    CONSTRAINT study_order_booking_tokens_uses_check CHECK (max_uses > 0)
);

COMMENT ON TABLE  public.study_order_booking_tokens IS
    'Link por el que el paciente elige horario para una orden concreta, sin cuenta.';
COMMENT ON COLUMN public.study_order_booking_tokens.token_hash IS
    'sha256 del token en hexadecimal. El token en claro se devuelve UNA sola vez al generarlo y nunca se guarda, igual que users.login_code del portal de pacientes.';
COMMENT ON COLUMN public.study_order_booking_tokens.max_uses IS
    'Una orden puede necesitar varias citas: con max_uses > 1 el paciente vuelve a entrar con el mismo link para agendar lo que le quedó pendiente.';

-- -----------------------------------------------------------------------------
-- 5. Columna nueva en appointments: de qué orden nació la cita
-- -----------------------------------------------------------------------------
-- Precedente directo: quote_id e invoice_id ya viven acá con el mismo criterio.
ALTER TABLE public.appointments
    ADD COLUMN IF NOT EXISTS study_order_id uuid;

COMMENT ON COLUMN public.appointments.study_order_id IS
    'Orden de estudio que originó la cita. Una orden puede tener varias citas. Qué servicios cubre cada cita NO se guarda aparte: se deriva cruzando esta columna con appointment_service_catalog, que /appointments/upsert ya mantiene.';

-- -----------------------------------------------------------------------------
-- 6. Claves foráneas (idempotentes)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_study_orders_doctor') THEN
        ALTER TABLE public.study_orders
            ADD CONSTRAINT fk_study_orders_doctor
            FOREIGN KEY (doctor_id) REFERENCES public.users (id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_study_orders_patient') THEN
        ALTER TABLE public.study_orders
            ADD CONSTRAINT fk_study_orders_patient
            FOREIGN KEY (patient_id) REFERENCES public.users (id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_study_orders_sede') THEN
        ALTER TABLE public.study_orders
            ADD CONSTRAINT fk_study_orders_sede
            FOREIGN KEY (preferred_sede_id) REFERENCES public.sedes (id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_study_order_items_order') THEN
        ALTER TABLE public.study_order_items
            ADD CONSTRAINT fk_study_order_items_order
            FOREIGN KEY (study_order_id) REFERENCES public.study_orders (id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_study_order_items_service') THEN
        ALTER TABLE public.study_order_items
            ADD CONSTRAINT fk_study_order_items_service
            FOREIGN KEY (service_id) REFERENCES public.service_catalog (id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_study_order_options_service') THEN
        ALTER TABLE public.study_order_options
            ADD CONSTRAINT fk_study_order_options_service
            FOREIGN KEY (service_id) REFERENCES public.service_catalog (id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_study_order_tokens_order') THEN
        ALTER TABLE public.study_order_booking_tokens
            ADD CONSTRAINT fk_study_order_tokens_order
            FOREIGN KEY (study_order_id) REFERENCES public.study_orders (id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_appointments_study_order') THEN
        ALTER TABLE public.appointments
            ADD CONSTRAINT fk_appointments_study_order
            FOREIGN KEY (study_order_id) REFERENCES public.study_orders (id) ON DELETE SET NULL;
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 7. Índices
-- -----------------------------------------------------------------------------
-- Mis Órdenes: siempre filtra por doctor y ordena por fecha.
CREATE INDEX IF NOT EXISTS idx_study_orders_doctor
    ON public.study_orders (doctor_id, status, created_at DESC);
-- Bandeja de la clínica: nunca muestra borradores ajenos.
CREATE INDEX IF NOT EXISTS idx_study_orders_board
    ON public.study_orders (status, submitted_at DESC) WHERE status <> 'draft';
-- El bucket "nuevas": lo primero que mira recepción al entrar.
CREATE INDEX IF NOT EXISTS idx_study_orders_pending_ack
    ON public.study_orders (submitted_at DESC) WHERE status = 'submitted' AND acknowledged_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_study_orders_patient
    ON public.study_orders (patient_id) WHERE patient_id IS NOT NULL;
-- Búsqueda por paciente con prefijo, sin depender de pg_trgm.
CREATE INDEX IF NOT EXISTS idx_study_orders_patient_name
    ON public.study_orders (lower(patient_name) varchar_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_study_order_items_order
    ON public.study_order_items (study_order_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_study_order_items_service
    ON public.study_order_items (service_id);

CREATE INDEX IF NOT EXISTS idx_study_order_options_lookup
    ON public.study_order_options (option_kind, section_code, service_id) WHERE is_active;

CREATE INDEX IF NOT EXISTS idx_appointments_study_order
    ON public.appointments (study_order_id) WHERE study_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_study_order_tokens_order
    ON public.study_order_booking_tokens (study_order_id) WHERE revoked_at IS NULL;

-- -----------------------------------------------------------------------------
-- 8. Trigger de updated_at (la función viene de 029_*.sql)
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS set_updated_at ON public.study_orders;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.study_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.study_order_items;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.study_order_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.study_order_options;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.study_order_options
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 9. Vista de la bandeja — el estado operativo se DERIVA, no se guarda
-- -----------------------------------------------------------------------------
-- Duplicar "agendada/parcialmente agendada" en una columna sería garantizar
-- drift: la verdad son las citas. Si el operario saca un servicio de una cita,
-- la línea vuelve sola a "sin agendar".
CREATE OR REPLACE VIEW public.v_study_orders_board AS
WITH item_state AS (
    SELECT i.study_order_id,
           i.id AS item_id,
           EXISTS (SELECT 1
                     FROM public.appointments a
                     JOIN public.appointment_service_catalog asc2 ON asc2.appointment_id = a.id
                    WHERE a.study_order_id = i.study_order_id
                      AND asc2.service_id  = i.service_id
                      AND a.status NOT IN ('cancelled', 'deleted', 'no_show')) AS is_scheduled,
           EXISTS (SELECT 1
                     FROM public.appointments a
                     JOIN public.appointment_service_catalog asc2 ON asc2.appointment_id = a.id
                    WHERE a.study_order_id = i.study_order_id
                      AND asc2.service_id  = i.service_id
                      AND a.status = 'completed')                              AS is_completed
      FROM public.study_order_items i
     WHERE i.is_cancelled = false
)
SELECT o.id,
       o.order_number,
       o.doctor_id,
       o.patient_id,
       o.patient_name,
       o.patient_document,
       o.patient_phone,
       o.status,
       o.preferred_sede_id,
       o.submitted_at,
       o.acknowledged_at,
       o.completed_at,
       o.created_at,
       COUNT(s.item_id)                                AS items_total,
       COUNT(*) FILTER (WHERE s.is_scheduled)          AS items_scheduled,
       COUNT(*) FILTER (WHERE s.is_completed)          AS items_completed,
       EXTRACT(epoch FROM (now() - o.submitted_at)) / 3600.0 AS hours_since_submitted,
       EXISTS (SELECT 1 FROM public.appointments a
                WHERE a.study_order_id = o.id
                  AND a.end_datetime < now()
                  AND a.status NOT IN ('completed', 'cancelled', 'deleted'))   AS has_past_due_appointment,
       CASE
           WHEN o.status = 'cancelled' THEN 'cancelled'
           WHEN o.status = 'draft'     THEN 'draft'
           WHEN o.status = 'completed' THEN 'completed'
           WHEN COUNT(s.item_id) > 0
            AND COUNT(*) FILTER (WHERE s.is_completed) = COUNT(s.item_id) THEN 'completed'
           WHEN COUNT(*) FILTER (WHERE s.is_completed) > 0                THEN 'in_progress'
           WHEN COUNT(s.item_id) > 0
            AND COUNT(*) FILTER (WHERE s.is_scheduled) = COUNT(s.item_id) THEN 'scheduled'
           WHEN COUNT(*) FILTER (WHERE s.is_scheduled) > 0                THEN 'partially_scheduled'
           WHEN o.acknowledged_at IS NULL                                 THEN 'new'
           ELSE 'unscheduled'
       END AS board_status
  FROM public.study_orders o
  LEFT JOIN item_state s ON s.study_order_id = o.id
 GROUP BY o.id;

COMMENT ON VIEW public.v_study_orders_board IS
    'Bandeja operativa. board_status resuelve los buckets que pide recepción (nueva, sin agendar, parcial, agendada, en curso, completada) a partir del estado real de las citas. El umbral de "atrasada" NO está acá: la vista expone hours_since_submitted y el endpoint aplica el SLA, para no tener que tocar la DDL si el umbral cambia.';

-- -----------------------------------------------------------------------------
-- 10. Seed del catálogo de opciones del formulario
-- -----------------------------------------------------------------------------
-- Generado por scripts/generate-study-order-options.mjs
-- Fuente: scripts/sql/orden-mapping.json (https://clinicaimagen.uy/ordenes/orden.html)
-- 42 opciones: 22 modifier · 14 text · 4 delivery · 2 region_group

INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
SELECT 'modifier', 'telerradio-frontal-analisis', 'Con analisis', 'RX-EXTRA', sc.id, NULL, 'checkbox', 0, 'ci-orden:opt:telerradio-frontal-analisis'
  FROM public.service_catalog sc WHERE sc.external_id = 'ci-orden:svc:telerradio-frontal'
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
SELECT 'modifier', 'frankfort', 'Plano de Frankfort', 'RX-EXTRA', sc.id, 'tecnica', 'checkbox', 1, 'ci-orden:opt:frankfort'
  FROM public.service_catalog sc WHERE sc.external_id = 'ci-orden:svc:telerradio-perfil'
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
SELECT 'modifier', 'horizontal-verdadero', 'Horizontal verdadero', 'RX-EXTRA', sc.id, 'tecnica', 'checkbox', 2, 'ci-orden:opt:horizontal-verdadero'
  FROM public.service_catalog sc WHERE sc.external_id = 'ci-orden:svc:telerradio-perfil'
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
SELECT 'modifier', 'labios-reposo', 'Labios en reposo', 'RX-EXTRA', sc.id, 'tecnica', 'checkbox', 3, 'ci-orden:opt:labios-reposo'
  FROM public.service_catalog sc WHERE sc.external_id = 'ci-orden:svc:telerradio-perfil'
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
SELECT 'modifier', 'labios-contacto', 'Labios en contacto', 'RX-EXTRA', sc.id, 'tecnica', 'checkbox', 4, 'ci-orden:opt:labios-contacto'
  FROM public.service_catalog sc WHERE sc.external_id = 'ci-orden:svc:telerradio-perfil'
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
SELECT 'modifier', 'mordida-constructiva', 'Mordida constructiva', 'MOD-DIG', sc.id, NULL, 'checkbox', 5, 'ci-orden:opt:mordida-constructiva'
  FROM public.service_catalog sc WHERE sc.external_id = 'ci-orden:svc:modelos-trabajo'
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
SELECT 'modifier', 'escaneo-superior', 'SUPERIOR', 'OTROS-SRV', sc.id, 'arcada', 'checkbox', 6, 'ci-orden:opt:escaneo-superior'
  FROM public.service_catalog sc WHERE sc.external_id = 'ci-orden:svc:escaneo-ortodoncia-placas'
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
SELECT 'modifier', 'escaneo-inferior', 'INFERIOR', 'OTROS-SRV', sc.id, 'arcada', 'checkbox', 7, 'ci-orden:opt:escaneo-inferior'
  FROM public.service_catalog sc WHERE sc.external_id = 'ci-orden:svc:escaneo-ortodoncia-placas'
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
SELECT 'modifier', 'escaneo-placa-75', '0.75mm', 'OTROS-SRV', sc.id, 'espesor', 'checkbox', 8, 'ci-orden:opt:escaneo-placa-75'
  FROM public.service_catalog sc WHERE sc.external_id = 'ci-orden:svc:escaneo-ortodoncia-placas'
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
SELECT 'modifier', 'escaneo-placa-1', '1mm', 'OTROS-SRV', sc.id, 'espesor', 'checkbox', 9, 'ci-orden:opt:escaneo-placa-1'
  FROM public.service_catalog sc WHERE sc.external_id = 'ci-orden:svc:escaneo-ortodoncia-placas'
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
SELECT 'modifier', 'escaneo-placa-15', '1.5mm', 'OTROS-SRV', sc.id, 'espesor', 'checkbox', 10, 'ci-orden:opt:escaneo-placa-15'
  FROM public.service_catalog sc WHERE sc.external_id = 'ci-orden:svc:escaneo-ortodoncia-placas'
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
SELECT 'modifier', 'escaneo-recto', 'RECTO', 'OTROS-SRV', sc.id, 'borde', 'checkbox', 11, 'ci-orden:opt:escaneo-recto'
  FROM public.service_catalog sc WHERE sc.external_id = 'ci-orden:svc:escaneo-ortodoncia-placas'
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
SELECT 'modifier', 'escaneo-festoneado', 'FESTONEADO', 'OTROS-SRV', sc.id, 'borde', 'checkbox', 12, 'ci-orden:opt:escaneo-festoneado'
  FROM public.service_catalog sc WHERE sc.external_id = 'ci-orden:svc:escaneo-ortodoncia-placas'
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
SELECT 'modifier', 'placas-superior', 'SUPERIOR', 'OTROS-SRV', sc.id, 'arcada', 'checkbox', 13, 'ci-orden:opt:placas-superior'
  FROM public.service_catalog sc WHERE sc.external_id = 'ci-orden:svc:placas-blanqueamiento'
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
SELECT 'modifier', 'placas-inferior', 'INFERIOR', 'OTROS-SRV', sc.id, 'arcada', 'checkbox', 14, 'ci-orden:opt:placas-inferior'
  FROM public.service_catalog sc WHERE sc.external_id = 'ci-orden:svc:placas-blanqueamiento'
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
VALUES ('modifier', 'tomo-sin-separacion', 'Sin separación de tejidos blandos', 'CONEBEAM', NULL, NULL, 'checkbox', 15, 'ci-orden:opt:tomo-sin-separacion')
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
VALUES ('modifier', 'est-tipo-implante', 'Implante', 'CONEBEAM', NULL, 'indicacion_clinica', 'checkbox', 16, 'ci-orden:opt:est-tipo-implante')
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
VALUES ('modifier', 'est-tipo-endodoncia', 'Endodoncia', 'CONEBEAM', NULL, 'indicacion_clinica', 'checkbox', 17, 'ci-orden:opt:est-tipo-endodoncia')
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
VALUES ('modifier', 'est-tipo-cirugia', 'Cirugía', 'CONEBEAM', NULL, 'indicacion_clinica', 'checkbox', 18, 'ci-orden:opt:est-tipo-cirugia')
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
VALUES ('modifier', 'est-tipo-ortodoncia', 'Ortodoncia', 'CONEBEAM', NULL, 'indicacion_clinica', 'checkbox', 19, 'ci-orden:opt:est-tipo-ortodoncia')
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
VALUES ('modifier', 'est-tipo-periodoncia', 'Periodoncia', 'CONEBEAM', NULL, 'indicacion_clinica', 'checkbox', 20, 'ci-orden:opt:est-tipo-periodoncia')
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
VALUES ('modifier', 'est-tipo-atm', 'ATM', 'CONEBEAM', NULL, 'indicacion_clinica', 'checkbox', 21, 'ci-orden:opt:est-tipo-atm')
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
VALUES ('text', 'indiacion-opt', 'Indicación de la OPT', 'RX-EXTRA', NULL, NULL, 'text', 22, 'ci-orden:opt:indiacion-opt')
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
VALUES ('text', 'estudio-cefalo-compu-otros', 'Otro estudio cefalométrico (texto libre)', 'CEFALO', NULL, NULL, 'text', 23, 'ci-orden:opt:estudio-cefalo-compu-otros')
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
VALUES ('text', 'fotografia-interes', 'Interés de la foto en dinámica', 'FOTO', NULL, NULL, 'text', 24, 'ci-orden:opt:fotografia-interes')
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
VALUES ('text', 'ortodoncia-marca', 'Marca o sistema de alineadores', 'ALINEA', NULL, NULL, 'text', 25, 'ci-orden:opt:ortodoncia-marca')
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
VALUES ('text', 'ortodoncia-info-clinica', 'Información clínica de alineadores', 'ALINEA', NULL, NULL, 'textarea', 26, 'ci-orden:opt:ortodoncia-info-clinica')
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
VALUES ('text', 'tomo-elementos-sueltos', 'Cone Beam · elementos sueltos', 'CONEBEAM', NULL, NULL, 'text', 27, 'ci-orden:opt:tomo-elementos-sueltos')
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
VALUES ('text', 'interes-estudio-tomo', 'Interés del estudio Cone Beam', 'CONEBEAM', NULL, NULL, 'textarea', 28, 'ci-orden:opt:interes-estudio-tomo')
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
VALUES ('text', 'implante-marca', 'Marca del implante', 'CIR-GUIA', NULL, NULL, 'text', 29, 'ci-orden:opt:implante-marca')
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
VALUES ('text', 'implante-ubicacion', 'Ubicación del implante', 'CIR-GUIA', NULL, NULL, 'text', 30, 'ci-orden:opt:implante-ubicacion')
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
VALUES ('text', 'implante-fecha-cirugia', 'Fecha probable de cirugía', 'CIR-GUIA', NULL, NULL, 'date', 31, 'ci-orden:opt:implante-fecha-cirugia')
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
VALUES ('text', 'eco-interes', 'Interés del estudio ecográfico', 'ECO', NULL, NULL, 'text', 32, 'ci-orden:opt:eco-interes')
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
VALUES ('text', 'solo-escaneo-interes', 'Interés del escaneo', 'OTROS-SRV', NULL, NULL, 'text', 33, 'ci-orden:opt:solo-escaneo-interes')
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
VALUES ('text', 'color-protector', 'Color del protector bucal', 'OTROS-SRV', NULL, NULL, 'text', 34, 'ci-orden:opt:color-protector')
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
VALUES ('text', 'aclaracion', 'Aclaración del profesional', NULL, NULL, NULL, 'textarea', 35, 'ci-orden:opt:aclaracion')
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
VALUES ('delivery', 'impreso', 'Impreso', NULL, NULL, NULL, 'checkbox', 36, 'ci-orden:opt:impreso')
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
VALUES ('delivery', 'imagencloud', 'Imagen Cloud', NULL, NULL, NULL, 'checkbox', 37, 'ci-orden:opt:imagencloud')
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
VALUES ('delivery', 'email-medio', 'Mail', NULL, NULL, NULL, 'checkbox', 38, 'ci-orden:opt:email-medio')
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
VALUES ('delivery', 'medcloud', 'Medcloud', NULL, NULL, NULL, 'checkbox', 39, 'ci-orden:opt:medcloud')
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
VALUES ('region_group', 'intraoral_odontogram', 'Indique región de interés', 'RX-INTRA', NULL, NULL, 'checkbox', 40, 'ci-orden:opt:intraoral_odontogram')
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
VALUES ('region_group', 'conebeam_odontogram', 'Indique región de interés', 'CONEBEAM', NULL, NULL, 'checkbox', 41, 'ci-orden:opt:conebeam_odontogram')
ON CONFLICT (external_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 11. Permisos
-- -----------------------------------------------------------------------------
INSERT INTO permissions (name, description, code, module, submenu, permission_type)
VALUES
    ('Ver Menú de Órdenes de Estudio', 'Acceder al menú de órdenes de estudio',
     'STUDY_ORDERS_VIEW_MENU', 'study_orders', 'study-orders', 'view'),
    ('Ver Mis Órdenes', 'Ver únicamente las órdenes que el propio doctor derivó',
     'STUDY_ORDERS_VIEW_MINE', 'study_orders', 'study-orders', 'view'),
    ('Ver Todas las Órdenes', 'Ver la bandeja con las órdenes de todos los derivadores',
     'STUDY_ORDERS_VIEW_ALL', 'study_orders', 'study-orders', 'view'),
    ('Ver Detalle de Orden', 'Abrir el detalle de una orden de estudio',
     'STUDY_ORDERS_VIEW_DETAIL', 'study_orders', 'study-orders', 'view'),
    ('Crear Orden de Estudio', 'Crear una orden de estudio en borrador',
     'STUDY_ORDERS_CREATE', 'study_orders', 'study-orders', 'write'),
    ('Crear Orden en Nombre de un Doctor', 'Cargar una orden que llegó por teléfono, a nombre de otro derivador',
     'STUDY_ORDERS_CREATE_FOR_DOCTOR', 'study_orders', 'study-orders', 'write'),
    ('Editar Orden de Estudio', 'Modificar una orden en borrador',
     'STUDY_ORDERS_UPDATE', 'study_orders', 'study-orders', 'write'),
    ('Eliminar Orden de Estudio', 'Eliminar una orden en borrador',
     'STUDY_ORDERS_DELETE', 'study_orders', 'study-orders', 'delete'),
    ('Enviar Orden a la Clínica', 'Enviar la orden y dejarla inmutable',
     'STUDY_ORDERS_SUBMIT', 'study_orders', 'study-orders', 'write'),
    ('Anular Orden de Estudio', 'Anular una orden ya enviada, con motivo',
     'STUDY_ORDERS_CANCEL', 'study_orders', 'study-orders', 'write'),
    ('Tomar Orden de Estudio', 'Marcar la orden como recibida por la clínica',
     'STUDY_ORDERS_ACKNOWLEDGE', 'study_orders', 'study-orders', 'write'),
    ('Agendar Orden de Estudio', 'Crear citas a partir de una orden',
     'STUDY_ORDERS_SCHEDULE', 'study_orders', 'study-orders', 'write'),
    ('Compartir Link de Agenda', 'Generar el link para que el paciente elija horario',
     'STUDY_ORDERS_SHARE_LINK', 'study_orders', 'study-orders', 'write'),
    ('Buscar Pacientes para Orden', 'Buscar y dar de alta pacientes desde el formulario de orden, sin acceso al padrón completo',
     'STUDY_ORDERS_SEARCH_PATIENT', 'study_orders', 'study-orders', 'view')
ON CONFLICT (code) DO NOTHING;

-- Administrador (4) y Gerente (37): todo.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.id
FROM (VALUES (4), (37)) AS r(role_id)
CROSS JOIN permissions p
WHERE p.code LIKE 'STUDY_ORDERS_%'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Doctor (2): sólo lo suyo. Sin VIEW_ALL, para que no vea derivaciones de colegas.
-- SEARCH_PATIENT le permite resolver/crear el paciente de su orden sin darle
-- PATIENTS_VIEW_LIST, que le abriría el padrón completo de la clínica.
INSERT INTO role_permissions (role_id, permission_id)
SELECT 2, p.id FROM permissions p
WHERE p.code IN (
    'STUDY_ORDERS_VIEW_MENU',
    'STUDY_ORDERS_VIEW_MINE',
    'STUDY_ORDERS_VIEW_DETAIL',
    'STUDY_ORDERS_CREATE',
    'STUDY_ORDERS_UPDATE',
    'STUDY_ORDERS_DELETE',
    'STUDY_ORDERS_SUBMIT',
    'STUDY_ORDERS_SEARCH_PATIENT'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Recepcionista (8): la bandeja operativa completa, menos borrar.
INSERT INTO role_permissions (role_id, permission_id)
SELECT 8, p.id FROM permissions p
WHERE p.code IN (
    'STUDY_ORDERS_VIEW_MENU',
    'STUDY_ORDERS_VIEW_ALL',
    'STUDY_ORDERS_VIEW_DETAIL',
    'STUDY_ORDERS_CREATE',
    'STUDY_ORDERS_CREATE_FOR_DOCTOR',
    'STUDY_ORDERS_UPDATE',
    'STUDY_ORDERS_SUBMIT',
    'STUDY_ORDERS_CANCEL',
    'STUDY_ORDERS_ACKNOWLEDGE',
    'STUDY_ORDERS_SCHEDULE',
    'STUDY_ORDERS_SHARE_LINK',
    'STUDY_ORDERS_SEARCH_PATIENT'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 12. Chequeo informativo: tipos de notificación
-- -----------------------------------------------------------------------------
-- Las fases 2 y 3 insertan en public.notifications los tipos study_order_submitted
-- y study_order_results_ready. Si esa columna tiene un CHECK cerrado, hay que
-- ampliarlo. No lo tocamos a ciegas: sólo avisamos.
DO $$
DECLARE con_def text;
BEGIN
    IF to_regclass('public.notifications') IS NULL THEN
        RAISE NOTICE '[study-orders] No existe public.notifications: revisar antes de la fase 2.';
        RETURN;
    END IF;
    SELECT pg_get_constraintdef(oid) INTO con_def
      FROM pg_constraint
     WHERE conrelid = 'public.notifications'::regclass
       AND contype  = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%type%'
     LIMIT 1;
    IF con_def IS NOT NULL AND con_def NOT ILIKE '%study_order%' THEN
        RAISE NOTICE '[study-orders] notifications tiene un CHECK sobre type que no admite los tipos nuevos. Ampliarlo antes de la fase 2. Definición actual: %', con_def;
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 13. Registro de migración
-- -----------------------------------------------------------------------------
INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '071_20260906_study-orders.sql',
    'v1',
    'Órdenes de estudio — study_orders, study_order_items, study_order_options, study_order_booking_tokens, appointments.study_order_id, vista v_study_orders_board y permisos STUDY_ORDERS_*'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;

-- =============================================================================
-- Rollback manual
-- =============================================================================
-- BEGIN;
-- DROP VIEW  IF EXISTS public.v_study_orders_board;
-- ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS fk_appointments_study_order;
-- DROP INDEX IF EXISTS public.idx_appointments_study_order;
-- ALTER TABLE public.appointments DROP COLUMN IF EXISTS study_order_id;
-- DROP TABLE IF EXISTS public.study_order_booking_tokens;
-- DROP TABLE IF EXISTS public.study_order_options;
-- DROP TABLE IF EXISTS public.study_order_items;
-- DROP TABLE IF EXISTS public.study_orders;
-- DROP SEQUENCE IF EXISTS public.study_orders_number_seq;
-- DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE code LIKE 'STUDY_ORDERS_%');
-- DELETE FROM permissions WHERE code LIKE 'STUDY_ORDERS_%';
-- DELETE FROM public.db_migrations WHERE script_name = '071_20260906_study-orders.sql';
-- COMMIT;
