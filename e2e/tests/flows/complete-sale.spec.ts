import { expect, type Page, test } from '@playwright/test';

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
  await page.goto('/es/sales/quotes');
  await page.waitForSelector('table', { timeout: 15_000 });
  await expect(page.getByText(T.quotesPage).first()).toBeVisible();
}

async function getQuoteTableRows(page: Page) {
  return page.locator('table').first().locator('tbody tr');
}

async function getQuoteDocNo(row: ReturnType<Page['locator']>) {
  const docNo = (await row.locator('td').nth(1).textContent())?.trim();
  expect(docNo, 'El presupuesto creado debe tener número de documento').toBeTruthy();
  return docNo as string;
}

async function selectFirstDoctor(page: Page) {
  const dialog = page.getByRole('dialog').filter({ hasText: T.clinicSessionDialog.title });
  await expect(dialog).toBeVisible();

  await dialog.getByRole('combobox').first().click();
  const options = page.getByRole('option');
  await expect(options.first()).toBeVisible({ timeout: 15_000 });
  await options.first().click();
}

test.describe('Flujo de Venta Completo', () => {
  test('crea, confirma, completa, factura y cobra un presupuesto', async ({ page }) => {
    await openQuotesPage(page);

    let createdQuoteDocNo = '';
    let createdQuoteRow = page.locator('table tbody tr').first();

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
      await quoteDialog.locator('table tbody tr').last().getByRole('combobox').click();
      await page.getByPlaceholder(new RegExp(T.quoteDialog.searchService, 'i')).fill('a');
      await page.waitForTimeout(500);
      await expect(page.getByRole('option').first()).toBeVisible({ timeout: 15_000 });
      await page.getByRole('option').first().click();

      await quoteDialog.getByRole('button', { name: T.quoteDialog.save }).click();
      await expect(quoteDialog).not.toBeVisible({ timeout: 20_000 });

      createdQuoteRow = page.locator('table tbody tr').first();
      await expect(createdQuoteRow).toBeVisible({ timeout: 15_000 });
      createdQuoteDocNo = await getQuoteDocNo(createdQuoteRow);
      await createdQuoteRow.click();
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
    });

    await test.step('Completar un ítem de la orden desde el panel del presupuesto', async () => {
      await page.getByRole('button', { name: T.tabs.items }).last().click();

      const orderItemRadio = page.locator('input[type="radio"][name="order-item-selection"]').first();
      await expect(orderItemRadio).toBeVisible({ timeout: 15_000 });

      const orderItemRow = orderItemRadio.locator('xpath=ancestor::tr');
      await orderItemRadio.check();

      const completeButton = page.getByRole('button', { name: T.actions.completeItem }).last();
      await expect(completeButton).toBeVisible();
      await completeButton.click();

      await selectFirstDoctor(page);

      const clinicDialog = page.getByRole('dialog').filter({ hasText: T.clinicSessionDialog.title });
      await clinicDialog.getByRole('button', { name: T.clinicSessionDialog.save }).click();
      await expect(clinicDialog).not.toBeVisible({ timeout: 20_000 });

      await expect(orderItemRow).toContainText('Completado', { timeout: 20_000 });
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

      await page.goto('/es/sales/invoices');
      await page.waitForSelector('table', { timeout: 15_000 });
      await expect(page.getByText(T.invoicesPage).first()).toBeVisible();
    });

    await test.step('Agregar un pago real y verificar estado pagado', async () => {
      await page.getByPlaceholder(T.filterInvoices).fill(invoiceDocNo);
      const filteredInvoiceRow = page.locator('table tbody tr').filter({ hasText: invoiceDocNo }).first();
      await expect(filteredInvoiceRow).toBeVisible({ timeout: 15_000 });
      await expect(filteredInvoiceRow).toContainText(T.invoiceStatus.booked, { timeout: 15_000 });

      await filteredInvoiceRow.getByRole('button', { name: T.actions.openMenu }).click();
      await page.getByRole('menuitem', { name: T.actions.addPayment }).click();

      const paymentDialog = page.getByRole('dialog').filter({ hasText: T.paymentDialog.title });
      await expect(paymentDialog).toBeVisible();

      await paymentDialog.getByRole('checkbox', { name: T.paymentDialog.historical }).click();

      await paymentDialog.getByRole('combobox', { name: T.paymentDialog.method }).click();
      const methodOptions = page.getByRole('option');
      await expect(methodOptions.first()).toBeVisible({ timeout: 15_000 });
      await methodOptions.first().click();

      await paymentDialog.getByRole('button', { name: T.paymentDialog.submit }).click();
      await expect(paymentDialog).not.toBeVisible({ timeout: 20_000 });

      await expect(filteredInvoiceRow).toContainText(T.invoiceStatus.paid, { timeout: 20_000 });
    });
  });
});
