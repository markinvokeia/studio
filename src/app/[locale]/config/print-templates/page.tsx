'use client';

import * as React from 'react';
import Editor, { type Monaco } from '@monaco-editor/react';
import { format } from 'date-fns';
import {
  Code2, Eye, FileText, Loader2, Maximize2, Minimize2,
  RefreshCw, Receipt, FileCheck, CreditCard, Wallet, Save,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
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
import { usePrintDocumentStore } from '@/stores/print-document-store';
import type { PrintDocumentType } from '@/stores/print-document-store';
import type { DocPrintTemplate } from '@/lib/types';

// ── Config ─────────────────────────────────────────────────────────────────────

type EditorRef = Parameters<NonNullable<React.ComponentProps<typeof Editor>['onMount']>>[0];

const TEMPLATE_TYPES: { type: PrintDocumentType; labelKey: string; Icon: React.ElementType }[] = [
  { type: 'invoice',     labelKey: 'tabs.invoice',     Icon: FileCheck  },
  { type: 'quote',       labelKey: 'tabs.quote',        Icon: FileText   },
  { type: 'payment',     labelKey: 'tabs.payment',      Icon: Receipt    },
  { type: 'credit_note', labelKey: 'tabs.credit_note',  Icon: CreditCard },
  { type: 'prepayment',  labelKey: 'tabs.prepayment',   Icon: Wallet     },
];

const GROUP_ORDER: Array<'clinic' | 'document' | 'patient' | 'tables'> = ['clinic', 'document', 'patient', 'tables'];

// ── Preview substitution ───────────────────────────────────────────────────────

function substituteForPreview(
  html: string,
  type: PrintDocumentType,
  clinicName: string, clinicLogoUrl: string,
  clinicAddress: string, clinicPhone: string, clinicEmail: string,
): string {
  const sampleItemsTable = `<table class="print-template-table" style="width:100%;"><thead><tr><th>#</th><th>Servicio</th><th>Cant.</th><th>P. Unit.</th><th>Total</th></tr></thead><tbody><tr><td>1</td><td>Extracción simple</td><td>1</td><td>UYU 500</td><td>UYU 500</td></tr><tr><td>2</td><td>Consulta general</td><td>1</td><td>UYU 300</td><td>UYU 300</td></tr></tbody></table>`;
  const samplePaymentsTable = `<table class="print-template-table" style="width:100%;"><thead><tr><th>Nro. Doc.</th><th>Fecha</th><th>Método</th><th>Monto</th></tr></thead><tbody><tr><td>PAG-0042</td><td>28/05/2026</td><td>Efectivo</td><td style="text-align:right;">UYU 500</td></tr></tbody></table>`;
  const sampleInvoicesSection = `<div style="margin-bottom:1.5rem;"><h2 style="font-size:0.75rem;font-weight:600;text-transform:uppercase;color:#6b7280;margin-bottom:0.5rem;">Facturas</h2><div style="padding-left:0.75rem;border-left:2px solid #e5e7eb;"><div style="font-weight:600;margin-bottom:0.5rem;">Factura #FAC-0021 — 28/05/2026</div>${sampleItemsTable}</div></div>`;

  const ph = clinicPhone && clinicEmail ? ' | ' : '';
  const v: Record<string, string> = {
    clinic_name: clinicName || 'Mi Clínica Demo',
    clinic_logo: clinicLogoUrl || '',
    clinic_address: clinicAddress || 'Av. Principal 123, Ciudad',
    clinic_phone: clinicPhone || '+598 99 000 000',
    clinic_email: clinicEmail || 'contacto@miclinica.com',
    clinic_phone_email_sep: ph || ' | ',
    doc_no: type === 'invoice' ? 'FAC-0021' : type === 'quote' ? 'PRE-0015' : type === 'credit_note' ? 'NC-0003' : 'PAG-0042',
    date: '28/05/2026', due_date: '28/06/2026', status: 'Registrada',
    payment_status: 'Pagado', currency: 'UYU', patient_name: 'Ana García',
    reference: 'PRE-0015', original_invoice: 'FAC-0021',
    total: '800', paid: '500', pending: '300',
    amount_invoiced: '800', pending_invoice: '0', amount_paid: '500', pending_payment: '300',
    method: 'Efectivo', transaction_type: 'Pago directo', exchange_rate: '',
    amount: '800', notes: '',
    generated_at: format(new Date(), 'dd/MM/yyyy HH:mm'),
    items_table: sampleItemsTable,
    payments_table: samplePaymentsTable,
    invoices_section: sampleInvoicesSection,
  };
  return html.replace(/\{\{(\w+)\}\}/g, (_, key: string) => v[key] ?? `[${key}]`);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PrintTemplatesPage() {
  const t = useTranslations('Config.PrintTemplates');
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const { resolvedTheme } = useTheme();
  const clinic = useClinicInfo();
  const { setCustomTemplates } = usePrintDocumentStore();

  const canEdit = hasPermission(BUSINESS_CONFIG_PERMISSIONS.PRINT_TEMPLATES_EDIT);

  const [activeType, setActiveType]     = React.useState<PrintDocumentType>('invoice');
  const [templates, setTemplates]       = React.useState<Partial<Record<PrintDocumentType, string>>>({});
  const [isLoading, setIsLoading]       = React.useState(true);
  const [saving, setSaving]             = React.useState<PrintDocumentType | null>(null);
  const [resetting, setResetting]       = React.useState<PrintDocumentType | null>(null);
  const [mobileView, setMobileView]     = React.useState<'code' | 'preview'>('code');
  const [editorExpanded, setEditorExpanded] = React.useState(false);
  const [previewHtml, setPreviewHtml]   = React.useState('');

  const editorRefs = React.useRef<Partial<Record<PrintDocumentType, EditorRef>>>({});
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Rebuild preview on change
  React.useEffect(() => {
    const raw = templates[activeType] ?? PRINT_TEMPLATE_DEFAULTS[activeType];
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPreviewHtml(substituteForPreview(
        raw, activeType,
        clinic?.name || '', clinic?.logoUrl || '',
        clinic?.address || '', clinic?.phone || '', clinic?.email || '',
      ));
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [templates, activeType, clinic]);

  // Load saved templates
  React.useEffect(() => {
    api.get(API_ROUTES.PRINT_TEMPLATES)
      .then((data: unknown) => {
        const raw = Array.isArray(data) ? (data as DocPrintTemplate[]) : [];
        const loaded: Partial<Record<PrintDocumentType, string>> = {};
        raw.forEach((tpl) => { loaded[tpl.template_type] = tpl.template_html; });
        setTemplates(loaded);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  function insertAtCursor(text: string) {
    const editor = editorRefs.current[activeType];
    if (!editor) return;
    const sel = editor.getSelection();
    if (sel) editor.executeEdits('insert-variable', [{ range: sel, text, forceMoveMarkers: true }]);
    else editor.trigger('keyboard', 'type', { text });
    editor.focus();
  }

  function handleEditorMount(editor: EditorRef, _monaco: Monaco, type: PrintDocumentType) {
    editorRefs.current[type] = editor;
    editor.onDidChangeModelContent(() => {
      setTemplates((prev) => ({ ...prev, [type]: editor.getValue() }));
    });
  }

  async function handleSave(type: PrintDocumentType) {
    if (!canEdit) return;
    setSaving(type);
    try {
      const html = templates[type] ?? PRINT_TEMPLATE_DEFAULTS[type];
      await api.post(API_ROUTES.PRINT_TEMPLATES_UPSERT, { template_type: type, template_html: html, is_active: true });
      setCustomTemplates(TEMPLATE_TYPES.map((tt) => ({
        id: '', clinic_id: '', template_type: tt.type,
        template_html: templates[tt.type] ?? PRINT_TEMPLATE_DEFAULTS[tt.type],
        is_active: true, createdAt: '', updatedAt: '',
      })));
      toast({ title: t('saveSuccess') });
    } catch {
      toast({ title: 'Error al guardar', variant: 'destructive' });
    } finally { setSaving(null); }
  }

  async function handleReset(type: PrintDocumentType) {
    if (!canEdit) return;
    setResetting(type);
    try { await api.delete(API_ROUTES.PRINT_TEMPLATES_DELETE, { template_type: type }); }
    catch { /* no row yet — fine */ }
    const defaultHtml = PRINT_TEMPLATE_DEFAULTS[type];
    setTemplates((prev) => ({ ...prev, [type]: defaultHtml }));
    editorRefs.current[type]?.setValue(defaultHtml);
    setResetting(null);
    toast({ title: t('resetSuccess') });
  }

  const monacoTheme   = resolvedTheme === 'dark' ? 'vs-dark' : 'light';
  const activeLabel   = t(TEMPLATE_TYPES.find((tt) => tt.type === activeType)!.labelKey as any);
  const variables     = PRINT_TEMPLATE_VARIABLES[activeType];
  const groupedVars   = GROUP_ORDER.map((g) => ({ group: g, vars: variables.filter((v) => v.group === g) })).filter((g) => g.vars.length > 0);
  const currentHtml   = templates[activeType] ?? PRINT_TEMPLATE_DEFAULTS[activeType];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    // Stretch to fill whatever height the app shell gives us
    <div className="flex h-full overflow-hidden">

      {/* ── Left sidebar (desktop only) ──────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-48 border-r shrink-0 bg-muted/10 overflow-y-auto">
        <div className="flex items-center gap-2 px-3 py-3 border-b">
          <FileText className="h-4 w-4 text-primary shrink-0" />
          <span className="text-xs font-semibold truncate">{t('title')}</span>
        </div>
        <nav className="flex flex-col py-1">
          {TEMPLATE_TYPES.map(({ type, labelKey, Icon }) => {
            const isActive = type === activeType;
            return (
              <button
                key={type}
                type="button"
                onClick={() => setActiveType(type)}
                className={cn(
                  'relative flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors text-left w-full',
                  isActive
                    ? 'text-primary bg-primary/8 font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r-full bg-primary" />
                )}
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{t(labelKey as any)}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Mobile: template selector (horizontal scroll) */}
        <div className="md:hidden flex overflow-x-auto shrink-0 border-b bg-muted/10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TEMPLATE_TYPES.map(({ type, labelKey, Icon }) => {
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
          })}
        </div>

        {/* ── Sticky action bar ─────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-3 py-2 border-b bg-background shrink-0 z-10">
          {/* Current template label (desktop) */}
          <span className="hidden md:block text-sm font-medium text-foreground">{activeLabel}</span>

          {/* Variable insertion dropdown */}
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

          {/* Expand editor toggle (desktop only) */}
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:flex h-8 w-8 shrink-0"
            onClick={() => setEditorExpanded((v) => !v)}
            title={editorExpanded ? 'Vista dividida' : 'Expandir editor'}
          >
            {editorExpanded
              ? <Minimize2 className="h-3.5 w-3.5" />
              : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>

          {/* Mobile: code/preview toggle */}
          <div className="md:hidden flex items-center rounded-md border overflow-hidden text-xs ml-1">
            <button
              type="button"
              onClick={() => setMobileView('code')}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1.5 transition-colors',
                mobileView === 'code' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Code2 className="h-3 w-3" /> HTML
            </button>
            <button
              type="button"
              onClick={() => setMobileView('preview')}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1.5 transition-colors border-l',
                mobileView === 'preview' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Eye className="h-3 w-3" /> Vista
            </button>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Save + Reset — always visible */}
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

        {/* ── Editor + Preview ──────────────────────────────────────────── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Editor pane */}
          <div className={cn(
            'flex flex-col min-w-0',
            editorExpanded ? 'flex-1' : 'flex-1 md:flex-none md:w-1/2',
            mobileView === 'preview' ? 'hidden md:flex' : 'flex',
          )}>
            {TEMPLATE_TYPES.map(({ type }) => (
              <div
                key={type}
                className={cn('flex-1 min-h-0', type === activeType ? 'block' : 'hidden')}
              >
                <Editor
                  language="html"
                  value={templates[type] ?? PRINT_TEMPLATE_DEFAULTS[type]}
                  theme={monacoTheme}
                  height="100%"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 12,
                    wordWrap: 'on',
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    formatOnPaste: true,
                    tabSize: 2,
                    automaticLayout: true,
                    readOnly: !canEdit,
                    padding: { top: 8 },
                    overviewRulerLanes: 0,
                    folding: true,
                  }}
                  onMount={(editor, monaco) => handleEditorMount(editor, monaco, type)}
                />
              </div>
            ))}
          </div>

          {/* Preview pane (desktop: always; mobile: when mobileView==='preview') */}
          {!editorExpanded && (
            <div className={cn(
              'overflow-auto border-l bg-white',
              mobileView === 'code' ? 'hidden md:block md:flex-1' : 'flex-1',
            )}>
              <div
                className="p-8 print-template-root text-sm"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
