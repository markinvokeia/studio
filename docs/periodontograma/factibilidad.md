# Periodontograma · Informe de factibilidad (Fase 0)

> **Actualizado el 5 nov 2026:** las decisiones y el plan vigentes están en [diseno-odontograma-y-periodontograma.md](diseno-odontograma-y-periodontograma.md). Lo que este informe dice de Gotenberg, Vitest, la extracción de la cabecera, el póntico y el agente clínico (que sí está exportado, en *Users Workflows*) quedó reemplazado.

**Veredicto: factible con ajustes.** Hay dos decisiones para tomar antes del PR 1 (backend en n8n + funciones SQL, y cómo se marca el póntico en el odontograma). El resto se adapta al código sin bloquear.

5 nov 2026 · Fase 0 sobre la rama `periodoncia` (`origin/periodoncia`, que ya incluye el merge de `modulo-estetica`). No se cambió código.

---

## 1. Resumen para decidir

Lo que encontré en el código real, y que cambia lo que propone la guía técnica:

| # | La guía supone | En Invoke hoy | Ajuste propuesto |
|---|---|---|---|
| 1 | API REST en Next.js (`/api/perio/...`) y carga sitio a sitio sin pasar por n8n | **No hay backend en Next.js.** Todo pasa por webhooks de n8n (`jwtAuth`) que llaman a **funciones plpgsql**. Estética (mig. 151–161) es el modelo más nuevo: cada webhook es un nodo Postgres `SELECT * FROM aesthetic_xxx($1::jsonb, $2)` | Mismo patrón: flujo `Perio Record` en n8n, muy fino, con funciones `perio_*` en SQL. La carga va **en lotes**: el front junta los cambios y guarda cada 800 ms o al cambiar de pieza (como el autoguardado de estética). Son de 10 a 30 llamadas por sesión, no 170. **Decisión 1** |
| 2 | `sesiones_clinicas.tipo_sesion` + `perio_exams` 1 a 1 con la sesión | No hay columna de tipo. Cada tipo tiene **su propia tabla**: `sesiones_clinicas` (simple), `sesiones` (odontograma, con `estado_odontograma` JSON) y `aesthetic_sessions` (estética). La historia las une: odontograma con `UNION ALL` en SQL y estética en el cliente | `perio_exams` como tabla propia (igual que `aesthetic_sessions`), sin FK a `sesiones_clinicas` y sin agregar la columna de tipo. La línea de tiempo suma `kind: 'perio'` y el filtro `periodontograma` |
| 3 | `perioAssess` en TypeScript ejecutado en el servidor | No hay servidor TypeScript | Estado, avance e índices en **plpgsql** (`perio_exam_recompute()`, igual que `aesthetic_session_recompute()`): son los que deciden si se puede firmar. Estadio, grado, riesgo y plan en **TypeScript** (`src/lib/perio`), en el cliente: son sugerencias, y lo que queda en la historia es lo que el profesional confirma (el servidor valida rangos y guarda) |
| 4 | Siluetas de corona y raíz tomadas del odontograma | El diente del odontograma es una **vista oclusal de 5 caras** (`odontogram-tooth.tsx`). No hay perfil lateral con raíz | Se portan las siluetas del prototipo (`GEO`) a un archivo nuevo. Del odontograma solo se reutilizan helpers (`isUpperTooth`, `isRightQuadrant`, `getToothKind`, listas FDI) |
| 5 | Ausente, póntico e implante vienen del odontograma | Hay `missing`, `implant` e `implant-osseo` (condición `whole`), pero **no hay póntico**: un puente es `fixed-prosth` o `bridge-*` en la pieza, sin distinguir pilar de póntico | **Decisión 2** (ver sección 7) |
| 6 | Shell común de sesión guiada (estética + odontograma nuevo) con riel de agenda | Solo estética tiene sesión guiada, y su cabecera y stepper están dentro de `aesthetic-session-sheet.tsx` (un `ResizableSheet`, sin ruta propia). El odontograma (`DentalRecordViewer`) no tiene estados, stepper ni firma. **No hay riel de agenda** en ninguna sesión | Extraer en el PR 1 `GuidedSessionHeader` (paciente, stepper, anillo, chip de estado, lo que falta, guardado) desde estética y usarlo en los dos. Riel de agenda fuera del PR 1 (Mi Consultorio ya da ese contexto) |
| 7 | Ya existe un periodontograma | Existe **un mock**: `periodontogram-view.tsx` (511 líneas) en una pestaña del `DentalRecordViewer`, que guarda en `localStorage` (`dental_perio_<id>`) con tipos `ToothPerioData` y `SixPointMeasure` | Se reemplaza: se quita la pestaña, el mock y sus tipos en el PR 1. No hay datos reales que migrar (solo vivían en el navegador) |
| 8 | Anamnesis con cigarrillos por día y HbA1c | `habitos_paciente.fuma` (booleano) + `tabaquismo` (texto libre). Diabetes = un `antecedentes_personales` unido por **nombre** a `catalogo_padecimientos`. No hay HbA1c | Columnas nuevas en el PR 3 (`cigarrillos_dia`, `hba1c`, `hba1c_fecha`). Mientras tanto, el paso Diagnóstico precarga lo que pueda y el profesional lo completa |
| 9 | WhatsApp con `wa_plantillas`, `wa_envios_programados` y `wa_mensajes` | Esas tablas no existen. Se usa `communication_templates` (`type = 'WHATSAPP'`), el motor de `alert_rules` con *Alert WhatsApp Auto-Send* y YCloud por HTTP | Plantillas como filas de `communication_templates`. El recordatorio de mantenimiento va como regla de alerta (o `reminders`), no como tabla nueva |
| 10 | PDF con Gotenberg *si no existe* | **Gotenberg ya existe**: *Print Invoice PDF* llama a `$env.GOTENBERG_URL`. En el cliente, las impresiones son plantillas locales (`usePrintDocument`) | PDF del periodontograma = plantilla de impresión local. Reporte al paciente (PDF/PNG para WhatsApp) = flujo n8n con Gotenberg, igual que la factura |
| 11 | Cobro y próxima cita reutilizados de estética | Estética cobra con el **Cobro Rápido** (`useBillingWizard().open(...)`) y vincula la factura (`link_invoice`). La cita se agenda con `AppointmentFormDialog` precargado, no con un selector propio de huecos | Lo mismo: `perio_exams.invoice_id` + `perio_exam_link_invoice()`. Próxima cita con `AppointmentFormDialog` y la fecha sugerida. Días con huecos libres reales, como en el prototipo, en una segunda vuelta |
| 12 | Tests unitarios con Vitest o Jest | Solo hay Playwright (suite E2E en `e2e/`). No hay framework unitario | Agregar **Vitest** como devDependency para `src/lib/perio` (los 12 casos obligatorios). Requiere tu visto bueno |
| 13 | Permisos `periodontograma.ver`, `.firmar`… | Códigos en MAYÚSCULAS por módulo (`AESTHETIC_RECORD_VIEW`, `ODONTOGRAM_REGISTER_SESSION`), sembrados en `permissions` + `role_permissions` copiando roles de un permiso existente | `PERIO_RECORD_VIEW`, `PERIO_RECORD_REGISTER_SESSION` (PR 1), `PERIO_RECORD_DIAGNOSE`, `PERIO_RECORD_SIGN`, `PERIO_RECORD_AMEND`, `PERIO_RECORD_SEND_REPORT` (PR 3 y 4), dados a los roles que ya tienen los del odontograma |
| 14 | Columna de aislamiento por clínica | Las tablas clínicas (`sesiones_clinicas`, `sesiones`, `aesthetic_sessions`) **no tienen** columna de tenant: el aislamiento es por despliegue y base. `sede_id` existe solo en agenda y caja | Las tablas `perio_*` siguen igual que estética, sin columna de tenant |
| 15 | Textos en español rioplatense, claves `perio.*` | Regla del repo: se actualizan **siempre** `en.json`, `es.json` y `es-ES.json` (este último con tú). Los namespaces son PascalCase (`AestheticRecord`, `DentalRecord`) | Namespace `PerioRecord` en los tres idiomas. Fichas y guías del asistente en es y en (el build falla si falta el inglés) |

---

## 2. Mapa de reutilización

**R** = reutiliza tal cual · **E** = extiende · **N** = nuevo

### Integración como tipo de sesión

| Pieza | Qué hay | | Qué se hace |
|---|---|---|---|
| Tipo de sesión | Tablas separadas por tipo; `PatientSession.tipo_sesion: 'odontograma' \| 'clinica'` solo en la respuesta de `patient_sessions` | N | `perio_exams` propia; no se toca `patient_sessions` |
| Línea de tiempo | `TreatmentTimeline` en [clinic-history-viewer.tsx](../../src/components/users/clinic-history-viewer.tsx) mezcla `sessions` + `aestheticSessions` + `appointments`; `TimelineFilter = 'all' \| 'clinica' \| 'odontograma' \| 'estetica' \| 'appointment'` | E | Agregar `'periodontograma'`, `kind: 'perio'`, `usePerioSessions(userId)`, tarjeta y apertura del sheet |
| Tarjeta en la historia | `aesthetic-timeline.tsx` (`AestheticSessionDetails`, `AestheticStatusChip`, `aestheticSessionPreview`) | E | `perio-timeline.tsx` con el mismo esqueleto + miniatura de curvas desde `stats` |
| Nueva sesión | `onCreateOdontogram` / `onCreateAestheticSession` en `patient-actions-menu`, `patient-quick-actions`, `patients/page`, `PatientDetailSheet`, `doctor-workspace` (patrón de *trigger*) | E | `onCreatePerioExam` en los mismos cinco puntos |
| Shell guiado | Cabecera, stepper, autoguardado (`ensureSaved`, `AUTOSAVE_DELAY`), contexto (`session-flow-context.tsx`) y estado (`session-status.ts`) de estética | E | Extraer `GuidedSessionHeader`; copiar el patrón de contexto y autoguardado en `perio-flow-context.tsx` |
| Ruta propia `/pacientes/[id]/sesiones/[id]` | No existe: las sesiones se abren en `ResizableSheet` desde la historia | R | Seguir el patrón de sheet. Para entrar a un paso: parámetro del trigger, no ruta |

### Base de datos

| Pieza | | Detalle |
|---|---|---|
| Migraciones | R | SQL plano en `database/scripts/NNN_YYYYMMDD_nombre.sql`, `BEGIN … COMMIT`, idempotente, registro `INSERT INTO db_migrations (script_name, version_tag, notes) … ON CONFLICT (script_name) DO UPDATE`. Liquibase existe pero los scripts nuevos no lo usan. **Próximo número libre: 162** (el más alto en todas las ramas es 161; hay un `202` suelto para revisar) |
| `perio_exams`, `perio_teeth`, `perio_sites` | N | Como la guía, con convenciones de estética: inglés, `patient_id`/`doctor_id` uuid, `appointment_id integer`, `timestamp without time zone`, `created_by`/`updated_by`, `deleted_at`, `status` y `completeness` calculados |
| `perio_exam_events` | N | Registro de actividad (igual que `aesthetic_session_events`) |
| `perio_amendments` | N | Como la guía (PR 4). Estética resuelve las enmiendas con notas `kind = 'amendment'`; acá conviene la tabla con `path`, valor viejo y nuevo, y motivo, porque se corrigen medidas |
| Errores | R | Las funciones lanzan `'PERIO:<CODIGO>\|<detalle>'` y el nodo *Map error* (copiado de estética) responde `400 { success:false, code, detail }` |
| `service_catalog` semillas | E | **No hay código único**: la inserción idempotente va con `WHERE NOT EXISTS` por nombre, no con `ON CONFLICT` por código. Categoría vía `category_id` |
| Anamnesis | E | PR 3: `habitos_paciente.cigarrillos_dia`, `hba1c`, `hba1c_fecha` |

### Lógica, API y n8n

| Pieza | | Detalle |
|---|---|---|
| `src/lib/perio` | N | `sequence.ts` (`probeSequence`), `stats.ts`, `diff.ts`, `assess.ts` (estabilidad, estadio, grado, riesgo), `plan.ts`, `dictation-parser.ts` (port de `parseDict`). Los tipos compartidos van a `src/lib/types.ts` (regla del repo) |
| Flujo n8n `Perio Record` | N | `docs/n8n-flows/flow-perio-record.json`, mismo esqueleto que `flow-aesthetic-record.json` (22 webhooks, 1 Postgres por webhook). **Se importa a mano en n8n**: yo dejo el JSON |
| Servicio front | N | `src/services/perio-record.ts` con `unwrap`, normalizador y timeouts de `REQUEST_TIMEOUT_MS`, como `aesthetic-record.ts` |
| Rutas | E | `API_ROUTES.PERIO_RECORD.*` en `src/constants/routes.ts` |
| Dictado | E | `VoiceRecorderButton` (Web Speech API del navegador) ya existe. El parser determinístico va en el cliente (PR 1 o 5). El respaldo con LLM se apoya en el agente clínico `/ai/doctor/query`, **cuyo flujo no está exportado en el repo** |
| Reporte | E | Gotenberg ya existe; flujo `perio-report` nuevo, igual que *Print Invoice PDF* |
| Recordatorio | E | Regla nueva en `alert_rules` / `communication_templates` |

### Frontend

| Componente de la guía | | Archivo propuesto |
|---|---|---|
| `PerioSession` | N | `src/components/users/perio-record/perio-session-sheet.tsx` + `perio-flow-context.tsx` |
| `PerioProbeStep` | N | `step-probe.tsx` |
| `PerioArch` | N | `perio-arch.tsx` (SVG por arcada, `React.memo` por pieza) + `perio-tooth-geometry.ts` |
| `PerioArchMap` | N | `perio-arch-map.tsx` (PR 2). `odontogram-board.tsx` tiene un arco anatómico; si su cálculo de posiciones se puede exponer, se reutiliza; si no, se porta `placeArch` |
| `PerioInspector` | N | `perio-inspector.tsx`, `perio-keypad.tsx`, `perio-dock.tsx` (teclado fijo en tablet) |
| Teclado físico | N | `use-perio-keyboard.ts` |
| `PerioEvolutionStep` | N | `step-evolution.tsx` (PR 2). Estética no tiene línea de tiempo comparativa reutilizable más allá de `zone-history.tsx` |
| `PerioDiagnosisStep` | N | `step-diagnosis.tsx` (PR 3) |
| `PerioCloseStep` | E | `step-close.tsx` (PR 4) con `SessionBillingCard`-like + `AppointmentFormDialog` + firma |
| `PerioHistoryCard` | E | `perio-timeline.tsx` |
| Tokens de color | E | `tailwind.config.ts` + CSS variables (claro y oscuro) |

---

## 3. Diferencias con la guía, con motivo

1. **Carga por lotes vía n8n, no API directa.** Invoke no tiene backend propio en Next.js: armarlo (conexión a Postgres desde el servidor de Next, validación del JWT, despliegue) sería otra arquitectura para un solo módulo. Con lotes de 800 ms el número de llamadas a n8n cae de unas 170 a unas 20 por sesión, y estética ya autoguarda así. Si después se mide latencia molesta en tablet, el contrato del servicio front no cambia y se puede mover a un Route Handler.
2. **Sin FK a `sesiones_clinicas`.** Seguir la guía obligaría a crear una fila en `sesiones_clinicas` que no se usa para nada (no tiene `estado_odontograma`, ni estados, ni capas). Estética eligió tabla propia y la historia ya sabe mezclar fuentes.
3. **`perioAssess` partido en dos.** El servidor calcula lo que bloquea (estado, si se puede firmar, índices que se guardan en `stats`). Estadio, grado, riesgo y plan son sugerencias que el profesional confirma: se calculan en TypeScript con tests y el servidor guarda lo confirmado. Duplicarlas en plpgsql sería mantener dos veces las reglas clínicas.
4. **Permisos con la convención del repo** (`PERIO_RECORD_*`), no `periodontograma.*`.
5. **Recordatorio y plantillas** con `alert_rules` y `communication_templates`, porque `wa_envios_programados` y `wa_plantillas` no existen.
6. **Sin riel de agenda** en el PR 1: no existe en ninguna sesión y no bloquea nada clínico.
7. **Idioma:** las claves van en los tres archivos de idioma, no solo en rioplatense.

---

## 4. Huecos y bloqueos

| Hueco | Impacto | Cuándo se resuelve |
|---|---|---|
| No hay póntico en el odontograma | Sin regla, un puente se sondea como pieza presente | Decisión 2, PR 1 |
| No hay cigarrillos por día ni HbA1c | Grado y riesgo sin datos | PR 3 (columnas + edición desde Diagnóstico) |
| No hay framework de tests unitarios | Los 12 casos obligatorios no tienen dónde correr | PR 1 (Vitest), con tu visto bueno |
| El flujo del agente clínico (`/ai/doctor/query`) no está exportado en el repo | No puedo extenderlo ni versionarlo | PR 5: exportarlo de n8n a `docs/n8n-flows/` |
| Los flujos de `docs/n8n-flows` pueden no coincidir con producción | Riesgo de basarse en una copia vieja | Confirmar antes del PR 1 que la exportación de *Clinic History Workflows* está al día |
| El MCP de Postgres no conectó en esta sesión | No validé el esquema vivo (columnas de `service_catalog`, `habitos_paciente`, `communication_templates`, roles) | Antes de escribir la migración del PR 1: reconectar y validar |
| La rama local `periodoncia` está un commit detrás de `origin/periodoncia` (le falta el merge de estética) | El PR 1 depende de estética | `git pull --ff-only` antes de empezar |
| El consentimiento de WhatsApp del paciente | No encontré el campo; la guía dice que sin consentimiento no se envía | PR 4: ubicarlo o definirlo |

---

## 5. Riesgos técnicos

| Riesgo | Mitigación |
|---|---|
| Latencia de n8n con lotes frecuentes en tablet | Cola local con reintento, indicador *Guardado hace N s*, deshacer local que no espera al servidor. Medir en el PR 1 con un examen completo |
| Permisos solo en el front: los webhooks de estética validan el JWT pero no el permiso | Igual que el resto de Invoke hoy. Para firmar y enmendar, la función SQL recibe el usuario y verifica el permiso en `role_permissions` (barato y cierra lo clínico sensible) |
| Bug existente en `patient_sessions`: el `UNION ALL` filtra por `id` sin distinguir tabla, y un `sesiones_clinicas.id` puede coincidir con un `sesiones.id` | No lo tocamos; el periodontograma no entra en ese UNION. Lo anoto para un ticket aparte |
| Rendimiento del SVG (6 filas × 32 piezas × 2 arcadas, más curvas) | `React.memo` por pieza, curvas por cara memoizadas, deslizador con `clipPath` por `ref` (PR 2). Probar en una tablet real en el PR 1 |
| Reglas clínicas mal interpretadas | Casos de prueba validados por un periodoncista antes del PR 3 |
| `clinic-history-viewer.tsx` tiene 3.688 líneas y la tocan varias ramas | Cambios chicos y aislados (filtro, `kind`, trigger); la tarjeta y el sheet viven en `perio-record/` |
| Mapeo del odontograma a estados de pieza | Congelado en `perio_teeth` al crear; si el odontograma cambia, aviso *Actualizar piezas* (PR 1 o 2) |
| Plantillas de Meta demoradas | Cargarlas al iniciar el PR 4; dentro de la ventana de 24 h se manda sin plantilla |

---

## 6. Estimación por PR

Con Claude Code haciendo el grueso del código y un desarrollador revisando. Incluye 25 % de margen. Sube un poco respecto de la guía (171 h) por las funciones SQL y el flujo n8n que la guía no contaba, y por mantener tres idiomas y el asistente.

| PR | Contenido | Dev (h) | QA (h) | Depende de |
|---|---|---|---|---|
| 1 | Migración 162 + funciones; flujo `Perio Record`; `src/lib/perio` (secuencia, índices, estado) con Vitest; servicio y rutas; `GuidedSessionHeader` extraído de estética; sheet, paso Sondaje, `PerioArch`, inspector, teclado y dock, pasadas, examen guía, deshacer, autoguardado; tarjeta y filtro en la historia; entradas de *Nueva sesión*; permisos; quitar el mock; i18n ×3; fichas del asistente es/en; E2E de carga | 62 | 16 | Este informe aprobado + decisiones 1 y 2 |
| 2 | Evolución: deslizador, superponer, cambios, mapa, tendencias, listas, animación; *Comparar con hoy* | 24 | 8 | 1 |
| 3 | `assess.ts` y `plan.ts` con tests; paso Diagnóstico; columnas de anamnesis; plan EFP a presupuesto en Ventas; semillas de `service_catalog`; permiso `DIAGNOSE` | 34 | 10 | 1 |
| 4 | Cierre: Cobro Rápido + vínculo de factura, próxima cita, firma, enmiendas (`perio_amendments`), impresión local, flujo `perio-report` con Gotenberg, plantilla en `communication_templates` | 30 | 10 | 3 |
| 5 | Dictado (parser + respaldo LLM), recordatorio por `alert_rules`, cribado PSR/BPE, modo solo implantes, configuración por clínica (secuencia, signo del margen, intervalos) | 30 | 10 | 1 y 4 |
| **Total** | | **180** | **54** | |

A USD 20/h de desarrollo y USD 10/h de QA: unos **USD 4.140**. Los PR 1 a 3 ya dan un periodontograma usable en clínica.

Supuestos: el esquema vivo coincide con lo que muestran los scripts y las exportaciones de n8n; Mark o Luis importan los flujos en n8n y corren las migraciones; no se migran periodontogramas de otros sistemas.

---

## 7. Decisiones que necesito antes del PR 1

1. **Backend.** Propuesta: n8n + funciones plpgsql con guardado en lotes (sección 3, punto 1). Alternativa: Route Handlers de Next.js con conexión directa a Postgres (más rápido por sitio, pero es infraestructura nueva).
2. **Póntico.** Opciones:
   - **a) (propuesta)** Regla de derivación: pieza con `missing` + `fixed-prosth`/`bridge-*` → póntico; `missing` solo → ausente; `implant`/`implant-osseo` → implante; el resto → presente. El profesional puede corregir cada pieza en el examen.
   - b) Agregar la condición `pontic` al catálogo del odontograma (cambio en ese módulo, con su test).
3. **Extraer `GuidedSessionHeader` de estética** (unas 6 h, toca estética) **o copiarlo** con un ticket de deuda. Propuesta: extraer.
4. **Agregar Vitest** como devDependency (`pnpm test`).
5. **¿El PR 1 trae un cierre mínimo?** Propuesta: sí, *Firmar y cerrar* solo con sondaje completo; los requisitos de diagnóstico, cobro y cita se suman en los PR 3 y 4. Sin eso, el PR 1 genera exámenes que nunca se cierran.

---

## 8. Plan del PR 1

Rama `perio/fase-1` desde `periodoncia` actualizada. Un PR contra `periodoncia`.

### Migración `database/scripts/163_20261105_perio-record.sql`

- `perio_exams`: `id bigserial`, `patient_id uuid`, `doctor_id uuid`, `appointment_id integer`, `exam_date date`, `exam_type` (`initial`, `reevaluation`, `maintenance`, `psr`, `implants`), `guide_exam_id`, `status` calculado (`probing`, `probed`, `diagnosed`, `ready_to_close`, `closed`, `void`), `completeness`, `gm_sign`, `stats jsonb`, `notes`, cierre (`closed_at`, `closed_by`), anulación (`voided_at`, `voided_by`, `void_reason`), auditoría (`created_*`, `updated_*`, `deleted_at`). Las columnas de diagnóstico se agregan en la migración del PR 3.
- `perio_teeth` y `perio_sites` como la guía: clave natural, `CHECK` de rangos, `cal_mm` generado, `source` (`manual`, `dictation`, `same`), `confirmed`.
- `perio_exam_events`.
- Funciones: `perio_exam_create(jsonb, uuid)` (congela piezas desde el último odontograma y elige el examen guía), `perio_exam_json(bigint)`, `perio_exams_list(uuid)`, `perio_sites_save(bigint, jsonb, uuid)` (lote), `perio_tooth_save(bigint, jsonb, uuid)`, `perio_exam_recompute(bigint)`, `perio_exam_close(bigint, uuid)`, `perio_exam_delete(bigint, uuid)` (solo sin cerrar). Todas rechazan escribir en exámenes cerrados (`PERIO:EXAM_CLOSED`) y en piezas ausentes o pónticos.
- Permisos `PERIO_RECORD_VIEW` y `PERIO_RECORD_REGISTER_SESSION`, copiando los roles de `ODONTOGRAM_VIEW` y `ODONTOGRAM_REGISTER_SESSION`.
- `INSERT INTO db_migrations`.
- `163_20261105_perio-record_down.sql`: borra las tablas solo si están vacías. Está comentado entero: sólo se corre a mano.

### n8n

- `docs/n8n-flows/flow-perio-record.json`: `GET perio/exams`, `GET perio/exams/get`, `POST perio/exams/create`, `POST perio/sites/save`, `POST perio/teeth/save`, `POST perio/exams/close`, `POST perio/exams/delete`, con *Map error*.

### Frontend

| Archivo | Cambio |
|---|---|
| `src/lib/types.ts` | Tipos `PerioExam`, `PerioTooth`, `PerioSite`, `PerioStats`, `PerioExamStatus`…; se quitan `ToothPerioData`, `SixPointMeasure`, `SixPointBool`, `DentalRecordSession` |
| `src/lib/perio/{sequence,stats,status,odontogram-bridge,geometry}.ts` + `*.test.ts` | Lógica pura y tests (secuencia de 174 sitios del caso de ejemplo, NIC, estado con margen faltante) |
| `src/services/perio-record.ts` | Cliente del flujo |
| `src/constants/routes.ts`, `permissions.ts`, `default-role-permissions.ts` | Rutas y permisos |
| `src/components/users/guided-session/guided-session-header.tsx` | Extraído de estética |
| `src/components/users/aesthetic-record/aesthetic-session-sheet.tsx` | Usa el header extraído |
| `src/components/users/perio-record/*` | Sheet, contexto, paso Sondaje, `PerioArch`, inspector, teclado, dock, atajos, autoguardado, tarjeta |
| `src/components/users/clinic-history-viewer.tsx` | Filtro, `kind: 'perio'`, trigger |
| `patient-actions-menu.tsx`, `patient-quick-actions.tsx`, `patients/page.tsx`, `PatientDetailSheet.tsx`, `doctor-workspace.tsx` | *Nueva sesión → Periodontograma* |
| `dental-record-viewer.tsx`, `periodontogram-view.tsx`, `numpad-popover.tsx`, `services/dental-record.ts` | Se quita el mock en `localStorage` |
| `tailwind.config.ts` / CSS global | Tokens de periodoncia, claro y oscuro |
| `src/messages/{en,es,es-ES}.json` | Namespace `PerioRecord` |
| `knowledge/screens/…`, `knowledge/en/screens/…`, guías | Ficha y guías del asistente; `pnpm knowledge:build` |
| `package.json` | Vitest y script `test` |
| `e2e/tests/clinic-history/perio-probe.spec.ts` | Criterios de aceptación de la carga |

### Criterios de aceptación del PR 1

De la especificación: piezas desde el odontograma y secuencia que las saltea; `3` `2` `4` carga tres sitios y la guía muestra el cuarto; *Enter* guarda el valor guía con `source = same`; `B` marca el último sitio medido; alerta de salto de 3 mm o más con *Corregir*; NIC = PS + MG, y sin margen no pasa a *Sondada*; deshacer y rehacer; tema oscuro y 1440/1024/390 px, con teclado fijo en 1024.

Al cerrar el PR: `pnpm typecheck && pnpm lint && pnpm test`, E2E, capturas en claro y oscuro, y la nota de diferencias con la guía.
