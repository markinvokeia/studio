-- =============================================================================
-- MÓDULO DE NÓMINAS — InvokeIA Studio
-- Script: 009_adjustment_category_hora_extra.sql
-- Descripción: Agrega el valor 'hora_extra' al enum adjustment_category_enum
--   para poder registrar horas extra como ajuste manual a la liquidación
--   (payroll_manual_adjustments), junto con bono / adelanto / descuento.
-- Autor: InvokeIA
-- Fecha: 2026-06-17
-- =============================================================================

-- ALTER TYPE ... ADD VALUE no puede correr dentro de un bloque de transacción
-- junto con su uso; se ejecuta de forma idempotente con IF NOT EXISTS.
ALTER TYPE adjustment_category_enum ADD VALUE IF NOT EXISTS 'hora_extra';
