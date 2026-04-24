import * as React from 'react';

import { BREAKPOINT_MOBILE, BREAKPOINT_TABLET } from '@/lib/design-tokens';
import type { CalendarBreakpoint } from '@/components/calendar/calendar-types';

function getBreakpoint(width: number): CalendarBreakpoint {
  if (width < BREAKPOINT_MOBILE) return 'mobile';
  if (width < BREAKPOINT_TABLET) return 'tablet';
  return 'desktop';
}

/**
 * Returns the current calendar breakpoint based on viewport width.
 * - mobile:  < 768px
 * - tablet:  768px – 1024px
 * - desktop: > 1024px
 */
export function useCalendarBreakpoint(): CalendarBreakpoint {
  // Always start as 'desktop' so SSR and first client render match; real value is set after mount.
  const [breakpoint, setBreakpoint] = React.useState<CalendarBreakpoint>('desktop');

  React.useEffect(() => {
    const handler = () => setBreakpoint(getBreakpoint(window.innerWidth));
    handler();
    window.addEventListener('resize', handler, { passive: true });
    return () => window.removeEventListener('resize', handler);
  }, []);

  return breakpoint;
}
