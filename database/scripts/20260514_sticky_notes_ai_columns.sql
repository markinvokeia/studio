-- =====================================================================
-- Sticky Notes — Columnas de acciones e IA
-- Run on: dev / staging / prod
-- Idempotente: se puede correr varias veces sin efectos secundarios.
-- =====================================================================
--
-- Cambios:
--   1. Agrega columna `actions`   (jsonb) — lista de claves de intención
--      detectadas por la IA: ["CALENDAR","QUOTE","INVOICE"] o []
--   2. Agrega columna `redirects` (jsonb) — lista de URLs de redirección
--      correspondientes a cada acción, sin prefijo de locale.
--      Ejemplo: ["/appointments?act=Crear", "/users?t=Presupuestos&act=Crear"]
-- =====================================================================

BEGIN;

ALTER TABLE public.sticky_notes
    ADD COLUMN IF NOT EXISTS actions   jsonb NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS redirects jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.sticky_notes.actions
    IS 'AI-detected intent keys: CALENDAR, QUOTE, INVOICE. Populated automatically on create/update via n8n enhance-text flow.';

COMMENT ON COLUMN public.sticky_notes.redirects
    IS 'Deep-link paths (no locale prefix) corresponding to each action, in the same order. Example: /appointments?act=Crear';

COMMIT;
