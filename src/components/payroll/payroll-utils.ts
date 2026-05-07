import type { FonasaFamilySituation, FonasaTableRow, IrpfBracket, PayrollEntry, PayrollSettings } from '@/lib/types';

export const DEFAULT_FONASA_TABLE: FonasaTableRow[] = [
  { situation: 'sin_conyuge_sin_hijos', until_2_5_bpc: 0.03,  above_2_5_bpc: 0.045 },
  { situation: 'con_hijos',            until_2_5_bpc: 0.05,  above_2_5_bpc: 0.06  },
  { situation: 'con_conyuge',          until_2_5_bpc: 0.05,  above_2_5_bpc: 0.06  },
  { situation: 'con_conyuge_e_hijos',  until_2_5_bpc: 0.065, above_2_5_bpc: 0.08  },
];

export const DEFAULT_PAYROLL_SETTINGS: PayrollSettings = {
  // BPS
  montepio_employee_rate: 0.15,
  bps_employer_rate: 0.075,
  bps_employee_rate: 0.15,
  bps_salary_cap_uyu: 272564,
  // FONASA
  fonasa_employer_rate: 0.05,
  fonasa_annual_cap_uyu: 100395,
  fonasa_table: DEFAULT_FONASA_TABLE,
  // Legacy simple fields
  fonasa_employee_base: 0.03,
  fonasa_employee_children: 0.06,
  // FRL
  frl_employee_rate: 0.00125,
  frl_employer_rate: 0.001,
  // FGCL / BSE
  fgcl_employer_rate: 0.00025,
  bse_employer_rate: 0.003,
  // IRPF — fracciones MENSUALES en BPC (anuales / 12)
  bpc_value_uyu: 6600,
  cpe_value_uyu: 6693,
  irpf_brackets: [
    { from: 0,   to: 7,   rate: 0 },
    { from: 7,   to: 10,  rate: 0.10 },
    { from: 10,  to: 15,  rate: 0.15 },
    { from: 15,  to: 50,  rate: 0.24 },
    { from: 50,  to: 75,  rate: 0.25 },
    { from: 75,  to: 110, rate: 0.27 },
    { from: 110, to: 200, rate: 0.31 },
    { from: 200, to: Infinity, rate: 0.36 },
  ],
  // Other
  vacation_days_per_year: 20,
  default_currency: 'UYU',
  min_salary_national: 24572,
};

/** Resolve FONASA rate for a given family situation and gross salary. */
export function getFonasaRate(
  situation: FonasaFamilySituation,
  grossSalary: number,
  settings: PayrollSettings,
): number {
  const row = settings.fonasa_table.find((r) => r.situation === situation);
  if (!row) return settings.fonasa_employee_base;
  const threshold = settings.bpc_value_uyu * 2.5;
  return grossSalary <= threshold ? row.until_2_5_bpc : row.above_2_5_bpc;
}

function applyIrpfBrackets(bpcAmount: number, brackets: IrpfBracket[]): number {
  let tax = 0;
  for (const bracket of brackets) {
    if (bpcAmount <= bracket.from) break;
    const upper = bracket.to === Infinity ? bpcAmount : bracket.to;
    const taxable = Math.min(bpcAmount, upper) - bracket.from;
    tax += taxable * bracket.rate;
  }
  return tax;
}

export function calculateIrpfMonthly(
  grossMonthly: number,
  bpsEmployee: number,
  fonasaEmployee: number,
  frlEmployee: number,
  irpfDeductionsPermanent: number,
  settings: PayrollSettings,
): number {
  const annualGross = grossMonthly * 12;
  const bpcAmount = annualGross / settings.bpc_value_uyu;
  const grossIrpfAnnual = applyIrpfBrackets(bpcAmount, settings.irpf_brackets) * settings.bpc_value_uyu;
  // Deduct allowable annual contributions
  const deductibleAnnual = (bpsEmployee + fonasaEmployee + frlEmployee) * 12 + irpfDeductionsPermanent * 12;
  const netIrpfAnnual = Math.max(0, grossIrpfAnnual - deductibleAnnual * 0.10);
  return Math.round((netIrpfAnnual / 12) * 100) / 100;
}

export function calculateEntryTotals(
  grossSalary: number,
  familySituation: FonasaFamilySituation,
  isEmpleado: boolean,
  manualDeductions: number,
  settings: PayrollSettings,
  permanentIrpfDeductions = 0,
): Pick<
  PayrollEntry,
  | 'bps_employee' | 'fonasa_employee' | 'frl_employee'
  | 'irpf_withholding' | 'other_deductions' | 'total_deductions' | 'net_salary'
  | 'bps_employer' | 'fonasa_employer' | 'frl_employer' | 'fgcl_employer' | 'bse_employer' | 'ccm_employer'
  | 'aguinaldo_provision' | 'vacation_provision' | 'total_employer_cost'
  | 'fonasa_family_situation' | 'fonasa_rate'
> {
  if (!isEmpleado) {
    return {
      bps_employee: 0, fonasa_employee: 0, frl_employee: 0,
      irpf_withholding: 0, other_deductions: manualDeductions,
      total_deductions: manualDeductions, net_salary: grossSalary - manualDeductions,
      bps_employer: 0, fonasa_employer: 0, frl_employer: 0, fgcl_employer: 0,
      bse_employer: 0, ccm_employer: 0, aguinaldo_provision: 0, vacation_provision: 0,
      total_employer_cost: grossSalary,
      fonasa_family_situation: familySituation, fonasa_rate: 0,
    };
  }

  const cappedGross = Math.min(grossSalary, settings.bps_salary_cap_uyu);

  // Employee contributions
  const bps_employee = Math.round(cappedGross * settings.montepio_employee_rate * 100) / 100;
  const fonasaRate = getFonasaRate(familySituation, grossSalary, settings);
  const fonasa_employee = Math.round(cappedGross * fonasaRate * 100) / 100;
  const frl_employee = Math.round(cappedGross * settings.frl_employee_rate * 100) / 100;
  const irpf_withholding = calculateIrpfMonthly(
    grossSalary, bps_employee, fonasa_employee, frl_employee, permanentIrpfDeductions, settings
  );
  const total_deductions = bps_employee + fonasa_employee + frl_employee + irpf_withholding + manualDeductions;
  const net_salary = Math.round((grossSalary - total_deductions) * 100) / 100;

  // Employer contributions
  const bps_employer = Math.round(cappedGross * settings.bps_employer_rate * 100) / 100;
  const fonasa_employer = Math.round(cappedGross * settings.fonasa_employer_rate * 100) / 100;
  const frl_employer = Math.round(cappedGross * settings.frl_employer_rate * 100) / 100;
  const fgcl_employer = Math.round(cappedGross * settings.fgcl_employer_rate * 100) / 100;
  const bse_employer = Math.round(cappedGross * settings.bse_employer_rate * 100) / 100;
  // CCM: if monthly FONASA employee < CPE, clinic pays the difference
  const ccm_employer = fonasa_employee < settings.cpe_value_uyu
    ? Math.round((settings.cpe_value_uyu - fonasa_employee) * 100) / 100
    : 0;

  const aguinaldo_provision = Math.round((grossSalary / 12) * 100) / 100;
  const vacation_provision = Math.round((grossSalary / 30) * (settings.vacation_days_per_year / 12) * 100) / 100;
  const total_employer_cost = Math.round(
    (grossSalary + bps_employer + fonasa_employer + frl_employer + fgcl_employer + bse_employer + ccm_employer + aguinaldo_provision + vacation_provision) * 100
  ) / 100;

  return {
    bps_employee, fonasa_employee, frl_employee,
    irpf_withholding, other_deductions: manualDeductions,
    total_deductions: Math.round(total_deductions * 100) / 100,
    net_salary,
    bps_employer, fonasa_employer, frl_employer, fgcl_employer, bse_employer, ccm_employer,
    aguinaldo_provision, vacation_provision, total_employer_cost,
    fonasa_family_situation: familySituation, fonasa_rate: fonasaRate,
  };
}

export function formatCurrency(amount: number, currency: 'UYU' | 'USD' = 'UYU'): string {
  return new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getMonthName(month: number, locale = 'es'): string {
  return new Date(2024, month - 1, 1).toLocaleString(locale, { month: 'long' });
}

export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const s = dateStr.slice(0, 10);
  const parts = s.split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  return `${d}-${m}-${y}`;
}
