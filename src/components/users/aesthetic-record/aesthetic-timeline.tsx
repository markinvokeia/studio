'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Camera, CheckCircle2, CircleAlert } from 'lucide-react';

import { fetchAestheticSessions } from '@/services/aesthetic-record';

import type { AestheticSession, AestheticZoneId } from '@/lib/types';
import { formatQuantity, layerColor, layerQuantity, layerTitle, unitTotals } from './layers';
import { useZoneLabel } from './use-zone-label';

/** Patient's aesthetic sessions for the timeline; `reload` after the sheet changes one */
export function useAestheticSessions(patientId: string, enabled: boolean) {
  const [sessions, setSessions] = React.useState<AestheticSession[]>([]);

  const reload = React.useCallback(async () => {
    if (!enabled || !patientId) {
      setSessions([]);
      return;
    }
    try {
      setSessions(await fetchAestheticSessions(patientId));
    } catch {
      // The timeline still shows the clinical sessions without them
      setSessions([]);
    }
  }, [patientId, enabled]);

  React.useEffect(() => { reload(); }, [reload]);

  return { sessions, reload };
}

/** Services applied in the session, e.g. "Toxina botulínica, Mesoterapia" */
export function aestheticSessionPreview(session: AestheticSession): string {
  return [...new Set(session.layers.map(layerTitle).filter(Boolean))].join(', ');
}

/** Body of an expanded aesthetic session in the timeline: what was applied, where, and its consent and photos */
export function AestheticSessionDetails({ session }: { session: AestheticSession }) {
  const t = useTranslations('AestheticRecord');
  const zoneLabel = useZoneLabel();

  const products = React.useMemo(
    () => session.layers.map((layer, index) => ({ id: layer.id, name: layerTitle(layer), unit: layer.unitSymbol, quantity: layerQuantity(layer), color: layerColor(layer, index) })),
    [session.layers],
  );
  const marks = React.useMemo(() => session.layers.flatMap((layer) => layer.marks), [session.layers]);
  const zones = React.useMemo(
    () => [...new Set(marks.map((m) => m.zone).filter((z): z is AestheticZoneId => !!z))].map(zoneLabel),
    [marks, zoneLabel],
  );
  const totals = unitTotals(session.layers);

  return (
    <>
      <p className="break-words text-foreground">
        <span className="text-muted-foreground">{t('timeline.points')}:</span>{' '}
        {t('layers.marks', { count: marks.length })}
        {totals.length > 0 && ` · ${totals.map(({ unit, quantity }) => `${formatQuantity(quantity)} ${unit}`).join(' · ')}`}
      </p>
      {products.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground">{t('timeline.products')}:</span>
          {products.map((product) => (
            <span key={product.id} className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2 py-0.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: product.color }} aria-hidden />
              <span className={product.name ? 'text-foreground' : 'italic text-muted-foreground'}>{product.name || t('point.noProduct')}</span>
              <span className="font-semibold text-foreground">{formatQuantity(product.quantity)} {product.unit}</span>
            </span>
          ))}
        </div>
      )}
      {zones.length > 0 && (
        <p className="break-words text-foreground">
          <span className="text-muted-foreground">{t('timeline.zones')}:</span>{' '}
          {zones.join(', ')}
        </p>
      )}
      {session.doctorName && (
        <p className="break-words text-foreground">
          <span className="text-muted-foreground">{t('session.doctor')}:</span>{' '}
          {session.doctorName}
        </p>
      )}
      {session.notes.trim() && (
        <p className="whitespace-pre-wrap break-words text-foreground">
          <span className="text-muted-foreground">{t('timeline.notes')}:</span>{' '}
          {session.notes}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {session.consent ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3" />{t('consent.signedBadge')}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 font-medium text-amber-700 dark:text-amber-400">
            <CircleAlert className="h-3 w-3" />{t('consent.missingBadge')}
          </span>
        )}
        {session.photos.length > 0 && (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Camera className="h-3.5 w-3.5" />{t('sheet.photoCount', { count: session.photos.length })}
          </span>
        )}
      </div>
    </>
  );
}
