# Odontograma guiado y periodontograma · Diseño técnico

5 nov 2026 · rama `estetica-test` (= `origin/periodoncia`, con estética mergeada). Reemplaza el plan de [factibilidad.md](factibilidad.md) en todo lo que se contradiga.

**Orden:** primero el odontograma (O1 → O3), que tiene que quedar funcional en cada fase; después el periodontograma, por iteraciones (P1 → P5).

---

## 0. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Backend | n8n + funciones plpgsql, con el patrón de estética (`flow-aesthetic-record.json`, scripts 151–161) |
| Tipos de sesión | Cada tipo tiene su tabla: el odontograma sigue en `sesiones`, el periodontograma va en `perio_exams`. No hay columna `tipo_sesion` |
| Catálogo de marcas | Se conservan **todos** los ids de `odontogram-catalog.ts` (se guardan en `estado_odontograma` y el agente los usa como lista cerrada). Solo se agregan condiciones nuevas si hacen falta |
| Siluetas | Las de los prototipos (`GEO`: incisivo, canino, premolar, molar). Un solo archivo de geometría para el odontograma y el periodontograma |
| Imprimir y PDF | Impresión del navegador (`usePrintDocument` + plantillas de `print-templates`). Sin Gotenberg ni PDF en el servidor |
| Cabecera guiada | Se **copia** `FlowHeader` y `SaveIndicator` de `aesthetic-session-sheet.tsx` en cada módulo. No se extrae un componente común |
| Tests | Ninguno hasta que se pidan. QA manual por fase |
| Idiomas | Claves nuevas en `en.json`, `es.json` y `es-ES.json`; fichas y guías del asistente en es y en |

---

## 1. Odontograma

### 1.1 Qué hay hoy

- **Datos:** tabla `sesiones` (`paciente_id`, `fecha_sesion`, `descripcion`, `notas`, `estado_odontograma` JSONB, `tratamientos` JSONB, `proximo_control_desc`, `fecha_proximo_control`, `doctor_id`, `appointment_id`, `invoice_id`). Cada sesión guarda **una foto completa** de la boca. Una sesión nueva arranca copiando la foto de la última.
- **Backend:** `POST upsert_odontogram` (en *Clinic History Workflows*) es un insert/update por mapeo de columnas, más la subida de imágenes a Drive. `estado_odontograma` es opaco para n8n: **se puede enriquecer desde el front sin tocar el flujo**.
- **Front:** `DentalRecordViewer` (927 líneas) con `OdontogramBoard`, `OdontogramTooth` (diagrama oclusal de 5 caras, sin silueta), `ProcedurePalette`, `ToothDetailCard`, `SessionForm` (título, notas, plan, próxima fecha, imágenes) y `SessionTimeline` (paginador). Se monta en 5 lugares: historia clínica (crear y ver), `patients/page`, `clinic-history/[user_id]/page` y Mi Consultorio (pestañas *Sesiones / Odontograma*).
- **Agente clínico:** `ai/doctor/query` (*Users Workflows*, nodo *Manager*) devuelve `abrir_odontograma` con `marcaciones: [{ diente, condicion, superficie }]`, usando los ids del catálogo. Hoy se aplican directo al odontograma (`applyMarcaciones`).
- **Cobro:** el Cobro Rápido ya acepta `sessionType: 'odontograma'`, `sessionId` y `preloadedItems`, y vincula la factura con `sesiones/link_invoice`.
- **Lectores de `estado_odontograma`:** historia clínica, agenda, historial de citas, `AppointmentFormDialog`, plantilla de impresión de la historia. Todos ignoran campos desconocidos, salvo `normalizeTooth()` en `odontogram-state.ts`, que hay que adaptar.
- **Código muerto:** `src/components/odontogram/index.tsx` (1.570 líneas) no se importa en ningún lado. El catálogo administrable `catalogo_condiciones_dentales` no lo usa el odontograma nuevo. Ninguno de los dos se toca en este trabajo.

### 1.2 Qué se toma de la especificación y qué no

**Se toma:** silueta con 5 caras y dentición mixta; vista FDI continua; vista Arcada marcable; vista Historial; inspector fijo con marcado en dos toques; *Registrar como* (indicado, existente, hecho hoy) con colores fijos; fichas frecuentes, buscador y categorías; pincel, borrador, deshacer y rehacer (60 pasos) y teclado; capas; barra de dictado con propuestas y bandeja de confirmación; sesión guiada (Examen → Plan → Tratamiento → Cierre) con estado calculado en el servidor, autoguardado, cierre y enmienda; plan por fases con precios del catálogo y presupuesto en Ventas; tratamiento con *Sesión 1 de N*, anestesia, material y evolución automática; cierre con Cobro Rápido, próxima cita e indicaciones.

**No se toma (por ahora):**

- Tabla de eventos `dental_chart_entries` con migración de datos. Se mantiene la foto por sesión con metadatos por marca (1.3). El historial y la auditoría salen de las fotos y de los eventos de la sesión.
- Tabla `dental_conditions`: el catálogo sigue en código. Solo se agrega el vínculo condición → servicio para los precios (O3).
- Riel de agenda de 64 px: el sheet ya ocupa casi todo el ancho; se evalúa después.
- Selector propio de días y huecos libres: se usa `AppointmentFormDialog` precargado, como en estética.
- UI propia de medios de pago, cuotas, moneda y vuelto: lo resuelve el Cobro Rápido.
- Mercado Pago QR, descuento de stock por lote, FHIR/SNOMED, planes alternativos, financiación.

### 1.3 Modelo de datos: `estado_odontograma` compatible

La foto sigue con la forma actual (`{ "16": { top, center, …, whole, overlays, notes } }`) y suma **campos opcionales** que los lectores viejos ignoran:

```jsonc
{
  "16": {
    "center": "caries", "right": "caries",            // como hoy
    "whole": "endo-indicated",
    "overlays": ["periapical-lesion"],
    "notes": "Dolor al morder",
    // ── nuevo, opcional ──
    "meta": {
      "center":  { "st": "indicated", "at": "2026-11-04T14:31:00Z", "by": "<uuid>", "src": "voice" },
      "whole":   { "st": "done", "stage": "partial", "sessions": 2, "at": "…", "by": "…" },
      "o:periapical-lesion": { "st": "indicated", "at": "…", "by": "…" }
    },
    "voided": [ { "slot": "whole", "condition": "crown", "reason": "Error de carga", "at": "…", "by": "…", "fromSession": "812" } ]
  },
  "24": { "whole": "bridge-defective", "meta": { "whole": { "st": "indicated", "range": "r1" } } },
  "25": { "whole": "bridge-defective", "meta": { "whole": { "st": "indicated", "range": "r1" } } },
  "26": { "whole": "bridge-defective", "meta": { "whole": { "st": "indicated", "range": "r1" } } }
}
```

**El estado sale de los ids que ya existen.** Cada condición del catálogo recibe un `defaultStatus` y, cuando existe, su **gemela**:

| Ficha | Indicado | Existente | Hecho hoy |
|---|---|---|---|
| Corona | `crown-indicated` | `crown` | `crown` + `st: done` |
| Endodoncia | `endo-indicated` | `endo-done` | `endo-done` + `st: done` |
| Implante | `implant-planned` | `implant-osseo` | `implant-osseo` + `st: done` |
| Exodoncia / ausente | `extraction-indicated` | `missing` | `missing` + `st: done` |
| Puente fijo | `bridge-in-progress` / `bridge-defective` | `fixed-prosth` | `fixed-prosth` + `st: done` |
| Restauración | `restoration-required`, `caries`, `caries-incipient` | `resin`, `amalgam`, `filling` | `resin` + `st: done` |
| Sin gemela (fractura, bracket, movilidad…) | `meta.st` | `meta.st` (por defecto del catálogo) | `meta.st` |

Reglas:

1. **Marca sin `meta`** (todas las sesiones de hoy): el estado es el `defaultStatus` de su id. Las sesiones viejas se ven igual que antes, solo que con los colores nuevos.
2. **Marca nueva:** se escribe el id gemelo que corresponde al modo elegido, y `meta` con estado, fecha, autor y origen. Así el agente, la impresión y la historia siguen entendiendo la marca aunque ignoren `meta`.
3. **Al crear la sesión siguiente** (copia de la última foto), `st: done` pasa a `existing` y se borran `stage`, `src` y `voided`: lo hecho hoy queda como existente.
4. **Borrar** una marca de hoy la saca de la foto. **Anular** una marca heredada la saca de la foto y deja una entrada en `voided` con motivo. El historial la muestra tachada.
5. **Rangos:** el puente se sigue guardando pieza por pieza (como hoy) y `meta.range` agrupa el rango. Para puentes viejos sin `range`, se toma como rango cada tramo contiguo de la misma condición en la arcada.
6. Las caras se siguen guardando como `top / bottom / left / right / center`. La conversión a V, P/L, M, D, O/I según la pieza ya existe en `odontogram-catalog.ts`.

No hace falta migrar datos ni cambiar el flujo para O1.

### 1.4 Dibujo de las condiciones existentes

`odontogram-catalog.ts` suma `render` a cada condición. Los dibujos salen del prototipo; el color lo da el estado (rojo indicado, azul existente, verde hecho hoy, violeta punteado propuesto).

| `render` | Condiciones |
|---|---|
| `surface` (relleno de la cara) | caries, caries-incipient, amalgam, resin, restoration-required, filling, sealant (centro tenue) y los legacy de cara |
| `crown` (corona rellena + anillo en el diagrama) | crown, crown-indicated, crown-tmp (anillo punteado), prosthesis |
| `canals` (línea por conducto) | endo-done, endo-indicated, endodontics |
| `post` (barra en la raíz) | post, post-fiber, root-post |
| `implant` (tornillo en lugar de la raíz) | implant-osseo, implant-planned, implant |
| `cross` (aspa; silueta atenuada si no está) | missing, extraction-indicated, edentulism |
| `bridge` (barra continua con pilares) | fixed-prosth, bridge-in-progress, bridge-defective |
| `fracture` (zigzag) | fracture, crown-fracture, ortho-fracture; root-fracture en la raíz |
| `apex` (círculo en el ápice) | periapical-lesion, root-resorption |
| `root-remnant` | root-remnant |
| `gum` (onda en el cuello) | gingival-recession, gingival-enlargement, perio-pocket |
| `badge` (letra o código en la silueta) | mobility-1/2/3 (M1–M3), furcation, bracket (cuadrado), y todos los de ortodoncia y patología sin dibujo propio, con su código corto |

### 1.5 Sesión guiada: lo nuevo en el backend (O2)

**Migración `162_<fecha>_dental-guided-session.sql`** (patrón de 155):

- Columnas nuevas en `public.sesiones`: `status` (`draft`, `examined`, `planned`, `in_treatment`, `ready_to_close`, `closed`, `void`), `completeness`, `flow_version` (las sesiones existentes quedan en 1 y **cerradas**), `anamnesis_reviewed`, `consult_only`, `plan_skipped`, `evolution_text`, `evolution_edited`, `procedures` JSONB (ítems de hoy: condición, pieza, caras, etapa, anestesia, material, nota, precio), `plan` JSONB (ítems con fase, precio, incluido, hoy, más `quote_id` y la aceptación), `charge_status` (`charged`, `cashier`, `account`, `none`), `next_status` (`booked`, `skipped`) y `next_appointment_id`, `closed_at` / `closed_by`, `voided_at` / `voided_by` / `void_reason`, `created_by` / `updated_by`.
- `public.dental_session_notes` (notas y enmiendas con hora y autor) y `public.dental_session_events` (marcas confirmadas, anulaciones, aceptación, cobro, cierre).
- Funciones: `dental_session_json(id)`, `dental_session_save(jsonb, uuid)` (la foto y los campos de los pasos, en una sola llamada de autoguardado), `dental_session_recompute(id)` (estado y completitud con las reglas de la especificación), `dental_session_close`, `dental_session_void`, `dental_session_note_add`. Todas rechazan escribir en sesiones cerradas o anuladas con `DENTAL:SESSION_CLOSED|…`.
- Permisos nuevos solo si hacen falta (firmar y enmendar); el resto usa los `ODONTOGRAM_*` que ya existen.
- Registro en `db_migrations`.

**Flujo n8n nuevo `docs/n8n-flows/flow-dental-session.json`**, un nodo Postgres por webhook, con el *Map error* de estética: `GET dental/sessions/get`, `POST dental/sessions/save`, `POST dental/sessions/close`, `POST dental/sessions/void`, `POST dental/notes/add`.

**Cambios chicos en flujos existentes:**

- `upsert_odontogram` se sigue usando para subir imágenes.
- *Filter patient sessions* (`patient_sessions`): sumar `status`, `completeness` y `invoice_id` en la rama de `sesiones` del `UNION`, para el chip de estado en la historia.
- Prompt del agente (*Manager*): sin cambios en O1–O2. Si se agrega una condición al catálogo, se suma también ahí.

Los flujos se importan a mano en n8n y las migraciones las corren ustedes; yo dejo los archivos.

### 1.6 Front

`src/components/users/dental-record/` (se reescribe por dentro; la API pública de `DentalRecordViewer` se mantiene mientras conviva con la sesión guiada):

| Archivo | Qué es |
|---|---|
| `tooth-geometry.ts` | **Nuevo, compartido con el periodontograma.** `GEO` del prototipo, conductos, tipo de pieza, orientación de caras |
| `odontogram-tooth.tsx` | Reescrito: silueta + 5 caras + dibujos de 1.4, `React.memo` |
| `odontogram-chart.tsx` | Vista FDI continua (permanente, mixta, temporal), selección múltiple, rango |
| `odontogram-arch.tsx` | Vista Arcada marcable (`placeArch` del prototipo), reemplaza la de `odontogram-board.tsx` |
| `odontogram-history.tsx` | Línea de tiempo de sesiones con la foto de cada una y lo anulado tachado |
| `tooth-inspector.tsx` | Inspector: diagrama grande, *Registrar como*, fichas, buscador, categorías, *En esta pieza*, notas; sin pieza, el contexto (cita, alertas, estado de la boca, notas generales) |
| `odontogram-toolbar.tsx` | Seleccionar, pincel, borrador, deshacer, rehacer |
| `dictation-bar.tsx` + `proposals-tray.tsx` | Barra con `VoiceRecorderButton`, parser local y, si queda texto sin entender, `ai/doctor/query`. Propuestas en los dientes y bandeja *Confirmar todo / Descartar* |
| `odontogram-state.ts` | Se extiende: `meta`, gemelas, anulación, rangos, paso a existente al copiar |
| `odontogram-catalog.ts` | Se extiende: `defaultStatus`, `twin`, `render`, `frequent`, categoría de la especificación |
| `use-odontogram-keyboard.ts` | Atajos (dos dígitos a la pieza, O/M/D/V/P/L/I, B, E, /, Esc, Ctrl+Z/Y) |
| `dental-session-sheet.tsx` + `dental-flow-context.tsx` + `session-status.ts` (O2) | Sheet guiado con la cabecera **copiada** de estética, autoguardado y estado |
| `step-exam.tsx`, `step-plan.tsx` (O3), `step-treatment.tsx`, `step-close.tsx` | Los cuatro pasos |
| `dental-timeline.tsx` (O2) | Tarjeta de la historia con chip de estado |

**Comportamiento del agente:** `open_odontogram` con `marcaciones` deja de aplicar directo. Las marcas entran como **propuestas** en la bandeja y `onAutoStartHandled` informa `applied: true` cuando quedan visibles. Nada dictado se guarda sin *Confirmar*.

**Dónde se abre (O2):** la sesión guiada reemplaza al sheet de crear y ver odontograma de la historia clínica. En Mi Consultorio, la pestaña *Odontograma* pasa a abrir la sesión odontológica de la cita. La sesión clínica simple sigue existiendo (es otra tabla), así que las pestañas no se pueden unir del todo: ver la decisión 1 en la sección 4.

### 1.7 Pasos 2 a 4

- **Plan (O3).** Nueva tabla `public.dental_condition_services` (`condition_id` texto del catálogo, `service_id`, `price_mode`: por pieza, por cara con adicional o por pieza del rango) y una pantalla en *Catálogo de la clínica → Condiciones dentales* para vincular cada condición con un servicio. Los ítems salen de las marcas indicadas con servicio vinculado. Fases automáticas editables. Al aceptar, se crea el presupuesto en Ventas (`quotes/upsert` + `quote/lines/upsert`, con número de pieza) y se confirma (`quote/confirm`). La firma en tablet usa una copia de `signature-pad.tsx` de estética. *Enviar para firmar* usa el flujo existente *Quote Confirmation or Rejection*.
- **Tratamiento (O2).** Ítems *Hoy* con *Pendiente · Sesión 1 de N · Realizado*, anestesia, material y nota. Sin plan (O2) los ítems salen de las marcas *hecho hoy*. Evolución redactada sola y editable. Adjuntos con el `upsert_odontogram` actual.
- **Cierre (O2).** Resumen e indicaciones (plantillas de indicaciones médicas existentes). Cobro con el Cobro Rápido: `preloadedItems` desde lo realizado, `sessionType: 'odontograma'`, y vínculo de la factura (ya existe). Próxima cita con `AppointmentFormDialog` precargado con la sugerencia. *Firmar y cerrar* con los mismos requisitos de la especificación; *Enmendar* con motivo. Impresión de la sesión con plantilla local.

---

## 2. Periodontograma

Igual que en el informe de factibilidad, con estos cambios:

- **Siluetas:** salen de `tooth-geometry.ts` (las mismas del odontograma, escaladas a mm).
- **Piezas desde el odontograma:** se lee la última foto: `missing` / `extraction-indicated` / `edentulism` → ausente; `implant-osseo` / `implant` → implante; dentro de un rango de puente (`meta.range` o tramo contiguo), los extremos son pilares (presentes) y las piezas del medio son **pónticos**. Se puede corregir por pieza en el examen. No hace falta una condición `pontic` nueva.
- **Cabecera:** copia de la de estética, con textos propios (`PerioRecord.flow.*`).
- **Sin Gotenberg ni Vitest.** El PDF del periodontograma es una plantilla de impresión local. El reporte al paciente por WhatsApp va como plantilla de texto en `communication_templates` (puntaje, sangrado, bolsas, indicación); si más adelante se quiere adjuntar un PDF, se genera en el navegador con `html2pdf.js`, que ya está en el proyecto.
- **Dictado:** el parser del prototipo (`parseDict`) corre en el cliente; si queda texto sin entender, se suma una acción al agente `ai/doctor/query`.

**Datos y backend:** migración `perio_exams`, `perio_teeth`, `perio_sites` (con `cal_mm` generado), `perio_exam_events` y, en P4, `perio_amendments`. Funciones `perio_*` y flujo `flow-perio-record.json`. Detalle en factibilidad, secciones 2 y 8.

**Front:** `src/components/users/perio-record/` (sheet, contexto, `PerioArch`, inspector, teclado, dock de tablet, atajos, tarjeta en la historia). Se quita el mock en `localStorage` (`periodontogram-view.tsx`, tipos `ToothPerioData` y la pestaña del `DentalRecordViewer`) en O1, porque el odontograma nuevo ya no tiene esa pestaña.

---

## 3. Entrega por fases

Estimación con Claude Code haciendo el código y QA manual (sin tests automáticos). Incluye 25 % de margen.

| Fase | Entrega | Backend | Dev (h) | QA (h) |
|---|---|---|---|---|
| **O1** · Odontograma nuevo | Silueta + 5 caras, FDI continua con mixta y temporal, Arcada, Historial, inspector de dos toques, *Registrar como* con `meta`, fichas, buscador, pincel, borrador, deshacer/rehacer, teclado, capas, dictado con propuestas (también las del agente), anulación con motivo. Reemplaza el interior de `DentalRecordViewer` en los 5 lugares donde se monta; el formulario de registro de abajo se mantiene (título, notas, plan, fecha, imágenes) | Ninguno | 42 | 10 |
| **O2** · Sesión odontológica guiada | Sheet con la cabecera copiada, estado en el servidor, autoguardado; pasos Examen, Tratamiento y Cierre (Cobro Rápido, próxima cita, indicaciones, firma, enmienda); tarjeta con estado en la historia; Mi Consultorio abre la sesión guiada; impresión local. El paso Plan se muestra como *no aplica* hasta O3 | Migración 162, flujo `flow-dental-session.json`, ajuste de `patient_sessions` | 46 | 12 |
| **O3** · Plan y presupuesto | Vínculo condición → servicio, plan por fases con precios, presupuesto en Ventas, aceptación con firma o WhatsApp | Migración de `dental_condition_services` + endpoints | 30 | 8 |
| **P1** · Sondaje | Exam, piezas desde el odontograma, pasadas, autoavance, examen guía, inspector, teclado y dock, autoguardado, tarjeta en la historia, firma mínima | Migración `perio_*`, flujo `flow-perio-record.json` | 50 | 12 |
| **P2** · Evolución | Deslizador, superponer, cambios, mapa, tendencias, listas, animación | — | 22 | 6 |
| **P3** · Diagnóstico y plan | Estabilidad, estadio, grado, riesgo, plan EFP a presupuesto; cigarrillos y HbA1c en la anamnesis | Migración de anamnesis | 30 | 8 |
| **P4** · Cierre | Cobro Rápido, cita, impresión, reporte por WhatsApp (texto), enmiendas | `communication_templates`, `perio_amendments` | 22 | 6 |
| **P5** · Extras | Dictado con agente, recordatorio por `alert_rules`, PSR/BPE, solo implantes, configuración por clínica | Flujo de alertas | 26 | 8 |
| **Total** | | | **268** | **70** |

A USD 20/h de desarrollo y 10/h de QA: unos USD 6.060 (odontograma unos 2.140; periodontograma unos 3.920). Al terminar cada fase: `pnpm typecheck && pnpm lint`, `pnpm knowledge:build`, capturas en claro y oscuro y la lista de lo que hay que importar o correr en n8n y en la base.

---

## 4. Decisiones (respondidas el 5 nov 2026)

1. **Mi Consultorio:** se elige de qué tipo es la sesión a registrar (odontológica, clínica simple, estética y, desde P1, periodontograma) en lugar de las dos pestañas.
2. **Sesiones de odontograma existentes:** al llegar O2 quedan cerradas (`flow_version = 1`); se pueden ver y enmendar.
3. **Botón flotante del agente:** se oculta mientras la sesión odontológica está abierta, y queda un acceso en la interfaz que abre el agente en Mi Consultorio.
4. **Color de marcas legacy:** existente (azul), salvo fracturas, lesión periapical y reabsorción, que van como indicadas (rojo). Ya aplicado en O1.

**Ajustes de O1 pedidos después de la primera revisión:** la sesión tiene dos pasos (1 marcar el odontograma, 2 registrar la sesión con el formulario); los pasos, *Cancelar* y *Continuar* van en la cabecera del sheet; el paso 1 entra en la ventana sin scroll de página (el gráfico y el inspector se desplazan por dentro); los resultados de búsqueda y categorías del inspector ocupan el lugar de las fichas.

## 5. Riesgos

| Riesgo | Mitigación |
|---|---|
| Un lector de `estado_odontograma` que no conozco (por ejemplo en n8n) choca con `meta` o `voided` | Son campos opcionales dentro de cada pieza; los lectores del repo ya los ignoran. Revisar el agente con una sesión de prueba antes de liberar O1 |
| Cambiar el color por estado confunde a quien usaba los colores del catálogo | La leyenda queda siempre visible; el código corto de cada condición se sigue viendo en la pieza |
| `dental-record-viewer.tsx` y `clinic-history-viewer.tsx` son grandes y los tocan otras ramas | O1 cambia el interior del visor sin cambiar su API; la historia solo cambia en O2 (sheet y tarjeta) |
| Rendimiento del SVG en tablet (32 piezas × silueta + caras) | `React.memo` por pieza; cada marca re-renderiza una sola pieza |
| El cálculo de estado en SQL y en la cabecera no coinciden | La cabecera muestra lo calculado en el cliente mientras viaja el autoguardado y lo reemplaza con lo del servidor, como en estética |
