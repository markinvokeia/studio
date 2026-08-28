# Análisis de brechas — "Panel de Control Gerencial · Clínica Odontológica"

Comparación entre los requerimientos del documento **`Panel de Control Gerencial Clínica.pdf`** y lo que
hoy existe implementado en el sistema (dashboard + módulo de Reportes).

- **Fecha del análisis:** 19/08/2026
- **Alcance revisado:** `src/app/[locale]/page.tsx` (dashboard), `src/app/[locale]/reports/*` (21 reportes),
  `src/config/nav.ts`, `src/lib/types.ts` (contratos de reportes R-01…R-21), `src/constants/routes.ts`.
- **Objetivo:** dejar explícito **qué falta**, para poder responder en la reunión el "punto clave" que plantea
  el documento: qué viene estándar, qué se configura y qué requiere desarrollo específico.

---

> ### ⚠️ Nota de corrección (19/08/2026)
>
> Este análisis se escribió **sin acceso a la base de datos**. Tres afirmaciones quedaron superadas por la
> validación posterior — ver **§3 de la [especificación funcional](./panel-control-gerencial-especificacion-funcional.md)**:
>
> 1. **Sucursal:** se afirma que la sede "no llega a la capa analítica". Más preciso: `invoices.sede_id` y
>    `quotes.sede_id` **ya existen como columnas**, pero están vacías (1 de 37.085). Y la sede **sí es
>    derivable hoy para la agenda** (`calendar_sources.sede_id`, 99,8% de cobertura).
> 2. **Clasificación de tratamientos:** se propone crear una "agrupación gerencial de alto nivel". No hace
>    falta: `service_catalog.specialty` **ya contiene la taxonomía del PDF** (ortodoncia, implantología,
>    cirugía, endodoncia, estética…). Falta **completarla** — hoy el 98,4% de la facturación queda sin clasificar.
> 3. **Próxima cita:** se indica que no existe. `sesiones_clinicas.fecha_proxima_cita` y `plan_proxima_cita`
>    **existen**, pero con 0,1% de uso; conviene calcularlo desde `appointments`.
>
> El resto del análisis se mantiene válido.

---

## 0. Resumen ejecutivo

El sistema hoy tiene una **base analítica muy sólida en lo administrativo-financiero y en producción**
(21 reportes operativos con exportación CSV/Excel/PDF), pero el documento pide un **tablero de gestión**,
que es un artefacto distinto de un conjunto de reportes. Las brechas se concentran en cuatro ejes:

| # | Brecha | Severidad | Naturaleza |
|---|--------|-----------|------------|
| 1 | **Dimensión Sucursal (sede) ausente en todo el análisis** — ningún reporte ni el dashboard filtran o abren por sede | 🔴 Alta | Desarrollo (front + back) |
| 2 | **Seguimiento de Ortodoncia** — no existe el bloque completo (stock, altas/bajas, control mensual, atrasados) | 🔴 Alta | Desarrollo nuevo |
| 3 | **Concepto de "paciente vigente" y su evolución mensual** — no está definido ni calculado | 🔴 Alta | Definición + desarrollo |
| 4 | **Panel gerencial unificado ("hoy" en tiempo real) con drill-down** — hoy hay reportes sueltos, no un tablero | 🟠 Media | Desarrollo (composición) |

Además hay brechas menores de indicadores puntuales (cobranza por tratamiento, % de participación,
comparación contra período anterior en varios cortes) que se detallan más abajo.

**Lo que sí está cubierto y no requiere trabajo:** cobranza por medio de pago, cierre de caja, gastos por
categoría/proveedor, estado de resultados (ingresos − gastos), deudores con aging, presupuestos y conversión,
producción por doctor, producción por tratamiento, ocupación de agenda, cancelaciones, nuevos pacientes,
pacientes inactivos, honorarios, y el selector de período (hoy / semana / mes / mes anterior / año / personalizado).

---

## 1. Inventario de lo que YA tenemos

### 1.1 Dashboard principal (`/`)

| Elemento | Detalle |
|---|---|
| KPIs (4 tarjetas) | Ingresos totales, Pacientes nuevos, Ventas, Tasa de conversión de presupuestos — **todos con % de variación vs. período anterior** |
| KPIs secundarios | Facturación promedio por paciente, Tasa de asistencia (show rate), Demografía de pacientes |
| Gráficos | Evolución de ventas, Ventas por servicio, Estado de facturas, Pacientes nuevos vs. recurrentes |
| Tablas | Presupuestos recientes, Pacientes nuevos (con panel de detalle) |
| Filtros | Rango de fechas |

### 1.2 Módulo de Reportes (21 reportes)

| Grupo | Reportes |
|---|---|
| **Caja** | Cierre de Caja, Cobros del Día |
| **Ingresos** | Cuentas Corrientes, Estado de Presupuestos, Ingresos por Período, Facturación vs. Cobranza, Deudores (aging 0-30/31-60/61-90/90+), Ingresos por Servicio |
| **Producción** | Producción por Doctor, Tratamientos Realizados, Comparativo de Producción (mensual por doctor), Honorarios |
| **Pacientes** | Nuevos Pacientes, Pacientes Inactivos, Tratamientos en Curso |
| **Agenda** | Ocupación de Agenda, Cancelaciones |
| **Gastos** | Gastos Operativos (por categoría, proveedor, período, servicio, estado de pago) |
| **Gestión** | Estado de Resultados, KPIs de Clínica, Balance Mensual (producido / cobrado / pendiente por médico) |

### 1.3 Filtros disponibles hoy en los reportes

- **Período:** `DateRangePresets` → hoy, semana, mes, mes anterior, año, rango personalizado. ✅ *Cubre el requerimiento del documento.*
- **Moneda:** UYU / USD (en la mayoría de reportes financieros).
- **Odontólogo:** solo en Ocupación de Agenda, Cancelaciones y Balance Mensual.
- **Calendario / Estado de cita / Motivo / Con presupuesto / Con sesión:** en Ocupación de Agenda y Cancelaciones.
- **Grupo de pacientes:** solo en Balance Mensual.
- **Estado de cuenta:** solo en Cuentas Corrientes.
- **Sucursal (sede):** ❌ **en ningún reporte**.

---

## 2. Brechas por sección del documento

### 2.1 Sección 1 — Visión general / Resumen ejecutivo

| Requerimiento del PDF | Estado | Brecha |
|---|---|---|
| Producción del día y del mes ($) | 🟡 Parcial | El dato existe (`produccion-doctor`, `tratamientos`) pero **no hay una vista "hoy" de producción en el dashboard**; el dashboard muestra "ingresos" (cobrado), no producción. Falta separar explícitamente **producción vs. facturación vs. cobranza** en la vista principal. |
| Cobranza / ingresos de caja del día y del mes | 🟡 Parcial | Existe en `cobros-dia` / `cierre-caja` / `ingresos-periodo`, pero **no consolidado en el panel principal** con la doble lectura día + mes simultánea. |
| Gastos del día y del mes | 🟡 Parcial | Existe `gastos-operativos`, **no está en el dashboard** ni en formato día+mes simultáneo. |
| Resultado de caja (ingresos cobrados − gastos pagados) | 🟡 Parcial | Existe en `estado-resultados` como reporte de período; **no está como indicador del día en el panel**. |
| Pacientes atendidos hoy y en el mes | 🔴 **Falta** | No existe el indicador "pacientes atendidos" como métrica propia. Lo más cercano es *citas completadas* (`ocupacion-agenda`) y *nº de pacientes por doctor* (`produccion-doctor`), que **no es lo mismo** (una cita ≠ un paciente único atendido). |
| Pacientes vigentes | 🔴 **Falta** | **No existe el concepto de "paciente vigente"** en el modelo ni criterio definido. El PDF explícitamente pide definir este criterio. |
| Pacientes nuevos del mes | ✅ Existe | `nuevos-pacientes` + KPI del dashboard. |
| Pacientes de ortodoncia vigentes | 🔴 **Falta** | No hay tratamiento de Ortodoncia como dimensión de negocio (ver §2.4). |
| Evolución respecto al período anterior (%) | 🟡 Parcial | Solo el **dashboard** trae variación vs. período anterior (ingresos, pacientes nuevos, ventas, conversión, facturación promedio, show rate). **Ningún reporte del módulo Reportes trae comparación contra período anterior.** |
| Vista: Consolidado \| Punta del Este \| Montevideo | 🔴 **Falta** | Ver §2.6 (Sucursal). |

### 2.2 Sección 2 — Producción y actividad

#### Producción por sucursal
| Requerimiento | Estado | Brecha |
|---|---|---|
| Pacientes atendidos / Tratamientos realizados / Importe producido / Importe cobrado, **por sucursal** | 🔴 **Falta completo** | Las métricas existen a nivel clínica; **no existe el corte por sede en ningún reporte**. |

#### Producción por odontólogo (`/reports/produccion-doctor`)
| Requerimiento | Estado | Brecha |
|---|---|---|
| Pacientes atendidos | ✅ `num_pacientes` | — |
| Cantidad de procedimientos | 🟡 Parcial | Se reporta `num_facturas`, **no cantidad de procedimientos/tratamientos** ejecutados por el doctor. |
| Producción económica generada | ✅ `total_facturado` | — |
| Cobranza asociada | ✅ `total_cobrado` | — |
| Ticket promedio | ✅ `ticket_promedio` | — |
| **% de participación sobre la producción total** | 🔴 **Falta** | El campo `pct_total` existe en el reporte de tratamientos y de servicios, **no en producción por doctor**. |
| Comparación entre odontólogos y períodos | 🟡 Parcial | `comparativo-produccion` compara doctores mes a mes, pero **no permite comparar dos períodos arbitrarios** ni muestra variación %. |

#### Producción por tipo de tratamiento (`/reports/tratamientos`, `/reports/servicios`)
| Requerimiento | Estado | Brecha |
|---|---|---|
| Cantidad de tratamientos / Producción $ / % sobre total | ✅ Existe (`cantidad`, `total_facturado`, `pct_total`) | — |
| **Separar Ortodoncia/Brackets, Prótesis y Otros** | 🟡 Parcial | Se agrupa por `category` del catálogo de servicios (configurable), pero **no existe una agrupación gerencial de alto nivel** (Ortodoncia / Prótesis / Otros) ni la posibilidad de mapear categorías a esos grupos. |
| Clasificación configurable (general, implantes, cirugía, endodoncia, estética, otros) | 🟡 Configurable | Se resuelve creando categorías de servicio. **No requiere desarrollo, sí requiere parametrización y un mapeo acordado.** |
| **Evolución respecto al período anterior** | 🔴 **Falta** | El reporte no tiene comparación contra período anterior. |

### 2.3 Sección 3 — Pacientes

| Requerimiento | Estado | Brecha |
|---|---|---|
| **Total de pacientes vigentes** | 🔴 **Falta** | No existe el concepto. Requiere: (a) definir el criterio (ej. con tratamiento activo, o con actividad en los últimos N meses, o con próxima cita agendada), (b) implementarlo. |
| Pacientes vigentes por sucursal | 🔴 **Falta** | Depende de (1) el concepto de vigente y (2) la dimensión sede. |
| Pacientes vigentes por odontólogo | 🔴 **Falta** | El paciente sí tiene `doctor_id` asignado, pero no hay reporte de cartera por doctor. |
| Pacientes vigentes por tipo de tratamiento | 🔴 **Falta** | — |
| Pacientes nuevos | ✅ Existe | `nuevos-pacientes` (con nº de citas y tasa de conversión a primera cita). |
| Pacientes que finalizaron tratamiento | 🟡 Parcial | `pacientes-inactivos` distingue `alta_medica` vs. `inactividad`, y `tratamientos-en-curso` marca completados. **No hay una métrica mensual de "finalizaciones del período".** |
| Pacientes que dejaron de concurrir / inactivos | ✅ Existe | `pacientes-inactivos` con `days_inactive` y deuda asociada. |
| **Evolución mensual: Inicial + Altas − Bajas = Vigentes al cierre** | 🔴 **Falta completo** | No existe ningún reporte con esta lógica de *stock y flujo* de cartera. Es un desarrollo nuevo. |

### 2.4 Sección 4 — Seguimiento especial de Ortodoncia 🔴 **BRECHA MAYOR**

Este bloque es el que el documento marca como el de mayor relevancia y es **el que menos cobertura tiene hoy**.

#### Stock de pacientes de ortodoncia
| Requerimiento | Estado |
|---|---|
| Pacientes activos al inicio del mes | 🔴 Falta |
| Nuevos pacientes de ortodoncia del mes | 🔴 Falta |
| Pacientes que finalizaron tratamiento | 🔴 Falta |
| Pacientes que abandonaron / quedaron inactivos | 🔴 Falta |
| Pacientes activos al cierre del mes | 🔴 Falta |
| Vista total / por sucursal / por ortodoncista | 🔴 Falta |
| Gráfico de evolución 12–24 meses de la cartera | 🔴 Falta |

> **Nota:** hoy "Ortodoncia" solo aparece como *nombre de categoría/servicio* del catálogo
> (`Ortodoncia Fija`, `Ortodoncia Removible`). No hay ninguna lógica de negocio que trate la
> ortodoncia como una **cartera de pacientes con stock, altas y bajas mensuales**.

#### Control de seguimiento
| Requerimiento | Estado | Comentario |
|---|---|---|
| Pacientes que realizaron el control del mes | 🔴 Falta | — |
| Pacientes que todavía no realizaron su control | 🔴 Falta | — |
| Pacientes atrasados | 🟡 Base parcial | `tratamientos-en-curso` ya calcula `days_since_last_step` y marca pasos en estado `alert`. Es una **base reutilizable**, pero no es un control mensual de ortodoncia. |
| Tiempo desde el último control | 🟡 Base parcial | Idem (`days_since_last_step`). |
| Próximo control agendado | 🔴 Falta | No se expone "próxima cita" del paciente en ningún reporte. |
| **Pacientes sin próxima cita** | 🔴 Falta | Indicador clave de fuga de cartera; no existe. |
| Alerta/listado de pacientes que debían concurrir y no lo hicieron | 🟡 **Configurable** | El **Centro de Alertas** permite definir reglas basadas en consultas SQL (`AlertRule.query_template`, con `days_before`/`days_after` y recurrencia), con envío automático por email/SMS/WhatsApp. Esto se puede **configurar sin desarrollo de core**, aunque requiere escribir la regla y validarla. |

### 2.5 Sección 5 — Administración y finanzas

| Requerimiento | Estado | Brecha |
|---|---|---|
| **Diferenciar producción / facturación / cobranza** | 🟡 Parcial | `balance-mensual` (producido / cobrado / pendiente) y `facturacion-cobranza` cubren facturado vs. cobrado. **Falta la distinción explícita de "producción" (trabajo ejecutado) vs. "facturación" (documento emitido)** como conceptos separados en el tablero. |
| Cobranza del día, mes y período | ✅ Existe | `cobros-dia`, `ingresos-periodo`. |
| **Cobranza por sucursal** | 🔴 Falta | — |
| **Cobranza por tratamiento** | 🔴 Falta | `servicios` reporta **facturado** por servicio (`total_facturado`), **no cobrado**. Es una brecha concreta de un campo. |
| Cobranza por medio de pago | ✅ Existe | `by_method` en `cobros-dia` y `cierre-caja`. |
| Gastos del día, mes y período | ✅ Existe | `gastos-operativos` (`by_period`). |
| **Gastos por sucursal** | 🔴 Falta | — |
| Gastos por categoría (sueldos, honorarios, laboratorio, insumos, alquiler, servicios, marketing, impuestos, mantenimiento, otros) | 🟡 **Configurable** | `by_category` existe y las categorías se administran desde *Caja → Categorías de movimientos*. **Requiere parametrizar el plan de categorías acordado y asegurar que sueldos/honorarios se registren allí** (hoy honorarios se calcula aparte en su propio reporte). |
| Resultado = Ingresos cobrados − Gastos pagados | ✅ Existe | `estado-resultados` (neto + margen). |
| Visualización hoy / semana / mes / mes anterior / año / personalizado | ✅ Existe | `DateRangePresets`. |
| **Comparación período actual vs. anterior** | 🔴 Falta | No está en ningún reporte del módulo (solo en el dashboard para 6 métricas). |

### 2.6 Sección 6 — Filtros generales

| Filtro requerido | Estado |
|---|---|
| Fecha / período | ✅ Completo (presets + personalizado) |
| **Sucursal** | 🔴 **Falta en el 100% de los reportes y en el dashboard.** El modelo tiene la entidad `Sede` y se usa en calendarios, horarios y agenda, pero **no llega a la capa analítica**. |
| Odontólogo | 🟡 Solo en 3 de 21 reportes (Ocupación, Cancelaciones, Balance Mensual) |
| Tipo de tratamiento | 🔴 Falta como filtro transversal (existe como dimensión de fila, no como filtro) |
| Estado del paciente | 🔴 Falta (depende de definir el concepto de vigente/inactivo como estado) |
| Forma de pago | 🟡 Existe como dimensión (`by_method`), **no como filtro** |
| **Drill-down: clic en un indicador → detalle que lo compone** | 🔴 **Falta** | Las tarjetas de KPI de los reportes no son clicables. Solo `balance-mensual` tiene interacción a nivel fila. Este es un requisito transversal del tablero. |

### 2.7 Sección 7 — Las 5 preguntas que debe responder el panel

| # | Pregunta | ¿La responde hoy? |
|---|---|---|
| 1 | ¿Cuánto estamos produciendo? | 🟡 Sí, pero **repartido en varios reportes y sin corte por sucursal**. |
| 2 | ¿Cuánto cobramos y cuánto gastamos? | ✅ Sí (`estado-resultados`, `ingresos-periodo`, `gastos-operativos`) — **sin corte por sucursal**. |
| 3 | ¿Cuántos pacientes activos tenemos y cómo evolucionan? | 🔴 **No.** No existe el concepto de paciente vigente ni la evolución de cartera. |
| 4 | ¿Qué sucursal, odontólogo y tratamiento genera la producción? | 🟡 Odontólogo y tratamiento sí; **sucursal no**. |
| 5 | ¿Está creciendo o disminuyendo la cartera de ortodoncia? | 🔴 **No.** Brecha total. |

---

## 3. Clasificación para la reunión (el "punto clave" del documento)

### 3.1 Ya viene estándar (0 desarrollo)
- Selector de período: hoy / semana / mes / mes anterior / año / personalizado.
- Cobranza por medio de pago, cierre de caja, arqueo por sesión.
- Gastos por categoría / proveedor / período / estado de pago.
- Estado de resultados (ingresos cobrados − gastos pagados, con margen).
- Deudores con aging 0-30 / 31-60 / 61-90 / 90+.
- Presupuestos pendientes y tasa de conversión.
- Producción y cobranza por odontólogo, ticket promedio.
- Producción por tratamiento con % sobre el total.
- Ocupación de agenda, cancelaciones por motivo/doctor/paciente/servicio.
- Pacientes nuevos y pacientes inactivos.
- Facturación vs. cobranza mensual; Balance mensual producido/cobrado/pendiente.
- Exportación CSV / Excel / PDF en todos los reportes.

### 3.2 Se resuelve con configuración (sin desarrollo de core)
- **Clasificación de tratamientos** (Ortodoncia / Prótesis / Implantes / Cirugía / Endodoncia / Estética / Otros): crear las categorías en el catálogo de servicios y reasignar los servicios existentes.
- **Plan de categorías de gastos** (sueldos, honorarios, laboratorio, insumos, alquiler, servicios, marketing, impuestos, mantenimiento, otros): alta de categorías de movimientos de caja + criterio de carga.
- **Alerta de pacientes que debían concurrir y no lo hicieron**: regla en el Centro de Alertas (query + recurrencia + notificación automática por email/SMS/WhatsApp).
- **Agrupamientos de pacientes** (ya usados en Balance Mensual) para segmentaciones ad-hoc.

### 3.3 Requiere desarrollo específico
| Prioridad | Desarrollo | Comentario |
|---|---|---|
| 🔴 1 | **Dimensión Sucursal (sede) en toda la capa analítica** | Propagar `sede_id` a facturas, cobros, gastos, producción y pacientes; agregar filtro + vista "Consolidado / Punta del Este / Montevideo" en dashboard y reportes. Es el habilitador de gran parte del resto. |
| 🔴 2 | **Definición e implementación de "paciente vigente"** | Definir criterio con el cliente, persistirlo/calcularlo y exponerlo por sede, doctor y tratamiento. |
| 🔴 3 | **Evolución mensual de cartera** (Inicial + Altas − Bajas = Cierre) | Reporte nuevo de stock y flujo, con serie histórica. |
| 🔴 4 | **Módulo de seguimiento de Ortodoncia** | Stock mensual, altas/bajas/finalizaciones, control mensual realizado/pendiente/atrasado, próximo control, pacientes sin próxima cita, gráfico 12–24 meses. Puede apoyarse en la infraestructura existente de *Tratamientos en Curso* (pasos, `days_since_last_step`, estados `alert`). |
| 🟠 5 | **Panel gerencial "hoy" unificado** | Una vista con producción / cobranza / gastos / resultado del día y del mes + pacientes atendidos + pacientes vigentes + ortodoncia vigentes, con selector de sede. |
| 🟠 6 | **Comparación contra período anterior en los reportes** | Hoy solo la tiene el dashboard. El PDF la pide en resumen ejecutivo, tratamientos y finanzas. |
| 🟠 7 | **Drill-down desde indicador a detalle** | Hacer clicables las tarjetas de KPI para abrir el detalle que las compone. |
| 🟡 8 | **Métrica "pacientes atendidos"** (únicos, no citas) | Día / mes, por sede y por doctor. |
| 🟡 9 | **Cobranza por tratamiento** | Agregar `total_cobrado` al reporte de servicios (hoy solo facturado). |
| 🟡 10 | **% de participación por odontólogo** | Agregar `pct_total` al reporte de producción por doctor. |
| 🟡 11 | **Filtros transversales**: odontólogo en todos los reportes, tipo de tratamiento, estado del paciente, forma de pago | Homogeneizar la barra de filtros del módulo. |
| 🟡 12 | **Cantidad de procedimientos por doctor** | Hoy se reporta cantidad de facturas, no de procedimientos. |
| 🟡 13 | **Pacientes que finalizaron tratamiento en el período** | Métrica de flujo, hoy solo hay stock de inactivos/altas médicas. |

---

## 4. Preguntas a definir con el cliente

1. **¿Cuál es el criterio exacto de "paciente vigente"?** El propio documento lo señala como algo a definir con precisión. Opciones: tratamiento activo abierto / actividad en los últimos N meses / próxima cita agendada / combinación.
2. **¿Cuál es el criterio de "baja" o "abandono"** en ortodoncia? (¿N meses sin control? ¿alta médica explícita?)
3. **¿Con qué frecuencia se espera el control de ortodoncia** (mensual fijo, o según plan de tratamiento)? De eso depende el cálculo de "atrasado".
4. **¿"Producción" se define como trabajo ejecutado (sesiones/procedimientos realizados) o como monto facturado?** Hoy el sistema mide facturación; el documento los trata como conceptos distintos.
5. **¿Los gastos se van a imputar por sucursal** desde la carga? Sin eso, el corte de gastos por sede no es calculable retroactivamente.
6. **¿Sueldos y honorarios se cargan como movimientos de caja / facturas de proveedor**, o deben integrarse desde el reporte de honorarios al estado de resultados?
7. **¿El tablero debe ser multi-moneda consolidado (UYU/USD)?** Hoy los reportes trabajan por moneda seleccionada, no consolidan.

---

## 5. Anexo — Mapa rápido requerimiento → reporte existente

| Requerimiento del PDF | Reporte / vista actual |
|---|---|
| Cobranza del día | `/reports/cobros-dia` |
| Cierre / arqueo de caja | `/reports/cierre-caja` |
| Cobranza por medio de pago | `/reports/cobros-dia` (`by_method`) |
| Ingresos por período | `/reports/ingresos-periodo` |
| Facturación vs. cobranza | `/reports/facturacion-cobranza` |
| Saldos y deuda por paciente | `/reports/cuentas-corrientes`, `/reports/deudores` |
| Gastos por categoría / proveedor | `/reports/gastos-operativos` |
| Resultado del período | `/reports/estado-resultados` |
| Producción por odontólogo | `/reports/produccion-doctor`, `/reports/comparativo-produccion` |
| Producción por tratamiento | `/reports/tratamientos`, `/reports/servicios` |
| Producido / cobrado / pendiente por médico | `/reports/balance-mensual` |
| Honorarios | `/reports/honorarios` |
| Pacientes nuevos | `/reports/nuevos-pacientes` |
| Pacientes inactivos | `/reports/pacientes-inactivos` |
| Tratamientos en curso y sus pasos | `/reports/tratamientos-en-curso` |
| Ocupación de agenda / show rate | `/reports/ocupacion-agenda` |
| Cancelaciones y motivos | `/reports/cancelaciones` |
| KPIs generales | `/reports/kpis` |
| **Producción/cobranza/gastos por sucursal** | ❌ no existe |
| **Pacientes vigentes y evolución de cartera** | ❌ no existe |
| **Seguimiento de ortodoncia (stock + controles)** | ❌ no existe |
| **Panel gerencial "hoy" con drill-down** | ❌ no existe |
