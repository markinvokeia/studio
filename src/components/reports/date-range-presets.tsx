'use client';

import { Button } from '@/components/ui/button';
import { DatePickerInput } from '@/components/ui/date-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subMonths,
} from 'date-fns';
import { CalendarIcon, ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { DateRange } from 'react-day-picker';

interface DateRangePresetsProps {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  className?: string;
  /** When true, adds an "All time" option (no filter) and makes it the default. */
  allowAllTime?: boolean;
}

type Preset = 'all' | 'today' | 'week' | 'month' | 'prevMonth' | 'year' | 'custom';

export function DateRangePresets({ onChange, className, allowAllTime = false }: DateRangePresetsProps) {
  const t = useTranslations('DateRangePresets');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Preset>(allowAllTime ? 'all' : 'month');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');

  const today = new Date();

  const applyPreset = (preset: Preset) => {
    setActive(preset);
    if (preset === 'all') {
      onChange(undefined);
      setOpen(false);
    } else if (preset === 'today') {
      onChange({ from: today, to: today });
      setOpen(false);
    } else if (preset === 'week') {
      onChange({ from: startOfWeek(today, { weekStartsOn: 1 }), to: endOfWeek(today, { weekStartsOn: 1 }) });
      setOpen(false);
    } else if (preset === 'month') {
      onChange({ from: startOfMonth(today), to: endOfMonth(today) });
      setOpen(false);
    } else if (preset === 'prevMonth') {
      const prev = subMonths(today, 1);
      onChange({ from: startOfMonth(prev), to: endOfMonth(prev) });
      setOpen(false);
    } else if (preset === 'year') {
      onChange({ from: startOfYear(today), to: endOfYear(today) });
      setOpen(false);
    }
    // 'custom' stays open so user can fill the date inputs
  };

  // "All time" sentinels used when only one side of a custom range is picked.
  const MIN_DATE = new Date(1900, 0, 1);
  const MAX_DATE = new Date(9999, 11, 31);

  /** Apply the custom range live on every change. With `allowAllTime`, a missing side is
   *  filled with an all-time sentinel (open-ended start when only "hasta" is set, open-
   *  ended future when only "desde" is set); otherwise we wait until both are present. */
  const emitCustom = (fromIso: string, toIso: string) => {
    if (fromIso && toIso) {
      onChange({ from: parseISO(fromIso), to: parseISO(toIso) });
    } else if (allowAllTime && (fromIso || toIso)) {
      onChange({ from: fromIso ? parseISO(fromIso) : MIN_DATE, to: toIso ? parseISO(toIso) : MAX_DATE });
    } else if (allowAllTime) {
      onChange(undefined);
    }
  };

  const handleCustomFrom = (iso: string) => {
    setCustomFrom(iso);
    setActive('custom');
    emitCustom(iso, customTo);
  };

  const handleCustomTo = (iso: string) => {
    setCustomTo(iso);
    setActive('custom');
    emitCustom(customFrom, iso);
  };

  const presets: { key: Preset; label: string }[] = [
    ...(allowAllTime ? [{ key: 'all' as Preset, label: t('all') }] : []),
    { key: 'today',     label: t('today')     },
    { key: 'week',      label: t('week')       },
    { key: 'month',     label: t('month')      },
    { key: 'prevMonth', label: t('prevMonth')  },
    { key: 'year',      label: t('year')       },
  ];

  const customLabel = () => {
    const f = customFrom ? format(parseISO(customFrom), 'dd/MM/yy') : null;
    const tt = customTo ? format(parseISO(customTo), 'dd/MM/yy') : null;
    if (f && tt) return `${f} – ${tt}`;
    if (f) return `${t('fromPrefix')} ${f}`;
    if (tt) return `${t('toPrefix')} ${tt}`;
    return t('custom');
  };
  const triggerLabel = active === 'custom'
    ? customLabel()
    : presets.find((p) => p.key === active)?.label ?? t('month');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('h-8 gap-1.5 text-xs font-normal', className)}
        >
          <CalendarIcon className="h-3 w-3 shrink-0" />
          <span className="max-w-[160px] truncate">{triggerLabel}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-52 p-1" align="start">
        {/* Presets list */}
        {presets.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => applyPreset(key)}
            className={cn(
              'flex w-full items-center rounded px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
              active === key && 'bg-accent text-accent-foreground font-medium'
            )}
          >
            {label}
          </button>
        ))}

        {/* Separator */}
        <div className="my-1 h-px bg-border" />

        {/* Custom date range. Only the label follows the accent foreground — the date
            inputs keep their own foreground so their text/icon stay visible on the white
            field background (accent-foreground is white in the light theme). */}
        <div
          className={cn(
            'rounded px-3 py-2 space-y-2',
            active === 'custom' && 'bg-accent'
          )}
          onClick={() => setActive('custom')}
        >
          <p className={cn('text-xs font-medium', active === 'custom' ? 'text-accent-foreground' : 'text-muted-foreground')}>{t('custom')}</p>
          <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
            <DatePickerInput
              value={customFrom}
              onChange={handleCustomFrom}
              placeholder="Desde dd/mm/aaaa"
              iconClassName="text-foreground"
            />
            <DatePickerInput
              value={customTo}
              onChange={handleCustomTo}
              placeholder="Hasta dd/mm/aaaa"
              iconClassName="text-foreground"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
