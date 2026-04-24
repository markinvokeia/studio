Generate a complete Playwright test suite (Page Object Model + spec file) for the given module by reading its source code.

## Usage
/playwright-generate <module>

Examples:
- /playwright-generate patients
- /playwright-generate sales/quotes
- /playwright-generate config/doctors
- /playwright-generate clinic-catalog/ailments
- /playwright-generate system/users
- /playwright-generate cashier

## Argument
The $ARGUMENTS variable contains the module path (e.g. "patients", "sales/quotes").

## Instructions

You are generating a Playwright E2E test suite for the Invoke IA healthcare SaaS app. Follow these steps precisely:

### Step 1 — Gather context

Read the following files (all reads in parallel):
1. `src/app/[locale]/$ARGUMENTS/page.tsx` — the module's page component (source of truth for UI)
2. `docs/guia-uso-invoke-ia.md` — find the section matching this module for field names, validations, and flows
3. `e2e/pages/base.page.ts` — the base page class to extend
4. `e2e/fixtures/test.fixture.ts` — how to import the test fixture
5. `e2e/utils/helpers.ts` — available utility functions

If `src/app/[locale]/$ARGUMENTS/page.tsx` doesn't exist, try `src/app/[locale]/$ARGUMENTS/layout.tsx` or the closest page file.

### Step 2 — Analyse the source

From `page.tsx`, extract:
- **Forms**: all fields (labels, placeholders, types), required/optional, validation rules
- **Actions**: buttons and what they do (create, edit, delete, confirm, print, email, etc.)
- **Tabs**: tab names and their content in the detail panel
- **Filters**: search inputs, date pickers, dropdowns, toggles
- **API routes**: any `API_ROUTES` references — tells you what data is fetched/mutated
- **Permissions**: any `usePermissions()` or `<Can>` usage — note what's permission-gated

### Step 3 — Generate the Page Object Model

Write `e2e/pages/<module-slug>.page.ts`:
- Extend `BasePage` from `e2e/pages/base.page.ts`
- Add module-specific selectors and action methods
- Use accessible selectors in this priority order:
  1. `data-testid="..."` (if present)
  2. `getByRole(...)` with accessible name
  3. `getByLabel(...)` / `getByPlaceholder(...)`
  4. `getByText(...)` for unique visible text
  5. CSS selectors only as last resort
- Name methods after what the user does: `fillPatientName()`, `clickCreateQuote()`, `openOrdersTab()`

### Step 4 — Generate the spec file

Write `e2e/tests/<module-path>/<module-slug>.spec.ts`:

Structure:
```typescript
import { test, expect } from '../../fixtures/test.fixture';
import { <ModulePage> } from '../../pages/<module-slug>.page';
import { randomEmail, randomDoc, randomPhone } from '../../utils/helpers';

test.describe('<ModuleName>', () => {

  test.describe('Listado y filtros', () => {
    // - page loads and shows table
    // - search returns matching results
    // - empty search shows all results
    // - date range filter narrows results
    // - "solo activos" toggle if present
    // - clear filters restores all results
  });

  test.describe('Crear', () => {
    // - form opens on click
    // - valid data → success toast → row appears in table
    // - required fields show validation errors when empty
    // - invalid email/phone/doc shows validation error
    // - cancel closes form without creating
  });

  test.describe('Editar', () => {
    // - form opens pre-filled with selected row data
    // - modifying a field and saving → success toast → table reflects change
    // - cancel discards changes
  });

  test.describe('Eliminar', () => {
    // - delete button shows confirmation dialog
    // - cancelling dialog keeps the row
    // - confirming removes the row and shows toast
  });

  test.describe('Detalle y tabs', () => {
    // One test per tab: tab is clickable, shows relevant content
  });

  test.describe('Acciones específicas', () => {
    // Module-specific: print, send email, convert to order, complete item, etc.
    // Derive from the guide and the source code
  });

});
```

Rules for writing tests:
- Each test is **independent** — create test data at the start, clean up if needed
- Use `test.beforeEach` only for navigation, not for complex state setup
- Use `randomEmail()`, `randomDoc()`, `randomPhone()` from helpers for unique test data
- Assert **behaviour**, not implementation (check visible text, not DOM structure)
- Keep tests short: navigate → act → assert
- Use `await expect(...).toBeVisible()` with `{ timeout: 8_000 }` for async UI
- Add `test.skip(condition, reason)` for tests that need a real backend state (e.g., "needs existing invoice to pay")

### Step 5 — Write the files

Create both files and then report:
- Path of POM file created
- Path of spec file created
- Number of test cases generated
- List of any tests marked as skip and why
- Any selectors that are fragile and would benefit from `data-testid` (mention `/playwright-add-testids` skill)
