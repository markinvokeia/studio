# Plan — Matriz de colores de estado configurable por cliente

Repo: `/Users/luisrs/Workspace/invokeia/projects/studio`
Ramas comparadas: `clinica_imagen` (actual) vs `bracketsup`
Fecha: 2026-09-15

---

## 0. Diagnóstico

La divergencia entre ramas se reduce a **dos ejes por estado**, no uno:

| Eje | `clinica_imagen` | `bracketsup` |
| --- | --- | --- |
| **color** de `scheduled` | `#a78bfa` lila | `#3b82f6` azul |
| **modo en calendario** de `scheduled` | `always` (pinta la card entera siempre) | `never` (nunca pinta; la cita queda con el color del calendario) |
| **color** de `no_show` | `#4b5563` gris | `#ef4444` rojo |
| **modo en calendario** de `no_show` | `always` | `preference` (según `color_by_status`) |

`clinica_imagen` lo modela con `STATUS_FORCED_CALENDAR_COLOR` (lista blanca de "siempre") y
`bracketsup` con `STATUS_NEUTRAL_ON_CALENDAR` (lista blanca de "nunca"). Son **la misma
dimensión con el default distinto**. La matriz la unifica en un enum de 3 valores y borra la
necesidad de ramas divergentes.

Estado actual del código: `STATUS_ACCENT_COLOR` / `STATUS_BADGE_VARIANT` /
`STATUS_FORCED_CALENDAR_COLOR` son constantes de módulo consumidas en **16 archivos**, algunas
**a nivel de módulo** (`AppointmentStatusMenu.tsx:48`), lo que impide volverlas dinámicas sin
refactor.

---

## 1. Modelo de datos

### Tabla nueva `public.calendar_status_display`

Una fila por `(clinic_id, calendar_id, status)`. **Fila por estado y no un JSONB**: es
literalmente la matriz, permite override parcial, y "replicar a cada calendario" es un
`INSERT … SELECT` en vez de duplicar un blob.

```sql
CREATE TABLE IF NOT EXISTS public.calendar_status_display (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id     INTEGER     NOT NULL REFERENCES public.clinic (id) ON DELETE CASCADE,
    -- NULL = configuración GENERAL del cliente. No NULL = override de ese calendario.
    calendar_id   UUID        REFERENCES public.calendars (id) ON DELETE CASCADE,
    status        VARCHAR(20) NOT NULL
                  CHECK (status IN ('scheduled','confirmed','arrived','arrived_late',
                                    'in_progress','completed','attended_late',
                                    'no_show','cancelled','pending')),
    color         VARCHAR(7)  NOT NULL CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
    calendar_mode VARCHAR(12) NOT NULL DEFAULT 'preference'
                  CHECK (calendar_mode IN ('always','preference','never')),
    badge_style   VARCHAR(8)  NOT NULL DEFAULT 'solid'
                  CHECK (badge_style IN ('solid','soft','outline')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- UNIQUE con calendar_id NULL: dos índices parciales (no depende de PG15).
CREATE UNIQUE INDEX IF NOT EXISTS calendar_status_display_general_uq
    ON public.calendar_status_display (clinic_id, status) WHERE calendar_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS calendar_status_display_per_calendar_uq
    ON public.calendar_status_display (clinic_id, calendar_id, status) WHERE calendar_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS calendar_status_display_clinic_idx
    ON public.calendar_status_display (clinic_id);
```

**Verificar antes de escribir el SQL:** el nombre y el tipo de PK real de la tabla de
calendarios (`calendars`? `calendar_source`?) y el tipo de `clinic.id`. Se confirma por MCP
postgres con `list_objects` + `get_object_details` (solo lectura).

### Semántica de `calendar_mode`

| Valor | Comportamiento en el calendario |
| --- | --- |
| `always` | La card entera se pinta con el color del estado **aunque** `color_by_status` esté apagado y aunque el color venga de servicio/doctor/consultorio. Excepción que se mantiene: etiqueta de color puesta a mano sobre la cita gana, y el estado baja a franja lateral. |
| `preference` | Comportamiento actual por defecto: respeta `color_by_status` del usuario; con color propio o de servicio → franja lateral; si solo hereda doctor/consultorio → pinta la card. |
| `never` | Nunca aporta color al calendario; la cita se ve igual que con la preferencia apagada. |

`badge_style` gobierna el resto de la app (badges, chips de historia, notificaciones):
`solid` = fondo del color + texto legible (`getReadableTextColor`), `soft` = fondo al 15 % +
texto del color, `outline` = borde del color. Es la pieza que permite que "un solo origen de
verdad" no rompa la legibilidad de los badges, que hoy usan una paleta distinta
(`STATUS_BADGE_VARIANT` → `info/default/warning/…`).

### Migración `database/scripts/084_20260915_calendar-status-display.sql`

Estructura idéntica a `068_20260814_clinic-preferences-and-discounts.sql`: `BEGIN` / tabla /
`COMMENT ON` por columna / trigger `update_updated_at_column` / seed / permisos /
`db_migrations` / bloque `ROLLBACK` comentado. Idempotente.

Seed de la **configuración general** por clínica, con los valores por defecto (sección 5):

```sql
INSERT INTO public.calendar_status_display (clinic_id, calendar_id, status, color, calendar_mode)
SELECT c.id, NULL, v.status, v.color, v.mode
FROM public.clinic c
CROSS JOIN (VALUES
    ('scheduled','#a78bfa','always'), ('confirmed','#0284c7','preference'), …
) AS v(status, color, mode)
ON CONFLICT DO NOTHING;
```

Permisos nuevos `CALENDAR_DISPLAY_VIEW` / `CALENDAR_DISPLAY_UPDATE` (módulo `config`, submenú
`calendar-colors`). **Los roles se resuelven por nombre, nunca por id** — los ids difieren
entre BDs de cliente:

```sql
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name IN ('Administrador', 'Gerente')
  AND p.code IN ('CALENDAR_DISPLAY_VIEW','CALENDAR_DISPLAY_UPDATE')
ON CONFLICT (role_id, permission_id) DO NOTHING;
```

Además, dos scripts de seed por cliente en `database/scripts/seeds/`
(`clinica-imagen-status-colors.sql`, `bracketsup-status-colors.sql`) con los valores de cada
rama, para que el corte no cambie nada visualmente en producción.

---

## 2. Backend (n8n) — contrato requerido

Tres endpoints nuevos en `src/constants/routes.ts`:

```ts
CALENDAR_STATUS_DISPLAY: {
    SEARCH: '/calendar_status_display/search',   // GET  → todas las filas de la clínica (general + overrides)
    UPSERT: '/calendar_status_display/upsert',   // POST { rows: Row[] }  (batch)
    DELETE: '/calendar_status_display/delete',   // POST { calendar_id }  → borra el override completo de ese calendario
}
```

`Row = { calendar_id: string | null; status; color; calendar_mode; badge_style }`.
`clinic_id` lo resuelve el backend desde el JWT, como el resto de los flujos.

**`UPSERT` en batch es requisito**, no comodidad: guardar la matriz son 10 filas, y "replicar a
N calendarios" son 10·N. Con un flujo de a una fila el botón de replicar hace 10·N requests.

> ⚠️ **Dependencia externa bloqueante.** Sin estos tres flujos n8n el frontend no persiste. Se
> puede desarrollar y revisar contra los defaults compilados (el store cae a
> `DEFAULT_STATUS_DISPLAY` si el search falla), pero la funcionalidad no cierra hasta que existan.

---

## 3. Frontend — arquitectura

### 3.1 Tipos (`src/lib/types.ts`)

```ts
export type StatusCalendarMode = 'always' | 'preference' | 'never';
export type StatusBadgeStyle   = 'solid' | 'soft' | 'outline';

export type AppointmentStatusDisplay = {
  color: string;                    // hex #rrggbb
  calendarMode: StatusCalendarMode;
  badgeStyle: StatusBadgeStyle;
};

export type AppointmentStatusDisplayMatrix = Record<AppointmentStatus, AppointmentStatusDisplay>;

export type CalendarStatusDisplayRow = AppointmentStatusDisplay & {
  calendar_id: string | null;       // null = general
  status: AppointmentStatus;
};
```

### 3.2 Defaults (`src/constants/appointment-status.ts`)

- **Se eliminan** `STATUS_ACCENT_COLOR`, `STATUS_BADGE_VARIANT` y `STATUS_FORCED_CALENDAR_COLOR`.
  Borrarlas en vez de dejarlas como alias es deliberado: `pnpm typecheck` pasa a ser la
  checklist de migración y ningún archivo se queda silenciosamente con colores estáticos.
- **Se agrega** `DEFAULT_STATUS_DISPLAY: AppointmentStatusDisplayMatrix`, con los comentarios de
  justificación de color que ya existen (ΔE2000 entre `confirmed` y `scheduled`, los tres
  grises, etc.) reubicados ahí.
- Todo lo demás del archivo (`APPOINTMENT_STATUSES`, transiciones, `STATUS_MENU_LAYOUT`,
  `normalizeAppointmentStatus`, `canReschedule`, `canDelete`) queda igual.

### 3.3 Resolución pura (`src/lib/appointment-status-display.ts` — archivo nuevo)

Sin React, testeable, compartido por el hook y por el `useMemo` de la página:

```ts
resolveStatusDisplay(matrix, status): AppointmentStatusDisplay
mergeStatusMatrix(base, rows): AppointmentStatusDisplayMatrix   // valida hex y enums; ignora filas corruptas
statusBadgeClassNames(display): string                          // solid | soft | outline → clases Tailwind
resolveEventStatusColors({ status, display, colorSource, color, colorByStatus })
    : { color: string | undefined; statusColored: boolean; statusStripeColor: string | undefined }
```

`resolveEventStatusColors` es la extracción literal de
`src/app/[locale]/appointments/page.tsx:3562-3596`, con `forcesStatus` reemplazado por
`display.calendarMode`:

```ts
const showsStatus =
  display.calendarMode === 'always'  ? true  :
  display.calendarMode === 'never'   ? false :
  colorByStatus;
const forces         = display.calendarMode === 'always';
const hasOwnColorTag = colorSource === 'appointment' && Boolean(color);
const keepsOwnColor  = hasOwnColorTag || (!forces && colorSource === 'service');
const statusColored  = showsStatus && !keepsOwnColor;
```

Esto es exactamente lo que hoy diverge entre ramas, y queda en un solo lugar con tests.

### 3.4 Servicio (`src/services/calendar-status-display.ts` — archivo nuevo)

`fetchStatusDisplayRows()`, `upsertStatusDisplayRows(rows)`, `deleteCalendarOverride(calendarId)`.
Desenvuelve la respuesta con el mismo patrón defensivo de `unwrapCalendarSettingsRow` (la API
devuelve `row`, `[row]`, `{data:[row]}`…). Normaliza con `mergeStatusMatrix` para que una fila
con un hex inválido no rompa el calendario.

### 3.5 Store (`src/stores/calendar-status-display-store.ts` — archivo nuevo)

Zustand, calcado de `clinic-preferences-store.ts`:

```ts
{ general: AppointmentStatusDisplayMatrix,
  byCalendar: Record<string, AppointmentStatusDisplayMatrix>,
  isLoaded: boolean, isLoading: boolean,
  fetchMatrix(), setRows(rows) }
```

Mientras `isLoaded === false` sirve `DEFAULT_STATUS_DISPLAY` — el calendario nunca queda sin
color esperando la red.

Carga: se extiende `ClinicPreferencesInitializer`
(`src/components/clinic/ClinicPreferencesInitializer.tsx`, ya montado en
`src/app/[locale]/layout.tsx:76` dentro de `PrivateRoute`) para disparar también este fetch.
Un initializer nuevo sería un segundo componente con el mismo ciclo de vida sin ganancia.

### 3.6 Hook (`src/hooks/useAppointmentStatusDisplay.ts` — archivo nuevo)

Única puerta de entrada de los componentes, patrón `useDiscountSettings`:

```ts
function useAppointmentStatusDisplay(calendarId?: string | null): {
  matrix: AppointmentStatusDisplayMatrix;
  colorOf(status): string;
  displayOf(status): AppointmentStatusDisplay;
  badgeClassOf(status): string;
}
```

Resuelve `byCalendar[calendarId] ?? general ?? DEFAULT_STATUS_DISPLAY`. No dispara peticiones.

---

## 4. Migración de los 16 consumidores

Guiada por el typecheck tras borrar las constantes. Agrupados por tipo de cambio:

**A. Calendario — color de evento (fuente de verdad del pintado)**

- `src/app/[locale]/appointments/page.tsx:3562-3596` → llama `resolveEventStatusColors`;
  agregar `matrix` al array de dependencias del `useMemo` (línea 3640). El `colorByStatus` de
  las líneas 1323/1347 se mantiene intacto.

**B. Calendario — lectura directa de color por estado** (sustituir import por hook)

- `calendar-event.tsx:66`, `calendar-event-day.tsx:111`, `calendar-schedule-view.tsx:42`,
  `calendar-search-panel.tsx:300`, `calendar-month-view-mobile.tsx:244`,
  `appointment-quick-view.tsx:118`.
- `calendar-event.tsx` y `calendar-event-day.tsx` están memoizados (`React.memo`) y se
  renderizan por evento: el hook lee del store con selector, así que un cambio de matriz
  re-renderiza una vez, no por card.

**C. Menú / rail / panel de estados**

- `AppointmentStatusMenu.tsx:48,112,203` — **ojo:** la línea 48
  (`const CANCELLATION_REASON_COLOR = STATUS_ACCENT_COLOR.cancelled`) es **scope de módulo** y
  hay que moverla dentro del componente. Es el único sitio donde el refactor no es mecánico.
- `AppointmentStatusRail.tsx:69,97,170,189,212,290,327` (7 usos).
- `AppointmentPanel.tsx:875` (y el comentario de `:88` que referencia `STATUS_ACCENT_COLOR.confirmed`).

**D. Badges fuera del calendario** (`STATUS_BADGE_VARIANT` → `badgeClassOf`)

- `doctor-workspace.tsx:85`, `PatientAppointmentsHistorySheet.tsx:299`,
  `clinic-history-viewer.tsx`, `notification-card.tsx:97`, `GlobalNotificationAlerts.tsx:35`,
  `patient-portal/appointment-card.tsx:62`.
- Se agrega la variante `custom` a `src/components/ui/badge.tsx` (sin colores propios) para
  poder pasar clases/estilo desde el hook sin pelear con las variantes existentes.
- **Cambio visual esperado y querido**: hoy `confirmed` en badge es `default` (color primario) y
  en calendario `#0284c7`. Al unificar, el badge pasa al color de la matriz. Es la consecuencia
  directa de "un solo origen de verdad" — conviene mostrarle una captura al cliente antes de
  mergear.

**E. Fuera de alcance (confirmado, no tocar)**

- `src/app/[locale]/tv-display/page.tsx:35` — `statusColors` es el estado de la **pantalla**
  (on/off/paused/promo), no de la cita.
- `src/components/ui/status-badge.tsx` — badge genérico de presupuestos/facturas, ajeno a
  `AppointmentStatus`.
- `src/app/[locale]/reports/cancelaciones/page.tsx:54` — paleta de **motivos de cancelación**,
  otra dimensión. Candidata a una segunda matriz más adelante; hoy se deja.

**F. Portal del paciente — punto abierto.** `patient-portal/appointment-card.tsx` renderiza bajo
sesión de paciente; el store se llena dentro de `PrivateRoute` del staff. **Resolución
propuesta:** el portal cae a `DEFAULT_STATUS_DISPLAY` en esta fase y se anota como deuda;
exponer la matriz en el endpoint público del portal es un ítem aparte.

---

## 5. Defaults compilados

`DEFAULT_STATUS_DISPLAY` toma los valores de **`clinica_imagen`** (lila + gris, ambos
`always`): es la rama con el trabajo de color más reciente y documentado, y es la que arrastra
`main`. `bracketsup` deja de ser una rama divergente y pasa a ser **filas en su BD**
(`scheduled` → `#3b82f6` / `never`; `no_show` → `#ef4444` / `preference`).

| Estado | color | calendar_mode |
| --- | --- | --- |
| `pending` | `#9ca3af` | `preference` |
| `scheduled` | `#a78bfa` | `always` |
| `confirmed` | `#0284c7` | `preference` |
| `arrived` | `#f59e0b` | `preference` |
| `arrived_late` | `#d97706` | `preference` |
| `in_progress` | `#f97316` | `preference` |
| `completed` | `#16a34a` | `preference` |
| `attended_late` | `#0d9488` | `preference` |
| `no_show` | `#4b5563` | `always` |
| `cancelled` | `#6b7280` | `preference` |

---

## 6. Pantalla de configuración

`src/app/[locale]/config/calendar-colors/page.tsx` + `layout.tsx`, y el grueso en
`src/components/calendar/status-display-matrix.tsx`. Precedente de UI:
`src/components/roles/permission-matrix.tsx` (matriz editable con guardar / restaurar / estado
sucio).

**Layout** — `PageHeader` + tabla matriz, filas en el orden de `STATUS_MENU_LAYOUT`:

```
Estado              Color            En el calendario           Badge      Vista previa
────────────────────────────────────────────────────────────────────────────────────────
🗓  Programada       [swatch ▾]  #a78bfa   ( Siempre        ▾ )   (Sólido ▾)   [ 09:00 Juan P. ]
✓  Confirmada       [swatch ▾]  #0284c7   ( Según pref.    ▾ )   (Sólido ▾)   [ 09:30 Ana G.  ]
✗  No asistió       [swatch ▾]  #4b5563   ( Siempre        ▾ )   (Sólido ▾)   [ 10:00 Luis R. ]
```

- **Color**: popover con los 11 presets de `GOOGLE_CALENDAR_COLORS` + input hex libre +
  `<input type="color">`.
- **En el calendario**: `Select` de 3 opciones con texto explicativo (mismo tono que los
  `help.*` del popover de ajustes).
- **Vista previa**: mini card real, renderizada con `resolveEventStatusColors` sobre una cita
  ficticia con color de servicio, para que se vea la diferencia entre franja lateral y card
  pintada sin salir de la pantalla.
- **Aviso de contraste**: si dos estados quedan a ΔE2000 < 10 se muestra un `Alert` no
  bloqueante. Es exactamente el problema que documentan los comentarios actuales de
  `appointment-status.ts` (emerald vs green) y que la configuración libre va a reintroducir.

**Acciones del header**: `Guardar` (batch upsert + `setRows` en el store, como hace
`clinic-prefs/page.tsx` con `setStorePreferences`), `Restaurar por defecto`,
`Replicar a calendarios…`.

**Diálogo "Replicar a calendarios"**: lista de calendarios con checkboxes + "Seleccionar
todos"; escribe la matriz general como filas con `calendar_id` de cada uno. Una nota explica
que a partir de ahí ese calendario queda desacoplado de la general.

**Sección "Calendarios con configuración propia"**: lista los `calendar_id` con overrides y
ofrece "Volver a usar la general" (→ `DELETE`). En esta fase **no** se editan matrices por
calendario desde la UI: solo se replican y se quitan. Es lo pedido ("a nivel general del
cliente… al menos por ahora"), y la tabla ya soporta el paso siguiente sin migración.

---

## 7. Permisos, navegación e i18n

- `src/constants/permissions.ts`: `CALENDAR_DISPLAY_PERMISSIONS = { VIEW: 'CALENDAR_DISPLAY_VIEW', UPDATE: 'CALENDAR_DISPLAY_UPDATE' }`.
- `src/constants/default-role-permissions.ts`: agregar los códigos a Administrador y Gerente.
- `src/config/nav.ts`: entrada `CalendarColors` → `/config/calendar-colors`, icono `Palette`,
  después de `Calendars` (línea ~240), con `requiredPermission: CALENDAR_DISPLAY_PERMISSIONS.VIEW`;
  sumar `VIEW` al array de permisos del grupo Configuración (línea ~231).
- Botón Guardar envuelto en `<Can>` / deshabilitado sin `UPDATE`, igual que `clinic-prefs/page.tsx`.
- **Al implementar: cargar la skill `permissions-protection`** (lo exige el CLAUDE.md para
  cualquier UI con control de acceso).
- i18n: namespace `CalendarColorsPage` en `src/messages/en.json` **y** `src/messages/es.json` —
  títulos, las 3 opciones de modo con su ayuda, los 3 estilos de badge, textos del diálogo de
  replicar, aviso de contraste, toasts. Actualizar además
  `AppointmentsPage.settings.help.colorByStatus` (líneas 993 de ambos archivos), que hoy
  describe en prosa el comportamiento cableado de "Programada (lila) y No asistió (gris)".

---

## 8. Orden de ejecución

1. Confirmar por MCP postgres (solo lectura) los nombres/tipos reales de `calendars.id` y `clinic.id`.
2. Migración SQL + los dos seeds por cliente.
3. Tipos, `DEFAULT_STATUS_DISPLAY`, `appointment-status-display.ts` (puro) — compila sin tocar nada más.
4. Servicio + store + hook + enganche en `ClinicPreferencesInitializer`.
5. **Borrar las 3 constantes** y migrar los 16 consumidores guiado por `pnpm typecheck` (grupos A→D).
6. Pantalla de configuración + permisos + nav + i18n.
7. `pnpm typecheck && pnpm lint`; verificación manual en calendario (mes / semana / día /
   agenda / móvil), menú de estados, rail, panel, notificaciones e historia clínica.
8. Seed en la BD de `bracketsup` y verificación de que se ve idéntico a hoy → recién ahí se
   puede converger la rama.

---

## 9. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Los 3 flujos n8n no existen | El store cae a defaults; el frontend se puede desarrollar y revisar completo, pero **la feature no cierra sin ellos**. Es la dependencia externa del plan. |
| Unificar badges cambia el aspecto de pantallas que nadie pidió tocar | `badge_style` + captura comparativa antes de mergear. Si incomoda, se recorta el alcance a solo calendario dejando `STATUS_BADGE_VARIANT`. |
| Colores libres → estados indistinguibles | Aviso de contraste ΔE2000 en la pantalla + botón Restaurar. |
| El portal del paciente no ve la matriz | Cae a defaults; anotado como deuda explícita (punto 4.F). |
| `AppointmentStatusMenu.tsx:48` a nivel de módulo | Único punto no mecánico del refactor; señalado para revisarlo a mano. |

---

## 10. Decisiones tomadas sin confirmar

- **(a)** `color_by_status` **sobrevive** como interruptor por usuario y solo aplica a los
  estados en modo `preference` — la matriz define la política del cliente, el usuario conserva
  su interruptor.
- **(b)** Los defaults compilados son los de `clinica_imagen`, y `bracketsup` pasa a ser filas
  en su BD.
