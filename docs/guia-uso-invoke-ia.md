# Guía de Uso — Invoke IA

**Versión:** 3.2  
**Fecha:** Mayo 2026  
**Sistema:** Invoke IA — Gestión de Clínicas Odontológicas y de Salud

---

## Índice

1. [Módulo 0: Introducción al sistema](#módulo-0-introducción-al-sistema)
2. [Módulo 1: Primer acceso y configuración personal](#módulo-1-primer-acceso-y-configuración-personal)
   - [1.1 Iniciar sesión](#11-iniciar-sesión)
   - [1.2 Establecer primera contraseña](#12-establecer-primera-contraseña-usuarios-nuevos)
   - [1.3 Recuperar contraseña](#13-recuperar-contraseña-olvidada)
   - [1.4 Seleccionar idioma](#14-seleccionar-idioma)
   - [1.5 Menú de usuario y configuración personal](#15-menú-de-usuario-y-configuración-personal)
   - [1.6 Preferencias personales](#16-preferencias-personales)
3. [Módulo 2: Configuración inicial de la clínica](#módulo-2-configuración-inicial-de-la-clínica)
   - [2.1 Licencias y suscripción](#21-licencias-y-suscripción)
   - [2.2 Detalles de la clínica](#22-detalles-de-la-clínica)
   - [2.3 Monedas y tipos de cambio](#23-monedas-y-tipos-de-cambio)
   - [2.4 Secuencias de numeración](#24-secuencias-de-numeración)
   - [2.5 Horarios](#25-horarios)
   - [2.6 Feriados](#26-feriados)
   - [2.7 Calendarios](#27-calendarios)
   - [2.8 Sociedades Mutuales](#28-sociedades-mutuales)
   - [2.9 Plantillas de documentos](#29-plantillas-de-documentos)
4. [Módulo 3: Gestión de usuarios y permisos](#módulo-3-gestión-de-usuarios-y-permisos)
   - [3.1 Roles](#31-roles)
   - [3.2 Permisos](#32-permisos)
   - [3.3 Usuarios del sistema](#33-usuarios-del-sistema)
   - [3.4 Personal (Secretarias y Administración)](#34-personal-secretarias-y-administración)
5. [Módulo 4: Doctores y disponibilidad](#módulo-4-doctores-y-disponibilidad)
   - [4.1 Doctores](#41-doctores)
   - [4.2 Disponibilidad médica](#42-disponibilidad-médica)
   - [4.3 Excepciones de disponibilidad](#43-excepciones-de-disponibilidad)
6. [Módulo 5: Catálogos clínicos](#módulo-5-catálogos-clínicos)
   - [5.1 Padecimientos](#51-padecimientos)
   - [5.2 Medicamentos](#52-medicamentos)
   - [5.3 Condiciones dentales](#53-condiciones-dentales)
   - [5.4 Superficies dentales](#54-superficies-dentales)
7. [Módulo 6: Configuración de ventas](#módulo-6-configuración-de-ventas)
   - [6.1 Métodos de pago](#61-métodos-de-pago)
   - [6.2 Servicios y prestaciones](#62-servicios-y-prestaciones)
8. [Módulo 7: Configuración de alertas y comunicaciones](#módulo-7-configuración-de-alertas-y-comunicaciones)
   - [7.1 Configuración del sistema de alertas](#71-configuración-del-sistema-de-alertas)
   - [7.2 Categorías de alertas](#72-categorías-de-alertas)
   - [7.3 Reglas de alertas](#73-reglas-de-alertas)
   - [7.4 Plantillas de comunicación](#74-plantillas-de-comunicación)
   - [7.5 Configuración de notificaciones](#75-configuración-de-notificaciones)
9. [Módulo 8: Widget de acciones rápidas (panel derecho)](#módulo-8-widget-de-acciones-rápidas-panel-derecho)
10. [Módulo 8B: Dashboard](#módulo-8b-dashboard)
11. [Módulo 9: Pacientes e historial clínico](#módulo-9-pacientes-e-historial-clínico)
    - [9.1 Lista de pacientes](#91-lista-de-pacientes)
    - [9.2 Detalle del paciente](#92-detalle-del-paciente)
    - [9.3 Historia clínica — Sub-pestañas](#93-historia-clínica--sub-pestañas)
    - [9.4 Finanzas — Resumen y documentos](#94-finanzas--resumen-y-documentos)
    - [9.5 Odontograma](#95-odontograma)
12. [Módulo 9B: Cobro Rápido (Billing Wizard)](#módulo-9b-cobro-rápido-billing-wizard)
13. [Módulo 10: Agenda y turnos](#módulo-10-agenda-y-turnos)
14. [Módulo 11: Caja](#módulo-11-caja)
    - [11.1 Cajas registradoras físicas](#111-cajas-registradoras-físicas)
    - [11.2 Apertura de sesión de caja](#112-apertura-de-sesión-de-caja)
    - [11.3 Panel principal de caja](#113-panel-principal-de-caja)
    - [11.4 Categorías y transacciones misceláneas](#114-categorías-y-transacciones-misceláneas)
    - [11.5 Cierre de sesión de caja](#115-cierre-de-sesión-de-caja)
    - [11.6 Historial de sesiones](#116-historial-de-sesiones)
15. [Módulo 12: Ventas](#módulo-12-ventas)
    - [12.1 Presupuestos](#121-presupuestos)
    - [12.2 Facturas](#122-facturas)
    - [12.3 Pagos](#123-pagos)
16. [Módulo 13: Compras](#módulo-13-compras)
    - [13.1 Presupuestos de compra](#131-presupuestos-de-compra)
    - [13.2 Facturas de compra](#132-facturas-de-compra)
    - [13.3 Pagos de compra](#133-pagos-de-compra)
    - [13.4 Proveedores](#134-proveedores)
    - [13.5 Productos de proveedores](#135-productos-de-proveedores)
17. [Módulo 14: Centro de alertas](#módulo-14-centro-de-alertas)
18. [Módulo 15: Reportes](#módulo-15-reportes)
    - [15.1–15.4 Reportes de Caja e Ingresos](#reportes-de-caja)
    - [15.5–15.8 Reportes de Producción](#reportes-de-producción)
    - [15.9–15.11 Reportes de Pacientes](#reportes-de-pacientes)
    - [15.12–15.13 Reportes de Agenda](#reportes-de-agenda)
    - [15.14–15.17 Reportes de Ingresos](#reportes-de-ingresos)
    - [15.18 Reportes de Gastos](#reportes-de-gastos)
    - [15.19–15.20 Reportes de Gestión](#reportes-de-gestión)
19. [Módulo 16: TV Display](#módulo-16-tv-display)
20. [Módulo 17: Estudios DICOM](#módulo-17-estudios-dicom)
    - [17.1 Mis estudios](#171-mis-estudios)
    - [17.2 Estudios compartidos](#172-estudios-compartidos)
21. [Módulo 18: Mi Consultorio (Workspace del doctor)](#módulo-18-mi-consultorio-workspace-del-doctor)
22. [Módulo 19: Administración del sistema](#módulo-19-administración-del-sistema)
    - [19.1 Configuración del sistema](#191-configuración-del-sistema)
    - [19.2 Importar datos](#192-importar-datos)
    - [19.3 Log de auditoría](#193-log-de-auditoría)
    - [19.4 Log de accesos](#194-log-de-accesos)
    - [19.5 Log de errores](#195-log-de-errores)
    - [19.6 Historial de comunicaciones](#196-historial-de-comunicaciones)
    - [19.7 Historial de ejecuciones de alertas](#197-historial-de-ejecuciones-de-alertas)

---

## Módulo 0: Introducción al sistema

### ¿Qué es Invoke IA?

Invoke IA es un sistema de gestión integral diseñado específicamente para clínicas odontológicas y de salud. Su objetivo es centralizar en una sola plataforma web todo lo que la clínica necesita para operar: desde la atención al paciente y la agenda de turnos, hasta la facturación, compras, reportes de gestión y comunicaciones automáticas.

El sistema está pensado para que cada integrante del equipo —doctores, secretarias, administrativos— tenga exactamente las herramientas que necesita, sin complejidades innecesarias. Todo funciona desde el navegador, sin instalar nada, accesible desde cualquier computadora, notebook o tablet con conexión a internet.

#### Inteligencia Artificial integrada

Una de las características que distingue a Invoke IA es la incorporación de inteligencia artificial en los flujos de trabajo clínicos y administrativos. Esto se traduce en:

- **Asistente de voz**: dictá notas clínicas, registrá sesiones o emití instrucciones sin tocar el teclado, directamente desde el consultorio.
- **Sugerencias inteligentes**: el sistema aprende de los patrones de la clínica para agilizar el registro de diagnósticos, tratamientos y medicamentos.
- **Automatización de comunicaciones**: envío automático de recordatorios de turno, seguimiento post-consulta y alertas configurables sin intervención manual.
- **Análisis y reportes**: el sistema procesa los datos de la clínica y los presenta en dashboards claros, para que la dirección tome decisiones con información real y actualizada.

#### Flujos rápidos y eficientes

Invoke IA está diseñado para reducir el tiempo que el equipo dedica a tareas administrativas:

- **Cobro Rápido**: desde cualquier lugar del sistema, en dos clics se puede abrir un wizard que guía paso a paso para emitir una factura y registrar el pago al instante.
- **Panel de acciones rápidas**: visible siempre en el lateral derecho, concentra las funciones más usadas (caja, alertas, cobro, notas, asistente de voz) sin necesidad de navegar por el menú.
- **Mi Consultorio**: espacio de trabajo exclusivo para el doctor, donde gestiona su agenda del día, revisa pacientes próximos y accede a la historia clínica con un clic, desde el mismo lugar donde trabaja.
- **Agenda inteligente**: el sistema valida disponibilidad del doctor, sala y horario en tiempo real al agendar un turno, evitando solapamientos y errores.

#### Seguridad y control

Invoke IA fue construido con seguridad como principio central:

- **Acceso basado en roles y permisos**: cada usuario solo ve y puede hacer lo que su rol permite. Los permisos son configurables con granularidad fina por módulo y acción.
- **Log de auditoría completo**: cada acción en el sistema queda registrada con usuario, fecha y hora. El administrador puede auditar quién hizo qué y cuándo.
- **Log de accesos**: registro de todos los inicios y cierres de sesión para monitoreo de seguridad.
- **Sistema de licencias**: el acceso al sistema está controlado por licencia. La cantidad de doctores, secretarias y pacientes habilitados depende del plan contratado.
- **Sesiones de caja trazables**: cada sesión de caja requiere apertura y cierre explícito, con registro de saldos, movimientos y responsable.

---

### Cómo acceder al sistema

Invoke IA funciona directamente en el navegador web: no requiere instalación. La URL de acceso es proporcionada por el administrador de la clínica o por el equipo de Invoke IA al momento de la puesta en marcha.

**Navegadores compatibles** (versión más reciente): Google Chrome, Mozilla Firefox, Microsoft Edge y Safari.

> **Recomendación:** Utilizar Google Chrome o Microsoft Edge para la mejor experiencia. Algunas funciones avanzadas (como el asistente de voz y la impresión de documentos) están optimizadas para estos navegadores.

---

### Cómo está organizado este manual

Esta guía está estructurada en módulos que siguen el orden natural de uso del sistema, desde la configuración inicial hasta la operación diaria. Cada módulo incluye:

- **Para qué sirve**: el objetivo de la sección en términos concretos para la clínica.
- **Cómo acceder**: la ruta exacta en el menú y los permisos necesarios.
- **Pasos**: instrucciones detalladas en orden secuencial.
- **Tablas de referencia**: campos, opciones y valores disponibles.
- **Notas y advertencias**: comportamientos importantes o errores frecuentes a evitar.

Si sos nuevo en el sistema, se recomienda leer el manual en orden. Si ya usás el sistema y buscás algo específico, usá el índice al inicio del documento para ir directamente al módulo que necesitás.

---

### Roles principales

Los usuarios del sistema tienen uno o más roles asignados. El rol determina qué módulos son visibles en el menú y qué acciones están permitidas. Un usuario solo ve lo que su rol habilita.

| Rol | Responsabilidades principales |
|-----|-------------------------------|
| **Superadministrador** | Acceso total al sistema, incluyendo configuración de licencias y gestión avanzada. Generalmente es el equipo de Invoke IA. |
| **Administrador** | Configuración de la clínica, gestión de usuarios y roles, acceso a todos los reportes y módulos de operación. |
| **Doctor** | Agenda propia, historia clínica de sus pacientes, workspace de consultorio, odontograma y planes de tratamiento. |
| **Secretaria / Recepcionista** | Gestión de pacientes, agenda general, caja, ventas y comunicaciones con pacientes. |

> Los permisos dentro de cada rol son configurables. El administrador puede ajustarlos para adaptar el sistema a la forma de trabajar de cada clínica (ver Módulo 3).

---

### 🎬 Guión del video — Módulo 0: Introducción

**Duración estimada:** 3 minutos  
**Tono:** Bienvenida, motivacional, claro

[ESCENA 1 — Logo de Invoke IA en pantalla]  
"Bienvenidos a Invoke IA, el sistema de gestión integral para tu clínica. Esta guía te va a acompañar módulo a módulo para que puedas sacarle el máximo provecho al sistema desde el primer día."

[ESCENA 2 — Pantalla del sistema en uso: agenda, pacientes, dashboard]  
"Invoke IA centraliza todo lo que necesita tu clínica: la agenda de turnos, el historial clínico de cada paciente, la facturación y cobros, el control de caja, las compras, los reportes de gestión y las comunicaciones automáticas. Todo en un solo lugar, desde el navegador, sin instalar nada."

[ESCENA 3 — Asistente de voz y cobro rápido]  
"Pero Invoke IA va más allá de la gestión tradicional. Tiene inteligencia artificial integrada: podés dictar notas clínicas por voz en el consultorio, y el sistema procesa y registra todo. Las comunicaciones con los pacientes —recordatorios de turno, seguimiento post-consulta— se envían de forma automática. Y el Cobro Rápido permite facturar y cobrar en segundos desde cualquier lugar del sistema."

[ESCENA 4 — Panel de permisos y log de auditoría]  
"La seguridad es central en Invoke IA. Cada usuario tiene acceso solo a lo que su rol permite. Cada acción queda registrada en el log de auditoría. Y cada sesión de caja tiene apertura, cierre y trazabilidad completa."

[ESCENA 5 — Menú lateral con módulos]  
"El sistema está organizado en módulos: pacientes, agenda, caja, ventas, reportes y más. Lo que ves en el menú depende del rol de tu usuario. En los próximos módulos vamos a recorrer cada sección paso a paso, empezando por el primer acceso y la configuración inicial."

---

## Módulo 1: Primer acceso y configuración personal

> **Menú:** (acceso directo desde la URL del sistema — no requiere menú)  
> **URL:** `/login` · `/reset-password` · `/set-password`  
> **Permiso:** `PROFILE_CHANGE_PASSWORD` — Cambiar contraseña de perfil

### ¿Para qué sirve?

Este módulo cubre cómo iniciar sesión por primera vez, establecer la contraseña inicial, recuperar una contraseña olvidada y configurar las preferencias personales del usuario.

### 1.1 Iniciar sesión

> **URL:** `/login`

**Cómo acceder:** Abrir la URL del sistema en el navegador

> 📸 **Captura:** Pantalla de login con campos de correo y contraseña, selector de idioma ES/EN.

**Pasos:**
1. Ingresar el **Correo Electrónico** registrado en el sistema
2. Ingresar la **Contraseña**
3. Hacer clic en **Entrar**

**Si las credenciales son incorrectas:** El sistema muestra un mensaje de error. Verificar que el correo y la contraseña sean correctos.

**Si olvidó la contraseña:** Hacer clic en **¿Olvidó su contraseña?**, ingresar el correo electrónico y hacer clic en **Recuperar Contraseña**. Se recibirá un enlace por correo.

### 1.2 Establecer primera contraseña (usuarios nuevos)

> **URL:** `/set-password`

Cuando un administrador crea un usuario nuevo, el sistema envía un correo con un enlace para establecer la contraseña inicial.

**Pasos:**
1. Abrir el enlace recibido por correo
2. Ingresar la **Nueva contraseña** (mínimo 8 caracteres, una mayúscula, un número)
3. Confirmar la contraseña en **Confirmar nueva contraseña**
4. Hacer clic en **Establecer contraseña**

El sistema redirige automáticamente a la pantalla de inicio de sesión.

### 1.3 Recuperar contraseña olvidada

> **URL:** `/reset-password`

**Pasos:**
1. En la pantalla de inicio de sesión, hacer clic en **¿Olvidó su contraseña?**
2. Ingresar el **Correo Electrónico** de la cuenta
3. Hacer clic en **Recuperar Contraseña**
4. Revisar el correo y hacer clic en el enlace recibido
5. Ingresar la nueva contraseña y confirmarla
6. Hacer clic en **Establecer contraseña**

### 1.4 Seleccionar idioma

En la pantalla de inicio de sesión y en la de establecer contraseña, hay un selector de idioma (ES / EN) en la esquina superior. Al cambiar el idioma, la interfaz se adapta inmediatamente.

### 1.5 Menú de usuario y configuración personal

> **Menú:** Avatar del usuario (esquina inferior izquierda del menú lateral)  
> **Permiso:** `GLOBAL_CHANGE_THEME` — Cambiar tema | `GLOBAL_CHANGE_LANGUAGE` — Cambiar idioma

> 📸 **Captura:** Menú desplegable del usuario con opciones: Cambiar Contraseña, Preferencias, tema, densidad, idioma y Cerrar Sesión.

**Cómo acceder:** Hacer clic en el avatar del usuario en la esquina inferior izquierda del menú

El menú de usuario agrupa las opciones de cuenta, apariencia e idioma:

#### Opciones de cuenta

| Opción | Descripción |
|--------|-------------|
| **Cambiar Contraseña** | Abre un diálogo para cambiar la contraseña. Requiere la contraseña actual, la nueva contraseña y su confirmación. |
| **Preferencias** | Abre la página de preferencias de notificaciones y espacio de trabajo (ver sección 1.6). |
| **Cerrar Sesión** | Cierra la sesión del sistema. Si hay una sesión de caja abierta, el sistema avisa y ofrece ir a cerrarla primero o cerrar sesión de todos modos. |

#### Apariencia y densidad

| Opción | Valores |
|--------|---------|
| **Cambiar tema** | **Invoke** (tema morado corporativo), **Claro** (tema blanco), **Oscuro** (tema oscuro) |
| **Densidad de tabla** | **Cómoda** (filas más altas), **Normal** (estándar), **Compacta** (filas más ajustadas para ver más datos en pantalla) |

#### Idioma

| Opción | Descripción |
|--------|-------------|
| **Idioma** | Cambia el idioma de toda la interfaz entre **Español** y **English** |

---

### 1.6 Preferencias personales

> **Menú:** Menú de usuario → Preferencias  
> **URL:** `/preferences`  
> **Permiso:** `NOTIFICATION_SETTINGS_VIEW_MENU` — Ver configuración de notificaciones

> 📸 **Captura:** Página de Preferencias con secciones de Notificaciones (canales por categoría) y Espacio de trabajo (estilo de alertas).

**Cómo acceder:** Menú de usuario → **Preferencias** (o Menú lateral → **Preferencias**)

#### Sección: Notificaciones

Configura por qué canales y para qué categorías recibir comunicaciones:

| Categoría | Canales disponibles |
|-----------|---------------------|
| Facturación y Presupuestos | email, whatsapp, telegram |
| Seguridad y Acceso | email, whatsapp, telegram |
| Promociones y Comunicaciones | email, whatsapp, telegram |
| Citas | email, whatsapp, telegram |
| Todas las Categorías | email, whatsapp, telegram |

Para cada combinación de categoría y canal se puede activar o desactivar la recepción de mensajes. Hacer clic en **Guardar** para aplicar los cambios.

#### Sección: Espacio de trabajo (solo para doctores)

| Opción | Descripción |
|--------|-------------|
| **Estilo de alertas** | Elige cómo se muestran las alertas cuando una cita cambia de estado: **Modal** (ventana emergente que requiere interacción) o **Notificación** (banner discreto en esquina) |

---

### 🎬 Guión del video — Módulo 1: Primer acceso

**Duración estimada:** 3 minutos  
**Tono:** Paso a paso, claro

[ESCENA 1 — Pantalla de inicio de sesión]  
"Para entrar al sistema, abrís el navegador y vas a la URL de tu clínica. Ahí vas a ver la pantalla de inicio de sesión."

[ESCENA 2 — Llenar formulario de login]  
"Ingresás el correo electrónico que te dio el administrador y la contraseña. Hacés clic en Entrar."

[ESCENA 3 — Enlace en el correo]  
"Si es la primera vez que entrás, vas a recibir un correo con un enlace para establecer tu contraseña. Lo abrís y creás una contraseña con al menos 8 caracteres, una mayúscula y un número."

[ESCENA 4 — Recuperar contraseña]  
"Si olvidaste tu contraseña, hacés clic en '¿Olvidó su contraseña?', ingresás tu correo y te llega un enlace para restablecerla."

[ESCENA 5 — Preferencias]  
"Una vez adentro, podés configurar tus preferencias personales: qué notificaciones recibir y cómo se muestran las alertas si sos doctor."

---

## Módulo 2: Configuración inicial de la clínica

> **Importante:** Este módulo debe completarse antes de comenzar a operar. El orden recomendado es el que sigue esta guía.

### 2.1 Licencias y suscripción

> **Menú:** Sistema → Licencias  
> **URL:** `/system/licenses`  
> **Permiso:** `LICENSING_VIEW_MENU` — Ver menú de licencias

> 📸 **Captura:** Panel de licencias mostrando estado de la licencia activa, fechas de vigencia y límites contratados.

**Cómo acceder:** Menú lateral → **Sistema** → **Licencias**  
**Permiso requerido:** `LICENSING_VIEW_MENU` — Ver menú de licencias

Esta sección muestra el estado de la licencia activa y los límites contratados.

**Información que se muestra:**

| Campo | Descripción |
|-------|-------------|
| ID de Licencia | Identificador único de la licencia |
| Tipo | Monthly (mensual), Annual (anual) o Custom |
| Fecha de Inicio | Fecha desde la que es válida |
| Fecha de Fin | Fecha de vencimiento |
| Máx. Doctores | Cantidad máxima de doctores habilitados |
| Máx. Recepcionistas | Cantidad máxima de secretarias habilitadas |
| Máx. Admins | Cantidad máxima de administradores |
| Máx. Pacientes/Mes | Límite de nuevos pacientes por mes |
| Acceso IA | Nivel de acceso a funciones de inteligencia artificial |
| Emitida El | Fecha de emisión de la licencia |

> Si la licencia está próxima a vencer (menos de 30 días), el sistema muestra una advertencia. Contactar al equipo de Invoke IA para renovar.

Para ver el historial completo de suscripciones: Menú lateral → **Suscripciones**

---

### 2.2 Detalles de la clínica

> **Menú:** Configuración de Negocio → Detalles de la Clínica  
> **URL:** `/config/clinics`  
> **Permiso:** `CLINIC_DETAILS_VIEW` — Ver detalles de la clínica | `CLINIC_DETAILS_UPDATE` — Editar datos de la clínica

> 📸 **Captura:** Formulario de datos de la clínica con campo de logo, nombre, dirección, teléfono, RUT, email y moneda.

**Cómo acceder:** Menú lateral → **Configuración de Negocio** → **Detalles de la Clínica**

**Pasos:**
1. Completar o actualizar los campos del formulario
2. Para cargar el logo: hacer clic en el área de logo y seleccionar un archivo de imagen (máximo 1 MB)
3. Hacer clic en **Guardar**

**Campos del formulario:**

| Campo | Descripción | Requerido |
|-------|-------------|-----------|
| Logo | Imagen de la clínica (máx. 1 MB) | No |
| Nombre | Nombre oficial de la clínica | Sí |
| Dirección | Dirección física completa | No |
| Teléfono | Número de teléfono con código de país | No |
| RUT | Número de documento tributario (ej. 21234567-8) | No |
| Correo Electrónico | Email de contacto de la clínica | No |
| Moneda | Moneda principal (USD o UYU) | No |

---

### 2.3 Monedas y tipos de cambio

> **Menú:** Configuración de Negocio → Monedas y Tipos de Cambio  
> **URL:** `/config/currencies`  
> **Permiso:** `CURRENCIES_VIEW_LIST` — Ver lista de monedas | `GLOBAL_VIEW_EXCHANGE_RATE` — Ver tipo de cambio

> 📸 **Captura:** Lista de monedas con historial de tipos de cambio. Columnas: Fecha, Compra USD, Venta USD, Promedio.

**Cómo acceder:** Menú lateral → **Configuración de Negocio** → **Monedas y Tipos de Cambio**

Esta sección permite gestionar las monedas disponibles en el sistema y consultar el historial de tipos de cambio.

**Información mostrada:**
- **Moneda Base** configurada para la clínica
- **Historial de Tipos de Cambio** con columnas: Fecha, Compra USD, Venta USD, Promedio USD

**Filtros disponibles:**
- Fecha de Inicio y Fecha de Fin para filtrar el historial

**Para crear una nueva moneda:**
1. Hacer clic en el botón **Crear**
2. Completar los campos: Código (ej. USD), Nombre, Símbolo, ¿Es Moneda Base?
3. Hacer clic en **Crear**

---

### 2.4 Secuencias de numeración

> **Menú:** Configuración de Negocio → Secuencias  
> **URL:** `/config/sequences`  
> **Permiso:** `SEQUENCES_VIEW_LIST` — Ver lista de secuencias | `SEQUENCES_CREATE` — Crear secuencia | `SEQUENCES_UPDATE` — Editar secuencia

> 📸 **Captura:** Lista de secuencias definidas con columnas Nombre, Tipo de Documento, Patrón, Contador Actual y Estado.

**Cómo acceder:** Menú lateral → **Configuración de Negocio** → **Secuencias**

Las secuencias controlan la numeración automática de documentos (facturas, presupuestos, órdenes, pagos).

**Pasos para crear una secuencia:**
1. Hacer clic en **Crear**
2. Completar los campos:

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| Nombre de Secuencia | Nombre descriptivo | "Facturas 2026" |
| Tipo de Documento | Factura, Presupuesto, Orden, Pago | Factura |
| Patrón | Formato de numeración con variables | `FAC-{YYYY}-{MM}-{COUNTER:4}` |
| Contador Actual | Número desde donde empieza | 1 |
| Período de Reinicio | Cuándo se resetea el contador | Anual, Mensual, Nunca |
| Activo | Si está habilitada | Sí |

**Variables disponibles para el patrón:**
- `{YYYY}` — año de 4 dígitos
- `{MM}` — mes de 2 dígitos
- `{DD}` — día de 2 dígitos
- `{COUNTER:N}` — contador con N dígitos (ej. `{COUNTER:4}` genera 0001, 0002...)

Al ingresar el patrón, el sistema muestra una **Vista Previa** del número que se generará.

---

### 2.5 Horarios

> **Menú:** Configuración de Negocio → Horarios  
> **URL:** `/config/schedules`  
> **Permiso:** `SCHEDULES_VIEW_LIST` — Ver lista de horarios | `SCHEDULES_CREATE` — Crear horario

> 📸 **Captura:** Lista de horarios con columnas Día de la Semana, Hora de Inicio, Hora de Fin y acciones editar/eliminar.

**Cómo acceder:** Menú lateral → **Configuración de Negocio** → **Horarios**

Los horarios definen los días y horas de atención estándar de la clínica. Se usan como referencia para configurar la disponibilidad de doctores.

**Pasos para crear un horario:**
1. Hacer clic en **Crear**
2. Seleccionar el **Día de la Semana** (Lunes a Domingo)
3. Ingresar la **Hora de Inicio** (ej. 08:00)
4. Ingresar la **Hora de Fin** (ej. 18:00)
5. Hacer clic en **Guardar**

Se pueden crear múltiples horarios para diferentes días. Para editar o eliminar, usar los íconos de acción en cada fila.

---

### 2.6 Feriados

> **Menú:** Configuración de Negocio → Días Feriados  
> **URL:** `/config/holidays`  
> **Permiso:** `HOLIDAYS_VIEW_LIST` — Ver lista de feriados | `HOLIDAYS_CREATE` — Crear feriado

> 📸 **Captura:** Lista de feriados con fecha, estado (abierto/cerrado) y horario especial si aplica.

**Cómo acceder:** Menú lateral → **Configuración de Negocio** → **Días Feriados**

Los feriados bloquean la disponibilidad de turnos en las fechas configuradas.

**Pasos para crear un feriado:**
1. Hacer clic en **Crear**
2. Completar los campos:

| Campo | Descripción | Requerido |
|-------|-------------|-----------|
| Fecha | Fecha del feriado | Sí |
| ¿Está Abierto? | Si la clínica atiende ese día | No |
| Hora de Inicio | Si atiende con horario especial | No |
| Hora de Fin | Hora de cierre especial | No |
| Notas | Observaciones adicionales | No |

3. Hacer clic en **Guardar**

---

### 2.7 Calendarios

> **Menú:** Configuración de Negocio → Calendarios  
> **URL:** `/config/calendars`  
> **Permiso:** `CALENDARS_VIEW_LIST` — Ver lista de calendarios | `CALENDARS_CREATE` — Crear calendario

> 📸 **Captura:** Lista de calendarios (consultorios) con nombre, color y estado activo/inactivo.

**Cómo acceder:** Menú lateral → **Configuración de Negocio** → **Calendarios**

Los calendarios representan los consultorios o salas de atención. Cada turno en la agenda queda asignado a un calendario específico.

**Pasos para crear un calendario:**
1. Hacer clic en **Crear**
2. Completar los campos:

| Campo | Descripción | Requerido |
|-------|-------------|-----------|
| Nombre | Nombre del consultorio (ej. "Consultorio 1") | Sí |
| ID de Google Calendar | ID de integración con Google Calendar (opcional) | No |
| Color | Color identificador en formato hexadecimal (ej. #3B82F6) | No |
| Activo | Si está disponible para turnos | No |

3. Hacer clic en **Crear**

---

### 2.8 Sociedades Mutuales

> **Menú:** Configuración de Negocio → Sociedades Mutuales  
> **URL:** `/config/mutual-societies`  
> **Permiso:** `MUTUAL_SOC_VIEW_LIST` — Ver lista de mutuales | `MUTUAL_SOC_CREATE` — Crear mutual

> 📸 **Captura:** Lista de sociedades mutuales con nombre, código y estado activo.

**Cómo acceder:** Menú lateral → **Configuración de Negocio** → **Sociedades Mutuales**

Registra las obras sociales o mutualistas que acepta la clínica. Estos registros se usan al crear presupuestos y facturas.

**Pasos para crear una mutual:**
1. Hacer clic en **Crear Sociedad**
2. Completar los campos:

| Campo | Descripción | Requerido |
|-------|-------------|-----------|
| Nombre | Nombre de la mutual (ej. "Blue Cross") | Sí |
| Código | Código identificador (ej. "BC001") | Sí |
| Descripción | Descripción opcional | No |
| Activo | Si está habilitada | No |

3. Hacer clic en **Crear Sociedad**

---

### 2.9 Plantillas de documentos

> **Menú:** Configuración de Negocio → Plantillas de Documentos  
> **URL:** `/config/print-templates`  
> **Permiso:** `PRINT_TEMPLATES_VIEW` — Ver plantillas de impresión | `PRINT_TEMPLATES_EDIT` — Editar plantillas

> 📸 **Captura:** Editor de plantillas con lista de tipos de documento a la izquierda, editor HTML al centro y vista previa a la derecha.

**Cómo acceder:** Menú lateral → **Configuración de Negocio** → **Plantillas de Documentos**

Permite personalizar el diseño de los documentos que se imprimen: presupuestos, facturas, recibos de pago, notas de crédito y prepagos.

**Funcionamiento:**
- Cada tipo de documento tiene su propia plantilla
- Las plantillas se editan con un editor de código HTML
- Hay una vista previa en tiempo real del resultado
- Al imprimir desde cualquier módulo, se usa la plantilla configurada aquí

**Para editar una plantilla:**
1. Seleccionar el tipo de documento en la lista
2. Editar el código HTML en el panel de edición
3. Verificar el resultado en el panel de vista previa
4. Hacer clic en **Guardar**

---

### 🎬 Guión del video — Módulo 2: Configuración inicial

**Duración estimada:** 8 minutos  
**Tono:** Didáctico, metódico

[ESCENA 1 — Menú Sistema → Licencias]  
"Antes de configurar cualquier cosa, revisamos que la licencia esté activa. Vamos a Sistema en el menú y entramos a Licencias. Acá podemos ver cuántos doctores, secretarias y admins tenemos habilitados, y la fecha de vencimiento."

[ESCENA 2 — Configuración de Negocio → Detalles de la Clínica]  
"Ahora vamos a lo primero que hay que completar: los datos de la clínica. En el menú izquierdo, Configuración de Negocio, Detalles de la Clínica."

[ESCENA 3 — Llenar formulario de clínica]  
"Completamos el nombre, la dirección, el teléfono, el RUT y el correo. También podemos subir el logo — que no pese más de 1 megabyte. Elegimos la moneda principal y guardamos."

[ESCENA 4 — Monedas]  
"Si la clínica trabaja con más de una moneda, vamos a Monedas y Tipos de Cambio. Ahí registramos las monedas y podemos consultar el historial de tipo de cambio."

[ESCENA 5 — Secuencias]  
"Las secuencias controlan cómo se numeran los documentos. Creamos una para facturas, otra para presupuestos. Definimos el patrón, por ejemplo FAC-2026-001, y el sistema lo genera automáticamente."

[ESCENA 6 — Horarios]  
"Ahora configuramos los horarios de atención de la clínica. Definimos qué días y en qué horario atiende la clínica. Esto después se usa para la disponibilidad de los doctores."

[ESCENA 7 — Feriados]  
"Los feriados son días donde la clínica no atiende o atiende con horario reducido. Los cargamos acá y el sistema los bloquea automáticamente en la agenda."

[ESCENA 8 — Calendarios]  
"Los calendarios son los consultorios. Si tenemos dos consultorios, creamos dos calendarios con nombre y color diferente. En la agenda van a aparecer como columnas separadas."

[ESCENA 9 — Mutuales]  
"Si la clínica trabaja con obras sociales, las registramos en Sociedades Mutuales. Van a estar disponibles para asociar en presupuestos y facturas."

[ESCENA 10 — Plantillas]  
"Por último, las plantillas de documentos nos permiten personalizar el diseño de lo que imprimimos: facturas, recibos, presupuestos. Acá se puede poner el logo, los datos de la clínica y el formato que queramos."

---

## Módulo 3: Gestión de usuarios y permisos

> **Menú:** Sistema  
> **URL base:** `/system`  
> **Permiso de acceso:** `SYSTEM_VIEW_MENU` — Ver menú del sistema

### 3.1 Roles

> **Menú:** Sistema → Roles  
> **URL:** `/roles`  
> **Permiso:** `ROLES_VIEW_MENU` — Ver menú de roles | `ROLES_CREATE` — Crear rol | `ROLES_ASSIGN_PERMISSION` — Asignar permisos

> 📸 **Captura:** Lista de roles con panel lateral expandible para editar nombre, gestionar permisos asignados y ver usuarios.

**Cómo acceder:** Menú lateral → **Sistema** → **Roles**

Los roles agrupan permisos y se asignan a los usuarios. Un usuario puede tener uno o más roles.

**Pasos para crear un rol:**
1. Hacer clic en **Crear**
2. Ingresar el **Nombre** del rol (ej. "Recepcionista Turno Tarde")
3. Hacer clic en **Guardar**

**Panel lateral — Pestañas:**

| Pestaña | Descripción |
|---------|-------------|
| Detalles | Editar el nombre del rol |
| Permisos | Asignar o quitar permisos al rol |
| Usuarios | Ver qué usuarios tienen este rol asignado |

**Para asignar permisos a un rol:**
1. Seleccionar el rol en la lista
2. Ir a la pestaña **Permisos**
3. Activar o desactivar los permisos deseados

---

### 3.2 Permisos

> **Menú:** Sistema → Permisos  
> **URL:** `/permissions`  
> **Permiso:** `PERMISSIONS_VIEW_MENU` — Ver menú de permisos

Muestra el catálogo completo de permisos disponibles en el sistema. Esta pantalla es de solo lectura y sirve como referencia para configurar los roles.

Los permisos siguen el patrón `MÓDULO_ACCIÓN` (ej. `PATIENTS_VIEW_LIST`, `SALES_INVOICES_CREATE`).

---

### 3.3 Usuarios del sistema

> **Menú:** Sistema → Usuarios  
> **URL:** `/system/users`  
> **Permiso:** `USERS_VIEW_MENU` — Ver menú de usuarios | `USERS_CREATE` — Crear usuario | `USERS_ASSIGN_ROLE` — Asignar rol

> 📸 **Captura:** Lista de usuarios del sistema con columnas Nombre, Correo, Roles asignados y Estado. Panel lateral con pestañas Detalles, Roles y Logs.

**Cómo acceder:** Menú lateral → **Sistema** → **Usuarios**

Gestión de todos los usuarios registrados en el sistema (doctores, secretarias, administradores).

**Pasos para crear un usuario:**
1. Hacer clic en **Crear**
2. Completar los campos del formulario
3. Hacer clic en **Guardar**

**Campos del formulario:**

| Campo | Descripción | Requerido |
|-------|-------------|-----------|
| Nombre | Nombre completo | Sí |
| Correo Electrónico | Email de acceso al sistema | Sí o Teléfono |
| Teléfono | Número con código de país | Sí o Email |
| Documento de Identidad | Número de cédula (hasta 10 dígitos) | Sí |
| ¿Está Activo? | Si puede iniciar sesión | No |

Al crear el usuario, el sistema envía automáticamente un correo con el enlace para establecer su contraseña inicial.

**Panel lateral — Pestañas:**

| Pestaña | Descripción |
|---------|-------------|
| Detalles | Editar información del usuario |
| Roles | Asignar roles al usuario |
| Historial | Ver actividad reciente del usuario |

**Para activar o desactivar un usuario:** En la fila del usuario, usar el menú de acciones → **Activar** o **Desactivar**.

---

### 3.4 Personal (Secretarias y Administración)

> **Menú:** Configuración de Negocio → Secretarias y Administración  
> **URL:** `/system/staff`  
> **Permiso:** `STAFF_VIEW_MENU` — Ver menú de personal

> 📸 **Captura:** Lista de personal administrativo con nombre, rol y estado.

**Cómo acceder:** Menú lateral → **Configuración de Negocio** → **Secretarias y Administración**

Vista dedicada para crear y gestionar secretarias y administradores. Al crear un usuario aquí, se puede asignar directamente el rol correspondiente.

> Esta sección valida contra los límites de la licencia. Si se alcanzó el máximo de usuarios habilitados, el sistema lo informará.

**Pasos para crear personal:**
1. Hacer clic en **Crear**
2. Seleccionar el **Rol** (Recepcionista o Gerente)
3. Completar los campos: Nombre, Correo Electrónico, Teléfono, Documento de Identidad
4. Hacer clic en **Guardar**

**Panel lateral — Pestañas:** Detalles, Roles, Historial

---

### 🎬 Guión del video — Módulo 3: Usuarios y permisos

**Duración estimada:** 5 minutos  
**Tono:** Paso a paso

[ESCENA 1 — Sistema → Roles]  
"El sistema de permisos se basa en roles. Primero creamos los roles, después los asignamos a los usuarios. Vamos a Sistema, Roles."

[ESCENA 2 — Crear un rol y asignar permisos]  
"Creamos un rol, por ejemplo 'Recepcionista'. Le ponemos nombre y guardamos. Ahora seleccionamos ese rol, vamos a la pestaña Permisos y activamos los permisos que necesita: ver pacientes, gestionar agenda, caja."

[ESCENA 3 — Crear usuario]  
"Para crear un usuario, vamos a Sistema, Usuarios. Completamos nombre, correo, teléfono y documento. Al guardar, el sistema envía un correo automático al usuario para que establezca su contraseña."

[ESCENA 4 — Asignar rol al usuario]  
"Seleccionamos el usuario en la lista, vamos a la pestaña Roles y le asignamos el rol que corresponde."

[ESCENA 5 — Personal (Staff)]  
"Para secretarias y administradores hay una entrada más directa: Configuración de Negocio, Secretarias y Administración. Ahí podemos crear el usuario y asignar el rol en un solo paso."

---

## Módulo 4: Doctores y disponibilidad

> **Menú:** Configuración de Negocio  
> **URL base:** `/config`

### 4.1 Doctores

> **Menú:** Configuración de Negocio → Doctores  
> **URL:** `/config/doctors`  
> **Permiso:** `DOCTORS_VIEW_LIST` — Ver lista de doctores | `DOCTORS_CREATE` — Crear doctor | `DOCTORS_TOGGLE_STATUS` — Activar/desactivar doctor

> 📸 **Captura:** Lista de doctores con nombre, color de calendario, estado activo/inactivo y panel lateral con pestañas Detalles, Disponibilidad y Excepciones.

**Cómo acceder:** Menú lateral → **Configuración de Negocio** → **Doctores**

> Los doctores también son usuarios del sistema. Al crear un doctor aquí, se crea el perfil médico con su agenda y disponibilidad.

**Pasos para crear un doctor:**
1. Hacer clic en **Crear**
2. Completar los campos del formulario
3. Hacer clic en **Guardar**

**Campos del formulario:**

| Campo | Descripción | Requerido |
|-------|-------------|-----------|
| Nombre | Nombre completo del doctor | Sí |
| Correo Electrónico | Email de acceso | Sí o Teléfono |
| Teléfono | Número con código de país | Sí o Email |
| Documento de Identidad | Cédula (hasta 10 dígitos, solo números) | Sí |
| Color | Color identificador en la agenda | No |
| ¿Está Activo? | Si aparece en la agenda | No |

**Panel lateral — Pestañas:**

| Pestaña | Descripción |
|---------|-------------|
| Detalles | Editar información del doctor |
| Disponibilidad | Configurar horarios de trabajo del doctor |
| Excepciones | Configurar días de ausencia puntuales |

**Filtro disponible:** "Mostrar solo activos" para ver únicamente doctores activos.

---

### 4.2 Disponibilidad médica

> **Menú:** Configuración de Negocio → Disponibilidad Médica  
> **URL:** `/config/doctor-availability`  
> **Permiso:** `AVAILABILITY_RULES_VIEW` — Ver reglas de disponibilidad | `AVAILABILITY_RULES_CREATE` — Crear regla

> 📸 **Captura:** Lista de reglas de disponibilidad con doctor, día(s), horario y fechas de vigencia.

**Cómo acceder:** Menú lateral → **Configuración de Negocio** → **Disponibilidad Médica**

También se puede acceder desde el panel lateral de un doctor → pestaña **Disponibilidad**.

Define en qué días y horarios trabaja cada doctor. Se usa para validar al crear turnos.

**Pasos para crear una disponibilidad:**
1. Hacer clic en **Crear**
2. Completar los campos:

| Campo | Descripción | Requerido |
|-------|-------------|-----------|
| Doctor | Seleccionar el doctor | Sí |
| Recurrencia | Diario, Semanal, Quincenal, Mensual | Sí |
| Día de la Semana | Para recurrencia semanal o quincenal | Condicional |
| Hora de Inicio | Desde qué hora atiende | Sí |
| Hora de Fin | Hasta qué hora atiende | Sí |
| Fecha de Inicio | Desde cuándo aplica esta disponibilidad | Sí |
| Fecha de Fin | Hasta cuándo aplica (opcional) | No |

3. Hacer clic en **Guardar**

---

### 4.3 Excepciones de disponibilidad

**Cómo acceder:** Menú lateral → **Configuración de Negocio** → **Excepciones de Disponibilidad**  
**Permiso requerido:** `AVAILABILITY_EXCEPTIONS_VIEW`

Permite registrar días puntuales en que un doctor no estará disponible (vacaciones, licencias, días especiales) sin modificar su disponibilidad habitual.

**Pasos para crear una excepción:**
1. Hacer clic en **Crear**
2. Seleccionar el **Doctor**
3. Ingresar la **Fecha** de la excepción
4. Configurar si ese día el doctor trabaja con horario especial o no trabaja
5. Hacer clic en **Guardar**

---

### 🎬 Guión del video — Módulo 4: Doctores y disponibilidad

**Duración estimada:** 4 minutos

[ESCENA 1 — Configuración de Negocio → Doctores]  
"Para que los doctores aparezcan en la agenda, primero los registramos en Configuración de Negocio, Doctores."

[ESCENA 2 — Crear doctor]  
"Completamos nombre, documento de identidad y al menos un correo o teléfono. También le asignamos un color — ese color es el que va a aparecer en la agenda para identificarlo rápidamente. Guardamos."

[ESCENA 3 — Disponibilidad]  
"Ahora configuramos cuándo atiende. Seleccionamos el doctor, vamos a la pestaña Disponibilidad y creamos sus horarios. Por ejemplo: lunes a viernes de 9 a 18hs, con recurrencia semanal."

[ESCENA 4 — Excepciones]  
"Si el doctor tiene vacaciones o una ausencia puntual, usamos Excepciones de Disponibilidad. Registramos la fecha y esos días quedan bloqueados automáticamente en la agenda."

---

## Módulo 5: Catálogos clínicos

> **Menú:** Catálogo de la Clínica  
> **URL base:** `/clinic-catalog`  
> **Permiso de acceso:** `CATALOG_VIEW_MENU` — Ver menú de catálogos

> Los catálogos son datos de referencia que se usan en la historia clínica. Se recomienda cargarlos antes de comenzar a atender pacientes.

### 5.1 Padecimientos

> **Menú:** Catálogo de la Clínica → Padecimientos  
> **URL:** `/clinic-catalog/ailments`  
> **Permiso:** `CATALOG_CONDITIONS_VIEW_LIST` — Ver padecimientos | `CATALOG_CONDITIONS_CREATE` — Crear padecimiento

**Cómo acceder:** Menú lateral → **Catálogo de la Clínica** → **Padecimientos**

Catálogo de condiciones médicas y enfermedades que pueden registrarse en la historia clínica del paciente.

**Campos al crear un padecimiento:**

| Campo | Descripción | Requerido |
|-------|-------------|-----------|
| Nombre | Nombre de la condición (ej. "Hipertensión Arterial") | Sí |
| Categoría | Categoría médica (ej. "Cardiovascular") | No |
| Nivel de Alerta | 1 Normal, 2 Advertencia, 3 Crítico | No |

---

### 5.2 Medicamentos

> **Menú:** Catálogo de la Clínica → Medicamentos  
> **URL:** `/clinic-catalog/medications`  
> **Permiso:** `CATALOG_MEDICATIONS_VIEW_LIST` — Ver medicamentos | `CATALOG_MEDICATIONS_CREATE` — Crear medicamento

**Cómo acceder:** Menú lateral → **Catálogo de la Clínica** → **Medicamentos**

Catálogo de medicamentos para autocompletar en la historia clínica.

**Campos al crear un medicamento:**

| Campo | Descripción | Requerido |
|-------|-------------|-----------|
| Nombre Genérico | Principio activo (ej. "Ibuprofeno") | Sí |
| Nombre Comercial | Marca comercial (ej. "Advil") | No |

---

### 5.3 Condiciones dentales

> **Menú:** Catálogo de la Clínica → Condiciones Dentales  
> **URL:** `/clinic-catalog/dental-conditions`  
> **Permiso:** `CATALOG_DENTAL_COND_VIEW_LIST` — Ver condiciones dentales

**Cómo acceder:** Menú lateral → **Catálogo de la Clínica** → **Condiciones Dentales**

Catálogo de condiciones que pueden marcarse sobre los dientes en el odontograma.

---

### 5.4 Superficies dentales

> **Menú:** Catálogo de la Clínica → Superficies Dentales  
> **URL:** `/clinic-catalog/dental-surfaces`  
> **Permiso:** `CATALOG_DENTAL_SURF_VIEW_LIST` — Ver superficies dentales

**Cómo acceder:** Menú lateral → **Catálogo de la Clínica** → **Superficies Dentales**

Define las superficies de cada diente (mesial, distal, vestibular, palatino, oclusal) que se pueden marcar en el odontograma.

---

### 🎬 Guión del video — Módulo 5: Catálogos clínicos

**Duración estimada:** 3 minutos

[ESCENA 1 — Catálogo de la Clínica]  
"Los catálogos son listas de referencia que se usan al registrar la historia clínica de los pacientes. Cuanto más completos estén, más fácil y rápido es el trabajo clínico."

[ESCENA 2 — Padecimientos]  
"En Padecimientos cargamos las condiciones médicas más frecuentes de nuestros pacientes: diabetes, hipertensión, alergias. Podemos ponerles un nivel de alerta — nivel 3 es crítico y se va a destacar en la historia del paciente."

[ESCENA 3 — Medicamentos]  
"En Medicamentos cargamos el catálogo de fármacos. Cuando el profesional registre los medicamentos de un paciente, el sistema le va a sugerir desde este catálogo."

[ESCENA 4 — Condiciones y superficies dentales]  
"Las condiciones y superficies dentales se usan en el odontograma. Con esto el profesional puede marcar con precisión qué hay en cada diente y en qué cara."

---

## Módulo 6: Configuración de ventas

> **Menú:** Ventas  
> **URL base:** `/sales`  
> **Permiso de acceso:** `SALES_VIEW_MENU` — Ver menú de ventas

### 6.1 Métodos de pago

> **Menú:** Ventas → Métodos de Pago  
> **URL:** `/sales/payment-methods`  
> **Permiso:** `PAYMENT_METHODS_VIEW_MENU` — Ver métodos de pago | `PAYMENT_METHODS_CREATE` — Crear método | `PAYMENT_METHODS_TOGGLE_STATUS` — Activar/desactivar

> 📸 **Captura:** Lista de métodos de pago (Efectivo, Tarjeta, Transferencia, etc.) con estado activo y opción de habilitar/deshabilitar.

**Cómo acceder:** Menú lateral → **Ventas** → **Métodos de Pago**

Define los métodos de pago disponibles al registrar pagos de pacientes.

**Campos al crear un método de pago:**

| Campo | Descripción | Requerido |
|-------|-------------|-----------|
| Nombre | Nombre visible (ej. "Tarjeta de Crédito") | Sí |
| Código | Código interno (ej. "TARJ_CRED") | Sí |
| ¿Es Equivalente a Efectivo? | Si se considera efectivo para el cierre de caja | No |
| ¿Está Activo? | Si está disponible para usar | No |

---

### 6.2 Servicios y prestaciones

> **Menú:** Ventas → Servicios  
> **URL:** `/sales/services`  
> **Permiso:** `SALES_SERVICES_VIEW_MENU` — Ver servicios | `SALES_SERVICES_CREATE` — Crear servicio

> 📸 **Captura:** Catálogo de servicios con nombre, precio, duración estimada y color de identificación en la agenda.

**Cómo acceder:** Menú lateral → **Ventas** → **Servicios**

Catálogo de servicios médicos y tratamientos que se ofrecen en la clínica. Estos servicios se usan al crear turnos y presupuestos.

**Campos principales de un servicio:** nombre, descripción, precio, duración estimada, color, si está activo.

---

### 🎬 Guión del video — Módulo 6: Configuración de ventas

**Duración estimada:** 3 minutos

[ESCENA 1 — Métodos de pago]  
"Para que la clínica pueda cobrar, primero configuramos los métodos de pago. Vamos a Ventas, Métodos de Pago. Creamos los que usamos: efectivo, tarjeta de débito, transferencia. Podemos marcar cuáles se consideran equivalentes a efectivo para el cierre de caja."

[ESCENA 2 — Servicios]  
"Los servicios son las prestaciones que ofrece la clínica. Cada servicio tiene un nombre, precio y duración. Cuando el profesional agenda un turno, selecciona el servicio y el sistema sabe cuánto tiempo reservar."

---

## Módulo 7: Configuración de alertas y comunicaciones

> **Menú:** Sistema  
> **URL base:** `/system`  
> **Permiso de acceso:** `SYSTEM_VIEW_MENU` — Ver menú del sistema

### 7.1 Configuración del sistema de alertas

> **Menú:** Sistema → Configuración de Alertas  
> **URL:** `/system/alerts-config`  
> **Permiso:** `ALERT_CONFIG_VIEW_MENU` — Ver configuración de alertas | `ALERT_CONFIG_UPDATE` — Editar configuración

> 📸 **Captura:** Formulario de configuración de alertas con secciones: Programador (horario y zona horaria), Correo electrónico (SMTP) y SMS (proveedor).

**Cómo acceder:** Menú lateral → **Sistema** → **Configuración de Alertas**

Configura los ajustes globales del sistema de alertas automáticas.

**Secciones:**

**Programador de Alertas:**
- Habilitar/deshabilitar el trabajo nocturno de generación de alertas
- Configurar la hora de ejecución diaria
- Zona horaria
- Botón **Ejecutar Ahora** para forzar una ejecución inmediata

**Configuración de Correo Electrónico:**
- Proveedor SMTP
- Servidor SMTP, Puerto
- Usuario y Contraseña
- Correo y Nombre del remitente predeterminado
- Botón **Enviar Correo de Prueba**

**Configuración de SMS:**
- Proveedor de SMS
- Credenciales del proveedor

---

### 7.2 Categorías de alertas

> **Menú:** Sistema → Categorías de Alertas  
> **URL:** `/system/alert-categories`  
> **Permiso:** `ALERT_CATEGORIES_VIEW_MENU` — Ver categorías | `ALERT_CATEGORIES_CREATE` — Crear categoría

**Cómo acceder:** Menú lateral → **Sistema** → **Categorías de Alertas**

Agrupa las alertas por tipo para facilitar su gestión y filtrado.

**Campos al crear una categoría:**

| Campo | Descripción |
|-------|-------------|
| Nombre | Nombre de la categoría (ej. "Facturación") |
| Código | Código único (ej. "FACTURACION") |
| Descripción | Descripción opcional |
| Categoría Interna | Clasificación interna del sistema |
| Activo | Si está habilitada |

---

### 7.3 Reglas de alertas

> **Menú:** Sistema → Reglas de Alertas  
> **URL:** `/system/alert-rules`  
> **Permiso:** `ALERT_RULES_VIEW_MENU` — Ver reglas | `ALERT_RULES_CREATE` — Crear regla | `ALERT_RULES_TOGGLE_STATUS` — Activar/desactivar

**Cómo acceder:** Menú lateral → **Sistema** → **Reglas de Alertas**

Define las condiciones bajo las cuales el sistema genera alertas automáticamente.

**Columnas de la tabla:**

| Columna | Descripción |
|---------|-------------|
| Nombre | Nombre de la regla |
| Categoría | Categoría asignada |
| Prioridad | Nivel de urgencia |
| Correo Automático | Si envía email automáticamente |
| SMS Automático | Si envía SMS automáticamente |
| Activo | Si la regla está habilitada |

**Acciones disponibles:** Editar, Duplicar, Probar Regla, Eliminar.

---

### 7.4 Plantillas de comunicación

> **Menú:** Sistema → Plantillas de Alertas  
> **URL:** `/system/communication-templates`  
> **Permiso:** `ALERT_TEMPLATES_VIEW_MENU` — Ver plantillas | `ALERT_TEMPLATES_CREATE` — Crear plantilla

**Cómo acceder:** Menú lateral → **Sistema** → **Plantillas de Alertas**

Plantillas para los mensajes de correo y SMS que se envían automáticamente a los pacientes.

**Campos al crear una plantilla:**

| Campo | Descripción |
|-------|-------------|
| Nombre | Nombre de la plantilla |
| Código | Código interno |
| Tipo | Email o SMS |
| Categoría | Categoría de alerta asociada |
| Asunto | Asunto del correo (para emails) |
| Contenido del Cuerpo | Texto del mensaje con variables dinámicas |

**Acciones:** Editar, Duplicar, Vista Previa, Ver Historial, Eliminar.

---

### 7.5 Configuración de notificaciones

> **Menú:** Sistema → Notificaciones  
> **URL:** `/system/notification-settings`  
> **Permiso:** `NOTIFICATION_SETTINGS_VIEW_MENU` — Ver configuración de notificaciones

**Cómo acceder:** Menú lateral → **Sistema** → **Notificaciones**

Configura qué notificaciones recibe cada tipo de usuario y por qué canal (in-app, email, SMS).

---

### 🎬 Guión del video — Módulo 7: Alertas y comunicaciones

**Duración estimada:** 4 minutos

[ESCENA 1 — Sistema → Configuración de Alertas]  
"El sistema de alertas permite enviar recordatorios y comunicaciones automáticas a los pacientes. Primero configuramos el proveedor de correo y SMS en Configuración de Alertas."

[ESCENA 2 — Categorías y Reglas]  
"Las categorías organizan las alertas por tipo. Las reglas definen cuándo se generan: por ejemplo, enviar un recordatorio de turno 24 horas antes."

[ESCENA 3 — Plantillas]  
"Las plantillas son los mensajes que se envían. Creamos plantillas con el texto personalizado y variables como el nombre del paciente y la fecha del turno."

[ESCENA 4 — Configuración de notificaciones]  
"Por último, en Notificaciones configuramos qué recibe cada usuario y cómo."

---

## Módulo 8: Widget de acciones rápidas (panel derecho)

> **Menú:** (panel fijo lateral derecho — visible desde cualquier módulo)  
> **Permiso principal:** `CASHIER_VIEW_WIDGET` — Ver widget de caja | `ALERT_CENTER_VIEW_MENU` — Ver alertas | `STICKY_NOTES_VIEW` — Notas adhesivas | `GLOBAL_VIEW_EXCHANGE_RATE` — Tipo de cambio

> 📸 **Captura:** Panel lateral derecho expandido mostrando los 10 botones de acciones rápidas con sus indicadores de estado y contadores.

El widget de acciones rápidas es un panel vertical fijo en el lado derecho de la pantalla, visible en todo momento desde cualquier módulo del sistema. Permite acceder de un clic a las funciones más usadas sin necesidad de navegar por el menú.

El panel puede **expandirse** (haciendo clic en la flecha `>`) o **colapsarse**. Cuando está colapsado, sigue mostrando indicadores visuales (puntos de color, contadores) para alertar sobre pendientes.

### Botones del widget

| Botón | Ícono | Descripción | Permiso |
|-------|-------|-------------|---------|
| **Caja** | Caja registradora | Muestra el estado de la sesión de caja (abierta/cerrada) y permite acceder rápidamente. | `CASHIER_VIEW_WIDGET` |
| **TV** | Televisor | Acceso rápido al control del TV Display de sala de espera. | — |
| **Cobrar** | Rayo (color verde) | Abre el wizard de **Cobro Rápido** para facturar y cobrar en el acto. | `SALES_INVOICES_CREATE` |
| **Alertas** | Campana (rojo) | Muestra el contador de alertas pendientes. Al hacer clic, abre el Centro de Alertas. | `ALERT_CENTER_VIEW_MENU` |
| **Cambio** | Moneda USD | Muestra el tipo de cambio USD actual. Solo visible con sesión de caja activa. | `GLOBAL_VIEW_EXCHANGE_RATE` |
| **Inbox** | Bandeja de entrada | Notificaciones del sistema para el usuario. | — |
| **Notas** | Nota adhesiva (amarillo) | Acceso a las notas adhesivas (sticky notes) rápidas. | `STICKY_NOTES_VIEW` |
| **Chat** | Burbuja de mensaje | Abre el panel de chat interno del sistema. | — |
| **Voz** | Parlante | Activa o desactiva la lectura en voz alta (text-to-speech) del sistema. | — |
| **Mic** | Micrófono | Abre el asistente de voz para dar instrucciones por dictado. | — |

> El contador del botón **Alertas** e **Inbox** se actualiza en tiempo real. Cuando hay pendientes urgentes y el panel está colapsado, los botones pulsan con una animación de destello.

---

### 🎬 Guión del video — Módulo 8: Widget de acciones rápidas

**Duración estimada:** 2 minutos

[ESCENA 1 — Panel derecho en cualquier pantalla]  
"A la derecha de la pantalla siempre hay un panel con acciones rápidas. Desde cualquier lugar del sistema podés acceder de un clic a las funciones más usadas."

[ESCENA 2 — Recorrer botones]  
"Caja muestra si hay sesión abierta. TV controla la pantalla de sala de espera. Cobrar abre el wizard de cobro rápido. Alertas muestra los pendientes con el conteo en tiempo real. Cambio muestra el tipo de cambio del dólar. Inbox tiene las notificaciones del sistema. Notas permite escribir notas rápidas adhesivas. Y Chat, Voz y Mic son para el asistente de voz."

[ESCENA 3 — Colapsar/expandir]  
"El panel se puede colapsar para ganar espacio en pantalla. Incluso colapsado sigue mostrando indicadores cuando hay pendientes."

---

## Módulo 8B: Dashboard

> **Menú:** Dashboard (ícono de casa en el menú lateral)  
> **URL:** `/`  
> **Permiso:** `DASHBOARD_VIEW_MENU` — Ver menú del dashboard | `DASHBOARD_VIEW_KPIS` — Ver KPIs | `DASHBOARD_VIEW_CHARTS` — Ver gráficos | `DASHBOARD_APPLY_FILTERS` — Aplicar filtros de fecha

> 📸 **Captura:** Dashboard mostrando KPIs principales (facturación, cobros, nuevos pacientes, turnos del día), gráficos de evolución y tablas de datos recientes.

**Cómo acceder:** Menú lateral → ícono de casa (inicio)

El dashboard es la pantalla principal del sistema. Muestra un resumen visual del estado de la clínica en tiempo real.

**Secciones:**
- **KPIs**: métricas clave del período (facturación, cobros, nuevos pacientes, turnos)
- **Gráficos**: evolución temporal de indicadores principales
- **Tablas**: datos recientes (últimas citas, últimos pagos, alertas pendientes)
- **Filtros**: selector de rango de fechas para ajustar el período visualizado

> Lo que cada usuario ve en el dashboard depende de sus permisos.

---

### 🎬 Guión del video — Módulo 8: Dashboard

**Duración estimada:** 2 minutos

[ESCENA 1 — Pantalla del dashboard]  
"Al entrar al sistema, lo primero que ves es el dashboard. Es el resumen de lo que está pasando en la clínica: cuánto se facturó, cuántos pacientes nuevos, cuántos turnos hay hoy."

[ESCENA 2 — Filtros]  
"Podés cambiar el período con los filtros de fecha para ver datos de la semana, el mes o el rango que necesités."

---

## Módulo 9: Pacientes e historial clínico

> **Menú:** Pacientes  
> **URL base:** `/patients`  
> **Permiso de acceso:** `PATIENTS_VIEW_MENU` — Ver menú de pacientes

### 9.1 Lista de pacientes

> **Menú:** Pacientes  
> **URL:** `/patients`  
> **Permiso:** `PATIENTS_VIEW_LIST` — Ver lista de pacientes | `PATIENTS_CREATE` — Crear paciente | `PATIENTS_UPDATE` — Editar paciente

> 📸 **Captura:** Lista paginada de pacientes con barra de búsqueda, filtros avanzados y columnas Nombre, Correo, Teléfono, Doctor tratante y Estado.

**Cómo acceder:** Menú lateral → **Pacientes**

Vista principal con la lista completa de pacientes registrados. Muestra hasta 25 pacientes por página con paginación.

**Funciones disponibles:**
- **Buscar**: filtrar por nombre o correo electrónico en tiempo real
- **Crear paciente**: botón **Crear** en la barra de herramientas
- **Filtros avanzados**: por estado activo/inactivo, médico tratante, y otros criterios
- **Actualizar**: botón de refresh para recargar la lista

---

### 9.2 Detalle del paciente

> **URL:** `/patients/{id}`  
> **Permiso:** `PATIENTS_VIEW_DETAIL` — Ver detalle del paciente | `PATIENTS_UPDATE` — Editar | `MEDICAL_HISTORY_VIEW_MENU` — Ver historia clínica

> 📸 **Captura:** Perfil del paciente con pestañas Información, Historia Clínica y Finanzas. Botones "Crear" y "Más acciones" en la barra de herramientas.

Al seleccionar un paciente en la lista, se abre el panel de detalle con tres pestañas principales:

| Pestaña principal | Descripción |
|---------|-------------|
| **Información** | Datos personales del paciente (nombre, contacto, documento, fecha de nacimiento, etc.) |
| **Historia clínica** | Expediente médico completo con sub-pestañas |
| **Finanzas** | Resumen financiero y documentos del paciente |

#### Botón "Crear" (creación rápida)

Desde el perfil del paciente, el botón **Crear** despliega un menú con acceso rápido a:

**Sección Clínico:**
| Opción | Descripción |
|--------|-------------|
| Sesión clínica | Registra una nueva consulta o intervención |
| Sesión de odontograma | Abre el odontograma para registrar el estado dental |
| Documento | Adjunta un documento al expediente |

**Sección Financiero:**
| Opción | Descripción |
|--------|-------------|
| Cobro rápido | Abre el wizard de cobro rápido para cobrar en el acto (ver Módulo 20) |
| Presupuesto | Crea un nuevo presupuesto para el paciente |
| Factura | Crea una factura directamente |
| Prepago | Registra un pago a cuenta sin factura asociada |

**Sección Agenda:**
| Opción | Descripción |
|--------|-------------|
| Cita | Crea un turno en la agenda para este paciente |

#### Botón "Más acciones"

**Sección Comunicación:**
| Opción | Condición |
|--------|-----------|
| WhatsApp | Visible si el paciente tiene teléfono registrado; abre chat de WhatsApp |

**Sección Estado:**
| Opción | Descripción |
|--------|-------------|
| Dar Alta / Reingreso | Alterna entre marcar al paciente como dado de alta o reingresarlo |
| Activar / Desactivar | Activa o desactiva el usuario en el sistema |

**Sección Configuración:**
| Opción | Descripción |
|--------|-------------|
| Preferencias | Configura las preferencias de comunicación del paciente (canales y categorías) |

---

### 9.3 Historia clínica — Sub-pestañas

> **Permiso:** `MEDICAL_HISTORY_VIEW` — Ver historia clínica | `TIMELINE_VIEW` — Ver línea de tiempo | `CLINICAL_SESSION_CREATE` — Crear sesión clínica

> 📸 **Captura:** Pestaña Historia Clínica con sub-pestañas: Anamnesis, Línea de Tiempo, Planes de Tratamiento, Documentos y Servicios.

**Cómo acceder:** Pestaña **Historia clínica** del perfil del paciente  
**Permiso requerido:** `MEDICAL_HISTORY_VIEW_DETAIL`

#### Anamnesis

Registro médico completo del paciente con las siguientes secciones:

| Sección | Descripción |
|---------|-------------|
| **Información Personal** | Datos médicos relevantes (tipo de sangre, alergias conocidas) |
| **Medicamentos** | Lista de medicamentos actuales (seleccionados del catálogo) |
| **Información Familiar** | Antecedentes hereditarios con indicación del parentesco (ej. Hipertiroidismo — Madre) |
| **Alergias** | Alergias registradas, destacadas en rojo por su importancia clínica |
| **Hábitos** | Tabaquismo, Alcoholismo, Bruxismo y otros hábitos |

Cada sección tiene un botón **+** para agregar ítems y íconos de editar/eliminar en cada registro.

#### Línea de tiempo

Cronología completa de todos los eventos del paciente. Muestra:
- **Citas**: turnos agendados con fecha, servicio y doctor
- **Sesiones Clínicas**: intervenciones registradas con notas
- **Odontograma**: sesiones de odontograma con fecha y autor

Botón **+ Agregar sesión** para registrar una nueva sesión clínica directamente.  
Filtros disponibles para mostrar solo ciertos tipos de eventos.

**Para registrar una sesión clínica:**
1. Hacer clic en **+ Agregar sesión**
2. Registrar el procedimiento realizado, diagnóstico y observaciones
3. Adjuntar archivos si corresponde (radiografías, fotos, documentos)
4. Guardar — la sesión queda registrada con fecha, hora y autor

#### Planes de Tratamiento

Muestra los planes de tratamiento activos del paciente. Cada plan tiene:
- **Nombre del plan** y estado (Activo / Completado)
- **Fecha de inicio**, doctor responsable e ID del plan
- **Barra de progreso**: N de M hitos completados
- **Pasos**: lista numerada con fecha, estado (Agendado/Pendiente), descripción y notas
- **Editar pasos**: modificar el orden, estado o contenido de cada paso
- **Agregar paso**: añadir nuevas etapas al plan

Los pasos muestran el estado con un badge de color:
- **Agendado**: ya tiene turno en agenda
- **Pendiente**: aún sin turno
- **Completado**: intervención realizada

#### Documentos

Archivos adjuntos al expediente del paciente: radiografías, informes, consentimientos. Se pueden subir, descargar y eliminar.

#### Servicios

Historial de servicios prestados al paciente con detalle de fechas, montos y estados.

---

### 9.4 Finanzas — Resumen y documentos

> **Permiso:** `PATIENTS_VIEW_DETAIL_QUOTES` — Ver presupuestos | `PATIENTS_VIEW_DETAIL_INVOICES` — Ver facturas | `PATIENTS_VIEW_DETAIL_PAYMENTS` — Ver pagos

> 📸 **Captura:** Pestaña Finanzas del paciente mostrando 4 KPIs (Facturado, Pagado, Deuda, Saldo disponible) y sub-pestañas Presupuestos, Facturas y Pagos.

**Cómo acceder:** Pestaña **Finanzas** del perfil del paciente

#### Resumen financiero

Muestra cuatro indicadores en la parte superior:

| Indicador | Descripción |
|-----------|-------------|
| **Total Facturado** | Suma de todas las facturas emitidas al paciente |
| **Total Pagado** | Suma de todos los pagos recibidos |
| **Deuda Actual** | Saldo pendiente de pago |
| **Saldo Disponible** | Prepagos o créditos disponibles a favor del paciente |

Los montos se muestran en UYU y USD (si aplica).

**Imprimir Resumen Financiero:**  
Botón **Imprimir** en la esquina superior del resumen. Permite seleccionar un **rango de fechas** opcional (Desde / Hasta). El sistema genera el documento solo si hay movimientos en el período. Si no hay datos, muestra un aviso.

#### Sub-pestañas de Finanzas

**Presupuestos:**
- Lista de todos los presupuestos del paciente con ID, estado, total, monto facturado, pendiente de facturar y pagado
- Los estados posibles son: Pendiente, Confirmado, Rechazado, Facturado
- Buscador y paginación

**Facturas:**
- Lista de facturas con ID, estado, total y fecha
- Permite ver el detalle de cada factura

**Pagos:**
- Lista de todos los pagos registrados para el paciente
- Incluye prepagos y pagos asociados a facturas

---

### 9.5 Odontograma

El odontograma es la representación gráfica de la boca del paciente. Se accede desde:
- Pestaña **Historia clínica** → **Línea de tiempo** → ítems de tipo "Odontograma"
- Botón **Crear** del paciente → **Sesión de odontograma**

**Funciones:**
- Vista de dentición permanente y temporal
- Marcar condiciones por diente y por superficie (usando el catálogo de condiciones y superficies dentales configurado en el sistema)
- Cada sesión de odontograma queda registrada en la línea de tiempo con fecha y autor

---

### 🎬 Guión del video — Módulo 9: Pacientes e historial clínico

**Duración estimada:** 8 minutos

[ESCENA 1 — Menú → Pacientes]  
"El módulo de pacientes centraliza todo lo relacionado a cada persona que atiende la clínica. Vamos a Pacientes."

[ESCENA 2 — Lista y búsqueda]  
"Vemos la lista completa con paginación. Buscamos por nombre o correo. Al hacer clic en un paciente, se abre el panel de detalle."

[ESCENA 3 — Pestañas principales]  
"El perfil tiene tres pestañas: Información, Historia clínica y Finanzas. Empezamos por Historia clínica."

[ESCENA 4 — Anamnesis]  
"En Anamnesis registramos toda la información médica del paciente: medicamentos actuales, antecedentes familiares con parentesco, alergias — que se destacan en rojo — y hábitos como tabaquismo o bruxismo."

[ESCENA 5 — Línea de tiempo]  
"La Línea de tiempo es el historial cronológico de todo lo que pasó: citas, sesiones clínicas y sesiones de odontograma. Desde acá también podemos agregar una nueva sesión clínica."

[ESCENA 6 — Planes de tratamiento]  
"Los Planes de Tratamiento organizan tratamientos que requieren múltiples pasos. Cada paso tiene su fecha y se puede vincular a un turno en agenda. La barra de progreso muestra cuántos hitos se completaron."

[ESCENA 7 — Finanzas]  
"En la pestaña Finanzas vemos el resumen financiero: total facturado, pagado, deuda y saldo disponible. Haciendo clic en Imprimir podemos elegir un rango de fechas y generar el reporte."

[ESCENA 8 — Menú Crear y Más acciones]  
"El botón Crear nos da acceso rápido a todo: desde acá podemos crear una sesión clínica, un presupuesto, una factura, un prepago o agendar una cita — sin salir del perfil del paciente. Y con Más acciones podemos contactar por WhatsApp, dar de alta al paciente o configurar sus preferencias de comunicación."

---

## Módulo 9B: Cobro Rápido (Billing Wizard)

> **Menú:** (acceso desde widget → Cobrar, perfil del paciente → Crear → Cobro rápido, o Mi Consultorio)  
> **Permiso:** `SALES_INVOICES_CREATE` — Crear factura | `SALES_PAYMENTS_CREATE` — Crear pago | `SALES_PREPAYMENTS_CREATE` — Crear prepago

> 📸 **Captura:** Wizard de Cobro Rápido en paso 2 (Servicios): lista de ítems con servicio, precio unitario, cantidad y total. Botones "Solo facturar" y "Facturar y Cobrar".

**Cómo acceder:**

1. Widget de acciones rápidas → botón **Cobrar**
2. Perfil del paciente → **Crear** → **Cobro rápido**
3. Mi Consultorio: al finalizar una sesión, botón de acción rápida de la secretaria

El Cobro Rápido es un wizard de 2 a 4 pasos que permite facturar y cobrar servicios de forma ágil, sin necesidad de navegar por el módulo de Ventas.

### Flujos según contexto

El wizard adapta sus pasos según desde dónde se inicie:

| Origen | Pasos | Descripción |
|--------|-------|-------------|
| Desde un presupuesto confirmado | Presupuesto → Pago → Listo | Factura el presupuesto y cobra en el mismo wizard |
| Desde una factura existente | Pago → Listo | Solo registra el pago de una factura ya emitida |
| Libremente (sin contexto previo) | Paciente → Servicios → Pago → Listo | Flujo completo: selecciona paciente, elige servicios, factura y cobra |

---

### Paso 1: Selección de paciente (flujo libre)

Solo en el flujo libre, si no hay paciente preseleccionado.  
Buscar y seleccionar el paciente desde el buscador.

---

### Paso 2: Servicios / Presupuesto

Si viene de un presupuesto: muestra los servicios del presupuesto confirmado con montos.

Si es flujo libre: editor de ítems donde se agregan los servicios a facturar.

| Campo | Descripción |
|-------|-------------|
| Servicio | Nombre del servicio prestado |
| Precio unitario | Precio del servicio |
| Cantidad | Unidades |
| Total | Calculado automáticamente |
| Moneda | UYU o USD |

**Botones disponibles:**
- **Solo facturar**: genera la factura sin registrar pago en este momento
- **Facturar y Cobrar**: avanza al paso de pago

---

### Paso 3: Pago

Registra el cobro con los siguientes campos:

| Campo | Descripción |
|-------|-------------|
| Método de pago | Seleccionar entre los métodos configurados (efectivo, tarjeta, transferencia, etc.) |
| Monto | Monto a cobrar (puede ser pago parcial) |
| Moneda | UYU o USD |
| Referencia de transacción | Número de referencia opcional (ej. número de comprobante) |

Se puede registrar más de un método de pago (pago mixto). El sistema muestra el total de la factura, lo pagado hasta el momento y el saldo pendiente.

**Botones disponibles:**
- **Cobrar**: registra el pago
- **Solo facturar**: deja la factura pendiente de cobro

---

### Paso 4: Confirmación

Muestra el resumen de la operación:
- Número de factura generada (ej. FAC-2026-05-0123)
- Lista de pagos registrados
- Total facturado y total pagado
- Monto pendiente (si hubo pago parcial)

Botón **Cerrar** para finalizar. Desde acá también se puede ir directamente a ver la factura y los pagos.

---

### 🎬 Guión del video — Módulo 9B: Cobro Rápido

**Duración estimada:** 4 minutos

[ESCENA 1 — Botón Cobrar en el widget derecho]  
"El Cobro Rápido es la forma más ágil de cobrarle a un paciente. Se puede acceder desde el botón Cobrar del panel derecho o desde el perfil del paciente."

[ESCENA 2 — Flujo desde presupuesto]  
"Si el paciente tiene un presupuesto confirmado, el wizard lo toma directamente, muestra los servicios y pasa al cobro. En dos pantallas ya está listo."

[ESCENA 3 — Flujo libre]  
"Si no hay presupuesto previo, seleccionamos el paciente, agregamos los servicios y los montos, y pasamos a registrar el pago."

[ESCENA 4 — Pago]  
"En el paso de pago elegimos el método, ingresamos el monto y confirmamos. Si el paciente paga con varios métodos, podemos registrarlos todos. Al final el wizard muestra el número de factura generada."

---

## Módulo 10: Agenda y turnos

> **Menú:** Citas (calendario en el menú lateral)  
> **URL:** `/appointments`  
> **Permiso:** `APPOINTMENTS_VIEW_CALENDAR` — Ver agenda | `APPOINTMENTS_CREATE` — Crear cita | `APPOINTMENTS_UPDATE` — Editar cita | `APPOINTMENTS_DELETE` — Eliminar cita

> 📸 **Captura:** Vista semanal de la agenda agrupada por doctor, con turnos de colores según servicio/doctor y panel de creación de cita al hacer clic en un horario vacío.

**Cómo acceder:** Menú lateral → **Citas**

La agenda muestra todos los turnos de la clínica y permite crearlos, editarlos y cancelarlos.

**Vistas disponibles:**
- **Día**: vista de un solo día
- **2 Días**: vista de dos días lado a lado
- **3 Días**: vista de tres días
- **Semana**: vista semanal completa
- **Mes**: vista mensual
- **Agenda**: listado cronológico de turnos

**Agrupación:**
- **Por Doctor**: cada columna es un doctor
- **Por Calendario** (consultorio): cada columna es un consultorio
- **Sin agrupar**

**Filtros disponibles:**
- Seleccionar calendarios (consultorios) visibles
- Filtrar por servicio

**Configuración de la agenda** (ícono de ajustes):
- Vista predeterminada al abrir
- Agrupación predeterminada
- Verificar disponibilidad del doctor al crear turnos
- Filtrar doctores por servicio seleccionado

**Para crear un turno:**
1. Hacer clic en un espacio vacío de la agenda o en **Nueva Cita**
2. Completar los campos:

| Campo | Descripción | Requerido |
|-------|-------------|-----------|
| Paciente | Buscar y seleccionar el paciente | Sí |
| Servicios | Uno o más servicios del turno | No |
| Doctor | Doctor que atenderá | No |
| Calendario | Consultorio donde se atenderá | No |
| Fecha y Hora | Fecha y hora de inicio | Sí |
| Hora de Fin | Hora de finalización | No |
| Presupuesto | Presupuesto asociado (opcional) | No |
| Notas | Notas adicionales del turno | No |

3. El sistema puede mostrar **Horas Sugeridas** según disponibilidad del doctor
4. Hacer clic en **Guardar**

**Estados de un turno:** Pendiente → Confirmado → Completado / Cancelado.

---

### 🎬 Guión del video — Módulo 10: Agenda y turnos

**Duración estimada:** 5 minutos

[ESCENA 1 — Menú → Citas]  
"La agenda es el centro de operaciones de la clínica. Vamos a Citas."

[ESCENA 2 — Vistas y agrupación]  
"Podemos ver la agenda por día, semana o mes. Y agruparla por doctor o por consultorio. Eso nos da mucha flexibilidad según cómo trabajemos."

[ESCENA 3 — Crear un turno]  
"Para crear un turno, hacemos clic en el horario que queremos. Buscamos al paciente, elegimos el servicio y el doctor. El sistema puede sugerir horarios disponibles automáticamente."

[ESCENA 4 — Gestión de turnos]  
"Desde la agenda podemos confirmar, cancelar o reagendar turnos. Y asociarlos a un presupuesto si el paciente ya tiene uno creado."

---

## Módulo 11: Caja

> **Menú:** Caja  
> **URL base:** `/cashier`  
> **Permiso de acceso:** `CASHIER_VIEW_MENU` — Ver menú de caja

### 11.1 Cajas registradoras físicas

> **Menú:** Caja → Cajas Registradoras Físicas  
> **URL:** `/cashier/cash-points`  
> **Permiso:** `CASH_REGISTER_VIEW_LIST` — Ver cajas | `CASH_REGISTER_CREATE` — Crear caja | `CASH_REGISTER_UPDATE` — Editar caja

> 📸 **Captura:** Lista de terminales de caja con nombre, descripción y estado (activa/inactiva).

**Cómo acceder:** Menú lateral → **Caja** → **Cajas Registradoras Físicas**

Define las terminales (cajas físicas) disponibles en la clínica. Cada cajero abre su sesión en una terminal específica.

---

### 11.2 Apertura de sesión de caja

> **URL:** `/cashier`  
> **Permiso:** `CASH_SESSION_OPEN` — Abrir sesión de caja | `CASH_SESSION_SET_EXCHANGE_RATE` — Configurar tipo de cambio al abrir

> 📸 **Captura:** Pantalla de apertura de caja con selector de terminal, tipo de cambio vigente y campo de monto inicial.

**Cómo acceder:** Menú lateral → **Caja**

Para operar la caja, es necesario abrir una sesión primero.

**Pasos:**
1. Ir a **Caja**
2. Si no hay sesión abierta, se muestra el estado **Cerrado** con el botón **Abrir**
3. Completar el formulario de apertura:
   - Seleccionar la **Terminal** (caja física)
   - Verificar el **Tipo de Cambio** vigente
   - Ingresar el **Monto de Apertura** (efectivo en caja al inicio del turno)
4. Confirmar la apertura

---

### 11.3 Panel principal de caja

> **URL:** `/cashier`  
> **Permiso:** `CASH_SESSION_VIEW_DETAIL` — Ver detalle de sesión | `CASH_SESSION_VIEW_TRANSACTIONS` — Ver transacciones

> 📸 **Captura:** Panel de caja con sesión abierta mostrando datos de la sesión (terminal, usuario, tipo de cambio) y lista de transacciones del día.

Con la sesión abierta, el panel de caja muestra:
- Información de la sesión: terminal, usuario, fecha y hora de apertura, tipo de cambio
- **Botón Cierre**: para iniciar el cierre al final del turno
- Lista de movimientos del día

---

### 11.4 Categorías y transacciones misceláneas

> **Menú:** Caja → Categorías de Productos y Servicios | Caja → Transacciones Misceláneas  
> **URL:** `/cashier/miscellaneous-categories` | `/cashier/miscellaneous-transactions`  
> **Permiso:** `MISC_TRANSACTION_VIEW_LIST` — Ver transacciones | `MISC_TRANSACTION_CREATE` — Crear transacción

**Categorías misceláneas:**  
**Cómo acceder:** Menú lateral → **Caja** → **Categorías de Productos y Servicios**

Define categorías para clasificar ingresos y egresos que no corresponden a servicios médicos (ej. venta de productos, gastos de limpieza, etc.).

**Transacciones misceláneas:**  
**Cómo acceder:** Menú lateral → **Caja** → **Transacciones Misceláneas**

Permite registrar movimientos de caja no vinculados a pacientes: un ingreso de efectivo puntual, un gasto menor, etc.

---

### 11.5 Cierre de sesión de caja

> **Permiso:** `CASH_SESSION_CLOSE_CONFIRM` — Confirmar cierre | `CASH_SESSION_CLOSE_COUNT` — Conteo de efectivo | `CASH_SESSION_CLOSE_DECLARE` — Declarar totales | `CASH_SESSION_PRINT_CLOSE` — Imprimir cierre

> 📸 **Captura:** Wizard de cierre de caja, paso de conteo de efectivo por denominaciones (UYU/USD) con campo de cantidad y total calculado.

**Pasos del wizard de cierre:**

| Paso | Descripción |
|------|-------------|
| 1. Configuración | Resumen de la sesión y verificación de datos |
| 2. Conteo de Efectivo (UYU) | Ingresar las denominaciones físicas en pesos uruguayos |
| 3. Conteo de Efectivo (USD) | Ingresar las denominaciones en dólares |
| 4. Depósito Bancario (opcional) | Declarar el efectivo que se retirará para el banco, con archivos adjuntos |
| 5. Declarar | Confirmar los totales declarados |
| 6. Revisar | Ver el resumen: total apertura, total contado, diferencia |
| 7. Confirmación | Cerrar la sesión definitivamente |

**Botones de ayuda en el conteo:** **Rellenar con 0** y **Rellenar con último cierre** para agilizar el proceso.

---

### 11.6 Historial de sesiones

> **Menú:** Caja → Sesiones de Caja  
> **URL:** `/cashier/sessions`  
> **Permiso:** `CASH_SESSION_VIEW_LIST` — Ver historial de sesiones

**Cómo acceder:** Menú lateral → **Caja** → **Sesiones de Caja**

Lista de todas las sesiones de caja con fecha, usuario, terminal, monto de apertura, monto de cierre y estado.

---

### 🎬 Guión del video — Módulo 11: Caja

**Duración estimada:** 6 minutos

[ESCENA 1 — Menú → Caja]  
"El módulo de caja maneja toda la operación económica del día. Para empezar a trabajar, necesitamos abrir una sesión de caja."

[ESCENA 2 — Abrir sesión]  
"Vamos a Caja. Si no hay sesión abierta, el sistema muestra 'Cerrado' y el botón Abrir. Seleccionamos la terminal, verificamos el tipo de cambio y declaramos cuánto efectivo hay al inicio. Confirmamos y la sesión queda abierta."

[ESCENA 3 — Panel de caja]  
"El panel nos muestra la información de la sesión: terminal, usuario, hora de apertura, tipo de cambio. Acá también vemos los movimientos del día."

[ESCENA 4 — Transacciones misceláneas]  
"Para registrar un movimiento que no sea un cobro de paciente, usamos Transacciones Misceláneas. Por ejemplo, un gasto menor o un ingreso de efectivo puntual."

[ESCENA 5 — Cierre de caja]  
"Al final del día cerramos la sesión. Hacemos clic en Cierre y seguimos el wizard: contamos el efectivo en UYU y USD, declaramos si hay depósito bancario, revisamos el resumen y confirmamos. El sistema guarda todo el registro."

---

## Módulo 12: Ventas

> **Menú:** Ventas  
> **URL base:** `/sales`  
> **Permiso de acceso:** `SALES_VIEW_MENU` — Ver menú de ventas

El flujo de ventas es: **Presupuesto → Factura → Pago**

### 12.1 Presupuestos

> **Menú:** Ventas → Presupuestos  
> **URL:** `/sales/quotes`  
> **Permiso:** `SALES_QUOTES_VIEW_MENU` — Ver presupuestos | `SALES_QUOTES_CREATE` — Crear | `SALES_QUOTES_CONFIRM` — Confirmar | `SALES_QUOTES_PRINT` — Imprimir

> 📸 **Captura:** Lista de presupuestos con columnas Número, Paciente, Total, Estado (Borrador/Confirmado/Rechazado) y Estado de Facturación.

**Cómo acceder:** Menú lateral → **Ventas** → **Presupuestos**

Los presupuestos detallan los servicios que se realizarán y su costo. Son la primera etapa del ciclo de facturación.

**Acciones sobre un presupuesto:**

| Acción | Descripción |
|--------|-------------|
| Imprimir | Genera el PDF del presupuesto según la plantilla configurada |
| Enviar por Correo | Envía el presupuesto al email del paciente |
| Confirmar | Cambia el estado a Confirmado |
| Rechazar | Cancela el presupuesto con notas opcionales |
| Facturar | Crea una factura a partir del presupuesto confirmado |

**Al enviar por correo:** Se puede especificar múltiples destinatarios separados por coma.

---

### 12.2 Facturas

> **Menú:** Ventas → Facturas  
> **URL:** `/sales/invoices`  
> **Permiso:** `SALES_INVOICES_VIEW_MENU` — Ver facturas | `SALES_INVOICES_CREATE` — Crear | `SALES_INVOICES_CONFIRM` — Confirmar | `SALES_INVOICES_PRINT` — Imprimir | `CREDIT_NOTE_CREATE` — Crear nota de crédito

> 📸 **Captura:** Lista de facturas con número, paciente, total, estado (Borrador/Confirmada) y estado de pago (Pendiente/Parcial/Pagada).

**Cómo acceder:** Menú lateral → **Ventas** → **Facturas**

Registro de todos los documentos de facturación emitidos. Pueden ser **Facturas** o **Notas de Crédito**.

**Columnas principales:** ID de Factura, Paciente, Total, Estado, Estado de Pago, Fecha de creación, Moneda, Tipo.

**Desde una factura se puede:**
- Ver el detalle completo
- Agregar un pago
- Imprimir el documento

**Factura histórica:** Una factura puede marcarse como "Histórico". Esto significa que se registra como un documento del pasado y no se incluye en el cierre de caja actual.

---

### 12.3 Pagos

> **Menú:** Ventas → Pagos  
> **URL:** `/sales/payments`  
> **Permiso:** `SALES_PAYMENTS_VIEW_MENU` — Ver pagos | `SALES_PAYMENTS_CREATE` — Crear pago | `SALES_PREPAYMENTS_CREATE` — Crear prepago | `SALES_PAYMENTS_USE_CREDITS` — Usar créditos

**Cómo acceder:** Menú lateral → **Ventas** → **Pagos**

Registro de todos los pagos recibidos. Los pagos pueden estar asociados a facturas específicas o ser prepagos (pagos a cuenta sin factura asociada).

---

### 🎬 Guión del video — Módulo 12: Ventas

**Duración estimada:** 5 minutos

[ESCENA 1 — Ventas → Presupuestos]  
"El ciclo de ventas arranca con un presupuesto. Vamos a Ventas, Presupuestos, y creamos uno para el paciente con los servicios y precios acordados."

[ESCENA 2 — Confirmar y facturar]  
"Una vez que el paciente acepta, confirmamos el presupuesto y lo convertimos en factura con un solo clic."

[ESCENA 3 — Facturas]  
"En Facturas vemos todos los documentos emitidos. Podemos imprimir, enviar por correo y registrar el pago."

[ESCENA 4 — Pagos]  
"En Pagos tenemos el registro de todos los cobros. Los pagos pueden asociarse a una factura específica o ser un prepago a cuenta del paciente."

---

## Módulo 13: Compras

> **Menú:** Compras  
> **URL base:** `/purchases`  
> **Permiso de acceso:** `PURCHASES_VIEW_MENU` — Ver menú de compras

El módulo de compras funciona de forma espejo al de ventas, orientado a los proveedores.

### 13.1 Presupuestos de compra

> **Menú:** Compras → Presupuestos  
> **URL:** `/purchases/quotes`  
> **Permiso:** `PURCHASE_QUOTES_VIEW_MENU` — Ver presupuestos de compra | `PURCHASE_QUOTES_CREATE` — Crear | `PURCHASE_QUOTES_CONFIRM` — Confirmar

**Cómo acceder:** Menú lateral → **Compras** → **Presupuestos**

---

### 13.2 Facturas de compra

> **Menú:** Compras → Facturas  
> **URL:** `/purchases/invoices`  
> **Permiso:** `PURCHASE_INVOICES_VIEW_MENU` — Ver facturas de compra | `PURCHASE_INVOICES_CREATE` — Crear | `PURCHASE_INVOICES_IMPORT_AI` — Importar con IA

> 📸 **Captura:** Lista de facturas de compra con proveedor, total, estado y opción de importar facturas de proveedores con reconocimiento de IA.

**Cómo acceder:** Menú lateral → **Compras** → **Facturas**

---

### 13.3 Pagos de compra

> **Menú:** Compras → Pagos  
> **URL:** `/purchases/payments`  
> **Permiso:** `PURCHASE_PAYMENTS_VIEW_MENU` — Ver pagos a proveedores | `PURCHASE_PAYMENTS_CREATE` — Crear pago

**Cómo acceder:** Menú lateral → **Compras** → **Pagos**

---

### 13.4 Proveedores

> **Menú:** Compras → Proveedores  
> **URL:** `/purchases/providers`  
> **Permiso:** `SUPPLIERS_VIEW_MENU` — Ver proveedores | `SUPPLIERS_CREATE` — Crear | `SUPPLIERS_TOGGLE_STATUS` — Activar/desactivar

**Cómo acceder:** Menú lateral → **Compras** → **Proveedores**

Gestiona el directorio de proveedores. Incluye resumen financiero por proveedor: total facturado, total pagado, monto por pagar y pagos adelantados.

**Campos al crear un proveedor:**

| Campo | Descripción | Requerido |
|-------|-------------|-----------|
| Nombre | Nombre o razón social | Sí |
| Correo Electrónico | Email de contacto | No |
| Teléfono | Teléfono principal | No |
| Teléfono Alternativo | Teléfono secundario | No |
| Documento de Identidad | RUT o cédula | No |
| Dirección | Dirección del proveedor | No |

---

### 13.5 Productos de proveedores

> **Menú:** Compras → Productos de Proveedores  
> **URL:** `/purchases/services`  
> **Permiso:** `PURCHASE_PRODUCTS_VIEW_MENU` — Ver productos | `PURCHASE_PRODUCTS_CREATE` — Crear producto

**Cómo acceder:** Menú lateral → **Compras** → **Productos de Proveedores**

Catálogo de productos que se compran a los proveedores (insumos, materiales, medicamentos).

---

### 🎬 Guión del video — Módulo 13: Compras

**Duración estimada:** 3 minutos

[ESCENA 1 — Módulo Compras]  
"El módulo de compras funciona igual que el de ventas pero para los proveedores de la clínica. Vamos a Compras en el menú."

[ESCENA 2 — Proveedores y productos]  
"Primero registramos los proveedores y sus productos o insumos. Después podemos generar presupuestos de compra, convertirlos en facturas y registrar los pagos a proveedores."

---

## Módulo 14: Centro de alertas

> **Menú:** Centro de Alertas (campana en el menú lateral)  
> **URL:** `/alerts`  
> **Permiso:** `ALERT_CENTER_VIEW_MENU` — Ver centro de alertas | `ALERT_CENTER_VIEW_LIST` — Ver lista | `ALERT_CENTER_COMPLETE` — Marcar completada | `ALERT_CENTER_ASSIGN` — Asignar | `ALERT_CENTER_BULK_ACTIONS` — Acciones en lote

> 📸 **Captura:** Centro de alertas con KPIs (pendientes, completadas, ignoradas) y lista de alertas con filtros por prioridad, categoría y estado.

**Cómo acceder:** Menú lateral → **Centro de Alertas**

Centraliza todas las alertas generadas automáticamente por el sistema: turnos sin confirmar, pagos vencidos, recordatorios, seguimientos post-consulta, etc.

**Secciones del centro de alertas:**
- **KPIs**: cantidad de alertas por estado (pendientes, completadas, ignoradas)
- **Lista de alertas**: con filtros por estado, prioridad y categoría
- **Paginación**: navegación entre alertas

**Acciones sobre una alerta:**

| Acción | Descripción |
|--------|-------------|
| Enviar Email | Envía un email al paciente vinculado a la alerta |
| Enviar SMS | Envía un SMS al paciente |
| Registrar Llamada | Registra que se contactó al paciente telefónicamente |
| Completar | Marca la alerta como resuelta |
| Posponer (Snooze) | Pospone la alerta a una fecha y hora posterior |
| Ignorar | Descarta la alerta sin acción |

**Acciones masivas:** Seleccionar múltiples alertas y completar, ignorar o posponer todas a la vez.

---

### 🎬 Guión del video — Módulo 14: Centro de alertas

**Duración estimada:** 3 minutos

[ESCENA 1 — Centro de Alertas]  
"El Centro de Alertas nos muestra todas las comunicaciones pendientes con los pacientes: turnos sin confirmar, pagos vencidos, recordatorios."

[ESCENA 2 — Gestionar alertas]  
"Desde cada alerta podemos enviar un email, un SMS, registrar una llamada o marcarla como completada. Si necesitamos atenderla después, la posponemos con el snooze."

[ESCENA 3 — Acciones masivas]  
"También podemos seleccionar múltiples alertas y ejecutar una acción en lote para trabajar más rápido."

---

## Módulo 15: Reportes

> **Menú:** Reportes  
> **URL base:** `/reports`  
> **Permiso:** `REPORTS_VIEW_MENU` — Ver módulo de reportes | `REPORTS_EXPORT_PDF` — Exportar a PDF | `REPORTS_EXPORT_EXCEL` — Exportar a Excel

> 📸 **Captura:** Menú de reportes desplegado con las 21 opciones organizadas por categoría.

**Cómo acceder:** Menú lateral → **Reportes**

El módulo de reportes ofrece 21 informes organizados en 6 categorías. Todos los reportes permiten filtrar por rango de fechas y exportar los resultados a PDF o Excel.

---

### Reportes de Caja

#### Cierre de Caja
**Ruta:** Reportes → Cierre de Caja  
**Permiso:** `REPORTS_CAJA_VIEW`  
Resumen del cierre diario de caja: efectivo contado, diferencias con lo declarado, depósitos bancarios.

#### Cobros del Día
**Ruta:** Reportes → Cobros del Día  
**Permiso:** `REPORTS_CAJA_VIEW`  
Detalle de todos los cobros realizados en el día, desglosados por método de pago.

#### Cuentas Corrientes
**Ruta:** Reportes → Cuentas Corrientes  
**Permiso:** `REPORTS_INGRESOS_VIEW`  
Estado de cuenta de cada paciente: saldo deudor, pagos realizados y créditos disponibles.

#### Estado de Presupuestos
**Ruta:** Reportes → Estado de Presupuestos  
**Permiso:** `REPORTS_INGRESOS_VIEW`  
Resumen del estado de todos los presupuestos: pendientes, confirmados, rechazados, facturados.

---

### Reportes de Producción

#### Producción por Doctor
**Ruta:** Reportes → Producción por Doctor  
**Permiso:** `REPORTS_PRODUCCION_VIEW`  
Comparativo de producción clínica por doctor en el período seleccionado.

#### Tratamientos
**Ruta:** Reportes → Tratamientos  
**Permiso:** `REPORTS_PRODUCCION_VIEW`  
Listado de tratamientos realizados con detalle por tipo de servicio.

#### Comparativo de Producción
**Ruta:** Reportes → Comparativo de Producción  
**Permiso:** `REPORTS_PRODUCCION_VIEW`  
Comparación de la producción entre dos períodos seleccionados.

#### Honorarios
**Ruta:** Reportes → Honorarios  
**Permiso:** `REPORTS_PRODUCCION_VIEW`  
Detalle de los honorarios generados por cada doctor en el período.

---

### Reportes de Pacientes

#### Nuevos Pacientes
**Ruta:** Reportes → Nuevos Pacientes  
**Permiso:** `REPORTS_PACIENTES_VIEW`  
Pacientes registrados por primera vez en el período.

#### Pacientes Inactivos
**Ruta:** Reportes → Pacientes Inactivos  
**Permiso:** `REPORTS_PACIENTES_VIEW`  
Pacientes sin actividad registrada en el período configurado.

#### Tratamientos en Curso
**Ruta:** Reportes → Tratamientos en Curso  
**Permiso:** `REPORTS_PACIENTES_VIEW`  
Pacientes con tratamientos activos en progreso.

---

### Reportes de Agenda

#### Ocupación de Agenda
**Ruta:** Reportes → Ocupación de Agenda  
**Permiso:** `REPORTS_AGENDA_VIEW`  
Porcentaje de ocupación de la agenda por doctor y período.

#### Cancelaciones
**Ruta:** Reportes → Cancelaciones  
**Permiso:** `REPORTS_AGENDA_VIEW`  
Turnos cancelados con detalle por doctor, motivo y período.

---

### Reportes de Ingresos

#### Ingresos del Período
**Ruta:** Reportes → Ingresos del Período  
**Permiso:** `REPORTS_INGRESOS_VIEW`  
Total de ingresos facturados y cobrados en el período.

#### Facturación y Cobranza
**Ruta:** Reportes → Facturación y Cobranza  
**Permiso:** `REPORTS_INGRESOS_VIEW`  
Comparativo entre lo facturado y lo efectivamente cobrado.

#### Deudores
**Ruta:** Reportes → Deudores  
**Permiso:** `REPORTS_INGRESOS_VIEW`  
Lista de pacientes con saldo deudor pendiente.

#### Servicios
**Ruta:** Reportes → Servicios  
**Permiso:** `REPORTS_INGRESOS_VIEW`  
Ingresos desglosados por tipo de servicio prestado.

---

### Reportes de Gastos

#### Gastos Operativos
**Ruta:** Reportes → Gastos Operativos  
**Permiso:** `REPORTS_GASTOS_VIEW`  
Gastos registrados por categoría en el período.

---

### Reportes de Gestión

#### Estado de Resultados
**Ruta:** Reportes → Estado de Resultados  
**Permiso:** `REPORTS_GESTION_VIEW`  
Resumen de ingresos, gastos y resultado neto del período.

#### KPIs
**Ruta:** Reportes → KPIs  
**Permiso:** `REPORTS_GESTION_VIEW`  
Indicadores clave de desempeño de la clínica.

---

### 🎬 Guión del video — Módulo 15: Reportes

**Duración estimada:** 5 minutos

[ESCENA 1 — Menú → Reportes]  
"El módulo de reportes nos da visibilidad sobre todo lo que pasa en la clínica. Hay 21 reportes organizados en seis categorías."

[ESCENA 2 — Filtros de fecha y exportar]  
"Todos los reportes tienen filtros de fecha. Seleccionamos el período y el sistema calcula los datos. Podemos exportar a PDF o Excel."

[ESCENA 3 — Reportes de Caja]  
"Los reportes de Caja nos dan el detalle del movimiento económico diario: cobros, cierres y estado de cuenta de los pacientes."

[ESCENA 4 — Reportes de Producción]  
"Los reportes de Producción muestran cuánto produjo cada doctor, qué tratamientos se realizaron y cuáles son los honorarios."

[ESCENA 5 — Reportes de Pacientes y Agenda]  
"Los reportes de Pacientes ayudan a detectar quiénes hay que recontactar. Los de Agenda muestran la ocupación y las cancelaciones."

[ESCENA 6 — Reportes de Gestión]  
"El Estado de Resultados y los KPIs son los reportes de gestión: dan el panorama financiero completo del período."

---

## Módulo 16: TV Display

> **Menú:** TV Display  
> **URL:** `/tv-display`  
> **Permiso:** `TV_DISPLAY_VIEW_MENU` — Ver TV Display | `TV_DISPLAY_UPDATE_SETTINGS` — Controlar display | `TV_DISPLAY_VIEW_SCREEN` — Ver pantalla

> 📸 **Captura:** Panel de control del TV Display con botón "Llamar próximo paciente" y vista previa de lo que se muestra en la pantalla de sala de espera.

**Cómo acceder:** Menú lateral → **TV Display**

Permite configurar una pantalla de sala de espera que muestra información para los pacientes: el nombre del próximo paciente a ser llamado, mensajes de la clínica y contenido promocional.

**Configuración:**
- Ajustar el contenido que aparecerá en la pantalla
- Configurar mensajes de bienvenida y promocionales

**Para mostrar la pantalla en el TV:**
1. Ir a **TV Display** en el menú
2. Abrir la URL de la pantalla en el navegador del TV o pantalla de sala de espera
3. Desde el panel de control, el operador puede:
   - Llamar al siguiente paciente (su nombre aparece en la pantalla)
   - Pausar o reanudar el display
   - Cambiar el contenido mostrado

**Permiso requerido para controlar el display:** `TV_DISPLAY_UPDATE_SETTINGS`

---

### 🎬 Guión del video — Módulo 16: TV Display

**Duración estimada:** 2 minutos

[ESCENA 1 — TV Display]  
"Si la clínica tiene una pantalla en la sala de espera, el módulo TV Display la controla. Configuramos el contenido desde el panel y en el TV abrimos la URL de la pantalla."

[ESCENA 2 — Llamar paciente]  
"Cuando es el turno de un paciente, hacemos clic en Llamar y el nombre aparece en la pantalla de la sala de espera automáticamente."

---

## Módulo 17: Estudios DICOM

> **Menú:** Pacientes → Estudios / Estudios Compartidos  
> **URL base:** `/studies` | `/shared-studies`  
> **Permiso:** `DICOM_VIEW_MENU` — Ver módulo DICOM

### 17.1 Mis estudios

> **URL:** `/studies`  
> **Permiso:** `DICOM_VIEW_STUDIES` — Ver estudios propios | `DICOM_USE_MPR` — Vista 3D MPR | `DICOM_USE_MEASUREMENTS` — Herramientas de medición | `DICOM_ADD_ANNOTATIONS` — Agregar anotaciones

> 📸 **Captura:** Visor DICOM con imagen de radiografía, panel de herramientas (medición, anotaciones, ajuste de ventana) y selector de layout.

**Cómo acceder:** Menú lateral → **Pacientes** → **Estudios**

Visualizador de imágenes médicas en formato DICOM (radiografías, tomografías, resonancias magnéticas).

**Funciones del visor:**
- Visualización de imágenes DICOM de alta resolución
- Herramientas de medición sobre la imagen
- Ajuste de ventana (brillo y contraste)
- Anotaciones sobre la imagen
- Vista MPR (Multi-Planar Reconstruction) para imágenes 3D
- Cambio de layout (1 imagen, 2x2, etc.)

---

### 17.2 Estudios compartidos

> **URL:** `/shared-studies`  
> **Permiso:** `DICOM_VIEW_SHARED_STUDIES` — Ver estudios compartidos

**Cómo acceder:** Menú lateral → **Pacientes** → **Estudios Compartidos**

Permite generar un enlace externo para que el paciente pueda ver sus propios estudios desde cualquier dispositivo, sin necesidad de acceder al sistema.

---

### 🎬 Guión del video — Módulo 17: Estudios DICOM

**Duración estimada:** 3 minutos

[ESCENA 1 — Estudios]  
"Para clínicas que manejan imágenes médicas como radiografías o tomografías, el sistema incluye un visor DICOM integrado."

[ESCENA 2 — Herramientas del visor]  
"Desde el visor podemos ajustar el contraste, hacer mediciones directamente sobre la imagen y agregar anotaciones. También hay una vista 3D para tomografías."

[ESCENA 3 — Compartir estudios]  
"Los estudios compartidos generan un enlace para que el paciente vea sus propias imágenes desde cualquier dispositivo, sin necesidad de acceder al sistema."

---

## Módulo 18: Mi Consultorio (Workspace del doctor)

> **Menú:** Mi Consultorio (ícono de estetoscopio en el menú lateral)  
> **URL:** `/workspace`  
> **Permiso:** `DASHBOARD_DOCTOR_WORKSPACE_ACCESS` — Acceder al espacio de trabajo del doctor

> 📸 **Captura:** Workspace del doctor con la agenda del día (lista de turnos), alertas clínicas del paciente seleccionado y acceso directo a la historia clínica.

**Cómo acceder:** Menú lateral → **Mi Consultorio**

Mi Consultorio es la vista de operación diaria del doctor. Centraliza en una sola pantalla todo lo que necesita durante la jornada de trabajo sin tener que navegar por distintos módulos.

### Qué muestra

- **Agenda del día**: todos los turnos del doctor para la fecha actual, con hora, paciente, servicio y estado
- **Alertas clínicas del paciente seleccionado**: alergias registradas, condiciones críticas (nivel 3) de la historia clínica, medicación relevante — visibles antes de atender al paciente
- **Acceso directo a la historia clínica**: desde cada turno se puede abrir el expediente del paciente y registrar la sesión clínica

> El workspace puede abrirse directamente desde la agenda usando el acceso rápido de un turno específico (deep-link por `appointmentId`).

---

### Notificaciones por cambio de estado de citas

Cuando la recepcionista o secretaria **modifica el estado de un turno** desde la agenda (ej. marca al paciente como "llegó" o "confirmado"), el doctor recibe una notificación automática en Mi Consultorio.

El formato de la notificación depende de las preferencias del doctor (configuradas en Preferencias → Espacio de trabajo):

| Formato | Descripción |
|---------|-------------|
| **Modal** | Aparece una ventana emergente que requiere que el doctor la cierre. Texto: "El estado de una de tus citas de hoy fue actualizado externamente." |
| **Notificación** | Aparece un banner discreto en la esquina de la pantalla que desaparece solo |

Si varios turnos cambian de estado simultáneamente: "N citas en tu agenda de hoy cambiaron de estado."

El doctor puede ver el detalle del cambio directamente desde la notificación.

---

### Registro de sesión clínica

Durante o después de la consulta, el doctor registra la sesión clínica desde el turno activo:

1. Seleccionar el turno en la agenda del workspace
2. Acceder al expediente del paciente
3. Registrar: procedimiento realizado, diagnóstico, próximos pasos
4. Guardar la sesión

---

### Notificación a la secretaria al finalizar sesión

Cuando el doctor **completa y guarda una sesión clínica**, el sistema envía una notificación automática a la secretaria/recepcionista con un modal de acción:

**Título del modal:** "Sesión clínica registrada"  
**Descripción:** "El Dr./Dra. {nombre del doctor} completó una sesión para {nombre del paciente}."

**Información mostrada en el modal:**
- Procedimiento realizado
- Plan para la próxima cita (si el doctor lo registró)
- Cantidad de tratamientos registrados en la sesión

**Acciones disponibles para la secretaria:**

| Acción | Condición | Descripción |
|--------|-----------|-------------|
| **Crear presupuesto** | Siempre visible | Abre el wizard de creación de presupuesto para el paciente |
| **Agendar próxima cita** | Visible si el doctor registró un plan de siguiente cita | Abre la agenda para crear el próximo turno |
| **Generar factura** | Visible si no hay presupuesto pendiente | Abre el Cobro Rápido para facturar y cobrar los servicios del día |

Este flujo permite que la atención clínica y la operación administrativa estén sincronizadas sin necesidad de comunicación manual entre el doctor y la recepción.

---

### 🎬 Guión del video — Módulo 18: Mi Consultorio

**Duración estimada:** 5 minutos

[ESCENA 1 — Mi Consultorio]  
"Mi Consultorio es la vista de trabajo del doctor. Desde acá puede ver todos sus turnos del día y acceder a la información clínica de cada paciente antes de atenderlo."

[ESCENA 2 — Alertas clínicas]  
"Cuando el doctor selecciona un turno, el sistema muestra las alertas clínicas del paciente: alergias, condiciones críticas, medicación importante. Eso le permite prepararse antes de que el paciente entre al consultorio."

[ESCENA 3 — Notificación de cambio de estado]  
"Cuando la recepcionista marca que el paciente llegó o confirma un turno, el doctor recibe una notificación automática en pantalla. El formato puede ser un popup o una notificación discreta según las preferencias configuradas."

[ESCENA 4 — Registrar sesión clínica]  
"Al finalizar la consulta, el doctor registra la sesión clínica desde el turno: el procedimiento realizado, el diagnóstico y el plan para la próxima visita."

[ESCENA 5 — Notificación a la secretaria]  
"En cuanto el doctor guarda la sesión, la secretaria recibe una notificación automática con un resumen: qué se realizó y qué sigue. Desde ese aviso puede directamente crear el presupuesto, agendar la próxima cita o abrir el cobro rápido para facturar los servicios del día. Todo coordinado sin necesidad de llamarse entre consultorios."

---

## Módulo 19: Administración del sistema

> **Menú:** Sistema  
> **URL base:** `/system`  
> **Permiso de acceso:** `SYSTEM_VIEW_MENU` — Ver menú del sistema

### 19.1 Configuración del sistema

> **Menú:** Sistema → Configuraciones  
> **URL:** `/system/config`  
> **Permiso:** `SYS_CONFIG_VIEW_MENU` — Ver configuración del sistema | `SYS_CONFIG_UPDATE` — Editar parámetros

**Cómo acceder:** Menú lateral → **Sistema** → **Configuraciones**

Parámetros globales del sistema en formato clave-valor. Permite ajustar comportamientos avanzados del sistema.

---

### 19.2 Importar datos

> **Menú:** Sistema → Importar Datos  
> **URL:** `/system/import`  
> **Permiso:** `IMPORT_DATA_VIEW_MENU` — Ver módulo de importación | `IMPORT_DATA_EXECUTE` — Ejecutar importación

> 📸 **Captura:** Wizard de importación en paso de Mapeo de columnas: tabla con columnas del CSV a la izquierda y campos del sistema a la derecha.

**Cómo acceder:** Menú lateral → **Sistema** → **Importar Datos**

Wizard para importar registros en masa desde archivos CSV.

**Pasos del wizard:**

| Paso | Descripción |
|------|-------------|
| 1. Tipo | Seleccionar qué tipo de datos importar |
| 2. Archivo | Subir el archivo CSV |
| 3. Vista Previa | Verificar el contenido del archivo |
| 4. Mapeo | Asociar las columnas del CSV con los campos del sistema |
| 5. Validación | El sistema verifica los datos y marca errores |
| 6. Resultado | Resumen de registros importados y errores encontrados |

---

### 19.3 Log de auditoría

> **Menú:** Sistema → Registro de Auditoría  
> **URL:** `/system/audit`  
> **Permiso:** `AUDIT_LOG_VIEW_MENU` — Ver log de auditoría | `AUDIT_LOG_VIEW_DETAIL` — Ver detalle de evento

**Cómo acceder:** Menú lateral → **Sistema** → **Registro de Auditoría**

Registro completo de todas las acciones realizadas en el sistema: creaciones, ediciones y eliminaciones, con usuario, fecha y detalle de qué cambió.

---

### 19.4 Log de accesos

> **Menú:** Sistema → Registro de Acceso  
> **URL:** `/system/access`  
> **Permiso:** `ACCESS_LOG_VIEW_MENU` — Ver log de accesos | `ACCESS_LOG_VIEW_LIST` — Ver lista

**Cómo acceder:** Menú lateral → **Sistema** → **Registro de Acceso**

Historial de todos los inicios de sesión: quién accedió, desde qué dispositivo y en qué momento.

---

### 19.5 Log de errores

> **Menú:** Sistema → Registro de Errores  
> **URL:** `/system/errors`  
> **Permiso:** `ERROR_LOG_VIEW_MENU` — Ver log de errores | `ERROR_LOG_VIEW_LIST` — Ver lista

**Cómo acceder:** Menú lateral → **Sistema** → **Registro de Errores**

Errores del sistema para diagnóstico técnico. Útil para reportar incidentes al equipo de soporte.

---

### 19.6 Historial de comunicaciones

**Cómo acceder:** Menú lateral → **Sistema** → **Historial de Alertas**  

> **Menú:** Sistema → Historial de Alertas  
> **URL:** `/system/communication-history`  
> **Permiso:** `ALERT_HISTORY_VIEW_MENU` — Ver historial | `ALERT_HISTORY_VIEW_LIST` — Ver lista | `ALERT_HISTORY_VIEW_DETAIL` — Ver detalle

Registro de todos los emails y SMS enviados a los pacientes, con estado de entrega y marca de tiempo.

---

### 19.7 Historial de ejecuciones de alertas

> **Menú:** Sistema → Ejecuciones de Alertas  
> **URL:** `/system/execution-history`  
> **Permiso:** `ALERT_EXECUTIONS_VIEW_MENU` — Ver historial de ejecuciones | `ALERT_EXECUTIONS_VIEW_DETAIL` — Ver detalle

**Cómo acceder:** Menú lateral → **Sistema** → **Ejecuciones de Alertas**

Registro de cada vez que el programador automático de alertas se ejecutó, con detalle de las alertas generadas en cada ejecución.

---

### 🎬 Guión del video — Módulo 19: Administración del sistema

**Duración estimada:** 4 minutos

[ESCENA 1 — Sistema]  
"El módulo de Sistema tiene las herramientas de administración más avanzadas. Están pensadas para el administrador o el equipo técnico de Invoke IA."

[ESCENA 2 — Importar datos]  
"La importación de datos permite cargar pacientes, servicios u otros registros en forma masiva desde un archivo CSV. Un wizard guía paso a paso: seleccionás el tipo de dato, subís el archivo, mapeás las columnas y el sistema valida todo antes de importar."

[ESCENA 3 — Logs de auditoría y acceso]  
"Los registros de auditoría y acceso son fundamentales para la seguridad. Permiten saber quién hizo qué y cuándo: quién modificó un dato, quién inició sesión y desde dónde."

[ESCENA 4 — Historial de comunicaciones]  
"El historial de comunicaciones muestra todos los emails y SMS enviados a los pacientes, con el estado de entrega. Es muy útil para confirmar que los recordatorios llegaron."

---

*Fin del documento — Invoke IA v3.2 — Mayo 2026*
