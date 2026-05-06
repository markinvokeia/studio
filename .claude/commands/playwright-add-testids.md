Add `data-testid` attributes to interactive elements in a page component to make Playwright selectors stable.

## Usage
/playwright-add-testids <file-path>

Examples:
- /playwright-add-testids src/app/[locale]/patients/page.tsx
- /playwright-add-testids src/app/[locale]/sales/quotes/page.tsx

## Argument
The $ARGUMENTS variable contains the relative file path to modify.

## Instructions

### Step 1 — Read the file
Read the file at `$ARGUMENTS` completely.

### Step 2 — Identify elements

Find ALL interactive and key structural elements:
- **Buttons**: create, edit, delete, confirm, cancel, print, email, save, etc.
- **Form inputs**: text, email, tel, number, date, textarea
- **Selects / Comboboxes**: shadcn Select and Command/Combobox components
- **Checkboxes and switches**
- **Tabs** (TabsList, TabsTrigger)
- **Table** (the main DataTable)
- **Search inputs**
- **Dialog/Sheet/Modal** containers
- **Detail panel** container

### Step 3 — Apply testids

Follow the naming convention: `{module}-{element-description}`

Examples by module:
```
patients-create-btn
patients-search-input
patients-table
patients-name-input
patients-email-input
patients-phone-input
patients-doc-input
patients-active-checkbox
patients-save-btn
patients-cancel-btn
patients-edit-btn
patients-delete-btn
patients-detail-panel
patients-tab-history
patients-tab-quotes
patients-tab-appointments
```

For buttons in row actions (dropdown menus):
```
patients-row-menu-btn
patients-row-edit-option
patients-row-delete-option
patients-row-activate-option
```

For forms inside dialogs/sheets:
```
patients-form-dialog
patients-form-name
patients-form-email
```

Rules:
- Use `data-testid` prop on JSX elements
- For shadcn components (Button, Input, etc.) add it directly: `<Button data-testid="patients-create-btn">`
- For Radix primitives that don't forward the prop, wrap in a `<div data-testid="...">` or add to the trigger element
- Do NOT add testids to every single element — focus on elements a test would need to interact with or assert on
- Keep existing code structure exactly — only add the `data-testid` attributes

### Step 4 — Apply the changes

Use the Edit tool to modify the file with all the testid additions.

### Step 5 — Report

List all added testids in a table:
| testid | Element | Purpose |
|--------|---------|---------|
| patients-create-btn | Button | Opens create patient form |
| ... | ... | ... |

This list can be directly copied into the Playwright spec for reference.
