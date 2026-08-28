-- =====================================================================
-- Mecanismo de Customizaciones (Event Handlers estilo Openbravo)
--
-- PROBLEMA QUE RESUELVE
--   Hoy, cuando un cliente necesita un comportamiento propio (mandar un
--   WhatsApp al facturar, recalcular descuentos con su propia regla, validar
--   algo antes de guardar), hay que bifurcar el flujo n8n común. Eso obliga a
--   replicar cada fix en todas las variantes.
--
--   Con este mecanismo el flujo común queda IDÉNTICO en todas las
--   instalaciones y, en puntos definidos, invoca un sub-workflow dispatcher
--   genérico que consulta aquí qué customizaciones hay registradas para ese
--   evento y las ejecuta en orden. Si el cliente no tiene nada registrado el
--   flujo se comporta exactamente igual que antes: ésa es la propiedad de
--   seguridad que hace viable instrumentar los flujos en producción.
--
-- PIEZAS
--   1. public.hook_events        → el CATÁLOGO: qué puntos de extensión ofrece
--                                  el producto. Es documentación ejecutable.
--   2. public.hook_registry      → las IMPLEMENTACIONES: qué sub-workflow n8n
--                                  se engancha a qué evento, en qué orden y con
--                                  qué política de errores. Varía por cliente.
--   3. public.hook_execution_log → la TRAZA: qué corrió, cuánto tardó y qué
--                                  devolvió. Sin esto, depurar por qué un
--                                  cliente se comporta distinto es un infierno.
--
--   Además: la función prune_hook_execution_log() para podar la traza, el
--   catálogo inicial de 3 eventos, y los permisos CUSTOMIZATIONS_*.
--
-- CONTRATO DEL ENVELOPE (v1) — lo que recibe un hook y lo que debe devolver.
--   Está documentado en docs/hooks-mechanism.md y NO debe cambiarse sin subir
--   hook_envelope_version; si los nombres o los payloads cambian cada dos
--   meses, las customizaciones de cada cliente se rompen y volvemos al
--   mantenimiento que queríamos evitar.
--
--     ENTRADA → { hook_envelope_version, event_code, timing, payload, context,
--                 config, registry_id, depth, hook_path }
--     SALIDA  ← { ok, patch, message, data }
--
-- LO QUE ESTE SCRIPT NO HACE
--   No inserta ninguna fila en hook_registry. Los handler_ref son IDs de
--   workflow de n8n, que son propios de cada instalación: una registración
--   exportada de un cliente no significa nada en otro. Se cargan desde la
--   ventana Sistema → Customizaciones.
--
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- Depende de: 068_20260814_clinic-preferences-and-discounts.sql
--             (y de la función update_updated_at_column(), creada en 029)
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Catálogo de eventos
--
--    Producto, no cliente: describe los puntos de extensión que los flujos
--    comunes están dispuestos a ofrecer. El `code` es una constante que vive
--    embebida en el JSON del flujo, así que renombrarlo rompe el flujo.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hook_events (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(80)  NOT NULL UNIQUE,
    name            TEXT         NOT NULL,
    description     TEXT,
    module          VARCHAR(40)  NOT NULL DEFAULT 'core',
    timing          VARCHAR(10)  NOT NULL
                    CHECK (timing IN ('before', 'after')),
    payload_schema  JSONB        NOT NULL DEFAULT '{}'::jsonb,
    payload_version INTEGER      NOT NULL DEFAULT 1,
    is_system       BOOLEAN      NOT NULL DEFAULT true,
    is_active       BOOLEAN      NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- El formato del code se fuerza para que el catálogo no derive en texto libre:
-- <entidad>.<before|after>_<accion>, todo en minúsculas.
ALTER TABLE public.hook_events DROP CONSTRAINT IF EXISTS hook_events_code_format_check;
ALTER TABLE public.hook_events ADD CONSTRAINT hook_events_code_format_check
    CHECK (code ~ '^[a-z][a-z0-9_]*\.(before|after)_[a-z0-9_]+$');

CREATE INDEX IF NOT EXISTS idx_hook_events_module
    ON public.hook_events (module, code);

DROP TRIGGER IF EXISTS set_updated_at ON public.hook_events;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.hook_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE  public.hook_events                 IS 'Catálogo de puntos de extensión (hooks) que ofrecen los flujos comunes de n8n. Producto, no cliente: las implementaciones viven en hook_registry.';
COMMENT ON COLUMN public.hook_events.code            IS 'Identificador estable del evento: <entidad>.<before|after>_<accion>, p.ej. ''invoice.after_upsert''. Es una constante embebida en el JSON del flujo n8n que lo dispara: renombrarlo rompe el flujo. Destino de la FK de hook_registry.';
COMMENT ON COLUMN public.hook_events.module          IS 'Agrupador para la UI: ''billing'', ''appointments'', ''core''… Sólo presentación.';
COMMENT ON COLUMN public.hook_events.timing          IS '''before'' ⇒ corre antes de escribir y su patch puede modificar el payload o abortar la operación. ''after'' ⇒ corre después de commitear y su retorno se ignora.';
COMMENT ON COLUMN public.hook_events.payload_schema  IS 'DOCUMENTACIÓN del contrato del payload (JSON-Schema-ish), renderizado por la ventana Customizaciones. El dispatcher NO valida contra él en v1: es un acuerdo entre quien instrumenta el flujo y quien escribe el hook.';
COMMENT ON COLUMN public.hook_events.payload_version IS 'Se sube cuando el payload cambia de forma incompatible. Los hooks lo reciben en el envelope y pueden ramificar por él.';
COMMENT ON COLUMN public.hook_events.is_system       IS 'true ⇒ evento entregado por el producto: la UI no deja borrarlo ni cambiarle el code ni el timing (sí la descripción y el payload_schema). Los eventos que crea el usuario entran con false y son borrables.';

-- ---------------------------------------------------------------------------
-- 2. Registro de implementaciones
--
--    Esto es lo que varía por cliente. Una fila = "cuando pase X, ejecutá el
--    sub-workflow n8n Y". El dispatcher lee esta tabla en cada disparo.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hook_registry (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    event_code   VARCHAR(80) NOT NULL
                 REFERENCES public.hook_events (code)
                 ON UPDATE CASCADE ON DELETE RESTRICT,
    clinic_id    INTEGER     REFERENCES public.clinic (id) ON DELETE CASCADE,
    name         TEXT        NOT NULL,
    description  TEXT,
    handler_type VARCHAR(20) NOT NULL DEFAULT 'n8n_workflow'
                 CHECK (handler_type IN ('n8n_workflow', 'http', 'js')),
    handler_ref  TEXT        NOT NULL,
    seq          INTEGER     NOT NULL DEFAULT 100
                 CHECK (seq BETWEEN 0 AND 9999),
    mode         VARCHAR(10) NOT NULL DEFAULT 'sync'
                 CHECK (mode IN ('sync', 'async')),
    on_error     VARCHAR(10) NOT NULL DEFAULT 'ignore'
                 CHECK (on_error IN ('ignore', 'fail')),
    timeout_ms   INTEGER     NOT NULL DEFAULT 30000
                 CHECK (timeout_ms BETWEEN 1000 AND 300000),
    config       JSONB       NOT NULL DEFAULT '{}'::jsonb,
    log_enabled  BOOLEAN     NOT NULL DEFAULT true,
    is_active    BOOLEAN     NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by   UUID        REFERENCES public.users (id) ON DELETE SET NULL,
    updated_by   UUID        REFERENCES public.users (id) ON DELETE SET NULL
);

-- El índice que usa el dispatcher en CADA disparo de un evento instrumentado.
CREATE INDEX IF NOT EXISTS idx_hook_registry_lookup
    ON public.hook_registry (event_code, is_active, seq);

-- Un mismo sub-workflow no puede quedar registrado dos veces en el mismo evento
-- y ámbito. COALESCE porque NULL nunca colisiona consigo mismo en un UNIQUE.
CREATE UNIQUE INDEX IF NOT EXISTS uq_hook_registry_event_handler
    ON public.hook_registry (event_code, handler_ref, COALESCE(clinic_id, -1));

DROP TRIGGER IF EXISTS set_updated_at ON public.hook_registry;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.hook_registry
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE  public.hook_registry              IS 'Implementaciones de hooks: qué sub-workflow n8n se engancha a qué evento del catálogo. ESTO es lo que varía entre clientes. Sin filas aquí, los flujos comunes se comportan exactamente como antes de instrumentarlos.';
COMMENT ON COLUMN public.hook_registry.event_code   IS 'Evento del catálogo al que se engancha. ON DELETE RESTRICT: no se puede borrar un evento que todavía tiene implementaciones.';
COMMENT ON COLUMN public.hook_registry.clinic_id    IS 'NULL ⇒ aplica a toda la instalación (el caso normal hoy, porque la multi-tenencia es por deployment). Existe para no tener que migrar con datos en producción el día que una instalación sirva a varias clínicas. La UI no lo expone en v1.';
COMMENT ON COLUMN public.hook_registry.handler_type IS 'El CHECK ya admite ''http'' y ''js'' para poder crecer sin DDL, pero v1 SÓLO acepta ''n8n_workflow'': lo rechazan el schema Zod de la página y el nodo Validar del webhook, y el dispatcher filtra por él en su SELECT.';
COMMENT ON COLUMN public.hook_registry.handler_ref  IS 'ID del sub-workflow n8n a ejecutar (el que aparece en la URL /workflow/<id>). Es propio de cada instalación: una registración exportada de un cliente no sirve en otro. Por eso esta tabla no lleva datos semilla.';
COMMENT ON COLUMN public.hook_registry.seq          IS 'Orden de ejecución dentro del mismo evento, ascendente. Cada hook ve el payload ya parcheado por los de seq menor.';
COMMENT ON COLUMN public.hook_registry.mode         IS '''sync'' ⇒ el flujo llamante espera a que el hook termine (obligatorio en eventos ''before'': un hook asíncrono no puede devolver un patch). ''async'' ⇒ se dispara y se sigue; su retorno se descarta.';
COMMENT ON COLUMN public.hook_registry.on_error     IS '''ignore'' ⇒ el fallo del hook se registra y el flujo continúa (lo correcto para casi todo hook ''after''). ''fail'' ⇒ el dispatcher aborta y propaga el error al flujo llamante.';
COMMENT ON COLUMN public.hook_registry.timeout_ms   IS 'ORIENTATIVO: n8n no permite acotar por tiempo una llamada a sub-workflow desde el nodo que la hace. Es una pista contractual que se espera que el hook respete; si hace falta cortar de verdad, se configura settings.executionTimeout en el workflow del hook.';
COMMENT ON COLUMN public.hook_registry.config       IS 'Parámetros de esta registración concreta (destinatarios, umbrales, flags). Llega al hook en el campo `config` del envelope, sin interpretar.';
COMMENT ON COLUMN public.hook_registry.log_enabled  IS 'false ⇒ no se escribe en hook_execution_log. Válvula de escape para hooks colgados de eventos de alta frecuencia, que si no inundan la traza.';

-- ---------------------------------------------------------------------------
-- 3. Traza de ejecución
--
--    NOTA sobre la PK: se rompe a propósito el convenio UUID de las tablas
--    nuevas. Ésta es append-only, de alto volumen y se lee siempre en orden
--    temporal; un bigint monotónico mantiene el índice denso y evita la
--    fragmentación que produciría un uuid aleatorio.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hook_execution_log (
    id               BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_code       VARCHAR(80) NOT NULL,
    registry_id      UUID        REFERENCES public.hook_registry (id) ON DELETE SET NULL,
    handler_ref      TEXT,
    status           VARCHAR(10) NOT NULL
                     CHECK (status IN ('success', 'error', 'skipped')),
    depth            INTEGER     NOT NULL DEFAULT 0,
    duration_ms      INTEGER,
    input            JSONB,
    output           JSONB,
    error_message    TEXT,
    correlation_id   TEXT,
    n8n_execution_id TEXT,
    executed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hook_execution_log_time
    ON public.hook_execution_log (executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_hook_execution_log_event
    ON public.hook_execution_log (event_code, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_hook_execution_log_errors
    ON public.hook_execution_log (executed_at DESC) WHERE status = 'error';

COMMENT ON TABLE  public.hook_execution_log                  IS 'Traza de cada ejecución de hook. Append-only. Es lo que permite responder "por qué este cliente hizo algo distinto" sin abrir n8n.';
COMMENT ON COLUMN public.hook_execution_log.handler_ref      IS 'Desnormalizado a propósito: cuando se borra la registración, la fila del log sigue diciendo QUÉ workflow corrió.';
COMMENT ON COLUMN public.hook_execution_log.status           IS '''success'' | ''error'' | ''skipped''. ''skipped'' se usa cuando el dispatcher no llegó a ejecutar por el guard de profundidad o de ciclo.';
COMMENT ON COLUMN public.hook_execution_log.depth            IS 'Profundidad de anidamiento de hooks. El dispatcher corta en 5.';
COMMENT ON COLUMN public.hook_execution_log.input            IS 'Envelope enviado al hook, truncado por el dispatcher a ~8 KB de JSON.';
COMMENT ON COLUMN public.hook_execution_log.output           IS 'Lo que devolvió el hook, truncado igual que input.';
COMMENT ON COLUMN public.hook_execution_log.correlation_id   IS 'Hilo común entre todos los hooks disparados por una misma operación de negocio.';

-- Poda. Deliberadamente una función a demanda y no un DELETE probabilístico
-- dentro del dispatcher: la ruta caliente del dispatcher no debe hacer trabajo
-- de mantenimiento. Se llama desde cualquier flujo n8n con schedule trigger.
CREATE OR REPLACE FUNCTION public.prune_hook_execution_log(retention_days INTEGER DEFAULT 30)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
    deleted BIGINT;
BEGIN
    DELETE FROM public.hook_execution_log
     WHERE executed_at < now() - (retention_days || ' days')::interval;
    GET DIAGNOSTICS deleted = ROW_COUNT;
    RETURN deleted;
END;
$$;

COMMENT ON FUNCTION public.prune_hook_execution_log(INTEGER) IS 'Borra las filas de hook_execution_log más viejas que retention_days y devuelve cuántas borró. Hay que agendarla: si nadie la llama, la tabla crece sin límite.';

-- ---------------------------------------------------------------------------
-- 4. Catálogo inicial
--
--    Tres eventos, elegidos para cubrir las dos temporalidades y dos módulos.
--    Agregar uno nuevo es SIEMPRE: (1) una migración que inserta aquí,
--    (2) intercalar el nodo dispatcher en el flujo, (3) documentar el payload
--    en docs/hooks-mechanism.md. Ver el runbook en ese documento.
-- ---------------------------------------------------------------------------
INSERT INTO public.hook_events (code, name, description, module, timing, payload_version, payload_schema)
VALUES
    (
        'invoice.before_upsert',
        'Antes de crear/editar factura',
        'Se dispara al inicio de invoices/upsert, antes de cualquier escritura. El patch que devuelva el hook reescribe el cuerpo de la factura; devolver ok:false en una implementación con on_error=''fail'' rechaza la operación. Punto natural para reglas de negocio propias del cliente ("no facturar sin obra social", "forzar la sede del doctor").',
        'billing',
        'before',
        1,
        '{
            "type": "object",
            "properties": {
                "id":             { "type": ["integer","null"], "description": "null = alta" },
                "user_id":        { "type": "string",  "format": "uuid", "description": "Paciente" },
                "order_id":       { "type": ["integer","null"] },
                "doctor_id":      { "type": ["string","null"],  "format": "uuid" },
                "sede_id":        { "type": ["integer","null"] },
                "currency":       { "type": "string" },
                "due_date":       { "type": ["string","null"],  "format": "date" },
                "notes":          { "type": ["string","null"] },
                "total":          { "type": "number",  "description": "NETO (descuento ya aplicado)" },
                "gross_total":    { "type": ["number","null"] },
                "discount_scope": { "type": ["string","null"], "enum": ["line","total",null] },
                "discount_mode":  { "type": ["string","null"], "enum": ["percent","amount",null] },
                "discount_value": { "type": ["number","null"] },
                "items": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id":             { "type": ["integer","null"] },
                            "service_id":     { "type": "integer" },
                            "quantity":       { "type": "integer" },
                            "unit_price":     { "type": "number" },
                            "total":          { "type": "number", "description": "NETO" },
                            "gross_total":    { "type": ["number","null"] },
                            "discount_mode":  { "type": ["string","null"] },
                            "discount_value": { "type": ["number","null"] }
                        }
                    }
                }
            }
        }'::jsonb
    ),
    (
        'invoice.after_upsert',
        'Después de crear/editar factura',
        'Se dispara al final de invoices/upsert, con la factura y sus líneas ya escritas y los totales consolidados. El retorno no altera la factura (para eso está invoice.before_upsert): sirve para efectos laterales — notificar, sincronizar con un tercero, recalcular campos derivados. IMPORTANTE: corre FUERA de la transacción del flujo llamante, así que un hook de este evento debe ser idempotente y seguro de re-ejecutar.',
        'billing',
        'after',
        1,
        '{
            "type": "object",
            "required": ["invoice_id", "is_update"],
            "properties": {
                "invoice_id":     { "type": "integer", "description": "invoices.id (autoincremental, NO uuid)" },
                "doc_no":         { "type": "string" },
                "is_update":      { "type": "boolean", "description": "false = alta, true = edición" },
                "user_id":        { "type": "string",  "format": "uuid", "description": "Paciente" },
                "order_id":       { "type": ["integer","null"] },
                "doctor_id":      { "type": ["string","null"],  "format": "uuid" },
                "sede_id":        { "type": ["integer","null"] },
                "currency":       { "type": "string" },
                "status":         { "type": "string" },
                "total":          { "type": "number", "description": "NETO. Debe seguir cuadrando con SUM(invoice_items.total)" },
                "gross_total":    { "type": ["number","null"] },
                "discount_scope": { "type": ["string","null"], "enum": ["line","total",null] },
                "item_ids":       { "type": "array", "items": { "type": "integer" } }
            }
        }'::jsonb
    ),
    (
        'appointment.after_create',
        'Después de crear cita',
        'Se dispara al confirmarse el alta de una cita, tanto desde la agenda del staff como desde el portal del paciente o el agente de IA. El campo context.source distingue el origen. Punto habitual para recordatorios propios del cliente o sincronización con calendarios externos.',
        'appointments',
        'after',
        1,
        '{
            "type": "object",
            "required": ["appointment_id"],
            "properties": {
                "appointment_id": { "type": "integer" },
                "user_id":        { "type": "string",  "format": "uuid", "description": "Paciente" },
                "doctor_id":      { "type": ["string","null"],  "format": "uuid" },
                "calendar_id":    { "type": ["integer","null"] },
                "sede_id":        { "type": ["integer","null"] },
                "service_id":     { "type": ["integer","null"] },
                "start_time":     { "type": "string", "format": "date-time", "description": "ISO UTC" },
                "end_time":       { "type": "string", "format": "date-time", "description": "ISO UTC" },
                "status":         { "type": "string" },
                "created_by":     { "type": ["string","null"], "format": "uuid" },
                "source":         { "type": "string", "enum": ["staff","portal","ai"] }
            }
        }'::jsonb
    )
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. Permisos
--
--    Sólo Administrador (rol 4). Se excluye deliberadamente a Gerente (37),
--    que sí tiene el resto de la configuración: registrar aquí un hook es
--    inyectar código que corre dentro de una operación de facturación, no una
--    tarea de gestión. En esta BD no existe un rol "super administrador"
--    separado; Administrador es el tope.
--
--    CUSTOMIZATIONS_EVENTS_MANAGE va aparte del resto porque definir un tipo
--    de evento nuevo es más sensible que enganchar una implementación a uno
--    que ya existe.
-- ---------------------------------------------------------------------------
INSERT INTO public.permissions (name, description, code, module, submenu, permission_type)
VALUES
    ('Ver Customizaciones',
     'Ver la entrada Customizaciones en el menú de Sistema',
     'CUSTOMIZATIONS_VIEW_MENU',     'system', 'customizations', 'view'),

    ('Listar Customizaciones',
     'Acceder al catálogo de eventos y a sus implementaciones registradas',
     'CUSTOMIZATIONS_VIEW_LIST',     'system', 'customizations', 'view'),

    ('Crear Implementación de Hook',
     'Registrar un sub-workflow n8n como implementación de un evento',
     'CUSTOMIZATIONS_CREATE',        'system', 'customizations', 'create'),

    ('Editar Implementación de Hook',
     'Modificar una implementación registrada: orden, modo, política de errores, activarla o desactivarla',
     'CUSTOMIZATIONS_UPDATE',        'system', 'customizations', 'update'),

    ('Eliminar Implementación de Hook',
     'Dar de baja una implementación registrada',
     'CUSTOMIZATIONS_DELETE',        'system', 'customizations', 'delete'),

    ('Gestionar Tipos de Hook',
     'Crear, editar o eliminar definiciones de eventos del catálogo. Más sensible que registrar una implementación: define el contrato que consumen los flujos',
     'CUSTOMIZATIONS_EVENTS_MANAGE', 'system', 'customizations', 'update')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 4, p.id
FROM public.permissions p
WHERE p.code LIKE 'CUSTOMIZATIONS_%'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6. Registro de migración
-- ---------------------------------------------------------------------------
INSERT INTO public.db_migrations (script_name, version_tag, notes)
VALUES (
    '069_20260828_hooks-registry-and-permissions.sql',
    'v1',
    'Mecanismo de Customizaciones (Event Handlers): hook_events / hook_registry / hook_execution_log, prune_hook_execution_log(), catálogo inicial de 3 eventos y permisos CUSTOMIZATIONS_*'
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
-- DELETE FROM public.role_permissions rp USING public.permissions p
--   WHERE rp.permission_id = p.id AND p.code LIKE 'CUSTOMIZATIONS_%';
-- DELETE FROM public.permissions WHERE code LIKE 'CUSTOMIZATIONS_%';
--
-- DROP FUNCTION IF EXISTS public.prune_hook_execution_log(INTEGER);
-- DROP TABLE IF EXISTS public.hook_execution_log;
-- DROP TABLE IF EXISTS public.hook_registry;
-- DROP TABLE IF EXISTS public.hook_events;
--
-- DELETE FROM public.db_migrations WHERE script_name = '069_20260828_hooks-registry-and-permissions.sql';
-- COMMIT;
