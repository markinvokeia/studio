'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, ChevronDown, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

import { cn, formatDisplayDate } from '@/lib/utils';

import type { AestheticDepth, AestheticLayer, AestheticMark, AestheticTechnique, ServiceAestheticConfig } from '@/lib/types';
import { formatQuantity, hasOverrides, isMarkIncomplete, layerColor, layerQuantity, layerTitle, MARK_KIND_ICONS, type PlacedMark } from './layers';
import { DEPTHS, TECHNIQUES } from './map-templates';
import { useZoneLabel } from './use-zone-label';

const NOT_SET = '__unset__';

interface LayersPanelProps {
  layers: AestheticLayer[];
  /** Marks of every layer with their numbers, as the map draws them */
  placed: PlacedMark[];
  /** Services that can be added as a layer */
  configs: ServiceAestheticConfig[];
  configsError?: string | null;
  activeLayerId: string | null;
  selectedMarkId: string | null;
  /** Layers whose marks the map leaves out */
  hiddenLayerIds: Set<string>;
  onToggleLayerVisibility: (layerId: string) => void;
  isEditing: boolean;
  /** Mark the incomplete marks as errors (after a blocked save) */
  showErrors?: boolean;
  onAddLayer: (config: ServiceAestheticConfig) => void;
  onRemoveLayer: (layerId: string) => void;
  onActivateLayer: (layerId: string) => void;
  onChangeLayer: (layerId: string, patch: Partial<AestheticLayer>) => void;
  onChangeMark: (markId: string, patch: Partial<AestheticMark>) => void;
  onSelectMark: (placed: PlacedMark) => void;
  /** Detail shown under the selected row, so a mark is picked and edited in the same place */
  renderDetail?: (placed: PlacedMark) => React.ReactNode;
}

/** The session's services ("layers"): what was applied once for all its marks, and the marks themselves */
export function LayersPanel({
  layers,
  placed,
  configs,
  configsError,
  activeLayerId,
  selectedMarkId,
  hiddenLayerIds,
  onToggleLayerVisibility,
  isEditing,
  showErrors = false,
  onAddLayer,
  onRemoveLayer,
  onActivateLayer,
  onChangeLayer,
  onChangeMark,
  onSelectMark,
  renderDetail,
}: LayersPanelProps) {
  const t = useTranslations('AestheticRecord');
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set(layers.length === 1 ? [layers[0].id] : []));
  const [removing, setRemoving] = React.useState<AestheticLayer | null>(null);

  const usedServiceIds = new Set(layers.map((l) => l.serviceId).filter(Boolean));
  const available = configs.filter((c) => c.isActive && !usedServiceIds.has(c.serviceId));

  // The layer being marked is always open, so its new marks show up
  const isOpen = (layer: AestheticLayer) => (isEditing && layer.id === activeLayerId) || expanded.has(layer.id);
  const toggle = (layer: AestheticLayer) => {
    if (isEditing && layer.id !== activeLayerId) {
      onActivateLayer(layer.id);
      return;
    }
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(layer.id)) next.delete(layer.id);
      else next.add(layer.id);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {layers.length === 0 && (
        <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
          {isEditing ? t('layers.emptyEditing') : t('layers.empty')}
        </p>
      )}

      {layers.map((layer, index) => {
        const color = layerColor(layer, index);
        const open = isOpen(layer);
        const active = isEditing && layer.id === activeLayerId;
        const layerMarks = placed.filter((p) => p.layer.id === layer.id);
        const incomplete = layerMarks.filter((p) => isMarkIncomplete(p.mark)).length;
        const ToolIcon = MARK_KIND_ICONS[layer.markingTool];
        const hidden = hiddenLayerIds.has(layer.id);
        const total = layerQuantity(layer);
        return (
          <section key={layer.id} className={cn('overflow-hidden rounded-xl border', active && 'border-primary/50 ring-1 ring-primary/30 dark:border-foreground/40 dark:ring-foreground/20')}>
            <div className={cn('flex items-center transition-colors hover:bg-muted/40', active && 'bg-primary/5')}>
            <button
              type="button"
              onClick={() => toggle(layer)}
              aria-expanded={open}
              className="flex min-w-0 flex-1 items-center gap-2.5 py-2.5 pl-3 text-left"
            >
              <span className={cn('h-3 w-3 shrink-0 rounded-full ring-2 ring-white dark:ring-card', hidden && 'opacity-30')} style={{ backgroundColor: color }} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">{layerTitle(layer) || t('point.noProduct')}</span>
                <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                  <ToolIcon className="h-3 w-3 shrink-0" />
                  {layer.productName.trim() ? `${layer.serviceName} · ` : ''}
                  {t('layers.marks', { count: layer.marks.length })}
                  {total > 0 && ` · ${formatQuantity(total)} ${layer.unitSymbol}`}
                </span>
              </span>
              {active && <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">{t('layers.active')}</span>}
              {isEditing && incomplete > 0 && (
                <AlertTriangle className={cn('h-4 w-4 shrink-0', showErrors ? 'text-destructive' : 'text-amber-500')} aria-label={t('map.incompletePoint')} />
              )}
              <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden />
            </button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className={cn('mx-1 h-8 w-8 shrink-0', hidden ? 'text-muted-foreground/60' : 'text-muted-foreground')}
              onClick={() => onToggleLayerVisibility(layer.id)}
              aria-pressed={!hidden}
              aria-label={hidden ? t('layers.show', { name: layerTitle(layer) }) : t('layers.hide', { name: layerTitle(layer) })}
              title={hidden ? t('layers.show', { name: layerTitle(layer) }) : t('layers.hide', { name: layerTitle(layer) })}
            >
              {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            </div>

            {open && (
              <div className="flex flex-col gap-3 border-t p-3">
                <LayerAttributes layer={layer} readOnly={!isEditing} onChange={(patch) => onChangeLayer(layer.id, patch)} />

                {layerMarks.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
                    {isEditing ? t(layer.markingTool === 'area' ? 'layers.noMarksArea' : layer.markingTool === 'line' ? 'layers.noMarksLine' : 'layers.noMarks') : t('map.empty')}
                  </p>
                ) : (
                  <ul className="flex flex-col divide-y overflow-hidden rounded-lg border">
                    {layerMarks.map((p) => (
                      <MarkRow
                        key={p.mark.id}
                        placed={p}
                        isSelected={selectedMarkId === p.mark.id}
                        isEditing={isEditing}
                        showErrors={showErrors}
                        expandable={!!renderDetail}
                        onSelect={() => onSelectMark(p)}
                        onQuantityChange={(quantity) => onChangeMark(p.mark.id, { quantity })}
                        detail={selectedMarkId === p.mark.id ? renderDetail?.(p) : undefined}
                      />
                    ))}
                  </ul>
                )}

                {isEditing && (
                  <Button type="button" size="sm" variant="ghost" className="h-8 self-end text-destructive hover:text-destructive" onClick={() => (layer.marks.length ? setRemoving(layer) : onRemoveLayer(layer.id))}>
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    {t('layers.remove')}
                  </Button>
                )}
              </div>
            )}
          </section>
        );
      })}

      {isEditing && (
        configsError ? (
          <p className="text-xs text-destructive">{configsError}</p>
        ) : configs.length === 0 ? (
          <p className="rounded-xl border border-dashed p-3 text-center text-xs text-muted-foreground">{t('layers.noConfigs')}</p>
        ) : available.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground">{t('layers.allUsed')}</p>
        ) : (
          <Select
            value=""
            onValueChange={(serviceId) => {
              const config = available.find((c) => c.serviceId === serviceId);
              if (config) onAddLayer(config);
            }}
          >
            <SelectTrigger className="h-9 border-dashed" aria-label={t('layers.add')}>
              <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><Plus className="h-4 w-4" />{t('layers.add')}</span>
            </SelectTrigger>
            <SelectContent>
              {available.map((config) => (
                <SelectItem key={config.serviceId} value={config.serviceId}>
                  <span className="inline-flex items-center gap-2">
                    {React.createElement(MARK_KIND_ICONS[config.markingTool], { className: 'h-3.5 w-3.5 text-muted-foreground' })}
                    {config.serviceName}
                    <span className="text-xs text-muted-foreground">· {config.unitSymbol}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      )}

      <AlertDialog open={removing !== null} onOpenChange={(next) => { if (!next) setRemoving(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('layers.removeTitle', { name: removing ? layerTitle(removing) : '' })}</AlertDialogTitle>
            <AlertDialogDescription>{t('layers.removeDescription', { count: removing?.marks.length ?? 0 })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (removing) onRemoveLayer(removing.id);
                setRemoving(null);
              }}
            >
              {t('layers.remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Attributes set once for every mark of the layer */
function LayerAttributes({ layer, readOnly, onChange }: { layer: AestheticLayer; readOnly: boolean; onChange: (patch: Partial<AestheticLayer>) => void }) {
  const t = useTranslations('AestheticRecord');
  const idPrefix = `aes-layer-${layer.id}`;

  if (readOnly) {
    const rows: [string, string | undefined][] = [
      [t('layers.product'), layer.productName.trim() || undefined],
      [t('point.lot'), layer.lot],
      [t('point.lotExpiry'), layer.lotExpiry ? formatDisplayDate(layer.lotExpiry) : undefined],
      [t('point.depth'), layer.depth ? t(`depths.${layer.depth}`) : undefined],
      [t('point.technique'), layer.technique ? t(`techniques.${layer.technique}`) : undefined],
      [t('point.notes'), layer.notes],
    ];
    const shown = rows.filter(([, value]) => value);
    if (shown.length === 0) return null;
    return (
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
        {shown.map(([label, value]) => (
          <React.Fragment key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="whitespace-pre-wrap text-foreground">{value}</dd>
          </React.Fragment>
        ))}
      </dl>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] text-muted-foreground">{t('layers.attributesHint')}</p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-product`} className="text-xs">{t('layers.product')}</Label>
        <Input id={`${idPrefix}-product`} value={layer.productName} onChange={(e) => onChange({ productName: e.target.value })} placeholder={t('layers.productPlaceholder')} className="h-9" />
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-lot`} className="text-xs">{t('point.lot')}</Label>
          <Input id={`${idPrefix}-lot`} value={layer.lot ?? ''} onChange={(e) => onChange({ lot: e.target.value || undefined })} className="h-9" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-expiry`} className="text-xs">{t('point.lotExpiry')}</Label>
          <Input id={`${idPrefix}-expiry`} type="date" value={layer.lotExpiry ?? ''} onChange={(e) => onChange({ lotExpiry: e.target.value || undefined })} className="h-9" />
        </div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">{t('point.depth')}</Label>
          <Select value={layer.depth ?? NOT_SET} onValueChange={(v) => onChange({ depth: v === NOT_SET ? undefined : (v as AestheticDepth) })}>
            <SelectTrigger className="h-9" aria-label={t('point.depth')}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NOT_SET}>{t('point.notSet')}</SelectItem>
              {DEPTHS.map((depth) => <SelectItem key={depth} value={depth}>{t(`depths.${depth}`)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">{t('point.technique')}</Label>
          <Select value={layer.technique ?? NOT_SET} onValueChange={(v) => onChange({ technique: v === NOT_SET ? undefined : (v as AestheticTechnique) })}>
            <SelectTrigger className="h-9" aria-label={t('point.technique')}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NOT_SET}>{t('point.notSet')}</SelectItem>
              {TECHNIQUES.map((technique) => <SelectItem key={technique} value={technique}>{t(`techniques.${technique}`)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-notes`} className="text-xs">{t('point.notes')}</Label>
        <Textarea id={`${idPrefix}-notes`} value={layer.notes ?? ''} onChange={(e) => onChange({ notes: e.target.value || undefined })} rows={2} className="resize-none text-sm" />
      </div>
    </div>
  );
}

interface MarkRowProps {
  placed: PlacedMark;
  isSelected: boolean;
  isEditing: boolean;
  showErrors: boolean;
  expandable: boolean;
  onSelect: () => void;
  onQuantityChange: (quantity: number | null) => void;
  detail?: React.ReactNode;
}

/** A mark in its layer's list; the quantity is typed right there, the rest opens in its detail */
function MarkRow({ placed, isSelected, isEditing, showErrors, expandable, onSelect, onQuantityChange, detail }: MarkRowProps) {
  const t = useTranslations('AestheticRecord');
  const zoneLabel = useZoneLabel();
  const rowRef = React.useRef<HTMLLIElement>(null);
  const { mark, layer, color, number } = placed;
  const incomplete = isMarkIncomplete(mark);
  const KindIcon = MARK_KIND_ICONS[mark.kind];

  // A mark picked on the map (or just added) opens below the fold otherwise
  React.useEffect(() => {
    if (isSelected) rowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [isSelected]);

  return (
    <li ref={rowRef} className="scroll-my-3">
      <div className={cn('flex items-center gap-2 px-2.5 py-1.5 text-xs transition-colors', isSelected && 'bg-primary/5', incomplete && showErrors && 'bg-destructive/5')}>
        <button
          type="button"
          onClick={onSelect}
          aria-expanded={expandable ? isSelected : undefined}
          aria-pressed={expandable ? undefined : isSelected}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-0.5 text-left hover:text-foreground"
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white" style={{ backgroundColor: color }} aria-hidden>
            {number}
          </span>
          <KindIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label={t(`mark.${mark.kind}`)} />
          <span className="min-w-0 flex-1 truncate font-medium text-foreground">{mark.zone ? zoneLabel(mark.zone) : t('zones.none')}</span>
          {hasOverrides(mark) && <span className="shrink-0 rounded-full bg-amber-500/10 px-1.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">{t('mark.customized')}</span>}
        </button>
        {isEditing ? (
          <div className="flex shrink-0 items-center gap-1">
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step={layer.unitStep}
              value={mark.quantity ?? ''}
              onChange={(e) => {
                const value = e.target.value === '' ? null : Number(e.target.value);
                onQuantityChange(value != null && Number.isFinite(value) ? value : null);
              }}
              aria-label={t('mark.quantityOf', { number })}
              aria-invalid={(incomplete && showErrors) || undefined}
              className={cn('h-7 w-16 px-2 text-right text-xs', incomplete && showErrors && 'border-destructive')}
            />
            <span className="w-6 text-muted-foreground">{layer.unitSymbol}</span>
          </div>
        ) : (
          <span className="shrink-0 font-semibold text-foreground">{mark.quantity != null ? `${formatQuantity(mark.quantity)} ${layer.unitSymbol}` : '—'}</span>
        )}
        {expandable && (
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', isSelected && 'rotate-180')} aria-hidden />
        )}
      </div>
      {detail}
    </li>
  );
}
