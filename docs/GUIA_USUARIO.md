# Guía de Usuario - InvokeAI Command Center

## 1. Introducción
InvokeAI Command Center es una plataforma integral de gestión clínica y administrativa diseñada para optimizar los flujos de trabajo de salud, ventas y finanzas. Este documento detalla todas las operaciones del sistema, sus dependencias y requisitos.

---

## 2. Panel de Control (Dashboard)
El Dashboard es la pantalla de aterrizaje principal y ofrece una visión de 360° del estado del negocio.

### 2.1 Indicadores en Tiempo Real (KPIs)
*   **Resumen Financiero:** Muestra ingresos totales, crecimiento comparado con el mes anterior y tasa de conversión de presupuestos.
*   **Métricas Clínicas:** Visualiza la tasa de asistencia a citas (Show Rate) y la facturación promedio por paciente.
*   **Demografía:** Gráficos circulares que diferencian entre pacientes nuevos y recurrentes.

### 2.2 Gráficos de Análisis
*   **Tendencia de Ventas:** Línea de tiempo que muestra la evolución de los ingresos.
*   **Ventas por Servicio:** Identifica qué tratamientos o productos son los más demandados.
*   **Estado de Facturación:** Resumen visual de facturas cobradas, pendientes y vencidas.

---

## 3. Ciclo de Ventas: De la Propuesta al Cobro
El sistema gestiona un flujo documental completo que garantiza la trazabilidad de cada centavo y cada servicio.

### 3.1 Presupuestos (Quotes)
*   **Propósito:** Documentar la propuesta comercial para el paciente.
*   **Requisito:** El paciente y los servicios deben existir en el catálogo.
*   **Conversión Automática:** Al marcar un presupuesto como **Confirmado**, el sistema genera automáticamente una **Orden de Venta** vinculada.

### 3.2 Órdenes y Planificación (Orders)
*   **Gestión de Ítems:** Las líneas de la orden representan los compromisos adquiridos.
*   **Calendario:** Desde la vista de ítems de la orden, el usuario puede **Planificar** cada servicio asignándole una fecha y hora en la agenda médica.
*   **Ejecución:** Una vez realizado el procedimiento, el ítem se marca como **Completado**. Solo los ítems completados son elegibles para ser facturados masivamente.

### 3.3 Facturación (Invoices)
*   **Generación:** Se pueden crear facturas desde una orden (basadas en ítems completados) o de forma **Independiente** para ventas directas en mostrador.
*   **Estados:** Los documentos transitan por estados: *Borrador* (editable), *Enviada* (contabilizada) y *Pagada*.

### 3.4 Pagos y Créditos (Payments)
*   **Flexibilidad de Cobro:** Permite registrar pagos parciales o totales asociados a una o varias facturas.
*   **Prepagos:** Los pacientes pueden realizar entregas de dinero a cuenta (prepago) que quedan como saldo a favor para futuras facturas.
*   **Créditos por Devoluciones:** En caso de cancelaciones o errores, el sistema permite generar Notas de Crédito que alimentan el "Saldo Disponible" del cliente.

---

## 4. Ciclo de Compras y Carga por IA
Gestión eficiente de la relación con proveedores y gastos operativos.

### 4.1 Carga Automática (IA Import)
*   **Importación Inteligente:** El sistema permite subir archivos **PDF o fotografías** de facturas de proveedores.
*   **Procesamiento:** Mediante GenAI (Genkit), el sistema extrae automáticamente el proveedor, fecha, número de documento, ítems, impuestos y totales, eliminando la necesidad de entrada manual de datos.
*   **Validación:** El usuario solo debe revisar los datos extraídos y confirmar la creación del documento en el sistema.

---

## 5. Gestión de Caja (Cashier)
Es el núcleo financiero diario. Todas las transacciones de efectivo deben ocurrir dentro de una sesión.

### 5.1 Widget de Estado Permanente
*   En la barra superior del sistema, se muestra un widget dinámico con el saldo actual en **UYU y USD**. 
*   Este valor se actualiza en tiempo real con cada ingreso (pagos, ventas) o egreso (gastos misceláneos) registrado.

### 5.2 Flujo de Cierre (Arqueo Paso a Paso)
El cierre de caja es un proceso guiado para asegurar que no existan discrepancias:
1.  **Revisión de Movimientos:** El sistema presenta una lista de todas las transacciones del día para confirmación visual.
2.  **Conteo Físico (UYU/USD):** El usuario ingresa la cantidad de billetes y monedas por cada denominación.
3.  **Declaración de Depósito:** Registro opcional de dinero retirado de la caja para ser depositado en el banco (permite adjuntar el comprobante de depósito).
4.  **Análisis de Diferencias:** El sistema compara el **Total Teórico** (Apertura + Entradas - Salidas) contra el **Declarado**.
5.  **Conciliación:** Si existen diferencias (faltantes o sobrantes), el sistema solicita una justificación antes de generar el reporte final en PDF.

---

## 6. Flexibilidad y Operaciones Independientes
Aunque el sistema promueve flujos ordenados (Presupuesto -> Orden -> Factura), permite total libertad:
*   Crear una **Factura** directamente sin presupuesto previo.
*   Generar una **Orden** manual para servicios recurrentes.
*   Registrar **Gastos Misceláneos** (limpieza, papelería) directamente asociados a la sesión de caja sin pasar por el módulo de compras.

---

## 7. Configuración del Motor de Alertas
El sistema utiliza un motor de reglas para automatizar notificaciones.

### 7.1 Categorías y Reglas
*   **Categorías:** Grupos lógicos (Citas, Cobranzas, Cumpleaños) con iconos y colores distintivos.
*   **Reglas:** Consultas dinámicas sobre las tablas del sistema (ej. "Facturas vencidas hace más de 5 días").
*   **Plantillas:** Diseñador de mensajes con variables dinámicas como `{{patient.full_name}}`.

---

## 8. Datos Financieros y Tasa de Cambio
*   **Sincronización:** El sistema consulta indicadores oficiales (BROU/BCU).
*   **Consistencia:** Al abrir la caja, se fija la tasa de la sesión. Todos los cálculos de conversión de esa jornada (ej. pagar una factura en USD con Pesos) usarán esa tasa para garantizar que el arqueo final sea exacto.
