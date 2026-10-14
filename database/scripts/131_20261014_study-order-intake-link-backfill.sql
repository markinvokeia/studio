-- =============================================================================
-- Órdenes de estudio — completar study_orders.source_intake_id desde el intake
-- =============================================================================
-- Contexto:
--
--   Una orden que salió de leer originales (WhatsApp o importada) queda vinculada a su lectura de
--   dos lados: study_orders.source_intake_id → intake, y whatsapp_order_intakes.study_order_id →
--   orden. Hay órdenes con el segundo vínculo pero sin el primero (anteriores a que existiera la
--   columna, o creadas por un camino que no lo completó).
--
--   Todo lo que muestra los originales parte de source_intake_id: el tab Original del detalle, los
--   originales al editar, que el borrador se vea en la bandeja y se pueda asignar. En esas órdenes
--   no aparecía nada de eso. El detalle ya busca también por el intake (DETAIL_SQL); este script
--   completa el dato para que el resto funcione igual.
--
--   Si una orden tiene varios intakes apuntándola, se toma el más reciente.
--
-- Requiere la 123. Idempotente: solo toca órdenes sin source_intake_id.
-- =============================================================================

BEGIN;

UPDATE public.study_orders so
   SET source_intake_id = wi.id
  FROM (SELECT DISTINCT ON (study_order_id) id, study_order_id
          FROM public.whatsapp_order_intakes
         WHERE study_order_id IS NOT NULL
         ORDER BY study_order_id, created_at DESC) wi
 WHERE wi.study_order_id = so.id
   AND so.source_intake_id IS NULL;

INSERT INTO public.db_migrations (script_name, version_tag, notes)
VALUES (
    '131_20261014_study-order-intake-link-backfill.sql',
    'v2',
    'Órdenes de estudio — completa study_orders.source_intake_id desde whatsapp_order_intakes.study_order_id'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;

-- =============================================================================
-- Diagnóstico (antes de correrlo): órdenes con originales que no tienen el vínculo
-- =============================================================================
-- SELECT so.order_number, so.status, so.source, wi.id AS intake_id, wi.channel,
--        (SELECT count(*) FROM attachments a
--          WHERE a.source_name = 'whatsapp_order_intake' AND a.source_id = wi.id::text) AS archivos
--   FROM study_orders so
--   JOIN whatsapp_order_intakes wi ON wi.study_order_id = so.id
--  WHERE so.source_intake_id IS NULL
--  ORDER BY so.created_at DESC;

-- Rollback: no hay forma de distinguir lo que completó este script de lo que ya estaba; el dato
-- que agrega es el mismo vínculo que ya existía del lado del intake, así que no hace falta.
