# Plan: Plantillas de Indicaciones Médicas + Indicación al Paciente

## 1. Contexto y objetivo

Se quiere agregar la capacidad de crear **plantillas reutilizables de indicaciones médicas** (texto con formato + variables dinámicas como nombre del paciente, clínica, fecha, etc.) y, desde la **historia clínica del paciente**, poder generar una **indicación médica concreta** a partir de una de esas plantillas, con los datos del paciente/doctor/pieza ya inyectados, editable antes de guardar, y con opción de imprimir — pudiendo reimprimirse más adelante exactamente igual a como quedó guardada.

## 2. Estado actual del proyecto (hallazgos de la investigación)

### 2.1 No existe hoy un sistema de indicaciones médicas / recetas

- El único vestigio es `Service.indications` (`src/lib/types.ts:426-442`): campo de texto plano por servicio del catálogo, sin variables ni formato, usado como instrucción pre-cita (ej. "cepillarse antes de la cita").
- Existe un `eventType: 'prescription'` en `src/components/users/medical-history.tsx`, pero **este componente está huérfano**: no se renderiza en ningún lugar del árbol de componentes actual (solo referenciado en i18n y en un tipo de permisos). No tiene CRUD real, ni plantilla, ni backend de recetas.
- El timeline **real y activo** del expediente del paciente es `src/components/users/clinic-history-viewer.tsx` (exporta `ClinicHistoryViewer`, `AnamnesisViewer`, `DocumentsViewer`), montado dentro de `PatientDetailSheetMainContent` → `src/components/appointments/PatientDetailSheet.tsx`. Este es el punto de integración correcto para el nuevo botón.

### 2.2 Sistemas de plantillas existentes (referencia arquitectónica)

**A) `/config/templates`** (`src/app/[locale]/config/templates/page.tsx`, 672 líneas)

- Hub central de plantillas de impresión/email/WhatsApp (facturas, presupuestos, pagos, recordatorios de cita).
- Editor: **Monaco Editor** (`@monaco-editor/react`) para HTML crudo — pensado para documentos de facturación, no para contenido clínico simple.
- Tipo: `DocPrintTemplate` (`src/lib/types.ts:322-330`).
- Rutas: `PRINT_TEMPLATES`, `PRINT_TEMPLATES_UPSERT`, `PRINT_TEMPLATES_DELETE` (`src/constants/routes.ts:381-383`).
- Permisos: `BUSINESS_CONFIG_PERMISSIONS.PRINT_TEMPLATES_VIEW/EDIT`.

**B) `/system/communication-templates`** (`src/app/[locale]/system/communication-templates/page.tsx`, 728 líneas) — **patrón elegido como base**

- CRUD de `CommunicationTemplate` (tipo `EMAIL | SMS | DOCUMENT | WHATSAPP`), ligado a categorías de alertas.
- Tipo: `src/lib/types.ts:1413-1429`.
- Rutas: `COMMUNICATION_TEMPLATES`, `COMMUNICATION_TEMPLATE`, `COMMUNICATION_HISTORY` (`src/constants/routes.ts:312-314`).
- **Editor**: no usa librería WYSIWYG. Usa un `<Textarea className="font-mono">` con botones que envuelven la selección con tags HTML:

  ```ts
  const insertText = (text: string) => {
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = currentText.substring(0, start) + text + currentText.substring(end);
    form.setValue('body_html', newText, { shouldValidate: true });
    // reposiciona cursor
  };

  const wrapText = (wrapper: [string, string]) => {
    const selectedText = textarea.value.substring(start, end);
    const newText = `${before}${wrapper[0]}${selectedText}${wrapper[1]}${after}`;
    form.setValue('body_html', newText, { shouldValidate: true });
  };
  ```

- Catálogo de variables agrupado (`getAvailableVariables(t)`, líneas 126-142) con notación `{{grupo.campo}}`, insertado vía `DropdownMenu` (botón "Variables", icono `Code2`).
- Vista previa vía `dangerouslySetInnerHTML` resaltando tokens.
- Interpolación real: `src/hooks/useCommunicationTemplates.ts` expone `substituteTokens(text, vars)` con regex `/\{\{(\w+)\}\}/g`.

### 2.3 No hay ningún editor WYSIWYG instalado

Confirmado en `package.json`: el único editor de código es `@monaco-editor/react`. No hay TipTap, Slate, react-quill, Draft.js, ni Lexical. **Decisión: no se agrega ninguna dependencia nueva** — se reutiliza el patrón de Textarea + toolbar + preview del punto 2.2-B, extraído a un componente compartido.

### 2.4 Flujo de impresión con datos reales (`usePrintDocument`)

- Hook `src/hooks/usePrintDocument.ts`: al iniciar sesión, precarga plantillas custom activas por `template_type` en el store zustand `usePrintDocumentStore`.
- Componente que resuelve HTML + variables: `src/components/print-templates/custom-template-renderer.tsx` (`CustomTemplateRenderer`). La interpolación es **100% frontend**, vía regex sobre `{{variable}}`, construyendo un mapa `values` (incluye tablas HTML armadas a mano para ítems/pagos) y reemplazando con `html.replace(/\{\{(\w+)\}\}/g, ...)`.
- Para "indicaciones médicas" **no hace falta enganchar este store completo**: el contenido ya viene resuelto y guardado (`content_html` final) en `PatientMedicalInstruction`, así que reimprimir es solo volver a renderizar ese HTML guardado con el membrete de clínica, sin recalcular variables.

### 2.5 Piezas dentales (numeración FDI)

- El proyecto usa notación **FDI** de forma consistente (`src/components/users/dental-record/odontogram-canvas.tsx`: cuadrantes 1-4 permanentes 11-48, cuadrantes 5-8 temporales 51-85).
- No existe un `<Select>` dedicado de "elegir diente": se usa **input numérico validado** con rango FDI completo. Ejemplo en `src/components/sales/quotes/QuoteFormDialog.tsx`:

  ```ts
  tooth_number: z.coerce.number().int()
    .min(11, t('validation.toothNumberMin'))
    .max(85, t('validation.toothNumberMax'))
    .optional().or(z.literal('')),
  ```

- Mismo patrón a replicar para el campo "pieza" de la indicación médica (opcional).

### 2.6 Selección de doctor en formularios existentes

Patrón consolidado en `src/components/clinic-session-dialog.tsx`:

- `ensureDoctorOption(nextDoctors, currentDoctorId, currentDoctorName)` — garantiza que el doctor actualmente asignado siga apareciendo como opción aunque ya no esté activo/en la lista.
- Fetch: `api.get(API_ROUTES.USERS_DOCTORS)`.
- `<Select>` con `doctorOptions` memoizado, soporte `lockDoctor` para deshabilitar el campo cuando el doctor viene prefijado.
- Guarda `doctor_id` + `doctor_name` denormalizado — mismo patrón que `PatientSession`.

### 2.7 Modelo de referencia: `PatientSession`

`src/lib/types.ts:893` — mejor modelo de referencia para "indicación médica del paciente": fecha, doctor (`doctor_id`/`doctor_name`), notas de texto libre, referencia opcional a diente (`numero_diente`), vínculo opcional a sesión/cita origen.

### 2.8 Patrón "seleccionar plantilla → cargar → interpolar → editar antes de usar"

Ya existe y está bien establecido en `src/components/whatsapp-composer-dialog.tsx` (y análogamente `email-composer-dialog.tsx`):

```ts
const commTemplates = useCommunicationTemplates();
const [message, setMessage] = React.useState('');

React.useEffect(() => {
  if (!open) { setMessage(''); return; }
  const vars = { patient_name: recipientName || '', clinic_name: clinic?.name || '', ... };
  const tpl = commTemplates['TREATMENT_INTERRUPTED_WHATSAPP'];
  setMessage(substituteTokens(tpl?.body_text || DEFAULT, vars));
}, [open, clinic, commTemplates, recipientName, treatmentContext]);
```

Al abrir el diálogo se busca la plantilla, se interpola contra variables reales del contexto, y el resultado se vuelca a un campo editable antes de la acción final (enviar/guardar). **Este es el patrón exacto a replicar** para "cargar plantilla de indicación médica → precargar con datos reales → permitir edición → guardar/imprimir".

## 3. Decisiones tomadas

| Decisión | Resolución |
|---|---|
| Editor de texto | Reutilizar el patrón Textarea + toolbar (wrap/insert) + preview de `communication-templates/page.tsx`, extraído a componente compartido. **Sin dependencias nuevas.** |
| Ubicación | Sección nueva independiente, desacoplada de `Service.indications` y `CommunicationTemplate`. |
| Punto de integración en el paciente | `clinic-history-viewer.tsx` / `PatientDetailSheet.tsx` (timeline real), NO `medical-history.tsx` (huérfano). Patrón de "trigger counters" existente (`createSessionTrigger`, `createOdontogramTrigger`, `createDocumentTrigger`) → se agrega `createMedicalInstructionTrigger`. |
| Permisos | **Separados**: gestión de plantillas (config) vs. creación de indicación a un paciente (uso clínico diario). |
| Persistencia de la indicación impresa | Se guarda el **HTML final ya interpolado** (`content_html`) en `PatientMedicalInstruction`, no un archivo/PDF adjunto. Reimprimir = renderizar ese HTML guardado, sin recalcular variables. |
| Pieza dental | Input numérico opcional, rango FDI 11-85, mismo patrón de validación que `QuoteFormDialog`. |
| Doctor | Select con `ensureDoctorOption` + `api.get(API_ROUTES.USERS_DOCTORS)`, patrón de `clinic-session-dialog.tsx`. |

## 4. Modelo de datos

```ts
// Plantilla maestra reutilizable
export type MedicalInstructionTemplate = {
  id?: string;
  name: string;
  description?: string;
  content_html: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

// Indicación concreta generada para un paciente
export type PatientMedicalInstruction = {
  id?: string;
  patient_id: string;
  fecha: string;                    // ver skill date-formatting
  numero_diente?: number | null;    // FDI 11-85, opcional
  doctor_id: string | null;
  doctor_name?: string;             // denormalizado
  template_id?: string;             // plantilla origen (solo referencia)
  template_name?: string;
  content_html: string;             // contenido YA resuelto — fuente de verdad para reimpresión
  created_at?: string;
  updated_at?: string;
};
```

## 5. Rutas API (a confirmar con backend)

Siguiendo el patrón de `CLINIC_HISTORY` / `PRINT_TEMPLATES` en `src/constants/routes.ts`:

```ts
// Plantillas maestras
MEDICAL_INSTRUCTION_TEMPLATES: '/medical-instruction-templates',
MEDICAL_INSTRUCTION_TEMPLATES_UPSERT: '/medical-instruction-templates/upsert',
MEDICAL_INSTRUCTION_TEMPLATES_DELETE: '/medical-instruction-templates/delete',

// Indicaciones del paciente
PATIENT_MEDICAL_INSTRUCTIONS: '/patient-medical-instructions',              // list por patient_id
PATIENT_MEDICAL_INSTRUCTIONS_UPSERT: '/patient-medical-instructions/upsert',
PATIENT_MEDICAL_INSTRUCTIONS_DELETE: '/patient-medical-instructions/delete',
```

## 6. Catálogo de variables + leyenda

Nuevo archivo `src/lib/medical-instruction-template-variables.ts`, reutilizando el tipo `PrintTemplateVariable` ya existente (`src/lib/print-template-variables.ts`), agrupado en `patient`, `clinic`, `doctor`, `date`, `tooth` (ej. `{{patient_name}}`, `{{clinic_name}}`, `{{doctor_name}}`, `{{today_date}}`, `{{tooth_number}}`). La leyenda se muestra junto al editor (panel/dropdown con descripción de cada variable), igual que en `communication-templates/page.tsx`.

## 7. Editor compartido

`src/components/medical-instructions/instruction-rich-text-editor.tsx` — extracción del patrón `insertText` / `wrapText` / preview de `communication-templates/page.tsx`, parametrizable con el catálogo de variables correspondiente. Se reutiliza en:

- El CRUD de la plantilla maestra (variables sin resolver, ej. `{{patient_name}}`).
- El diálogo de indicación al paciente (contenido ya interpolado con datos reales, editable libremente).

## 8. Permisos

```ts
// Gestión de plantillas (config)
MEDICAL_INSTRUCTION_TEMPLATES_VIEW
MEDICAL_INSTRUCTION_TEMPLATES_CREATE
MEDICAL_INSTRUCTION_TEMPLATES_UPDATE
MEDICAL_INSTRUCTION_TEMPLATES_DELETE

// Uso clínico diario (crear indicación a un paciente)
PATIENT_MEDICAL_INSTRUCTIONS_VIEW
PATIENT_MEDICAL_INSTRUCTIONS_CREATE
PATIENT_MEDICAL_INSTRUCTIONS_UPDATE
PATIENT_MEDICAL_INSTRUCTIONS_DELETE
```

Seguir la skill `permissions-protection` al implementar (`usePermissions()`, `<Can>`, guardas en nav).

## 9. Flujo funcional completo

1. **Gestión de plantillas** (`/config/medical-instruction-templates`, nueva página): CRUD de `MedicalInstructionTemplate` con el editor compartido + catálogo de variables sin resolver, siguiendo el patrón de `communication-templates/page.tsx` (tabla + diálogo).
2. **Botón "Nueva indicación médica"** en `clinic-history-viewer.tsx` (patrón trigger-counter) → abre `PatientMedicalInstructionDialog`.
3. Campos del diálogo:
   - **Fecha** (date picker, según skill `date-formatting`).
   - **Pieza** (input numérico FDI opcional).
   - **Doctor** (Select con `ensureDoctorOption`).
   - **Plantilla** (Select de `MedicalInstructionTemplate` activas).
4. Al elegir una plantilla: se toma `template.content_html`, se interpola con `substituteTokens` contra un mapa de variables reales (`patient_name`, `clinic_name`, `doctor_name`, `tooth_number`, `date`, etc. — mismo mecanismo que `whatsapp-composer-dialog.tsx`), y el resultado precarga el editor compartido.
5. El usuario **edita libremente** el contenido ya interpolado (no afecta la plantilla maestra).
6. **Guardar** → persiste `PatientMedicalInstruction` con `content_html` final → aparece como nueva entrada en el timeline del historial clínico.
7. **Imprimir** (en el momento de creación o después, reabriendo la indicación guardada) → renderiza `content_html` tal cual está guardado, con membrete de clínica/paciente (misma convención visual que `custom-template-renderer.tsx`, sin necesidad de reinterpolar ni de engancharse al store `usePrintDocumentStore`) → `window.print()`.

## 10. Archivos a crear / modificar

| Archivo | Acción |
|---|---|
| `src/lib/types.ts` | Agregar `MedicalInstructionTemplate`, `PatientMedicalInstruction` |
| `src/constants/routes.ts` | Agregar rutas de sección 5 |
| `src/constants/permissions.ts` | Agregar permisos de sección 8 |
| `src/lib/medical-instruction-template-variables.ts` | Nuevo — catálogo de variables |
| `src/components/medical-instructions/instruction-rich-text-editor.tsx` | Nuevo — editor compartido |
| `src/app/[locale]/config/medical-instruction-templates/page.tsx` | Nuevo — CRUD de plantillas maestras |
| `src/components/medical-instructions/patient-instruction-dialog.tsx` | Nuevo — diálogo de creación/edición de indicación al paciente |
| `src/components/medical-instructions/patient-instruction-print-view.tsx` | Nuevo — vista imprimible del `content_html` guardado |
| `src/components/users/clinic-history-viewer.tsx` | Modificar — agregar entrada de tipo indicación al timeline + botón |
| `src/components/appointments/PatientDetailSheet.tsx` | Modificar — agregar `createMedicalInstructionTrigger` |
| `src/config/nav.ts` | Agregar entrada de navegación para el CRUD de plantillas |
| `src/messages/es.json` / `en.json` | Agregar strings nuevos |

## 11. Orden de implementación propuesto

1. Tipos + rutas + permisos.
2. Editor compartido (`instruction-rich-text-editor.tsx`) + catálogo de variables.
3. CRUD de plantillas maestras (`/config/medical-instruction-templates`).
4. Integración en historial del paciente: diálogo de indicación + impresión.

## 12. Puntos pendientes de confirmar con backend

- Confirmar que los endpoints propuestos en la sección 5 no colisionan con convenciones ya acordadas del backend (nombres exactos, paginación, filtros).
- Confirmar si `PatientMedicalInstruction` debe además aparecer en algún reporte/export existente del expediente del paciente.
