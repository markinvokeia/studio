# Gestión por voz en Invoke IA

Cómo funciona la voz de punta a punta, qué se le puede pedir en cada pantalla, cómo está hecha y qué queda pendiente. Es la puerta de entrada a toda la documentación de voz:

| Documento | Qué tiene |
| --- | --- |
| **Este** (`voz-gestion.md`) | Uso, reglas, recorrido de una frase, IA, piezas del código, módulos y comandos, páginas cubiertas, pruebas, cómo extender, pendientes |
| [voz-ejemplos/](voz-ejemplos/README.md) | **Todas** las frases dichas en las pruebas que pasan, con la pantalla, el idioma y lo que respondió la voz (generado) |
| [voz-pruebas-vivo.md](voz-pruebas-vivo.md) | La matriz en la app real, pantalla por pantalla, es y en (generado) |
| [voz-agenda.md](voz-agenda.md) | La agenda en detalle: reglas originales y levantamiento de cada acción |
| [voz-agenda-pruebas.md](voz-agenda-pruebas.md) | El catálogo de los nombres de todas las pruebas del simulador (generado) |
| [voz-patron-hibrido.md](voz-patron-hibrido.md) | El patrón «local primero, IA si hace falta» y cómo sumar un módulo con IA |
| [voz-app-progreso.md](voz-app-progreso.md) | El avance página por página, con lo que destapó y arregló cada etapa |

> **Sobre los ejemplos.** Cada frase citada como ejemplo en este documento se dijo en una prueba que pasa: en el simulador (`pnpm test:voice`, [voz-ejemplos/](voz-ejemplos/README.md)) o en la app real (`e2e/tests/voice-live/`). Las que marcan **(IA)** dependen de lo que entienda el modelo; en las pruebas su respuesta está simulada. Todo lo demás lo entiende el navegador solo, siempre igual.

## Índice

1. [En cifras](#1-en-cifras)
2. [Cómo se usa](#2-cómo-se-usa)
3. [Las reglas del agente](#3-las-reglas-del-agente)
4. [El recorrido de una frase](#4-el-recorrido-de-una-frase)
5. [La IA](#5-la-ia)
6. [Cómo está hecha](#6-cómo-está-hecha)
7. [Módulos, comandos y qué se puede pedir](#7-módulos-comandos-y-qué-se-puede-pedir)
8. [Páginas cubiertas](#8-páginas-cubiertas)
9. [Pruebas](#9-pruebas)
10. [Cómo sumar voz a una pantalla nueva](#10-cómo-sumar-voz-a-una-pantalla-nueva)
11. [Pendiente y no cubierto](#11-pendiente-y-no-cubierto)

---

## 1. En cifras

| | |
| --- | --- |
| Idiomas | Español rioplatense (`es`, voseo), español de España (`es-ES`, tú) e inglés (`en`) |
| Módulos de voz | 15: `core` (siempre activo), `calendar`, `workspace`, `dashboard`, `alerts`, `cashier`, `patients`, `lab_orders`, `perio`, `billing`, `documents`, `ledger`, `reports`, `crud`, y `screen` (la IA de la pantalla) |
| Comandos | 83 (`src/lib/voice/commands/`) |
| Páginas del menú | 92 rutas: **todas** tienen la voz general; cuántas tienen además voz propia (o la de sus tablas, documentos o reportes) y cuántas se recorrieron en la app real está al comienzo de la tabla de §8 |
| Pruebas del simulador | 2420 en verde (`pnpm test:voice`, ~7 min, sin navegador ni base) |
| Frases de ejemplo probadas | 2983 frases dichas (1850 distintas) en las pruebas que pasan, al 2026-11-23; el total al día está en [voz-ejemplos/README.md](voz-ejemplos/README.md) |
| Pruebas en la app real | Matriz de **59 pantallas × 2 idiomas, 1775 de 1775 pasos** ([voz-pruebas-vivo.md](voz-pruebas-vivo.md)); recorrido de humo de 46 escenarios es/en; barrido y auditoría de controles de las 37 pantallas de Configuración y Sistema; auditoría de Mi consultorio |
| Flujo de IA | n8n «Voz - Interpretar» (`POST /voice/interpret`), 5 módulos con prompt propio: `core`, `calendar`, `lab_orders`, `screen`, `perio` |

## 2. Cómo se usa

### 2.1 Prender y apagar

- **Botón Voz**, en el riel derecho (debajo de la mascota). Lo monta el `Header` una sola vez para toda la app (`VoiceCommandHost` + `VoiceCommandButton`). Un toque prende el micrófono y queda prendido hasta apagarlo; **se recuerda por navegador** (`localStorage` `voice-always-on`): al volver, sigue como se dejó.
- **Ctrl+Espacio mantenido**: escucha una frase mientras se mantiene; al soltar, se interpreta. Sirve con el micrófono apagado.
- **Escape** corta lo que se esté haciendo y cierra la tarjeta (el micrófono permanente sigue prendido). El Escape que manda la propia voz para cerrar una lista o una ventana no la corta.
- **Se duerme sola**: 90 s sin hablarle apaga el micrófono; con una pregunta abierta espera 3 min y la guarda. Al prenderla de nuevo retoma la pregunta.
- **Dejar de escuchar por voz**: «dejá de escuchar», «pausá el dictado», «apagá el micrófono», «no me escuches más», «eso es todo», «stop listening», «pause listening». Si había una pregunta abierta, queda guardada y se retoma al prender Voz de nuevo.
- El **punto verde** del botón indica que el micrófono está oyendo a alguien en ese momento.
- Navegador: usa el reconocimiento de voz del navegador (Web Speech API: **Chrome y Edge**). Ver §11.

### 2.2 Hablar

- **Sin palabra de activación**: con el micrófono prendido se procesa todo lo que se dice. Si se nombra al asistente, se saca: «Invoke andá a mañana», «Inbox IA volvé a hoy» (así lo transcribe a veces el reconocedor); «Invoke» solo contesta «Te escucho».
- **Las pausas no cortan el pedido**: el navegador cierra una frase en cualquier pausa corta; los pedazos se juntan hasta 1,2 s sin oír nada.
- **No se oye a sí misma**: mientras habla el asistente (o la mascota leyendo una guía), lo que se oye se descarta, sin reiniciar el reconocimiento.
- **La charla de la sala no dispara nada**: lo que no se entiende con el micrófono prendido se muestra en la tarjeta sin decirlo en voz alta, y solo se proponen alternativas si se parecen mucho a algo que se puede hacer.
- **Cortesía y muletillas no molestan**: se sacan antes de entender («poné más zoom por favor», «eh bueno dale andá a mañana», «zoom in please»).
- **Números en palabras**: «cinco de mil» (5 billetes de 1000), «tres coma cinco» (3,5), «mil quinientos» (1500).
- **Idioma**: los intérpretes entienden español e inglés con la app en cualquier idioma («show the Email column» funciona con la app en español). La tarjeta y la voz contestan en el idioma de la app, y en `es-ES` con tú («Introduce», «¿Te refieres a…?»).

### 2.3 La tarjeta de voz

- Sale del botón Voz con una flechita que lo señala. En escritorio aparece a la izquierda del riel y crece hacia arriba si el botón está abajo; en celular, debajo del botón. Ocupa como mucho el 60 % del alto; con una ventana abierta, se pone al costado sin taparla. Tocarla no cierra la ventana.
- Muestra: lo que se oyó («…»), el estado («Te escucho», «Un momento», «Esperando tu respuesta»), el resultado, las **opciones** como botones (se pueden tocar o decir) y una línea de ayuda («hablá normalmente · Esc cancela · tocá Voz para apagar»).
- Un resultado queda a la vista lo que lleva leerlo (12 a 30 s según el largo). La respuesta del agente clínico **no** se va sola: queda hasta que se pida otra cosa o se diga «cerrá», «listo», «gracias».
- Texto con formato (negritas, listas) sin asteriscos (`voice-rich-text.tsx`).

### 2.4 Por dónde empezar

- **«¿qué puedo hacer acá?»** (también «qué puedo hacer aquí», «what can I do here») en cualquier pantalla: lista lo que se ve y se puede tocar, y lo que se le puede pedir a su tabla. Es una pregunta liviana: lo que se pide después se hace sin preguntar «¿cambiamos de tarea?».
- **«andá a …»** lleva a cualquier pantalla del menú; **«andá a … y …»** va y sigue allá («andá a la agenda y poné vista semana»).
- Al abrirse una ventana, la tarjeta dice cuál y qué se le puede pedir: «Se abrió «Nueva sede». Decime qué completar (Nombre…) o qué apretar: Guardar o Cancelar.»

## 3. Las reglas del agente

Son ley para toda la voz (vienen de [voz-agenda.md §1](voz-agenda.md) y se generalizaron a la app).

### 3.1 Lo abierto primero (capas)

Lo dicho va primero a lo que está más arriba en pantalla:

1. **Un aviso abierto** (pop-up «¿Seguro que…?»): se leen sus botones y se aprieta el nombrado, por su texto, su posición («el segundo») o por sí/no.
2. **Una ventana o panel lateral abierto**: sus botones y sus campos. Un botón de lo abierto que se llama como lo dicho gana a cualquier otro comando («Cobro rápido» de la bandeja abierta, no el del riel).
3. **La pestaña activa del detalle**, después **el detalle** del registro elegido.
4. **La lista** de la página.

Lo marcan `data-voice-panel` (en `TwoPanelLayout`) y los atributos de Radix (`role="dialog"`, `data-state="open"`). Si lo nombrado está más abajo, se cierra lo de arriba antes de hacerlo. Con una ventana abierta, las tablas de atrás no se llevan lo dicho.

### 3.2 Tareas, preguntas y foco

- **Cada pedido es una tarea.** Si para hacerla hace falta elegir algo (la cita, el paciente, el doctor), se pregunta cuál y **se retoma la tarea** con lo elegido, sin volver a pedir lo que ya se dijo.
- **Las preguntas forman una pila**: la de arriba recibe la próxima frase.
- **Herramientas en el medio**: con una pregunta abierta, moverse de día, cambiar la vista o el zoom, filtrar, ver huecos, buscar o desplazarse **no cancela nada**; se hace y se repite la pregunta (comandos `aux`).
- **Cambio de tema**: si con una tarea a medias se pide algo que no tiene nada que ver, se pregunta «Estábamos con «X». ¿Lo dejo para hacer «Y»?». Si la pregunta abierta es liviana (el menú de ayuda, «¿te referís a…?») o no es de ninguna tarea con nombre, lo nuevo se hace sin preguntar.
- **Cancelar**: «cancelá», «olvidalo», «deja eso», «stop», «cancel that», «never mind» cortan la tarea en curso («cancelá la cita de Ana», en cambio, es cancelar esa cita).
- **Retomar**: «sigamos», «continuemos», «en qué estábamos», «where were we», «lets continue» vuelven a mostrar la pregunta abierta; también al prender Voz de nuevo o después de una herramienta.
- **Foco**: la última cita (y su paciente) elegida queda como contexto 30 minutos; «marcala como llegó», «abrí su cuenta», «¿cuánto debe?» actúan sobre ella. «Olvidá esa cita» lo limpia. Lo seleccionado en pantalla también es el contexto (la orden de laboratorio abierta, el caso clínico de Mi consultorio).
- **Cambio de contexto**: un pedido de otra cosa con una ventana o un aviso abierto cierra lo abierto sin elegir y hace lo nuevo («andá a pacientes» con un aviso abierto).

### 3.3 Cuándo confirma y cuándo pregunta

| Situación | Qué pasa |
| --- | --- |
| Varias coincidencias (citas, pacientes, filas, opciones, órdenes) | Siempre se listan (hasta 6–8) y se pregunta cuál: por número («la segunda»), posición («la última»), hora («la de las 10 y media») o texto |
| Mirar o moverse (navegar, vistas, zoom, filtros, columnas, páginas, buscar, desplazarse) | Se hace directo y se dice qué quedó |
| Cambiar algo (estado de una cita, doctor, etapa de una orden, completar o ignorar alertas, acciones del estado de cuenta) | Se confirma antes («¿La paso a confirmada?») |
| Borrar, cancelar, no asistió, descartar | Confirmación de peligro |
| Dar, editar, reprogramar, altas | Se abre **el formulario de siempre**, completo con lo dicho; se siguen corrigiendo campos por voz; «guardar» / «sí» aprieta su botón (con sus validaciones) |
| Mandar algo (mail, WhatsApp) | Se confirma antes |
| La IA duda (confianza 0,5–0,8) | «No estoy seguro: ¿querés …?» |
| No se entendió | Se proponen hasta 3 cosas parecidas que sí se pueden hacer («¿Te referís a…?»); si no hay, «No entendí» con ejemplos. **Nunca adivina** |

### 3.4 Regla de oro: la voz nunca rompe la pantalla

- Si un paso falla (error del servidor, algo que no existe, una acción no permitida), se dice qué pasó, **no se cambia nada más** y la voz sigue funcionando.
- Un plan de varios pasos que se frena dice en qué paso quedó y que lo anterior quedó hecho.
- El botón y la tarjeta tienen su propio límite de errores: si algo de la voz falla al dibujarse, se apaga la voz y la pantalla sigue.
- Cada montaje de una pantalla publica con su dueño: al cambiar de idioma o recargar, la pantalla vieja no borra lo de la nueva.
- Recién abierta una página, lo pedido espera a que termine de cargar antes de interpretarse.

### 3.5 Privacidad

- **A la IA de voz nunca viajan datos de pacientes.** Se manda la frase dicha y el contexto de la pantalla: nombres de botones, campos y listas (nunca sus valores ni las filas), doctores, agendas, sedes, tratamientos, etapas, laboratorios, destinos del menú permitidos.
- Lo clínico (resúmenes, preguntas sobre el paciente, dictar la sesión) va al **agente clínico** (`POST ai/doctor/query`), el mismo del chat de Mi consultorio, con la cita y sus permisos.
- Lo financiero del paciente solo se responde con el permiso de ver su cuenta.
- **Los permisos se revisan en cada comando** igual que en la pantalla (`ctx.hasPermission`); el menú solo ofrece destinos permitidos.

## 4. El recorrido de una frase

```
micrófono ─► juntar pedazos (1,2 s) ─► descartar eco ─► sacar «Invoke» ─► normalizar
   │
   ▼
handleText (session.ts)
   1. «dejá de escuchar» ───────────────► apaga el micrófono (guarda la tarea)
   2. aviso abierto preguntando ────────► es para sus botones
   3. formulario en manos de la voz ────► es una corrección del formulario
   4. «cancelá» con algo en curso ──────► corta la tarea
   5. «listo / gracias / cerrá» ─────────► cierra la tarjeta (si nada lo toma)
   6. «olvidá esa cita» ─────────────────► suelta el foco
   7. pregunta abierta ─────────────────► routeToPending (¿respuesta, herramienta, cambio de tema?)
   8. aviso de la pantalla sin pregunta ─► aprieta el botón nombrado
   9. pedido nuevo ─────────────────────► runRequest
   │
   ▼
runRequest
   a. pantalla cargando ─► espera a que esté lista
   b. intérprete local: el primer comando de los módulos activos que entiende (por prioridad)
   c. varios pedidos en una frase ─► plan de la IA (salvo la navegación, que va y deja el resto)
   d. ventana abierta ─► su botón nombrado, o su campo («el nombre es …»)
   e. comando local ─► runFound (herramienta en el medio si es aux)
   f. IA de los módulos activos + la de la pantalla ─► confianza ─► pasos
   g. nada ─► «¿Te referís a…?» con lo parecido ─► «No entendí» con ejemplos
   │
   ▼
runFound: la tarea, paso por paso, con el contexto del comando (ctx):
   ask / choose / confirm (preguntas en la pila) · show / finish (tarjeta y voz)
   followUp (decir otra frase como si se hubiera dicho) · hasPermission · navigate · signal (cancelar)
```

Detalle de cada paso:

1. **Escucha** (`speech-recognition.ts`): `startContinuousListening` con el micrófono prendido; `listenOnce` para Ctrl+Espacio. Un solo micrófono a la vez (`mic-handoff.ts`): el dictado propio del periodontograma pide prestado el micrófono y lo devuelve.
2. **Normalizar** (`parse.ts` `normalizeSpeech`): minúsculas, sin tildes ni puntuación, posesivo inglés fuera («Ana's» → «ana»), números en dígitos. Los comandos reciben también la frase original (`raw`) para escribir con las mayúsculas y tildes dichas.
3. **Elegir el comando** (`registry.ts` `matchVoiceCommand`): se prueban los comandos de los **módulos activos** (los de la pantalla más `core`) de mayor a menor prioridad; el primero cuyo `match` devuelve algo gana. Los específicos (formulario de la cita, 100; cobro rápido, 88–92; periodontograma, 70) le ganan a los generales (tablas, 6; voz genérica, −1; agente clínico, −10).
4. **Respuestas a una pregunta** (`routeToPending`): sí/no; una opción dicha tal cual (aunque parezca un pedido: «nuevo paciente»); «la segunda», «la última», «la de las 10 y media»; una herramienta (se hace y se repite la pregunta); un pedido que un comando entiende (cambio de tema); y si no, la IA decide la relación (`answer`, `cancel`, `resume`, `ignore`, `aux`, `new`).
5. **Correr** (`runFound`): cada tarea tiene su `AbortController`; cancelar corta todos los pasos. Al terminar, si la tarea abrió una ventana, se suma «se abrió … decime qué completar».
6. **Contestar**: la tarjeta (`useVoiceCommand`) y la voz del asistente (`speak`), salvo que esté silenciada.

## 5. La IA

- **Cuándo**: solo si ningún comando local entendió, si la frase trae varios pedidos («la cita de Juan, marcala como llegó y abrí su cuenta» (IA)), o para decidir si una frase larga contesta la pregunta abierta. Lo común se entiende sin IA: las pruebas sin IA verifican además que no se la llamó.
- **Qué se manda** (`ai.ts`, `services/voice.ts`): `POST /voice/interpret` con JWT, `{ domain, text, context, conversation }`; el contexto lo arma cada módulo (`VoiceDomain.ai.context`) sin datos de pacientes. Espera hasta 25 s.
- **El flujo** «Voz - Interpretar» (`scripts/n8n/generate-help-workflows.mjs` → `n8n-workflows/help-voice-interpret.json`, nunca editar el JSON a mano; `pnpm n8n:help` lo regenera y `N8N_API_KEY=… pnpm n8n:deploy:voice` lo publica). Cada módulo define `system` (prompt), `prepare` (contexto → texto) y `validate` (lista cerrada):

| Módulo | Qué entiende la IA |
| --- | --- |
| `core` | A qué destino del menú se quiere ir cuando no se nombró tal cual («llevame donde veo quién nos debe plata» (IA) → Deudores) |
| `calendar` | Toda la agenda: pasos de un catálogo cerrado (ir a fecha, vista, filtros, citas, estados, formulario, configuración…) con doctores, agendas, sedes y tratamientos de la pantalla |
| `lab_orders` | Alta y edición de órdenes (paciente, trabajos, piezas, laboratorio, envío), etapas, estados, filtros |
| `screen` | Cualquier pantalla: con los nombres de lo que está a la vista devuelve pasos (apretar, completar con un valor, activar, elegir, pestaña, buscar) o hasta 3 propuestas |
| `perio` | Dictado del periodontograma (los mismos comandos que su intérprete) |

- **Revalidación doble**: en n8n (`validate`) y en el navegador (`sanitize` de cada módulo). Un id, una pieza, una fecha o un botón que no está en lo que se mandó se descarta.
- **Confianza**: < 0,5 → «No entendí»; 0,5–0,8 → «No estoy seguro: ¿querés …?»; ≥ 0,8 → se hace. Hasta 6 pasos por plan.
- **La IA nunca ejecuta**: devuelve pasos; el navegador decide y la pantalla pregunta antes de lo pesado. Confirmar, descartar y parar nunca vienen de la IA.
- Sin el flujo publicado, la pantalla sigue funcionando: queda «No entendí» o «¿Te referís a…?».

## 6. Cómo está hecha

### 6.1 El motor (`src/lib/voice/`)

| Archivo | Qué hace |
| --- | --- |
| `session.ts` | La sesión: escucha (botón y Ctrl+Espacio), juntar pedazos, eco, dormir, pila de preguntas, tareas, foco, herramientas, cambio de tema, avisos y ventanas que se abren, IA, sugerencias, tarjeta y voz. Lo configura el host con `configureVoiceSession` (idioma, traductor, permisos, navegación) |
| `registry.ts` | Registro de módulos (`registerVoiceDomain`) y comandos (`registerVoiceCommand`); `matchVoiceCommand` por prioridad; cortesía fuera; `listVoiceAiDomains` (siempre suma `screen` al final) |
| `commands/` | Los 83 comandos, uno o varios por archivo; `index.ts` los registra |
| `parse.ts` | Normalizar, números en palabras, sí/no, fechas y horas dichas, posiciones («la primera») |
| `wake.ts` | «Invoke» y sus formas; frases de control (retomar, cancelar, dejar de escuchar); qué parece un pedido; pedidos compuestos |
| `speech-recognition.ts` | Web Speech API (continuo y una frase), con pausa blanda |
| `mic-handoff.ts` | Un solo micrófono a la vez (dictado del periodontograma ↔ botón Voz) |
| `focus.ts` | La cita en foco (30 min) y lo seleccionado en pantalla |
| `ai.ts` | Pedir a la IA del módulo y revalidar |
| `screen-bridge.ts` | Puentes pantalla ↔ voz (`useVoiceBridge`, `publishVoiceBridge`, `getVoiceBridge`, `listVoiceBridges`, `waitVoiceBridge`) |
| `calendar-bridge.ts` | El puente propio de la agenda (estado y acciones de la página) |
| `dialog-voice.ts` | Control numerado de los diálogos de la agenda (bloquear/habilitar horario, recordatorios) |
| `lab-order-draft-bridge.ts` | El asistente de órdenes de laboratorio abierto por voz (alta y edición) |
| `dom-ui.ts` | La «superficie»: lo que está arriba en pantalla (botones, pestañas, campos, interruptores, listas, buscador, filas) con su nombre; escribir, elegir, tocar, esperar a que cargue |
| `dom-dialog.ts` | Avisos y ventanas: leerlos, elegir su botón por texto/posición/sí-no y por verbo sinónimo («aplicá los cambios» → «Confirmar todo»), cerrar el de arriba, mirar cuándo se abren |
| `dom-scroll.ts` | Desplazarse dentro de lo de arriba |
| `field-values.ts` | Lo dicho como lo espera el campo: hora, fecha, número, color, teléfono |
| `search-term.ts` | La palabra clave de una búsqueda («filtrá los que se llaman ibuprofeno» → «ibuprofeno») |
| `suggest.ts` | «¿Te referís a…?»: lo más parecido entre lo que se ve y el menú |
| `nav-targets.ts` | Destinos del menú con sinónimos es/en (de `src/config/nav.ts`) y qué módulo tiene cada ruta (`ROUTE_VOICE_DOMAINS`) |
| `period.ts` | Períodos dichos para el panel y los reportes |
| `patient-info.ts` | Preguntas sobre un paciente que se contestan con sus registros |

### 6.2 La interfaz

| Pieza | Dónde |
| --- | --- |
| Host (atajos, configura la sesión, tarjeta, puentes de prueba `__voiceSurface`) | `src/components/voice/voice-command-host.tsx` |
| Botón Voz | `VoiceCommandButton`, en el riel derecho (lo monta el `Header`) |
| Estado de la tarjeta | `src/stores/voice-command-store.ts` (`useVoiceCommand`) |
| Módulos activos | `src/stores/voice-screen-store.ts` + `useVoiceScreen([...])` (`src/hooks/use-voice-screen.ts`) |
| Texto con formato en la tarjeta | `src/components/voice/voice-rich-text.tsx` |
| Riel derecho | `src/components/voice/rail-voice-bridge.tsx` |
| Asistente de órdenes por voz | `src/components/voice/voice-lab-order-dialog-host.tsx` |
| Avisos | `src/components/ui/alert-dialog.tsx` marca el botón principal y el de cancelar (`data-voice-dialog`) |

### 6.3 Qué activa cada módulo (lo monta el componente, no la ruta)

| Módulo | Lo activa (`useVoiceScreen`) | Puente que publica |
| --- | --- | --- |
| `core` | Siempre | `rail` (riel derecho) |
| `dashboard` | Panel de control (`app/[locale]/page.tsx`) | `dashboard` |
| `calendar` | Agenda (`appointments/page.tsx`) | `calendar-bridge` |
| `workspace` | Mi consultorio (`doctor-workspace.tsx`) | `workspace`, `workspace.agent` (agente clínico) |
| `alerts` | Centro de alertas | `alerts` |
| `cashier` | Caja | `cashier`, `cashier.session`, `cashier.count.*` |
| `patients` | Pacientes | `patients` |
| `lab_orders` | Órdenes de laboratorio | `lab_orders.page` |
| `perio` | Barra de dictado del periodontograma | `perio` |
| `billing` | Cobro rápido abierto (desde cualquier lado) | `billing.patient`, `billing.items`, `billing.payment` |
| `documents` | Tablas de facturas, pagos y presupuestos (`use-documents-voice.ts`: Ventas, Compras, ficha del paciente) | `documents.*` |
| `ledger` | Estado de cuenta del paciente (`patient-ledger.tsx`: ficha → Finanzas y panel «Estado de cuenta») | `ledger` |
| `reports` | `ReportShell` (los 23 reportes) | `reports.shell`, `reports.period`, `reports.kpi.*`, `reports.table` |
| `crud` | **Cualquier** `DataTable` (la tabla común) | `crud.*`, `view.*` (vista tabla/lista), `export.dialog` |
| `screen` | Siempre (solo IA) | — (lee la superficie) |

### 6.4 Textos

Todo lo que dice la voz está en `src/messages/{es,es-ES,en}.json`, bajo `VoiceCommands.*` (con las mismas claves y placeholders en los tres; `pnpm i18n:check`). Los nombres de los botones y campos se leen de la pantalla, así que siempre coinciden con lo que se ve.

## 7. Módulos, comandos y qué se puede pedir

Prioridad: más alta se prueba antes. **aux**: herramienta (no corta la tarea en curso). **foco**: actúa sobre la cita o el paciente en foco. **ventana**: trabaja dentro de la ventana abierta. **IA**: la IA de su módulo puede devolverlo.

### 7.1 General, en cualquier pantalla (`core`)

| Comando | Prio | Qué hace |
| --- | --- | --- |
| `core.navigate` | 50 | Menú principal: los 92 destinos por nombre y sinónimos (es/en), con permisos; ambiguos se preguntan; «andá a X y …» va y sigue allá; IA si no se nombró tal cual. **IA** |
| `core.rail_*` (8) | 30–38 | Riel derecho: paciente (ficha, historia, cuenta), cobrar, sede de trabajo, caja, pantalla TV, información (alertas, bandeja, tipo de cambio), panel (mostrar/ocultar), notas |
| `core.close` | 30 | Cerrar lo último que se abrió (ventana de arriba; si no hay, el detalle del registro); «cerrá todo» |
| `core.scroll` | 2 | Desplazarse dentro de lo de arriba. aux |
| `core.navigate_open` | 1 | «abrí …» como navegación cuando nada más lo toma |
| `core.screen` | −1 | La voz genérica: cualquier cosa que se vea (ver 7.2) |
| `core.suggest` | — | «¿Te referís a…?» (lo arma la sesión) |

**Ejemplos probados.** Navegar: «andá a pacientes», «centro de alertas», «volvé al inicio», «ve a pacientes», «llévame a la caja», «llevame a reportes de deudores», «andá a la agenda y poné vista día», «andá a pacientes y bajá», «go to patients», «take me to the alerts center», «go home», «go to the calendar and switch to month view»; con IA: «llevame donde veo quién nos debe plata» (IA), «take me where I see the income» (IA). Riel: «en qué sede estoy», «cambiá a la sede Pocitos», «quiero trabajar en la sede pocitos», «switch to the location Pocitos», «cuánto hay en caja», «está abierta la caja», «is the cash register open», «a cuánto está el dólar», «what is the exchange rate», «cuántas alertas tengo», «any alerts», «tengo mensajes», «abrí las notificaciones», «abrí la ficha de Ana», «abrí la cuenta», «cobrale», «prendé la tele», «turn off the tv», «llamá al siguiente paciente», «siguiente paciente en el sillón 1», «agregá una nota», «nueva nota: llamar al laboratorio el lunes», «add a note saying call the lab», «abrí las notas», «escondé el panel derecho», «mostrá el panel derecho», «hide the right panel», «despertá al asistente». Desplazarse: «bajá», «bajá un poco». Cerrar: «cerrá», «cerrá el detalle», «close it», «back to the list».

### 7.2 Cualquier pantalla: la voz genérica (`core.screen`)

Lo que se ve se puede tocar, aunque la pantalla no tenga voz propia. Lee la superficie de arriba (`dom-ui.ts`) y le da nombre a cada control por su texto, su `aria-label`, su etiqueta, lo que tiene al lado o (en una grilla) fila + columna.

| Qué | Cómo se pide |
| --- | --- |
| Botones y pestañas | Por su nombre con o sin verbo («nuevo paciente», «pulsa nuevo paciente», «guardar», «exportar»); por un verbo sinónimo («grabá» → Guardar, «aplicá los cambios» → Confirmar todo, «agregá un artículo» → Agregar Artículo) |
| Campos | «el nombre es …», «poné … en …», «completá el … con …», «modificá / cambiá / editá / asigná / actualizá / seteá / definí / registrá / fijá / indicá / colocá / especificá / corregí …», sustantivos («nueva dosis 500 mg»), el campo con su valor sin verbo («vía oral»); «poné el teléfono» sin valor pregunta qué poner. Si el campo está bloqueado hasta «Editar», aprieta «Editar» y espera |
| Valores | Hora («la hora es las 9 y media» → 09:30), fecha (al formato del campo), número con unidad («la duración es 5 días» → 5), color («el color es rojo» → #ef4444), teléfono con su país |
| Interruptores y casillas | «activá …», «desactivá …», «prendé …», «marcá la casilla de …», «turn on …», «deactivate …» |
| Listas | «elegí … en …», «… : …», «método de pago cheque», «sede Pocitos», «set the doctor to …»; con caja de búsqueda escribe lo dicho, espera y elige («paciente Carolina Píriz», «elegí Leonardo en paciente»); varios iguales, pregunta; sin decir cuál («elegí el paciente»), pregunta qué buscar |
| Opciones (radio, tarjetas) | Por su título |
| Calendario a la vista | La fecha dicha («el 15 de diciembre»): va de mes en mes y la toca |
| Acción de una fila | «desactivá la etapa enviado al laboratorio», «eliminá recibido en clínica» (si el botón está deshabilitado, lo dice) |
| Color de una fila | «el color de atendida es rojo» |
| Buscar | «buscá …», «filtrá por …», «filter the ones that have …» (escribe solo la palabra clave); «borrá la búsqueda», «clear the search»; donde no hay buscador, lo dice |
| Editores enriquecidos | «el contenido es …» (indicaciones, recetas, plantillas) |
| Ayuda | «qué puedo hacer acá» |

**Ejemplos probados**: «nuevo paciente», «pulsa nuevo paciente», «busca a Juan», «paciente Carolina Píriz», «elegí Leonardo en paciente», «doctor Martínez», «sede Pocitos», «método de pago cheque», «activá enviar por email», «desactivá el recordatorio», «prendé recordatorio», «marcá la casilla de factura», «deactivate solicitud creada», «la cantidad es 2», «la duración es 5 días», «la hora es las 9 y media», «set the dosis to 400 mg», «set the doctor to Benítez», «record the precio 1500», «el color de atendida es rojo», «desactivá la etapa enviado al laboratorio», «eliminá recibido en clínica», «filtrá por Juan», «filter the ones that have Carolina», «clear the search», «qué puedo hacer acá», «qué puedo hacer aquí». En la app real: «la hora de inicio es las 9 y media», «el color es rojo», «el 15 de diciembre», «modificá el nombre de la clínica a Clínica de Prueba Voz», y en las 59 pantallas de la matriz tres sinónimos por campo.

**La IA de la pantalla** (`screen.steps`, `screen.suggest`, módulo `screen`): lo que la voz genérica no entiende se le pregunta a la IA con los nombres de lo que se ve; devuelve pasos o propuestas. Probado: «dejame esto guardado con el nombre Sede Pocitos» (IA), «get this stored with the name Downtown» (IA), «que no mande los recordatorios» (IA) → desactiva «Enviar recordatorios». La validación descarta lo que no está en pantalla («quiero esto borrado del sistema» termina en «¿Te referís a ir a «Sistema»?») y lo que está en las filas no viaja a la IA.

**«¿Te referís a…?»**: «los mapas sincronizados» → «¿Te referís a apretar «Sincronizar mapas»?»; se elige con «la primera» o «sincronizar mapas»; «no», «ninguna», «no, nada que ver», «none of those» lo dejan como estaba. La charla de la sala («qué lindo día hace hoy en la playa») no propone nada.

### 7.3 Tablas (`table.act`, módulo `crud`)

Cualquier tabla común (`DataTable`), donde esté: la lista de la pantalla, la de una pestaña del detalle o la de una ventana. La de arriba primero.

| Qué | Ejemplos probados |
| --- | --- |
| Buscar (escribe en la barra, espera y lee cuántos salieron) | «buscá ibuprofeno», «busca paracetamol», «search for amoxicilina», «buscá ibu» (vivo), «borrá la búsqueda» |
| Filtrar con la palabra clave | «filtrá por Juan», «filtrá los que tengan Carolina» (vivo) |
| Filtro de la barra | «filtrá por facturas», «solo los presupuestos» |
| Páginas | «siguiente página», «página anterior», «primera página», «última página», «página 9», «next page» (vivo) |
| Cantidad por página | «poné 10 por página» (vivo), «show 10 per page» (vivo) |
| Vista tabla / lista | «lista», «vista de lista» (vivo), «vista de tabla» (vivo) |
| Columnas | «qué columnas hay», «which columns are there», «ocultá la columna precio», «ocultá la columna fecha de alta», «mostrá la columna …» (vivo, 59 pantallas) |
| Ordenar | «ordená por nombre», «ordená por nombre descendente», «sort by nombre descending», «sacá el orden»; si la columna no se puede ordenar, lo dice («ordená por teléfono») |
| Elegir por posición | «seleccioná el 1», «seleccioná el 2», «el segundo», «select row 1»; un número que no está lo dice («seleccioná el 15») |
| Elegir por una columna | «abrí el que tiene nombre ibuprofeno» (varios: pregunta) |
| Elegir por ID o código | «seleccioná el código MED-3», «abrí el código MED-9» (si no está en la página, lo busca) |
| Tablas que no abren su detalle | Se aprieta «Ver» o «Editar» de esa fila (Servicios, Cajas registradoras) |
| Cerrar el detalle | «cerrá el detalle», «back to the list» |
| Exportar | «exportá a Excel», «exportá a CSV», «exportá a PDF», «export to excel», «exportá» (pregunta el formato) |
| Esperar la recarga | Recién buscada o borrada la búsqueda, elegir una fila espera a que la tabla termine de cargar |

### 7.4 Listas del Catálogo, Configuración y Sistema (`crud.act`)

Alta con nombre, abrir por nombre o posición, contar y actualizar en cualquier lista común; el formulario se completa con la voz genérica.

**Ejemplos probados**: «nuevo medicamento Diclofenac», «nuevo medicamento Ketorolac», «agregá un medicamento llamado Ácido Tranexámico», «añade un medicamento llamado Diclofenaco», «nueva sede Carrasco», «nueva unidad de medida Kilogramo», «crea una moneda llamada Euro», «nuevo doctor Juan Pérez», «new medication Ibuprofen», «add a medication called Diclofenac», «create a location called Downtown», «new location Downtown», «andá a medicamentos y agregá uno llamado Diclofenac», «abrí la amoxicilina», «abrí la sede pocitos», «abre la sede centro», «editá el ibuprofeno», «abrí el último», «open the second», «open the location pocitos», «cuántos hay», «how many are there», «actualizá la lista», «refresh the list», «nuevo» (abre el alta; en listas de consulta dice que no se crea). En la app real: «nuevo medicamento Prueba Voz», «new medication Voice Test», «cuántas hay», «actualizá la lista».

### 7.5 Agenda (`calendar`, 33 comandos)

La pantalla más completa; levantamiento acción por acción en [voz-agenda.md](voz-agenda.md) y frases en [voz-ejemplos/](voz-ejemplos/README.md) (áreas 10 a 13, 20, 30, 40, 50, 60, 70 a 72, 80, 90).

| Grupo | Comandos | Ejemplos probados |
| --- | --- | --- |
| Moverse | `calendar.navigate` (aux) | «andá a mañana», «volvé a hoy», «go to tomorrow», «today» |
| Vista y agendas | `calendar.view`, `calendar.filter`, `calendar.group`, `calendar.panel` (aux) | «poné vista mes», «vista día», «week view» |
| Zoom, panel, opciones, engranaje | `calendar.zoom`, `calendar.agendas_panel`, `calendar.options`, `calendar.settings` (aux) | ver área 10 y 11 del catálogo |
| Consultas | `calendar.query` (aux) | «qué tengo hoy», «mostrame las citas de hoy» |
| La cita | `calendar.select` (foco), `calendar.status`, `calendar.color`, `calendar.move_calendar`, `calendar.assign_doctor`, `calendar.duration`, `calendar.delete`, `calendar.open` | «la cita de Ana», «la cita de Juan Pérez», «la segunda» |
| Dar, editar, reprogramar | `calendar.create`, `calendar.edit`, `calendar.reschedule`, `calendar.form` (100: el formulario abierto recibe las correcciones) | ver área 13 |
| Horarios y recordatorios | `calendar.slot`, `calendar.reminder`, `calendar.reminder_action` | ver área 72 |
| Exportar | `calendar.export` | ver área 13 |
| Pacientes | `calendar.patient_find`, `calendar.patient_ask`, `calendar.patient_info` (aux), `calendar.patient_action` | «cuánto debe» |
| Avisos y cerrar | `calendar.dialog` (99), `calendar.close`, `calendar.toolbar` | ver área 03 y 04 |

### 7.6 Panel de control (`dashboard`)

`dashboard.query` (leer) y `dashboard.filter` (período, sede, moneda; aux). Todo local, con lo que ya cargó.

**Ejemplos probados**: «cuánto producimos hoy», «producción por sede, cuál vende más», «mostrame el mes pasado», «este mes», «show me last month», «filtrá por la sede centro», «solo la sede Pocitos», «only the location Pocitos», «todas las sedes», «en dólares», «actualizá el panel», «refresh», «volvé al inicio y decime cuánto producimos hoy».

### 7.7 Mi consultorio (`workspace` + agente clínico)

`workspace.select` y `workspace.switch` (elegir y cambiar de caso), `workspace.action` (sesión, receta, laboratorio, estética, periodontograma, ficha, anamnesis, odontograma), `workspace.filter` (día, semana, mes, mis citas, la agenda de un consultorio; aux) y `workspace.agent` (−10: lo que no es de la página y suena dirigido al asistente va al agente clínico).

**Ejemplos probados**: «el de las 10», «el de las 9», «el siguiente», «el anterior», «la primera», «the 10 o clock», «quién sigue», «who is next», «qué pacientes tengo», «qué pacientes tengo mañana», «what is on my schedule», «qué tengo el viernes», «mis citas de mañana», «my appointments», «show me tomorrow», «mostrame del 1 al 15», «el 15 de diciembre», «cambiá a Roberto», «nueva sesión», «nueva sesión para Carlos», «new session», «recetale a Sofía», «prescribe», «hacé una orden de laboratorio para el de las 10», «open the periodontal chart», «abrí la ficha de Roberto Díaz», «andá a mi consultorio y abrí el de las 10». En la app real: «cambiá de Carolina a Leonardo», «seleccioná a Martín», «mis calendarios», «asignadas a mí», «cambiá la fecha a mañana», «la semana pasada», «cerrá este caso clínico y abrí el de Leonardo», «quiero ver ahora el de Martín», «el paciente Carolina», «el siguiente paciente», «hacele una receta», «medicamento ibuprofeno», «la dosis es 400 mg».

**Caso clínico** (agente): «dame un resumen», «qué alergias tiene», «le hice una limpieza», «le he hecho una limpieza», «I did a cleaning on 16», «completá la sesión hice una limpieza en el 16», «abrí el odontograma y marcá caries en el 16», «guardala», «guárdala», «save it», «revisala», «cerrá el caso», «cierra el caso», «close the case», «volvé al caso», «vuelve al caso», «back to the case». La charla de la sala («decime el clima de mañana») no se manda.

### 7.8 Centro de alertas (`alerts`)

`alerts.read` (leer y filtrar; aux) y `alerts.action` (completar, ignorar con motivo, posponer, llamada, nota, mail, WhatsApp, abrir el paciente; sobre una, varias, las seleccionadas o todas; lo que cambia o manda se confirma).

**Ejemplos probados**: «cuántas alertas hay», «how many alerts are there», «leé las alertas», «qué alertas críticas hay», «show me the completed alerts», «seleccioná la de Carlos», «completá la de Carlos», «completá la primera», «completá las críticas», «completá las seleccionadas», «complete the alert for Carlos», «ignorá la de Sofía», «ignorá la del laboratorio porque ya llegó», «posponé la de Carlos una semana», «posponé las de cumpleaños hasta mañana», «pospón la de Carlos hasta mañana», «snooze the alert for Juan until tomorrow», «registrá una llamada a Carlos para mañana a las 10», «agregá una nota a la de Carlos: pagará el viernes», «mandale un mail a Carlos», «mandale un whatsapp a Juan», «send a whatsapp to Juan», «abrí el paciente de la segunda», «andá al centro de alertas y decime cuántas alertas hay».

### 7.9 Caja (`cashier`)

`cashier.points` (cajas: ver, abrir, una abierta por persona), `cashier.session` (efectivo, entradas, salidas, tarjeta, movimientos; aux), `cashier.count` (contar el efectivo en la apertura o el cierre). Los botones del asistente con la voz genérica.

**Ejemplos probados**: «qué cajas hay», «which registers are there» (vivo), «abrí la caja principal», «entrá a la caja recepción», «open the register caja principal», «la segunda», «volvé a las cajas», «how much cash is there», «hacé el cierre», «start the closing», «5 billetes de 1000, 3 de 500 y 2 monedas de 10», «cinco de mil», «de 200 pongo 4», «3 de 100 dólares», «5 notes of 1000 and 2 of 500», «todo en cero», «todo a cero», «lo mismo que el último cierre», «el total es 1500», «cuánto da», «andá a la caja y decime qué cajas hay».

### 7.10 Pacientes (`patients`)

`patients.list` (buscar, abrir, filtros, nuevo, contar), `patients.detail` (pestañas y acciones de la ficha), `patients.info` (preguntas; aux). Los formularios que se abren se llenan con la voz genérica.

**Ejemplos probados**: «buscá a Ana», «busca a Roberto», «buscá a Roberto Díaz», «search for Roberto», «abrí el segundo», «abrí a Ana», «abrí la ficha de Carlos López», «abrí la ficha de Sofía Castro» (no está a la vista: la busca), «open Juan Pérez record», «only debtors», «cuántos pacientes hay», «new patient», «nueva sesión para Carlos López», «new session for Carlos López», «hacele un presupuesto a Sofía Castro», «make a quote», «abrí el estado de cuenta de Zoe Zamora», «cuánto debe», «how much does he owe», «cuántas veces vino Juan Pérez», «resumen de Juan Pérez», «andá a pacientes y buscá a Roberto Díaz». Lo que es de la tabla no se toma como un nombre: «mostrá la columna Correo Electrónico», «seleccioná el 1», «abrí el registro 3», «show the Email column».

### 7.11 Estado de cuenta del paciente (`ledger`)

`ledger.act`: moneda, orden, período, altas en línea (presupuesto, tratamiento, pago) con sus campos, saldo, movimientos y acciones por fila (por número, fecha, posición o descripción); lo que cambia algo se confirma.

**Ejemplos probados**: «cuánto debe», «what is the balance», «leeme los movimientos», «en dólares», «mostrame el mes pasado», «facturá el presupuesto 1», «factura el presupuesto 1», «facturá el del 17 de marzo», «facturalo», «finalizá la factura 12», «volvé a presupuesto la factura 12», «hacé una nota de crédito de la restauración», «imprimí la factura 12», «print invoice 12», «mandá por mail el presupuesto 1», «editá el pago», «eliminá el pago», «seleccioná el último». En la app real: «abrí el estado de cuenta de Carolina Píriz», «ordená descendente», «en pesos», «nuevo presupuesto», «tratamiento limpieza», «la cantidad es 2».

### 7.12 Facturas, pagos y presupuestos (`documents`)

`documents.act`, en cualquier tabla de documentos (Ventas, Compras, la ficha del paciente): leer y sumar, abrir, imprimir, mail, editar, confirmar, rechazar, cobrar, asignar, crear, exportar, actualizar, filtrar.

**Ejemplos probados**: «cuántas facturas hay», «how many invoices are there», «cuánto suman las pendientes», «¿cuánto suman las pendientes?», «cuántos presupuestos hay», «abrí la factura 999» (no existe: lo dice), «imprime la factura 120», «print invoice 120», «imprimí la de Ana», «imprimí la de Dental Sur», «email the one for Juan Pérez», «confirmá el presupuesto P-10», «rechazá el de Sofía Castro», «cobrá el presupuesto 11», «collect invoice 123», «andá a facturas y cobrá la factura 120», «new invoice», «nuevo presupuesto», «export the invoices», «solo las anuladas».

### 7.13 Reportes (`reports`)

`reports.act` (generar, período, desde siempre, leer los totales, filas, exportar, imprimir) y `reports.filter` (cualquier selector de la barra: caja, método de pago, moneda, sede, doctor, tipo). Sirve en los 23 reportes porque va en las piezas comunes.

**Ejemplos probados**: «generá el reporte», «genera el informe», «run the report», «el mes pasado», «last month», «mostrame marzo», «del 1 al 15», «desde siempre», «cuánto da», «what is the total», «cuántas filas hay», «exportá a excel», «export to excel», «exportá a csv», «bajalo en pdf», «imprimilo», «qué cajas hay», «filtrá por la caja fuerte», «sacá los filtros», «llevame a reportes de deudores y mostrame el mes pasado» (sin período: lo genera igual). En la app real: «llevame a reportes de cobros del día y mostrame el mes pasado», «filtrá por la caja sede carrasco», «solo egresos», «take me to the daily collections report and show last month», «read the totals».

### 7.14 Órdenes de laboratorio (`lab_orders`)

`lab-orders.pick` (por lo que se ve: «la de Ana», «la primera», la orden abierta), `lab-orders.stage`, `lab-orders.status`, `lab-orders.edit`, `lab-orders.list` (por número), `lab-orders.create` y `lab-orders.edit-order` (con IA: el asistente completo en Revisar, «sí» crea o guarda).

**Ejemplos probados**: «abrí la de Juan Pérez», «abre la de Juan Pérez», «abrí la tercera», «open the one for Juan», «dónde está la de Juan», «dónde está la de Ana» (dos: pregunta cuál), «pasá la de Juan a recibida en clínica», «llegó la de Juan», «la orden 46 llegó», «ya llegó», «it arrived», «andá a laboratorio y abrí la de Juan Pérez», «cerrá» (cierra la orden abierta). La creación y edición con IA tienen su propia batería en el navegador (`e2e/tests/lab-orders/voice-commands.spec.ts`).

### 7.15 Periodontograma (`perio`)

`perio.dictate` (70, ventana): con el examen abierto, lo dicho va a su dictado («3 2 3», «three two three», «bleeding on 16», «guardar»), sin cerrar la ventana. Navegar («andá a la agenda»), desplazarse («bajá un poco») y «dejá de escuchar» siguen siendo generales. Un solo micrófono a la vez. Su intérprete propio y su IA: `src/lib/perio/voice.ts` y `e2e/tests/patients/perio-voice-*.spec.ts`.

### 7.16 Cobro rápido (`billing`, desde cualquier lado)

`billing.patient` (92), `billing.add` (91), `billing.line` y `billing.payment` (90), `billing.info` (89), `billing.go` (88), todos dentro de la ventana del cobro.

**Ejemplos probados**: «cobrale a Juan Pérez», «el paciente es Ana», «agregá limpieza», «agregá 2 limpiezas», «añade una limpieza», «add limpieza», «add 2 consulta at 900», «agregá un servicio», «el precio de la limpieza a 1200», «la consulta a 800», «la cantidad de la consulta en 3», «cantidad 2», «10% de descuento», «10% de descuento a la limpieza», «descuento del 15 por ciento», «aplicá un descuento de 200», «give a 10 percent discount», «cambiá la moneda a pesos», «en dólares», «en efectivo», «con tarjeta de débito», «con transferencia», «1000 en efectivo y el resto con tarjeta de crédito», «agregá otro medio de pago», «cuánto da», «cuánto falta», «facturá y cobrá», «invoice and collect», «cobrá», «charge it», «cerrar», «cancelar». En la app real: el cobro desde la bandeja con «Cobro Rápido».

## 8. Páginas cubiertas

**Todas las páginas tienen la voz general** (§7.1–7.2): menú, riel, cerrar, desplazarse, la voz genérica (botones, campos, listas, interruptores, buscador, ayuda), «¿te referís a…?» y la IA de la pantalla. La tabla dice qué más tiene cada una y cómo se probó.

Columnas: **Voz propia** (además de la general) · **Simulador** (hay pruebas con esa pantalla; las áreas generales usan una pantalla de ejemplo) · **En vivo**: `matriz` (59 pantallas, es y en, [voz-pruebas-vivo.md](voz-pruebas-vivo.md)), `humo` (escenarios de `voice-smoke.live.ts`), `barrido` (`config-sweep.live.ts` + `controls-audit.live.ts`), `auditoría` (`workspace-audit.live.ts`), `grabación` (la promo, `scripts/videos/promo-voice`).

<!-- PAGES_TABLE:START (generado por pnpm test:voice:examples) -->
**92 páginas del menú**: 77 con voz propia o la de sus tablas, documentos o reportes; 15 solo con la general. **69 recorridas en la app real**; 23 todavía no (marcadas **—**).

| Página | Ruta | Voz propia | Simulador | En vivo |
| --- | --- | --- | --- | --- |
| Panel de Control | `/` | Panel de control (`dashboard`) | 119 frases | humo |
| Mi Consultorio | `/workspace` | Mi consultorio (`workspace`) + agente clínico + periodontograma, estado de cuenta | 311 frases | humo, auditoría, grabación |
| Centro de Alertas | `/alerts` | Centro de alertas (`alerts`) | 48 frases | matriz, humo |
| Caja | `/cashier` | Caja (`cashier`) + Tablas (`crud`) | 40 frases | humo |
| Transacciones Misceláneas | `/cashier/miscellaneous-transactions` | Tablas (`crud`) | — | matriz |
| Categorías de Productos y Servicios | `/cashier/miscellaneous-categories` | Tablas (`crud`) | — | matriz |
| Sesiones de Caja | `/cashier/sessions` | Tablas (`crud`) | — | matriz |
| Cajas Registradoras Físicas | `/cashier/cash-points` | Tablas (`crud`) | — | matriz |
| Citas | `/appointments` | Agenda (`calendar`) + Tablas (`crud`) | 1708 frases | humo, grabación |
| Pantalla TV | `/tv-display` | Solo la general | — | **—** |
| Pacientes | `/patients` | Pacientes (`patients`) + estado de cuenta (`ledger`) + documentos de la ficha + periodontograma + Tablas (`crud`) | 161 frases | matriz, humo |
| Estudios | `/studies` | Solo la general | — | matriz |
| Estudios Compartidos | `/shared-studies` | Solo la general | — | **—** |
| Órdenes de Laboratorio | `/lab-orders` | Órdenes de laboratorio (`lab_orders`) + Tablas (`crud`) | 25 frases | matriz, humo |
| Presupuestos | `/sales/quotes` | Documentos (`documents`) + Tablas (`crud`) | 5 frases | matriz |
| Órdenes | `/sales/orders` | Documentos (`documents`) | — | **—** |
| Facturas | `/sales/invoices` | Documentos (`documents`) + Tablas (`crud`) | 34 frases | matriz, humo |
| Pagos | `/sales/payments` | Documentos (`documents`) + Tablas (`crud`) | — | matriz |
| Métodos de Pago | `/sales/payment-methods` | Tablas (`crud`) | — | matriz |
| Servicios | `/sales/services` | Tablas (`crud`) | — | matriz |
| Presupuestos de Compra | `/purchases/quotes` | Documentos (`documents`) | — | matriz, humo |
| Órdenes de Compra | `/purchases/orders` | Documentos (`documents`) | — | **—** |
| Facturas de Compra | `/purchases/invoices` | Documentos (`documents`) + Tablas (`crud`) | 1 frase | matriz |
| Pagos de Compra | `/purchases/payments` | Documentos (`documents`) + Tablas (`crud`) | — | matriz |
| Proveedores | `/purchases/providers` | Tablas (`crud`) | 278 frases | matriz, humo |
| Productos y Servicios de Proveedores | `/purchases/services` | Tablas (`crud`) | — | matriz |
| Padecimientos | `/clinic-catalog/ailments` | Tablas (`crud`) | — | matriz |
| Medicamentos | `/clinic-catalog/medications` | Tablas (`crud`) | 162 frases | matriz, humo |
| Condiciones Dentales | `/clinic-catalog/dental-conditions` | Tablas (`crud`) | — | matriz |
| Superficies Dentales | `/clinic-catalog/dental-surfaces` | Tablas (`crud`) | — | matriz |
| Unidades de medida | `/clinic-catalog/measurement-units` | Solo la general | 1 frase | matriz |
| Detalles de la Clínica | `/config/clinics` | Tablas (`crud`) | — | matriz, humo, barrido |
| Preferencias de Clínica | `/config/clinic-prefs` | Solo la general | — | matriz, barrido |
| Portal del Paciente | `/config/patients-portal` | Solo la general | — | matriz, barrido |
| Sedes | `/config/sedes` | Tablas (`crud`) | 45 frases | matriz, humo, barrido |
| Horarios | `/config/schedules` | Tablas (`crud`) | — | matriz, humo, barrido |
| Horarios de Excepción | `/config/holidays` | Tablas (`crud`) | 2 frases | matriz, humo, barrido |
| Calendarios | `/config/calendars` | Tablas (`crud`) | — | matriz, humo, barrido |
| Colores de Calendario | `/config/calendar-colors` | Solo la general | — | matriz, barrido |
| Doctores | `/config/doctors` | Tablas (`crud`) | 1 frase | matriz, barrido |
| Secretarias y Administración | `/system/staff` | Tablas (`crud`) | — | matriz, barrido |
| Disponibilidad Médica | `/config/doctor-availability` | Tablas (`crud`) | — | matriz, barrido |
| Excepciones de Disponibilidad | `/config/availability-exceptions` | Tablas (`crud`) | — | matriz, barrido |
| Monedas y Tipos de Cambio | `/config/currencies` | Tablas (`crud`) | 1 frase | matriz, barrido |
| Secuencias | `/config/sequences` | Tablas (`crud`) | — | matriz, barrido |
| Sociedades Mutuales | `/config/mutual-societies` | Tablas (`crud`) | — | matriz, barrido |
| Grupos de Pacientes | `/config/patient-groups` | Tablas (`crud`) | — | matriz, barrido |
| Grupos de Proveedores | `/config/provider-groups` | Tablas (`crud`) | — | matriz, barrido |
| Etapas de Laboratorio | `/config/lab-stages` | Solo la general | — | matriz, barrido |
| Plantillas | `/config/templates` | Solo la general | — | matriz, barrido |
| Plantillas de Indicaciones Médicas | `/config/medical-instruction-templates` | Tablas (`crud`) | — | matriz, barrido |
| Plantillas de Receta | `/config/prescription-templates` | Tablas (`crud`) | — | matriz, barrido |
| Usuarios | `/system/users` | Tablas (`crud`) | — | matriz, barrido |
| Roles | `/roles` | Tablas (`crud`) | — | matriz |
| Permisos | `/permissions` | Tablas (`crud`) | — | matriz |
| Configuración de Alertas | `/system/alerts-config` | Solo la general | — | barrido |
| Categorías de Alertas | `/system/alert-categories` | Tablas (`crud`) | — | matriz, barrido |
| Reglas de Alertas | `/system/alert-rules` | Tablas (`crud`) | — | matriz, barrido |
| Plantillas de Alertas | `/system/communication-templates` | Tablas (`crud`) | — | matriz, barrido |
| Historial de Alertas | `/system/communication-history` | Tablas (`crud`) | — | matriz, barrido |
| Ejecuciones de Alertas | `/system/execution-history` | Tablas (`crud`) | — | matriz, barrido |
| Agente WhatsApp | `/system/whatsapp-agent` | Solo la general | — | matriz, barrido |
| Métricas del Asistente | `/system/help-insights` | Solo la general | — | barrido |
| Configuraciones | `/system/config` | Tablas (`crud`) | — | matriz, barrido |
| Notificaciones | `/system/notification-settings` | Solo la general | — | matriz, barrido |
| Registro de Auditoría | `/system/audit` | Tablas (`crud`) | — | matriz, barrido |
| Registro de Acceso | `/system/access` | Tablas (`crud`) | — | matriz, barrido |
| Registro de Errores | `/system/errors` | Tablas (`crud`) | — | matriz, barrido |
| Importar Datos | `/system/import` | Solo la general | — | barrido |
| Licencias | `/system/licenses` | Solo la general | — | barrido |
| Suscripciones | `/subscriptions` | Tablas (`crud`) | — | **—** |
| Cierre de Caja | `/reports/cierre-caja` | Reportes (`reports`) + Tablas (`crud`) | 10 frases | humo |
| Cobros del Día | `/reports/cobros-dia` | Reportes (`reports`) + Tablas (`crud`) | — | humo |
| Cuentas Corrientes | `/reports/cuentas-corrientes` | Reportes (`reports`) + Tablas (`crud`) | — | **—** |
| Estado de Presupuestos | `/reports/estado-presupuestos` | Reportes (`reports`) + Tablas (`crud`) | — | **—** |
| Producción por Doctor | `/reports/produccion-doctor` | Reportes (`reports`) + Tablas (`crud`) | — | **—** |
| Tratamientos Realizados | `/reports/tratamientos` | Reportes (`reports`) + Tablas (`crud`) | — | **—** |
| Comparativo de Producción | `/reports/comparativo-produccion` | Reportes (`reports`) + Tablas (`crud`) | — | **—** |
| Honorarios | `/reports/honorarios` | Reportes (`reports`) + Tablas (`crud`) | — | **—** |
| Nuevos Pacientes | `/reports/nuevos-pacientes` | Reportes (`reports`) + Tablas (`crud`) | — | **—** |
| Pacientes Inactivos | `/reports/pacientes-inactivos` | Reportes (`reports`) + Tablas (`crud`) | — | **—** |
| Tratamientos en Curso | `/reports/tratamientos-en-curso` | Reportes (`reports`) + Tablas (`crud`) | — | **—** |
| Ocupación de Agenda | `/reports/ocupacion-agenda` | Reportes (`reports`) + Tablas (`crud`) | — | **—** |
| Cancelaciones | `/reports/cancelaciones` | Reportes (`reports`) + Tablas (`crud`) | — | **—** |
| Ingresos por Período | `/reports/ingresos-periodo` | Reportes (`reports`) + Tablas (`crud`) | — | **—** |
| Facturación vs Cobranza | `/reports/facturacion-cobranza` | Reportes (`reports`) + Tablas (`crud`) | — | **—** |
| Deudores | `/reports/deudores` | Reportes (`reports`) + Tablas (`crud`) | 31 frases | humo |
| Rendimiento de Servicios | `/reports/servicios` | Reportes (`reports`) + Tablas (`crud`) | — | **—** |
| Gastos Operativos | `/reports/gastos-operativos` | Reportes (`reports`) + Tablas (`crud`) | — | **—** |
| Estado de Resultados | `/reports/estado-resultados` | Reportes (`reports`) | — | **—** |
| KPIs Clínica | `/reports/kpis` | Reportes (`reports`) | — | **—** |
| Balance Mensual | `/reports/balance-mensual` | Reportes (`reports`) + Tablas (`crud`) | — | **—** |
<!-- PAGES_TABLE:END -->

## 9. Pruebas

### 9.1 Simulador (`pnpm test:voice`)

- 2420 pruebas en Node, sin navegador, sin servidor y sin tocar DEV (~7 min). **No correrlo a la vez que un build o las pruebas en vivo**: compiten por la máquina y aparecen timeouts falsos.
- Se «habla» por el micrófono permanente falso: cada frase pasa por la sesión, los comandos y los textos reales del idioma de la prueba.
- Las pantallas son simuladas (`e2e/tests/voice-agent/sim/`: agenda, riel, panel, Mi consultorio, alertas, caja, pacientes, laboratorio, documentos, reportes, tablas comunes y un DOM falso para la voz genérica) y publican lo mismo que la pantalla real.
- La IA es el flujo de n8n real (prompt y validación) con el modelo reemplazado por la respuesta que da la prueba; después pasa por la revalidación del navegador.
- Catálogos generados: [voz-ejemplos/](voz-ejemplos/README.md) (`pnpm test:voice:examples`: cada frase y lo que respondió) y [voz-agenda-pruebas.md](voz-agenda-pruebas.md) (`pnpm test:voice:catalog`: los nombres de las pruebas).

### 9.2 En la app real (`pnpm test:voice:live`)

Chrome contra la app en modo producción (`pnpm build && pnpm start -p 3000`), con la sesión del e2e y un reconocimiento falso que entrega cada frase como lo haría Chrome. Solo lo que no guarda (o se deshace).

| Prueba | Qué hace |
| --- | --- |
| `page-matrix.live.ts` | **La matriz**: en cada una de las 59 pantallas descubre lo que hay y prueba ayuda, ordenar, ocultar y mostrar una columna, filtrar con la palabra clave y borrar la búsqueda, elegir el primero y cerrar el detalle, el alta (avisa qué se le puede pedir), tres campos con tres sinónimos y valores de su tipo, interruptores, listas, opciones, cerrar lo último y el cambio de contexto con la ventana abierta. Cada paso se comprueba por lo que hizo o por la respuesta y se guarda al momento. `VOICE_MATRIX_LOCALE=en` y `VOICE_MATRIX_ROUTES=/a,/b` eligen idioma y pantallas; `pnpm test:voice:matrix:report` arma la galería |
| `voice-smoke.live.ts` | 46 escenarios es/en de punta a punta: menú, agenda, panel, riel, Mi consultorio (agenda, caso clínico, cambiar de caso, receta), tablas, configuración (horario, color, feriado, datos de la clínica), estado de cuenta, alertas, caja, pacientes, laboratorio, ventas, compras, reportes (período y filtros), catálogo |
| `config-sweep.live.ts` | Las 37 pantallas de Configuración y Sistema: ayuda, tabla, alta |
| `controls-audit.live.ts` | Lo que se ve y la voz no sabe nombrar, por pantalla, alta, detalle y pestañas del detalle |
| `workspace-audit.live.ts` | Mi consultorio a fondo |

### 9.3 Antes de dar por terminado un cambio

`pnpm typecheck`, `pnpm lint` sobre lo tocado, `pnpm i18n:check`, `pnpm test:voice` (solo), y si cambia algo de la pantalla real, la matriz de esas pantallas. Después `pnpm test:voice:examples` y `pnpm test:voice:catalog` para los catálogos.

## 10. Cómo sumar voz a una pantalla nueva

1. **¿Hace falta?** Si la pantalla usa la tabla común y formularios normales, ya tiene voz (tablas + genérica). Probar con la matriz (`VOICE_MATRIX_ROUTES=/la-ruta`) antes de escribir nada.
2. **Nombres**: cada control tiene que tener un nombre que se lea (texto, `aria-label`, etiqueta). `controls-audit.live.ts` muestra lo que queda sin nombre.
3. **Voz propia** (si la pantalla tiene acciones que no son botones a la vista o lecturas propias):
   - Un puente con `useVoiceBridge('clave', { estado, acciones })`: la voz nunca toca el estado de la página, llama a sus funciones.
   - El módulo: `useVoiceScreen(['modulo'])` en el componente y su línea en `ROUTE_VOICE_DOMAINS` (`nav-targets.ts`) para seguir el pedido después de navegar.
   - Los comandos en `src/lib/voice/commands/<modulo>.ts` (`registerVoiceDomain`, `registerVoiceCommand` con `match` local, `run`, prioridad y banderas) y su import en `commands/index.ts`.
   - Si necesita IA: su entrada en `VOICE_DOMAINS` del generador de n8n y `ai.from` en los comandos ([voz-patron-hibrido.md](voz-patron-hibrido.md)).
4. **Textos** en `es.json`, `es-ES.json` (tú) y `en.json` bajo `VoiceCommands.*`; `pnpm i18n:check`.
5. **Pruebas**: su pantalla simulada en `e2e/tests/voice-agent/sim/`, un archivo `NN-<area>.spec.ts` en español e inglés (sumarlo a `scripts/voice-test-areas.mjs`), y la pantalla en la matriz en vivo.
6. **Documentos**: una fila en [voz-app-progreso.md](voz-app-progreso.md), su sección en este documento y los catálogos regenerados.

## 11. Pendiente y no cubierto

### 11.1 Páginas que ninguna prueba en la app real recorrió

Son las marcadas **—** en la tabla de §8. Todas tienen la voz general (menú, riel, botones, campos, listas, ayuda, IA de la pantalla) y algunas la de sus tablas o documentos, pero no se probaron por voz en la app real:

| Página | Ruta | Qué falta |
| --- | --- | --- |
| Pantalla TV | `/tv-display` | Es una pantalla para la sala de espera; se maneja desde el riel («prendé la tele», «llamá al siguiente paciente»), pero la página en sí no se probó por voz |
| Estudios compartidos | `/shared-studies` | Sin prueba en vivo ni en el simulador |
| Órdenes (Ventas) | `/sales/orders` | Tiene las tablas de documentos (voz de documentos), pero no está en la matriz ni en el humo |
| Órdenes de Compra | `/purchases/orders` | Igual que Órdenes de Ventas |
| Suscripciones | `/subscriptions` | Tiene la tabla común; no se probó en vivo |
| 20 reportes | `/reports/*` salvo Cierre de Caja, Cobros del Día y Deudores | Tienen la voz de los reportes por sus piezas comunes (probadas en el simulador y en esos 3 en vivo), pero no se recorrieron uno por uno |

### 11.2 Páginas probadas en vivo solo en parte

| Página | Qué se probó | Qué falta |
| --- | --- | --- |
| Panel de control `/` | Humo (período, actualizar), simulador completo | La matriz no la recorre (no es una lista) |
| Mi consultorio `/workspace` | Humo, auditoría, grabación, simulador completo | La matriz no la recorre; guardar la sesión clínica por voz solo se probó a mano (fila 37 del avance) |
| Agenda `/appointments` | Humo (vistas, días), grabación, simulador completo (≈1300 casos) | La matriz no la recorre; crear, mover y borrar citas en vivo solo a mano |
| Caja `/cashier` | Humo («qué cajas hay»), simulador completo | Apertura, conteo y cierre de caja nunca en vivo (guardan) |
| Configuración de alertas, Métricas del asistente, Importar datos, Licencias (`/system/alerts-config`, `/system/help-insights`, `/system/import`, `/system/licenses`) | Barrido y auditoría de controles | No están en la matriz |
| Reportes (`/reports/*`, 23) | Humo en 3 (cobros del día, cierre de caja, deudores); el resto por sus piezas comunes en el simulador | Los otros 20 no se recorrieron en vivo |
| Ficha del paciente (pestañas: historia clínica, odontograma, archivos) | Estado de cuenta en vivo; acciones de la ficha en el simulador | Las pestañas de historia y archivos no se recorrieron en vivo |

### 11.3 Lo que la voz todavía no hace

- **Editar el odontograma pieza por pieza por voz**: solo a través del agente clínico («abrí el odontograma y marcá caries en el 16»), no con comandos propios del odontograma.
- **Visor de estudios (imágenes, DICOM)**: solo la voz genérica sobre sus botones.
- **Asistente guiado (guías de ayuda)**: no se abren guías por voz.
- **Reasignar citas en lote** desde la agenda: quedó como fase 2 en [voz-agenda.md §3.7](voz-agenda.md).

### 11.4 Lo que falta probar

- **En la matriz en vivo** no se recorren todavía: páginas («siguiente página», «10 por página»; sí en el humo en Medicamentos y Facturas), desplazarse, elegir por ID o código, «¿cuál de estos?» con varios, «¿te referís a…?» y la IA de la pantalla, el menú y el riel pedidos desde cada pantalla, y frases con varios pedidos.
- **Guardar** por voz solo se probó en vivo en algunos flujos (horario, disponibilidad, cita, sesión clínica, odontograma por dictado, color de una fila); la matriz nunca guarda porque DEV es compartido.
- **`es-ES`** solo se prueba en el simulador; la matriz en vivo corre en `es` y `en`.
- **Lo que marca (IA)** se prueba con la respuesta del modelo simulada: en la app real depende de lo que conteste el modelo del flujo de n8n.
- **Frases para retomar y cancelar** («sigamos», «en qué estábamos», «stop»…) se prueban en el intérprete (`01-wake`), no dichas en una conversación completa con una tarea a medias; retomar al prender Voz de nuevo sí está probado de punta a punta.
- **Navegadores**: solo Chrome y Edge tienen el reconocimiento de voz que se usa; Safari y Firefox no se probaron.

### 11.5 Cierre técnico pendiente

- `pnpm lint` falla con 57 errores de reglas de React Compiler en archivos que la voz no tocó (la agenda, `use-deep-link`, el chat del doctor, otros); lo de voz pasa limpio.
- La rama `feat/calendar-voice-commands` no tiene todavía su PR a `main`.
- La promo de voz (`videos/promo-voice/out/`) está armada con la intro (es 104,5 s, en 97,3 s) y espera aprobación.
