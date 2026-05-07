-- ─────────────────────────────────────────────────────────────────────────────
-- 004_payroll_performance_and_audit.sql
--
-- Adds performance indexes for common query patterns and a JSONB column on
-- payroll_entries to snapshot calculation inputs at computation time.
-- This enables full audit traceability and exact recalculation at any point
-- in the future, even if master data (employments, settings, family charges)
-- has changed since the original calculation.
-- ─────────────────────────────────────────────────────────────────────────────

-- Indexes for payroll_entries
CREATE INDEX IF NOT EXISTS idx_pe_period_id
    ON payroll_entries(payroll_period_id);

CREATE INDEX IF NOT EXISTS idx_pe_doctor_id
    ON payroll_entries(doctor_id);

-- Indexes for payroll_session_assignments
CREATE INDEX IF NOT EXISTS idx_psa_entry_id
    ON payroll_session_assignments(payroll_entry_id);

CREATE INDEX IF NOT EXISTS idx_psa_doctor_date
    ON payroll_session_assignments(doctor_id, session_date);

-- Indexes for payroll_novedades (filtered by period when building entries)
CREATE INDEX IF NOT EXISTS idx_pn_period
    ON payroll_novedades(period_year, period_month);

-- Index for payroll_periods lookups by clinic + period
CREATE INDEX IF NOT EXISTS idx_pp_clinic_period
    ON payroll_periods(clinic_id, period_year, period_month);

-- ─────────────────────────────────────────────────────────────────────────────
-- Audit snapshot column on payroll_entries
--
-- Stores the complete set of inputs used for the calculation at the moment it
-- was run. This allows:
--   • Displaying the exact formula breakdown to admins
--   • Reproducing the calculation without relying on current master data
--   • Detecting drift (if master data changed after calculation)
--
-- Schema of the JSON object:
-- {
--   "employment":      { PayrollEmployment record snapshot },
--   "contract":        { DoctorContract record snapshot, if applicable },
--   "family_charges":  [ PayrollFamilyCharge[] ],
--   "irpf_deductions": [ PayrollIrpfDeduction[] ],
--   "novedades":       [ PayrollNovedad[] for this period ],
--   "settings":        { PayrollSettings key-value snapshot }
-- }
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE payroll_entries
    ADD COLUMN IF NOT EXISTS calculation_params JSONB DEFAULT NULL;
