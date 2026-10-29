'use client';

import * as React from 'react';
import Editor, { type Monaco } from '@monaco-editor/react';
import { format } from 'date-fns';
import {
  Code2, Eye, FileText, Loader2, Maximize2, Minimize2,
  RefreshCw, Receipt, FileCheck, CreditCard, Wallet, Save, BookOpen,
  Mail, MessageSquare, AlertTriangle,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ConfirmActionDialog } from '@/components/ui/confirm-action-dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { api, isTimeoutError, REQUEST_TIMEOUT_MS } from '@/services/api';
import { API_ROUTES } from '@/constants/routes';
import { useKeyedAsyncAction } from '@/hooks/use-async-action';
import { useDataLoader } from '@/hooks/use-data-loader';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { useClinicInfo } from '@/hooks/useClinicInfo';
import { BUSINESS_CONFIG_PERMISSIONS } from '@/constants/permissions';
import { PRINT_TEMPLATE_DEFAULTS } from '@/lib/print-template-defaults';
import { PRINT_TEMPLATE_VARIABLES } from '@/lib/print-template-variables';
import { EMAIL_TEMPLATE_DEFAULTS, EMAIL_CODE_MAP } from '@/lib/email-template-defaults';
import { EMAIL_TEMPLATE_VARIABLES, WHATSAPP_TEMPLATE_VARIABLES } from '@/lib/email-template-variables';
import { WHATSAPP_TEMPLATE_DEFAULTS, WHATSAPP_CODE_MAP } from '@/lib/whatsapp-template-defaults';
import { invalidateCommTemplatesCache } from '@/hooks/useCommunicationTemplates';
import { usePrintDocumentStore } from '@/stores/print-document-store';
import type { PrintDocumentType } from '@/stores/print-document-store';
import type { EmailTemplateType } from '@/lib/email-template-defaults';
import type { WhatsappTemplateType } from '@/lib/whatsapp-template-defaults';
import type { DocPrintTemplate, CommunicationTemplate } from '@/lib/types';
import { getClinicCurrency } from '@/stores/clinic-info-store';

// ── Types ──────────────────────────────────────────────────────────────────────

type EditorRef = Parameters<NonNullable<React.ComponentProps<typeof Editor>['onMount']>>[0];
type TemplateSection = 'document' | 'email' | 'whatsapp';
type AllTemplateType = PrintDocumentType | EmailTemplateType | WhatsappTemplateType;

const GROUP_ORDER: Array<'clinic' | 'document' | 'patient' | 'tables' | 'appointment' | 'alert' | 'treatment' | 'cash'> =
  ['clinic', 'document', 'patient', 'appointment', 'alert', 'treatment', 'cash', 'tables'];

// Types that use a plain-text textarea instead of Monaco
const PLAIN_TEXT_TYPES = new Set<string>(['whatsapp_patient_general', 'whatsapp_alert_followup', 'whatsapp_appointment_reminder', 'whatsapp_treatment_interrupted']);
function isPlainText(type: AllTemplateType) { return PLAIN_TEXT_TYPES.has(type as string); }

// ── Section / item config ──────────────────────────────────────────────────────

type SectionItem = { type: AllTemplateType; labelKey: string; Icon: React.ElementType; section: TemplateSection };
type SectionGroup = { section: TemplateSection; headerKey: string; items: SectionItem[] };

const SECTION_GROUPS: SectionGroup[] = [
  {
    section: 'document',
    headerKey: 'sections.document',
    items: [
      { type: 'invoice',           labelKey: 'tabs.invoice',           Icon: FileCheck,  section: 'document' },
      { type: 'quote',             labelKey: 'tabs.quote',             Icon: FileText,   section: 'document' },
      { type: 'payment',           labelKey: 'tabs.payment',           Icon: Receipt,    section: 'document' },
      { type: 'credit_note',       labelKey: 'tabs.credit_note',       Icon: CreditCard, section: 'document' },
      { type: 'prepayment',        labelKey: 'tabs.prepayment',        Icon: Wallet,     section: 'document' },
      { type: 'financial_summary', labelKey: 'tabs.financial_summary', Icon: BookOpen,   section: 'document' },
    ],
  },
  {
    section: 'email',
    headerKey: 'sections.email',
    items: [
      { type: 'email_patient_general',          labelKey: 'tabs.email_patient_general',          Icon: Mail, section: 'email' },
      { type: 'email_alert_followup',           labelKey: 'tabs.email_alert_followup',           Icon: Mail, section: 'email' },
      { type: 'email_invoice',                  labelKey: 'tabs.email_invoice',                  Icon: Mail, section: 'email' },
      { type: 'email_quote',                    labelKey: 'tabs.email_quote',                    Icon: Mail, section: 'email' },
      { type: 'email_quote_approved',           labelKey: 'tabs.email_quote_approved',           Icon: Mail, section: 'email' },
      { type: 'email_quote_rejected',           labelKey: 'tabs.email_quote_rejected',           Icon: Mail, section: 'email' },
      { type: 'email_payment',                  labelKey: 'tabs.email_payment',                  Icon: Mail, section: 'email' },
      { type: 'email_appointment_reminder',     labelKey: 'tabs.email_appointment_reminder',     Icon: Mail, section: 'email' },
      { type: 'email_appointment_confirmation', labelKey: 'tabs.email_appointment_confirmation', Icon: Mail, section: 'email' },
      { type: 'email_financial_summary',        labelKey: 'tabs.email_financial_summary',        Icon: Mail, section: 'email' },
      { type: 'email_treatment_update',         labelKey: 'tabs.email_treatment_update',         Icon: Mail, section: 'email' },
      { type: 'email_password_reset',           labelKey: 'tabs.email_password_reset',           Icon: Mail, section: 'email' },
    ],
  },
  {
    section: 'whatsapp',
    headerKey: 'sections.whatsapp',
    items: [
      { type: 'whatsapp_patient_general',       labelKey: 'tabs.whatsapp_patient_general',       Icon: MessageSquare, section: 'whatsapp' },
      { type: 'whatsapp_alert_followup',        labelKey: 'tabs.whatsapp_alert_followup',        Icon: MessageSquare, section: 'whatsapp' },
      { type: 'whatsapp_appointment_reminder',  labelKey: 'tabs.whatsapp_appointment_reminder',  Icon: MessageSquare, section: 'whatsapp' },
      { type: 'whatsapp_treatment_interrupted', labelKey: 'tabs.whatsapp_treatment_interrupted', Icon: MessageSquare, section: 'whatsapp' },
    ],
  },
];

const DOC_ITEMS      = SECTION_GROUPS[0].items;
const EMAIL_ITEMS    = SECTION_GROUPS[1].items.filter((i) => !isPlainText(i.type));
const WHATSAPP_ITEMS = SECTION_GROUPS[2].items;

function getSectionOf(type: AllTemplateType): TemplateSection {
  if ((type as string).startsWith('email_'))    return 'email';
  if ((type as string).startsWith('whatsapp_')) return 'whatsapp';
  return 'document';
}

// ── Preview substitution ───────────────────────────────────────────────────────

function substituteDocForPreview(
  html: string, type: PrintDocumentType,
  clinicName: string, clinicLogoUrl: string,
  clinicAddress: string, clinicPhone: string, clinicEmail: string,
): string {
  const sampleItems = `<table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="background:#f9fafb;"><th style="text-align:left;padding:6px 8px;">#</th><th style="text-align:left;padding:6px 8px;">Servicio</th><th style="text-align:center;padding:6px 8px;">Cant.</th><th style="text-align:right;padding:6px 8px;">P. Unit.</th><th style="text-align:right;padding:6px 8px;">Total</th></tr></thead><tbody><tr><td style="padding:6px 8px;">1</td><td style="padding:6px 8px;">Extracción simple</td><td style="text-align:center;padding:6px 8px;">1</td><td style="text-align:right;padding:6px 8px;">UYU 500</td><td style="text-align:right;padding:6px 8px;">UYU 500</td></tr></tbody></table>`;
  const samplePayments = `<table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="background:#f9fafb;"><th style="padding:6px 8px;">Nro. Doc.</th><th style="padding:6px 8px;">Fecha</th><th style="padding:6px 8px;">Método</th><th style="text-align:right;padding:6px 8px;">Monto</th></tr></thead><tbody><tr><td style="padding:6px 8px;font-family:monospace;">PAG-0042</td><td style="padding:6px 8px;">28/05/2026</td><td style="padding:6px 8px;">Efectivo</td><td style="text-align:right;padding:6px 8px;">UYU 500</td></tr></tbody></table>`;
  const ph = clinicPhone && clinicEmail ? ' | ' : '';
  const v: Record<string, string> = {
    clinic_name: clinicName || 'Mi Clínica Demo', clinic_logo: clinicLogoUrl || '',
    clinic_address: clinicAddress || 'Av. Principal 123', clinic_phone: clinicPhone || '+598 99 000 000',
    clinic_email: clinicEmail || 'contacto@miclinica.com', clinic_phone_email_sep: ph || ' | ',
    doc_no: type === 'invoice' ? 'FAC-0021' : type === 'quote' ? 'PRE-0015' : type === 'credit_note' ? 'NC-0003' : 'PAG-0042',
    date: '28/05/2026', due_date: '28/06/2026', status: 'Registrada', payment_status: 'Pagado',
    currency: getClinicCurrency(), patient_name: 'Ana García', reference: 'PRE-0015', original_invoice: 'FAC-0021',
    total: '800', paid: '500', pending: '300', amount_invoiced: '800', pending_invoice: '0',
    amount_paid: '500', pending_payment: '300', method: 'Efectivo', transaction_type: 'Pago directo',
    exchange_rate: '', amount: '800', notes: '', generated_at: format(new Date(), 'dd/MM/yyyy HH:mm'),
    items_table: sampleItems, payments_table: samplePayments, invoices_section: '', movements_table: '',
    patient_id: '1.234.567-8', patient_email: 'ana@example.com', patient_phone: '+598 99 000 000',
    date_from: '01/05/2026', date_to: '28/05/2026',
  };
  return html.replace(/\{\{(\w+)\}\}/g, (_, key: string) => v[key] ?? `[${key}]`);
}

function substituteEmailForPreview(
  html: string, type: EmailTemplateType,
  clinicName: string, clinicLogoUrl: string,
  clinicAddress: string, clinicPhone: string, clinicEmail: string,
): string {
  const sampleItems = `<table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="background:#f9fafb;"><th style="text-align:left;padding:6px 8px;">Servicio</th><th style="text-align:right;padding:6px 8px;">Total</th></tr></thead><tbody><tr><td style="padding:6px 8px;">Extracción simple</td><td style="text-align:right;padding:6px 8px;">UYU 500</td></tr></tbody></table>`;
  const sampleMovements = `<table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="background:#f9fafb;"><th style="text-align:left;padding:6px 8px;">Fecha</th><th style="text-align:left;padding:6px 8px;">Tipo</th><th style="text-align:right;padding:6px 8px;">Monto</th><th style="text-align:right;padding:6px 8px;">Saldo</th></tr></thead><tbody><tr><td style="padding:6px 8px;">28/05/2026</td><td style="padding:6px 8px;">Pago</td><td style="text-align:right;padding:6px 8px;color:#15803d;">+500</td><td style="text-align:right;padding:6px 8px;">500</td></tr></tbody></table>`;
  const v: Record<string, string> = {
    clinic_name: clinicName || 'Mi Clínica Demo', clinic_logo: clinicLogoUrl || '',
    clinic_address: clinicAddress || 'Av. Principal 123', clinic_phone: clinicPhone || '+598 99 000 000',
    clinic_email: clinicEmail || 'contacto@miclinica.com',
    patient_name: 'Ana García', patient_email: 'ana@example.com',
    doc_no: type === 'email_invoice' ? 'FAC-0021' : type === 'email_quote' || type === 'email_quote_approved' || type === 'email_quote_rejected' ? 'PRE-0015' : 'PAG-0042',
    date: '28/05/2026', status: 'Registrada', currency: getClinicCurrency(),
    total: '800', amount: '800', method: 'Efectivo', items_table: sampleItems,
    exchange_rate: '1.00',
    appointment_date: '30/06/2026', appointment_time: '10:00',
    doctor_name: 'Dra. Martínez', location: 'Consultorio 2 — Av. Principal 123',
    alert_title: 'Control de seguimiento', alert_summary: 'El paciente no asistió a su última cita programada.', alert_date: '24/06/2026 10:00',
    movements_table: sampleMovements,
    date_from: '01/05/2026', date_to: '28/05/2026',
    service_name: 'Ortodoncia', treatment_status: 'En progreso', treatment_date: '28/05/2026',
    reset_link: '#',
  };
  return html.replace(/\{\{(\w+)\}\}/g, (_, key: string) => v[key] ?? `[${key}]`);
}

function substituteWhatsappForPreview(text: string, clinicName: string, clinicPhone: string): string {
  const v: Record<string, string> = {
    clinic_name: clinicName || 'Mi Clínica Demo', clinic_phone: clinicPhone || '+598 99 000 000',
    patient_name: 'Ana García',
    appointment_date: '30/06/2026', appointment_time: '10:00',
    doctor_name: 'Dra. Martínez', location: 'Consultorio 2',
    alert_title: 'Control de seguimiento', alert_summary: 'El paciente no asistió a su última cita.', alert_date: '24/06/2026 10:00',
    service_name: 'Ortodoncia', missed_step: 'Aplicación de brackets', missed_date: '28/05/2026',
  };
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => v[key] ?? `[${key}]`);
}

// ── Loading / persistence helpers ─────────────────────────────────────────────

type TemplateBodies = {
  doc: Partial<Record<PrintDocumentType, string>>;
  email: Partial<Record<EmailTemplateType, string>>;
  subjects: Partial<Record<EmailTemplateType, string>>;
  whatsapp: Partial<Record<WhatsappTemplateType, string>>;
  ids: Partial<Record<EmailTemplateType | WhatsappTemplateType, string>>;
};

const EMPTY_TEMPLATES: TemplateBodies = { doc: {}, email: {}, subjects: {}, whatsapp: {}, ids: {} };

/**
 * Throws when either list fails: showing the compiled defaults as if they were the saved templates
 * would let the user overwrite (or duplicate, without the record id) the clinic's real templates.
 */
async function fetchAllTemplates(signal: AbortSignal): Promise<TemplateBodies> {
  const [docRaw, commRaw] = await Promise.all([
    api.get(API_ROUTES.PRINT_TEMPLATES, undefined, undefined, { signal }),
    api.get(API_ROUTES.SYSTEM.COMMUNICATION_TEMPLATES, undefined, undefined, { signal }),
  ]);

  const doc: TemplateBodies['doc'] = {};
  (Array.isArray(docRaw) ? docRaw as DocPrintTemplate[] : [])
    .forEach((tpl) => { doc[tpl.template_type] = tpl.template_html; });

  const comms: CommunicationTemplate[] = Array.isArray(commRaw) ? commRaw : [];
  const email: TemplateBodies['email'] = {};
  const subjects: TemplateBodies['subjects'] = {};
  const whatsapp: TemplateBodies['whatsapp'] = {};
  const ids: TemplateBodies['ids'] = {};

  const codeToEmail    = Object.fromEntries(Object.entries(EMAIL_CODE_MAP).map(([k, v]) => [v, k as EmailTemplateType]));
  const codeToWhatsapp = Object.fromEntries(Object.entries(WHATSAPP_CODE_MAP).map(([k, v]) => [v, k as WhatsappTemplateType]));

  comms.forEach((tpl) => {
    const emailType = codeToEmail[tpl.code];
    if (emailType) {
      email[emailType] = isPlainText(emailType) ? (tpl.body_text || tpl.body_html || '') : (tpl.body_html || '');
      subjects[emailType] = tpl.subject || '';
      if (tpl.id) ids[emailType] = tpl.id;
    }
    const waType = codeToWhatsapp[tpl.code];
    if (waType) {
      whatsapp[waType] = tpl.body_text || tpl.body_html || '';
      if (tpl.id) ids[waType] = tpl.id;
    }
  });

  return { doc, email, subjects, whatsapp, ids };
}

/** Takes the server values, but keeps every entry the user changed since the last known saved state. */
function mergeKeepingEdits<K extends string>(
  current: Partial<Record<K, string>>,
  previousSaved: Partial<Record<K, string>>,
  server: Partial<Record<K, string>>,
): Partial<Record<K, string>> {
  const next = { ...server };
  (Object.keys(current) as K[]).forEach((key) => {
    if (current[key] !== previousSaved[key]) next[key] = current[key];
  });
  return next;
}

/** n8n answers some failures with a 2xx body carrying the error. */
function throwIfBackendError(response: unknown) {
  const first = (Array.isArray(response) ? response[0] : response) as { error?: unknown; code?: number; message?: string } | undefined;
  if (first?.error || (first?.code && Number(first.code) >= 400)) {
    throw new Error(first?.message || (typeof first?.error === 'string' ? first.error : '') || 'Request failed');
  }
}

/** Deleting a template that was never customized is not an error for "restore default". */
const isNotFound = (error: unknown) => (error as { status?: number } | null)?.status === 404;

const MUTATION_OPTIONS = { timeoutMs: REQUEST_TIMEOUT_MS.mutation };

// ── Component ─────────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const t = useTranslations('Config.Templates');
  const tCommon = useTranslations('Common');
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const { resolvedTheme } = useTheme();
  const clinic = useClinicInfo();
  const { setCustomTemplates } = usePrintDocumentStore();

  const canEdit = hasPermission(BUSINESS_CONFIG_PERMISSIONS.PRINT_TEMPLATES_EDIT);

  // ── State ──────────────────────────────────────────────────────────────────
  const [activeType, setActiveType]       = React.useState<AllTemplateType>('invoice');
  const [docTemplates, setDocTemplates]       = React.useState<Partial<Record<PrintDocumentType, string>>>({});
  const [emailTemplates, setEmailTemplates]   = React.useState<Partial<Record<EmailTemplateType, string>>>({});
  const [emailSubjects, setEmailSubjects]     = React.useState<Partial<Record<EmailTemplateType, string>>>({});
  const [whatsappTemplates, setWhatsappTemplates] = React.useState<Partial<Record<WhatsappTemplateType, string>>>({});
  const [commIds, setCommIds] = React.useState<Partial<Record<EmailTemplateType | WhatsappTemplateType, string>>>({});

  const [resetTarget, setResetTarget]       = React.useState<AllTemplateType | null>(null);
  const [mobileView, setMobileView]         = React.useState<'code' | 'preview'>('code');
  const [editorExpanded, setEditorExpanded] = React.useState(false);
  const [previewContent, setPreviewContent] = React.useState('');

  const editorRefs     = React.useRef<Partial<Record<PrintDocumentType | EmailTemplateType, EditorRef>>>({});
  const plainTextareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const debounceRef   = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeSection = getSectionOf(activeType);

  // ── Derived content ────────────────────────────────────────────────────────
  function getCurrentBody(type: AllTemplateType): string {
    const section = getSectionOf(type);
    if (section === 'document')  return docTemplates[type as PrintDocumentType]     ?? PRINT_TEMPLATE_DEFAULTS[type as PrintDocumentType];
    if (section === 'email')     return emailTemplates[type as EmailTemplateType]   ?? EMAIL_TEMPLATE_DEFAULTS[type as EmailTemplateType].body;
    return whatsappTemplates[type as WhatsappTemplateType] ?? WHATSAPP_TEMPLATE_DEFAULTS[type as WhatsappTemplateType];
  }

  // ── Rebuild preview ────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const cn = clinic?.name || '';
      const logo = clinic?.logoUrl || '';
      const addr = clinic?.address || '';
      const ph   = clinic?.phone || '';
      const em   = clinic?.email || '';
      const content = getCurrentBody(activeType);
      if (activeSection === 'document') {
        setPreviewContent(substituteDocForPreview(content, activeType as PrintDocumentType, cn, logo, addr, ph, em));
      } else if (activeSection === 'email' && !isPlainText(activeType)) {
        setPreviewContent(substituteEmailForPreview(content, activeType as EmailTemplateType, cn, logo, addr, ph, em));
      } else {
        setPreviewContent(substituteWhatsappForPreview(content, cn, ph));
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeType, docTemplates, emailTemplates, whatsappTemplates, clinic]);

  // ── Load templates ─────────────────────────────────────────────────────────
  const { data: server, isLoading, isRefreshing, error: loadError, reload } = useDataLoader(fetchAllTemplates, EMPTY_TEMPLATES);

  // Last state known to be persisted: the baseline for "unsaved changes".
  const [saved, setSaved] = React.useState<TemplateBodies>(EMPTY_TEMPLATES);
  const savedRef = React.useRef<TemplateBodies>(EMPTY_TEMPLATES);
  const updateSaved = React.useCallback((update: (prev: TemplateBodies) => TemplateBodies) => {
    savedRef.current = update(savedRef.current);
    setSaved(savedRef.current);
  }, []);

  // A (re)load never discards what the user is editing: only untouched templates take the server value.
  React.useEffect(() => {
    const previousSaved = savedRef.current;
    setDocTemplates((cur) => mergeKeepingEdits(cur, previousSaved.doc, server.doc));
    setEmailTemplates((cur) => mergeKeepingEdits(cur, previousSaved.email, server.email));
    setEmailSubjects((cur) => mergeKeepingEdits(cur, previousSaved.subjects, server.subjects));
    setWhatsappTemplates((cur) => mergeKeepingEdits(cur, previousSaved.whatsapp, server.whatsapp));
    setCommIds(server.ids);
    updateSaved(() => server);
  }, [server, updateSaved]);

  function getSavedBody(type: AllTemplateType): string {
    const section = getSectionOf(type);
    if (section === 'document') return saved.doc[type as PrintDocumentType] ?? PRINT_TEMPLATE_DEFAULTS[type as PrintDocumentType];
    if (section === 'email')    return saved.email[type as EmailTemplateType] ?? EMAIL_TEMPLATE_DEFAULTS[type as EmailTemplateType].body;
    return saved.whatsapp[type as WhatsappTemplateType] ?? WHATSAPP_TEMPLATE_DEFAULTS[type as WhatsappTemplateType];
  }

  function isTypeDirty(type: AllTemplateType): boolean {
    if (getCurrentBody(type) !== getSavedBody(type)) return true;
    if (getSectionOf(type) !== 'email') return false;
    const eType = type as EmailTemplateType;
    const fallback = EMAIL_TEMPLATE_DEFAULTS[eType].subject;
    return (emailSubjects[eType] ?? fallback) !== (saved.subjects[eType] ?? fallback);
  }

  const hasUnsavedChanges = SECTION_GROUPS.some((g) => g.items.some((i) => isTypeDirty(i.type)));

  // Leaving the page (reload, close tab) with unsaved template edits asks first.
  React.useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  /** Print store = saved document templates (never other types' unsaved edits). */
  const syncPrintStore = (docs: TemplateBodies['doc']) => {
    setCustomTemplates(DOC_ITEMS.map((tt) => ({
      id: '', clinic_id: '', template_type: tt.type as PrintDocumentType,
      template_html: docs[tt.type as PrintDocumentType] ?? PRINT_TEMPLATE_DEFAULTS[tt.type as PrintDocumentType],
      is_active: true, createdAt: '', updatedAt: '',
    })));
  };

  // ── Cursor insertion ───────────────────────────────────────────────────────
  function insertAtCursor(text: string) {
    if (isPlainText(activeType)) {
      const textarea = plainTextareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end   = textarea.selectionEnd;
      const prev  = textarea.value;
      const next  = prev.substring(0, start) + text + prev.substring(end);
      if (activeSection === 'whatsapp') setWhatsappTemplates((s) => ({ ...s, [activeType]: next }));
      else setEmailTemplates((s) => ({ ...s, [activeType]: next }));
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + text.length;
        textarea.focus();
      }, 0);
      return;
    }
    const editor = editorRefs.current[activeType as PrintDocumentType | EmailTemplateType];
    if (!editor) return;
    const sel = editor.getSelection();
    if (sel) editor.executeEdits('insert-variable', [{ range: sel, text, forceMoveMarkers: true }]);
    else editor.trigger('keyboard', 'type', { text });
    editor.focus();
  }

  function handleEditorMount(editor: EditorRef, _monaco: Monaco, type: PrintDocumentType | EmailTemplateType) {
    editorRefs.current[type] = editor;
    editor.onDidChangeModelContent(() => {
      const val = editor.getValue();
      if (getSectionOf(type) === 'document') {
        setDocTemplates((prev) => ({ ...prev, [type]: val }));
      } else {
        setEmailTemplates((prev) => ({ ...prev, [type]: val }));
      }
    });
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  // Locked per template type: a double click can't upsert twice (and, for a template without id yet,
  // create two records with the same code); other types stay saveable meanwhile.
  const save = useKeyedAsyncAction(
    async (type: AllTemplateType) => {
      const section = getSectionOf(type);

      if (section === 'document') {
        const html = docTemplates[type as PrintDocumentType] ?? PRINT_TEMPLATE_DEFAULTS[type as PrintDocumentType];
        const res = await api.post(API_ROUTES.PRINT_TEMPLATES_UPSERT, { template_type: type, template_html: html, is_active: true }, undefined, undefined, MUTATION_OPTIONS);
        throwIfBackendError(res);
        return { type, body: html, subject: undefined, id: undefined };
      }
      if (section === 'email') {
        const eType   = type as EmailTemplateType;
        const body    = emailTemplates[eType] ?? EMAIL_TEMPLATE_DEFAULTS[eType].body;
        const subject = emailSubjects[eType]  ?? EMAIL_TEMPLATE_DEFAULTS[eType].subject;
        const payload = isPlainText(eType)
          ? { type: 'EMAIL' as const, subject, body_text: body }
          : { type: 'EMAIL' as const, subject, body_html: body };
        const res = await api.post(API_ROUTES.SYSTEM.COMMUNICATION_TEMPLATES, {
          ...(commIds[eType] ? { id: commIds[eType] } : {}),
          code: EMAIL_CODE_MAP[eType],
          name: t(SECTION_GROUPS[1].items.find((i) => i.type === eType)!.labelKey as any),
          is_active: true, ...payload,
        }, undefined, undefined, MUTATION_OPTIONS);
        throwIfBackendError(res);
        return { type, body, subject, id: res?.id as string | undefined };
      }
      const waType = type as WhatsappTemplateType;
      const body   = whatsappTemplates[waType] ?? WHATSAPP_TEMPLATE_DEFAULTS[waType];
      const res    = await api.post(API_ROUTES.SYSTEM.COMMUNICATION_TEMPLATES, {
        ...(commIds[waType] ? { id: commIds[waType] } : {}),
        code: WHATSAPP_CODE_MAP[waType], name: t(SECTION_GROUPS[2].items.find((i) => i.type === waType)!.labelKey as any),
        type: 'WHATSAPP', body_text: body, is_active: true,
      }, undefined, undefined, MUTATION_OPTIONS);
      throwIfBackendError(res);
      return { type, body, subject: undefined, id: res?.id as string | undefined };
    },
    {
      onSuccess: ({ type, body, subject, id }) => {
        const section = getSectionOf(type);
        if (section === 'document') {
          updateSaved((prev) => ({ ...prev, doc: { ...prev.doc, [type]: body } }));
          syncPrintStore({ ...savedRef.current.doc });
        } else if (section === 'email') {
          updateSaved((prev) => ({ ...prev, email: { ...prev.email, [type]: body }, subjects: { ...prev.subjects, [type]: subject ?? '' } }));
        } else {
          updateSaved((prev) => ({ ...prev, whatsapp: { ...prev.whatsapp, [type]: body } }));
        }
        if (id) setCommIds((prev) => ({ ...prev, [type]: id }));
        invalidateCommTemplatesCache();
        toast({ title: t('saveSuccess'), description: t(SECTION_GROUPS.flatMap((g) => g.items).find((i) => i.type === type)!.labelKey as any) });
      },
      // The upsert may have been applied before the timeout: reload (keeps unsaved edits) so a retry
      // updates the record instead of creating a second one.
      onError: (error) => { if (isTimeoutError(error)) reload(); },
      errorTitle: t('saveError'),
    }
  );

  // ── Reset ──────────────────────────────────────────────────────────────────
  const reset = useKeyedAsyncAction(
    async (type: AllTemplateType) => {
      const section = getSectionOf(type);
      try {
        if (section === 'document') {
          await api.delete(API_ROUTES.PRINT_TEMPLATES_DELETE, { template_type: type }, undefined, undefined, MUTATION_OPTIONS);
        } else {
          const id = commIds[type as EmailTemplateType | WhatsappTemplateType];
          if (id) await api.delete(API_ROUTES.SYSTEM.COMMUNICATION_TEMPLATES, { id }, undefined, undefined, MUTATION_OPTIONS);
        }
      } catch (error) {
        if (!isNotFound(error)) throw error;
      }
      return type;
    },
    {
      onSuccess: (type) => {
        const section = getSectionOf(type);
        if (section === 'document') {
          const defaultHtml = PRINT_TEMPLATE_DEFAULTS[type as PrintDocumentType];
          setDocTemplates((prev) => ({ ...prev, [type]: defaultHtml }));
          updateSaved((prev) => { const doc = { ...prev.doc }; delete doc[type as PrintDocumentType]; return { ...prev, doc }; });
          syncPrintStore({ ...savedRef.current.doc });
          editorRefs.current[type as PrintDocumentType]?.setValue(defaultHtml);
        } else if (section === 'email') {
          const eType = type as EmailTemplateType;
          const defaults = EMAIL_TEMPLATE_DEFAULTS[eType];
          setEmailTemplates((prev) => ({ ...prev, [eType]: defaults.body }));
          setEmailSubjects((prev) => ({ ...prev, [eType]: defaults.subject }));
          updateSaved((prev) => {
            const email = { ...prev.email }; delete email[eType];
            const subjects = { ...prev.subjects }; delete subjects[eType];
            return { ...prev, email, subjects };
          });
          if (!isPlainText(eType)) editorRefs.current[eType]?.setValue(defaults.body);
        } else {
          const waType = type as WhatsappTemplateType;
          setWhatsappTemplates((prev) => ({ ...prev, [waType]: WHATSAPP_TEMPLATE_DEFAULTS[waType] }));
          updateSaved((prev) => { const whatsapp = { ...prev.whatsapp }; delete whatsapp[waType]; return { ...prev, whatsapp }; });
        }
        if (section !== 'document') {
          setCommIds((prev) => { const n = { ...prev }; delete n[type as EmailTemplateType | WhatsappTemplateType]; return n; });
        }
        invalidateCommTemplatesCache();
        setResetTarget(null);
        toast({ title: t('resetSuccess') });
      },
      onError: (error) => { if (isTimeoutError(error)) reload(); },
      errorTitle: t('resetError'),
    }
  );

  // ── Variable list for active type ──────────────────────────────────────────
  const variables = activeSection === 'document'
    ? PRINT_TEMPLATE_VARIABLES[activeType as PrintDocumentType]
    : activeSection === 'email'
      ? EMAIL_TEMPLATE_VARIABLES[activeType as EmailTemplateType]
      : WHATSAPP_TEMPLATE_VARIABLES[activeType as WhatsappTemplateType];

  const groupedVars = GROUP_ORDER
    .map((g) => ({ group: g, vars: variables.filter((v) => v.group === g) }))
    .filter((g) => g.vars.length > 0);

  const monacoTheme = resolvedTheme === 'dark' ? 'vs-dark' : 'light';
  const activeItem  = SECTION_GROUPS.flatMap((g) => g.items).find((i) => i.type === activeType)!;
  const activeLabel = t(activeItem.labelKey as any);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t('loadError')}</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>{loadError}</span>
            <Button size="sm" variant="outline" onClick={() => reload()} loading={isRefreshing}>
              {tCommon('retry')}
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const isActiveBusy = save.isPending(activeType) || reset.isPending(activeType);
  const resetTargetLabel = resetTarget ? t(SECTION_GROUPS.flatMap((g) => g.items).find((i) => i.type === resetTarget)!.labelKey as any) : '';

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left sidebar ─────────────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-52 border-r shrink-0 bg-muted/10 overflow-y-auto">
        <div className="flex items-center gap-2 px-3 py-3 border-b">
          <FileText className="h-4 w-4 text-primary shrink-0" />
          <span className="text-xs font-semibold truncate">{t('title')}</span>
        </div>
        <nav className="flex flex-col py-1">
          {SECTION_GROUPS.map(({ section, headerKey, items }) => (
            <React.Fragment key={section}>
              <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                {t(headerKey as any)}
              </p>
              {items.map(({ type, labelKey, Icon }) => {
                const isActive = type === activeType;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setActiveType(type)}
                    className={cn(
                      'relative flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left w-full',
                      isActive
                        ? 'text-primary bg-primary/8 font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                    )}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r-full bg-primary" />
                    )}
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate text-xs">{t(labelKey as any)}</span>
                    {isTypeDirty(type) && (
                      <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" title={t('unsavedChanges')} aria-label={t('unsavedChanges')} />
                    )}
                  </button>
                );
              })}
            </React.Fragment>
          ))}
        </nav>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Mobile: horizontal scroll tabs */}
        <div className="md:hidden flex overflow-x-auto shrink-0 border-b bg-muted/10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SECTION_GROUPS.map(({ items }) =>
            items.map(({ type, labelKey, Icon }) => {
              const isActive = type === activeType;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => { setActiveType(type); setMobileView('code'); }}
                  className={cn(
                    'relative flex items-center gap-1.5 px-4 py-2.5 text-xs whitespace-nowrap shrink-0 transition-colors',
                    isActive ? 'text-primary font-medium' : 'text-muted-foreground',
                  )}
                >
                  {isActive && <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-t-full bg-primary" />}
                  <Icon className="h-3.5 w-3.5" />
                  {t(labelKey as any)}
                </button>
              );
            })
          )}
        </div>

        {/* ── Action bar ────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-3 py-2 border-b bg-background shrink-0 z-10">
          <span className="hidden md:block text-sm font-medium text-foreground truncate">{activeLabel}</span>

          {/* Variable insertion */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={!canEdit} className="h-8 gap-1.5">
                <Code2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('insertVariable')}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 max-h-96 overflow-y-auto">
              {groupedVars.map(({ group, vars }) => (
                <React.Fragment key={group}>
                  <DropdownMenuLabel className="text-xs">{t(`groups.${group}` as any)}</DropdownMenuLabel>
                  {vars.map((v) => (
                    <DropdownMenuItem
                      key={v.key}
                      onSelect={() => insertAtCursor(v.key)}
                      className="font-mono text-xs cursor-pointer"
                    >
                      <span className="flex-1 truncate">{v.key}</span>
                      <span className="ml-2 text-muted-foreground font-sans text-[10px] shrink-0">{v.label}</span>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </React.Fragment>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Expand editor */}
          <Button
            variant="ghost" size="icon"
            className="hidden md:flex h-8 w-8 shrink-0"
            onClick={() => setEditorExpanded((v) => !v)}
            title={editorExpanded ? t('splitView') : t('expandEditor')}
          >
            {editorExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>

          {/* Mobile code/preview toggle */}
          <div className="md:hidden flex items-center rounded-md border overflow-hidden text-xs ml-1">
            <button
              type="button"
              onClick={() => setMobileView('code')}
              className={cn('flex items-center gap-1 px-2.5 py-1.5 transition-colors',
                mobileView === 'code' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
            >
              {isPlainText(activeType) ? <MessageSquare className="h-3 w-3" /> : <Code2 className="h-3 w-3" />}
              {isPlainText(activeType) ? t('textMode') : 'HTML'}
            </button>
            <button
              type="button"
              onClick={() => setMobileView('preview')}
              className={cn('flex items-center gap-1 px-2.5 py-1.5 border-l transition-colors',
                mobileView === 'preview' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
            >
              <Eye className="h-3 w-3" /> {t('preview')}
            </button>
          </div>

          <div className="flex-1" />

          {canEdit && (
            <>
              <Button
                onClick={() => save.run(activeType, activeType)}
                disabled={isActiveBusy}
                aria-busy={save.isPending(activeType) || undefined}
                size="sm"
                className="h-8 gap-1.5"
                aria-label={t('save')}
              >
                {save.isPending(activeType) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{t('save')}</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => setResetTarget(activeType)}
                disabled={isActiveBusy}
                size="sm"
                className="h-8 gap-1.5"
                aria-label={t('resetDefault')}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('resetDefault')}</span>
              </Button>
            </>
          )}
        </div>

        {/* ── Subject field (email only) ────────────────────────────────── */}
        {activeSection === 'email' && !isPlainText(activeType) && (
          <div className="flex items-center gap-2 px-3 py-2 border-b bg-background shrink-0">
            <span className="text-xs text-muted-foreground shrink-0 w-14">{t('subject')}</span>
            <Input
              className="h-7 text-sm"
              disabled={!canEdit}
              value={emailSubjects[activeType as EmailTemplateType] ?? EMAIL_TEMPLATE_DEFAULTS[activeType as EmailTemplateType].subject}
              onChange={(e) => setEmailSubjects((prev) => ({ ...prev, [activeType]: e.target.value }))}
              placeholder={t('subjectPlaceholder')}
            />
          </div>
        )}

        {/* ── Editor + Preview ──────────────────────────────────────────── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* ── Left pane: editor ── */}
          <div className={cn(
            'flex flex-col min-w-0',
            editorExpanded ? 'flex-1' : 'flex-1 md:flex-none md:w-1/2',
            mobileView === 'preview' ? 'hidden md:flex' : 'flex',
          )}>
            {/* Document editors */}
            {DOC_ITEMS.map(({ type }) => (
              <div key={type} className={cn('flex-1 min-h-0', type === activeType ? 'block' : 'hidden')}>
                <Editor
                  language="html"
                  value={docTemplates[type as PrintDocumentType] ?? PRINT_TEMPLATE_DEFAULTS[type as PrintDocumentType]}
                  theme={monacoTheme}
                  height="100%"
                  options={{ minimap: { enabled: false }, fontSize: 12, wordWrap: 'on', lineNumbers: 'on', scrollBeyondLastLine: false, formatOnPaste: true, tabSize: 2, automaticLayout: true, readOnly: !canEdit, padding: { top: 8 }, overviewRulerLanes: 0, folding: true }}
                  onMount={(editor, monaco) => handleEditorMount(editor, monaco, type as PrintDocumentType)}
                />
              </div>
            ))}
            {/* Email editors (rich HTML only) */}
            {EMAIL_ITEMS.map(({ type }) => (
              <div key={type} className={cn('flex-1 min-h-0', type === activeType ? 'block' : 'hidden')}>
                <Editor
                  language="html"
                  value={emailTemplates[type as EmailTemplateType] ?? EMAIL_TEMPLATE_DEFAULTS[type as EmailTemplateType].body}
                  theme={monacoTheme}
                  height="100%"
                  options={{ minimap: { enabled: false }, fontSize: 12, wordWrap: 'on', lineNumbers: 'on', scrollBeyondLastLine: false, formatOnPaste: true, tabSize: 2, automaticLayout: true, readOnly: !canEdit, padding: { top: 8 }, overviewRulerLanes: 0, folding: true }}
                  onMount={(editor, monaco) => handleEditorMount(editor, monaco, type as EmailTemplateType)}
                />
              </div>
            ))}
            {/* Plain-text textarea (SMS / WhatsApp / email_alert_followup) */}
            {isPlainText(activeType) && (
              <div className="flex-1 min-h-0 p-4">
                <Textarea
                  ref={plainTextareaRef}
                  className="h-full font-mono text-sm resize-none"
                  disabled={!canEdit}
                  value={getCurrentBody(activeType)}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (activeSection === 'whatsapp') setWhatsappTemplates((s) => ({ ...s, [activeType]: val }));
                    else                             setEmailTemplates((s) => ({ ...s, [activeType]: val }));
                  }}
                />
              </div>
            )}
          </div>

          {/* ── Right pane: preview ── */}
          {!editorExpanded && (
            <div className={cn(
              'overflow-auto border-l',
              !isPlainText(activeType) && activeSection !== 'whatsapp' && 'bg-white',
              mobileView === 'code' ? 'hidden md:block md:flex-1' : 'flex-1',
            )}>
              {!isPlainText(activeType) ? (
                <div
                  className={cn('p-8 text-sm', activeSection === 'document' && 'print-template-root')}
                  dangerouslySetInnerHTML={{ __html: previewContent }}
                />
              ) : (
                <div className="p-6 flex flex-col items-start gap-2">
                  <p className="text-xs text-muted-foreground">{t('preview')}</p>
                  <div className="bg-muted/40 rounded-2xl rounded-tl-sm px-4 py-3 max-w-xs border text-sm leading-relaxed whitespace-pre-wrap">
                    {previewContent}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      <ConfirmActionDialog
        open={resetTarget !== null}
        onOpenChange={(open) => { if (!open) setResetTarget(null); }}
        title={t('resetConfirm.title')}
        description={t('resetConfirm.description', { name: resetTargetLabel })}
        cancelLabel={t('resetConfirm.cancel')}
        confirmLabel={t('resetDefault')}
        onConfirm={() => { if (resetTarget) reset.run(resetTarget, resetTarget); }}
        isPending={resetTarget !== null && reset.isPending(resetTarget)}
      />
    </div>
  );
}
