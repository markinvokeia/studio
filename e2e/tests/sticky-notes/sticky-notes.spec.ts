import { test, expect, type Page } from '@playwright/test';

// ── Translation strings (es.json — StickyNotes namespace) ────────────────────
const T = {
  openNotes: 'Notas rápidas',
  newNote: 'Nueva nota',
  save: 'Guardar',
  cancel: 'Cancelar',
  edit: 'Editar nota',
  delete: 'Eliminar nota',
  empty: 'Sin notas aún',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Opens the sticky notes overlay from the global header button. */
async function openOverlay(page: Page) {
  const btn = page.getByRole('button', { name: T.openNotes }).first();
  await expect(btn).toBeVisible({ timeout: 10_000 });
  await btn.click();
  // Overlay is mounted when "Nueva nota" card is visible
  await expect(page.getByText(T.newNote).first()).toBeVisible({ timeout: 8_000 });
}

/** Closes the overlay via the X button, falling back to Escape. */
async function closeOverlay(page: Page) {
  const closeBtn = page
    .locator('button')
    .filter({ has: page.locator('svg.lucide-x') })
    .first();
  if (await closeBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await closeBtn.click();
  } else {
    await page.keyboard.press('Escape');
  }
  // Wait for overlay to fully unmount
  await expect(page.getByText(T.newNote).first()).not.toBeVisible({ timeout: 5_000 });
}

/**
 * Clicks the new-note card (+) to activate the form and waits for the textarea.
 * Scopes within the overlay area to avoid ambiguity.
 */
async function activateNewNote(page: Page) {
  // The overlay content area is the fixed scrollable wrapper at z-[9981]
  const overlay = page.locator('[class*="fixed"][class*="overflow-y-auto"]').last();
  await overlay.getByText(T.newNote).first().click();
  await page.waitForSelector('textarea', { timeout: 5_000 });
}

/**
 * Scope for color picker buttons: only the circular color dots inside the
 * active new-note form. Scopes to the overlay to exclude other rounded-full
 * elements (notification badges, avatar buttons, etc.).
 */
function colorDotsInOverlay(page: Page) {
  return page
    .locator('[class*="fixed"][class*="overflow-y-auto"]')
    .last()
    .locator('button[type="button"][class*="h-5"][class*="w-5"][class*="rounded-full"]');
}

/** Finds an existing note card by its exact text (excludes the new-note card). */
function noteCardByText(page: Page, text: string) {
  return page
    .locator('[class*="rounded-xl"][class*="border"][class*="shadow"]')
    .filter({ hasText: text })
    .filter({ hasNot: page.locator('[class*="border-dashed"]') }) // exclude the + dashed card
    .first();
}

// ── Test suite ───────────────────────────────────────────────────────────────

test.describe('Notas rápidas (Sticky Notes)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('header', { timeout: 15_000 });
  });

  // ── Apertura y cierre del overlay ────────────────────────────────────────

  test.describe('Apertura y cierre del overlay', () => {
    test('botón "Notas rápidas" está visible en el header', async ({ page }) => {
      await expect(page.getByRole('button', { name: T.openNotes }).first()).toBeVisible({ timeout: 10_000 });
    });

    test('clic en el botón abre el overlay', async ({ page }) => {
      await openOverlay(page);
      await expect(page.getByText(T.newNote).first()).toBeVisible();
    });

    test('botón X cierra el overlay', async ({ page }) => {
      await openOverlay(page);
      const closeBtn = page.locator('button').filter({ has: page.locator('svg.lucide-x') }).first();
      await closeBtn.click();
      await expect(page.getByText(T.newNote).first()).not.toBeVisible({ timeout: 5_000 });
    });

    test('tecla Escape cierra el overlay', async ({ page }) => {
      await openOverlay(page);
      await page.keyboard.press('Escape');
      await expect(page.getByText(T.newNote).first()).not.toBeVisible({ timeout: 5_000 });
    });

    test('clic en el backdrop semitransparente cierra el overlay', async ({ page }) => {
      await openOverlay(page);
      // The backdrop is the fixed inset-0 div with backdrop-blur-[1px]
      // Clicking it (not on the overlay content) triggers onClose
      const backdrop = page.locator('[class*="backdrop-blur"]').first();
      await backdrop.click({ position: { x: 5, y: 5 }, force: true });
      await expect(page.getByText(T.newNote).first()).not.toBeVisible({ timeout: 5_000 });
    });

    test('deep-link ?act=Notes abre el overlay sin interacción manual', async ({ page }) => {
      await page.goto('/?act=Notes', { waitUntil: 'domcontentloaded' });
      await expect(page.getByText(T.newNote).first()).toBeVisible({ timeout: 10_000 });
    });
  });

  // ── Tarjeta de nueva nota ────────────────────────────────────────────────

  test.describe('Tarjeta de nueva nota', () => {
    test.beforeEach(async ({ page }) => {
      await openOverlay(page);
    });

    test('la tarjeta + muestra el texto "Nueva nota"', async ({ page }) => {
      await expect(page.getByText(T.newNote).first()).toBeVisible();
    });

    test('clic en la tarjeta + muestra el textarea del formulario', async ({ page }) => {
      await activateNewNote(page);
      await expect(page.locator('textarea').first()).toBeVisible();
    });

    test('botón Cancelar resetea el formulario y vuelve la tarjeta +', async ({ page }) => {
      await activateNewNote(page);
      await page.locator('textarea').first().fill('Nota cancelada');
      await page.getByRole('button', { name: T.cancel }).first().click();
      await expect(page.locator('textarea').first()).not.toBeVisible({ timeout: 3_000 });
      await expect(page.getByText(T.newNote).first()).toBeVisible();
    });

    test('Escape en el textarea cancela el formulario', async ({ page }) => {
      await activateNewNote(page);
      await page.locator('textarea').first().fill('Texto temporal');
      await page.locator('textarea').first().press('Escape');
      await expect(page.locator('textarea').first()).not.toBeVisible({ timeout: 3_000 });
    });

    test('botón Guardar está deshabilitado con textarea vacío', async ({ page }) => {
      await activateNewNote(page);
      await expect(page.getByRole('button', { name: T.save }).first()).toBeDisabled();
    });

    test('botón Guardar se habilita al escribir texto', async ({ page }) => {
      await activateNewNote(page);
      await page.locator('textarea').first().fill('Texto válido');
      await expect(page.getByRole('button', { name: T.save }).first()).toBeEnabled();
    });

    test('el selector de color muestra exactamente 6 opciones', async ({ page }) => {
      await activateNewNote(page);
      // Color dots: h-5 w-5 rounded-full buttons inside the overlay, scoped to avoid
      // any other rounded-full elements in the rest of the page
      const dots = colorDotsInOverlay(page);
      await expect(dots).toHaveCount(6);
    });

    test('crear una nota muestra el texto en el overlay y resetea el formulario', async ({ page }) => {
      await activateNewNote(page);
      const noteText = `Nota e2e ${Date.now()}`;
      await page.locator('textarea').first().fill(noteText);
      await page.getByRole('button', { name: T.save }).first().click();

      // Form resets: textarea disappears and + card reappears
      await expect(page.locator('textarea').first()).not.toBeVisible({ timeout: 8_000 });
      await expect(page.getByText(T.newNote).first()).toBeVisible({ timeout: 5_000 });
      // The note text should now appear in the overlay as a note card
      await expect(page.getByText(noteText)).toBeVisible({ timeout: 10_000 });
    });

    test('Ctrl+Enter guarda la nota y resetea el formulario', async ({ page }) => {
      await activateNewNote(page);
      const noteText = `Nota teclado ${Date.now()}`;
      await page.locator('textarea').first().fill(noteText);
      await page.locator('textarea').first().press('Control+Enter');
      await expect(page.locator('textarea').first()).not.toBeVisible({ timeout: 8_000 });
      await expect(page.getByText(noteText)).toBeVisible({ timeout: 10_000 });
    });
  });

  // ── Selector de color ────────────────────────────────────────────────────

  test.describe('Selector de color', () => {
    test.beforeEach(async ({ page }) => {
      await openOverlay(page);
    });

    test('cambiar a color azul en creación aplica el fondo azul a la tarjeta', async ({ page }) => {
      await activateNewNote(page);
      const dots = colorDotsInOverlay(page);
      // Colors: yellow(0), pink(1), blue(2), green(3), purple(4), orange(5)
      const blueBtn = dots.nth(2);
      if (!await blueBtn.isVisible({ timeout: 3_000 }).catch(() => false)) return;
      await blueBtn.click();
      // The active new-note card container should now have a blue background
      await expect(page.locator('[class*="bg-blue"]').first()).toBeVisible({ timeout: 2_000 });
    });

    test('cambiar color al editar una nota existente persiste en la tarjeta', async ({ page }) => {
      // Create a yellow (default) note first
      await activateNewNote(page);
      const noteText = `Nota color edit ${Date.now()}`;
      await page.locator('textarea').first().fill(noteText);
      await page.getByRole('button', { name: T.save }).first().click();
      await expect(page.getByText(noteText)).toBeVisible({ timeout: 10_000 });

      // Enter edit mode
      const card = noteCardByText(page, noteText);
      await card.hover();
      await card.getByTitle(T.edit).click();

      // Click green color (index 3)
      const editDots = card.locator('button[type="button"][class*="h-5"][class*="w-5"][class*="rounded-full"]');
      const greenBtn = editDots.nth(3);
      if (!await greenBtn.isVisible({ timeout: 3_000 }).catch(() => false)) return;
      await greenBtn.click();

      // Save the edit
      await card.getByRole('button', { name: T.save }).click();
      await page.waitForTimeout(500);

      // The card should now have a green background
      await expect(noteCardByText(page, noteText).locator('[class*="bg-green"]')).toBeVisible({ timeout: 3_000 });
    });
  });

  // ── Notas existentes — vista e interacciones ─────────────────────────────

  test.describe('Notas existentes', () => {
    test('los botones Editar y Eliminar aparecen al hacer hover', async ({ page }) => {
      await openOverlay(page);
      await activateNewNote(page);
      const noteText = `Nota hover ${Date.now()}`;
      await page.locator('textarea').first().fill(noteText);
      await page.getByRole('button', { name: T.save }).first().click();
      await expect(page.getByText(noteText)).toBeVisible({ timeout: 10_000 });

      const card = noteCardByText(page, noteText);
      await card.hover();
      await expect(card.getByTitle(T.edit)).toBeVisible({ timeout: 3_000 });
      await expect(card.getByTitle(T.delete)).toBeVisible({ timeout: 3_000 });
    });

    test('la tarjeta en modo lectura muestra el texto completo de la nota', async ({ page }) => {
      await openOverlay(page);
      await activateNewNote(page);
      const noteText = `Texto visible en tarjeta ${Date.now()}`;
      await page.locator('textarea').first().fill(noteText);
      await page.getByRole('button', { name: T.save }).first().click();
      await expect(page.getByText(noteText)).toBeVisible({ timeout: 10_000 });

      // The note text is rendered in a <p> tag inside the card
      const noteCard = noteCardByText(page, noteText);
      await expect(noteCard).toBeVisible();
      const cardText = await noteCard.textContent().catch(() => '');
      expect(cardText).toContain(noteText);
    });

    test('la nota más reciente aparece en primer lugar (comportamiento prepend)', async ({ page }) => {
      await openOverlay(page);

      // Create first note
      await activateNewNote(page);
      const firstText = `Primera ${Date.now()}`;
      await page.locator('textarea').first().fill(firstText);
      await page.getByRole('button', { name: T.save }).first().click();
      await expect(page.getByText(firstText)).toBeVisible({ timeout: 10_000 });

      // Create second note (should appear before the first)
      await activateNewNote(page);
      const secondText = `Segunda ${Date.now() + 1}`;
      await page.locator('textarea').first().fill(secondText);
      await page.getByRole('button', { name: T.save }).first().click();
      await expect(page.getByText(secondText)).toBeVisible({ timeout: 10_000 });

      // Get all note cards (excluding the + new-note card)
      const cards = page
        .locator('[class*="rounded-xl"][class*="border"][class*="shadow"]')
        .filter({ hasNot: page.locator('[class*="border-dashed"]') });

      const firstCardText = await cards.first().textContent().catch(() => '');
      expect(firstCardText).toContain(secondText); // most recent is first
    });

    test('clic en Editar abre el textarea con el texto original de la nota', async ({ page }) => {
      await openOverlay(page);
      await activateNewNote(page);
      const noteText = `Nota editar ${Date.now()}`;
      await page.locator('textarea').first().fill(noteText);
      await page.getByRole('button', { name: T.save }).first().click();
      await expect(page.getByText(noteText)).toBeVisible({ timeout: 10_000 });

      const card = noteCardByText(page, noteText);
      await card.hover();
      await card.getByTitle(T.edit).click();

      const editTextarea = card.locator('textarea');
      await expect(editTextarea).toBeVisible({ timeout: 3_000 });
      await expect(editTextarea).toHaveValue(noteText);
    });

    test('editar y guardar actualiza el texto de la nota en el overlay', async ({ page }) => {
      await openOverlay(page);
      await activateNewNote(page);
      const noteText = `Nota antes ${Date.now()}`;
      await page.locator('textarea').first().fill(noteText);
      await page.getByRole('button', { name: T.save }).first().click();
      await expect(page.getByText(noteText)).toBeVisible({ timeout: 10_000 });

      const card = noteCardByText(page, noteText);
      await card.hover();
      await card.getByTitle(T.edit).click();

      const updatedText = `Nota después ${Date.now()}`;
      await card.locator('textarea').fill(updatedText);
      await card.getByRole('button', { name: T.save }).click();

      await expect(page.getByText(updatedText)).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(noteText)).not.toBeVisible({ timeout: 3_000 });
    });

    test('cancelar edición restaura el texto original', async ({ page }) => {
      await openOverlay(page);
      await activateNewNote(page);
      const noteText = `Nota cancelar ${Date.now()}`;
      await page.locator('textarea').first().fill(noteText);
      await page.getByRole('button', { name: T.save }).first().click();
      await expect(page.getByText(noteText)).toBeVisible({ timeout: 10_000 });

      const card = noteCardByText(page, noteText);
      await card.hover();
      await card.getByTitle(T.edit).click();
      await card.locator('textarea').fill('Texto que no debe quedar');
      await card.getByRole('button', { name: T.cancel }).click();

      await expect(page.getByText(noteText)).toBeVisible({ timeout: 3_000 });
    });

    test('Escape durante edición descarta los cambios', async ({ page }) => {
      await openOverlay(page);
      await activateNewNote(page);
      const noteText = `Nota escape edit ${Date.now()}`;
      await page.locator('textarea').first().fill(noteText);
      await page.getByRole('button', { name: T.save }).first().click();
      await expect(page.getByText(noteText)).toBeVisible({ timeout: 10_000 });

      const card = noteCardByText(page, noteText);
      await card.hover();
      await card.getByTitle(T.edit).click();
      await card.locator('textarea').press('Escape');

      await expect(page.getByText(noteText)).toBeVisible({ timeout: 3_000 });
    });

    test('eliminar una nota la remueve del overlay', async ({ page }) => {
      await openOverlay(page);
      await activateNewNote(page);
      const noteText = `Nota borrar ${Date.now()}`;
      await page.locator('textarea').first().fill(noteText);
      await page.getByRole('button', { name: T.save }).first().click();
      await expect(page.getByText(noteText)).toBeVisible({ timeout: 10_000 });

      const card = noteCardByText(page, noteText);
      await card.hover();
      await card.getByTitle(T.delete).click();

      await expect(page.getByText(noteText)).not.toBeVisible({ timeout: 10_000 });
    });
  });

  // ── Estado vacío ─────────────────────────────────────────────────────────

  test.describe('Estado vacío', () => {
    test('muestra "Sin notas aún" cuando no hay notas activas', async ({ page }) => {
      await openOverlay(page);
      await page.waitForTimeout(2_000); // let API response settle

      const cards = page
        .locator('[class*="rounded-xl"][class*="border"][class*="shadow"]')
        .filter({ hasNot: page.locator('[class*="border-dashed"]') });

      if (await cards.count() > 0) return; // account has notes — skip

      await expect(page.getByText(T.empty)).toBeVisible({ timeout: 5_000 });
    });
  });

  // ── Badge de conteo en el header ─────────────────────────────────────────

  test.describe('Badge de conteo en el header', () => {
    test('el botón del header muestra estilo amarillo cuando hay notas', async ({ page }) => {
      await openOverlay(page);
      await activateNewNote(page);
      await page.locator('textarea').first().fill(`Badge test ${Date.now()}`);
      await page.getByRole('button', { name: T.save }).first().click();

      await closeOverlay(page);

      const headerBtn = page.getByRole('button', { name: T.openNotes }).first();
      // When notes > 0 the button gets bg-yellow-400/20 and text-yellow-500 classes
      const hasYellowStyle = await headerBtn
        .evaluate((el) => el.className.includes('yellow') || el.innerHTML.includes('yellow'))
        .catch(() => false);
      // Alternatively, a numeric badge span might be visible inside
      const hasBadge = await headerBtn
        .locator('span, div')
        .filter({ hasText: /^\d+$/ })
        .isVisible({ timeout: 2_000 }).catch(() => false);

      expect(hasYellowStyle || hasBadge).toBe(true);
    });
  });

  // ── Persistencia al reabrir ──────────────────────────────────────────────

  test.describe('Persistencia al reabrir', () => {
    test('las notas persisten al cerrar y volver a abrir el overlay (fetched from API)', async ({ page }) => {
      await openOverlay(page);
      await activateNewNote(page);
      const noteText = `Nota persistente ${Date.now()}`;
      await page.locator('textarea').first().fill(noteText);
      await page.getByRole('button', { name: T.save }).first().click();
      await expect(page.getByText(noteText)).toBeVisible({ timeout: 10_000 });

      await closeOverlay(page);
      await openOverlay(page);

      await expect(page.getByText(noteText)).toBeVisible({ timeout: 10_000 });

      // Cleanup: delete the note so it doesn't pollute other tests
      const card = noteCardByText(page, noteText);
      await card.hover();
      await card.getByTitle(T.delete).click();
      await expect(page.getByText(noteText)).not.toBeVisible({ timeout: 8_000 });
    });
  });
});
