# Portal del Paciente — Contrato de Backend

Documento de referencia para los flujos n8n que soportan `/patient-login` y `/my-profile`.

- **Base URL:** `${NEXT_PUBLIC_API_URL}/webhook` (ver [`runtime-config.md`](./runtime-config.md))
- **Script de BD:** `database/scripts/065_20260806_patient-portal.sql` (aplicar a mano antes de importar los flujos)
- **Workflows nuevos:** `n8n-workflows/patient-*.json`

---

## 0. Modelo

No existe entidad "paciente": **un paciente es una fila de `public.users`**, discriminada por el query param `filter_type='PACIENTE'` en `/users`. El portal reutiliza esa misma fila; el login por código sólo agrega columnas de OTP y el rol `Paciente`.

| Columna nueva en `users` | Uso |
|---|---|
| `login_code varchar(128)` | **Hash** `sha256(code \|\| user_id)`. Nunca el código en claro. |
| `login_code_expires_at timestamp` | Vencimiento: `NOW() + interval '10 minutes'`. |
| `login_code_attempts smallint` | Intentos fallidos del código actual. Máx. **5**. |
| `login_code_sent_at timestamp` | Último envío. Reenvío permitido cada **60 s**. |
| `is_portal_user boolean` | `TRUE` tras la primera verificación exitosa. |

---

## 1. ⚠️ Guard obligatorio: `assert_self_or_staff`

> **Sin esto el portal es una fuga de datos y no se puede publicar.**

Hoy los webhooks autorizan por **existencia** del token, no por su sujeto. Un token con rol `Paciente` podría llamar `GET /users?filter_type=PACIENTE` y leer a toda la clínica.

El token del sistema **no lleva claim `roles`** (ver §2.3), así que el rol hay que resolverlo contra la BD. Colocar en cada workflow de la lista, inmediatamente después de validar el JWT:

**Paso 1 — resolver los roles del usuario** (nodo Postgres):

```sql
SELECT lower(r.name) AS role_name
FROM public.user_roles ur
JOIN public.roles r ON r.id = ur.role_id
WHERE ur.user_id = $1::uuid
  AND ur.is_active IS NOT FALSE
```
Parámetro: el claim **`userId`** del token (no `sub` — ese claim no existe).

**Paso 2 — aplicar el guard** (nodo Code):

```js
// assert_self_or_staff
const claims = $('Decode Token').first().json.payload;   // JWT ya verificado
const userId = claims.userId;                            // ⚠️ `userId`, NO `sub`
if (!userId) throw new Error('UNAUTHORIZED: token sin userId');

const roles = $input.all().map((i) => String(i.json.role_name || '').toLowerCase());
const isPatient = roles.includes('paciente') || roles.includes('patient');
const isStaff   = roles.some((r) => r !== 'paciente' && r !== 'patient');

// Con rol de staff no hay restricción, aunque además sea paciente:
// es el caso de la recepcionista que también se atiende en la clínica.
if (isStaff || !isPatient) return items;

// Paciente puro: sólo puede operar sobre sí mismo.
const requested = $json.query?.user_id
               ?? $json.body?.user_id
               ?? $json.body?.patient_id
               ?? userId;

if (String(requested) !== String(userId)) {
  throw new Error('FORBIDDEN: patient scope violation');   // → responder 403
}

// Forzar el id del token, ignorando lo que venga del cliente.
$json.query = { ...($json.query || {}), user_id: userId };
return items;
```

**Workflows que deben incorporarlo** (no se modifican en nada más):

`/auth/me` · `/users` · `/users_appointments` · `/appointments_availability` · `/appointments/upsert` · `/appointments/reschedule` · `/appointments/update_status` · `/user_financial` · `/user_invoices` · `/user_payments` · `/user_quotes` · `/users/preferences` · `/calendars` · `/users/doctors` · todos los `/clinic-history/*` y `/odontogram/*`

Reglas adicionales por endpoint:

| Endpoint | Restricción extra para rol `Paciente` |
|---|---|
| `/users` | Ignorar `search`/`filter_type`; devolver **sólo** la fila `claims.userId`. |
| `/appointments/upsert` | Sólo `mode='create'`, `patient_id = claims.userId`, y forzar `status='pending'`. |
| `/appointments/reschedule` | La cita debe pertenecer a `claims.userId` y ser futura. No permitir cambiar doctor ni servicios. |
| `/appointments/update_status` | Sólo `status='cancelled'`, sobre una cita futura propia. |
| `/calendars`, `/users/doctors` | Devolver sólo campos públicos (id, nombre) — sin emails ni datos internos. |

---

## 2. Endpoints nuevos

Los cuatro de auth son **públicos (noauth)** — el paciente todavía no tiene token. Hay precedente de variantes `_noauth` en `docs/n8n-flows/All Appointment Workflows.json`.

Todos responden `200` con el cuerpo indicado, o `4xx` con `{ "message": "..." }` — el cliente lee `message` vía el manejador de errores de `src/services/api.ts`.

### 2.1 `POST /api/auth/patient/identify`

Averigua si el identificador corresponde a un paciente. **Nunca devuelve datos del paciente** — sólo el email enmascarado, para que el usuario confirme a dónde le llega el código.

```jsonc
// Request
{ "identifier": "099123456" }   // email, teléfono o cédula
```
```jsonc
// Response — encontrado
{ "found": true, "needs_email": false, "masked_email": "j***z@gmail.com",
  "user_id": "uuid", "name": "Juan",
  "has_upcoming_appointments": true }
// existe pero sin email cargado
{ "found": true, "needs_email": true, "masked_email": null, "user_id": "uuid", "name": "Juan",
  "has_upcoming_appointments": false }
// no encontrado → el cliente ofrece registro
{ "found": false, "needs_email": false, "masked_email": null }
```

`has_upcoming_appointments` es lo que decide si se le pide OTP o se lo manda directo a reservar (§3). Calcularlo así:

```sql
SELECT EXISTS (
  SELECT 1 FROM public.appointments a
  WHERE a.patient_id = u.id
    AND a.start_datetime >= NOW()
    AND lower(coalesce(a.status, '')) NOT IN ('cancelled', 'canceled', 'no_show')
) AS has_upcoming_appointments
```

> ⚠️ La columna es **`start_datetime`**, no `start_time`. El baseline de Liquibase está desactualizado; la referencia son las queries de `docs/n8n-flows/All Appointment Workflows.json`.

> `user_id` y `name` sólo se devuelven cuando `found`. Son los mínimos para poder reservar sin sesión; **no** agregar email, teléfono ni ningún otro dato: este endpoint es público.

Lookup (normalizar el teléfono quitando espacios, guiones y el prefijo `+598`):

```sql
SELECT id, email
FROM public.users
WHERE is_active = TRUE
  AND (
        lower(email) = lower($1)
     OR regexp_replace(coalesce(phone_number,''), '\D', '', 'g') = regexp_replace($1, '\D', '', 'g')
     OR regexp_replace(coalesce(alternative_phone,''), '\D', '', 'g') = regexp_replace($1, '\D', '', 'g')
     OR identity_document = regexp_replace($1, '\D', '', 'g')
  )
LIMIT 1;
```

> El match por teléfono/cédula sólo aplica si el identificador tiene al menos 6 dígitos, para evitar coincidencias accidentales.

### 2.2 `POST /api/auth/patient/send-code`

```jsonc
// Request
{ "identifier": "099123456", "email": "juan@gmail.com" }  // `email` sólo cuando needs_email=true
```
```jsonc
// Response
{ "sent": true, "masked_email": "j***n@gmail.com", "expires_in": 600 }
```

1. Resolver el usuario igual que en `identify`. Si no existe → `404`.
2. Si viene `email` y el usuario no tenía, guardarlo (validando que no esté en uso por otro `users.id`).
3. Si `login_code_sent_at > NOW() - interval '60 seconds'` → `429` con `{ "message": "..." , "retry_after": <segundos> }`.
4. Generar código numérico de **6 dígitos** (evitar códigos con todos los dígitos iguales).
5. Guardar:
   ```sql
   UPDATE public.users SET
       login_code            = encode(digest($code || id::text, 'sha256'), 'hex'),
       login_code_expires_at = NOW() + interval '10 minutes',
       login_code_attempts   = 0,
       login_code_sent_at    = NOW()
   WHERE id = $user_id;
   ```
6. Enviar el email reutilizando el **mismo nodo/credencial SMTP** del flujo `/api/auth/recover/email`. Asunto: `Tu código de acceso — {clínica}`. Cuerpo: el código, su vigencia (10 min) y el aviso de "si no fuiste vos, ignorá este mensaje".

> **Anti-enumeración:** si el identificador no existe, este endpoint sólo se alcanza tras un `identify` que devolvió `found:false`, y en ese caso el cliente va a registro. Aun así, no revelar en el mensaje de error si el fallo fue por usuario inexistente o por rate-limit.

### 2.3 `POST /api/auth/patient/verify-code`

```jsonc
// Request
{ "identifier": "099123456", "code": "482913" }
```
```jsonc
// Response — MISMO token que /api/auth/login
{
  "token": "eyJhbGciOi...",
  "user":  { "id": "uuid", "name": "Juan Pérez", "email": "juan@gmail.com" },
  "is_new": false
}
```

1. Resolver el usuario. Si `login_code IS NULL` o `login_code_expires_at < NOW()` → `410` (`code_expired`).
2. Si `login_code_attempts >= 5` → `429` (`too_many_attempts`); obliga a pedir un código nuevo.
3. Comparar `encode(digest($code || id::text,'sha256'),'hex')` con `login_code`. Si no coincide → `login_code_attempts = login_code_attempts + 1` y responder `401`.
4. Éxito:
   ```sql
   UPDATE public.users SET
       login_code = NULL, login_code_expires_at = NULL, login_code_attempts = 0,
       is_portal_user = TRUE, last_login_timestamp = NOW()
   WHERE id = $user_id;

   INSERT INTO public.user_roles (user_id, role_id, is_active)
   SELECT $user_id, r.id, TRUE FROM public.roles r WHERE r.name = 'Paciente'
   ON CONFLICT (user_id, role_id) DO UPDATE SET is_active = TRUE;
   ```
5. Firmar el JWT con el nodo nativo `n8n-nodes-base.jwt` (`operation: sign`) usando **la misma credencial `jwtAuth` que `/api/auth/login`** — en este repo aparece con id `C6sB1r7ab5H5EmJj` en `docs/n8n-flows/Check requirements for first time password - Endpoint.json`. No hace falta conocer el valor del secreto: lo guarda la credencial.

   **Forma exacta del token** (verificada decodificando uno real del sistema):
   ```jsonc
   // header
   { "alg": "HS256", "typ": "JWT" }
   // payload
   { "userId": "283f09c7-…", "email": "raidel@invokeia.com", "expiresIn": "24h", "iat": 1786037515 }
   ```
   - El identificador va en **`userId`**, no en `sub`.
   - **No hay claim `roles`**: `/auth/me` los resuelve consultando `user_roles`. Por eso el guard de §1 hace una consulta a la BD.
   - **No hay `exp`**: `"expiresIn"` es un claim literal, no la opción de `jsonwebtoken`. En los hechos el token no vence — es el comportamiento actual del login de staff; si se corrige, hay que hacerlo en **ambos** flujos a la vez.
   - `iat` lo agrega solo el nodo JWT.

   > **No se puede reutilizar `/api/auth/login`** para emitir el token del paciente: ese endpoint exige `email` + `password` en claro, y el flujo OTP nunca la tiene (en la BD está hasheada, y el hash no sirve como entrada). Lo que sí se reutiliza —y es lo que hace válido al token frente a `/auth/me`— es la credencial de firma.
6. `is_new` es `true` cuando el usuario fue creado por `/api/auth/patient/register` en los últimos 30 minutos (o cuando `is_portal_user` era `false` y `created_at > NOW() - interval '30 minutes'`). El cliente lo usa para abrir el diálogo de reserva de cita automáticamente.

### 2.4 `POST /api/auth/patient/register`

```jsonc
// Request — sólo name y email son obligatorios
{
  "name": "Juan Pérez",
  "email": "juan@gmail.com",
  "phone": "+59899123456",   // opcional
  "identity_document": "12345678",   // opcional
  "birth_date": "1985-03-12",        // opcional, YYYY-MM-DD
  "address": "Av. Italia 1234"       // opcional
}
```
```jsonc
// Response — ya dispara el envío del código
{ "created": true, "user_id": "uuid", "sent": true, "masked_email": "j***n@gmail.com", "expires_in": 600 }
```

1. Validar conflictos contra `users`: `email`, `phone_number` e `identity_document` son UNIQUE. Si alguno ya existe → `409` con el formato que el frontend ya sabe leer (ver `patient-form-utils.ts`):
   ```jsonc
   { "error": { "code": "unique_conflict", "conflictedFields": ["email"] } }
   ```
2. Insertar:
   ```sql
   INSERT INTO public.users (name, email, phone_number, identity_document, birthday, address,
                             is_active, is_sales, is_portal_user)
   VALUES ($1,$2,$3,NULLIF($4,''),NULLIF($5,'')::date,NULLIF($6,''), TRUE, TRUE, FALSE)
   RETURNING id;
   ```
   `is_sales = TRUE` es lo que hace que aparezca como paciente en `/users?filter_type=PACIENTE`, igual que `upsertUser()` del frontend.
3. Asignar el rol `Paciente` en `user_roles`.
4. Encadenar la lógica de `send-code` y devolver su resultado.

> **Anti-abuso:** limitar los registros por IP (p. ej. 5 cada 15 min) con un nodo de rate-limit al inicio del workflow. Un registro crea una fila real en `users` que después ve el staff.

### 2.5 `POST /ai/patient/query` (con Bearer)

Asistente virtual del portal. **No se reutiliza el Help Agent existente**: es staff-scoped y su webhook de chat en el header no lleva auth. Se modela sobre `docs/Agent_InvokeIA_Help_v3.json`.

```jsonc
// Request
{ "patient_id": "uuid", "query": "¿cuándo es mi próxima cita?",
  "channel": "text", "session_id": "uuid", "has_existing_session": true }
```
```jsonc
// Response — misma forma que DoctorAiQueryResponse
{
  "answer": "Tu próxima cita es el martes 12 a las 15:30 con la Dra. Gómez.",
  "speak_text": "Tu próxima cita es el martes 12 a las 15:30.",
  "suggestions": ["Reagendar esa cita", "¿Cuánto debo?"],
  "action": { "type": "open_booking" | "open_tab" | "none", "payload": { "tab": "appointments" } }
}
```

Reglas:
- `patient_id` se **ignora del body** y se toma del claim `userId` del JWT (el token no tiene `sub`).
- Las herramientas del agente se limitan a: citas propias, finanzas propias, historial propio, e info pública de la clínica (horarios, servicios, ubicación, doctores).
- El prompt del sistema debe prohibir explícitamente dar diagnósticos o consejo médico, y derivar a la clínica ante cualquier consulta clínica.

### 2.6 `GET /api/public/clinic`

Datos públicos de la clínica para la landing `/patient-login`. **Sin autenticación** — lo consume un visitante que todavía no se identificó.

```jsonc
// Response
{
  "name": "Clínica Dental Ejemplo",
  "address": "Av. Italia 1234",
  "phone": "+598 2600 0000",
  "email": "hola@clinica.com",
  "logo_url": "data:image/png;base64,...",   // o null
  "welcome_video_url": null,                  // null ⇒ video genérico de Invoke IA
  "welcome_message": null,                    // null ⇒ copy por defecto traducido
  "patient_portal_enabled": true,
  "schedules": [ { "day_of_week": 1, "start_time": "09:00", "end_time": "18:00" } ]
}
```

- Los tres campos configurables (`patient_portal_enabled`, `welcome_video_url`, `welcome_message`) salen de **`public.clinic`** — ver `database/scripts/066_20260806_clinic-patient-portal-settings.sql`.
- ⚠️ La tabla es **`clinic`, en singular**, y sus columnas de contacto son **`address` / `phone` / `email`**. El baseline de Liquibase (`v1_baseline.xml`) declara una tabla `clinics` con `location` / `phone_number` / `contact_email`: **está desactualizado**. La referencia son los flujos n8n en producción (`Whats App.json`, `Alert Scheduler.json`), que consultan `public.clinic`.
- `clinic_schedules` (ese sí en plural) **no tiene `clinic_id`**: la instalación es de una sola clínica, así que la subconsulta no filtra por clínica.
- `schedules` son los horarios **sin sede asignada** (`clinic_schedules.sede_id IS NULL`), los que valen para toda la clínica. Los de cada sede se piden a `/schedules_noauth?sede_id=`.
- `logo_url` se puede dejar en `null`; la landing cae al isotipo de Invoke IA sin romperse. Para servirlo, reusar la lectura de binario de `/clinic/logo` y convertirla a data URI.
- **Nunca** agregar campos sensibles acá: RUT, facturación, ids internos, datos de pacientes o de staff.

> El frontend asume `patient_portal_enabled: true` cuando el campo viene ausente, para no dejar la landing muerta si la columna todavía no está migrada. Es explícito el `!== false` en `src/services/public-clinic.ts`.

---

### 2.7 `POST /clinic/patient-portal-config`  *(con Bearer)*

Guarda los ajustes de Configuración → Portal del Paciente. **Sólo actualiza**: nunca crea clínicas ni toca nombre, RUT ni datos fiscales — eso sigue en `/clinic/update`.

```jsonc
{ "patient_portal_enabled": true, "online_booking_enabled": true,
  "appointments_only": false, "welcome_video_url": null, "welcome_message": null }
```
Requiere el permiso `PATIENT_PORTAL_CONFIG_UPDATE`. La lectura no tiene endpoint propio: reutiliza `/api/public/clinic`, que ya devuelve estos campos.

### 2.8 `POST /api/public/appointment-notify`  *(noauth)*

Avisa al paciente **y** a la clínica de cualquier cambio que el paciente haga sobre una cita.

```jsonc
{ "event": "booked" | "rescheduled" | "cancelled",
  "appointment_id": "...", "patient_id": "...",
  "patient_name": "...", "patient_email": "...",
  "date": "2026-08-20", "time": "14:00",
  "doctor_name": "...", "sede_name": "...", "reason": "...",
  "previous_date": "2026-08-13", "previous_time": "10:00" }   // sólo en rescheduled
```

| `event` | Cuándo | Qué dice |
|---|---|---|
| `booked` | Reservó una cita, con o sin sesión | Confirmación con los datos |
| `rescheduled` | Movió una cita | Nuevo horario, con el anterior tachado |
| `cancelled` | Canceló | A la clínica se le avisa que el horario se liberó |

El copy de ambos correos sale del nodo `Preparar Datos` según el evento; un valor desconocido cae a `booked`.

Es un flujo aparte y no un agregado a `/appointments/upsert`, porque ese endpoint lo usa toda la app —agenda del staff incluida— y mandaría correos donde hoy no se manda.

> El cliente **nunca falla por el correo**: `notifyAppointmentChange()` traga el error. La cita ya se creó/movió/canceló y el paciente ya vio la confirmación en pantalla.

### 2.9 `POST /api/public/patient-email-bounce`  *(noauth)*

Recibe el webhook de rebote del proveedor SMTP, marca `users.email_bounced` y deja una nota en las citas `pending` futuras de ese paciente.

> ⚠️ **Hay que registrar esta URL en el proveedor de correo** (SendGrid Event Webhook, Mailgun `permanent_fail`, Postmark Bounce, SNS de SES). Sin ese registro el flujo no se ejecuta nunca y los contactos falsos no se detectan.

---

## 3. Modos del portal y flujo de acceso

El comportamiento de `/patient-login` depende de dos flags de `clinic`:

| Flag | Efecto |
|---|---|
| `patient_portal_enabled` | `false` ⇒ la landing muestra "portal no disponible". |
| `patient_portal_online_booking` | `false` ⇒ el paciente sólo consulta; no puede reservar. |
| `patient_portal_appointments_only` | `true` ⇒ el portal es **sólo para reservar**. |

**Modo "sólo citas"** (`appointments_only = true`):
identificarse → agenda → confirmación. **Nunca** se pide OTP ni se entra al perfil, ni siquiera a un paciente conocido.

**Modo completo** (`appointments_only = false`):

| Situación | Camino |
|---|---|
| No está en el sistema | Registro (nombre + email, teléfono opcional) → **se crea el usuario** → agenda → confirmación. **Sin OTP.** |
| Existe, sin citas futuras | Agenda → confirmación. **Sin OTP** — no hay nada que consultar todavía. |
| Existe, con citas futuras | **OTP** → portal, en Citas. Detrás hay historia clínica y estado de cuenta: eso sí se protege. |

### Por qué el registro no pide OTP

Es una decisión de producto: pedir un código antes de la primera reserva agrega fricción justo donde más se pierde gente. El costo es que **se pueden crear pacientes y citas con correos inexistentes**. Las tres barreras que lo compensan:

1. La cita nace en `status = 'pending'` — recepción confirma antes de bloquear el horario.
2. `patient-email-bounce` marca al contacto y señala sus citas si el correo rebota (§2.9).
3. Rate-limit por IP en `/api/auth/patient/register` (pendiente de configurar en n8n).

Un paciente **ya existente** nunca accede a sus datos sin OTP: sin código sólo puede reservar, que no expone información.

---

## 3.1 Selección de sede

Cuando la clínica tiene **más de una sede**, el paciente elige primero dónde atenderse; hasta que no lo hace no se cargan horarios, porque los huecos dependen de los consultorios de esa sede.

El vínculo es `calendars.sede_id`: elegir sede se traduce en pasar sus `calendar_source_ids` a `/appointments_availability`.

**Endpoints requeridos sin sesión.** El flujo público (registro nuevo y modo "sólo citas") no tiene token, así que necesita las variantes:

- **`GET /sedes_noauth?page=1&limit=200`** — `id`, `name`, `address`, `phone`, `email`, `is_active`. Alimenta el pie del portal y el selector de sede.
- **`GET /calendars_noauth`** — `id`, `name`, `sede_id`, `is_active`. Vincula consultorios con sedes para filtrar los huecos.
- **`GET /schedules_noauth?sede_id=`** — horarios de una sede: `day_of_week`, `start_time`, `end_time` (`HH:MM:SS`, el cliente los recorta). Los usa el pie y, sobre todo, la grilla de huecos: **la ventana de atención es por sede**, no global.

> Si `/sedes_noauth` ya devuelve los consultorios de cada sede (en `calendar_ids`, `calendar_source_ids` o `calendars`), el cliente los usa y **no** llama a `/calendars_noauth`. Ver `fetchBookingSedes()`.

**Degradación:** si ninguna sede tiene consultorios vinculados, el selector se muestra igual y la elección se registra, pero los horarios no se filtran. Es deliberado — filtrar sin el vínculo cargado dejaba al paciente sin ninguna opción.

---

## 3.2 Endpoints reutilizados (no se crean workflows nuevos)

| Uso en el portal | Endpoint existente |
|---|---|
| Sesión / permisos | `GET /auth/me` |
| Datos del paciente | `GET /users?search=<id>&filter_type=PACIENTE` |
| Mis citas | `GET /users_appointments?user_id=&startingDateAndTime=&endingDateAndTime=` |
| Sedes | `GET /sedes` · sin sesión: **`/sedes_noauth`** |
| Consultorios | `GET /calendars` · sin sesión: **`/calendars_noauth`** |
| Slots libres | `GET /appointments_availability` · sin sesión: `/appointments_availability_noauth` |
| Reservar | `POST /appointments/upsert` · sin sesión: `/appointments/upsert_noauth` |
| Reagendar | `POST /appointments/reschedule` |
| Cancelar | `POST /appointments/update_status` (`status:'cancelled'`) |
| Historia clínica | `CLINIC_HISTORY.*`, `ODONTOGRAM.PATIENT_ODONTOGRAMS` |
| Finanzas | `GET /user_financial`, `/user_invoices`, `/user_payments`, `/user_quotes` |
| Preferencias | `GET /users/preferences` |

---

## 4. Checklist de puesta en marcha

1. `psql < database/scripts/065_20260806_patient-portal.sql`
2. `psql < database/scripts/066_20260806_clinic-patient-portal-settings.sql`
3. `UPDATE public.clinic SET patient_portal_enabled = TRUE;` — sin esto la landing muestra el aviso de "portal no disponible".
4. `psql < database/scripts/067_20260806_patient-portal-booking-mode.sql`
5. Importar `n8n-workflows/patient-*.json` (auth, public-clinic, ai-query, portal-config-upsert, appointment-notify, email-bounce); asignar la credencial SMTP y el secreto JWT existentes.
5. Agregar `assert_self_or_staff` a los workflows de la lista de §1.
6. Verificar con un token de paciente que `GET /webhook/users?filter_type=PACIENTE` devuelve **403** y que `GET /webhook/user_financial?user_id=<otro>` devuelve **403**.
7. Recién ahí, publicar el portal.

---

## 5. Pendiente — UI de administración

Los tres campos de §2.6 todavía **no tienen UI**. Hay que agregarlos al formulario de
`src/app/[locale]/config/clinics/page.tsx` (Configuración → Datos de la Clínica),
gatearlos con `BUSINESS_CONFIG_PERMISSIONS.CLINIC_DETAILS_UPDATE` e incluirlos en el
payload de `POST /clinic/update`:

| Campo | Control sugerido |
|---|---|
| `patient_portal_enabled` | Switch — "Permitir el acceso de pacientes al portal" |
| `welcome_video_url` | Input URL — vacío ⇒ video genérico de Invoke IA |
| `welcome_message` | Textarea — vacío ⇒ copy por defecto traducido |

Mientras tanto se configuran por SQL.
