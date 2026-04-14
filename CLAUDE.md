# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev           # Start dev server on 0.0.0.0:3000
npm run build         # Production build
npm run lint          # ESLint (Next.js config)
npm run typecheck     # TypeScript type check without emit
npm run genkit:dev    # Start Google Genkit AI dev server
npm run genkit:watch  # Start Genkit with file watching
```

**Before committing:** Always run `npm run typecheck && npm run lint`.

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

`src/services/api.ts` wraps all HTTP calls with Bearer token auth (from localStorage). Base URL from `NEXT_PUBLIC_API_URL`. Route constants live in `src/constants/routes.ts` — never hardcode API routes inline.

### Auth & permissions

`AuthContext` manages JWT token, user data, roles, and cash session state (all persisted in localStorage). The permission system is role-based:

- `usePermissions()` hook — `hasPermission(code)`, `hasAnyPermission([])`, `hasAllPermissions([])`
- `<Can>` component — conditional UI rendering
- `<PrivateRoute>` — route-level protection
- Navigation menu in `src/config/nav.ts` is filtered by permissions at runtime

**When adding pages, buttons, or any access-controlled UI:** load and follow the `permissions-protection` skill.

### Internationalization

All routes are under `[locale]/` (Spanish `es` / English `en`). Use `useTranslations()` from next-intl. **Every new user-facing string must have entries added to both `src/messages/en.json` and `src/messages/es.json`.**

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
|-------|------|
| `frontend-design` | Creating/improving UI components and pages |
| `vercel-react-best-practices` | Any React/Next.js code task |
| `permissions-protection` | Any access control or conditional UI work |
| `tailwind-v4-shadcn` | Tailwind/shadcn issues, dark mode, CSS variables |
| `date-formatting` | Any time a date or datetime is read, displayed, or sent to the backend |

## Environment variables

```
NEXT_PUBLIC_API_URL            # Backend base URL (n8n webhooks)
NEXT_PUBLIC_ONDONTOGRAMA_URL   # Odontogram external service
```
