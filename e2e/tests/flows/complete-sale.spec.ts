import { expect, type Page, test } from '@playwright/test';

import { ROW_OR_CARD, rowOrCardByText, waitForList } from '../../utils/helpers';

const T = {
  quotesPage: 'Presupuestos',
  invoicesPage: 'Facturas',
  filterInvoices: 'Filtrar aquí...',
  quoteStatus: {
    draft: 'Borrador',
    confirmed: 'Confirmado',
  },
  billingStatus: {
    notInvoiced: 'Sin Facturar',
  },
  tabs: {
    items: 'Artículos',
    invoices: 'Facturas',
  },
  actions: {
    createQuote: 'Crear',
    confirmQuote: 'Confirmar',
    addItem: 'Agregar Artículo',
    completeItem: 'Completar',
    invoiceQuote: 'Facturar',
    confirmInvoice: 'Confirmar Factura',
    addPayment: 'Agregar Pago',
    viewDetails: 'Ver',
    openMenu: /Abrir menú|Abrir Menú/,
  },
  quoteConfirmDialog: {
    title: 'Confirmar Presupuesto',
    confirm: 'Confirmar',
  },
  quoteDialog: {
    title: 'Crear Presupuesto',
    selectUser: 'Seleccionar Usuario',
    searchUser: 'Buscar Usuario',
    selectService: 'Seleccionar Servicio',
    searchService: 'Buscar servicio',
    save: 'Guardar',
  },
  invoiceConfirmDialog: {
    title: 'Confirmar Factura',
    confirm: 'Confirmar',
  },
  clinicSessionDialog: {
    title: 'Crear Sesión',
    doctor: 'Doctor',
    save: 'Guardar',
  },
  paymentDialog: {
    title: 'Agregar Pago',
    method: 'Método',
    historical: 'Histórico',
    submit: 'Agregar Pago',
  },
  invoiceStatus: {
    booked: 'Contabilizado',
    paid: 'Pagado',
  },
};

async function openQuotesPage(page: Page) {
  await page.goto('/es/sales/quotes', { waitUntil: 'domcontentloaded' });
  await waitForList(page, 15_000);
  await expect(page.getByText(T.quotesPage).first()).toBeVisible();
}

async function getQuoteTableRows(page: Page) {
  return page.locator(ROW_OR_CARD);
}

async function getQuoteDocNo(row: ReturnType<Page['locator']>) {
  const rowText = (await row.innerText()).replace(/\s+/g, ' ').trim();
  const docNo = rowText.match(/QUO-\d{4}-\d{2}-\d{4}/)?.[0] || '';
  expect(docNo, 'El presupuesto creado debe tener número de documento').toBeTruthy();
  return docNo as string;
}

async function selectRowOrCard(page: Page, text: string) {
  const selectionReady = async () => {
    const viewDetailsButton = page.getByRole('button', { name: /Ver detalles/i }).first();
    const invoiceButton = page.getByRole('button', { name: T.actions.invoiceQuote }).first();
    const confirmButton = page.getByRole('button', { name: T.actions.confirmQuote }).first();
    return (
      await confirmButton.isVisible({ timeout: 1_000 }).catch(() => false)
      || await viewDetailsButton.isVisible({ timeout: 1_000 }).catch(() => false)
      || await invoiceButton.isVisible({ timeout: 1_000 }).catch(() => false)
    );
  };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const entry = page.locator(`${ROW_OR_CARD}:visible`).filter({ hasText: text }).first();
    await expect(entry).toBeVisible({ timeout: 15_000 });

    const radio = entry.getByRole('radio').first();
    if (await radio.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await radio.click();
      if (await selectionReady()) {
        return entry;
      }
    }

    await entry.click();
    if (await selectionReady()) {
      return entry;
    }

    await page.waitForTimeout(500);
  }

  await expect.poll(selectionReady, { timeout: 10_000 }).toBe(true);
  return rowOrCardByText(page, text).first();
}

async function selectFirstDoctor(page: Page) {
  const dialog = page.getByRole('dialog').filter({ hasText: T.clinicSessionDialog.title });
  await expect(dialog).toBeVisible();

  await dialog.getByRole('combobox').first().click();
  const options = page.getByRole('option');
  await expect(options.first()).toBeVisible({ timeout: 15_000 });
  await options.first().click();
}

async function openQuoteDetailsIfNeeded(page: Page) {
  if (!await isCardMode(page)) {
    const detailsTitle = page.getByText(/Detalles para/i).first();
    if (await detailsTitle.isVisible({ timeout: 2_000 }).catch(() => false)) {
      return;
    }

    const openPanelButton = page.getByRole('button', { name: new RegExp(`^${T.actions.viewDetails}$`, 'i') }).first();
    await expect(openPanelButton).toBeVisible({ timeout: 15_000 });
    await openPanelButton.click();
    await expect(detailsTitle).toBeVisible({ timeout: 15_000 });
    return;
  }

  const openPanelButton = page.getByRole('button', { name: new RegExp(`^${T.actions.viewDetails}$`, 'i') }).first();
  if (await openPanelButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await openPanelButton.click();
  }

  const itemsTab = page.getByRole('button', { name: T.tabs.items }).last();
  if (await itemsTab.isVisible({ timeout: 2_000 }).catch(() => false)) {
    return;
  }

  const viewDetailsButton = page.getByRole('button', { name: /Ver detalles/i }).first();
  if (await viewDetailsButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await viewDetailsButton.click();
    await expect(itemsTab).toBeVisible({ timeout: 15_000 });
    return;
  }
  await expect(itemsTab).toBeVisible({ timeout: 15_000 });
}

async function isCardMode(page: Page) {
  return page.evaluate(() => window.innerWidth < 768);
}

async function expectAnyText(locator: ReturnType<Page['locator']>, patterns: Array<string | RegExp>, timeout = 15_000) {
  await expect.poll(async () => {
    const text = (await locator.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    return patterns.some((pattern) => (
      typeof pattern === 'string' ? text.includes(pattern) : pattern.test(text)
    ));
  }, { timeout }).toBe(true);
}

test.describe('Flujo de Venta Completo', () => {
  test('crea, confirma, completa, factura y cobra un presupuesto', async ({ page }) => {
    await openQuotesPage(page);

    let createdQuoteDocNo = '';
    let createdQuoteRow = page.locator(ROW_OR_CARD).first();

    await test.step('Crear un presupuesto borrador', async () => {
      await page.getByRole('button', { name: T.actions.createQuote }).click();

      const quoteDialog = page.getByRole('dialog').filter({ hasText: T.quoteDialog.title });
      await expect(quoteDialog).toBeVisible();

      await quoteDialog.getByRole('combobox', { name: 'Usuario' }).click();
      await page.getByPlaceholder(T.quoteDialog.searchUser).fill('a');
      await page.waitForTimeout(500);
      await expect(page.getByRole('option').first()).toBeVisible({ timeout: 15_000 });
      await page.getByRole('option').first().click();

      await quoteDialog.getByRole('button', { name: T.actions.addItem }).click();
      const selectServiceTrigger = quoteDialog.locator('button:visible').filter({
        hasText: new RegExp(T.quoteDialog.selectService, 'i'),
      }).last();
      await selectServiceTrigger.click();
      await page.getByPlaceholder(new RegExp(T.quoteDialog.searchService, 'i')).fill('a');
      await page.waitForTimeout(500);
      await expect(page.getByRole('option').first()).toBeVisible({ timeout: 15_000 });
      await page.getByRole('option').first().click();

      await quoteDialog.getByRole('button', { name: T.quoteDialog.save }).click();
      await expect(quoteDialog).not.toBeVisible({ timeout: 20_000 });

      await waitForList(page, 15_000);
      createdQuoteRow = page.locator(ROW_OR_CARD).first();
      await expect(createdQuoteRow).toBeVisible({ timeout: 15_000 });
      createdQuoteDocNo = await getQuoteDocNo(createdQuoteRow);
      if (await isCardMode(page)) {
        await createdQuoteRow.click();
        await openQuoteDetailsIfNeeded(page);
      } else {
        await createdQuoteRow.click();
      }
    });

    await test.step('Confirmar el presupuesto recién creado', async () => {
      const confirmQuoteButton = page.getByRole('button', { name: T.actions.confirmQuote }).first();
      await expect(confirmQuoteButton).toBeVisible();
      await confirmQuoteButton.click();

      const confirmDialog = page.getByRole('dialog').filter({ hasText: T.quoteConfirmDialog.title });
      await expect(confirmDialog).toBeVisible();
      await confirmDialog.getByRole('button', { name: T.quoteConfirmDialog.confirm }).click();

      await expect(page.getByText(T.quoteStatus.confirmed).first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(T.billingStatus.notInvoiced).first()).toBeVisible({ timeout: 15_000 });
      if (await isCardMode(page)) {
        await openQuoteDetailsIfNeeded(page);
      } else {
        const refreshedQuoteRow = page.locator('table tbody tr').first();
        await expect(refreshedQuoteRow).toBeVisible({ timeout: 15_000 });
        await refreshedQuoteRow.click();
        await openQuoteDetailsIfNeeded(page);
      }
    });

    await test.step('Completar un ítem de la orden desde el panel del presupuesto', async () => {
      const inCardMode = await isCardMode(page);
      await openQuoteDetailsIfNeeded(page);
      if (inCardMode) {
        await page.locator('button:visible').filter({ hasText: new RegExp(`^${T.tabs.items}$`) }).last().click();
      }

      const orderItemRadio = page.locator('input[type="radio"][name="order-item-selection"]:visible').first();
      const hasRadioTable = await orderItemRadio.isVisible({ timeout: 5_000 }).catch(() => false);
      const orderItemRow = page.locator('[data-testid="card-list"]:visible [data-testid="list-item"]').first();
      const orderItemCardButton = orderItemRow.getByRole('button').first();
      const completeButton = page.locator('button:visible').filter({ hasText: new RegExp(`^${T.actions.completeItem}$`) }).last();

      if (!inCardMode) {
        if (!hasRadioTable) {
          await page.locator('table tbody tr').first().click();
          await expect(orderItemRadio).toBeVisible({ timeout: 15_000 });
        }
        await orderItemRadio.check();
      } else {
        await expect(orderItemRow).toBeVisible({ timeout: 15_000 });
        for (let attempt = 0; attempt < 3; attempt += 1) {
          if (await orderItemCardButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
            await orderItemCardButton.click();
          } else {
            await orderItemRow.click();
          }
          if (await completeButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
            break;
          }
        }
      }

      await expect(completeButton).toBeVisible({ timeout: 15_000 });
      await completeButton.click();

      await selectFirstDoctor(page);

      const clinicDialog = page.getByRole('dialog').filter({ hasText: T.clinicSessionDialog.title });
      await clinicDialog.getByRole('button', { name: T.clinicSessionDialog.save }).click();
      await expect(clinicDialog).not.toBeVisible({ timeout: 20_000 });

      if (inCardMode) {
        await expect(orderItemRow).toContainText('Completado', { timeout: 20_000 });
      } else {
        await expectAnyText(page.locator('body'), ['Completado', /completed/i], 20_000);
      }
    });

    let invoiceDocNo = '';

    await test.step('Facturar el presupuesto y verificar que aparece una factura contabilizada', async () => {
      const invoiceButton = page.getByRole('button', { name: T.actions.invoiceQuote });
      await expect(invoiceButton).toBeVisible({ timeout: 15_000 });
      await invoiceButton.click();

      await page.getByRole('button', { name: T.tabs.invoices }).last().click();

      const invoiceCard = page.getByRole('button', { name: /INV-\d{4}-\d{2}-\d{4}/ }).first();
      await expect(invoiceCard).toBeVisible({ timeout: 20_000 });

      const invoiceText = (await invoiceCard.innerText()).replace(/\s+/g, ' ');
      invoiceDocNo = invoiceText.match(/INV-\d{4}-\d{2}-\d{4}/)?.[0] || '';
      expect(invoiceDocNo, 'La factura generada debe tener número de documento').not.toBe('');

      await page.goto('/es/sales/invoices', { waitUntil: 'domcontentloaded' });
      await waitForList(page, 15_000);
      await expect(page.getByText(T.invoicesPage).first()).toBeVisible();
    });

    await test.step('Agregar un pago real y verificar estado pagado', async () => {
      await page.getByPlaceholder(T.filterInvoices).fill(invoiceDocNo);
      const filteredInvoiceRow = rowOrCardByText(page, invoiceDocNo).first();
      await expect(filteredInvoiceRow).toBeVisible({ timeout: 15_000 });
      await expectAnyText(filteredInvoiceRow, [T.invoiceStatus.booked, /booked/i]);
      await filteredInvoiceRow.click();

      const addPaymentButton = page.getByRole('button', { name: T.actions.addPayment }).first();
      await expect(addPaymentButton).toBeVisible({ timeout: 15_000 });
      await addPaymentButton.click();

      const paymentDialog = page.getByRole('dialog').filter({ hasText: T.paymentDialog.title });
      await expect(paymentDialog).toBeVisible();

      await paymentDialog.getByRole('checkbox', { name: T.paymentDialog.historical }).click();

      await paymentDialog.getByRole('combobox', { name: T.paymentDialog.method }).click();
      const methodOptions = page.getByRole('option');
      await expect(methodOptions.first()).toBeVisible({ timeout: 15_000 });
      await methodOptions.first().click();

      await paymentDialog.getByRole('button', { name: T.paymentDialog.submit }).click();
      await expect(paymentDialog).not.toBeVisible({ timeout: 20_000 });

      await expectAnyText(page.locator('body'), [T.invoiceStatus.paid, /paid/i], 20_000);
    });
  });
});
