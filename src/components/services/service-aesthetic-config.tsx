'use client';

import * as React from 'react';
import { MapPin, Minus, Shapes, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';

import { useAsyncAction } from '@/hooks/use-async-action';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/error-utils';
import { cn } from '@/lib/utils';
import { fetchMeasurementUnits, fetchServiceAestheticConfigs, saveServiceAestheticConfig } from '@/services/aesthetic-record';

import type { AestheticMarkKind, MeasurementUnit } from '@/lib/types';

interface Draft {
  enabled: boolean;
  unitId: string;
  markingTool: AestheticMarkKind;
  defaultQuantity: string;
}

const TOOLS: { id: AestheticMarkKind; icon: React.ElementType }[] = [
  { id: 'point', icon: MapPin },
  { id: 'area', icon: Shapes },
  { id: 'line', icon: Minus },
];

interface ServiceAestheticConfigPanelProps {
  serviceId: string;
  canManage?: boolean;
}

/**
 * How the service is marked on the aesthetic record: its dose unit and whether it is
 * marked with points or areas. It saves on its own (service_aesthetic_config), apart from
 * the service form, so the service upsert stays as it is.
 */
export function ServiceAestheticConfigPanel({ serviceId, canManage = false }: ServiceAestheticConfigPanelProps) {
  const t = useTranslations('AestheticRecord.serviceConfig');
  const { toast } = useToast();
  const [units, setUnits] = React.useState<MeasurementUnit[]>([]);
  const [saved, setSaved] = React.useState<Draft | null>(null);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    setDraft(null);
    setLoadError(null);
    Promise.all([fetchMeasurementUnits(), fetchServiceAestheticConfigs()])
      .then(([unitList, configs]) => {
        if (!active) return;
        const config = configs.find((c) => c.serviceId === serviceId);
        const next: Draft = config
          ? { enabled: true, unitId: config.unitId, markingTool: config.markingTool, defaultQuantity: config.defaultQuantity != null ? String(config.defaultQuantity) : '' }
          : { enabled: false, unitId: unitList.find((u) => u.isActive)?.id ?? '', markingTool: 'point', defaultQuantity: '' };
        setUnits(unitList);
        setSaved(next);
        setDraft(next);
      })
      .catch((error) => { if (active) setLoadError(getErrorMessage(error)); });
    return () => { active = false; };
  }, [serviceId]);

  const save = useAsyncAction(
    async (next: Draft) => {
      await saveServiceAestheticConfig(serviceId, {
        enabled: next.enabled,
        unitId: next.unitId || undefined,
        markingTool: next.markingTool,
        defaultQuantity: next.defaultQuantity === '' ? null : Number(next.defaultQuantity),
      });
      return next;
    },
    {
      onSuccess: (next) => {
        setSaved(next);
        toast({ title: t('saved') });
      },
      errorTitle: t('saveError'),
    },
  );

  if (loadError) return <p className="text-xs text-destructive">{loadError}</p>;
  if (!draft || !saved) return <Skeleton className="h-16 w-full" />;

  const update = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const isDirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const unit = units.find((u) => u.id === draft.unitId);
  const quantityInvalid = draft.defaultQuantity !== '' && !(Number(draft.defaultQuantity) > 0);
  const canSave = isDirty && !quantityInvalid && (!draft.enabled || !!draft.unitId);
  const disabled = !canManage || save.isPending;
  // Inactive units stay listed only when the service already uses them
  const unitOptions = units.filter((u) => u.isActive || u.id === saved.unitId);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
          <div className="min-w-0">
            <Label htmlFor={`aes-config-${serviceId}`} className="text-sm font-medium">{t('title')}</Label>
            <p className="text-xs text-muted-foreground">{t('description')}</p>
          </div>
        </div>
        <Switch id={`aes-config-${serviceId}`} checked={draft.enabled} onCheckedChange={(enabled) => update({ enabled })} disabled={disabled} />
      </div>

      {draft.enabled && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">{t('unit')}</Label>
            {unitOptions.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('noUnits')}</p>
            ) : (
              <Select value={draft.unitId} onValueChange={(unitId) => update({ unitId })} disabled={disabled}>
                <SelectTrigger className="h-9" aria-label={t('unit')}><SelectValue placeholder={t('unitPick')} /></SelectTrigger>
                <SelectContent>
                  {unitOptions.map((u) => <SelectItem key={u.id} value={u.id}>{u.name} ({u.symbol})</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">{t('tool')}</Label>
            <div className="inline-flex h-9 overflow-hidden rounded-md border" role="radiogroup" aria-label={t('tool')}>
              {TOOLS.map(({ id, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={draft.markingTool === id}
                  disabled={disabled}
                  onClick={() => update({ markingTool: id })}
                  className={cn(
                    'inline-flex flex-1 items-center justify-center gap-1.5 px-2 text-xs font-medium transition-colors disabled:opacity-60',
                    draft.markingTool === id ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t(`tools.${id}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`aes-config-qty-${serviceId}`} className={cn('text-xs', quantityInvalid && 'text-destructive')}>{t('defaultQuantity')}</Label>
            <div className="flex items-center gap-2">
              <Input
                id={`aes-config-qty-${serviceId}`}
                type="number"
                inputMode="decimal"
                min={0}
                step={unit?.step ?? 'any'}
                value={draft.defaultQuantity}
                onChange={(e) => update({ defaultQuantity: e.target.value })}
                disabled={disabled}
                aria-invalid={quantityInvalid || undefined}
                className="h-9"
              />
              {unit && <span className="shrink-0 text-sm text-muted-foreground">{unit.symbol}</span>}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground sm:col-span-3">{t(`toolHints.${draft.markingTool}`)}</p>
        </div>
      )}

      {canManage && isDirty && (
        <div className="flex justify-end gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => setDraft(saved)} disabled={save.isPending}>{t('discard')}</Button>
          <Button type="button" size="sm" onClick={() => save.run(draft)} disabled={!canSave} loading={save.isPending}>{t('save')}</Button>
        </div>
      )}
    </div>
  );
}
