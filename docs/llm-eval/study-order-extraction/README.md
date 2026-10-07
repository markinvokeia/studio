# Extracción de órdenes de estudio — kit para probar otros LLMs

Generado el 2026-10-07 a partir del nodo **Build Vision Request** del flujo
`docs/n8n-flows/WhatsApp - Study Order Intake.json` (prompt `so-intake-v1`,
schema `so-extraction-v1`), con el catálogo y las opciones activas de la base DEV.

| Archivo | Qué es |
| --- | --- |
| `system-prompt.txt` | Mensaje de sistema completo (reglas + catálogo + opciones). |
| `user-message.txt` | Texto del mensaje de usuario; las imágenes/PDF van como partes adjuntas a ese mismo mensaje. |
| `schema.json` | `json_schema` de salida estructurada (formato OpenAI `response_format`, `strict: true`). |

## Cómo se arma la llamada en producción

- Endpoint: `POST https://api.openai.com/v1/chat/completions`, modelo `system_configurations.whatsapp_orders_vision_model`.
- `messages[0]` = system prompt; `messages[1]` = user con `[texto, ...archivos]`.
  - Imagen → `{ type: "image_url", image_url: { url: "data:<mime>;base64,...", detail: "high" } }`
  - PDF → `{ type: "file", file: { filename, file_data: "data:application/pdf;base64,..." } }`
- `response_format = { type: "json_schema", json_schema: <schema.json> }`.
- Varias páginas de la misma orden se mandan juntas en un solo mensaje.

## Qué hace el validador con la salida (para evaluar respuestas)

- Cualquier estudio en `unmatched_text_lines` → la orden entera se deriva a humano (`service_not_found`).
- `is_study_order: false` o `document_quality: "unreadable"` → pide reenviar una vez y luego deriva.
- `items[].confidence` < `whatsapp_orders_min_confidence` (0.85 por defecto) → pregunta al paciente para confirmar esa línea.
- `patient.document` se normaliza a dígitos/letras y se valida el dígito verificador de la cédula uruguaya.
- `patient.confidence` < umbral → pide confirmar nombre y documento.

Por eso, en la comparación conviene medir sobre todo: ids de `items` correctos (precisión/recall),
que no invente estudios ni los meta en `items` cuando no están en la lista, nombre y cédula exactos,
y calibración de `confidence`.

## Portabilidad del schema

El schema usa el modo estricto de OpenAI: todas las propiedades en `required`,
`additionalProperties: false`, y los opcionales como unión con null (`"type": ["string", "null"]`,
`enum: [..., null]`).

- **Claude (structured outputs / tool input_schema)** y **OpenAI-compatibles** (vLLM, OpenRouter, etc.): se usa tal cual.
- **Gemini (`responseSchema`)**: no acepta `type` como array. Hay que cambiar `["string","null"]` por
  `"type": "string", "nullable": true` y quitar el `null` de los `enum`. Otra opción es `responseJsonSchema`
  en los modelos que la soportan.
- **Modelos sin salida estructurada**: pegar el schema al final del system prompt con
  "Respondé solo con un JSON que cumpla este schema" y validar después con Ajv.

## Observaciones del catálogo actual (DEV)

- `id:1626 | ECO | Masaje Relajante` aparece como estudio: parece un dato de prueba que se cuela en el catálogo.
- Códigos con errores de tipeo que el modelo ve tal cual: `indiacion-opt`, `ci-orden:svc:funcacion-gnathos`.
- Si cambia el catálogo o `study_order_options`, hay que volver a generar el prompt y el schema, porque los dos se arman de forma dinámica.
