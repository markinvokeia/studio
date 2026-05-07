'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import type { PayrollPeriod } from '@/lib/types';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingPeriods: PayrollPeriod[];
  onCreated: (period: PayrollPeriod) => void;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export function PeriodCreateDialog({ open, onOpenChange, existingPeriods, onCreated }: Props) {
  const t = useTranslations('PayrollPage.periods');
  const { toast } = useToast();

  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [creating, setCreating] = useState(false);

  // Months still available for the selected year (exclude already-created ones)
  const availableMonths = useMemo(
    () => MONTHS.filter(
      (m) => !existingPeriods.some((p) => p && p.period_year === Number(year) && p.period_month === m)
    ),
    [existingPeriods, year]
  );

  // Keep the selected month valid for the chosen year (and on open)
  useEffect(() => {
    if (!open) return;
    if (availableMonths.length > 0 && !availableMonths.includes(Number(month))) {
      setMonth(String(availableMonths[0]));
    }
  }, [open, year, availableMonths, month]);

  const noMonthsLeft = availableMonths.length === 0;

  async function handleCreate() {
    if (noMonthsLeft || !availableMonths.includes(Number(month))) return;
    setCreating(true);
    try {
      const res = await api.post(API_ROUTES.PAYROLL.PERIODS_CREATE, {
        period_year: Number(year),
        period_month: Number(month),
      });
      const created = (res?.data ?? res) as PayrollPeriod;
      toast({ title: t('created') });
      onCreated(created);
      onOpenChange(false);
    } catch {
      toast({ title: t('errorCreating'), variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!creating) onOpenChange(v); }}>
      <DialogContent maxWidth="sm">
        <DialogHeader>
          <DialogTitle>{t('createDialog.title')}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-6 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t('createDialog.year')}</Label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{t('createDialog.month')}</Label>
              <Select value={month} onValueChange={setMonth} disabled={noMonthsLeft}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableMonths.map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {t(`createDialog.months.${m}` as Parameters<typeof t>[0])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {noMonthsLeft && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {t('createDialog.noMonthsLeft')}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
            {t('createDialog.cancel')}
          </Button>
          <Button onClick={handleCreate} disabled={creating || noMonthsLeft}>
            {creating ? t('createDialog.creating') : t('createDialog.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
