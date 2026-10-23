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

- **Mascota**: el logo de Invoke (mismos degradés, sin las letras) con ojitos,
  sonrisa y manitas que giran alrededor del cuerpo para señalar en cualquier
  dirección. Estados: `idle`, `waving`, `thinking`, `pointing`, `happy` y `sad`
  (paso fallido o pregunta sin ayuda: cejitas caídas y lagrimita).
- **Lanzador** (`mascot-launcher.tsx`): en reposo la mascota se asoma de detrás
  del riel derecho del header (`data-help-rail`; si está colapsado, del borde),
  mira hacia la pantalla, saluda con la mano visible y vuelve. Badge con los pasos
  obligatorios pendientes. Se abre sola una vez por sesión si la clínica no llegó
  al mínimo operativo.
- **Guiar siempre a mano**: la checklist tiene "Llevarme y guiarme" en todos los
  pasos; cada respuesta del chat trae "Guiarme" y "Llevarme"
  (`resolveReplyActions` completa lo que el agente no devolvió: la guía de la
  pantalla del link o un recorrido de la pantalla); "Esta pantalla" tiene
  "Guiarme por esta pantalla" (`screenTour`) además de sus guías.
- **Puesta en marcha**: checklist del journey. Cada paso se marca solo, mirando
  la BD. "Guiarme", "Llevarme ahí" y, con `HELP_ONBOARDING_MANAGE`, "Omitir".
- **Ayuda**: chat con dictado por voz (Web Speech API). Las respuestas traen
  "Guiarme" / "Completarlo por mí", "Llevarme a …", video (Fase 3) y 👍/👎. Si
  el backend no responde, cae a búsqueda local en el catálogo.
- **Esta pantalla**: la ficha de la ruta actual, con "Mostrar" para resaltar cada campo.

### Guías

`startGuide()` ejecuta solos los pasos que preparan la pantalla (navegar, abrir
el diálogo, esperar) y se detiene en el primer campo o botón que hay que mirar;
si lo completó con datos dictados, lo deja señalado ("Lo completé") hasta
"Siguiente". La lista de pasos queda en un panel compacto que cambia de esquina
para no tapar el elemento resaltado. Quien señala es la propia mascota: se ubica
junto al elemento, lo mira y apunta con su manita al punto más cercano. Con datos dictados (`values`), "Completarlo por mí" corre todo hasta el
primer `confirm`. El spotlight oscurece la pantalla, marca el elemento con un
borde que **titila cada vez más fuerte** (`--help-level` sube de 1 a 5 cada
2,5 s), una **manito** lo señala y una burbuja explica qué hacer: título,
**Obligatorio/Opcional** (sale de `optional`) y el `details` del paso (qué
cambia según lo que elijas; si la guía no lo trae, el extractor usa la
descripción del elemento en su ficha).

Ubicación (`src/lib/help/placement.ts`, todo `position: fixed`, sin tocar el
layout): la burbuja va abajo del elemento, si no arriba, si no a un costado; la
manito va arriba apuntando hacia abajo, si no a un costado, si no abajo
apuntando hacia arriba, sin pisar la burbuja ni el panel de pasos. El scroll
sólo mueve contenedores desplazables: `scrollIntoView` corría también los
contenedores con overflow hidden y desarmaba banner y footer de los diálogos.

- `fill` usa el setter de React Hook Form que registra cada `FormControl`
  (funciona con Select, checkbox, PhoneInput…); para selects/comboboxes elige la
  opción por el texto dictado; si no puede, pide completarlo a mano.
- `confirm` nunca se pulsa solo: se espera el clic de la persona y la guía sigue.
- Los clics en el asistente y en la burbuja no cierran el diálogo de Radix que
  está debajo (se corta el `pointerdown`). Limitación conocida: con un diálogo
  modal abierto no se puede escribir en el chat (el diálogo atrapa el foco); las
  guías se manejan con botones y funcionan.

## Backend

### BD (script 140)

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

El chat es RAG sin herramientas: búsqueda full-text → prompt con fichas,
pantalla actual, **elementos visibles** (los manda el frontend), casos de uso y
pasos pendientes → OpenAI (`gpt-6-luna`, constante `OPENAI_MODEL` del generador) → un nodo valida contra la **lista cerrada** (rutas y
casos de uso del catálogo, help ids del catálogo o visibles) y descarta lo que
no exista. El asistente no puede inventar una ruta ni un paso.

### Despliegue

1. Aplicar `140_20261023_help-assistant-and-onboarding.sql`.
2. Importar `n8n-workflows/help-*.json` y activarlos. Ya traen las credenciales compartidas: "JWT Auth account" en los Webhooks (el token se valida en n8n y el usuario sale de `jwtPayload.userId`) y "Postgres account" en los nodos Postgres y "OpenAi account 2" en el nodo "OpenAI" del chat.
3. Desplegar el frontend. Al entrar un administrador, el catálogo se publica solo.

Sin el script nadie tiene `HELP_ASSISTANT_USE` y el asistente no aparece.

## Fases

| Fase | Estado |
| --- | --- |
| 1 · Mapa del producto | Base lista: IDs automáticos en toda la app, extractor, 95 pantallas / ~780 elementos / 455 permisos indexados, fichas redactadas del recorrido de onboarding. **Falta**: fichas del resto del menú (`knowledge:check` lista las que faltan), validación humana, esquema de BD documentado (exportar `information_schema` a `knowledge/db/`), embeddings. |
| 2 · Asistente de onboarding | Funcional: checklist derivada de datos, guías de los 9 pasos con formulario, chat con dictado, ayuda contextual, modo implementador (omitir/notas). **Falta**: probar con dos clínicas nuevas, notas del implementador en la UI, modo multitenant. |
| 3 · Tests y videos | Base: `runUseCase()` corre cualquier guía como test E2E (modo `demo` lento y resaltado para grabar) y `help-guides.spec.ts` es la regresión de guías. **Falta**: tenant demo con datos sintéticos, grabación + narración (ElevenLabs) + subtítulos (ffmpeg), carga en `help_videos`. |
| 4 · Soporte automático | Base: registro de preguntas, confianza, escalado y feedback. **Falta**: canal WhatsApp (YCloud) con el mismo agente, tickets de escalado, panel de métricas, job nocturno (`knowledge:strict` + suite de guías). |

Las respuestas mejoran solas a medida que se avanza: cada ficha nueva entra al
catálogo en el commit, cada guía nueva aparece en "Guiarme", y cuando un caso
de uso tenga video en `help_videos` el chat lo ofrece sin cambiar código.
