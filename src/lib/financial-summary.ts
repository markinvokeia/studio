import type { FinancialSummaryMovement, FinancialSummaryReport, Invoice, StatementEntry } from '@/lib/types';

/**
 * Build the human-readable concept line for a financial-summary movement:
 * `label — services — payment type — "Paga Factura X, Y"`. Shared by the print
 * template and the interactive account-statement timeline so both stay in sync.
 * `paysInvoiceLabel` is the already-translated prefix (e.g. "Paga Factura").
 */
export function buildMovementConcept(
  mov: FinancialSummaryMovement,
  paysInvoiceLabel: string,
): string {
  // Invoices a payment is applied to → show their references in the concept.
  const paidInvoices = mov.document_type === 'payment'
    ? (mov.metadata.target_invoices?.length ? mov.metadata.target_invoices : mov.metadata.applied_to)
    : undefined;

  return [
    mov.metadata.label,
    mov.metadata.services?.length ? mov.metadata.services.join(', ') : null,
    mov.metadata.payment_type ?? null,
    paidInvoices?.length ? `${paysInvoiceLabel} ${paidInvoices.join(', ')}` : null,
  ].filter(Boolean).join(' — ');
}

const normKey = (v: unknown) => String(v ?? '').trim().toLowerCase();

/** Round to 2 decimals, avoiding float drift when comparing against `pending`. */
function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Turn the per-currency financial summary into timeline entries, joining each
 * invoice movement to its USER_INVOICES record (by doc_no / id) so we can show
 * the outstanding amount and mark it as a collectable candidate.
 */
export function buildStatementEntries(
  report: FinancialSummaryReport,
  invoices: Invoice[],
  paysInvoiceLabel: string,
): Record<string, StatementEntry[]> {
  const byKey = new Map<string, Invoice>();
  for (const inv of invoices) {
    for (const key of [inv.doc_no, (inv as { invoice_doc_no?: string }).invoice_doc_no, inv.id]) {
      const k = normKey(key);
      if (k && !byKey.has(k)) byKey.set(k, inv);
    }
  }

  const result: Record<string, StatementEntry[]> = {};
  for (const [currency, section] of Object.entries(report.history_by_currency)) {
    result[currency] = section.movements.map((mov, idx) => {
      const entry: StatementEntry = {
        // index keeps the key unique even if internal_id repeats across movements.
        id: `${currency}-${idx}-${mov.internal_id}-${mov.document_type}`,
        kind: mov.document_type,
        date: mov.created_at,
        docNo: mov.doc_no,
        concept: buildMovementConcept(mov, paysInvoiceLabel),
        notes: mov.metadata.notes,
        amount: mov.amount,
        currency,
        runningBalance: mov.running_balance,
      };

      if (mov.document_type === 'invoice') {
        const inv = byKey.get(normKey(mov.doc_no));
        if (inv) {
          const total = inv.total ?? mov.amount;
          const paid = inv.paid_amount ?? 0;
          entry.invoiceId = inv.id;
          entry.pending = Math.max(0, round2(total - paid));
          entry.paymentStatus = inv.payment_status;
        }
      }
      return entry;
    });
  }
  return result;
}

/** True when any entry across all currencies is a collectable invoice (pending > 0). */
export function hasCollectableDebt(entriesByCurrency: Record<string, StatementEntry[]>): boolean {
  return Object.values(entriesByCurrency).some((entries) =>
    entries.some((e) => e.kind === 'invoice' && (e.pending ?? 0) > 0 && e.invoiceId),
  );
}
