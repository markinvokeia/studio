# Módulo de Liquidación de Nóminas — Plan Técnico v2
## InvokeIA Studio · Uruguay · Abril 2026


---


## Índice


1. [Estado actual y delta vs v1](#1-estado-actual-y-delta-vs-v1)
2. [Cálculos Uruguay — corregidos y completos](#2-cálculos-uruguay--corregidos-y-completos)
3. [Modelo de datos completo](#3-modelo-de-datos-completo)
4. [Estructura frontend completa](#4-estructura-frontend-completa)
5. [Endpoints n8n completos](#5-endpoints-n8n-completos)
6. [Permisos por vista y acción](#6-permisos-por-vista-y-acción)
7. [Tipos TypeScript actualizados](#7-tipos-typescript-actualizados)
8. [Fases de implementación](#8-fases-de-implementación)


---


## 1. Estado actual y delta vs v1


### 1.1 Lo que ya está hecho (Fase 1)


| Archivo | Estado |
|---------|--------|
| `src/lib/types.ts` | Tipos básicos de payroll agregados (DoctorContract, PayrollPeriod, PayrollEntry, etc.) |
| `src/constants/routes.ts` | Objeto `PAYROLL` con 22 rutas |
| `src/constants/permissions.ts` | `PAYROLL_PERMISSIONS` con 17 códigos |
| `src/config/nav.ts` | Sección Nóminas con 4 subitems |
| `src/messages/es.json` + `en.json` | Namespace completo `PayrollPage.*` |
| `src/components/payroll/payroll-utils.ts` | Motor de cálculo básico |
| `src/components/payroll/mock-data.ts` | 5 contratos, 3 períodos, 4 entradas, 7 sesiones |
| `src/components/payroll/` | 10 componentes (Dashboard, ContractList, PeriodList, PeriodDetail, EntryDetail, SessionsTable, ManualAdjustments, Breakdown, Settings, ContractFormDialog) |
| `src/app/[locale]/payroll/` | 5 páginas (dashboard, contracts, periods, periods/[id], settings) |


### 1.2 Errores en v1 que hay que corregir


| Problema | Corrección |
|----------|------------|
| BPC = $5,999 | Actualizar a $6,600 (2026) |
| FONASA solo 2 tasas (3% / 6%) | Implementar tabla completa de 5 filas × 2 columnas (ver sección 2.3) |
| Falta CPE ($6,693) | Nuevo parámetro obligatorio para cálculo CCM |
| Falta FRL obrero (0.125%) y patronal (0.10%) | Agregar al motor de cálculo |
| Falta FGCL patronal (0.025%) | Agregar al motor de cálculo |
| Falta BSE (variable) | Tasa configurable por empleador, no calculable |
| Falta CCM | Condicional: solo si FONASA_personal < CPE |
| Aporte patronal BPS jubilatorio correcto | Confirmar: 7.5% (en v1 usaba 12.625% total) |


### 1.3 Funcionalidades completamente nuevas vs v1


- Legajo del empleado (datos personales, CI, banco, BPS, etc.)
- Vinculaciones contractuales con categoría Grupo 15 y jornada
- Cargas de familia (cónyuge + hijos) para FONASA e IRPF
- Deducciones permanentes IRPF (BHU, Caja Profesional, alimentos, etc.)
- Documentos adjuntos al legajo
- Novedades del mes (horas extra, ausencias, certificados, licencias)
- Categorías y salarios mínimos Grupo 15 MTSS
- Conceptos/rubros parametrizables
- Calendario laboral (feriados)
- Liquidación por egreso (salario pendiente + aguinaldo prop. + licencia + vacacional + indemnización)
- Honorarios: órdenes de pago a independientes + validación facturas
- Cierre formal del período (bloqueo + archivos BPS + archivo bancario)
- Reportes: BPS ATYR, GAFI, DGI IRPF, MTSS planilla, archivo bancario, asientos contables
- Portal del trabajador (recibos, certificados)


---


## 2. Cálculos Uruguay — corregidos y completos


### 2.1 Parámetros 2026


| Parámetro | Valor | Descripción |
|-----------|-------|-------------|
| `bpc_value_uyu` | $6,600 | Base de Prestaciones y Contribuciones mensual |
| `cpe_value_uyu` | $6,693 | Costo Promedio Equivalente (FONASA) |
| `fonasa_annual_cap_uyu` | $100,395 | Tope anual FONASA individual |
| `min_salary_national` | $24,572 | Salario Mínimo Nacional |
| `bps_salary_cap_uyu` | ~$272,564 | Tope aportes BPS (en revisión) |


### 2.2 Tasas de aportes


```
APORTES OBREROS (a cargo del trabajador):
 Montepío (jubilatorio):     15.00%
 FONASA:                     ver tabla 2.3
 FRL:                         0.125%
 IRPF:                        ver franjas 2.4


APORTES PATRONALES (a cargo de la clínica):
 BPS jubilatorio patronal:    7.50%
 FONASA:                      5.00%
 FRL patronal:                0.10%
 FGCL:                        0.025%
 BSE (accidentes trabajo):    variable (configurable por empleador)
 CCM:                         solo si FONASA_personal_mensual < CPE
```


### 2.3 Tabla FONASA personal (5 situaciones familiares × 2 tramos de ingreso)


| Situación familiar | Hasta 2.5 BPC (~$16,500) | Más de 2.5 BPC |
|--------------------|--------------------------|----------------|
| Sin cónyuge, sin hijos | 3.00% | 4.50% |
| Con hijos (sin cónyuge) | 5.00% | 6.00% |
| Con cónyuge (sin hijos) | 5.00% | 6.00% |
| Con cónyuge e hijos | 6.50% | 8.00% |


**Regla CCM:** si `FONASA_mensual_empleado < CPE ($6,693)`, la clínica paga la diferencia como CCM.


### 2.4 IRPF Categoría II — Franjas progresivas (en BPC mensuales)


| Desde (BPC/mes) | Hasta (BPC/mes) | Hasta UYU aprox. | Tasa |
|-----------------|-----------------|-------------------|------|
| 0 | 7 | ~$46,200 | 0% (exento) |
| 7 | 10 | ~$66,000 | 10% |
| 10 | 15 | ~$99,000 | 15% |
| 15 | 50 | ~$330,000 | 24% |
| 50 | 75 | ~$495,000 | 25% |
| 75 | 110 | ~$726,000 | 27% |
| 110 | 200 | ~$1,320,000 | 31% |
| 200 | ∞ | — | 36% |


**Deducciones IRPF admitidas:**
- 7% × BPC × hijos menores a cargo (sin discapacidad)
- 14% × BPC × hijos con discapacidad
- FONASA obrero del mes
- FRL obrero del mes
- Cuota BHU/ANV (préstamos hipotecarios)
- Aportes a Caja Profesional
- Pensiones alimenticias (judiciales)
- Alquiler de vivienda (con tope)


### 2.5 Aguinaldo


```
Provisión mensual = nominal_mensual / 12
Pago semestre 1 (junio):  suma nominales dic–may / 12
Pago semestre 2 (diciembre): suma nominales jun–nov / 12
Genera aportes BPS + retención IRPF
```


### 2.6 Licencia y salario vacacional


```
Licencia anual:
 - Primer año: 1.6667 días/mes trabajado
 - A partir del año: 20 días corridos anuales
 - +1 día cada 4 años desde el año 5


Salario vacacional = jornal_líquido × días_licencia × 100%
 - jornal_líquido = (nominal - aportes_obreros - IRPF) / 30
 - No genera aportes BPS, sí genera IRPF


Provisión mensual = (nominal/30) × 1.6667  (primer año)
```


### 2.7 Liquidación por egreso


```
1. Salario proporcional al mes = nominal × (días_trabajados / días_mes)
2. Aguinaldo proporcional = suma_nominales_semestre / 12 × (meses/6)
3. Licencia no gozada = jornal_líquido × días_licencia_acumulada
4. Salario vacacional proporcional = jornal_líquido × días_licencia_no_gozada × 100%
5. Indemnización por despido sin causa = 1 mensualidad/año (máx 6)
  Si egreso por renuncia: sin indemnización
  Si vencimiento contrato a término: sin indemnización
```


### 2.8 Horas extra


```
Día hábil (lunes–sábado): tarifa_hora × 2.00
Día feriado pago:         tarifa_hora × 2.50
tarifa_hora = nominal_mensual / (horas_semanales × 4.33)
```


---


## 3. Modelo de datos completo


### 3.1 Tablas existentes reutilizadas


| Tabla | Campos usados | Para qué |
|-------|---------------|----------|
| `users` | `id`, `name`, `is_sales`, `email` | Identificar doctores y empleados |
| `user_clinic` | `user_id`, `clinic_id` | Saber a qué clínica(s) pertenece |
| `patient_sessions` | `sesion_id`, `doctor_id`, `fecha_sesion`, `procedimiento_realizado` | Sesiones del período para producción |
| `appointments` | `id`, `doctor_id`, `date`, `services[]`, `status`, `duration_minutes` | Actividad y horas trabajadas |
| `services` | `id`, `price`, `duration_minutes` | Precio lista y horas |
| `payments` | `amount_applied`, `payment_date`, `quote_id` | Ingresos cobrados por sesión |
| `clinics` | `id`, `name`, `rut` | Datos del empleador para recibos |


### 3.2 Tablas nuevas


#### `payroll_employees`
```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id               UUID → users.id (NULL si el empleado no tiene login)
clinic_id             UUID → clinics.id
cedula                VARCHAR(20) UNIQUE NOT NULL
nombres               VARCHAR(100) NOT NULL
apellidos             VARCHAR(100) NOT NULL
fecha_nacimiento      DATE
sexo                  ENUM('M','F','O')
estado_civil          ENUM('soltero','casado','divorciado','viudo','union_libre')
domicilio             TEXT
telefono              VARCHAR(30)
email                 VARCHAR(150)
banco                 VARCHAR(60)
cuenta_banco          VARCHAR(30)
numero_bps            VARCHAR(20)
fecha_ingreso         DATE NOT NULL
foto_url              TEXT
activo                BOOLEAN DEFAULT TRUE
created_at            TIMESTAMPTZ DEFAULT now()
created_by            UUID → users.id
```


#### `payroll_employment` (vinculaciones)
```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
employee_id           UUID → payroll_employees.id
clinic_id             UUID → clinics.id
tipo_contrato         ENUM('dependencia','arrendamiento','honorarios','empresa_unipersonal','pasante','termino','suplencia')
category_id           UUID → payroll_categories.id
fecha_inicio          DATE NOT NULL
fecha_fin             DATE  -- NULL = vigente
jornada_horas_semanales DECIMAL(5,2) DEFAULT 40
modalidad_jornada     ENUM('mensual','jornal','horario') DEFAULT 'mensual'
sueldo_base           DECIMAL(12,2) NOT NULL
productividad_porcentaje DECIMAL(5,2) DEFAULT 0
productividad_base    ENUM('sobre_cobrado','sobre_realizado') DEFAULT 'sobre_cobrado'
centro_costo_id       UUID → cost_centers.id (NULL if no cost centers)
tipo_aporte_bps       ENUM('industria_comercio','civil') DEFAULT 'industria_comercio'
is_active             BOOLEAN DEFAULT TRUE
motivo_baja           TEXT
fecha_baja            DATE
created_at            TIMESTAMPTZ DEFAULT now()
created_by            UUID → users.id
```


#### `payroll_family_charges` (cargas de familia)
```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
employee_id           UUID → payroll_employees.id
tipo                  ENUM('conyuge','hijo','hijo_discapacidad')
nombres               VARCHAR(100) NOT NULL
apellidos             VARCHAR(100) NOT NULL
fecha_nacimiento      DATE
cedula                VARCHAR(20)
vigente_desde         DATE NOT NULL
vigente_hasta         DATE  -- NULL = vigente
documento_url         TEXT
created_at            TIMESTAMPTZ DEFAULT now()
```


#### `payroll_irpf_deductions` (deducciones permanentes)
```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
employee_id           UUID → payroll_employees.id
tipo                  ENUM('bhu_anv','caja_profesional','alimentos','alquiler','otro')
descripcion           VARCHAR(200) NOT NULL
monto_mensual         DECIMAL(10,2) NOT NULL
vigente_desde         DATE NOT NULL
vigente_hasta         DATE
documento_url         TEXT
created_at            TIMESTAMPTZ DEFAULT now()
```


#### `payroll_employee_documents`
```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
employee_id           UUID → payroll_employees.id
tipo                  ENUM('cedula','contrato','acta_bps','certificado_medico','otro')
descripcion           VARCHAR(200)
archivo_url           TEXT NOT NULL
fecha_documento       DATE
uploaded_at           TIMESTAMPTZ DEFAULT now()
uploaded_by           UUID → users.id
```


#### `payroll_categories` (Grupo 15 — categorías y salarios mínimos)
```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
codigo                VARCHAR(20) UNIQUE NOT NULL
nombre                VARCHAR(150) NOT NULL
subgrupo              VARCHAR(50)  -- subgrupo laudo
descripcion           TEXT
salario_minimo_uyu    DECIMAL(12,2) NOT NULL
vigente_desde         DATE NOT NULL
vigente_hasta         DATE
created_at            TIMESTAMPTZ DEFAULT now()
```


#### `payroll_concepts` (rubros/conceptos parametrizables)
```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
codigo                VARCHAR(30) UNIQUE NOT NULL
nombre                VARCHAR(100) NOT NULL
tipo                  ENUM('haber','descuento','provision','informativo')
formula               TEXT  -- expresión evaluable o código de cálculo predefinido
grava_aportes_bps     BOOLEAN DEFAULT TRUE
grava_irpf            BOOLEAN DEFAULT TRUE
integra_aguinaldo     BOOLEAN DEFAULT TRUE
integra_licencia      BOOLEAN DEFAULT TRUE
cuenta_contable_haber VARCHAR(20)
cuenta_contable_debe  VARCHAR(20)
is_active             BOOLEAN DEFAULT TRUE
vigente_desde         DATE NOT NULL
created_at            TIMESTAMPTZ DEFAULT now()
```


#### `payroll_work_calendar` (calendario laboral)
```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
clinic_id             UUID → clinics.id  -- NULL = global para todas
fecha                 DATE NOT NULL
tipo                  ENUM('feriado_no_laborable','feriado_comun','cierre_clinica')
descripcion           VARCHAR(100)
UNIQUE(clinic_id, fecha)
```


#### `payroll_novedades` (novedades del mes)
```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
employment_id         UUID → payroll_employment.id
period_year           INTEGER NOT NULL
period_month          INTEGER NOT NULL  -- 1-12
tipo                  ENUM('hora_extra_habil','hora_extra_feriado','ausencia_justificada','ausencia_injustificada','certificado_medico','licencia','vacaciones','adelanto','bono','descuento','otro')
cantidad              DECIMAL(8,2) NOT NULL  -- horas, días, o monto según tipo
descripcion           VARCHAR(255)
fecha_desde           DATE
fecha_hasta           DATE
aprobado_por          UUID → users.id
created_at            TIMESTAMPTZ DEFAULT now()
created_by            UUID → users.id
```


#### `payroll_periods` (MODIFICADA)
```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
period_year           INTEGER NOT NULL
period_month          INTEGER NOT NULL
status                ENUM('draft','calculated','approved','paid','closed') DEFAULT 'draft'
total_gross           DECIMAL(14,2)
total_net             DECIMAL(14,2)
total_employer_cost   DECIMAL(14,2)
total_bps_employer    DECIMAL(12,2)
total_bps_employee    DECIMAL(12,2)
total_fonasa          DECIMAL(12,2)
total_irpf            DECIMAL(12,2)
entries_count         INTEGER DEFAULT 0
honorarios_count      INTEGER DEFAULT 0
total_honorarios      DECIMAL(14,2)
generated_at          TIMESTAMPTZ
approved_at           TIMESTAMPTZ
paid_at               TIMESTAMPTZ
closed_at             TIMESTAMPTZ
generated_by          UUID → users.id
approved_by           UUID → users.id
closed_by             UUID → users.id
notes                 TEXT
created_at            TIMESTAMPTZ DEFAULT now()
UNIQUE(period_year, period_month)
```


#### `payroll_entries` (MODIFICADA — campos adicionales)
```sql
id                          UUID PRIMARY KEY DEFAULT gen_random_uuid()
payroll_period_id           UUID → payroll_periods.id
employee_id                 UUID → payroll_employees.id  -- puede ser NULL para doctores sin legajo
employment_id               UUID → payroll_employment.id
doctor_id                   UUID → users.id
doctor_name                 VARCHAR(150)  -- desnormalizado para historial
doctor_contract_id          UUID → doctor_contracts.id
clinic_id                   UUID → clinics.id
contract_type               TEXT
calculation_type            TEXT


-- Actividad del período
sessions_count              INTEGER DEFAULT 0
hours_worked                DECIMAL(6,2) DEFAULT 0
hours_extra_habiles         DECIMAL(6,2) DEFAULT 0
hours_extra_feriados        DECIMAL(6,2) DEFAULT 0
absence_days                DECIMAL(5,2) DEFAULT 0
services_revenue_billed     DECIMAL(12,2) DEFAULT 0
services_revenue_listed     DECIMAL(12,2) DEFAULT 0


-- Cálculo bruto
base_amount                 DECIMAL(12,2) DEFAULT 0
variable_amount             DECIMAL(12,2) DEFAULT 0
extra_hours_amount          DECIMAL(12,2) DEFAULT 0
gross_salary                DECIMAL(12,2) DEFAULT 0  -- base + variable + horas extra


-- Deducciones obreras
bps_employee                DECIMAL(10,2) DEFAULT 0   -- Montepío 15%
fonasa_employee             DECIMAL(10,2) DEFAULT 0   -- según tabla familiar
frl_employee                DECIMAL(10,2) DEFAULT 0   -- 0.125%
irpf_withholding            DECIMAL(10,2) DEFAULT 0
other_deductions            DECIMAL(10,2) DEFAULT 0
total_deductions            DECIMAL(10,2) DEFAULT 0


-- Neto
net_salary                  DECIMAL(12,2) DEFAULT 0


-- Aportes patronales
bps_employer                DECIMAL(10,2) DEFAULT 0   -- 7.5%
fonasa_employer             DECIMAL(10,2) DEFAULT 0   -- 5%
frl_employer                DECIMAL(10,2) DEFAULT 0   -- 0.10%
fgcl_employer               DECIMAL(10,2) DEFAULT 0   -- 0.025%
bse_employer                DECIMAL(10,2) DEFAULT 0   -- variable
ccm_employer                DECIMAL(10,2) DEFAULT 0   -- si FONASA < CPE


-- Provisiones
aguinaldo_provision         DECIMAL(10,2) DEFAULT 0
vacation_provision          DECIMAL(10,2) DEFAULT 0
total_employer_cost         DECIMAL(12,2) DEFAULT 0


-- FONASA info
fonasa_family_situation     ENUM('sin_conyuge_sin_hijos','con_hijos','con_conyuge','con_conyuge_e_hijos')
fonasa_rate                 DECIMAL(5,4) DEFAULT 0


-- Meta
currency                    ENUM('UYU','USD') DEFAULT 'UYU'
exchange_rate               DECIMAL(8,4) DEFAULT 1
status                      ENUM('draft','approved','paid') DEFAULT 'draft'
notes                       TEXT
calculated_at               TIMESTAMPTZ
created_at                  TIMESTAMPTZ DEFAULT now()
UNIQUE(payroll_period_id, employment_id)
```


#### `payroll_session_assignments` (sin cambios estructurales)
```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
payroll_entry_id      UUID → payroll_entries.id
session_id            INTEGER → patient_sessions.sesion_id
appointment_id        UUID → appointments.id
session_date          DATE NOT NULL
doctor_id             UUID → users.id
clinic_id             UUID → clinics.id
revenue_billed        DECIMAL(10,2) DEFAULT 0
revenue_listed        DECIMAL(10,2) DEFAULT 0
hours_billed          DECIMAL(4,2) DEFAULT 0
is_included           BOOLEAN DEFAULT TRUE
created_at            TIMESTAMPTZ DEFAULT now()
```


#### `payroll_manual_adjustments` (sin cambios estructurales)
```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
payroll_entry_id      UUID → payroll_entries.id
description           VARCHAR(255) NOT NULL
amount                DECIMAL(10,2) NOT NULL
adjustment_type       ENUM('addition','deduction')
category              ENUM('bono','adelanto','descuento','correccion','otro')
created_at            TIMESTAMPTZ DEFAULT now()
created_by            UUID → users.id
```


#### `payroll_honorarios` (órdenes de pago a independientes)
```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
payroll_period_id     UUID → payroll_periods.id
doctor_id             UUID → users.id
doctor_name           VARCHAR(150)
doctor_rut            VARCHAR(20)
modalidad             ENUM('honorarios','empresa_unipersonal','sociedad')
clinic_id             UUID → clinics.id
produccion_base       DECIMAL(14,2) NOT NULL  -- producción del mes
porcentaje            DECIMAL(5,2)
descuentos            DECIMAL(12,2) DEFAULT 0
bruto                 DECIMAL(12,2) NOT NULL
iva                   DECIMAL(10,2) DEFAULT 0
retenciones           DECIMAL(10,2) DEFAULT 0  -- si aplica
liquido               DECIMAL(12,2) NOT NULL
factura_numero        VARCHAR(50)
factura_fecha         DATE
factura_url           TEXT
estado                ENUM('pendiente','validada','autorizada','pagada','rechazada') DEFAULT 'pendiente'
fecha_pago            DATE
notes                 TEXT
created_at            TIMESTAMPTZ DEFAULT now()
created_by            UUID → users.id
```


#### `payroll_accounting_entries` (asientos contables)
```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
payroll_period_id     UUID → payroll_periods.id
payroll_entry_id      UUID → payroll_entries.id  -- NULL para asientos del período
tipo                  ENUM('salario','aguinaldo','licencia','aporte_bps','irpf','honorario','provision')
cuenta_debe           VARCHAR(20) NOT NULL
cuenta_haber          VARCHAR(20) NOT NULL
monto                 DECIMAL(14,2) NOT NULL
centro_costo          VARCHAR(50)
descripcion           VARCHAR(255)
exported              BOOLEAN DEFAULT FALSE
exported_at           TIMESTAMPTZ
created_at            TIMESTAMPTZ DEFAULT now()
```


#### `payroll_settings` (MODIFICADA — más parámetros)
```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
setting_key           VARCHAR(100) UNIQUE NOT NULL
setting_value         JSONB NOT NULL
description           TEXT
updated_at            TIMESTAMPTZ DEFAULT now()
updated_by            UUID → users.id
```


Valores iniciales (2026):
```json
{ "key": "bpc_value_uyu",               "value": 6600       }
{ "key": "cpe_value_uyu",               "value": 6693       }
{ "key": "fonasa_annual_cap_uyu",        "value": 100395     }
{ "key": "min_salary_national",          "value": 24572      }
{ "key": "bps_salary_cap_uyu",           "value": 272564     }
{ "key": "montepio_employee_rate",        "value": 0.15       }
{ "key": "bps_employer_rate",            "value": 0.075      }
{ "key": "fonasa_employer_rate",         "value": 0.05       }
{ "key": "frl_employee_rate",            "value": 0.00125    }
{ "key": "frl_employer_rate",            "value": 0.001      }
{ "key": "fgcl_employer_rate",           "value": 0.00025    }
{ "key": "bse_employer_rate",            "value": 0.003      }
{ "key": "fonasa_table",
 "value": [
   {"situation":"sin_conyuge_sin_hijos","until_2_5_bpc":0.03,"above_2_5_bpc":0.045},
   {"situation":"con_hijos",           "until_2_5_bpc":0.05,"above_2_5_bpc":0.06},
   {"situation":"con_conyuge",         "until_2_5_bpc":0.05,"above_2_5_bpc":0.06},
   {"situation":"con_conyuge_e_hijos", "until_2_5_bpc":0.065,"above_2_5_bpc":0.08}
 ]
}
{ "key": "irpf_brackets",
 "value": [
   {"from":0,"to":7,"rate":0},
   {"from":7,"to":10,"rate":0.10},
   {"from":10,"to":15,"rate":0.15},
   {"from":15,"to":50,"rate":0.24},
   {"from":50,"to":75,"rate":0.25},
   {"from":75,"to":110,"rate":0.27},
   {"from":110,"to":200,"rate":0.31},
   {"from":200,"to":null,"rate":0.36}
 ]
}
{ "key": "vacation_days_per_year",       "value": 20         }
{ "key": "default_currency",             "value": "UYU"      }
```


---


## 4. Estructura frontend completa


### 4.1 Páginas (`src/app/[locale]/payroll/`)


```
payroll/
├── layout.tsx                        Guard: PAYROLL_VIEW_MENU
├── page.tsx                          Dashboard principal (→ PayrollDashboard)
│
├── employees/
│   ├── page.tsx                      Lista de empleados (→ EmployeeList)
│   └── [id]/
│       └── page.tsx                  Legajo empleado con tabs (→ LegajoTabs)
│
├── contracts/
│   └── page.tsx                      Contratos de doctores (→ ContractList) [existente]
│
├── periods/
│   ├── page.tsx                      Lista períodos (→ PeriodList) [existente]
│   └── [id]/
│       └── page.tsx                  Detalle período (→ PeriodDetail) [existente]
│
├── novedades/
│   └── page.tsx                      Novedades del mes (→ NovedadesPage)
│
├── honorarios/
│   ├── page.tsx                      Lista honorarios (→ HonorariosList)
│   └── [id]/
│       └── page.tsx                  Detalle orden (→ HonorariosDetail)
│
├── egreso/
│   └── page.tsx                      Liquidación por egreso (→ EgresoWizard)
│
├── cierre/
│   └── page.tsx                      Cierre formal del período (→ CierreWorkflow)
│
├── reports/
│   └── page.tsx                      Reportes y exportaciones (→ ReportsPanel)
│
├── portal/
│   └── page.tsx                      Portal del trabajador (→ WorkerPortal)
│
└── settings/
   └── page.tsx                      Configuración (→ PayrollSettingsPage) [existente]
```


### 4.2 Componentes (`src/components/payroll/`)


```
payroll/
├── mock-data.ts                      [existente — ampliar con todos los nuevos tipos]
├── payroll-utils.ts                  [existente — ampliar con FONASA 5 tramos, FRL, FGCL, BSE, CCM]
│
├── dashboard/
│   └── PayrollDashboard.tsx          [existente] KPIs, tabla resumen, alertas
│
├── employees/
│   ├── EmployeeList.tsx              DataTable con filtros
│   ├── EmployeeFormDialog.tsx        Create/edit empleado (datos personales + vinculación)
│   ├── LegajoTabs.tsx                Shell de pestañas del legajo
│   ├── LegajoPersonal.tsx            Tab: datos personales y banco
│   ├── LegajoVinculaciones.tsx       Tab: historial de contratos laborales
│   ├── LegajoCargasFamilia.tsx       Tab: cónyuge e hijos
│   ├── LegajoDeducciones.tsx         Tab: deducciones permanentes IRPF
│   ├── LegajoDocumentos.tsx          Tab: documentos adjuntos
│   └── LegajoHistorial.tsx           Tab: historial de cambios/auditoría
│
├── contracts/
│   ├── ContractList.tsx              [existente]
│   └── ContractFormDialog.tsx        [existente]
│
├── periods/
│   ├── PeriodList.tsx                [existente]
│   ├── PeriodDetail.tsx              [existente]
│   ├── PayrollEntryDetail.tsx        [existente]
│   ├── PayrollCalculationBreakdown.tsx [existente — ampliar con FRL/FGCL/BSE/CCM]
│   ├── ManualAdjustmentsPanel.tsx    [existente]
│   └── SessionAssignmentsTable.tsx   [existente]
│
├── novedades/
│   ├── NovedadesTable.tsx            Tabla editable inline por empleado
│   └── NovedadesImportDialog.tsx     Upload XLSX/CSV con validación previa
│
├── honorarios/
│   ├── HonorariosList.tsx            DataTable con estados (pendiente/validada/pagada)
│   ├── HonorariosFormDialog.tsx      Generar orden de pago a partir de producción
│   └── FacturaValidationPanel.tsx    Validar datos factura recibida del profesional
│
├── egreso/
│   └── EgresoWizard.tsx              Wizard multi-paso: selección empleado → cálculo → confirmación
│
├── cierre/
│   └── CierreWorkflow.tsx            Steps: generar archivos BPS → archivo banco → emitir recibos → cerrar
│
├── reports/
│   └── ReportsPanel.tsx              Tabs por reporte: BPS ATYR, GAFI, DGI IRPF, MTSS, banco, contable
│
├── settings/
│   ├── PayrollSettings.tsx           [existente] BPS/FONASA/IRPF tasas
│   ├── ConceptsTable.tsx             CRUD de conceptos/rubros
│   ├── CategoriesTable.tsx           CRUD categorías Grupo 15
│   └── WorkCalendarPanel.tsx         Gestión feriados y días de cierre
│
└── portal/
   └── WorkerPortal.tsx              Vista empleado: recibos, certificados, constancias
```


### 4.3 Navegación actualizada (`src/config/nav.ts`)


```typescript
{
 title: 'Payroll',
 href: '/payroll',
 icon: Banknote,
 requiredPermission: PAYROLL_PERMISSIONS.VIEW_MENU,
 items: [
   { title: 'PayrollDashboard',   href: '/payroll',            icon: LayoutDashboard, isChidren: true },
   { title: 'PayrollEmployees',   href: '/payroll/employees',  icon: Users,           isChidren: true },
   { title: 'PayrollNovedades',   href: '/payroll/novedades',  icon: ClipboardList,   isChidren: true },
   { title: 'PayrollPeriods',     href: '/payroll/periods',    icon: CalendarDays,    isChidren: true },
   { title: 'PayrollHonorarios',  href: '/payroll/honorarios', icon: Receipt,         isChidren: true },
   { title: 'PayrollEgreso',      href: '/payroll/egreso',     icon: LogOut,          isChidren: true },
   { title: 'PayrollReports',     href: '/payroll/reports',    icon: FileBarChart,    isChidren: true },
   { title: 'PayrollCierre',      href: '/payroll/cierre',     icon: Lock,            isChidren: true },
   { title: 'PayrollContracts',   href: '/payroll/contracts',  icon: FileText,        isChidren: true },
   { title: 'PayrollSettings',    href: '/payroll/settings',   icon: Settings2,       isChidren: true },
   { title: 'PayrollPortal',      href: '/payroll/portal',     icon: UserCircle,      isChidren: true },
 ],
}
```


---


## 5. Endpoints n8n completos


### 5.1 Employees (legajo)


```
GET  /payroll/employees                        lista (filtros: clinic_id, activo, search)
POST /payroll/employees/upsert                 crear/editar empleado
POST /payroll/employees/deactivate             baja del empleado { id, motivo }
GET  /payroll/employees/detail                 legajo completo { id }
```


### 5.2 Employment (vinculaciones)


```
GET  /payroll/employment/by-employee           { employee_id }
POST /payroll/employment/upsert                crear/editar vinculación
POST /payroll/employment/terminate             marcar baja + fecha
```


### 5.3 Family charges


```
GET  /payroll/family-charges/by-employee       { employee_id }
POST /payroll/family-charges/upsert
POST /payroll/family-charges/delete
```


### 5.4 IRPF deductions


```
GET  /payroll/irpf-deductions/by-employee      { employee_id }
POST /payroll/irpf-deductions/upsert
POST /payroll/irpf-deductions/delete
```


### 5.5 Contracts (doctores independientes — existente)


```
GET  /payroll/contracts                        (filtros: doctor_id, clinic_id, active)
POST /payroll/contracts/upsert
POST /payroll/contracts/delete                 soft delete
GET  /payroll/contracts/by-doctor
```


### 5.6 Novedades


```
GET  /payroll/novedades/by-period              { year, month, clinic_id? }
POST /payroll/novedades/upsert                 una novedad
POST /payroll/novedades/bulk-upsert            múltiples novedades de una vez
POST /payroll/novedades/delete
POST /payroll/novedades/import                 validar + importar desde XLSX/CSV
```


### 5.7 Periods


```
GET  /payroll/periods                          (filtros: year, status)
POST /payroll/periods/create                   { year, month }
GET  /payroll/periods/detail                   { id }
POST /payroll/periods/calculate                (re)calcular todas las entradas
POST /payroll/periods/approve
POST /payroll/periods/mark-paid
POST /payroll/periods/close                    cierre formal (genera archivos, bloquea)
POST /payroll/periods/reopen                   reapertura controlada con justificativo
```


### 5.8 Entries


```
GET  /payroll/entries/by-period                { period_id, clinic_id?, doctor_id? }
GET  /payroll/entries/detail                   { id }
POST /payroll/entries/update
```


### 5.9 Session assignments


```
GET  /payroll/session-assignments              { entry_id }
POST /payroll/session-assignments/toggle       incluir/excluir + recalcular entry
```


### 5.10 Manual adjustments


```
POST /payroll/adjustments/upsert               + recalcular entry
POST /payroll/adjustments/delete               + recalcular entry
```


### 5.11 Honorarios


```
GET  /payroll/honorarios                       (filtros: period_id, doctor_id, estado)
POST /payroll/honorarios/generate-order        generar desde producción { doctor_id, period_id }
POST /payroll/honorarios/validate-invoice      validar factura recibida { id, factura_* }
POST /payroll/honorarios/authorize-payment     autorizar pago { id }
POST /payroll/honorarios/mark-paid             { id, fecha_pago }
POST /payroll/honorarios/reject                { id, motivo }
```


### 5.12 Egreso


```
POST /payroll/egreso/calculate                 cálculo preliminar { employment_id, fecha_egreso, motivo }
POST /payroll/egreso/confirm                   confirmar y generar recibo final
```


### 5.13 Categories (Grupo 15)


```
GET  /payroll/categories                       (filtros: vigente)
POST /payroll/categories/upsert
```


### 5.14 Concepts (rubros)


```
GET  /payroll/concepts
POST /payroll/concepts/upsert
POST /payroll/concepts/toggle-active
```


### 5.15 Work calendar


```
GET  /payroll/calendar                         { clinic_id?, year }
POST /payroll/calendar/upsert-event
POST /payroll/calendar/delete-event
```


### 5.16 Reports y exports


```
GET  /payroll/reports/bps-nomina               { period_id } → archivo ATYR layout BPS
GET  /payroll/reports/gafi                     { period_id } → altas/bajas/modificaciones BPS
GET  /payroll/reports/dgi-irpf-annual          { year } → declaración jurada anual DGI
GET  /payroll/reports/mtss-planilla            { year } → planilla MTSS
GET  /payroll/reports/bank-file                { period_id, bank } → acreditación sueldos
GET  /payroll/reports/accounting-entries       { period_id } → asientos contables CSV/JSON
GET  /payroll/reports/receipts-batch           { period_id } → PDF recibos masivos
GET  /payroll/reports/cost-by-center           { period_id, year? } → costo por centro de costo
```


### 5.17 Dashboard y settings


```
GET  /payroll/dashboard                        { year, month, clinic_id? }
GET  /payroll/settings
POST /payroll/settings/update
```


---


## 6. Permisos por vista y acción


### 6.1 Códigos de permiso actualizados


```typescript
export const PAYROLL_PERMISSIONS = {
 VIEW_MENU:                  'PAYROLL_VIEW_MENU',


 // Dashboard
 DASHBOARD_VIEW:             'PAYROLL_DASHBOARD_VIEW',


 // Employees (legajo)
 EMPLOYEES_VIEW_LIST:        'PAYROLL_EMPLOYEES_VIEW_LIST',
 EMPLOYEES_CREATE:           'PAYROLL_EMPLOYEES_CREATE',
 EMPLOYEES_UPDATE:           'PAYROLL_EMPLOYEES_UPDATE',
 EMPLOYEES_DEACTIVATE:       'PAYROLL_EMPLOYEES_DEACTIVATE',
 EMPLOYEES_VIEW_LEGAJO:      'PAYROLL_EMPLOYEES_VIEW_LEGAJO',
 EMPLOYEES_MANAGE_FAMILY:    'PAYROLL_EMPLOYEES_MANAGE_FAMILY',
 EMPLOYEES_MANAGE_DEDUCTIONS:'PAYROLL_EMPLOYEES_MANAGE_DEDUCTIONS',
 EMPLOYEES_MANAGE_DOCUMENTS: 'PAYROLL_EMPLOYEES_MANAGE_DOCUMENTS',


 // Contracts (doctores independientes)
 CONTRACTS_VIEW_LIST:        'PAYROLL_CONTRACTS_VIEW_LIST',
 CONTRACTS_CREATE:           'PAYROLL_CONTRACTS_CREATE',
 CONTRACTS_UPDATE:           'PAYROLL_CONTRACTS_UPDATE',
 CONTRACTS_DELETE:           'PAYROLL_CONTRACTS_DELETE',


 // Novedades
 NOVEDADES_VIEW:             'PAYROLL_NOVEDADES_VIEW',
 NOVEDADES_MANAGE:           'PAYROLL_NOVEDADES_MANAGE',
 NOVEDADES_IMPORT:           'PAYROLL_NOVEDADES_IMPORT',


 // Periods
 PERIODS_VIEW_LIST:          'PAYROLL_PERIODS_VIEW_LIST',
 PERIODS_CREATE:             'PAYROLL_PERIODS_CREATE',
 PERIODS_CALCULATE:          'PAYROLL_PERIODS_CALCULATE',
 PERIODS_APPROVE:            'PAYROLL_PERIODS_APPROVE',
 PERIODS_MARK_PAID:          'PAYROLL_PERIODS_MARK_PAID',
 PERIODS_CLOSE:              'PAYROLL_PERIODS_CLOSE',
 PERIODS_REOPEN:             'PAYROLL_PERIODS_REOPEN',


 // Entries
 ENTRIES_VIEW:               'PAYROLL_ENTRIES_VIEW',
 ENTRIES_UPDATE:             'PAYROLL_ENTRIES_UPDATE',
 ADJUSTMENTS_MANAGE:         'PAYROLL_ADJUSTMENTS_MANAGE',


 // Honorarios
 HONORARIOS_VIEW:            'PAYROLL_HONORARIOS_VIEW',
 HONORARIOS_MANAGE:          'PAYROLL_HONORARIOS_MANAGE',
 HONORARIOS_AUTHORIZE:       'PAYROLL_HONORARIOS_AUTHORIZE',
 HONORARIOS_MARK_PAID:       'PAYROLL_HONORARIOS_MARK_PAID',


 // Egreso
 EGRESO_CALCULATE:           'PAYROLL_EGRESO_CALCULATE',
 EGRESO_CONFIRM:             'PAYROLL_EGRESO_CONFIRM',


 // Reports
 REPORTS_VIEW:               'PAYROLL_REPORTS_VIEW',
 REPORTS_BPS:                'PAYROLL_REPORTS_BPS',
 REPORTS_DGI:                'PAYROLL_REPORTS_DGI',
 REPORTS_BANK:               'PAYROLL_REPORTS_BANK',
 REPORTS_ACCOUNTING:         'PAYROLL_REPORTS_ACCOUNTING',
 REPORTS_RECEIPTS:           'PAYROLL_REPORTS_RECEIPTS',


 // Cierre
 CIERRE_EXECUTE:             'PAYROLL_CIERRE_EXECUTE',
 CIERRE_REOPEN:              'PAYROLL_CIERRE_REOPEN',


 // Settings
 SETTINGS_VIEW:              'PAYROLL_SETTINGS_VIEW',
 SETTINGS_UPDATE:            'PAYROLL_SETTINGS_UPDATE',
 SETTINGS_CONCEPTS:          'PAYROLL_SETTINGS_CONCEPTS',
 SETTINGS_CATEGORIES:        'PAYROLL_SETTINGS_CATEGORIES',
 SETTINGS_CALENDAR:          'PAYROLL_SETTINGS_CALENDAR',


 // Export genérico
 EXPORT:                     'PAYROLL_EXPORT',


 // Portal del trabajador
 PORTAL_VIEW:                'PAYROLL_PORTAL_VIEW',
} as const
```


### 6.2 Permiso mínimo por vista


| Ruta | Permiso mínimo | Nota |
|------|----------------|------|
| `/payroll` | `DASHBOARD_VIEW` | |
| `/payroll/employees` | `EMPLOYEES_VIEW_LIST` | |
| `/payroll/employees/[id]` | `EMPLOYEES_VIEW_LEGAJO` | |
| `/payroll/contracts` | `CONTRACTS_VIEW_LIST` | |
| `/payroll/novedades` | `NOVEDADES_VIEW` | |
| `/payroll/periods` | `PERIODS_VIEW_LIST` | |
| `/payroll/periods/[id]` | `PERIODS_VIEW_LIST` + `ENTRIES_VIEW` | |
| `/payroll/honorarios` | `HONORARIOS_VIEW` | |
| `/payroll/honorarios/[id]` | `HONORARIOS_VIEW` | |
| `/payroll/egreso` | `EGRESO_CALCULATE` | |
| `/payroll/reports` | `REPORTS_VIEW` | |
| `/payroll/cierre` | `CIERRE_EXECUTE` | Rol contador/admin |
| `/payroll/settings` | `SETTINGS_VIEW` | |
| `/payroll/portal` | `PORTAL_VIEW` | Solo rol empleado |


> **Nota durante Fase 1 (mocks):** Todas las páginas se renderizan sin `<PrivateRoute>` / `<Can>`. Los permisos se activarán en Fase 3 cuando el backend esté listo.


---


## 7. Tipos TypeScript actualizados


Agregar/modificar en `src/lib/types.ts`:


```typescript
// ─── Employees / Legajo ─────────────────────────────────────────────────────


export type ContractLaboralType =
 | 'dependencia' | 'arrendamiento' | 'honorarios'
 | 'empresa_unipersonal' | 'pasante' | 'termino' | 'suplencia'


export type FonasaFamilySituation =
 | 'sin_conyuge_sin_hijos' | 'con_hijos' | 'con_conyuge' | 'con_conyuge_e_hijos'


export interface PayrollEmployee {
 id: string
 user_id?: string
 clinic_id: string
 cedula: string
 nombres: string
 apellidos: string
 fecha_nacimiento?: string
 sexo?: 'M' | 'F' | 'O'
 estado_civil?: 'soltero' | 'casado' | 'divorciado' | 'viudo' | 'union_libre'
 domicilio?: string
 telefono?: string
 email?: string
 banco?: string
 cuenta_banco?: string
 numero_bps?: string
 fecha_ingreso: string
 foto_url?: string
 activo: boolean
 created_at?: string
}


export interface PayrollEmployment {
 id: string
 employee_id: string
 clinic_id: string
 tipo_contrato: ContractLaboralType
 category_id?: string
 category_name?: string
 fecha_inicio: string
 fecha_fin?: string
 jornada_horas_semanales: number
 modalidad_jornada: 'mensual' | 'jornal' | 'horario'
 sueldo_base: number
 productividad_porcentaje: number
 productividad_base: PercentageBasis
 centro_costo_id?: string
 tipo_aporte_bps: 'industria_comercio' | 'civil'
 is_active: boolean
 motivo_baja?: string
 fecha_baja?: string
}


export interface PayrollFamilyCharge {
 id: string
 employee_id: string
 tipo: 'conyuge' | 'hijo' | 'hijo_discapacidad'
 nombres: string
 apellidos: string
 fecha_nacimiento?: string
 cedula?: string
 vigente_desde: string
 vigente_hasta?: string
 documento_url?: string
}


export interface PayrollIrpfDeduction {
 id: string
 employee_id: string
 tipo: 'bhu_anv' | 'caja_profesional' | 'alimentos' | 'alquiler' | 'otro'
 descripcion: string
 monto_mensual: number
 vigente_desde: string
 vigente_hasta?: string
 documento_url?: string
}


// ─── Categories (Grupo 15) ───────────────────────────────────────────────────


export interface PayrollCategory {
 id: string
 codigo: string
 nombre: string
 subgrupo?: string
 descripcion?: string
 salario_minimo_uyu: number
 vigente_desde: string
 vigente_hasta?: string
}


// ─── Novedades ───────────────────────────────────────────────────────────────


export type NovedadType =
 | 'hora_extra_habil' | 'hora_extra_feriado'
 | 'ausencia_justificada' | 'ausencia_injustificada' | 'certificado_medico'
 | 'licencia' | 'vacaciones' | 'adelanto' | 'bono' | 'descuento' | 'otro'


export interface PayrollNovedad {
 id: string
 employment_id: string
 employee_name?: string
 period_year: number
 period_month: number
 tipo: NovedadType
 cantidad: number
 descripcion?: string
 fecha_desde?: string
 fecha_hasta?: string
 aprobado_por?: string
 created_at?: string
 created_by?: string
}


// ─── Honorarios ─────────────────────────────────────────────────────────────


export type HonorariosEstado =
 | 'pendiente' | 'validada' | 'autorizada' | 'pagada' | 'rechazada'


export interface PayrollHonorario {
 id: string
 payroll_period_id: string
 doctor_id: string
 doctor_name?: string
 doctor_rut?: string
 modalidad: 'honorarios' | 'empresa_unipersonal' | 'sociedad'
 clinic_id: string
 produccion_base: number
 porcentaje: number
 descuentos: number
 bruto: number
 iva: number
 retenciones: number
 liquido: number
 factura_numero?: string
 factura_fecha?: string
 factura_url?: string
 estado: HonorariosEstado
 fecha_pago?: string
 notes?: string
 created_at?: string
}


// ─── Periods (actualizado) ───────────────────────────────────────────────────


export type PayrollPeriodStatus = 'draft' | 'calculated' | 'approved' | 'paid' | 'closed'


// PayrollPeriod ya existe — solo agregar status 'closed' al tipo union


// ─── Entries (actualizado) ───────────────────────────────────────────────────


// PayrollEntry ya existe — agregar nuevos campos:
// frl_employee, frl_employer, fgcl_employer, bse_employer, ccm_employer
// fonasa_family_situation, fonasa_rate
// hours_extra_habiles, hours_extra_feriados, absence_days
// extra_hours_amount


// ─── Settings (actualizado) ─────────────────────────────────────────────────


export interface FonasaTableRow {
 situation: FonasaFamilySituation
 until_2_5_bpc: number
 above_2_5_bpc: number
}


export interface PayrollSettings {
 bpc_value_uyu: number
 cpe_value_uyu: number
 fonasa_annual_cap_uyu: number
 min_salary_national: number
 bps_salary_cap_uyu: number
 montepio_employee_rate: number
 bps_employer_rate: number
 fonasa_employer_rate: number
 frl_employee_rate: number
 frl_employer_rate: number
 fgcl_employer_rate: number
 bse_employer_rate: number
 fonasa_table: FonasaTableRow[]
 irpf_brackets: Array<{ from: number; to: number | null; rate: number }>
 vacation_days_per_year: number
 default_currency: 'UYU' | 'USD'
}
```


---


## 8. Fases de implementación


### Fase 1 — Frontend con mocks ✅ COMPLETADA


Todo el frontend básico con datos mock. Dashboard, contratos, períodos, detalle, settings.


### Fase 2 — Ampliar frontend con nuevas secciones (próxima)


**Prioridad:** Alta — todo con mocks, sin backend.


1. Corregir `payroll-utils.ts`:
  - BPC = $6,600
  - CPE = $6,693
  - FONASA con tabla de 4 situaciones familiares × 2 tramos
  - Agregar FRL obrero (0.125%) y patronal (0.10%)
  - Agregar FGCL (0.025%)
  - Agregar BSE (rate configurable)
  - Agregar CCM condicional (si FONASA < CPE)


2. Actualizar `PayrollSettings.tsx` y `PayrollCalculationBreakdown.tsx` con nuevos campos.


3. Ampliar `mock-data.ts` con `MOCK_EMPLOYEES`, `MOCK_EMPLOYMENTS`, `MOCK_FAMILY_CHARGES`, `MOCK_NOVEDADES`, `MOCK_HONORARIOS`.


4. Actualizar `src/lib/types.ts` con todos los tipos nuevos.


5. Actualizar `src/constants/permissions.ts` con los nuevos códigos.


6. Actualizar `src/config/nav.ts` con las nuevas secciones.


7. Implementar nuevas páginas y componentes:
  - `employees/` (list + legajo con 6 tabs)
  - `novedades/` (tabla editable + import)
  - `honorarios/` (list + detail)
  - `egreso/` (wizard 3 pasos)
  - `reports/` (panel con tabs por reporte)
  - `cierre/` (workflow 4 pasos)
  - `portal/` (vista empleado)


8. Actualizar `src/messages/es.json` y `en.json` con todos los nuevos strings.


### Fase 3 — Backend n8n core (cálculo real)


**Dependencias:** BD creada, tablas migradas.


1. SQL de migración: crear todas las tablas nuevas.
2. Endpoints employees: GET, upsert, deactivate, detail.
3. Endpoints employment: by-employee, upsert, terminate.
4. Endpoints family-charges, irpf-deductions.
5. Endpoint periods/calculate — motor de cálculo n8n con datos reales.
6. Reemplazar mock calls en PeriodDetail, PayrollDashboard, ContractList.


### Fase 4 — Novedades, honorarios y egreso


1. Endpoints novedades: by-period, upsert, bulk-upsert, import.
2. Endpoints honorarios: generate-order, validate-invoice, authorize, mark-paid.
3. Endpoint egreso: calculate + confirm.
4. Integrar novedades al cálculo (horas extra afectan gross_salary).


### Fase 5 — Cierre formal y reportes


1. Endpoints periods/close y periods/reopen.
2. Endpoints reports: BPS ATYR, GAFI, DGI IRPF anual, MTSS planilla.
3. Endpoint reports/bank-file (formato BROU primero).
4. Endpoint accounting-entries + export.
5. Endpoint receipts-batch (PDF generación masiva).


### Fase 6 — Portal del trabajador


1. Endpoint portal del empleado: recibos, certificados, constancias.
2. Envío de recibos por email.
3. Conservación con hash de integridad.


### Fase 7 — Piloto


1. Operar en paralelo con la planilla existente de la clínica piloto (3 meses).
2. Validar cálculos con contador.
3. Enviar archivos BPS y DGI reales.
4. Afinar alertas (sueldo bajo laudo, líquido negativo, IRPF inconsistente).


---


## Notas de implementación


- **Mocks vs producción:** Durante Fases 1–2, todos los componentes usan props con tipos TypeScript puros → swap sencillo a `api.get/post(API_ROUTES.PAYROLL.*)` en Fases 3+.
- **Permisos:** Actualmente sin `<Can>` / `<PrivateRoute>`. Activar al final de Fase 3, una vez el backend esté estable y los roles de BD estén configurados.
- **Topes y mínimos:** Implementar validaciones al calcular: (1) sueldo_base >= salario_minimo de la categoría asignada, (2) líquido_cobrar >= 0 (alerta + bloqueo si es negativo), (3) FONASA no superar tope anual.
- **Motor de cálculo:** Encapsular toda la lógica en `payroll-utils.ts` (ya existe) con funciones puras testables. El cálculo real en n8n debe replicar exactamente estas funciones.
- **Versionado de parámetros:** Los parámetros en `payroll_settings` no tienen vigencias en v1. Para v2 del módulo, agregar `vigente_desde` y `vigente_hasta` a la tabla para soporte de cambios retroactivos.


---


*Generado: 2026-04-29 | Módulo Nóminas InvokeIA Studio v2*



