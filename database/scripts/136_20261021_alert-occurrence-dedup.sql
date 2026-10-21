-- =====================================================================
-- Motor de alertas — anti-duplicado por OCURRENCIA del evento
--
-- Problema: el anti-duplicado del "Alert Scheduler" comparaba solo
-- (regla, registro) + estado/alert_date, nunca la fecha del evento:
--   · Cita reprogramada: si la alerta anterior seguía PENDING (sin email,
--     envío fallido, regla sin envío automático) bloqueaba el recordatorio
--     de la nueva fecha.
--   · Cumpleaños corregido: una alerta por año → la fecha corregida nunca
--     generaba alerta.
--   · Factura con vencimiento extendido: igual que la cita.
--   · Al revés, una factura dentro de la ventana ±N días se re-alertaba (y
--     re-enviaba) TODOS los días una vez que la anterior quedaba COMPLETED
--     (en DEV: 51 alertas repetidas para el mismo vencimiento).
--
-- Solución: cada alerta representa una ocurrencia, identificada por
-- alert_instances.occurrence_key. La unicidad pasa a ser
-- (rule_id, reference_table, reference_id, occurrence_key), sin importar el
-- estado. Si la fecha del evento cambia, la clave cambia → alerta nueva; si
-- no cambia, nunca se repite.
--
-- La "fecha del evento" de cada regla es condition_config.event_field:
--   · una columna del origen,
--   · "none" → la regla no tiene fecha de evento (modo "estado"),
--   · ausente/vacío → se deduce de las condiciones: el primer BETWEEN o, si
--     no hay, el primer "=" contra una variable de fecha ({{TODAY}}, ...).
-- Modos (misma lógica que "Build dynamic query" en Alert Scheduler y en
-- Alert Rules → POST /alert-rules/test):
--   event  → occurrence_key = valor de la columna tal como lo serializa
--            to_jsonb (ej. '2026-10-30T09:00:00', '2026-10-28').
--   yearly → la condición sobre esa columna usa {{TODAY_NO_YEAR}}
--            (cumpleaños): occurrence_key = día de la ocurrencia en el año,
--            'YYYY-MM-DD' (target_date + days_before - days_after).
--   state  → sin fecha de evento: occurrence_key = alert_date 'YYYY-MM-DD'
--            y se mantiene la regla anterior (no se crea otra mientras haya
--            una abierta).
-- event_date pasa a guardar la fecha real del evento (antes era la hora de
-- la corrida).
--
-- Este script:
--   1. agrega alert_instances.occurrence_key,
--   2. guarda el event_field deducido en las reglas que no lo tienen,
--   3. completa occurrence_key / event_date de las alertas existentes desde
--      el snapshot details_json->'data' (generado con el mismo to_jsonb, así
--      el formato coincide y no se reenvían recordatorios ya enviados),
--   4. a las alertas repetidas de una misma ocurrencia (histórico) les agrega
--      el sufijo '#<id>' (se conserva la primera),
--   5. reemplaza unique_alert_per_record por el índice único nuevo.
--
-- Idempotente.
-- Despliegue: aplicar ESTE script y reimportar "Alert Scheduler" y
-- "Alert Rules" en n8n en la misma ventana (los flujos viejos usan
-- ON CONFLICT sobre alert_date, que deja de existir, y los nuevos insertan
-- occurrence_key). No hacerlo cerca de medianoche: el scheduler corre en el
-- primer tick del día.
-- =====================================================================

BEGIN;

ALTER TABLE public.alert_instances
    ADD COLUMN IF NOT EXISTS occurrence_key text;

COMMENT ON COLUMN public.alert_instances.occurrence_key IS
    'Ocurrencia del evento que originó la alerta (fecha del evento según condition_config.event_field de la regla). Única por regla + registro.';

-- Modo de cada regla (ver cabecera).
CREATE TEMP TABLE _alert_rule_occurrence ON COMMIT DROP AS
WITH conds AS (
    SELECT ar.id, c.value AS cond, c.ord
    FROM public.alert_rules ar
    CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(ar.condition_config->'conditions') = 'array'
             THEN ar.condition_config->'conditions' ELSE '[]'::jsonb END
    ) WITH ORDINALITY AS c(value, ord)
),
anchor AS (
    SELECT DISTINCT ON (id) id, cond->>'column' AS col
    FROM conds
    WHERE upper(cond->>'operator') = 'BETWEEN'
       OR (cond->>'operator' = '='
           AND btrim(cond->>'value') ~* '^\{\{\s*(TODAY|TOMORROW|YESTERDAY|WEEK_START|WEEK_END|MONTH_START|MONTH_END|YEAR_START|YEAR_END)')
    ORDER BY id, (upper(cond->>'operator') = 'BETWEEN') DESC, ord
)
SELECT ar.id AS rule_id,
       f.event_field,
       a.col AS inferred_field,
       GREATEST(COALESCE(ar.days_before, 0), 0) - GREATEST(COALESCE(ar.days_after, 0), 0) AS day_offset,
       CASE WHEN f.event_field IS NULL THEN 'state'
            WHEN EXISTS (SELECT 1 FROM conds c
                         WHERE c.id = ar.id
                           AND c.cond->>'column' = f.event_field
                           AND c.cond->>'value' ~* 'TODAY_NO_YEAR') THEN 'yearly'
            ELSE 'event'
       END AS mode
FROM public.alert_rules ar
LEFT JOIN anchor a ON a.id = ar.id
CROSS JOIN LATERAL (
    SELECT CASE WHEN ar.condition_config->>'event_field' = 'none' THEN NULL
                ELSE COALESCE(NULLIF(ar.condition_config->>'event_field', ''), a.col)
           END AS event_field
) f;

-- 2. Deja explícito el campo deducido (lo muestra el formulario de reglas).
UPDATE public.alert_rules ar
SET condition_config = jsonb_set(ar.condition_config, '{event_field}', to_jsonb(m.inferred_field)),
    updated_at = CURRENT_TIMESTAMP
FROM _alert_rule_occurrence m
WHERE m.rule_id = ar.id
  AND m.inferred_field IS NOT NULL
  AND NULLIF(ar.condition_config->>'event_field', '') IS NULL;

-- 3. Backfill desde el snapshot de cada alerta.
UPDATE public.alert_instances ai
SET occurrence_key = CASE m.mode
        WHEN 'event'  THEN COALESCE(ai.details_json->'data'->>m.event_field, 'null')
        WHEN 'yearly' THEN to_char(ai.alert_date + m.day_offset, 'YYYY-MM-DD')
        ELSE to_char(ai.alert_date, 'YYYY-MM-DD')
    END,
    event_date = CASE m.mode
        WHEN 'event' THEN CASE WHEN pg_input_is_valid(ai.details_json->'data'->>m.event_field, 'timestamp')
                               THEN (ai.details_json->'data'->>m.event_field)::timestamp
                               ELSE ai.event_date END
        WHEN 'yearly' THEN (ai.alert_date + m.day_offset)::timestamp
        ELSE ai.event_date
    END
FROM _alert_rule_occurrence m
WHERE m.rule_id = ai.rule_id
  AND ai.occurrence_key IS NULL;

-- Red de seguridad: cualquier fila que no haya matcheado una regla.
UPDATE public.alert_instances
SET occurrence_key = to_char(alert_date, 'YYYY-MM-DD')
WHERE occurrence_key IS NULL;

-- 4. Repetidas de una misma ocurrencia (histórico): se conserva la primera.
UPDATE public.alert_instances ai
SET occurrence_key = ai.occurrence_key || '#' || ai.id
FROM (
    SELECT id,
           row_number() OVER (PARTITION BY rule_id, reference_table, reference_id, occurrence_key
                              ORDER BY id) AS rn
    FROM public.alert_instances
) d
WHERE d.id = ai.id
  AND d.rn > 1;

-- 5. Unicidad por ocurrencia.
ALTER TABLE public.alert_instances
    ALTER COLUMN occurrence_key SET NOT NULL;

ALTER TABLE public.alert_instances
    DROP CONSTRAINT IF EXISTS unique_alert_per_record;

CREATE UNIQUE INDEX IF NOT EXISTS alert_instances_occurrence_uk
    ON public.alert_instances USING btree (rule_id, reference_table, reference_id, occurrence_key);

COMMIT;

-- Rollback (solo si se vuelven a importar los flujos anteriores):
--   BEGIN;
--   DROP INDEX IF EXISTS public.alert_instances_occurrence_uk;
--   ALTER TABLE public.alert_instances
--       ADD CONSTRAINT unique_alert_per_record
--       UNIQUE (rule_id, reference_table, reference_id, alert_date);
--   ALTER TABLE public.alert_instances DROP COLUMN occurrence_key;
--   COMMIT;
