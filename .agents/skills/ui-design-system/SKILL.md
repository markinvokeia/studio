---
name: ui-design-system
description: >
  Sistema de diseño de Invoke IA. Usar cuando: crear componentes nuevos,
  migrar páginas al nuevo diseño, verificar coherencia visual, implementar
  paneles de detalle, configurar tabs verticales, o aplicar el patrón
  "Lift and Reframe" para migrar sheets y páginas.
---

# Invoke IA — UI Design System

## Typography

**Font:** Plus Jakarta Sans (400, 500, 600, 700, 800)
- Configured in `tailwind.config.ts` as `font-body` and `font-headline`
- Loaded via Google Fonts in `src/app/layout.tsx`

**Scale:**
- Page titles: `text-lg font-semibold`
- Section headers: `text-base font-semibold`
- Body: `text-sm`
- Labels / captions: `text-xs font-medium text-muted-foreground`
- Mono values (IDs, doc numbers): `font-mono text-xs`

---

## Color Palette

All colors reference CSS variables defined in `src/app/globals.css`.

### Light theme (`:root` — Invoke/Violeta)
| Token | Value | Use |
|---|---|---|
| `--background` | `0 0% 99%` | Page background (near white) |
| `--card` | `0 0% 100%` | Card, sheet, panel backgrounds |
| `--card-header-bg` | `0 0% 100%` | Card headers (no violet tint) |
| `--nav-bg` | `#1e1b4b` | Sidebar background (clean indigo) |
| `--primary` | `263 67% 35%` | Brand violet — active states, accent |
| `--brand-light` | `263 67% 95%` | Pill backgrounds for active nav items |
| `--brand-mid` | `263 67% 55%` | Hover accent states |
| `--border` | `260 20% 90%` | Default borders |
| `--border-subtle` | `260 20% 94%` | Subtle separators |
| `--panel-transition` | `220ms cubic-bezier(0.4,0,0.2,1)` | All panel animations |

### Tailwind utility equivalents
- `bg-primary/8` → very light brand background (8% opacity)
- `text-primary` → brand violet text
- `bg-muted/30` → tab content area background

---

## Layout Rules

### Sidebar
- Fixed, `w-20` (80px), `bg-[var(--nav-bg)]` (indigo dark)
- Active nav items: `bg-white/15 text-white` pill + left `w-0.5` white accent bar
- Hover: `hover:bg-white/10 hover:text-white/90`
- **SecondarySidebar** (submenu flyout): `bg-white dark:bg-card shadow-xl border border-border rounded-r-2xl`
  - Active sub-item: `bg-primary/8 text-primary font-semibold` + left `w-0.5 bg-primary` accent
  - Inactive: `text-foreground font-medium hover:bg-muted`

### TwoPanelLayout
- Uses `react-resizable-panels`
- Left panel tracks width via `usePanelWidth` hook
- Exposes `isNarrow` (true when left panel < 380px) via `useNarrowMode()` context
- In narrow mode: use `DataTable` with `isNarrow + renderCard` props for card list view

### Page shell
- Use `<PageShell>` from `src/components/ui/page-shell.tsx` as outermost page wrapper
- Use `<PageHeader>` from `src/components/ui/page-header.tsx` to replace `CardHeader` patterns

---

## Component Patterns

### DetailPanel
**File:** `src/components/ui/detail-panel.tsx`

```tsx
<DetailPanel isOpen={boolean} onClose={() => void} depth={0} totalDepth={1}>
  {/* panel content */}
</DetailPanel>
```

- Renders inline (no portal) with `absolute inset-0`
- Animates via `.panel-enter` / `.panel-exit` CSS keyframes
- Stack depth > 0: shifts left + reduces opacity for "peek" effect
- Always put inside a `position: relative` container

### VerticalTabStrip
**File:** `src/components/ui/vertical-tab-strip.tsx`

```tsx
const tabs: VerticalTab[] = [
  { id: 'info', icon: CalendarClock, label: 'Información' },
  { id: 'patient', icon: Users, label: 'Paciente' },
];

<VerticalTabStrip
  tabs={tabs}
  activeTabId={activeTab}
  onTabClick={(tab) => setActiveTab(tab.id)}
/>
```

- 48px wide (`w-12`), left border of the detail area
- Active tab: left `w-0.5 bg-primary` accent + `bg-primary/8 text-primary`
- Tooltips built-in (Radix `TooltipProvider`)
- `navigatesTo?: string` field on a tab → use `pushPanel` instead of switching content

### PanelStack
**Files:** `src/context/panel-stack-context.tsx`, `src/components/ui/panel-stack-renderer.tsx`

```tsx
// Wrap the page
<PanelStackProvider>
  <TwoPanelLayout
    leftPanel={<MyList />}
    rightPanel={<PanelStackRenderer renderPanel={(frame) => <MyPanel frame={frame} />} />}
    isRightPanelOpen={panelStack.length > 0}
  />
</PanelStackProvider>

// Inside a component
const { pushPanel, popPanel, activePanel } = usePanelStack();
pushPanel({ type: 'patient', data: { userId: '123' } });
```

### DataCard
**File:** `src/components/ui/data-card.tsx`

```tsx
<DataCard
  fields={[
    { label: 'Paciente', value: 'Juan García', primary: true },
    { label: 'Fecha', value: '15/04/2026' },
  ]}
  accentColor="#5484ed"
  onClick={() => openDetail(row)}
  actions={<Button size="sm">Editar</Button>}
/>
```

Use in `DataTable` via `isNarrow + renderCard` props when left panel is < 380px.

### PageHeader
**File:** `src/components/ui/page-header.tsx`

```tsx
<PageHeader
  icon={<Users className="h-5 w-5" />}
  title="Pacientes"
  description="Gestionar todos los pacientes"
  actions={<Button>Nuevo</Button>}
/>
```

Replaces `CardHeader` + `CardTitle` + `CardDescription` pattern in detail panels.

---

## Migration Pattern: "Lift and Reframe"

Used when migrating existing sheets/pages to the new design.
**Critical rule: zero functionality changes.**

### Steps:
1. **Read** the existing component fully
2. **Keep** all `useEffect`, `api.*`, form state, `usePermissions`, `useTranslations`
3. **Replace** the outer container (`ResizableSheet` or `Dialog`) with the same type if needed
4. **Replace** `Tabs/TabsList/TabsTrigger` with `VerticalTabStrip`
5. **Replace** `TabsContent` with `{activeTab === 'id' && <Component />}` conditional rendering
6. **Adjust** header from full `CardHeader` to compact `px-5 py-3` layout
7. **Run** `npm run typecheck && npm run lint` before committing

### Example — Sheet migration:
```tsx
// Before
<ResizableSheet ...>
  <Tabs value={activeTab} onValueChange={setActiveTab}>
    <TabsList>
      <TabsTrigger value="info">Info</TabsTrigger>
    </TabsList>
    <TabsContent value="info"><InfoPanel /></TabsContent>
  </Tabs>
</ResizableSheet>

// After
<ResizableSheet ...>
  <div className="flex flex-1 overflow-hidden min-h-0">
    <VerticalTabStrip tabs={tabs} activeTabId={activeTab} onTabClick={(t) => setActiveTab(t.id)} />
    <div className="flex-1 overflow-auto p-3">
      {activeTab === 'info' && <InfoPanel />}
    </div>
  </div>
</ResizableSheet>
```

---

## Narrow Mode

When `TwoPanelLayout` left panel < 380px (`LEFT_PANEL_NARROW_THRESHOLD`):
- `useNarrowMode()` returns `{ isNarrow: true }`
- Tables should render `DataCard` list instead of full table
- Pass `isNarrow` + `renderCard` to `DataTable`

```tsx
const { isNarrow } = useNarrowMode();

<DataTable
  columns={columns}
  data={data}
  isNarrow={isNarrow}
  renderCard={(row) => (
    <DataCard
      fields={[
        { label: 'Nombre', value: row.name, primary: true },
        { label: 'Email', value: row.email },
      ]}
      onClick={() => onRowClick(row)}
    />
  )}
/>
```

---

## Calendar Event Panel

**File:** `src/components/appointments/AppointmentPanel.tsx`

Replaces the Dialog used in `src/app/[locale]/appointments/page.tsx`.
Uses `ResizableSheet` + `VerticalTabStrip` with tabs:

| Tab | Icon | Content |
|---|---|---|
| `info` | `CalendarClock` | Date, time, status, calendar, services, notes + Edit/Cancel buttons |
| `patient` | `Users` | Patient name + button to open PatientDetailSheet |
| `doctor` | `UserSquare` | Doctor name + button to open DoctorDetailSheet |
| `session` | `Stethoscope` | Linked clinic session viewer + create/edit trigger |
| `quote` | `FileText` | Quote doc no + button to open QuoteDetailSheet (conditional) |
| `invoices` | `Receipt` | Invoice buttons to open InvoiceDetailSheet (conditional) |
| `payments` | `CreditCard` | Payment summaries per invoice (conditional) |

Sub-sheets (Patient, Doctor, Quote, Invoice) are managed **internally** by `AppointmentPanel`.

---

## What Is Never Changed

- All `api.*` calls, `useEffect` data fetching
- All `useForm`, Zod schemas, `onSubmit` handlers
- All `usePermissions`, `<Can>`, `<PrivateRoute>` usage
- All `useTranslations` calls and translation key strings
- All `ColumnDef` definitions in `columns.tsx` files
- `src/config/nav.ts` navigation configuration
- Context providers in layout files
- `Calendar.tsx` event rendering logic
- TanStack Table state (sorting, filtering, pagination)
- `src/components/ui/resizable-sheet.tsx` — backward compat, keep as-is

---

## Design Tokens Reference

**File:** `src/lib/design-tokens.ts`
```ts
SIDEBAR_WIDTH = 80           // px — matches sidebar w-20
PANEL_ANIMATION_DURATION = 220  // ms — mirrors --panel-transition
LEFT_PANEL_NARROW_THRESHOLD = 380  // px — activates card view
```

---

## Verification Checklist (after each migration)

1. `npm run typecheck && npm run lint` — must pass (existing warnings OK, no new errors)
2. Manual test: open the migrated page, click through all tabs
3. Verify all actions still work (create, edit, delete, form submit)
4. Test all 3 themes: Invoke (light), Claro, Dark
5. Test responsive: 1024px, 1440px, 1920px
6. Verify narrow mode triggers card view when panel is resized small

---

## Extended UI Requirements (v2)

### 1. VerticalTabStrip — Icon Above + Text Below

All vertical tab strips must display the icon centered with the label below it, identical to the main sidebar navigation style.

```tsx
// Tab item layout (update VerticalTabStrip component)
<button className="flex flex-col items-center justify-center gap-0.5 h-14 w-full px-1">
  <Icon className="h-4 w-4" />
  <span className="text-[9px] font-medium leading-tight text-center line-clamp-2 w-full">{label}</span>
</button>
```

- Height: `h-14` per tab (up from `h-10`)
- Width: `w-14` (up from `w-12`) to accommodate label
- Active: left `w-0.5 bg-primary` accent bar + `bg-primary/8 text-primary`
- Inactive: `text-muted-foreground hover:text-foreground hover:bg-muted/60`

---

### 2. Tables — Radio in First Column

Every DataTable that supports single row selection must show a radio button in the first column.

- Add a `radio` column as the first `ColumnDef` in every columns file that uses `enableSingleRowSelection`
- Use Radix `RadioGroup` or a plain `<input type="radio">` styled with Tailwind
- The radio reflects `row.getIsSelected()`
- Clicking anywhere on the row still selects it (existing behavior preserved)
- Example column def:
```ts
{
  id: 'select',
  size: 36,
  header: () => null,
  cell: ({ row }) => (
    <div className="flex items-center justify-center px-1">
      <input
        type="radio"
        checked={row.getIsSelected()}
        onChange={() => {}} // controlled by row click
        className="h-3.5 w-3.5 accent-primary cursor-pointer"
        aria-label="Seleccionar fila"
        onClick={(e) => { e.stopPropagation(); row.toggleSelected(true); }}
      />
    </div>
  ),
  enableSorting: false,
  enableHiding: false,
}
```

---

### 3. Row → Card Conversion on Panel Open + Mobile (UPDATED)

**Pattern: always use a narrow wrapper component.**

Every `TwoPanelLayout` page must:
1. Add a small inner component that calls `useNarrowMode()` and passes `isNarrow + renderCard` to `DataTable`
2. For custom table components (`PaymentsTable`, `InvoicesTable`, `OrdersTable`, `RecentQuotesTable`): these already have `useNarrowMode()` injected — they automatically show cards when `isNarrow`
3. `DataCard` props:
   - `title`: primary display value (name, doc_no, etc.)
   - `subtitle`: secondary info as single truncated string
   - `avatar`: initials string or ReactNode (shown for people/entities)
   - `isSelected`: `selectedItem?.id === row.id`
   - `showArrow`: always `true` for clickable items
   - `onClick`: calls the row selection handler
   - `accentColor`: optional color for service/calendar items

**DataCard now supports two layouts:**
- "List item" (when `title` prop is provided): avatar + name + subtitle — for entities like users, doctors, providers
- "Field grid" (when only `fields` prop is provided): label/value pairs — for data-heavy items

**Selected state**: selected card gets `border-primary/60 bg-primary/5 ring-1 ring-primary/20` styling. Arrow button turns `bg-primary text-primary-foreground`.

### Original Row → Card rule:

**When right panel opens** (any `TwoPanelLayout`): automatically activate `isNarrow` card mode for the left table. The left panel becomes ≤ 40% width, rows convert to `DataCard` components.

**On mobile** (`< 768px`): always render cards instead of table rows regardless of panel state.

Every `DataTable` in a `TwoPanelLayout` must define a `renderCard` prop showing the 3–4 most important fields. The card must be clickable and trigger row selection + right panel open.

Pattern:
```tsx
<DataTable
  isNarrow={isNarrow || isMobile}
  renderCard={(row) => (
    <DataCard
      fields={[
        { label: 'Nombre', value: row.name, primary: true },
        { label: 'Estado', value: <Badge>{row.status}</Badge> },
      ]}
      accentColor={row.color}
      onClick={() => handleRowSelect(row)}
    />
  )}
  ...
/>
```

---

### 4. Actions — Remove Dropdown, Show Icon+Text Buttons

**Remove** all "Acciones" dropdown menus and `...` (ellipsis) column actions from every table and view.

**Replace with** inline action buttons in table row cells or in the panel header. Button format: icon on top, text below (same as sidebar/tabs).

```tsx
// Action button pattern
<button className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg hover:bg-muted transition-colors min-w-[48px]">
  <Edit className="h-4 w-4" />
  <span className="text-[9px] font-medium">Editar</span>
</button>
```

- Keep the row actions visible at all times (no hover-reveal)
- For many actions: show top 2–3 most-used inline, group the rest in a compact secondary strip
- In narrow/card mode: show action buttons at the bottom of each DataCard
- In the right detail panel header: `Dar Alta`, `Preferencias`, `+Crear` buttons follow icon-above-text pattern

---

### 5. Calendar — GroupBy Doctor

When `groupBy === 'doctor'`: render the same day-boundary structure used for calendar grouping, but with doctor columns inside each day boundary.

Layout:
```
┌─── Lunes 14 ───────────────────────────────┐
│  Dr. García  │  Dra. López  │  Dr. Smith   │
│   [events]   │   [events]   │   [events]   │
└────────────────────────────────────────────┘
┌─── Martes 15 ──────────────────────────────┐
│  ...
```

- Day header: full-width row with the date, same style as calendar group header
- Doctor columns inside the day: same column style as calendar columns in groupBy=calendar mode
- Events render inside the correct doctor column
- File to update: `src/components/calendar/Calendar.tsx` — locate the `groupBy === 'calendar'` rendering branch and add a parallel `groupBy === 'doctor'` branch

---

### 6. New "Detalles" Tab in All Detail Panels

Add a `detalles` tab as the **first** tab in every detail panel (PatientDetailSheet, DoctorDetailSheet, QuoteDetailSheet, InvoiceDetailSheet, AppointmentPanel, and all future panels).

**Behavior:**
- **View mode** (existing record selected): shows all fields pre-populated in a read-optimized layout (label + value pairs). An "Editar" button enables edit mode.
- **Edit mode**: fields become form inputs (same as existing Create/Edit dialog content). "Actualizar" submits the form, "Cancelar" reverts.
- **Create mode** (triggered from "Crear" button): Detalles tab opens in create mode. "Crear" submits. This replaces opening a Dialog.

**Implementation pattern:**
1. Extract the form JSX from the existing Create/Edit Dialog into a `<EntityDetailsForm>` component
2. In the detail panel, add tab `{ id: 'detalles', icon: ClipboardList, label: 'Detalles' }` as first tab
3. The tab renders `<EntityDetailsForm mode="view"|"edit"|"create" entity={...} onSuccess={...} />`
4. When "Crear" is clicked in the list view: `setActiveTab('detalles')` + `setFormMode('create')` instead of opening a Dialog

**Files to update (example for Users):**
- Extract form from `UsersPage` dialog into `src/components/users/user-details-form.tsx`
- Add `detalles` tab to `UserDetailPanel` / users page right panel
- Connect "Nuevo" button → opens panel + detalles tab in create mode

---

### 7. Full Screen Toggle for All Panels

Every `ResizableSheet` and right-panel area must have a full-screen toggle button (like the TV display screen).

**Add to ResizableSheet** (or as HOC): a maximize/restore icon button in the panel header.

```tsx
const [isFullscreen, setIsFullscreen] = React.useState(false);

// Panel container
<div
  className={cn(
    'fixed z-50 bg-background shadow-2xl transition-all duration-200',
    isFullscreen
      ? 'inset-0 rounded-none'
      : 'right-0 top-0 bottom-0 rounded-l-2xl border-l border-border'
  )}
  style={isFullscreen ? undefined : { width }}
>
  {/* Header with fullscreen toggle */}
  <button onClick={() => setIsFullscreen(f => !f)}>
    {isFullscreen ? <Minimize2 /> : <Maximize2 />}
  </button>
  {children}
</div>
```

Add `Maximize2` / `Minimize2` icons to the close button area of every `ResizableSheet`.
Add to all `TwoPanelLayout` right panels via a wrapper.

---

### 8. TV Screen — Larger Patient + Calendar Names

In `src/app/[locale]/tv-display/screen/` (TV display screen):
- Patient name font: `text-4xl` minimum (up from current), `font-bold`
- Calendar/room name: `text-2xl font-semibold`
- Doctor name: `text-xl`
- Time: `text-lg font-mono`
- Apply consistently in both grouped and ungrouped views

---

### 9. Financial Summary Redesign (Users/Patient Detail)

**File:** `src/components/users/user-financial-summary-stats.tsx`

Redesign targets:
- **Header row**: title `text-sm font-semibold`, `Ocultar`/`Imprimir` as icon+text buttons (not links), cohesive with panel header
- **Financial cards** (Facturado, Pagado, Deuda, Saldo):
  - Modern card style: `rounded-xl border border-border bg-card shadow-sm p-3`
  - UYU amount: `text-2xl font-bold` — primary display
  - USD amount: `text-xs text-muted-foreground` — secondary, below UYU
  - Label: `text-[10px] uppercase tracking-wide text-muted-foreground`
  - Positive/negative color coding: Saldo positive → `text-green-600`, negative → `text-destructive`
- `Dar Alta`, `Preferencias`, `+Crear` buttons: icon above + text below format (see section 4)

---

### 10. Odontogram — Cleaner Layout + Subtle Colors

**File:** `src/components/users/clinic-history-viewer.tsx` and odontogram-related files.

Changes:
- Use a muted, consistent palette: `--muted`, `--border`, `--primary/20` instead of bright per-tooth colors
- Session/event list: `rounded-xl border border-border bg-card` cards, not colored pills
- Tooth status colors: use CSS opacity variants (`bg-destructive/15`, `bg-amber-500/15`) for subtle indication
- Session timeline: clean vertical list with date left-aligned, procedure truncated, status badge right-aligned
- Remove excessive color diversity — use at most 3–4 semantic colors (healthy, treated, attention, missing)

---

### 11. Responsive Rules (Global)

Apply to **every** page and panel:
- **< 768px (mobile)**: table rows → `DataCard` cards always (no table)
- **768px–1024px (tablet)**: `TwoPanelLayout` renders as overlay (right panel covers left)
- **> 1024px (desktop)**: side-by-side `TwoPanelLayout` with resizable panels
- All panels have a full-screen toggle
- Column panels adapt: use `min-w-0 flex-1` to prevent overflow
- Text truncates with `truncate` — never wraps panel headers

---

### 12. Priority Order for Implementation

When implementing these changes across the codebase:
1. `VerticalTabStrip` update (affects all detail panels immediately)
2. TV screen font sizes (3 lines of CSS)
3. Financial summary cards
4. `DataTable` radio column + `renderCard` in `TwoPanelLayout` pages
5. Remove Actions dropdowns → header buttons
6. Calendar groupBy Doctor
7. Detalles tab (highest LOE — do one page at a time: Users → Appointments → rest)
8. Full screen toggle in `ResizableSheet`
9. Odontogram
