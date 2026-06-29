'use client';

import * as React from 'react';
import { Check, Loader2, Plus } from 'lucide-react';

import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList, CommandInput } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { getSalesServices } from '@/services/services';
import { api } from '@/services/api';
import { API_ROUTES } from '@/constants/routes';
import type { Service } from '@/lib/types';

interface InlineServicePickerProps {
  selected: Service[];
  onToggle: (svc: Service) => void;
  searchPlaceholder: string;
  emptyText: string;
  createLabel: (name: string) => string;
}

function mapApiService(s: any): Service {
  return {
    id: String(s.id),
    name: s.name,
    category: s.category || '',
    price: s.price || 0,
    duration_minutes: s.duration_minutes || 0,
    is_active: s.is_active,
    service_type: s.service_type || 'single',
  } as Service;
}

/**
 * Searchable service picker with inline creation — mirrors the appointment form:
 * live search and, when no match exists, a "create" action that adds the service.
 */
export function InlineServicePicker({ selected, onToggle, searchPlaceholder, emptyText, createLabel }: InlineServicePickerProps) {
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<Service[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [isCreating, setIsCreating] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    setIsSearching(true);
    const handler = setTimeout(async () => {
      try {
        const r = await getSalesServices({ search: query.trim(), limit: 50 });
        if (!active) return;
        setResults(r.items.filter((s: any) => s.name?.trim()).map(mapApiService));
      } catch {
        if (active) setResults([]);
      } finally {
        if (active) setIsSearching(false);
      }
    }, 300);
    return () => { active = false; clearTimeout(handler); };
  }, [query]);

  const handleCreate = async () => {
    const name = query.trim();
    if (!name) return;
    setIsCreating(true);
    try {
      await api.post(API_ROUTES.PURCHASES.SERVICES_UPSERT, {
        name, price: 0, currency: 'UYU', is_sales: true, is_active: true, duration_minutes: 60, category: '', description: '',
      });
      const r = await getSalesServices({ search: name, limit: 50 });
      const created = r.items.map(mapApiService).find((s) => s.name.toLowerCase() === name.toLowerCase()) ?? r.items.map(mapApiService)[0];
      if (created) onToggle(created);
    } catch (error) {
      console.error('Failed to create service:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const showCreate = query.trim() && !results.some((s) => s.name.toLowerCase() === query.trim().toLowerCase());

  return (
    <Command shouldFilter={false} className="rounded-lg">
      <CommandInput placeholder={searchPlaceholder} value={query} onValueChange={setQuery} className="text-xs" />
      <CommandList className="max-h-48">
        {isSearching ? (
          <div className="flex items-center justify-center p-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {results.map((svc) => (
                <CommandItem key={svc.id} value={`${svc.name} ${svc.id}`} onSelect={() => onToggle(svc)} className="gap-2 text-xs">
                  <Check className={cn('h-3.5 w-3.5 shrink-0', selected.some((s) => s.id === svc.id) ? 'opacity-100' : 'opacity-0')} />
                  <span className="truncate">{svc.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {showCreate && (
              <button
                type="button"
                onClick={handleCreate}
                disabled={isCreating}
                className="flex w-full items-center gap-2 border-t px-2 py-2 text-left text-xs hover:bg-accent"
              >
                {isCreating ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                <span className="truncate">{createLabel(query.trim())}</span>
              </button>
            )}
          </>
        )}
      </CommandList>
    </Command>
  );
}
