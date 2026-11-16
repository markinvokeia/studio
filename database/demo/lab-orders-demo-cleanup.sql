-- =====================================================================
-- DEMO — Órdenes de laboratorio: limpieza
-- Run on: donde se haya corrido database/demo/lab-orders-demo.sql.
-- =====================================================================
--
-- Deshace todo lo que creó o cambió lab-orders-demo.sql:
--   · borra las 22 órdenes del demo, con su historial y servicios, y los
--     avisos (/alerts) y notificaciones que se hayan generado sobre ellas
--     durante la demo;
--   · borra las etapas "Prueba en boca", "Recibido en clínica" y
--     "Cancelado" que creó (si una orden REAL quedó en alguna, la desactiva
--     en vez de borrarla y lo avisa) y las alertas de etapa que agregó;
--   · devuelve el orden y el umbral de atraso de las etapas originales;
--   · quita las categorías de laboratorio que creó, los laboratorios que
--     asignó y la categoría que puso en los servicios.
-- No toca órdenes ni configuración creadas a mano durante la demo, y los
-- adjuntos subidos a una orden del demo quedan en Drive (sin la orden).
-- =====================================================================

BEGIN;

DO $$
BEGIN
    IF to_regprocedure('public.demo_lab_orders_cleanup()') IS NULL THEN
        RAISE NOTICE 'No hay demo de laboratorio para limpiar.';
        RETURN;
    END IF;
    RAISE NOTICE '%', public.demo_lab_orders_cleanup();
END;
$$;

DROP FUNCTION IF EXISTS public.demo_lab_orders_cleanup();

-- La tabla de registro se borra si ningún otro demo la usa.
DO $$
BEGIN
    IF to_regclass('public.demo_seed_rows') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.demo_seed_rows) THEN
        DROP TABLE public.demo_seed_rows;
    END IF;
END;
$$;

COMMIT;
