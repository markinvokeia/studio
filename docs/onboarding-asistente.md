# Asistente guiado y base de conocimiento

Implementación del plan *Onboarding guiado y base de conocimiento de Invoke IA*
(oct 2026). Un asistente con la forma del logo guía el onboarding, responde
dudas llevando a la pantalla exacta y ejecuta guías paso a paso: abre
diálogos, llena campos con lo dictado y **siempre deja el OK final a la
persona**.

Todo sale de una sola fuente: el **mapa del producto** (catálogo), versionado en
este repo y publicado en la BD de cada cliente.

```
 código (src/) ──┐
                 ├─► scripts/knowledge/build-catalog.mjs ─► src/generated/help-catalog.json
 knowledge/ ─────┘        (pre-commit)                         │
                                                               ├─► asistente (frontend, lazy)
                                                               ├─► e2e/utils/help.ts (tests, videos)
                                                               └─► POST /help/catalog/sync ─► help_catalog_items (BD del cliente)
                                                                                                │
                                         POST /help/assistant/chat ◄── búsqueda + OpenAI ◄──────┘
```

## Piezas

| Pieza | Dónde |
| --- | --- |
| Convención de help ids | `src/lib/help/help-id.ts` |
| IDs automáticos en primitivas | `src/components/ui/{form,button,tabs,data-table-toolbar,vertical-tab-strip}.tsx`, `src/components/sidebar.tsx` |
| Scope por ruta | `HelpScopeProvider` en `src/components/auth/PrivateRoute.tsx` |
| Fichas, guías y recorrido | `knowledge/screens/`, `knowledge/use-cases/`, `knowledge/onboarding/journey.json` |
| Extractor | `scripts/knowledge/build-catalog.mjs` → `src/generated/help-catalog.json` |
| Asistente (UI) | `src/components/help/` (`help-assistant.tsx` es la raíz) |
| Motor de guías | `src/lib/help/guide-engine.ts` (DOM) + `guide-runner.ts` (secuencia) |
| Estado | `src/stores/help-assistant-store.ts` |
| API | `src/services/help-assistant.ts`, `API_ROUTES.HELP` |
| BD | `database/scripts/140_20261023_help-assistant-and-onboarding.sql` |
| n8n | `scripts/n8n/generate-help-workflows.mjs` → `n8n-workflows/help-*.json` |
| Tests | `e2e/utils/help.ts`, `e2e/tests/help/help-guides.spec.ts` |

## Help ids

Formato `<scope>.<kind>.<name>`:

- **scope**: la ruta sin locale con `/` → `.` (`/config/sedes` → `config.sedes`, `/` → `dashboard`).
- **kind**: `field` · `btn` · `tab` · `filter` · `nav` · `section`.
- **name**: el `name` del `FormField`, el `value` del tab o un nombre fijo.

Se ponen **solos** como `data-help-id`, sin tocar las páginas:

| Elemento | Help id |
| --- | --- |
| `FormField name="x"` (control) | `<scope>.field.x` (y `data-help-item` en el `FormItem`) |
| `Button type="submit"` | `<scope>.btn.submit` |
| Crear / Refrescar / Buscar del `DataTable` | `<scope>.btn.new`, `<scope>.btn.refresh`, `<scope>.filter.search` |
| `TabsTrigger value="x"`, `VerticalTabStrip` | `<scope>.tab.x` |
| Menú | `nav.config.sedes`, `nav.group.BusinessSetup` |

Cuando hace falta un id a mano (inputs que no son de React Hook Form, botones
que no son submit) se escribe el literal: `data-help-id="config.clinics.btn.save"`.
El extractor sólo lee literales.

Si un componente se monta en muchas pantallas o hay dos formularios con los
mismos campos en la misma pantalla, envolverlo en
`<HelpScopeProvider scope="config.clinics.sede">` (ver `config/clinics/page.tsx`).

**Un help id publicado no se renombra.** Si cambia, las guías que lo usan
fallan en `pnpm knowledge:check` y en el test E2E de guías.

## Catálogo

`pnpm knowledge:build` recorre:

- `src/config/nav.ts` (menú, permisos) y `src/constants/permissions.ts` (los ~450 permisos con su JSDoc),
- cada `page.tsx` de `src/app/[locale]` y sus imports locales de `src/components` (un nivel),
- `es.json` para las etiquetas visibles,

y une todo con las fichas redactadas:

- `knowledge/screens/<scope>.json`: `summary`, `purpose`, `prerequisites`, `tips`,
  `useCases`, `elements` (descripción por help id), `ignoreElements` (para lo que
  el extractor atribuye mal) y `status` (`draft` → `validated` cuando soporte lo revisa).
- `knowledge/use-cases/<id>.json`: las guías. Cada paso es `navigate | click |
  fill | highlight | confirm | wait`. `fill` admite `{{values.x}}` con lo dictado;
  `inputs` documenta qué datos puede extraer el agente. El paso que guarda
  **siempre** es `confirm`.
- `knowledge/onboarding/journey.json`: el recorrido. Cada `id` es una clave de
  `help_onboarding_compute()` (al agregar un paso, agregarlo en las dos partes).

Validaciones (`pnpm knowledge:check`, falla el commit): rutas y help ids de cada
guía existen, casos de uso del journey y de las fichas existen, y el archivo
generado está al día. `pnpm knowledge:strict` además exige ficha para cada
pantalla del menú (para el job nocturno cuando la cobertura llegue al 100%).

### En cada commit

`pnpm install` configura `core.hooksPath=.githooks`. El `pre-commit`:

1. si el commit toca `src/`, `knowledge/` o `scripts/knowledge/`, regenera el
   catálogo y lo suma al commit; si una guía quedó apuntando a algo que ya no
   existe, el commit falla;
2. si cambió el generador de workflows del asistente, regenera `n8n-workflows/help-*.json`.

Después, cada frontend desplegado trae su catálogo. La primera vez que entra
alguien con `HELP_CATALOG_SYNC`, el asistente compara la versión (hash del
contenido) con `GET /help/catalog/version` y, si difiere, la publica con
`POST /help/catalog/sync`. Lo que ya no está queda `stale`. Así cada cliente
tiene la base de conocimiento de *su* versión del frontend, sin secretos de CI.

## Asistente (UI)

- **Mascota** (`src/components/invoke-mascot`, librería de Claude Design: ver su
  README y `CLAUDE_CODE_INTEGRATION.md`). La monta `src/components/help/mascot-host.tsx`
  en el layout autenticado (sólo con `HELP_ASSISTANT_USE`) y la conecta:
  - **Lanzador**: hacerle clic abre el chat justo encima de ella (si duerme, se
    despierta; si está escondida, sale) y saluda; con el chat abierto y sin que nadie
    escriba, cada 11 s hace un gesto invitando a pedirle algo. Avisa una vez por sesión
    cuántos pasos obligatorios faltan (sin abrir nada).
  - **Escondite**: tras 45 s sin uso se mete detrás del riel derecho del header
    (`MascotPeekZone edge="left"`; el riel tiene fondo opaco y nada lo recorta) y se
    asoma de costado en distintas alturas.
  - **Sueño**: tras 3 h sin pedidos (o con "Mostrar asistente animado" apagado en
    Preferencias → `users/preferences.show_mascot`) bosteza y se duerme.
  - **Cambio de página**: cruza al otro lado (`teleport`), salvo durante una guía, con
    el chat abierto o si la persona ya eligió su lugar; al cerrar vuelve a su lugar.
  - **Arrastrar**: en reposo (sin guía ni chat) se arrastra a cualquier lugar, que queda
    guardado en el navegador (`useMascotHome`). Soltada en el 25 % derecho se esconde
    detrás del riel; en el izquierdo, detrás del menú (`sidebar.tsx`); si no, arriba o
    abajo, detrás del panel del contenido (`PrivateRoute`, `MascotPeekZone name="content"
    edge="auto"`). Se asoma justo donde la dejaron.
  - **Iconos al tocarla**: junto al chat salen silenciar la voz y esconderla. Escondida
    (o con "Mostrar asistente animado" apagado) no está en pantalla y en el riel queda
    su ícono dormido (`MascotWakeButton`): un clic y se levanta.
  - **Globo**: va arriba; si no entra completo (cerca del tope), a un costado o abajo,
    sin tapar el elemento señalado ni la barra de pasos.
  - **Ficha de la pantalla con "Mostrar"**: la ventana deja de seguir a la mascota y va
    a una esquina que no tape el elemento, la mascota ni la barra.
  - **Chat**: "pensando" al enviar, "cargando" si tarda, contenta o una frase corta
    al responder, triste ante un error o una pregunta sin ayuda, asiente al pedir video.
  - **Guías**: viaja junto al elemento (`placeGuideMascot`, sin pisar la barra de
    pasos) y lo señala con `pointAt(…, { duration: Infinity, signal, say })` hasta que
    el paso cambia; el texto del paso (título, descripción, `details`) sale en su
    propio globo. En el último paso festeja ("¡Listo!…") y la guía se cierra sola a
    los 3,2 s; si un paso falla, triste y explica por qué. Un toast destructivo en
    cualquier pantalla también la pone triste. Mientras algo carga (la guía esperando
    una pantalla o un elemento, o un link del menú que tarda) pone cara de cargando.
    Durante la guía su capa va por encima de diálogos; en reposo, debajo (z 45).
  - Borde del elemento señalado: **violeta**; **rojo** si es obligatorio y falta o si
    el campo tiene error (`aria-invalid` / mensaje de validación).
- **Chat** (`help-assistant.tsx` + `help-chat.tsx`): una sola ventana, anclada
  encima de la mascota, con el estilo de sus globos. Sin pestañas: arranca con un
  saludo, los atajos y ejemplos de pedidos. **Se oculta mientras hay una guía**
  (al empezar una guía el chat se cierra): lo principal es la mascota yendo de un
  elemento a otro.
  - **Puesta en marcha**: atajo que sólo aparece si falta algún paso del journey;
    abre la checklist (cada paso se marca solo mirando la BD; "Llevarme y guiarme"
    en todos, "Omitir" con `HELP_ONBOARDING_MANAGE`).
  - **Guíame en esta pantalla**: siempre presente, destacado si llegaste a una
    pantalla nueva desde la última vez que abriste el chat. Abre la ficha de la
    ruta actual: recorrido completo (`screenTour`), sus guías y cada elemento con
    "Mostrar".
  - Preguntas con dictado por voz (Web Speech API). Las guías son **predefinidas**:
    el agente nunca arma pasos, devuelve hasta 3 `useCaseIds` (la más parecida
    primero, preferentemente de la pantalla actual) y la respuesta las ofrece cada
    una con su "Guiarme", más "Llevarme" al link. Si el agente no propone ninguna,
    `resolveReplyActions` busca las guías de la pantalla más parecidas a la pregunta
    (`rankScreenUseCases`). Video (Fase 3) y 👍/👎. Sin backend, búsqueda local.
  - Al cerrar una guía (o al terminar) se vuelve a la vista del asistente desde la
    que se abrió (`returnTo`): el chat con la conversación, la ficha de la pantalla
    o la checklist.
  - **Mascota visible** (Configuración → Preferencias de Clínica → Asistente guiado,
    `system_configurations.help_mascot_visible`, script 142; lo lee cualquiera con
    `GET /help/settings`). Apagada, las guías muestran igual el resaltado, la
    descripción del paso en un globo propio junto al elemento, la barra y la lista
    de pasos, sin mascota; al asistente se entra por el ícono **?** del riel
    (`MascotWakeButton`). Prendida y escondida por la persona, en el riel queda la
    mascota dormida.
  - **Voz**: la mascota lee cada respuesta en voz alta (`speechSynthesis` del
    navegador, `src/hooks/use-assistant-voice.ts`) con cara de "hablando" y, si la
    respuesta arranca una guía, la guía empieza al terminar de leer. Se silencia con
    el parlante del encabezado (queda guardado en este navegador); cada respuesta
    tiene "Escuchar" / "Dejar de leer". Dictar, empezar una guía o cerrar el chat
    corta la lectura.

### Guías

`startGuide()` ejecuta solos los pasos que preparan la pantalla (navegar, abrir
el diálogo, esperar) y se detiene en el primer campo o botón que hay que mirar;
si lo completó con datos dictados, lo deja señalado hasta "Siguiente". Con datos
dictados (`values`), "Completarlo por mí" corre todo hasta el primer `confirm`.

El spotlight (`guide-spotlight.tsx`) oscurece la pantalla y marca el elemento con
un borde que **titila cada vez más fuerte** (`--help-level` sube de 1 a 5 cada
2,5 s). Quien señala es la mascota, y lo que hay que hacer lo dice en su globo:
título, descripción y el `details` del paso (qué cambia según lo que elijas; si la
guía no lo trae, el extractor usa la descripción del elemento en su ficha).
Debajo del elemento (si no entra, al costado de la mascota; nunca debajo de ella) queda
una barra mínima, sólo con iconos: **Paso X/Y** (un
punto si es obligatorio, rojo si falta), ir al primero, anterior, siguiente (✓ en
un `confirm`: "ya lo hice"), saltar el actual, ir al final y cerrar
(`goToStep`, `previousStep`, `nextStep`, `skipStep`, `lastStep`, `stopGuide`).
Si un paso falla, la barra queda abajo al centro con reintentar, saltar y cerrar.
Junto a la barra (abajo si entra, si no arriba) va la **lista de pasos** con su
estado (hecho, actual, pendiente, saltado; "te toca" en los que hace la persona),
que se pliega con el ícono de lista; tocar un paso lleva a ese paso.

Pasos especiales (ver la skill `help-catalog`):
- `navigate` va por el **menú lateral** como la persona: la mascota señala el menú,
  se despliega el submenú y pulsa el ítem, en un solo paso ("Menú → Submenú"). Sin
  menú a la vista (mobile, permiso) navega directo.
- `until` / `blocking`: pasos que hace la persona (clic derecho en un turno, elegir
  un registro real). Siguen solos cuando aparece lo que abren; mientras tanto
  "Siguiente", "Saltar" e "Ir al final" están deshabilitados.
- `doneOnClose`: una opción de menú se da por hecha al cerrarse el menú.
- `target` con `{{values.x}}`: en pruebas y videos elige la opción del dato; sin el
  dato el paso se salta y el siguiente pide elegir.
- `click` pulsa como una persona (pointerdown → mousedown → pointerup → mouseup →
  click): los menús de Radix abren en pointerdown.
- `fill` en selectores con lista (profesional, consultorio, servicios, paciente):
  abre la lista y elige por texto; si no está a la vista y la lista tiene buscador
  (pacientes, búsqueda en el servidor) escribe lo dictado y espera los resultados.
  En fechas con máscara pasa `AAAA-MM-DD` a `dd/mm/aaaa` y confirma al salir del campo.
  Sólo cierra la lista con Escape si sigue abierta: un Escape de más le llega a la
  tarjeta o al diálogo, que preguntan "¿Descartar cambios?".
- Mientras guía, la mascota no captura clics (`interactive={false}`): clic derecho y
  arrastre llegan a la pantalla aunque esté encima del elemento.
- Una opción dentro de un menú (contextual, select) se señala desde afuera del menú, y
  la barra y la lista de pasos se ubican alrededor del menú entero.

Cobertura por pantalla (todas probadas en la app real, sin guardar en DEV):
- **Panel de Control**: `dashboard.overview`, `dashboard.filters`.
- **Citas** (`/appointments`): agendar (botón Crear, en un horario libre, desde un
  hueco), cambiar estado, cancelar con motivo, editar, mover / duración, cambiar
  profesional o consultorio, eliminar, ver la ficha del paciente desde la cita,
  buscar una cita, recordatorios y notas, moverse por la agenda, reasignar en lote.
  También la vista por defecto (modo, vista, agrupación, sede, tamaño, slots, formato,
  días ocultos, color por estado) y las reglas al agendar, en Ajustes de la agenda.
- **Mi Consultorio** (`/workspace`): usar la pantalla, ver otro día/período/calendario,
  completar la sesión clínica, recetar, odontograma y agente clínico con IA.
- **Centro de Alertas** (`/alerts`): usar la pantalla, filtrar, registrar llamada,
  pausar, ignorar, agregar nota, WhatsApp, correo, marcar resueltas y trabajar en lote.
  Las acciones que se ejecutan al tocarlas (WhatsApp, completar) son `confirm`: la guía
  sólo las señala y explica.

- **Caja** (las 5 pantallas): abrir y cerrar la caja (cada una cubre el otro estado: abrir
  con la caja abierta guía primero el cierre, cerrar con la caja cerrada guía primero la
  apertura), ver la caja abierta, gasto e ingreso varios con ejemplos (si la caja está
  cerrada, primero la abre), ver/editar movimientos, categorías, historial de sesiones y
  cajas físicas.
- **Pacientes** (`/patients`, 27 guías agrupadas por pestaña con `group`): *Listado y
  alta* (buscar y filtrar, registrar, recorrer la ficha); *Información* (recorrido de la
  pestaña, editar datos, notas, preferencias); *Historia clínica* (recorrido, anamnesis,
  línea de tiempo, sesión clínica, odontograma, planes, receta, indicación, documentos);
  *Finanzas* (cuenta en sus dos vistas, cobro rápido, presupuesto, factura, prepago);
  *Agenda y comunicación* (cita, email, WhatsApp, recordatorio); *Estado* (alta /
  readmitir, activar / desactivar). Toda guía de ficha arranca buscando al paciente y
  espera a que la persona abra su ficha. Readmitir y Activar/Desactivar se aplican al
  tocarlos: son `confirm`.
- **Ventas y Compras** (Presupuestos, Facturas y Pagos, en paralelo: la misma guía en las
  dos, aterrizada a paciente o proveedor; se generan juntas). Presupuestos: recorrer, crear,
  editar borrador, confirmar/rechazar, facturar, imprimir/enviar, eliminar, ítems, exportar.
  Facturas: recorrer, crear, confirmar, cobrar/pagar, imprimir/enviar, ítems, notas de
  crédito, exportar (+ importar en compras). Pagos: recorrer, prepago/anticipo,
  imprimir/enviar recibo, corregir medio de pago, exportar. «Facturar» en compras factura
  al tocarlo: es `confirm`.
- **Configuración de Negocio** (20 pantallas, 65 guías): en los listados (sedes, horarios,
  excepciones, calendarios, disponibilidad, excepciones de disponibilidad, secuencias,
  mutualistas, grupos, plantillas de indicación y receta) recorrer, crear, editar y
  eliminar (la baja confirma en `<scope>.btn.confirm-action` del `ConfirmActionDialog`);
  doctores y personal: recorrer la ficha con sus pestañas, alta, edición y contraseña
  inicial (se envía al tocarla: `confirm`); pantallas de ajustes (preferencias, portal,
  colores, plantillas de impresión, datos de la clínica, tipo de cambio): recorrido por
  sección y guardar. Catálogo de la Clínica va al final, después de Pantalla TV.
- **Ventas y Compras, resto**: Servicios y Productos de proveedores en paralelo (recorrer,
  crear, cambiar precio, eliminar; etapas de tratamientos en ventas), Métodos de pago, y
  Proveedores como la ficha del paciente (13 guías agrupadas: listado y alta, información,
  compras al proveedor, comunicación y estado).
- **Sistema** (19 pantallas, 43 guías): usuarios, roles y permisos (ficha con pestañas,
  alta, edición, baja, asignar roles y permisos, contraseña inicial); categorías, reglas
  (probar/duplicar) y plantillas de alertas, y configuraciones (CRUD); registros de acceso,
  auditoría, errores, historial y ejecuciones de alertas (consulta); ajustes de alertas,
  agente de WhatsApp, notificaciones, licencias, métricas del asistente, suscripciones e
  importación.
- **Reportes** (21): una guía por reporte (período, moneda, filtros propios, Generar,
  indicadores, resultados, detalle, exportar e imprimir). Los ids están en los componentes
  compartidos (`ReportShell`, `ReportKPICard`, `ReportDataTable`, `ReportExportActions`).
- **Panel de Control, grupos «Menú» y «Barra lateral»**: un recorrido del menú, un
  recorrido de la barra lateral, guías de detalle de la barra (paciente/sede/caja,
  TV/cobro, alertas/cambio/inbox/notas) y «Conocer <sección>» que entra a cada pantalla de
  la sección (tramos de hasta 6, según los separadores del menú). Sin guías de 1–2 pasos.
  La barra tiene ids globales `rail.*`; el contenido de cada pantalla, `app.section.page`.
- **Pantalla TV** (4) y **Catálogo de la Clínica** (16). Estudios y Estudios compartidos
  quedan sin cubrir por decisión del usuario.

Más reglas de ubicación: un botón que se repite en varias filas (acciones por alerta o
por cita) se señala en una fila donde esté habilitado; dentro de un diálogo, si la lista
de pasos taparía sus otros campos, va al costado del diálogo.

Ubicación (`src/lib/help/placement.ts`, todo `position: fixed`, sin tocar el
layout): la barra va abajo del elemento, si no arriba; la mascota va arriba
señalando hacia abajo, si no a un costado, si no abajo, sin pisar la barra. El scroll
sólo mueve contenedores desplazables: `scrollIntoView` corría también los
contenedores con overflow hidden y desarmaba banner y footer de los diálogos.

- `fill` usa el setter de React Hook Form que registra cada `FormControl`
  (funciona con Select, checkbox, PhoneInput…); para selects/comboboxes elige la
  opción por el texto dictado; si no puede, pide completarlo a mano.
- `confirm` nunca se pulsa solo: se espera el clic de la persona y la guía sigue.
- Avance automático: mientras un paso espera a la persona, la guía mira el
  elemento señalado. Un campo se da por hecho cuando cambia su valor (elegir una
  opción, marcar un check; si está escribiendo, espera una pausa de ~2 s); un
  botón, tab o sección, cuando lo pulsa. Abrir un desplegable no cuenta.
- Esperas largas: navegación hasta 90 s (reintenta a los 12 s) y elementos hasta
  30 s, con aviso "Abriendo la pantalla…": en desarrollo Next compila cada
  pantalla la primera vez.
- La agenda crea citas en un diálogo (`AppointmentFormDialog`) o en la tarjeta
  inline (`inline-appointment-draft.tsx`, modo personalizado). Los dos usan los
  mismos help ids (`appointments.field.*`, `appointments.btn.save`), así la misma
  guía sirve en cualquier modo. Un componente nuevo que repita un formulario
  existente debe reutilizar sus ids.
- `ChunkLoadError` (el navegador pide un chunk que ya no existe: en desarrollo,
  Next descartó la pantalla; en producción, hubo un deploy) lo atrapa
  `src/app/[locale]/error.tsx` y recarga la página una vez. En desarrollo
  `next.config.ts` (`onDemandEntries`) mantiene compiladas 30 pantallas por 30 min.
- Los clics en el asistente y en la barra de pasos no cierran el diálogo de Radix que
  está debajo (se corta el `pointerdown`). Limitación conocida: con un diálogo
  modal abierto no se puede escribir en el chat (el diálogo atrapa el foco); las
  guías se manejan con botones y funcionan.

## Backend

### BD (scripts 140 y 141)

| Objeto | Para qué |
| --- | --- |
| `help_catalog_items` | Catálogo publicado. FTS en español sobre `search_text` (sin tildes). `embedding vector(1536)` (text-embedding-3-small) sólo si el servidor tiene pgvector (la imagen `postgres:17` oficial no lo trae). |
| `help_catalog_syncs` | Historial de publicaciones (la última es la versión vigente). |
| `onboarding_progress` | Primera vez que se cumplió cada paso (métrica "tiempo hasta el mínimo"), omitidos y notas del implementador. |
| `help_onboarding_compute()` | Estado de cada paso desde los datos reales. |
| `help_questions` | Cada pregunta con respuesta, confianza, escalado y 👍/👎. `resolution_status='open'` = cola para completar el catálogo. Es la línea base de soporte. |
| `help_videos` | Videos por caso de uso (Fase 3). |
| Permisos | `HELP_ASSISTANT_USE` (todo el staff), `HELP_ONBOARDING_VIEW`, `HELP_ONBOARDING_MANAGE`, `HELP_CATALOG_SYNC` (administrador y gerente). |

### Workflows

Generados por `pnpm n8n:help` (no editar los JSON):

| Webhook | Workflow |
| --- | --- |
| `GET help/onboarding/status` | `help-onboarding-status.json` |
| `POST help/onboarding/progress` | `help-onboarding-progress.json` |
| `GET help/catalog/version` | `help-catalog-version.json` |
| `POST help/catalog/sync` | `help-catalog-sync.json` |
| `POST help/assistant/chat` | `help-assistant-chat.json` |
| `POST help/assistant/feedback` | `help-assistant-feedback.json` |
| `POST help/videos/request` | `help-video-request.json` |
| `POST help/videos/queue` | `help-video-queue.json` (worker) |
| `POST help/videos/register` | `help-video-register.json` (publicar / fallido / desactualizado) |
| `GET help/insights` | `help-insights.json` |
| `POST help/support/update` | `help-support-update.json` |

El chat es RAG sin herramientas: búsqueda full-text → prompt con fichas,
pantalla actual, **elementos visibles** (los manda el frontend), casos de uso y
pasos pendientes → OpenAI (`gpt-6-luna`, constante `OPENAI_MODEL` del generador) → un nodo valida contra la **lista cerrada** (rutas y
casos de uso del catálogo, help ids del catálogo o visibles) y descarta lo que
no exista. El asistente no puede inventar una ruta ni un paso.

### Videos demo (Fase 3)

Cada guía del catálogo se graba ejecutada por el asistente real (la mascota
señalando, la burbuja con el detalle), se narra y se publica:

```
pnpm videos:record    # e2e/videos/record.video.ts (proyecto help-videos de Playwright)
pnpm videos:build     # scripts/videos/build-videos.mjs: narración + subtítulos + logo
pnpm videos:publish   # scripts/videos/publish-videos.mjs: GCS + POST help/videos/register
pnpm videos:worker    # video a demanda: procesa los pedidos del chat ("Pedir video")
```

| Variable | Para qué |
| --- | --- |
| `HELP_VIDEO_DEMO_TENANT=1` + `E2E_BASE_URL` | Obligatorio para grabar: sólo contra el tenant demo (datos sintéticos de `e2e/videos/demo-values.ts`). |
| `HELP_VIDEO_USE_CASES` | Casos a grabar/armar/publicar (por defecto, todos). |
| `HELP_VIDEO_CONFIRM=1` | Pulsa el OK al final (crea los datos en el demo). |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL` | Narración (caché por texto en `videos/cache`). Sin clave, sale sin voz. |
| `HELP_VIDEOS_BUCKET` | Bucket de GCS (`gcloud` autenticado; el bucket necesita CORS para los subtítulos). Sin bucket va a `public/help-videos/` (sólo desarrollo). |
| `HELP_API_URL`, `HELP_API_TOKEN` | n8n del cliente y JWT de un usuario técnico con `HELP_CATALOG_SYNC` (registro, cola, job nocturno). |

El grabador maneja la guía por `window.__invokeHelp`, que el asistente expone
sólo con `localStorage['invoke-help:automation'] = '1'`. Los subtítulos siempre
salen como `.vtt` (los muestra el reproductor del chat) y como pista del mp4; si
el ffmpeg tiene libass, además se queman en la imagen. `videos/` no se versiona.

### Soporte y métricas (Fase 4)

- Toda pregunta escalada (baja confianza, error del sistema o pedido de una
  persona) abre un ticket en `help_support_tickets` con la pantalla y el
  contexto; prioridad alta si el agente lo marca como error del sistema.
- **Sistema → Métricas del Asistente** (`/system/help-insights`,
  `HELP_INSIGHTS_VIEW`): preguntas por semana, % resuelto por el asistente
  (meta 85%), escaladas en fin de semana (meta: sólo críticas), pantallas con
  más dudas, cola de preguntas sin resolver, tickets, estado del catálogo, videos
  y onboarding.
- Esquema de la BD en el catálogo: cada `POST help/catalog/sync` llama a
  `help_refresh_schema_items()`, que vuelca tablas, columnas, FKs y `COMMENT ON`
  a `help_catalog_items` (kind `table`). Nunca viaja al navegador. El
  significado de negocio sale de los comentarios de las migraciones.
- `pnpm knowledge:nightly` (cron del servidor de QA): cobertura estricta +
  regresión de guías; las guías rotas marcan su video como desactualizado.

### Despliegue

1. Aplicar `140_20261023_help-assistant-and-onboarding.sql` y `141_20261023_help-schema-videos-support.sql`.
2. Importar `n8n-workflows/help-*.json` (11 workflows) y activarlos. Ya traen las credenciales compartidas: "JWT Auth account" en los Webhooks (el token se valida en n8n y el usuario sale de `jwtPayload.userId`), "Postgres account" en los nodos Postgres y "OpenAi account 2" en el nodo "OpenAI" del chat.
3. Desplegar el frontend. Al entrar un administrador, el catálogo se publica solo.

Sin el script nadie tiene `HELP_ASSISTANT_USE` y el asistente no aparece.

## Fases

| Fase | Estado |
| --- | --- |
| 1 · Mapa del producto | IDs automáticos en toda la app; 96 pantallas, ~810 elementos, 456 permisos; **ficha en el 100% del menú** (`draft`, falta la validación de soporte); esquema de la BD documentado en cada sync; `knowledge:strict` en el job nocturno. **Falta**: validar fichas (`validated`), comentarios de negocio en las tablas principales, embeddings (requiere pgvector en el servidor). |
| 2 · Asistente de onboarding | Checklist derivada de datos con "Llevarme y guiarme" en los 12 pasos; guías con la mascota señalando, detalle y obligatorio/opcional; chat con dictado que siempre ofrece guiar y llevar; ayuda contextual con recorrido de pantalla; modo implementador. **Falta**: probar con dos clínicas nuevas; modo multitenant. |
| 3 · Tests y videos | Regresión de guías; grabación de la guía real, narración ElevenLabs, subtítulos y logo; publicación en GCS + registro; video a demanda con cola y worker; videos desactualizados por el job nocturno. **Falta**: levantar el tenant demo, elegir la voz y el bucket, correr la primera tanda de los 13 casos (y llegar a 30). |
| 4 · Soporte automático | Tickets al escalar, cola de preguntas sin resolver, panel de métricas, job nocturno. **Falta**: canal WhatsApp (YCloud) con el mismo agente, aviso a soporte por ticket crítico. |
