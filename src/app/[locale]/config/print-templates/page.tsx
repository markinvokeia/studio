'use client';

import * as React from 'react';
import Editor, { type Monaco } from '@monaco-editor/react';
import { format } from 'date-fns';
import {
  Code2, Eye, FileText, Loader2, Maximize2, Minimize2,
  RefreshCw, Receipt, FileCheck, CreditCard, Wallet, Save, BookOpen, Banknote,
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
  { type: 'invoice',           labelKey: 'tabs.invoice',           Icon: FileCheck  },
  { type: 'quote',             labelKey: 'tabs.quote',             Icon: FileText   },
  { type: 'payment',           labelKey: 'tabs.payment',           Icon: Receipt    },
  { type: 'credit_note',       labelKey: 'tabs.credit_note',       Icon: CreditCard },
  { type: 'prepayment',        labelKey: 'tabs.prepayment',        Icon: Wallet     },
  { type: 'financial_summary', labelKey: 'tabs.financial_summary', Icon: BookOpen   },
  { type: 'payroll_period',    labelKey: 'tabs.payroll_period',    Icon: Banknote   },
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
  const sampleMovementsTable = `<div style="margin-bottom:1.5rem;"><h2 style="font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;margin-bottom:0.5rem;">Moneda: UYU</h2><div style="border:1px solid #e5e7eb;border-radius:4px;"><table class="print-template-table" style="width:100%;"><thead><tr><th style="text-align:left;width:6rem;">Fecha</th><th style="text-align:left;width:8rem;">Nro. Doc.</th><th style="text-align:left;">Concepto</th><th style="text-align:right;width:7rem;">Monto</th><th style="text-align:right;width:7rem;">Saldo</th></tr></thead><tbody><tr><td>28/05/2026</td><td style="font-family:monospace;font-size:0.72rem;">FAC-0021</td><td>Factura — Extracción simple</td><td style="text-align:right;font-family:monospace;">500</td><td style="text-align:right;font-family:monospace;">500</td></tr><tr><td>28/05/2026</td><td style="font-family:monospace;font-size:0.72rem;">PAG-0042</td><td>Recibo de Pago — Efectivo</td><td style="text-align:right;font-family:monospace;">−500</td><td style="text-align:right;font-family:monospace;">0</td></tr></tbody><tfoot><tr style="border-top:2px solid #d1d5db;"><td colspan="4" style="text-align:right;font-weight:600;">Saldo Final</td><td style="text-align:right;font-weight:700;font-family:monospace;">0</td></tr></tfoot></table></div></div>`;

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
    movements_table: sampleMovementsTable,
    patient_id: '1.234.567-8', patient_email: 'ana@example.com', patient_phone: '+598 99 000 000',
    date_from: '01/05/2026', date_to: '28/05/2026',
    period_label: 'Junio 2026',
    summary_table: `<table class="print-template-table" style="width:100%;"><tbody><tr><td>Bruto</td><td style="text-align:right;">$ 180.000</td></tr><tr><td style="font-weight:700;">Neto</td><td style="text-align:right;font-weight:700;">$ 150.000</td></tr><tr><td style="font-weight:700;">Costo patronal</td><td style="text-align:right;font-weight:700;">$ 210.000</td></tr></tbody></table>`,
    annex_table: `<table class="print-template-table" style="width:100%;font-size:0.7rem;"><thead><tr><th style="text-align:left;">Empleado</th><th style="text-align:right;">Sesiones</th><th style="text-align:right;">Bruto</th><th style="text-align:right;">Neto</th></tr></thead><tbody><tr><td>Dra. Ana López</td><td style="text-align:right;">12</td><td style="text-align:right;">$ 90.000</td><td style="text-align:right;">$ 75.000</td></tr><tr><td>Dr. Manuel Vilano</td><td style="text-align:right;">8</td><td style="text-align:right;">$ 90.000</td><td style="text-align:right;">$ 75.000</td></tr></tbody></table>`,
    annex2_table: `<table class="print-template-table" style="width:100%;font-size:0.6rem;"><thead><tr><th style="text-align:left;">Empleado</th><th style="text-align:right;">Bruto</th><th style="text-align:right;">BPS emp.</th><th style="text-align:right;">IRPF</th><th style="text-align:right;">Neto</th></tr></thead><tbody><tr><td>Dra. Ana López</td><td style="text-align:right;">$ 90.000</td><td style="text-align:right;">$ 13.500</td><td style="text-align:right;">$ 1.200</td><td style="text-align:right;">$ 75.000</td></tr></tbody></table>`,
  };
  return html.replace(/\{\{(\w+)\}\}/g, (_, key: string) => v[key] ?? `[${key}]`);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function OldPrintTemplatesPage() {
  const router = useRouter();
  useEffect(() => { router.replace('../templates'); }, [router]);
  return null;
}
