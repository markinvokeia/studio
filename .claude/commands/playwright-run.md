Run Playwright tests and report results clearly.

## Usage
/playwright-run [filter]

Examples:
- /playwright-run              → runs all tests
- /playwright-run auth         → runs tests matching "auth"
- /playwright-run patients     → runs tests matching "patients"
- /playwright-run flows        → runs E2E flow tests
- /playwright-run sales        → runs all sales module tests

## Argument
The $ARGUMENTS variable contains an optional filter string (grep pattern). Empty = run all.

## Instructions

### Step 1 — Check prerequisites

Run this command to check if the dev server is running:
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/es/login
```

If it returns anything other than 200, note that the server is not running and the `webServer` in `playwright.config.ts` will attempt to start it automatically.

Check that `.env.local` has `E2E_USER` and `E2E_PASS` set:
```bash
grep -E "E2E_USER|E2E_PASS" .env.local 2>/dev/null && echo "credentials found" || echo "WARNING: E2E credentials not set in .env.local"
```

### Step 2 — Run the tests

If $ARGUMENTS is empty, run all tests:
```bash
npx playwright test --reporter=list 2>&1
```

If $ARGUMENTS has a filter:
```bash
npx playwright test --grep "$ARGUMENTS" --reporter=list 2>&1
```

Capture the full output.

### Step 3 — Parse and report

From the output, extract and display:

**Summary:**
```
✅ Passed:  X
❌ Failed:  X
⏭️  Skipped: X
Total:     X
Duration:  Xs
```

**Failed tests** (if any):
For each failure, show:
- Test name
- File path
- Error message (first 3 lines)
- Likely cause (network, selector not found, assertion failed, timeout)
- Suggested fix

**Skipped tests** (if any):
- List them with their skip reason

### Step 4 — Offer next steps

Based on results:
- If all pass: "All tests passing ✅. Run `npm run test:e2e:report` to see the HTML report."
- If failures: List which modules have failures and suggest:
  - `/playwright-add-testids <file>` for selector issues
  - Check if dev server is running and API is accessible
  - Check if `E2E_USER` / `E2E_PASS` credentials are valid
- If no tests exist for a module: "Run `/playwright-generate <module>` to generate tests for it."
