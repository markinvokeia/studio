# Especificación funcional — Panel de Control Gerencial

Documento funcional de las modificaciones a realizar sobre el **Panel de Control actual** (`/` — dashboard)
y el módulo de Reportes, para cumplir con el requerimiento del cliente.

- **Fecha:** 19/08/2026
- **Versión:** 2 — **validada contra la base de datos de DEV** (ver §3)
- **Entradas de este documento:**
  1. `Panel de Control Gerencial Clínica.pdf` (requerimientos funcionales del cliente)
  2. [Análisis de brechas](./analisis-panel-control-gerencial.md) (qué tenemos vs. qué pide el PDF)
  3. Notas de priorización del cliente (ver §1)
  4. **Verificación del modelo de datos real en DEV** (consultas de solo lectura vía MCP Postgres)

> **Cambios respecto a la v1:** la v1 se escribió sin acceso a la base y varios supuestos resultaron
> incorrectos. Todo lo corregido está marcado con **⚠️ Corregido v2** e incluye la evidencia en §3.
> Los tres cambios de mayor impacto:
> 1. `invoices.sede_id` y `quotes.sede_id` **ya existen** como columnas (pero están vacías).
> 2. **La sucursal de una factura no es derivable por ninguna vía directa** — se propone una heurística validada con **100% de cobertura**.
> 3. `service_catalog.specialty` **ya contiene exactamente la taxonomía que pide el PDF** — no hay que inventar un nivel de agrupación nuevo, hay que **completarlo**.

---

## 1. Notas de priorización del cliente

| # | Nota | Interpretación funcional | ¿Viable hoy? |
|---|---|---|---|
| 1 | Cantidad de pacientes | Pacientes vigentes + padrón total | 🟡 Padrón sí (14.978); vigentes requiere definir criterio |
| 2 | Cantidad de pacientes nuevos | Altas de pacientes en el período | ✅ Sí |
| 3 | Cantidad de pacientes por día | **Pacientes atendidos por día** (únicos, no citas) | ✅ **Sí, y con sede** |
| 4 | Producción del día | Producción económica de hoy | 🟡 Como facturación sí; ver D3 |
| 5 | Producción del mes | Producción económica del mes | 🟡 Ídem |
| 6 | Producción por sucursal | Todo lo anterior abierto por sede | 🔴 **Solo vía heurística** (§3.3) |

> **Consecuencia de diseño:** estas 6 notas definen el **Bloque A (Resumen Ejecutivo)** y son la **Fase 1**.

---

## 2. Estado actual del Panel de Control

Lo que hoy renderiza `/` (`src/app/[locale]/page.tsx`):

| Bloque | Contenido actual | Permiso |
|---|---|---|
| Filtros | Solo rango de fechas + un `Select` decorativo sin lógica | `DASHBOARD_APPLY_FILTERS` |
| Stats (4 tarjetas) | Ingresos · Pacientes nuevos · Ventas · Conversión de presupuestos (con % vs. período anterior) | `DASHBOARD_VIEW_KPIS` |
| Gráficos | Evolución de ventas · Ventas por servicio · Estado de facturas | `DASHBOARD_VIEW_CHARTS` |
| KPIs operativos | Facturación promedio · Demografía · Tasa de asistencia | `DASHBOARD_VIEW_OPERATIONAL_KPIS` |
| Tablas | Presupuestos recientes · Pacientes nuevos | `DASHBOARD_VIEW_RECENT_QUOTES` / `..._NEW_PATIENTS` |

**Endpoints actuales:** `/dashboard_summary`, `/dashboard_sales_summary`, `/dashboard_sales_by_service`,
`/dashboard_invoice_status`, `/dashboard_new_vs_recurring_patients`.

**Limitaciones a corregir:** no hay filtro de sucursal; no distingue producción / facturación / cobranza;
no hay lectura "hoy" vs. "mes" simultánea; no hay pacientes vigentes ni atendidos; las tarjetas no son
clicables; el `Select` "Filtrar por" es decorativo; la moneda está fijada a USD por formato sin selector.

---

## 3. Validación técnica contra la base de datos DEV ⚠️ *nuevo en v2*

Consultas de solo lectura sobre la base de DEV. **Esto es lo que define qué es realmente posible.**

### 3.1 La dimensión Sucursal: qué existe y qué está poblado

Hay **3 sedes activas**: `Clínica Salud Dental Total`, `Sede de la Esquina`, `Convencion 1560`.

| Tabla / columna | ¿Existe? | Registros con dato | Cobertura |
|---|---|---|---|
| `calendar_sources.sede_id` | ✅ | 17 de 17 | **100%** ✅ |
| `cash_points.sede_id` | ✅ | 3 de 3 | **100%** ✅ |
| `clinic_schedules.sede_id` | ✅ | — | — |
| `invoices.sede_id` | ✅ **ya existe** | **1 de 37.085** | **0%** ❌ |
| `quotes.sede_id` | ✅ **ya existe** | **2 de 39.522** | **0%** ❌ |
| `users.active_sede_id` | ✅ | 1 de 15.165 | 0% ❌ |
| `miscellaneous_transactions` | ❌ **no tiene columna de sede** | — | — |
| `payments` | ❌ **no tiene columna de sede** | — | — |

> ⚠️ **Corregido v2:** la v1 afirmaba que la sede "no llega a la capa transaccional". Es más preciso:
> **las columnas ya están creadas en facturas y presupuestos, pero nadie las escribe.** El trabajo no es
> crear el modelo, es **poblarlo**.

### 3.2 Cadenas de derivación: cuáles funcionan y cuáles no

| Cadena | Cobertura real | Veredicto |
|---|---|---|
| `appointments.calendar_source_id` → `calendar_sources.sede_id` | **62.768 de 62.904 = 99,8%** | ✅ **Usable hoy** |
| `payments.cash_session_id` → `cash_sessions.cash_point_id` → `cash_points.sede_id` | **19 de 41.751 = 0,0%** | ❌ Inservible |
| `miscellaneous_transactions.cash_session_id` → … | **tabla vacía (0 filas)** | ❌ Inservible |
| `appointments.invoice_id` → factura | **0 de 62.904** | ❌ Inservible |
| `sesiones_clinicas.invoice_id` → factura | **0 de 60.464** | ❌ Inservible |
| `invoices` → `orders` → `quotes.sede_id` | **1 de 37.085** | ❌ Inservible |

**Conclusión:** la agenda resuelve sede al 99,8%, pero **el dinero (facturas y cobros) no tiene ninguna
vía directa a la sucursal**.

### 3.3 Heurística propuesta para la sede de una factura ✅ *validada*

Atribuir la factura a la sede de **la cita del paciente más cercana en el tiempo** a la fecha de la factura:

| Métrica | Resultado |
|---|---|
| Facturas 2026 evaluadas | 4.377 |
| Facturas con sede estimada | **4.377** |
| **Cobertura** | **100,0%** ✅ |
| Pacientes que se atienden en **1 sola** sede | 11.479 = **98,8%** |
| Pacientes atendidos en 2 sedes | 130 = 1,1% |
| Pacientes atendidos en 3 sedes | 4 = 0,0% |
| **Margen de error estimado** | **~1,2% de los pacientes** |

> ✅ **Esto habilita la Fase 1.** "Producción por sucursal" se puede entregar **ya**, sin esperar backfill
> ni cambios de captura, con un margen de error de ~1,2%. Debe presentarse en la UI como **valor estimado**
> hasta que `invoices.sede_id` se empiece a poblar en el alta.

### 3.4 Pacientes atendidos por sede: validado ✅

Consulta real sobre 2026, citas en estado `completed`:

| Sede | Citas completadas | Pacientes únicos | Días con actividad |
|---|---|---|---|
| Sede de la Esquina | 3.803 | 1.265 | 113 |
| Clínica Salud Dental Total | 2.049 | 725 | 139 |
| Convencion 1560 | 17 | 13 | 8 |
| *sin sede* | **0** | 0 | 0 |

**Las notas 3 y 6 del cliente (pacientes por día, por sucursal) son entregables de inmediato.**

**Estados de cita existentes:** `completed` (36.783), `scheduled` (11.099), `no_show` (7.229),
`cancelled` (6.045), `arrived_late` (1.044), `confirmed` (635), `attended_late` (40), `in_progress` (11),
`arrived` (10), `deleted` (8). → **Definir si `arrived_late` y `attended_late` cuentan como atendidos** (D2).

### 3.5 Clasificación de tratamientos: el campo ya existe ⚠️ *Corregido v2*

`service_catalog.specialty` **ya contiene exactamente la taxonomía que pide el PDF**:

`ortodoncia` (4) · `implantologia` (8) · `cirugia` (7) · `estetica` (6) · `rehabilitacion` (9) ·
`periodoncia` (3) · `endodoncia` (3) · `odontopediatria` (3) · `general` (1)

**Pero solo está poblado en los 52 servicios de tipo `workflow`.** Los 381 servicios `single` tienen
`specialty` nulo o vacío. Impacto medido sobre la facturación 2026:

| Agrupación | % de la facturación que cae en "sin clasificar" |
|---|---|
| Por `specialty` | **98,4%** ❌ |
| Por `category` | **99,9%** ❌ |

> ⚠️ **Corregido v2:** la v1 proponía **crear** un nivel de "grupo gerencial". No hace falta: hay que
> **completar `specialty`** en los ~381 servicios `single`. Es **configuración/data entry, no desarrollo**.
> `specialty` es mejor base que `category` (mejor taxonomía y menos vacío).

### 3.6 Producción por fecha de prestación (D3): el dato clínico existe, el dinero no

`sesiones_clinicas` es el registro clínico y tiene **60.464 filas** (2016 → 2026):

| Campo | Cobertura | Sirve para |
|---|---|---|
| `fecha_sesion` | **60.464 = 100%** ✅ | Fecha de prestación real |
| `doctor_id` | **60.464 = 100%** ✅ | Producción por odontólogo |
| `invoice_id` | **0 = 0%** ❌ | — no hay puente al dinero |
| `appointment_id` | **161 = 0,3%** ❌ | — no hay puente a la sede |
| `fecha_proxima_cita` | **58 = 0,1%** ❌ | Campo existe, sin uso |
| `tratamientos_sesion` (ítems) | **274 filas**, 75 con `service_catalog_id` | ❌ Sin itemizar |

**Conclusión sobre D3:** la producción **en volumen** (sesiones, pacientes, por doctor y por fecha real de
prestación) **es computable hoy**. La producción **en dinero por fecha de prestación NO lo es**: no hay
vínculo sesión↔factura ni itemización de servicios por sesión. → **Si "producción" es un monto, debe
calcularse por fecha de factura.**

### 3.7 Gastos: no hay datos ⚠️ *Corregido v2*

| Fuente de gasto | Estado en DEV |
|---|---|
| `miscellaneous_transactions` | **0 filas** (tabla vacía) |
| `miscellaneous_categories` | **92 categorías ya creadas** ✅ |
| Facturas de compra (`invoices` con `is_sales=false`) | **0 filas** — las 37.085 facturas son de venta |
| Módulo de nómina | `payroll_employees` (21), `payroll_periods` (6), `payroll_entries` (31), `payroll_egresos` (13), `payroll_honorarios` (4) |

> ⚠️ **Corregido v2:** el riesgo R1 de la v1 ("los gastos no tienen sede") estaba mal enfocado. El problema
> real es más básico: **no hay gastos cargados en absoluto**, y `miscellaneous_transactions` **no tiene
> columna de sede** (solo la heredaría de `cash_session`, que tampoco se usa). Además, el plan de categorías
> ya está parametrizado (92 categorías), así que esa tarea de configuración está hecha.
>
> **Novedad:** existe un **módulo de nómina completo** con egresos y honorarios. Hay que definir si alimenta
> el estado de resultados (ver §12 Q7).

### 3.8 Ortodoncia: la infraestructura existe, los datos no ⚠️ *R4 confirmado y agravado*

| Tabla | Filas | Comentario |
|---|---|---|
| `treatment_sequences` | **67** | `patient_id`, `service_id`, `status`, `started_at`, `expected_end_at` — la estructura es correcta |
| `treatment_seq_steps` | — | tiene `milestone_status`, `scheduled_date`, `sesion_id`, `appointment_id` |
| `abandonment_alerts` | **0** | ✅ **La tabla ya existe** con `days_overdue`, `triggered_at`, `resolved_at`, `action_taken` |
| Servicios con `specialty='ortodoncia'` | **4** | Solo de tipo `workflow` |

> ⚠️ **R4 confirmado:** con 67 secuencias de tratamiento **es imposible reconstruir 24 meses de stock de
> ortodoncia**. La serie histórica del PDF no es alcanzable con los datos actuales.
>
> ✅ **Buena noticia:** `abandonment_alerts` ya existe con exactamente los campos necesarios para el
> control de abandono (D-3). Está sin uso, no hay que crearla.

---

## 4. Definiciones funcionales (a confirmar antes de desarrollar)

| # | Concepto | Definición propuesta | Estado |
|---|---|---|---|
| D1 | **Paciente vigente** | Tratamiento en curso **o** cita atendida en los últimos N meses (propuesto 12) **o** próxima cita agendada. Padrón total de referencia: **14.978 pacientes** | ⏳ Confirmar N |
| D2 | **Paciente atendido** | Paciente **único** con cita `completed` en la fecha. **⚠️ Definir si `arrived_late` (1.044) y `attended_late` (40) cuentan** | ⏳ Confirmar |
| D3 | **Producción** | ⚠️ **Corregido v2:** en **volumen** puede ser por fecha de prestación (`sesiones_clinicas`, 100% poblada). En **dinero** debe ser por **fecha de factura** — no existe puente sesión↔dinero (§3.6) | 🔴 Decisión clave |
| D4 | **Facturación** | Comprobantes emitidos en el período (fecha de factura) | ✅ Existe |
| D5 | **Cobranza** | Monto cobrado en el período (fecha de pago) | ✅ Existe |
| D6 | **Sucursal de una operación** | Citas: `calendar_sources.sede_id` (99,8%). Facturas: **heurística de cita más cercana** (100% cobertura, ~1,2% error). Cobros y gastos: **sin vía** | ⏳ Aprobar heurística |
| D7 | **Baja / abandono de ortodoncia** | Sin control en los últimos M meses (propuesto 3) y sin alta médica. Usar `abandonment_alerts` (ya existe) | ⏳ Confirmar M |
| D8 | **Frecuencia de control de ortodoncia** | Mensual por defecto, configurable por plan | ⏳ Confirmar |
| D9 | **Consolidación multi-moneda** | Una moneda a la vez (UYU o USD), sin conversión automática | ⏳ Confirmar |
| D10 | **Sede estimada vs. real** ⚠️ *nuevo* | Mientras `invoices.sede_id` esté vacío, los montos por sede son **estimados**. Definir cómo se comunica en la UI | ⏳ Confirmar |

---

## 5. Diseño funcional del nuevo Panel de Control

### 5.1 Barra de filtros globales (nueva)

Reemplaza al `ReportFilters` actual. Sticky en el tope, aplica a **todos** los bloques.

| Control | Comportamiento | Prioridad |
|---|---|---|
| **Sucursal** | `Consolidado` (default) + las 3 sedes activas. Persistir por usuario | 🔴 Fase 1 |
| **Período** | Reutilizar `DateRangePresets` (hoy · semana · mes · mes anterior · año · personalizado). Default: mes en curso | 🔴 Fase 1 |
| **Moneda** | `UYU` / `USD`. Default: moneda base | 🟠 Fase 1 |
| **Odontólogo** | Selector opcional | 🟡 Fase 2 |
| **Tipo de tratamiento** | Por `specialty` (una vez completada) | 🟡 Fase 2 |
| Comparación | Toggle `vs. período anterior` | 🟠 Fase 2 |

**Eliminar:** el `Select` "Filtrar por" (`byService`/`byUser`/`byStatus`) de `report-filters.tsx`, hoy sin lógica.

### 5.2 Bloque A — Resumen Ejecutivo *(Fase 1 — las notas del cliente)*

Tarjetas con **doble lectura simultánea HOY / MES**, independiente del período del filtro.

| # | Tarjeta | Valor | Secundario | Viabilidad |
|---|---|---|---|---|
| A1 | **Producción** | Hoy | Mes | 🟡 Como facturación (D3) |
| A2 | **Cobranza** | Hoy | Mes | ✅ Total; ❌ por sede |
| A3 | **Gastos** | Hoy | Mes | ⚠️ Sin datos cargados (§3.7) |
| A4 | **Resultado de caja** | Cobrado − Gastos | Mes | ⚠️ Depende de A3 |
| A5 | **Pacientes atendidos** | Hoy | Mes | ✅ **Validado, con sede** |
| A6 | **Pacientes vigentes** | Total | Δ vs. cierre anterior | 🟡 Requiere D1 |
| A7 | **Pacientes nuevos** | Mes | % vs. mes anterior | ✅ |
| A8 | **Ortodoncia vigentes** | Total | Altas − bajas del mes | 🔴 Datos insuficientes (§3.8) |

**Reglas:** todas respetan el filtro de sucursal; "hoy" se calcula sobre la fecha del servidor, no sobre el
rango del filtro; cuando el filtro ≠ Consolidado el título muestra la sede; **las tarjetas con monto por sede
llevan un indicador de "estimado"** (D10); todas son clicables (§5.7).

### 5.3 Bloque B — Producción y actividad

| # | Componente | Contenido | Fase | Viabilidad |
|---|---|---|---|---|
| B1 | **Producción por sucursal** | Por sede: pacientes atendidos · nº tratamientos · producción $ · cobrado $ · % del total | 🔴 1 | 🟡 Montos estimados |
| B2 | **Pacientes por día** | Serie diaria de atendidos + comparación período anterior | 🔴 1 | ✅ **Validado** |
| B3 | **Producción por odontólogo** | Pacientes · procedimientos · producción · cobranza · ticket · **% participación** | 🟠 2 | ✅ `doctor_id` 100% |
| B4 | **Producción por tipo de tratamiento** | Por `specialty`: cantidad · producción $ · % total · evolución | 🟠 2 | ⚠️ **Requiere completar `specialty` primero** |

> **B4 — precondición:** hoy el 98,4% de la facturación cae en "sin especialidad" (§3.5). **Sin completar
> `specialty` en los ~381 servicios `single`, este componente muestra una sola barra.** Es la tarea de
> configuración de mayor impacto y menor costo del proyecto.

### 5.4 Bloque C — Pacientes y cartera *(Fase 2)*

| # | Componente | Contenido |
|---|---|---|
| C1 | Composición de la cartera | Vigentes por sucursal · por odontólogo · por tipo de tratamiento |
| C2 | Evolución mensual | `Inicio + Altas − Bajas = Cierre`, serie 12–24 meses |
| C3 | Flujos del período | Nuevos · finalizados · pasados a inactivos |

**Formato de C2:**

| Mes | Inicio | Altas | Bajas / Finalizados | Cierre |
|---|---|---|---|---|
| Enero | 420 | 28 | 15 | 433 |

**Regla de consistencia:** `Cierre(mes) = Inicio(mes+1)`; el sistema debe validarlo y señalar discrepancias.

> **Viabilidad:** computable desde `appointments` + fecha de alta del paciente. **No** depende de
> `treatment_sequences` (solo 67 filas), así que C2 sí es alcanzable — a diferencia del stock de ortodoncia.

### 5.5 Bloque D — Seguimiento de Ortodoncia *(Fase 3)*

Página propia (`/reports/ortodoncia`) + tarjeta A8.

#### D-1. Stock de la cartera
Inicio · nuevos · finalizados · abandonos · cierre, en vistas total / por sucursal / por ortodoncista,
con gráfico de 12–24 meses.

> 🔴 **Bloqueante de datos:** con 67 `treatment_sequences` la serie histórica **no es reconstruible**.
> Opciones: (a) identificar ortodoncia vía `invoice_items` → `specialty='ortodoncia'` y reconstruir desde
> facturación; (b) acordar una **fecha de corte** desde la cual la serie es confiable y empezar a acumular.
> **Debe decidirse con el cliente antes de comprometer la Fase 3.**

#### D-2. Control de seguimiento

| Estado | Definición | Acción |
|---|---|---|
| ✅ Control realizado | Tuvo control en el mes | — |
| ⏳ Control pendiente | Dentro del plazo | — |
| 🔴 Atrasado | Superó la frecuencia (D8) | Contactar / agendar |
| ⚠️ Sin próxima cita | Sin cita futura agendada | Contactar / agendar |

Columnas: paciente · teléfono · ortodoncista · sucursal · último control · días desde el último control ·
próximo control · estado.

> ⚠️ **Corregido v2:** la v1 decía que "próxima cita" no existía. `sesiones_clinicas.fecha_proxima_cita` y
> `plan_proxima_cita` **sí existen**, pero con 0,1% de uso. **Calcular desde `appointments`** (existencia de
> cita futura), que es confiable, y no desde esos campos.

#### D-3. Alerta de inasistencia
Regla del Centro de Alertas (`alert_rules.query_template` + `days_after` + recurrencia) con notificación
automática. ✅ **Además, `abandonment_alerts` ya existe** con `days_overdue` / `resolved_at` / `action_taken`
— es la tabla destino natural, sin desarrollo de modelo.

### 5.6 Bloque E — Administración y finanzas *(Fase 2)*

| # | Componente | Cambio | Viabilidad |
|---|---|---|---|
| E1 | Producción vs. Facturación vs. Cobranza | Panel de 3 columnas con el gap entre conceptos | 🟡 Ver D3 |
| E2 | Cobranza por sucursal | Nuevo corte | 🔴 **Sin vía de datos** (§3.2) |
| E3 | Cobranza por tratamiento | Agregar `total_cobrado` al reporte de servicios | ✅ |
| E4 | Cobranza por medio de pago | Ya existe — integrar al panel | ✅ |
| E5 | Gastos por sucursal | Nuevo corte | 🔴 **Sin columna ni datos** (§3.7) |
| E6 | Gastos por categoría | Ya existe; **92 categorías ya creadas** | ✅ Falta cargar gastos |
| E7 | Resultado del período | Corte por sede + comparación de períodos | 🟡 Depende de E2/E5 |

### 5.7 Drill-down (requisito transversal)

**Regla general:** toda tarjeta de KPI y todo segmento de gráfico es clicable y abre el detalle que lo
compone, **propagando los filtros vigentes**.

| Modalidad | Cuándo | Implementación |
|---|---|---|
| Navegación al reporte | El detalle ya existe como reporte | Ruta + filtros en query string, leídos al montar |
| Panel lateral | Listado acotado (ej. atendidos hoy) | `Sheet` lateral — patrón ya usado en el panel |

**Requisito derivado:** los reportes deben **aceptar filtros por query string** (hoy inicializan con valores
fijos). Cambio transversal al módulo.

---

## 6. Especificación de indicadores

| ID | Indicador | Origen validado | Trabajo |
|---|---|---|---|
| I-01 | Producción del día | `invoices.created_at` (por factura) | Backend — ver D3 |
| I-02 | Producción del mes | Ídem | Backend |
| I-03 | **Producción por sucursal** | **Heurística §3.3 (100% cobertura, ~1,2% error)** | Backend + aviso "estimado" |
| I-04 | Cobranza día / mes | `payments` ✅ | Exponer en panel — **sin corte por sede** |
| I-05 | Gastos día / mes | ⚠️ Sin datos en DEV | Bloqueado por carga |
| I-06 | Resultado de caja | I-04 − I-05 | Depende de I-05 |
| I-07 | Pacientes atendidos | `appointments` + `calendar_sources` ✅ **validado** | Backend nuevo |
| I-08 | **Pacientes atendidos por día** | Ídem ✅ **validado** | Backend nuevo |
| I-09 | Pacientes vigentes | Requiere D1 | Definición + backend |
| I-10 | Pacientes nuevos | ✅ Existe | Agregar corte por sede |
| I-11 | Finalizaron tratamiento | Alta médica | Backend |
| I-12 | Inactivos / bajas | ✅ Existe | Convertir a flujo mensual |
| I-13 | Evolución de cartera | `appointments` + fecha de alta | Backend nuevo |
| I-14 | Ortodoncia — stock mensual | 🔴 67 secuencias — insuficiente | **Bloqueado por datos** |
| I-15 | Ortodoncia — controles | Base en `treatment_seq_steps` | Backend nuevo |
| I-16 | **Pacientes sin próxima cita** | ⚠️ Calcular desde `appointments`, **no** desde `fecha_proxima_cita` (0,1% uso) | Backend nuevo |
| I-17 | % participación por odontólogo | `invoices.doctor_id` 100% ✅ | Agregar `pct_total` |
| I-18 | Cobranza por tratamiento | `invoice_items.service_id` ✅ | Agregar `total_cobrado` |
| I-19 | Variación vs. período anterior | Solo en dashboard hoy | Extender a reportes |
| I-20 | Nº de procedimientos por doctor | ⚠️ `tratamientos_sesion` solo 274 filas → usar `invoice_items` | Backend |

---

## 7. Cambios en los reportes existentes

| Reporte | Cambio | Fase |
|---|---|---|
| **Todos (21)** | Aceptar `sede_id` + selector de sucursal | 1 |
| **Todos (21)** | Aceptar filtros por **query string** (drill-down) | 1 |
| Todos los financieros | Comparación vs. período anterior | 2 |
| `produccion-doctor` | `pct_total` + nº de procedimientos | 2 |
| `tratamientos` | Agrupar por `specialty` + evolución vs. período anterior | 2 |
| `servicios` | Agregar `total_cobrado` | 2 |
| `nuevos-pacientes` | Corte por sede y odontólogo | 1 |
| `pacientes-inactivos` | Bajas como **flujo mensual** | 2 |
| `gastos-operativos` | Corte por sede (bloqueado por §3.7) | 2 |
| `estado-resultados` | Corte por sede + comparación | 2 |
| `ocupacion-agenda` | Agregar **pacientes únicos atendidos** | 1 |
| `tratamientos` / `servicios` | ⚠️ **Advertir en la UI cuando >90% cae en "sin clasificar"** | 1 |
| **Nuevo:** `produccion-sucursal` | Página nueva | 1 |
| **Nuevo:** `evolucion-cartera` | Página nueva | 2 |
| **Nuevo:** `ortodoncia` | Página nueva | 3 |
| Filtro de odontólogo | Extender a los 21 reportes (hoy 3) | 2 |

---

## 8. Cambios técnicos

### 8.1 Modelo de datos — plan de acción sobre la sede

| Acción | Detalle | Momento |
|---|---|---|
| **A. Heurística de lectura** | Resolver sede de factura por cita más cercana del paciente (§3.3) | Fase 1 — **habilita la entrega** |
| **B. Poblar en el alta** | Escribir `invoices.sede_id` y `quotes.sede_id` (columnas ya existentes) al crear el documento | Fase 1 — backend |
| **C. Backfill histórico** | Correr la heurística una vez y persistir el resultado en `invoices.sede_id` | Fase 2 — migración versionada |
| **D. Cobros** | `payments` no tiene sede y `cash_session_id` está al 0%. Definir: ¿columna nueva, o heredar de la factura? | 🔴 Decisión |
| **E. Gastos** | `miscellaneous_transactions` no tiene columna de sede. Agregarla + imputación en la carga | 🔴 Decisión |

> Toda migración de esquema va por el **flujo normal de migraciones versionadas del backend**, no por DDL suelto.

### 8.2 Frontend

| Cambio | Archivo(s) |
|---|---|
| Barra de filtros globales (sede + período + moneda) | Reemplazar `src/components/dashboard/report-filters.tsx` |
| Contexto de filtros del panel | Nuevo `src/context/DashboardFiltersContext.tsx` |
| Tarjetas KPI doble lectura + clicables + badge "estimado" | Extender `src/components/dashboard/stats.tsx` |
| Gráfico de pacientes por día | Nuevo `src/components/charts/patients-per-day-chart.tsx` |
| Tabla de producción por sucursal | Nuevo `src/components/dashboard/production-by-branch.tsx` |
| Selector de sucursal reutilizable | Nuevo `src/components/reports/sede-filter.tsx` |
| Filtros desde query string | `src/components/reports/report-shell.tsx` + cada página |
| Páginas nuevas | `src/app/[locale]/reports/{produccion-sucursal,evolucion-cartera,ortodoncia}/page.tsx` |
| Navegación | `src/config/nav.ts` |
| Tipos | `src/lib/types.ts` |
| Rutas de API | `src/constants/routes.ts` |

**Convenciones:** strings nuevos en `en.json` **y** `es.json`; rutas en `src/constants/routes.ts` (nunca
inline); tipos compartidos en `src/lib/types.ts`; tablas con el `DataTable` estándar; fechas con los helpers
de `src/lib/utils.ts`.

### 8.3 Backend — endpoints propuestos

| Endpoint | Propósito | Parámetros |
|---|---|---|
| `GET /dashboard_executive_summary` | Bloque A completo | `sede_id?`, `currency`, `date_from`, `date_to` |
| `GET /dashboard_patients_per_day` | Serie diaria de atendidos | `sede_id?`, `date_from`, `date_to` |
| `GET /reports/produccion-sucursal` | Producción y cobranza por sede | `date_from`, `date_to`, `currency` |
| `GET /reports/evolucion-cartera` | Stock y flujo mensual | `months`, `sede_id?`, `doctor_id?` |
| `GET /reports/ortodoncia-stock` | Cartera de ortodoncia | `months`, `sede_id?`, `doctor_id?` |
| `GET /reports/ortodoncia-controles` | Realizados / pendientes / atrasados / sin próxima cita | `sede_id?`, `doctor_id?`, `estado?` |
| Todos los `/reports/*` | Aceptar `sede_id` opcional | — |

**Forma propuesta de `/dashboard_executive_summary`:**

```
{
  "sede_id": null,                    // null = consolidado
  "currency": "UYU",
  "sede_source": "estimated",         // "estimated" | "actual"  <-- nuevo en v2 (D10)
  "produccion":         { "hoy": 0, "mes": 0, "var_pct": 0 },
  "cobranza":           { "hoy": 0, "mes": 0, "var_pct": 0 },
  "gastos":             { "hoy": 0, "mes": 0, "var_pct": 0 },
  "resultado":          { "hoy": 0, "mes": 0, "var_pct": 0 },
  "pacientes_atendidos":{ "hoy": 0, "mes": 0, "var_pct": 0 },
  "pacientes_vigentes": { "total": 0, "var_vs_cierre_anterior": 0 },
  "pacientes_nuevos":   { "mes": 0, "var_pct": 0 },
  "ortodoncia_vigentes":{ "total": 0, "altas_mes": 0, "bajas_mes": 0, "var_pct": 0 }
}
```

### 8.4 Permisos nuevos

| Permiso | Protege |
|---|---|
| `DASHBOARD_VIEW_EXECUTIVE_SUMMARY` | Bloque A |
| `DASHBOARD_VIEW_BY_BRANCH` | Filtro y cortes por sucursal |
| `DASHBOARD_VIEW_PRODUCTION` | Bloque B |
| `REPORTS_ORTODONCIA_VIEW` | Panel de ortodoncia |
| `REPORTS_CARTERA_VIEW` | Evolución de cartera |

Aplicar con `<Can>` en el panel y `<PrivateRoute>` en las páginas nuevas, con su `requiredPermission` en
`src/config/nav.ts`. **Roles existentes:** `Super Admin`, `administrador`, **`gerente`**, `medico`,
`recepcionista`, `paciente` — el rol `gerente` es el destinatario natural del panel.

---

## 9. Aspecto y experiencia

1. **Jerarquía:** Bloque A arriba, en una pantalla sin scroll en desktop.
2. **Semáforo de variación:** verde / rojo / neutro según `KpiChangeType` (patrón existente).
3. **Carga:** `Skeleton` por tarjeta, no spinner global (patrón existente).
4. **Sede activa:** badge visible cuando el filtro ≠ Consolidado.
5. **Vacío vs. cero:** distinguir "sin datos" de "valor 0" — crítico para gastos (§3.7), que hoy daría `$0`.
6. **⚠️ Dato estimado:** los montos por sede llevan un indicador visual + tooltip explicando la heurística (D10).
7. **⚠️ Dato sin clasificar:** cuando >90% cae en "sin especialidad", mostrar un aviso en lugar de un gráfico engañoso.
8. **Exportación:** el panel debe exportarse a PDF como "foto del día".

---

## 10. Fases de entrega

### Fase 0 — Configuración y carga *(precondición, sin desarrollo)*
- **Completar `service_catalog.specialty` en los ~381 servicios `single`** ← mayor impacto / menor costo.
- Empezar a **cargar gastos** (las 92 categorías ya existen).
- Definir la imputación de sede en el alta de facturas y gastos.

### Fase 1 — Las notas del cliente
- Filtro global de sucursal + heurística de sede para facturas (§3.3).
- Escritura de `invoices.sede_id` / `quotes.sede_id` en el alta.
- Bloque A: Producción (día/mes), Pacientes atendidos, Pacientes nuevos, Pacientes vigentes.
- B1 Producción por sucursal · B2 Pacientes por día.
- Drill-down básico.

**Entrega:** las 6 notas del cliente + preguntas 1 y 4 del PDF. **Notas 3 y 6 ya validadas como viables.**

### Fase 2 — Completar el PDF
- Cobranza / gastos / resultado con corte por sede (**sujeto a decisiones D y E de §8.1**).
- Backfill histórico de `invoices.sede_id`.
- Comparación vs. período anterior en reportes.
- C2 Evolución de cartera.
- B4 Producción por tipo de tratamiento (**requiere Fase 0**).
- % participación por odontólogo · cobranza por tratamiento.
- Filtros de odontólogo y tratamiento en todos los reportes.

**Entrega:** preguntas 2 y 3 del PDF.

### Fase 3 — Ortodoncia
- Stock mensual + gráfico 12–24 meses (**sujeto a la decisión de §5.5 D-1**).
- Control de seguimiento (realizado / pendiente / atrasado / sin próxima cita).
- Alerta de abandono sobre `abandonment_alerts` (tabla ya existente).

**Entrega:** pregunta 5 del PDF, con el alcance histórico acordado.

---

## 11. Criterios de aceptación

| # | Criterio |
|---|---|
| CA-01 | El panel muestra producción del día y del mes, y el valor cambia al seleccionar sucursal |
| CA-02 | El selector ofrece `Consolidado` + las 3 sedes activas y afecta a **todos** los bloques |
| CA-03 | Se muestra cantidad de pacientes, nuevos y atendidos por día |
| CA-04 | El gráfico de pacientes por día muestra la serie y la comparación con el período anterior |
| CA-05 | Al hacer clic en cualquier KPI se accede al detalle, con los filtros propagados |
| CA-06 | Producción, facturación y cobranza se muestran como conceptos diferenciados |
| CA-07 | El panel distingue "hoy" de "mes" sin depender del rango seleccionado |
| CA-08 | **Los montos por sede se identifican visualmente como estimados** mientras `invoices.sede_id` esté vacío |
| CA-09 | **Los cortes por tipo de tratamiento avisan cuando el % sin clasificar supera el 90%** |
| CA-10 | **Los indicadores sin datos de origen muestran "sin datos", nunca `$0`** |
| CA-11 | La evolución de cartera cumple `Cierre(mes) = Inicio(mes+1)` en toda la serie |
| CA-12 | El panel de ortodoncia muestra inicio/altas/bajas/cierre en el rango histórico acordado |
| CA-13 | El control de ortodoncia lista atrasados y sin próxima cita |
| CA-14 | Todos los textos nuevos existen en `es.json` y `en.json` |
| CA-15 | Todos los bloques nuevos están protegidos por permiso |
| CA-16 | `pnpm typecheck && pnpm lint` pasan sin errores |

---

## 12. Riesgos (revisados con datos reales)

| # | Riesgo | Estado v2 | Impacto | Mitigación |
|---|---|---|---|---|
| R1 | Gastos sin sede | ⚠️ **Reformulado:** el problema no es la sede, es que **no hay gastos cargados** (0 filas) y la tabla **no tiene columna de sede** | 🔴 Alto | Cargar gastos + agregar columna vía migración |
| R2 | Producción ≠ facturación | ⚠️ **Confirmado y acotado:** el dato clínico existe al 100% (`fecha_sesion`) pero **sin puente al dinero** | 🔴 Alto | Definir producción en dinero por fecha de factura |
| R3 | Criterio de paciente vigente | Sin cambios | 🔴 Alto | Cerrar D1 y dejar N configurable |
| R4 | Historia de ortodoncia insuficiente | ⚠️ **Confirmado y agravado:** solo **67** `treatment_sequences` | 🔴 Alto | Acordar fecha de corte de la serie |
| R5 | Consolidación UYU + USD | Sin cambios | 🟠 Medio | Confirmar D9; por defecto no consolidar |
| R6 | `sede_id` en 21 reportes | Sin cambios | 🟠 Medio | Encapsular en componente + hook |
| R7 | Factura sin cita origen | ✅ **Resuelto:** heurística con **100% de cobertura** | 🟢 Bajo | Aplicar §3.3 + avisar "estimado" |
| R8 | **Clasificación de tratamientos vacía** ⚠️ *nuevo* | **98,4% de la facturación sin `specialty`** | 🔴 Alto | Fase 0: completar los ~381 servicios `single` |
| R9 | **Cobranza sin vía a la sede** ⚠️ *nuevo* | `payments` no tiene columna; `cash_session_id` al 0,0% | 🔴 Alto | Decisión D de §8.1 (heredar de la factura) |
| R10 | **Pacientes multi-sede** ⚠️ *nuevo* | 1,2% se atiende en más de una sede → error de la heurística | 🟢 Bajo | Documentar el margen; badge "estimado" |
| R11 | **DEV no representa producción** ⚠️ *nuevo* | Gastos, secuencias y clasificación están vacíos en DEV; en producción pueden estar poblados | 🟠 Medio | **Repetir esta validación contra la base de producción antes de estimar** |

---

## 13. Preguntas abiertas para la reunión

1. **¿"Producción" es monto o volumen?** Si es monto, se calcula por fecha de factura — el registro clínico no tiene puente al dinero (§3.6). *(D3)*
2. **¿Se aprueba la heurística de sede estimada** (cita más cercana del paciente, 100% cobertura, ~1,2% error) para poder entregar la Fase 1 sin esperar backfill? *(D6, D10)*
3. **¿Cuál es el criterio exacto de "paciente vigente"?** *(D1)*
4. **¿"Cantidad de pacientes" es el padrón total (14.978) o los vigentes?** *(nota 1)*
5. **¿`arrived_late` y `attended_late` cuentan como pacientes atendidos?** *(D2)*
6. **¿Cómo se imputa la sede de un cobro?** No hay columna ni cadena utilizable. ¿Se hereda de la factura? *(R9)*
7. **¿El módulo de nómina alimenta el estado de resultados**, o los sueldos y honorarios se cargan además como movimientos de caja? Existe `payroll_egresos` / `payroll_honorarios`. *(§3.7)*
8. **¿Quién completa `service_catalog.specialty`** en los ~381 servicios `single`? Sin eso, el corte por tipo de tratamiento no existe. *(R8)*
9. **¿Desde qué mes se considera confiable la serie de ortodoncia?** Con 67 secuencias no hay 24 meses reconstruibles. *(R4)*
10. **¿Cuál es la frecuencia esperada del control de ortodoncia y el umbral de abandono?** *(D7, D8)*
11. **¿El tablero consolida UYU y USD o se ve una moneda a la vez?** *(D9)*
12. **¿La base de producción está tan vacía como DEV** en gastos, secuencias de tratamiento y clasificación de servicios? *(R11 — condiciona toda la estimación)*

---

## Anexo — Trazabilidad de la validación

Consultas de **solo lectura** ejecutadas sobre la base de DEV vía MCP Postgres el 19/08/2026.
Ninguna sentencia de escritura fue ejecutada.

| Verificación | Resultado | Sección |
|---|---|---|
| Columnas `sede_id` existentes y su cobertura | 7 tablas; facturas y presupuestos al 0% | §3.1 |
| Cadenas de derivación de sede | Solo agenda funciona (99,8%) | §3.2 |
| Heurística de sede por cita más cercana | 100% cobertura, ~1,2% error | §3.3 |
| Pacientes atendidos por sede | Validado en 3 sedes | §3.4 |
| Cobertura de `specialty` y `category` | 98,4% y 99,9% sin clasificar | §3.5 |
| Producción por fecha de prestación | `fecha_sesion` 100%, sin puente al dinero | §3.6 |
| Existencia de gastos | 0 filas | §3.7 |
| Datos de ortodoncia | 67 secuencias, 0 alertas de abandono | §3.8 |
