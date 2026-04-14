# Skill: date-formatting

## Propósito

Garantizar que todas las fechas y horas en el frontend se interpreten y muestren correctamente, evitando conversiones de timezone no deseadas cuando la API devuelve strings ISO UTC (e.g. `2026-03-26T16:27:33.831Z`).

## El problema

La API devuelve fechas en formato ISO UTC con sufijo `Z` (e.g. `2026-03-26T16:27:33.831Z`).  
Si se parsean directamente con `new Date()` o `format(parseISO(...))`, JavaScript convierte al timezone local del cliente, produciendo horas incorrectas (e.g. en GMT-3, las 16:27 UTC se muestran como 13:27).

## Reglas obligatorias

### 1. Mostrar fecha + hora

Usar **siempre** `formatDateTime` de `@/lib/utils`:

```typescript
import { formatDateTime } from '@/lib/utils';

// correcto
formatDateTime(row.original.fecha)           // "26/03/2026 16:27"

// incorrecto — causa shift de timezone
new Date(fecha).toLocaleTimeString()
format(parseISO(fecha), 'dd/MM/yyyy HH:mm')
new Date(fecha).toLocaleString()
```

Comportamiento: elimina la `Z` antes de parsear, evitando la conversión UTC → local.  
Salida: `dd/MM/yyyy HH:mm`.

---

### 2. Mostrar solo fecha (sin hora)

Usar **siempre** `formatDisplayDate` de `@/lib/utils`:

```typescript
import { formatDisplayDate } from '@/lib/utils';

// correcto
formatDisplayDate(row.original.fecha)        // "26/03/2026"

// incorrecto
new Date(fecha).toLocaleDateString()
format(parseISO(fecha), 'dd/MM/yyyy')
```

Comportamiento: extrae la parte de fecha del ISO string sin crear un objeto `Date`, evitando cualquier conversión de zona horaria.

---

### 3. Mostrar solo fecha en formato interno (`yyyy-MM-dd`)

Usar `formatDate` de `@/lib/utils` cuando se necesita el formato `yyyy-MM-dd` (e.g. para comparaciones, valores de inputs de tipo `date`):

```typescript
import { formatDate } from '@/lib/utils';

formatDate('2026-03-26T16:27:33.831Z')      // "2026-03-26"
```

---

### 4. Enviar fechas al backend

Usar **siempre** `toLocalISOString` de `@/lib/utils` en lugar de `.toISOString()`:

```typescript
import { toLocalISOString } from '@/lib/utils';

// correcto — no convierte a UTC
toLocalISOString(new Date())                 // "2026-03-26T16:27:33"

// incorrecto — convierte a UTC y causa shift de 3 horas en GMT-3
new Date().toISOString()                     // "2026-03-26T19:27:33.000Z"
```

---

### 5. Fechas de holidays / fechas sin componente de hora

Usar `formatHolidayDate` de `@/lib/utils` para fechas que vienen como `2026-12-25T00:00:00.000Z` y representan solo un día (sin hora significativa):

```typescript
import { formatHolidayDate } from '@/lib/utils';

formatHolidayDate('2026-12-25T00:00:00.000Z')   // "2026-12-25"
```

---

## Resumen de utilidades disponibles

| Función           | Importar desde   | Cuándo usar                                      | Formato de salida    |
|-------------------|------------------|--------------------------------------------------|----------------------|
| `formatDateTime`  | `@/lib/utils`    | Mostrar fecha y hora de un registro              | `dd/MM/yyyy HH:mm`   |
| `formatDisplayDate` | `@/lib/utils`  | Mostrar solo fecha en UI                         | `dd/MM/yyyy`         |
| `formatDate`      | `@/lib/utils`    | Fecha en formato interno / inputs tipo date      | `yyyy-MM-dd`         |
| `formatHolidayDate` | `@/lib/utils`  | Fechas-día sin hora significativa                | `yyyy-MM-dd`         |
| `toLocalISOString` | `@/lib/utils`   | Enviar fecha al backend desde un `Date` object   | `yyyy-MM-ddTHH:mm:ss`|

## Lo que NUNCA hacer

- `new Date(isoString).toLocaleTimeString()` — muestra solo hora y aplica offset local
- `new Date(isoString).toLocaleDateString()` — aplica offset local, puede cambiar el día
- `new Date(isoString).toLocaleString()` — aplica offset local
- `format(parseISO(isoString), '...')` — parseISO con Z aplica offset local
- `date.toISOString()` — convierte Date local a UTC antes de serializar

## Archivo de referencia

Todas las utilidades están en: `src/lib/utils.ts`
