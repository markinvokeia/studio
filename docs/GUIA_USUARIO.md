# Guía de Usuario - InvokeAI Command Center

## 1. Introducción
InvokeAI Command Center es una plataforma integral de gestión clínica y administrativa diseñada para optimizar los flujos de trabajo de salud, ventas y finanzas. Este documento detalla todas las operaciones del sistema, sus dependencias y requisitos.

---

## 2. Acceso y Seguridad

### 2.1 Inicio de Sesión (Login)
*   **Ruta:** `/login`
*   **Requisitos:** Correo electrónico y contraseña válidos.
*   **Validaciones:** 
    *   Credenciales correctas.
    *   Cuenta de usuario activa.
*   **Flujo:** Tras un inicio de sesión exitoso, el sistema verifica si el usuario tiene una **Sesión de Caja** activa. Si la tiene, se muestra un widget de estado en la cabecera.

### 2.2 Gestión de Contraseña
*   **Recuperación:** Desde la pantalla de login, el usuario puede solicitar un correo de recuperación.
*   **Primer Acceso:** Los administradores pueden enviar un "Token de Contraseña Inicial" a nuevos usuarios desde el panel de gestión de usuarios.
*   **Cambio de Contraseña:** Disponible en el menú de usuario (esquina superior derecha). Requiere la contraseña actual y una nueva que cumpla con:
    *   Mínimo 8 caracteres.
    *   Al menos una mayúscula.
    *   Al menos un número.

---

## 3. Centro de Alertas
El sistema utiliza un motor de reglas para automatizar notificaciones y recordatorios.

### 3.1 Gestión de Alertas
*   **Ruta:** `/alerts`
*   **Funcionamiento:** Muestra alertas pendientes agrupadas por categoría (Citas, Facturación, etc.).
*   **Acciones:**
    *   **Marcar como Completada:** Finaliza el ciclo de la alerta.
    *   **Pausar (Snooze):** Permite ocultar la alerta hasta una fecha futura (ej. 1 día, 1 semana).
    *   **Ignorar:** Descarta la alerta solicitando un motivo.
    *   **Comunicación Directa:** Permite enviar Email, SMS o WhatsApp basados en plantillas predefinidas.

### 3.2 Configuración del Motor de Alertas (Administrador)
*   **Categorías de Alerta:** Definen el grupo y el color/icono visual.
*   **Reglas de Alerta:**
    *   **Pre-requisito:** Existencia de tablas en la base de datos y plantillas de comunicación.
    *   **Configuración:** Se define una tabla origen, un campo de ID, un campo de Usuario y condiciones lógicas (ej. `dias_antes = 1` para recordatorios de citas).
*   **Plantillas:** Permiten usar variables dinámicas como `{{patient.full_name}}` o `{{appointment.time}}`.
*   **Programador (Scheduler):** Se configura para ejecutarse automáticamente (típicamente de noche) para procesar todas las reglas y generar las alertas del día siguiente.

---

## 4. Gestión de Caja (Cashier)
Es el núcleo financiero diario. **Importante:** La mayoría de las operaciones de pago requieren una sesión de caja abierta.

### 4.1 Apertura de Sesión
*   **Ruta:** `/cashier`
*   **Pre-requisitos:** Existencia de un Punto de Caja (Caja Registradora Física).
*   **Flujo de Apertura:**
    1.  **Tasa de Cambio:** El sistema consulta automáticamente las cotizaciones (BROU/BCU). El usuario puede ajustarla manualmente. Esta tasa será la base para todas las conversiones de moneda de la sesión.
    2.  **Arqueo Inicial:** El usuario debe contar el efectivo físico (billetes y monedas) en UYU y USD.
    3.  **Confirmación:** Se registra el monto de apertura y la sesión queda vinculada al usuario.

### 4.2 Operaciones Diarias
*   **Transacciones Misceláneas:** Registro de gastos o ingresos que no provienen de facturas (ej. limpieza, papelería). Requiere una **Categoría Miscelánea** previa.
*   **Pagos de Facturas:** Se vinculan automáticamente a la sesión activa del usuario que recibe el dinero.

### 4.3 Cierre de Sesión (Arqueo)
*   **Flujo de Cierre:**
    1.  **Revisión:** Verificación de todos los movimientos del día.
    2.  **Conteo Final:** Registro del efectivo físico al final del día.
    3.  **Declaración de Depósito:** Si se retira dinero para depositar en el banco, se declara aquí (opcional adjuntar comprobante).
    4.  **Conciliación:** El sistema compara el "Total Teórico" (Apertura + Ingresos - Egresos) contra el "Total Declarado". Muestra las diferencias (faltantes o sobrantes).
    5.  **Reporte:** Generación de PDF de cierre.

---

## 5. Gestión de Pacientes y Clínica

### 5.1 Pacientes
*   **Registro:** Requiere Nombre, Documento, Email y Teléfono.
*   **Historia Clínica:** Centraliza Anamnesis, Odontograma, Documentos y Línea de Tiempo.
*   **Odontograma:** Representación gráfica dental (ISO 3950). Permite registrar hallazgos (Caries, Coronas, etc.) en superficies específicas.
*   **Estudios:** Visor DICOM integrado para radiografías y tomografías.

### 5.2 Citas (Appointments)
*   **Pre-requisitos:** Paciente, Servicio, Doctor, Calendario y Horario del Doctor.
*   **Flujo:** 
    1.  Selección de fecha/hora.
    2.  Verificación de disponibilidad automática. 
    3.  Si hay conflicto, el sistema ofrece sugerencias basadas en la agenda del doctor.

---

## 6. Ciclo de Ventas y Compras

### 6.1 Ventas (Flujo Estándar)
1.  **Presupuesto (Quote):** 
    *   **Pre-requisito:** Paciente y Servicios/Productos.
    *   **Validación:** El presupuesto debe ser aprobado antes de generar una orden.
2.  **Orden (Order):** Se genera al aceptar el presupuesto. Crea el compromiso de servicio.
3.  **Factura (Invoice):** Puede generarse desde la orden o importarse (PDF/Imagen) mediante IA.
4.  **Pago (Payment):**
    *   **Pre-requisito:** Sesión de caja abierta.
    *   **Flujo:** Se selecciona el método de pago (Efectivo, Tarjeta, Créditos del cliente). Si las monedas difieren, se aplica la tasa de cambio de la sesión de caja.

### 6.2 Compras
*   Mismo flujo que ventas pero orientado a **Proveedores** y productos de insumo clínico.

---

## 7. Configuración de Negocio (Administración)

### 7.1 Detalles de la Clínica
*   Configuración de nombre, logo (base64 para reportes), dirección y moneda base.

### 7.2 Horarios y Feriados
*   **Schedules:** Horario general de apertura.
*   **Holidays:** Días de cierre o excepción que bloquean la agenda de citas automáticamente.

### 7.3 Doctores y Disponibilidad
*   Cada doctor tiene sus propios servicios asignados.
*   **Disponibilidad:** Reglas recurrentes (ej. Lunes de 08:00 a 12:00).
*   **Excepciones:** Días específicos donde el doctor no estará disponible a pesar de la regla recurrente.

### 7.4 Secuencias
*   Define el formato de numeración de documentos (ej. `FAC-{YYYY}-{COUNTER:4}`).
*   Permite reinicio automático anual, mensual o diario.

---

## 8. Administración del Sistema

### 8.1 Usuarios, Roles y Permisos
*   Los **Roles** agrupan **Permisos**.
*   Los **Usuarios** pueden tener múltiples roles.
*   **Seguridad:** El sistema valida los permisos en cada acción de la UI y en las llamadas a la API.

### 8.2 Registros (Logs)
*   **Audit Log:** Historial de cambios en los datos (Quién cambió qué y cuándo).
*   **Access Log:** Registro de inicios de sesión y accesos.
*   **Error Log:** Registro técnico de fallos del sistema para soporte.

---

## 9. Datos Financieros y Tasa de Cambio
*   **Origen de la Tasa:** El sistema se sincroniza mediante webhooks con indicadores financieros oficiales. 
*   **Prioridad:** Prevalece la tasa definida en la **Apertura de Caja** para todas las transacciones de esa sesión, garantizando que el arqueo final sea consistente.
