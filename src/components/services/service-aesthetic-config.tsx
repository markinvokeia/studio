'use client';

import * as React from 'react';
import { AlertTriangle, MapPin, Minus, Shapes, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

import { ServiceConsentTemplatePanel } from '@/components/services/service-consent-template';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useToast } from '@/hooks/use-toast';
import { useAestheticErrorMessage } from '@/components/users/aesthetic-record/aesthetic-errors';
import { cn } from '@/lib/utils';
import { fetchServiceAestheticConfigs, saveServiceAestheticConfig } from '@/services/aesthetic-record';

import type { AestheticMarkKind, MeasurementUnit } from '@/lib/types';

interface Draft {
  markingTool: AestheticMarkKind;
  defaultQuantity: string;
  maxPerSession: string;
  minIntervalDays: string;
  followUpDays: string;
  followUpLabel: string;
  aftercare: string;
}

const EMPTY_DRAFT: Draft = { markingTool: 'point', defaultQuantity: '', maxPerSession: '', minIntervalDays: '', followUpDays: '', followUpLabel: '', aftercare: '' };

const TOOLS: { id: AestheticMarkKind; icon: React.ElementType }[] = [
  { id: 'point', icon: MapPin },
  { id: 'area', icon: Shapes },
  { id: 'line', icon: Minus },
];

const numberText = (value: number | null) => (value != null ? String(value) : '');
const numberOrNull = (value: string) => (value.trim() === '' ? null : Number(value));
/** Empty, or a number greater than 0 (whole when `integer`) */
const isValidNumber = (value: string, integer = false) => value.trim() === '' || (Number(value) > 0 && (!integer || Number.isInteger(Number(value))));

interface ServiceAestheticTabProps {
  serviceId: string;
  serviceName: string;
  /** Unit picked in the service's details (maybe not saved yet): the aesthetic record measures with it */
  unitId: string | null;
  units: MeasurementUnit[];
  canManage?: boolean;
  /** The service's aesthetic configuration was stored */
  onSaved?: () => void;
}

/** "Estética" tab of a service: how it is marked on the aesthetic record, and its consent text */
export function ServiceAestheticTab({ serviceId, serviceName, unitId, units, canManage = false, onSaved }: ServiceAestheticTabProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border p-3">
        <ServiceAestheticConfigPanel serviceId={serviceId} unitId={unitId} units={units} canManage={canManage} onSaved={onSaved} />
      </div>
      <div className="rounded-lg border p-3">
        <ServiceConsentTemplatePanel key={serviceId} serviceId={serviceId} serviceName={serviceName} canManage={canManage} />
      </div>
    </div>
  );
}

interface ServiceAestheticConfigPanelProps {
  serviceId: string;
  unitId: string | null;
  units: MeasurementUnit[];
  canManage?: boolean;
  onSaved?: () => void;
}

/**
 * How the service is marked on the aesthetic record: tool, default dose, limits, follow-up and
 * aftercare. It saves on its own (service_aesthetic_config), apart from the service form.
 */
export function ServiceAestheticConfigPanel({ serviceId, unitId, units, canManage = false, onSaved }: ServiceAestheticConfigPanelProps) {
  const t = useTranslations('AestheticRecord.serviceConfig');
  const { toast } = useToast();
  const [saved, setSaved] = React.useState<Draft | null>(null);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  /** The service already has an aesthetic configuration stored */
  const [exists, setExists] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const describeError = useAestheticErrorMessage();

  React.useEffect(() => {
    let active = true;
    setDraft(null);
    setLoadError(null);
    fetchServiceAestheticConfigs()
      .then((configs) => {
        if (!active) return;
        const config = configs.find((c) => c.serviceId === serviceId);
        const next: Draft = config
          ? {
            markingTool: config.markingTool,
            defaultQuantity: numberText(config.defaultQuantity),
            maxPerSession: numberText(config.maxPerSession),
            minIntervalDays: numberText(config.minIntervalDays),
            followUpDays: numberText(config.followUpDays),
            followUpLabel: config.followUpLabel ?? '',
            aftercare: config.aftercare ?? '',
          }
          : EMPTY_DRAFT;
        setExists(!!config);
        setSaved(next);
        setDraft(next);
      })
      .catch((error) => { if (active) setLoadError(describeError(error)); });
    return () => { active = false; };
  }, [serviceId, describeError]);

  const save = useAsyncAction(
    async (next: Draft) => {
      await saveServiceAestheticConfig(serviceId, {
        enabled: true,
        unitId: unitId ?? undefined,
        markingTool: next.markingTool,
        defaultQuantity: numberOrNull(next.defaultQuantity),
        maxPerSession: numberOrNull(next.maxPerSession),
        minIntervalDays: numberOrNull(next.minIntervalDays),
        followUpDays: numberOrNull(next.followUpDays),
        followUpLabel: next.followUpLabel.trim(),
        aftercare: next.aftercare.trim(),
      });
      return next;
    },
    {
      onSuccess: (next) => {
        setSaved(next);
        setExists(true);
        toast({ title: t('saved') });
        onSaved?.();
      },
      errorTitle: t('saveError'),
      describeError,
    },
  );

  if (loadError) return <p className="text-xs text-destructive">{loadError}</p>;
  if (!draft || !saved) return <Skeleton className="h-40 w-full" />;

  const update = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const isDirty = !exists || JSON.stringify(draft) !== JSON.stringify(saved);
  const unit = units.find((u) => u.id === unitId);
  const quantityInvalid = !isValidNumber(draft.defaultQuantity);
  const maxInvalid = !isValidNumber(draft.maxPerSession);
  const intervalInvalid = !isValidNumber(draft.minIntervalDays, true);
  const followUpInvalid = !isValidNumber(draft.followUpDays, true);
  const canSave = isDirty && !!unitId && !quantityInvalid && !maxInvalid && !intervalInvalid && !followUpInvalid;
  const disabled = !canManage || save.isPending;
  const unitSuffix = unit && <span className="shrink-0 text-sm text-muted-foreground">{unit.symbol}</span>;
  const daysSuffix = <span className="shrink-0 text-sm text-muted-foreground">{t('days')}</span>;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-w-0 items-start gap-2">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
        <div className="min-w-0">
          <p className="text-sm font-medium">{t('title')}</p>
          <p className="text-xs text-muted-foreground">{t('description')}</p>
        </div>
      </div>

      {!unitId && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{t('unitMissing')}</AlertDescription>
        </Alert>
      )}
      {!exists && unitId && <p className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">{t('notSavedYet')}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
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
        <NumberField id={`aes-config-qty-${serviceId}`} label={t('defaultQuantity')} value={draft.defaultQuantity} invalid={quantityInvalid} step={unit?.step} suffix={unitSuffix} disabled={disabled} onChange={(v) => update({ defaultQuantity: v })} />
        <p className="text-[11px] text-muted-foreground sm:col-span-2">{t(`toolHints.${draft.markingTool}`)}</p>

        <NumberField id={`aes-config-max-${serviceId}`} label={t('maxPerSession')} value={draft.maxPerSession} invalid={maxInvalid} step={unit?.step} suffix={unitSuffix} disabled={disabled} onChange={(v) => update({ maxPerSession: v })} />
        <NumberField id={`aes-config-interval-${serviceId}`} label={t('minIntervalDays')} value={draft.minIntervalDays} invalid={intervalInvalid} step={1} suffix={daysSuffix} disabled={disabled} onChange={(v) => update({ minIntervalDays: v })} />
        <NumberField id={`aes-config-followup-${serviceId}`} label={t('followUpDays')} value={draft.followUpDays} invalid={followUpInvalid} step={1} suffix={daysSuffix} disabled={disabled} onChange={(v) => update({ followUpDays: v })} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`aes-config-followup-label-${serviceId}`} className="text-xs">{t('followUpLabel')}</Label>
          <Input id={`aes-config-followup-label-${serviceId}`} value={draft.followUpLabel} onChange={(e) => update({ followUpLabel: e.target.value })} placeholder={t('followUpLabelPlaceholder')} disabled={disabled || !draft.followUpDays.trim()} className="h-9" />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor={`aes-config-aftercare-${serviceId}`} className="text-xs">{t('aftercare')}</Label>
          <Textarea id={`aes-config-aftercare-${serviceId}`} value={draft.aftercare} onChange={(e) => update({ aftercare: e.target.value })} placeholder={t('aftercarePlaceholder')} rows={3} disabled={disabled} className="text-sm" />
          <p className="text-[11px] text-muted-foreground">{t('limitsHint')}</p>
        </div>
      </div>

      {canManage && isDirty && (
        <div className="flex justify-end gap-2">
          {exists && <Button type="button" size="sm" variant="ghost" onClick={() => setDraft(saved)} disabled={save.isPending}>{t('discard')}</Button>}
          <Button type="button" size="sm" onClick={() => save.run(draft)} disabled={!canSave} loading={save.isPending}>{t('save')}</Button>
        </div>
      )}
    </div>
  );
}

function NumberField({ id, label, value, invalid, step, suffix, disabled, onChange }: {
  id: string;
  label: string;
  value: string;
  invalid: boolean;
  step?: number;
  suffix?: React.ReactNode;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className={cn('text-xs', invalid && 'text-destructive')}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input id={id} type="number" inputMode="decimal" min={0} step={step ?? 'any'} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} aria-invalid={invalid || undefined} className="h-9" />
        {suffix}
      </div>
    </div>
  );
}
