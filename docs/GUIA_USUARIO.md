# Guía de Usuario - InvokeAI Command Center

## 1. Introducción
InvokeAI Command Center es una plataforma integral de gestión clínica y administrativa diseñada para optimizar los flujos de trabajo de salud, ventas y finanzas. Este documento detalla todas las operaciones del sistema, sus dependencias y requisitos.

---

## 2. Acceso y Seguridad
El sistema implementa un modelo de seguridad robusto basado en roles para proteger la información sensible de los pacientes y los datos financieros.

### 2.1 Autenticación y Control de Acceso
*   **Inicio de Sesión:** Acceso restringido mediante credenciales únicas. El sistema permite la recuperación de contraseña vía email.
*   **Roles y Permisos:** Los usuarios (Doctores, Administrativos, Gerentes) tienen acceso limitado según su rol. Los permisos se definen a nivel de recurso (ej. "Ver Facturas", "Editar Historial Clínico").
*   **Contraseñas Iniciales:** El administrador puede generar tokens de "Primera Contraseña" para nuevos usuarios, garantizando que el usuario defina su clave privada desde el primer ingreso.

### 2.2 Auditoría y Trazabilidad (Compliance)
*   **Registro de Auditoría (Audit Log):** El sistema graba cada cambio realizado en los registros (qué valor había antes, qué valor hay ahora, quién lo hizo y cuándo).
*   **Registro de Acceso (Access Log):** Monitoreo de cada intento de inicio de sesión, incluyendo IP y canal de acceso.
*   **Registro de Errores:** Captura técnica de fallos para soporte proactivo.

---

## 3. Panel de Control (Dashboard)
El Dashboard es el centro neurálgico del sistema, ofreciendo una visión de 360° del estado del negocio mediante indicadores clave (KPIs) procesados en tiempo real.

### 3.1 Indicadores en Tiempo Real (KPIs)
*   **Resumen Financiero:** Ingresos totales del período, crecimiento porcentual comparado con el mes anterior y tasa de conversión de presupuestos (de propuesta a venta efectiva).
*   **Métricas Clínicas:** Tasa de asistencia a citas (Show Rate) para medir el ausentismo y facturación promedio por paciente.
*   **Demografía:** Visualización segmentada entre pacientes nuevos y recurrentes para medir la fidelización.

### 3.2 Gráficos de Análisis
*   **Tendencia de Ventas:** Línea de tiempo que muestra la evolución de los ingresos mes a mes.
*   **Ventas por Servicio:** Gráfico de barras/progreso que identifica los tratamientos o productos más demandados.
*   **Estado de Facturación:** Resumen visual de facturas pagadas, pendientes y vencidas (Overdue).

---

## 4. Ciclo de Ventas: De la Propuesta al Cobro
El sistema gestiona un flujo documental completo que garantiza la trazabilidad de cada servicio prestado y cada centavo ingresado.

### 4.1 Presupuestos (Quotes)
*   **Propósito:** Documentar la propuesta comercial.
*   **Requisito:** El paciente y los servicios deben existir previamente en el catálogo.
*   **Conversión Automática:** Al marcar un presupuesto como **Confirmado**, el sistema genera automáticamente una **Orden de Venta** vinculada, heredando todos los ítems y precios.

### 4.2 Órdenes y Planificación (Orders)
*   **Gestión de Ítems:** Las líneas de la orden representan los compromisos adquiridos.
*   **Calendario:** Desde la vista de ítems de la orden, el usuario puede **Planificar** cada servicio asignándole una fecha y hora en la agenda médica.
*   **Ejecución:** Una vez realizado el procedimiento, el ítem se marca como **Completado**. Solo los ítems completados son elegibles para ser facturados masivamente o de forma selectiva.

### 4.3 Facturación (Invoices)
*   **Generación:** Se pueden crear facturas desde una orden (basadas en ítems completados) o de forma **Independiente** para ventas directas.
*   **Estados:** Los documentos transitan por estados: *Borrador* (editable), *Enviada* (contabilizada) y *Pagada*.
*   **Integración:** Cada factura refleja el saldo pendiente y los pagos ya aplicados.

### 4.4 Pagos y Créditos (Payments)
*   **Flexibilidad de Cobro:** Registro de pagos parciales o totales asociados a una factura.
*   **Prepagos:** Permite registrar dinero a cuenta de un cliente sin una factura previa, el cual queda como "Saldo Disponible".
*   **Notas de Crédito:** Generación de créditos por devoluciones o errores, que alimentan automáticamente el saldo a favor del cliente para futuras transacciones.

---

## 5. Ciclo de Compras y Carga por IA
Gestión eficiente de gastos operativos y relación con proveedores.

### 5.1 Carga Automática (IA Import)
*   **Importación Inteligente:** Sube archivos **PDF o fotografías** de facturas de proveedores.
*   **Procesamiento:** Mediante GenAI (Genkit), el sistema extrae automáticamente el proveedor, fecha, número de documento, ítems, impuestos y totales. 
*   **Optimización:** Elimina la entrada manual de datos, reduciendo errores y tiempos administrativos. El usuario solo valida y confirma la creación del documento.

### 5.2 Catálogo de Proveedores
*   Gestión de entidades proveedoras y productos específicos de compra para mantener un control de costos.

---

## 6. Gestión de Caja (Cashier)
Es el núcleo financiero diario. Todas las transacciones de efectivo deben ocurrir dentro de una sesión controlada.

### 6.1 Widget de Estado Permanente
*   En la barra superior, un widget dinámico muestra el saldo actual en **UYU y USD** basado en las transacciones registradas.
*   Permite a los cajeros y gerentes conocer la liquidez inmediata sin entrar a reportes complejos.

### 6.2 Flujo de Cierre (Arqueo Paso a Paso)
Proceso guiado para asegurar que no existan discrepancias:
1.  **Revisión de Movimientos:** Confirmación visual de todos los ingresos (pagos) y egresos del día.
2.  **Conteo Físico (UYU/USD):** Ingreso de cantidad de billetes y monedas por denominación.
3.  **Declaración de Depósito:** Registro de dinero retirado de la caja para depósito bancario (con opción de adjuntar comprobante).
4.  **Análisis de Diferencias:** El sistema compara el **Total Teórico** (Apertura + Entradas - Salidas) contra el **Declarado**.
5.  **Conciliación:** Si existen diferencias, se solicita una justificación obligatoria antes de emitir el reporte final.

---

## 7. Flexibilidad y Operaciones Independientes
Aunque el sistema promueve flujos ordenados, permite total libertad operativa:
*   Crear una **Factura** directamente sin presupuesto ni orden previa.
*   Registrar **Gastos Misceláneos** (ej. limpieza, papelería) asociados directamente a la sesión de caja.
*   Gestionar créditos y saldos a favor de forma manual para resolver disputas comerciales rápidamente.

---

## 8. Configuración del Motor de Alertas
Motor de reglas para automatizar la comunicación y seguimiento.

### 8.1 Categorías y Reglas
*   **Categorías:** Grupos lógicos (Citas, Cobranzas, Cumpleaños) con iconos y colores.
*   **Reglas:** Consultas dinámicas (ej. "Facturas vencidas hace más de 5 días").
*   **Plantillas:** Diseñador de mensajes con variables dinámicas como `{{patient.full_name}}` para Email, SMS o WhatsApp.

---

## 9. Datos Financieros y Tasa de Cambio
*   **Sincronización:** Consulta automática de indicadores oficiales (BROU/BCU).
*   **Consistencia:** Al abrir la caja, se fija la tasa de la sesión. Todos los cálculos de conversión de esa jornada usarán esa tasa para garantizar un arqueo exacto al final del día.
