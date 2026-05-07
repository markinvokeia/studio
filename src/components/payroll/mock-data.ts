import type {
  DoctorContract,
  PayrollCategory,
  PayrollEmployee,
  PayrollEmployment,
  PayrollEntry,
  PayrollFamilyCharge,
  PayrollHonorario,
  PayrollIrpfDeduction,
  PayrollManualAdjustment,
  PayrollNovedad,
  PayrollPeriod,
  PayrollSessionAssignment,
  PayrollSettings,
} from '@/lib/types';
import { DEFAULT_PAYROLL_SETTINGS } from './payroll-utils';

export const MOCK_SETTINGS: PayrollSettings = DEFAULT_PAYROLL_SETTINGS;

// ─── Employees ────────────────────────────────────────────────────────────────

export const MOCK_EMPLOYEES: PayrollEmployee[] = [
  {
    id: 'emp1',
    clinic_id: 'clinic1',
    clinic_name: 'Clínica Central',
    cedula: '12345678',
    nombres: 'Carlos',
    apellidos: 'García',
    fecha_nacimiento: '1985-03-15',
    sexo: 'M',
    estado_civil: 'casado',
    domicilio: 'Av. 18 de Julio 1234, Montevideo',
    telefono: '099123456',
    email: 'c.garcia@example.com',
    banco: 'BROU',
    cuenta_banco: '001234567890',
    numero_bps: '123456789',
    fecha_ingreso: '2022-01-15',
    activo: true,
    created_at: '2022-01-10T09:00:00Z',
  },
  {
    id: 'emp2',
    clinic_id: 'clinic1',
    clinic_name: 'Clínica Central',
    cedula: '23456789',
    nombres: 'María',
    apellidos: 'González',
    fecha_nacimiento: '1990-07-22',
    sexo: 'F',
    estado_civil: 'soltero',
    domicilio: 'Bvar. España 2100, Montevideo',
    telefono: '098765432',
    email: 'm.gonzalez@example.com',
    banco: 'Itaú',
    cuenta_banco: '001234567891',
    numero_bps: '234567890',
    fecha_ingreso: '2023-03-01',
    activo: true,
    created_at: '2023-02-20T10:00:00Z',
  },
  {
    id: 'emp3',
    clinic_id: 'clinic1',
    clinic_name: 'Clínica Central',
    cedula: '34567890',
    nombres: 'Andrés',
    apellidos: 'López',
    fecha_nacimiento: '1982-11-08',
    sexo: 'M',
    estado_civil: 'casado',
    telefono: '097654321',
    email: 'a.lopez@example.com',
    banco: 'Santander',
    cuenta_banco: '001234567892',
    numero_bps: '345678901',
    fecha_ingreso: '2021-06-01',
    activo: true,
    created_at: '2021-05-25T09:00:00Z',
  },
];

// ─── Employment (vinculaciones) ───────────────────────────────────────────────

export const MOCK_EMPLOYMENTS: PayrollEmployment[] = [
  {
    id: 'empl1',
    employee_id: 'emp1',
    employee_name: 'Carlos García',
    clinic_id: 'clinic1',
    tipo_contrato: 'dependencia',
    category_id: 'cat1',
    category_name: 'Odontólogo General',
    salario_minimo_categoria: 52000,
    fecha_inicio: '2022-01-15',
    jornada_horas_semanales: 40,
    modalidad_jornada: 'mensual',
    sueldo_base: 85000,
    productividad_porcentaje: 0,
    productividad_base: 'sobre_cobrado',
    tipo_aporte_bps: 'industria_comercio',
    is_active: true,
  },
  {
    id: 'empl2',
    employee_id: 'emp2',
    employee_name: 'María González',
    clinic_id: 'clinic1',
    tipo_contrato: 'dependencia',
    category_id: 'cat3',
    category_name: 'Asistente Dental',
    salario_minimo_categoria: 34000,
    fecha_inicio: '2023-03-01',
    jornada_horas_semanales: 40,
    modalidad_jornada: 'mensual',
    sueldo_base: 42000,
    productividad_porcentaje: 0,
    productividad_base: 'sobre_cobrado',
    tipo_aporte_bps: 'industria_comercio',
    is_active: true,
  },
  {
    id: 'empl3',
    employee_id: 'emp3',
    employee_name: 'Andrés López',
    clinic_id: 'clinic1',
    tipo_contrato: 'dependencia',
    category_id: 'cat1',
    category_name: 'Odontólogo General',
    salario_minimo_categoria: 52000,
    fecha_inicio: '2021-06-01',
    jornada_horas_semanales: 30,
    modalidad_jornada: 'mensual',
    sueldo_base: 65000,
    productividad_porcentaje: 15,
    productividad_base: 'sobre_cobrado',
    tipo_aporte_bps: 'industria_comercio',
    is_active: true,
  },
];

// ─── Family charges ───────────────────────────────────────────────────────────

export const MOCK_FAMILY_CHARGES: PayrollFamilyCharge[] = [
  {
    id: 'fc1',
    employee_id: 'emp1',
    tipo: 'conyuge',
    nombres: 'Ana',
    apellidos: 'García',
    cedula: '43210987',
    vigente_desde: '2015-08-10',
  },
  {
    id: 'fc2',
    employee_id: 'emp1',
    tipo: 'hijo',
    nombres: 'Tomás',
    apellidos: 'García',
    fecha_nacimiento: '2018-05-20',
    vigente_desde: '2018-05-20',
  },
  {
    id: 'fc3',
    employee_id: 'emp3',
    tipo: 'conyuge',
    nombres: 'Laura',
    apellidos: 'López',
    cedula: '54321098',
    vigente_desde: '2010-03-15',
  },
  {
    id: 'fc4',
    employee_id: 'emp3',
    tipo: 'hijo',
    nombres: 'Valentina',
    apellidos: 'López',
    fecha_nacimiento: '2012-09-01',
    vigente_desde: '2012-09-01',
  },
];

// ─── IRPF permanent deductions ────────────────────────────────────────────────

export const MOCK_IRPF_DEDUCTIONS: PayrollIrpfDeduction[] = [
  {
    id: 'ded1',
    employee_id: 'emp1',
    tipo: 'bhu_anv',
    descripcion: 'Cuota hipotecaria BHU',
    monto_mensual: 8500,
    vigente_desde: '2022-01-01',
  },
];

// ─── Contracts (doctores independientes) ─────────────────────────────────────

export const MOCK_CONTRACTS: DoctorContract[] = [
  {
    id: 'c1',
    doctor_id: 'd1',
    doctor_name: 'Dr. Carlos García',
    contract_type: 'empleado',
    calculation_type: 'fijo',
    base_salary: 85000,
    currency: 'UYU',
    has_children: false,
    valid_from: '2024-01-01',
    is_active: true,
    notes: 'Odontólogo general. Contrato de dependencia laboral.',
    created_at: '2024-01-01',
  },
  {
    id: 'c2',
    doctor_id: 'd2',
    doctor_name: 'Dra. Sofía Martínez',
    contract_type: 'arrendamiento',
    calculation_type: 'porcentaje',
    percentage_rate: 60,
    percentage_basis: 'sobre_cobrado',
    currency: 'UYU',
    has_children: true,
    valid_from: '2024-03-01',
    is_active: true,
    notes: 'Especialista en ortodoncia. Arrendamiento de servicios.',
    created_at: '2024-03-01',
  },
  {
    id: 'c3',
    doctor_id: 'd3',
    doctor_name: 'Dr. Andrés López',
    contract_type: 'empleado',
    calculation_type: 'fijo_porcentaje',
    base_salary: 45000,
    percentage_rate: 15,
    percentage_threshold: 100000,
    percentage_basis: 'sobre_realizado',
    currency: 'UYU',
    has_children: true,
    valid_from: '2024-06-01',
    is_active: true,
    notes: 'Cirujano bucal. Fijo + bono por producción.',
    created_at: '2024-06-01',
  },
  {
    id: 'c4',
    doctor_id: 'd4',
    doctor_name: 'Dra. Laura Fernández',
    contract_type: 'honorarios',
    calculation_type: 'por_hora',
    hourly_rate: 1800,
    currency: 'UYU',
    has_children: false,
    valid_from: '2025-01-01',
    is_active: true,
    notes: 'Endodoncista. Honorarios profesionales por hora.',
    created_at: '2025-01-01',
  },
  {
    id: 'c5',
    doctor_id: 'd5',
    doctor_name: 'Dr. Pablo Rodríguez',
    contract_type: 'empresa_unipersonal',
    calculation_type: 'por_prestacion',
    per_session_rate: 3500,
    currency: 'UYU',
    has_children: false,
    valid_from: '2024-09-01',
    valid_until: '2024-12-31',
    is_active: false,
    notes: 'Contrato finalizado.',
    created_at: '2024-09-01',
  },
];

// ─── Periods ──────────────────────────────────────────────────────────────────

export const MOCK_PERIODS: PayrollPeriod[] = [
  {
    id: 'p1',
    period_year: 2026,
    period_month: 2,
    status: 'closed',
    total_gross: 287500,
    total_net: 228640,
    total_employer_cost: 342180,
    entries_count: 4,
    honorarios_count: 2,
    total_honorarios: 144000,
    generated_at: '2026-03-01T09:00:00Z',
    approved_at: '2026-03-03T14:30:00Z',
    closed_at: '2026-03-05T16:00:00Z',
    generated_by: 'admin',
    approved_by: 'admin',
    closed_by: 'contador',
  },
  {
    id: 'p2',
    period_year: 2026,
    period_month: 3,
    status: 'approved',
    total_gross: 301200,
    total_net: 239850,
    total_employer_cost: 358640,
    entries_count: 4,
    honorarios_count: 2,
    total_honorarios: 152000,
    generated_at: '2026-04-01T08:45:00Z',
    approved_at: '2026-04-03T10:00:00Z',
    generated_by: 'admin',
    approved_by: 'admin',
  },
  {
    id: 'p3',
    period_year: 2026,
    period_month: 4,
    status: 'draft',
    entries_count: 0,
  },
];

// ─── Entries ──────────────────────────────────────────────────────────────────

export const MOCK_ENTRIES: PayrollEntry[] = [
  // Dr. García — empleado fijo, con cónyuge e hijos → FONASA 6.5% (≤2.5 BPC) o 8%
  {
    id: 'e1',
    payroll_period_id: 'p2',
    doctor_id: 'd1',
    doctor_name: 'Dr. Carlos García',
    doctor_contract_id: 'c1',
    contract_type: 'empleado',
    calculation_type: 'fijo',
    sessions_count: 22,
    hours_worked: 44,
    services_revenue_billed: 124000,
    services_revenue_listed: 131000,
    base_amount: 85000,
    variable_amount: 0,
    extra_hours_amount: 0,
    gross_salary: 85000,
    bps_employee: 12750,      // 15%
    fonasa_employee: 5525,    // 6.5% (con cónyuge e hijos, bruto > 2.5 BPC → 8% → pero < cap)
    frl_employee: 106,         // 0.125%
    irpf_withholding: 6200,
    other_deductions: 0,
    total_deductions: 24581,
    net_salary: 60419,
    bps_employer: 6375,       // 7.5%
    fonasa_employer: 4250,    // 5%
    frl_employer: 85,          // 0.10%
    fgcl_employer: 21,         // 0.025%
    bse_employer: 255,         // 0.3%
    ccm_employer: 0,           // FONASA > CPE
    aguinaldo_provision: 7083,
    vacation_provision: 4722,
    total_employer_cost: 107791,
    fonasa_family_situation: 'con_conyuge_e_hijos',
    fonasa_rate: 0.065,
    currency: 'UYU',
    exchange_rate: 1,
    status: 'draft',
    calculated_at: '2026-04-01T08:45:00Z',
  },
  // Dra. Martínez — arrendamiento 60% sobre cobrado (no empleada → sin aportes)
  {
    id: 'e2',
    payroll_period_id: 'p2',
    doctor_id: 'd2',
    doctor_name: 'Dra. Sofía Martínez',
    doctor_contract_id: 'c2',
    contract_type: 'arrendamiento',
    calculation_type: 'porcentaje',
    sessions_count: 18,
    hours_worked: 36,
    services_revenue_billed: 168000,
    services_revenue_listed: 175000,
    base_amount: 0,
    variable_amount: 100800,
    gross_salary: 100800,
    bps_employee: 0, fonasa_employee: 0, frl_employee: 0,
    irpf_withholding: 0, other_deductions: 0,
    total_deductions: 0, net_salary: 100800,
    bps_employer: 0, fonasa_employer: 0, frl_employer: 0,
    fgcl_employer: 0, bse_employer: 0, ccm_employer: 0,
    aguinaldo_provision: 0, vacation_provision: 0,
    total_employer_cost: 100800,
    currency: 'UYU', exchange_rate: 1, status: 'draft',
    calculated_at: '2026-04-01T08:45:00Z',
  },
  // Dr. López — empleado fijo + % sobre realizado, con cónyuge e hijos
  {
    id: 'e3',
    payroll_period_id: 'p2',
    doctor_id: 'd3',
    doctor_name: 'Dr. Andrés López',
    doctor_contract_id: 'c3',
    contract_type: 'empleado',
    calculation_type: 'fijo_porcentaje',
    sessions_count: 14,
    hours_worked: 28,
    services_revenue_billed: 98000,
    services_revenue_listed: 115400,
    base_amount: 45000,
    variable_amount: 2310,
    extra_hours_amount: 0,
    gross_salary: 47310,
    bps_employee: 7097,
    fonasa_employee: 3075,    // 6.5%
    frl_employee: 59,
    irpf_withholding: 1200,
    other_deductions: 0,
    total_deductions: 11431,
    net_salary: 35879,
    bps_employer: 3548,
    fonasa_employer: 2366,
    frl_employer: 47,
    fgcl_employer: 12,
    bse_employer: 142,
    ccm_employer: 3618,       // 6693 CPE − 3075 FONASA = 3618
    aguinaldo_provision: 3943,
    vacation_provision: 2629,
    total_employer_cost: 63515,
    fonasa_family_situation: 'con_conyuge_e_hijos',
    fonasa_rate: 0.065,
    currency: 'UYU', exchange_rate: 1, status: 'draft',
    calculated_at: '2026-04-01T08:45:00Z',
  },
  // Dra. Fernández — honorarios por hora (no empleada)
  {
    id: 'e4',
    payroll_period_id: 'p2',
    doctor_id: 'd4',
    doctor_name: 'Dra. Laura Fernández',
    doctor_contract_id: 'c4',
    contract_type: 'honorarios',
    calculation_type: 'por_hora',
    sessions_count: 12,
    hours_worked: 24,
    services_revenue_billed: 76000,
    services_revenue_listed: 80000,
    base_amount: 0,
    variable_amount: 43200,
    gross_salary: 43200,
    bps_employee: 0, fonasa_employee: 0, frl_employee: 0,
    irpf_withholding: 0, other_deductions: 0,
    total_deductions: 0, net_salary: 43200,
    bps_employer: 0, fonasa_employer: 0, frl_employer: 0,
    fgcl_employer: 0, bse_employer: 0, ccm_employer: 0,
    aguinaldo_provision: 0, vacation_provision: 0,
    total_employer_cost: 43200,
    currency: 'UYU', exchange_rate: 1, status: 'draft',
    calculated_at: '2026-04-01T08:45:00Z',
  },
];

// ─── Session assignments ──────────────────────────────────────────────────────

export const MOCK_SESSION_ASSIGNMENTS: PayrollSessionAssignment[] = [
  { id: 'sa1', payroll_entry_id: 'e1', session_id: 1001, session_date: '2026-03-02', doctor_id: 'd1', revenue_billed: 5800, revenue_listed: 6200, hours_billed: 2, is_included: true, service_names: 'Obturación, Limpieza' },
  { id: 'sa2', payroll_entry_id: 'e1', session_id: 1002, session_date: '2026-03-04', doctor_id: 'd1', revenue_billed: 4200, revenue_listed: 4200, hours_billed: 1.5, is_included: true, service_names: 'Extracción' },
  { id: 'sa3', payroll_entry_id: 'e1', session_id: 1003, session_date: '2026-03-07', doctor_id: 'd1', revenue_billed: 7600, revenue_listed: 8000, hours_billed: 2.5, is_included: true, service_names: 'Endodoncia' },
  { id: 'sa4', payroll_entry_id: 'e1', session_id: 1004, session_date: '2026-03-09', doctor_id: 'd1', revenue_billed: 3100, revenue_listed: 3100, hours_billed: 1, is_included: true, service_names: 'Consulta' },
  { id: 'sa5', payroll_entry_id: 'e2', session_id: 1010, session_date: '2026-03-03', doctor_id: 'd2', revenue_billed: 12000, revenue_listed: 12500, hours_billed: 3, is_included: true, service_names: 'Ortodoncia - ajuste' },
  { id: 'sa6', payroll_entry_id: 'e2', session_id: 1011, session_date: '2026-03-10', doctor_id: 'd2', revenue_billed: 11500, revenue_listed: 12000, hours_billed: 2.5, is_included: true, service_names: 'Ortodoncia - brackets' },
  { id: 'sa7', payroll_entry_id: 'e2', session_id: 1012, session_date: '2026-03-15', doctor_id: 'd2', revenue_billed: 0, revenue_listed: 8500, hours_billed: 2, is_included: false, service_names: 'Consulta inicial' },
];

// ─── Manual adjustments ───────────────────────────────────────────────────────

export const MOCK_ADJUSTMENTS: PayrollManualAdjustment[] = [
  {
    id: 'adj1',
    payroll_entry_id: 'e1',
    description: 'Bono por antigüedad Q1',
    amount: 5000,
    adjustment_type: 'addition',
    category: 'bono',
    created_at: '2026-04-02T10:00:00Z',
    created_by_name: 'Admin',
  },
  {
    id: 'adj2',
    payroll_entry_id: 'e3',
    description: 'Adelanto enero',
    amount: 10000,
    adjustment_type: 'deduction',
    category: 'adelanto',
    created_at: '2026-04-02T10:30:00Z',
    created_by_name: 'Admin',
  },
];

// ─── Novedades ────────────────────────────────────────────────────────────────

export const MOCK_NOVEDADES: PayrollNovedad[] = [
  {
    id: 'nov1',
    employment_id: 'empl1',
    employee_name: 'Carlos García',
    period_year: 2026,
    period_month: 4,
    tipo: 'hora_extra_habil',
    cantidad: 6,
    descripcion: 'Horas extra semana del 15/04',
    created_at: '2026-04-18T09:00:00Z',
    created_by: 'admin',
  },
  {
    id: 'nov2',
    employment_id: 'empl2',
    employee_name: 'María González',
    period_year: 2026,
    period_month: 4,
    tipo: 'certificado_medico',
    cantidad: 2,
    descripcion: 'Certificado médico 22-23/04',
    fecha_desde: '2026-04-22',
    fecha_hasta: '2026-04-23',
    created_at: '2026-04-24T08:30:00Z',
    created_by: 'admin',
  },
  {
    id: 'nov3',
    employment_id: 'empl3',
    employee_name: 'Andrés López',
    period_year: 2026,
    period_month: 4,
    tipo: 'adelanto',
    cantidad: 15000,
    descripcion: 'Adelanto de sueldo solicitado',
    created_at: '2026-04-10T10:00:00Z',
    created_by: 'admin',
  },
];

// ─── Honorarios ───────────────────────────────────────────────────────────────

export const MOCK_HONORARIOS: PayrollHonorario[] = [
  {
    id: 'hon1',
    payroll_period_id: 'p2',
    doctor_id: 'd2',
    doctor_name: 'Dra. Sofía Martínez',
    doctor_rut: '21345678901',
    modalidad: 'honorarios',
    clinic_id: 'clinic1',
    produccion_base: 168000,
    porcentaje: 60,
    descuentos: 0,
    bruto: 100800,
    iva: 10080,
    retenciones: 0,
    liquido: 100800,
    factura_numero: 'A-000123',
    factura_fecha: '2026-04-05',
    estado: 'validada',
    created_at: '2026-04-05T11:00:00Z',
  },
  {
    id: 'hon2',
    payroll_period_id: 'p2',
    doctor_id: 'd4',
    doctor_name: 'Dra. Laura Fernández',
    doctor_rut: '31234567890',
    modalidad: 'empresa_unipersonal',
    clinic_id: 'clinic1',
    produccion_base: 76000,
    porcentaje: 0,
    descuentos: 0,
    bruto: 43200,
    iva: 4320,
    retenciones: 0,
    liquido: 43200,
    factura_numero: 'B-000045',
    factura_fecha: '2026-04-06',
    estado: 'pendiente',
    created_at: '2026-04-06T09:30:00Z',
  },
];

// ─── Payroll Concepts / Rubros ────────────────────────────────────────────────

export interface PayrollConcept {
  id: string;
  codigo: string;
  nombre: string;
  tipo: 'haber' | 'descuento' | 'provision' | 'informativo';
  grava_bps: boolean;
  grava_irpf: boolean;
  activo: boolean;
}

export const MOCK_CONCEPTS: PayrollConcept[] = [
  {
    id: 'con1',
    codigo: '001',
    nombre: 'Sueldo básico',
    tipo: 'haber',
    grava_bps: true,
    grava_irpf: true,
    activo: true,
  },
  {
    id: 'con2',
    codigo: '010',
    nombre: 'Montepío BPS',
    tipo: 'descuento',
    grava_bps: false,
    grava_irpf: false,
    activo: true,
  },
  {
    id: 'con3',
    codigo: '011',
    nombre: 'FONASA empleado',
    tipo: 'descuento',
    grava_bps: false,
    grava_irpf: false,
    activo: true,
  },
  {
    id: 'con4',
    codigo: '020',
    nombre: 'Provisión aguinaldo',
    tipo: 'provision',
    grava_bps: true,
    grava_irpf: false,
    activo: true,
  },
  {
    id: 'con5',
    codigo: '050',
    nombre: 'Horas trabajadas',
    tipo: 'informativo',
    grava_bps: false,
    grava_irpf: false,
    activo: true,
  },
];

// ─── MTSS Group 15 Categories ─────────────────────────────────────────────────

export const MOCK_CATEGORIES: PayrollCategory[] = [
  {
    id: 'cat1',
    codigo: 'G15-01',
    nombre: 'Odontólogo General',
    subgrupo: '01',
    salario_minimo_uyu: 52000,
    vigente_desde: '2025-01-01',
  },
  {
    id: 'cat2',
    codigo: 'G15-02',
    nombre: 'Especialista Odontológico',
    subgrupo: '01',
    salario_minimo_uyu: 68000,
    vigente_desde: '2025-01-01',
  },
  {
    id: 'cat3',
    codigo: 'G15-10',
    nombre: 'Asistente Dental',
    subgrupo: '02',
    salario_minimo_uyu: 34000,
    vigente_desde: '2025-01-01',
  },
  {
    id: 'cat4',
    codigo: 'G15-11',
    nombre: 'Recepcionista / Secretaria',
    subgrupo: '03',
    salario_minimo_uyu: 28500,
    vigente_desde: '2025-01-01',
  },
  {
    id: 'cat5',
    codigo: 'G15-20',
    nombre: 'Auxiliar de Servicios',
    subgrupo: '04',
    salario_minimo_uyu: 24000,
    vigente_desde: '2025-01-01',
  },
];

// ─── Work Calendar ────────────────────────────────────────────────────────────

export interface WorkCalendarDay {
  id: string;
  fecha: string;
  tipo: 'feriado_no_laborable' | 'feriado_comun' | 'cierre_clinica';
  descripcion: string;
}

export const MOCK_WORK_CALENDAR: WorkCalendarDay[] = [
  {
    id: 'wc1',
    fecha: '2026-01-01',
    tipo: 'feriado_no_laborable',
    descripcion: 'Año Nuevo',
  },
  {
    id: 'wc2',
    fecha: '2026-04-02',
    tipo: 'feriado_no_laborable',
    descripcion: 'Jueves de Semana Santa',
  },
  {
    id: 'wc3',
    fecha: '2026-04-03',
    tipo: 'feriado_no_laborable',
    descripcion: 'Viernes de Semana Santa',
  },
  {
    id: 'wc4',
    fecha: '2026-05-01',
    tipo: 'feriado_no_laborable',
    descripcion: 'Día del Trabajo',
  },
  {
    id: 'wc5',
    fecha: '2026-07-18',
    tipo: 'feriado_no_laborable',
    descripcion: 'Jura de la Constitución',
  },
  {
    id: 'wc6',
    fecha: '2026-12-25',
    tipo: 'feriado_comun',
    descripcion: 'Navidad',
  },
];
