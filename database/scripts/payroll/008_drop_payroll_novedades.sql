-- =============================================================================
-- MÓDULO DE NÓMINAS — InvokeIA Studio
-- Script: 008_drop_payroll_novedades.sql
-- Descripción: Elimina la tabla payroll_novedades y todo lo asociado. El control
--   de eventos del personal (vacaciones, ausencias, licencias, etc.) se unifica
--   en payroll_ausencias (ver 006). Las "novedades" dejan de usarse.
--
--   CASCADE elimina la tabla, sus índices (idx_payroll_novedades_*, idx_pn_period)
--   y cualquier dependencia. También se elimina el enum novedad_type_enum.
-- Autor: InvokeIA
-- Fecha: 2026-06-17
-- =============================================================================

BEGIN;

DROP TABLE IF EXISTS public.payroll_novedades CASCADE;

DROP TYPE IF EXISTS novedad_type_enum;

COMMIT;
