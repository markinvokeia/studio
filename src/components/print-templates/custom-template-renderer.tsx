'use client';

import { format } from 'date-fns';
import { useTranslations } from 'next-intl';
import { formatDisplayDate } from '@/lib/utils';
import { computeInvoiceTotals } from '@/components/print-templates/invoice-totals';
import { useClinicInfo } from '@/hooks/useClinicInfo';
import type { ClinicInfo } from '@/hooks/useClinicInfo';
import type { PrintData, PrintDocumentType, QuotePrintData, InvoicePrintData, PaymentPrintData, CreditNotePrintData, PrepaymentPrintData, FinancialSummaryPrintData, CajaAperturaPrintData, CajaCierrePrintData, CajaSesionPrintData, PayrollPeriodPrintData } from '@/stores/print-document-store';
import type { FinancialSummaryMovement, CajaSessionMovement, CajaSessionDetails, PayrollEntry } from '@/lib/types';
import { normalizePaymentMethodCode } from '@/lib/payment-methods';
import { getMonthName } from '@/components/payroll/payroll-utils';
import { PAYROLL_DETAIL_PRINT_COLUMNS, parsePayrollParams } from '@/components/payroll/payroll-detail-columns';

interface CustomTemplateRendererProps {
  html: string;
  data: PrintData;
  type: PrintDocumentType;
}

function fmt(amount: number | undefined, _currency: string): string {
  return Number(amount ?? 0).toLocaleString('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function buildItemsTable(
  items: Array<{ service_name: string; tooth_number?: number | null; quantity: number; unit_price: number; total: number }>,
  currency: string,
  includeTooth = false,
): string {
  const toothCol = includeTooth ? `<th style="text-align:center;width:4rem;">Diente</th>` : '';
  const rows = items.length === 0
    ? `<tr><td colspan="${includeTooth ? 6 : 5}" style="text-align:center;color:#9ca3af;padding:0.5rem;">Sin ítems</td></tr>`
    : items.map((item, idx) => {
        const toothCell = includeTooth ? `<td style="text-align:center;">${item.tooth_number ?? '—'}</td>` : '';
        return `<tr>
          <td>${idx + 1}</td><td>${item.service_name}</td>${toothCell}
          <td style="text-align:center;">${item.quantity}</td>
          <td style="text-align:right;">${currency} ${fmt(item.unit_price, currency)}</td>
          <td style="text-align:right;">${currency} ${fmt(item.total, currency)}</td>
        </tr>`;
      }).join('');
  return `<table class="print-template-table" style="width:100%;">
    <thead><tr>
      <th style="text-align:left;width:2rem;">#</th>
      <th style="text-align:left;">Servicio</th>
      ${toothCol}
      <th style="text-align:center;width:4rem;">Cant.</th>
      <th style="text-align:right;width:7rem;">P. Unit.</th>
      <th style="text-align:right;width:7rem;">Total</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function buildPaymentsTable(
  payments: Array<{ id: string; doc_no?: string | null; payment_doc_no?: string | null; payment_date?: string | null; payment_method?: string | null; method?: string | null; amount_applied?: number; source_currency?: string | null }>,
  currency: string,
): string {
  const rows = payments.length === 0
    ? `<tr><td colspan="4" style="text-align:center;color:#9ca3af;padding:0.5rem;">Sin pagos</td></tr>`
    : payments.map((p) => `<tr>
        <td style="font-family:monospace;font-size:0.75rem;">${p.doc_no || p.payment_doc_no || p.id}</td>
        <td>${formatDisplayDate(p.payment_date || '')}</td>
        <td>${p.payment_method || p.method || '—'}</td>
        <td style="text-align:right;">${p.source_currency || currency} ${fmt(p.amount_applied, p.source_currency || currency)}</td>
      </tr>`).join('');
  return `<table class="print-template-table" style="width:100%;">
    <thead><tr>
      <th style="text-align:left;">Nro. Doc.</th>
      <th style="text-align:left;">Fecha</th>
      <th style="text-align:left;">Método</th>
      <th style="text-align:right;">Monto</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function buildInvoicesSection(invoices: QuotePrintData['invoices'], currency: string): string {
  if (invoices.length === 0) return '';
  const blocks = invoices.map((inv) => {
    const invDocNo = inv.doc_no || inv.invoice_doc_no || inv.invoice_ref || inv.id;
    const invCurrency = inv.currency || currency;
    const { total: invTotal, paid: invPaid, pending: invPending } = computeInvoiceTotals(inv, inv.payments);
    const isCredit = inv.type?.toLowerCase().includes('credit');

    const itemsHtml = inv.items.length > 0
      ? `<table class="print-template-table" style="width:100%;margin-bottom:0.5rem;">
          <thead><tr>
            <th style="text-align:left;">Servicio</th>
            <th style="text-align:center;width:4rem;">Cant.</th>
            <th style="text-align:right;width:7rem;">P. Unit.</th>
            <th style="text-align:right;width:7rem;">Total</th>
          </tr></thead>
          <tbody>
            ${inv.items.map((item) => `<tr>
              <td>${item.service_name}</td>
              <td style="text-align:center;">${item.quantity}</td>
              <td style="text-align:right;">${invCurrency} ${fmt(item.unit_price, invCurrency)}</td>
              <td style="text-align:right;">${invCurrency} ${fmt(item.total, invCurrency)}</td>
            </tr>`).join('')}
          </tbody>
          <tfoot><tr style="border-top:1px solid #e5e7eb;font-size:0.75rem;color:#6b7280;">
            <td colspan="3" style="text-align:right;">Total</td>
            <td style="text-align:right;font-weight:600;">${invCurrency} ${fmt(invTotal, invCurrency)}</td>
          </tr></tfoot>
        </table>`
      : '';

    const paymentsHtml = inv.payments.length > 0
      ? `<p style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;font-weight:600;margin:0.5rem 0 0.25rem;">Pagos</p>
         <table class="print-template-table" style="width:100%;font-size:0.72rem;">
           <thead><tr>
             <th style="text-align:left;">Nro. Doc.</th>
             <th style="text-align:left;">Fecha</th>
             <th style="text-align:left;">Método</th>
             <th style="text-align:right;">Monto</th>
           </tr></thead>
           <tbody>
             ${inv.payments.map((p) => `<tr>
               <td style="font-family:monospace;">${p.doc_no || p.payment_doc_no || p.id}</td>
               <td>${formatDisplayDate(p.payment_date || '')}</td>
               <td>${p.payment_method || p.method || '—'}</td>
               <td style="text-align:right;">${p.source_currency || invCurrency} ${fmt(p.amount_applied, p.source_currency || invCurrency)}</td>
             </tr>`).join('')}
           </tbody>
           <tfoot>
             <tr style="border-top:1px solid #e5e7eb;font-size:0.72rem;font-weight:500;">
               <td colspan="3" style="text-align:right;">Pagado</td>
               <td style="text-align:right;">${invCurrency} ${fmt(invPaid, invCurrency)}</td>
             </tr>
             <tr style="font-size:0.72rem;font-weight:700;">
               <td colspan="3" style="text-align:right;">Pendiente</td>
               <td style="text-align:right;">${invCurrency} ${fmt(invPending, invCurrency)}</td>
             </tr>
           </tfoot>
         </table>`
      : '';

    return `<div style="margin-bottom:1.5rem;padding-left:0.75rem;border-left:2px solid #e5e7eb;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:0.5rem;font-size:0.85rem;">
        <span style="font-weight:600;">${isCredit ? 'Nota de Crédito' : 'Factura'} #${invDocNo}</span>
        <span style="font-size:0.75rem;color:#6b7280;">${formatDisplayDate(inv.createdAt)}</span>
      </div>
      ${itemsHtml}${paymentsHtml}
    </div>`;
  }).join('');

  return `<div style="margin-bottom:1.5rem;">
    <h2 style="font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;margin-bottom:0.5rem;">Facturas</h2>
    ${blocks}
  </div>`;
}

function buildMovementsTable(currency: string, movements: FinancialSummaryMovement[], finalBalance: number): string {
  const rows = movements.map((mov) => {
    const concept = [
      mov.metadata.label,
      mov.metadata.services?.length ? mov.metadata.services.join(', ') : null,
      mov.metadata.payment_type ?? null,
    ].filter(Boolean).join(' — ');
    const notes = mov.metadata.notes ? ` · ${mov.metadata.notes}` : '';
    const isDebit = mov.amount > 0;
    const amountStr = `${isDebit ? '' : '−'}${fmt(Math.abs(mov.amount), currency)}`;
    const balStr = `${mov.running_balance < 0 ? '−' : ''}${fmt(Math.abs(mov.running_balance), currency)}`;
    return `<tr>
      <td style="white-space:nowrap;">${formatDisplayDate(mov.created_at)}</td>
      <td style="font-family:monospace;font-size:0.72rem;">${mov.doc_no}</td>
      <td>${concept}${notes ? `<span style="color:#9ca3af;">${notes}</span>` : ''}</td>
      <td style="text-align:right;font-family:monospace;">${amountStr}</td>
      <td style="text-align:right;font-family:monospace;">${balStr}</td>
    </tr>`;
  }).join('');
  const finalStr = `${finalBalance < 0 ? '−' : ''}${fmt(Math.abs(finalBalance), currency)}`;
  return `<div style="margin-bottom:1.5rem;">
    <h2 style="font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;margin-bottom:0.5rem;">Moneda: ${currency}</h2>
    <div style="border:1px solid #e5e7eb;border-radius:4px;">
      <table class="print-template-table" style="width:100%;">
        <thead><tr>
          <th style="text-align:left;width:6rem;">Fecha</th>
          <th style="text-align:left;width:8rem;">Nro. Doc.</th>
          <th style="text-align:left;">Concepto</th>
          <th style="text-align:right;width:7rem;">Monto</th>
          <th style="text-align:right;width:7rem;">Saldo</th>
        </tr></thead>
        <tbody>${rows || `<tr><td colspan="5" style="text-align:center;color:#9ca3af;padding:0.5rem;">Sin movimientos</td></tr>`}</tbody>
        <tfoot><tr style="border-top:2px solid #d1d5db;">
          <td colspan="4" style="text-align:right;font-weight:600;">Saldo Final</td>
          <td style="text-align:right;font-weight:700;font-family:monospace;">${finalStr}</td>
        </tr></tfoot>
      </table>
    </div>
  </div>`;
}

const CAJA_METHOD_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  BANK_TRANSFER: 'Transferencia',
  CREDIT_CARD: 'Tarjeta crédito',
  DEBIT_CARD: 'Tarjeta débito',
  MOBILE_PAYMENT: 'Pago móvil',
  MERCADO_PAGO: 'Mercado Pago',
  PE: 'PE',
};

function buildOpeningAmountsTable(amounts: Array<{ currency: string; opening_amount: number }>): string {
  if (!amounts.length) return '<p style="color:#9ca3af;">Sin datos de apertura.</p>';
  const rows = amounts.map((a) => {
    const n = Number(a.opening_amount ?? 0);
    const val = n.toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `<tr><td style="font-weight:500;">${a.currency}</td><td style="text-align:right;font-weight:600;">${a.currency} ${val}</td></tr>`;
  }).join('');
  return `<table class="print-template-table" style="width:100%;">
    <thead><tr><th style="text-align:left;">Moneda</th><th style="text-align:right;">Monto apertura</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

type CurrencyData = NonNullable<CajaSessionDetails['currencies_data']>[number];

function buildCajaClosingSummaryTable(
  closingMovements: CurrencyData[],
  openingDetails: Record<string, Record<string, number>>,
): string {
  if (!closingMovements.length) return '<p style="color:#9ca3af;">Sin datos de cierre.</p>';
  const sections = closingMovements.map((mov) => {
    const openingAmount = openingDetails[mov.currency.toLowerCase()]?.total ?? 0;
    const variance = Number(mov.declared_cash) - Number(mov.calculated_cash);
    const fmtVal = (v: number) => v.toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const varianceColor = variance < 0 ? '#dc2626' : '#16a34a';
    return `<div style="margin-bottom:1.25rem;">
      <p style="font-size:0.75rem;font-weight:600;text-transform:uppercase;color:#6b7280;margin-bottom:0.25rem;">${mov.currency}</p>
      <table class="print-template-table" style="width:100%;">
        <tbody>
          <tr><td style="color:#6b7280;">Monto apertura</td><td style="text-align:right;">${mov.currency} ${fmtVal(openingAmount)}</td></tr>
          <tr><td style="color:#6b7280;">Efectivo declarado</td><td style="text-align:right;">${mov.currency} ${fmtVal(Number(mov.declared_cash))}</td></tr>
          <tr><td style="color:#6b7280;">Efectivo sistema</td><td style="text-align:right;">${mov.currency} ${fmtVal(Number(mov.calculated_cash))}</td></tr>
          <tr><td style="color:#6b7280;">Diferencia</td><td style="text-align:right;font-weight:600;color:${varianceColor};">${mov.currency} ${fmtVal(variance)}</td></tr>
          <tr><td style="color:#6b7280;">Tarjeta (sistema)</td><td style="text-align:right;">${mov.currency} ${fmtVal(Number(mov.calculated_card))}</td></tr>
          <tr><td style="color:#6b7280;">Transferencia (sistema)</td><td style="text-align:right;">${mov.currency} ${fmtVal(Number(mov.calculated_transfer))}</td></tr>
          <tr><td style="color:#6b7280;">Otros (sistema)</td><td style="text-align:right;">${mov.currency} ${fmtVal(Number(mov.calculated_other))}</td></tr>
        </tbody>
      </table>
    </div>`;
  }).join('');
  return sections;
}

function buildCajaMovementsTable(movements: CajaSessionMovement[]): string {
  const currencies = [...new Set(movements.map((m) => m.currency))].sort((a, b) =>
    a === 'UYU' ? -1 : b === 'UYU' ? 1 : a.localeCompare(b)
  );
  if (!currencies.length) return '<p style="color:#9ca3af;text-align:center;padding:0.5rem;">Sin movimientos registrados.</p>';

  return currencies.map((currency) => {
    const mMovs = movements.filter((m) => m.currency === currency);
    const totalIngresos = mMovs.filter((m) => m.amount > 0).reduce((s, m) => s + m.amount, 0);
    const totalEgresos = mMovs.filter((m) => m.amount < 0).reduce((s, m) => s + Math.abs(m.amount), 0);
    const fmtVal = (v: number) => v.toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const rows = mMovs.map((mov) => {
      const isEgreso = mov.amount < 0;
      const color = isEgreso ? 'color:#dc2626;' : '';
      return `<tr>
        <td style="font-size:0.75rem;white-space:nowrap;">${formatDisplayDate(mov.created_at)}</td>
        <td style="font-size:0.75rem;">${mov.payment_method_name || '—'}</td>
        <td style="font-size:0.75rem;">${mov.description || '—'}</td>
        <td style="font-size:0.75rem;color:#6b7280;">${mov.registered_by_user || '—'}</td>
        <td style="text-align:right;font-size:0.75rem;font-weight:500;${color}">${isEgreso ? '−' : ''}${currency} ${fmtVal(Math.abs(mov.amount))}</td>
      </tr>`;
    }).join('');

    return `<div style="margin-bottom:1.5rem;">
      <p style="font-size:0.75rem;font-weight:600;text-transform:uppercase;color:#6b7280;margin-bottom:0.25rem;">${currency}</p>
      <table class="print-template-table" style="width:100%;">
        <thead><tr>
          <th style="text-align:left;width:6rem;">Fecha</th>
          <th style="text-align:left;">Método</th>
          <th style="text-align:left;">Descripción</th>
          <th style="text-align:left;">Registrado por</th>
          <th style="text-align:right;width:8rem;">Monto</th>
        </tr></thead>
        <tbody>${rows || `<tr><td colspan="5" style="text-align:center;color:#9ca3af;padding:0.5rem;">Sin movimientos</td></tr>`}</tbody>
        <tfoot>
          <tr style="border-top:1px solid #d1d5db;">
            <td colspan="4" style="text-align:right;font-size:0.75rem;color:#6b7280;">Total ingresos</td>
            <td style="text-align:right;font-size:0.75rem;font-weight:600;color:#16a34a;">${currency} ${fmtVal(totalIngresos)}</td>
          </tr>
          <tr>
            <td colspan="4" style="text-align:right;font-size:0.75rem;color:#6b7280;">Total egresos</td>
            <td style="text-align:right;font-size:0.75rem;font-weight:600;color:#dc2626;">−${currency} ${fmtVal(totalEgresos)}</td>
          </tr>
          <tr style="border-top:2px solid #d1d5db;">
            <td colspan="4" style="text-align:right;font-size:0.75rem;font-weight:700;">Neto</td>
            <td style="text-align:right;font-size:0.75rem;font-weight:700;">${currency} ${fmtVal(totalIngresos - totalEgresos)}</td>
          </tr>
        </tfoot>
      </table>
    </div>`;
  }).join('');
}

function buildClinicValues(clinic: ClinicInfo | null): Record<string, string> {
  const phone = clinic?.phone || '';
  const email = clinic?.email || '';
  const sep = phone && email ? ' | ' : '';
  return {
    clinic_name:           clinic?.name || '',
    clinic_logo:           clinic?.logoUrl || '',
    clinic_address:        clinic?.address || '',
    clinic_phone:          phone,
    clinic_email:          email,
    clinic_phone_email_sep: sep,
  };
}

type Translator = ReturnType<typeof useTranslations>;

// ── Payroll period table builders (tokens for the editable payroll template) ───
function payrollSum(entries: PayrollEntry[], f: keyof PayrollEntry): number {
  return entries.reduce((s, e) => s + Number((e[f] as number) ?? 0), 0);
}

function buildPayrollSummaryTable(entries: PayrollEntry[], t: Translator): string {
  const tt = (k: string) => t(`payrollPeriod.${k}`);
  const row = (label: string, f: keyof PayrollEntry, strong = false) =>
    `<tr${strong ? ' style="font-weight:700;"' : ''}><td>${label}</td><td style="text-align:right;">$ ${fmt(payrollSum(entries, f), 'UYU')}</td></tr>`;
  return `<table class="print-template-table" style="width:100%;"><tbody>
    ${row(tt('gross'), 'gross_salary')}
    ${row(tt('bpsEmployee'), 'bps_employee')}
    ${row(tt('fonasaEmployee'), 'fonasa_employee')}
    ${row(tt('frlEmployee'), 'frl_employee')}
    ${row(tt('irpf'), 'irpf_withholding')}
    ${row(tt('other'), 'other_deductions')}
    ${row(tt('totalDeductions'), 'total_deductions')}
    ${row(tt('net'), 'net_salary', true)}
    ${row(tt('bpsEmployer'), 'bps_employer')}
    ${row(tt('fonasaEmployer'), 'fonasa_employer')}
    ${row(tt('frlEmployer'), 'frl_employer')}
    ${row(tt('fgcl'), 'fgcl_employer')}
    ${row(tt('bse'), 'bse_employer')}
    ${row(tt('aguinaldo'), 'aguinaldo_provision')}
    ${row(tt('vacation'), 'vacation_provision')}
    ${row(tt('employerCost'), 'total_employer_cost', true)}
  </tbody></table>`;
}

function buildPayrollAnnexTable(entries: PayrollEntry[], t: Translator): string {
  const tt = (k: string) => t(`payrollPeriod.${k}`);
  const cols: Array<[string, keyof PayrollEntry]> = [
    [tt('gross'), 'gross_salary'], [tt('bpsEmployee'), 'bps_employee'], [tt('fonasaEmployee'), 'fonasa_employee'],
    [tt('frlEmployee'), 'frl_employee'], [tt('irpf'), 'irpf_withholding'], [tt('other'), 'other_deductions'],
    [tt('totalDeductions'), 'total_deductions'], [tt('net'), 'net_salary'], [tt('employerCost'), 'total_employer_cost'],
  ];
  const head = `<th style="text-align:left;">${tt('employee')}</th><th style="text-align:right;">${tt('colSessions')}</th>${cols.map(([l]) => `<th style="text-align:right;">${l}</th>`).join('')}`;
  const rows = entries.map((e) =>
    `<tr><td>${e.doctor_name ?? ''}</td><td style="text-align:right;">${e.sessions_count ?? 0}</td>${cols.map(([, f]) => `<td style="text-align:right;">$ ${fmt(Number(e[f] ?? 0), 'UYU')}</td>`).join('')}</tr>`).join('');
  return `<table class="print-template-table" style="width:100%;font-size:0.7rem;"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
}

function buildPayrollAnnex2Table(entries: PayrollEntry[], t: Translator): string {
  const cols = PAYROLL_DETAIL_PRINT_COLUMNS();
  const head = cols.map((c) =>
    `<th style="text-align:${c.labelKey === 'employee' ? 'left' : 'right'};">${t(`payrollPeriod.${c.labelKey}`)}</th>`).join('');
  const rows = entries.map((e) => {
    const cp = parsePayrollParams(e.calculation_params);
    return `<tr>${cols.map((c) => {
      const v = c.get(e, cp);
      const display = c.currency ? `$ ${fmt(Number(v), 'UYU')}`
        : c.rate ? `${(Number(v) * 100).toFixed(2)}%`
        : String(v);
      return `<td style="text-align:${c.labelKey === 'employee' ? 'left' : 'right'};">${display}</td>`;
    }).join('')}</tr>`;
  }).join('');
  return `<table class="print-template-table" style="width:100%;font-size:0.6rem;"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
}

/** Translates a status code (e.g. "booked", "unpaid") to its label, falling back to the raw value. */
function translateStatus(t: Translator, namespace: string, value: string | undefined | null): string {
  if (!value) return '';
  const key = `${namespace}.${value}`;
  return t.has(key) ? t(key) : value;
}

function substituteVariables(html: string, data: PrintData, type: PrintDocumentType, clinic: ClinicInfo | null, t: Translator): string {
  const values: Record<string, string> = {
    ...buildClinicValues(clinic),
    generated_at: format(new Date(), 'dd/MM/yyyy HH:mm'),
  };

  if (type === 'invoice') {
    const d = data as InvoicePrintData;
    const { invoice, items, payments } = d;
    const currency = invoice.currency || 'UYU';
    const { total, paid, pending, paymentStatus } = computeInvoiceTotals(invoice, payments);
    Object.assign(values, {
      doc_no: invoice.doc_no || invoice.invoice_doc_no || invoice.invoice_ref || invoice.id,
      date: formatDisplayDate(invoice.createdAt),
      due_date: invoice.due_date ? formatDisplayDate(invoice.due_date) : '',
      status: translateStatus(t, 'invoiceStatus', invoice.status),
      payment_status: translateStatus(t, 'paymentStatusLabels', paymentStatus),
      currency,
      patient_name: invoice.user_name || '—',
      reference: invoice.quote_doc_no || '',
      total: fmt(total, currency),
      paid: fmt(paid, currency),
      pending: fmt(pending, currency),
      notes: invoice.notes ? `<p style="color:#6b7280;font-weight:500;margin-bottom:0.25rem;">Notas</p><p>${invoice.notes}</p>` : '',
      items_table: buildItemsTable(items, currency),
      payments_table: buildPaymentsTable(payments, currency),
    });
  } else if (type === 'quote') {
    const d = data as QuotePrintData;
    const { quote, items, invoices } = d;
    const currency = quote.currency || 'UYU';
    const total = Number(quote.total || 0);
    const amountInvoiced = Number(quote.amount_invoiced ?? 0);
    const pendingInvoice = Number(quote.amount_pending_invoice ?? Math.max(total - amountInvoiced, 0));
    const amountPaid = Number(quote.amount_paid ?? 0);
    const pendingPayment = Number(quote.amount_pending_payment ?? Math.max(amountInvoiced - amountPaid, 0));
    Object.assign(values, {
      doc_no: quote.doc_no || quote.quote_doc_no || quote.id,
      date: formatDisplayDate(quote.createdAt),
      status: translateStatus(t, 'quoteStatus', quote.status),
      payment_status: translateStatus(t, 'paymentStatusLabels', quote.payment_status),
      currency,
      patient_name: quote.user_name || '—',
      total: fmt(total, currency),
      amount_invoiced: fmt(amountInvoiced, currency),
      pending_invoice: fmt(pendingInvoice, currency),
      amount_paid: fmt(amountPaid, currency),
      pending_payment: fmt(pendingPayment, currency),
      notes: quote.notes ? `<p style="color:#6b7280;font-weight:500;margin-bottom:0.25rem;">Notas</p><p>${quote.notes}</p>` : '',
      items_table: buildItemsTable(items, currency, true),
      invoices_section: buildInvoicesSection(invoices, currency),
    });
  } else if (type === 'payment') {
    const d = data as PaymentPrintData;
    const { payment } = d;
    const currency = payment.source_currency || 'UYU';
    Object.assign(values, {
      doc_no: payment.doc_no || payment.payment_doc_no || payment.id,
      date: formatDisplayDate(payment.payment_date || payment.createdAt),
      currency,
      patient_name: payment.user_name || '—',
      method: payment.payment_method || payment.method || '—',
      transaction_type: translateStatus(t, 'transactionType', payment.transaction_type),
      reference: payment.invoice_doc_no || '',
      exchange_rate: payment.exchange_rate && payment.exchange_rate !== 1 ? String(payment.exchange_rate) : '—',
      amount: fmt(payment.source_amount || payment.amount_applied || 0, currency),
      notes: payment.notes ? `<p style="color:#6b7280;font-weight:500;margin-bottom:0.25rem;">${t('notes')}</p><p>${payment.notes}</p>` : '',
    });
  } else if (type === 'credit_note') {
    const d = data as CreditNotePrintData;
    const { creditNote, items, originalInvoice } = d;
    const currency = creditNote.currency || 'UYU';
    const total = Number(creditNote.total || 0);
    Object.assign(values, {
      doc_no: creditNote.doc_no || creditNote.invoice_doc_no || creditNote.id,
      date: formatDisplayDate(creditNote.createdAt),
      currency,
      patient_name: creditNote.user_name || '—',
      original_invoice: originalInvoice
        ? (originalInvoice.doc_no || originalInvoice.invoice_doc_no || originalInvoice.invoice_ref || originalInvoice.id)
        : '',
      reference: creditNote.quote_doc_no || '',
      total: fmt(total, currency),
      notes: creditNote.notes ? `<p style="color:#6b7280;font-weight:500;margin-bottom:0.25rem;">Notas</p><p>${creditNote.notes}</p>` : '',
      items_table: buildItemsTable(items, currency),
    });
  } else if (type === 'prepayment') {
    const d = data as PrepaymentPrintData;
    const { prepayment } = d;
    const currency = prepayment.source_currency || 'UYU';
    const amount = Number(prepayment.source_amount || prepayment.amount_applied || 0);
    Object.assign(values, {
      doc_no: prepayment.doc_no || prepayment.payment_doc_no || prepayment.id,
      date: formatDisplayDate(prepayment.payment_date || prepayment.createdAt),
      currency,
      patient_name: prepayment.user_name || '—',
      method: prepayment.payment_method || prepayment.method || '—',
      exchange_rate: prepayment.exchange_rate && prepayment.exchange_rate !== 1 ? String(prepayment.exchange_rate) : '—',
      amount: fmt(amount, currency),
      notes: prepayment.notes ? `<p style="color:#6b7280;font-weight:500;margin-bottom:0.25rem;">${t('notes')}</p><p>${prepayment.notes}</p>` : '',
    });
  } else if (type === 'caja_apertura') {
    const d = data as CajaAperturaPrintData;
    const { details } = d;
    const openingDetails = details.opening_details ?? {};
    const amounts = (details.currencies_data ?? []).map((cd) => ({ currency: cd.currency, opening_amount: cd.opening_amount }));
    Object.assign(values, {
      session_id:            String(details.id),
      cashier_name:          details.user_name || (openingDetails as any).opened_by || '—',
      opening_date:          details.opened_at ? format(new Date(details.opened_at), 'dd/MM/yyyy HH:mm') : '—',
      cash_point_name:       details.cash_point_name || '—',
      opening_amounts_table: buildOpeningAmountsTable(amounts),
    });
  } else if (type === 'caja_cierre') {
    const d = data as CajaCierrePrintData;
    const { details } = d;
    const openingDetails = details.opening_details ?? {};
    Object.assign(values, {
      session_id:            String(details.id),
      cashier_name:          details.user_name || (openingDetails as any).opened_by || '—',
      opening_date:          details.opened_at ? format(new Date(details.opened_at), 'dd/MM/yyyy HH:mm') : '—',
      closing_date:          details.closed_at ? format(new Date(details.closed_at), 'dd/MM/yyyy HH:mm') : '—',
      cash_point_name:       details.cash_point_name || '—',
      closing_notes:         (details as any).closing_notes || '',
      closing_summary_table: buildCajaClosingSummaryTable(details.currencies_data ?? [], openingDetails as Record<string, Record<string, number>>),
    });
  } else if (type === 'caja_sesion') {
    const d = data as CajaSesionPrintData;
    const { details } = d;
    Object.assign(values, {
      session_id:      String(details.id),
      cashier_name:    details.user_name || '—',
      opening_date:    details.opened_at ? format(new Date(details.opened_at), 'dd/MM/yyyy HH:mm') : '—',
      closing_date:    details.closed_at ? format(new Date(details.closed_at), 'dd/MM/yyyy HH:mm') : '—',
      cash_point_name: details.cash_point_name || '—',
      movements_table: buildCajaMovementsTable(details.movements_data ?? []),
    });
  } else if (type === 'financial_summary') {
    const d = data as FinancialSummaryPrintData;
    const { report, dateRange } = d;
    const dateFrom = report.report_start_date ?? dateRange?.from ?? null;
    const dateTo   = report.report_end_date   ?? dateRange?.to   ?? null;
    const currencies = Object.keys(report.history_by_currency).sort((a, b) =>
      a === 'UYU' ? -1 : b === 'UYU' ? 1 : a.localeCompare(b)
    );
    const movementsTable = currencies
      .map((cur) => {
        const section = report.history_by_currency[cur];
        if (!section) return '';
        return buildMovementsTable(cur, section.movements, section.final_balance);
      })
      .join('');
    Object.assign(values, {
      patient_name:  report.name || '—',
      patient_id:    report.identity_document || '',
      patient_email: report.email || '',
      patient_phone: report.phone_number || '',
      date_from:     dateFrom ? formatDisplayDate(dateFrom) : '',
      date_to:       dateTo   ? formatDisplayDate(dateTo)   : '',
      movements_table: movementsTable,
    });
  } else if (type === 'payroll_period') {
    const d = data as PayrollPeriodPrintData;
    const { period, entries } = d;
    const statusKey = `payrollPeriod.statusLabels.${period.status}`;
    Object.assign(values, {
      period_label:  `${getMonthName(period.period_month)} ${period.period_year}`,
      status:        t.has(statusKey) ? t(statusKey) : period.status,
      summary_table: buildPayrollSummaryTable(entries, t),
      annex_table:   buildPayrollAnnexTable(entries, t),
      annex2_table:  buildPayrollAnnex2Table(entries, t),
    });
  }

  return html.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] ?? '');
}

export function CustomTemplateRenderer({ html, data, type }: CustomTemplateRendererProps) {
  const clinic = useClinicInfo();
  const t = useTranslations('PrintTemplates');
  const substituted = substituteVariables(html, data, type, clinic, t);
  return (
    <div
      className="print-template-root"
      dangerouslySetInnerHTML={{ __html: substituted }}
    />
  );
}
