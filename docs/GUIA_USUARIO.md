# Guía de Usuario - InvokeAI Command Center

## 1. Introducción
InvokeAI Command Center es una plataforma integral de gestión clínica y administrativa diseñada para optimizar los flujos de trabajo de salud, ventas y finanzas. Este documento detalla todas las operaciones del sistema, sus dependencias y requisitos.

---

## 2. Acceso y Seguridad
El sistema implementa un modelo de seguridad robusto basado en roles para proteger la información sensible de los pacientes y los datos financieros.

### 2.1 Autenticación y Control de Acceso
*   **Inicio de Sesión:** Acceso restringido mediante credenciales únicas.
*   **Roles y Permisos:** Los usuarios (Doctores, Administrativos, Gerentes) tienen acceso limitado según su rol. Los permisos se definen a nivel de recurso (ej. "Ver Facturas", "Editar Historial Clínico").
*   **Gestión de Contraseñas:** El sistema permite la recuperación vía email y el cambio de contraseña desde el perfil de usuario. Para nuevos usuarios, se pueden generar tokens de "Primera Contraseña".

### 2.2 Auditoría y Trazabilidad (Compliance)
*   **Registro de Auditoría (Audit Log):** Graba cada cambio realizado en los registros (valor anterior, valor nuevo, autor y fecha).
*   **Registro de Acceso (Access Log):** Monitoreo de cada intento de inicio de sesión, incluyendo IP y canal.
*   **Registro de Errores:** Captura técnica de fallos para soporte proactivo.

---

## 3. Panel de Control (Dashboard)
El Dashboard ofrece una visión de 360° del estado del negocio mediante indicadores clave (KPIs) procesados en tiempo real.

### 3.1 Indicadores en Tiempo Real (KPIs)
*   **Resumen Financiero:** Ingresos totales del período y crecimiento porcentual comparado con el mes anterior.
*   **Métricas Clínicas:** Tasa de asistencia a citas (Show Rate) y facturación promedio por paciente.
*   **Conversión:** Tasa de transformación de presupuestos en ventas efectivas.

### 3.2 Gráficos de Análisis
*   **Tendencia de Ventas:** Evolución de los ingresos mes a mes.
*   **Ventas por Servicio:** Identificación de los tratamientos o productos más demandados.
*   **Estado de Facturación:** Resumen visual de facturas pagadas, pendientes y vencidas.

---

## 4. Gestión de Pacientes y Citas

### 4.1 Pacientes
*   **Registro:** Requiere Nombre, Documento de Identidad, Email y Teléfono.
*   **Historia Clínica:** Centraliza la ficha médica del paciente.
    *   **Anamnesis:** Antecedentes personales, familiares, alergias y medicación actual.
    *   **Odontograma:** Representación gráfica dental basada en la norma ISO 3950. Permite registrar hallazgos (caries, coronas, etc.) en superficies específicas de cada pieza.
    *   **Documentos y Estudios:** Gestión de archivos adjuntos y visor DICOM integrado para radiografías y tomografías.
    *   **Línea de Tiempo:** Historial cronológico de todas las intervenciones y sesiones.

### 4.2 Citas (Appointments)
*   **Pre-requisitos:** El paciente, el servicio, el doctor y el calendario deben estar creados previamente.
*   **Flujo de Reserva:** 
    1.  Selección de fecha y hora.
    2.  Verificación automática de disponibilidad (cruza horario del doctor, feriados y citas existentes).
    3.  **Sugerencias Inteligentes:** Si hay conflicto, el sistema ofrece alternativas basadas en los huecos libres en la agenda del doctor.

---

## 5. Ciclo de Ventas: De la Propuesta al Cobro

### 5.1 Presupuestos (Quotes)
*   **Propósito:** Documentar la propuesta comercial inicial.
*   **Confirmación:** Al marcar un presupuesto como **Confirmado**, el sistema genera automáticamente una **Orden de Venta** vinculada, heredando todos los ítems y precios.

### 5.2 Órdenes y Planificación (Orders)
*   **Gestión de Ítems:** Las líneas de la orden representan los servicios comprometidos.
*   **Planificación:** Desde la orden, el usuario puede asignar fecha y hora a cada servicio en la agenda médica.
*   **Ejecución:** Una vez realizado el procedimiento, el ítem se marca como **Completado**. Solo los ítems completados son elegibles para facturación.

### 5.3 Facturación (Invoices)
*   **Generación:** Se crean facturas desde órdenes (basadas en ítems completados) o de forma independiente para ventas directas.
*   **Estados:** Los documentos transitan por: *Borrador* (editable), *Contabilizado/Enviado* y *Pagado*.

### 5.4 Pagos y Créditos (Payments)
*   **Flexibilidad:** Registro de pagos parciales o totales. El sistema permite aplicar pagos en diferentes momentos asociados a una misma factura.
*   **Prepagos:** Registro de dinero a cuenta de un cliente sin factura previa ("Saldo Disponible").
*   **Notas de Crédito:** Generación de créditos por devoluciones que alimentan el saldo a favor del cliente.

---

## 6. Ciclo de Compras y Carga por IA

### 6.1 Carga Automática (IA Import)
*   **Importación Inteligente:** Permite subir archivos **PDF o fotografías** de facturas de proveedores.
*   **Procesamiento GenAI:** Mediante Genkit, el sistema extrae automáticamente proveedor, fecha, número de documento, ítems, impuestos y totales, eliminando la entrada manual de datos.

### 6.2 Catálogo de Proveedores
*   Gestión de entidades proveedoras y servicios de compra para mantener el control de costos operativos.

---

## 7. Gestión de Caja (Cashier)

### 7.1 Widget de Estado Permanente
*   En la barra superior, un widget dinámico muestra el saldo actual en **UYU y USD** basado en las transacciones registradas, permitiendo conocer la liquidez inmediata.

### 7.2 Flujo de Cierre (Arqueo Paso a Paso)
1.  **Revisión de Movimientos:** Confirmación de todos los ingresos y egresos del día.
2.  **Conteo Físico:** Ingreso de cantidad de billetes y monedas por denominación.
3.  **Declaración de Depósito:** Registro de dinero retirado de la caja para depósito bancario.
4.  **Análisis de Diferencias:** Comparación automática entre el **Total Teórico** (Apertura + Entradas - Salidas) y el **Declarado**. En caso de discrepancias, se requiere una justificación obligatoria.

---

## 8. Configuración de Negocio (Administración)

### 8.1 Detalles de la Clínica
*   Configuración de nombre, logo (para reportes PDF), dirección y moneda base de operación.

### 8.2 Horarios y Feriados
*   **Schedules:** Definición del horario general de atención de la clínica.
*   **Holidays:** Días de cierre que bloquean automáticamente la agenda de citas.

### 8.3 Doctores y Disponibilidad
*   Gestión de profesionales y asignación de sus servicios específicos.
*   **Reglas de Disponibilidad:** Configuración de horarios recurrentes por doctor.
*   **Excepciones:** Días específicos donde un doctor no estará disponible a pesar de su regla recurrente.

### 8.4 Secuencias
*   Define el formato de numeración de documentos (ej. `FAC-{YYYY}-{COUNTER:4}`). Soporta reinicio automático anual, mensual o diario para mantener la correlatividad legal.

### 8.5 Monedas y Tasa de Cambio
*   **Sincronización:** Consulta de indicadores oficiales. Al abrir la caja, se fija la tasa de la sesión para garantizar la consistencia en todas las conversiones de esa jornada.

---

## 9. Administración del Sistema y Alertas

### 9.1 Usuarios y Permisos
*   Gestión de acceso mediante la triada **Usuario - Rol - Permiso**. Un usuario puede tener múltiples roles para cubrir diversas funciones operativas.

### 9.2 Motor de Alertas
*   **Reglas de Automatización:** Consultas dinámicas para detectar eventos (ej. "Facturas vencidas hace más de 5 días").
*   **Plantillas de Comunicación:** Diseñador de mensajes con variables dinámicas (ej. `{{patient.full_name}}`) para envíos automáticos por Email, SMS o WhatsApp.
