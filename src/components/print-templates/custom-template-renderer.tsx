'use client';

import { format } from 'date-fns';
import { formatDisplayDate } from '@/lib/utils';
import { useClinicInfo } from '@/hooks/useClinicInfo';
import type { ClinicInfo } from '@/hooks/useClinicInfo';
import type { PrintData, PrintDocumentType, QuotePrintData, InvoicePrintData, PaymentPrintData, CreditNotePrintData, PrepaymentPrintData, FinancialSummaryPrintData } from '@/stores/print-document-store';
import type { FinancialSummaryMovement } from '@/lib/types';

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
    const invTotal = Number(inv.total || 0);
    const invPaid = Number(inv.paid_amount || 0);
    const invPending = Math.max(invTotal - invPaid, 0);
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
    const amountStr = `${isDebit ? '' : '−'}${currency} ${fmt(Math.abs(mov.amount), currency)}`;
    const balStr = `${mov.running_balance < 0 ? '−' : ''}${currency} ${fmt(Math.abs(mov.running_balance), currency)}`;
    return `<tr>
      <td style="white-space:nowrap;">${formatDisplayDate(mov.created_at)}</td>
      <td style="font-family:monospace;font-size:0.72rem;">${mov.doc_no}</td>
      <td>${concept}${notes ? `<span style="color:#9ca3af;">${notes}</span>` : ''}</td>
      <td style="text-align:right;font-family:monospace;">${amountStr}</td>
      <td style="text-align:right;font-family:monospace;">${balStr}</td>
    </tr>`;
  }).join('');
  const finalStr = `${finalBalance < 0 ? '−' : ''}${currency} ${fmt(Math.abs(finalBalance), currency)}`;
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

function substituteVariables(html: string, data: PrintData, type: PrintDocumentType, clinic: ClinicInfo | null): string {
  const values: Record<string, string> = {
    ...buildClinicValues(clinic),
    generated_at: format(new Date(), 'dd/MM/yyyy HH:mm'),
  };

  if (type === 'invoice') {
    const d = data as InvoicePrintData;
    const { invoice, items, payments } = d;
    const currency = invoice.currency || 'UYU';
    const total = Number(invoice.total || 0);
    const paid = Number(invoice.paid_amount || 0);
    Object.assign(values, {
      doc_no: invoice.doc_no || invoice.invoice_doc_no || invoice.invoice_ref || invoice.id,
      date: formatDisplayDate(invoice.createdAt),
      due_date: invoice.due_date ? formatDisplayDate(invoice.due_date) : '',
      status: invoice.status || '',
      payment_status: invoice.payment_status || '',
      currency,
      patient_name: invoice.user_name || '—',
      reference: invoice.quote_doc_no || '',
      total: fmt(total, currency),
      paid: fmt(paid, currency),
      pending: fmt(Math.max(total - paid, 0), currency),
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
      status: quote.status || '',
      payment_status: quote.payment_status || '',
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
      transaction_type: payment.transaction_type || '',
      reference: payment.invoice_doc_no || '',
      exchange_rate: payment.exchange_rate && payment.exchange_rate !== 1 ? String(payment.exchange_rate) : '—',
      amount: fmt(payment.source_amount || payment.amount_applied || 0, currency),
      notes: '',
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
      notes: '',
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
  }

  return html.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] ?? '');
}

export function CustomTemplateRenderer({ html, data, type }: CustomTemplateRendererProps) {
  const clinic = useClinicInfo();
  const substituted = substituteVariables(html, data, type, clinic);
  return (
    <div
      className="print-template-root"
      dangerouslySetInnerHTML={{ __html: substituted }}
    />
  );
}
