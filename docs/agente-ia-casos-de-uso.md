# Plan: Agente IA — Casos de Uso sobre Invoke IA

## Contexto

El sistema Invoke IA tiene un backend de webhooks n8n que expone todas las APIs de gestión clínica (citas, pacientes, presupuestos, facturación, caja, historia clínica, etc.). El usuario ya tiene un esqueleto de flujo n8n que recibe peticiones desde distintos canales (chat web, WhatsApp, etc.) y devuelve respuestas.

El objetivo es identificar los casos de uso más valiosos donde el agente IA reutilice las funcionalidades existentes para:
1. **Acción**: Ejecutar flujos operativos completos en nombre del usuario (staff de la clínica)
2. **Consulta**: Responder preguntas sobre datos del sistema
3. **Guía**: Ayudar a usuarios con dudas sobre cómo usar el sistema
4. **Externo**: Atender consultas de pacientes sin intervención humana

---

## Arquitectura del Agente

```
Canal (WhatsApp / Web Chat / Voz)
        ↓
   n8n: recibe mensaje + contexto del usuario (token, clinic_id)
        ↓
   LLM (Gemini / GPT): interpreta intención → extrae entidades
        ↓
   n8n: llama webhook Invoke IA (mismo backend del frontend)
        ↓
   n8n: formatea respuesta → devuelve al canal
```

**Autenticación:** El agente opera con un token de servicio (usuario "Agente IA") con permisos específicos configurados en Invoke IA.

**APIs disponibles:** `${NEXT_PUBLIC_API_URL}/webhook/*` — las mismas que usa el frontend.

**Flows Genkit reutilizables** (ya implementados en `src/ai/flows/`):
- `interpretUserCommandFlow` — extrae intención + parámetros del mensaje
- `executeDatabaseOperationFlow` — traduce lenguaje natural a SQL para consultas
- `generateInsightsFromConversationFlow` — extrae insights de texto clínico

---

## Casos de Uso (ordenados por valor + factibilidad)

---

### TIER 1 — Impacto Inmediato (diario, alta frecuencia)

---

#### CU-01: Consulta de Agenda del Día
**"¿Qué citas hay hoy?" / "¿A qué hora tiene cita María González?"**

- **API:** `GET /users_appointments` con `startingDateAndTime` + `endingDateAndTime` del día actual
- **Entidades a extraer:** fecha (default hoy), nombre paciente (opcional), médico (opcional)
- **Respuesta:** lista formateada: hora · paciente · doctor · estado
- **Valor:** Recepcionista no necesita abrir el sistema para saber qué sigue

---

#### CU-02: Buscar Deuda / Estado Financiero de un Paciente
**"¿Cuánto debe Pedro Ruiz?" / "¿Qué facturas tiene pendientes López?"**

- **APIs:**
  - `GET /filter_users?search=Pedro+Ruiz` → obtiene `user_id`
  - `GET /user_financial?user_id=X` → deuda, saldo, facturado
  - `GET /user_invoices?user_id=X` → facturas con estado
- **Respuesta:** resumen financiero (deuda total, facturas pendientes, saldo a favor)
- **Valor:** Evita navegación de 3 pantallas para dato que se consulta 10+ veces/día

---

#### CU-03: Crear Cita por Conversación
**"Agenda a Juan Pérez con el Dr. García mañana a las 10 para una limpieza"**

- **APIs:**
  1. `GET /filter_users?search=Juan+Pérez` → `patient_id`
  2. `GET /users/doctors` → `doctor_id`
  3. `GET /appointments_availability` → verificar que el horario esté libre
  4. `GET /services?search=limpieza` → `service_id`
  5. `POST /appointments/upsert` → crear la cita
- **Entidades:** paciente, doctor, fecha, hora, servicio
- **Manejo de conflictos:** si el horario no está disponible, ofrecer el próximo slot libre
- **Valor:** Recepcionista dicta la cita de voz/chat sin tocar el sistema

---

#### CU-04: Registrar Pago desde Chat
**"Registra pago de $2500 UYU en efectivo para la factura de López"**

- **APIs:**
  1. `GET /filter_users?search=López` → `user_id`
  2. `GET /user_invoices?user_id=X` → facturas pendientes
  3. `GET /metodospago/all` → id del método "Efectivo"
  4. `POST /invoices/upsert` (o endpoint de pago) → registrar pago
- **Confirmación:** Antes de ejecutar, el agente confirma: "¿Confirmas pago de $2500 UYU en efectivo para FAC-0042 de Juan López?"
- **Valor:** Cajero registra pagos sin salir del chat con el paciente

---

#### CU-05: Completar Atención (flujo multi-paso)
**"Completa la atención de Juan Pérez, realizó extracción pieza 26, sin complicaciones"**

1. Busca cita activa del paciente hoy: `GET /users_appointments`
2. Crea sesión clínica: `POST /sesiones/upsert` con procedimiento + notas
3. Actualiza estado de la cita a "completada": `POST /appointments/upsert`
4. Si el ítem de orden está vinculado, lo marca completado: `POST /orders/upsert`
- **Valor:** Reduce a 1 acción lo que normalmente requiere 3-4 pantallas y ~5 minutos

---

#### CU-06: Resumen del Día (briefing matutino)
**"Dame el resumen del día" / se dispara automáticamente al abrir caja**

- **APIs:**
  - `GET /users_appointments` (citas de hoy)
  - `GET /cash-session/active` (si la caja está abierta)
  - `GET /system/alert-instances?status=PENDING` (alertas pendientes)
- **Respuesta:**
  ```
  Buenos días. Hoy tienen 12 citas programadas.
  🔴 3 pacientes con facturas vencidas (alertas pendientes).
  💰 Caja: no hay sesión activa.
  📅 Primera cita: Juan Pérez a las 09:00 con Dr. García.
  ```
- **Valor:** El staff llega y sabe exactamente el estado del día sin buscar nada

---

### TIER 2 — Flujos Completos Automatizados

---

#### CU-07: Crear Presupuesto por Conversación
**"Crea un presupuesto para Carlos López con ortodoncia y extracción en USD"**

1. `GET /filter_users?search=Carlos+López` → `user_id`
2. `GET /services` → busca servicios por nombre
3. `POST /quotes/upsert` → crea presupuesto con ítems
4. Responde con número de documento y total

- **Valor alto:** Presupuestos se crean en 30 segundos desde la silla de atención

---

#### CU-08: Apertura/Cierre de Caja Asistido
**"Abrir caja con $10,000 UYU de efectivo inicial"**
**"Cerrar caja"**

- Apertura: `GET /cash_points/search` → `POST /cash-session/open`
- Cierre: `GET /cash-session/prefill` (obtiene datos prefill) → `POST /cash-session/close`
- Para el cierre, el agente guía paso a paso: pregunta el efectivo contado, informa diferencias
- **Valor:** Cajeros menos técnicos pueden abrir/cerrar sin entender la UI

---

#### CU-09: Pipeline Presupuesto → Orden → Factura
**"El paciente aceptó el presupuesto PRES-0023, convierte a orden y genera la factura"**

1. `POST /quote/confirm` → confirma presupuesto
2. El backend crea automáticamente la orden (verificar si es automático o requiere `POST /orders/upsert`)
3. `POST /invoices/upsert` → genera factura
4. Informa: "Orden ORD-0018 y Factura FAC-0031 creadas para Juan Pérez. Total: $4500 UYU"

- **Valor:** Proceso que tarda 5-10 minutos en 3 pantallas → 1 mensaje

---

#### CU-10: Alertas Proactivas por WhatsApp
**Agente inicia la conversación, no espera ser preguntado**

- Trigger n8n: cada hora revisa `GET /system/alert-instances?status=PENDING&priority=HIGH`
- Si hay alertas CRITICAL o HIGH sin atender → envía mensaje al administrador
- Ejemplos:
  - "⚠️ 5 facturas llevan más de 30 días vencidas. ¿Quieres que te mande la lista?"
  - "📅 Mañana no hay disponibilidad del Dr. García pero tiene 3 citas programadas"
  - "💰 Pedro Ruiz tiene deuda de $15,000 UYU y viene hoy a las 15:00"
- **Valor:** Convierte el sistema de alertas pasivo en notificaciones proactivas

---

### TIER 3 — Atención al Paciente (canal externo)

---

#### CU-11: Paciente Consulta su Cita por WhatsApp
**Paciente escribe: "Hola, ¿cuándo es mi próxima cita?"**

1. El agente identifica al paciente por número de teléfono (campo `phone_number` en `User`)
2. `GET /users_appointments?patient_id=X` → próxima cita pendiente
3. Responde: "Hola María, tu próxima cita es el viernes 11/04 a las 14:30 con el Dr. García para limpieza dental."
- **Valor:** Elimina llamadas de consulta de pacientes (alto volumen en clínicas)

---

#### CU-12: Paciente Solicita Turno por WhatsApp
**"Quiero una cita para limpieza la próxima semana"**

1. Identifica paciente por teléfono
2. Consulta disponibilidad: `GET /appointments_availability`
3. Ofrece 3 opciones de horario
4. Paciente elige → `POST /appointments/upsert` con estado "pending" (para confirmar por staff)
5. Notifica al staff que hay una solicitud nueva
- **Valor:** Pacientes se auto-agendan fuera del horario de atención

---

#### CU-13: Paciente Consulta Presupuesto
**"¿Cuánto cuesta un implante dental?"**

- `GET /services?search=implante` → precio(s) del catálogo
- Si tiene presupuesto: `GET /user_quotes?user_id=X` → cita el presupuesto específico
- Respuesta con precios del catálogo o referencia al presupuesto personal
- **Valor:** Reduce consultas de precio por teléfono

---

#### CU-14: Recordatorio Automático de Cita (proactivo hacia paciente)
**n8n trigger: X horas antes de cada cita**

- `GET /users_appointments` con filtro de próximas 24 hs
- Para cada cita: busca email/teléfono del paciente
- `POST /system/alert-instances/send-whatsapp` o envío directo n8n
- Mensaje: "Recordatorio: tienes cita mañana 10/04 a las 10:00 con Dr. García. Responde SI para confirmar o NO para cancelar."
- Si paciente responde NO → actualizar estado cita + notificar recepción
- **Valor:** Reduce no-shows (ausentismo) que es el mayor problema operativo de clínicas

---

### TIER 4 — Inteligencia y Reportes

---

#### CU-15: Dashboard Conversacional
**"¿Cómo van las ventas este mes?" / "¿Cuántos pacientes nuevos tuvimos?"**

- `GET /dashboard_summary` / `GET /dashboard_sales_summary` / `GET /dashboard_new_vs_recurring_patients`
- LLM reformatea en lenguaje natural con contexto:
  "Este mes tuvieron $48,500 UYU en ingresos, un 12% más que el mes pasado.
   23 pacientes nuevos vs 78 recurrentes. El servicio más demandado fue limpieza dental (34 casos)."
- **Valor:** Gestores obtienen KPIs sin entrar al dashboard

---

#### CU-16: Consulta de Historia Clínica para el Doctor
**"¿Qué antecedentes tiene Juan Pérez?" / "¿Qué tratamientos ha recibido?"**

- `GET /clinic-history/:user_id` → antecedentes, alergias, medicamentos
- `GET /patient_sessions?user_id=X` → historial de sesiones
- LLM sintetiza la información relevante
- **Valor:** Doctor consulta historial de voz mientras atiende al paciente

---

## Priorización de Implementación

| # | Caso | Valor | Complejidad | Prioridad |
|---|------|-------|-------------|-----------|
| CU-01 | Consulta agenda del día | Alto | Baja | 🔴 1 |
| CU-06 | Resumen del día | Alto | Baja | 🔴 2 |
| CU-02 | Deuda de paciente | Alto | Baja | 🔴 3 |
| CU-14 | Recordatorio cita (proactivo) | Muy Alto | Media | 🟠 4 |
| CU-03 | Crear cita | Muy Alto | Alta | 🟠 5 |
| CU-05 | Completar atención | Alto | Alta | 🟠 6 |
| CU-10 | Alertas proactivas | Alto | Media | 🟡 7 |
| CU-11 | Paciente consulta cita | Alto | Baja | 🟡 8 |
| CU-04 | Registrar pago | Alto | Alta | 🟡 9 |
| CU-07 | Crear presupuesto | Medio | Alta | ⚪ 10 |

---

## Estructura del Flow n8n por Caso de Uso

### Patrón General

```
1. TRIGGER (webhook / WhatsApp / cron)
2. CONTEXTO: obtener token + clinic_id del usuario o canal
3. INTENT: LLM extrae intención + entidades del mensaje
4. DISPATCH: switch/if por intención detectada
5. FETCH: llamar API(s) de Invoke IA con el token
6. FORMAT: LLM formatea respuesta amigable
7. RESPONSE: devolver al canal de origen
```

### Intenciones Base (intent classification)

```javascript
const INTENTS = {
  // Consultas (no modifican datos)
  QUERY_AGENDA: 'consultar_agenda',
  QUERY_PATIENT_DEBT: 'consultar_deuda_paciente',
  QUERY_PATIENT_INFO: 'consultar_info_paciente',
  QUERY_AVAILABILITY: 'consultar_disponibilidad',
  QUERY_SERVICES_PRICE: 'consultar_precio_servicio',
  QUERY_DASHBOARD: 'consultar_estadisticas',

  // Acciones (modifican datos — requieren confirmación)
  ACTION_CREATE_APPOINTMENT: 'crear_cita',
  ACTION_CANCEL_APPOINTMENT: 'cancelar_cita',
  ACTION_COMPLETE_APPOINTMENT: 'completar_atencion',
  ACTION_CREATE_QUOTE: 'crear_presupuesto',
  ACTION_REGISTER_PAYMENT: 'registrar_pago',
  ACTION_OPEN_CASHIER: 'abrir_caja',
  ACTION_CLOSE_CASHIER: 'cerrar_caja',

  // Ambiguos (pedir aclaración)
  UNKNOWN: 'desconocido',
};
```

### Patrón de Confirmación para Acciones

```
Agente NO ejecuta acciones sin confirmación explícita:

Usuario: "Registra pago de $2000 para López"
Agente: "Voy a registrar:
  • Paciente: Juan López
  • Factura: FAC-0042 (pendiente $4500 UYU)
  • Monto: $2000 UYU en efectivo
  ¿Confirmas? (SI/NO)"
Usuario: "SI"
Agente: → ejecuta POST → "✓ Pago registrado. Saldo pendiente: $2500 UYU"
```

---

## Datos de Contexto que el Agente Necesita en Cada Request

```json
{
  "channel": "whatsapp | web_chat | internal",
  "user_token": "Bearer ...",  // token del staff (o token de servicio para pacientes)
  "user_id": "...",            // ID del usuario autenticado en Invoke IA
  "clinic_id": "...",          // para filtrar datos
  "sender_phone": "...",       // para canal WhatsApp, identificar si es paciente
  "conversation_history": []   // últimos N mensajes para contexto
}
```

---

## Notas de Implementación

1. **Seguridad:** Acciones de escritura (crear cita, registrar pago) SIEMPRE requieren confirmación. Consultas no.

2. **Resolución de ambigüedad:** Si hay múltiples pacientes con el mismo nombre, el agente muestra lista y pide confirmar cuál.

3. **Pacientes externos (WhatsApp):** Usan token de servicio restringido. Solo pueden consultar sus propios datos (identificados por phone_number). No pueden crear pagos ni ver datos de otros pacientes.

4. **Fallback:** Si el agente no entiende la intención o falla la API, escala a: "No pude completar esa acción. ¿Quieres que te explique cómo hacerlo desde el sistema?" → activa modo guía.

5. **Modo Guía:** El agente puede consultar el contenido de la guía de usuario (docs/guia-uso-invoke-ia.docx procesado como RAG) para responder "¿Cómo hago X?" en lenguaje natural paso a paso.

6. **APIs de n8n ya existentes:** El agente llama exactamente las mismas URLs que el frontend (`${NEXT_PUBLIC_API_URL}/webhook/*`) con el mismo `Authorization: Bearer` header.
