'use client';

import * as React from 'react';
import { Loader2, UserRound, UserSearch } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { API_ROUTES } from '@/constants/routes';
import { usePatientView } from '@/stores/patient-view-store';
import { api } from '@/services/api';
import { cn } from '@/lib/utils';

interface QuickPatientResult {
  id: string;
  name: string;
  phone_number: string;
  email: string;
}

/**
 * Always-visible quick patient search (first widget icon). Searches patients the
 * same way the Patients page search does and opens the full patient view.
 */
export function QuickPatientSearch() {
  const t = useTranslations('QuickPatientSearch');
  const { open: openPatient } = usePatientView();

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<QuickPatientResult[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  // Debounced search mirroring the Patients page / UserSelector behavior.
  React.useEffect(() => {
    if (!open) return;
    const handler = setTimeout(async () => {
      setIsLoading(true);
      try {
        const params: Record<string, string> = { filter_type: 'PACIENTE' };
        if (query.trim()) params.search = query.trim();
        const data = await api.get(API_ROUTES.USERS, params);
        let usersData: any[] = [];
        if (Array.isArray(data) && data.length > 0) {
          const first = data[0];
          usersData = first.json?.data || first.data || [];
        } else if (data?.data) {
          usersData = data.data;
        }
        setResults(usersData.map((u: any) => ({
          id: String(u.id),
          name: u.name || 'Sin nombre',
          phone_number: u.phone_number || '',
          email: u.email || '',
        })));
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [query, open]);

  const handleSelect = (patient: QuickPatientResult) => {
    setOpen(false);
    setQuery('');
    openPatient({
      userId: patient.id,
      userName: patient.name,
      userEmail: patient.email || undefined,
      userPhone: patient.phone_number || undefined,
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-xl h-10 w-10 bg-muted/60 text-muted-foreground hover:bg-muted"
          title={t('title')}
          aria-label={t('title')}
        >
          <UserSearch className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="left"
        align="start"
        sideOffset={8}
        className="w-80 p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t('placeholder')}
            value={query}
            onValueChange={setQuery}
            autoFocus
          />
          <CommandList className="max-h-72">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('searching')}
              </div>
            ) : results.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {query.trim() ? t('noResults') : t('hint')}
              </p>
            ) : (
              <CommandGroup>
                {results.map((patient) => (
                  <CommandItem
                    key={patient.id}
                    value={`${patient.name} ${patient.phone_number} ${patient.id}`}
                    onSelect={() => handleSelect(patient)}
                    className="gap-2"
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                      <UserRound className="h-3.5 w-3.5" />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">{patient.name}</span>
                      {(patient.phone_number || patient.email) && (
                        <span className={cn('truncate text-xs text-muted-foreground')}>
                          {patient.phone_number || patient.email}
                        </span>
                      )}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
