# GUÍA DE USO COMPLETA — INVOKE IA
**Plataforma de gestión integral para clínicas odontológicas y de salud**
Versión 2.0 · Abril 2026

---

## ÍNDICE DE RUTAS

| Módulo | Path |
|--------|------|
| Dashboard | `/` |
| Pacientes | `/users` |
| Historia Clínica | `/clinic-history/{user_id}` |
| Citas | `/appointments` |
| Alertas | `/alerts` |
| Ventas › Presupuestos | `/sales/quotes` |
| Ventas › Órdenes | `/sales/orders` |
| Ventas › Facturas | `/sales/invoices` |
| Ventas › Pagos | `/sales/payments` |
| Ventas › Servicios | `/sales/services` |
| Ventas › Métodos de pago | `/sales/payment-methods` |
| Caja | `/cashier` |
| Caja › Sesiones | `/cashier/sessions` |
| Caja › Puntos de venta | `/cashier/cash-points` |
| Caja › Transacciones misc. | `/cashier/miscellaneous-transactions` |
| Caja › Categorías misc. | `/cashier/miscellaneous-categories` |
| Compras › Presupuestos | `/purchases/quotes` |
| Compras › Órdenes | `/purchases/orders` |
| Compras › Facturas | `/purchases/invoices` |
| Compras › Pagos | `/purchases/payments` |
| Compras › Proveedores | `/purchases/providers` |
| Compras › Servicios proveedor | `/purchases/services` |
| Config › Clínica | `/config/clinics` |
| Config › Médicos | `/config/doctors` |
| Config › Disponibilidad | `/config/doctor-availability` |
| Config › Excepciones disponibilidad | `/config/availability-exceptions` |
| Config › Horarios | `/config/schedules` |
| Config › Calendarios | `/config/calendars` |
| Config › Feriados | `/config/holidays` |
| Config › Monedas | `/config/currencies` |
| Config › Secuencias | `/config/sequences` |
| Config › Mutualistas | `/config/mutual-societies` |
| Catálogo › Padecimientos | `/clinic-catalog/ailments` |
| Catálogo › Condiciones dentales | `/clinic-catalog/dental-conditions` |
| Catálogo › Superficies dentales | `/clinic-catalog/dental-surfaces` |
| Catálogo › Medicamentos | `/clinic-catalog/medications` |
| Sistema › Usuarios | `/system/users` |
| Sistema › Roles | `/roles` |
| Sistema › Permisos | `/permissions` |
| Sistema › Auditoría | `/system/audit` |
| Sistema › Accesos | `/system/access` |
| Sistema › Cat. alertas | `/system/alert-categories` |
| Sistema › Reglas alertas | `/system/alert-rules` |
| Sistema › Config alertas | `/system/alerts-config` |
| Sistema › Plantillas comunicación | `/system/communication-templates` |
| Sistema › Historial comunicaciones | `/system/communication-history` |
| Sistema › Config sistema | `/system/config` |
| Sistema › Errores | `/system/errors` |
| Sistema › Historial ejecución | `/system/execution-history` |
| Sistema › Notificaciones | `/system/notification-settings` |
| Sistema › Importación | `/system/import` |
| Pantalla TV | `/tv-display` |
| Estudios DICOM | `/studies` |
| Estudios compartidos | `/shared-studies` |

---

## MÓDULO 1 — DASHBOARD
**Path:** `/`

Panel de control principal. Muestra KPIs, gráficos y tablas de actividad reciente.

### Secciones (controladas por permisos)
- **KPIs principales:** Ingresos totales, Nuevos pacientes, Ventas, Tasa de conversión de presupuestos.
- **KPIs operacionales:** Facturación promedio, Asistencia a citas.
- **Gráficos:** Resumen de ventas (líneas), Ventas por servicio (torta), Estado facturas (torta), Demografía pacientes.
- **Tablas recientes:**
  - *Presupuestos recientes:* doc_no, paciente, total, estado, estado_pago, fecha.
  - *Órdenes recientes:* doc_no, paciente, estado, moneda, fecha.
  - *Nuevos pacientes:* nombre, email, teléfono, activo — con paginación y búsqueda.
- **Filtros:** Rango de fechas aplicable a todos los datos (requiere permiso `APPLY_FILTERS`).

---

## MÓDULO 2 — PACIENTES
**Path:** `/users`

### Layout
Dos paneles: izquierda lista de pacientes, derecha panel de detalle del paciente seleccionado.

### Grid (panel izquierdo)
Columnas: Nombre, Email, Documento de identidad, Teléfono, Estado (Activo/Inactivo).

**Vista alternativa "Deudores":** Nombre, Email, Documento, Deuda UYU, Deuda USD.

### Búsqueda y filtros
- Búsqueda por nombre o email (debounced).
- Rango de fechas con presets: Todo el tiempo, Hoy, Esta semana, Este mes.
- Toggle "Solo deudores" (requiere permiso).
- Toggle "Solo activos".
- Botón limpiar filtros.

### Acciones
- **Crear paciente** (botón +): abre formulario.
- **Editar:** abre formulario pre-cargado.
- **Activar/Desactivar:** toggle de estado.
- **Copiar ID.**
- **Dar de alta/baja:** abre diálogo con fecha (opciones rápidas: 1 mes, 3 meses, 6 meses, 1 año, o fecha personalizada).
- **Resumen financiero:** selector de rango de fechas para imprimir PDF.
- **Botón + Crear rápido:** Sesión clínica, Documento clínico, Presupuesto, Factura, Prepago, Cita.
- **Preferencias:** popover con configuración de comunicaciones.

### Formulario Crear/Editar Paciente
Campos:
- Nombre (requerido)
- Email (opcional, formato email válido)
- Teléfono (opcional, formato internacional válido)
- Documento de identidad (requerido, solo dígitos, max 10)
- Fecha de nacimiento (opcional, formato YYYY-MM-DD)
- Notas (opcional, textarea)
- Mutualista (opcional, select)
- Activo (checkbox)

**Validación:** debe tener al menos email O teléfono.

### Panel de detalle (tabs)
1. **Historia Clínica** — ClinicHistoryViewer
2. **Servicios** — (solo si el paciente tiene rol médico)
3. **Presupuestos** — lista con acciones
4. **Órdenes** — lista con acciones
5. **Facturas** — lista con acciones
6. **Pagos** — lista con acciones
7. **Citas** — lista con acciones
8. **Mensajes** — historial de comunicaciones
9. **Logs** — actividad del usuario
10. **Notas** — editor libre con guardado/cancelación

### Alertas clínicas en cabecera del panel
- Badge rojo: cantidad de alergias registradas.
- Badge amarillo: cantidad de condiciones dentales activas.
- Muestra primeros 3 ítems + "+N más".

---

## MÓDULO 3 — HISTORIA CLÍNICA
**Path:** `/clinic-history/{user_id}`

### Secciones

#### Antecedentes personales
Columnas: Padecimiento (del catálogo), Comentarios. Acciones: editar, eliminar.
Formulario: Padecimiento (combobox catálogo, requerido) + Comentarios (textarea).

#### Antecedentes familiares
Columnas: Padecimiento, Parentesco (padre/madre/hermano/etc.), Comentarios.
Formulario: Padecimiento (requerido) + Parentesco (select, requerido) + Comentarios.

#### Alergias
Columnas: Alérgeno, Reacción descrita. Acciones: editar, eliminar.
Formulario: Alérgeno (texto, requerido) + Reacción (textarea, requerida).

#### Medicamentos actuales
Columnas: Medicamento, Dosis, Frecuencia, Fecha inicio, Fecha fin, Motivo.
Formulario: Medicamento (búsqueda en catálogo, debounced 300ms, requerido) + Dosis (requerida) + Frecuencia (requerida) + Fecha inicio (requerida) + Fecha fin (opcional) + Motivo.

#### Hábitos del paciente
Campos: Tabaquismo, Alcohol, Bruxismo — con modo edición/vista.

#### Odontograma
Visualización interactiva de piezas dentales con condiciones y superficies.

---

## MÓDULO 4 — CITAS
**Path:** `/appointments`

### Vistas del calendario
Día, 2 días, 3 días, Semana, Mes. Seleccionable con botones.

### Filtros
- Calendarios (multi-select, seleccionar/deseleccionar todos).
- Médicos (multi-select, solo en vista día/semana).
- Agrupación: ninguna, por médico, por calendario.

### Información mostrada en cada cita
Servicio, Paciente, Médico, Calendario, Fecha, Hora, Estado (confirmada/pendiente/programada/completada/cancelada), color del médico.

### Acciones
- **Crear cita** (botón +): abre formulario.
- **Editar cita:** modifica datos.
- **Cancelar/Eliminar:** diálogo de confirmación.
- **Registrar sesión clínica:** abre diálogo de sesión vinculado a la cita.
- **Ver detalle:** modal con información completa, links a paciente, médico, presupuesto, factura.
- **Reprogramar:** drag & drop en el calendario o edición manual.
- **Cambiar color:** menú desplegable por cita.

### Formulario Crear/Editar Cita
Campos:
- Paciente (búsqueda, requerido; se puede crear nuevo)
- Médico (select, requerido)
- Calendario (select, requerido)
- Servicio (select, requerido)
- Fecha y hora (date+time picker, requerido)
- Notas (textarea, opcional)
- Presupuesto asociado (select filtrado por paciente; o crear nuevo presupuesto en el momento)
- Validar disponibilidad calendario (checkbox)
- Validar disponibilidad médico (checkbox)

### Formulario Sesión Clínica (desde cita)
Campos: Tipo de sesión, Fecha, Médico, Diagnóstico, Descripción del procedimiento, Notas clínicas, Ítems de tratamiento (auto-cargados desde presupuesto vinculado), Archivos adjuntos.

---

## MÓDULO 5 — ALERTAS
**Path:** `/alerts`

### KPIs (cabecera)
Total alertas pendientes, Críticas, Alta prioridad, Media prioridad.

### Grid
Columnas: Título, Prioridad (CRITICAL/HIGH/MEDIUM/LOW, barras de color), Estado (PENDING/COMPLETED/ACTION_TAKEN/IGNORED/SUPPRESSED), Paciente, Campos configurables por alerta (tipo text/datetime/number/boolean).

**Agrupación:** por categoría (APPOINTMENTS, BILLING, PATIENTS, FOLLOWUP, DEFAULT) — colapsables, con checkbox de selección masiva por categoría.

### Filtros
- Estado: Todos, PENDING, COMPLETED, ACTION_TAKEN, IGNORED, SUPPRESSED.
- Prioridad: Todos, LOW, MEDIUM, HIGH, CRITICAL.

### Acciones por alerta
- Enviar email.
- Completar (checkmark).
- Menú "más": Enviar WhatsApp, Registrar llamada, Posponer (snooze), Ignorar, Agregar nota.

### Acciones masivas (barra flotante al seleccionar)
Completar, Enviar email, Enviar SMS, Enviar WhatsApp, Registrar llamada, Posponer, Ignorar, Agregar nota.

### Diálogos
- **Ignorar:** textarea con motivo.
- **Posponer (snooze):** date/time picker + opciones rápidas (1 día, 3 días, 1 semana) + motivo.
- **Registrar llamada:** date/time + notas.
- **Agregar nota:** textarea con contenido.

### Paginación
Selector de tamaño (10, 25, 50, 100). Navegación primera/anterior/siguiente/última página.

---

## MÓDULO 6 — FLUJO DE VENTAS

### 6.1 Presupuestos
**Path:** `/sales/quotes`

**Grid:** doc_no, Paciente, Email, Total, Moneda (UYU/USD), Estado (borrador/enviado/aceptado/rechazado/pendiente/confirmado), Estado de pago (no_facturado/pagado/parcial), Estado de facturación, Fecha creación, Notas.

**Acciones:** Crear, Editar, Eliminar, Imprimir PDF, Enviar email, Convertir a orden.

**Formulario:**
- Paciente (requerido)
- Moneda (UYU/USD)
- Tipo de cambio (opcional, min 0.0001)
- Notas
- Ítems: Servicio (del catálogo), Cantidad, Precio unitario (multipleOf 0.01), Total, Número de pieza dental (11–85, opcional para odontología)

**Tabs del detalle:**
1. Ítems (agregar/editar/eliminar)
2. Órdenes generadas
3. Facturas generadas
4. Sesiones clínicas vinculadas
5. Citas vinculadas
6. Notas

### 6.2 Órdenes de Venta
**Path:** `/sales/orders`

**Grid:** doc_no, Paciente, Presupuesto origen, Moneda, Estado, Fecha creación.

**Acciones:** Ver detalle, Crear factura desde orden, Programar ítems, Completar ítems.

**Tabs del detalle:**
1. Ítems (con botones PROGRAMAR y COMPLETAR por ítem — COMPLETAR abre diálogo de sesión clínica)
2. Facturas relacionadas (con ítems anidados)
3. Pagos
4. Notas

**Importante:** Solo los ítems en estado "Completado" pueden incluirse en una factura.

### 6.3 Facturas de Venta
**Path:** `/sales/invoices`

**Grid:** doc_no, Paciente, Total, Moneda, Estado (borrador/confirmada), Tipo (factura/nota_crédito), Estado de pago, Monto pagado, Fecha.

**Acciones:** Crear, Editar, Eliminar, Confirmar, Imprimir PDF, Enviar email, Registrar pago, Importar (AI con archivo), Agregar/Editar/Eliminar ítems.

**Formulario ítem:** Servicio, Cantidad (min 1), Precio unitario (min 0).

**Tabs del detalle:**
1. Ítems
2. Pagos (multi-moneda)
3. Notas de crédito
4. Asignaciones (para notas de crédito)

**Diálogos:**
- Enviar email: campo de destinatarios con validación de formato.
- Importar: drag-and-drop de archivo.
- Confirmar factura.
- Aviso de preferencias de comunicación desactivadas.

### 6.4 Pagos de Venta
**Path:** `/sales/payments`

**Grid:** doc_no, Paciente, Factura, Tipo (pago/prepago/nota_crédito), Fecha, Monto aplicado, Monto origen, Moneda, Tipo de cambio, Método de pago, Tipo transacción, Histórico (badge).

**Acciones:** Crear prepago, Imprimir, Enviar email. Paginación de 50 ítems.

**Formulario Prepago:**
- Paciente (búsqueda popover, requerido)
- Monto (número positivo, requerido)
- Método de pago (requerido)
- Fecha (requerida)
- Moneda (UYU/USD)
- Notas (opcional)
- Es histórico (boolean)

**Tabs del detalle:** Asignaciones a facturas, Notas.

### 6.5 Servicios
**Path:** `/sales/services`

**Grid:** ID, Nombre, Categoría, Precio, Moneda, Duración (min), Color, Activo.

**Formulario:**
- Nombre (requerido)
- Categoría (select de categorías, requerido)
- Precio (número positivo, requerido)
- Moneda (UYU/USD, default USD)
- Duración en minutos (entero positivo, requerido)
- Descripción (textarea, opcional)
- Indicaciones (textarea, opcional)
- Color (color picker, opcional)
- Activo (checkbox)

**Acciones:** Crear, Editar, Eliminar.

### 6.6 Métodos de Pago
**Path:** `/sales/payment-methods`

**Grid:** ID, Nombre, Código, Equivalente a efectivo (sí/no), Activo.

**Formulario:** Nombre (requerido), Código (requerido), Equivalente a efectivo (boolean), Activo (boolean).

**Acciones:** Crear, Editar, Eliminar, Activar/Desactivar.

---

## MÓDULO 7 — CAJA

### 7.1 Panel principal de Caja
**Path:** `/cashier`

**Muestra:** tarjetas de puntos de venta con estado (ABIERTO/CERRADO), información de sesión activa.

**Flujo apertura de sesión** (wizard 4 pasos):
1. CONFIG: seleccionar caja física y tipo de cambio.
2. COUNT_UYU: contar billetes y monedas en pesos (denominaciones: 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1).
3. COUNT_USD: contar billetes en dólares (denominaciones: 100, 50, 20, 10, 5, 1).
4. CONFIRM: confirmar saldo inicial calculado.

**Flujo cierre de sesión:** mismo esquema de conteo de denominaciones + confirmación con diferencia calculada automáticamente.

**Tabla de movimientos de sesión:**
Columnas: ID movimiento, Sesión, Tipo (INGRESO/EGRESO), Monto, Moneda, Descripción, Fecha, Usuario, Método de pago, Número de documento.

### 7.2 Sesiones de Caja
**Path:** `/cashier/sessions`

Historial de todas las sesiones con apertura, cierre, saldo esperado vs. real. Acciones: ver detalle, imprimir cierre.

### 7.3 Puntos de Venta
**Path:** `/cashier/cash-points`

**Grid:** Nombre, Estado, Sesión activa.
**Formulario:** Nombre (requerido).
**Acciones:** Crear, Editar, Eliminar.

### 7.4 Transacciones Misceláneas
**Path:** `/cashier/miscellaneous-transactions`

Ingresos o egresos que no provienen de facturas (gastos, cobros varios).

**Grid:** Tipo, Categoría, Monto, Moneda, Descripción, Beneficiario, Método de pago, Fecha.

**Formulario:** Tipo (Ingreso/Egreso), Categoría (select), Monto, Moneda, Descripción, Beneficiario, Método de pago, Fecha.

### 7.5 Categorías Misceláneas
**Path:** `/cashier/miscellaneous-categories`

**Grid:** Nombre, Código, Tipo (ingreso/egreso), Activo.
**Formulario:** Nombre, Código, Tipo, Activo.
**Acciones:** Crear, Editar, Eliminar.

---

## MÓDULO 8 — COMPRAS

Flujo simétrico al de ventas pero del lado del proveedor.

### 8.1 Proveedores
**Path:** `/purchases/providers`

**Grid:** Nombre, Email, Teléfono, Documento fiscal, Activo.
**Formulario:** Nombre, Email, Teléfono, Documento fiscal (RUT), Activo.
**Acciones:** Crear, Editar, Activar/Desactivar.

### 8.2 Presupuestos de Compra
**Path:** `/purchases/quotes`

Idéntico a ventas quotes pero para proveedores. Sin campo de pieza dental en ítems.
**Tabs:** Ítems, Órdenes, Facturas, Pagos.

### 8.3 Órdenes de Compra
**Path:** `/purchases/orders`

**Grid:** doc_no, Proveedor, Presupuesto origen, Moneda, Estado, Fecha.
**Tabs:** Ítems, Facturas relacionadas, Pagos.

### 8.4 Facturas de Compra
**Path:** `/purchases/invoices`

**Grid:** doc_no, Proveedor, Total, Moneda, Estado, Tipo, Estado de pago, Monto pagado, Fecha.
**Acciones:** Crear, Editar, Eliminar, Confirmar, Importar AI, Enviar email, Agregar/Editar/Eliminar ítems.
**Tabs:** Ítems, Pagos, Notas de crédito, Asignaciones.

### 8.5 Pagos de Compra
**Path:** `/purchases/payments`

**Grid:** Mismo esquema que pagos de venta. Paginación 50 ítems.
**Tabs:** Asignaciones, Notas.

### 8.6 Servicios del Proveedor
**Path:** `/purchases/services`

Catálogo de productos/servicios de proveedores. CRUD básico.

---

## MÓDULO 9 — CONFIGURACIÓN

### 9.1 Clínica
**Path:** `/config/clinics`

Vista única (no tabla). Campos: Logo (upload, max 1MB, PNG recomendado ≥200×200px), Nombre, Dirección, Email, Teléfono, Moneda base. Incluye embed de Google Maps. Acción: Guardar cambios.

### 9.2 Médicos
**Path:** `/config/doctors`

**Grid:** Nombre, Email, Documento, Teléfono, Estado.
**Formulario:** Nombre (requerido), Email (opcional, válido), Teléfono (opcional, válido), Documento de identidad (requerido, solo dígitos, max 10), Color (color picker), Activo.
**Validación:** debe tener email O teléfono.
**Panel derecho (tabs):** Servicios asignados, Mensajes, Logs.
**Acciones:** Crear, Editar, Activar/Desactivar.

### 9.3 Disponibilidad de Médicos
**Path:** `/config/doctor-availability`

**Grid:** Médico, Recurrencia, Día de semana, Hora inicio, Hora fin, Fecha inicio, Fecha fin.
**Formulario:** Médico (combobox búsqueda, requerido), Recurrencia (diaria/semanal/quincenal), Día de semana (requerido si semanal/quincenal), Hora inicio, Hora fin, Fecha inicio, Fecha fin (opcional).
**Acciones:** Crear, Editar, Eliminar.

### 9.4 Excepciones de Disponibilidad
**Path:** `/config/availability-exceptions`

Vacaciones o días especiales de un médico que sobreescriben su disponibilidad normal.
**Formulario:** Médico, Fecha inicio, Fecha fin, Motivo.

### 9.5 Horarios de la Clínica
**Path:** `/config/schedules`

**Grid:** Día de semana, Hora inicio, Hora fin.
**Formulario:** Día (select 0–6), Hora inicio, Hora fin.
**Acciones:** Crear, Editar, Eliminar.

### 9.6 Calendarios
**Path:** `/config/calendars`

**Grid:** Nombre, Google Calendar ID, Color, Activo.
**Formulario:** Nombre (requerido), Google Calendar ID (formato email, requerido), Color (#RRGGBB, opcional), Activo.
**Acciones:** Crear, Editar, Eliminar.

### 9.7 Feriados
**Path:** `/config/holidays`

**Grid:** Fecha, Estado (abierto/cerrado), Hora inicio, Hora fin, Notas.
**Formulario:** Fecha (requerida), ¿Abierto? (checkbox — permite agregar horas parciales), Hora inicio (opcional), Hora fin (opcional), Notas (opcional).
**Acciones:** Crear, Editar, Eliminar. Búsqueda de texto libre.

### 9.8 Monedas y Tipos de Cambio
**Path:** `/config/currencies`

Muestra historial de cotizaciones (USD compra/venta/promedio). Filtro por rango de fechas. Modal de detalle con todas las monedas. Solo lectura — los tipos de cambio vienen de fuente externa.

### 9.9 Secuencias de Documentos
**Path:** `/config/sequences`

**Grid:** Nombre, Tipo de documento, Patrón, Contador actual, Período de reset, Activo.
**Formulario:** Nombre (requerido), Tipo (invoice/quote/order/payment/credit_note/purchase_order/miscellaneous), Patrón (texto con variables: {YYYY}{MM}{DD}{HH}{MI}{SS}{COUNTER:N}), Contador inicial (min 1), Período de reset (nunca/anual/mensual/diario), Activo.
**Vista previa del patrón** en tiempo real.
**Acciones:** Crear, Editar, Eliminar. Filtros avanzados: solo activos, rango de fechas.

### 9.10 Mutualistas
**Path:** `/config/mutual-societies`

**Grid:** Nombre, Descripción, Código, Activo, Creado, Actualizado.
**Formulario:** Nombre (requerido), Código (requerido), Descripción (opcional), Activo.
**Acciones:** Crear, Editar, Eliminar.

---

## MÓDULO 10 — CATÁLOGO CLÍNICO

### 10.1 Padecimientos / Afecciones
**Path:** `/clinic-catalog/ailments`

**Grid:** Nombre, Categoría, Nivel de alerta.
**Formulario:** Nombre (requerido), Categoría (requerida), Nivel de alerta (requerido).
**Acciones:** Crear, Editar, Eliminar.

### 10.2 Condiciones Dentales
**Path:** `/clinic-catalog/dental-conditions`

**Grid:** Nombre, Código visual, Color (swatch).
**Formulario:** Nombre (requerido), Código visual (requerido), Color (#RRGGBB, requerido) — color picker dual.
**Acciones:** Crear, Editar, Eliminar.

### 10.3 Superficies Dentales
**Path:** `/clinic-catalog/dental-surfaces`

**Grid:** Nombre, Código.
**Formulario:** Nombre (requerido), Código (requerido).
**Acciones:** Crear, Editar, Eliminar.

### 10.4 Medicamentos
**Path:** `/clinic-catalog/medications`

**Grid:** ID, Nombre genérico, Nombre comercial.
**Formulario:** Nombre genérico (requerido), Nombre comercial (opcional).
**Búsqueda:** mínimo 3 caracteres. Paginación.
**Acciones:** Crear, Editar, Eliminar.

---

## MÓDULO 11 — SISTEMA

### 11.1 Usuarios del Sistema
**Path:** `/system/users`

**Grid (izquierda):** Nombre, Email, Teléfono, Activo, Roles.
**Panel derecho (tabs):** Roles asignados, Logs de actividad.
**Formulario:** Nombre (requerido), Email (opcional), Teléfono (opcional), Documento (opcional, max 10 dígitos), Activo.
**Acciones:** Crear, Editar, Activar/Desactivar, Asignar/quitar roles, Establecer contraseña inicial.

### 11.2 Roles
**Path:** `/roles`

Gestión de roles con permisos asignados. **Grid:** Nombre, Descripción, Cantidad de permisos, Cantidad de usuarios.
**Formulario:** Nombre, Descripción, selección múltiple de permisos.
**Acciones:** Crear, Editar, Eliminar, Asignar usuarios.

### 11.3 Permisos
**Path:** `/permissions`

Catálogo de permisos del sistema con análisis de impacto. **Grid:** Código, Nombre, Módulo, Usuarios afectados.
**Acciones:** Ver detalle con usuarios que tienen el permiso.

### 11.4 Auditoría
**Path:** `/system/audit`

**Grid:** Fecha/hora, Tabla, ID de registro, Operación (CREATE/UPDATE/DELETE), Valor anterior (JSON), Valor nuevo (JSON), Usuario.
**Filtro:** por nombre de tabla. Paginación manual. Visibilidad de columnas.

### 11.5 Logs de Acceso
**Path:** `/system/access`

**Grid:** Usuario, Timestamp, Acción, Éxito (sí/no), IP, Canal, Detalle.
**Acciones:** Ver usuario (dropdown). Solo lectura.

### 11.6 Categorías de Alertas
**Path:** `/system/alert-categories`

**Grid:** Ícono (Lucide), Nombre, Código (formato ^[A-Z0-9_]+$), Categoría interna, Cantidad de reglas, Activo.
**Formulario:** Código (requerido, mayúsculas), Nombre (max 100), Descripción (max 500), Ícono, Color (#RRGGBB), Orden (número), Activo.
**Acciones:** Crear, Editar, Eliminar (solo si no tiene reglas).

### 11.7 Reglas de Alertas
**Path:** `/system/alert-rules`

**Formulario:** Categoría (requerida), Código, Nombre, Descripción, Prioridad (LOW/MEDIUM/HIGH/CRITICAL), Tabla fuente, Campo ID de tabla, Campo ID de usuario, Días antes, Días después, Tipo de recurrencia (ONCE/DAILY/WEEKLY/MONTHLY), Auto-enviar email, Auto-enviar SMS, Plantilla email, Plantilla SMS, Activo.
**Acciones:** Crear, Editar, Eliminar, Activar/Desactivar.

### 11.8 Configuración de Alertas
**Path:** `/system/alerts-config`

Página tipo acordeón (no tabla) con secciones:
- **Scheduler:** habilitado (switch), hora de ejecución, zona horaria, botón "Ejecutar ahora".
- **Email:** proveedor (smtp/sendgrid/ses), servidor, puerto, usuario, contraseña, email remitente, botón "Enviar prueba".
- **SMS:** habilitado, proveedor (twilio/nexmo), API key, API secret, número remitente, botón "Enviar prueba".
- **Retención:** días para alertas, logs de comunicación, logs de ejecución.

### 11.9 Plantillas de Comunicación
**Path:** `/system/communication-templates`

**Grid:** Nombre, Tipo (EMAIL/SMS/DOCUMENT/WHATSAPP), Versión, Categoría, Activo.
**Formulario:** Código, Nombre, Tipo, Categoría, Asunto, Cuerpo HTML, Cuerpo texto, Variables schema, Remitente default, Config adjuntos, Activo.
**Características especiales:** toolbar de formato (negrita/cursiva/lista), inserción de variables dinámicas ({{paciente.nombre}}, {{clinica.nombre}}, etc.), vista previa con variables resaltadas.
**Acciones:** Crear, Editar, Duplicar, Previsualizar, Eliminar.

### 11.10 Historial de Comunicaciones
**Path:** `/system/communication-history`

**Grid:** Fecha envío, Canal (badge), Destinatario, Título, Estado (badge), ID alerta, Notas.
**Acciones:** Ver notas (diálogo). Solo lectura. Paginación 50/página.

### 11.11 Configuración del Sistema
**Path:** `/system/config`

**Grid:** ID, Clave, Valor, Descripción, Tipo de dato (string/number/boolean/json), Público, Actualizado por.
**Formulario:** Clave (requerida), Valor (requerido), Descripción, Tipo de dato, Es público.
**Acciones:** Crear, Editar (upsert), Eliminar.

### 11.12 Errores del Sistema
**Path:** `/system/errors`

**Grid:** Fecha, Severidad, Mensaje, Canal, Usuario. Paginación. Solo lectura.

### 11.13 Historial de Ejecución
**Path:** `/system/execution-history`

**Grid:** Estado, Inicio, Fin, Total alertas, Exitosas, Fallidas.
**Acciones:** Ver detalle (diálogo, requiere permiso). Paginación.

### 11.14 Configuración de Notificaciones
**Path:** `/system/notification-settings`

Interfaz de matriz: filas = categorías, columnas = plataformas (Email, SMS, WhatsApp). Celdas = checkboxes para habilitar/deshabilitar. Switch maestro global. Guardado masivo.

### 11.15 Importación de Datos
**Path:** `/system/import`

Wizard de importación de datos masivos. Carga de archivos con validación.

---

## MÓDULO 12 — PANTALLA TV
**Path:** `/tv-display`

### Configuración (SettingsForm)
- Consultorios a mostrar (multi-select de calendarios).
- Tema (oscuro/claro/branded).
- Reloj y fecha en encabezado (switch).
- Datos del paciente visibles: nombre, médico, hora del turno, próximo paciente.
- Información de la clínica: teléfono, dirección, email (switches).
- Videos de promoción (URLs de video/YouTube, en bucle).
- Columna de videos lateral (izquierda/derecha/arriba/abajo/ninguna).
- Intervalo de actualización (minutos).

### Vista previa en tiempo real
Refleja todos los cambios de configuración antes de encender la pantalla.

### Controles de la pantalla encendida
- **Encender pantalla:** abre nueva ventana fullscreen (para arrastrar al monitor secundario).
- **Siguiente paciente por consultorio:** botón por cada consultorio activo — muestra tarjeta de anuncio y avanza el turno.
- **Pausar:** congela visualización con overlay "PAUSADO".
- **Mostrar promoción:** activa videos de promo en pantalla completa.
- **Actualizar datos:** fuerza recarga inmediata.
- **Apagar:** overlay "APAGADO".

### Widget flotante (indicador)
- Verde = pantalla encendida, Rojo = apagada. Visible desde cualquier pantalla del sistema.

---

## MÓDULO 13 — ESTUDIOS MÉDICOS
**Path:** `/studies`

Visor DICOM integrado vía iframe. Permite subir, visualizar y gestionar radiografías y tomografías en formato DICOM. Herramientas: ajuste de brillo/contraste, zoom, series de imágenes.

**Path estudios compartidos:** `/shared-studies`
Permite compartir estudios con pacientes via enlace externo.

---

## FLUJOS COMPLETOS

### Flujo de Venta Completo
1. **Crear presupuesto** → `/sales/quotes` → Nuevo presupuesto → agregar paciente e ítems → Guardar (borrador) → Cambiar estado a "Enviado".
2. **Aceptar presupuesto** → Cambiar estado a "Aceptado" → "Convertir a Orden" → aparece en `/sales/orders`.
3. **Completar ítems** → `/sales/orders` → abrir orden → en cada ítem hacer clic en COMPLETAR → registrar sesión clínica.
4. **Generar factura** → "Convertir a Factura" → aparece en `/sales/invoices` como "Pendiente de pago".
5. **Registrar pago** → abrir factura → "Registrar pago" → ingresar monto, fecha, método → Guardar.

### Flujo de Caja Diario
1. **Apertura:** `/cashier` → Abrir sesión → contar denominaciones UYU/USD → Confirmar apertura.
2. **Durante el día:** los pagos de facturas y transacciones misceláneas se registran automáticamente.
3. **Cierre:** Cerrar sesión → contar denominaciones reales → Confirmar cierre → imprimir resumen.

### Flujo de Citas
1. **Crear cita:** `/appointments` → clic en franja horaria o botón + → completar paciente, médico, servicio → Guardar.
2. **Atender paciente:** clic en la cita → Registrar sesión → completar procedimientos → Confirmar (la cita pasa a "Completada").
3. **Facturar:** desde la orden vinculada → Completar ítem → Convertir a factura.

---

## VALIDACIONES GENERALES

| Campo | Regla |
|-------|-------|
| Email | Formato `^[^\s@]+@[^\s@]+\.[^\s@]+$` |
| Teléfono | Formato internacional (libphonenumber-js) |
| Documento de identidad | Solo dígitos, máximo 10 caracteres |
| Color | Formato `#RRGGBB` (hexadecimal 6 dígitos) |
| Precio/Monto | Número positivo, múltiplo de 0.01 |
| Tipo de cambio | Número positivo, mínimo 0.0001 |
| Paciente/Usuario | Debe tener al menos email O teléfono |
| Código de categoría alerta | Solo mayúsculas, dígitos y guión bajo `^[A-Z0-9_]+$` |
| Pieza dental | Número entre 11 y 85 |

---

## MONEDAS SOPORTADAS
- **UYU** — Pesos Uruguayos (moneda base)
- **USD** — Dólares Americanos
- **URU** — (alias interno)

El sistema convierte automáticamente usando el tipo de cambio configurado en `/config/currencies`.

---

## SISTEMA DE PERMISOS

Todos los módulos están protegidos por roles y permisos. Los permisos se asignan a roles en `/roles` y los roles a usuarios en `/system/users`. La UI oculta automáticamente botones y secciones para los que el usuario no tiene permiso. Los permisos siguen el patrón `MODULO_ACCION` (ej. `SALES_QUOTES_CREATE`, `CASHIER_OPEN_SESSION`).
