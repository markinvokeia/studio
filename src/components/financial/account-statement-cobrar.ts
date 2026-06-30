'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useCashSessionValidation } from '@/hooks/use-cash-session-validation';
import { api } from '@/services/api';
import { API_ROUTES } from '@/constants/routes';
import { toLocalISOString } from '@/lib/utils';
import type { CobrarLineState, StatementEntry } from '@/lib/types';

interface SaveContext {
  userId: string;
  userName?: string;
  email?: string;
}

/**
 * Quick "Cobrar" (settle) flow: select unpaid invoices of a single currency, set
 * an amount (≤ pending) and a payment method per line (or a shared one), then POST
 * one payment per line to SALES.INVOICE_PAYMENT. Reuses cash-session validation.
 */
export function useCobrarFlow(paymentMethods: { id: string; name: string }[], onSaved: () => void) {
  const t = useTranslations('AccountStatement');
  const { user, checkActiveSession } = useAuth();
  const { toast } = useToast();
  const { validateActiveSession, showCashSessionError } = useCashSessionValidation();

  const [activeCurrency, setActiveCurrency] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<Record<string, CobrarLineState>>({});
  const [sharedMethodId, setSharedMethodId] = React.useState<string>('');
  const [isSaving, setIsSaving] = React.useState(false);
  const [progress, setProgress] = React.useState<{ current: number; total: number } | null>(null);

  // Default the shared method to the first available method.
  React.useEffect(() => {
    if (!sharedMethodId && paymentMethods.length) setSharedMethodId(paymentMethods[0].id);
  }, [paymentMethods, sharedMethodId]);

  const start = React.useCallback((currency: string) => {
    setActiveCurrency(currency);
    setSelected({});
  }, []);

  const cancel = React.useCallback(() => {
    setActiveCurrency(null);
    setSelected({});
  }, []);

  const toggle = React.useCallback((entry: StatementEntry) => {
    if (!entry.invoiceId) return;
    const invoiceId = entry.invoiceId;
    setSelected((prev) => {
      const next = { ...prev };
      if (next[invoiceId]) {
        delete next[invoiceId];
      } else {
        next[invoiceId] = {
          invoiceId,
          docNo: entry.docNo,
          currency: entry.currency,
          pending: entry.pending ?? 0,
          amount: entry.pending ?? 0,
        };
      }
      return next;
    });
  }, []);

  const updateLine = React.useCallback((invoiceId: string, patch: Partial<CobrarLineState>) => {
    setSelected((prev) => (prev[invoiceId] ? { ...prev, [invoiceId]: { ...prev[invoiceId], ...patch } } : prev));
  }, []);

  /** Select every collectable invoice line at once (full pending amount each). */
  const selectAll = React.useCallback((entries: StatementEntry[]) => {
    setSelected(() => {
      const next: Record<string, CobrarLineState> = {};
      for (const e of entries) {
        if (e.invoiceId && (e.pending ?? 0) > 0) {
          next[e.invoiceId] = {
            invoiceId: e.invoiceId,
            docNo: e.docNo,
            currency: e.currency,
            pending: e.pending ?? 0,
            amount: e.pending ?? 0,
          };
        }
      }
      return next;
    });
  }, []);

  const clearAll = React.useCallback(() => setSelected({}), []);

  const lines = React.useMemo(() => Object.values(selected), [selected]);
  const totalToCollect = React.useMemo(() => lines.reduce((s, l) => s + (l.amount || 0), 0), [lines]);

  const save = React.useCallback(async (ctx: SaveContext) => {
    if (lines.length === 0) {
      toast({ variant: 'destructive', title: t('noSelection') });
      return;
    }
    if (lines.some((l) => l.amount <= 0 || l.amount > l.pending + 0.01)) {
      toast({ variant: 'destructive', title: t('overpayError') });
      return;
    }

    const validation = await validateActiveSession();
    if (!validation.isValid) {
      showCashSessionError(validation.error);
      return;
    }
    const sessionId = validation.sessionId || null;

    setIsSaving(true);
    const failed: string[] = [];
    // Only post lines with a positive amount; round to 2 decimals so float drift
    // never produces a tiny (or negative-zero) payment in the statement.
    const payable = lines
      .map((l) => ({ ...l, amount: Math.round(l.amount * 100) / 100 }))
      .filter((l) => l.amount > 0);
    for (let i = 0; i < payable.length; i++) {
      const line = payable[i];
      setProgress({ current: i + 1, total: payable.length });
      const methodId = line.methodId || sharedMethodId;
      const method = paymentMethods.find((m) => m.id === methodId);
      try {
        const res = await api.post(API_ROUTES.SALES.INVOICE_PAYMENT, {
          cash_session_id: sessionId,
          user,
          client_user: { id: ctx.userId, name: ctx.userName || '', email: ctx.email || '' },
          credit_payment: [],
          query: {
            invoice_id: parseInt(line.invoiceId, 10),
            payment_date: toLocalISOString(new Date()),
            amount: line.amount,
            converted_amount: line.amount,
            method: method?.name || 'Cash',
            payment_method_id: methodId,
            status: 'completed',
            user_id: ctx.userId,
            invoice_currency: line.currency,
            payment_currency: line.currency,
            exchange_rate: 1,
            is_sales: true,
            total_paid: line.amount,
            notes: '',
            is_historical: false,
          },
        });
        if (res?.error || (res?.code && res.code >= 400)) throw new Error(res?.message || 'fail');
      } catch {
        failed.push(line.docNo);
      }
    }
    setProgress(null);
    setIsSaving(false);

    if (failed.length === 0) {
      toast({ title: t('collectSuccess') });
    } else {
      toast({ variant: 'destructive', title: t('collectPartialError', { failed: failed.join(', ') }) });
    }
    await checkActiveSession();
    cancel();
    onSaved();
  }, [lines, sharedMethodId, paymentMethods, user, validateActiveSession, showCashSessionError, checkActiveSession, toast, t, cancel, onSaved]);

  return {
    activeCurrency,
    selected,
    lines,
    totalToCollect,
    sharedMethodId,
    setSharedMethodId,
    isSaving,
    progress,
    start,
    cancel,
    toggle,
    updateLine,
    selectAll,
    clearAll,
    save,
  };
}
