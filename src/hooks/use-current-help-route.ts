'use client';

import { useLocale } from 'next-intl';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import { routeToHelpScope, stripLocale } from '@/lib/help/help-id';

/** Ruta sin locale y scope de help ids de la pantalla actual. */
export function useCurrentHelpRoute(): { route: string; scope: string } {
  const pathname = usePathname();
  const locale = useLocale();
  return React.useMemo(() => {
    const route = stripLocale(pathname ?? '/', locale);
    return { route, scope: routeToHelpScope(route) };
  }, [pathname, locale]);
}
