# UI Navigation Mapping — Invoke IA

This document maps every page, tab, subtab, and action reachable via the
deep-link URL parameter system.  It is the authoritative reference for the
**InvokeIAHelpTool** n8n agent so it can generate URLs that navigate users
directly to the right screen.

---

## Query parameters

| Param | Type | Description |
|-------|------|-------------|
| `f`   | string | Filter value — applied to the main table's search field |
| `t`   | string | Tab slug — navigate to this tab in the detail panel |
| `st`  | string | Subtab slug — navigate to this subtab within tab `t` |
| `act` | string | Action slug — execute this UI action |

All parameters are **optional**.  Execution order: filter → auto-select first result → tab → subtab → action.
The UI waits for each step to render before proceeding.

---

## Hook implementation

The feature is implemented via `src/hooks/use-deep-link.ts`.  Each page calls
`useDeepLink({ tabMap, subtabMap, onFilter, items, isLoading, onAutoSelect,
onTabChange, onSubtabChange, actionMap })` to participate.

---

## Pages

---

### `/[locale]/users` — Pacientes

**Filter column:** `email` (searches name, email, phone, document)

**Tabs (`t=`)**

| URL slug | Internal ID | Label |
|----------|-------------|-------|
| `Historia-Clinica` | `clinical-history` | Historia Clínica |
| `Servicios` | `services` | Servicios (solo médicos) |
| `Presupuestos` | `quotes` | Presupuestos |
| `Ordenes` | `orders` | Órdenes |
| `Facturas` | `invoices` | Facturas |
| `Pagos` | `payments` | Pagos |
| `Citas` | `appointments` | Citas |
| `Mensajes` | `messages` | Mensajes |
| `Historial` | `logs` | Historial de actividad |
| `Notas` | `notes` | Notas |

**Subtabs of `Historia-Clinica` (`st=`)**

| URL slug | Internal ID | Label |
|----------|-------------|-------|
| `Anamnesis` | `anamnesis` | Anamnesis (antecedentes, alergias) |
| `Timeline` | `timeline` | Línea de tiempo de sesiones |
| `Linea-de-Tiempo` | `timeline` | Alias de Timeline |
| `Odontograma` | `odontogram` | Odontograma |
| `Documentos` | `documents` | Documentos clínicos |

**Actions (`act=`)**

| URL slug | Context | Description |
|----------|---------|-------------|
| `Crear` | `t=Historia-Clinica, st=Timeline` (default) | Crear sesión clínica |
| `Crear` | `t=Historia-Clinica, st=Documentos` | Subir documento clínico |
| `Crear` | `t=Citas` | Abrir diálogo crear cita |
| `Crear` | `t=Presupuestos` | Abrir diálogo crear presupuesto |
| `Crear` | `t=Facturas` | Abrir diálogo crear factura |
| `Crear` | (sin `t`) | Abrir diálogo crear paciente |
| `Sesion` | `t=Historia-Clinica` | Crear sesión clínica |
| `Documento` | `t=Historia-Clinica` | Subir documento clínico |
| `Cita` | cualquier | Abrir diálogo crear cita |
| `Presupuesto` | cualquier | Abrir diálogo crear presupuesto |
| `Factura` | cualquier | Abrir diálogo crear factura |
| `Prepago` | cualquier | Abrir diálogo crear prepago |

**Ejemplos**

```
# Abrir historial clínico del paciente Zahari
/es/users?f=Zahari&t=Historia-Clinica

# Ir a Timeline y crear sesión clínica para Zahari
/es/users?f=Zahari&t=Historia-Clinica&st=Timeline&act=Crear

# Abrir odontograma de Zahari
/es/users?f=Zahari&t=Historia-Clinica&st=Odontograma

# Crear una cita para Zahari
/es/users?f=Zahari&act=Cita

# Ver facturas de Zahari
/es/users?f=Zahari&t=Facturas

# Ver documentos clínicos y subir uno nuevo
/es/users?f=Zahari&t=Historia-Clinica&st=Documentos&act=Crear
```

---

### `/[locale]/roles` — Roles

**Filter column:** `name`

**Tabs (`t=`)**

| URL slug | Internal ID | Label |
|----------|-------------|-------|
| `Detalles` | `details` | Detalles del rol |
| `Usuarios` | `users` | Usuarios con este rol |
| `Permisos` | `permissions` | Permisos asignados |

**Actions (`act=`)**

| URL slug | Context | Description |
|----------|---------|-------------|
| `Crear` | (sin `f`) | Abrir diálogo crear rol |
| `Eliminar` | con `f` | Eliminar rol seleccionado |

**Ejemplos**

```
# Ver permisos del rol Admin
/es/roles?f=Admin&t=Permisos

# Crear nuevo rol
/es/roles?act=Crear
```

---

### `/[locale]/permissions` — Permisos

**Filter column:** `name`

**Tabs (`t=`)**

| URL slug | Internal ID | Label |
|----------|-------------|-------|
| `Detalles` | `details` | Detalles del permiso |
| `Usuarios` | `users` | Usuarios con este permiso |

**Actions (`act=`)**

| URL slug | Context | Description |
|----------|---------|-------------|
| `Crear` | — | Abrir diálogo crear permiso |

---

### `/[locale]/config/doctors` — Doctores

**Filter column:** `email`

**Tabs (`t=`)**

| URL slug | Internal ID | Label |
|----------|-------------|-------|
| `Detalles` | `details` | Detalles del doctor |
| `Servicios` | `services` | Servicios que ofrece |
| `Mensajes` | `messages` | Mensajes |
| `Historial` | `logs` | Historial de actividad |

**Actions (`act=`)**

| URL slug | Context | Description |
|----------|---------|-------------|
| `Crear` | — | Abrir diálogo crear doctor |

**Ejemplos**

```
# Ver servicios del doctor García
/es/config/doctors?f=Garcia&t=Servicios
```

---

### `/[locale]/system/users` — Usuarios del sistema

**Filter column:** `email`

**Tabs (`t=`)**

| URL slug | Internal ID | Label |
|----------|-------------|-------|
| `Detalles` | `details` | Detalles del usuario |
| `Roles` | `roles` | Roles asignados |
| `Historial` | `logs` | Historial de actividad |

**Actions (`act=`)**

| URL slug | Context | Description |
|----------|---------|-------------|
| `Crear` | — | Abrir diálogo crear usuario |

---

### `/[locale]/sales/services` — Servicios de venta

**Filter column:** `name`

**Tabs (`t=`)**

| URL slug | Internal ID | Label |
|----------|-------------|-------|
| `Detalles` | `details` | Detalles del servicio |
| `Info` | `info` | Información adicional |

**Actions (`act=`)**

| URL slug | Description |
|----------|-------------|
| `Crear` | Abrir diálogo crear servicio |

---

### `/[locale]/purchases/services` — Servicios de compra

**Filter column:** `name`

**Tabs (`t=`)**

| URL slug | Internal ID | Label |
|----------|-------------|-------|
| `Detalles` | `details` | Detalles del servicio |
| `Info` | `info` | Información adicional |

**Actions (`act=`)**

| URL slug | Description |
|----------|-------------|
| `Crear` | Abrir diálogo crear servicio de compra |

---

### `/[locale]/purchases/providers` — Proveedores

**Filter column:** `email`

**Tabs (`t=`)**

| URL slug | Internal ID | Label |
|----------|-------------|-------|
| `Detalles` | `details` | Detalles del proveedor |
| `Resumen` | `summary` | Resumen financiero |
| `Servicios` | `services` | Servicios del proveedor |
| `Presupuestos` | `quotes` | Presupuestos de compra |
| `Ordenes` | `orders` | Órdenes de compra |
| `Facturas` | `invoices` | Facturas de compra |
| `Pagos` | `payments` | Pagos realizados |
| `Notas` | `notes` | Notas internas |

**Actions (`act=`)**

| URL slug | Context | Description |
|----------|---------|-------------|
| `Crear` | — | Abrir diálogo crear proveedor |
| `Presupuesto` | cualquier | Abrir diálogo crear presupuesto de compra |
| `Factura` | cualquier | Abrir diálogo crear factura de compra |
| `Prepago` | cualquier | Abrir diálogo crear prepago |

**Ejemplos**

```
# Ver facturas del proveedor Acme
/es/purchases/providers?f=Acme&t=Facturas

# Crear presupuesto para el proveedor Acme
/es/purchases/providers?f=Acme&act=Presupuesto
```

---

### `/[locale]/appointments` — Citas / Calendario

**No left-panel filter table** — el calendario es la vista principal.

**Actions (`act=`)**

| URL slug | Description |
|----------|-------------|
| `Crear` | Abrir diálogo crear nueva cita |

---

## Adding deep-link support to a new page

1. Import the hook:
   ```ts
   import { useDeepLink } from '@/hooks/use-deep-link';
   ```

2. Call it inside the page component:
   ```ts
   useDeepLink({
     tabMap: { 'Mi-Tab': 'my-tab' },
     onFilter: (v) => setColumnFilters([{ id: 'name', value: v }]),
     items: myItems,
     isLoading: isRefreshing,
     onAutoSelect: (item) => handleRowSelectionChange([item]),
     onTabChange: (id) => setActiveTab(id),
     actionMap: { 'Crear': () => setIsCreateDialogOpen(true) },
   });
   ```

3. Add the page to this document with its `tabMap`, `subtabMap`, and `actionMap`.

4. Update the **InvokeIAHelpTool** n8n workflow with the new URL examples.

---

## Notes for InvokeIAHelpTool

- Always use the locale prefix: `/es/` for Spanish, `/en/` for English.
- URL slugs are **case-sensitive** — use the exact values from the tables above.
- Spaces in values should be replaced with `-` (e.g., `Historia-Clinica`).
- All parameters are optional — only include what you need.
- The `act=Crear` action is the most common; use it to pre-open creation forms.
- When answering "how do I…" questions, provide both a text explanation AND a
  direct URL the user can click.
