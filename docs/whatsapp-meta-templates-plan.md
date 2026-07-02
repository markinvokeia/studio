# Plan — Migración de plantillas de WhatsApp a la API oficial de Meta (vía YCloud)

Fecha: 2026-07-01

## Objetivo

Hoy el envío de WhatsApp se hace con la API pública `wa.me`: se arma un link con texto libre (editable por el agente) y se abre WhatsApp Web/App para que la persona toque "Enviar" manualmente. El backend va a pasar a usar la **API oficial de Meta (Cloud API) a través de YCloud**, que exige otro modelo de trabajo:

- Para iniciar una conversación (fuera de la ventana de 24h de sesión) el mensaje **debe** referenciar una plantilla previamente creada y **aprobada por Meta** — no se puede enviar texto libre.
- Una plantilla aprobada tiene **texto fijo** con variables **posicionales** (`{{1}}`, `{{2}}`, ...), no variables nombradas libres.
- El formato soportado es el markdown propio de WhatsApp (`*negrita*`, `_cursiva_`, `~tachado~`), **no HTML**.
- Cada plantilla tiene `name` (identificador único en Meta), `language` (ej. `es`, `es_MX`) y `category` (`MARKETING` / `UTILITY` / `AUTHENTICATION`), y un `status` de aprobación (`PENDING` / `APPROVED` / `REJECTED`) que gestiona Meta, no nosotros.
- Crear/editar el *contenido* de una plantilla deja de tener sentido en la app: se hace manualmente en Meta Business Manager y hay que esperar aprobación (horas/días).

La idea es **no duplicar** la gestión de plantillas: seguir usando el catálogo (`communication_templates`) que ya existe para EMAIL/SMS/DOCUMENT, pero para `type = WHATSAPP` cambiar su rol — de "contenido editable que se envía tal cual" a **"catálogo espejo" de lo que ya está aprobado en Meta**, agregando los metadatos que la API necesita para poder enviar.

---

## 1. Estado actual del código

| Pieza | Ubicación | Lo que hace hoy |
|---|---|---|
| Tabla / tipo `CommunicationTemplate` | `src/lib/types.ts:1410` | `type: 'EMAIL' \| 'SMS' \| 'DOCUMENT' \| 'WHATSAPP'`, `variables_schema: any` (siempre `"{}"` en producción, sin usar), `body_html`, `body_text`, `is_active`, `version`. |
| Registros reales en BD | — | **No existe ningún registro con `type = "WHATSAPP"`.** Todos los templates persistidos hoy son `EMAIL`/`SMS`, con tokens namespaced tipo `{{patient.full_name}}`, `{{clinic.name}}`, `{{appointment.date}}`, `{{data.id}}`. |
| Defaults de WhatsApp | `src/lib/whatsapp-template-defaults.ts` | 4 plantillas **hardcodeadas en el frontend** (`whatsapp_patient_general`, `whatsapp_alert_followup`, `whatsapp_appointment_reminder`, `whatsapp_treatment_interrupted`) con tokens simples (`{{patient_name}}`, no namespaced). Se usan como fallback. |
| Carga de templates | `src/hooks/useCommunicationTemplates.ts` | `useCommunicationTemplates()` trae todo `COMMUNICATION_TEMPLATES` y cachea por `code`. `substituteTokens(text, vars)` hace reemplazo simple por regex `{{key}}`. |
| Composer de WhatsApp | `src/components/whatsapp-composer-dialog.tsx` | Busca template por `code` (`PATIENT_GENERAL_WHATSAPP`, `TREATMENT_INTERRUPTED_WHATSAPP`), sustituye tokens, pone el resultado en un `Textarea` **editable libremente**, y al confirmar abre `https://wa.me/{phone}?text=...`. No hay llamada a backend. |
| Composer de alertas WhatsApp | `src/components/alerts/alert-whatsapp-composer-dialog.tsx` | Mismo patrón (no revisado en detalle, asumir análogo). |
| Admin de plantillas | `src/app/[locale]/system/communication-templates/page.tsx` | CRUD genérico para las 4 `type`. El editor de cuerpo (`body_html`) tiene toolbar que inserta **HTML** (`<strong>`, `<em>`, `<ul>`) — pensado para EMAIL, no aplica a WhatsApp. El selector de variables usa grupos `patient` / `clinic` / `data` con tokens nombrados. |

---

## 2. Qué cambia y qué no

### No cambia

- El modelo genérico de `communication_templates` sigue sirviendo como catálogo único multi-canal.
- Los templates `EMAIL`, `SMS`, `DOCUMENT` no se tocan — su flujo de texto libre + tokens nombrados sigue siendo válido porque no dependen de aprobación externa.
- La estructura de permisos (`ALERT_TEMPLATES_VIEW_LIST/CREATE/UPDATE/DELETE`) se mantiene igual.

### Cambia (solo para `type = WHATSAPP`)

- El `body_text` deja de ser "lo que se envía" y pasa a ser **preview/espejo de lo aprobado en Meta** — de solo lectura una vez que el status es `APPROVED`.
- Se necesita guardar el **orden posicional** de las variables (para traducir tokens nombrados → `{{1}}`, `{{2}}`...).
- Se necesita guardar `meta_template_name`, `meta_language`, `meta_category`, `meta_status`.
- El envío deja de ser "abrir wa.me con texto editado a mano" y pasa a ser una llamada real al backend, que arma el request a YCloud con el nombre de plantilla + parámetros posicionales.
- El editor de cuerpo, para WhatsApp, debe usar markdown de WhatsApp (`*`, `_`, `~`) en vez de HTML, y probablemente debe ser de solo lectura/informativo en vez de editable libremente (el contenido real vive en Meta).

---

## 3. Cambios de esquema (BD)

Como **no existen filas WHATSAPP hoy**, no hay migración de datos que romper — solo hay que definir el esquema antes de crear las primeras.

### Reutilizar columnas existentes

- **`variables_schema` (jsonb, hoy sin usar):** pasa a guardar el array ordenado de tokens, que define el mapeo posicional. Ejemplo para `APPOINTMENT_REMINDER_WHATSAPP`:

  ```json
  ["patient.full_name", "appointment.date", "appointment.time", "appointment.doctor_name"]
  ```

  El índice + 1 de cada entrada es la posición `{{n}}` que espera Meta. Esto evita tener que inventar una columna nueva solo para esto.
- **`body_text`:** sigue guardando el texto legible con tokens nombrados (`{{patient.full_name}}`, etc.), usado para preview en el admin y en el composer. Para WHATSAPP, debe coincidir exactamente (salvo los propios tokens) con el texto aprobado en Meta.
- **`is_active`:** sigue significando "disponible para usarse en la app" (independiente del estado de aprobación en Meta).

### Columnas nuevas (solo relevantes cuando `type = WHATSAPP`, nullable para no afectar otros tipos)

| Columna | Tipo | Propósito |
|---|---|---|
| `meta_template_name` | `varchar` | Nombre exacto registrado en Meta Business Manager. Puede no coincidir con `code` (que es el identificador interno). |
| `meta_language` | `varchar` | Código de idioma exigido por Meta (`es`, `es_MX`, `en`, ...). |
| `meta_category` | `varchar` / enum | `MARKETING` \| `UTILITY` \| `AUTHENTICATION`. Afecta costo por conversación y reglas de envío (ventanas, límites). |
| `meta_status` | `varchar` / enum | `PENDING` \| `APPROVED` \| `REJECTED`. Gestionado manualmente al principio (no hay webhook de YCloud confirmado); a futuro puede sincronizarse. |

Migración: `ALTER TABLE communication_templates ADD COLUMN meta_template_name varchar NULL, ADD COLUMN meta_language varchar NULL, ADD COLUMN meta_category varchar NULL, ADD COLUMN meta_status varchar NULL DEFAULT 'PENDING';`

---

## 4. Cambios en frontend

### 4.1 Tipos (`src/lib/types.ts:1410`)

Agregar los 4 campos opcionales a `CommunicationTemplate`, y tipar `variables_schema` como `string[]` en vez de `any` cuando `type === 'WHATSAPP'` (a nivel de uso, no es necesario un discriminated union completo).

### 4.2 Admin de plantillas (`system/communication-templates/page.tsx`)

- Condicionar la UI de edición de cuerpo por `type`:
  - Si `type !== 'WHATSAPP'`: comportamiento actual (HTML + toolbar `<strong>`/`<em>`/`<ul>`).
  - Si `type === 'WHATSAPP'`: toolbar de markdown de WhatsApp (`*texto*`, `_texto_`, `~texto~`), sin HTML; y mostrar los campos nuevos (`meta_template_name`, `meta_language`, `meta_category`, badge de `meta_status`).
- Si `meta_status !== 'APPROVED'`, mostrar aviso visual ("plantilla pendiente de aprobación en Meta, no puede usarse para enviar") y deshabilitar su uso en los composers.
- El selector de variables (`getAvailableVariables`) ya usa grupos `patient`/`clinic`/`data` — se reutiliza igual para insertar tokens en `body_text`; al guardar, derivar `variables_schema` a partir del orden en que aparecen los tokens en el texto (o dejar que el usuario los reordene si hace falta soporte para repetir variables).

### 4.3 Retiro de defaults hardcodeados (`whatsapp-template-defaults.ts`)

- Los 4 templates hardcodeados pasan a ser el **seed inicial** de las filas WHATSAPP en BD (con sus tokens actualizados al formato namespaced `patient.name`, `clinic.name`, etc. para ser consistentes con EMAIL/SMS) — no se listan más aparte, todo pasa por `useCommunicationTemplates()`.
- Mantener el archivo únicamente como fallback de emergencia (si el backend no responde) es opcional; si se decide quitarlo, `whatsapp-composer-dialog.tsx` y `alert-whatsapp-composer-dialog.tsx` deben ajustarse para no referenciarlo.

### 4.4 Composer (`whatsapp-composer-dialog.tsx`, `alerts/alert-whatsapp-composer-dialog.tsx`)

Cambio de fondo: de "editar texto libre y abrir wa.me" a "completar variables y enviar por API".

- Quitar el `Textarea` editable libre. En su lugar:
  - Mostrar el `body_text` de la plantilla como **preview de solo lectura** con los tokens resaltados (mismo patrón que ya existe en el preview del admin, línea ~700-706 de `communication-templates/page.tsx`).
  - Generar dinámicamente un campo de input por cada variable en `variables_schema` que no se pueda derivar automáticamente del contexto (paciente/cita/clínica ya conocidos no necesitan input; algo como un campo libre sí).
- Quitar `window.open('https://wa.me/...')`. En su lugar, llamar a un endpoint nuevo del backend (ej. `API_ROUTES.WHATSAPP.SEND`) que reciba `{ phone, meta_template_name, meta_language, parameters: string[] }` y sea el backend quien arme la llamada a YCloud.
- Manejar estado de envío real (pending/sent/failed) en vez de solo "se abrió la ventana" — hoy `isOpening` asume que basta con abrir el link; con la API real hay que esperar respuesta del backend y mostrar error si YCloud rechaza el envío (ventana de 24h cerrada, plantilla no aprobada, número inválido, etc.).
- Normalización de teléfono: ya existe (`normalizedPhone`), pero para la API oficial hay que validar formato E.164 estricto (no basta con quitar `+` y no-dígitos).

### 4.5 Nueva ruta de API

Agregar en `src/constants/routes.ts` el endpoint de envío (ej. `WHATSAPP.SEND`), y en `src/services/api.ts` el método correspondiente, siguiendo el patrón existente de wrapping con Bearer token.

---

## 5. Fuera de alcance de este plan (decisiones pendientes, a validar con backend)

- Si YCloud expone webhook de estado de aprobación de plantillas, para sincronizar `meta_status` automáticamente en vez de editarlo a mano.
- Si se permite texto libre para respuestas dentro de la ventana de 24h de sesión activa (mensaje de sesión, no de plantilla) — de ser así, el composer actual (editable) seguiría teniendo sentido pero **solo** en ese caso, con un flag que distinga "mensaje de plantilla" vs "mensaje de sesión".
- Manejo de multimedia/botones en plantillas (Meta soporta header con imagen, botones de quick-reply/URL) — no contemplado aquí porque las 4 plantillas actuales son solo texto.
- Traducción de las plantillas EMAIL/SMS existentes al mismo esquema no aplica — solo WHATSAPP tiene la restricción de aprobación externa.

---

## 6. Orden sugerido de implementación

1. Migración de BD: columnas nuevas en `communication_templates`.
2. Seed de las 4 plantillas WhatsApp actuales como filas reales (status `PENDING` hasta que se den de alta y aprueben en Meta).
3. Endpoint backend de envío vía YCloud + ruta en `constants/routes.ts`.
4. Ajustes en `communication-templates/page.tsx` (UI condicional por tipo, campos meta, badge de estado).
5. Reescritura de `whatsapp-composer-dialog.tsx` y `alert-whatsapp-composer-dialog.tsx` (preview de solo lectura + inputs de variables + llamada a backend).
6. Retiro (o degradación a fallback) de `whatsapp-template-defaults.ts`.
