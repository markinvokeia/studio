'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import type { PayrollManualAdjustment } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/components/payroll/payroll-utils';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

interface Props {
  adjustments: PayrollManualAdjustment[];
  entryId: string;
  /** Called after a successful persist so the parent can reload */
  onChanged: () => void;
  readonly?: boolean;
}

const CATEGORIES = ['bono', 'adelanto', 'descuento', 'hora_extra', 'correccion', 'otro'] as const;
const EMPTY = { id: '', description: '', amount: '', adjustment_type: 'addition' as 'addition' | 'deduction', category: 'bono' as PayrollManualAdjustment['category'] };

export function ManualAdjustmentsPanel({ adjustments, entryId, onChanged, readonly }: Props) {
  const t = useTranslations('PayrollPage.periodDetail.breakdown');
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  function openNew() {
    setForm({ ...EMPTY });
    setShowForm(true);
  }

  function openEdit(adj: PayrollManualAdjustment) {
    setForm({
      id: adj.id,
      description: adj.description ?? '',
      amount: String(adj.amount ?? ''),
      adjustment_type: adj.adjustment_type,
      category: adj.category ?? 'otro',
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.description || !form.amount) return;
    setSaving(true);
    try {
      await api.post(API_ROUTES.PAYROLL.ADJUSTMENTS_UPSERT, {
        id: form.id || undefined,
        payroll_entry_id: entryId,
        description: form.description,
        amount: Math.abs(Number(form.amount)) || 0,
        adjustment_type: form.adjustment_type,
        category: form.category,
      });
      setShowForm(false);
      setForm({ ...EMPTY });
      onChanged();
    } catch {
      toast({ title: t('adjustmentError'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      await api.post(API_ROUTES.PAYROLL.ADJUSTMENTS_DELETE, { id });
      onChanged();
    } catch {
      toast({ title: t('adjustmentError'), variant: 'destructive' });
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{t('adjustments')}</p>
        {!readonly && (
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={openNew}>
            <Plus className="h-3 w-3 mr-1" />
            {t('addAdjustment')}
          </Button>
        )}
      </div>

      {adjustments.length > 0 && (
        <div className="flex flex-col gap-1">
          {adjustments.map((adj) => (
            <div key={adj.id} className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span className={cn(
                  'inline-block h-1.5 w-1.5 rounded-full shrink-0',
                  adj.adjustment_type === 'addition' ? 'bg-green-500' : 'bg-red-500'
                )} />
                <span className="truncate text-xs">{adj.description}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={cn(
                  'text-xs font-mono font-medium',
                  adj.adjustment_type === 'addition' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                )}>
                  {adj.adjustment_type === 'addition' ? '+' : '-'}{formatCurrency(adj.amount)}
                </span>
                {!readonly && (
                  <>
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
                      onClick={() => openEdit(adj)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                      disabled={deleting === adj.id} onClick={() => handleDelete(adj.id)}>
                      {deleting === adj.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && !readonly && (
        <div className="rounded-lg border bg-muted/30 p-3 flex flex-col gap-2">
          <div className="space-y-1">
            <Label className="text-xs">{t('adjustmentDescription')}</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Ej: Bono de productividad"
              className="h-8 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">{t('adjustmentAmount')}</Label>
              <Input
                type="number"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="0"
                className="h-8 text-sm"
                min={0}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('adjustmentType')}</Label>
              <Select
                value={form.adjustment_type}
                onValueChange={(v) => setForm((f) => ({ ...f, adjustment_type: v as 'addition' | 'deduction' }))}
              >
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="addition">{t('addition')}</SelectItem>
                  <SelectItem value="deduction">{t('deduction')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('adjustmentCategory')}</Label>
            <Select
              value={form.category}
              onValueChange={(v) => setForm((f) => ({ ...f, category: v as PayrollManualAdjustment['category'] }))}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{t(`categories.${c}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="flex-1 h-8 text-xs" onClick={handleSave} disabled={saving || !form.description || !form.amount}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t('save')}
            </Button>
            <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => setShowForm(false)}>{t('cancel')}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
