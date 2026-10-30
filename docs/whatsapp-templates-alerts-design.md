# Diseño: envío de plantillas de WhatsApp desde Alertas (extensible)

**Estado:** propuesta / no implementado
**Fecha:** 2026-07-21
**Relacionado con:** `feat: add WhatsApp template sending functionality for patient reminders` (d525f46c)

## 1. Problema

Hoy existen dos caminos distintos para enviar WhatsApp, y no están unificados:

1. **Flujo "template send" (real, vía WhatsApp Business API / YCloud)** — `src/components/patients/whatsapp-template-send-dialog.tsx` → `POST /patients/send_whatsapp_template` con `{ id, template_code, appointment_id? }`. El backend (n8n) resuelve todos los datos y arma el envío server-side. Solo soporta 3 `template_code` hardcodeados (`birthday`, `appointment_reminder`, `invoice_due`), cada uno con un nodo de código dedicado en n8n que hace queries específicas y arma el array de parámetros a mano.
2. **Flujo "composer" (legacy, texto libre)** — `src/components/alerts/alert-whatsapp-composer-dialog.tsx` y `src/components/whatsapp-composer-dialog.tsx`. Leen `CommunicationTemplate.body_text`, sustituyen `{{var}}` con `substituteTokens()`, y abren `wa.me/...?text=...` en una pestaña nueva. No hay llamada a API, ni registro de la acción, ni validación contra Meta. Esto es además cuestionable a mediano plazo: fuera de la ventana de servicio de 24h, Meta no permite texto libre — solo plantillas aprobadas.

Las **alertas** hoy solo usan el flujo #2. El objetivo de este documento es diseñar cómo las alertas pasan a usar el flujo #1, y cómo hacer que el flujo #1 sea extensible: **agregar un template nuevo no debería requerir cambios de código en frontend ni backend**, solo configuración.

### 1.1 Por qué el diseño actual no escala

Agregar un 4º template hoy requiere:

- Backend: un nuevo `case` en el switch de n8n, con un nuevo nodo de código que sabe qué tabla consultar y arma el array de parámetros en el orden correcto.
- Frontend: extender el enum `WhatsAppTemplateCode` y la UI que lo usa.

El problema no es solo "dónde vive el nombre del template de Meta" — es sobre todo **de dónde salen los valores que rellenan las variables**, y en qué orden/nombre van.

### 1.2 Dato nuevo que cambia el diseño: variables con nombre

Al inspeccionar la respuesta real de YCloud para un template (`invoice_due`), las variables son **nombradas**, no posicionales:

```json
{
  "name": "invoice_due",
  "language": "es",
  "status": "APPROVED",
  "components": [
    {
      "type": "BODY",
      "text": "Hola {{name}}, te recordamos que tienes una factura pendiente en {{clinic}}:\n\n🧾 Factura N°: {{doc_no}}\n💵 Monto: {{amount}}\n📅 Vencimiento: {{date_due}}\n\n...",
      "example": {
        "body_text": [["John Doe", "Invoke IA", "INV-2026-003", "1000 UYU", "26 de Julio"]]
      }
    }
  ]
}
```

Esto es el formato "named parameters" de Meta (más reciente que el clásico `{{1}}`, `{{2}}`). El payload de envío a la API de WhatsApp va como un objeto `{parameter_name, text}` por variable — **no depende del orden**. Esto elimina el riesgo frágil del enfoque posicional actual (`parameters = [name, clinic, date, hour, professional]`, donde un desorden rompe el mensaje sin dar error).

> **Confirmado con backend:** actualmente todos los templates en la cuenta de YCloud usan variables nombradas. Se mantiene igual §3.3 como fallback documentado por si aparece un template legacy posicional en el futuro, pero no es una prioridad para la v1.

## 2. Objetivo del diseño

- Agregar un template de WhatsApp nuevo (que combine datos ya conocidos por el resolver) = **una fila de configuración**, sin deploy de frontend ni backend.
- Las alertas envían WhatsApp por el mismo endpoint unificado que ya usa el flujo de pacientes, no un endpoint paralelo.
- Queda registro server-side del envío (acción de alerta / log de comunicación), cosa que hoy no existe.
- Se valida contra YCloud en tiempo de envío (existencia + estado `APPROVED`), no solo contra configuración local, para detectar drift.

## 3. Diseño propuesto

### 3.1 `code` con semántica dependiente del tipo + nuevos campos en `CommunicationTemplate`

**Ajuste respecto a la primera versión de este documento:** en vez de agregar un campo `provider_template_name` separado, `code` pasa a tener significado distinto según `type`:

- `type: 'WHATSAPP'` → `code` **es** el nombre exacto del template en Meta/YCloud. No se escribe a mano: se elige mediante un buscador que consulta YCloud en vivo por nombre (ver §4.1), y queda validado (existe + `APPROVED`) en el momento de guardar. No puede haber `CommunicationTemplate` de tipo WhatsApp cuyo `code` no corresponda a un template real y aprobado.
- `type: 'EMAIL' | 'SMS' | 'DOCUMENT'` → `code` sigue siendo un identificador interno libre, definido a mano por el admin, sin relación con ningún sistema externo — igual que hoy.

Esto evita un campo redundante (`code` interno + `provider_template_name` externo apuntando a lo mismo) y hace que la relación "regla de alerta → template de Meta" sea directa a través de un único campo (`AlertRule.whatsapp_template_code`, §3.6), sin nivel de indirección extra.

Archivo: `src/lib/types.ts` (tipo `CommunicationTemplate`, líneas ~1454-1470 actualmente).

```ts
export type CommunicationTemplate = {
  id?: string;
  code: string;                 // WHATSAPP: nombre exacto del template en Meta. EMAIL/SMS/DOCUMENT: libre, como hoy.
  name: string;                 // etiqueta interna legible, independiente de `code`
  type: 'EMAIL' | 'SMS' | 'DOCUMENT' | 'WHATSAPP';
  category_id?: number;
  subject?: string;
  body_html?: string;           // sigue en uso real para EMAIL — no tocar
  body_text?: string;           // deprecar para WHATSAPP (ver §5); SMS ya no se usa en ningún lado
  variables_schema?: WhatsAppVariablesSchema; // ver 3.2 — hoy es `any` y no se usa en ningún lado
  provider_language?: string;       // NUEVO, solo WHATSAPP — ej. "es". YCloud identifica un template por (name, language), no por name solo
  entity_type?: WhatsAppTemplateEntityType; // NUEVO, solo WHATSAPP — ver 3.4, qué tipo de entidad resuelve las variables
  default_sender?: string;
  attachments_config?: any;
  is_active: boolean;
  version?: number;
  created_at?: string;
  updated_at?: string;
};
```

`body_text` deja de enviarse para WhatsApp; se puede conservar solo como preview/documentación en el admin si se quiere, pero no participa en el envío real.

### 3.2 `variables_schema` como mapa nombre→origen

En vez de una lista posicional, un **mapa** donde la clave es el nombre de variable tal cual aparece en el template de Meta, y el valor es una clave de campo que el resolver del backend sabe resolver:

```ts
export type WhatsAppVariablesSchema = Record<string, string>;

// Ejemplo para "invoice_due":
{
  "name": "patient.name",
  "clinic": "clinic.name",
  "doc_no": "invoice.doc_no",
  "amount": "invoice.amount_formatted",
  "date_due": "invoice.due_date_formatted"
}
```

- El admin, al dar de alta el template, copia los nombres de variable directamente desde la respuesta de YCloud (ver §4.1 — el form puede mostrarlos automáticamente) y los mapea contra un selector de claves conocidas (no texto libre, para evitar typos que solo se detectarían en producción).
- El campo `example.body_text` de YCloud sirve como referencia visual en el admin, no como dato funcional.

**Por qué no hace falta una convención de nombres entre templates:** hoy el nodo Switch de n8n sabe qué significa `"date"` o `"name"` porque el código está bifurcado por `template_code` — cada rama "sabe" implícitamente el contexto. Con `variables_schema`, ese contexto se vuelve explícito en vez de implícito: el mapa es *por template* (no una tabla global de nombres), así que la clave (`"date"`, tal cual la puso Meta) puede significar `appointment.date` en un template y `invoice.due_date` en otro sin colisión — el resolver nunca interpreta `"date"` por sí solo, solo recibe la clave calificada (`appointment.date`) que ya viene resuelta desde `variables_schema`. El `entity_type` del template además acota qué claves calificadas son seleccionables en el formulario (§4.1), evitando por diseño que alguien asigne `invoice.doc_no` a un template de `entity_type: 'appointment'`. **No es necesario renombrar variables en Meta ni definir una convención global** — la variable puede llamarse como sea en cada template, mientras el mapeo a la clave calificada sea correcto en su propio `variables_schema`.

### 3.3 Compatibilidad con templates posicionales (si existieran)

Si algún template en la cuenta usa `{{1}}`, `{{2}}` en vez de nombres, `variables_schema` puede usar las claves `"1"`, `"2"`, ... como si fueran "nombres", y el backend arma el payload posicional en vez de por nombre según lo que YCloud reporte para ese template (`components[0].text` con `\{\{\d+\}\}` vs `\{\{\w+\}\}`). No requiere un campo de schema distinto, solo una rama en la lógica de armado de payload del backend.

### 3.4 Resolver genérico por tipo de entidad (backend / n8n)

En vez de un nodo de código por `template_code`, una función genérica:

```
resolveFields(entity_type, entity_id, patient_id, field_names[]) → { field_name: value, ... }
```

- `entity_type` ∈ `'patient' | 'appointment' | 'invoice'` (extensible a futuro sin tocar frontend).
- Cada `entity_type` sabe resolver un conjunto fijo de "claves de campo" con nombre plano (`patient.name`, `clinic.name`, `appointment.date`, `appointment.hour`, `appointment.professional_name`, `invoice.doc_no`, `invoice.amount_formatted`, `invoice.due_date_formatted`, etc.) — este es el "diccionario de campos resolubles" y es el único lugar que crece cuando aparece un dato genuinamente nuevo.
- Agregar un template que solo combina campos ya en el diccionario = **cero cambios de backend**, solo la fila de `CommunicationTemplate` con su `variables_schema`.
- Agregar un campo nunca antes usado (ej. "próxima limpieza dental") sí requiere extender el diccionario una vez — límite razonable e inevitable.

`patient` y `clinic` están disponibles siempre (se resuelven desde `patient_id`, presente en todos los casos); `entity_type` determina qué namespace extra se agrega (`appointment.*` o `invoice.*`).

### 3.5 Validación contra YCloud en tiempo de envío

**Confirmado con backend:** el endpoint de YCloud soporta filtrar directamente por nombre de template + `language`, así que no hace falta traer/listar todos los templates y filtrar client-side — se pide exactamente el template necesario.

Antes de enviar (se mantiene lo que el flujo actual ya hace parcialmente vía el nodo "Get Templates (YCloud)"):

1. Buscar el template en YCloud por `code` (= nombre del template) + `provider_language`.
2. Si no existe → error claro ("template no encontrado en YCloud").
3. Si `status !== 'APPROVED'` → error claro ("template no aprobado").
4. Comparar el set de nombres de variable extraídos del `text` vivo contra las claves de `variables_schema` local. Si no coinciden → error claro ("drift: la plantilla en Meta cambió, actualizar `variables_schema`"), en vez de enviar un mensaje corrupto o fallar silenciosamente.

Esta misma búsqueda por `code` + `provider_language` es la que alimenta el buscador del formulario de admin (§4.1) al dar de alta o editar un template WhatsApp.

### 3.6 Mapeo alerta → template: `AlertRule.whatsapp_template_code`

Nuevo campo en `AlertRule` (`src/lib/types.ts`), siguiendo el patrón ya existente de `email_template_id` / `sms_template_id`:

```ts
export type AlertRule = {
  // ...campos existentes...
  auto_send_email?: boolean;
  email_template_id?: string;
  sms_template_id?: string;
  whatsapp_template_code?: string; // NUEVO — code de CommunicationTemplate a usar para esta regla
};
```

- Si `whatsapp_template_code` no está configurado en la regla → la opción de WhatsApp se oculta/deshabilita para esas alertas, sin lógica especial en frontend.
- La entidad a resolver (`entity_type`/`entity_id` en términos del resolver) sigue viniendo de `alert.reference_table` / `alert.reference_id`, que ya existen en `AlertInstance` — no se duplica esa decisión en la regla.
- Esto reemplaza la lógica hardcodeada actual en `alert-whatsapp-composer-dialog.tsx` (`isAppointment = alert.reference_table === 'appointments'` → elegir template a mano).

### 3.7 Endpoint unificado

Las alertas dejan de tener un endpoint propio (`ALERT_INSTANCES_SEND_WHATSAPP` queda confirmado como código muerto y se puede remover). Usan el mismo `POST /patients/send_whatsapp_template`, extendiendo el payload:

```ts
export type WhatsAppTemplateSendPayload = {
  id: string;                    // patient id
  template_code: string;         // ahora referencia el `code` de CommunicationTemplate, no un enum fijo
  reference_table?: string;      // NUEVO, opcional — para resolver entity_type/entity_id si aplica (ej. "appointments")
  reference_id?: string;         // NUEVO, opcional — id de la entidad (cita, factura, etc.)
  alert_instance_id?: string;    // NUEVO — para trazabilidad y registrar la acción en el historial de la alerta
  performed_by?: string;         // ya reservado en el payload interno de n8n, ahora se puebla realmente
};
```

`WhatsAppTemplateCode` (enum fijo de 3 valores) se elimina en favor de `string` (el `code` de `CommunicationTemplate`), ya que el objetivo es que nuevos templates no requieran tocar el frontend.

### 3.8 Registro de la acción

**Confirmado con backend:** email/SMS ya persisten `AlertAction`/`CommunicationLog` al enviarse — hay que replicar el mismo mecanismo para WhatsApp, no diseñarlo desde cero.

Cuando `alert_instance_id` viene no-nulo, el backend debe crear una fila en el historial de acciones de la alerta (`action_type: 'SEND_WHATSAPP'`, igual que ya se renderiza hoy en `alerts/page.tsx` para `SEND_EMAIL`/`SEND_SMS`) y, si existe, un `CommunicationLog` (`channel: 'WHATSAPP'`). Hoy el flujo `wa.me` no deja ningún rastro server-side — este es un gap que se cierra automáticamente con el endpoint unificado.

## 4. Cambios de UI (admin de templates)

### 4.1 `src/app/[locale]/system/communication-templates/page.tsx` y/o `src/app/[locale]/config/templates/page.tsx`

Para templates `type: 'WHATSAPP'`:

- Reemplazar el editor de `body_text` (texto libre) por: un buscador para `code` (autocompletar contra YCloud por nombre — no texto libre), selector/input `provider_language`, selector `entity_type`.
- Al elegir `code` + `provider_language` en el buscador, trae el template real desde YCloud y:
  - Extrae automáticamente los nombres de variable del `text` (regex `\{\{(\w+)\}\}`).
  - Pre-llena `variables_schema` con esas claves, cada una con un selector de "origen" limitado a las claves conocidas del diccionario del resolver (§3.4), filtradas por `entity_type` elegido.
  - Muestra el `example.body_text` de YCloud como preview de referencia (solo visual, no funcional).
  - Muestra el `status` (`APPROVED`/`PENDING`/`REJECTED`) para que el admin sepa si puede activarse ya; bloquea guardar si no existe o no está `APPROVED`.
- Para `type: 'EMAIL' | 'SMS' | 'DOCUMENT'`, `code` sigue siendo un input de texto libre — sin cambios respecto al formulario actual.

### 4.2 `src/app/[locale]/alerts/page.tsx` y `AlertWhatsAppComposerDialog`

- El dropdown "Enviar WhatsApp" pasa a estar habilitado solo si `alert.rule?.whatsapp_template_code` (o el campo equivalente que exponga el backend en la respuesta de la alerta) está presente.
- El diálogo deja de armar texto editable — pasa a ser una confirmación simple (paciente, teléfono, nombre del template) que llama al endpoint unificado con `alert_instance_id`. Puede reutilizarse gran parte de `whatsapp-template-send-dialog.tsx` en vez de duplicar lógica.
- Se elimina la dependencia de `useCommunicationTemplates()` + `substituteTokens()` + `WHATSAPP_TEMPLATE_DEFAULTS` para este flujo (siguen existiendo para EMAIL, que sí usa `body_html` funcionalmente).

## 5. Qué se retira / deprecia

- `WhatsAppTemplateCode` (enum de 3 valores fijos) — reemplazado por `code: string` libre, validado contra `CommunicationTemplate` existentes.
- Uso de `body_text` para `type: 'WHATSAPP'` en el envío real — se puede dejar el campo en el tipo por compatibilidad de datos existentes, pero no se lee más para armar el mensaje.
- `alert-whatsapp-composer-dialog.tsx` en su forma actual (texto libre + `wa.me`) — o se reescribe a confirmación simple, o se retira y se reutiliza `whatsapp-template-send-dialog.tsx` parametrizado.
- Constante de ruta muerta `ALERT_INSTANCES_SEND_WHATSAPP` (`/system/alert-instances/send-whatsapp`) — nunca se llegó a usar.
- Revisar si `src/components/whatsapp-composer-dialog.tsx` (composer genérico de pacientes, fuera del alcance de este documento pero mismo patrón legacy) debería seguir el mismo camino en un trabajo aparte.

## 6. Preguntas abiertas — estado

1. ✅ Todos los templates activos en YCloud usan variables nombradas hoy. §3.3 (fallback posicional) queda documentado pero no es prioridad de v1.
2. ✅ YCloud permite filtrar por nombre de template + `language` directamente — no hace falta listar todos y filtrar client-side.
3. ✅ Email/SMS ya persisten `AlertAction`/`CommunicationLog` — WhatsApp debe replicar el mismo mecanismo (§3.8).
4. ✅ `AlertRule` ya es editable desde un admin UI existente — solo hay que agregar el campo `whatsapp_template_code` a ese formulario.
5. ✅ Resuelto por diseño (ver nota en §3.2): no se necesita una convención de nombres entre templates ni renombrar variables en Meta — `variables_schema` es un mapa aislado por template, y `entity_type` acota qué claves calificadas son válidas. El listado inicial del diccionario de campos resolubles sigue pendiente de armar en detalle (paso de implementación, no de diseño): al menos `patient.name`, `clinic.name`, `appointment.date`, `appointment.hour`, `appointment.professional_name`, `invoice.doc_no`, `invoice.amount_formatted`, `invoice.due_date_formatted`, cubriendo los 3 templates actuales (`birthday`, `appointment_reminder`, `invoice_due`).

Sin preguntas abiertas bloqueantes para pasar a implementación.

## 7. Plan de implementación (alto nivel, para cuando se apruebe el diseño)

1. **Backend (n8n):** resolver genérico por `entity_type`, validación contra YCloud (búsqueda por `code` + `provider_language`), armado de payload por nombre (y posicional si aplica), registro de `AlertAction`/`CommunicationLog`.
2. **Backend (DB):** agregar columnas `provider_language`, `entity_type` a `communication_templates`; agregar `whatsapp_template_code` a `alert_rules`. Definir el diccionario inicial de campos resolubles (§6.5).
3. **Frontend — tipos:** actualizar `CommunicationTemplate`, `AlertRule`, `WhatsAppTemplateSendPayload` en `src/lib/types.ts`.
4. **Frontend — admin:** actualizar formulario de templates (§4.1).
5. **Frontend — alertas:** actualizar `alerts/page.tsx` y reemplazar/adaptar `AlertWhatsAppComposerDialog` (§4.2).
6. **Frontend — limpieza:** remover `WhatsAppTemplateCode` enum y ruta muerta `ALERT_INSTANCES_SEND_WHATSAPP`.
7. Validar en dev con al menos 2 templates reales (uno con `entity_type: 'appointment'`, uno con `entity_type: 'invoice'`) antes de dar por cerrado.
