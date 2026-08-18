# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev           # Start dev server on 0.0.0.0:3000
pnpm build         # Production build
pnpm lint          # ESLint (Next.js config)
pnpm typecheck     # TypeScript type check without emit
pnpm genkit:dev    # Start Google Genkit AI dev server
pnpm genkit:watch  # Start Genkit with file watching
```

**Before committing:** Always run `pnpm typecheck && pnpm lint`.

## Architecture

Healthcare/dental clinic management SaaS. Next.js 15 App Router + TypeScript strict mode + Tailwind CSS + shadcn/ui.

**Key libraries:** React Hook Form + Zod, next-intl, Google Genkit, Recharts, Radix UI, next-themes, date-fns, Firebase.

### Directory structure

```
src/
├── app/[locale]/          # i18n-routed App Router pages
├── components/
│   ├── ui/                # shadcn/ui primitives
│   └── [feature]/         # Feature-specific components
├── context/               # AuthContext, AlertNotificationsContext
├── hooks/                 # Custom hooks (useAuth, usePermissions, etc.)
├── services/api.ts        # Centralized API client
├── lib/
│   ├── types.ts           # All shared types (central, 958 lines)
│   ├── permissions.ts     # Permission filtering utilities
│   └── utils.ts
├── constants/
│   ├── routes.ts          # All API endpoint definitions (~200+ endpoints)
│   └── permissions.ts     # Permission code constants
├── config/nav.ts          # Navigation menu with permission guards
├── ai/flows/              # Google Genkit AI flows
└── messages/{en,es}.json  # i18n translation files
```

### API layer

`src/services/api.ts` wraps all HTTP calls with Bearer token auth (from localStorage). Base URL and all env-derived values come from `src/lib/runtime-config.ts` — **never read `process.env` or `NEXT_PUBLIC_*` directly**. Route constants live in `src/constants/routes.ts` — never hardcode API routes inline.

### Auth & permissions

`AuthContext` manages JWT token, user data, roles, and cash session state (all persisted in localStorage). The permission system is role-based:

- `usePermissions()` hook — `hasPermission(code)`, `hasAnyPermission([])`, `hasAllPermissions([])`
- `<Can>` component — conditional UI rendering
- `<PrivateRoute>` — route-level protection
- Navigation menu in `src/config/nav.ts` is filtered by permissions at runtime

**When adding pages, buttons, or any access-controlled UI:** load and follow the `permissions-protection` skill.

### Internationalization

All routes are under `[locale]/` (Spanish `es` / English `en`). Use `useTranslations()` from next-intl. **Every new user-facing string must have entries added to both `src/messages/en.json` and `src/messages/es.json`.**

**Per-client overrides:** a client can override specific translation keys via `src/messages/overrides/<NEXT_PUBLIC_CLIENT_ID>/<locale>.json` (partial file — only the changed keys; everything else falls back to the base). `src/i18n.ts` deep-merges the base with the client's override. See [`docs/i18n-overrides.md`](docs/i18n-overrides.md).

## Code Conventions

### TypeScript

- `interface` for object shapes, `type` for primitives/unions
- All shared types go in `src/lib/types.ts`
- Use `z.infer<typeof schema>` for form data types
- Prefer union types over enums

### Components

Interactive components need `'use client'`. Use `React.forwardRef` + `displayName` for reusable UI components. Use `cn()` from `@/lib/utils` for conditional class merging.

### Import order (with blank lines between groups)

1. React and external libraries
2. `@/components/ui/*`
3. `@/components/*` (feature components)
4. Hooks, utilities, services
5. Types, constants, config

### Naming

- Components/types: `PascalCase`
- Files: `kebab-case`
- Functions/variables: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Hooks: `use` prefix

### Forms

React Hook Form + Zod only. Define the schema first, then derive the TypeScript type with `z.infer`.

## Skills to use

| Skill | When |
| ------- | ------ |
| `frontend-design` | Creating/improving UI components and pages |
| `vercel-react-best-practices` | Any React/Next.js code task |
| `permissions-protection` | Any access control or conditional UI work |
| `tailwind-v4-shadcn` | Tailwind/shadcn issues, dark mode, CSS variables |
| `date-formatting` | Any time a date or datetime is read, displayed, or sent to the backend |

## Environment variables

> **IMPORTANT:** See [`docs/runtime-config.md`](docs/runtime-config.md) before working with env vars.

Variables are injected at **runtime** (not build time) via `window.__INVOKEIA_RUNTIME_CONFIG__` — a `<script>` tag written by the Server Component `src/app/[locale]/layout.tsx`. Always access them through the getters in `src/lib/runtime-config.ts`, never via `process.env` directly.

## Postgres MCP (base de datos de DEV)

El MCP `postgres` da acceso directo a la base de datos de DEV. Se puede usar libremente para **explorar y consultar** (listar esquemas/objetos, `SELECT`, `EXPLAIN`, analizar salud/índices), pero se deben respetar estos guardarraíles:

- **Nunca ejecutar `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `DROP`, `ALTER`, `CREATE` ni ninguna otra sentencia que modifique datos o esquema sin confirmación explícita del usuario primero.** Mostrar la sentencia SQL exacta que se va a ejecutar y esperar el visto bueno antes de correrla.
- Tratar DEV como un entorno compartido, no descartable: aunque sea "solo dev", otros pueden depender de sus datos/estado — no asumir que se puede resetear o limpiar sin preguntar.
- Nunca ejecutar sentencias destructivas o de bulk-update "para probar" ni como parte de debugging exploratorio.
- Si una consulta de solo lectura es pesada (full scans en tablas grandes, sin `LIMIT`), preferir acotarla (`LIMIT`, filtros por fecha/id) para no degradar el entorno compartido.
- No usar el MCP de Postgres para leer ni exponer datos de pacientes/PII más allá de lo estrictamente necesario para la tarea en curso; nunca pegar dumps completos de tablas sensibles en la conversación sin necesidad.
- Nunca ejecutar cambios de configuración a nivel de servidor/rol/extensión (`ALTER SYSTEM`, `CREATE EXTENSION`, gestión de roles, etc.) sin confirmación explícita.
- Si una tarea requiere una migración de esquema, se debe hacer a través del flujo normal del backend (migraciones versionadas), no ejecutando DDL suelto vía MCP.
