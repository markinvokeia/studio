'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, FlipHorizontal2, History, Info, Minus, Plus, Trash2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { cn, formatDisplayDate } from '@/lib/utils';

import type { AestheticDepth, AestheticMark, AestheticSession, AestheticTechnique, AestheticZoneId, ServiceAestheticConfig } from '@/lib/types';
import { formatQuantity, layerQuantity, MARK_KIND_ICONS, resolveMark, type PlacedMark } from './layers';
import { DEPTHS, getViewZoneIds, TECHNIQUES } from './map-templates';
import { daysBetween } from './session-status';
import { Hint } from './hint';
import { useZoneLabel } from './use-zone-label';

const NO_ZONE = '__none__';
const INHERIT = '__inherit__';

/** Last application of the same service on the same zone, in an earlier session */
export function lastApplication(previousSessions: AestheticSession[], serviceId: string | undefined, zone: AestheticZoneId | null): { date: string; quantity: number } | null {
  if (!serviceId || !zone) return null;
  for (let i = previousSessions.length - 1; i >= 0; i--) {
    const session = previousSessions[i];
    const quantity = session.layers
      .filter((l) => l.serviceId === serviceId)
      .flatMap((l) => l.marks)
      .filter((m) => m.zone === zone)
      .reduce((sum, m) => sum + (m.quantity ?? 0), 0);
    if (quantity > 0) return { date: session.date, quantity };
  }
  return null;
}

interface MarkEditorProps {
  placed: PlacedMark;
  config: ServiceAestheticConfig | undefined;
  sessionDate: string;
  previousSessions: AestheticSession[];
  readOnly: boolean;
  onChange: (patch: Partial<AestheticMark>, options?: { skipHistory?: boolean }) => void;
  onDelete: () => void;
  onMirror: () => void;
  onZoneHistory: () => void;
  onClose: () => void;
  /** Shown over the map beside the mark */
  floating?: boolean;
}

/** The selected mark: dose, its own product and lot if they differ from the service's, zone, depth, technique and note, with inline warnings */
export function MarkEditor({ placed, config, sessionDate, previousSessions, readOnly, onChange, onDelete, onMirror, onZoneHistory, onClose, floating = false }: MarkEditorProps) {
  const t = useTranslations('AestheticRecord');
  const zoneLabel = useZoneLabel();
  const { mark, layer, color, number } = placed;
  const step = layer.unitStep || 1;
  const zones = React.useMemo(() => getViewZoneIds(mark.view), [mark.view]);
  const KindIcon = MARK_KIND_ICONS[mark.kind];
  const [text, setText] = React.useState(mark.quantity != null ? formatQuantity(mark.quantity) : '');
  React.useEffect(() => { setText(mark.quantity != null ? formatQuantity(mark.quantity) : ''); }, [mark.quantity, mark.id]);

  const setQuantity = (value: number | null) => onChange({ quantity: value == null ? null : Math.max(0, Math.round(value * 10000) / 10000) });
  const bump = (direction: 1 | -1) => setQuantity((mark.quantity ?? 0) + direction * step);

  // Warnings: they inform, they never block
  const last = lastApplication(previousSessions, layer.serviceId, mark.zone);
  const intervalDays = last ? daysBetween(last.date, sessionDate) : null;
  const intervalWarning = !!config?.minIntervalDays && intervalDays != null && intervalDays < config.minIntervalDays;
  const total = layerQuantity(layer);
  const overMax = config?.maxPerSession != null && total > config.maxPerSession;
  const { lotExpiry } = resolveMark(layer, mark);
  const lotExpired = !!lotExpiry && lotExpiry < sessionDate;
  const label = `${t(`mark.${mark.kind}`)} ${number}`;
  const hasOwnSupply = !!(mark.productName || mark.lot || mark.lotExpiry);
  const [editingSupply, setEditingSupply] = React.useState(hasOwnSupply);
  const ownSupply = [
    mark.productName,
    mark.lot && t('flow.close.lot', { lot: mark.lot }),
    mark.lotExpiry && t('flow.treatment.expires', { date: formatDisplayDate(mark.lotExpiry) }),
  ].filter((v): v is string => !!v);
  /** What the mark takes from its service: product, lot and expiry are loaded once, in the summary */
  const serviceDefaults = [
    layer.productName.trim(),
    layer.lot && t('flow.close.lot', { lot: layer.lot }),
    layer.lotExpiry && t('flow.treatment.expires', { date: formatDisplayDate(layer.lotExpiry) }),
    config?.defaultQuantity != null && t('flow.treatment.defaultDose', { quantity: formatQuantity(config.defaultQuantity), unit: layer.unitSymbol }),
  ].filter((v): v is string => !!v);

  return (
    <section aria-label={t('flow.treatment.markLabel', { service: layer.serviceName, mark: label })} className={cn('flex flex-col gap-2.5 rounded-2xl border bg-card p-3', floating ? 'shadow-[0_8px_30px_rgb(30_26_51/0.18)]' : 'shadow-sm')}>
      <div className="flex items-center gap-2">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white" style={{ backgroundColor: color }}>{number}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold">{layer.serviceName} · {label}</p>
          <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
            <KindIcon className="h-3 w-3 shrink-0" />{mark.zone ? zoneLabel(mark.zone) : t('zones.none')} · {t(`views.${mark.view}`)}
          </p>
        </div>
        <Hint label={t('panels.closeProperties')} description={t('flow.hints.editor.close')} side="left">
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={onClose} aria-label={t('panels.closeProperties')}><X className="h-4 w-4" /></Button>
        </Hint>
      </div>

      <div className="-mt-1 flex flex-col gap-1.5 rounded-lg bg-muted/60 px-2.5 py-1.5 text-[11px] leading-snug text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">{t('flow.treatment.fromService')}</span> {serviceDefaults.length ? serviceDefaults.join(' · ') : t('flow.treatment.noServiceSupply')}
        </p>
        {readOnly ? (
          ownSupply.length > 0 && <p><span className="font-medium text-foreground">{t('flow.treatment.markSupplyOwn')}:</span> {ownSupply.join(' · ')}</p>
        ) : !editingSupply ? (
          <button type="button" className="self-start font-medium text-violet-700 hover:underline dark:text-violet-300" onClick={() => setEditingSupply(true)}>{t('flow.treatment.markSupplyChange')}</button>
        ) : (
          <div className="flex flex-col gap-2 border-t pt-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-foreground">{t('flow.treatment.markSupplyOwn')}</span>
              <button
                type="button"
                className="font-medium text-violet-700 hover:underline dark:text-violet-300"
                onClick={() => {
                  if (hasOwnSupply) onChange({ productName: undefined, lot: undefined, lotExpiry: undefined });
                  setEditingSupply(false);
                }}
              >
                {t('flow.treatment.markSupplyReset')}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="col-span-2 flex flex-col gap-1">
                <Label htmlFor={`aes-mark-product-${mark.id}`} className="text-[11px] text-muted-foreground">{t('layers.product')}</Label>
                <Input id={`aes-mark-product-${mark.id}`} value={mark.productName ?? ''} placeholder={layer.productName.trim() || t('layers.productPlaceholder')} onChange={(e) => onChange({ productName: e.target.value || undefined }, { skipHistory: true })} className="h-8 bg-card text-xs" />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor={`aes-mark-lot-${mark.id}`} className="text-[11px] text-muted-foreground">{t('point.lot')}</Label>
                <Input id={`aes-mark-lot-${mark.id}`} value={mark.lot ?? ''} placeholder={layer.lot} onChange={(e) => onChange({ lot: e.target.value || undefined }, { skipHistory: true })} className="h-8 bg-card text-xs" />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor={`aes-mark-exp-${mark.id}`} className="text-[11px] text-muted-foreground">{t('flow.treatment.expiry')}</Label>
                <Input id={`aes-mark-exp-${mark.id}`} type="date" value={mark.lotExpiry ?? ''} onChange={(e) => onChange({ lotExpiry: e.target.value || undefined }, { skipHistory: true })} className="h-8 bg-card px-1.5 text-xs" />
              </div>
            </div>
            {mark.lot && !mark.lotExpiry && layer.lotExpiry && (
              <p className="text-amber-700 dark:text-amber-400">{t('flow.treatment.markExpiryInherited', { date: formatDisplayDate(layer.lotExpiry) })}</p>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <Hint label={t('flow.treatment.less')} description={t('flow.hints.editor.less', { step: formatQuantity(step), unit: layer.unitSymbol })}>
          <Button type="button" variant="outline" size="icon" className="h-10 w-10 text-lg" onClick={() => bump(-1)} disabled={readOnly} aria-label={t('flow.treatment.less')}><Minus className="h-4 w-4" /></Button>
        </Hint>
        <Input
          inputMode="decimal"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            const n = text.trim() === '' ? null : Number(text.replace(',', '.'));
            if (n == null || (Number.isFinite(n) && n >= 0)) setQuantity(n);
            else setText(mark.quantity != null ? formatQuantity(mark.quantity) : '');
          }}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          disabled={readOnly}
          aria-label={t('point.quantity')}
          aria-invalid={mark.quantity == null || mark.quantity <= 0 || undefined}
          className={cn('h-10 w-20 text-center text-lg font-semibold tabular-nums', (mark.quantity == null || mark.quantity <= 0) && 'border-destructive')}
        />
        <Hint label={t('flow.treatment.more')} description={t('flow.hints.editor.more', { step: formatQuantity(step), unit: layer.unitSymbol })}>
          <Button type="button" variant="outline" size="icon" className="h-10 w-10 text-lg" onClick={() => bump(1)} disabled={readOnly} aria-label={t('flow.treatment.more')}><Plus className="h-4 w-4" /></Button>
        </Hint>
        <span className="text-sm text-muted-foreground">{layer.unitSymbol}{mark.kind === 'area' ? ` ${t('flow.treatment.inArea')}` : ''}</span>
      </div>

      <Select value={mark.zone ?? NO_ZONE} onValueChange={(v) => onChange({ zone: v === NO_ZONE ? null : (v as AestheticZoneId) })} disabled={readOnly}>
        <SelectTrigger className="h-9 text-xs" aria-label={t('point.zone')}><SelectValue /></SelectTrigger>
        <SelectContent>
          {zones.map((zone) => <SelectItem key={zone} value={zone}>{zoneLabel(zone)}</SelectItem>)}
          <SelectItem value={NO_ZONE}>{t('zones.none')}</SelectItem>
        </SelectContent>
      </Select>
      <div className="grid grid-cols-2 gap-1.5">
        <Select value={mark.depth ?? INHERIT} onValueChange={(v) => onChange({ depth: v === INHERIT ? undefined : (v as AestheticDepth) })} disabled={readOnly}>
          <SelectTrigger className="h-9 text-xs" aria-label={t('point.depth')}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={INHERIT}>{layer.depth ? t('mark.inherited', { value: t(`depths.${layer.depth}`) }) : t('point.depth')}</SelectItem>
            {DEPTHS.map((d) => <SelectItem key={d} value={d}>{t(`depths.${d}`)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={mark.technique ?? INHERIT} onValueChange={(v) => onChange({ technique: v === INHERIT ? undefined : (v as AestheticTechnique) })} disabled={readOnly}>
          <SelectTrigger className="h-9 text-xs" aria-label={t('point.technique')}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={INHERIT}>{layer.technique ? t('mark.inherited', { value: t(`techniques.${layer.technique}`) }) : t('point.technique')}</SelectItem>
            {TECHNIQUES.map((d) => <SelectItem key={d} value={d}>{t(`techniques.${d}`)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Input
        value={mark.notes ?? ''}
        onChange={(e) => onChange({ notes: e.target.value || undefined }, { skipHistory: true })}
        placeholder={t('flow.treatment.markNote')}
        aria-label={t('point.notes')}
        disabled={readOnly}
        className="h-9 text-xs"
      />

      {intervalWarning && (
        <Warning>{t('flow.treatment.intervalWarning', { days: intervalDays!, min: config!.minIntervalDays! })}</Warning>
      )}
      {overMax && (
        <Warning>{t('flow.treatment.maxWarning', { total: formatQuantity(total), max: formatQuantity(config!.maxPerSession!), unit: layer.unitSymbol })}</Warning>
      )}
      {lotExpired && <Warning>{t('flow.treatment.lotExpired', { date: formatDisplayDate(lotExpiry) })}</Warning>}
      {last && !intervalWarning && (
        <p className="flex items-start gap-2 rounded-lg bg-blue-500/10 px-2.5 py-2 text-xs text-blue-700 dark:text-blue-300">
          <Info className="mt-px h-3.5 w-3.5 shrink-0" />
          {t('flow.treatment.lastTime', { date: formatDisplayDate(last.date), quantity: formatQuantity(last.quantity), unit: layer.unitSymbol })}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {!readOnly && (
          <Hint label={t('flow.treatment.mirror')} description={t('flow.hints.editor.mirror')}>
            <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={onMirror}>
              <FlipHorizontal2 className="mr-1 h-3.5 w-3.5" />{t('flow.treatment.mirror')}
            </Button>
          </Hint>
        )}
        {mark.zone && (
          <Hint label={t('flow.treatment.zoneHistory')} description={t('flow.hints.editor.zoneHistory')}>
            <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={onZoneHistory}>
              <History className="mr-1 h-3.5 w-3.5" />{t('flow.treatment.zoneHistory')}
            </Button>
          </Hint>
        )}
        <span className="flex-1" />
        {!readOnly && (
          <Hint label={t('mark.delete')} description={t('flow.hints.editor.delete')} shortcut="Supr" side="left">
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={onDelete} aria-label={t('mark.delete')}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </Hint>
        )}
      </div>
    </section>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-lg bg-amber-500/12 px-2.5 py-2 text-xs text-amber-800 dark:text-amber-300" role="status">
      <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
      {children}
    </p>
  );
}
