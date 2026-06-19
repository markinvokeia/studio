'use client';

import * as React from 'react';
import Editor, { type Monaco } from '@monaco-editor/react';
import { format } from 'date-fns';
import {
  Code2, Eye, FileText, Loader2, Maximize2, Minimize2,
  RefreshCw, Receipt, FileCheck, CreditCard, Wallet, Save, BookOpen,
  Mail, MessageSquare,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { useClinicInfo } from '@/hooks/useClinicInfo';
import { BUSINESS_CONFIG_PERMISSIONS } from '@/constants/permissions';
import { PRINT_TEMPLATE_DEFAULTS } from '@/lib/print-template-defaults';
import { PRINT_TEMPLATE_VARIABLES } from '@/lib/print-template-variables';
import { EMAIL_TEMPLATE_DEFAULTS, SMS_TEMPLATE_DEFAULTS, EMAIL_CODE_MAP, SMS_CODE_MAP } from '@/lib/email-template-defaults';
import { EMAIL_TEMPLATE_VARIABLES, SMS_TEMPLATE_VARIABLES, WHATSAPP_TEMPLATE_VARIABLES } from '@/lib/email-template-variables';
import { WHATSAPP_TEMPLATE_DEFAULTS, WHATSAPP_CODE_MAP } from '@/lib/whatsapp-template-defaults';
import { invalidateCommTemplatesCache } from '@/hooks/useCommunicationTemplates';
import { usePrintDocumentStore } from '@/stores/print-document-store';
import type { PrintDocumentType } from '@/stores/print-document-store';
import type { EmailTemplateType, SmsTemplateType } from '@/lib/email-template-defaults';
import type { WhatsappTemplateType } from '@/lib/whatsapp-template-defaults';
import type { DocPrintTemplate, CommunicationTemplate } from '@/lib/types';

// ── Types ──────────────────────────────────────────────────────────────────────

type EditorRef = Parameters<NonNullable<React.ComponentProps<typeof Editor>['onMount']>>[0];
type TemplateSection = 'document' | 'email' | 'sms' | 'whatsapp';
type AllTemplateType = PrintDocumentType | EmailTemplateType | SmsTemplateType | WhatsappTemplateType;

const GROUP_ORDER: Array<'clinic' | 'document' | 'patient' | 'tables' | 'appointment' | 'alert' | 'treatment' | 'cash'> =
  ['clinic', 'document', 'patient', 'appointment', 'alert', 'treatment', 'cash', 'tables'];

// Types that use a plain-text textarea instead of Monaco
const PLAIN_TEXT_TYPES = new Set<string>(['sms_appointment_reminder', 'sms_appointment_confirmation', 'whatsapp_patient_general', 'whatsapp_alert_followup', 'whatsapp_treatment_interrupted', 'email_alert_followup']);
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
      { type: 'email_cash_opening',             labelKey: 'tabs.email_cash_opening',             Icon: Mail, section: 'email' },
      { type: 'email_cash_closing',             labelKey: 'tabs.email_cash_closing',             Icon: Mail, section: 'email' },
      { type: 'email_financial_summary',        labelKey: 'tabs.email_financial_summary',        Icon: Mail, section: 'email' },
      { type: 'email_treatment_update',         labelKey: 'tabs.email_treatment_update',         Icon: Mail, section: 'email' },
      { type: 'email_password_reset',           labelKey: 'tabs.email_password_reset',           Icon: Mail, section: 'email' },
    ],
  },
  {
    section: 'sms',
    headerKey: 'sections.sms',
    items: [
      { type: 'sms_appointment_reminder',     labelKey: 'tabs.sms_appointment_reminder',     Icon: MessageSquare, section: 'sms' },
      { type: 'sms_appointment_confirmation', labelKey: 'tabs.sms_appointment_confirmation', Icon: MessageSquare, section: 'sms' },
    ],
  },
  {
    section: 'whatsapp',
    headerKey: 'sections.whatsapp',
    items: [
      { type: 'whatsapp_patient_general',       labelKey: 'tabs.whatsapp_patient_general',       Icon: MessageSquare, section: 'whatsapp' },
      { type: 'whatsapp_alert_followup',        labelKey: 'tabs.whatsapp_alert_followup',        Icon: MessageSquare, section: 'whatsapp' },
      { type: 'whatsapp_treatment_interrupted', labelKey: 'tabs.whatsapp_treatment_interrupted', Icon: MessageSquare, section: 'whatsapp' },
    ],
  },
];

const DOC_ITEMS      = SECTION_GROUPS[0].items;
const EMAIL_ITEMS    = SECTION_GROUPS[1].items.filter((i) => !isPlainText(i.type));
const WHATSAPP_ITEMS = SECTION_GROUPS[3].items;

function getSectionOf(type: AllTemplateType): TemplateSection {
  if ((type as string).startsWith('email_'))    return 'email';
  if ((type as string).startsWith('sms_'))      return 'sms';
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
    currency: 'UYU', patient_name: 'Ana García', reference: 'PRE-0015', original_invoice: 'FAC-0021',
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
  const sampleCurrencies = `<table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="background:#f9fafb;"><th style="padding:6px 8px;">Moneda</th><th style="padding:6px 8px;">Apertura</th><th style="padding:6px 8px;">Declarado</th><th style="padding:6px 8px;">Calculado</th></tr></thead><tbody><tr><td style="padding:6px 8px;">UYU</td><td style="padding:6px 8px;">1000</td><td style="padding:6px 8px;">1500</td><td style="padding:6px 8px;">1500</td></tr></tbody></table>`;
  const sampleOpening = `<table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="background:#f9fafb;"><th style="padding:6px 8px;">Denominación</th><th style="padding:6px 8px;">Cantidad</th><th style="padding:6px 8px;">Total</th></tr></thead><tbody><tr><td style="padding:6px 8px;">UYU 500</td><td style="padding:6px 8px;">2</td><td style="padding:6px 8px;">UYU 1000</td></tr></tbody></table>`;
  const v: Record<string, string> = {
    clinic_name: clinicName || 'Mi Clínica Demo', clinic_logo: clinicLogoUrl || '',
    clinic_address: clinicAddress || 'Av. Principal 123', clinic_phone: clinicPhone || '+598 99 000 000',
    clinic_email: clinicEmail || 'contacto@miclinica.com',
    patient_name: 'Ana García', patient_email: 'ana@example.com',
    doc_no: type === 'email_invoice' ? 'FAC-0021' : type === 'email_quote' || type === 'email_quote_approved' || type === 'email_quote_rejected' ? 'PRE-0015' : 'PAG-0042',
    date: '28/05/2026', status: 'Registrada', currency: 'UYU',
    total: '800', amount: '800', method: 'Efectivo', items_table: sampleItems,
    exchange_rate: '1.00',
    appointment_date: '30/06/2026', appointment_time: '10:00',
    doctor_name: 'Dra. Martínez', location: 'Consultorio 2 — Av. Principal 123',
    session_id: 'SES-0042', cash_point_name: 'Caja Principal', user_name: 'Admin',
    opened_at: '28/05/2026 08:00', closed_at: '28/05/2026 18:00',
    opening_table: sampleOpening, movements_table: sampleMovements, currencies_table: sampleCurrencies,
    date_from: '01/05/2026', date_to: '28/05/2026',
    service_name: 'Ortodoncia', treatment_status: 'En progreso', treatment_date: '28/05/2026',
    reset_link: '#',
  };
  return html.replace(/\{\{(\w+)\}\}/g, (_, key: string) => v[key] ?? `[${key}]`);
}

function substituteSmsForPreview(text: string, clinicName: string, clinicPhone: string): string {
  const v: Record<string, string> = {
    clinic_name: clinicName || 'Mi Clínica Demo', clinic_phone: clinicPhone || '+598 99 000 000',
    clinic_email: '', patient_name: 'Ana García',
    appointment_date: '30/06/2026', appointment_time: '10:00',
    doctor_name: 'Dra. Martínez', location: 'Consultorio 2',
  };
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => v[key] ?? `[${key}]`);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const t = useTranslations('Config.Templates');
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
  const [smsTemplates, setSmsTemplates]       = React.useState<Partial<Record<SmsTemplateType, string>>>({});
  const [whatsappTemplates, setWhatsappTemplates] = React.useState<Partial<Record<WhatsappTemplateType, string>>>({});
  const [commIds, setCommIds] = React.useState<Partial<Record<EmailTemplateType | SmsTemplateType | WhatsappTemplateType, string>>>({});

  const [isLoading, setIsLoading]           = React.useState(true);
  const [saving, setSaving]                 = React.useState<AllTemplateType | null>(null);
  const [resetting, setResetting]           = React.useState<AllTemplateType | null>(null);
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
    if (section === 'sms')       return smsTemplates[type as SmsTemplateType]       ?? SMS_TEMPLATE_DEFAULTS[type as SmsTemplateType];
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
        setPreviewContent(substituteSmsForPreview(content, cn, ph));
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeType, docTemplates, emailTemplates, smsTemplates, whatsappTemplates, clinic]);

  // ── Load templates ─────────────────────────────────────────────────────────
  React.useEffect(() => {
    const loadAll = async () => {
      try {
        // Document templates
        const docRaw = await api.get(API_ROUTES.PRINT_TEMPLATES).catch(() => []);
        const loaded: Partial<Record<PrintDocumentType, string>> = {};
        (Array.isArray(docRaw) ? docRaw as DocPrintTemplate[] : [])
          .forEach((tpl) => { loaded[tpl.template_type] = tpl.template_html; });
        setDocTemplates(loaded);

        // Email + SMS templates (communication templates)
        const commRaw = await api.get(API_ROUTES.SYSTEM.COMMUNICATION_TEMPLATES).catch(() => []);
        const comms: CommunicationTemplate[] = Array.isArray(commRaw) ? commRaw : [];

        const loadedEmail:    Partial<Record<EmailTemplateType, string>>    = {};
        const loadedSubj:     Partial<Record<EmailTemplateType, string>>    = {};
        const loadedSms:      Partial<Record<SmsTemplateType, string>>      = {};
        const loadedWhatsapp: Partial<Record<WhatsappTemplateType, string>> = {};
        const ids: Partial<Record<EmailTemplateType | SmsTemplateType | WhatsappTemplateType, string>> = {};

        const codeToEmail    = Object.fromEntries(Object.entries(EMAIL_CODE_MAP).map(([k, v]) => [v, k as EmailTemplateType]));
        const codeToSms      = Object.fromEntries(Object.entries(SMS_CODE_MAP).map(([k, v]) => [v, k as SmsTemplateType]));
        const codeToWhatsapp = Object.fromEntries(Object.entries(WHATSAPP_CODE_MAP).map(([k, v]) => [v, k as WhatsappTemplateType]));

        comms.forEach((tpl) => {
          const emailType = codeToEmail[tpl.code];
          if (emailType) {
            loadedEmail[emailType] = isPlainText(emailType) ? (tpl.body_text || tpl.body_html || '') : (tpl.body_html || '');
            loadedSubj[emailType]  = tpl.subject || '';
            if (tpl.id) ids[emailType] = tpl.id;
          }
          const smsType = codeToSms[tpl.code];
          if (smsType) {
            loadedSms[smsType] = tpl.body_text || tpl.body_html || '';
            if (tpl.id) ids[smsType] = tpl.id;
          }
          const waType = codeToWhatsapp[tpl.code];
          if (waType) {
            loadedWhatsapp[waType] = tpl.body_text || tpl.body_html || '';
            if (tpl.id) ids[waType] = tpl.id;
          }
        });

        setEmailTemplates(loadedEmail);
        setEmailSubjects(loadedSubj);
        setSmsTemplates(loadedSms);
        setWhatsappTemplates(loadedWhatsapp);
        setCommIds(ids);
      } finally {
        setIsLoading(false);
      }
    };
    loadAll();
  }, []);

  // ── Cursor insertion ───────────────────────────────────────────────────────
  function insertAtCursor(text: string) {
    if (isPlainText(activeType)) {
      const textarea = plainTextareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end   = textarea.selectionEnd;
      const prev  = textarea.value;
      const next  = prev.substring(0, start) + text + prev.substring(end);
      if (activeSection === 'sms')      setSmsTemplates((s) => ({ ...s, [activeType]: next }));
      else if (activeSection === 'whatsapp') setWhatsappTemplates((s) => ({ ...s, [activeType]: next }));
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
  async function handleSave(type: AllTemplateType) {
    if (!canEdit) return;
    setSaving(type);
    try {
      const section = getSectionOf(type);

      if (section === 'document') {
        const html = docTemplates[type as PrintDocumentType] ?? PRINT_TEMPLATE_DEFAULTS[type as PrintDocumentType];
        await api.post(API_ROUTES.PRINT_TEMPLATES_UPSERT, { template_type: type, template_html: html, is_active: true });
        setCustomTemplates(DOC_ITEMS.map((tt) => ({
          id: '', clinic_id: '', template_type: tt.type as PrintDocumentType,
          template_html: docTemplates[tt.type as PrintDocumentType] ?? PRINT_TEMPLATE_DEFAULTS[tt.type as PrintDocumentType],
          is_active: true, createdAt: '', updatedAt: '',
        })));
      } else if (section === 'email') {
        const eType   = type as EmailTemplateType;
        const body    = emailTemplates[eType] ?? EMAIL_TEMPLATE_DEFAULTS[eType].body;
        const subject = emailSubjects[eType]  ?? EMAIL_TEMPLATE_DEFAULTS[eType].subject;
        const payload = isPlainText(eType)
          ? { type: 'EMAIL' as const, subject, body_text: body }
          : { type: 'EMAIL' as const, subject, body_html: body };
        const saved = await api.post(API_ROUTES.SYSTEM.COMMUNICATION_TEMPLATES, {
          ...(commIds[eType] ? { id: commIds[eType] } : {}),
          code: EMAIL_CODE_MAP[eType],
          name: t(SECTION_GROUPS[1].items.find((i) => i.type === eType)!.labelKey as any),
          is_active: true, ...payload,
        });
        if (saved?.id) setCommIds((prev) => ({ ...prev, [eType]: saved.id }));
      } else if (section === 'sms') {
        const sType = type as SmsTemplateType;
        const body  = smsTemplates[sType] ?? SMS_TEMPLATE_DEFAULTS[sType];
        const saved = await api.post(API_ROUTES.SYSTEM.COMMUNICATION_TEMPLATES, {
          ...(commIds[sType] ? { id: commIds[sType] } : {}),
          code: SMS_CODE_MAP[sType], name: t(SECTION_GROUPS[2].items.find((i) => i.type === sType)!.labelKey as any),
          type: 'SMS', body_text: body, is_active: true,
        });
        if (saved?.id) setCommIds((prev) => ({ ...prev, [sType]: saved.id }));
      } else {
        const waType = type as WhatsappTemplateType;
        const body   = whatsappTemplates[waType] ?? WHATSAPP_TEMPLATE_DEFAULTS[waType];
        const saved  = await api.post(API_ROUTES.SYSTEM.COMMUNICATION_TEMPLATES, {
          ...(commIds[waType] ? { id: commIds[waType] } : {}),
          code: WHATSAPP_CODE_MAP[waType], name: t(SECTION_GROUPS[3].items.find((i) => i.type === waType)!.labelKey as any),
          type: 'WHATSAPP', body_text: body, is_active: true,
        });
        if (saved?.id) setCommIds((prev) => ({ ...prev, [waType]: saved.id }));
      }

      invalidateCommTemplatesCache();
      toast({ title: t('saveSuccess') });
    } catch {
      toast({ title: t('saveError'), variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  }

  // ── Reset ──────────────────────────────────────────────────────────────────
  async function handleReset(type: AllTemplateType) {
    if (!canEdit) return;
    setResetting(type);
    try {
      const section = getSectionOf(type);

      if (section === 'document') {
        try { await api.delete(API_ROUTES.PRINT_TEMPLATES_DELETE, { template_type: type }); } catch { /* not saved yet */ }
        const defaultHtml = PRINT_TEMPLATE_DEFAULTS[type as PrintDocumentType];
        setDocTemplates((prev) => ({ ...prev, [type]: defaultHtml }));
        editorRefs.current[type as PrintDocumentType]?.setValue(defaultHtml);
      } else if (section === 'email') {
        const eType = type as EmailTemplateType;
        const id = commIds[eType];
        if (id) try { await api.delete(API_ROUTES.SYSTEM.COMMUNICATION_TEMPLATES, { id }); } catch { /* ok */ }
        const defaults = EMAIL_TEMPLATE_DEFAULTS[eType];
        setEmailTemplates((prev) => ({ ...prev, [eType]: defaults.body }));
        setEmailSubjects((prev) => ({ ...prev, [eType]: defaults.subject }));
        setCommIds((prev) => { const n = { ...prev }; delete n[eType]; return n; });
        if (!isPlainText(eType)) editorRefs.current[eType]?.setValue(defaults.body);
      } else if (section === 'sms') {
        const sType = type as SmsTemplateType;
        const id = commIds[sType];
        if (id) try { await api.delete(API_ROUTES.SYSTEM.COMMUNICATION_TEMPLATES, { id }); } catch { /* ok */ }
        setSmsTemplates((prev) => ({ ...prev, [sType]: SMS_TEMPLATE_DEFAULTS[sType] }));
        setCommIds((prev) => { const n = { ...prev }; delete n[sType]; return n; });
      } else {
        const waType = type as WhatsappTemplateType;
        const id = commIds[waType];
        if (id) try { await api.delete(API_ROUTES.SYSTEM.COMMUNICATION_TEMPLATES, { id }); } catch { /* ok */ }
        setWhatsappTemplates((prev) => ({ ...prev, [waType]: WHATSAPP_TEMPLATE_DEFAULTS[waType] }));
        setCommIds((prev) => { const n = { ...prev }; delete n[waType]; return n; });
      }

      invalidateCommTemplatesCache();
      toast({ title: t('resetSuccess') });
    } finally {
      setResetting(null);
    }
  }

  // ── Variable list for active type ──────────────────────────────────────────
  const variables = activeSection === 'document'
    ? PRINT_TEMPLATE_VARIABLES[activeType as PrintDocumentType]
    : activeSection === 'email'
      ? EMAIL_TEMPLATE_VARIABLES[activeType as EmailTemplateType]
      : activeSection === 'sms'
        ? SMS_TEMPLATE_VARIABLES[activeType as SmsTemplateType]
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
              {isPlainText(activeType) ? 'Texto' : 'HTML'}
            </button>
            <button
              type="button"
              onClick={() => setMobileView('preview')}
              className={cn('flex items-center gap-1 px-2.5 py-1.5 border-l transition-colors',
                mobileView === 'preview' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
            >
              <Eye className="h-3 w-3" /> Vista
            </button>
          </div>

          <div className="flex-1" />

          {canEdit && (
            <>
              <Button onClick={() => handleSave(activeType)} disabled={saving === activeType} size="sm" className="h-8 gap-1.5">
                {saving === activeType ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{t('save')}</span>
              </Button>
              <Button variant="outline" onClick={() => handleReset(activeType)} disabled={resetting === activeType} size="sm" className="h-8 gap-1.5">
                {resetting === activeType ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
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
                    if (activeSection === 'sms')           setSmsTemplates((s) => ({ ...s, [activeType]: val }));
                    else if (activeSection === 'whatsapp') setWhatsappTemplates((s) => ({ ...s, [activeType]: val }));
                    else                                   setEmailTemplates((s) => ({ ...s, [activeType]: val }));
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
    </div>
  );
}
