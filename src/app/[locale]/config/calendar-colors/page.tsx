'use client';

import * as React from 'react';
import { Loader2, Palette, RotateCcw, Save, Share2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';

import { Can } from '@/components/auth/Can';
import { StatusDisplayMatrix } from '@/components/calendar/status-display-matrix';

import { APPOINTMENT_STATUSES, DEFAULT_STATUS_DISPLAY } from '@/constants/appointment-status';
import { CALENDAR_DISPLAY_PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { mergeStatusMatrix } from '@/lib/appointment-status-display';
import type {
  AppointmentStatus,
  AppointmentStatusDisplay,
  AppointmentStatusDisplayMatrix,
  Calendar,
  CalendarStatusDisplayRow,
} from '@/lib/types';
import {
  deleteCalendarOverride,
  fetchStatusDisplayRows,
  upsertStatusDisplayRows,
} from '@/services/calendar-status-display';
import { fetchAppointmentCalendars } from '@/services/appointments';
import { useCalendarStatusDisplayStore } from '@/stores/calendar-status-display-store';

function rowsFromMatrix(matrix: AppointmentStatusDisplayMatrix, calendarId: string | null): CalendarStatusDisplayRow[] {
  return APPOINTMENT_STATUSES.map((status) => ({
    calendar_id: calendarId,
    status,
    ...matrix[status],
  }));
}

/**
 * Configuración → Colores de Calendario. Matriz general (calendar_id null) +
 * "Replicar a calendarios" para crear overrides. En esta fase los overrides
 * no se editan desde acá: solo se replican y se quitan (§6 del plan).
 */
export default function CalendarColorsConfigPage() {
  const t = useTranslations('CalendarColorsPage');
  const { hasPermission } = usePermissions();
  const canUpdate = hasPermission(CALENDAR_DISPLAY_PERMISSIONS.UPDATE);
  const { toast } = useToast();
  const setStoreRows = useCalendarStatusDisplayStore((s) => s.setRows);

  const [rows, setRows] = React.useState<CalendarStatusDisplayRow[]>([]);
  const [calendars, setCalendars] = React.useState<Calendar[]>([]);
  const [matrix, setMatrix] = React.useState<AppointmentStatusDisplayMatrix>(DEFAULT_STATUS_DISPLAY);
  const [initialMatrix, setInitialMatrix] = React.useState<AppointmentStatusDisplayMatrix>(DEFAULT_STATUS_DISPLAY);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [replicateOpen, setReplicateOpen] = React.useState(false);
  const [removingCalendarId, setRemovingCalendarId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [fetchedRows, fetchedCalendars] = await Promise.all([
        fetchStatusDisplayRows(),
        fetchAppointmentCalendars(),
      ]);
      setRows(fetchedRows);
      setCalendars(fetchedCalendars);
      const general = mergeStatusMatrix(
        DEFAULT_STATUS_DISPLAY,
        fetchedRows.filter((r) => r.calendar_id === null),
      );
      setMatrix(general);
      setInitialMatrix(general);
    } catch (error) {
      console.error('Failed to load the calendar status display matrix:', error);
      toast({ variant: 'destructive', title: t('loadError') });
    } finally {
      setIsLoading(false);
    }
  }, [t, toast]);

  React.useEffect(() => {
    load();
  }, [load]);

  const isDirty = JSON.stringify(matrix) !== JSON.stringify(initialMatrix);
  const canSave = canUpdate && isDirty && !isSaving;

  const handleChange = (status: AppointmentStatus, patch: Partial<AppointmentStatusDisplay>) => {
    setMatrix((m) => ({ ...m, [status]: { ...m[status], ...patch } }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const generalRows = rowsFromMatrix(matrix, null);
      await upsertStatusDisplayRows(generalRows);
      setInitialMatrix(matrix);
      const nextRows = [...rows.filter((r) => r.calendar_id !== null), ...generalRows];
      setRows(nextRows);
      // El resto de la app lee del store, no de esta página.
      setStoreRows(nextRows);
      toast({ title: t('saved') });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('saveError'),
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestoreDefaults = () => {
    setMatrix(DEFAULT_STATUS_DISPLAY);
  };

  const overrideCalendarIds = React.useMemo(
    () => Array.from(new Set(rows.filter((r) => r.calendar_id !== null).map((r) => r.calendar_id as string))),
    [rows],
  );

  const handleReplicate = async (calendarIds: string[]) => {
    try {
      const replicated = calendarIds.flatMap((calendarId) => rowsFromMatrix(matrix, calendarId));
      await upsertStatusDisplayRows(replicated);
      const nextRows = [...rows.filter((r) => r.calendar_id === null || !calendarIds.includes(r.calendar_id)), ...replicated];
      setRows(nextRows);
      setStoreRows(nextRows);
      toast({ title: t('replicateDialog.success') });
      setReplicateOpen(false);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('replicateDialog.error'),
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const handleRemoveOverride = async (calendarId: string) => {
    setRemovingCalendarId(calendarId);
    try {
      await deleteCalendarOverride(calendarId);
      const nextRows = rows.filter((r) => r.calendar_id !== calendarId);
      setRows(nextRows);
      setStoreRows(nextRows);
      toast({ title: t('overrides.removed') });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('overrides.removeError'),
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setRemovingCalendarId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        icon={<Palette className="h-5 w-5" />}
        title={t('title')}
        description={t('description')}
        actions={
          <Can permission={CALENDAR_DISPLAY_PERMISSIONS.UPDATE}>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleRestoreDefaults} disabled={!canUpdate || isSaving} className="gap-1.5">
                <RotateCcw className="h-4 w-4" />
                {t('restoreDefaults')}
              </Button>
              <Button
                variant="outline"
                onClick={() => setReplicateOpen(true)}
                disabled={!canUpdate || isSaving || calendars.length === 0}
                className="gap-1.5"
              >
                <Share2 className="h-4 w-4" />
                {t('replicateDialog.trigger')}
              </Button>
              <Button onClick={handleSave} disabled={!canSave} className="gap-1.5">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {t('save')}
              </Button>
            </div>
          </Can>
        }
      />

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-1 pb-6">
        <StatusDisplayMatrix
          statuses={APPOINTMENT_STATUSES}
          matrix={matrix}
          onChange={handleChange}
          disabled={!canUpdate || isSaving}
        />

        {!canUpdate && <p className="px-1 text-xs text-muted-foreground">{t('readOnlyNotice')}</p>}

        {overrideCalendarIds.length > 0 && (
          <div className="space-y-2 rounded-xl border p-4">
            <h2 className="text-sm font-semibold">{t('overrides.sectionTitle')}</h2>
            <p className="text-xs text-muted-foreground">{t('overrides.sectionDescription')}</p>
            <ul className="divide-y">
              {overrideCalendarIds.map((calendarId) => {
                const calendar = calendars.find((c) => c.id === calendarId);
                return (
                  <li key={calendarId} className="flex items-center justify-between gap-3 py-2">
                    <span className="text-sm font-medium">{calendar?.name ?? calendarId}</span>
                    <Can permission={CALENDAR_DISPLAY_PERMISSIONS.UPDATE}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-muted-foreground hover:text-destructive"
                        disabled={removingCalendarId === calendarId}
                        onClick={() => handleRemoveOverride(calendarId)}
                      >
                        {removingCalendarId === calendarId ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <X className="h-3.5 w-3.5" />
                        )}
                        {t('overrides.useGeneral')}
                      </Button>
                    </Can>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <ReplicateDialog
        open={replicateOpen}
        onOpenChange={setReplicateOpen}
        calendars={calendars}
        onConfirm={handleReplicate}
      />
    </div>
  );
}

function ReplicateDialog({
  open,
  onOpenChange,
  calendars,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendars: Calendar[];
  onConfirm: (calendarIds: string[]) => Promise<void>;
}) {
  const t = useTranslations('CalendarColorsPage');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) setSelected(new Set());
  }, [open]);

  const allSelected = calendars.length > 0 && selected.size === calendars.length;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(calendars.map((c) => c.id)));
  };

  const handleConfirm = async () => {
    if (selected.size === 0) return;
    setIsSubmitting(true);
    try {
      await onConfirm(Array.from(selected));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('replicateDialog.title')}</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-4 px-6 py-4">
          <p className="text-sm text-muted-foreground">{t('replicateDialog.description')}</p>

          <div className="flex items-center gap-2 border-b pb-2">
            <Checkbox checked={allSelected} onCheckedChange={toggleAll} id="replicate-select-all" />
            <label htmlFor="replicate-select-all" className="cursor-pointer text-sm font-medium">
              {t('replicateDialog.selectAll')}
            </label>
          </div>

          <div className="max-h-64 space-y-1 overflow-y-auto">
            {calendars.map((calendar) => (
              <div key={calendar.id} className="flex items-center gap-2 rounded-md p-1.5 hover:bg-muted/50">
                <Checkbox
                  checked={selected.has(calendar.id)}
                  onCheckedChange={() => toggle(calendar.id)}
                  id={`replicate-cal-${calendar.id}`}
                />
                <label htmlFor={`replicate-cal-${calendar.id}`} className="flex-1 cursor-pointer truncate text-sm">
                  {calendar.name}
                </label>
              </div>
            ))}
          </div>

          <p className="rounded-lg bg-primary/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            {t('replicateDialog.decoupleNotice')}
          </p>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            {t('replicateDialog.cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={selected.size === 0 || isSubmitting} className="gap-1.5">
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('replicateDialog.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
