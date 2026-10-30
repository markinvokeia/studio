'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { MapPin, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ServiceSelector } from '@/components/ui/service-selector';
import { Textarea } from '@/components/ui/textarea';

import { cn, formatDisplayDate } from '@/lib/utils';

import type { AestheticDepth, AestheticPoint, AestheticTechnique, AestheticZoneId } from '@/lib/types';
import { DEPTHS, DOSE_UNITS, getViewZoneIds, TECHNIQUES, UNIT_COLORS } from './map-templates';
import { useZoneLabel } from './use-zone-label';

const NO_ZONE = '__none__';
const NOT_SET = '__unset__';

interface PointDetailCardProps {
  point: AestheticPoint;
  number?: number;
  readOnly?: boolean;
  /** Mark the missing required fields (after a save attempt) */
  showErrors?: boolean;
  onChange: (patch: Partial<AestheticPoint>) => void;
  onDelete: () => void;
  /** Rendered inside its row of the points list: no card chrome nor header (the row shows it) */
  embedded?: boolean;
  /** The header sticks under a 2.5rem bar at the top of the scrolling panel that holds the card */
  stickyHeader?: boolean;
}

export function PointDetailCard({ point, number, readOnly = false, showErrors = false, onChange, onDelete, embedded = false, stickyHeader = false }: PointDetailCardProps) {
  const t = useTranslations('AestheticRecord');
  const zoneLabel = useZoneLabel();
  const zones = React.useMemo(() => getViewZoneIds(point.view), [point.view]);
  const idPrefix = `aes-point-${point.id}`;
  const productInvalid = showErrors && !point.productName.trim();
  const quantityInvalid = showErrors && (point.quantity == null || point.quantity <= 0);

  const header = (
    // Sticky, it spans the card's padding so the fields scroll under a solid band
    <div className={cn('flex items-center gap-2', stickyHeader && 'sticky top-10 z-10 -mx-4 -mt-4 rounded-t-2xl border-b bg-card px-4 py-3')}>
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
        style={{ backgroundColor: UNIT_COLORS[point.unit] }}
        aria-hidden
      >
        {number ?? '•'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{point.productName || t('point.noProduct')}</p>
        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" />
          {point.zone ? zoneLabel(point.zone) : t('zones.none')} · {t(`views.${point.view}`)}
        </p>
      </div>
      {!readOnly && (
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive hover:text-destructive" onClick={onDelete} aria-label={t('point.delete')} title={t('point.delete')}>
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );

  const shell = embedded ? 'flex flex-col gap-3 border-t bg-muted/20 p-3' : 'flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm';

  if (readOnly) {
    const rows: [string, string | undefined][] = [
      [t('point.quantity'), point.quantity != null ? `${point.quantity} ${point.unit}` : undefined],
      [t('point.lot'), point.lot],
      [t('point.lotExpiry'), point.lotExpiry ? formatDisplayDate(point.lotExpiry) : undefined],
      [t('point.depth'), point.depth ? t(`depths.${point.depth}`) : undefined],
      [t('point.technique'), point.technique ? t(`techniques.${point.technique}`) : undefined],
      [t('point.notes'), point.notes],
    ];
    return (
      <div className={shell}>
        {!embedded && header}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
          {rows.map(([label, value]) => (
            <React.Fragment key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className={cn('text-foreground', !value && 'text-muted-foreground/60')}>{value || '—'}</dd>
            </React.Fragment>
          ))}
        </dl>
      </div>
    );
  }

  return (
    <div className={cn(shell, !embedded && (productInvalid || quantityInvalid) && 'border-destructive/60')}>
      {!embedded && header}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-name`} className={cn('text-xs', productInvalid && 'text-destructive')}>{t('point.product')}</Label>
        <ServiceSelector
          className={cn(productInvalid && 'border-destructive')}
          value={point.serviceId}
          selectedServiceName={point.serviceId ? point.productName : undefined}
          onValueChange={(serviceId, service) => onChange({ serviceId, productName: service?.name ?? point.productName })}
          placeholder={t('point.productSearch')}
          noResultsText={t('point.productNoResults')}
          loadingText={t('point.productLoading')}
          triggerText={t('point.productPick')}
        />
        <Input
          id={`${idPrefix}-name`}
          value={point.productName}
          onChange={(e) => onChange({ productName: e.target.value })}
          placeholder={t('point.productNamePlaceholder')}
          aria-label={t('point.productName')}
          aria-invalid={productInvalid || undefined}
          aria-describedby={productInvalid ? `${idPrefix}-name-error` : undefined}
          className="h-8 text-xs"
        />
        {productInvalid && <p id={`${idPrefix}-name-error`} className="text-xs font-medium text-destructive">{t('point.productRequired')}</p>}
      </div>

      <div className="grid grid-cols-[1fr_auto] items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-qty`} className={cn('text-xs', quantityInvalid && 'text-destructive')}>{t('point.quantity')}</Label>
          <Input
            id={`${idPrefix}-qty`}
            type="number"
            inputMode="decimal"
            min={0}
            step={point.unit === 'U' ? 1 : 0.05}
            value={point.quantity ?? ''}
            onChange={(e) => {
              const value = e.target.value === '' ? null : Number(e.target.value);
              onChange({ quantity: value != null && Number.isFinite(value) ? value : null });
            }}
            aria-invalid={quantityInvalid || undefined}
            aria-describedby={quantityInvalid ? `${idPrefix}-qty-error` : undefined}
            className="h-9"
          />
        </div>
        <div className="inline-flex h-9 overflow-hidden rounded-md border" role="radiogroup" aria-label={t('point.unit')}>
          {DOSE_UNITS.map((unit) => (
            <button
              key={unit}
              type="button"
              role="radio"
              aria-checked={point.unit === unit}
              onClick={() => onChange({ unit })}
              className={cn(
                'px-3 text-xs font-medium transition-colors',
                point.unit === unit ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted',
              )}
            >
              {t(`units.${unit}`)}
            </button>
          ))}
        </div>
        {quantityInvalid && <p id={`${idPrefix}-qty-error`} className="col-span-2 text-xs font-medium text-destructive">{t('point.quantityRequired')}</p>}
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-lot`} className="text-xs">{t('point.lot')}</Label>
          <Input id={`${idPrefix}-lot`} value={point.lot ?? ''} onChange={(e) => onChange({ lot: e.target.value })} className="h-9" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-expiry`} className="text-xs">{t('point.lotExpiry')}</Label>
          <Input id={`${idPrefix}-expiry`} type="date" value={point.lotExpiry ?? ''} onChange={(e) => onChange({ lotExpiry: e.target.value || undefined })} className="h-9" />
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">{t('point.depth')}</Label>
          <Select value={point.depth ?? NOT_SET} onValueChange={(v) => onChange({ depth: v === NOT_SET ? undefined : (v as AestheticDepth) })}>
            <SelectTrigger className="h-9" aria-label={t('point.depth')}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NOT_SET}>{t('point.notSet')}</SelectItem>
              {DEPTHS.map((depth) => <SelectItem key={depth} value={depth}>{t(`depths.${depth}`)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">{t('point.technique')}</Label>
          <Select value={point.technique ?? NOT_SET} onValueChange={(v) => onChange({ technique: v === NOT_SET ? undefined : (v as AestheticTechnique) })}>
            <SelectTrigger className="h-9" aria-label={t('point.technique')}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NOT_SET}>{t('point.notSet')}</SelectItem>
              {TECHNIQUES.map((technique) => <SelectItem key={technique} value={technique}>{t(`techniques.${technique}`)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">{t('point.zone')}</Label>
        <Select value={point.zone ?? NO_ZONE} onValueChange={(v) => onChange({ zone: v === NO_ZONE ? null : (v as AestheticZoneId) })}>
          <SelectTrigger className="h-9" aria-label={t('point.zone')}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_ZONE}>{t('zones.none')}</SelectItem>
            {zones.map((zone) => <SelectItem key={zone} value={zone}>{zoneLabel(zone)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-notes`} className="text-xs">{t('point.notes')}</Label>
        <Textarea id={`${idPrefix}-notes`} value={point.notes ?? ''} onChange={(e) => onChange({ notes: e.target.value })} rows={2} className="resize-none text-sm" />
      </div>

      {embedded && (
        <Button type="button" size="sm" variant="ghost" className="h-8 self-end text-destructive hover:text-destructive" onClick={onDelete}>
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          {t('point.delete')}
        </Button>
      )}
    </div>
  );
}
