'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Settings2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

import { SYSTEM_PERMISSIONS } from '@/constants/permissions';
import { useAsyncAction } from '@/hooks/use-async-action';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { type PerioSettings, savePerioSettings, usePerioSettingsContext } from '@/lib/perio/settings';
import { cn } from '@/lib/utils';

import type { PerioRisk } from '@/lib/types';

/** Gear on the exam banner: the clinic's probing order, margin sign and maintenance intervals */
export function PerioSettingsButton({ onSaved }: { onSaved?: (settings: PerioSettings) => void }) {
  const t = useTranslations('PerioRecord.settings');
  const { toast } = useToast();
  const { hasAnyPermission } = usePermissions();
  const canEdit = hasAnyPermission([SYSTEM_PERMISSIONS.SYS_CONFIG_UPDATE, SYSTEM_PERMISSIONS.SYS_CONFIG_CREATE]);
  const current = usePerioSettingsContext();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<PerioSettings>(current);

  const save = useAsyncAction(() => savePerioSettings(form), {
    onSuccess: () => { onSaved?.(form); setOpen(false); toast({ title: t('saved') }); },
    errorTitle: t('error'),
  });

  const choice = <K extends 'order' | 'marginSign'>(key: K, options: PerioSettings[K][]) => (
    <div role="radiogroup" className="flex flex-col gap-1.5">
      {options.map((o) => (
        <button key={o} type="button" role="radio" aria-checked={form[key] === o} disabled={!canEdit || save.isPending} onClick={() => setForm({ ...form, [key]: o })} className={cn('rounded-xl border px-3 py-2 text-left text-[13px] disabled:opacity-70', form[key] === o && 'border-primary bg-primary/5')}>
          <b className="block font-semibold">{t(`${key}.${o}`)}</b>
          <small className="text-[12px] text-muted-foreground">{t(`${key}.${o}Help`)}</small>
        </button>
      ))}
    </div>
  );

  return (
    <>
      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setForm(current); setOpen(true); }} aria-label={t('title')} title={t('title')}>
        <Settings2 className="h-4 w-4" />
      </Button>
      <Dialog open={open} onOpenChange={(next) => { if (!save.isPending) setOpen(next); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
            <DialogDescription>{canEdit ? t('lead') : t('readOnly')}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <section className="flex flex-col gap-1.5"><h4 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">{t('order.label')}</h4>{choice('order', ['arch', 'buccalFirst'])}</section>
            <section className="flex flex-col gap-1.5"><h4 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">{t('marginSign.label')}</h4>{choice('marginSign', ['recessionPositive', 'recessionNegative'])}</section>
            <section className="flex flex-col gap-1.5">
              <h4 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">{t('intervals.label')}</h4>
              <div className="grid grid-cols-3 gap-2">
                {(['high', 'moderate', 'low'] as PerioRisk[]).map((risk) => (
                  <label key={risk} className="flex flex-col gap-1 text-[12.5px] text-muted-foreground">
                    {t(`intervals.${risk}`)}
                    <Input type="number" min={1} max={24} value={form.intervals[risk]} disabled={!canEdit || save.isPending} onChange={(e) => setForm({ ...form, intervals: { ...form.intervals, [risk]: Math.max(1, Math.min(24, Number(e.target.value) || 1)) } })} className="h-8" />
                  </label>
                ))}
              </div>
              <small className="text-[11.5px] text-muted-foreground">{t('intervals.help')}</small>
            </section>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={save.isPending}>{t('cancel')}</Button>
            {canEdit && <Button type="button" loading={save.isPending} onClick={() => save.run()}>{t('save')}</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
