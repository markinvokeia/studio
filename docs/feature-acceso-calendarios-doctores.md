# Acceso de doctores a calendarios en el Workspace

> Permite que un doctor, además de ver sus citas asignadas, pueda consultar en su
> Espacio de Trabajo (Workspace) las citas de uno o más **calendarios/agendas** a los
> que el administrador le haya dado acceso.

---

## 1. Documentación funcional (para el cliente)

### 1.1 ¿Qué problema resuelve?

Hasta ahora, cuando un doctor entraba a su Workspace solo veía **las citas asignadas a él**
(las que tienen su nombre como profesional), sin importar en qué agenda/calendario estuvieran.

Con esta funcionalidad, un doctor puede **alternar** entre:

- **"Asignadas a mí"** → sus citas, exactamente como funcionaba antes.
- **"Mis calendarios"** → todas las citas registradas en un calendario al que tiene acceso,
  sin importar a qué profesional estén asignadas.

Esto es útil, por ejemplo, cuando varios doctores comparten una agenda/sillón, o cuando un
profesional necesita ver la ocupación completa de un calendario.

Esta posibilidad **no está activa por defecto**: el administrador decide, doctor por doctor,
si la habilita y a qué calendarios da acceso.

---

### 1.2 Paso a paso para el administrador

Para que un doctor pueda usar el selector de calendarios deben cumplirse **dos condiciones**:

1. Que el doctor tenga **habilitado el permiso** para ver agendas de calendarios (un flag).
2. Que el doctor esté **asignado al menos a un calendario**.

Si falta cualquiera de las dos, el doctor solo verá sus citas asignadas (el selector ni
siquiera aparece).

#### Paso A — Habilitar el permiso al doctor

1. Ir a **Configuración → Doctores**.
2. Crear un doctor nuevo o seleccionar uno existente para abrir su panel de detalle.
3. En el formulario (tanto al **crear** como al **editar**) aparece la casilla:
   **"Puede ver agendas de calendarios"**.
   - **Desmarcada (por defecto):** el doctor solo ve sus citas asignadas.
   - **Marcada:** se habilita la posibilidad de ver calendarios (falta asignarle calendarios, Paso B).
4. Guardar.

#### Paso B — Asignar calendarios al doctor

El vínculo "calendario ↔ doctor" se puede gestionar **desde dos lugares distintos**, y ambos
afectan a la misma información (es indistinto cuál se use):

**Opción 1 — Desde el Calendario** (útil para asignar varios doctores a un mismo calendario)

1. Ir a **Configuración → Calendarios**.
2. Seleccionar un calendario.
3. Abrir el tab **"Doctores con acceso"**.
4. Elegir en el selector los doctores que tendrán acceso a ese calendario (se pueden marcar
   varios) y pulsar **"Guardar accesos"**.

**Opción 2 — Desde el Doctor** (útil para asignar varios calendarios a un mismo doctor)

1. Ir a **Configuración → Doctores** y seleccionar un doctor.
2. Abrir el tab **"Calendarios con acceso"**.
3. Elegir en el selector los calendarios a los que tendrá acceso y pulsar **"Guardar accesos"**.

> Ambas vistas son equivalentes y se sincronizan: si asigno el Doctor 1 al Calendario A desde
> la pantalla de Calendarios, al abrir el Doctor 1 veré el Calendario A en su lista, y viceversa.

**Ejemplo:** al Calendario A le asigno Doctor 1 y Doctor 3. Cuando el Doctor 1 o el Doctor 3
entren a su Workspace, podrán seleccionar el Calendario A. El Doctor 2 (no asignado) no verá el
Calendario A en su selector.

#### Quitar accesos

En cualquiera de los dos tabs, se quita un acceso desmarcándolo en el selector (o con la "X"
del chip correspondiente) y pulsando **"Guardar accesos"**.

---

### 1.3 Experiencia del doctor en el Workspace

Cuando el doctor abre su **Espacio de Trabajo**:

- **Si NO tiene el permiso, o no está asignado a ningún calendario:** todo funciona como antes.
  Ve únicamente sus citas asignadas y **no aparece ningún selector**.

- **Si tiene el permiso y al menos un calendario asignado:** en la cabecera de la *Agenda del
  día* aparece un conmutador con dos opciones:
  - **"Asignadas a mí"** (opción por defecto): muestra sus citas asignadas.
  - **"Mis calendarios"**: muestra un desplegable con los calendarios a los que tiene acceso;
    al elegir uno, la agenda carga **todas las citas de ese calendario** (de cualquier
    profesional).

El conmutador recuerda siempre cuál de las dos vistas está activa, y al elegir "Mis
calendarios" queda visible qué calendario se está mostrando. El doctor puede cambiar de una
vista a otra en cualquier momento; el resto del Workspace (ficha del paciente, historia
clínica, acciones) sigue funcionando igual sobre la cita seleccionada.

---

### 1.4 Resumen de reglas funcionales

| Situación del doctor | ¿Ve el selector? | ¿Qué puede ver? |
|---|---|---|
| Sin permiso | No | Solo sus citas asignadas |
| Con permiso, sin calendarios asignados | No | Solo sus citas asignadas |
| Con permiso y ≥ 1 calendario asignado | Sí | Sus citas asignadas **o** las de un calendario asignado |

Además, en la **creación de citas** el comportamiento existente se refuerza: al elegir un
doctor, el selector de calendario se limita a los calendarios a los que ese doctor tiene
acceso (más su calendario propio), y se preselecciona su calendario por defecto.

---

## 2. Resumen técnico (para el equipo de desarrollo)

> El detalle funcional está arriba; esta sección solo enumera los cambios.

### 2.1 Base de datos

**Migración `052_20260625_calendar-users-access.sql`**
- Nueva tabla puente **`calendar_users`** (N:M entre `calendar_sources` y `users`):
  `calendar_source_id bigint` + `user_id uuid`, PK compuesta, ambas FK con `ON DELETE CASCADE`,
  índice por `user_id`. Nombre genérico (`users`, no `doctors`) pensando en usos futuros.
- Nuevo permiso **`CALENDARS_MANAGE_USERS`** + asignación a roles Administrador (4) y Gerente (37).

**Migración `053_20260625_users-can-browse-calendars.sql`**
- Nueva columna **`users.can_browse_calendars boolean NOT NULL DEFAULT false`** (el flag por doctor).
- **`get_users_filtered(...)`**: se hace `DROP` + `CREATE` (cambia el tipo de retorno) para
  agregar `can_browse_calendars boolean` al `RETURNS TABLE` y al `SELECT`, justo después de
  `calendar_source_id`. El resto de la función queda igual.

### 2.2 Flujos n8n

**Nuevos** (en `docs/n8n-flows/`, vienen con `"active": false`):
- **`flow-calendar-users-search.json`** → `GET /webhook/calendar_users/search`. Un único flujo
  con filtros opcionales que cubre 3 modos:
  - `?calendar_source_id=` → doctores con acceso a un calendario (tab del Calendario).
  - `?user_id=` → calendarios accesibles por un doctor (Workspace + tab del Doctor + form de citas).
  - sin parámetros → todas las asociaciones (mapa doctor→calendarios del form de citas).
  - Devuelve `calendar_source_id, user_id, user_name, calendar_name, color`.
- **`flow-calendar-users-upsert.json`** → `POST /webhook/calendar_users/upsert`. Recibe
  `{ calendar_source_id, user_ids: [...] }` y **reemplaza el set completo** de usuarios de ese
  calendario (CTE `DELETE` + `INSERT … unnest()` en una sola sentencia atómica; un `SELECT
  COUNT(*)` final garantiza respuesta incluso al vaciar el set).

**Modificados / a verificar (responsabilidad backend):**
- **`auth/me`** → debe incluir `can_browse_calendars` en el usuario (el front lo lee desde
  `AuthContext`). *Ya verificado que lo devuelve.*
- **`users` (USERS_UPSERT)** → debe **persistir** `can_browse_calendars` al crear/editar doctor.
- **`users` (listado)** → al usar `get_users_filtered`, ya expone la columna (sirve de fallback
  en el Workspace si `auth/me` no la trajera).
- **`users_appointments`** → **sin cambios**. Se reutiliza tal cual: el Workspace en modo
  calendario envía `calendar_source_ids={id}` y omite `doctor_id` (mismo parámetro que ya usa la
  página de Citas). El servicio filtra por calendario e ignora el doctor.

### 2.3 Frontend (resumen)

- **Constantes/tipos:** `CALENDAR_USERS_SEARCH` y `CALENDAR_USERS_UPSERT` en `routes.ts`;
  `CALENDARS_MANAGE_USERS` en `permissions.ts`; `can_browse_calendars?` en los tipos `User` y
  `AuthUser`; tipo `CalendarUserAccess`.
- **CRUD desde el Calendario:** tab **"Doctores con acceso"** en `config/calendars/page.tsx`
  (componente `calendar-access-tab.tsx`) — multiselect de doctores + guardado vía upsert.
- **CRUD desde el Doctor:** tab **"Calendarios con acceso"** en `config/doctors/page.tsx`
  (componente `doctor-calendars-tab.tsx`) — multiselect de calendarios. Como el upsert es
  "por calendario", al guardar recalcula los calendarios cambiados y por cada uno hace
  `search?calendar_source_id=` + `upsert` (reutiliza los mismos endpoints, sin lógica nueva en n8n).
- **Flag del doctor:** casilla **"Puede ver agendas de calendarios"** en el form de crear/editar
  doctor (default `false`), enviada en el payload de upsert.
- **Workspace** (`doctor-workspace.tsx`):
  - Lee `can_browse_calendars` de `auth/me` (con fallback a `USERS` si no viniera).
  - Si el flag está activo, carga los calendarios accesibles (`search?user_id=`).
  - Muestra el conmutador **solo** si `flag === true && accesibles.length > 0`.
  - Conmutador "Asignadas a mí" / "Mis calendarios" + selector de calendario; refactor del fetch
    para soportar modo doctor (`doctor_id`) o modo calendario (`calendar_source_ids`).
- **Form de creación de citas** (`AppointmentFormDialog.tsx` + `appointments/page.tsx`): nuevo
  `doctorCalendarMap` (doctor → calendarios accesibles) construido desde `search` sin parámetros;
  al elegir doctor, el selector de calendario se limita a sus calendarios accesibles + el propio,
  preseleccionando el propio.
- **i18n:** cadenas nuevas en `messages/es.json` y `messages/en.json` (etiquetas visibles dicen
  "Doctores"/"Calendarios"; el backend usa el término genérico `users`).

### 2.4 Checklist de despliegue

1. Aplicar migraciones **052** y **053**.
2. Importar y **activar** los flujos `calendar_users/search` y `calendar_users/upsert` en n8n
   (verificar credencial Postgres `clinic-postgres`).
3. Asegurar que `auth/me` y `users` (upsert) contemplen `can_browse_calendars`.
4. Configurar accesos: marcar el flag al doctor y asignarle calendarios (desde Calendario o Doctor).
