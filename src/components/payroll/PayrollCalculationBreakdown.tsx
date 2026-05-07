'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import type { PayrollCalculationParams, PayrollEntry, PayrollManualAdjustment } from '@/lib/types';
import { formatCurrency } from '@/components/payroll/payroll-utils';
import { cn } from '@/lib/utils';
import { HelpCircle, Loader2, Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

interface Props {
  entry: PayrollEntry;
  adjustments: PayrollManualAdjustment[];
  contractLabel?: string;
  readonly?: boolean;
  /** Called after a manual edit is persisted so the parent can refetch. */
  onSaved?: () => void;
}

// Every numeric field the backend ENTRIES_UPDATE endpoint accepts + recomputes.
const EDITABLE_FIELDS = [
  'sessions_count', 'hours_worked', 'services_revenue_billed', 'services_revenue_listed',
  'base_amount', 'variable_amount', 'extra_hours_amount', 'gross_salary',
  'bps_employee', 'fonasa_employee', 'frl_employee', 'irpf_withholding', 'other_deductions',
  'bps_employer', 'fonasa_employer', 'frl_employer', 'fgcl_employer', 'bse_employer', 'ccm_employer',
  'aguinaldo_provision', 'vacation_provision',
] as const;
type EditableField = typeof EDITABLE_FIELDS[number];

const n = (v: number | null | undefined) => Number(v ?? 0);
const pct = (part: number, whole: number) => whole > 0 ? `${((part / whole) * 100).toFixed(2)}%` : '—';
const ratePct = (r?: number | null) => r != null ? `${(r * 100).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}%` : '—';

// calculation_params may arrive as a jsonb object or a JSON string depending on the driver.
function parseParams(raw: unknown): PayrollCalculationParams | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as PayrollCalculationParams; } catch { return null; }
  }
  return raw as PayrollCalculationParams;
}

export function PayrollCalculationBreakdown({ entry, adjustments, contractLabel, readonly, onSaved }: Props) {
  const t = useTranslations('PayrollPage.periodDetail.breakdown');
  const tpd = useTranslations('PayrollPage.periodDetail');
  const { toast } = useToast();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<EditableField, string>>(() => buildForm(entry));

  function buildForm(e: PayrollEntry): Record<EditableField, string> {
    return Object.fromEntries(
      EDITABLE_FIELDS.map((f) => [f, String((e as unknown as Record<string, unknown>)[f] ?? '')]),
    ) as Record<EditableField, string>;
  }

  // help text lookup (renders a "?" only when a translation exists)
  const help = (k: string): string | undefined => {
    const key = `help.${k}` as Parameters<typeof t>[0];
    return t.has(key) ? t(key) : undefined;
  };

  const val = (f: EditableField): number =>
    editing ? Number(form[f] || 0) : n((entry as unknown as Record<string, number>)[f]);

  // Live totals — mirror the backend recompute exactly.
  const gross = val('gross_salary');
  const adjSum = adjustments.reduce((s, a) => s + (a.adjustment_type === 'addition' ? a.amount : -a.amount), 0);
  const totalDeductions = val('bps_employee') + val('fonasa_employee') + val('frl_employee') + val('irpf_withholding') + val('other_deductions');
  const netSalary = gross - totalDeductions + adjSum;
  const totalEmployerCost = gross + val('bps_employer') + val('fonasa_employer') + val('frl_employer')
    + val('fgcl_employer') + val('bse_employer') + val('ccm_employer') + val('aguinaldo_provision') + val('vacation_provision');

  const totalAdjAdded = adjustments.filter((a) => a.adjustment_type === 'addition').reduce((s, a) => s + a.amount, 0);
  const totalAdjDeducted = adjustments.filter((a) => a.adjustment_type === 'deduction').reduce((s, a) => s + a.amount, 0);

  // Exact engine rates/caps captured at calc time (transparency reference, read-only).
  const cp = parseParams(entry.calculation_params);
  const capBase = cp?.cap_base ?? null;
  const rateHint = (r: number | undefined, value: number) =>
    (cp && r != null && capBase != null) ? `${formatCurrency(capBase)} × ${ratePct(r)}` : pct(value, gross);

  const baseHint = cp?.calculation_type === 'por_hora'
    ? `${formatCurrency(cp.hourly_rate ?? 0)} × ${val('hours_worked')}h` : undefined;
  const variableHint = (() => {
    if (!cp) return undefined;
    if (cp.calculation_type === 'porcentaje')
      return `${formatCurrency(cp.revenue_base ?? 0)} × ${cp.percentage_rate ?? 0}%`;
    if (cp.calculation_type === 'fijo_porcentaje')
      return `(${formatCurrency(cp.revenue_base ?? 0)} − ${formatCurrency(cp.percentage_threshold ?? 0)}) × ${cp.percentage_rate ?? 0}%`;
    if (cp.calculation_type === 'por_prestacion')
      return `${formatCurrency(cp.per_session_rate ?? 0)} × ${val('sessions_count')}`;
    return undefined;
  })();

  async function handleSave() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { id: entry.id };
      for (const f of EDITABLE_FIELDS) payload[f] = Number(form[f] || 0);
      await api.post(API_ROUTES.PAYROLL.ENTRIES_UPDATE, payload);
      setEditing(false);
      onSaved?.();
    } catch {
      toast({ title: t('saveError'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  function startEdit() {
    setForm(buildForm(entry));
    setEditing(true);
  }

  const rowProps = { editing, form, setForm };

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        {contractLabel
          ? <p className="text-xs text-muted-foreground border rounded-full px-2.5 py-0.5 w-fit">{contractLabel}</p>
          : <span />}
        {!readonly && (
          editing ? (
            <div className="flex items-center gap-1.5">
              <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t('save')}
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditing(false)} disabled={saving}>
                {t('cancel')}
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={startEdit}>
              <Pencil className="h-3 w-3 mr-1" />
              {t('edit')}
            </Button>
          )
        )}
      </div>

      {/* Calculation bases (read-only reference from the engine) */}
      {cp && (
        <Section title={t('basesTitle')} help={help('bases')}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <BaseRow label={t('bases.calcType')} value={cp.calculation_type ? (t.has(`calcTypes.${cp.calculation_type}` as Parameters<typeof t>[0]) ? t(`calcTypes.${cp.calculation_type}` as Parameters<typeof t>[0]) : cp.calculation_type) : '—'} help={help('calcType')} />
            <BaseRow label={t('bases.fonasaSituation')} value={cp.fonasa_family_situation ? (t.has(`fonasaSituations.${cp.fonasa_family_situation}` as Parameters<typeof t>[0]) ? t(`fonasaSituations.${cp.fonasa_family_situation}` as Parameters<typeof t>[0]) : cp.fonasa_family_situation) : '—'} help={help('fonasaSituation')} />
            {(cp.calculation_type === 'porcentaje' || cp.calculation_type === 'fijo_porcentaje') && <>
              <BaseRow label={t('bases.basis')} value={cp.percentage_basis ?? '—'} help={help('basis')} />
              <BaseRow label={t('bases.percentageRate')} value={`${cp.percentage_rate ?? 0}%`} help={help('percentageRate')} />
              <BaseRow label={t('bases.revenueBase')} value={formatCurrency(cp.revenue_base ?? 0)} help={help('revenueBase')} />
            </>}
            {cp.calculation_type === 'fijo_porcentaje' && <BaseRow label={t('bases.threshold')} value={formatCurrency(cp.percentage_threshold ?? 0)} help={help('threshold')} />}
            {cp.calculation_type === 'por_hora' && <BaseRow label={t('bases.hourlyRate')} value={formatCurrency(cp.hourly_rate ?? 0)} help={help('hourlyRate')} />}
            {cp.calculation_type === 'por_prestacion' && <BaseRow label={t('bases.perSessionRate')} value={formatCurrency(cp.per_session_rate ?? 0)} help={help('perSessionRate')} />}
            {cp.calculation_type === 'fijo' && <BaseRow label={t('bases.baseSalary')} value={formatCurrency(cp.base_salary ?? 0)} help={help('baseSalary')} />}
            <BaseRow label={t('bases.capBase')} value={cp.cap_base != null ? formatCurrency(cp.cap_base) : '—'} help={help('capBase')} />
            <BaseRow label={t('bases.bpsCap')} value={formatCurrency(cp.bps_salary_cap_uyu ?? 0)} help={help('bpsCap')} />
            <BaseRow label={t('bases.bpc')} value={formatCurrency(cp.bpc_value_uyu ?? 0)} help={help('bpc')} />
            <BaseRow label={t('bases.vacDays')} value={String(cp.vacation_days_per_year ?? '—')} help={help('vacDays')} />
            <BaseRow label={t('bases.absenceDays')} value={String(cp.absence_days ?? 0)} help={help('absenceDays')} />
            <BaseRow label={t('bases.irpfDeductions')} value={formatCurrency(cp.irpf_deductions_monthly ?? 0)} help={help('irpfDeductions')} />
            {(cp.irpf_deductions_monthly ?? 0) > 0 && <BaseRow label={t('bases.irpfDeductionRate')} value={ratePct(cp.irpf_deduction_rate)} help={help('irpfDeductionRate')} />}
            <BaseRow label={t('bases.bpsEmpRate')} value={ratePct(cp.bps_employee_rate)} help={help('bpsEmpRate')} />
            <BaseRow label={t('bases.fonasaRate')} value={ratePct(cp.fonasa_rate_applied)} help={help('fonasaRate')} />
            <BaseRow label={t('bases.frlEmpRate')} value={ratePct(cp.frl_employee_rate)} help={help('frlEmpRate')} />
            <BaseRow label={t('bases.bpsEmployerRate')} value={ratePct(cp.bps_employer_rate)} help={help('bpsEmployerRate')} />
            <BaseRow label={t('bases.fonasaEmployerRate')} value={ratePct(cp.fonasa_employer_rate)} help={help('fonasaEmployerRate')} />
            <BaseRow label={t('bases.frlEmployerRate')} value={ratePct(cp.frl_employer_rate)} help={help('frlEmployerRate')} />
            <BaseRow label={t('bases.fgclRate')} value={ratePct(cp.fgcl_rate)} help={help('fgclRate')} />
            <BaseRow label={t('bases.bseRate')} value={ratePct(cp.bse_rate)} help={help('bseRate')} />
          </div>
        </Section>
      )}

      {/* Activity inputs that feed the calculation */}
      <Section title={t('activity')} help={help('activity')}>
        <EditRow label={tpd('sessions')} field="sessions_count" {...rowProps} value={val('sessions_count')} kind="number" help={help('sessions')} />
        <EditRow label={tpd('hours')} field="hours_worked" {...rowProps} value={val('hours_worked')} kind="number" help={help('hours')} />
        <EditRow label={t('revenueBilled')} field="services_revenue_billed" {...rowProps} value={val('services_revenue_billed')} kind="currency" help={help('revenueBilled')} />
        <EditRow label={t('revenueListed')} field="services_revenue_listed" {...rowProps} value={val('services_revenue_listed')} kind="currency" help={help('revenueListed')} />
      </Section>

      {/* Gross */}
      <Section title={t('grossCalc')} tone="muted" help={help('gross')}>
        <EditRow label={t('baseAmount')} field="base_amount" {...rowProps} value={val('base_amount')} kind="currency" hint={editing ? undefined : baseHint} help={help('base')} />
        <EditRow label={t('variableAmount')} field="variable_amount" {...rowProps} value={val('variable_amount')} kind="currency" hint={editing ? undefined : variableHint} help={help('variable')} />
        <EditRow label={t('extraHours')} field="extra_hours_amount" {...rowProps} value={val('extra_hours_amount')} kind="currency" help={help('extraHours')} />
        <Divider />
        <EditRow label={t('grossTotal')} field="gross_salary" {...rowProps} value={gross} kind="currency" highlight hint={editing ? t('grossHint') : undefined} help={help('gross')} />
      </Section>

      {/* Deductions → net */}
      <Section title={t('deductions')} tone="red" help={help('deductions')}>
        <EditRow label={t('montepio')} field="bps_employee" {...rowProps} value={val('bps_employee')} kind="currency" negative hint={rateHint(cp?.bps_employee_rate, val('bps_employee'))} help={help('bpsEmployee')} />
        <EditRow label={t('fonasaEmployee')} field="fonasa_employee" {...rowProps} value={val('fonasa_employee')} kind="currency" negative hint={rateHint(cp?.fonasa_rate_applied, val('fonasa_employee'))} help={help('fonasaEmployee')} />
        <EditRow label={t('frlEmployee')} field="frl_employee" {...rowProps} value={val('frl_employee')} kind="currency" negative hint={rateHint(cp?.frl_employee_rate, val('frl_employee'))} help={help('frlEmployee')} />
        <EditRow label={t('irpf')} field="irpf_withholding" {...rowProps} value={val('irpf_withholding')} kind="currency" negative
          hint={cp?.irpf_deductions_monthly
            ? t('irpfDedHint', { amount: formatCurrency(cp.irpf_deductions_monthly), rate: ratePct(cp.irpf_deduction_rate) })
            : (cp?.bpc_value_uyu ? `BPC ${formatCurrency(cp.bpc_value_uyu)}` : pct(val('irpf_withholding'), gross))}
          help={help('irpf')} />
        <EditRow label={t('otherDeductions')} field="other_deductions" {...rowProps} value={val('other_deductions')} kind="currency" negative hint={!editing && cp?.absence_days ? t('absenceHint', { days: cp.absence_days }) : undefined} help={help('otherDeductions')} />
        <Divider />
        <DisplayRow label={t('totalDeductions')} amount={totalDeductions} negative help={help('totalDeductions')} />
        <DisplayRow label={t('netSalary')} amount={netSalary} highlight hint={t('netHint')} help={help('net')} />
      </Section>

      {/* Manual adjustments (managed in the panel below) */}
      <Section title={t('adjustments')} help={help('adjustments')}>
        {adjustments.length === 0 ? (
          <p className="text-xs text-muted-foreground/70 py-1">{t('noAdjustments')}</p>
        ) : (
          <>
            {adjustments.map((adj) => (
              <DisplayRow key={adj.id} label={adj.description} amount={adj.amount} negative={adj.adjustment_type === 'deduction'} />
            ))}
            {totalAdjAdded > 0 && totalAdjDeducted > 0 && (
              <>
                <Divider />
                <DisplayRow label={t('netAdjustment')} amount={totalAdjAdded - totalAdjDeducted} highlight />
              </>
            )}
          </>
        )}
      </Section>

      {/* Employer cost */}
      <Section title={t('employerSection')} tone="amber" help={help('employerSection')}>
        <EditRow label={t('bpsEmployer')} field="bps_employer" {...rowProps} value={val('bps_employer')} kind="currency" hint={rateHint(cp?.bps_employer_rate, val('bps_employer'))} help={help('bpsEmployer')} />
        <EditRow label={t('fonasaEmployer')} field="fonasa_employer" {...rowProps} value={val('fonasa_employer')} kind="currency" hint={rateHint(cp?.fonasa_employer_rate, val('fonasa_employer'))} help={help('fonasaEmployer')} />
        <EditRow label={t('frlEmployer')} field="frl_employer" {...rowProps} value={val('frl_employer')} kind="currency" hint={rateHint(cp?.frl_employer_rate, val('frl_employer'))} help={help('frlEmployer')} />
        <EditRow label={t('fgclEmployer')} field="fgcl_employer" {...rowProps} value={val('fgcl_employer')} kind="currency" hint={rateHint(cp?.fgcl_rate, val('fgcl_employer'))} help={help('fgcl')} />
        <EditRow label={t('bseEmployer')} field="bse_employer" {...rowProps} value={val('bse_employer')} kind="currency" hint={rateHint(cp?.bse_rate, val('bse_employer'))} help={help('bse')} />
        <EditRow label={t('ccmEmployer')} field="ccm_employer" {...rowProps} value={val('ccm_employer')} kind="currency" help={help('ccm')} />
        <Divider />
        <EditRow label={t('aguinaldo')} field="aguinaldo_provision" {...rowProps} value={val('aguinaldo_provision')} kind="currency" hint={editing ? undefined : t('aguinaldoHint')} help={help('aguinaldo')} />
        <EditRow label={t('vacation')} field="vacation_provision" {...rowProps} value={val('vacation_provision')} kind="currency" help={help('vacation')} />
        <Divider />
        <DisplayRow label={t('totalEmployerCost')} amount={totalEmployerCost} highlight help={help('totalEmployerCost')} />
      </Section>
    </div>
  );
}

function HelpDot({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="inline-flex shrink-0 text-muted-foreground/50 hover:text-foreground transition-colors" aria-label="?">
          <HelpCircle className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 text-xs leading-relaxed">{text}</PopoverContent>
    </Popover>
  );
}

function Section({ title, tone, help, children }: { title: string; tone?: 'muted' | 'red' | 'amber'; help?: string; children: React.ReactNode }) {
  return (
    <div className={cn(
      'rounded-lg border p-3',
      tone === 'muted' && 'bg-muted/30',
      tone === 'red' && 'bg-red-50/50 dark:bg-red-900/5',
      tone === 'amber' && 'bg-amber-50/50 dark:bg-amber-900/5',
    )}>
      <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
        {title}
        <HelpDot text={help} />
      </p>
      {children}
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-border my-1" />;
}

function Label({ text, hint, help, highlight }: { text: string; hint?: string; help?: string; highlight?: boolean }) {
  return (
    <span className={cn('text-sm text-muted-foreground flex items-center gap-1.5 min-w-0', highlight && 'text-foreground font-medium')}>
      <span className="truncate">{text}</span>
      {hint && <span className="text-[10px] text-muted-foreground/70 shrink-0">{hint}</span>}
      <HelpDot text={help} />
    </span>
  );
}

function BaseRow({ label, value, help }: { label: string; value: React.ReactNode; help?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <Label text={label} help={help} />
      <span className="text-xs font-mono text-foreground shrink-0">{value}</span>
    </div>
  );
}

function DisplayRow({ label, amount, negative, highlight, hint, help }: {
  label: string; amount: number; negative?: boolean; highlight?: boolean; hint?: string; help?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <Label text={label} hint={hint} help={help} highlight={highlight} />
      <span className={cn(
        'text-sm font-mono shrink-0',
        highlight && 'font-semibold',
        negative ? 'text-red-600 dark:text-red-400' : highlight ? 'text-foreground' : 'text-muted-foreground',
      )}>
        {negative && amount > 0 ? `- ${formatCurrency(amount)}` : formatCurrency(amount)}
      </span>
    </div>
  );
}

function EditRow({
  label, field, editing, form, setForm, value, kind, negative, highlight, hint, help,
}: {
  label: string;
  field: EditableField;
  editing: boolean;
  form: Record<EditableField, string>;
  setForm: React.Dispatch<React.SetStateAction<Record<EditableField, string>>>;
  value: number;
  kind: 'currency' | 'number';
  negative?: boolean;
  highlight?: boolean;
  hint?: string;
  help?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <Label text={label} hint={hint} help={help} highlight={highlight} />
      {editing ? (
        <Input
          type="number"
          step="0.01"
          value={form[field]}
          onChange={(e) => setForm((s) => ({ ...s, [field]: e.target.value }))}
          className="h-7 w-28 text-right text-sm font-mono shrink-0"
        />
      ) : (
        <span className={cn(
          'text-sm font-mono shrink-0',
          highlight && 'font-semibold',
          negative ? 'text-red-600 dark:text-red-400' : highlight ? 'text-foreground' : 'text-muted-foreground',
        )}>
          {kind === 'currency'
            ? (negative && value > 0 ? `- ${formatCurrency(value)}` : formatCurrency(value))
            : value}
        </span>
      )}
    </div>
  );
}
