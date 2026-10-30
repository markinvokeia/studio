'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { RotateCcw, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

import { cn, formatDisplayDate } from '@/lib/utils';

import type { AestheticDepth, AestheticMark, AestheticTechnique, AestheticZoneId } from '@/lib/types';
import { formatQuantity, hasOverrides, layerTitle, lineOrientation, MARK_KIND_ICONS, resolveMark, SHARED_ATTRIBUTES, type PlacedMark } from './layers';
import { DEPTHS, getViewZoneIds, TECHNIQUES } from './map-templates';
import { useZoneLabel } from './use-zone-label';

const NO_ZONE = '__none__';
/** Select value of an attribute the mark takes from its layer */
const INHERIT = '__inherit__';

interface MarkDetailCardProps {
  placed: PlacedMark;
  readOnly?: boolean;
  /** Mark the missing required fields (after a save attempt) */
  showErrors?: boolean;
  onChange: (patch: Partial<AestheticMark>) => void;
  onDelete: () => void;
  /** Rendered inside its row of the list: no card chrome nor header (the row shows it) */
  embedded?: boolean;
  /** The header sticks under a 2.5rem bar at the top of the scrolling panel that holds the card */
  stickyHeader?: boolean;
}

/** One mark: its quantity and zone, and the layer's attributes it changes for itself */
export function MarkDetailCard({ placed, readOnly = false, showErrors = false, onChange, onDelete, embedded = false, stickyHeader = false }: MarkDetailCardProps) {
  const t = useTranslations('AestheticRecord');
  const zoneLabel = useZoneLabel();
  const { mark, layer, color, number } = placed;
  const zones = React.useMemo(() => getViewZoneIds(mark.view), [mark.view]);
  const resolved = resolveMark(layer, mark);
  const idPrefix = `aes-mark-${mark.id}`;
  const quantityInvalid = showErrors && (mark.quantity == null || mark.quantity <= 0);
  const KindIcon = MARK_KIND_ICONS[mark.kind];
  const orientation = lineOrientation(mark);
  /** Placeholder of an attribute left to the layer: what the layer says */
  const inherited = (value: string | undefined) => (value ? t('mark.inherited', { value }) : t('point.notSet'));

  const header = (
    // Sticky, it spans the card's padding so the fields scroll under a solid band
    <div className={cn('flex items-center gap-2', stickyHeader && 'sticky top-10 z-10 -mx-4 -mt-4 rounded-t-2xl border-b bg-card px-4 py-3')}>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white" style={{ backgroundColor: color }} aria-hidden>
        {number}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{layerTitle(layer) || t('point.noProduct')}</p>
        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
          <KindIcon className="h-3 w-3 shrink-0" />
          {t(`mark.${mark.kind}`)}{orientation && ` (${t(`mark.orientation.${orientation}`)})`} · {mark.zone ? zoneLabel(mark.zone) : t('zones.none')} · {t(`views.${mark.view}`)}
        </p>
      </div>
      {!readOnly && (
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive hover:text-destructive" onClick={onDelete} aria-label={t('mark.delete')} title={t('mark.delete')}>
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );

  const shell = embedded ? 'flex flex-col gap-3 border-t bg-muted/20 p-3' : 'flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm';

  if (readOnly) {
    const rows: [string, string | undefined, boolean][] = [
      [t('point.quantity'), mark.quantity != null ? `${formatQuantity(mark.quantity)} ${layer.unitSymbol}` : undefined, false],
      [t('point.lot'), resolved.lot, !!mark.lot],
      [t('point.lotExpiry'), resolved.lotExpiry ? formatDisplayDate(resolved.lotExpiry) : undefined, !!mark.lotExpiry],
      [t('point.depth'), resolved.depth ? t(`depths.${resolved.depth}`) : undefined, !!mark.depth],
      [t('point.technique'), resolved.technique ? t(`techniques.${resolved.technique}`) : undefined, !!mark.technique],
      [t('point.notes'), resolved.notes, !!mark.notes],
    ];
    return (
      <div className={shell}>
        {!embedded && header}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
          {rows.map(([label, value, own]) => (
            <React.Fragment key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className={cn('text-foreground', !value && 'text-muted-foreground/60')}>
                {value || '—'}
                {own && <span className="ml-1.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">· {t('mark.customized')}</span>}
              </dd>
            </React.Fragment>
          ))}
        </dl>
      </div>
    );
  }

  return (
    <div className={cn(shell, !embedded && quantityInvalid && 'border-destructive/60')}>
      {!embedded && header}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-qty`} className={cn('text-xs', quantityInvalid && 'text-destructive')}>
            {mark.kind === 'area' ? t('mark.quantityArea') : mark.kind === 'line' ? t('mark.quantityLine') : t('point.quantity')}
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id={`${idPrefix}-qty`}
              type="number"
              inputMode="decimal"
              min={0}
              step={layer.unitStep}
              value={mark.quantity ?? ''}
              onChange={(e) => {
                const value = e.target.value === '' ? null : Number(e.target.value);
                onChange({ quantity: value != null && Number.isFinite(value) ? value : null });
              }}
              aria-invalid={quantityInvalid || undefined}
              aria-describedby={quantityInvalid ? `${idPrefix}-qty-error` : undefined}
              className="h-9"
            />
            <span className="shrink-0 text-sm font-medium text-muted-foreground">{layer.unitSymbol}</span>
          </div>
          {quantityInvalid && <p id={`${idPrefix}-qty-error`} className="text-xs font-medium text-destructive">{t('point.quantityRequired')}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">{t('point.zone')}</Label>
          <Select value={mark.zone ?? NO_ZONE} onValueChange={(v) => onChange({ zone: v === NO_ZONE ? null : (v as AestheticZoneId) })}>
            <SelectTrigger className="h-9" aria-label={t('point.zone')}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_ZONE}>{t('zones.none')}</SelectItem>
              {zones.map((zone) => <SelectItem key={zone} value={zone}>{zoneLabel(zone)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-dashed p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground">{t('mark.overrides')}</p>
            <p className="text-[11px] text-muted-foreground">{t('mark.overridesHint')}</p>
          </div>
          {hasOverrides(mark) && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 shrink-0 px-2 text-xs"
              onClick={() => onChange(Object.fromEntries(SHARED_ATTRIBUTES.map((key) => [key, undefined])))}
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              {t('mark.resetOverrides')}
            </Button>
          )}
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${idPrefix}-lot`} className="text-xs">{t('point.lot')}</Label>
            <Input id={`${idPrefix}-lot`} value={mark.lot ?? ''} placeholder={inherited(layer.lot)} onChange={(e) => onChange({ lot: e.target.value || undefined })} className="h-9" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${idPrefix}-expiry`} className="text-xs">{t('point.lotExpiry')}</Label>
            <Input id={`${idPrefix}-expiry`} type="date" value={mark.lotExpiry ?? ''} onChange={(e) => onChange({ lotExpiry: e.target.value || undefined })} className="h-9" />
            {!mark.lotExpiry && layer.lotExpiry && <p className="text-[11px] text-muted-foreground">{inherited(formatDisplayDate(layer.lotExpiry))}</p>}
          </div>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">{t('point.depth')}</Label>
            <Select value={mark.depth ?? INHERIT} onValueChange={(v) => onChange({ depth: v === INHERIT ? undefined : (v as AestheticDepth) })}>
              <SelectTrigger className="h-9" aria-label={t('point.depth')}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={INHERIT}>{inherited(layer.depth && t(`depths.${layer.depth}`))}</SelectItem>
                {DEPTHS.map((depth) => <SelectItem key={depth} value={depth}>{t(`depths.${depth}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">{t('point.technique')}</Label>
            <Select value={mark.technique ?? INHERIT} onValueChange={(v) => onChange({ technique: v === INHERIT ? undefined : (v as AestheticTechnique) })}>
              <SelectTrigger className="h-9" aria-label={t('point.technique')}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={INHERIT}>{inherited(layer.technique && t(`techniques.${layer.technique}`))}</SelectItem>
                {TECHNIQUES.map((technique) => <SelectItem key={technique} value={technique}>{t(`techniques.${technique}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-notes`} className="text-xs">{t('point.notes')}</Label>
          <Textarea id={`${idPrefix}-notes`} value={mark.notes ?? ''} placeholder={inherited(layer.notes)} onChange={(e) => onChange({ notes: e.target.value || undefined })} rows={2} className="resize-none text-sm" />
        </div>
      </div>

      {embedded && (
        <Button type="button" size="sm" variant="ghost" className="h-8 self-end text-destructive hover:text-destructive" onClick={onDelete}>
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          {t('mark.delete')}
        </Button>
      )}
    </div>
  );
}
