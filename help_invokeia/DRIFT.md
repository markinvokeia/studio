# Divergencias entre el manual y la aplicación

Grabar cada pregunta obliga a ejecutar el recorrido que el manual describe, así
que el primer efecto secundario del piloto fue descubrir dónde el texto **ya no
coincide con la app**. Este archivo las anota a medida que aparecen.

Cada entrada necesita una decisión: o se corrige el manual, o se corrige la app.
El video, mientras tanto, muestra lo que la app hace hoy.

---

## PARTE 0

### q015 · «¿Cómo paso a modo oscuro?»

| | |
| --- | --- |
| **Dice el manual** | «Avatar → **Tema** → Claro / Oscuro / Sistema. "Sistema" sigue la configuración de tu computadora.» |
| **Hace la app** | El menú del avatar ofrece **tres** botones: **Invoke**, **Claro** y **Oscuro**. No existe la opción «Sistema». |
| **Dónde** | [`src/components/sidebar.tsx`](../src/components/sidebar.tsx) — los literales están hardcodeados, no vienen de `es.json`. |
| **Decisión** | Pendiente. El video graba lo que la app hace (Invoke / Claro / Oscuro). |

### q010 · «¿Cómo cambio entre vista de tabla y vista de lista?»

| | |
| --- | --- |
| **Dice el manual** | «En la barra superior de cualquier listado hay un conmutador tabla / lista… El conmutador sirve para forzarlo a mano.» |
| **Hace la app** | En `/patients` **no hay conmutador manual**: `showCardList = Boolean(isNarrow && renderCard)` depende sólo del ancho disponible. El cambio es automático al abrir un registro (se comprime el listado) o al angostar la ventana. El conmutador existe sólo en pantallas que pasan `viewControls`, como las pestañas de grupos de pacientes. |
| **Dónde** | [`src/components/ui/data-table.tsx:143`](../src/components/ui/data-table.tsx) |
| **Decisión** | Pendiente. El video muestra el comportamiento automático, que es el que ve la mayoría. |

### q003 · «Olvidé mi contraseña»

| | |
| --- | --- |
| **Dice el manual** | Sugiere una pantalla aparte: la sección 2.4 de la Guía de Usuario la documenta como `/reset-password`. |
| **Hace la app** | «¿Olvidó su contraseña?» es un `<button>` que hace `setView('forgotPassword')`: **no navega**, el mismo formulario de login se transforma y pasa a pedir sólo el correo. La ruta `/reset-password` existe, pero es a donde lleva el enlace del email, no el botón. |
| **Dónde** | [`src/app/[locale]/login/page.tsx:279`](../src/app/[locale]/login/page.tsx) |
| **Decisión** | Pendiente. Conviene aclararlo en el manual: son dos cosas distintas. |

## PARTE 1

### q023 · «¿Qué datos pide el formulario de cita?» — la tabla está desactualizada

El manual lista campos que **no existen con ese nombre** en el formulario actual:

| Dice el manual | Hace la app |
| --- | --- |
| **Nombre de paciente** | **Paciente**, con el texto de ayuda «¿Quién se atiende?» |
| **Servicios** | **«¿Qué se realiza?»** |
| **Fecha**, **Hora**, **Hora de Fin**, **Duración (minutos)** | **Fecha**, **Desde**, **Hasta** — y la duración se muestra *dentro* de «Hasta»: `16:11 (10 min)` |
| **Descripción** y **Notas** | un solo campo, **Anotación** |
| **Presupuesto** («permite enlazar la cita a un presupuesto…») | **No está en este formulario** |
| — | **Fondo** (color de la cita), que el manual no menciona |

Además, el formulario **no es un modal**: es la tarjeta flotante
`calendar-inline-draft-overlay`. Eso vuelve confusa la q024, que presenta la
creación «sin modal» como una preferencia que hay que encender —conviene
verificar qué hace hoy esa preferencia, porque el camino Crear → Crear cita ya
abre la tarjeta en línea.

**Decisión:** pendiente. El video muestra el formulario real.

### q024 · La configuración del calendario NO está en `/preferences`

El manual manda a **«Preferencias → Calendario → Crear cita en el calendario
(sin modal)»**, y la Guía de Usuario dice lo mismo en su capítulo 4.1.5
(«Toda la configuración del calendario vive aquí»).

`/preferences` tiene hoy cuatro secciones y **ninguna es Calendario**:
Notificaciones (posición de los mensajes), Finanzas del paciente, Firma y
Espacio de trabajo. Los ajustes del calendario están únicamente en el botón de
ajustes del propio calendario.

**Decisión:** pendiente. Es de las divergencias más molestas para el usuario,
porque lo manda a una pantalla donde no va a encontrar nada.

### q072 · El listado de presupuestos no tiene botón «Crear»

El manual dice «**Ventas → Presupuestos → Crear**». La barra de
`/sales/quotes` tiene paginación, Refrescar, el conmutador Tabla/Lista, «Ver» y
los encabezados de columna — **ningún botón de creación**.

El camino que sí funciona es el segundo que menciona el manual: ficha del
paciente → **Crear → Presupuesto**. Conviene que sea el primero, o el único.

### q046 · «Calendarios» y «Doctores» no existen en el modo por defecto

El manual presenta esos dos botones como si estuvieran siempre. No se renderizan
en el modo **Personalizado**, que es el que viene de fábrica: ahí el control
equivalente es el panel **Agendas**. Aparecen en modo **Invoke**, donde tiene
sentido mostrar varios recursos a la vez.

### El conmutador Tabla/Lista sí existe, pero no en todas las pantallas

Complemento de lo anotado en q010: en `/sales/quotes` el conmutador existe y
además tiene nombre accesible (`aria="Tabla"` / `aria="Lista"`). En `/patients`
no está, y el cambio a tarjetas es automático. O sea que la respuesta del manual
es correcta para unas pantallas y no para otras.

### Los botones de la barra del calendario no tenían nombre accesible

A 1280 px la barra pasa a modo sólo-ícono (`secondaryIconOnly`) y los botones
quedaban **sin `aria-label` y sin texto**: su único rótulo era un `TooltipContent`,
que no le da nombre accesible al disparador. Para un lector de pantalla eran
botones mudos, y para Playwright, inseleccionables por rol.

Se les agregó `aria-label` en
[`src/app/[locale]/appointments/page.tsx`](../src/app/[locale]/appointments/page.tsx):
**Buscar cita**, **Buscar huecos**, **Operaciones en Lotes** y **Crear**. Es una
corrección de accesibilidad real, no sólo una ayuda para los tests.

---

## PARTE 2

### q091 · Los campos de la sesión clínica no son los que dice el manual

El manual lista: *Fecha · Doctor · Paciente · Presupuesto · Procedimiento ·
**Diagnóstico** · **Notas Clínicas** · **Tratamientos por diente** · Plan para la
Próxima Sesión · **Fecha Próxima Cita** · Archivos adjuntos*.

El diálogo **Crear Sesión** tiene hoy, en este orden:

| Campo | Nota |
| --- | --- |
| **Paciente** | Sólo lectura, viene de la ficha |
| **Fecha** · **Doctor** | |
| **Presupuesto** | Con un atajo **Nuevo** al lado |
| **Procedimiento** | Texto largo con micrófono, más un **+ Añadir** |
| **Plan para la Próxima Sesión** | Ídem |
| **Dar de alta al paciente al guardar la sesión** | Casilla |
| **Archivos adjuntos** | Zona de arrastre |

No existen **Diagnóstico**, **Notas Clínicas** ni **Fecha Próxima Cita**.

### q095 · «Tratamientos por diente» son en realidad servicios

El manual dice que se agrega una línea con **N° de diente** y **Descripción**.
Lo que hace el botón **+ Añadir** es sumar una fila **«Seleccionar servicio…»**,
del catálogo de servicios de la clínica. No hay número de pieza en este diálogo.

Funcionalmente tiene sentido —es lo que permite facturar sin retipear— pero la
respuesta del manual manda a buscar algo que no está.

### q093 y q094 · Los bloques de IA no aparecen

El manual describe **«Estructurar con IA»** (dictado clínico que reparte el texto
en los campos) y **«Generar con IA»** (propone tratamientos del catálogo).
Ninguno de los dos está en el diálogo de sesión de este entorno.

> **Hipótesis, no conclusión.** La licencia tiene un campo **«Acceso IA»**
> (capítulo 23.9 de la Guía). Es razonable que estos bloques estén detrás de ese
> flag y que la licencia de DEV lo tenga apagado. **No filmé estas dos hasta
> confirmarlo**: quedaron marcadas `blocked` en `filmability.overrides.json`.
> Si el flag es la explicación, se encienden y se graban sin tocar nada más.

### q103 · «Imprimir historia clínica» no está en la ficha del paciente

El manual dice sólo «Botón **Imprimir historia clínica**», sin decir dónde. No
está en la ficha ni en su menú **Más acciones**.

Vive en el panel `PatientHistorySheet`, y el **único** sitio que lo abre es el
calendario: clic derecho sobre una cita → submenú del nombre del paciente →
**Historia**. Lo confirma el código: `patient-history-sheet-store` sólo tiene un
consumidor, `src/app/[locale]/appointments/page.tsx`.

Conviene que el manual diga el camino, porque nadie lo encuentra solo.

### q104 · «Alertas clínicas» tampoco está en la cabecera de la ficha

El manual lo ubica en la cabecera de la ficha del paciente. Las claves de
traducción están bajo `UsersPage.doctorWorkspace.clinicalAlerts` y
`…noAllergies`: el bloque pertenece al **panel de paciente de Mi Consultorio**,
que se abre al elegir una cita del día.

Quedó `blocked`: para filmarlo hace falta una cita de hoy asignada a la cuenta
de grabación, que hoy no tiene ninguna.

### El menú «Más acciones» del paciente: era un falso positivo

> **Corrección de un hallazgo anterior de este mismo documento.** Había anotado
> que al menú le faltaban opciones respecto de la Guía (8.3.1). Es incorrecto.

Las opciones de envío son **condicionales a que el paciente tenga el dato**:
`patient-actions-menu.tsx:212` las renderiza con `hasPhone && onSendWhatsAppTemplate`.
El paciente de prueba con el que se graba no tiene teléfono ni correo cargados,
así que el menú mostraba sólo **Dar Alta**, **Desactivar** y **Preferencias**.

No es una función faltante: es la app ocultando una acción que no se podría
ejecutar. Lo único realmente a confirmar es **Desactivar**, que la guía no lista.

**Consecuencia para las demos:** q064 y q065 (mandar WhatsApp y correo) necesitan
un paciente con teléfono y correo. Con el paciente de prueba vacío no se pueden
mostrar.

### El menú contextual de la cita está organizado en dos niveles

El manual lista las acciones en plano. En la app, las que son del **paciente**
cuelgan de un submenú que abre su nombre, arriba de todo: **Cuentas · Historia ·
Imágenes y archivos · Historial de Citas · Datos del paciente**. El resto
—estados, Editar, Eliminar, Cambiar color, Cambiar doctor, Cambiar consultorio,
Mover a…, Duración— sí está al primer nivel.

### q105–q111 · El odontograma completo está en una ruta sin entrada de menú

El manual dice «Está en el **Expediente Médico**, solapa **Odontograma**». La
ficha del paciente **no tiene** esa solapa: sus macro-pestañas son Información,
Historia clínica y Finanzas, y dentro de Historia clínica hay cinco sub-pestañas,
ninguna de odontograma.

Lo que sí existe es el diálogo **«Nueva sesión — Odontograma»**, que se abre
desde **Crear → Sesión de odontograma** en la ficha. Ahí están las tres
categorías de condiciones y «Limpiar odontograma», pero **no** el conmutador de
vista, ni pantalla completa, ni la navegación entre sesiones.

Esos tres controles viven en `DentalRecordViewer`, que **sólo se renderiza en
`/clinic-history/[user_id]`**. No encontré entrada de menú hacia esa ruta.

> **Y hay un cabo suelto que conviene mirar.**
> `src/app/[locale]/patients/page.tsx` **importa `DentalRecordViewer` pero nunca
> lo renderiza** — el import está y no hay ningún `<DentalRecordViewer` en el
> archivo. Es coherente con que el odontograma estuviera pensado para vivir
> dentro de la ficha y hoy no aparezca ahí. Puede ser una regresión.

q108, q109 y q110 quedaron `blocked` hasta confirmar el camino de usuario.

### El catálogo de condiciones dentales es bastante más amplio que el del manual

El manual lista dieciséis. La app tiene, sólo en los grupos **Pieza** y
**Superposición**: Fractura, Diastema, Prot. Removible, Migración, Rotación,
Fusión, Erupción, Transposición, Supernumerario, Tornillo, Ortod. Fija,
Macrodoncia, Microdoncia, Semiretenido, Intrusión, Ectópico, Retenido, Ortod.
Removible, Extrusión y Perno — más las seis de **Superficies**.

Varias que el manual nombra (Corona, Corona Temporal, Resto Radicular,
Edentulismo) no aparecieron con esos nombres. Como el catálogo es configurable
por clínica, la lista del manual probablemente debería decir que es un ejemplo y
no un inventario.

### «Clear Search» sin traducir

El botón de limpiar la búsqueda del listado de pacientes aparece en inglés.

### Hay doctores de prueba visibles en el selector

El desplegable de doctores del diálogo de sesión incluye entradas como
`Dr. E2E 1777129781342`, generadas por la suite de QA y nunca borradas. Salen en
cámara en cualquier demo que abra ese selector. No es de este trabajo, pero
conviene limpiarlas.

---

## Condiciones del entorno que hay que resolver para poder grabar

No son divergencias del manual, pero bloquean la grabación y conviene tenerlas
anotadas porque van a reaparecer.

### El modal de selección de sede bloquea todo

Si el usuario con el que se graba **no tiene sede de trabajo**, la app muestra un
`AlertDialog` centrado que tapa la pantalla entera y que **no se puede cerrar con
Escape** (`onEscapeKeyDown` está prevenido a propósito en
[`src/components/sede-selection-modal.tsx:44`](../src/components/sede-selection-modal.tsx)).
Ningún clic de ninguna demo funciona mientras esté abierto.

Resuelto en `_setup/help.auth.setup.ts`: si el modal aparece, el setup elige la
primera sede y lo informa por consola. **No es un bug** — la protección es
deliberada y q019 la documenta — pero la grabación tiene que contemplarla.

### El panel de notificaciones queda montado fuera de pantalla

En `/preferences` hay un `role="dialog"` con las notificaciones posicionado en
`x: 1280` con un viewport de 1280: está justo fuera del borde derecho. No se ve
en el video ni intercepta clics, pero **sí aparece en los selectores**, así que
un `getByRole('dialog')` sin filtrar puede agarrarlo por error. Conviene filtrar
siempre por texto: `getByRole('dialog').filter({ hasText: … })`.

### Lo transitorio hay que afirmarlo en el momento

La vista previa de «Posición de los mensajes» no es un cartel fijo: es un **toast
de verdad** (`toast({ variant: 'info', … })` en
[`src/app/[locale]/preferences/page.tsx:46`](../src/app/[locale]/preferences/page.tsx)),
y se auto-cierra. Un `demo.step()` con la aserción adentro falla, porque `step()`
primero muestra el subtítulo y espera los 3 s de reposo, y para entonces el toast
ya no está.

Para cualquier cosa efímera va `demo.toast()`, que la espera, le pone el puntero
encima —Radix pausa el temporizador de auto-cierre mientras el mouse está
dentro— y recién ahí la resalta.

> **Síntoma para reconocerlo:** el test pasa en `DEMO_SPEED=0` (modo dry, sin
> pausas) y falla al grabar. Si pasa eso, lo que se está afirmando es transitorio.

---

## Cambios hechos en la app para poder grabar

Sólo `data-testid`, sin tocar comportamiento:

| Archivo | Cambio | Por qué |
| --- | --- | --- |
| `src/components/sidebar.tsx` | `data-testid="sidebar-avatar-trigger"` en el disparador del menú de cuenta | Su nombre accesible es el nombre del usuario logueado, que cambia por entorno |
| `src/components/header.tsx` | `data-testid="rail-<label>"` en `PanelItem` | Hace direccionable toda la tira derecha (`rail-paciente`, `rail-caja`, `rail-notas`…), que es el tema de q008 |
