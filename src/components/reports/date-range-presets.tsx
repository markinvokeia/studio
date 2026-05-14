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
}

type Preset = 'today' | 'week' | 'month' | 'prevMonth' | 'year' | 'custom';

export function DateRangePresets({ value, onChange, className }: DateRangePresetsProps) {
  const t = useTranslations('DateRangePresets');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Preset>('month');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');

  const today = new Date();

  const applyPreset = (preset: Preset) => {
    setActive(preset);
    if (preset === 'today') {
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

  const handleCustomFrom = (iso: string) => {
    setCustomFrom(iso);
    setActive('custom');
    if (iso && customTo) {
      onChange({ from: parseISO(iso), to: parseISO(customTo) });
    }
  };

  const handleCustomTo = (iso: string) => {
    setCustomTo(iso);
    setActive('custom');
    if (customFrom && iso) {
      onChange({ from: parseISO(customFrom), to: parseISO(iso) });
      setOpen(false);
    }
  };

  const presets: { key: Preset; label: string }[] = [
    { key: 'today',     label: t('today')     },
    { key: 'week',      label: t('week')       },
    { key: 'month',     label: t('month')      },
    { key: 'prevMonth', label: t('prevMonth')  },
    { key: 'year',      label: t('year')       },
  ];

  const triggerLabel =
    active === 'custom' && value?.from && value?.to
      ? `${format(value.from, 'dd/MM/yy')} – ${format(value.to, 'dd/MM/yy')}`
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
              'flex w-full items-center rounded px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent',
              active === key && 'bg-accent font-medium'
            )}
          >
            {label}
          </button>
        ))}

        {/* Separator */}
        <div className="my-1 h-px bg-border" />

        {/* Custom date range */}
        <div
          className={cn(
            'rounded px-3 py-2 space-y-2',
            active === 'custom' && 'bg-accent'
          )}
          onClick={() => setActive('custom')}
        >
          <p className="text-xs font-medium text-muted-foreground">{t('custom')}</p>
          <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
            <DatePickerInput
              value={customFrom}
              onChange={handleCustomFrom}
              placeholder="Desde dd/mm/aaaa"
            />
            <DatePickerInput
              value={customTo}
              onChange={handleCustomTo}
              placeholder="Hasta dd/mm/aaaa"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
