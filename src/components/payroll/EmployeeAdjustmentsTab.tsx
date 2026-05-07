'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { coerceNumericStrings, formatCurrency, getMonthName } from '@/components/payroll/payroll-utils';
import type { PayrollEmployee, PayrollEntry, PayrollManualAdjustment } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

type AdjCategory = 'bono' | 'adelanto' | 'descuento' | 'hora_extra' | 'correccion' | 'otro';
const CATEGORIES: AdjCategory[] = ['bono', 'adelanto', 'descuento', 'hora_extra', 'correccion', 'otro'];
const ALL = '__all__';

type AdjRow = PayrollManualAdjustment & { period_year?: number; period_month?: number };

interface Props {
  employee: PayrollEmployee;
}

interface EntryRow extends PayrollEntry {
  period_year?: number;
  period_month?: number;
  period_status?: string;
}

function unwrap<T>(raw: unknown): T[] {
  const inner = (raw as { data?: unknown })?.data ?? raw;
  return Array.isArray(inner) ? (inner as T[]) : [];
}

export function EmployeeAdjustmentsTab({ employee }: Props) {
  const t = useTranslations('PayrollPage.legajo.ajustes');
  const tRoot = useTranslations('PayrollPage.legajo');
  const { toast } = useToast();

  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [entryId, setEntryId] = useState('');

  const [adjustments, setAdjustments] = useState<AdjRow[]>([]);
  const [adjLoading, setAdjLoading] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PayrollManualAdjustment | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // form
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [adjType, setAdjType] = useState<'addition' | 'deduction'>('addition');
  const [category, setCategory] = useState<AdjCategory>('bono');

  // Load the employee's calculated entries (one per period)
  useEffect(() => {
    const uid = employee.user_id;
    if (!uid) { setEntries([]); setEntriesLoading(false); return; }
    let cancelled = false;
    setEntriesLoading(true);
    api.get(API_ROUTES.PAYROLL.ENTRIES_BY_EMPLOYEE, { employee_id: uid })
      .then((res) => {
        if (cancelled) return;
        const rows = unwrap<EntryRow>(res).filter((e) => e && e.id);
        setEntries(rows);
        setEntryId((prev) => prev || (rows[0]?.id ?? ''));
      })
      .catch(() => { if (!cancelled) setEntries([]); })
      .finally(() => { if (!cancelled) setEntriesLoading(false); });
    return () => { cancelled = true; };
  }, [employee.user_id]);

  const loadAdjustments = useCallback((eid: string) => {
    if (!eid) { setAdjustments([]); return; }
    // "TODOS": send entry_id null + user_id so the backend returns every
    // adjustment of the employee across all their liquidations.
    const params: Record<string, string> = eid === ALL
      ? (employee.user_id ? { user_id: employee.user_id } : {})
      : { entry_id: eid };
    setAdjLoading(true);
    api.get(API_ROUTES.PAYROLL.ADJUSTMENTS_BY_ENTRY, params)
      .then((res) => setAdjustments(unwrap<AdjRow>(res)
        .map((a) => coerceNumericStrings(a as unknown as Record<string, unknown>) as unknown as AdjRow)))
      .catch(() => setAdjustments([]))
      .finally(() => setAdjLoading(false));
  }, [employee.user_id]);

  useEffect(() => { loadAdjustments(entryId); }, [entryId, loadAdjustments]);

  const periodLabel = (e: EntryRow) =>
    e.period_month && e.period_year ? `${getMonthName(e.period_month)} ${e.period_year}` : e.id.slice(0, 8);

  function openNew() {
    setEditing(null);
    setDescription(''); setAmount(''); setAdjType('addition'); setCategory('bono');
    setDialogOpen(true);
  }

  function openEdit(a: PayrollManualAdjustment) {
    setEditing(a);
    setDescription(a.description ?? '');
    setAmount(String(a.amount ?? ''));
    setAdjType(a.adjustment_type);
    setCategory((a.category as AdjCategory) ?? 'otro');
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!entryId || !description || !amount) return;
    setSaving(true);
    try {
      await api.post(API_ROUTES.PAYROLL.ADJUSTMENTS_UPSERT, {
        id: editing?.id,
        payroll_entry_id: entryId,
        description,
        amount: Math.abs(Number(amount)) || 0,
        adjustment_type: adjType,
        category,
      });
      toast({ title: tRoot('saved') });
      setDialogOpen(false);
      setEditing(null);
      loadAdjustments(entryId);
    } catch {
      toast({ title: tRoot('errorSaving'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      await api.post(API_ROUTES.PAYROLL.ADJUSTMENTS_DELETE, { id });
      loadAdjustments(entryId);
    } catch {
      toast({ title: tRoot('errorDeleting'), variant: 'destructive' });
    } finally {
      setDeleting(null);
    }
  }

  if (!employee.user_id) {
    return <p className="text-sm text-muted-foreground text-center py-10">{t('noUserId')}</p>;
  }
  if (entriesLoading) {
    return <div className="flex flex-col gap-2 p-1">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>;
  }
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-10">{t('noEntries')}</p>;
  }

  const isAll = entryId === ALL;
  const sumAdd = adjustments.filter((a) => a.adjustment_type === 'addition').reduce((s, a) => s + (Number(a.amount) || 0), 0);
  const sumDed = adjustments.filter((a) => a.adjustment_type === 'deduction').reduce((s, a) => s + (Number(a.amount) || 0), 0);
  const net = sumAdd - sumDed;

  return (
    <div className="flex flex-col h-full min-h-0 -mb-4">
      {/* Period selector + add */}
      <div className="flex items-end gap-2 flex-none pb-3">
        <div className="flex-1 space-y-1.5">
          <Label className="text-xs">{t('selectPeriod')}</Label>
          <Select value={entryId} onValueChange={setEntryId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('allPeriods')}</SelectItem>
              {entries.map((e) => (
                <SelectItem key={e.id} value={e.id} className="capitalize">{periodLabel(e)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" className="h-9" onClick={openNew} disabled={isAll} title={isAll ? t('selectPeriodToAdd') : undefined}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          {t('addNew')}
        </Button>
      </div>

      {/* Adjustments list (scrolls) */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {adjLoading ? (
          <div className="flex flex-col gap-2">{[1, 2].map((i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
        ) : adjustments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">{t('none')}</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {adjustments.map((a, idx) => (
              <Card key={a.id ?? `adj-${idx}`} className="cursor-pointer" onClick={() => openEdit(a)}>
                <CardContent className="p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn('inline-block h-2 w-2 rounded-full shrink-0',
                      a.adjustment_type === 'addition' ? 'bg-green-500' : 'bg-red-500')} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{a.description}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {t(`categories.${a.category ?? 'otro'}` as Parameters<typeof t>[0])}
                        {isAll && a.period_month && a.period_year ? ` · ${getMonthName(a.period_month)} ${a.period_year}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn('text-sm font-mono font-medium',
                      a.adjustment_type === 'addition' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
                      {a.adjustment_type === 'addition' ? '+' : '-'}{formatCurrency(a.amount)}
                    </span>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      disabled={deleting === a.id}
                      onClick={(e) => { e.stopPropagation(); handleDelete(a.id); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Totals footer — always visible */}
      <div className="flex-none border-t bg-background -mx-4 px-4 py-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[11px] text-muted-foreground">{t('totalAdded')}</p>
          <p className="text-sm font-semibold text-green-600 dark:text-green-400">+{formatCurrency(sumAdd)}</p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">{t('totalDeducted')}</p>
          <p className="text-sm font-semibold text-red-600 dark:text-red-400">−{formatCurrency(sumDed)}</p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">{t('totalNet')}</p>
          <p className={cn('text-base font-bold', net >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
            {net >= 0 ? '+' : '−'}{formatCurrency(Math.abs(net))}
          </p>
        </div>
      </div>

      {/* Add / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) { setDialogOpen(false); setEditing(null); } }}>
        <DialogContent maxWidth="sm">
          <DialogHeader>
            <DialogTitle>{editing ? t('editTitle') : t('addNew')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 px-6 py-4">
            <div className="space-y-1.5">
              <Label className="text-xs">{t('description')}</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('descriptionPlaceholder')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t('amount')}</Label>
                <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('type')}</Label>
                <Select value={adjType} onValueChange={(v) => setAdjType(v as 'addition' | 'deduction')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="addition">{t('addition')}</SelectItem>
                    <SelectItem value="deduction">{t('deduction')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('category')}</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as AdjCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{t(`categories.${c}` as Parameters<typeof t>[0])}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setEditing(null); }}>{tRoot('cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || !description || !amount}>
              {saving ? tRoot('saving') : tRoot('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
