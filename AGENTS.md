# AGENTS.md

Healthcare/dental clinic management SaaS. Next.js 15 App Router (React 18, TypeScript strict), Tailwind **v3** + shadcn/ui. Single Next app, no monorepo. Use Node 22.13+ and pnpm 11 (`engine-strict`); `.nvmrc` says 20 and is stale. `README.md` is Firebase Studio boilerplate — real docs are in `docs/`.

`CLAUDE.md` is the Claude Code counterpart of this file; keep it in sync when changing repo-wide instructions.

## Commands

```bash
pnpm dev            # Next dev on 0.0.0.0:3000
pnpm typecheck      # tsc --noEmit
pnpm lint           # ESLint flat config
pnpm build          # production build (does NOT verify types/lint; see below)
pnpm test:e2e       # Playwright suite
pnpm test:e2e:ui    # Playwright UI mode
pnpm knowledge:build   # regenerate the help catalog
pnpm knowledge:check   # validate routes/help ids/English completeness
pnpm n8n:help       # regenerate n8n-workflows/help-*.json
pnpm genkit:dev     # Genkit AI flows (src/ai)
```

Run `pnpm typecheck && pnpm lint` before committing. **`pnpm build` is not a verification step:** `next.config.ts` sets `typescript.ignoreBuildErrors` and `eslint.ignoreDuringBuilds`, so it can pass with type and lint errors.

`pnpm install` sets `core.hooksPath=.githooks`. The pre-commit hook regenerates `src/generated/help-catalog*.json` when `src/`, `knowledge/` or `scripts/knowledge/` are staged, and blocks the commit if a guide points to a missing route/help id or lacks its English version. Use `git commit --no-verify` only as an emergency, then run `pnpm knowledge:build`.

## Architecture

- Pages: `src/app/[locale]/<feature>/page.tsx`; locales are `en`, `es`, `es-ES` (`src/i18n.ts`). The only server routes are a few proxies/helpers under `src/app/api/`.
- Backend is n8n, not Next. `src/services/*` call `api` (`src/services/api.ts`), which prefixes `getWebhookBaseUrl()` (`${getApiUrl()}/webhook`) and adds `Authorization: Bearer <localStorage token>`. `NEXT_PUBLIC_API_URL` must **not** end in `/webhook`.
- `api` argument order is easy to get wrong: `api.get(endpoint, query?, params?, options?)` — query is the 2nd argument, path params (`:id`) are the 3rd. Mutations: `api.post(endpoint, data, params?, query?, options?)`.
- Never hardcode endpoints: use `API_ROUTES` from `src/constants/routes.ts`. Response shapes are inconsistent; normalize with `normalizeApiResponse()` from `src/lib/api-utils.ts`.
- Shared types live in `src/lib/types.ts` (~3.7k lines; search it, don't read it whole). Zustand stores for cross-component state: `src/stores/`. Navigation and its permission guards: `src/config/nav.ts`.
- Backend SQL and business logic live in exported n8n workflows in `n8n-workflows/*.json`. Generated ones (notably `help-*.json`) must not be hand-edited; regenerate with `pnpm n8n:help` (see `scripts/n8n/*.mjs`).
- Genkit AI flows are separate from n8n: `src/ai/` (`pnpm genkit:dev`).
- Environment variables: use getters from `src/lib/runtime-config.ts` (`getApiUrl`, `getLicenseKey`, …), never `process.env`/`NEXT_PUBLIC_*` in app code. The only direct readers are `runtime-config.ts`, `src/i18n.ts` (server-side `NEXT_PUBLIC_CLIENT_ID`) and `src/app/[locale]/layout.tsx`, which injects `window.__INVOKEIA_RUNTIME_CONFIG__`. Adding a variable means updating `RuntimeConfig`, the getter, the layout and `docs/runtime-config.md`. If `NEXT_PUBLIC_API_URL` is missing, `getApiUrl()` falls back to a hardcoded n8n host — verify the target before running mutations.

## Auth & permissions

`AuthContext` (`src/context/AuthContext.tsx`) keeps the JWT and user/roles in `localStorage` and exposes the active cash session and active sede (loaded from the API). Permission checks are code-based, not role-name-based:

- `usePermissions()` (`src/hooks/usePermissions.ts`) → `hasPermission`, `hasAnyPermission`, `hasAllPermissions`, `canAccess`; codes in `src/constants/permissions.ts`.
- `<Can>` for conditional UI, `<PrivateRoute>` for page access, `<RoutePermissionGuard>` in a leaf `layout.tsx` when a section has several pages with separate permissions.
- The sidebar is filtered at runtime by permission; add new entries to `src/config/nav.ts` with the right `requiredPermission`/`requiredAnyPermission`.
- Patient portal (`/patient-login`, `/my-profile`) uses a patient JWT and `usePatientPortal`; don't put staff-only guards on it.
- For any access-controlled UI, load the `permissions-protection` skill.

## i18n & dates

- Add every user-facing string to **all three** base files: `src/messages/{en,es,es-ES}.json`, with identical keys and ICU placeholders (there is no automated parity check). `es` is Rioplatense; `es-ES` is Castilian with `tú`.
- Per-client overrides: `src/messages/overrides/<NEXT_PUBLIC_CLIENT_ID>/<locale>.json` (partial, deep-merged in `src/i18n.ts`). Update them when changing a key they already override. See `docs/i18n-overrides.md`.
- E2E specs assert Spanish strings from `es.json`; changing Spanish copy can require test updates.
- Dates/timezones are a bug source. Use `formatDateTime` (API timestamps; strips `Z`), `formatUtcDateTime` (DB-generated UTC timestamps), `formatDisplayDate`, `formatDate`, `formatHolidayDate` and `toLocalISOString` from `src/lib/utils.ts`. Never use `new Date(iso).toLocale*`, `parseISO` with `Z`, or `toISOString()` in API payloads. Load `date-formatting` for details.
- Money: use `formatMoney` / `formatMoneyCompact` / `formatMultiCurrency` from `src/lib/currency.ts`; `fmtMoney` / `fmtMultiCurrency` in `utils.ts` are deprecated.

## Help catalog / guided assistant

The in-app assistant is generated from code plus hand-written knowledge. When adding or changing a page, form, button, tab or menu item:

1. Ensure `data-help-id` exists. UI primitives (`FormField`, `Button type="submit"`, `DataTable` toolbar, tabs, confirm dialogs) emit `<scope>.<kind>.<name>` automatically; add literals only for the rest.
2. Update the screen ficha (`knowledge/screens/<scope>.json`) and any affected guide (`knowledge/use-cases/<id>.json`) **and the same files under `knowledge/en/`** in the same commit.
3. Run `pnpm knowledge:build` (pre-commit also runs it). `pnpm knowledge:check` validates routes, help ids and English completeness. Generated `src/generated/help-catalog*.json` is committed.

Never rename a published help id or a `FormField` name used by a guide without updating the guide. Load the `help-catalog` skill; full reference: `docs/onboarding-asistente.md`. New onboarding steps also need the same id in `help_onboarding_compute()` (a `database/scripts/` SQL migration).

The mascot at `src/components/invoke-mascot` is a vendored design library with intentional `refs`/`Date.now` in render and ESLint overrides; don't refactor it.

## Database

The app never connects to Postgres: browser → n8n → Postgres.

- Current migrations are plain SQL in `database/scripts/NNN_YYYYMMDD_name.sql`: `BEGIN … COMMIT`, idempotent, and register in `db_migrations` (`ON CONFLICT (script_name) DO UPDATE`). Use the next free number (newest sequential script is 161). Apply manually with `psql < database/scripts/...sql`; when the change ships with an n8n workflow, apply the SQL before importing the workflow.
- The Liquibase setup (`pnpm db:*`, `database/changelogs/`) is legacy and out of sync: `changelog-master.xml` includes `scripts/metadata/` and `scripts/seed/`, which don't exist, and it does **not** include `database/scripts/`. Don't expect `pnpm db:migrate` to apply new SQL.
- Postgres MCP targets the shared DEV database. Read-only queries/EXPLAIN are fine; never run `INSERT`/`UPDATE`/`DELETE`/DDL or bulk changes without explicit user approval (show the SQL first). Don't dump patient/PII data.

## Testing

Playwright only (`e2e/`), no unit-test runner.

- `.env.local` must define `E2E_USER` and `E2E_PASS`; `playwright.config.ts` loads it. Base URL is `E2E_BASE_URL` (default `http://localhost:3000`) + `/es`.
- The `setup` project logs in and saves `e2e/.auth/user.json`; `chromium` and `mobile-chrome` depend on it. Workers are 1 and tests are not fully parallel.
- The webServer command is `npm run dev` (not pnpm) and reuses an existing server locally.
- Tests hit the real n8n backend and shared DEV data; they create/edit/delete records. Don't run the full suite against production.
- Single spec: `pnpm test:e2e e2e/tests/patients/patients.spec.ts`; filter with `-g "..."`. Report: `pnpm test:e2e:report`.
- Guides regression: `e2e/tests/help/help-guides.spec.ts`. `pnpm videos:record` drives the real app and by default presses the final OK (writes real data); set `HELP_VIDEO_NO_CONFIRM=1` unless you intend that.

## Conventions

- `interface` for object shapes, `type` for unions/primitives. All shared types go in `src/lib/types.ts`.
- Forms: React Hook Form + Zod only. Define the schema first and derive the type with `z.infer`.
- Interactive components need `'use client'`; reusable UI uses `forwardRef` + `displayName`; merge classes with `cn()` from `@/lib/utils`.
- Import order: external libs → `@/components/ui/*` → `@/components/*` → hooks/utils/services → types/constants/config, blank line between groups.
- New files are kebab-case (some legacy hooks/services are camelCase).
- Backend mutations: use `useAsyncAction`/`useKeyedAsyncAction` (`src/hooks/use-async-action.ts`) plus `<Button loading>`; pass `REQUEST_TIMEOUT_MS.mutation` (30 s) or `.longRunning` (300 s) to `api.*`. On timeout, refresh instead of blindly retrying — the backend may have applied it. Load `ux-interaction-patterns`.
- **Tailwind is v3**, configured in `tailwind.config.ts` with CSS variables in `src/app/globals.css`; don't apply the `tailwind-v4-shadcn` v4 setup. Use `ui-design-system` for tokens and component patterns.
