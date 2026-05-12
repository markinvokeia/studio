# Plan — Header del calendario en tablet

Fecha: 2026-05-11
Autor: Luis Rodríguez

## Contexto

En viewport tablet (768 px – 1024 px) la cabecera del calendario está usando la
rama "desktop" del componente, pero el ancho disponible no alcanza para sus
8+ controles:

- Título "Calendario"
- Botón "Hoy"
- Navegación `<` `>`
- Fecha del rango ("mayo 11 – 17, 2026")
- Botón "+ Crear"
- Botón Refresh
- Popovers de **Calendarios**, **Doctores**, **Agrupar**
- Selector de vista ("Semana ▾")
- Settings popover

El contenedor tiene `flex-wrap`, así que todo se rompe en **tres filas
desordenadas** (el comportamiento que el usuario reportó como problema visual).
Es funcional pero el resultado no se ve bien.

La rama "mobile" del header ya resuelve un escenario equivalente — condensa
casi todo en un solo renglón y delega los filtros a un bottom sheet
(`CalendarFilterSheet`). La propuesta es **tratar tablet con la misma rama
compacta que mobile**, con tres pequeños ajustes para que no se sienta
apretado y conserve los affordances que un viewport de tablet sí tolera
(botón "Crear" con texto, selector de vista inline en el header).

Esto explota código ya existente — no se introducen patrones nuevos, no hay
backend, ni CSS nuevo, ni i18n nuevo.

---

## Decisión clave

Hay tres breakpoints reales en `useCalendarBreakpoint`:

- `mobile` (< 768 px) → header compacto, FAB, bottom view tabs.
- `tablet` (768 – 1024 px) → **HOY usa la misma rama "full" que desktop** ← problema.
- `desktop` (> 1024 px) → header completo con popovers inline.

La rama "compacta" del header pasa a aplicar a **`mobile` + `tablet`**.

Las decisiones visuales por-botón (Crear ghost-icon vs Crear con texto)
siguen distinguiendo mobile de tablet con la flag existente `isMobile` para
que tablet mantenga prominencia donde tenga espacio.

---

## Cambios detallados

### 1. `src/components/calendar/calendar-header.tsx`

**Hoy** (línea 78):

```ts
if (breakpoint === 'mobile') { /* compact branch */ }
```

**Cambio:** extender el guard a tablet:

```ts
if (breakpoint === 'mobile' || breakpoint === 'tablet') { /* compact branch */ }
```

Dentro de esa rama compacta, agregar el **selector de vista** (`DropdownMenu`
con "Semana ▾") sólo cuando `breakpoint === 'tablet'`. En `mobile` se mantiene
fuera del header porque `CalendarViewTabs` (las pestañas inferiores) ya cubren
esa función.

Patrón del trigger (igual al que ya usa la rama desktop, sólo cambiando
tamaños para que case con la altura compacta del header `mobile/tablet`):

```tsx
{breakpoint === 'tablet' && (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
        <CalendarClock className="h-3.5 w-3.5" />
        {t(`views.${viewKey}`)}
        <ChevronDown className="h-3.5 w-3.5" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent>
      {/* …mismos items que el desktop branch */}
    </DropdownMenuContent>
  </DropdownMenu>
)}
```

**Refactor menor recomendado:** extraer la lista de items del menú de vistas
(`<DropdownMenuItem>` × 6) a una constante local o sub-componente
`ViewMenuItems` para que las dos ramas (desktop y compact-en-tablet) lo
consuman sin duplicar JSX.

### 2. `src/components/calendar/Calendar.tsx`

**Hoy** (líneas relevantes ~58, 208, 228):

```ts
const isMobile = breakpoint === 'mobile';
// …
onOpenFilterSheet={isMobile && filterSheet ? () => setFilterSheetOpen(true) : undefined}
// …
{isMobile && onSlotClick && <CalendarFab onClick={...} />}
{isMobile && <CalendarViewTabs ... />}
```

**Cambio:** añadir una flag derivada `isCompactHeader = breakpoint !== 'desktop'`
y usarla en `onOpenFilterSheet`. `isMobile` queda igual y sigue gobernando
FAB y bottom tabs (que en tablet **no** aparecen).

```ts
const isMobile = breakpoint === 'mobile';
const isCompactHeader = breakpoint !== 'desktop';
// …
onOpenFilterSheet={isCompactHeader && filterSheet ? () => setFilterSheetOpen(true) : undefined}
// FAB y CalendarViewTabs mantienen su gate por `isMobile`
```

### 3. `src/app/[locale]/appointments/page.tsx`

Tres gates a actualizar — todos hoy son `!isMobile`, deben pasar a
`breakpoint === 'desktop'`:

| Pieza | Línea aprox. | Antes | Después |
|---|---|---|---|
| Bloque `children` del Calendar (popovers Calendarios / Doctores / Agrupar inline) | ~1105 | `{!isMobile && (...)}` | `{breakpoint === 'desktop' && (...)}` |
| `trailingActions` (`CalendarSettingsPopover`) | ~1099 | `!isMobile ? <…/> : null` | `breakpoint === 'desktop' ? <…/> : null` |
| `filterSheet` — sección "grouping" interna | ~1036 | `{isMobile && (...)}` | `{breakpoint !== 'desktop' && (...)}` |

`breakpoint` se obtiene con el mismo hook que ya está montado:

```ts
const breakpoint = useCalendarBreakpoint();
const isMobile = breakpoint === 'mobile';
```

El botón "+ Crear" (`extraActions`) y el botón Refresh (`extraActionsAfterToday`)
**no cambian**. Siguen usando `isMobile` para alternar entre ghost-icon
(mobile) y default con texto (tablet/desktop) — así tablet conserva la
prominencia del botón principal.

### 4. (Sin cambios) `CalendarFilterSheet` y `CalendarViewTabs`

- El bottom sheet (`CalendarFilterSheet`) ya soporta cualquier viewport — no
  hay que tocarlo. Con el cambio en `Calendar.tsx`, el botón que lo abre
  aparecerá también en tablet y abrirá la misma sheet (con Calendarios,
  Doctores, Agrupar y Settings, ya que esas secciones internas ya están
  habilitadas para `breakpoint !== 'desktop'` después del cambio del punto 3).
- `CalendarViewTabs` (las pestañas inferiores) permanece **sólo en mobile**;
  en tablet el dropdown inline del header reemplaza esa función.

---

## Resultado en tablet

Una sola fila:

```
[≡ filtros]  Calendario       Hoy  <  >   [+ Crear]  [⟳]  [Semana ▾]
```

Sin wrap. Los filtros (Calendarios / Doctores / Agrupar / Settings) viven en
el bottom sheet que ya existía para mobile.

Como **comparativa lado a lado**:

| Elemento | Mobile | Tablet (nuevo) | Desktop |
|---|---|---|---|
| Layout header | Compacto | Compacto | Completo |
| Filtros (Cal/Doc/Agrupar) | Bottom sheet | Bottom sheet | Popovers inline |
| Settings | Bottom sheet | Bottom sheet | Popover trailing |
| Selector de vista | Bottom tabs | Inline en header | Inline en header |
| Botón "Crear" | Ghost icon | Default + texto | Default + texto |
| Refresh | Ghost icon | Ghost icon | Ghost icon |
| FAB | Sí | **No** | No |
| Bottom view tabs | Sí | **No** | No |

---

## Archivos a modificar

1. `src/components/calendar/calendar-header.tsx` — extender la rama compacta
   a tablet + agregar selector de vista inline cuando es tablet.
2. `src/components/calendar/Calendar.tsx` — `isCompactHeader` para
   `onOpenFilterSheet`.
3. `src/app/[locale]/appointments/page.tsx` — gates `!isMobile` →
   `breakpoint === 'desktop'` (tres lugares) y gate `isMobile` →
   `breakpoint !== 'desktop'` (sección grouping del filter sheet).

Cero cambios de backend, CSS, traducciones o tests.

---

## Utilidades reutilizadas

- `useCalendarBreakpoint()` (`src/hooks/use-calendar-breakpoint.ts`) — ya
  expone `'mobile' | 'tablet' | 'desktop'`. No requiere cambios.
- `CalendarFilterSheet` (`src/components/calendar/calendar-filter-sheet.tsx`)
  — drawer existente, listo para reutilizar.
- `DropdownMenu` / `DropdownMenuSub` (shadcn) — el mismo selector de vista del
  desktop se inserta tal cual en la rama compacta para tablet.

---

## Alternativas consideradas (y descartadas)

### Opción B: Mantener layout completo en tablet, sólo achicar/iconizar
Ocultar el título "Calendario" y el rango de fechas, e iconizar los popovers
(sólo el icono, label oculto detrás de tooltip).

**Descartada porque:**

- Sigue siendo frágil al ancho exacto del viewport — en 800 px puede que
  funcione, en 768 px no.
- Pierde labels que el usuario reconoce de un vistazo.
- Mantener dos sets de variantes visuales por botón es más código que
  reutilizar la rama mobile que ya existe.

### Opción C: Layout deliberado de 2 filas en tablet
Asumir el wrap como diseño: fila 1 (navegación), fila 2 (filtros + acciones).

**Descartada porque:**

- Aumenta la altura del header en una pantalla donde el espacio vertical
  también es escaso.
- Hay que rediseñar el contenedor para imponer el wrap exacto que queremos
  (en lugar de dejarlo a azar de medidas). Más trabajo que aprovechar la rama
  mobile existente.

### Opción D: Sólo achicar el padding/gap en tablet vía CSS
Apretar el gap entre botones para que entren más.

**Descartada porque:**

- Apenas ayuda con 4-5 botones; el ancho mínimo de cada `Button outline` con
  label es ~110 px. En tablet de 800 px no entran.
- No resuelve el problema, sólo lo retrasa unas pulgadas.

---

## Verificación

1. **Build limpio:**

   ```bash
   npm run typecheck
   npm run lint
   ```

2. **Test manual en los 3 breakpoints (DevTools → device toolbar):**

   - **Mobile (< 768 px)**: header compacto **sin** selector de vista en el
     header; bottom tabs visibles; FAB visible; abre el bottom sheet con
     Calendarios / Doctores / Agrupar / Settings.
   - **Tablet (768 – 1024 px)**: header compacto **con** selector de vista
     ("Semana ▾") inline, "+ Crear" con texto, refresh ghost-icon, botón de
     filtros que abre el mismo bottom sheet del mobile. Todo en una fila, sin
     wrap. **Sin** FAB ni bottom tabs.
   - **Desktop (> 1024 px)**: header completo idéntico al actual (popovers de
     Calendarios / Doctores / Agrupar inline, selector de vista a la derecha,
     Settings popover).

3. **Edge cases:**

   - Redimensionar de desktop → tablet → mobile y verificar que el header se
     adapta en vivo (el hook escucha `resize`).
   - Con `groupBy = 'doctor'` y `groupBy = 'calendar'` activos: confirmar que
     en tablet los filtros se editan desde el sheet y se reflejan en el
     calendario.
   - Verificar que la traducción `t('grouping.label')` y `t('views.*')` se ven
     correctamente en español e inglés (no hay claves nuevas — sólo se
     reutilizan).
