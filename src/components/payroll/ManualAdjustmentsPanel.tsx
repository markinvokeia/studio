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
import type { PayrollManualAdjustment } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/components/payroll/payroll-utils';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

interface Props {
  adjustments: PayrollManualAdjustment[];
  entryId: string;
  onChange: (adjustments: PayrollManualAdjustment[]) => void;
  readonly?: boolean;
}

const CATEGORIES = ['bono', 'adelanto', 'descuento', 'correccion', 'otro'] as const;

export function ManualAdjustmentsPanel({ adjustments, entryId, onChange, readonly }: Props) {
  const t = useTranslations('PayrollPage.periodDetail.breakdown');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    description: '',
    amount: '',
    adjustment_type: 'addition' as 'addition' | 'deduction',
    category: 'otro' as PayrollManualAdjustment['category'],
  });

  function handleAdd() {
    if (!form.description || !form.amount) return;
    const adj: PayrollManualAdjustment = {
      id: `adj${Date.now()}`,
      payroll_entry_id: entryId,
      description: form.description,
      amount: Number(form.amount),
      adjustment_type: form.adjustment_type,
      category: form.category,
      created_at: new Date().toISOString(),
    };
    onChange([...adjustments, adj]);
    setForm({ description: '', amount: '', adjustment_type: 'addition', category: 'otro' });
    setShowForm(false);
  }

  function handleDelete(id: string) {
    onChange(adjustments.filter((a) => a.id !== id));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{t('adjustments')}</p>
        {!readonly && (
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setShowForm((v) => !v)}>
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
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(adj.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
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
            <Button size="sm" className="flex-1 h-8 text-xs" onClick={handleAdd}>Agregar</Button>
            <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </div>
      )}
    </div>
  );
}
