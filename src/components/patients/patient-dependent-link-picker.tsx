'use client';

import * as React from 'react';
import { Link2, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { searchDependentCandidates } from '@/components/patients/patient-form-utils';
import { getErrorMessage } from '@/lib/error-utils';
import { formatPhoneNumber } from '@/lib/phone-text';
import { isAbortError } from '@/services/api';
import type { User } from '@/lib/types';

interface PatientDependentLinkPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tutor al que se vincula; vacío si todavía no está guardado. */
  guardianId: string;
  /** Pacientes que ya están a cargo: se muestran, pero no se pueden elegir. */
  linkedIds: ReadonlySet<string>;
  /** Paciente que se está vinculando ahora (marca su fila y bloquea el resto). */
  linkingId?: string | null;
  onPick: (candidate: User) => void;
}

/** Botón "Vincular existente" con la búsqueda de pacientes que se pueden poner a cargo del tutor. */
export function PatientDependentLinkPicker({
  open,
  onOpenChange,
  guardianId,
  linkedIds,
  linkingId = null,
  onPick,
}: PatientDependentLinkPickerProps) {
  const t = useTranslations('UsersPage.dependents');
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<User[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const isLinking = !!linkingId;

  React.useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setSearchError(null);
      return;
    }
    const term = query.trim();
    if (!term) { setResults([]); setSearchError(null); setIsSearching(false); return; }
    const controller = new AbortController();
    const handler = setTimeout(async () => {
      setIsSearching(true);
      setSearchError(null);
      try {
        const found = await searchDependentCandidates(term, guardianId, controller.signal);
        if (!controller.signal.aborted) setResults(found);
      } catch (error) {
        if (!controller.signal.aborted && !isAbortError(error)) setSearchError(getErrorMessage(error));
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 300);
    return () => { clearTimeout(handler); controller.abort(); };
  }, [query, open, guardianId]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (!next && isLinking) return;
        onOpenChange(next);
      }}
    >
      <PopoverTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="gap-1.5">
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
                      disabled={alreadyLinked || isLinking}
                      onSelect={() => onPick(candidate)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{candidate.name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {alreadyLinked
                            ? t('alreadyLinked')
                            : candidate.is_dependent
                              ? t('hasOtherResponsible')
                              : candidate.identity_document || formatPhoneNumber(candidate.phone_number) || candidate.email}
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
  );
}
