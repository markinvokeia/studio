'use client';

import * as React from 'react';
import { Loader2, Palette, RotateCcw, Save, Share2, Undo2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
import { cn } from '@/lib/utils';

const GENERAL_SCOPE = 'general' as const;
type Scope = typeof GENERAL_SCOPE | string;

function rowsFromMatrix(
  matrix: AppointmentStatusDisplayMatrix,
  calendarId: string | null,
  statuses: AppointmentStatus[] = APPOINTMENT_STATUSES,
): CalendarStatusDisplayRow[] {
  return statuses.map((status) => ({
    calendar_id: calendarId,
    status,
    ...matrix[status],
  }));
}

function sameDisplay(a: AppointmentStatusDisplay, b: AppointmentStatusDisplay): boolean {
  return a.color === b.color && a.calendarMode === b.calendarMode && a.badgeStyle === b.badgeStyle;
}

/**
 * Configuración → Colores de Calendario. Selector de alcance (General + un tab
 * por calendario) sobre la misma tabla editable: General edita/guarda la
 * matriz completa; un calendario edita solo las filas que cambian, y puede
 * revertir un estado puntual o todo el override a la matriz general.
 */
export default function CalendarColorsConfigPage() {
  const t = useTranslations('CalendarColorsPage');
  const { hasPermission } = usePermissions();
  const canUpdate = hasPermission(CALENDAR_DISPLAY_PERMISSIONS.UPDATE);
  const { toast } = useToast();
  const setStoreRows = useCalendarStatusDisplayStore((s) => s.setRows);

  const [rows, setRows] = React.useState<CalendarStatusDisplayRow[]>([]);
  const [calendars, setCalendars] = React.useState<Calendar[]>([]);
  const [scope, setScope] = React.useState<Scope>(GENERAL_SCOPE);
  const [matrix, setMatrix] = React.useState<AppointmentStatusDisplayMatrix>(DEFAULT_STATUS_DISPLAY);
  const [initialMatrix, setInitialMatrix] = React.useState<AppointmentStatusDisplayMatrix>(DEFAULT_STATUS_DISPLAY);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isRevertingAll, setIsRevertingAll] = React.useState(false);
  const [revertingStatus, setRevertingStatus] = React.useState<AppointmentStatus | null>(null);
  const [replicateOpen, setReplicateOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [fetchedRows, fetchedCalendars] = await Promise.all([
        fetchStatusDisplayRows(),
        fetchAppointmentCalendars(),
      ]);
      setRows(fetchedRows);
      setCalendars(fetchedCalendars);
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

  const generalMatrix = React.useMemo(
    () => mergeStatusMatrix(DEFAULT_STATUS_DISPLAY, rows.filter((r) => r.calendar_id === null)),
    [rows],
  );

  const overriddenStatuses = React.useMemo(() => {
    if (scope === GENERAL_SCOPE) return undefined;
    return new Set(rows.filter((r) => r.calendar_id === scope).map((r) => r.status));
  }, [rows, scope]);

  const calendarHasOverride = React.useMemo(() => {
    const ids = new Set(rows.filter((r) => r.calendar_id !== null).map((r) => r.calendar_id as string));
    return (calendarId: string) => ids.has(calendarId);
  }, [rows]);

  // Sincroniza la matriz editable con el alcance activo cada vez que cambian
  // las filas del servidor o el usuario cambia de tab.
  React.useEffect(() => {
    const next =
      scope === GENERAL_SCOPE
        ? generalMatrix
        : mergeStatusMatrix(generalMatrix, rows.filter((r) => r.calendar_id === scope));
    setMatrix(next);
    setInitialMatrix(next);
  }, [scope, rows, generalMatrix]);

  const isDirty = JSON.stringify(matrix) !== JSON.stringify(initialMatrix);
  const canSave = canUpdate && isDirty && !isSaving;
  const isBusy = isSaving || isRevertingAll || revertingStatus !== null;

  const handleChange = (status: AppointmentStatus, patch: Partial<AppointmentStatusDisplay>) => {
    setMatrix((m) => ({ ...m, [status]: { ...m[status], ...patch } }));
  };

  const handleScopeChange = (next: string) => {
    if (isDirty && !window.confirm(t('unsavedChangesConfirm'))) return;
    setScope(next);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (scope === GENERAL_SCOPE) {
        const generalRows = rowsFromMatrix(matrix, null);
        await upsertStatusDisplayRows(generalRows);
        const nextRows = [...rows.filter((r) => r.calendar_id !== null), ...generalRows];
        setRows(nextRows);
        setStoreRows(nextRows);
      } else {
        const changedStatuses = APPOINTMENT_STATUSES.filter(
          (status) => !sameDisplay(matrix[status], initialMatrix[status]),
        );
        if (changedStatuses.length === 0) return;
        const changedRows = rowsFromMatrix(matrix, scope, changedStatuses);
        await upsertStatusDisplayRows(changedRows);
        const nextRows = [
          ...rows.filter((r) => !(r.calendar_id === scope && changedStatuses.includes(r.status))),
          ...changedRows,
        ];
        setRows(nextRows);
        setStoreRows(nextRows);
      }
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

  const handleRevertStatus = async (status: AppointmentStatus) => {
    if (scope === GENERAL_SCOPE) return;
    setRevertingStatus(status);
    try {
      await deleteCalendarOverride(scope, status);
      const nextRows = rows.filter((r) => !(r.calendar_id === scope && r.status === status));
      setRows(nextRows);
      setStoreRows(nextRows);
      toast({ title: t('scope.revertStatusSuccess') });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('scope.revertStatusError'),
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setRevertingStatus(null);
    }
  };

  const handleRevertAll = async () => {
    if (scope === GENERAL_SCOPE) return;
    setIsRevertingAll(true);
    try {
      await deleteCalendarOverride(scope);
      const nextRows = rows.filter((r) => r.calendar_id !== scope);
      setRows(nextRows);
      setStoreRows(nextRows);
      toast({ title: t('scope.revertAllSuccess') });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('scope.revertAllError'),
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsRevertingAll(false);
    }
  };

  const handleReplicate = async (calendarIds: string[]) => {
    try {
      const replicated = calendarIds.flatMap((calendarId) => rowsFromMatrix(matrix, calendarId));
      await upsertStatusDisplayRows(replicated);
      const nextRows = [
        ...rows.filter((r) => r.calendar_id === null || !calendarIds.includes(r.calendar_id)),
        ...replicated,
      ];
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

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  const replicateTargets = calendars.filter((c) => c.id !== scope);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        icon={<Palette className="h-5 w-5" />}
        title={t('title')}
        description={t('description')}
        actions={
          <Can permission={CALENDAR_DISPLAY_PERMISSIONS.UPDATE}>
            <div className="flex items-center gap-2">
              {scope === GENERAL_SCOPE ? (
                <Button variant="outline" onClick={handleRestoreDefaults} disabled={!canUpdate || isBusy} className="gap-1.5">
                  <RotateCcw className="h-4 w-4" />
                  {t('restoreDefaults')}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={handleRevertAll}
                  disabled={!canUpdate || isBusy || !calendarHasOverride(scope)}
                  className="gap-1.5"
                >
                  {isRevertingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
                  {t('scope.revertAll')}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setReplicateOpen(true)}
                disabled={!canUpdate || isBusy || calendars.length === 0}
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
        <Tabs value={scope} onValueChange={handleScopeChange}>
          <TabsList className="h-auto justify-start overflow-x-auto">
            <TabsTrigger value={GENERAL_SCOPE} className="gap-1.5">
              {t('scope.general')}
            </TabsTrigger>
            {calendars.map((calendar) => (
              <TabsTrigger key={calendar.id} value={calendar.id} className="gap-1.5">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/10"
                  style={{ backgroundColor: calendar.color || '#e5e7eb' }}
                />
                <span className="max-w-[12rem] truncate">{calendar.name}</span>
                {calendarHasOverride(calendar.id) && (
                  <span
                    className={cn('h-1.5 w-1.5 shrink-0 rounded-full', scope === calendar.id ? 'bg-primary-foreground' : 'bg-primary')}
                    title={t('scope.customized')}
                  />
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <p className="px-1 text-xs text-muted-foreground">
          {scope === GENERAL_SCOPE ? t('scope.generalHint') : t('scope.calendarHint')}
        </p>

        <StatusDisplayMatrix
          statuses={APPOINTMENT_STATUSES}
          matrix={matrix}
          onChange={handleChange}
          disabled={!canUpdate || isBusy}
          overriddenStatuses={overriddenStatuses}
          onRevertStatus={handleRevertStatus}
        />

        {!canUpdate && <p className="px-1 text-xs text-muted-foreground">{t('readOnlyNotice')}</p>}
      </div>

      <ReplicateDialog
        open={replicateOpen}
        onOpenChange={setReplicateOpen}
        calendars={replicateTargets}
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
