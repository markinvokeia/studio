'use client';

import * as React from 'react';
import { AlertTriangle, ExternalLink, Link2, Loader2, Phone, RefreshCw, Unlink, UserPlus, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { DataCard } from '@/components/ui/data-card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { PatientFormDialogShell } from '@/components/patients/patient-form-dialog-shell';
import { PatientInfoTab } from '@/components/patients/patient-info-tab';
import { useReadOnly } from '@/components/patient-portal/read-only-context';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useDataLoader } from '@/hooks/use-data-loader';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import {
  fetchPatientById,
  fetchPatientDependents,
  resolveDependencyErrorCode,
  searchDependentCandidates,
  setPatientResponsible,
} from '@/components/patients/patient-form-utils';
import { getErrorMessage } from '@/lib/error-utils';
import { computeAge } from '@/lib/prescription-render';
import { isAbortError, isTimeoutError } from '@/services/api';
import { usePatientView } from '@/stores/patient-view-store';
import { PATIENTS_PERMISSIONS } from '@/constants/permissions';
import type { PatientDependent, User } from '@/lib/types';

interface PatientDependentsTabProps {
  /** Paciente de la ficha. Si es dependiente, la pestaña muestra a su tutor y a los otros dependientes de este. */
  patient: User;
  /** Tutor del paciente cuando es dependiente (el listado de `/users` no siempre trae su nombre). */
  responsible?: { id: string; name: string } | null;
  /** Avisa que cambió quién depende de este paciente (para refrescar listados del host). */
  onDependentsChanged?: () => void;
}

/**
 * Pestaña "Dependientes" de la ficha del paciente: los pacientes a su cargo
 * (`users.responsible_contact_id`) con alta, vinculación y desvinculación. Para un
 * paciente dependiente muestra, de solo lectura, a su tutor y a los otros a cargo de él:
 * el tutor se cambia desde "Detalles".
 */
export function PatientDependentsTab({ patient, responsible, onDependentsChanged }: PatientDependentsTabProps) {
  const t = useTranslations('UsersPage.dependents');
  const tRoot = useTranslations();
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const isPortal = useReadOnly();
  const openPatientView = usePatientView((s) => s.open);
  const notifyPatientUpdated = usePatientView((s) => s.notifyPatientUpdated);

  const isDependent = !!patient.is_dependent;
  // Tutor cuyos dependientes se listan: el propio paciente, o su tutor si es dependiente.
  const guardianId = isDependent ? responsible?.id ?? patient.responsible_contact_id ?? null : patient.id;
  const canManage = !isDependent && !isPortal && hasPermission(PATIENTS_PERMISSIONS.UPDATE);
  const canCreate = canManage && hasPermission(PATIENTS_PERMISSIONS.CREATE);

  const {
    data: loaded,
    isLoading,
    isRefreshing,
    error: loadError,
    reload,
  } = useDataLoader(
    (signal) => (guardianId ? fetchPatientDependents(guardianId, signal) : Promise.resolve([])),
    [] as PatientDependent[],
    [guardianId],
  );
  const dependents = isDependent ? loaded.filter((d) => d.id !== patient.id) : loaded;

  const openPatient = (dependent: { id: string; name: string; email?: string | null; phone_number?: string | null }) => {
    openPatientView({
      userId: dependent.id,
      userName: dependent.name,
      userEmail: dependent.email || undefined,
      userPhone: dependent.phone_number || undefined,
    });
  };

  // Agenda y panel de citas muestran el teléfono/tutor del paciente: se les avisa del
  // cambio con la ficha recién leída. Es un extra; si falla, la vista ya quedó bien.
  const afterChange = async (dependentId: string) => {
    await reload();
    onDependentsChanged?.();
    fetchPatientById(dependentId).then((u) => { if (u) notifyPatientUpdated(u); }).catch(() => {});
  };

  const describeError = (error: unknown) =>
    resolveDependencyErrorCode((error as { code?: string })?.code, tRoot) ?? getErrorMessage(error);

  // ── Desvincular ────────────────────────────────────────────────────────────
  const [unlinking, setUnlinking] = React.useState<PatientDependent | null>(null);
  const unlink = useAsyncAction(async (dependent: PatientDependent) => {
    await setPatientResponsible(dependent.id, null);
    return dependent;
  }, {
    onSuccess: async (dependent) => {
      toast({ title: t('unlinkSuccess', { name: dependent.name }) });
      setUnlinking(null);
      await afterChange(dependent.id);
    },
    onError: (error) => {
      if (isTimeoutError(error)) { reload(); return; }
      toast({ variant: 'destructive', title: t('unlinkError'), description: describeError(error) });
    },
    showErrorToast: false,
  });

  // ── Vincular un paciente existente ─────────────────────────────────────────
  const [isLinkOpen, setLinkOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<User[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  // Paciente que ya depende de otro tutor: se pide confirmar antes de reasignarlo.
  const [reassigning, setReassigning] = React.useState<User | null>(null);

  React.useEffect(() => {
    if (!isLinkOpen) return;
    const term = query.trim();
    if (!term) { setResults([]); setSearchError(null); setIsSearching(false); return; }
    const controller = new AbortController();
    const handler = setTimeout(async () => {
      setIsSearching(true);
      setSearchError(null);
      try {
        const found = await searchDependentCandidates(term, patient.id, controller.signal);
        if (!controller.signal.aborted) setResults(found);
      } catch (error) {
        if (!controller.signal.aborted && !isAbortError(error)) setSearchError(getErrorMessage(error));
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 300);
    return () => { clearTimeout(handler); controller.abort(); };
  }, [query, isLinkOpen, patient.id]);

  // Un vínculo a la vez: guarda el elegido para marcar su fila mientras se guarda.
  const [linkingId, setLinkingId] = React.useState<string | null>(null);
  const link = useAsyncAction(async (candidate: User) => {
    setLinkingId(candidate.id);
    try {
      await setPatientResponsible(candidate.id, patient.id);
    } finally {
      setLinkingId(null);
    }
    return candidate;
  }, {
    onSuccess: async (candidate) => {
      toast({ title: t('linkSuccess', { name: candidate.name }) });
      setReassigning(null);
      setLinkOpen(false);
      setQuery('');
      setResults([]);
      await afterChange(candidate.id);
    },
    onError: (error) => {
      if (isTimeoutError(error)) { reload(); return; }
      toast({ variant: 'destructive', title: t('linkError'), description: describeError(error) });
    },
    showErrorToast: false,
  });

  const linkedIds = React.useMemo(() => new Set(loaded.map((d) => d.id)), [loaded]);

  const handlePickCandidate = (candidate: User) => {
    if (linkedIds.has(candidate.id) || link.isPending) return;
    if (candidate.is_dependent) {
      setLinkOpen(false);
      setReassigning(candidate);
      return;
    }
    link.run(candidate);
  };

  // ── Alta de un dependiente nuevo ───────────────────────────────────────────
  const [isCreateOpen, setCreateOpen] = React.useState(false);
  const [isCreateDirty, setCreateDirty] = React.useState(false);

  // ── Render ─────────────────────────────────────────────────────────────────
  const renderDependentCard = (dependent: PatientDependent, manageable: boolean) => {
    const age = computeAge(dependent.birth_date);
    return (
      <DataCard
        key={dependent.id}
        title={dependent.name}
        subtitle={[
          age ? t('age', { age }) : null,
          dependent.identity_document,
          dependent.phone_number,
        ].filter(Boolean).join(' · ')}
        badge={(
          <div className="flex flex-wrap items-center gap-1">
            {!dependent.is_active && <Badge variant="outline" className="text-[10px]">{t('inactive')}</Badge>}
            {dependent.uses_responsible_phone && (
              <Badge variant="secondary" className="gap-1 text-[10px] font-normal">
                <Phone className="h-3 w-3" />
                {t('usesResponsiblePhone')}
              </Badge>
            )}
          </div>
        )}
        onClick={() => openPatient(dependent)}
        actions={(
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => openPatient(dependent)}
              aria-label={t('openProfile')}
              title={t('openProfile')}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
            {manageable && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setUnlinking(dependent)}
                disabled={unlink.isPending}
                aria-label={t('unlink')}
                title={t('unlink')}
              >
                <Unlink className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      />
    );
  };

  const listBody = isLoading ? (
    <div className="space-y-2">
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-16 w-full rounded-xl" />
    </div>
  ) : loadError ? (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-destructive/40 px-4 py-8 text-center">
      <AlertTriangle className="h-5 w-5 text-destructive" />
      <p className="text-sm text-muted-foreground">{loadError}</p>
      <Button size="sm" variant="outline" onClick={() => reload()} loading={isRefreshing}>{t('retry')}</Button>
    </div>
  ) : dependents.length === 0 ? (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-10 text-center">
      <Users className="h-6 w-6 text-muted-foreground/60" />
      <p className="text-sm font-medium">{isDependent ? t('noSiblings') : t('empty')}</p>
      {!isDependent && <p className="max-w-sm text-xs text-muted-foreground">{t('emptyHint')}</p>}
    </div>
  ) : (
    <div className="space-y-2">{dependents.map((d) => renderDependentCard(d, canManage))}</div>
  );

  if (isDependent) {
    const responsibleName = responsible?.name || patient.responsible_contact_name || '';
    return (
      <div className="space-y-5">
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('responsibleTitle')}</h3>
          {guardianId ? (
            <DataCard
              title={responsibleName || t('responsibleUnknown')}
              subtitle={t('responsibleHint')}
              avatar={<Users className="h-4 w-4" />}
              onClick={() => openPatient({ id: guardianId, name: responsibleName })}
              showArrow
            />
          ) : (
            <p className="text-sm text-muted-foreground">{t('responsibleUnknown')}</p>
          )}
        </section>
        {guardianId && (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('siblingsTitle', { name: responsibleName })}
            </h3>
            {listBody}
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{t('title')}</h3>
          {!isLoading && !loadError && <Badge variant="secondary" className="text-[10px]">{dependents.length}</Badge>}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            onClick={() => reload()}
            disabled={isRefreshing}
            aria-label={t('refresh')}
            title={t('refresh')}
          >
            <RefreshCw className={isRefreshing ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
          </Button>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <Popover
              open={isLinkOpen}
              onOpenChange={(open) => {
                if (!open && link.isPending) return;
                setLinkOpen(open);
                if (!open) { setQuery(''); setResults([]); setSearchError(null); }
              }}
            >
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1.5">
                  <Link2 className="h-4 w-4" />
                  {t('linkExisting')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end" collisionPadding={12}>
                <Command shouldFilter={false}>
                  <CommandInput placeholder={t('searchPlaceholder')} value={query} onValueChange={setQuery} />
                  <CommandList className="max-h-64">
                    {isSearching ? (
                      <div className="flex items-center justify-center py-6 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    ) : searchError ? (
                      <p className="px-3 py-6 text-center text-sm text-destructive">{searchError}</p>
                    ) : results.length === 0 ? (
                      <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                        {query.trim() ? t('noResults') : t('searchHint')}
                      </p>
                    ) : (
                      <CommandGroup>
                        {results.map((candidate) => {
                          const alreadyLinked = linkedIds.has(candidate.id);
                          return (
                            <CommandItem
                              key={candidate.id}
                              value={candidate.id}
                              disabled={alreadyLinked || link.isPending}
                              onSelect={() => handlePickCandidate(candidate)}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="truncate">{candidate.name}</div>
                                <div className="truncate text-xs text-muted-foreground">
                                  {alreadyLinked
                                    ? t('alreadyLinked')
                                    : candidate.is_dependent
                                      ? t('hasOtherResponsible')
                                      : candidate.identity_document || candidate.phone_number || candidate.email}
                                </div>
                              </div>
                              {linkingId === candidate.id && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {canCreate && (
              <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
                <UserPlus className="h-4 w-4" />
                {t('addNew')}
              </Button>
            )}
          </div>
        )}
      </div>

      {listBody}

      {/* Desvincular: el dependiente deja de usar el teléfono/correo del tutor. */}
      <AlertDialog open={!!unlinking} onOpenChange={(open) => { if (!open && !unlink.isPending) setUnlinking(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('unlinkTitle')}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>{t('unlinkDescription', { name: unlinking?.name ?? '', responsible: patient.name })}</p>
                {unlinking?.uses_responsible_phone && (
                  <p className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-2 text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{t('unlinkNoPhoneWarning', { name: unlinking.name })}</span>
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unlink.isPending}>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (unlinking) unlink.run(unlinking); }}
              disabled={unlink.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {unlink.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('unlinkConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reasignar: el paciente elegido ya está a cargo de otro tutor. */}
      <AlertDialog open={!!reassigning} onOpenChange={(open) => { if (!open && !link.isPending) setReassigning(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('reassignTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {reassigning?.responsible_contact_name
                ? t('reassignDescriptionNamed', { name: reassigning.name, current: reassigning.responsible_contact_name, responsible: patient.name })
                : t('reassignDescription', { name: reassigning?.name ?? '', responsible: patient.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={link.isPending}>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (reassigning) link.run(reassigning); }}
              disabled={link.isPending}
            >
              {link.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('reassignConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {canCreate && (
        <PatientFormDialogShell
          open={isCreateOpen}
          onOpenChange={setCreateOpen}
          title={t('createTitle')}
          description={t('createDescription', { name: patient.name })}
          confirmOnClose
          isDirty={isCreateDirty}
        >
          {isCreateOpen && (
            <PatientInfoTab
              variant="dialog"
              initialResponsible={{ id: patient.id, name: patient.name }}
              onDirtyChange={setCreateDirty}
              onSaved={async (created) => {
                setCreateOpen(false);
                await reload();
                onDependentsChanged?.();
                if (created.id) notifyPatientUpdated(created);
              }}
            />
          )}
        </PatientFormDialogShell>
      )}
    </div>
  );
}

export default PatientDependentsTab;
