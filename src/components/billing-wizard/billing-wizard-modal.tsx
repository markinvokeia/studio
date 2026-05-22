'use client';

import * as React from 'react';
import { Loader2, Zap } from 'lucide-react';

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { API_ROUTES } from '@/constants/routes';
import { useBillingWizard } from '@/stores/billing-wizard-store';
import { api } from '@/services/api';
import { sortQuoteItems, toLocalISOString } from '@/lib/utils';
import {
  calculateQuoteFinancialSummary,
  fetchQuoteInvoicesForFinancials,
  type QuoteFinancialSummary,
} from '@/services/quote-financials';
import type { Invoice, Quote, QuoteItem, User } from '@/lib/types';
import {
  linkInvoiceToAppointment,
  linkInvoiceToClinicSession,
  linkInvoiceToOdontogramSession,
} from '@/services/billing-links';

import { BillingWizardStepper, type WizardStep } from './wizard-stepper';
import { StepPatientSelect } from './steps/step-patient-select';
import { StepTreatment } from './steps/step-treatment';
import { StepInvoiceSelect } from './steps/step-invoice-select';
import { StepItemsEditor, type EditableItem } from './steps/step-items-editor';
import { StepPayment, type PaymentResult, type CreatedPayment } from './steps/step-payment';
import { StepConfirmation } from './steps/step-confirmation';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function loadQuoteItems(quoteId: string, isSales: boolean): Promise<QuoteItem[]> {
  try {
    const endpoint = isSales ? API_ROUTES.SALES.QUOTES_ITEMS : API_ROUTES.PURCHASES.QUOTES_ITEMS;
    const data = await api.get(endpoint, { quote_id: quoteId, is_sales: isSales ? 'true' : 'false' });
    const raw = Array.isArray(data) ? data : (data.items || data.data || data.result || []);
    return sortQuoteItems(
      raw.map((item: any) => ({
        id: item.id ? String(item.id) : '',
        service_id: String(item.service_id || ''),
        service_name: item.service_name || '',
        unit_price: Number(item.unit_price || 0),
        quantity: Number(item.quantity || 1),
        total: Number(item.total || 0),
        tooth_number: item.tooth_number ? Number(item.tooth_number) : undefined,
      })),
    );
  } catch {
    return [];
  }
}

async function loadOrderId(quoteId: string, isSales: boolean): Promise<string | null> {
  try {
    const endpoint = isSales ? API_ROUTES.SALES.QUOTES_ORDERS : API_ROUTES.PURCHASES.QUOTES_ORDERS;
    const data = await api.get(endpoint, { quote_id: quoteId, is_sales: isSales ? 'true' : 'false' });
    const raw = Array.isArray(data) ? data : (data.orders || data.data || data.result || []);
    const first = raw[0];
    return first?.id ? String(first.id) : null;
  } catch {
    return null;
  }
}

async function confirmQuote(quoteId: string, isSales: boolean): Promise<void> {
  const endpoint = isSales ? API_ROUTES.SALES.QUOTE_CONFIRM : API_ROUTES.PURCHASES.QUOTE_CONFIRM;
  await api.post(endpoint, { quote_id: quoteId, is_sales: isSales });
}

async function createInvoiceFromOrder(
  orderId: string,
  quote: Quote,
  items: QuoteItem[],
  isSales: boolean,
): Promise<void> {
  const endpoint = isSales ? API_ROUTES.SALES.ORDER_INVOICE : API_ROUTES.PURCHASES.ORDER_INVOICE;
  const billingItems = items
    .filter((item) => Number(item.total) > 0)
    .map((item) => ({
      quote_item_id: Number(item.id),
      service_id: Number(item.service_id),
      step_names: [],
      amount: Number(item.total),
    }));

  const billingQuery = {
    quote_id: Number(quote.id),
    user_id: quote.user_id,
    currency: quote.currency || 'UYU',
    invoice_date: toLocalISOString(new Date()),
    notes: '',
    items: billingItems,
  };

  const payload = {
    order_id: orderId,
    is_sales: isSales,
    query: JSON.stringify(billingQuery),
  };

  const response = await api.post(endpoint, payload);
  if (response?.error && response?.code >= 400) {
    throw new Error(response.message || 'Error al crear la factura');
  }
  if (Array.isArray(response) && response[0]?.code >= 400) {
    throw new Error(response[0]?.message || 'Error al crear la factura');
  }
}

async function fetchLatestUnpaidInvoice(quoteId: string, isSales: boolean): Promise<Invoice | null> {
  const invoices = await fetchQuoteInvoicesForFinancials(quoteId, isSales);
  const unpaid = invoices
    .filter((inv) => inv.type !== 'credit_note' && !['paid'].includes(inv.payment_status || ''))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return unpaid[0] || null;
}

async function fetchInvoiceById(invoiceId: string, userId: string): Promise<Invoice | null> {
  try {
    const data = await api.get(API_ROUTES.USER_INVOICES, { user_id: userId });
    const raw = Array.isArray(data) ? data : (data.invoices || data.data || []);
    const found = raw.find((inv: any) => String(inv.id) === invoiceId);
    if (!found) return null;
    return {
      id: String(found.id),
      invoice_ref: found.invoice_ref || '',
      doc_no: found.doc_no || found.invoice_doc_no || '',
      invoice_doc_no: found.invoice_doc_no || found.doc_no || '',
      order_id: String(found.order_id || ''),
      quote_id: String(found.quote_id || ''),
      user_id: String(found.user_id || ''),
      user_name: found.user_name || '',
      userEmail: found.user_email || found.userEmail || '',
      total: Number(found.total || 0),
      currency: found.currency || 'USD',
      status: found.status || 'draft',
      payment_status: found.payment_state || found.payment_status || 'unpaid',
      paid_amount: Number(found.paid_amount || 0),
      type: found.type || 'invoice',
      createdAt: found.created_at || found.createdAt || '',
      updatedAt: found.updated_at || found.updatedAt || '',
    };
  } catch {
    return null;
  }
}

async function fetchLatestInvoiceIdForUser(userId: string): Promise<string | null> {
  try {
    const data = await api.get(API_ROUTES.USER_INVOICES, { user_id: userId });
    const raw: any[] = Array.isArray(data) ? data : (data.invoices || data.data || []);
    if (raw.length === 0) return null;
    const latest = raw.reduce((best: any, cur: any) => {
      const bestId = Number(best?.id ?? 0);
      const curId = Number(cur?.id ?? 0);
      if (!isNaN(bestId) && !isNaN(curId)) return curId > bestId ? cur : best;
      const bestTs = new Date(best?.created_at || best?.createdAt || 0).getTime();
      const curTs = new Date(cur?.created_at || cur?.createdAt || 0).getTime();
      return curTs > bestTs ? cur : best;
    });
    return latest?.id ? String(latest.id) : null;
  } catch {
    return null;
  }
}

async function createDirectInvoice(
  patientId: string,
  items: EditableItem[],
  isSales: boolean,
  currency: string,
): Promise<Invoice> {
  const endpoint = isSales ? API_ROUTES.SALES.INVOICES_UPSERT : API_ROUTES.PURCHASES.INVOICES_UPSERT;
  const now = new Date();
  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + 30);
  const total = items.reduce((s, i) => s + i.total, 0);
  const payload = {
    user_id: patientId,
    type: 'invoice',
    currency,
    total,
    is_sales: isSales,
    is_historical: false,
    created_at: toLocalISOString(now),
    due_date: toLocalISOString(dueDate),
    notes: '',
    items: items.map((i) => ({
      service_id: i.service_id,
      quantity: i.quantity,
      unit_price: i.unit_price,
      total: i.total,
    })),
  };
  const response = await api.post(endpoint, payload);
  const raw = Array.isArray(response)
    ? response[0]
    : response?.data && Array.isArray(response.data)
      ? response.data[0]
      : response?.result || response?.data || response;
  if (raw?.error || (raw?.code && raw.code >= 400)) {
    throw new Error(raw.message || 'Error al crear la factura');
  }

  // Response shape: [{"success":true,"invoice_id":441,"doc_no":"..."}]
  // Prefer invoice_id field, fall back to id, then fetch latest from USER_INVOICES
  let invoiceId: string = (raw?.invoice_id ?? raw?.id) ? String(raw.invoice_id ?? raw.id) : '';
  if (!invoiceId) {
    const latestId = await fetchLatestInvoiceIdForUser(patientId);
    if (!latestId) throw new Error('No se pudo obtener el ID de la factura creada.');
    invoiceId = latestId;
  }

  return {
    id: invoiceId,
    invoice_ref: '',
    doc_no: raw.doc_no || raw.invoice_doc_no || '',
    invoice_doc_no: raw.invoice_doc_no || raw.doc_no || '',
    order_id: '',
    quote_id: '',
    user_id: patientId,
    user_name: '',
    total,
    currency: currency as 'USD' | 'UYU',
    status: raw.status || 'draft',
    payment_status: raw.payment_status || 'unpaid',
    paid_amount: 0,
    type: 'invoice',
    createdAt: raw.created_at || raw.createdAt || now.toISOString(),
    updatedAt: raw.updated_at || raw.updatedAt || now.toISOString(),
  };
}

async function fetchInvoicePaymentsForConfirmation(
  invoiceId: string,
  isSales: boolean,
  fallbackCurrency: string,
): Promise<CreatedPayment[]> {
  try {
    const endpoint = isSales ? API_ROUTES.SALES.INVOICE_PAYMENTS : API_ROUTES.PURCHASES.INVOICE_PAYMENTS;
    const data = await api.get(endpoint, { invoice_id: invoiceId, is_sales: isSales ? 'true' : 'false' });
    const raw = Array.isArray(data) ? data : (data.payments || data.data || []);
    return raw
      .filter((p: any) => p?.status !== 'failed' && (p?.transaction_id || p?.id))
      .map((p: any) => ({
        docNo: p.doc_no || p.payment_doc_no || undefined,
        transactionId: p.transaction_id ? String(p.transaction_id) : String(p.id),
        transactionType: p.transaction_type || 'direct_payment',
        methodName: p.method || p.payment_method || undefined,
        amount: Math.abs(Number(p.amount_applied ?? p.amount ?? 0)),
        currency: p.currency || fallbackCurrency,
        date: p.payment_date || p.created_at || undefined,
      }));
  } catch {
    return [];
  }
}

// ── Step definitions ──────────────────────────────────────────────────────────

const STEPS_FROM_QUOTE: WizardStep[] = [
  { title: 'Tratamiento' },
  { title: 'Pago' },
  { title: 'Listo' },
];

const STEPS_FROM_INVOICE: WizardStep[] = [
  { title: 'Pago' },
  { title: 'Listo' },
];

const STEPS_INVOICE_SELECT: WizardStep[] = [
  { title: 'Facturas' },
  { title: 'Pago' },
  { title: 'Listo' },
];

const STEPS_FREEFORM: WizardStep[] = [
  { title: 'Servicios' },
  { title: 'Pago' },
  { title: 'Listo' },
];

const STEPS_FREEFORM_WITH_PATIENT: WizardStep[] = [
  { title: 'Paciente' },
  { title: 'Servicios' },
  { title: 'Pago' },
  { title: 'Listo' },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function BillingWizardModal() {
  const { isOpen, context, onSuccess, close } = useBillingWizard();
  const isSales = context?.isSales ?? true;

  // Determine base flow type
  const startFromInvoice = !!(context?.invoiceId || context?.invoice);

  // Freeform state (no quoteId, no invoiceId — direct items editor)
  const [editableItems, setEditableItems] = React.useState<EditableItem[]>([]);
  const [freeformCurrency, setFreeformCurrency] = React.useState<string>('UYU');
  // Patient selected in patient-selection step (freeform flow without context.patientId)
  const [selectedPatient, setSelectedPatient] = React.useState<User | null>(null);

  const [currentStep, setCurrentStep] = React.useState(0);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isPaymentSubmitting, setIsPaymentSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Data loaded for treatment step
  const [quote, setQuote] = React.useState<Quote | null>(null);
  const [quoteItems, setQuoteItems] = React.useState<QuoteItem[]>([]);
  const [financialSummary, setFinancialSummary] = React.useState<QuoteFinancialSummary | null>(null);
  const [orderId, setOrderId] = React.useState<string | null>(null);
  const [isLoadingTreatment, setIsLoadingTreatment] = React.useState(false);
  const [treatmentLoadError, setTreatmentLoadError] = React.useState<string | null>(null);

  // Data for payment step
  const [resolvedInvoice, setResolvedInvoice] = React.useState<Invoice | null>(null);

  // Invoice selection mode (fully-invoiced quote: skip invoice creation, pick existing unpaid invoices)
  const [availableInvoices, setAvailableInvoices] = React.useState<Invoice[]>([]);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = React.useState<Set<string>>(new Set());

  const selectedInvoices = React.useMemo(
    () => availableInvoices.filter((inv) => selectedInvoiceIds.has(inv.id)),
    [availableInvoices, selectedInvoiceIds],
  );

  // Invoice-selection mode: quote is fully invoiced but has unpaid invoices → skip creation
  const isInvoiceSelectionMode =
    !startFromInvoice &&
    financialSummary !== null &&
    financialSummary.amount_pending_invoice === 0 &&
    availableInvoices.length > 0;

  // Freeform mode: no quoteId and no invoiceId → direct items editor
  const isFreeformFlow = !startFromInvoice && !context?.quoteId;

  // Patient selection needed when freeform and no patient in context
  const needsPatientStep = isFreeformFlow && !context?.patientId;

  // Effective patient info: from patient-selection step OR from context
  const effectivePatientId = selectedPatient?.id || context?.patientId;
  const effectivePatientName = selectedPatient?.name || context?.patientName;

  const steps = startFromInvoice
    ? STEPS_FROM_INVOICE
    : isFreeformFlow
      ? (needsPatientStep ? STEPS_FREEFORM_WITH_PATIENT : STEPS_FREEFORM)
      : isInvoiceSelectionMode
        ? STEPS_INVOICE_SELECT
        : STEPS_FROM_QUOTE;

  // Confirmation data
  const [confirmationData, setConfirmationData] = React.useState<{
    invoiceId?: string;
    invoiceDocNo?: string;
    invoices?: Invoice[];
    payments: CreatedPayment[];
    total?: number;
    totalPaid?: number;
    pendingAfter?: number;
    currency?: string;
  } | null>(null);

  // Reset state when modal opens/closes
  React.useEffect(() => {
    if (!isOpen) {
      setCurrentStep(0);
      setQuote(null);
      setQuoteItems([]);
      setFinancialSummary(null);
      setOrderId(null);
      setResolvedInvoice(null);
      setAvailableInvoices([]);
      setSelectedInvoiceIds(new Set());
      setConfirmationData({ payments: [] });
      setError(null);
      setTreatmentLoadError(null);
      setEditableItems([]);
      setFreeformCurrency('UYU');
      setSelectedPatient(null);
      return;
    }

    if (!context) return;

    // Load data based on context
    if (startFromInvoice) {
      // Invoice flow: always fetch fresh from USER_INVOICES to get accurate
      // paid_amount. Pre-loaded context.invoice is used as optimistic state only.
      if (context.invoice) setResolvedInvoice(context.invoice);
      if (context.invoiceId && context.patientId) {
        fetchInvoiceById(context.invoiceId, context.patientId).then((inv) => {
          if (inv) setResolvedInvoice(inv);
        });
      }
    } else if (context.quoteId) {
      // Quote flow: load treatment data
      const existingQuote = context.quote || null;
      setIsLoadingTreatment(true);
      setTreatmentLoadError(null);

      const quoteId = context.quoteId;
      Promise.all([
        loadQuoteItems(quoteId, isSales),
        loadOrderId(quoteId, isSales),
        fetchQuoteInvoicesForFinancials(quoteId, isSales),
      ])
        .then(([items, oid, fetchedInvoices]) => {
          setQuoteItems(items);
          setOrderId(oid);
          const finSummary = existingQuote
            ? calculateQuoteFinancialSummary(Number(existingQuote.total || 0), fetchedInvoices)
            : null;
          setFinancialSummary(finSummary);
          if (existingQuote) setQuote(existingQuote);

          // Store unpaid invoices for potential invoice-selection mode
          const unpaidInvoices = fetchedInvoices.filter(
            (inv) => inv.type !== 'credit_note' && !['paid'].includes(inv.payment_status || ''),
          );
          setAvailableInvoices(unpaidInvoices);
        })
        .catch(() => {
          setTreatmentLoadError('No se pudieron cargar los datos del presupuesto.');
        })
        .finally(() => setIsLoadingTreatment(false));
    } else {
      // Freeform flow: start with preloaded items if provided
      setEditableItems(context.preloadedItems || []);
      setFreeformCurrency(context.currency || 'UYU');
    }
  }, [isOpen, context, startFromInvoice, isSales]);

  const handleClose = React.useCallback(() => {
    close();
    if (confirmationData) {
      onSuccess?.();
    }
  }, [close, confirmationData, onSuccess]);

  // Invoice toggle for selection step
  const handleToggleInvoice = React.useCallback((id: string) => {
    setSelectedInvoiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Invoice selection → Payment step (no invoice creation needed)
  const handleInvoiceSelectNext = React.useCallback(() => {
    if (selectedInvoiceIds.size === 0) {
      setError('Selecciona al menos una factura para continuar.');
      return;
    }
    setError(null);
    setCurrentStep(1);
  }, [selectedInvoiceIds]);

  // Fire-and-forget: link the new invoice back to the originating appointment/session
  const linkInvoiceToContext = React.useCallback((invoiceId: string) => {
    if (context?.appointmentId) {
      linkInvoiceToAppointment(invoiceId, context.appointmentId);
    }
    if (context?.sessionId) {
      if (context.sessionType === 'odontograma') {
        linkInvoiceToOdontogramSession(invoiceId, context.sessionId);
      } else {
        linkInvoiceToClinicSession(invoiceId, context.sessionId);
      }
    }
  }, [context]);

  // Step 1 → Step 2: Create invoice from quote
  const handleTreatmentNext = React.useCallback(async () => {
    if (!context?.quoteId) return;
    const quoteId = context.quoteId;
    const quoteObj = quote;

    if (!quoteObj) {
      setError('No se encontró el presupuesto.');
      return;
    }
    if (!orderId) {
      setError('No se encontró la orden del presupuesto. Verifique que el presupuesto esté confirmado.');
      return;
    }
    const pendingItems = quoteItems.filter((item) => Number(item.total) > 0);
    if (pendingItems.length === 0) {
      setError('No hay servicios pendientes de facturación.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Auto-confirm quote if needed
      if (quoteObj.status && !['confirmed', 'accepted'].includes(quoteObj.status)) {
        await confirmQuote(quoteId, isSales);
      }

      // Create invoice from order with all pending items
      await createInvoiceFromOrder(orderId, quoteObj, pendingItems, isSales);

      // Fetch the newly created invoice
      const invoice = await fetchLatestUnpaidInvoice(quoteId, isSales);
      if (!invoice) {
        throw new Error('No se encontró la factura creada. Verifique en el módulo de Facturas.');
      }

      setResolvedInvoice(invoice);
      linkInvoiceToContext(invoice.id);
      setCurrentStep(1); // Move to payment step
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la factura.');
    } finally {
      setIsProcessing(false);
    }
  }, [context, quote, orderId, quoteItems, isSales, linkInvoiceToContext]);

  // Freeform flow: create invoice directly from editable items
  const handleItemsEditorNext = React.useCallback(async (action: 'invoice-only' | 'invoice-and-pay') => {
    if (!effectivePatientId) return;
    if (editableItems.length === 0 || editableItems.some((i) => !i.service_id)) {
      setError('Agrega al menos un servicio con ID válido.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const invoice = await createDirectInvoice(
        effectivePatientId,
        editableItems,
        isSales,
        freeformCurrency,
      );
      setResolvedInvoice(invoice);
      linkInvoiceToContext(invoice.id);

      if (action === 'invoice-only') {
        setConfirmationData({
          invoiceId: invoice.id,
          invoiceDocNo: invoice.doc_no,
          payments: [],
          total: invoice.total,
          currency: invoice.currency,
        });
        setCurrentStep(steps.length - 1);
        onSuccess?.();
      } else {
        // Payment step index shifts by 1 when there is a patient-selection step
        setCurrentStep(needsPatientStep ? 2 : 1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la factura.');
    } finally {
      setIsProcessing(false);
    }
  }, [effectivePatientId, editableItems, freeformCurrency, isSales, steps.length, onSuccess, linkInvoiceToContext]);

  const handlePaymentSuccess = React.useCallback(
    async (result: PaymentResult) => {
      const targetInvoiceId = result.invoiceId || resolvedInvoice?.id;
      const targetCurrency = result.currency || resolvedInvoice?.currency || 'USD';

      // Fetch all invoice payments, then mark which ones were just created.
      const sessionIds = new Set(result.payments.map((p) => p.transactionId).filter(Boolean));
      let payments = result.payments.map((p) => ({ ...p, isNew: true }));
      if (targetInvoiceId) {
        const fetched = await fetchInvoicePaymentsForConfirmation(targetInvoiceId, isSales, targetCurrency);
        if (fetched.length > 0) {
          payments = fetched.map((p) => ({ ...p, isNew: !!p.transactionId && sessionIds.has(p.transactionId) }));
        }
      }

      if (isInvoiceSelectionMode && selectedInvoices.length > 0) {
        const totalPending = selectedInvoices.reduce(
          (sum, inv) => sum + Math.max(0, (inv.total || 0) - (inv.paid_amount || 0)),
          0,
        );
        setConfirmationData({
          invoices: selectedInvoices,
          payments,
          total: totalPending,
          totalPaid: result.totalPaid,
          pendingAfter: result.remainingAfterPayment,
          currency: result.currency || selectedInvoices[0]?.currency,
        });
      } else {
        setConfirmationData({
          invoiceId: targetInvoiceId,
          invoiceDocNo: result.invoiceDocNo || resolvedInvoice?.doc_no,
          payments,
          total: resolvedInvoice?.total,
          totalPaid: result.totalPaid,
          pendingAfter: result.remainingAfterPayment,
          currency: targetCurrency,
        });
      }
      setCurrentStep(steps.length - 1);
      onSuccess?.();
    },
    [resolvedInvoice, steps.length, onSuccess, isInvoiceSelectionMode, selectedInvoices, isSales],
  );

  const handleSkipPayment = React.useCallback(
    async (invoiceDocNo?: string) => {
      if (isInvoiceSelectionMode) {
        // Fully-invoiced flow: nothing to skip, just close
        close();
        return;
      }
      const targetId = resolvedInvoice?.id;
      const targetCurrency = resolvedInvoice?.currency || 'USD';

      // Fetch all existing payments for the invoice (none are new since no payment was made)
      let payments: CreatedPayment[] = [];
      if (targetId) {
        const fetched = await fetchInvoicePaymentsForConfirmation(targetId, isSales, targetCurrency);
        payments = fetched.map((p) => ({ ...p, isNew: false }));
      }

      setConfirmationData({
        invoiceId: targetId,
        invoiceDocNo: invoiceDocNo || resolvedInvoice?.doc_no,
        payments,
        total: resolvedInvoice?.total,
        pendingAfter: resolvedInvoice ? Math.max(0, resolvedInvoice.total - (resolvedInvoice.paid_amount || 0)) : undefined,
        currency: targetCurrency,
      });
      setCurrentStep(steps.length - 1);
      onSuccess?.();
    },
    [resolvedInvoice, steps.length, onSuccess, isInvoiceSelectionMode, close, isSales],
  );

  // Determine which logical step renders
  const renderStep = () => {
    if (startFromInvoice) {
      // Invoice flow: Payment → Confirmation (payment-only, no "Solo facturar")
      if (currentStep === 0 && resolvedInvoice) {
        return (
          <StepPayment
            invoice={resolvedInvoice}
            isSales={isSales}
            onPaymentSuccess={handlePaymentSuccess}
            onSkipPayment={handleSkipPayment}
            isSubmitting={isPaymentSubmitting}
            setIsSubmitting={setIsPaymentSubmitting}
            paymentOnly

          />
        );
      }
    } else if (isInvoiceSelectionMode) {
      // Fully-invoiced quote: Invoice selection → Payment → Confirmation
      if (currentStep === 0) {
        return (
          <StepInvoiceSelect
            invoices={availableInvoices}
            selectedIds={selectedInvoiceIds}
            onToggle={handleToggleInvoice}
            onNext={handleInvoiceSelectNext}
            isLoading={isLoadingTreatment}
            patientName={context?.patientName}
          />
        );
      }
      if (currentStep === 1 && selectedInvoices.length > 0) {
        return (
          <StepPayment
            invoice={selectedInvoices[0]}
            invoices={selectedInvoices}
            isSales={isSales}
            onPaymentSuccess={handlePaymentSuccess}
            onSkipPayment={handleSkipPayment}
            isSubmitting={isPaymentSubmitting}
            setIsSubmitting={setIsPaymentSubmitting}

          />
        );
      }
    } else if (isFreeformFlow) {
      // Freeform flow: [Patient →] Items editor → Payment → Confirmation
      const itemsStep = needsPatientStep ? 1 : 0;
      const paymentStep = needsPatientStep ? 2 : 1;

      if (needsPatientStep && currentStep === 0) {
        return (
          <StepPatientSelect
            selectedPatient={selectedPatient}
            onPatientChange={setSelectedPatient}
          />
        );
      }
      if (currentStep === itemsStep) {
        return (
          <StepItemsEditor
            items={editableItems}
            onItemsChange={setEditableItems}
            currency={freeformCurrency}
            onCurrencyChange={setFreeformCurrency}
            isSales={isSales}
          />
        );
      }
      if (currentStep === paymentStep && resolvedInvoice) {
        return (
          <StepPayment
            invoice={resolvedInvoice}
            isSales={isSales}
            onPaymentSuccess={handlePaymentSuccess}
            onSkipPayment={handleSkipPayment}
            isSubmitting={isPaymentSubmitting}
            setIsSubmitting={setIsPaymentSubmitting}
            paymentOnly
            invoiceJustCreated

          />
        );
      }
    } else {
      // Quote flow: Treatment → Payment → Confirmation
      if (currentStep === 0) {
        return (
          <StepTreatment
            quote={quote}
            items={quoteItems}
            financialSummary={financialSummary}
            isLoading={isLoadingTreatment}
            error={treatmentLoadError}
            patientName={context?.patientName}
          />
        );
      }
      if (currentStep === 1 && resolvedInvoice) {
        return (
          <StepPayment
            invoice={resolvedInvoice}
            isSales={isSales}
            onPaymentSuccess={handlePaymentSuccess}
            onSkipPayment={handleSkipPayment}
            isSubmitting={isPaymentSubmitting}
            setIsSubmitting={setIsPaymentSubmitting}

          />
        );
      }
    }

    // Confirmation (last step)
    if (currentStep === steps.length - 1) {
      return (
        <StepConfirmation
          invoiceId={confirmationData?.invoiceId}
          invoiceDocNo={confirmationData?.invoiceDocNo}
          invoices={confirmationData?.invoices}
          payments={confirmationData?.payments ?? []}
          patientName={effectivePatientName}
          total={confirmationData?.total}
          totalPaid={confirmationData?.totalPaid}
          pendingAfter={confirmationData?.pendingAfter}
          currency={confirmationData?.currency}
          isSales={isSales}
          onClose={handleClose}
        />
      );
    }

    // Loading / waiting state
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  };

  const isConfirmationStep = currentStep === steps.length - 1;
  const isPaymentStep = steps.length >= 2 && currentStep === steps.length - 2;
  const isPatientStep = needsPatientStep && currentStep === 0;
  const isItemsEditorStep = isFreeformFlow && !isConfirmationStep && !isPaymentStep && !isPatientStep;

  // Pending amount for the payment step (drives button visibility in the action bar)
  const paymentPendingAmount = React.useMemo(() => {
    if (!isPaymentStep) return 0;
    if (isInvoiceSelectionMode && selectedInvoices.length > 0) {
      return selectedInvoices.reduce((sum, inv) => sum + Math.max(0, (inv.total || 0) - (inv.paid_amount || 0)), 0);
    }
    return Math.max(0, (resolvedInvoice?.total || 0) - (resolvedInvoice?.paid_amount || 0));
  }, [isPaymentStep, isInvoiceSelectionMode, selectedInvoices, resolvedInvoice]);

  const isPaymentFullyPaid = isPaymentStep && paymentPendingAmount <= 0;
  // paymentOnly: invoice already exists so "Solo facturar" doesn't apply
  const isPaymentOnly = startFromInvoice || (isFreeformFlow && isPaymentStep);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent maxWidth="xl">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="header-icon-circle mt-0.5">
              <Zap className="h-5 w-5" />
            </div>
            <div className="flex flex-col text-left">
              <DialogTitle>Cobro Rápido</DialogTitle>
              {context?.patientName ? (
                <p className="text-base font-semibold text-foreground mt-0.5 leading-snug">
                  {context.patientName}
                </p>
              ) : (
                <DialogDescription>Asistente de facturación y cobro</DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="flex flex-col overflow-hidden p-0">
          {/* Fixed top: stepper + error */}
          {(!isConfirmationStep || error) && (
            <div className="px-6 pt-5 pb-3 shrink-0 space-y-3">
              {!isConfirmationStep && <BillingWizardStepper steps={steps} currentStep={currentStep} />}
              {error && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Scrollable step content */}
          <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4">
            {renderStep()}
          </div>

          {/* Fixed bottom action bar — always visible, all buttons live here */}
          <div className="shrink-0 border-t px-6 pb-5 pt-3 flex items-center justify-end gap-2">
            {/* Cancel — all non-confirmation steps */}
            {!isConfirmationStep && (
              <button
                type="button"
                onClick={handleClose}
                disabled={isProcessing || isPaymentSubmitting}
                className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
            )}

            {/* Invoice select step: Siguiente */}
            {isInvoiceSelectionMode && currentStep === 0 && (
              <button
                type="button"
                onClick={handleInvoiceSelectNext}
                disabled={selectedInvoiceIds.size === 0}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Siguiente
              </button>
            )}

            {/* Quote treatment step: Siguiente */}
            {!isFreeformFlow && !isInvoiceSelectionMode && !startFromInvoice && currentStep === 0 && !isLoadingTreatment && (
              <button
                type="button"
                onClick={handleTreatmentNext}
                disabled={isProcessing || !!treatmentLoadError || quoteItems.length === 0}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
                {isProcessing ? 'Generando factura...' : 'Siguiente'}
              </button>
            )}

            {/* Freeform patient step: Siguiente */}
            {isPatientStep && (
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                disabled={!selectedPatient}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Siguiente
              </button>
            )}

            {/* Freeform items step: Solo facturar + Facturar y Cobrar */}
            {isItemsEditorStep && (
              <>
                <button
                  type="button"
                  onClick={() => handleItemsEditorNext('invoice-only')}
                  disabled={isProcessing || editableItems.length === 0 || !effectivePatientId}
                  className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
                  Solo facturar
                </button>
                <button
                  type="button"
                  onClick={() => handleItemsEditorNext('invoice-and-pay')}
                  disabled={isProcessing || editableItems.length === 0 || !effectivePatientId}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isProcessing ? 'Generando factura...' : 'Facturar y Cobrar'}
                </button>
              </>
            )}

            {/* Payment step — fully paid: just navigate to confirmation */}
            {isPaymentStep && isPaymentFullyPaid && (
              <button
                type="button"
                onClick={() => handleSkipPayment(resolvedInvoice?.doc_no || resolvedInvoice?.invoice_doc_no || selectedInvoices[0]?.doc_no)}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
              >
                Ver factura y pagos
              </button>
            )}

            {/* Payment step — has pending: Solo facturar (when applicable) + Cobrar */}
            {isPaymentStep && !isPaymentFullyPaid && (
              <>
                {!isPaymentOnly && !isInvoiceSelectionMode && (
                  <button
                    type="button"
                    onClick={() => handleSkipPayment(resolvedInvoice?.doc_no || resolvedInvoice?.invoice_doc_no)}
                    disabled={isPaymentSubmitting}
                    className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Solo facturar
                  </button>
                )}
                <button
                  form="billing-payment-form"
                  type="submit"
                  disabled={isPaymentSubmitting}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isPaymentSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Cobrar
                </button>
              </>
            )}

            {/* Confirmation step: Cerrar */}
            {isConfirmationStep && (
              <button
                type="button"
                onClick={handleClose}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
              >
                Cerrar
              </button>
            )}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
