'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Camera, CheckCircle2, CircleAlert } from 'lucide-react';

import { fetchAestheticSessions } from '@/services/aesthetic-record';

import type { AestheticSession, AestheticZoneId } from '@/lib/types';
import { UNIT_COLORS } from './map-templates';
import { aestheticUnitTotals } from './aesthetic-session-sheet';
import { useZoneLabel } from './use-zone-label';
import { formatQuantity } from './zone-history';

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
      // Local mockup storage: an unreadable record just leaves the timeline without them
      setSessions([]);
    }
  }, [patientId, enabled]);

  React.useEffect(() => { reload(); }, [reload]);

  return { sessions, reload };
}

/** Products applied in the session, e.g. "Toxina botulínica, Ácido hialurónico" */
export function aestheticSessionPreview(session: AestheticSession): string {
  return [...new Set(session.points.map((p) => p.productName.trim()).filter(Boolean))].join(', ');
}

/** Body of an expanded aesthetic session in the timeline: what was applied, where, and its consent and photos */
export function AestheticSessionDetails({ session }: { session: AestheticSession }) {
  const t = useTranslations('AestheticRecord');
  const zoneLabel = useZoneLabel();

  const products = React.useMemo(() => {
    const map = new Map<string, { name: string; unit: string; quantity: number; color: string }>();
    for (const point of session.points) {
      const name = point.productName.trim();
      const key = `${name}|${point.unit}`;
      const entry = map.get(key) ?? { name, unit: point.unit, quantity: 0, color: UNIT_COLORS[point.unit] };
      entry.quantity += point.quantity ?? 0;
      map.set(key, entry);
    }
    return [...map.values()];
  }, [session.points]);

  const zones = React.useMemo(
    () => [...new Set(session.points.map((p) => p.zone).filter((z): z is AestheticZoneId => !!z))].map(zoneLabel),
    [session.points, zoneLabel],
  );
  const unitTotals = aestheticUnitTotals(session.points);

  return (
    <>
      <p className="break-words text-foreground">
        <span className="text-muted-foreground">{t('timeline.points')}:</span>{' '}
        {t('map.pointsTitle', { count: session.points.length })}
        {unitTotals.length > 0 && ` · ${unitTotals.map(({ unit, quantity }) => `${formatQuantity(quantity)} ${unit}`).join(' · ')}`}
      </p>
      {products.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground">{t('timeline.products')}:</span>
          {products.map((product) => (
            <span key={`${product.name}|${product.unit}`} className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2 py-0.5">
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
