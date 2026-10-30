# Reporte de limpieza y organización del repositorio

**Fecha:** 2026-09-18
**Alcance:** revisión únicamente (sin cambios de código). Objetivo: identificar qué está "regado", duplicado o sin uso para poder limpiarlo/organizarlo en un siguiente paso.

---

## 0. Hallazgo crítico — requiere acción inmediata, no solo "limpieza"

### `.env.local` está commiteado en git con secretos reales

- `git ls-files` confirma que `.env.local` está trackeado (a diferencia de `.env`, que sí respeta `.gitignore`).
- El motivo es un bug en `.gitignore`: la regla `*.env` no matchea `.env.local` (el glob exige que el nombre *termine* en `.env`; `.env.local` termina en `.local`).
- El archivo contiene, en texto plano y en el historial de git desde el commit `9d9e257b` ("Tests automatizados con Playwright"):
  - `GOOGLE_GENAI_API_KEY=AIzaSyC...` (API key de Google GenAI real y funcional)
  - `E2E_USER` / `E2E_PASS` (credenciales de un usuario real de test)
  - `NEXT_PUBLIC_LICENSE_KEY`, `NEXT_PUBLIC_MASTER_SEC` (secretos del sistema de licencias)

**Recomendación (fuera del alcance de "solo reporte", pero urgente):**

1. Rotar la API key de Google GenAI y cualquier otro secreto de esa lista ya mismo — están expuestos en el historial aunque se borre el archivo hoy.
2. Agregar `.env.local` (y `.env*.local`) explícitamente a `.gitignore`.
3. Quitar el archivo del tracking (`git rm --cached .env.local`).
4. Evaluar reescribir el historial (`git filter-repo` / BFG) dado que es un repo compartido — coordinar con el equipo antes de hacerlo, ya que reescribir historial afecta a todos los clones.

---

## 1. Flujos de n8n: 3 ubicaciones distintas, sin criterio unificado

| Carpeta | Archivos | Commits que la tocan | Último commit | Convención de nombres |
| --- | --- | --- | --- | --- |
| `n8n-workflows/` (raíz del repo) | 25 archivos + subcarpetas `dashboard/`, `reports/` | 15 | 2026-09-17 | kebab-case, un flujo por endpoint |
| `docs/n8n-flows/` | ~67 archivos | 80 | 2026-09-18 (la más activa) | Mixta: `Title Case.json` (exports completos de un workflow) + `flow-kebab-case.json` (parches/fragmentos para copiar-pegar) |
| `docs/n8n-workflows/` | `README.md` + 1 archivo | 1 | 2026-09-17 | kebab-case + README documentando el endpoint |

Observaciones:

- Los nombres `n8n-workflows/` y `docs/n8n-workflows/` son casi idénticos pero son carpetas distintas con contenido no relacionado — alta probabilidad de que alguien guarde un archivo en el lugar equivocado.
- `docs/n8n-flows/` es, por volumen de commits, la ubicación "de facto" más usada y la más referenciada desde otros documentos (`patient-portal.md`, `reconciliacion-allocations-edicion.md`, `finalizado-manual-tratamiento.md`, `feature-acceso-calendarios-doctores.md`, etc.).
- `n8n-workflows/` (raíz) tiene subcarpetas (`dashboard/`, `reports/`) — es justo el patrón que se pidió evitar.
- `docs/n8n-workflows/README.md` tiene el mejor patrón de documentación (explica método/path del endpoint, query params, uso en frontend, pasos de import, SQL de referencia) pero solo se usó una vez y luego se abandonó.
- Dentro de `docs/n8n-flows/`: **`Agent_InvokeIA_Help_v2.json` no tiene ninguna referencia en todo el repo** y está confirmado como reemplazado por `Agent_InvokeIA_Help_v3.json` (referenciado explícitamente en `docs/patient-portal.md` y en `n8n-workflows/patient-ai-query.json`). Es basura segura de eliminar.

**Recomendación:** unificar en **una sola carpeta plana** (ej. `n8n/`), sin subcarpetas por feature (usar prefijos en el nombre de archivo en su lugar, como ya hace `docs/n8n-flows/flow-*`), y adoptar la convención de `docs/n8n-workflows/README.md` (un README por flujo, o un README índice) como estándar. Mover ahí el contenido de las tres carpetas actuales y borrar `Agent_InvokeIA_Help_v2.json`.

---

## 2. Documentación: falta una carpeta de documentación FUNCIONAL separada de planes técnicos

Catálogo completo de `docs/*.md` (excluyendo n8n):

| Archivo | Categoría | Estado real | Recomendación |
| --- | --- | --- | --- |
| `GUIA_USUARIO.md` | Funcional | vigente, genérico | Aclarar relación con `guia-uso-invoke-ia.md` (¿cuál es la guía oficial?) — probablemente fusionar |
| `guia-uso-invoke-ia.md` | Funcional (manual de usuario, ~2500 líneas) | vigente | Mover a `docs/funcional/` |
| `guia-uso-invoke-ia.docx` | Generado (vía `scripts/generate_guide.py` / `docs/style_docx.py` desde el `.md` de arriba) | derivado, 1.4 MB versionado en git | Sacar del control de versiones; regenerar como paso de release, no commitear el binario |
| `guia-administracion-licencias.md` | Funcional/técnica | vigente | Mover a `docs/funcional/` |
| `agente-ia-casos-de-uso.md` | Diseño de feature | vigente | Agrupar con el plan de implementación |
| `agente-ia-plan-implementacion.docx` | Plan (binario, generado por `scripts/generate_agent_plan.py`, sin `.md` fuente en el repo) | vigente | Convertir a `.md` para que sea diffable; agrupar en `docs/agente-ia/` |
| `blueprint.md` | Técnica (brief fundacional, ago-2025) | **obsoleto** | Archivar — ya no refleja el producto actual |
| `runtime-config.md` | Técnica (arquitectura) | vigente | Mover a `docs/tecnico/` |
| `i18n-overrides.md` | Técnica | vigente | Mover a `docs/tecnico/` |
| `ui-mapping.md` | Técnica (referencia viva, consumida por el agente n8n de ayuda) | vigente, activa | Mover a `docs/tecnico/`; validar que sigue cubriendo pantallas nuevas |
| `patient-ledger-cuenta-unificada.md` | Técnica (doc de un refactor ya hecho) | implementado | Mover a `docs/tecnico/` |
| `cobro-rapido-billing-wizard.md` | Técnica (referencia de módulo) | implementado | Mover a `docs/tecnico/` |
| `patient-portal.md` | Técnica (contrato de backend) | parcial — falta UI de administración | Mantener activo |
| `analisis-panel-control-gerencial.md` | Plan (análisis de brechas) | en progreso | Agrupar en `docs/panel-gerencial/` junto con la especificación y `.design/panel-gerencial/` |
| `panel-control-gerencial-especificacion-funcional.md` | Plan/Funcional | en progreso | Agrupar en `docs/panel-gerencial/` |
| `calendar-status-colors-plan.md` | Plan | en progreso (frontend listo, faltan 3 flujos n8n) | Mantener activo |
| `appointments-mejoras-plan.md` | Plan | parcial (checklist sin cerrar) | Mantener activo, aclarar qué fases se completaron |
| `whatsapp-templates-alerts-design.md` | Plan | propuesta, no implementada | Mantener como backlog o descartar explícitamente |
| `import-tickets.md` | Plan (tickets) | parcial (solo `patients` implementado) | Revisar tickets abiertos vs cerrados |
| `appointments-cancellation-reschedule-plan.md` | Plan | **implementado** (confirmado en código) | Archivar |
| `feature-acceso-calendarios-doctores.md` | Plan | **implementado** (confirmado en código) | Archivar |
| `medical-instructions-templates-plan.md` | Plan | **implementado** (confirmado en código) | Archivar |
| `pnpm-migration-plan.md` | Plan (infra) | **implementado** (confirmado: `pnpm-lock.yaml`, sin `package-lock.json`) | Archivar |
| `calendar-header-tablet-plan.md` | Plan (UI) | probablemente implementado | Verificar y archivar |
| `finalizado-manual-tratamiento.md` | Plan | Implementado (ya lo dice el doc) | Archivar |
| `reconciliacion-allocations-edicion.md` | Plan | Implementado (ya lo dice el doc) | Archivar |
| `docs/qa/whatsapp-agent-test-battery.xlsx` | QA | vigente, sin README que lo explique | Agregar README de una línea |
| `style_docx.py` | Script de build de documentación | vigente, en uso | Mantener; documentar que depende de una plantilla local no versionada |

**Patrón detectado:** varios planes ya implementados en código (confirmado por grep) **no llevan ningún encabezado de estado**, mientras que otros dos sí dicen explícitamente "Estado: Implementado". No hay convención consistente.

**Recomendación de estructura para `docs/`:**

```
docs/
├── funcional/        # guías de usuario, administración — para gente no técnica
├── tecnico/          # arquitectura, runtime-config, i18n, referencias vivas
├── planes/           # features en diseño o en progreso (activos)
├── archive/          # planes ya implementados (mover aquí en vez de borrar, son buen historial de decisiones)
├── panel-gerencial/  # todo lo del panel gerencial junto (análisis + spec + .design/)
├── agente-ia/        # casos de uso + plan de implementación del agente
├── n8n/              # única carpeta de flujos n8n (ver sección 1)
└── qa/               # (ya existe, agregar README)
```

Esto responde directamente al pedido de "una carpeta para documentación FUNCIONAL" separada del resto.

---

## 3. Clutter en la raíz del repo

| Item | Problema | Recomendación |
| --- | --- | --- |
| `README.md` | Es el boilerplate original de Firebase Studio ("take a look at src/app/page.tsx") — **ese archivo ya no existe** (el proyecto usa `src/app/[locale]/`). No describe el proyecto real. | Reescribir con una descripción real del proyecto + link a `CLAUDE.md`/`AGENTS.md` y a `docs/`. |
| `AGENTS.md` vs `CLAUDE.md` | Contenido muy solapado pero **con drift real**: distinta cantidad de líneas (282 vs 127), tabla de skills distinta (`AGENTS.md` incluye `interface-design`, `CLAUDE.md` no), y **ambos referencian skills que no existen en el repo** (`vercel-react-best-practices`, `tailwind-v4-shadcn` — no hay ninguna carpeta con esos nombres en todo el proyecto). | Decidir una única fuente de verdad (una puede re-exportar/linkear a la otra en vez de duplicar contenido) y crear o quitar la referencia a los dos skills inexistentes. |
| `.agents/skills/` vs `.claude/skills/` | Los skills del proyecto están repartidos: `permissions-protection` y `ui-design-system` viven en `.agents/skills/`, pero `date-formatting` vive en `.claude/skills/`. **Consecuencia real:** en esta misma sesión, la lista de skills disponibles solo detectó `date-formatting` — `permissions-protection` (que tanto `CLAUDE.md` como `AGENTS.md` marcan como **obligatorio** para trabajo de permisos) no está siendo descubierto. | Unificar todos los skills del proyecto en una sola carpeta (`.claude/skills/`, que es la que se está indexando) y crear los skills faltantes o quitar sus referencias. |
| `test_panels.js` (raíz) | Script suelto de una sola línea (`console.log(Object.keys(require('react-resizable-panels')))`), claramente un debug puntual de enero 2026 que quedó commiteado. | Eliminar. |
| `src/package.json` | `package.json` duplicado y **obsoleto** dentro de `src/` (mismo `name: "nextn"` que el de la raíz, pero con versiones de dependencias viejas, sin tocar desde diciembre 2025). No es parte de ningún workspace (`pnpm-workspace.yaml` no lo referencia). | Eliminar — es un remanente, no cumple ninguna función. |
| `.idea/` | Configuración de JetBrains **trackeada en git** (debería ser local de cada dev). | Agregar `.idea/` a `.gitignore` y sacarla del tracking. |
| `.idx/` | Config de Project IDX / Firebase Studio (Nix env), del mismo origen que el `README.md` obsoleto. Si ya no se usa Firebase Studio/IDX para desarrollar (el flujo actual es pnpm + Docker + EasyPanel, según `db-manager.sh`/`Dockerfile`), es un remanente del scaffold inicial. | Confirmar con el equipo si alguien sigue usando IDX; si no, eliminar junto con la mención en `README.md`. |
| `apphosting.yaml` | Config de Firebase App Hosting; el despliegue real parece ser vía Docker/EasyPanel (`Dockerfile`, `db-manager.sh` menciona EasyPanel). | Confirmar si Firebase App Hosting sigue siendo un target de deploy real; si no, eliminar. |
| `.design/panel-gerencial/` | Archivos de diseño (Pencil) para el panel gerencial — legítimos, pero desconectados de `docs/analisis-panel-control-gerencial.md` y `docs/panel-control-gerencial-especificacion-funcional.md`, que tratan el mismo feature. | Agrupar los tres bajo `docs/panel-gerencial/` (ver sección 2). |
| `database/` en un repo de frontend | Migraciones Liquibase completas viven en el repo de frontend. Es una decisión de arquitectura existente (no es "basura"), pero vale mencionarlo: hay varios scripts con el mismo prefijo numérico duplicado (`065_...`, `068_...`, `069_...`, `081_...`, `082_...` aparecen dos veces cada uno con fechas distintas). No es bug de la app pero puede confundir el orden de aplicación. | Fuera del alcance de este frontend-cleanup; reportar al responsable de BD. |

---

## 4. Componentes y hooks sin uso aparente

Metodología: se extrajo cada export de `src/components/**` y `src/hooks/**` y se buscó cualquier import o uso JSX en el resto de `src/`. **Importante:** esta detección es heurística (grep + análisis de imports), no un bundler analizando el árbol real — antes de borrar cualquiera de estos, correr una búsqueda puntual (`grep -r "NombreComponente" src/`) para confirmar, especialmente si hay carga dinámica.

**Alta confianza (sin ningún import/JSX en `src/`):**

- `src/components/appointments/InvoiceDetailSheet.tsx`
- `src/components/appointments/QuickQuoteDialog.tsx`
- `src/components/appointments/ReminderDueAlert.tsx`
- `src/components/appointments/SecretarySessionNotificationModal.tsx`
- `src/components/billing-wizard/steps/step-treatment.tsx`
- `src/components/charts/invoice-status-chart.tsx`
- `src/components/charts/sales-summary-chart.tsx`
- `src/components/dashboard/doctor-ai-panel.tsx` (posiblemente superado por `doctor-workspace.tsx`/`doctor-agent-chat.tsx`)
- `src/components/dashboard/kpi-row.tsx` (posiblemente superado por `month-summary-cards.tsx`/`today-hero.tsx`)
- `src/components/dashboard/report-filters.tsx` (posiblemente superado por `dashboard-filter-bar.tsx`)
- `src/components/dashboard/stats.tsx`
- `src/components/floating-actions.tsx` y `floating-actions-wrapper.tsx` (posiblemente superados por `sticky-notes-overlay.tsx`)
- `src/components/horizontal-nav.tsx` (posiblemente superado por `nav.tsx`/`sidebar.tsx`)
- `src/components/icons/briefcase-icon.tsx`, `paperclip-icon.tsx`, `telegram-icon.tsx`
- `src/components/license/MasterKeyPromptModal.tsx`
- `src/components/sales/payments/SmartPaymentFormDialog.tsx` (posiblemente superado por `PrepaidFormDialog.tsx`)
- `src/components/tables/new-patients-table.tsx`
- `src/components/users/dental-record/session-timeline.tsx`
- `src/components/users/medical-history.tsx` (posible duplicado de `clinic-history-viewer.tsx`)
- `src/components/users/user-appointments.tsx`
- `src/components/users/user-summary-panel.tsx`
- `src/components/users/dental-record/odontogram-view.tsx` (posible versión vieja; el proyecto usa `src/components/odontogram/index.tsx` + `odontogram-arch-view.tsx`/`odontogram-canvas.tsx`)
- `src/components/ui/narrow-table-wrapper.tsx`, `page-shell.tsx`, `panel-stack-renderer.tsx`, `table-header-actions.tsx`
- `src/hooks/use-event-stream.ts` (implementación paralela no usada — el código real usa `useEventStreamSubscription`/`useRegisterEventChannels` de `src/context/event-stream-context.tsx`)
- `src/hooks/use-sidebar.tsx` (sobrante del sidebar genérico de shadcn; el proyecto tiene su propio `src/components/sidebar.tsx`)
- `src/hooks/useServices.ts`

No se encontraron archivos con patrones típicos de código muerto (`*-old`, `*-backup`, `*.bak`, `*copy*`, `*-v2`).

**Recomendación:** antes de eliminar, verificar cada uno individualmente (algunos, como los de `dashboard/`, podrían ser variantes A/B o quedar reemplazados a medias). Es una buena tanda para una PR dedicada de limpieza, separada del resto.

> **Corrección:** una primera pasada había incluido `src/components/ui/index.ts` en esta lista. Es un falso positivo — `src/components/ui/phone-input.tsx` lo importa como barrel vía `from '.'` (import relativo, no con el alias `@/components/ui`), que el grep inicial no cubría. **Sí está en uso**, no eliminar. Esto además es una advertencia general: la detección se basó en grep de imports, no en un bundler real, así que un import relativo (`from '.'`, `from '..'`) puede generar falsos positivos en cualquiera de los demás candidatos — confirmar con búsqueda manual antes de borrar.

---

## 5. Páginas/rutas potencialmente huérfanas

- **`src/app/[locale]/communications/`** (`page.tsx` y `channels/page.tsx`) — **confianza alta**. No está en `nav.ts`, ningún `Link`/`router.push` apunta ahí, y ni siquiera la constante `ROUTES.COMMUNICATIONS` (definida en `src/constants/routes.ts`) se usa en ningún componente. No existe un permiso asociado en `constants/permissions.ts`. Todo indica que fue reemplazada por `system/communication-templates` y `system/communication-history`, que sí están activas.
- **`src/app/[locale]/sales/orders/`** y **`src/app/[locale]/purchases/orders/`** — confianza media. Están comentadas explícitamente en `nav.ts` (`// hidden: orders tab`) pero el código sigue activo y mantenido, y tienen layout propio agregado en el último commit del repo — parece una feature pausada intencionalmente, no código muerto. Confirmar con el equipo si se retoma o se elimina.
- Los layouts nuevos del último commit (`01890a17`, purchases/sales/reports) sí tienen su `page.tsx` correspondiente — no hay layouts huérfanos.
- No se encontraron carpetas de rutas con nombres de debug/test/sandbox bajo `src/app`.

---

## 6. Otras observaciones menores

- `CLAUDE.md` describe `src/lib/types.ts` como "958 lines" — hoy tiene **3163 líneas**. La documentación de arquitectura no se ha mantenido al día con el crecimiento del archivo (y es la señal de que probablemente convenga dividirlo en módulos más chicos, aunque eso es una decisión aparte).
- `src/stores/` (10 stores de Zustand) no aparece mencionado en la estructura de directorios de `CLAUDE.md`/`AGENTS.md` — vale agregarlo.
- `Agent_InvokeIA_Help_v2.json` (ver sección 1) es basura confirmada.

---

## 7. Paquetes instalados

Revisión de `package.json` (raíz), `pnpm-lock.yaml` resuelto y `pnpm audit --prod`. Metodología: para cada dependencia se verificó (a) si se importa realmente en `src/`/`e2e/`, con revisión manual de los casos dudosos para descartar falsos positivos (imports dinámicos, peer dependencies transitivas necesarias, etc.), y (b) vulnerabilidades conocidas vía `pnpm audit`.

### 7.1 Dependencia sin ningún uso

- **`react-phone-number-input`** — confirmado sin ningún import en todo el repo. El componente real (`src/components/ui/phone-input.tsx`) implementa su propio `PhoneInput` usando `libphonenumber-js` directamente, sin pasar por esta librería. Se puede eliminar de `dependencies`.

### 7.2 Scripts de `package.json` rotos o desalineados

- **`pnpm genkit:dev` / `pnpm genkit:watch` probablemente no funcionan hoy.** El devDependency `genkit-cli` está pinneado en `^0.0.2` (versión real instalada: `0.0.2`), mientras que `genkit` (dependency) está en `1.35.0`. La última versión publicada de `genkit-cli` es `1.43.0` — `0.0.2` es una versión inicial/placeholder de hace mucho tiempo. Consecuencia verificada: ese paquete **no expone ningún binario `genkit`** (`bin` vacío en su `package.json`, y no existe `node_modules/.bin/genkit`), así que los scripts que llaman a `genkit start -- tsx ...` no tienen con qué ejecutarse. Recomendación: actualizar `genkit-cli` a una versión `^1.x` alineada con `genkit`.
- **`eslint-config-next` en una major distinta a `next`.** Instalado `eslint-config-next@16.2.6` (reglas pensadas para Next 16) contra `next@15.5.18` en uso real. Debería fijarse en `^15.x` para que el linter valide contra la versión de Next que realmente corre la app.
- **`patch-package` instalado pero inerte.** No existe carpeta `patches/` ni un script `postinstall` que lo invoque — hoy no hace nada. O se elimina, o se completa el setup (generar el patch necesario + agregar `"postinstall": "patch-package"`).

### 7.3 Vulnerabilidades (`pnpm audit --prod`)

**69 advisories: 3 críticas, 28 altas, 32 moderadas, 6 bajas.** La mayoría son transitivas (tooling de build/telemetría), pero hay varias en dependencias directas con parche disponible dentro del mismo rango de `package.json` — es decir, se arreglan solo con `pnpm update`, sin tocar código:

| Paquete | Problema | Instalado | Corregido en | Acción |
|---|---|---|---|---|
| `next` | 2 críticas (RCE no autenticado en Windows/Image Optimization) + varias altas/moderadas (SSRF, DoS) | `15.5.18` | `>=15.5.21` / `>=15.5.24` | El rango del `package.json` (`^15.5.9`) **ya permite** la versión corregida — alcanza con `pnpm update next` (o un `pnpm install` con el lockfile regenerado). **Prioridad máxima.** |
| `@tiptap/core` (+ extensiones) | Alta: ReDoS cuadrático parseando Markdown; moderada: `mergeAttributes()` con prototype pollution | `3.27.1` (pinneado) | `>=3.30.5` / `>=3.30.4` | Actualizar el rango en `package.json` a `^3.30.5` o superior (última: `3.31.3`). |
| `next-intl` | Moderada: open redirect y prototype pollution vía claves de catálogo de traducción | `3.26.5` | `>=4.9.2` (fix real) | Requiere subir de major (3→4, hay breaking changes de next-intl 4). No es un simple `pnpm update`; planificar como tarea aparte. |
| `xlsx` (SheetJS, edición community) | Alta: prototype pollution + ReDoS | `0.18.5` (= última publicada en npm) | `>=0.19.3`/`>=0.20.2`, **no publicadas en npm** (SheetJS mueve los fixes a su propio registro desde hace tiempo) | Riesgo real acotado: en este repo `xlsx` solo se usa para **generar** archivos (`writeFile`/`utils.*`), nunca para leer archivos subidos por usuarios — no hay superficie de ataque de parsing hoy. Si se quiere el fix igual, instalar desde el tarball oficial de SheetJS (`https://cdn.sheetjs.com/...`) en vez del paquete de npm. |
| `sharp` (transitiva, Next Image) | Alta: vulnerabilidades heredadas de `libvips`/`libheif` | `<0.35.0`/`<0.35.4` | `>=0.35.4` | Se resuelve al actualizar `next` (arrastra su propia versión de `sharp`) — revisar tras el update de la fila 1. |
| `websocket-driver` | Crítica: corrupción de mensajes por abuso de headers de longitud de protocolo | `0.7.4` | `>=0.7.5` | Transitiva profunda: `genkit@1.35.0 → @genkit-ai/firebase → firebase-admin/firebase → @firebase/database → faye-websocket → websocket-driver`. No depende de una elección directa del proyecto; solo se resuelve cuando Genkit/Firebase actualicen esa cadena. Bajo riesgo real salvo que se use Firebase Realtime Database activamente. |

El resto de advisories (dompurify vía `@monaco-editor/react`, opentelemetry/protobufjs/qs/nanoid/browserslist/postcss/fast-uri/brace-expansion/tmp/form-data, todas transitivas de tooling de build o de Genkit) son de exposición baja en este contexto (no procesan input de usuarios no confiable en producción) pero conviene revisarlas de nuevo después de actualizar `next` y `genkit-cli`, ya que muchas se resuelven en cascada.

### 7.4 Otras observaciones menores

- **`@types/leaflet` está en `dependencies` en vez de `devDependencies`.** Es un paquete de tipos, solo hace falta en compilación — moverlo no cambia el bundle pero es la convención correcta.
- **`xlsx` y `xlsx-js-style` coexistiendo no es duplicación accidental**: están usados a propósito — `xlsx-js-style` solo donde se necesita estilo de celdas al escribir (el comentario en `src/services/appointment-schedule-export.ts` lo explica), `xlsx` para el resto de exports. No tocar.
- `src/package.json` (ver sección 3) es, además de un archivo huérfano, una **segunda fuente de versiones de dependencias desactualizada** que puede confundir a herramientas de auditoría automatizadas si alguna vez escanean el repo completo — otro motivo más para eliminarlo.

---

## Resumen de acciones sugeridas, por prioridad

1. **Urgente (seguridad):** rotar secretos expuestos en `.env.local` y sacarlo de git (sección 0); actualizar `next` a `>=15.5.24` dentro del rango ya permitido por `package.json` (sección 7.3).
2. **Alto impacto, bajo riesgo:** unificar las 3 carpetas de n8n en una sola, plana (sección 1); eliminar `Agent_InvokeIA_Help_v2.json`, `test_panels.js`, `src/package.json`, `react-phone-number-input`; sacar `.idea/` del tracking; arreglar `genkit-cli` (script roto) y `eslint-config-next` (major desalineada).
3. **Organización de docs:** crear la estructura `docs/funcional/`, `docs/tecnico/`, `docs/planes/`, `docs/archive/` y mover cada archivo según la tabla de la sección 2.
4. **Consolidar guías de agentes:** resolver el drift entre `AGENTS.md`/`CLAUDE.md` y unificar `.agents/skills/` + `.claude/skills/` en una sola carpeta (afecta funcionalidad real: hoy `permissions-protection` no se está cargando).
5. **Código muerto:** revisar uno por uno los 26 candidatos de la sección 4 y las rutas de la sección 5, y eliminarlos en una PR dedicada.
6. **Dependencias con fix disponible pero que implican trabajo:** subir `@tiptap/core` y extensiones a `^3.30.5`+; evaluar la migración de `next-intl` 3→4 como tarea propia (breaking changes).
7. **Nice-to-have:** reescribir `README.md`, decidir el destino de `.idx/`/`apphosting.yaml`, sacar los `.docx` generados del control de versiones, mover `@types/leaflet` a `devDependencies`.
