'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { useLocale } from 'next-intl';

export function ClockDisplay() {
  const locale = useLocale();
  const dateLocale = locale === 'es' ? es : enUS;
  const [now, setNow] = React.useState<Date | null>(null);

  React.useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) return null;

  return (
    <div className="flex flex-col items-end select-none">
      <span className="text-3xl font-bold tabular-nums tracking-tight leading-none">
        {format(now, 'HH:mm')}
        <span className="text-xl opacity-60">:{format(now, 'ss')}</span>
      </span>
      <span className="text-sm opacity-70 capitalize mt-0.5">
        {format(now, 'EEEE d MMM', { locale: dateLocale })}
      </span>
    </div>
  );
}
