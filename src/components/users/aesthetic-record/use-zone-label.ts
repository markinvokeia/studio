'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

import type { AestheticZoneId } from '@/lib/types';
import { parseZoneId } from './map-templates';

/** "Crow's feet (left)" — the side is always the patient's */
export function useZoneLabel(): (zone: AestheticZoneId) => string {
  const t = useTranslations('AestheticRecord');
  return React.useCallback((zone: AestheticZoneId) => {
    const { base, side } = parseZoneId(zone);
    // Zones from older data may no longer exist: show the raw id instead of failing
    const name = t.has(`zones.${base}`) ? t(`zones.${base}`) : base;
    return side ? t('zones.withSide', { zone: name, side: t(`sides.${side}`) }) : name;
  }, [t]);
}
