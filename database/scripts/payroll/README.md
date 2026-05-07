# Nóminas — Scripts de Base de Datos

## Orden de ejecución

| Nº | Archivo | Descripción |
|----|---------|-------------|
| 1 | `001_create_payroll_tables.sql` | Crea todos los tipos ENUM, tablas e índices del módulo |
| 2 | `002_seed_payroll_dev.sql` | Inserta datos de prueba usando los doctores reales del sistema |

## Tablas creadas

| Tabla | Propósito |
|-------|-----------|
| `payroll_settings` | Tasas BPS/FONASA/IRPF/BPC configurables |
| `payroll_categories` | Categorías Grupo 15 MTSS con salarios mínimos |
| `payroll_concepts` | Catálogo de rubros de la liquidación |
| `payroll_work_calendar` | Feriados y cierres de clínica |
| `payroll_employees` | Legajo de empleados en dependencia laboral |
| `payroll_employments` | Vinculaciones / contratos BPS de cada empleado |
| `payroll_family_charges` | Cargas de familia (afecta tasa FONASA) |
| `payroll_irpf_deductions` | Deducciones IRPF declaradas por el empleado |
| `doctor_contracts` | Contratos honorarios / arrendamiento / empresa unipersonal |
| `payroll_periods` | Períodos mensuales de nómina |
| `payroll_entries` | Liquidación individual por empleado/período |
| `payroll_session_assignments` | Sesiones clínicas incluidas en una liquidación |
| `payroll_manual_adjustments` | Ajustes manuales (bonos, adelantos, descuentos) |
| `payroll_novedades` | Ausencias, horas extra, licencias por período |
| `payroll_honorarios` | Liquidación de honorarios profesionales |

## Antes de ejecutar el seed

El script 002 usa la primera clínica disponible (`SELECT id FROM clinics ORDER BY created_at LIMIT 1`).
Si necesitás una clínica específica, editá el script y reemplazá el CTE `first_clinic`.

## Doctores incluidos en el seed

| Doctor | UUID | Tipo contrato |
|--------|------|---------------|
| Jean Molina | `7f03e1e2-...` | Empleado dependencia — fijo |
| Dulce Viltre | `e4780813-...` | Empleada dependencia — fija, con hijo |
| Murse Ruiz | `23edf804-...` | Empleado dependencia — fijo |
| Dr Manuel Vilano | `57233abc-...` | Empleado dependencia — fijo + 30% producción |
| Dra. Ana López | `eab92215-...` | Empleada dependencia — fija + 25% producción |
| Pedro Suárez | `e4d19d69-...` | Honorarios — 40% sobre cobrado |
| Susel Romero | `b26e9bc4-...` | Arrendamiento — 35% sobre cobrado |
| Jose L Perales | `1893cd70-...` | Honorarios — fijo UYU 180,000 |
| Dr. Romano Roses | `1e467ab4-...` | Arrendamiento — 45% sobre cobrado |
