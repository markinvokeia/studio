-- =====================================================================
-- DEMO — Órdenes de laboratorio: datos de prueba para presentar el módulo
-- Run on: local / dev ÚNICAMENTE. Nunca en staging, clientes ni prod.
-- NO es una migración: no lleva número ni va a database/scripts/ ni a
-- scripts/seed/ (Liquibase lo correría solo y las fechas quedarían viejas).
-- =====================================================================
--
-- Cuándo correrlo: el día de la presentación, poco antes. Todas las fechas
-- son relativas a HOY (hora de Montevideo): "días en la etapa", atrasos y
-- vencimientos se ven bien solo si se corre cerca de la demo.
--
-- Re-ejecutable: al empezar borra lo que haya dejado una corrida anterior
-- de este mismo script (y nada más). Para sacarlo del todo:
-- database/demo/lab-orders-demo-cleanup.sql.
--
-- Requiere: scripts 147–150 y 167–174 aplicados.
--
-- Qué arma
-- ────────
-- 1. Categorías de laboratorio (grupos de proveedores con is_lab_category):
--      Prótesis fija · Prótesis removible · Ortodoncia y placas
--    con laboratorios que ya existen como proveedores (si falta alguno, se
--    salta). Los servicios de laboratorio sin categoría reciben una.
-- 2. Circuito de 6 etapas (las 3 precargadas se conservan):
--      Solicitud creada / Toma de impresión  inicial, atraso a los 3 días
--      Enviado al laboratorio / En progreso  atraso a los 7 días (ya estaba)
--      Prueba en boca                        nueva, atraso a los 5 días
--      Recibido en clínica                   nueva, atraso a los 4 días,
--                                            ALERTA AL ENTRAR → doctor
--      Completado                            final (ya estaba)
--      Cancelado                             final, nueva
--    + alertas: permanencia en "Prueba en boca" (una vez) y entrega
--    vencida en las dos etapas nuevas, al doctor, en el sistema.
-- 3. 22 órdenes con su historial completo (quién movió, cuándo, notas),
--    pensadas para mostrar cada cosa:
--      · recién creadas sin laboratorio, una URGENTE
--      · una "olvidada" en la etapa inicial (atrasada por permanencia)
--      · vence mañana / vence hoy / vencida hace 2 días
--      · atrasada en "Enviado" (más de 7 días)
--      · una que fue y volvió del laboratorio (prueba → ajuste → prueba)
--      · recibidas en la clínica esperando la colocación, una atrasada
--      · completadas hace 2–24 días y una hace 55 (fuera de la ventana de
--        30 días del tablero: aparece al elegir "Últimos 90 días")
--      · dos canceladas, con el motivo en el historial
--      · una solo con descripción (alineadores), sin servicio del catálogo
--
-- Para el momento "en vivo" de la demo
-- ────────────────────────────────────
--  · Claudia Etchegaray Cardozo — Corona de zirconio 36, en "Enviado", vence
--    HOY. Arrastrarla a "Recibido en clínica" dispara la alerta al entrar:
--    le llega la notificación a su doctor (Dr. Martín Rodríguez) y aparece
--    en /alerts.
--  · Las alertas por permanencia y por entrega vencida las genera el Alert
--    Scheduler (una vez por día). Para mostrarlas sin esperar: /alert-rules
--    → LAB_STAGE_OVERDUE y LAB_ORDER_PAST_DUE → "Ejecutar ahora".
--    Ojo: también las genera para las órdenes reales que estén atrasadas.
--  · Este script NO crea alertas ni notificaciones, ni manda nada: los
--    avisos solo salen por el flujo y el Scheduler, como en producción.
--
-- Pacientes, doctores, recepcionistas y laboratorios se buscan por nombre
-- entre los que YA existen (en DEV hay datos ficticios). Si falta un
-- paciente, esa orden se salta; si falta un doctor o una recepcionista, se
-- usa otro de su rol. Al final se informa qué se creó y qué se salteó.
-- =====================================================================

BEGIN;

-- ─── Registro de lo que crea / cambia el demo ────────────────────────────────
-- old_value guarda el valor anterior de lo que se modifica, para restaurarlo.

CREATE TABLE IF NOT EXISTS public.demo_seed_rows (
    seed        text        NOT NULL,
    table_name  text        NOT NULL,
    row_key     text        NOT NULL,
    old_value   jsonb,
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (seed, table_name, row_key)
);

COMMENT ON TABLE public.demo_seed_rows IS
    'Filas creadas o modificadas por scripts de demo (database/demo/). Solo DEV/local; las usan las funciones de limpieza.';

-- ─── Limpieza (también la usa lab-orders-demo-cleanup.sql) ───────────────────

CREATE OR REPLACE FUNCTION public.demo_lab_orders_cleanup()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
    c_seed   constant text := 'lab_orders_demo';
    v_ids    integer[];
    v_row    record;
    v_orders integer := 0;
    v_kept   integer := 0;
BEGIN
    -- 1. Órdenes (items e historial caen en cascada). También lo que se haya
    --    generado sobre ellas durante la demo: avisos y notificaciones.
    SELECT array_agg(d.row_key::integer) INTO v_ids
    FROM public.demo_seed_rows d
    WHERE d.seed = c_seed AND d.table_name = 'lab_orders';

    IF v_ids IS NOT NULL THEN
        DELETE FROM public.notifications n
        WHERE n.type = 'lab_order_alert'
          AND n.metadata->>'lab_order_id' = ANY (v_ids::text[]);

        DELETE FROM public.alert_instances ai
        WHERE ai.reference_table = 'lab_orders'
          AND ai.reference_id = ANY (v_ids::text[]);

        DELETE FROM public.lab_orders o WHERE o.id = ANY (v_ids);
        GET DIAGNOSTICS v_orders = ROW_COUNT;
    END IF;

    -- 2. Alertas de etapa creadas por el demo.
    DELETE FROM public.lab_stage_alerts a
    USING public.demo_seed_rows d
    WHERE d.seed = c_seed AND d.table_name = 'lab_stage_alerts'
      AND a.id = d.row_key::integer;

    -- 3. Etapas creadas por el demo. Si durante la demo se dejó ahí una orden
    --    real (o quedó en su historial), no se puede borrar: se desactiva.
    FOR v_row IN
        SELECT s.id, s.name FROM public.lab_stages s
        JOIN public.demo_seed_rows d
          ON d.seed = c_seed AND d.table_name = 'lab_stages' AND d.row_key = s.id::text
    LOOP
        IF EXISTS (SELECT 1 FROM public.lab_orders o WHERE o.current_stage_id = v_row.id)
           OR EXISTS (SELECT 1 FROM public.lab_order_stage_history h
                      WHERE h.to_stage_id = v_row.id OR h.from_stage_id = v_row.id) THEN
            UPDATE public.lab_stages SET is_active = false, updated_at = now() WHERE id = v_row.id;
            v_kept := v_kept + 1;
            RAISE NOTICE 'La etapa "%" tiene órdenes que no son del demo: se desactivó en lugar de borrarla.', v_row.name;
        ELSE
            DELETE FROM public.lab_stages WHERE id = v_row.id;
        END IF;
    END LOOP;

    -- 4. Etapas existentes que el demo modificó: vuelven a su valor anterior.
    UPDATE public.lab_stages s
    SET sort_order   = (d.old_value->>'sort_order')::integer,
        overdue_days = NULLIF(d.old_value->>'overdue_days', '')::integer,
        is_active    = COALESCE((d.old_value->>'is_active')::boolean, s.is_active),
        updated_at   = now()
    FROM public.demo_seed_rows d
    WHERE d.seed = c_seed AND d.table_name = 'lab_stages.update'
      AND s.id = d.row_key::integer;

    -- 5. Servicios: categoría anterior (NULL).
    UPDATE public.service_catalog sc
    SET lab_category_id = NULLIF(d.old_value->>'lab_category_id', '')::uuid
    FROM public.demo_seed_rows d
    WHERE d.seed = c_seed AND d.table_name = 'service_catalog.lab_category_id'
      AND sc.id = d.row_key::integer;

    -- 6. Laboratorios en categorías y categorías.
    DELETE FROM public.group_provider gp
    USING public.demo_seed_rows d
    WHERE d.seed = c_seed AND d.table_name = 'group_provider'
      AND d.row_key = gp.group_id::text || '|' || gp.provider_id::text;

    UPDATE public.groups_prov g
    SET is_lab_category = (d.old_value->>'is_lab_category')::boolean
    FROM public.demo_seed_rows d
    WHERE d.seed = c_seed AND d.table_name = 'groups_prov.update'
      AND g.id = d.row_key::uuid;

    DELETE FROM public.groups_prov g
    USING public.demo_seed_rows d
    WHERE d.seed = c_seed AND d.table_name = 'groups_prov'
      AND g.id = d.row_key::uuid;

    DELETE FROM public.demo_seed_rows WHERE seed = c_seed;

    RETURN format('Demo de laboratorio limpiado: %s órdenes borradas%s.', v_orders,
                  CASE WHEN v_kept > 0 THEN format(', %s etapa(s) desactivada(s) por tener órdenes reales', v_kept) ELSE '' END);
END;
$$;

SELECT public.demo_lab_orders_cleanup();

-- ─── Datos ───────────────────────────────────────────────────────────────────

DO $$
DECLARE
    c_seed   constant text := 'lab_orders_demo';
    c_tz     constant text := 'America/Montevideo';
    v_today  date := (now() AT TIME ZONE 'America/Montevideo')::date;

    -- Categorías: nombre → laboratorios (por nombre) y servicios (por nombre).
    v_categories jsonb := $j$[
      {"name": "Prótesis fija",
       "description": "Coronas, puentes e incrustaciones (cerámica, zirconio, metal-porcelana).",
       "labs": ["Cerámica Dental Prado", "Laboratorio Dental Cerro", "Cerámica Oral Norte"],
       "services": ["Corona de zirconio", "Corona metal-porcelana", "Incrustación de disilicato", "Puente de 3 piezas"]},
      {"name": "Prótesis removible",
       "description": "Prótesis parciales y completas, acrílicas y de cromo-cobalto.",
       "labs": ["Laboratorio Dental Cerro", "ProtéticaLab Montevideo", "Laboratorio Dental Sur"],
       "services": ["Prótesis parcial removible"]},
      {"name": "Ortodoncia y placas",
       "description": "Alineadores, placas de ortodoncia y férulas.",
       "labs": ["Ortolab Uruguay", "Laboratorio Dental Sur"],
       "services": ["Férula de descarga"]}
    ]$j$;

    -- Órdenes. "path": etapas por las que pasó, en orden (ago = hace cuántos
    -- días, at = hora local). Claves de etapa: ini env pru rec com can.
    -- "by" de un paso: "staff" (default) o "doctor". due = días desde hoy.
    v_orders jsonb := $j$[
      {"patient": "Sebastián De León", "doctor": "Dra. Valentina Sosa", "lab": null, "staff": "Camila Rivero",
       "items": [{"s": "Corona de zirconio", "q": 1, "t": [21], "n": "Color A2. Impresión digital con escáner intraoral."}],
       "path": [{"st": "ini", "ago": 0, "at": "08:45"}]},

      {"patient": "Verónica Núñez", "doctor": "Dr. Martín Rodríguez", "lab": null, "staff": "Florencia Acosta",
       "items": [{"s": "Férula de descarga", "q": 1, "t": [], "n": "Superior, rígida, 2 mm."}],
       "notes": "Bruxismo nocturno. Trae registro de mordida de la consulta.",
       "path": [{"st": "ini", "ago": 1, "at": "16:20"}]},

      {"patient": "Federico Romero Ferreira", "doctor": "Dr. Ignacio Varela", "lab": null, "staff": "Camila Rivero",
       "items": [{"s": "Puente de 3 piezas", "q": 1, "t": [34, 35, 36], "n": "Pilares 34 y 36, póntico 35."}],
       "notes": "Falta la impresión definitiva: el paciente reprogramó dos veces.",
       "path": [{"st": "ini", "ago": 5, "at": "10:10"}]},

      {"patient": "Martina Bentancur Pérez", "doctor": "Dra. Lucía Fernández", "lab": "Cerámica Dental Prado", "staff": "Florencia Acosta",
       "urgent": true,
       "items": [{"s": "Incrustación de disilicato", "q": 1, "t": [26], "n": "Onlay MOD."}],
       "notes": "Se despegó el provisorio. La paciente viaja el viernes: pedir prioridad al laboratorio.",
       "path": [{"st": "ini", "ago": 0, "at": "08:15"}]},

      {"patient": "Fernando Pereira", "doctor": "Dra. Sofía Benítez", "lab": "Cerámica Dental Prado", "staff": "Camila Rivero",
       "due": 5,
       "items": [{"s": "Corona metal-porcelana", "q": 2, "t": [14, 15], "n": "Color A3. Hombro cerámico vestibular."}],
       "path": [{"st": "ini", "ago": 4, "at": "11:30"}, {"st": "env", "ago": 2, "at": "09:05", "note": "Retiró el cadete del laboratorio."}]},

      {"patient": "Rosario Díaz", "doctor": "Dr. Pablo Ferreira", "lab": "Laboratorio Dental Cerro", "staff": "Florencia Acosta",
       "due": 1,
       "items": [{"s": "Corona de zirconio", "q": 1, "t": [11], "n": "Color B1, alta translucidez."}],
       "notes": "Colocación agendada para pasado mañana.",
       "path": [{"st": "ini", "ago": 9, "at": "15:40"}, {"st": "env", "ago": 6, "at": "10:20"}]},

      {"patient": "Andrea Romero Castro", "doctor": "Dra. Valentina Sosa", "lab": "Cerámica Oral Norte", "staff": "Camila Rivero",
       "due": 2,
       "items": [{"s": "Puente de 3 piezas", "q": 1, "t": [44, 45, 46], "n": "Zirconio monolítico."}],
       "path": [{"st": "ini", "ago": 13, "at": "09:50"}, {"st": "env", "ago": 10, "at": "12:15"}]},

      {"patient": "Mariana Morales Pereira", "doctor": "Dr. Martín Rodríguez", "lab": "ProtéticaLab Montevideo", "staff": "Florencia Acosta",
       "due": -2,
       "items": [{"s": "Prótesis parcial removible", "q": 1, "t": [], "n": "Superior, clase III de Kennedy, cromo-cobalto."}],
       "notes": "Llamé al laboratorio el lunes: dicen que sale esta semana.",
       "path": [{"st": "ini", "ago": 8, "at": "14:00"}, {"st": "env", "ago": 5, "at": "09:40"}]},

      {"patient": "Marcelo Ferreira", "doctor": "Dra. Lucía Fernández", "lab": "Laboratorio Dental Cerro", "staff": "Camila Rivero",
       "urgent": true, "due": 2,
       "items": [{"s": "Corona de zirconio", "q": 1, "t": [11], "n": "Color A1. Copiar la forma del 21."}],
       "notes": "Se fracturó el provisorio. Prioridad estética: el paciente trabaja de cara al público.",
       "path": [{"st": "ini", "ago": 2, "at": "17:10"}, {"st": "env", "ago": 1, "at": "08:50"}]},

      {"patient": "Natalia Pérez", "doctor": "Dra. Sofía Benítez", "lab": "Ortolab Uruguay", "staff": "Florencia Acosta",
       "due": 12,
       "description": "Alineadores transparentes — fase 1 (14 pares) con attachments en 13, 23, 33 y 43.",
       "notes": "Se envió el escaneo digital y el set-up aprobado por la paciente.",
       "path": [{"st": "ini", "ago": 6, "at": "10:45"}, {"st": "env", "ago": 3, "at": "11:00"}]},

      {"patient": "Claudia Etchegaray Cardozo", "doctor": "Dr. Martín Rodríguez", "lab": "Cerámica Oral Norte", "staff": "Camila Rivero",
       "due": 0,
       "items": [{"s": "Corona de zirconio", "q": 1, "t": [36], "n": "Sobre implante, atornillada."}],
       "notes": "El laboratorio confirmó que la entrega hoy a la tarde.",
       "path": [{"st": "ini", "ago": 8, "at": "09:20"}, {"st": "env", "ago": 6, "at": "15:30"}]},

      {"patient": "Leonardo Acosta Ramos", "doctor": "Dr. Ignacio Varela", "lab": "Laboratorio Dental Sur", "staff": "Florencia Acosta",
       "due": 6,
       "items": [{"s": "Prótesis parcial removible", "q": 1, "t": [], "n": "Inferior, retenedores en 33 y 43."}],
       "path": [{"st": "ini", "ago": 20, "at": "10:00"},
                {"st": "env", "ago": 18, "at": "09:15"},
                {"st": "pru", "ago": 9, "at": "16:40", "note": "Prueba de estructura: el retenedor del 33 queda flojo."},
                {"st": "env", "ago": 8, "at": "10:30", "note": "Vuelve al laboratorio para ajustar el retenedor del 33."},
                {"st": "pru", "ago": 2, "at": "15:10", "note": "Prueba de dientes en cera."}]},

      {"patient": "Hernán Morales Correa", "doctor": "Dra. Valentina Sosa", "lab": "Cerámica Dental Prado", "staff": "Camila Rivero",
       "due": 3,
       "items": [{"s": "Puente de 3 piezas", "q": 1, "t": [24, 25, 26], "n": "Metal-porcelana, color A3,5."}],
       "notes": "Prueba de bizcocho hecha. El paciente no vino a la cita de ajuste: volver a llamarlo.",
       "path": [{"st": "ini", "ago": 18, "at": "11:20"}, {"st": "env", "ago": 15, "at": "09:00"},
                {"st": "pru", "ago": 7, "at": "17:30", "note": "Prueba de bizcocho: ajustar contacto oclusal en 26."}]},

      {"patient": "Florencia Olivera", "doctor": "Dra. Lucía Fernández", "lab": "Laboratorio Dental Cerro", "staff": "Florencia Acosta",
       "due": 0,
       "items": [{"s": "Incrustación de disilicato", "q": 2, "t": [16, 17], "n": "Inlay en 16, onlay en 17."}],
       "path": [{"st": "ini", "ago": 12, "at": "10:30"}, {"st": "env", "ago": 10, "at": "09:10"},
                {"st": "rec", "ago": 1, "at": "16:05", "note": "Llegaron en caja sellada, sin observaciones."}]},

      {"patient": "Bruno López", "doctor": "Dr. Pablo Ferreira", "lab": "Ortolab Uruguay", "staff": "Camila Rivero",
       "due": -6,
       "items": [{"s": "Férula de descarga", "q": 1, "t": [], "n": "Inferior, blanda."}],
       "notes": "Llamar al paciente para coordinar la entrega.",
       "path": [{"st": "ini", "ago": 22, "at": "14:30"}, {"st": "env", "ago": 19, "at": "10:00"},
                {"st": "rec", "ago": 6, "at": "12:45"}]},

      {"patient": "Emiliano Ferreira Rivero", "doctor": "Dra. Valentina Sosa", "lab": "Cerámica Dental Prado", "staff": "Florencia Acosta",
       "due": -5,
       "items": [{"s": "Corona de zirconio", "q": 1, "t": [12], "n": "Color A2."}],
       "path": [{"st": "ini", "ago": 16, "at": "09:30"}, {"st": "env", "ago": 14, "at": "11:15"},
                {"st": "rec", "ago": 6, "at": "15:20"},
                {"st": "com", "ago": 2, "at": "11:40", "by": "doctor", "note": "Colocada. Paciente conforme con el color."}]},

      {"patient": "Álvaro González", "doctor": "Dr. Ignacio Varela", "lab": "Laboratorio Dental Cerro", "staff": "Camila Rivero",
       "due": -8,
       "items": [{"s": "Puente de 3 piezas", "q": 1, "t": [14, 15, 16], "n": "Zirconio estratificado."}],
       "path": [{"st": "ini", "ago": 25, "at": "10:15"}, {"st": "env", "ago": 22, "at": "09:30"},
                {"st": "pru", "ago": 15, "at": "16:00", "note": "Prueba de estructura: falta espacio para la cerámica en 16."},
                {"st": "env", "ago": 14, "at": "09:45", "note": "Vuelve al laboratorio para reducir la estructura."},
                {"st": "rec", "ago": 7, "at": "14:10"},
                {"st": "com", "ago": 5, "at": "10:20", "by": "doctor", "note": "Cementado definitivo."}]},

      {"patient": "Josefina Méndez Castro", "doctor": "Dra. Sofía Benítez", "lab": "Ortolab Uruguay", "staff": "Florencia Acosta",
       "due": -14,
       "items": [{"s": "Férula de descarga", "q": 1, "t": [], "n": "Superior, rígida."}],
       "path": [{"st": "ini", "ago": 24, "at": "15:00"}, {"st": "env", "ago": 21, "at": "10:30"},
                {"st": "rec", "ago": 14, "at": "11:50"},
                {"st": "com", "ago": 12, "at": "17:15", "by": "doctor", "note": "Entregada con indicaciones de uso y limpieza."}]},

      {"patient": "Andrés Álvarez", "doctor": "Dr. Pablo Ferreira", "lab": "ProtéticaLab Montevideo", "staff": "Camila Rivero",
       "due": -27,
       "items": [{"s": "Prótesis parcial removible", "q": 1, "t": [], "n": "Superior e inferior, acrílicas."}],
       "path": [{"st": "ini", "ago": 50, "at": "09:40"}, {"st": "env", "ago": 47, "at": "10:10"},
                {"st": "pru", "ago": 38, "at": "15:30", "note": "Prueba de dientes en cera: cambiar el color a A3."},
                {"st": "env", "ago": 37, "at": "09:20"},
                {"st": "rec", "ago": 27, "at": "16:45"},
                {"st": "com", "ago": 24, "at": "11:00", "by": "doctor", "note": "Instalada. Control en 7 días."}]},

      {"patient": "Juan Bentancur", "doctor": "Dr. Martín Rodríguez", "lab": "Cerámica Oral Norte", "staff": "Florencia Acosta",
       "due": -58,
       "items": [{"s": "Corona metal-porcelana", "q": 1, "t": [46], "n": "Color A3."}],
       "path": [{"st": "ini", "ago": 70, "at": "10:00"}, {"st": "env", "ago": 68, "at": "09:30"},
                {"st": "rec", "ago": 58, "at": "15:00"},
                {"st": "com", "ago": 55, "at": "10:40", "by": "doctor", "note": "Cementada."}]},

      {"patient": "Valentina Viera Techera", "doctor": "Dra. Lucía Fernández", "lab": "Laboratorio Dental Cerro", "staff": "Camila Rivero",
       "due": 1,
       "items": [{"s": "Puente de 3 piezas", "q": 1, "t": [35, 36, 37]}],
       "path": [{"st": "ini", "ago": 15, "at": "11:10"}, {"st": "env", "ago": 12, "at": "10:00"},
                {"st": "can", "ago": 8, "at": "12:30", "by": "doctor", "note": "Cancelada: la paciente optó por un implante en 36. Se avisó al laboratorio."}]},

      {"patient": "Natalia Núñez", "doctor": "Dr. Ignacio Varela", "lab": null, "staff": "Florencia Acosta",
       "items": [{"s": "Corona de zirconio", "q": 1, "t": [22]}],
       "path": [{"st": "ini", "ago": 10, "at": "16:00"},
                {"st": "can", "ago": 3, "at": "10:15", "note": "La paciente no aceptó el presupuesto."}]}
    ]$j$;

    v_cat        jsonb;
    v_cat_id     uuid;
    v_name       text;
    v_lab        uuid;
    v_svc        record;

    v_stage      jsonb := '{}'::jsonb;   -- clave → id de etapa
    v_id         integer;
    v_row        record;

    v_order      jsonb;
    v_step       jsonb;
    v_item       jsonb;
    v_patient    uuid;
    v_doctor     uuid;
    v_staff      uuid;
    v_by         uuid;
    v_order_id   integer;
    v_prev_stage integer;
    v_stage_id   integer;
    v_ts         timestamptz;
    v_prev_ts    timestamptz;
    v_first_ts   timestamptz;
    v_teeth      smallint[];
    v_pos        integer;
    v_items_n    integer;
    v_desc       text;
    v_created    integer := 0;
    v_skipped    text[] := ARRAY[]::text[];
    v_fallback_doctor uuid;
    v_fallback_staff  uuid;
BEGIN
    -- ── 1. Categorías de laboratorio ─────────────────────────────────────────
    FOR v_cat IN SELECT value FROM jsonb_array_elements(v_categories) LOOP
        SELECT g.id INTO v_cat_id FROM public.groups_prov g
        WHERE lower(btrim(g.name)) = lower(v_cat->>'name') LIMIT 1;

        IF v_cat_id IS NULL THEN
            INSERT INTO public.groups_prov (name, description, is_active, is_lab_category)
            VALUES (v_cat->>'name', v_cat->>'description', true, true)
            RETURNING id INTO v_cat_id;
            INSERT INTO public.demo_seed_rows (seed, table_name, row_key)
            VALUES (c_seed, 'groups_prov', v_cat_id::text);
        ELSE
            -- Ya existía un grupo con ese nombre: se marca como categoría.
            INSERT INTO public.demo_seed_rows (seed, table_name, row_key, old_value)
            SELECT c_seed, 'groups_prov.update', g.id::text, jsonb_build_object('is_lab_category', g.is_lab_category)
            FROM public.groups_prov g WHERE g.id = v_cat_id AND NOT g.is_lab_category
            ON CONFLICT DO NOTHING;
            UPDATE public.groups_prov SET is_lab_category = true WHERE id = v_cat_id AND NOT is_lab_category;
        END IF;

        FOR v_name IN SELECT jsonb_array_elements_text(v_cat->'labs') LOOP
            SELECT u.id INTO v_lab FROM public.users u
            WHERE lower(btrim(u.name)) = lower(v_name) AND u.is_sales IS FALSE AND COALESCE(u.is_active, true)
            LIMIT 1;
            IF v_lab IS NULL THEN
                RAISE NOTICE 'Laboratorio "%" no existe como proveedor: se salta.', v_name;
                CONTINUE;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM public.group_provider gp WHERE gp.group_id = v_cat_id AND gp.provider_id = v_lab) THEN
                INSERT INTO public.group_provider (group_id, provider_id, created_at) VALUES (v_cat_id, v_lab, now());
                INSERT INTO public.demo_seed_rows (seed, table_name, row_key)
                VALUES (c_seed, 'group_provider', v_cat_id::text || '|' || v_lab::text);
            END IF;
        END LOOP;

        FOR v_name IN SELECT jsonb_array_elements_text(v_cat->'services') LOOP
            FOR v_svc IN
                SELECT sc.id FROM public.service_catalog sc
                WHERE sc.is_lab AND lower(btrim(sc.name)) = lower(v_name) AND sc.lab_category_id IS NULL
            LOOP
                INSERT INTO public.demo_seed_rows (seed, table_name, row_key, old_value)
                VALUES (c_seed, 'service_catalog.lab_category_id', v_svc.id::text, jsonb_build_object('lab_category_id', NULL))
                ON CONFLICT DO NOTHING;
                UPDATE public.service_catalog SET lab_category_id = v_cat_id WHERE id = v_svc.id;
            END LOOP;
        END LOOP;
    END LOOP;

    -- ── 2. Etapas ────────────────────────────────────────────────────────────
    -- Existentes: la inicial, la primera intermedia y la primera final activas.
    SELECT s.id INTO v_id FROM public.lab_stages s WHERE s.is_active AND s.kind = 'initial' LIMIT 1;
    IF v_id IS NULL THEN RAISE EXCEPTION 'No hay etapa inicial activa: aplicar 147 antes del demo.'; END IF;
    v_stage := v_stage || jsonb_build_object('ini', v_id);

    SELECT s.id INTO v_id FROM public.lab_stages s
    WHERE s.is_active AND s.kind = 'intermediate'
    ORDER BY (lower(s.name) LIKE 'enviado%') DESC, s.sort_order, s.id LIMIT 1;
    IF v_id IS NULL THEN RAISE EXCEPTION 'No hay etapa intermedia activa para "Enviado al laboratorio".'; END IF;
    v_stage := v_stage || jsonb_build_object('env', v_id);

    SELECT s.id INTO v_id FROM public.lab_stages s
    WHERE s.is_active AND s.kind = 'final'
    ORDER BY (lower(s.name) LIKE 'complet%') DESC, s.sort_order, s.id LIMIT 1;
    IF v_id IS NULL THEN RAISE EXCEPTION 'No hay etapa final activa: aplicar 147 antes del demo.'; END IF;
    v_stage := v_stage || jsonb_build_object('com', v_id);

    -- Nuevas (si ya hay una activa con ese nombre, se usa esa).
    FOR v_row IN
        SELECT * FROM (VALUES
            ('pru', 'Prueba en boca',      '#8b5cf6', 'intermediate', 5),
            ('rec', 'Recibido en clínica', '#14b8a6', 'intermediate', 4),
            ('can', 'Cancelado',           '#ef4444', 'final',        NULL::integer)
        ) AS t(k, name, color, kind, overdue)
    LOOP
        SELECT s.id INTO v_id FROM public.lab_stages s
        WHERE s.is_active AND lower(btrim(s.name)) = lower(v_row.name) LIMIT 1;
        -- Una limpieza anterior la desactivó porque una orden real pasó por ella:
        -- se reactiva esa (y la limpieza la vuelve a desactivar) en vez de duplicarla.
        IF v_id IS NULL THEN
            SELECT s.id INTO v_id FROM public.lab_stages s
            WHERE NOT s.is_active AND lower(btrim(s.name)) = lower(v_row.name)
            ORDER BY s.id DESC LIMIT 1;
            IF v_id IS NOT NULL THEN
                INSERT INTO public.demo_seed_rows (seed, table_name, row_key, old_value)
                SELECT c_seed, 'lab_stages.update', s.id::text,
                       jsonb_build_object('sort_order', s.sort_order, 'overdue_days', s.overdue_days, 'is_active', false)
                FROM public.lab_stages s WHERE s.id = v_id
                ON CONFLICT DO NOTHING;
                UPDATE public.lab_stages
                SET is_active = true, kind = v_row.kind, overdue_days = v_row.overdue, updated_at = now()
                WHERE id = v_id;
            END IF;
        END IF;
        IF v_id IS NULL THEN
            INSERT INTO public.lab_stages (name, color, sort_order, kind, overdue_days, is_active)
            VALUES (v_row.name, v_row.color, 0, v_row.kind, v_row.overdue, true)
            RETURNING id INTO v_id;
            INSERT INTO public.demo_seed_rows (seed, table_name, row_key) VALUES (c_seed, 'lab_stages', v_id::text);
        END IF;
        v_stage := v_stage || jsonb_build_object(v_row.k, v_id);
    END LOOP;

    -- Orden del circuito y umbral de la inicial (se guarda el valor anterior
    -- de las que ya existían para restaurarlo en la limpieza).
    INSERT INTO public.demo_seed_rows (seed, table_name, row_key, old_value)
    SELECT c_seed, 'lab_stages.update', s.id::text,
           jsonb_build_object('sort_order', s.sort_order, 'overdue_days', s.overdue_days)
    FROM public.lab_stages s
    WHERE s.id IN (SELECT (v_stage->>k)::integer FROM unnest(ARRAY['ini', 'env', 'pru', 'rec', 'com', 'can']) k)
      AND NOT EXISTS (SELECT 1 FROM public.demo_seed_rows d
                      WHERE d.seed = c_seed AND d.table_name = 'lab_stages' AND d.row_key = s.id::text)
    ON CONFLICT DO NOTHING;

    UPDATE public.lab_stages s
    SET sort_order = o.pos, updated_at = now()
    FROM (VALUES ('ini', 1), ('env', 2), ('pru', 3), ('rec', 4), ('com', 5), ('can', 6)) AS o(k, pos)
    WHERE s.id = (v_stage->>o.k)::integer;

    -- Una orden que queda más de 3 días sin enviarse se marca atrasada.
    UPDATE public.lab_stages SET overdue_days = 3, updated_at = now()
    WHERE id = (v_stage->>'ini')::integer AND overdue_days IS NULL;

    -- Las demás etapas activas (si la clínica tenía otras) van después.
    INSERT INTO public.demo_seed_rows (seed, table_name, row_key, old_value)
    SELECT c_seed, 'lab_stages.update', s.id::text,
           jsonb_build_object('sort_order', s.sort_order, 'overdue_days', s.overdue_days)
    FROM public.lab_stages s
    WHERE s.is_active AND NOT (s.id IN (SELECT (v_stage->>k)::integer FROM unnest(ARRAY['ini', 'env', 'pru', 'rec', 'com', 'can']) k))
      AND s.sort_order <= 6
    ON CONFLICT DO NOTHING;

    UPDATE public.lab_stages s SET sort_order = 100 + s.sort_order
    WHERE s.is_active AND NOT (s.id IN (SELECT (v_stage->>k)::integer FROM unnest(ARRAY['ini', 'env', 'pru', 'rec', 'com', 'can']) k))
      AND s.sort_order <= 6;

    -- Alertas de las etapas (solo si la etapa no tenía ya una de ese tipo).
    FOR v_row IN
        SELECT * FROM (VALUES
            -- Recibido en clínica: avisar al doctor para que agende la colocación.
            ('rec', 'enter', NULL::integer, true,  false),
            -- Prueba en boca: más de 5 días esperando el ajuste → aviso una vez.
            ('pru', 'dwell', NULL::integer, true,  false)
            -- La entrega vencida la avisa el atraso de la etapa a la que se envió (script 177).
        ) AS t(k, trig, repeat_days, to_doctor, to_creator)
    LOOP
        INSERT INTO public.lab_stage_alerts (stage_id, trigger, repeat_every_days, notify_order_doctor, notify_order_creator,
                                             channel_in_app, channel_email, channel_whatsapp)
        VALUES ((v_stage->>v_row.k)::integer, v_row.trig, v_row.repeat_days, v_row.to_doctor, v_row.to_creator, true, false, false)
        ON CONFLICT (stage_id, trigger) DO NOTHING
        RETURNING id INTO v_id;
        IF FOUND THEN
            INSERT INTO public.demo_seed_rows (seed, table_name, row_key) VALUES (c_seed, 'lab_stage_alerts', v_id::text);
        END IF;
    END LOOP;

    -- ── 3. Órdenes ───────────────────────────────────────────────────────────
    SELECT u.id INTO v_fallback_doctor FROM public.users u
    JOIN public.user_roles ur ON ur.user_id = u.id JOIN public.roles r ON r.id = ur.role_id
    WHERE lower(btrim(r.name)) IN ('medico', 'médico', 'doctor') AND COALESCE(u.is_active, true)
    ORDER BY u.name LIMIT 1;

    SELECT u.id INTO v_fallback_staff FROM public.users u
    JOIN public.user_roles ur ON ur.user_id = u.id JOIN public.roles r ON r.id = ur.role_id
    WHERE lower(btrim(r.name)) IN ('recepcionista', 'administrador') AND COALESCE(u.is_active, true)
    ORDER BY (lower(btrim(r.name)) = 'recepcionista') DESC, u.name LIMIT 1;

    FOR v_order IN SELECT value FROM jsonb_array_elements(v_orders) LOOP
        SELECT u.id INTO v_patient FROM public.users u
        WHERE lower(btrim(u.name)) = lower(v_order->>'patient') AND COALESCE(u.is_active, true)
        ORDER BY u.created_at LIMIT 1;
        IF v_patient IS NULL THEN
            v_skipped := v_skipped || (v_order->>'patient');
            CONTINUE;
        END IF;

        SELECT u.id INTO v_doctor FROM public.users u
        WHERE lower(btrim(u.name)) = lower(v_order->>'doctor') AND COALESCE(u.is_active, true) LIMIT 1;
        v_doctor := COALESCE(v_doctor, v_fallback_doctor);

        SELECT u.id INTO v_staff FROM public.users u
        WHERE lower(btrim(u.name)) = lower(v_order->>'staff') AND COALESCE(u.is_active, true) LIMIT 1;
        v_staff := COALESCE(v_staff, v_fallback_staff);

        v_lab := NULL;
        IF v_order->>'lab' IS NOT NULL THEN
            SELECT u.id INTO v_lab FROM public.users u
            WHERE lower(btrim(u.name)) = lower(v_order->>'lab') AND u.is_sales IS FALSE LIMIT 1;
        END IF;

        -- Momentos de cada paso (hora de pared de Montevideo, nunca en el futuro
        -- y siempre crecientes). El primero es el alta.
        v_first_ts := NULL;
        v_prev_ts := NULL;
        v_teeth := ARRAY(SELECT DISTINCT t::smallint
                         FROM jsonb_array_elements(COALESCE(v_order->'items', '[]'::jsonb)) i,
                              jsonb_array_elements_text(COALESCE(i->'t', '[]'::jsonb)) t
                         ORDER BY 1);
        v_desc := v_order->>'description';
        IF v_desc IS NULL AND NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(COALESCE(v_order->'items', '[]'::jsonb)) i
            JOIN public.service_catalog sc ON sc.is_lab AND lower(btrim(sc.name)) = lower(i->>'s')) THEN
            -- Sin ningún servicio del catálogo: el trabajo va como descripción.
            SELECT string_agg(i->>'s' || CASE WHEN (i->>'q')::integer > 1 THEN ' ×' || (i->>'q') ELSE '' END, ', ')
            INTO v_desc FROM jsonb_array_elements(v_order->'items') i;
        END IF;

        v_step := v_order->'path'->0;
        v_first_ts := LEAST(((v_today - (v_step->>'ago')::integer) + (v_step->>'at')::time) AT TIME ZONE c_tz,
                            now() - interval '30 minutes');

        INSERT INTO public.lab_orders (
            patient_id, doctor_id, laboratory_id, work_description, current_stage_id, stage_entered_at,
            teeth, due_date, notes, is_urgent, created_at, updated_at, created_by, updated_by)
        VALUES (
            v_patient, v_doctor, v_lab, v_desc, (v_stage->>(v_step->>'st'))::integer, v_first_ts,
            v_teeth,
            CASE WHEN v_order ? 'due' THEN v_today + (v_order->>'due')::integer END,
            v_order->>'notes', COALESCE((v_order->>'urgent')::boolean, false),
            v_first_ts, v_first_ts, v_staff, v_staff)
        RETURNING id INTO v_order_id;

        INSERT INTO public.demo_seed_rows (seed, table_name, row_key) VALUES (c_seed, 'lab_orders', v_order_id::text);

        -- Servicios.
        v_pos := 0;
        FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(v_order->'items', '[]'::jsonb)) LOOP
            SELECT sc.id, sc.name INTO v_svc FROM public.service_catalog sc
            WHERE sc.is_lab AND lower(btrim(sc.name)) = lower(v_item->>'s')
            ORDER BY COALESCE(sc.is_active, true) DESC, sc.id LIMIT 1;
            IF NOT FOUND THEN CONTINUE; END IF;
            v_pos := v_pos + 1;
            INSERT INTO public.lab_order_items (lab_order_id, service_id, service_name, quantity, teeth, notes, sort_order, created_at)
            VALUES (v_order_id, v_svc.id, v_svc.name, COALESCE((v_item->>'q')::smallint, 1),
                    ARRAY(SELECT t::smallint FROM jsonb_array_elements_text(COALESCE(v_item->'t', '[]'::jsonb)) t),
                    v_item->>'n', v_pos, v_first_ts);
        END LOOP;

        -- Historial: el alta (sin etapa de origen) y cada cambio.
        v_prev_stage := NULL;
        FOR v_step IN SELECT value FROM jsonb_array_elements(v_order->'path') LOOP
            v_stage_id := (v_stage->>(v_step->>'st'))::integer;
            v_ts := LEAST(((v_today - (v_step->>'ago')::integer) + (v_step->>'at')::time) AT TIME ZONE c_tz,
                          now() - interval '30 minutes');
            IF v_prev_ts IS NOT NULL AND v_ts <= v_prev_ts THEN
                v_ts := v_prev_ts + interval '2 minutes';
            END IF;
            v_by := CASE WHEN v_step->>'by' = 'doctor' THEN COALESCE(v_doctor, v_staff) ELSE v_staff END;

            INSERT INTO public.lab_order_stage_history (lab_order_id, from_stage_id, to_stage_id, changed_by, changed_at, note)
            VALUES (v_order_id, v_prev_stage, v_stage_id, v_by, v_ts, v_step->>'note');

            v_prev_stage := v_stage_id;
            v_prev_ts := v_ts;
        END LOOP;

        -- La orden queda en el último paso. (El trigger de cierre de avisos
        -- corre acá, pero las órdenes nuevas no tienen avisos.)
        UPDATE public.lab_orders
        SET current_stage_id = v_prev_stage,
            stage_entered_at = v_prev_ts,
            updated_at = v_prev_ts,
            updated_by = v_by
        WHERE id = v_order_id;

        v_created := v_created + 1;
    END LOOP;

    RAISE NOTICE 'Demo de laboratorio: % órdenes creadas.%', v_created,
        CASE WHEN cardinality(v_skipped) > 0
             THEN ' Salteadas (no existe el paciente): ' || array_to_string(v_skipped, ', ') || '.'
             ELSE '' END;
END;
$$;

COMMIT;

-- Comprobación rápida:
-- SELECT stage_name, count(*), count(*) FILTER (WHERE is_overdue) AS atrasadas
-- FROM public.v_lab_orders v
-- JOIN public.demo_seed_rows d ON d.seed = 'lab_orders_demo' AND d.table_name = 'lab_orders' AND d.row_key = v.id::text
-- GROUP BY stage_name, stage_sort_order ORDER BY stage_sort_order;
