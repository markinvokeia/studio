'use client';

import * as React from 'react';
import { format, isValid, parseISO } from 'date-fns';
import { ArrowLeft, BookOpenText, ClipboardList, FilePlus2, Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ColumnDef, SortingState } from '@tanstack/react-table';

import { ResizableSheet, SheetTitle, SheetDescription } from '@/components/ui/resizable-sheet';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ViewModeToggle } from '@/components/ui/view-mode-toggle';

import { ClinicSessionDialog, ClinicSessionFormData } from '@/components/clinic-session-dialog';
import { PatientInstructionDialog } from '@/components/medical-instructions/patient-instruction-dialog';
import { TreatmentTimeline } from '@/components/users/clinic-history-viewer';

import { useClinicHistory } from '@/hooks/useClinicHistory';
import { usePatientHistorySheet } from '@/stores/patient-history-sheet-store';
import { useTableViewMode } from '@/hooks/use-table-view-mode';
import { useToast } from '@/hooks/use-toast';

import type { PatientSession } from '@/lib/types';

const formatSessionDate = (value?: string | null) => {
  if (!value) return '—';
  const parsed = parseISO(value);
  return isValid(parsed) ? format(parsed, 'dd/MM/yyyy') : value;
};

/**
 * Global host for the fullscreen "Historia" panel opened from the custom
 * calendar mode context menu. Shows the patient's clinical sessions as a
 * table and lets the user add annotations (simplified clinic sessions) and
 * medical instructions.
 */
export function PatientHistorySheet() {
  const { isOpen, userId, userName, close } = usePatientHistorySheet();
  const t = useTranslations('PatientHistorySheet');
  const { toast } = useToast();

  const {
    patientSessions,
    isLoadingPatientSessions,
    fetchPatientSessions,
    createSession,
    updateSession,
    deleteSession,
    doctors,
    isLoadingDoctors,
    fetchDoctors,
    isSubmittingSession,
    getSessionAttachment,
  } = useClinicHistory();

  const [viewMode, setViewMode] = useTableViewMode('patient-history-sheet', 'table');
  const [isAnnotationOpen, setIsAnnotationOpen] = React.useState(false);
  const [isInstructionOpen, setIsInstructionOpen] = React.useState(false);
  const [editingSession, setEditingSession] = React.useState<PatientSession | null>(null);
  const [deletingSession, setDeletingSession] = React.useState<PatientSession | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'fecha_sesion', desc: true }]);

  React.useEffect(() => {
    if (isOpen && userId) fetchPatientSessions(userId);
  }, [isOpen, userId, fetchPatientSessions]);

  // Odontogram sessions carry no useful textual description for this table.
  const rows = React.useMemo(
    () => patientSessions.filter((s) => s.tipo_sesion !== 'odontograma'),
    [patientSessions]
  );

  const columns = React.useMemo<ColumnDef<PatientSession>[]>(() => [
    {
      accessorKey: 'fecha_sesion',
      header: t('columns.date'),
      cell: ({ row }) => (
        <span className="whitespace-nowrap">{formatSessionDate(row.original.fecha_sesion)}</span>
      ),
    },
    {
      accessorKey: 'pieza',
      header: t('columns.piece'),
      cell: ({ row }) => row.original.pieza || '—',
    },
    {
      accessorKey: 'procedimiento_realizado',
      header: t('columns.description'),
      cell: ({ row }) => (
        <span className="whitespace-pre-wrap break-words">{row.original.procedimiento_realizado || '—'}</span>
      ),
    },
    {
      accessorKey: 'plan_proxima_cita',
      header: t('columns.next'),
      cell: ({ row }) => (
        <span className="whitespace-pre-wrap break-words">
          {row.original.plan_proxima_cita || '—'}
          {row.original.fecha_proxima_cita && (
            <span className="ml-1 text-xs text-muted-foreground">
              ({formatSessionDate(row.original.fecha_proxima_cita)})
            </span>
          )}
        </span>
      ),
    },
    {
      accessorKey: 'color',
      header: t('columns.color'),
      cell: ({ row }) => row.original.color ? (
        <span
          className="block h-3 w-3 rounded-full border"
          style={{ backgroundColor: row.original.color }}
          aria-label={`${t('columns.color')}: ${row.original.color}`}
          title={row.original.color}
        />
      ) : '—',
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label={t('edit')}
            title={t('edit')}
            onClick={() => {
              setEditingSession(row.original);
              setIsAnnotationOpen(true);
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            aria-label={t('delete')}
            title={t('delete')}
            onClick={() => setDeletingSession(row.original)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ], [t]);

  const handleSaveAnnotation = async (data: ClinicSessionFormData) => {
    if (!userId) return;
    if (editingSession?.sesion_id) {
      // Keep whatever attachments the session already has — the annotation
      // dialog doesn't expose them, so none can be added or removed here.
      await updateSession(
        editingSession.sesion_id,
        userId,
        data,
        undefined,
        undefined,
        editingSession.archivos_adjuntos || [],
      );
    } else {
      await createSession(userId, data);
    }
  };

  const confirmDeleteSession = async () => {
    if (!userId || !deletingSession) return;
    setIsDeleting(true);
    try {
      await deleteSession(deletingSession.sesion_id, userId);
      toast({ title: t('deleteSuccess') });
      setDeletingSession(null);
    } catch {
      toast({ title: t('deleteError'), variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <ResizableSheet
      open={isOpen}
      onOpenChange={(o) => { if (!o) close(); }}
      defaultWidth={900}
      minWidth={520}
      maxWidth={1300}
      storageKey="patient-history-sheet-width"
      defaultFullscreen
    >
      <div className="flex h-full flex-col overflow-hidden bg-card">
        <div className="flex flex-none items-center gap-3 border-b border-border px-5 py-4 pr-20">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <BookOpenText className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <SheetTitle className="truncate text-base font-semibold text-foreground">{t('title')}</SheetTitle>
            <SheetDescription className="truncate text-sm text-muted-foreground">{userName || ''}</SheetDescription>
          </div>
        </div>
        <div className="flex flex-none flex-wrap items-center gap-2 border-b border-border px-5 py-2.5">
          <Button variant="ghost" size="sm" onClick={close}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            {t('back')}
          </Button>
          <Button size="sm" onClick={() => { setEditingSession(null); setIsAnnotationOpen(true); }}>
            <FilePlus2 className="mr-1.5 h-4 w-4" />
            {t('newAnnotation')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsInstructionOpen(true)}>
            <ClipboardList className="mr-1.5 h-4 w-4" />
            {t('newInstruction')}
          </Button>
          <ViewModeToggle value={viewMode} onChange={setViewMode} className="ml-auto" />
        </div>
        {viewMode === 'table' ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
            <DataTable
              columns={columns}
              data={rows}
              isLoading={isLoadingPatientSessions}
              sorting={sorting}
              onSortingChange={setSorting}
              useGlobalFilter
              filterPlaceholder={t('searchPlaceholder')}
            />
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {userId && (
              <TreatmentTimeline
                sessions={patientSessions}
                appointments={[]}
                isLoading={isLoadingPatientSessions}
                userId={userId}
                userName={userName}
                doctors={doctors}
                isLoadingDoctors={isLoadingDoctors}
                isSubmittingSession={isSubmittingSession}
                onCreateSession={createSession}
                onUpdateSession={updateSession}
                onDeleteSession={deleteSession}
                onFetchDoctors={fetchDoctors}
                onRefreshAll={async (uid) => { await fetchPatientSessions(uid); }}
                onLoadSessionAttachment={getSessionAttachment}
                hideToolbar
                forcedTypeFilter="clinica"
                showSessionColor
              />
            )}
          </div>
        )}
      </div>

      {userId && (
        <ClinicSessionDialog
          open={isAnnotationOpen}
          onOpenChange={(o) => {
            setIsAnnotationOpen(o);
            if (!o) setEditingSession(null);
          }}
          onSave={handleSaveAnnotation}
          userId={userId}
          patientName={userName}
          existingSession={editingSession ?? undefined}
          annotationMode
        />
      )}

      <Dialog open={!!deletingSession} onOpenChange={(o) => { if (!o) setDeletingSession(null); }}>
        <DialogContent maxWidth="sm">
          <DialogHeader>
            <DialogTitle>{t('delete')}</DialogTitle>
          </DialogHeader>
          <DialogBody className="py-6 px-6">
            <p className="text-muted-foreground">{t('deleteConfirm')}</p>
          </DialogBody>
          <DialogFooter className="px-6 py-4 border-t gap-2">
            <Button variant="outline" onClick={() => setDeletingSession(null)} disabled={isDeleting}>
              {t('cancel')}
            </Button>
            <Button variant="destructive" onClick={confirmDeleteSession} disabled={isDeleting} className="px-8">
              {t('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {userId && (
        <PatientInstructionDialog
          open={isInstructionOpen}
          onOpenChange={setIsInstructionOpen}
          patientId={userId}
          patientName={userName}
          existingInstruction={null}
        />
      )}
    </ResizableSheet>
  );
}
