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

`has_upcoming_appointments` es **informativo**: ya no decide si se pide el OTP —eso es siempre— sino que
permite al portal elegir dónde aterrizar. Calcularlo así:

```sql
SELECT EXISTS (
  SELECT 1 FROM public.appointments a
  WHERE a.patient_id = u.id
    AND a.start_datetime >= NOW()
    AND lower(coalesce(a.status, '')) NOT IN ('cancelled', 'canceled', 'no_show')
) AS has_upcoming_appointments
```

> ⚠️ La columna es **`start_datetime`**, no `start_time`. El baseline de Liquibase está desactualizado; la referencia son las queries de `docs/n8n-flows/All Appointment Workflows.json`.

> `user_id` y `name` sólo se devuelven cuando `found`. **No** agregar email en claro, teléfono ni cédula: este endpoint es público y responde a cualquiera que pruebe identificadores.

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
  "online_booking_enabled": true,
  "appointments_only": false,
  "service_selection_enabled": false,         // el paciente elige servicios
  "show_pricing": false,                      // muestra precios y duraciones
  "default_service": { "id": "48", "name": "Consulta general",
                       "duration_minutes": 30 },   // o null
  "schedules": [ { "day_of_week": 1, "start_time": "09:00", "end_time": "18:00" } ]
}
```

- Los tres campos configurables (`patient_portal_enabled`, `welcome_video_url`, `welcome_message`) salen de **`public.clinic`** — ver `database/scripts/066_20260806_clinic-patient-portal-settings.sql`.
- ⚠️ La tabla es **`clinic`, en singular**, y sus columnas de contacto son **`address` / `phone` / `email`**. El baseline de Liquibase (`v1_baseline.xml`) declara una tabla `clinics` con `location` / `phone_number` / `contact_email`: **está desactualizado**. La referencia son los flujos n8n en producción (`Whats App.json`, `Alert Scheduler.json`), que consultan `public.clinic`.
- `clinic_schedules` (ese sí en plural) **no tiene `clinic_id`**: la instalación es de una sola clínica, así que la subconsulta no filtra por clínica.
- `schedules` son los horarios **sin sede asignada** (`clinic_schedules.sede_id IS NULL`), los que valen para toda la clínica. Los de cada sede se piden a `/schedules_noauth?sede_id=`.
- `logo_url` se puede dejar en `null`: el cliente cae entonces a la URL del webhook binario **`/clinic/logo`** —el mismo que usan los membretes de los reportes—, así que el logo de la clínica se muestra igual sin que este flujo tenga que adjuntarlo. El isotipo de Invoke IA sólo aparece si esa imagen tampoco carga. Ver `fetchPublicClinicInfo()` y `ClinicBrandLogo`.
- `default_service` sale de `clinic.patient_portal_default_service_id` y **no exige `bookable_online`**: el servicio por defecto lo aplica la clínica, no el paciente, así que no tiene por qué estar publicado para auto-agenda.
- `show_pricing` es **sólo presentación**. La duración de los servicios dimensiona el hueco de la agenda con el flag encendido o apagado; lo único que cambia es si el paciente ve los números.
- **Nunca** agregar campos sensibles acá: RUT, facturación, ids internos, datos de pacientes o de staff.

> El frontend asume `patient_portal_enabled: true` cuando el campo viene ausente, para no dejar la landing muerta si la columna todavía no está migrada. Es explícito el `!== false` en `src/services/public-clinic.ts`.

---

### 2.7 `POST /clinic/patient-portal-config`  *(con Bearer)*

Guarda los ajustes de Configuración → Portal del Paciente. **Sólo actualiza**: nunca crea clínicas ni toca nombre, RUT ni datos fiscales — eso sigue en `/clinic/update`.

```jsonc
{ "patient_portal_enabled": true, "online_booking_enabled": true,
  "appointments_only": false,
  "service_selection_enabled": false, "show_pricing": false,
  "default_service_id": 48,              // entero, o null ⇒ sin servicio por defecto
  "welcome_video_url": null, "welcome_message": null }
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

### 2.10 `GET /services_noauth`  *(noauth)*

Servicios que el paciente puede auto-agendar. Sólo los que la clínica marcó con
`service_catalog.bookable_online`: el catálogo entero no es ofrecible sin
intermediarios —una cirugía existe como servicio pero nadie la reserva solo
desde una landing—.

```jsonc
[ { "id": "48", "name": "Limpieza", "description": null,
    "duration_minutes": 45,
    "has_image": true, "image_updated_at": "2026-09-30 10:00:00",
    "price": 1500, "currency": "UYU",
    "bookable_online": true, "is_active": true } ]
```

- **`price` y `currency` sólo se devuelven si `clinic.patient_portal_show_pricing` es `TRUE`.** Si la clínica eligió no mostrar precios, tampoco salen por un endpoint sin token: esconderlos en la UI no alcanza.
- Es `noauth` porque en modo "sólo citas" el paciente reserva sin haberse identificado.
- ⚠️ **El portal lo usa con sesión y sin ella.** No alcanza con `/services`: ese flujo devuelve el catálogo entero y **no incluye `bookable_online`**, así que el portal no puede distinguir qué está publicado — filtrando del lado del cliente contra un campo que no viene, el paso quedaba vacío. Esta es la proyección hecha para el portal y es la única que se consulta.
- `has_image` sale de `image_drive_file_id IS NOT NULL`, que es la fuente de verdad. Existe para que la UI no pida una imagen que no está: con `false` va directo al placeholder. **La URL de la imagen no la manda este endpoint** —la arma el cliente con el id, igual que con `/clinic/logo`— porque la base del webhook es configuración de entorno y el flujo no sabe con qué host lo consultan.

### 2.11 `GET /services/image?service_id=`  *(noauth)* · `POST /services/image/upload` · `POST /services/image/delete`

Imagen del servicio, para las tarjetas del paso de selección. **Mismo mecanismo
que el logo de la clínica y la firma del doctor**: el archivo vive en Google
Drive y en `service_catalog` quedan sólo los metadatos
(`image_filename`, `image_mimetype`, `image_drive_file_id`,
`image_web_view_link`, `image_updated_at`).

| Endpoint | Auth | Contrato |
|---|---|---|
| `GET /services/image?service_id=` | **noauth** | Binario con su `Content-Type`, o **204** si el servicio no tiene imagen. El front lo trata como "sin imagen", no como error. Sólo sirve servicios activos |
| `POST /services/image/upload` | Bearer | `multipart/form-data` con `service_id` (entero) y el archivo en el campo binario **`data`**. PNG/JPEG/WEBP, **máx. 1 MB**, validado en el front *y* en n8n |
| `POST /services/image/delete` | Bearer | `{ "service_id": 48 }`. Limpia las columnas y borra de Drive |

- El `GET` es público por la misma razón que `/clinic/logo`: la landing lo muestra sin token y no hay nada sensible en la imagen de un servicio.
- ⚠️ `service_catalog.id` es un **entero autoincremental**, no un UUID como `users.id`. La validación de los flujos lo refleja.
- El borrado del archivo anterior en Drive es best-effort: un archivo huérfano es preferible a fallar una operación que ya se completó.
- `image_updated_at` viaja al cliente y se manda como query param `v=` para invalidar la caché del navegador cuando la clínica reemplaza la imagen. **La imagen se pide siempre, sin condicionarla a ese campo**: `/services` (la ruta con sesión) no devuelve esa columna, así que gatear el request en ella dejaba el portal sin imágenes. Si no hay imagen, el 204 hace caer la tarjeta al placeholder — igual que en la vista de edición del servicio.

### 2.12 `POST /services/bookable-online`  *(con Bearer)*

Prende o apaga `service_catalog.bookable_online`. **Nada más.**

```jsonc
// Request
{ "service_id": 48, "bookable_online": true }
// Response
{ "success": true, "service_id": "48", "name": "Limpieza", "bookable_online": true }
```

Es un flujo aparte y no un campo más en `/catalogoservicios/upsert` porque ese
workflow vive en "Web APIs", no está versionado en este repo y lo usan tres
pantallas distintas del catálogo. Con un endpoint propio **hay un solo escritor
de esa columna**: cuando un servicio aparece —o no aparece— en el portal, hay un
único lugar donde mirar.

Rechaza un `bookable_online` ausente o no booleano en vez de interpretarlo como
`false`: apagar la agenda online de un servicio por un payload mal armado sería
peor que rechazar la llamada.

**Cuándo lo llama el front** (`src/app/[locale]/sales/services/page.tsx`):

| Momento | ¿Se llama? |
|---|---|
| Al **crear** un servicio | **Siempre.** El upsert no guarda el flag, así que crear con la opción activada la perdería |
| Al **editar**, habiendo tocado la opción | Sí |
| Al **editar** sin tocarla (p. ej. sólo el precio) | **No.** Se compara contra el valor guardado |

Siempre **antes** de recargar el listado, para que la recarga ya lea de la base
el valor nuevo y la pantalla no muestre el anterior.

---

## 3. Modos del portal y flujo de acceso

El comportamiento de `/patient-login` depende de dos flags de `clinic`:

| Flag | Efecto |
|---|---|
| `patient_portal_enabled` | `false` ⇒ la landing muestra "portal no disponible". |
| `patient_portal_online_booking` | `false` ⇒ el paciente sólo consulta; no puede reservar. |
| `patient_portal_appointments_only` | `true` ⇒ el portal es **sólo para reservar**. |
| `patient_portal_service_selection` | `true` ⇒ el paciente elige servicios en un paso previo a la fecha. `false` (default) ⇒ toda reserva usa el servicio por defecto. |
| `patient_portal_show_pricing` | `true` ⇒ se muestran precios y duraciones. Sólo presentación. |
| `patient_portal_default_service_id` | Servicio con el que se crea la cita si el paciente no elige. |

**El código es siempre la puerta.** Ningún camino reserva ni entra al portal sin verificar el correo:

| Situación | Camino |
|---|---|
| No está en el sistema | Registro → se crea el usuario → **OTP** → portal |
| Existe | **OTP** → portal |

Una vez verificado, el portal decide qué mostrar:

| Config | Qué ve |
|---|---|
| `appointments_only = true` | **Sólo** la pantalla de reserva. Nunca el expediente |
| Sin citas futuras | Reserva primero; el perfil aparece después |
| Con citas futuras | El perfil, en la pestaña de Citas |

### Por qué el OTP no es opcional

Una versión anterior lo salteaba para el paciente nuevo y para el que no tenía citas futuras, apostando a verificar el correo por rebote a posteriori. Era explotable: **escribir un email conocido no prueba ser su dueño**, así que desde cualquier navegador se podían reservar citas a nombre de otro, y el propio paciente recibía un código que el sistema nunca le pedía.

La verificación por rebote (§2.9) sigue siendo útil como red de seguridad para detectar correos falsos, pero **no reemplaza al OTP**: llega tarde, cuando la cita ya está creada.

> Consecuencia: la reserva ocurre siempre con sesión. Los endpoints `_noauth` de disponibilidad y alta (§3.3) quedaron sin uso desde el portal, salvo en modo "sólo citas".

---

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

## 3.2 Selección de servicios

El paso va **antes** de fecha y hora, y no es un detalle de orden: de los
servicios elegidos depende cuánto dura la cita, y por lo tanto qué huecos se
pueden ofrecer. Elegirlos después obligaría a descartar el horario ya elegido.

Lo único que decide si el paso se muestra es **`patient_portal_service_selection`**.
No depende de `patient_portal_appointments_only`: el paso aparece igual en el
modo "sólo citas" y dentro del perfil del paciente. Sí requiere
`patient_portal_online_booking`, porque sin reserva no hay paso que mostrar.

| Situación | Qué pasa |
|---|---|
| `service_selection_enabled = false` | No hay paso. La cita se crea con `default_service` |
| `= true`, con servicios agendables | El paciente marca **varios** (checkboxes). Los elegidos quedan fijos arriba, fuera del scroll |
| `= true`, sin ninguno `bookable_online` | El paso no aparece; se sigue con el servicio por defecto |
| `= true` y el paciente no marca nada | Puede continuar igual: cae al servicio por defecto |
| **Reagendando** | El paso aparece, con los servicios de la cita original **ya marcados**: no tocar nada los conserva. Los que no estén en el catálogo agendable (los puso recepción) se agregan a la lista igual, para que no desaparezcan sin que nadie lo pida. Si desmarca todo se reagenda **sin** servicios — no se aplica el default, porque eso cambiaría el motivo de una cita que ya existía |

**Ancho de pantalla.** El paso de servicios es el que más espacio pide, así que
las superficies que alojan la reserva le dan el ancho completo: en la landing la
bienvenida con el video se oculta mientras se reserva y vuelve al terminar
(`onBookingActiveChange`), y en `/my-profile` la pestaña de reserva no usa el
`max-w-2xl` del resto. La grilla de tarjetas va de una a tres columnas.

**Duración.** `slotMinutes` = suma de `duration_minutes` de los servicios
efectivos, con piso de 15 min y con `PATIENT_SLOT_MINUTES` (30) como fallback
cuando no hay servicios o no se pudo resolver su duración. Ese valor alimenta el
paso de la grilla **y** el `durationInMinutes` de `/appointments_availability`,
así que el backend verifica que el doctor esté libre todo ese rato. Cambiar la
selección **invalida el horario elegido**: un hueco de 30 min no sirve para una
cita de 90.

**Cómo llegan al backend.** `/appointments/upsert` ya consumía `service_ids` y
`service_names` —los usa el formulario del staff— e inserta en
`appointment_service_catalog`. El portal sólo dejó de mandarlos vacíos; **no
hubo que tocar el flujo de alta de citas**.

**Qué servicios se publican.** `service_catalog.bookable_online` lo escribe un
único endpoint, `POST /services/bookable-online` (§2.12), llamado desde Ventas →
Servicios. El upsert del catálogo no toca esa columna.

> ⚠️ Si `default_service` no está configurado y el paciente no elige nada, la
> cita se crea sin servicios. Es válido —recepción la completa— pero conviene
> dejar un servicio por defecto para que no llegue sin motivo.

---

## 3.3 Endpoints reutilizados (no se crean workflows nuevos)

| Uso en el portal | Endpoint existente |
|---|---|
| Sesión / permisos | `GET /auth/me` |
| Datos del paciente | `GET /users?search=<id>&filter_type=PACIENTE` |
| Mis citas | `GET /users_appointments?user_id=&startingDateAndTime=&endingDateAndTime=` |
| Sedes | `GET /sedes` · sin sesión: **`/sedes_noauth`** |
| Consultorios | `GET /calendars` · sin sesión: **`/calendars_noauth`** |
| Slots libres | `GET /appointments_availability` · sin sesión: `/appointments_availability_noauth` |
| Servicios agendables | `GET /services` (filtrado por `bookable_online`) · sin sesión: **`/services_noauth`** |
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
4b. `psql < database/scripts/122_20260930_service-booking-and-images.sql` — agrega
    `service_catalog.bookable_online` + columnas de imagen, y los tres ajustes
    de servicios en `clinic`.
4c. Crear en Google Drive la carpeta de imágenes de servicios y poner su id en
    `service-image-upload.json` (`GOOGLE_DRIVE_SERVICE_IMAGES_FOLDER_ID`).
4d. Importar `n8n-workflows/service-bookable-online.json`. **No hay que tocar
    `/catalogoservicios/upsert`**: ese flujo no persiste `bookable_online` y no
    hace falta que lo haga — el switch escribe por este endpoint dedicado.
4e. En `docs/n8n-flows/All Appointment Workflows.json`, nodo
    `Insert_Appointment1` (rama `_noauth`): ya quedó mapeado
    `calendar_source_id`, que antes se perdía. Reimportar ese workflow.
5. Importar `n8n-workflows/patient-*.json` (auth, public-clinic, ai-query, portal-config-upsert, appointment-notify, email-bounce); asignar la credencial SMTP y el secreto JWT existentes. **Reimportar `patient-public-clinic.json` y `patient-portal-config-upsert.json`**: cambiaron para los campos de servicios.
5b. Importar `n8n-workflows/service-image-{upload,get,delete}.json` y
    `n8n-workflows/services-bookable-noauth.json`. **`service-image-get` y
    `services_noauth` van SIN autenticación**; los otros dos, con Bearer.
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
