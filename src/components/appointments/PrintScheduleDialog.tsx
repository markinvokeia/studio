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
import { useLocale, useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Skeleton } from '@/components/ui/skeleton';

import { useToast } from '@/hooks/use-toast';
import { getDateFnsLocale } from '@/lib/locale';
import { cn } from '@/lib/utils';
import { exportScheduleToExcel } from '@/services/appointment-schedule-export';
import { fetchScheduleExportSettings, SCHEDULE_EXPORT_COLUMNS } from '@/services/system-config';

import type { AppointmentStatus, ScheduleExportColumn, ScheduleExportSettings } from '@/lib/types';

type RangePreset = 'day' | 'week' | 'month' | 'custom';

export interface PrintScheduleCalendar {
  id: string;
  name: string;
  /** Sede del calendario (para agrupar y para la columna Sede del extendido). */
  sedeId?: string;
  sedeName?: string;
}

interface PrintScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendars: PrintScheduleCalendar[];
  /** Calendario preseleccionado: el que la agenda está mostrando al abrir el diálogo. */
  defaultCalendarId?: string | null;
}

interface CalendarGroup {
  key: string;
  name: string;
  calendars: PrintScheduleCalendar[];
}

const NO_SEDE_KEY = '__no_sede__';

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

/** Calendarios agrupados por sede, en el orden en que llegan; los sin sede al final. */
function groupBySede(calendars: PrintScheduleCalendar[], noSedeName: string): CalendarGroup[] {
  const groups = new Map<string, CalendarGroup>();
  const orphans: PrintScheduleCalendar[] = [];
  for (const cal of calendars) {
    if (!cal.sedeId) {
      orphans.push(cal);
      continue;
    }
    if (!groups.has(cal.sedeId)) {
      groups.set(cal.sedeId, { key: cal.sedeId, name: cal.sedeName || cal.sedeId, calendars: [] });
    }
    groups.get(cal.sedeId)!.calendars.push(cal);
  }
  const result = Array.from(groups.values());
  if (orphans.length) result.push({ key: NO_SEDE_KEY, name: noSedeName, calendars: orphans });
  return result;
}

export function PrintScheduleDialog({
  open,
  onOpenChange,
  calendars,
  defaultCalendarId,
}: PrintScheduleDialogProps) {
  const t = useTranslations('PrintScheduleDialog');
  const tStatus = useTranslations('AppointmentStatus');
  const locale = useLocale();
  const { toast } = useToast();

  const todayIso = format(new Date(), 'yyyy-MM-dd');

  // Formato que eligió la clínica en Preferencias de Clínica; `null` mientras se lee.
  const [settings, setSettings] = React.useState<ScheduleExportSettings | null>(null);
  const mode = settings?.mode ?? null;
  const [calendarId, setCalendarId] = React.useState<string>('');
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
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
    setSelectedIds(preferred ? [preferred] : []);
    setPreset('day');
    setAnchor(todayIso);
    setCustomFrom(todayIso);
    setCustomTo(todayIso);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Se relee en cada apertura: un cambio en Preferencias de Clínica se ve sin recargar.
  React.useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setSettings(null);
    fetchScheduleExportSettings({ signal: controller.signal })
      .then(setSettings)
      .catch(() => { /* abortado al cerrar */ });
    return () => controller.abort();
  }, [open]);

  const groups = React.useMemo(() => groupBySede(calendars, t('no_sede')), [calendars, t]);

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

  const isExtended = mode === 'extended';
  const exportCalendars = React.useMemo(() => {
    if (isExtended) {
      const ids = new Set(selectedIds);
      return calendars.filter((c) => ids.has(c.id));
    }
    const cal = calendars.find((c) => c.id === calendarId);
    return cal ? [cal] : [];
  }, [isExtended, selectedIds, calendarId, calendars]);

  const canExport = mode !== null && exportCalendars.length > 0 && !!resolved && !isExporting;

  const toggleIds = (ids: string[], checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (checked ? next.add(id) : next.delete(id)));
      // Orden canónico (el de la lista), para que el Excel no dependa del orden de clic.
      return calendars.filter((c) => next.has(c.id)).map((c) => c.id);
    });
  };

  const handleExport = async () => {
    if (!settings || !exportCalendars.length || !resolved) return;
    setIsExporting(true);
    try {
      const { count } = await exportScheduleToExcel({
        settings,
        calendars: exportCalendars.map((c) => ({ id: c.id, name: c.name, sedeName: c.sedeName })),
        from: resolved.from,
        to: resolved.to,
        dateLocale: getDateFnsLocale(locale),
        labels: {
          basic: { time: t('col_time'), name: t('col_name'), phone: t('col_phone') },
          columns: Object.fromEntries(
            SCHEDULE_EXPORT_COLUMNS.map((c) => [c, t(`columns.${c}`)]),
          ) as Record<ScheduleExportColumn, string>,
          status: (status: AppointmentStatus) => tStatus(status),
          noSede: t('no_sede'),
          multiCalendarFile: t('file_name_multi'),
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

  // Mientras se genera el archivo el diálogo no se cierra (Esc / clic afuera).
  const handleOpenChange = (next: boolean) => {
    if (!next && isExporting) return;
    onOpenChange(next);
  };

  const presets: RangePreset[] = ['day', 'week', 'month', 'custom'];
  const allSelected = calendars.length > 0 && selectedIds.length === calendars.length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent maxWidth="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 shrink-0" />
            {t('title')}
          </DialogTitle>
          <DialogDescription>{isExtended ? t('description_extended') : t('description')}</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-5 px-6 py-5">
          {/* Calendario(s) */}
          {mode === null ? (
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : isExtended ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label>{t('field_calendars')}</Label>
                {calendars.length > 0 && (
                  <button
                    type="button"
                    onClick={() => toggleIds(calendars.map((c) => c.id), !allSelected)}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    {allSelected ? t('select_none') : t('select_all')}
                  </button>
                )}
              </div>
              {calendars.length ? (
                <div className="max-h-64 space-y-3 overflow-y-auto rounded-md border p-3">
                  {groups.map((group) => {
                    const ids = group.calendars.map((c) => c.id);
                    const selectedCount = ids.filter((id) => selectedIds.includes(id)).length;
                    const groupState =
                      selectedCount === 0 ? false : selectedCount === ids.length ? true : 'indeterminate';
                    const groupId = `print-schedule-sede-${group.key}`;
                    return (
                      <div key={group.key} className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={groupId}
                            checked={groupState}
                            onCheckedChange={(v) => toggleIds(ids, v === true)}
                          />
                          <Label
                            htmlFor={groupId}
                            className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                          >
                            {group.name}
                          </Label>
                        </div>
                        <div className="space-y-1.5 pl-6">
                          {group.calendars.map((cal) => {
                            const id = `print-schedule-cal-${cal.id}`;
                            return (
                              <div key={cal.id} className="flex items-center gap-2">
                                <Checkbox
                                  id={id}
                                  checked={selectedIds.includes(cal.id)}
                                  onCheckedChange={(v) => toggleIds([cal.id], v === true)}
                                />
                                <Label htmlFor={id} className="truncate text-sm font-normal">
                                  {cal.name}
                                </Label>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{t('no_calendars')}</p>
              )}
              {calendars.length > 0 && selectedIds.length === 0 && (
                <p className="text-xs text-muted-foreground">{t('select_at_least_one')}</p>
              )}
            </div>
          ) : (
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
          )}

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
                {isExtended && exportCalendars.length > 1 && ` · ${t('summary_calendars', { count: exportCalendars.length })}`}
                {isExtended && settings?.split_by_sede && ` · ${t('summary_split_by_sede')}`}
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
