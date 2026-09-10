'use client';

import * as React from 'react';
import {
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { CalendarRange, Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { DatePickerInput } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { exportScheduleToExcel } from '@/services/appointment-schedule-export';

type RangePreset = 'day' | 'week' | 'month' | 'custom';

interface PrintScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendars: { id: string; name: string }[];
  /** Calendario preseleccionado: el que la agenda está mostrando al abrir el diálogo. */
  defaultCalendarId?: string | null;
}

function computeRange(preset: RangePreset, anchorIso: string): { from: Date; to: Date } | null {
  if (preset === 'custom') return null;
  const anchor = anchorIso ? parseISO(anchorIso) : new Date();
  if (preset === 'day') return { from: anchor, to: anchor };
  if (preset === 'week') {
    return {
      from: startOfWeek(anchor, { weekStartsOn: 1 }),
      to: endOfWeek(anchor, { weekStartsOn: 1 }),
    };
  }
  return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
}

export function PrintScheduleDialog({
  open,
  onOpenChange,
  calendars,
  defaultCalendarId,
}: PrintScheduleDialogProps) {
  const t = useTranslations('PrintScheduleDialog');
  const { toast } = useToast();

  const todayIso = format(new Date(), 'yyyy-MM-dd');

  const [calendarId, setCalendarId] = React.useState<string>('');
  const [preset, setPreset] = React.useState<RangePreset>('day');
  const [anchor, setAnchor] = React.useState<string>(todayIso);
  const [customFrom, setCustomFrom] = React.useState<string>(todayIso);
  const [customTo, setCustomTo] = React.useState<string>(todayIso);
  const [isExporting, setIsExporting] = React.useState(false);

  // Al abrir: siempre arrancar en el calendario que la agenda está mostrando y
  // en el día de hoy, sin arrastrar la selección de una apertura anterior.
  React.useEffect(() => {
    if (!open) return;
    const preferred =
      defaultCalendarId && calendars.some((c) => c.id === defaultCalendarId)
        ? defaultCalendarId
        : calendars[0]?.id ?? '';
    setCalendarId(preferred);
    setPreset('day');
    setAnchor(todayIso);
    setCustomFrom(todayIso);
    setCustomTo(todayIso);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const resolved = React.useMemo(() => {
    if (preset === 'custom') {
      if (!customFrom || !customTo) return null;
      const from = parseISO(customFrom);
      const to = parseISO(customTo);
      if (from.getTime() > to.getTime()) return { from: to, to: from };
      return { from, to };
    }
    return computeRange(preset, anchor);
  }, [preset, anchor, customFrom, customTo]);

  const selectedCalendar = calendars.find((c) => c.id === calendarId);
  const canExport = !!selectedCalendar && !!resolved && !isExporting;

  const handleExport = async () => {
    if (!selectedCalendar || !resolved) return;
    setIsExporting(true);
    try {
      const { count } = await exportScheduleToExcel({
        calendar: selectedCalendar,
        from: resolved.from,
        to: resolved.to,
        columns: {
          time: t('col_time'),
          name: t('col_name'),
          phone: t('col_phone'),
        },
      });
      if (count === 0) {
        toast({ title: t('toast_empty') });
      } else {
        toast({ title: t('toast_success', { count }) });
        onOpenChange(false);
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('toast_error'),
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const presets: RangePreset[] = ['day', 'week', 'month', 'custom'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent maxWidth="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 shrink-0" />
            {t('title')}
          </DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-5 px-6 py-5">
          {/* Calendario */}
          <div className="space-y-1.5">
            <Label htmlFor="print-schedule-calendar">{t('field_calendar')}</Label>
            <Select value={calendarId} onValueChange={setCalendarId} disabled={!calendars.length}>
              <SelectTrigger id="print-schedule-calendar">
                <SelectValue placeholder={t('field_calendar_placeholder')} />
              </SelectTrigger>
              <SelectContent>
                {calendars.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!calendars.length && (
              <p className="text-xs text-muted-foreground">{t('no_calendars')}</p>
            )}
          </div>

          {/* Rango */}
          <div className="space-y-1.5">
            <Label>{t('field_range')}</Label>
            <div
              role="group"
              aria-label={t('field_range')}
              className="grid grid-cols-4 gap-1 rounded-md border bg-muted/40 p-1"
            >
              {presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={preset === p}
                  onClick={() => setPreset(p)}
                  className={cn(
                    'rounded-sm px-2 py-1.5 text-xs font-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
                    preset === p
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t(`range_${p}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Fecha ancla para día/semana/mes */}
          {preset !== 'custom' ? (
            <div className="space-y-1.5">
              <Label>{t('field_anchor')}</Label>
              <DatePickerInput value={anchor} onChange={setAnchor} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('field_from')}</Label>
                <DatePickerInput value={customFrom} onChange={setCustomFrom} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('field_to')}</Label>
                <DatePickerInput value={customTo} onChange={setCustomTo} />
              </div>
            </div>
          )}

          {resolved && (
            <div className="flex items-start gap-2 rounded-md border border-dashed bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
              <CalendarRange className="mt-px h-3.5 w-3.5 shrink-0" />
              <span>
                {format(resolved.from, 'dd/MM/yyyy') === format(resolved.to, 'dd/MM/yyyy')
                  ? t('summary_single', { date: format(resolved.from, 'dd/MM/yyyy') })
                  : t('summary_range', {
                      from: format(resolved.from, 'dd/MM/yyyy'),
                      to: format(resolved.to, 'dd/MM/yyyy'),
                    })}
              </span>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
            {t('cancel')}
          </Button>
          <Button onClick={handleExport} disabled={!canExport} className="gap-1.5">
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {t('export')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
