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
import { Download, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { DatePickerInput } from '@/components/ui/date-picker';
import {
  Dialog,
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
  /** Calendario preseleccionado (normalmente el primero visible en la agenda). */
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

  // Al abrir: reset al calendario por defecto y al día de hoy.
  React.useEffect(() => {
    if (!open) return;
    const fallback = defaultCalendarId || calendars[0]?.id || '';
    setCalendarId((prev) => (prev && calendars.some((c) => c.id === prev) ? prev : fallback));
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
          study: t('col_study'),
          name: t('col_name'),
          identityDocument: t('col_identity'),
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Calendario */}
          <div className="space-y-1.5">
            <Label>{t('field_calendar')}</Label>
            <Select value={calendarId} onValueChange={setCalendarId}>
              <SelectTrigger>
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
          </div>

          {/* Rango */}
          <div className="space-y-1.5">
            <Label>{t('field_range')}</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {presets.map((p) => (
                <Button
                  key={p}
                  type="button"
                  size="sm"
                  variant={preset === p ? 'default' : 'outline'}
                  onClick={() => setPreset(p)}
                >
                  {t(`range_${p}`)}
                </Button>
              ))}
            </div>
          </div>

          {/* Fecha ancla para día/semana/mes */}
          {preset !== 'custom' && (
            <div className="space-y-1.5">
              <Label>{t('field_anchor')}</Label>
              <DatePickerInput value={anchor} onChange={setAnchor} />
            </div>
          )}

          {/* Rango personalizado */}
          {preset === 'custom' && (
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
            <p className={cn('text-xs text-muted-foreground')}>
              {format(resolved.from, 'dd/MM/yyyy') === format(resolved.to, 'dd/MM/yyyy')
                ? t('summary_single', { date: format(resolved.from, 'dd/MM/yyyy') })
                : t('summary_range', {
                    from: format(resolved.from, 'dd/MM/yyyy'),
                    to: format(resolved.to, 'dd/MM/yyyy'),
                  })}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
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
