'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { api } from '@/services/api';
import { API_ROUTES } from '@/constants/routes';
import { buildStatementEntries, hasCollectableDebt } from '@/lib/financial-summary';
import type { FinancialSummaryReport, Invoice, StatementEntry } from '@/lib/types';

type Status = 'idle' | 'loading' | 'empty' | 'error';

/** Lean normalization of USER_INVOICES → the fields the statement needs. */
function normalizeInvoices(data: unknown, userId: string): Invoice[] {
  const arr = Array.isArray(data) ? data : ((data as any)?.invoices || (data as any)?.data || []);
  return (arr as any[]).map((d) => ({
    id: String(d.id),
    doc_no: d.doc_no || null,
    invoice_doc_no: d.invoice_doc_no || undefined,
    user_id: String(d.user_id ?? userId),
    total: parseFloat(d.total) || 0,
    payment_status: d.payment_state || d.payment_status,
    currency: d.currency || 'USD',
    paid_amount: d.paid_amount != null ? parseFloat(d.paid_amount) : undefined,
    type: d.type || 'invoice',
  })) as Invoice[];
}

/**
 * Fetches the patient's financial summary (timeline movements per currency) and
 * their invoices (for per-invoice outstanding amounts), joining them into
 * collectable timeline entries. Exposes `refresh()` to re-fetch after a
 * collect/add-debt action.
 */
export function useAccountStatementData(userId: string | null, isOpen: boolean) {
  const t = useTranslations('AccountStatement');
  const paysInvoiceLabel = t('paysInvoice');

  const [report, setReport] = React.useState<FinancialSummaryReport | null>(null);
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [status, setStatus] = React.useState<Status>('idle');

  const refresh = React.useCallback(async () => {
    if (!userId) return;
    setStatus('loading');
    try {
      const [rawReport, rawInvoices] = await Promise.all([
        api.get(API_ROUTES.USER_FINANCIAL_SUMMARY_PRINT, { user_id: userId }),
        api.get(API_ROUTES.USER_INVOICES, { user_id: userId }).catch(() => []),
      ]);
      const rep = (Array.isArray(rawReport) ? rawReport[0] : rawReport) as FinancialSummaryReport | undefined;
      if (!rep?.history_by_currency || Object.keys(rep.history_by_currency).length === 0) {
        setReport(null);
        setInvoices([]);
        setStatus('empty');
        return;
      }
      setReport(rep);
      setInvoices(normalizeInvoices(rawInvoices, userId));
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }, [userId]);

  React.useEffect(() => {
    if (!isOpen || !userId) return;
    setReport(null);
    setInvoices([]);
    void refresh();
  }, [isOpen, userId, refresh]);

  const entriesByCurrency = React.useMemo<Record<string, StatementEntry[]>>(
    () => (report ? buildStatementEntries(report, invoices, paysInvoiceLabel) : {}),
    [report, invoices, paysInvoiceLabel],
  );

  const hasDebt = React.useMemo(() => hasCollectableDebt(entriesByCurrency), [entriesByCurrency]);

  return { status, report, entriesByCurrency, hasDebt, refresh };
}
