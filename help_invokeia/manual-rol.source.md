# Cómo usar este manual

Este documento **no se lee de principio a fin**. Está hecho para buscar una pregunta concreta, encontrarla, resolverla y volver al trabajo.

## Dos documentos, dos usos

| Documento | Para qué sirve |
| --- | --- |
| **Guía de Usuario** (por módulos) | Entender qué hace cada pantalla del sistema y cómo se configura. Es la referencia completa, ordenada por módulo. |
| **Manual de Trabajo** (este) | Resolver una tarea concreta. Ordenado por rol y por pregunta, no por módulo. |

Los dos cubren la misma funcionalidad. Cambia la puerta de entrada: uno se organiza por **dónde está** la función, el otro por **quién la necesita y para qué**.

## Cómo encontrar lo que buscás

Hay tres caminos, y cualquiera sirve:

1. **Por tu rol.** Andá a la parte que te corresponde (Recepción, Consultorio, Caja, Gerencia, Administración) y recorré sus preguntas.
2. **Por la pregunta.** El **Índice de preguntas** del final las lista todas en orden alfabético, con su página.
3. **Por el síntoma.** Si algo no funciona, andá directo a **Diagnóstico**: está ordenado por lo que ves en pantalla, no por la causa.

## Cada entrada es independiente

Una entrada responde su pregunta **sin obligarte a leer nada anterior**. Si necesita un dato de otra, lo dice explícitamente en *Ver también*. Eso significa que hay repetición entre partes: es deliberada. Si la misma tarea la hacen la recepción y la caja, aparece en las dos.

## Cómo está escrita cada entrada

```
¿Cómo hago X?                          ← la pregunta, tal como se formula

Respuesta directa y camino en pantalla.

Pasos, si hacen falta.

Permiso: CÓDIGO · Requiere: qué tiene que estar configurado antes
Ver también: otras entradas relacionadas
```

## Los dos tipos de recuadro

Esta es la convención más importante del documento, porque separa **lo que el sistema hace** de **lo que nosotros sugerimos hacer**:

> **Así funciona.** Recuadro de borde sólido. Describe el comportamiento real del sistema: valores por defecto, validaciones, qué pasa al pulsar un botón, qué permiso gobierna qué. Es verificable y no es opinable.

> **Recomendación.** Recuadro de borde punteado. Es criterio de uso, no comportamiento del sistema. Son sugerencias sobre cómo conviene trabajar, basadas en cómo está diseñada la herramienta, pero cada clínica puede hacerlo distinto sin que nada deje de funcionar.

Cuando leas un recuadro punteado, sabés que estás leyendo un consejo. Cuando leas uno sólido, sabés que estás leyendo el sistema.

> **IMAGEN 0.1** — Ejemplo de una entrada del manual señalando sus partes: pregunta, respuesta, línea de permisos y los dos tipos de recuadro.

## Convenciones

| Elemento | Significado |
| --- | --- |
| `/ruta` | URL dentro del sistema. Se antepone el idioma: `/es/patients`. |
| `PERMISO` | Código asignable a un rol desde **Sistema → Roles**. |
| **Negrita** | Nombre literal de un botón, campo o pestaña. |
| → | Secuencia de clics. **Menú → Submenú → Opción**. |

# PARTE 0 — PARA TODOS

Todo lo de esta parte aplica a cualquier cuenta del sistema, sin importar el rol.

## Entrar y salir

### ¿Cómo entro al sistema? {#q001}

Abrí `/login`, ingresá tu **correo electrónico** y tu **contraseña**, y pulsá **Entrar**.

Arriba a la derecha, antes de entrar, podés cambiar el **idioma** (Español / English) y el **tema** (Claro / Oscuro / Sistema).

> **Así funciona.** El sistema distingue los dos errores posibles y lo dice: *«El correo electrónico ingresado no existe en nuestro sistema»* significa que la cuenta no está dada de alta; *«Las credenciales que ingresaste son incorrectas»* significa que la cuenta existe pero la contraseña no coincide.

*Ver también: ¿Por qué entro a una pantalla distinta que mi compañero?*

### Soy nuevo en la clínica, ¿cómo creo mi contraseña? {#q002}

No te la asigna nadie: la definís vos. Vas a recibir **un correo con un enlace**. Al abrirlo llegás a `/set-first-password`, donde escribís tu contraseña dos veces.

Requisitos: mínimo **8 caracteres**, al menos **una mayúscula** y **un número**.

> **Así funciona.** El enlace caduca. Si venció, pedí que te lo reenvíen desde tu ficha de usuario. Si ya lo usaste, el sistema responde *«Tu primera contraseña ya fue establecida»* y te manda a iniciar sesión.

### Olvidé mi contraseña {#q003}

En `/login`, pulsá **¿Olvidó su contraseña?**, ingresá tu correo y recibirás un enlace para definir una nueva.

> **Así funciona.** Si el enlace expiró o no es válido, el sistema lo dice y ofrece pedir uno nuevo. No falla en silencio.

### ¿Cómo cambio mi contraseña estando dentro? {#q004}

Avatar (abajo en la barra lateral izquierda) → **Cambiar contraseña**. Pide la actual y la nueva dos veces.

*Permiso: `PROFILE_CHANGE_PASSWORD`*

### ¿Cómo cierro sesión? {#q005}

Avatar → **Cerrar sesión**.

> **Así funciona.** Antes de cerrar, el sistema verifica si tenés **una sesión de caja abierta**. Si la tenés, te avisa antes de dejarte salir. Es una protección deliberada para que nadie se vaya sin arquear.

### ¿Por qué entro a una pantalla distinta que mi compañero? {#q006}

Porque el sistema te lleva **a la primera pantalla a la que realmente tenés acceso**. Si tu rol no incluye el Panel de Control, no vas a aterrizar en una pantalla vacía: entrás directo a la primera opción disponible de tu menú.

## Moverse por la pantalla

### ¿Cómo está organizada la pantalla? {#q007}

Tres zonas fijas:

1. **Barra lateral izquierda** — el menú de navegación y, abajo, tu avatar con las opciones de cuenta.
2. **Centro** — donde trabajás: listados, formularios, calendario, gráficos.
3. **Panel flotante derecho** — herramientas que necesitás desde cualquier pantalla.

> **IMAGEN 0.2** — Vista general de la aplicación con las tres zonas señaladas.

### ¿Qué es el panel de la derecha y qué tiene? {#q008}

Es una tira vertical pegada al borde derecho. Se despliega y se colapsa. Cuando está colapsado queda una pestaña finita arriba a la derecha.

Contiene, según tus permisos:

| Acceso | Para qué |
| --- | --- |
| **Paciente** | Buscar un paciente desde cualquier pantalla y abrir su ficha. |
| **Sede** | Elegir en qué sede estás trabajando. |
| **Caja** | Ver el estado de la sesión de caja y el saldo del cajón. |
| **TV** | Encender, apagar o pausar la pantalla de sala de espera. |
| **Cobrar** | Abrir el asistente **Cobro Rápido**. |
| **Alertas** | Ver las alertas pendientes. |
| **Cambio** | El tipo de cambio del día. |
| **Inbox** | Las notificaciones del sistema. |
| **Notas** | Notas adhesivas sobre la pantalla. |
| **Chat / Voz / Mic** | El asistente conversacional y el dictado. |

> **Así funciona.** Cuando llega algo que requiere atención y el panel está colapsado, la pestaña **parpadea y asoma el ícono** de lo que llegó (una alerta, un mensaje, una nota), así sabés qué te reclama sin tener que abrirlo.

### ¿Por qué no veo un menú que sí ve mi compañero? {#q009}

Porque el menú **se filtra por permisos**. Si tu rol no tiene el permiso de ese módulo, el ítem no existe para vos: no aparece en gris ni da error, directamente no está.

Hablá con quien administre los roles y decile qué pantalla necesitás.

*Ver también: Parte 5 → ¿Por qué un usuario no ve algo que debería ver?*

### ¿Cómo cambio entre vista de tabla y vista de lista? {#q010}

En la barra superior de cualquier listado hay un conmutador **tabla / lista**.

> **Así funciona.** El sistema cambia solo a tarjetas cuando corresponde: al seleccionar un registro y comprimirse el listado, o cuando la ventana es angosta. El conmutador sirve para forzarlo a mano.

### ¿Cómo agrando el panel de la izquierda o el de la derecha? {#q011}

Arrastrando el divisor que los separa.

> **Así funciona.** La posición queda guardada en tu navegador: la próxima vez que abras esa pantalla, la vas a encontrar como la dejaste.

### ¿Cómo dicto en vez de escribir? {#q012}

Los campos de texto largo (notas clínicas, diagnósticos, descripciones, observaciones) tienen un **ícono de micrófono** adentro. Pulsalo y hablá: lo que digas se transcribe en el campo.

> **Recomendación.** Es lo más útil durante la atención: permite registrar la evolución sin soltar el instrumental ni quitarse los guantes.

### ¿Qué pasa si cierro un formulario sin guardar? {#q013}

El sistema detecta los cambios pendientes y pregunta **«¿Descartar cambios?»** antes de perderlos. Los diálogos tampoco se cierran por un clic accidental fuera de ellos.

## Tu configuración personal

### ¿Cómo cambio el idioma? {#q014}

Avatar → **Idioma** → Español / English. El cambio es inmediato y se refleja en la dirección (`/es/...` ↔ `/en/...`).

*Permiso: `GLOBAL_CHANGE_LANGUAGE`*

### ¿Cómo paso a modo oscuro? {#q015}

Avatar → **Tema** → Claro / Oscuro / Sistema. «Sistema» sigue la configuración de tu computadora.

*Permiso: `GLOBAL_CHANGE_THEME`*

### ¿Dónde configuro mis preferencias? {#q016}

Avatar → **Preferencias**, o directamente `/preferences`. Todo lo que configurés ahí **afecta solo a tu cuenta**: dos personas usando la misma computadora con cuentas distintas ven configuraciones distintas.

Secciones: Notificaciones · Finanzas del paciente · Firma · Espacio de trabajo · Calendario.

### ¿Cómo cambio dónde aparecen los mensajes de confirmación? {#q017}

**Preferencias → Notificaciones → Posición de los mensajes**: Arriba centro · Arriba derecha · Abajo centro · Abajo derecha.

La pantalla muestra una vista previa en vivo con el texto *«Los mensajes se mostrarán aquí»*.

> **Así funciona.** En pantallas pequeñas los mensajes **siempre** aparecen arriba, respetando el área segura del dispositivo. Esta preferencia solo tiene efecto de tablet en adelante.

### ¿Cómo cargo mi firma? {#q018}

**Preferencias → Firma.** Dos maneras:

- **Subir una imagen.** PNG, JPG o WEBP, máximo 1 MB.
- **Dibujarla.** Se abre un panel donde trazás la firma con el ratón, el dedo o un lápiz digital. Se guarda como imagen con fondo transparente.

> **Así funciona.** La firma se imprime al pie de **las recetas médicas que emitas vos**. Si no la cargás, tus recetas salen sin firmar y el sistema te lo advierte al emitirlas.

> **Recomendación.** Si subís una imagen, que tenga fondo transparente. Una firma sobre fondo blanco deja un rectángulo visible sobre el membrete de la receta.

*Permiso: `USER_SIGNATURE_UPLOAD` · Ver también: Parte 2 → ¿Por qué dice que la receta saldrá sin firmar?*

### ¿Cómo elijo o cambio mi sede de trabajo? {#q019}

Panel flotante derecho → **Sede**.

> **Así funciona.** Si todavía no elegiste sede, el sistema te la pide al entrar con un modal que no se puede saltear: *«Debes elegir la sede en la que vas a trabajar antes de continuar.»* La sede determina qué consultorios y agendas ves por defecto y a qué sede se imputan las operaciones que registrás.

### ¿Cómo dejo una nota pegada en la pantalla? {#q020}

Panel flotante derecho → **Notas**. Quedan superpuestas sobre la pantalla, como un papel adhesivo.

> **Así funciona.** Las notas adhesivas **no tienen fecha y no aparecen en el calendario**. Son un apunte visual tuyo. Si querés algo con fecha, hora y aviso, eso es un **recordatorio** y se crea desde el calendario.

*Permiso: `STICKY_NOTES_VIEW`, `STICKY_NOTES_CREATE` · Ver también: Parte 1 → ¿Cómo dejo un recordatorio para el equipo?*

### ¿Cómo busco un paciente estando en cualquier pantalla? {#q021}

Panel flotante derecho → **Paciente**. Escribí el nombre y elegí: se abre su ficha sin perder dónde estabas.

*Permiso: `PATIENTS_VIEW_LIST`*

# PARTE 1 — RECEPCIÓN

**Quién.** El rol **Recepcionista** y quien haga atención al paciente: agenda, alta de pacientes, presupuestos y cobro de mostrador.

**Qué ve.** Citas · Pacientes · Ventas · Caja · Centro de Alertas · Pantalla TV.

**Qué no ve.** La historia clínica y la configuración del negocio.

> **IMAGEN 1.1** — El calendario tal como lo ve la recepción, con el panel de agendas y el panel flotante derecho desplegado.

---

## La agenda: agendar

### ¿Cómo agendo una cita? {#q022}

Hay cinco caminos. Todos válidos; cambia el punto de partida.

| Camino | Cuándo conviene |
| --- | --- |
| Botón **Crear** del calendario | Cuando tenés todos los datos y querés el formulario completo. |
| **Clic en un hueco** del calendario | Cuando ya sabés el día y la hora. Precarga fecha y hora. |
| Desde la **ficha del paciente** → **Crear → Cita** | Cuando venías trabajando sobre ese paciente. |
| Desde el **panel de huecos disponibles** | Cuando el paciente pregunta «¿cuándo tenés lugar?». |
| Lo reserva **el propio paciente** desde el portal | Sin intervención de la recepción. |

*Permiso: `APPOINTMENTS_CREATE` · Ver también: ¿Qué datos pide el formulario de cita?*

### ¿Qué datos pide el formulario de cita? {#q023}

| Campo | Nota |
| --- | --- |
| **Nombre de paciente** | Obligatorio antes de guardar. |
| **Servicios** | Selección múltiple. |
| **Doctor** | |
| **Calendario (consultorio)** | |
| **Fecha**, **Hora**, **Hora de Fin**, **Duración (minutos)** | |
| **Presupuesto** | Permite enlazar la cita a un presupuesto existente o crear uno nuevo ahí mismo. |
| **Descripción** y **Notas** | |

> **Así funciona.** Si el servicio elegido es un **servicio con flujo**, el formulario avisa: *«Agendar esta cita creará un plan de tratamiento con N pasos»*, y al guardar crea el plan completo.

> **Así funciona.** La hora de fin debe ser posterior a la de inicio, y no se puede guardar sin paciente: *«Debe asignar un paciente antes de guardar la cita»*.

### ¿Cómo agendo sin que se abra la ventana? {#q024}

**Preferencias → Calendario → Crear cita en el calendario (sin modal)** → encendido.

Con eso, al hacer clic en un hueco la cita se crea **directamente sobre la rejilla**, como una tarjeta editable, sin abrir ninguna ventana. Es el camino más rápido para agendar en mostrador con el paciente delante.

> **Así funciona.** El botón **Crear** sigue abriendo el formulario completo aunque esta preferencia esté encendida. Y la tarjeta en línea avisa si te superponés: *«Cuidado: se solapa con otra cita»*.

> **IMAGEN 1.2** — Creación de cita en línea: la tarjeta editable directamente sobre la rejilla.

### ¿Cómo sé cuánto va a durar la cita? {#q025}

La duración sale del **servicio**: cada servicio tiene su duración configurada. Si no elegís servicio, la cita toma por defecto **la duración del slot** configurado en tu calendario.

*Ver también: Parte 5 → ¿Cómo cargo los servicios?*

### Si hago clic en la columna de un consultorio, ¿tengo que volver a elegirlo? {#q026}

No. Estando en vista agrupada, al hacer clic dentro de la columna de un consultorio o de un doctor, **ese recurso queda seleccionado por defecto** en la cita nueva.

### ¿Cómo encuentro un hueco libre? {#q027}

Botón **Buscar huecos** → se abre el panel **Huecos disponibles**.

Lista los espacios libres dentro del horario de atención con su duración (*«45 min»*) y marca con la etiqueta **Mayor** el hueco más grande del período. Al elegir uno, se crea la cita ahí.

> **Así funciona.** Solo muestra huecos **dentro del horario de atención**. Si no hay ninguno responde *«No hay huecos en el horario de atención»*, y eso puede significar que el día está lleno o que ese día no se atiende.

### ¿Por qué no me deja agendar a esa hora? {#q028}

Tres causas posibles, en este orden:

1. **Está fuera del horario de atención.** El sistema responde *«La fecha y hora seleccionada está fuera del horario de atención del calendario y no se puede agendar»* y el área aparece atenuada con la etiqueta **No disponible**. Se corrige en **Configuración → Horarios** o **Feriados**.
2. **Es un feriado o una excepción.** Mismo síntoma.
3. **El doctor no está disponible.** Solo si tenés activa la preferencia **Verificar disponibilidad**. Se corrige en **Disponibilidad médica**.

También puede pasar que el hueco se haya ocupado mientras completabas el formulario: *«El horario seleccionado ya no está disponible»*.

> **Así funciona.** El bloqueo visual depende de tu preferencia **Bloquear horarios fuera de atención**, que viene encendida. Si la apagás, el calendario deja de atenuar esas franjas.

*Ver también: Parte 7 → No me deja agendar en un horario*

---

## La agenda: modificar

### ¿Cómo cambio una cita de hora? {#q029}

**Arrastrala.** Agarrá la cita y soltala en el horario nuevo. Sirve también para moverla a otra columna (otro doctor u otro consultorio).

Al soltar, el sistema confirma: **«Cita movida — Nuevo horario: [fecha] · [hora]»**.

*Permiso: `APPOINTMENTS_UPDATE`*

### ¿Cómo cambio la duración de una cita? {#q030}

Arrastrá **el borde inferior** de la tarjeta. Confirma con **«Duración actualizada — 09:30 – 10:15 (45 min)»**.

También podés hacer clic derecho sobre la cita → **Duración** y elegirla por menú.

> **Así funciona.** En citas muy cortas o con el zoom muy bajo, la tarjeta puede no tener alto suficiente para mostrar el tirador de duración. Subí la altura de la hora o el zoom, o usá el menú contextual.

### ¿Cómo paso una cita a otro doctor o a otro consultorio? {#q031}

Dos formas:

- **Arrastrarla** a la columna del otro recurso (en vista agrupada).
- **Clic derecho → Mover a…** y elegir el destino.

### ¿Cómo muevo una cita a otro día o a la semana que viene? {#q032}

Tres formas, según la distancia:

- **Vista de mes:** arrastrala al día destino.
- **Arrastrar hasta el borde lateral** de la pantalla y sostener: el calendario **cambia de período** solo (día o semana siguiente/anterior) mientras seguís con la cita agarrada. Se pueden encadenar varias semanas sin soltar.
- **Editar la cita** y cambiar la fecha a mano.

> **Así funciona.** La cita **conserva su color** al moverse entre períodos.

### ¿Cómo hago esto desde una tablet o un celular? {#q033}

Igual, pero con un gesto distinto: **mantené el dedo apretado un instante** sobre la cita y después arrastrá. Si el dedo no se mueve, en cambio, se abre el menú contextual.

### ¿Cómo edito los datos de una cita? {#q034}

**Doble clic** sobre la cita, o clic derecho → **Editar**.

### ¿Qué puedo hacer con el clic derecho sobre una cita? {#q035}

Se abre el menú de acciones rápidas:

- **Cambiar estado**
- **Mover a…** (otro consultorio o doctor)
- **Duración**
- **Editar**, **Reagendar**, **Cancelar**, **Eliminar**
- **Ver estado de cuenta** del paciente
- **Cambiar color**
- **Enlazar presupuesto / factura**

En tablet y celular, el equivalente es mantener pulsado sin mover el dedo.

> **IMAGEN 1.3** — Menú contextual de una cita desplegado.

---

## La agenda: estados

### ¿Cómo marco que el paciente llegó? {#q036}

Clic derecho sobre la cita → **Llegó**. O desde el panel de detalle de la cita, o desde la línea de tiempo del paciente.

### ¿Cuáles son los estados y qué significan? {#q037}

| Estado | Significado |
| --- | --- |
| **Pendiente** | Solicitud recibida, sin agendar en firme. Es el estado en que entran las reservas del portal del paciente. |
| **Programada** | Agendada pero **sin confirmar**. |
| **Confirmada** | El paciente confirmó. |
| **Llegó** | Está en la clínica. |
| **Llegó tarde** | Llegó fuera de hora. |
| **En curso** | Se está atendiendo. |
| **Completada** | Atención terminada. |
| **Se le atiende tarde** | Atendido, pero fuera de horario. |
| **No asistió** | No se presentó. |
| **Cancelada** | Anulada, con motivo. |

> **Así funciona.** Se puede pasar de cualquier estado a cualquier otro. El sistema no impone una secuencia rígida, porque el mostrador tampoco la tiene.

*Permiso: `APPOINTMENTS_UPDATE`*

### ¿Qué significan los colores de las citas? {#q038}

Cada cita toma color del primer nivel disponible de esta cadena:

```
Etiqueta propia de la cita  →  Servicio  →  Doctor  →  Consultorio
```

Y encima de eso, **el estado**. Con la preferencia **Mostrar el estado de la cita con color** encendida (que viene así):

- Si la cita tiene **color propio o de servicio**, lo conserva y el estado aparece como **una franja en el borde izquierdo**.
- Si solo hereda el color **del doctor o del consultorio**, la cita se pinta **entera** con el color del estado.

| Estado | Color |
| --- | --- |
| Pendiente | Gris claro |
| **Programada** | **Lila** |
| Confirmada | Azul cielo |
| Llegó | Ámbar |
| Llegó tarde | Ámbar oscuro |
| En curso | Naranja |
| Completada | Verde |
| Se le atiende tarde | Verde azulado |
| **No asistió** | **Gris oscuro** |
| Cancelada | Gris con rayado diagonal |

> **Así funciona.** **Programada** (lila) y **No asistió** (gris oscuro) se pintan **siempre**, aunque apagues la preferencia. Son los dos estados que hay que reconocer de un vistazo: lila = todavía no confirmó; gris = no vino. La única excepción es que alguien le haya puesto a mano una etiqueta de color a esa cita: ese color manda y el estado pasa a la franja lateral.

> **IMAGEN 1.4** — Vista de día con citas en distintos estados: color completo, franja lateral y rayado de cancelada.

### ¿Cómo le cambio el color a una cita? {#q039}

Clic derecho → **Cambiar color**. Confirma con *«Color actualizado»*.

> **Así funciona.** Un color puesto a mano tiene prioridad sobre el del servicio, el del doctor y el del consultorio, y además sobre el coloreado por estado.

### ¿Cómo cancelo una cita dejando el motivo? {#q040}

Clic derecho → **Cancelar…** → elegir el motivo.

| Motivo | Cuándo |
| --- | --- |
| **Cancelada con tiempo** | Avisó con antelación razonable. |
| **Cancelada tarde** | Avisó sobre la hora. |
| **Cancelada sin aviso** | No avisó. |
| **Cancelada por el doctor** | |
| **Cancelada por la clínica** | |
| **Otro motivo** | Abre un campo de texto libre. |

> **Así funciona.** «Reagendada» no se puede elegir a mano: lo asigna el sistema cuando usás la acción **Reagendar**.

> **Recomendación.** Cargá siempre el motivo real. El reporte de **Cancelaciones** analiza por motivo, doctor y paciente; si todo se cancela como «Otro motivo», ese reporte no informa nada.

### ¿Cuál es la diferencia entre cancelar y eliminar una cita? {#q041}

**Cancelar** deja registro: la cita sigue existiendo, con su motivo, y alimenta los reportes. **Eliminar** la borra del sistema.

> **Así funciona.** Eliminar solo está disponible desde estados donde no se pierde historia clínica ni de facturación: **Pendiente, Programada, Cancelada y No asistió**. Desde el resto, el sistema no ofrece la opción.

> **Recomendación.** En la operación normal, cancelar. Eliminar es para errores de carga: la cita que se creó por equivocación y nunca existió.

### ¿Cómo reagendo una cita? {#q042}

Clic derecho → **Reagendar**, o el botón **Reagendar** del panel de la cita. Se edita fecha, hora y lo que haga falta, y se confirma.

> **Así funciona.** Reagendar **cancela la cita original con el motivo «Reagendada» y crea una nueva**. Quedan las dos registradas, con trazabilidad. No es lo mismo que arrastrar la cita, que simplemente la mueve.

> **Así funciona.** No se puede reagendar desde los estados terminales (Completada, Cancelada, No asistió). El sistema lo indica: *«No se puede reagendar una cita en estado [X]»*.

---

## La agenda: ver y buscar

### ¿Cómo busco una cita si no sé la fecha? {#q043}

Botón **Buscar cita** → panel **Buscar citas**.

Buscá por **título de la cita** o por **nombre, teléfono, correo o documento del paciente**.

> **Así funciona.** La búsqueda **incluye todas las fechas**, no solo el período que estás viendo. Es la herramienta para «la señora que llamó y no sé cuándo tenía turno». Se puede acotar por calendario.

### ¿Cómo veo la agenda de un solo consultorio a pantalla completa? {#q044}

Con el **modo Personalizado** (el que viene por defecto): botón **Agendas** arriba a la izquierda → elegí cuál ver.

El panel de agendas **se puede fijar** (*Fijar el panel*) para que quede siempre abierto al costado.

> **Así funciona.** El modo Personalizado **recuerda la última agenda que estabas mirando** y la reabre la próxima vez.

### ¿Cómo veo varios consultorios a la vez? {#q045}

**Preferencias → Calendario → Vista (Modo) → Invoke**, y además **Agrupar por → Consultorios** (o Doctores, o Sedes).

En modo Invoke, agrupar divide el calendario en **columnas simultáneas**, una por recurso.

> **Recomendación.** En clínicas con muchos consultorios, la vista multicolumna comprime cada agenda hasta hacerla difícil de leer. Si tenés más de tres o cuatro recursos, suele rendir más el modo Personalizado y conmutar entre agendas.

### ¿Cómo muestro u oculto consultorios y doctores? {#q046}

Con los botones **Calendarios** y **Doctores** de la barra del calendario. Indican cuántos estás viendo: *«Mostrando 3 de 7 calendarios»*. Tienen **Seleccionar Todo** y **Deseleccionar Todo**.

### ¿Qué vistas de calendario hay? {#q047}

1 Día · 2 Días · 3 Días · 4 Días · 5 Días · 6 Días · Semana · Mes · Año · Agenda · Lista.

La que se abre por defecto se elige en **Preferencias → Calendario → Vista predeterminada**.

### ¿Cómo hago más grandes las citas para verlas mejor? {#q048}

Dos controles, que se combinan:

- **Zoom** del calendario (acercar / alejar / restablecer).
- **Preferencias → Calendario → Altura de la hora** (60 a 200 px).

Y un tercero relacionado: **Duración del slot** (10, 15, 20, 30 min o 1 hora) define cuántas divisiones entran por hora.

> **Así funciona.** La altura de una cita es **exactamente proporcional a su duración**: el sistema nunca la agranda para que entre el texto, porque eso taparía los huecos libres. Lo que hace es compactar el contenido de la tarjeta.

### ¿Cómo veo el teléfono del paciente sin abrir su ficha? {#q049}

**Preferencias → Calendario → Formato de la cita**, y elegí un formato que incluya el teléfono:

| Formato | Se lee |
| --- | --- |
| Hora - Paciente - (Notas) | `09:30 - Ana García - (control)` |
| Paciente - Tratamiento - Hora | `Ana García - Endodoncia - 09:30` |
| **Hora - Paciente teléfono - (Notas, Tratamiento)** *(por defecto)* | `09:30 - Ana García 099123456 - (control, Endodoncia)` |
| Hora - Tratamiento - Paciente - Teléfono - (Notas) | `09:30 - Endodoncia - Ana García - 099123456 - (control)` |

> **Recomendación.** Para recepción, uno de los dos formatos que incluyen teléfono ahorra abrir la ficha cada vez que hay que llamar para confirmar.

### Si el paciente es un menor, ¿a quién llamo? {#q050}

Al **contacto responsable**. El calendario y el panel de la cita muestran **«Contacto del responsable»** con su teléfono, además de los datos del paciente.

*Ver también: ¿Cómo doy de alta un menor con su tutor?*

### ¿Por qué aparece una cita que yo no cargué? {#q051}

Puede venir de tres lados:

1. La **reservó el paciente** desde el portal (entra en estado **Pendiente**).
2. La cargó **otro usuario** — el calendario se actualiza en vivo, sin recargar.
3. Viene **importada de Google Calendar**, si el consultorio tiene esa sincronización. Esas citas llevan un distintivo azul.

---

## La agenda: herramientas

### ¿Cómo imprimo o exporto la agenda del día? {#q052}

Botón **Exportar agenda a Excel**. Elegís **Calendario** y **Período** (Día, Semana, Mes o un Rango) y descarga una planilla con: **Horario · Nombre y Apellido · Teléfono**.

> **Así funciona.** El Excel **excluye las citas canceladas y las ausencias**. Es la lista de quienes efectivamente vienen.

### El doctor faltó, ¿cómo paso todas sus citas a otro? {#q053}

Botón **Operaciones en Lotes**:

1. Filtrá: rango de fechas (Hoy / Esta semana / Este mes), doctores, calendarios y estados.
2. **Buscar y seleccionar** → el sistema selecciona las citas que cumplen el filtro e informa *«N citas seleccionadas»*.
3. **Reasignar doctor** → elegís el destino y confirmás.

El resultado informa cuántas se reasignaron y, si hubo fallos, cuántas no.

> **Recomendación.** Antes de reasignar en lote, verificá que el doctor destino preste esos servicios y tenga disponibilidad. La reasignación masiva no valida disponibilidad cita por cita.

### ¿Cómo dejo un recordatorio para el equipo? {#q054}

Botón **Crear** del calendario → **Recordatorio** (o **Nota**).

| Tipo | Diferencia |
| --- | --- |
| **Recordatorio** | Tarea interna visible en el calendario, con prioridad y vencimiento. **Avisa** al vencer. |
| **Nota** | Nota interna **silenciosa**: se ve, no avisa. |

Campos: Título · Descripción · Fecha · Hora · Duración (mínimo 5 min) · **Prioridad** (Baja / Media / Alta) · Calendario · Color.

> **Así funciona.** La casilla **«Solo para mí»** define el alcance. Sin marcar, el recordatorio es **General**: *«todo el equipo puede verlo, editarlo y eliminarlo»*. Marcada, es **Personal**. Solo quien lo creó puede cambiar el alcance.

> **Así funciona.** El botón **Mejorar con IA** pule la redacción y **detecta acciones** dentro del texto, ofreciendo atajos: **Nueva cita**, **Nuevo presupuesto**, **Nueva factura**, **Nueva compra**. Un recordatorio que dice «presupuestar la ortodoncia de la señora Pérez» muestra el botón para crear el presupuesto.

---

## Pacientes

### ¿Cómo doy de alta un paciente? {#q055}

**Pacientes → Crear**. Campos: Nombre (obligatorio) · Correo · Teléfono · Documento · Fecha de nacimiento · Sexo · Dirección · Doctor por defecto · Sociedad mutual · Grupos · Activo.

> **Así funciona.** Hace falta **al menos un correo o un teléfono**. El documento debe ser numérico y de 10 caracteres o menos.

*Permiso: `PATIENTS_CREATE`*

### Me dice que el correo ya está registrado, ¿qué hago? {#q056}

El sistema te dice exactamente cuáles campos chocan: *«Los siguientes campos ya están registrados: Correo Electrónico, Teléfono»*.

Buscá ese dato en el listado de pacientes: lo más probable es que la persona ya exista. Si es un familiar que comparte el correo, usá un dato distinto o dejá ese campo vacío y completá el otro.

> **Recomendación.** Antes de crear, buscá siempre por documento o teléfono. El duplicado de paciente es el error más caro de deshacer: parte la historia clínica y el estado de cuenta en dos.

### ¿Cómo doy de alta un menor con su tutor? {#q057}

En el formulario del paciente:

1. Marcá **«Paciente dependiente (menor, adulto mayor, a cargo de tutor)»**.
2. En **Contacto responsable (tutor/padre)**, buscá al tutor entre los pacientes existentes.
3. Si el tutor **todavía no existe**, la lista de búsqueda ofrece **«Crear tutor [nombre]»**: se abre un formulario reducido, lo completás y al guardarlo *«queda asignado como contacto responsable»*.

> **Así funciona.** No hace falta salir del formulario ni cancelar el alta del menor para crear antes al tutor.

> **IMAGEN 1.5** — Formulario de paciente con el bloque de paciente dependiente y la opción «Crear tutor».

### ¿Qué cambia cuando un paciente es dependiente? {#q058}

| Dónde | Qué aparece |
| --- | --- |
| Listado de pacientes | Distintivo **«Paciente dependiente»**. |
| Ficha del paciente | **«Dependiente de [nombre]»** y el enlace **«Ver perfil del contacto responsable»**. |
| Calendario y panel de cita | **«Contacto del responsable»** con su teléfono. |
| Comunicaciones | Los avisos y recordatorios se dirigen al responsable. |

### ¿Cómo asigno una mutualista a un paciente? {#q059}

En su ficha, campo de **sociedad mutual**: **Seleccionar sociedad** o **Sin asignar**.

El catálogo se administra en **Configuración → Sociedades Mutuales**.

### ¿Cómo pongo a un paciente en un convenio o grupo? {#q060}

En su ficha, campo **Grupos del paciente**. Es selección múltiple con buscador: **un paciente puede estar en varios grupos a la vez**. Indica *«N grupo(s)»* o *«Este paciente no pertenece a ningún grupo»*.

> **Recomendación.** Los grupos son lo que después permite filtrar el **Balance Mensual** por convenio y segmentar envíos. Vale la pena cargarlos desde el alta y no «cuando haga falta».

### ¿Cómo busco solo a los pacientes que deben? {#q061}

En el listado de pacientes, filtro **Mostrar solo deudores**.

*Permiso: `PATIENTS_SEARCH_DEBTORS`*

### ¿Cómo filtro el listado de pacientes? {#q062}

- **Buscador** por nombre, correo o documento.
- **Tipo de Paciente:** Todos / Paciente / Doctor / Proveedor.
- **Rango de Fechas:** Hoy / Esta Semana / Este Mes / Rango Personalizado / Todo el Tiempo.
- **Mostrar solo deudores** · **Mostrar solo activos**.

### ¿Cómo veo el historial de citas de un paciente? {#q063}

Ficha del paciente → sub-pestaña de **Citas**. Muestra pasadas y futuras con su estado.

*Permiso: `PATIENTS_VIEW_DETAIL_APPOINTMENTS`*

### ¿Cómo le mando un WhatsApp a un paciente? {#q064}

Ficha del paciente → **Más acciones** → enviar WhatsApp. Se abre **«Enviar recordatorio por WhatsApp — Selecciona la plantilla a enviar al paciente»**.

*Permiso: `PATIENTS_SEND_WHATSAPP_TEMPLATE`*

### ¿Cómo le mando un correo? {#q065}

Ficha del paciente → **Más acciones** → enviar correo. Se abre el redactor con las plantillas configuradas.

> **Así funciona.** Si el paciente tiene deshabilitado el canal de correo en sus preferencias de comunicación, el sistema avisa antes de enviar: **«Canal de Email No Habilitado»**, con la lista de direcciones afectadas. No lo bloquea: avisa y te deja decidir.

### ¿Cómo anoto algo sobre un paciente? {#q066}

Ficha → **Información → Notas**. Texto libre para observaciones administrativas.

> **Así funciona.** Esto **no es la historia clínica**. Lo clínico va en la sesión clínica, que carga el profesional. Las notas del paciente son para lo administrativo: «pide factura a nombre de la empresa», «prefiere turnos por la tarde».

*Permiso: `PATIENTS_VIEW_DETAIL_NOTES`, `PATIENTS_CREATE_NOTE`*

### ¿Cómo doy de alta (finalizo el tratamiento de) un paciente? {#q067}

Ficha → **Más acciones** → **Dar Alta**. Para reabrirlo, **Reingreso**.

> **Así funciona.** El alta también la puede registrar el profesional al guardar una sesión clínica, marcando la casilla correspondiente.

### ¿Cómo veo los datos de contacto en el listado? {#q068}

Las columnas de correo y teléfono **solo se muestran a quien tenga el permiso `PATIENTS_VIEW_DETAIL_INFO`**. Si no las ves, es eso.

---

## Cobrar en el mostrador

### ¿Cómo cobro rápido, sin dar vueltas? {#q069}

Panel flotante derecho → **Cobrar**. Se abre el asistente **Cobro Rápido**, que hace toda la cadena en un solo diálogo: confirma el presupuesto, genera la factura y registra el pago.

También se abre desde la ficha del paciente, desde el panel de una cita y desde una sesión clínica.

*Permiso: `SALES_PAYMENTS_CREATE`*

### ¿Cuántos pasos tiene el Cobro Rápido? {#q070}

Depende de desde dónde lo abras:

| Si lo abrís desde… | Pasos |
| --- | --- |
| Una **factura** existente | Pago → Listo |
| Un **presupuesto** | Tratamiento → Pago → Listo |
| Una **cita**, **sesión clínica** o la ficha de un paciente | Servicios → Pago → Listo |
| El **panel derecho**, sin contexto | Paciente → Servicios → Pago → Listo |

> **Así funciona.** Si el presupuesto está en borrador, el asistente **lo confirma y genera la factura solo**: no tenés que hacer esos pasos aparte. Y si lo abrís desde una cita o una sesión clínica, **los servicios vienen precargados** con lo que se hizo.

> **Así funciona.** El asistente **no cierra lo que tenías abierto detrás**. La ficha o el panel en el que estabas trabajando sigue ahí al cerrarlo, sin perder el estado.

> **IMAGEN 1.6** — Asistente Cobro Rápido en el paso de Pago.

### En el Cobro Rápido, ¿tengo que cobrar sí o sí? {#q071}

No. El paso final ofrece dos salidas:

- **Solo facturar** — emite la factura y termina. Para cuando el paciente paga después.
- **Facturar y cobrar** — emite y cobra en una sola operación.

Al terminar ofrece **Imprimir recibo**.

### ¿Cómo hago un presupuesto? {#q072}

**Ventas → Presupuestos → Crear**, o desde la ficha del paciente → **Crear → Presupuesto**.

Cada línea lleva: **Servicio**, **Pieza dental**, **Cantidad**, **Precio unitario**, **Descuento** (si está habilitado) y **Total**.

*Permiso: `SALES_QUOTES_CREATE`*

> **Recomendación.** Cargá el número de pieza. Es lo que hace que el presupuesto le hable al paciente en el mismo idioma que la historia clínica: ve qué se le va a hacer y en qué diente.

### ¿Cómo facturo un presupuesto? {#q073}

Desde el presupuesto confirmado, acción **Facturar**. Genera la factura por el total pendiente.

> **Así funciona.** Para poder facturar, el presupuesto tiene que estar **Aceptado o Confirmado**. Desde borrador no se puede: primero **Confirmar**.

### ¿Cómo facturo solo una parte del presupuesto? {#q074}

Acción **Facturación personalizada / parcial…**, que abre el diálogo **Facturar presupuesto**.

Muestra siempre: **Total del presupuesto**, **Facturado**, **Pendiente de facturar** y **Total de esta factura**. En **Servicios a facturar** agregás líneas eligiendo el servicio y el **monto a facturar**; por cada una ves lo facturado y lo que falta. Los servicios completos se marcan **«Facturado completo»**.

> **Así funciona.** No te deja pasarte: ni el total de la factura puede superar el pendiente del presupuesto, ni el monto de una línea el pendiente de su servicio.

### ¿Cómo aplico un descuento? {#q075}

En el presupuesto o la factura, campo **Descuento**. Tiene dos modos conmutables: **porcentaje** o **importe fijo**. El sistema muestra en vivo *«Descuenta $ X»*, y el bloque de totales queda como **Subtotal · Descuento · Total**.

### ¿Por qué no puedo poner el descuento? {#q076}

Dos causas distintas, con síntomas distintos:

1. **No ves el campo en ninguna pantalla** → los descuentos están **apagados** para toda la clínica. Se activan en **Configuración → Preferencias de Clínica**.
2. **Ves el campo pero no podés editarlo** → no tenés el permiso `SALES_APPLY_DISCOUNT`.

Y si te deja escribir pero rechaza el valor con *«Supera el máximo permitido (X %)»*, estás por encima del **tope de descuento** configurado para la clínica.

> **Así funciona.** Que el campo se vea en solo lectura es deliberado: podés saber qué descuento lleva el documento aunque no puedas cambiarlo.

*Ver también: Parte 5 → ¿Cómo activo los descuentos?*

### ¿Cómo veo cuánto debe un paciente? {#q077}

Ficha del paciente → cabecera → **Resumen financiero** (**VER**). Cuatro cifras: **Total Facturado**, **Total Pagado**, **Deuda Actual** y **Saldo Disponible**.

Para el detalle movimiento por movimiento, pestaña **Finanzas**.

### ¿Cómo imprimo el estado de cuenta de un paciente? {#q078}

Dos documentos distintos, según lo que necesites:

| Documento | Qué es | Dónde |
| --- | --- | --- |
| **Resumen Financiero** | Las cuatro cifras: facturado, pagado, deuda, saldo. | Cabecera de la ficha → **Imprimir Resumen Financiero**. Pide un rango de fechas (opcional). |
| **Estado de cuenta** | El detalle de todos los movimientos con saldo corriente. | Pestaña Finanzas → **Estado de cuenta**. |

> **Así funciona.** Si el paciente no tiene movimientos en el período elegido, el sistema lo avisa en vez de imprimir una hoja vacía.

### ¿Cómo cobro usando el crédito que el paciente tiene a favor? {#q079}

Al registrar el pago, si el paciente tiene crédito disponible (de un prepago o de una nota de crédito), el sistema lo ofrece para aplicarlo.

*Permiso: `SALES_PAYMENTS_USE_CREDITS` · Ver también: Parte 3 → ¿Por qué la factura figura cobrada si no entró plata?*

---

## Alertas y pantalla de espera

### ¿Qué es el Centro de Alertas y qué hago con él? {#q080}

Es la bandeja de tareas que **genera el sistema solo**: recordatorios de cita, facturas vencidas, pacientes a seguir. Está en **Centro de Alertas** (`/alerts`).

Arriba muestra cuántas hay: **Total Pendientes**, **Críticas**, **Alta**, **Media**. Se filtra por estado, prioridad y categoría.

*Permiso: `ALERT_CENTER_VIEW_MENU`*

### ¿Qué puedo hacer con una alerta? {#q081}

| Acción | Para qué |
| --- | --- |
| **Enviar Correo / WhatsApp / SMS** | Contactar al paciente desde la alerta. |
| **Registrar Llamada** | Dejar constancia de que llamaste, con fecha y notas. |
| **Marcar como Completada** | Cerrarla. |
| **Pausar** | Postergarla. Pide fecha (con atajos de Día / Días / Semana) y razón. |
| **Ignorar** | Descartarla, con razón. |
| **Asignar** | Adjudicársela a alguien. |
| **Agregar Nota** | |
| **Ver perfil del paciente** / **Imprimir** | |

> **Así funciona.** Si el paciente no tiene correo o teléfono, la acción correspondiente aparece deshabilitada con el motivo: *«El paciente no tiene correo»*.

> **Recomendación.** **Pausar** es «sigue pendiente, pero no ahora». **Ignorar** es «esto no corresponde». Usar una por la otra ensucia las estadísticas de gestión, porque las ignoradas se leen como falsos positivos de las reglas.

### ¿Cómo mando el mismo mensaje a muchos pacientes? {#q082}

Seleccioná varias alertas y usá la barra flotante de **Acciones en Masa**: **Enviar WhatsApp a todas**, **Enviar Correo a todas**, **Marcar todas como Completadas**, **Ignorar Todas**, **Pausar Todas**.

> **Así funciona.** El envío masivo informa el resultado desglosado: **«N enviados, N omitidos, N fallidos»**. Los omitidos suelen ser pacientes sin teléfono o con el canal deshabilitado en sus preferencias.

*Permiso: `ALERT_CENTER_BULK_ACTIONS`*

### ¿Cómo enciendo o apago la pantalla de la sala de espera? {#q083}

Panel flotante derecho → **TV**: **Encender**, **Apagar**, **Pausar**.

Para el control completo, **Pantalla TV** (`/tv-display`), que además tiene **Actualizar datos** y **Mostrar promo**.

*Permiso: `TV_DISPLAY_VIEW_MENU`, `TV_DISPLAY_CONTROL_DISPLAY`*

# PARTE 2 — CONSULTORIO

**Quién.** El rol **Doctor** y cualquier profesional que registre atención clínica.

**Qué ve.** Mi Consultorio · Citas · Pacientes (bloque clínico) · Estudios.

**Qué no ve, por defecto.** Caja y compras.

> **IMAGEN 2.1** — Mi Consultorio con la agenda del día y un aviso de cita nueva.

---

## Empezar el día

### ¿Por dónde empiezo? {#q084}

**Mi Consultorio** (`/workspace`). Es la pantalla pensada para pasar la jornada adentro: la agenda del día, el contexto del paciente y el cierre de la sesión clínica, sin cambiar de pantalla.

Arriba, cuatro contadores: **Citas de hoy**, **Confirmadas**, **Pendientes** y **Completadas**. Debajo, la fecha y la marca de **última actualización**, que se refresca sola.

*Permiso: `DASHBOARD_DOCTOR_WORKSPACE_ACCESS`*

### ¿Qué puedo hacer desde cada cita de la agenda? {#q085}

Tres botones:

| Botón | Abre |
| --- | --- |
| **Paciente** | La ficha del paciente. |
| **Contexto** | El contexto clínico preparado con ayuda de IA: antecedentes, tratamientos en curso, lo relevante de la última visita. |
| **Sesión** | El diálogo de sesión clínica para registrar lo realizado. |

### ¿Cómo veo mi agenda de otro día? {#q086}

Con el filtro de período: **Hoy**, **Mañana**, **Esta semana**, **Próximos 7 días** o un **rango personalizado** (marcás el día de inicio y después el de fin, guiado por el propio selector).

### ¿Por qué no puedo editar la agenda de ayer? {#q087}

Porque **los días que no son hoy se abren en solo lectura**. La agenda lo indica con la marca **«Solo lectura (no es hoy)»**.

> **Así funciona.** Es deliberado: el registro clínico se hace el día de la atención. Para consultar o corregir algo de otra fecha, entrá por la ficha del paciente → **Historia clínica → Línea de tiempo**.

### ¿Por qué veo (o no veo) la agenda de otro consultorio? {#q088}

Porque el acceso se define consultorio por consultorio. En **Configuración → Calendarios → Doctores con acceso** se elige qué profesionales ven cada agenda desde su workspace.

Si te falta una agenda, pedile a administración que te agregue ahí.

### ¿Cómo me entero de que entró una cita nueva? {#q089}

El sistema te avisa en el momento, sin recargar. Hay cinco tipos de aviso:

- **Tienes una cita nueva** — con paciente, hora y servicio.
- **Una cita cambió de estado**
- **Se reagendó una cita de hoy**
- **Te reasignaron una cita**
- **Se editó una cita de hoy**

Cada uno ofrece **Abrir primera cita** y **Cerrar aviso**.

### Los avisos me interrumpen, ¿puedo cambiarlos? {#q090}

Sí. **Preferencias → Espacio de trabajo → Estilo de alertas**:

| Opción | Comportamiento |
| --- | --- |
| **Modal** | Ventana en el centro de la pantalla, hay que cerrarla. Imposible de ignorar. |
| **Notificación** | Mensaje discreto en la esquina que se desvanece solo. No interrumpe. |

---

## Registrar la atención

### ¿Cómo registro lo que hice en la consulta? {#q091}

Desde el botón **Sesión** de la cita, o desde la ficha del paciente → **Crear → Sesión clínica**, o desde la línea de tiempo.

Campos: **Fecha** · **Doctor** (obligatorio) · **Paciente** · **Presupuesto** · **Procedimiento** · **Diagnóstico** · **Notas Clínicas** · **Tratamientos por diente** · **Plan para la Próxima Sesión** · **Fecha Próxima Cita** · **Archivos adjuntos**.

*Permiso: `CLINICAL_SESSION_CREATE`*

### ¿Puedo dictar en vez de escribir? {#q092}

Sí, en dos niveles distintos:

1. **Dictado simple.** Todos los campos de texto largo tienen ícono de micrófono: lo que decís se transcribe ahí.
2. **Dictado clínico con IA.** Un bloque aparte donde dictás la evolución entera en lenguaje natural y el sistema la reparte en los campos.

### ¿Cómo funciona el dictado clínico con IA? {#q093}

Dictá o escribí la evolución como se la contarías a alguien. Por ejemplo: *«paciente refiere menos dolor, se revisó la evolución, se realizó ajuste de provisionales en 11 y 21, sin signos de infección, indicar control en 7 días»*. Pulsá **Estructurar con IA**.

El sistema completa diagnóstico, procedimiento, notas y tratamientos sugeridos.

> **Así funciona.** Si detecta que falta algo relevante, lo señala en un bloque **«Información que conviene confirmar»**. No inventa el dato faltante: avisa.

> **Recomendación.** Revisá siempre lo que estructuró antes de guardar. La IA reparte lo que dictaste; la responsabilidad del registro clínico sigue siendo del profesional que firma.

### ¿Cómo hago que la IA me proponga los tratamientos? {#q094}

En el bloque de tratamientos, botón **Generar con IA**. Analiza el texto de la sesión y propone tratamientos **del catálogo de servicios de la clínica**, separados en **Sesión actual** y **Próxima sesión**.

Cada uno se puede aceptar, cambiar por otro servicio o quitar. También podés agregarlos a mano, y existe **Regenerar**.

> **Así funciona.** Los tratamientos salen del catálogo real de servicios, no de texto libre. Eso es lo que permite que después se facturen sin retipear nada.

### ¿Cómo anoto los tratamientos por diente? {#q095}

En la sección **Tratamientos por diente**: se agrega una línea con **N° de diente** y **Descripción**.

### ¿Cómo adjunto una radiografía o una foto a la sesión? {#q096}

En **Archivos adjuntos**: arrastrá los archivos o hacé clic para seleccionarlos. Quedan guardados con la sesión y accesibles también desde **Documentos**.

> **Así funciona.** Hay límite de tamaño y de tipos de archivo. Si te lo rechaza, el sistema dice cuál de los dos fue: *«El archivo excede el límite de X MB»* o *«Tipo de archivo no permitido»*.

*Permiso: `CLINICAL_SESSION_UPLOAD_ATTACHMENT`*

### ¿Cómo dejo anotada la próxima cita? {#q097}

En la sesión, campos **Plan para la Próxima Sesión** y **Fecha Próxima Cita**.

### ¿Cómo doy de alta al paciente al terminar? {#q098}

Marcá **«Dar de alta al paciente al guardar la sesión»** dentro del diálogo de sesión. *«Si lo activas, después de guardar la sesión se registrará el alta del paciente desde este mismo modal.»* Pide la fecha de alta.

### ¿Qué pasa cuando guardo la sesión? {#q099}

Tres cosas:

1. La sesión entra en la **línea de tiempo** del paciente.
2. **La recepción recibe un aviso**: *«Sesión clínica registrada — El Dr./Dra. X completó una sesión para Y»*.
3. Si vinculaste un presupuesto, los tratamientos quedan listos para facturar.

> **Recomendación.** Vinculá el presupuesto en la sesión. Es lo que evita que la recepción tenga que adivinar qué cobrar, y lo que hace que el Cobro Rápido abra con los servicios ya cargados.

---

## Historia clínica

### ¿Dónde está la historia clínica de un paciente? {#q100}

Ficha del paciente → macro-pestaña **Historia clínica**. Adentro, cinco sub-pestañas:

**Anamnesis** · **Línea de tiempo** · **Planes de Tratamiento** · **Indicaciones Médicas** · **Documentos**.

*Permiso: `PATIENTS_VIEW_DETAIL_HISTORY`*

### ¿Cómo cargo los antecedentes del paciente? {#q101}

Sub-pestaña **Anamnesis**. Registra:

- **Alergias**
- **Antecedentes personales**
- **Antecedentes familiares** (con el parentesco)
- **Medicación**, separando la **Activa** de la **Finalizada**
- **Hábitos:** Tabaquismo, Alcohol, Bruxismo, Otros, y comentarios

*Permiso: `ANAMNESIS_VIEW`, `ANAMNESIS_ADD_PERSONAL`*

### ¿Dónde veo todo lo que se le hizo al paciente? {#q102}

Sub-pestaña **Línea de tiempo**. Reúne en una sola cronología las **sesiones clínicas**, las **actualizaciones del odontograma** y las **citas**.

Desde ahí podés abrir el detalle de cualquier sesión y, si tenés el permiso, editar una cita o **cambiarle el estado** sin ir al calendario.

*Permiso: `TIMELINE_VIEW`*

### ¿Cómo imprimo la historia clínica completa? {#q103}

Botón **Imprimir historia clínica**. Genera el documento con: datos del paciente, **anamnesis completa** (alergias, antecedentes, medicación activa y finalizada, hábitos), y el **historial de sesiones** en tabla (Fecha · Profesional · Detalle · Próxima cita), distinguiendo sesión clínica de odontograma. Por sesión incluye procedimiento, diagnóstico, pieza, notas, tratamientos, actualización de odontograma y adjuntos.

> **Así funciona.** Si el paciente no tiene historia, lo dice en vez de imprimir una hoja vacía: *«Este paciente no tiene historia clínica para imprimir»*.

### ¿Dónde veo las alergias sin buscar? {#q104}

En la cabecera de la ficha, bloque **Alertas clínicas**.

> **Así funciona.** Si no hay ninguna registrada, dice explícitamente **«Sin alergias registradas»**. Un campo vacío y la ausencia de alergias no son lo mismo, y el sistema no los confunde.

---

## Odontograma

### ¿Cómo cargo el odontograma? {#q105}

Está en el **Expediente Médico**, solapa **Odontograma**.

1. **Nueva Sesión** — el odontograma **se edita siempre dentro de una sesión**. Sin sesión abierta está en **Solo lectura**; con una activa muestra **Editando**.
2. Elegí una **condición** del panel lateral.
3. Aplicala sobre el diente.

*Permiso: `ODONTOGRAM_VIEW`, `ODONTOGRAM_REGISTER_SESSION`*

### ¿Cómo aplico una condición a una sola cara del diente? {#q106}

Depende de la categoría de la condición, y el sistema te lo indica en pantalla:

| Categoría | Cómo se aplica |
| --- | --- |
| **Superficies** | *«Haz clic en una zona del diente»* — afecta solo a esa cara. |
| **Pieza** | *«Haz clic en el diente para aplicar a la pieza completa»*. |
| **Superposición** | *«Haz clic en el diente para agregar/quitar superposición»*. |

### ¿Qué condiciones puedo marcar? {#q107}

Sano · Caries · Obturación · Tratamiento Pulpar · Discromía · Desgaste · Corona · Corona Temporal · Ausente · Resto Radicular · Prótesis Removible · Prótesis Fija · Implante · Edentulismo · Endodoncia · Fractura.

> **Así funciona.** El catálogo es configurable: se administra en **Catálogo de la Clínica → Condiciones Dentales** y **Superficies Dentales**. Si falta una condición que usás, se puede agregar.

### ¿Cómo cambio entre la vista de boca y la vista plana? {#q108}

Con el conmutador **Vista boca abierta / Vista plana**. También hay **Volver a la boca**.

| Vista | Cuándo conviene |
| --- | --- |
| **Boca abierta** | Representación anatómica, arcadas enfrentadas. |
| **Plana** | Disposición lineal, más compacta. |

*Permiso: `ODONTOGRAM_TOGGLE_VIEW`*

### ¿Cómo lo veo más grande? {#q109}

Botón **Pantalla completa**. Para salir, **Salir de pantalla completa**.

### ¿Cómo veo cómo estaba la boca hace seis meses? {#q110}

Con **Sesión anterior** / **Sesión siguiente**: recorrés el odontograma tal como estaba en cada sesión registrada.

> **Recomendación.** Es la forma más clara de mostrarle al paciente su evolución. Abrir el odontograma de hace un año al lado del actual explica un tratamiento mejor que cualquier descripción.

*Permiso: `ODONTOGRAM_NAVIGATE_HISTORY`*

### ¿Cómo borro lo que cargué mal? {#q111}

**Limpiar diente** borra ese diente; **Limpiar odontograma** borra todo. El indicador de **Herramienta activa** muestra qué condición tenés seleccionada en cada momento.

> **IMAGEN 2.2** — Odontograma en vista de boca abierta con el panel de condiciones y el navegador de sesiones.

---

## Recetas

### ¿Cómo emito una receta? {#q112}

Ficha del paciente → **Recetas Médicas** → **Nueva receta**.

Cabecera: **Fecha** · **Doctor** (obligatorio, es de quien sale la firma) · **Plantilla** · **Diagnóstico** · **Notas**.

*Permiso: `PATIENT_PRESCRIPTIONS_CREATE`*

### ¿Qué datos lleva cada medicamento? {#q113}

| Campo | Ejemplo |
| --- | --- |
| **Medicamento** | Del catálogo de la clínica. |
| **Presentación** | Comprimidos 500 mg |
| **Dosis** | 1 comprimido |
| **Vía** | Oral |
| **Frecuencia** | Cada 8 horas |
| **Duración (días)** | 7 |
| **Cantidad** | 20 comprimidos |
| **Inicio** y **Fin** | |
| **Indicaciones** | Tomar con alimentos |

> **Así funciona.** La receta no se guarda sin doctor y sin al menos un medicamento.

### ¿Cómo hago que el medicamento quede registrado en la anamnesis? {#q114}

Marcá **«Registrar en la anamnesis del paciente»** en ese medicamento. Los registrados quedan marcados **«En anamnesis»** y pasan a la medicación activa del paciente.

> **Así funciona.** Si después borrás la receta, el sistema avisa que *«también se quitarán de la anamnesis los medicamentos que haya registrado»*.

### ¿Puedo ver cómo va a quedar antes de imprimir? {#q115}

Sí. El diálogo tiene dos paneles: **Datos** y **Vista previa**. La vista previa muestra la receta con la plantilla elegida.

### ¿Tengo que escribir los medicamentos en el cuerpo de la receta? {#q116}

**No.** Cargalos en los campos de arriba y el sistema arma la tabla al imprimir.

> **Así funciona.** Existe un editor del **Contenido de la receta**, pero el propio sistema advierte: *«Sólo si necesita apartarse de la plantilla. La tabla de medicamentos y la firma se arman al imprimir a partir de los campos de arriba, por eso sus tokens se mantienen en el texto.»* Ese editor es para ajustar el texto **alrededor** de la tabla, no para escribir la tabla.

El botón **Actualizar variables** recarga los datos del paciente y de la clínica en el texto.

### ¿Por qué dice que la receta saldrá sin firmar? {#q117}

Porque el doctor seleccionado no tiene firma cargada: *«Este doctor todavía no tiene firma. La receta se imprimirá sin firmar.»*

Al lado del aviso hay un botón **Definir firma** que abre el diálogo para **subir una imagen o dibujarla** sin salir de la receta. *«Queda guardada en el perfil del doctor y se usa en esta receta.»*

*Ver también: Parte 0 → ¿Cómo cargo mi firma?*

### ¿Qué sale impreso? {#q118}

Título **Receta Médica**, los datos y el logo de la clínica, **Paciente**, **Fecha**, **Doctor**, **Diagnóstico**, y la tabla de medicamentos con Medicamento · Presentación · Dosis · Frecuencia · Duración · Indicaciones. Al pie, la **firma del profesional**.

> **IMAGEN 2.3** — Diálogo de receta con el panel de datos y la vista previa del impreso.

### ¿Puedo tener varios formatos de receta? {#q119}

Sí, con varias plantillas. Se administran en **Configuración → Plantillas de Receta** (`/config/prescription-templates`): *«Definir la estructura de las recetas médicas: membrete, medicamentos y firma.»*

> **Recomendación.** Tener una plantilla por sede o por especialidad evita editar el membrete a mano cada vez.

---

## Indicaciones al paciente

### ¿Cómo le doy indicaciones escritas al paciente? {#q120}

Ficha → **Historia clínica → Indicaciones Médicas** → nueva indicación.

Elegís una **plantilla** (por ejemplo «Post-extracción»), el sistema completa solo las variables —nombre del paciente, clínica, fecha, pieza dental—, ajustás el texto si hace falta e **imprimís**.

*Permiso: `PATIENT_MEDICAL_INSTRUCTIONS_CREATE`*

### ¿Puedo imprimirla en el momento de guardarla? {#q121}

Sí.

> **Así funciona.** Al guardar, **el diálogo no se cierra**, precisamente para que puedas imprimir ahí mismo. Es deliberado: antes había que cerrarlo y volver a abrirlo solo para imprimir.

### ¿Cómo creo una plantilla de indicación nueva? {#q122}

Es configuración: **Configuración → Plantillas de Indicaciones Médicas**. Ver Parte 5.

---

## Planes de tratamiento

### ¿Qué es un plan de tratamiento y cómo se crea? {#q123}

Es el seguimiento de un tratamiento que necesita **varias citas secuenciales**: ortodoncia, implantes, endodoncias multisesión.

**No se crea a mano.** Se genera solo al agendar una cita con un **servicio con flujo**. El formulario avisa: *«Agendar esta cita creará un plan de tratamiento con N pasos»*.

*Ver también: Parte 5 → ¿Cómo hago un servicio de varias citas?*

### ¿Dónde sigo el avance? {#q124}

Ficha del paciente → **Historia clínica → Planes de Tratamiento**. Por cada plan muestra:

- **Estado:** Activo / Completado / Cancelado / Pausado.
- **Progreso del tratamiento** con los hitos cumplidos.
- **Próxima Cita**, **Siguiente** paso y **Paso Ausente** cuando corresponde.
- **Editar pasos** y **Crear Cita** para el paso siguiente.
- **Ver historial** de planes anteriores.

### ¿Cómo sé quién abandonó un tratamiento? {#q125}

El sistema los marca solo: **«Paciente con tratamiento interrumpido»** y **«Sin reprogramar hace N días»**, con un botón **Contactar** directo.

> **Recomendación.** Esa lista es, en la práctica, la herramienta de recuperación de pacientes: identifica sin que nadie tenga que revisarlo quién dejó algo a medias. Vale la pena revisarla con una periodicidad fija.

---

## Estudios por imágenes

### ¿Cómo veo una tomografía o una radiografía? {#q126}

**Pacientes → Estudios** (`/studies`). Los que compartieron terceros están en **Estudios Compartidos** (`/shared-studies`).

*Permiso: `DICOM_VIEW_STUDIES`, `DICOM_VIEW_STUDY`*

### ¿Qué puedo hacer sobre la imagen? {#q127}

| Función | Para qué | Permiso |
| --- | --- | --- |
| **Reconstrucción Multiplanar (MPR)** | Ver los cortes axial, coronal y sagital del volumen. | `DICOM_USE_MPR` |
| **Mediciones** | Distancias y ángulos con precisión milimétrica. | `DICOM_USE_MEASUREMENTS` |
| **Ventana (brillo/contraste)** | Ajuste radiológico, con optimización automática por tejido. | `DICOM_USE_WINDOW` |
| **Anotaciones** | Marcas y textos sobre la imagen. | `DICOM_ADD_ANNOTATIONS` |
| **Layout** | Cuántas vistas se muestran a la vez. | `DICOM_CHANGE_LAYOUT` |

> **IMAGEN 2.4** — Visor DICOM con reconstrucción multiplanar y una medición activa.

---

## Otras preguntas del consultorio

### ¿Puedo ver cuánto debe el paciente? {#q128}

Depende de tus permisos. La pestaña **Finanzas** y el atajo **«Ver estado de cuenta»** requieren al menos uno de los permisos financieros del paciente (`PATIENTS_VIEW_DETAIL_QUOTES`, `_ORDERS`, `_INVOICES` o `_PAYMENTS`).

> **Así funciona.** Muchas clínicas configuran el rol clínico **sin** esos permisos a propósito, para separar lo asistencial de lo comercial. Si no la ves, es una decisión de configuración, no una falla.

### ¿Por qué entro a Pacientes y no veo los datos personales? {#q129}

Porque tu rol tiene acceso al **bloque clínico** pero no a la pestaña **Información**, que se gobierna con el permiso `PATIENTS_VIEW_DETAIL_INFO`.

> **Así funciona.** Es una configuración prevista y frecuente: el profesional ve historia, odontograma, planes y documentos, y no ve datos personales, de contacto ni financieros. Con esa configuración, el paciente se abre directamente en la pestaña clínica y las columnas de contacto desaparecen del listado.

### ¿Cómo agendo la próxima cita sin salir de la ficha? {#q130}

Ficha del paciente → **Crear → Cita**. También podés editar una cita desde la línea de tiempo con el ícono de lápiz.

*Permiso: `PATIENTS_MANAGE_APPOINTMENTS`*

> **Así funciona.** Este permiso es **independiente** de los del calendario. Se puede dar acceso al calendario sin habilitar esta vía, o habilitar esta vía sin dar acceso al calendario completo.

# PARTE 3 — CAJA

**Quién.** El rol **Cajero** y quien maneje el dinero del día: apertura, cobros, gastos, arqueo.

**Qué ve.** Caja · Ventas (facturas, pagos) · Pacientes (finanzas).

**Qué no ve, por defecto.** La historia clínica.

> **IMAGEN 3.1** — Panel de la sesión de caja activa con los totales del día y las transacciones.

---

## Abrir la caja

### ¿Cómo abro la caja? {#q131}

Panel flotante derecho → **Caja** → **Abrir**. O desde **Caja** (`/cashier`).

El asistente **Abrir Sesión** pide:

1. **Terminal** — qué caja física estás abriendo.
2. **Usuario** y **Fecha de Apertura**.
3. **Tipo de Cambio** del día.
4. **Conteo de efectivo por denominación**, en cada moneda.

*Permiso: `CASH_SESSION_OPEN`*

### ¿Qué pongo en el tipo de cambio? {#q132}

El valor con el que la clínica va a operar ese día.

> **Así funciona.** El tipo de cambio queda **fijado para toda la sesión**: es el que se aplica a todas las conversiones de la jornada. Se muestra en el acceso **Cambio** del panel flotante derecho, para que todo el equipo cobre con el mismo valor.

*Permiso: `CASH_SESSION_SET_EXCHANGE_RATE`*

### ¿Tengo que contar billete por billete? {#q133}

Sí, el conteo es por denominación, y el sistema calcula el subtotal y el total.

Para acelerarlo hay dos atajos: **Rellenar con 0** y **Rellenar con último cierre** (el fondo fijo que quedó del arqueo anterior).

> **Recomendación.** «Rellenar con último cierre» y verificar es más rápido y más seguro que cargar de cero, porque el fondo fijo casi nunca cambia entre un día y el siguiente.

*Permiso: `CASH_SESSION_COUNT_OPENING`, `CASH_SESSION_FILL_LAST_CLOSE`*

### ¿Puedo imprimir la apertura? {#q134}

Sí, botón **Imprimir Apertura**.

*Permiso: `CASH_SESSION_PRINT_OPENING`*

---

## Durante el día

### ¿Cómo veo cuánto debería tener en el cajón? {#q135}

Panel flotante derecho → **Caja**. Con sesión abierta muestra el **saldo vivo de efectivo por moneda**: lo que debería haber físicamente.

> **Así funciona.** Los saldos se actualizan solos al volver a la pestaña del navegador. Si estuviste trabajando en otra ventana, al regresar el widget ya refleja los cobros registrados mientras tanto.

*Permiso: `CASHIER_VIEW_WIDGET`*

### ¿Qué muestra el panel de la sesión activa? {#q136}

- **Ingresos Totales**, **Egresos Totales**, **POS** (total por terminal de tarjetas) y **Efectivo en Mano**.
- **Detalles de Apertura**: las denominaciones que contaste al abrir.
- **Transacciones** de la sesión: Nro. Documento · Descripción · Monto · **Entidad/Tercero** · Método · Fecha.
- **Pagos Diarios**.

> **Así funciona.** Cuando la sesión acumula muchísimos movimientos, el panel avisa que está mostrando una parte y ofrece ampliar la página. No es que falten transacciones.

*Permiso: `CASH_SESSION_VIEW_DETAIL`, `CASH_SESSION_VIEW_TRANSACTIONS`*

### ¿Cómo registro un cobro? {#q137}

Tres caminos, según de dónde vengas:

| Camino | Cuándo |
| --- | --- |
| Panel derecho → **Cobrar** (Cobro Rápido) | El flujo normal de mostrador. |
| **Ventas → Pagos → Crear** | Registro directo de un pago. |
| Desde la **cuenta del paciente** → fila → **Cobrar** | Cuando ya estás mirando su estado de cuenta. |

*Permiso: `SALES_PAYMENTS_CREATE`*

### ¿Cómo asigno un pago a tratamientos concretos? {#q138}

Al registrar el pago, el sistema ofrece **distribuirlo entre los tratamientos pendientes** en lugar de dejarlo como un monto suelto.

El panel **Tratamientos pendientes** muestra por cada uno lo **Pendiente** y lo **Asignado**, con la **Diferencia** en vivo.

> **Así funciona.** No se puede asignar más de lo pendiente de un tratamiento (*«No puede exceder el pendiente»*) ni más que el monto del pago (*«Excedente: X»*).

> **Recomendación.** Asignar el pago cuesta unos segundos y permite saber después **qué** pagó el paciente, no solo cuánto. Sobre una fila ya pagada, el sistema muestra **Tratamientos pagados** y **Pagado con**: esa trazabilidad solo existe si se asignó.

> **IMAGEN 3.2** — Formulario de pago con el panel de asignación a tratamientos pendientes.

### ¿Qué pasa si el paciente paga de más? {#q139}

El sistema lo dice al asignar: **«El resto (X) se agregará como crédito del paciente»**. Ese crédito queda disponible para aplicarlo a facturas futuras.

### ¿Cómo registro una seña o un adelanto? {#q140}

Es un **prepago**: dinero recibido antes de que exista la factura. Queda como **crédito disponible del paciente** y se aplica después.

Se ve en el **Resumen financiero** de la ficha como **Saldo Disponible**.

> **Así funciona.** También se pueden cargar **prepagos históricos**, para reflejar adelantos recibidos antes de que la clínica usara el sistema.

*Permiso: `SALES_PREPAYMENTS_CREATE`*

### ¿Cómo registro un gasto chico? (caja chica) {#q141}

**Caja → Transacciones Misceláneas → Crear**. Son los movimientos que no corresponden a una factura: insumos urgentes, taxi, un gasto menor.

Cada transacción lleva una **categoría** y es obligatorio indicar el **método de pago**.

> **Recomendación.** Elegí bien la categoría. El reporte de **Gastos Operativos** consolida las misceláneas con las facturas de proveedores; sin categorías, el gasto queda como una masa indiferenciada que no se puede analizar.

*Permiso: `MISC_TRANSACTION_CREATE`*

### ¿Cómo agrego una categoría de gasto? {#q142}

**Caja → Categorías de Productos y Servicios** (`/cashier/miscellaneous-categories`).

---

## Notas de crédito y devoluciones

### ¿Cómo hago una nota de crédito? {#q143}

Desde la factura, o desde la fila correspondiente de la cuenta del paciente: **Crear nota de crédito**.

Indicás **Cantidad**, **Precio unitario** y **Notas**.

> **Así funciona.** El sistema muestra el **monto máximo acreditable** de esa factura y no deja superarlo: *«El total de la nota de crédito no puede superar X, el monto máximo acreditable restante de la factura.»*

*Permiso: `CREDIT_NOTE_CREATE`*

### ¿Cuándo uso una nota de crédito? {#q144}

Cuando hay que anular total o parcialmente una factura ya emitida: un tratamiento que no se realizó, un error de facturación, una devolución acordada.

### ¿Por qué la factura figura cobrada si no entró plata? {#q145}

Porque se saldó **aplicando un crédito** (una nota de crédito o un prepago), no con dinero.

Este es el punto que más confusión genera en el arqueo. La regla es:

| Momento | ¿Se mueve la caja? |
| --- | --- |
| **Se crea la nota de crédito** | **No.** Solo se genera un saldo a favor del paciente. |
| **Se aplica el crédito a una factura** | **No.** La factura se salda contra el crédito. Figura cobrada, **sin efectivo que la respalde**. |
| **Se devuelve el dinero en efectivo** | **Sí.** Es un egreso de caja y tiene que aparecer en el conteo. |

> **Recomendación.** Si al arquear te sobra «cobrado» contra el efectivo real, revisá primero las aplicaciones de crédito del día. En nueve de cada diez casos la diferencia está ahí y no es un faltante.

### ¿Cómo devuelvo dinero en efectivo? {#q146}

Se registra como **egreso de caja**, y por lo tanto impacta en el arqueo de la sesión.

---

## Cerrar la caja

### ¿Cómo cierro la caja? {#q147}

Asistente **Cerrar Sesión**, que recorre estos pasos:

| Paso | Qué se hace | Permiso |
| --- | --- | --- |
| **1. Configuración** | Datos de la sesión y confirmación de inicio del arqueo. | `CASH_SESSION_CLOSE_REVIEW` |
| **2 y 3. Conteo de Efectivo (UYU y USD)** | *«Ingrese el conteo físico de efectivo para cada denominación.»* Un paso por moneda. | `CASH_SESSION_CLOSE_COUNT` |
| **4. Depósito Bancario** *(opcional)* | Declarar qué efectivo se retira para el banco. | `CASH_SESSION_CLOSE_DEPOSIT` |
| **5. Revisar** | Comparación entre lo registrado y lo contado. | `CASH_SESSION_CLOSE_REVIEW` |
| **6. Declarar** | Conciliación por método de pago. | `CASH_SESSION_CLOSE_DECLARE` |
| **7. Reporte y Confirmación** | Resumen final y cierre. | `CASH_SESSION_CLOSE_CONFIRM` |

> **Así funciona.** **Cada paso tiene su propio permiso.** Eso permite separar responsabilidades: que el cajero cuente y declare, y que solo un supervisor justifique un descuadre (`CASH_SESSION_CLOSE_JUSTIFY`) y confirme el cierre.

### ¿Qué es el paso de «Declarar»? {#q148}

Es la **conciliación por método de pago**. El sistema lista cada método —Efectivo, Transferencia Bancaria, Tarjeta de Crédito, Tarjeta de Débito, Pago Móvil, Mercado Pago, POS— con lo que tiene registrado, y vos declarás lo que efectivamente tenés.

Ahí aparecen las diferencias.

> **IMAGEN 3.3** — Paso de declaración del arqueo con la conciliación por método de pago.

### ¿Qué hago si no cuadra? {#q149}

El paso de **justificación** pide explicar la diferencia antes de poder confirmar el cierre.

> **Recomendación.** Antes de justificar, revisá en este orden: (1) aplicaciones de crédito del día, que figuran cobradas sin efectivo; (2) devoluciones en efectivo; (3) misceláneas cargadas con el método de pago equivocado; (4) el conteo de billetes. La mayoría de los descuadres salen de los tres primeros.

*Permiso: `CASH_SESSION_CLOSE_JUSTIFY`*

### ¿Cómo declaro un depósito al banco? {#q150}

Paso 4 del cierre: *«Declare las denominaciones de efectivo físico que se retirarán para el banco. Este paso es opcional.»* Se indica qué se saca, por denominación y moneda, y se pueden **adjuntar archivos** (el comprobante).

> **Así funciona.** Lo que queda en el cajón después del depósito es el fondo fijo con el que abrirá la próxima sesión. Por eso el atajo **Rellenar con último cierre** funciona a la mañana siguiente.

### ¿Qué sale en el informe de cierre? {#q151}

**Info de Sesión**, **Resumen de Efectivo**, **Total UYU**, **Total USD**, **Total Apertura**, y **los movimientos de caja** del período — no solo los totales, de modo que el papel sea auditable por sí mismo.

*Permiso: `CASH_SESSION_PRINT_CLOSE`*

### ¿Puedo reimprimir un cierre anterior? {#q152}

Sí.

*Permiso: `CASH_SESSION_REPRINT`*

### ¿Dónde veo los cierres anteriores? {#q153}

**Caja → Sesiones de Caja** (`/cashier/sessions`). Están todas las sesiones cerradas con su apertura, cierre, diferencias y responsable. Se abre una haciendo clic en su fila.

*Permiso: `CASH_SESSION_VIEW_LIST`*

---

## Configuración de caja

### ¿Cómo doy de alta una caja física nueva? {#q154}

**Caja → Cajas Registradoras Físicas** (`/cashier/cash-points`) → Crear.

> **Así funciona.** Cada punto de cobro tiene su propia sesión y su propio arqueo. Varias cajas pueden operar a la vez de forma independiente.

*Permiso: `CASH_REGISTER_CREATE`*

### ¿Cómo agrego un método de pago? {#q155}

**Ventas → Métodos de Pago** (`/sales/payment-methods`) → Crear.

> **Así funciona.** Sin métodos de pago cargados no se puede registrar ningún cobro: es un prerrequisito del ciclo de ventas. Y en el cierre, la conciliación se hace **por método de pago**, así que el catálogo define la calidad del arqueo.

> **Recomendación.** Los métodos se **desactivan**, no se borran. Desactivar preserva el histórico de los pagos que ya lo usaron; borrar lo rompe.

*Permiso: `PAYMENT_METHODS_CREATE`, `PAYMENT_METHODS_TOGGLE_STATUS`*

### ¿Cómo exporto los pagos del período? {#q156}

**Ventas → Pagos → Exportar**. Incluye: Nro. Doc. · Fecha · Cliente/Proveedor · Monto Aplicado · Monto Origen · Moneda · Tipo de Cambio · Tipo Transacción · Método de Pago · Doc. Factura · Histórico · Notas.

*Permiso: `SALES_PAYMENTS_EXPORT`*

### ¿Qué significan los tipos de transacción de la lista de pagos? {#q157}

| Tipo | Qué es |
| --- | --- |
| **Pago Directo** | Cobro contra una factura. |
| **Aplicación de Pago** | Un pago o prepago existente que se aplica a una factura. |
| **Aplicación Nota de Crédito** | Un saldo a favor que se aplica a una factura. |

En el detalle se ve el flujo: **Pago origen** o **Nota de crédito origen** → **Factura destino**.

# PARTE 4 — GERENCIA

**Quién.** El rol **Gerente** y quien mire el negocio: rendimiento, cobranza, gastos, producción médica.

**Qué ve.** Todo, con capacidad de confirmar operaciones.

**Qué no ve, por defecto.** La configuración técnica del sistema, y no elimina datos sensibles.

> **IMAGEN 4.1** — Panel de Control con el bloque ejecutivo y el gráfico de evolución.

---

## El panel de control

### ¿Cómo veo cómo viene el día y el mes? {#q158}

**Panel de Control** (`/`). La franja superior muestra dos cortes simultáneos: **HOY** y el **mes acumulado**.

| Indicador | Qué mide |
| --- | --- |
| **Producción** | Lo facturado en el período. |
| **Cobranza** | Lo efectivamente cobrado, con su porcentaje sobre lo producido. |
| **Pacientes atendidos** | Atenciones del día sobre el total agendado (*«N de M agendados»*). |
| **Resultado de caja** | Saldo del movimiento de caja. |
| **Gastos del mes** | Egresos cargados. |
| **Pacientes nuevos** | Altas en el período. |

*Permiso: `DASHBOARD_VIEW_EXECUTIVE_SUMMARY`*

### ¿Contra qué se compara el dato del día? {#q159}

Contra **el mismo día de la semana anterior** (*«vs. martes pasado»*), no contra el día anterior.

> **Así funciona.** Es deliberado: comparar un lunes contra un domingo no dice nada útil en una clínica.

### ¿Por qué los gastos aparecen vacíos y no en cero? {#q160}

Porque no hay ningún gasto cargado en el sistema. El propio panel lo explica al pasar el cursor: mostrar **$ 0** se leería como *«no hubo gastos»*, que es una afirmación distinta de *«no se cargó nada»*.

> **Así funciona.** El indicador queda vacío a propósito. Si te aparece vacío, revisá que se estén cargando las misceláneas de caja y las facturas de proveedores.

### ¿Cómo comparo sucursales? {#q161}

Conmutador **Consolidado / Sucursal**, y el botón **Comparar sucursales**, que las pone lado a lado con pacientes, **ticket promedio** y tasa de **no asistió**.

*Permiso: `DASHBOARD_VIEW_BY_BRANCH`*

### ¿La producción por sucursal es exacta? {#q162}

No: es **estimada**, y el panel lo marca como tal.

> **Así funciona.** La sucursal de una factura se deduce de la cita del paciente más cercana en el tiempo, porque ese dato no se registra al facturar. La cobertura es del 100 % con un margen de error cercano al **1,2 %**, correspondiente a pacientes que se atienden en más de una sede.

### ¿Por qué la cobranza no cambia al filtrar por sucursal? {#q163}

Porque **los cobros no registran sucursal**, ni de forma directa ni derivada. Ese indicador se muestra siempre consolidado, aunque haya una sede seleccionada. El panel lo advierte.

### ¿Cómo veo la evolución de los últimos meses? {#q164}

Gráfico **Evolución**, conmutable entre métricas: Producción · Cobranza · Pacientes atendidos · Pacientes nuevos · Gastos · Atenciones. Muestra la variación contra el mes anterior.

> **Así funciona.** El mes en curso se marca **«en curso»**, para que un mes parcial no se lea como cerrado.

### ¿Por qué las barras de pacientes no suman el total del período? {#q165}

Porque **cada barra cuenta pacientes únicos de ese período**. Quien viene más de una vez aparece en varias barras. El propio gráfico lo aclara en su leyenda.

> **Así funciona.** El sistema elige la granularidad según el largo del período y lo explica: *«Agrupado por semana porque el período abarca 90 días»*.

### ¿Qué cuenta como paciente nuevo? {#q166}

Un paciente cuenta como nuevo **el día de su primera cita atendida** en la clínica.

> **Así funciona.** Con una sucursal filtrada, quien debutó en otra sede cuenta como **recurrente**, no como nuevo.

---

## Reportes

### ¿Cómo saco un reporte? {#q167}

**Reportes** → elegí el informe → configurá los filtros → **Generar Reporte**.

> **Así funciona.** Ningún reporte se genera solo al abrirlo. Hasta que pulsás Generar, la pantalla dice *«Configura los filtros y presiona Generar»*. Es para no disparar consultas pesadas por el solo hecho de entrar.

*Permiso: `REPORTS_VIEW_MENU` + el de su familia*

### ¿Qué filtros tengo? {#q168}

Según el reporte: **Rango de fechas**, **Doctor**, **Moneda**, **Método de pago**, **Punto de caja**, **Estado**, **Monto mínimo**, **Agrupar por** (Día / Semana / Mes) y **Filtrar por** (Servicio / Usuario / Estado).

Atajos de fecha: Todo el tiempo · Hoy · Esta semana · Este mes · **Mes anterior** · Este año · Personalizado.

### ¿Cómo exporto un reporte? {#q169}

Botones **Imprimir**, **Exportar PDF** y **Exportar Excel**.

*Permiso: `REPORTS_EXPORT_PDF`, `REPORTS_EXPORT_EXCEL`*

### ¿Qué reporte uso para cada pregunta? {#q170}

| Necesito saber… | Reporte | URL | Permiso |
| --- | --- | --- | --- |
| Cuánto entró por sesión de caja | **Cierre de Caja** | `/reports/cierre-caja` | `REPORTS_CAJA_VIEW` |
| Todos los pagos del período | **Cobros del Día** | `/reports/cobros-dia` | `REPORTS_CAJA_VIEW` |
| El saldo de cada paciente | **Cuentas Corrientes** | `/reports/cuentas-corrientes` | `REPORTS_INGRESOS_VIEW` |
| Cuántos presupuestos se convierten | **Estado de Presupuestos** | `/reports/estado-presupuestos` | `REPORTS_INGRESOS_VIEW` |
| Cuánto se cobró por período | **Ingresos por Período** | `/reports/ingresos-periodo` | `REPORTS_INGRESOS_VIEW` |
| La brecha entre facturar y cobrar | **Facturación vs Cobranza** | `/reports/facturacion-cobranza` | `REPORTS_INGRESOS_VIEW` |
| Quién debe y desde cuándo | **Deudores** | `/reports/deudores` | `REPORTS_INGRESOS_VIEW` |
| Qué servicios rinden | **Rendimiento de Servicios** | `/reports/servicios` | `REPORTS_INGRESOS_VIEW` |
| Cuánto produce cada doctor | **Producción por Doctor** | `/reports/produccion-doctor` | `REPORTS_PRODUCCION_VIEW` |
| Qué procedimientos se hacen más | **Tratamientos Realizados** | `/reports/tratamientos` | `REPORTS_PRODUCCION_VIEW` |
| La evolución de 12 meses | **Comparativo de Producción** | `/reports/comparativo-produccion` | `REPORTS_PRODUCCION_VIEW` |
| La base para comisiones | **Honorarios** | `/reports/honorarios` | `REPORTS_PRODUCCION_VIEW` |
| Cuántos pacientes nuevos entraron | **Nuevos Pacientes** | `/reports/nuevos-pacientes` | `REPORTS_PACIENTES_VIEW` |
| A quién hay que reactivar | **Pacientes Inactivos** | `/reports/pacientes-inactivos` | `REPORTS_PACIENTES_VIEW` |
| Qué tratamientos están abiertos | **Tratamientos en Curso** | `/reports/tratamientos-en-curso` | `REPORTS_PACIENTES_VIEW` |
| Cómo está la ocupación de la agenda | **Análisis de Citas** | `/reports/ocupacion-agenda` | `REPORTS_AGENDA_VIEW` |
| Por qué se cancelan las citas | **Cancelaciones** | `/reports/cancelaciones` | `REPORTS_AGENDA_VIEW` |
| Cuánto se gasta y en qué | **Gastos Operativos** | `/reports/gastos-operativos` | `REPORTS_GASTOS_VIEW` |
| El resultado del período | **Estado de Resultados** | `/reports/estado-resultados` | `REPORTS_GESTION_VIEW` |
| Los indicadores clave | **KPIs Clínica** | `/reports/kpis` | `REPORTS_GESTION_VIEW` |
| El cierre del mes por médico | **Balance Mensual** | `/reports/balance-mensual` | `REPORTS_BALANCE_MENSUAL_VIEW` |

### ¿Cómo comparo varios médicos en un solo reporte? {#q171}

En **Balance Mensual**, que admite **selección múltiple de doctores**. También filtra por **tipo de documento** y por **grupo de pacientes**.

> **Así funciona.** Balance Mensual tiene **permiso propio** (`REPORTS_BALANCE_MENSUAL_VIEW`), separado del resto de la familia de gestión. Está pensado para poder dárselo a la contabilidad o a la dirección sin abrir los demás informes.

### ¿Cómo aíslo la producción de un convenio? {#q172}

Filtrando por **grupo de pacientes** en el Balance Mensual. Requiere que los pacientes del convenio estén asignados a ese grupo.

*Ver también: Parte 5 → ¿Cómo creo un grupo de pacientes?*

### ¿Por qué el reporte de Cancelaciones no dice nada útil? {#q173}

Porque analiza **por motivo**, y si todas las cancelaciones se cargaron como «Otro motivo», no hay nada que analizar.

> **Recomendación.** Si querés que ese reporte sirva, la recepción tiene que cargar el motivo real al cancelar. Es una decisión de proceso, no de configuración: el sistema ofrece los motivos, pero no obliga a elegir el correcto.

### ¿Cómo veo el gasto total de la clínica? {#q174}

**Gastos Operativos**, que consolida **las misceláneas de caja + las facturas de proveedores**.

> **Así funciona.** Si las misceláneas se cargan sin categoría, el reporte las muestra pero no se pueden analizar por rubro.

---

## La cuenta de un paciente

### ¿Cómo veo el detalle de la cuenta de un paciente? {#q175}

Ficha del paciente → pestaña **Finanzas**. Hay dos diseños posibles, según tu preferencia personal:

| Preferencia | Qué ves |
| --- | --- |
| **Personalizado** (`unified`) | **La cuenta unificada**: una sola tabla cronológica con **Debe / Haber / Saldo**, una fila por tratamiento y una por pago, con saldo corriente. |
| **Normal** (`tabs`) | El diseño clásico: pestañas separadas de **Presupuestos**, **Facturas** y **Pagos**. |

Se cambia en **Preferencias → Finanzas del paciente**.

> **Así funciona.** Ojo con los nombres: «Personalizado» es la vista nueva de cuenta unificada; «Normal» es la clásica de pestañas.

### ¿Cómo leo la cuenta unificada? {#q176}

| Columna | Contenido |
| --- | --- |
| **Fecha** | |
| **Tratamiento** | El servicio de esa línea, o el concepto del pago. |
| **Debe** | Lo que se le cargó al paciente. |
| **Haber** | Lo que pagó o se le acreditó. |
| **Saldo** | Saldo corriente acumulado. |
| **Estado** | Presupuestado / Facturado / Pago parcial / Pagado / Pago / Nota de crédito. |

Al pie: **Facturado**, **Cobrado** y **Pendiente**.

> **Así funciona.** Tres reglas explican lo que ves: (1) una línea presupuestada que ya se facturó **aparece una sola vez**, como factura, no duplicada; (2) las facturas sin presupuesto previo se listan igual, en su fecha; (3) **las filas se agrupan por moneda**, porque un saldo corriente que mezcle pesos y dólares no significa nada.

### ¿Por qué aparece una fila de «Saldo anterior»? {#q177}

Porque estás filtrando por período. Esa fila trae el balance de la cuenta **antes del período** que estás viendo, para que el saldo corriente siga siendo correcto.

### ¿Qué puedo hacer desde una fila de la cuenta? {#q178}

Con el botón **⋮**, según el estado de la fila y tus permisos:

| Acción | Cuándo |
| --- | --- |
| **Editar** | Ítem de presupuesto aún no facturado. |
| **Confirmar presupuesto** | Presupuesto en borrador, pendiente o enviado. |
| **Facturar** | Presupuesto aceptado o confirmado. |
| **Facturación personalizada / parcial…** | Facturar solo una parte. |
| **Cobrar** | Factura no saldada. |
| **Crear nota de crédito** | Factura con saldo acreditable. |
| **Revertir a presupuesto** | Deshace la facturación de un ítem. |
| **Eliminar** | Presupuesto, pago, nota de crédito o tratamiento. |

> **Así funciona.** Si una fila no tiene ninguna acción disponible —por su estado o por tus permisos—, el botón **⋮** no se muestra.

### ¿Puedo cargar movimientos anteriores al sistema? {#q179}

Sí, con la marca **Histórico** al crear presupuestos, facturas o pagos desde la cuenta. Sirve para reflejar la situación real de un paciente que venía de antes.

---

## Compras y proveedores

### ¿Cómo cargo una factura de proveedor sin tipear? {#q180}

**Compras → Facturas de Compra** → importación con IA. Subís la factura (PDF o imagen) y el sistema **extrae los datos** —proveedor, número, fecha, ítems, importes, impuestos— y precarga el formulario. Revisás, corregís y confirmás.

*Permiso: `PURCHASE_INVOICES_IMPORT_AI`*

> **Recomendación.** Verificá siempre tres cosas antes de confirmar: **el proveedor identificado, el total y la moneda**. La extracción acierta en la enorme mayoría de los casos, pero la responsabilidad contable del dato es de quien confirma.

### ¿Cómo doy de alta un proveedor? {#q181}

**Compras → Proveedores → Crear**. Campos: nombre, documento, **dirección**, teléfono, **teléfono alternativo**, correo, **cuenta bancaria** y **notas**.

En su detalle, la pestaña **Servicios** lista lo que provee, con precios.

*Permiso: `SUPPLIERS_CREATE`*

### ¿Cómo agrupo a los proveedores? {#q182}

Con **Grupos de Proveedores** (`/config/provider-groups`): insumos, laboratorio, servicios, mantenimiento.

### ¿Cómo registro un pago a proveedor? {#q183}

**Compras → Pagos de Compra → Crear**. Funciona igual que los cobros: pago directo, aplicaciones y **prepagos a proveedores** para adelantos.

> **Así funciona.** Los pagos a proveedores **impactan en la caja** cuando se abonan en efectivo desde la sesión activa.

*Permiso: `PURCHASE_PAYMENTS_CREATE`*

### ¿Cómo llevo el catálogo de lo que compro? {#q184}

**Compras → Productos y Servicios de Proveedores** (`/purchases/services`). Cada producto pertenece a una **categoría**, que es lo que después permite analizar el gasto por rubro.

---

## Seguimiento comercial

### ¿Cómo sé cuántos presupuestos se están cerrando? {#q185}

Reporte **Estado de Presupuestos**, que los agrupa por estado: borrador, confirmado, rechazado.

### ¿Por qué un presupuesto se rechazó? {#q186}

En la pantalla del presupuesto rechazado aparece un **banner destacado con el motivo**, si se cargaron notas al rechazarlo.

### ¿Cómo veo a los pacientes que dejaron un tratamiento a medias? {#q187}

Dos caminos:

- Reporte **Tratamientos en Curso**, con filtros por estado y período.
- En la ficha de cada paciente, la alerta **«Paciente con tratamiento interrumpido»** con **«Sin reprogramar hace N días»** y un botón **Contactar**.

> **Recomendación.** El reporte da la visión agregada; la alerta de la ficha da la acción concreta. Para una campaña de recuperación, empezá por el reporte y bajá a las fichas.

# PARTE 5 — ADMINISTRACIÓN

**Quién.** El rol **Administrador** y quien ponga en marcha o mantenga la configuración de la clínica.

**Qué ve.** Todo, sin restricciones.

> **IMAGEN 5.1** — Menú de Configuración de Negocio desplegado con todas sus pantallas.

---

## Poner en marcha una clínica nueva

### ¿Por dónde empiezo? {#q188}

> **Recomendación.** Este orden evita tener que volver atrás, porque cada paso depende del anterior:
>
> 1. **Detalles de la Clínica** → 2. **Sedes** → 3. **Horarios** → 4. **Feriados** → 5. **Calendarios (consultorios)** → 6. **Doctores** → 7. **Disponibilidad médica** → 8. **Monedas** → 9. **Secuencias de numeración** → 10. **Métodos de pago** → 11. **Servicios** → 12. **Catálogo clínico** → 13. **Plantillas** → 14. **Usuarios y roles**.
>
> El sistema no impone este orden: se puede configurar en cualquier secuencia. Pero por ejemplo los horarios piden sedes, y los servicios con flujo conviene definirlos antes de agendar la primera cita.

### ¿Cómo cargo los datos de la clínica? {#q189}

**Configuración de Negocio → Detalles de la Clínica** (`/config/clinics`).

| Campo | Nota |
| --- | --- |
| **Logo** | Con vista previa. Requiere `CLINIC_DETAILS_UPLOAD_LOGO`. |
| **Nombre** | |
| **Dirección** | |
| **Teléfono** · **Correo Electrónico** | |
| **RUT** | Identificación fiscal. |
| **Moneda** | La moneda base de la clínica. |

> **Así funciona.** Estos datos **se imprimen en todos los documentos** (presupuestos, facturas, recibos, recetas) y aparecen en la portada del Portal del Paciente. Si hay sedes configuradas, **la dirección la gestionan las sedes** y la pantalla lo indica.

*Permiso: `CLINIC_DETAILS_VIEW`, `CLINIC_DETAILS_UPDATE`*

### ¿Cómo agrego una sede o sucursal? {#q190}

**Configuración → Sedes** (`/config/sedes`) → Crear. Campos: **Nombre**, **Dirección**, **Teléfono**, **Correo Electrónico**, **¿Está Activa?**

> **Así funciona.** Las sedes condicionan bastante más de lo que parece: los **calendarios** pertenecen a una sede, los **horarios** se definen por sede o como General, los **feriados** pueden ser de una sede, el calendario se filtra y se agrupa por sede, los usuarios tienen una **sede de trabajo**, y el Panel de Control ofrece el corte por sucursal.

*Permiso: `SEDES_CREATE`*

### ¿Cómo defino el horario de atención? {#q191}

**Configuración → Horarios** (`/config/schedules`). Por cada **Día de la Semana**, una **Hora de Inicio** y una **Hora de Fin**. Se pueden crear varios tramos por día (mañana y tarde).

Se asocian a una **sede** o se definen como **General**.

> **Así funciona.** Si no hay sedes configuradas, la pantalla lo advierte: *«Primero configura al menos una sede en Configuración > Sedes.»*

> **Así funciona.** Esto es lo que hace que el calendario bloquee las franjas fuera de atención, alimenta el **buscador de huecos** y define qué horarios ofrece la **reserva online** del portal.

*Permiso: `SCHEDULES_CREATE`*

### ¿Cómo cierro un día feriado? {#q192}

**Configuración → Feriados** (`/config/holidays`) → Crear, con **Estado: Cerrado**.

### ¿Cómo registro un día de atención reducida (medio día)? {#q193}

Mismo lugar, pero con **Estado: Abierto** y el horario especial de ese día en **Hora de Inicio** / **Hora de Fin**.

> **Así funciona.** Un feriado «Abierto» no es una contradicción: es la forma de registrar el 24 de diciembre con atención hasta el mediodía. El calendario bloquea solo la franja que no se atiende.

Cada feriado puede aplicar a **una sede o a todas**, y admite **Notas**.

*Permiso: `HOLIDAYS_CREATE`*

### ¿Cómo doy de alta un consultorio? {#q194}

**Configuración → Calendarios** (`/config/calendars`) → Crear. Un «calendario» es un **recurso físico agendable**: un consultorio, un sillón, un box, una sala de rayos.

| Campo | Nota |
| --- | --- |
| **Nombre** | Ej. «Consultorio 1». |
| **Sede** | A qué sucursal pertenece. |
| **Color** | El color de sus citas cuando no hay uno más específico. |
| **ID de Google Calendar** | Para sincronizar con un calendario de Google. |
| **Activo** | |

> **Así funciona.** Las citas importadas desde Google Calendar llevan un distintivo azul que las diferencia.

*Permiso: `CALENDARS_CREATE`*

### ¿Cómo hago que un doctor solo vea su agenda? {#q195}

**Configuración → Calendarios** → seleccioná el calendario → pestaña **Doctores con acceso**.

*«Selecciona los doctores que podrán ver las citas de este calendario desde su workspace.»* El contador indica *«N con acceso»*; si no hay ninguno, *«Ningún doctor con acceso»*.

> **Así funciona.** Esto es lo que evita que un profesional vea las agendas de todos sus colegas en **Mi Consultorio**. Se define agenda por agenda.

*Permiso: `CALENDARS_MANAGE_USERS`*

### ¿Cómo doy de alta un doctor? {#q196}

**Configuración → Doctores** (`/config/doctors`) → Crear.

| Campo | Nota |
| --- | --- |
| **Nombre** | |
| **Correo Electrónico** | Es también su usuario de acceso. |
| **Teléfono** · **Documento de Identidad** | |
| **Color** | Su color en el calendario. |
| **Sedes** | En qué sucursales atiende. |
| **¿Está Activo?** | |

En su detalle, la pestaña **Servicios** define qué prestaciones realiza.

> **Así funciona.** Cargar los servicios del doctor es lo que habilita la preferencia **Filtrar doctores por servicio** del calendario. Si esa preferencia está activa y los servicios no están cargados, la lista de doctores sale vacía al crear una cita.

> **Recomendación.** Desactivá en lugar de borrar. Un doctor desactivado conserva todo su histórico de citas, producción y sesiones clínicas; uno borrado lo rompe.

*Permiso: `DOCTORS_CREATE`, `DOCTORS_VIEW_SERVICES`, `DOCTORS_ADD_SERVICE`*

### ¿Cómo doy de alta a las secretarias y al personal administrativo? {#q197}

**Configuración → Secretarias y Administración** (`/system/staff`). Es la pantalla dedicada al personal no clínico, separada de Usuarios del Sistema para simplificar el alta del día a día.

*Permiso: `STAFF_VIEW_MENU`*

### ¿Cómo defino cuándo atiende cada doctor? {#q198}

**Configuración → Disponibilidad Médica** (`/config/doctor-availability`) → Crear.

| Campo | Nota |
| --- | --- |
| **Doctor** | |
| **Recurrencia** | Diario / Semanal / Quincenal / Mensual. |
| **Día de la Semana** | |
| **Hora de Inicio** / **Hora de Fin** | La de fin debe ser posterior. |
| **Fecha de Inicio** / **Fecha de Fin** | Vigencia de la regla. |

> **Así funciona.** Estas reglas se aplican solo si el usuario tiene activa la preferencia **Verificar disponibilidad**. También alimentan las **Horas Sugeridas** del formulario de cita.

*Permiso: `AVAILABILITY_RULES_CREATE`*

### ¿Cómo marco vacaciones o una licencia? {#q199}

**Configuración → Excepciones de Disponibilidad** (`/config/availability-exceptions`) → Crear:

- **Disponible = No** → ausencia: licencia, congreso, día libre.
- **Disponible = Sí** con horario → atención extraordinaria fuera de su horario habitual.

*Permiso: `AVAILABILITY_EXCEPTIONS_CREATE`*

### ¿Cómo configuro las monedas? {#q200}

**Configuración → Monedas y Tipos de Cambio** (`/config/currencies`).

> **Así funciona.** El tipo de cambio **operativo** no sale de acá: lo fija **la sesión de caja** al abrirla, y ese es el valor que se aplica a todas las conversiones de la jornada. Esta pantalla es el catálogo de monedas y sus tasas de referencia.

*Permiso: `CURRENCIES_VIEW_LIST`*

### ¿Cómo configuro la numeración de las facturas? {#q201}

**Configuración → Secuencias** (`/config/sequences`) → Crear.

| Campo | Nota |
| --- | --- |
| **Nombre de Secuencia** | |
| **Tipo de Documento** | Factura, presupuesto, orden, pago, nota de crédito… |
| **Patrón** | La máscara. Ej.: `FAC-{YYYY}-{MM}-{COUNTER:4}` |
| **Contador Actual** | Desde qué número sigue. |
| **Período de Reinicio** | Cuándo vuelve a empezar (nunca, mensual, anual). |
| **Activo** | |

El diálogo lista las **Variables Disponibles** —*«Haga clic en cualquier variable para agregarla al patrón»*— y muestra una **Vista Previa** con un ejemplo.

> **Recomendación.** Configurá esto **antes de emitir el primer documento**. Cambiar la numeración con documentos ya emitidos genera problemas de correlatividad que después hay que explicar.

*Permiso: `SEQUENCES_CREATE`*

### ¿Cómo cargo los servicios? {#q202}

**Ventas → Servicios** (`/sales/services`) → Crear.

| Campo | Efecto |
| --- | --- |
| **Nombre** | |
| **Categoría** | Obligatoria. Agrupa el catálogo y alimenta el reporte de Rendimiento de Servicios. |
| **Precio** y **Moneda** | Precio de lista que se propone al presupuestar. |
| **Duración** | **Determina cuánto ocupa la cita en el calendario.** |
| **Descripción** | |
| **Indicaciones** | Lo que el paciente debe hacer antes de la cita. |
| **Color** | Color de la cita cuando el servicio lo define. |
| **Activo** | Los inactivos dejan de ofrecerse pero conservan el histórico. |

*Permiso: `SALES_SERVICES_CREATE`*

### ¿Cómo hago un servicio de varias citas? (plan de tratamiento) {#q203}

En el servicio, marcá **«Servicio con Flujo»** — *«Este servicio comprende múltiples citas secuenciales (plan de tratamiento)»*. Aparece la pestaña **Pasos del Tratamiento**.

Cada paso lleva:

| Campo | Uso |
| --- | --- |
| **Nombre del Paso** | Ej. «Extracción dental». |
| **Posición** | Orden en la secuencia. |
| **Días desde el anterior**, con **Días mín.** y **Días máx.** | El intervalo recomendado. |
| **Duración (min)** | |
| **Depende de laboratorio** | Marca los pasos condicionados por un tercero. |
| **Notas** | |

> **Así funciona.** A partir de ahí, agendar una cita con ese servicio **crea el plan completo automáticamente**, y el formulario avisa: *«Agendar esta cita creará un plan de tratamiento con N pasos»*.

### ¿Cómo cargo los catálogos clínicos? {#q204}

**Catálogo de la Clínica**, cuatro diccionarios:

| Catálogo | URL | Alimenta |
| --- | --- | --- |
| **Padecimientos** | `/clinic-catalog/ailments` | La anamnesis. |
| **Medicamentos** | `/clinic-catalog/medications` | Las recetas y la medicación de la anamnesis. Incluye **nombre comercial**. |
| **Condiciones Dentales** | `/clinic-catalog/dental-conditions` | Lo que se puede marcar en el odontograma. |
| **Superficies Dentales** | `/clinic-catalog/dental-surfaces` | Las caras del diente. |

> **Así funciona.** Varios de estos se pueden alimentar sobre la marcha: si al cargar una receta falta un medicamento, se crea desde el propio buscador sin abandonar el formulario.

*Permiso: `CATALOG_*_CREATE` según el catálogo*

### ¿Cómo creo un grupo de pacientes o un convenio? {#q205}

**Configuración → Grupos de Pacientes** (`/config/patient-groups`) → Crear.

Cada grupo tiene, además de sus datos, una pestaña de **Servicios** para asociarle las prestaciones cubiertas. Los grupos se pueden **exportar a Excel** con sus integrantes.

*Permiso: `PATIENT_GROUPS_CREATE`*

### ¿Cómo cargo las mutualistas? {#q206}

**Configuración → Sociedades Mutuales** (`/config/mutual-societies`). Después se asigna una a cada paciente desde su ficha.

*Permiso: `MUTUAL_SOC_CREATE`*

---

## Usuarios, roles y permisos

### ¿Cómo doy de alta un usuario? {#q207}

**Sistema → Usuarios** (`/system/users`) → Crear.

1. Cargá sus datos.
2. **El sistema le asigna automáticamente un rol por defecto**, de modo que nunca queda una cuenta sin permisos.
3. Ajustá los roles si corresponde.
4. **Enviá el enlace de primera contraseña.** El usuario la define él mismo.
5. Verificá en el listado que la haya establecido.

*Permiso: `USERS_CREATE`, `USERS_ASSIGN_ROLE`, `USERS_SET_INITIAL_PASSWORD`*

### ¿Cómo sé quién todavía no entró nunca? {#q208}

Las pantallas de **Doctores**, **Secretarias y Administración** y **Usuarios del Sistema** muestran un **indicador de qué usuarios no establecieron su primera contraseña**.

### ¿Cómo funciona el modelo de permisos? {#q209}

```
Usuario  →  Rol (uno o varios)  →  Permisos (muchos)
```

**Los permisos no se asignan a personas: se asignan a roles**, y las personas reciben roles. Un usuario con varios roles acumula los permisos de todos.

### ¿Cuáles son los roles que vienen de fábrica? {#q210}

| Rol | Alcance |
| --- | --- |
| **Administrador** | Acceso total. |
| **Gerente** | Gestión y reportes. Ve todo y confirma operaciones, pero no elimina datos sensibles ni toca configuración técnica. |
| **Recepcionista** | Agenda, caja, presupuestos y facturación básica. Sin historia clínica ni configuración. |
| **Doctor** | Historia clínica completa y su workspace. Sin caja ni compras. |
| **Cajero** | Caja, facturación y cobros. Sin historia clínica. |

Además existen **Paciente** (para el portal, se asigna solo) y **Super Admin** (administración de la plataforma).

> **Así funciona.** Los roles se identifican **por nombre, no por número**. Cada instalación tiene sus propios identificadores internos, así que al migrar o documentar configuraciones hay que referirse siempre al nombre del rol.

### ¿Cómo creo un rol nuevo? {#q211}

**Sistema → Roles** (`/roles`) → Crear. Después, en la pestaña **Permisos** del rol, marcá lo que corresponda en la matriz.

> **Recomendación.** Método que evita la mayoría de los errores:
> 1. **Partí de un rol parecido** en vez de empezar en blanco.
> 2. **Empezá por los permisos de menú** (`_VIEW_MENU`): definen qué módulos verá.
> 3. **Agregá las lecturas** (`_VIEW_LIST`, `_VIEW_DETAIL`) de cada pantalla que deba abrir.
> 4. **Agregá solo las acciones necesarias.** Las eliminaciones y confirmaciones son las que conviene reservar.
> 5. **Probá con una cuenta real de ese rol** y recorré su flujo completo. Es la única verificación fiable.

*Permiso: `ROLES_CREATE`, `ROLES_ASSIGN_PERMISSION`*

### ¿Cómo uso la matriz de permisos? {#q212}

**Roles → [rol] → Permisos**. Muestra **todos los permisos agrupados por módulo**, con una casilla por permiso.

Controles: **buscador de permisos**, **Expandir / Colapsar** por módulo y **Expandir todos / Colapsar todos**, **Todos / Ninguno** a nivel de módulo, **Seleccionar todos / Deseleccionar todos**, y un **contador total**.

Los cambios se aplican con **Guardar**.

> **Así funciona.** El cambio se ve en la próxima carga de la aplicación del usuario afectado: aparecen o desaparecen ítems del menú, pestañas y botones.

> **IMAGEN 5.2** — Matriz de permisos de un rol con un módulo expandido.

### ¿Cómo le doy acceso clínico a un médico sin mostrarle datos personales? {#q213}

Asignale `PATIENTS_VIEW_DETAIL` + `PATIENTS_VIEW_DETAIL_HISTORY` y **no** le des `PATIENTS_VIEW_DETAIL_INFO` ni los permisos financieros.

Resultado: entra a Pacientes, el paciente se abre **directamente en la pestaña clínica**, y las columnas de contacto desaparecen del listado.

> **Así funciona.** `PATIENTS_VIEW_DETAIL_INFO` gobierna **la pestaña Información** (datos personales y de contacto) **y las columnas de correo y teléfono del listado**. Es el permiso que hace posible esta separación.

### ¿Cómo le quito a alguien la posibilidad de hacer descuentos? {#q214}

Quitale `SALES_APPLY_DISCOUNT` a su rol.

> **Así funciona.** Sin ese permiso el campo de descuento **sigue viéndose, pero en solo lectura**. Es la única excepción deliberada a la regla general: normalmente, lo que no se puede hacer no se muestra. Acá se muestra para que el vendedor sepa qué descuento lleva el documento aunque no pueda cambiarlo.

### ¿Cómo veo qué roles tienen un permiso? {#q215}

**Sistema → Permisos** (`/permissions`), función de **impacto** del permiso.

*Permiso: `PERMISSIONS_VIEW_IMPACT`*

### ¿Puedo crear permisos nuevos? {#q216}

Se puede, en `/permissions`, pero casi nunca es lo correcto.

> **Así funciona.** Un permiso nuevo que la aplicación no conoce **no habilita nada**: los códigos tienen que estar consumidos por la interfaz para tener efecto. La operación habitual del administrador es **asignar** permisos existentes a roles, no crear códigos nuevos.

### ¿Por qué un usuario no ve algo que debería ver? {#q217}

Revisá en este orden:

1. **¿Tiene el permiso de menú** (`_VIEW_MENU`) del módulo? Sin eso, el módulo no aparece.
2. **¿Tiene el permiso de listado** (`_VIEW_LIST`)? El error más común es dar el detalle sin el listado: el usuario entra al módulo y ve una pantalla vacía.
3. **¿Tiene el permiso de la acción concreta** que busca?
4. **¿Recargó la aplicación** después del cambio de permisos?

> **Recomendación.** Regla práctica: si das un `_VIEW_DETAIL`, dá siempre también el `_VIEW_LIST` correspondiente.

---

## Descuentos

### ¿Cómo activo los descuentos? {#q218}

**Configuración → Preferencias de Clínica** (`/config/clinic-prefs`) → **Aplicar descuentos** → encendido.

> **Así funciona.** Con esto apagado, **ninguna** pantalla de presupuestos ni facturas muestra campos de descuento, y los totales se calculan sin considerarlos.

*Permiso: `CLINIC_PREFS_VIEW`, `CLINIC_PREFS_UPDATE`*

### ¿Descuento por servicio o sobre el total? {#q219}

Las dos opciones son **excluyentes**: se elige una para toda la clínica.

| Opción | En pantalla | En el documento impreso |
| --- | --- | --- |
| **Por servicio** | Cada línea del presupuesto o la factura lleva su propio campo de descuento. | Cada línea muestra su precio ya descontado. |
| **Sobre el total** | Un único campo sobre el total del documento. | Los servicios salen a **precio de lista** y el descuento aparece como **una línea aparte**. |

> **Recomendación.** Si la clínica negocia el precio del tratamiento completo, «Sobre el total» refleja mejor la conversación y deja el descuento visible como concesión. Si se hacen bonificaciones puntuales por prestación, «Por servicio».

### ¿Cómo pongo un tope al descuento? {#q220}

Mismo lugar: **Descuento máximo (%)**. Si se supera, el formulario avisa *«Supera el máximo permitido (X %)»* y no deja guardar.

> **Así funciona.** El tope **también aplica a los descuentos introducidos como importe fijo**: el sistema los convierte a porcentaje sobre el importe y los valida igual. **100 significa sin tope.**

### ¿Cómo hago que el descuento arranque con un valor? {#q221}

**Descuento por defecto (%)**: es el valor con el que arranca el campo al crear un presupuesto o una factura. Siempre se puede cambiar en la venta. **0 deja el campo vacío.**

> **Así funciona.** El descuento por defecto no puede ser mayor que el máximo: la pantalla lo impide al guardar.

---

## Portal del Paciente

### ¿Cómo abro el portal a los pacientes? {#q222}

**Configuración → Portal del Paciente** (`/config/patients-portal`) → **Permitir el acceso de pacientes al portal**.

> **Así funciona.** *«Habilita la página pública /patient-login. Si está apagado, los pacientes ven un aviso de que el portal no está disponible y no pueden identificarse ni reservar.»*

*Permiso: `PATIENT_PORTAL_CONFIG_VIEW`, `PATIENT_PORTAL_CONFIG_UPDATE`*

### ¿Cómo habilito la reserva online? {#q223}

Misma pantalla: **Permitir la reserva de citas online**.

> **Así funciona.** *«Deja que el paciente elija día y horario entre los huecos libres de la agenda. Si está apagado, sólo puede consultar su información: las citas las sigue agendando la clínica.»*

### ¿Cómo hago que el portal sea solo para reservar, sin abrir el expediente? {#q224}

Opción **El portal es sólo para reservar citas**.

> **Así funciona.** *«El paciente entra, se identifica y pasa directo a la agenda. Nunca se le pide código ni accede a su historia clínica, finanzas o datos personales.»* Con esta opción activa, **ningún paciente ve su perfil** y **no se envían códigos de acceso**.

> **Recomendación.** Es la configuración indicada para empezar: abre el canal de reserva online sin exponer el expediente. Después, si la clínica lo decide, se apaga y se habilita el portal completo.

### ¿Cómo cambio el video y el mensaje de bienvenida? {#q225}

Misma pantalla:

- **Video de bienvenida** — acepta **YouTube, Instagram, Vimeo o un archivo .mp4**. Vacío = video genérico de Invoke IA.
- **Mensaje de bienvenida** — reemplaza el texto que acompaña al título. Vacío = texto por defecto.

> **Así funciona.** Si el enlace no se reconoce, el sistema lo dice: *«No pudimos reconocer ese enlace. Verificá que sea de YouTube, Instagram, Vimeo o un archivo .mp4.»*

### ¿Cómo saco el QR y el flier para la sala de espera? {#q226}

La misma pantalla genera **códigos QR**, con **Probar** y **Descargar**, y permite **Imprimir flier** en dos versiones:

- **Flier de paciente** — *«Reserva online, sin llamadas… Solo escanea el QR.»*
- **Flier del personal** — *«Accede a tu espacio de trabajo.»*

> **IMAGEN 5.3** — Configuración del Portal del Paciente con los interruptores y el QR generado.

---

## Correo, alertas y comunicación

### ¿Cómo configuro el correo saliente? {#q227}

**Sistema → Configuración de Alertas** (`/system/alerts-config`) → sección **Configuración de Correo Electrónico**: Proveedor SMTP, **Servidor**, **Puerto**, **Usuario**, **Contraseña**, **Correo de Remitente Predeterminado** y **Nombre de Remitente Predeterminado**. Hay **Enviar Correo de Prueba**.

> **Así funciona.** Sin esto configurado el sistema **no envía ningún correo**: ni alertas, ni presupuestos, ni enlaces de primera contraseña, ni los códigos del Portal del Paciente. Es de lo primero a configurar en una instalación nueva.

*Permiso: `ALERT_CONFIG_UPDATE`*

### ¿Cómo hago que el sistema genere alertas solo? {#q228}

Misma pantalla, sección **Programador de Alertas**:

| Opción | Efecto |
| --- | --- |
| **Habilitar Trabajo Nocturno** | *«Se ejecuta diariamente para generar alertas basadas en reglas activas.»* Apagado, **no se genera ninguna alerta automática**. |
| **Hora de Ejecución** | A qué hora corre. |
| **Zona Horaria** | |
| **Ejecutar Ahora** | Dispara el proceso manualmente. |

> **Recomendación.** Programá la ejecución fuera del horario de atención, y usá **Ejecutar Ahora** cuando quieras validar una regla nueva sin esperar al día siguiente.

### ¿Cómo creo una regla de alerta? {#q229}

**Sistema → Reglas de Alerta** (`/system/alert-rules`) → Crear.

| Campo | Qué define |
| --- | --- |
| **Nombre** y **Código** | Identificación. |
| **Categoría** | En qué grupo cae la alerta generada. |
| **Prioridad** | Baja / Media / Alta / Crítica. Determina color y orden en el Centro de Alertas. |
| **Tabla de Origen** | Sobre qué entidad se evalúa. |
| **Plantilla de Consulta** y **Condiciones** | Qué registros selecciona. |
| **Días Antes / Días Después del Evento** | El desfase temporal. |
| **Tipo de Recurrencia** | Cada cuánto se reevalúa. |
| **Campo de ID de usuario** / **de tabla** | Cómo se vincula la alerta al paciente y al registro. |
| **Campos a Mostrar** | Qué datos se ven en la tarjeta, con Etiqueta, Columna y Tipo de Dato. |
| **Está Activa** | |

Y el envío automático: **Enviar Correo Automáticamente** + plantilla, **Enviar SMS Automáticamente** + plantilla, y **Plantilla de WhatsApp**.

> **Así funciona.** Si no activás el envío automático, la alerta **solo aparece en el Centro de Alertas** y una persona decide qué hacer.

*Permiso: `ALERT_RULES_CREATE`*

### ¿Cómo pruebo una regla sin esperar a la noche? {#q230}

Botón **Probar Regla** en la fila de la regla. La ejecuta al instante y muestra qué habría generado.

> **Recomendación.** Probá siempre antes de activar una regla con envío automático. Una regla mal condicionada con correo automático le escribe a toda la cartera.

También existe **Duplicar**, para crear una variante de una regla que ya funciona.

### ¿Cómo agrupo las alertas? {#q231}

**Sistema → Categorías de Alerta** (`/system/alert-categories`). Las habituales: Citas, Facturación, Seguimiento, Pacientes, Recordatorios, Fechas y Predeterminado.

### ¿Cómo cambio el texto de una factura impresa? {#q232}

**Configuración → Plantillas de Documentos** (`/config/templates`), sección **Documentos**:

**Factura** · **Presupuesto** · **Recibo de Pago** · **Nota de Crédito** · **Pre-pago** · **Resumen financiero**.

*Permiso: `PRINT_TEMPLATES_VIEW`, `PRINT_TEMPLATES_EDIT`*

### ¿Cómo cambio el texto de un correo automático? {#q233}

Misma pantalla, sección **Correo**:

Correo general al paciente · Seguimiento de alerta · Factura · Presupuesto · **Presupuesto aprobado** · **Presupuesto rechazado** · Pago · **Recordatorio de cita** · **Confirmación de cita** · Resumen financiero · **Actualización de tratamiento** · **Restablecimiento de contraseña**.

### ¿Cómo cambio el texto de un WhatsApp? {#q234}

Misma pantalla, sección **WhatsApp**: Mensaje general al paciente · Seguimiento de alerta · **Recordatorio de cita** · **Tratamiento interrumpido**.

### ¿Cómo uso las variables en una plantilla? {#q235}

Todas las plantillas admiten variables agrupadas en **Paciente**, **Clínica**, **Documento** y **Tablas**: nombre y logo de la clínica, dirección, teléfono, correo, número de documento, fecha, vencimiento, estado, moneda, nombre del paciente, totales, y las tablas de ítems, pagos y movimientos.

Hay **vista previa con datos de ejemplo**, para ver cómo sale impreso sin emitir un documento real.

> **Así funciona.** La impresión ocurre **en el navegador**, componiendo el documento localmente a partir de la plantilla. Por eso es inmediata y por eso la vista previa es fiel.

### ¿Cómo creo una plantilla de indicaciones médicas? {#q236}

**Configuración → Plantillas de Indicaciones Médicas** (`/config/medical-instruction-templates`) → Crear.

Campos: **Nombre** (ej. «Post-extracción»), **Descripción**, **Contenido**, **Está Activa**.

El botón **Variables** inserta campos que se completan solos al usarla: *«como el nombre del paciente, la clínica, la fecha o la pieza dental»*. Hay **Vista previa**.

*Permiso: `MEDICAL_INSTRUCTION_TEMPLATES_CREATE`*

### ¿Cómo creo una plantilla de receta? {#q237}

**Configuración → Plantillas de Receta** (`/config/prescription-templates`). *«Definir la estructura de las recetas médicas: membrete, medicamentos y firma.»*

*Permiso: `PRESCRIPTION_TEMPLATES_CREATE`*

### ¿Cómo apago todos los correos del sistema de golpe? {#q238}

**Sistema → Notificaciones** (`/system/notification-settings`) → **interruptor maestro**.

*«Control maestro para activar o desactivar todos los correos del sistema.»*

Debajo hay una matriz por categoría y plataforma: **Transaccional**, **Clínico**, **Seguridad** y **Marketing**.

> **Así funciona.** Las categorías marcadas como **Crítico** (típicamente Seguridad) no se pueden desactivar.

> **Recomendación.** El interruptor maestro está pensado para cortar envíos durante una migración o una prueba. Acordate de volver a encenderlo.

*Permiso: `NOTIFICATION_SETTINGS_VIEW_MENU`*

### ¿Cuánto tiempo se guardan los históricos? {#q239}

**Configuración de Alertas → Retención de Datos**, en días, para: **Alertas Completadas/Ignoradas**, **Registros de Comunicación** y **Registros de Ejecución**.

---

## Agente de WhatsApp

### ¿Cómo configuro el agente de WhatsApp? {#q240}

**Sistema → Agente WhatsApp** (`/system/whatsapp-agent`). *«Configure el agente conversacional de WhatsApp y su horario de atención.»*

**Agente habilitado** es el interruptor general: *«Si está deshabilitado, el agente no procesa ningún mensaje entrante.»*

*Permiso: `WHATSAPP_AGENT_CONFIG_VIEW`, `WHATSAPP_AGENT_CONFIG_UPDATE`*

### ¿Cómo hago que no responda de noche? {#q241}

Sección **Horario de atención**: *«El agente sólo responde consultas dentro de los rangos definidos. Fuera de ellos no hace nada.»*

- **Aplicar horario** — si se desactiva, *«el agente responde a toda hora»*.
- **Zona horaria**.
- **Reglas**: cada una aplica sus rangos horarios a los días seleccionados. Hay atajos de **Entre semana**, **Fin de semana** y **Todos**, y se pueden agregar varios rangos por regla y varias reglas.

> **Así funciona.** *«Cada regla aplica sus rangos horarios a los días seleccionados. El agente responde dentro de esos rangos (hora local); usá 24:00 como fin del día. Si dos reglas comparten un día, se suman sus rangos.»*

> **Así funciona.** En cada rango, la hora de inicio debe ser menor que la de fin, o el guardado falla con *«Revise los rangos horarios»*.

### ¿Puedo dejar un mensaje automático fuera de horario? {#q242}

Sí: **Mensaje fuera de horario**.

> **Así funciona.** *«Si se completa, el agente envía este texto una vez cuando recibe un mensaje fuera de horario. Si se deja vacío, no responde nada.»* Se envía **una sola vez**, no en cada mensaje.

> **IMAGEN 5.4** — Configuración del agente de WhatsApp con las reglas de horario.

### ¿Qué pasa cuando el agente no puede resolver algo? {#q243}

**Deriva la conversación al equipo** y envía la notificación correspondiente, para que una persona la tome.

---

## Pantalla TV

### ¿Cómo configuro la pantalla de sala de espera? {#q244}

**Pantalla TV** (`/tv-display`). La pantalla en sí se abre en `/tv-display/screen`.

**Identidad y apariencia:** **Nombre de la clínica en pantalla** · **Tema** (Oscuro / Claro / **Corporativo**).

**Qué datos se muestran**, cada uno con su interruptor: Reloj · Fecha · Teléfono, Dirección y Email en el pie · **Nombre del paciente** · **Nombre del doctor** · **Hora del turno** · **Próximo paciente**.

**Comportamiento:** **Avanzar automáticamente al inicio del turno** · **Agrupar por consultorio (columnas)** · **Actualizar cada (minutos)** · **Mostrar promo cada (minutos)** · **Consultorios a mostrar**.

*Permiso: `TV_DISPLAY_UPDATE_SETTINGS`*

### ¿Puedo ocultar el nombre del paciente? {#q245}

Sí: **Mostrar nombre del paciente** → apagado.

> **Recomendación.** En una sala de espera compartida puede no ser deseable exponer nombres completos. El interruptor existe precisamente para eso.

### ¿Cómo pongo videos en la pantalla? {#q246}

Dos mecanismos que conviven:

- **Videos de promoción (pantalla completa).** *«Se reproducen en loop automáticamente cada cierto tiempo. Al interrumpir, el próximo video continúa desde donde quedó.»*
- **Columna de videos lateral.** Posición: Ninguno / Izquierda / Derecha / Arriba / Abajo. *«Se muestra junto a los turnos mientras la pantalla está activa.»*

> **Así funciona.** Para columnas laterales se recomiendan videos **verticales (9:16)**; para las de arriba o abajo, **horizontales (16:9)**. La pantalla lo indica al elegir la posición.

También hay **Música de fondo** con URL de stream.

### ¿Cómo pruebo la configuración sin ir hasta el televisor? {#q247}

La pantalla de gestión tiene **Vista previa**.

---

## Datos, licencia y auditoría

### ¿Cómo importo los datos de otro sistema? {#q248}

**Sistema → Importar Datos** (`/system/import`). *«Importá registros en masa desde un archivo CSV.»*

Entidades importables: **Pacientes · Servicios · Presupuestos · Facturas · Pagos · Citas · Sesiones Clínicas · Sociedades Mutuales**.

El asistente tiene seis pasos:

| Paso | Qué ocurre |
| --- | --- |
| **1. Tipo** | Qué entidad vas a importar. |
| **2. Archivo** | *«Descargá el CSV de ejemplo para ver la estructura esperada.»* Solo `.csv`, máximo **10 MB**. |
| **3. Vista Previa** | Primeros registros, total de filas y columnas detectadas. |
| **4. Mapeo** | *«Relacioná cada columna de tu CSV con el campo correspondiente.»* El asistente propone sugerencias. |
| **5. Validación** | *«Podés continuar solo con los válidos.»* |
| **6. Resultado** | Resumen de lo importado. |

> **Recomendación.** Descargá siempre el CSV de ejemplo primero: define la estructura y te ahorra el mapeo manual. Y en el paso de validación, preferí **corregir el archivo y reimportar** antes que continuar solo con los válidos, para no dejar registros a medio migrar.

*Permiso: `IMPORT_DATA_EXECUTE`*

> **IMAGEN 5.5** — Asistente de importación en el paso de mapeo de columnas.

### ¿Cómo veo quién cambió qué? {#q249}

**Sistema → Registro de Auditoría** (`/system/audit`). Registra cada cambio sobre los datos: **valor anterior, valor nuevo, autor y fecha**, con detalle por registro.

*Permiso: `AUDIT_LOG_VIEW_LIST`, `AUDIT_LOG_VIEW_DETAIL`*

### ¿Cómo veo quién entró al sistema? {#q250}

**Sistema → Registro de Acceso** (`/system/access`). Incluye la **dirección IP** y el **canal**: Web, WhatsApp, Telegram o Email (los tres últimos, del agente de IA).

*Permiso: `ACCESS_LOG_VIEW_LIST`*

### ¿Dónde veo los errores técnicos? {#q251}

**Sistema → Registro de Errores** (`/system/errors`).

*Permiso: `ERROR_LOG_VIEW_LIST`*

### ¿Cómo veo si se enviaron las comunicaciones? {#q252}

Dos registros complementarios:

| Pantalla | Qué muestra |
| --- | --- |
| **Historial de Ejecución** (`/system/execution-history`) | Cada corrida del generador de alertas: cuándo, cuánto tardó, cuántas generó, si falló. |
| **Historial de Comunicaciones** (`/system/communication-history`) | Cada mensaje enviado: destinatario, canal, plantilla, estado de entrega. |

> **Recomendación.** Para diagnosticar «no llegó el recordatorio», revisalos en ese orden: primero si el trabajo corrió, después si el envío se generó y con qué estado, y por último las preferencias de comunicación del paciente.

### ¿Qué es la pantalla de Configuraciones? {#q253}

**Sistema → Configuraciones** (`/system/config`) es la tabla de parámetros técnicos: **Clave**, **Valor**, **Descripción**, **Tipo de Dato**, **¿Es Público?** y **Actualizado Por**.

> **Así funciona.** Afecta al sistema a bajo nivel. Los ajustes funcionales del día a día **no están acá**: están en Preferencias de Clínica, Portal del Paciente, Configuración de Alertas y las preferencias de cada usuario.

> **Recomendación.** No modifiques ni borres una clave sin saber qué consume. Una clave alterada puede dejar una funcionalidad inoperativa sin dar error visible.

*Permiso: `SYS_CONFIG_UPDATE`*

### ¿Cómo veo o renuevo la licencia? {#q254}

**Sistema → Licencias** (`/system/licenses`). El acceso pide una **clave maestra** adicional.

Una licencia define: **Tipo de Suscripción**, **Fecha de Inicio** y **Fin**, **Máx. Doctores**, **Máx. Recepcionistas**, **Máx. Administradores**, **Máx. Super Administradores**, **Máx. Pacientes Nuevos por Mes**, **Acceso IA** y **Notas**.

El botón **Generar Licencia** produce una clave cifrada que se copia con **Copiar Clave**.

El historial está en **Suscripciones** (`/subscriptions`).

*Permiso: `LICENSING_VIEW`, `LICENSING_GENERATE`*

### ¿Por qué no me deja crear otro doctor / usuario / paciente? {#q255}

Porque llegaste al tope de la licencia. El mensaje lo dice:

| Entidad | Mensaje |
| --- | --- |
| **Doctores** | *«Tu suscripción permite hasta N doctores. Actualizá la licencia para agregar más.»* |
| **Usuarios del sistema** | *«Tu suscripción permite hasta N usuarios de sistema (secretarias y administración).»* |
| **Pacientes nuevos** | *«Tu suscripción permite hasta N pacientes nuevos por mes. Se alcanzó el límite de este mes.»* |

### ¿Qué pasa cuando la licencia vence? {#q256}

- **Antes de vencer:** banner de aviso — *«Su licencia vence en N día(s).»*
- **Vencida:** pantalla de bloqueo — *«La licencia de InvokeIA ha expirado.»* con el aviso de que **el acceso de los usuarios está bloqueado**.

# PARTE 6 — EL PACIENTE

**Quién.** El paciente de la clínica, desde su propio dispositivo. No es personal: es la contraparte.

**Para qué sirve esta parte.** Para que quien atiende en recepción sepa exactamente qué ve, qué puede y qué no puede hacer un paciente, y pueda guiarlo por teléfono.

> **IMAGEN 6.1** — Portada del Portal del Paciente con el video de bienvenida y el formulario de identificación.

---

## El acceso

### ¿Por dónde entra el paciente? {#q257}

Por `/patient-login`. Es una dirección distinta de la del equipo (`/login`), y cada pantalla enlaza a la otra.

> **Así funciona.** El acceso del paciente es **sin contraseña**: se identifica y recibe un código de un solo uso por correo.

### ¿Qué le pedimos para identificarse? {#q258}

*«Ingresá tu correo, teléfono o cédula. Te enviamos un código — no necesitás contraseña.»*

Cualquiera de los tres sirve. El sistema busca al paciente por ese dato.

### ¿Qué pasa según lo que encuentre? {#q259}

| Caso | Qué ve el paciente |
| --- | --- |
| **Existe y tiene correo** | El correo **enmascarado** (`j***z@gmail.com`), para que confirme a dónde le llega el código. |
| **Existe pero sin correo** | *«Te encontramos, pero no tenemos un correo registrado. Ingresá uno para enviarte el código.»* |
| **No existe** | La opción **«Soy nuevo, no estoy registrado»**. |

> **Así funciona.** El sistema **nunca devuelve datos del paciente** en este paso, solo el correo enmascarado. Es una pantalla pública.

### ¿Qué pasa si no está registrado y la clínica no acepta reservas online? {#q260}

Ve el aviso: *«Todavía no encontramos tu registro y esta clínica no acepta reservas online. Comunicate directamente para que te den de alta.»*

### ¿Qué datos pedimos a un paciente nuevo? {#q261}

*«No te encontramos en el sistema. Con estos datos alcanza para empezar.»*

**Obligatorios:** Nombre completo · Teléfono · Correo electrónico.
**Opcionales** (*«podés completarlos después»*): Cédula · Fecha de nacimiento · Dirección.

> **Así funciona.** Si el correo o el teléfono ya existen, avisa: *«Ya existe una cuenta con: [campos]. Volvé atrás e ingresá con ese dato.»* No crea duplicados.

### ¿Cómo funciona el código de acceso? {#q262}

*«Enviamos un código de 6 dígitos a [correo]. Vence en 10 minutos.»*

- Se puede **pegar directamente** en la primera casilla.
- Hay **reenvío** tras una espera (*«Podés reenviar el código en Ns»*).
- Tras varios intentos fallidos, el código se invalida: *«El código no es válido o venció. Pedí uno nuevo.»*

### ¿Por qué le pedimos un código? {#q263}

El portal se lo explica al paciente: *«Sólo vos tenés acceso a tu correo. Por eso te pedimos el código: así garantizamos que nadie más pueda ver tu información ni hacer operaciones a tu nombre sin tu consentimiento.»*

### ¿Siempre le pedimos código? {#q264}

No.

> **Así funciona.** Si el paciente **no tiene citas próximas** y la clínica tiene habilitada la reserva online, el portal puede llevarlo **directo a reservar sin pedirle código**: reservar una cita no expone ningún dato sensible. El código se exige para ver el expediente.

> **Así funciona.** Si la clínica configuró **«El portal es sólo para reservar citas»**, nunca se pide código a nadie y ningún paciente ve su perfil.

### «No me llega el código», ¿qué le digo? {#q265}

En este orden:

1. Que revise **la carpeta de spam** — el propio portal se lo sugiere al reenviar.
2. Verificá en su ficha que **el correo registrado sea el correcto**.
3. Verificá que el **correo saliente del sistema** esté configurado y funcionando (Parte 5 → ¿Cómo configuro el correo saliente?).
4. Revisá el **Historial de Comunicaciones** para ver si el envío se generó y con qué estado.

---

## Dentro del portal

### ¿Qué ve el paciente cuando entra? {#q266}

Su perfil en `/my-profile`, con cuatro pestañas:

| Pestaña | Contenido | Permiso |
| --- | --- | --- |
| **Mi Información** | Sus datos personales y de contacto. | `PATIENT_PORTAL_VIEW_INFO` |
| **Mis Citas** | Próximas citas y solicitud de nuevas. | `PATIENT_PORTAL_MANAGE_APPOINTMENTS` |
| **Historial** | Historia clínica, anamnesis, planes de tratamiento, indicaciones médicas y documentos. | `PATIENT_PORTAL_VIEW_HISTORY` |
| **Finanzas** | Su estado de cuenta. | `PATIENT_PORTAL_VIEW_FINANCE` |

El acceso general lo habilita `PATIENT_PORTAL_ACCESS`; el asistente conversacional, `PATIENT_PORTAL_USE_ASSISTANT`.

> **Recomendación.** Estos permisos son del rol **Paciente**. Si la clínica no quiere que el paciente vea, por ejemplo, su estado de cuenta, se quita `PATIENT_PORTAL_VIEW_FINANCE` de ese rol y la pestaña desaparece para todos los pacientes.

### ¿Qué puede hacer con sus citas? {#q267}

- **Reservar cita** — elige día y horario entre los huecos libres.
- **Reagendar** una cita futura.
- **Cancelar** una cita futura.

> **Así funciona.** Las citas pasadas **no aparecen** en esa pestaña: *«No tenés citas agendadas. Las citas pasadas están en tu Historial.»*

### ¿Cómo ve los horarios disponibles? {#q268}

*«Sólo se muestran los horarios con disponibilidad real. Al confirmar, la clínica recibe tu solicitud y te la confirma por correo.»*

Los huecos salen del horario de atención, los feriados y la disponibilidad configurada.

### ¿En qué estado entra una cita reservada por el paciente? {#q269}

En **Pendiente**.

> **Así funciona.** No ocupa la agenda como confirmada: la clínica la revisa y la confirma. Además, **la recepción recibe el aviso en tiempo real** en el momento de la reserva.

> **Recomendación.** Conviene acordar internamente quién revisa las citas en estado Pendiente y con qué frecuencia. El sistema avisa, pero no obliga a nadie a confirmarlas.

### ¿Qué ve al confirmar la reserva? {#q270}

*«¡Tu cita quedó agendada!»* con la fecha y la hora, y el aviso de que *«Enviamos un correo con los detalles de tu cita a vos y a la clínica»*.

### ¿Y si la clínica no tiene habilitada la reserva online? {#q271}

Ve: *«La clínica no tiene habilitada la reserva de citas online. Comunicate directamente para agendar.»*

---

## Límites y seguridad

### ¿Puede un paciente ver los datos de otro? {#q272}

No.

> **Así funciona.** El portal aplica un principio estricto: **un paciente solo puede operar sobre sí mismo**. Cada consulta valida que el registro solicitado corresponda al titular de la sesión; cualquier intento de acceder a otro paciente se rechaza.

### ¿Qué pasa con alguien del equipo que además es paciente de la clínica? {#q273}

Conserva sus permisos de staff.

> **Así funciona.** La restricción de «solo sobre sí mismo» aplica al paciente puro. Es el caso previsto de la recepcionista que también se atiende en la clínica.

### ¿Qué NO puede hacer un paciente desde el portal? {#q274}

- Ver o modificar datos de otros pacientes.
- Cambiar el doctor o los servicios de una cita al reagendar.
- Modificar citas pasadas.
- Confirmar sus propias citas (entran en Pendiente).
- Acceder a nada del sistema de gestión.

---

## Qué ve el paciente de la clínica

### ¿Qué muestra la portada pública? {#q275}

Además del acceso, `/patient-login` funciona como página de presentación:

- **Video de bienvenida** (configurable).
- **Título y mensaje** personalizables.
- Los beneficios: *Reservá y reagendá citas · Consultá tu historia clínica · Mirá tu estado de cuenta*.
- **Dónde encontrarnos**: dirección, teléfono, correo y **horarios de atención** por día de la semana.
- Un enlace de acceso para el equipo.

> **Así funciona.** La dirección, el teléfono, el correo y los horarios salen de **Detalles de la Clínica** y de **Horarios**. Si están mal ahí, están mal en la portada pública.

# PARTE 7 — DIAGNÓSTICO

Ordenado **por lo que ves en pantalla**, no por la causa. Buscá tu síntoma y seguí la secuencia de verificación.

> **Así funciona.** Casi todo lo que se reporta como «no funciona» es configuración o permisos, no una falla. Las tablas de esta parte están ordenadas por probabilidad decreciente: si verificás en orden, encontrás la causa antes.

---

## Tabla rápida

| Síntoma | Verificá primero |
| --- | --- |
| No veo un menú que ve otro | Permiso `_VIEW_MENU` de ese módulo |
| Entro al módulo y está vacío | Falta el permiso `_VIEW_LIST` |
| No aparece el campo de descuento | Descuentos apagados en Preferencias de Clínica |
| Veo el descuento pero no lo puedo editar | Falta `SALES_APPLY_DISCOUNT` |
| No me deja agendar en un horario | Horario de atención, feriado o `block_unavailable` |
| El selector de doctores sale vacío | `filter_doctors_by_service` activo + servicios del doctor sin cargar |
| No llegan las notificaciones en vivo | Configuración del servidor de eventos |
| No llegó el recordatorio al paciente | Trabajo nocturno → Historial de Ejecución → canal del paciente |
| No se creó el plan de tratamiento | El servicio no está marcado como «con flujo» |
| No puedo arrastrar las citas | Falta `APPOINTMENTS_UPDATE` |
| No me deja crear un doctor/usuario/paciente | Tope de la licencia |
| El doctor no ve una agenda | «Doctores con acceso» de ese calendario |
| La caja no cuadra | Aplicaciones de crédito del día |
| El reporte sale vacío | No pulsaste **Generar Reporte** |
| Los gastos del panel aparecen vacíos | No hay gastos cargados en el sistema |
| No llega el código del portal | Correo saliente sin configurar |
| El médico no ve los datos del paciente | Falta `PATIENTS_VIEW_DETAIL_INFO` (puede ser deliberado) |

---

## Permisos y visibilidad

### No veo un menú que sí ve mi compañero {#q276}

1. Tu rol no tiene el permiso `_VIEW_MENU` de ese módulo. El menú se filtra por permisos y lo que no está permitido **no se muestra**, ni siquiera en gris.
2. Pedile a administración que revise la matriz de permisos de tu rol.
3. Después del cambio, **recargá la aplicación**.

### Entro a un módulo y la pantalla está vacía {#q277}

Casi siempre es que te dieron el permiso de **detalle** (`_VIEW_DETAIL`) sin el de **listado** (`_VIEW_LIST`).

> **Recomendación.** Regla para quien configura roles: si das un `_VIEW_DETAIL`, dá siempre el `_VIEW_LIST` correspondiente.

### Un médico entra a Pacientes y no ve datos personales ni el estado de cuenta {#q278}

Puede ser **deliberado**. Falta `PATIENTS_VIEW_DETAIL_INFO` (datos personales y columnas de contacto) y los permisos financieros.

Es una configuración prevista y frecuente: acceso clínico sin datos personales ni comerciales. Confirmá con administración si fue una decisión antes de «corregirlo».

### Veo el campo de descuento pero no puedo modificarlo {#q279}

Falta el permiso `SALES_APPLY_DISCOUNT`. Que el campo se vea en solo lectura es deliberado: te permite saber qué descuento lleva el documento sin poder cambiarlo.

---

## Agenda

### No me deja agendar en un horario {#q280}

En este orden:

1. **¿Está dentro del horario de atención?** El sistema responde *«La fecha y hora seleccionada está fuera del horario de atención del calendario»* y el área se ve atenuada con la etiqueta **No disponible**. → **Configuración → Horarios**.
2. **¿Es feriado o excepción?** → **Configuración → Feriados**.
3. **¿El doctor está disponible?** Solo si tenés activa la preferencia **Verificar disponibilidad**. → **Configuración → Disponibilidad Médica** y **Excepciones**.
4. **¿Alguien tomó el hueco recién?** *«El horario seleccionado ya no está disponible.»*

> **Así funciona.** El bloqueo visual depende de tu preferencia **Bloquear horarios fuera de atención**. Si la apagás, el calendario deja de atenuar esas franjas, pero la validación del backend puede seguir rechazando.

### Al crear una cita, el selector de doctores está vacío {#q281}

Tenés activa la preferencia **Filtrar doctores por servicio**, y el servicio que elegiste **no está cargado en ningún doctor**.

→ **Configuración → Doctores → [doctor] → Servicios**.

O bien apagá la preferencia en **Preferencias → Calendario → Filtrar doctores por servicio**.

### No puedo arrastrar ni redimensionar las citas {#q282}

Falta el permiso `APPOINTMENTS_UPDATE`.

### No veo el tirador para cambiar la duración de una cita {#q283}

La tarjeta es demasiado baja. Pasa con citas cortas y el zoom bajo.

→ Subí la **altura de la hora** (Preferencias → Calendario) o el **zoom**. O usá el menú contextual: clic derecho → **Duración**.

### El doctor no ve una agenda en Mi Consultorio {#q284}

No está en la lista de **Doctores con acceso** de ese calendario.

→ **Configuración → Calendarios → [calendario] → Doctores con acceso**.

### Aparece una cita que nadie cargó {#q285}

Tres orígenes posibles:

1. La **reservó el paciente** desde el portal — entra en estado **Pendiente**.
2. La cargó **otro usuario**; el calendario se actualiza en vivo.
3. Viene **importada de Google Calendar** — lleva un distintivo azul.

### No se creó el plan de tratamiento al agendar {#q286}

El servicio no está marcado como **Servicio con Flujo**, o no tiene pasos definidos.

→ **Ventas → Servicios → [servicio] → Servicio con Flujo → Pasos del Tratamiento**.

> **Así funciona.** Cuando está bien configurado, el formulario de cita **avisa antes de guardar**: *«Agendar esta cita creará un plan de tratamiento con N pasos»*. Si no ves ese aviso, el servicio no tiene flujo.

### El reporte de Cancelaciones no dice nada {#q287}

Porque analiza **por motivo**, y las cancelaciones se cargaron todas como «Otro motivo». Es un problema de proceso, no de configuración: el sistema ofrece los motivos pero no obliga a elegir el correcto.

---

## Ventas y cobro

### No aparece el campo de descuento en ninguna pantalla {#q288}

Los descuentos están **apagados para toda la clínica**.

→ **Configuración → Preferencias de Clínica → Aplicar descuentos**.

### El descuento me lo rechaza {#q289}

*«Supera el máximo permitido (X %)»*: estás por encima del **Descuento máximo** configurado.

> **Así funciona.** El tope aplica también a los descuentos escritos como **importe fijo**: el sistema los convierte a porcentaje y los valida igual.

### No puedo facturar un presupuesto {#q290}

Tiene que estar en estado **Aceptado** o **Confirmado**. Desde borrador no se puede: primero **Confirmar**.

### No me deja facturar el monto que quiero {#q291}

Dos validaciones posibles:

- *«El total de la factura supera el pendiente del presupuesto»*.
- *«El monto supera el pendiente del servicio [X]»*.

Revisá el resumen del diálogo: **Total del presupuesto / Facturado / Pendiente de facturar**.

### La nota de crédito me la rechaza {#q292}

*«El total de la nota de crédito no puede superar X, el monto máximo acreditable restante de la factura.»* Ya se acreditó parte de esa factura.

### El estado de cuenta sale vacío al imprimir {#q293}

El paciente no tiene movimientos **en el período elegido**. El sistema lo avisa en vez de imprimir una hoja vacía. Ampliá el rango o dejá las fechas en blanco.

---

## Caja

### La caja no cuadra {#q294}

Verificá en este orden:

1. **Aplicaciones de crédito del día.** Una factura saldada con una nota de crédito o un prepago **figura cobrada sin que haya entrado efectivo**. Es la causa más frecuente.
2. **Devoluciones en efectivo.** Sí mueven la caja, como egreso.
3. **Misceláneas cargadas con el método de pago equivocado.**
4. **El conteo de billetes.**

> **Recomendación.** Si te «sobra cobrado» contra el efectivo real, el punto 1 explica la diferencia en la enorme mayoría de los casos y no es un faltante.

### Las transacciones de la sesión parecen incompletas {#q295}

Cuando la sesión acumula muchos movimientos, el panel muestra una parte y **avisa del límite**, ofreciendo ampliar la página. No faltan: no están todas cargadas en pantalla.

### No me deja avanzar en el cierre {#q296}

Cada paso del arqueo tiene **su propio permiso**. Puede faltarte `CASH_SESSION_CLOSE_JUSTIFY` (justificar diferencias) o `CASH_SESSION_CLOSE_CONFIRM` (confirmar el cierre), que suelen reservarse a un supervisor.

### No puedo registrar un cobro {#q297}

Verificá que haya **métodos de pago cargados y activos** (`/sales/payment-methods`). Sin métodos de pago no se puede registrar ningún cobro.

---

## Comunicaciones

### No llegó el recordatorio al paciente {#q298}

En este orden:

1. **¿Está encendido el Trabajo Nocturno?** → Sistema → Configuración de Alertas → Programador.
2. **¿Corrió?** → Sistema → **Historial de Ejecución**.
3. **¿Se generó el envío y con qué estado?** → Sistema → **Historial de Comunicaciones**.
4. **¿El paciente tiene el canal habilitado?** → Ficha del paciente → Información → Preferencias.
5. **¿Está configurado el correo saliente?** → Sistema → Configuración de Alertas → Correo → **Enviar Correo de Prueba**.
6. **¿Está encendido el interruptor maestro de notificaciones?** → Sistema → Notificaciones.

### El sistema no envía ningún correo {#q299}

Dos interruptores lo pueden estar cortando todo:

1. **Sistema → Notificaciones → interruptor maestro** — apaga *todos* los correos.
2. **Sistema → Configuración de Alertas → Correo** — sin SMTP configurado no sale nada, incluidos los enlaces de primera contraseña y los códigos del portal.

### Al enviar un correo me avisa que el canal no está habilitado {#q300}

*«Canal de Email No Habilitado»*: esos pacientes tienen el correo deshabilitado en sus **preferencias de comunicación** (ficha → Información → Preferencias).

> **Así funciona.** El sistema **avisa pero no bloquea**: te deja decidir si enviás igual.

### El envío masivo de WhatsApp omitió pacientes {#q301}

El resultado lo desglosa: **«N enviados, N omitidos, N fallidos»**. Los omitidos suelen ser pacientes **sin teléfono** o con **el canal deshabilitado**.

### El agente de WhatsApp no responde {#q302}

1. **¿Está habilitado?** → Sistema → Agente WhatsApp → **Agente habilitado**.
2. **¿Es horario de atención?** Con **Aplicar horario** activo, fuera de los rangos *«no hace nada»*.
3. **¿Hay mensaje fuera de horario configurado?** Si está vacío, el agente no responde nada fuera de hora — es el comportamiento esperado, no una falla.

### No llegan las notificaciones en tiempo real {#q303}

Es configuración técnica del servidor de eventos. Revisá las variables `NEXT_PUBLIC_EVENT_PUSHER_URL`, `NEXT_PUBLIC_EVENT_PUSHER_KEY` y `NEXT_PUBLIC_CLIENT_ID` (Parte 8 → Variables de entorno).

Si la aplicación y el servidor de eventos están en dominios distintos, el servidor de eventos debe permitir explícitamente el origen de la aplicación.

### No le llega el código de acceso al paciente {#q304}

1. **Carpeta de spam** — el portal se lo sugiere al reenviar.
2. **El correo registrado en su ficha** — verificá que sea el correcto.
3. **Correo saliente del sistema** configurado y probado.
4. **Historial de Comunicaciones** para ver si se generó el envío.

---

## Panel y reportes

### El reporte no muestra nada {#q305}

No pulsaste **Generar Reporte**. Ningún reporte se genera al abrirlo: hasta entonces la pantalla dice *«Configura los filtros y presiona Generar»*.

### Los gastos del Panel de Control aparecen vacíos {#q306}

No hay **ningún gasto cargado** en el sistema. El indicador queda vacío a propósito, porque mostrar **$ 0** se leería como «no hubo gastos».

→ Verificá que se estén cargando las **misceláneas de caja** y las **facturas de proveedores**.

### La cobranza no cambia al filtrar por sucursal {#q307}

Es el comportamiento esperado: **los cobros no registran sucursal**, ni directa ni derivadamente. Ese indicador se muestra siempre consolidado.

### La producción por sucursal no coincide exactamente {#q308}

Es un valor **estimado** y el panel lo marca como tal: la sucursal de una factura se deduce de la cita más cercana en el tiempo. Margen de error cercano al **1,2 %**, por pacientes que se atienden en más de una sede.

### Las barras de pacientes no suman el total del período {#q309}

Cada barra cuenta **pacientes únicos de ese período**; quien viene varias veces aparece en varias barras. Es correcto, y el gráfico lo aclara en su leyenda.

---

## Licencia

### No me deja crear otro doctor, usuario o paciente {#q310}

Llegaste al tope de la licencia. El mensaje indica el límite exacto y que hay que actualizarla.

### Apareció un banner de licencia próxima a vencer {#q311}

*«Su licencia vence en N día(s).»* Cuando venza, **el acceso de los usuarios queda bloqueado**. → **Sistema → Licencias**.

# Referencia A — Índice de preguntas

Todas las preguntas del manual, en orden alfabético. En la versión digital, cada entrada es un enlace: al pulsarla, el documento salta a la respuesta.

**311 preguntas.**

| Pregunta | Dónde |
| --- | --- |
| [Al crear una cita, el selector de doctores está vacío](#q281) | Parte 7 · Diagnóstico |
| [Al enviar un correo me avisa que el canal no está habilitado](#q300) | Parte 7 · Diagnóstico |
| [Aparece una cita que nadie cargó](#q285) | Parte 7 · Diagnóstico |
| [Apareció un banner de licencia próxima a vencer](#q311) | Parte 7 · Diagnóstico |
| [¿Cómo abro el portal a los pacientes?](#q222) | Parte 5 · Administración |
| [¿Cómo abro la caja?](#q131) | Parte 3 · Caja |
| [¿Cómo activo los descuentos?](#q218) | Parte 5 · Administración |
| [¿Cómo adjunto una radiografía o una foto a la sesión?](#q096) | Parte 2 · Consultorio |
| [¿Cómo agendo la próxima cita sin salir de la ficha?](#q130) | Parte 2 · Consultorio |
| [¿Cómo agendo sin que se abra la ventana?](#q024) | Parte 1 · Recepción |
| [¿Cómo agendo una cita?](#q022) | Parte 1 · Recepción |
| [¿Cómo agrando el panel de la izquierda o el de la derecha?](#q011) | Parte 0 · Todos |
| [¿Cómo agrego un método de pago?](#q155) | Parte 3 · Caja |
| [¿Cómo agrego una categoría de gasto?](#q142) | Parte 3 · Caja |
| [¿Cómo agrego una sede o sucursal?](#q190) | Parte 5 · Administración |
| [¿Cómo agrupo a los proveedores?](#q182) | Parte 4 · Gerencia |
| [¿Cómo agrupo las alertas?](#q231) | Parte 5 · Administración |
| [¿Cómo aíslo la producción de un convenio?](#q172) | Parte 4 · Gerencia |
| [¿Cómo anoto algo sobre un paciente?](#q066) | Parte 1 · Recepción |
| [¿Cómo anoto los tratamientos por diente?](#q095) | Parte 2 · Consultorio |
| [¿Cómo apago todos los correos del sistema de golpe?](#q238) | Parte 5 · Administración |
| [¿Cómo aplico un descuento?](#q075) | Parte 1 · Recepción |
| [¿Cómo aplico una condición a una sola cara del diente?](#q106) | Parte 2 · Consultorio |
| [¿Cómo asigno un pago a tratamientos concretos?](#q138) | Parte 3 · Caja |
| [¿Cómo asigno una mutualista a un paciente?](#q059) | Parte 1 · Recepción |
| [¿Cómo borro lo que cargué mal?](#q111) | Parte 2 · Consultorio |
| [¿Cómo busco solo a los pacientes que deben?](#q061) | Parte 1 · Recepción |
| [¿Cómo busco un paciente estando en cualquier pantalla?](#q021) | Parte 0 · Todos |
| [¿Cómo busco una cita si no sé la fecha?](#q043) | Parte 1 · Recepción |
| [¿Cómo cambio dónde aparecen los mensajes de confirmación?](#q017) | Parte 0 · Todos |
| [¿Cómo cambio el idioma?](#q014) | Parte 0 · Todos |
| [¿Cómo cambio el texto de un correo automático?](#q233) | Parte 5 · Administración |
| [¿Cómo cambio el texto de un WhatsApp?](#q234) | Parte 5 · Administración |
| [¿Cómo cambio el texto de una factura impresa?](#q232) | Parte 5 · Administración |
| [¿Cómo cambio el video y el mensaje de bienvenida?](#q225) | Parte 5 · Administración |
| [¿Cómo cambio entre la vista de boca y la vista plana?](#q108) | Parte 2 · Consultorio |
| [¿Cómo cambio entre vista de tabla y vista de lista?](#q010) | Parte 0 · Todos |
| [¿Cómo cambio la duración de una cita?](#q030) | Parte 1 · Recepción |
| [¿Cómo cambio mi contraseña estando dentro?](#q004) | Parte 0 · Todos |
| [¿Cómo cambio una cita de hora?](#q029) | Parte 1 · Recepción |
| [¿Cómo cancelo una cita dejando el motivo?](#q040) | Parte 1 · Recepción |
| [¿Cómo cargo el odontograma?](#q105) | Parte 2 · Consultorio |
| [¿Cómo cargo las mutualistas?](#q206) | Parte 5 · Administración |
| [¿Cómo cargo los antecedentes del paciente?](#q101) | Parte 2 · Consultorio |
| [¿Cómo cargo los catálogos clínicos?](#q204) | Parte 5 · Administración |
| [¿Cómo cargo los datos de la clínica?](#q189) | Parte 5 · Administración |
| [¿Cómo cargo los servicios?](#q202) | Parte 5 · Administración |
| [¿Cómo cargo mi firma?](#q018) | Parte 0 · Todos |
| [¿Cómo cargo una factura de proveedor sin tipear?](#q180) | Parte 4 · Gerencia |
| [¿Cómo cierro la caja?](#q147) | Parte 3 · Caja |
| [¿Cómo cierro sesión?](#q005) | Parte 0 · Todos |
| [¿Cómo cierro un día feriado?](#q192) | Parte 5 · Administración |
| [¿Cómo cobro rápido, sin dar vueltas?](#q069) | Parte 1 · Recepción |
| [¿Cómo cobro usando el crédito que el paciente tiene a favor?](#q079) | Parte 1 · Recepción |
| [¿Cómo comparo sucursales?](#q161) | Parte 4 · Gerencia |
| [¿Cómo comparo varios médicos en un solo reporte?](#q171) | Parte 4 · Gerencia |
| [¿Cómo configuro el agente de WhatsApp?](#q240) | Parte 5 · Administración |
| [¿Cómo configuro el correo saliente?](#q227) | Parte 5 · Administración |
| [¿Cómo configuro la numeración de las facturas?](#q201) | Parte 5 · Administración |
| [¿Cómo configuro la pantalla de sala de espera?](#q244) | Parte 5 · Administración |
| [¿Cómo configuro las monedas?](#q200) | Parte 5 · Administración |
| [¿Cómo creo un grupo de pacientes o un convenio?](#q205) | Parte 5 · Administración |
| [¿Cómo creo un rol nuevo?](#q211) | Parte 5 · Administración |
| [¿Cómo creo una plantilla de indicación nueva?](#q122) | Parte 2 · Consultorio |
| [¿Cómo creo una plantilla de indicaciones médicas?](#q236) | Parte 5 · Administración |
| [¿Cómo creo una plantilla de receta?](#q237) | Parte 5 · Administración |
| [¿Cómo creo una regla de alerta?](#q229) | Parte 5 · Administración |
| [¿Cómo declaro un depósito al banco?](#q150) | Parte 3 · Caja |
| [¿Cómo defino cuándo atiende cada doctor?](#q198) | Parte 5 · Administración |
| [¿Cómo defino el horario de atención?](#q191) | Parte 5 · Administración |
| [¿Cómo dejo anotada la próxima cita?](#q097) | Parte 2 · Consultorio |
| [¿Cómo dejo un recordatorio para el equipo?](#q054) | Parte 1 · Recepción |
| [¿Cómo dejo una nota pegada en la pantalla?](#q020) | Parte 0 · Todos |
| [¿Cómo devuelvo dinero en efectivo?](#q146) | Parte 3 · Caja |
| [¿Cómo dicto en vez de escribir?](#q012) | Parte 0 · Todos |
| [¿Cómo doy de alta (finalizo el tratamiento de) un paciente?](#q067) | Parte 1 · Recepción |
| [¿Cómo doy de alta a las secretarias y al personal administrativo?](#q197) | Parte 5 · Administración |
| [¿Cómo doy de alta al paciente al terminar?](#q098) | Parte 2 · Consultorio |
| [¿Cómo doy de alta un consultorio?](#q194) | Parte 5 · Administración |
| [¿Cómo doy de alta un doctor?](#q196) | Parte 5 · Administración |
| [¿Cómo doy de alta un menor con su tutor?](#q057) | Parte 1 · Recepción |
| [¿Cómo doy de alta un paciente?](#q055) | Parte 1 · Recepción |
| [¿Cómo doy de alta un proveedor?](#q181) | Parte 4 · Gerencia |
| [¿Cómo doy de alta un usuario?](#q207) | Parte 5 · Administración |
| [¿Cómo doy de alta una caja física nueva?](#q154) | Parte 3 · Caja |
| [¿Cómo edito los datos de una cita?](#q034) | Parte 1 · Recepción |
| [¿Cómo elijo o cambio mi sede de trabajo?](#q019) | Parte 0 · Todos |
| [¿Cómo emito una receta?](#q112) | Parte 2 · Consultorio |
| [¿Cómo enciendo o apago la pantalla de la sala de espera?](#q083) | Parte 1 · Recepción |
| [¿Cómo encuentro un hueco libre?](#q027) | Parte 1 · Recepción |
| [¿Cómo entro al sistema?](#q001) | Parte 0 · Todos |
| [¿Cómo está organizada la pantalla?](#q007) | Parte 0 · Todos |
| [¿Cómo exporto los pagos del período?](#q156) | Parte 3 · Caja |
| [¿Cómo exporto un reporte?](#q169) | Parte 4 · Gerencia |
| [¿Cómo facturo solo una parte del presupuesto?](#q074) | Parte 1 · Recepción |
| [¿Cómo facturo un presupuesto?](#q073) | Parte 1 · Recepción |
| [¿Cómo filtro el listado de pacientes?](#q062) | Parte 1 · Recepción |
| [¿Cómo funciona el código de acceso?](#q262) | Parte 6 · Paciente |
| [¿Cómo funciona el dictado clínico con IA?](#q093) | Parte 2 · Consultorio |
| [¿Cómo funciona el modelo de permisos?](#q209) | Parte 5 · Administración |
| [¿Cómo habilito la reserva online?](#q223) | Parte 5 · Administración |
| [¿Cómo hago esto desde una tablet o un celular?](#q033) | Parte 1 · Recepción |
| [¿Cómo hago más grandes las citas para verlas mejor?](#q048) | Parte 1 · Recepción |
| [¿Cómo hago que el descuento arranque con un valor?](#q221) | Parte 5 · Administración |
| [¿Cómo hago que el medicamento quede registrado en la anamnesis?](#q114) | Parte 2 · Consultorio |
| [¿Cómo hago que el portal sea solo para reservar, sin abrir el expediente?](#q224) | Parte 5 · Administración |
| [¿Cómo hago que el sistema genere alertas solo?](#q228) | Parte 5 · Administración |
| [¿Cómo hago que la IA me proponga los tratamientos?](#q094) | Parte 2 · Consultorio |
| [¿Cómo hago que no responda de noche?](#q241) | Parte 5 · Administración |
| [¿Cómo hago que un doctor solo vea su agenda?](#q195) | Parte 5 · Administración |
| [¿Cómo hago un presupuesto?](#q072) | Parte 1 · Recepción |
| [¿Cómo hago un servicio de varias citas? (plan de tratamiento)](#q203) | Parte 5 · Administración |
| [¿Cómo hago una nota de crédito?](#q143) | Parte 3 · Caja |
| [¿Cómo importo los datos de otro sistema?](#q248) | Parte 5 · Administración |
| [¿Cómo imprimo el estado de cuenta de un paciente?](#q078) | Parte 1 · Recepción |
| [¿Cómo imprimo la historia clínica completa?](#q103) | Parte 2 · Consultorio |
| [¿Cómo imprimo o exporto la agenda del día?](#q052) | Parte 1 · Recepción |
| [¿Cómo le cambio el color a una cita?](#q039) | Parte 1 · Recepción |
| [¿Cómo le doy acceso clínico a un médico sin mostrarle datos personales?](#q213) | Parte 5 · Administración |
| [¿Cómo le doy indicaciones escritas al paciente?](#q120) | Parte 2 · Consultorio |
| [¿Cómo le mando un correo?](#q065) | Parte 1 · Recepción |
| [¿Cómo le mando un WhatsApp a un paciente?](#q064) | Parte 1 · Recepción |
| [¿Cómo le quito a alguien la posibilidad de hacer descuentos?](#q214) | Parte 5 · Administración |
| [¿Cómo leo la cuenta unificada?](#q176) | Parte 4 · Gerencia |
| [¿Cómo llevo el catálogo de lo que compro?](#q184) | Parte 4 · Gerencia |
| [¿Cómo lo veo más grande?](#q109) | Parte 2 · Consultorio |
| [¿Cómo mando el mismo mensaje a muchos pacientes?](#q082) | Parte 1 · Recepción |
| [¿Cómo marco que el paciente llegó?](#q036) | Parte 1 · Recepción |
| [¿Cómo marco vacaciones o una licencia?](#q199) | Parte 5 · Administración |
| [¿Cómo me entero de que entró una cita nueva?](#q089) | Parte 2 · Consultorio |
| [¿Cómo muestro u oculto consultorios y doctores?](#q046) | Parte 1 · Recepción |
| [¿Cómo muevo una cita a otro día o a la semana que viene?](#q032) | Parte 1 · Recepción |
| [¿Cómo paso a modo oscuro?](#q015) | Parte 0 · Todos |
| [¿Cómo paso una cita a otro doctor o a otro consultorio?](#q031) | Parte 1 · Recepción |
| [¿Cómo pongo a un paciente en un convenio o grupo?](#q060) | Parte 1 · Recepción |
| [¿Cómo pongo un tope al descuento?](#q220) | Parte 5 · Administración |
| [¿Cómo pongo videos en la pantalla?](#q246) | Parte 5 · Administración |
| [¿Cómo pruebo la configuración sin ir hasta el televisor?](#q247) | Parte 5 · Administración |
| [¿Cómo pruebo una regla sin esperar a la noche?](#q230) | Parte 5 · Administración |
| [¿Cómo reagendo una cita?](#q042) | Parte 1 · Recepción |
| [¿Cómo registro lo que hice en la consulta?](#q091) | Parte 2 · Consultorio |
| [¿Cómo registro un cobro?](#q137) | Parte 3 · Caja |
| [¿Cómo registro un día de atención reducida (medio día)?](#q193) | Parte 5 · Administración |
| [¿Cómo registro un gasto chico? (caja chica)](#q141) | Parte 3 · Caja |
| [¿Cómo registro un pago a proveedor?](#q183) | Parte 4 · Gerencia |
| [¿Cómo registro una seña o un adelanto?](#q140) | Parte 3 · Caja |
| [¿Cómo saco el QR y el flier para la sala de espera?](#q226) | Parte 5 · Administración |
| [¿Cómo saco un reporte?](#q167) | Parte 4 · Gerencia |
| [¿Cómo sé cuánto va a durar la cita?](#q025) | Parte 1 · Recepción |
| [¿Cómo sé cuántos presupuestos se están cerrando?](#q185) | Parte 4 · Gerencia |
| [¿Cómo sé quién abandonó un tratamiento?](#q125) | Parte 2 · Consultorio |
| [¿Cómo sé quién todavía no entró nunca?](#q208) | Parte 5 · Administración |
| [¿Cómo uso la matriz de permisos?](#q212) | Parte 5 · Administración |
| [¿Cómo uso las variables en una plantilla?](#q235) | Parte 5 · Administración |
| [¿Cómo ve los horarios disponibles?](#q268) | Parte 6 · Paciente |
| [¿Cómo veo a los pacientes que dejaron un tratamiento a medias?](#q187) | Parte 4 · Gerencia |
| [¿Cómo veo cómo estaba la boca hace seis meses?](#q110) | Parte 2 · Consultorio |
| [¿Cómo veo cómo viene el día y el mes?](#q158) | Parte 4 · Gerencia |
| [¿Cómo veo cuánto debe un paciente?](#q077) | Parte 1 · Recepción |
| [¿Cómo veo cuánto debería tener en el cajón?](#q135) | Parte 3 · Caja |
| [¿Cómo veo el detalle de la cuenta de un paciente?](#q175) | Parte 4 · Gerencia |
| [¿Cómo veo el gasto total de la clínica?](#q174) | Parte 4 · Gerencia |
| [¿Cómo veo el historial de citas de un paciente?](#q063) | Parte 1 · Recepción |
| [¿Cómo veo el teléfono del paciente sin abrir su ficha?](#q049) | Parte 1 · Recepción |
| [¿Cómo veo la agenda de un solo consultorio a pantalla completa?](#q044) | Parte 1 · Recepción |
| [¿Cómo veo la evolución de los últimos meses?](#q164) | Parte 4 · Gerencia |
| [¿Cómo veo los datos de contacto en el listado?](#q068) | Parte 1 · Recepción |
| [¿Cómo veo mi agenda de otro día?](#q086) | Parte 2 · Consultorio |
| [¿Cómo veo o renuevo la licencia?](#q254) | Parte 5 · Administración |
| [¿Cómo veo qué roles tienen un permiso?](#q215) | Parte 5 · Administración |
| [¿Cómo veo quién cambió qué?](#q249) | Parte 5 · Administración |
| [¿Cómo veo quién entró al sistema?](#q250) | Parte 5 · Administración |
| [¿Cómo veo si se enviaron las comunicaciones?](#q252) | Parte 5 · Administración |
| [¿Cómo veo una tomografía o una radiografía?](#q126) | Parte 2 · Consultorio |
| [¿Cómo veo varios consultorios a la vez?](#q045) | Parte 1 · Recepción |
| [¿Contra qué se compara el dato del día?](#q159) | Parte 4 · Gerencia |
| [¿Cuál es la diferencia entre cancelar y eliminar una cita?](#q041) | Parte 1 · Recepción |
| [¿Cuáles son los estados y qué significan?](#q037) | Parte 1 · Recepción |
| [¿Cuáles son los roles que vienen de fábrica?](#q210) | Parte 5 · Administración |
| [¿Cuándo uso una nota de crédito?](#q144) | Parte 3 · Caja |
| [¿Cuánto tiempo se guardan los históricos?](#q239) | Parte 5 · Administración |
| [¿Cuántos pasos tiene el Cobro Rápido?](#q070) | Parte 1 · Recepción |
| [¿Descuento por servicio o sobre el total?](#q219) | Parte 5 · Administración |
| [¿Dónde configuro mis preferencias?](#q016) | Parte 0 · Todos |
| [¿Dónde está la historia clínica de un paciente?](#q100) | Parte 2 · Consultorio |
| [¿Dónde sigo el avance?](#q124) | Parte 2 · Consultorio |
| [¿Dónde veo las alergias sin buscar?](#q104) | Parte 2 · Consultorio |
| [¿Dónde veo los cierres anteriores?](#q153) | Parte 3 · Caja |
| [¿Dónde veo los errores técnicos?](#q251) | Parte 5 · Administración |
| [¿Dónde veo todo lo que se le hizo al paciente?](#q102) | Parte 2 · Consultorio |
| [El agente de WhatsApp no responde](#q302) | Parte 7 · Diagnóstico |
| [El descuento me lo rechaza](#q289) | Parte 7 · Diagnóstico |
| [El doctor faltó, ¿cómo paso todas sus citas a otro?](#q053) | Parte 1 · Recepción |
| [El doctor no ve una agenda en Mi Consultorio](#q284) | Parte 7 · Diagnóstico |
| [El envío masivo de WhatsApp omitió pacientes](#q301) | Parte 7 · Diagnóstico |
| [El estado de cuenta sale vacío al imprimir](#q293) | Parte 7 · Diagnóstico |
| [El reporte de Cancelaciones no dice nada](#q287) | Parte 7 · Diagnóstico |
| [El reporte no muestra nada](#q305) | Parte 7 · Diagnóstico |
| [El sistema no envía ningún correo](#q299) | Parte 7 · Diagnóstico |
| [En el Cobro Rápido, ¿tengo que cobrar sí o sí?](#q071) | Parte 1 · Recepción |
| [¿En qué estado entra una cita reservada por el paciente?](#q269) | Parte 6 · Paciente |
| [Entro a un módulo y la pantalla está vacía](#q277) | Parte 7 · Diagnóstico |
| [La caja no cuadra](#q294) | Parte 7 · Diagnóstico |
| [La cobranza no cambia al filtrar por sucursal](#q307) | Parte 7 · Diagnóstico |
| [La nota de crédito me la rechaza](#q292) | Parte 7 · Diagnóstico |
| [¿La producción por sucursal es exacta?](#q162) | Parte 4 · Gerencia |
| [La producción por sucursal no coincide exactamente](#q308) | Parte 7 · Diagnóstico |
| [Las barras de pacientes no suman el total del período](#q309) | Parte 7 · Diagnóstico |
| [Las transacciones de la sesión parecen incompletas](#q295) | Parte 7 · Diagnóstico |
| [Los avisos me interrumpen, ¿puedo cambiarlos?](#q090) | Parte 2 · Consultorio |
| [Los gastos del Panel de Control aparecen vacíos](#q306) | Parte 7 · Diagnóstico |
| [Me dice que el correo ya está registrado, ¿qué hago?](#q056) | Parte 1 · Recepción |
| [No aparece el campo de descuento en ninguna pantalla](#q288) | Parte 7 · Diagnóstico |
| [No le llega el código de acceso al paciente](#q304) | Parte 7 · Diagnóstico |
| [No llegan las notificaciones en tiempo real](#q303) | Parte 7 · Diagnóstico |
| [No llegó el recordatorio al paciente](#q298) | Parte 7 · Diagnóstico |
| [No me deja agendar en un horario](#q280) | Parte 7 · Diagnóstico |
| [No me deja avanzar en el cierre](#q296) | Parte 7 · Diagnóstico |
| [No me deja crear otro doctor, usuario o paciente](#q310) | Parte 7 · Diagnóstico |
| [No me deja facturar el monto que quiero](#q291) | Parte 7 · Diagnóstico |
| [«No me llega el código», ¿qué le digo?](#q265) | Parte 6 · Paciente |
| [No puedo arrastrar ni redimensionar las citas](#q282) | Parte 7 · Diagnóstico |
| [No puedo facturar un presupuesto](#q290) | Parte 7 · Diagnóstico |
| [No puedo registrar un cobro](#q297) | Parte 7 · Diagnóstico |
| [No se creó el plan de tratamiento al agendar](#q286) | Parte 7 · Diagnóstico |
| [No veo el tirador para cambiar la duración de una cita](#q283) | Parte 7 · Diagnóstico |
| [No veo un menú que sí ve mi compañero](#q276) | Parte 7 · Diagnóstico |
| [Olvidé mi contraseña](#q003) | Parte 0 · Todos |
| [¿Por dónde empiezo?](#q084) | Parte 2 · Consultorio |
| [¿Por dónde empiezo?](#q188) | Parte 5 · Administración |
| [¿Por dónde entra el paciente?](#q257) | Parte 6 · Paciente |
| [¿Por qué aparece una cita que yo no cargué?](#q051) | Parte 1 · Recepción |
| [¿Por qué aparece una fila de «Saldo anterior»?](#q177) | Parte 4 · Gerencia |
| [¿Por qué dice que la receta saldrá sin firmar?](#q117) | Parte 2 · Consultorio |
| [¿Por qué el reporte de Cancelaciones no dice nada útil?](#q173) | Parte 4 · Gerencia |
| [¿Por qué entro a Pacientes y no veo los datos personales?](#q129) | Parte 2 · Consultorio |
| [¿Por qué entro a una pantalla distinta que mi compañero?](#q006) | Parte 0 · Todos |
| [¿Por qué la cobranza no cambia al filtrar por sucursal?](#q163) | Parte 4 · Gerencia |
| [¿Por qué la factura figura cobrada si no entró plata?](#q145) | Parte 3 · Caja |
| [¿Por qué las barras de pacientes no suman el total del período?](#q165) | Parte 4 · Gerencia |
| [¿Por qué le pedimos un código?](#q263) | Parte 6 · Paciente |
| [¿Por qué los gastos aparecen vacíos y no en cero?](#q160) | Parte 4 · Gerencia |
| [¿Por qué no me deja agendar a esa hora?](#q028) | Parte 1 · Recepción |
| [¿Por qué no me deja crear otro doctor / usuario / paciente?](#q255) | Parte 5 · Administración |
| [¿Por qué no puedo editar la agenda de ayer?](#q087) | Parte 2 · Consultorio |
| [¿Por qué no puedo poner el descuento?](#q076) | Parte 1 · Recepción |
| [¿Por qué no veo un menú que sí ve mi compañero?](#q009) | Parte 0 · Todos |
| [¿Por qué un presupuesto se rechazó?](#q186) | Parte 4 · Gerencia |
| [¿Por qué un usuario no ve algo que debería ver?](#q217) | Parte 5 · Administración |
| [¿Por qué veo (o no veo) la agenda de otro consultorio?](#q088) | Parte 2 · Consultorio |
| [¿Puede un paciente ver los datos de otro?](#q272) | Parte 6 · Paciente |
| [¿Puedo cargar movimientos anteriores al sistema?](#q179) | Parte 4 · Gerencia |
| [¿Puedo crear permisos nuevos?](#q216) | Parte 5 · Administración |
| [¿Puedo dejar un mensaje automático fuera de horario?](#q242) | Parte 5 · Administración |
| [¿Puedo dictar en vez de escribir?](#q092) | Parte 2 · Consultorio |
| [¿Puedo imprimir la apertura?](#q134) | Parte 3 · Caja |
| [¿Puedo imprimirla en el momento de guardarla?](#q121) | Parte 2 · Consultorio |
| [¿Puedo ocultar el nombre del paciente?](#q245) | Parte 5 · Administración |
| [¿Puedo reimprimir un cierre anterior?](#q152) | Parte 3 · Caja |
| [¿Puedo tener varios formatos de receta?](#q119) | Parte 2 · Consultorio |
| [¿Puedo ver cómo va a quedar antes de imprimir?](#q115) | Parte 2 · Consultorio |
| [¿Puedo ver cuánto debe el paciente?](#q128) | Parte 2 · Consultorio |
| [¿Qué cambia cuando un paciente es dependiente?](#q058) | Parte 1 · Recepción |
| [¿Qué condiciones puedo marcar?](#q107) | Parte 2 · Consultorio |
| [¿Qué cuenta como paciente nuevo?](#q166) | Parte 4 · Gerencia |
| [¿Qué datos lleva cada medicamento?](#q113) | Parte 2 · Consultorio |
| [¿Qué datos pedimos a un paciente nuevo?](#q261) | Parte 6 · Paciente |
| [¿Qué datos pide el formulario de cita?](#q023) | Parte 1 · Recepción |
| [¿Qué es el Centro de Alertas y qué hago con él?](#q080) | Parte 1 · Recepción |
| [¿Qué es el panel de la derecha y qué tiene?](#q008) | Parte 0 · Todos |
| [¿Qué es el paso de «Declarar»?](#q148) | Parte 3 · Caja |
| [¿Qué es la pantalla de Configuraciones?](#q253) | Parte 5 · Administración |
| [¿Qué es un plan de tratamiento y cómo se crea?](#q123) | Parte 2 · Consultorio |
| [¿Qué filtros tengo?](#q168) | Parte 4 · Gerencia |
| [¿Qué hago si no cuadra?](#q149) | Parte 3 · Caja |
| [¿Qué le pedimos para identificarse?](#q258) | Parte 6 · Paciente |
| [¿Qué muestra el panel de la sesión activa?](#q136) | Parte 3 · Caja |
| [¿Qué muestra la portada pública?](#q275) | Parte 6 · Paciente |
| [¿Qué NO puede hacer un paciente desde el portal?](#q274) | Parte 6 · Paciente |
| [¿Qué pasa con alguien del equipo que además es paciente de la clínica?](#q273) | Parte 6 · Paciente |
| [¿Qué pasa cuando el agente no puede resolver algo?](#q243) | Parte 5 · Administración |
| [¿Qué pasa cuando guardo la sesión?](#q099) | Parte 2 · Consultorio |
| [¿Qué pasa cuando la licencia vence?](#q256) | Parte 5 · Administración |
| [¿Qué pasa según lo que encuentre?](#q259) | Parte 6 · Paciente |
| [¿Qué pasa si cierro un formulario sin guardar?](#q013) | Parte 0 · Todos |
| [¿Qué pasa si el paciente paga de más?](#q139) | Parte 3 · Caja |
| [¿Qué pasa si no está registrado y la clínica no acepta reservas online?](#q260) | Parte 6 · Paciente |
| [¿Qué pongo en el tipo de cambio?](#q132) | Parte 3 · Caja |
| [¿Qué puede hacer con sus citas?](#q267) | Parte 6 · Paciente |
| [¿Qué puedo hacer con el clic derecho sobre una cita?](#q035) | Parte 1 · Recepción |
| [¿Qué puedo hacer con una alerta?](#q081) | Parte 1 · Recepción |
| [¿Qué puedo hacer desde cada cita de la agenda?](#q085) | Parte 2 · Consultorio |
| [¿Qué puedo hacer desde una fila de la cuenta?](#q178) | Parte 4 · Gerencia |
| [¿Qué puedo hacer sobre la imagen?](#q127) | Parte 2 · Consultorio |
| [¿Qué reporte uso para cada pregunta?](#q170) | Parte 4 · Gerencia |
| [¿Qué sale en el informe de cierre?](#q151) | Parte 3 · Caja |
| [¿Qué sale impreso?](#q118) | Parte 2 · Consultorio |
| [¿Qué significan los colores de las citas?](#q038) | Parte 1 · Recepción |
| [¿Qué significan los tipos de transacción de la lista de pagos?](#q157) | Parte 3 · Caja |
| [¿Qué ve al confirmar la reserva?](#q270) | Parte 6 · Paciente |
| [¿Qué ve el paciente cuando entra?](#q266) | Parte 6 · Paciente |
| [¿Qué vistas de calendario hay?](#q047) | Parte 1 · Recepción |
| [Si el paciente es un menor, ¿a quién llamo?](#q050) | Parte 1 · Recepción |
| [Si hago clic en la columna de un consultorio, ¿tengo que volver a elegirlo?](#q026) | Parte 1 · Recepción |
| [¿Siempre le pedimos código?](#q264) | Parte 6 · Paciente |
| [Soy nuevo en la clínica, ¿cómo creo mi contraseña?](#q002) | Parte 0 · Todos |
| [¿Tengo que contar billete por billete?](#q133) | Parte 3 · Caja |
| [¿Tengo que escribir los medicamentos en el cuerpo de la receta?](#q116) | Parte 2 · Consultorio |
| [Un médico entra a Pacientes y no ve datos personales ni el estado de cuenta](#q278) | Parte 7 · Diagnóstico |
| [Veo el campo de descuento pero no puedo modificarlo](#q279) | Parte 7 · Diagnóstico |
| [¿Y si la clínica no tiene habilitada la reserva online?](#q271) | Parte 6 · Paciente |
# Referencia B — Mapa de URLs

Todas las rutas llevan prefijo de idioma: `/es/...` o `/en/...`.

| URL | Pantalla | Parte de este manual |
| --- | --- | --- |
| `/login` | Inicio de sesión del equipo | 0 |
| `/patient-login` | Portal del Paciente — portada | 6 |
| `/set-first-password` | Establecer primera contraseña | 0 |
| `/reset-password` | Restablecer contraseña | 0 |
| `/` | Panel de Control | 4 |
| `/workspace` | Mi Consultorio | 2 |
| `/alerts` | Centro de Alertas | 1 |
| `/appointments` | Citas / Calendario | 1 |
| `/patients` | Pacientes | 1, 2 |
| `/clinic-history/[id]` | Historia clínica de un paciente | 2 |
| `/studies` | Estudios DICOM | 2 |
| `/shared-studies` | Estudios compartidos | 2 |
| `/my-profile` | Mi perfil / Portal del Paciente | 0, 6 |
| `/preferences` | Preferencias del usuario | 0 |
| `/tv-display` | Gestión de la Pantalla TV | 1, 5 |
| `/tv-display/screen` | La pantalla de sala de espera | 5 |
| `/cashier` | Caja / sesión activa | 3 |
| `/cashier/sessions` | Historial de sesiones de caja | 3 |
| `/cashier/cash-points` | Cajas registradoras físicas | 3 |
| `/cashier/miscellaneous-transactions` | Transacciones misceláneas | 3 |
| `/cashier/miscellaneous-categories` | Categorías de misceláneas | 3 |
| `/sales/quotes` | Presupuestos | 1 |
| `/sales/invoices` | Facturas | 1, 3 |
| `/sales/payments` | Pagos | 3 |
| `/sales/payment-methods` | Métodos de pago | 3 |
| `/sales/services` | Servicios | 5 |
| `/sales/orders` | Órdenes *(oculta del menú)* | — |
| `/purchases/quotes` | Presupuestos de compra | 4 |
| `/purchases/invoices` | Facturas de compra | 4 |
| `/purchases/payments` | Pagos a proveedores | 4 |
| `/purchases/providers` | Proveedores | 4 |
| `/purchases/services` | Productos de proveedores | 4 |
| `/purchases/orders` | Órdenes de compra *(oculta del menú)* | — |
| `/clinic-catalog/ailments` | Padecimientos | 5 |
| `/clinic-catalog/medications` | Medicamentos | 5 |
| `/clinic-catalog/dental-conditions` | Condiciones dentales | 5 |
| `/clinic-catalog/dental-surfaces` | Superficies dentales | 5 |
| `/config/clinics` | Detalles de la Clínica | 5 |
| `/config/clinic-prefs` | Preferencias de Clínica (descuentos) | 5 |
| `/config/patients-portal` | Portal del Paciente (configuración) | 5 |
| `/config/sedes` | Sedes / Sucursales | 5 |
| `/config/schedules` | Horarios | 5 |
| `/config/holidays` | Feriados | 5 |
| `/config/calendars` | Calendarios / Consultorios | 5 |
| `/config/doctors` | Doctores | 5 |
| `/config/doctor-availability` | Disponibilidad médica | 5 |
| `/config/availability-exceptions` | Excepciones de disponibilidad | 5 |
| `/config/currencies` | Monedas y tipos de cambio | 5 |
| `/config/sequences` | Secuencias de numeración | 5 |
| `/config/mutual-societies` | Sociedades mutuales | 5 |
| `/config/patient-groups` | Grupos de pacientes | 5 |
| `/config/provider-groups` | Grupos de proveedores | 5 |
| `/config/templates` | Plantillas de documentos | 5 |
| `/config/medical-instruction-templates` | Plantillas de indicaciones médicas | 5 |
| `/config/prescription-templates` | Plantillas de receta | 5 |
| `/system/users` | Usuarios del sistema | 5 |
| `/system/staff` | Secretarias y Administración | 5 |
| `/roles` | Roles | 5 |
| `/permissions` | Permisos | 5 |
| `/system/config` | Configuraciones | 5 |
| `/system/notification-settings` | Configuración de notificaciones | 5 |
| `/system/alerts-config` | Configuración del sistema de alertas | 5 |
| `/system/alert-categories` | Categorías de alertas | 5 |
| `/system/alert-rules` | Reglas de alertas | 5 |
| `/system/communication-templates` | Plantillas de comunicación | 5 |
| `/system/communication-history` | Historial de comunicaciones | 5 |
| `/system/execution-history` | Historial de ejecución | 5 |
| `/system/whatsapp-agent` | Agente de WhatsApp | 5 |
| `/system/audit` | Registro de auditoría | 5 |
| `/system/access` | Registro de acceso | 5 |
| `/system/errors` | Registro de errores | 5 |
| `/system/import` | Importar datos | 5 |
| `/system/licenses` | Licencias | 5 |
| `/subscriptions` | Suscripciones | 5 |

**Reportes:** `/reports/` + `cierre-caja` · `cobros-dia` · `cuentas-corrientes` · `estado-presupuestos` · `produccion-doctor` · `tratamientos` · `comparativo-produccion` · `honorarios` · `nuevos-pacientes` · `pacientes-inactivos` · `tratamientos-en-curso` · `ocupacion-agenda` · `cancelaciones` · `ingresos-periodo` · `facturacion-cobranza` · `deudores` · `servicios` · `gastos-operativos` · `estado-resultados` · `kpis` · `balance-mensual`

---

# Referencia C — Catálogo completo de permisos

Para configurar roles en **Sistema → Roles → [rol] → Permisos**.

## Panel de Control

`DASHBOARD_VIEW_MENU` · `DASHBOARD_DOCTOR_WORKSPACE_ACCESS` · `DASHBOARD_VIEW_KPIS` · `DASHBOARD_VIEW_CHARTS` · `DASHBOARD_VIEW_OPERATIONAL_KPIS` · `DASHBOARD_VIEW_RECENT_QUOTES` · `DASHBOARD_VIEW_RECENT_ORDERS` · `DASHBOARD_VIEW_NEW_PATIENTS` · `DASHBOARD_APPLY_FILTERS` · `DASHBOARD_VIEW_EXECUTIVE_SUMMARY` · `DASHBOARD_VIEW_BY_BRANCH`

## Citas y calendarios

`APPOINTMENTS_VIEW_CALENDAR` · `APPOINTMENTS_CREATE` · `APPOINTMENTS_UPDATE` · `APPOINTMENTS_DELETE` · `CALENDARS_VIEW_MENU` · `CALENDARS_VIEW_LIST` · `CALENDARS_CREATE` · `CALENDARS_UPDATE` · `CALENDARS_DELETE` · `CALENDARS_TOGGLE_STATUS` · `CALENDARS_MANAGE_USERS`

> **Así funciona.** `APPOINTMENTS_UPDATE` gobierna a la vez editar la cita, cambiarle el estado, arrastrarla y redimensionarla.

## Pacientes

**Listado:** `PATIENTS_VIEW_MENU` · `PATIENTS_VIEW_LIST` · `PATIENTS_CREATE` · `PATIENTS_UPDATE` · `PATIENTS_TOGGLE_STATUS` · `PATIENTS_SEARCH_DEBTORS` · `PATIENTS_COPY_ID`

**Panel de detalle:** `PATIENTS_VIEW_DETAIL` · `PATIENTS_VIEW_DETAIL_INFO` · `PATIENTS_VIEW_DETAIL_HISTORY` · `PATIENTS_VIEW_DETAIL_APPOINTMENTS` · `PATIENTS_VIEW_DETAIL_QUOTES` · `PATIENTS_VIEW_DETAIL_ORDERS` · `PATIENTS_VIEW_DETAIL_INVOICES` · `PATIENTS_VIEW_DETAIL_PAYMENTS` · `PATIENTS_VIEW_DETAIL_MESSAGES` · `PATIENTS_VIEW_DETAIL_NOTES`

**Acciones:** `PATIENTS_SEND_WHATSAPP_TEMPLATE` · `PATIENTS_CREATE_NOTE` · `PATIENTS_UPDATE_NOTE` · `PATIENTS_DELETE_NOTE` · `PATIENTS_MANAGE_APPOINTMENTS`

> **Así funciona.** `PATIENTS_VIEW_DETAIL_INFO` gobierna la pestaña **Información** y las columnas de correo y teléfono del listado. Cualquiera de los cuatro permisos financieros (`_QUOTES`, `_ORDERS`, `_INVOICES`, `_PAYMENTS`) habilita la pestaña **Finanzas** y el atajo «Ver estado de cuenta».

## Historia clínica

`MEDICAL_HISTORY_VIEW_MENU` · `MEDICAL_HISTORY_VIEW` · `ANAMNESIS_VIEW` · `ANAMNESIS_ADD_PERSONAL` · `TIMELINE_VIEW` · `CLINICAL_SESSION_CREATE` · `CLINICAL_SESSION_VIEW_DETAIL` · `CLINICAL_SESSION_UPDATE` · `CLINICAL_SESSION_DELETE` · `CLINICAL_SESSION_UPLOAD_ATTACHMENT` · `CLINICAL_SESSION_VIEW_ATTACHMENTS` · `CLINICAL_SESSION_DELETE_ATTACHMENT` · `ODONTOGRAM_VIEW` · `ODONTOGRAM_REGISTER_SESSION` · `ODONTOGRAM_NAVIGATE_HISTORY` · `ODONTOGRAM_TOGGLE_VIEW` · `CLINICAL_DOCS_VIEW` · `CLINICAL_DOCS_UPLOAD`

**Indicaciones médicas:** `PATIENT_MEDICAL_INSTRUCTIONS_VIEW` · `_CREATE` · `_UPDATE` · `_DELETE`

**Recetas médicas:** `PATIENT_PRESCRIPTIONS_VIEW` · `_CREATE` · `_UPDATE` · `_DELETE`

## Estudios por imágenes

`DICOM_VIEW_MENU` · `DICOM_VIEW_STUDIES` · `DICOM_VIEW_SHARED_STUDIES` · `DICOM_VIEW_LIST` · `DICOM_VIEW_STUDY` · `DICOM_USE_MPR` · `DICOM_USE_MEASUREMENTS` · `DICOM_USE_WINDOW` · `DICOM_ADD_ANNOTATIONS` · `DICOM_CHANGE_LAYOUT`

## Ventas

**Menú:** `SALES_VIEW_MENU`

**Presupuestos:** `SALES_QUOTES_VIEW_MENU` · `_VIEW_LIST` · `_VIEW_DETAIL` · `_CREATE` · `_UPDATE` · `_DELETE` · `_CONFIRM` · `_REJECT` · `_SEND_EMAIL` · `_PRINT` · `_EXPORT` · `_VIEW_ITEMS` · `_ADD_ITEM` · `_UPDATE_ITEM` · `_DELETE_ITEM` · `_VIEW_ORDERS` · `_VIEW_INVOICES` · `_VIEW_PAYMENTS`

**Facturas:** `SALES_INVOICES_VIEW_MENU` · `_VIEW_LIST` · `_VIEW_DETAIL` · `_CREATE` · `_UPDATE` · `_DELETE` · `_CONFIRM` · `_PRINT` · `_SEND_EMAIL` · `_EXPORT` · `_VIEW_ITEMS` · `_ADD_ITEM` · `_UPDATE_ITEM` · `_DELETE_ITEM`

**Notas de crédito:** `CREDIT_NOTE_CREATE` · `CREDIT_NOTE_VIEW_LIST` · `CREDIT_NOTE_CONFIRM` · `CREDIT_NOTE_SELECT_ITEMS`

**Pagos:** `SALES_PAYMENTS_VIEW_MENU` · `_VIEW_LIST` · `_VIEW_DETAIL` · `_CREATE` · `_EXPORT` · `SALES_PAYMENTS_USE_CREDITS` · `SALES_PREPAYMENTS_CREATE` · `SALES_PREPAYMENTS_VIEW`

**Métodos de pago:** `PAYMENT_METHODS_VIEW_MENU` · `_VIEW_LIST` · `_CREATE` · `_UPDATE` · `_DELETE` · `_TOGGLE_STATUS`

**Servicios:** `SALES_SERVICES_VIEW_MENU` · `_VIEW_LIST` · `_CREATE` · `_UPDATE` · `_DELETE`

**Descuentos:** `SALES_APPLY_DISCOUNT`

**Órdenes de venta** (existen, con la pestaña oculta del menú): `SALES_ORDERS_VIEW_MENU` · `_VIEW_LIST` · `_VIEW_DETAIL` · `_CREATE` · `_UPDATE` · `_DELETE` · `_VIEW_ITEMS` · `_ADD_ITEM` · `_UPDATE_ITEM` · `_DELETE_ITEM` · `_SCHEDULE_ITEM` · `_COMPLETE_ITEM` · `_INVOICE_FROM_ORDER`

## Compras

`PURCHASES_VIEW_MENU` · `PURCHASE_QUOTES_*` · `PURCHASE_ORDERS_*` (incluye `PURCHASE_ORDERS_CONVERT_INVOICE`) · `PURCHASE_INVOICES_*` (incluye `PURCHASE_INVOICES_IMPORT_AI`) · `PURCHASE_PAYMENTS_*` · `PURCHASE_PREPAYMENTS_CREATE` · `PURCHASE_PREPAYMENTS_VIEW` · `SUPPLIERS_*` (incluye `SUPPLIERS_VIEW_SERVICES`, `_ADD_SERVICE`, `_UPDATE_SERVICE`, `_DELETE_SERVICE`) · `PURCHASE_PRODUCTS_*`

## Caja

**Sesión:** `CASHIER_VIEW_MENU` · `CASHIER_VIEW_WIDGET` · `CASH_SESSION_VIEW_LIST` · `_VIEW_DETAIL` · `_VIEW_TRANSACTIONS` · `CASH_SESSION_OPEN` · `_SET_EXCHANGE_RATE` · `_COUNT_OPENING` · `_FILL_LAST_CLOSE` · `_PRINT_OPENING`

**Cierre, un permiso por paso:** `CASH_SESSION_CLOSE_REVIEW` · `_CLOSE_COUNT` · `_CLOSE_DEPOSIT` · `_CLOSE_DECLARE` · `_CLOSE_JUSTIFY` · `_CLOSE_CONFIRM` · `CASH_SESSION_PRINT_CLOSE` · `CASH_SESSION_REPRINT`

**Cajas físicas:** `CASH_REGISTER_VIEW_MENU` · `_VIEW_LIST` · `_CREATE` · `_UPDATE` · `_TOGGLE_STATUS`

**Misceláneas:** `MISC_TRANSACTION_VIEW_MENU` · `_VIEW_LIST` · `_CREATE` · `_UPDATE` · `_DELETE`

## Configuración de Negocio

`BUSINESS_CONFIG_VIEW_MENU` · `CLINIC_DETAILS_VIEW` · `_UPDATE` · `_UPLOAD_LOGO` · `CLINIC_PREFS_VIEW` · `_UPDATE` · `PATIENT_PORTAL_CONFIG_VIEW` · `_UPDATE` · `SEDES_*` · `SCHEDULES_*` · `HOLIDAYS_*` · `DOCTORS_*` (incluye `DOCTORS_VIEW_SERVICES`, `_ADD_SERVICE`, `_UPDATE_SERVICE`, `_DELETE_SERVICE`, `DOCTORS_COPY_ID`) · `AVAILABILITY_VIEW_MENU` · `AVAILABILITY_RULES_*` · `AVAILABILITY_EXCEPTIONS_*` · `CURRENCIES_*` · `SEQUENCES_*` · `MUTUAL_SOC_*` · `PATIENT_GROUPS_*` · `PROVIDER_GROUPS_*` · `PRINT_TEMPLATES_VIEW` · `PRINT_TEMPLATES_EDIT` · `MEDICAL_INSTRUCTION_TEMPLATES_*` · `PRESCRIPTION_TEMPLATES_*`

## Catálogo de la Clínica

`CATALOG_VIEW_MENU` · `CATALOG_CONDITIONS_*` · `CATALOG_MEDICATIONS_*` · `CATALOG_DENTAL_COND_*` · `CATALOG_DENTAL_SURF_*` (cada uno con `_VIEW_MENU`, `_VIEW_LIST`, `_CREATE`, `_UPDATE`, `_DELETE`)

## Sistema

**Usuarios:** `SYSTEM_VIEW_MENU` · `USERS_VIEW_MENU` · `STAFF_VIEW_MENU` · `USERS_VIEW_LIST` · `USERS_CREATE` · `USERS_UPDATE` · `USERS_SET_INITIAL_PASSWORD` · `USERS_TOGGLE_STATUS` · `USERS_VIEW_DETAIL` · `USERS_VIEW_ROLES` · `USERS_ASSIGN_ROLE` · `USERS_REMOVE_ROLE` · `USERS_VIEW_LOGS` · `USER_SIGNATURE_MANAGE`

**Roles:** `ROLES_VIEW_MENU` · `_VIEW_LIST` · `_CREATE` · `_UPDATE` · `_DELETE` · `_VIEW_USERS` · `_ADD_USER` · `_REMOVE_USER` · `_VIEW_PERMISSIONS` · `_ASSIGN_PERMISSION` · `_REMOVE_PERMISSION`

**Permisos:** `PERMISSIONS_VIEW_MENU` · `_VIEW_LIST` · `_CREATE` · `_UPDATE` · `_DELETE` · `PERMISSIONS_VIEW_IMPACT`

**Configuración y registros:** `SYS_CONFIG_*` · `AUDIT_LOG_VIEW_MENU` · `_VIEW_LIST` · `_VIEW_DETAIL` · `ACCESS_LOG_VIEW_MENU` · `_VIEW_LIST` · `ERROR_LOG_VIEW_MENU` · `_VIEW_LIST` · `NOTIFICATION_SETTINGS_VIEW_MENU`

**Alertas:** `ALERT_CONFIG_VIEW_MENU` · `ALERT_CONFIG_VIEW` · `ALERT_CONFIG_UPDATE` · `ALERT_CATEGORIES_*` · `ALERT_RULES_*` (incluye `ALERT_RULES_TOGGLE_STATUS`) · `ALERT_TEMPLATES_*` · `ALERT_EXECUTIONS_VIEW_MENU` · `_VIEW_LIST` · `_VIEW_DETAIL` · `ALERT_HISTORY_VIEW_MENU` · `_VIEW_LIST` · `_VIEW_DETAIL`

**WhatsApp:** `WHATSAPP_AGENT_CONFIG_VIEW_MENU` · `_VIEW` · `_UPDATE`

**Importación:** `IMPORT_DATA_VIEW_MENU` · `IMPORT_DATA_EXECUTE`

**Licencias:** `LICENSING_VIEW_MENU` · `LICENSING_VIEW` · `LICENSING_GENERATE` · `SUBSCRIPTIONS_VIEW_MENU` · `SUBSCRIPTIONS_VIEW`

## Centro de Alertas

`ALERT_CENTER_VIEW_MENU` · `_VIEW_LIST` · `_VIEW_KPIS` · `_VIEW_DETAIL` · `_FILTER` · `_SEND_EMAIL` · `_SEND_SMS` · `_SEND_WHATSAPP` · `_REGISTER_CALL` · `_COMPLETE` · `_SNOOZE` · `_IGNORE` · `_ASSIGN` · `_ADD_NOTES` · `_PRINT` · `_BULK_ACTIONS`

## Reportes

`REPORTS_VIEW_MENU` y, por familia: `REPORTS_CAJA_VIEW` · `REPORTS_INGRESOS_VIEW` · `REPORTS_PRODUCCION_VIEW` · `REPORTS_PACIENTES_VIEW` · `REPORTS_AGENDA_VIEW` · `REPORTS_GASTOS_VIEW` · `REPORTS_GESTION_VIEW` · `REPORTS_BALANCE_MENSUAL_VIEW` · `REPORTS_EXPORT_PDF` · `REPORTS_EXPORT_EXCEL`

## Otros

**Pantalla TV:** `TV_DISPLAY_VIEW_MENU` · `_VIEW_SCREEN` · `_UPDATE_SETTINGS` · `_CONTROL_DISPLAY`

**Notas adhesivas:** `STICKY_NOTES_VIEW` · `_CREATE` · `_UPDATE` · `_DELETE`

**Globales:** `PROFILE_CHANGE_PASSWORD` · `USER_SIGNATURE_UPLOAD` · `GLOBAL_CHANGE_LANGUAGE` · `GLOBAL_CHANGE_THEME` · `GLOBAL_VIEW_EXCHANGE_RATE` · `GLOBAL_VIEW_NOTIFICATIONS_BADGE`

**Portal del Paciente (permisos del propio paciente):** `PATIENT_PORTAL_ACCESS` · `_VIEW_INFO` · `_VIEW_HISTORY` · `_VIEW_FINANCE` · `_MANAGE_APPOINTMENTS` · `_USE_ASSISTANT`

---

# Referencia D — Configuración técnica

> Esta sección es para el equipo de implantación, no para el usuario final.

## Variables de entorno

Las variables se inyectan **en tiempo de ejecución**, no al compilar. Eso permite usar la misma imagen de la aplicación en distintos entornos y clientes: basta reiniciar el contenedor con otras variables.

| Variable | Para qué sirve |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | URL base del backend. **No debe incluir `/webhook` al final**: se agrega solo. |
| `NEXT_PUBLIC_CLIENT_ID` | Identificador del cliente, usado por el stream de eventos. |
| `NEXT_PUBLIC_EVENT_PUSHER_URL` | Origen del servidor de eventos en tiempo real. Vacío = mismo origen vía proxy inverso. |
| `NEXT_PUBLIC_EVENT_PUSHER_KEY` | Clave de autenticación del navegador contra el servidor de eventos. |
| `NEXT_PUBLIC_LICENSE_KEY` | Clave de cifrado de las licencias. |
| `NEXT_PUBLIC_MASTER_SEC` | Clave maestra de acceso a la pantalla de licencias. |

> **Así funciona.** Si las notificaciones en tiempo real no llegan, lo primero a revisar son las tres del stream de eventos. Con la aplicación y el servidor de eventos en dominios distintos, el servidor debe permitir explícitamente el origen de la aplicación.

## Personalización de textos por cliente

El sistema admite **sobrescribir textos concretos por cliente** sin mantener una traducción completa: se define un archivo parcial con solo las claves que cambian y el resto se toma de los textos base.

> **Recomendación.** Sirve para adaptar vocabulario local — por ejemplo «Consultorio» en lugar de «Sillón» — sin tocar el resto del producto.

## Idiomas

Español (`es`) e inglés (`en`). Todo texto visible existe en ambos; el cambio es inmediato y se refleja en la URL.

---

# Referencia E — Glosario

| Término | Significado en Invoke IA |
| --- | --- |
| **Agenda** | Vista de las citas de un recurso (doctor o consultorio). |
| **Alerta** | Tarea generada automáticamente por una regla del sistema. |
| **Anamnesis** | Registro de antecedentes del paciente: alergias, antecedentes personales y familiares, medicación y hábitos. |
| **Arqueo** | El proceso de cierre de caja: contar, declarar, conciliar y confirmar. |
| **Calendario** | En el sentido del sistema: un recurso físico agendable (consultorio, sillón, box). |
| **Cobro Rápido** | El asistente global que factura y cobra en un solo diálogo. |
| **Cuenta unificada** | La vista de finanzas del paciente en formato de libro mayor (Debe / Haber / Saldo). |
| **Miscelánea** | Movimiento de caja que no corresponde a una factura (caja chica). |
| **Modo Invoke / Personalizado** | Los dos modos del calendario: varias columnas simultáneas, o una agenda a pantalla completa. |
| **Nota de crédito** | Documento que anula total o parcialmente una factura y genera saldo a favor. |
| **Paciente dependiente** | Paciente a cargo de un tutor, cuyas comunicaciones se dirigen al contacto responsable. |
| **Plan de tratamiento** | Secuencia de citas generada automáticamente por un servicio con flujo. |
| **Prepago** | Dinero recibido antes de que exista la factura. Queda como crédito del paciente. |
| **Regla de alerta** | La condición que hace que el sistema genere alertas automáticamente. |
| **Sede** | Sucursal de la clínica. |
| **Servicio con flujo** | Servicio que comprende varias citas secuenciales y genera un plan de tratamiento. |
| **Sesión clínica** | El registro de lo realizado en una atención. |
| **Sesión de caja** | El período entre la apertura y el cierre de una caja física. |
| **Slot** | La unidad mínima de tiempo de la rejilla del calendario (10 a 60 minutos). |
| **Toast** | Mensaje emergente de confirmación o error. |

---

# Contacto y soporte

Para consultas sobre el uso del sistema, solicitudes de nuevas funcionalidades o incidencias técnicas, contactar al equipo de Invoke IA por los canales de soporte acordados con la clínica.

> **IMAGEN 8.1** — Datos de contacto y soporte de Invoke IA.

