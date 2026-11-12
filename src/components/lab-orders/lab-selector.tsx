'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, FlaskConical, Loader2, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { DuplicateContactDialog, UniqueConflictDialog } from '@/components/patients/duplicate-contact-dialog';
import { saveProviderGroups } from '@/components/providers/provider-groups-field';

import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { formatPhoneNumber } from '@/lib/phone-text';
import { normalizePersonName } from '@/lib/person-name';
import { cn } from '@/lib/utils';
import { api, REQUEST_TIMEOUT_MS } from '@/services/api';
import { fetchLabCategories, searchLaboratories } from '@/services/lab-orders';
import { extractCreatedUserId } from '@/services/users';

import { PURCHASES_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import type { DuplicateContactOwners, LabCategory, Laboratory, UniqueConflict } from '@/lib/types';

/** Filtro "todas las categorías". */
const ALL = 'all';

export interface LabSelectorProps {
  value?: string;
  /** Nombre del laboratorio elegido, para mostrarlo sin volver a buscarlo. */
  selectedName?: string;
  onValueChange?: (laboratoryId: string, laboratory?: Laboratory) => void;
  /**
   * Categorías de laboratorio de los servicios de la orden. Con exactamente una, la lista
   * arranca filtrada por ella; con varias o ninguna, se ven todos los laboratorios.
   */
  categoryIds?: string[];
  /** Permite dar de alta un laboratorio desde el selector (default true). */
  allowCreate?: boolean;
  /** Muestra la opción para quitar la selección (filtros). */
  clearable?: boolean;
  placeholder?: string;
  triggerText?: string;
  className?: string;
  disabled?: boolean;
  'aria-invalid'?: React.AriaAttributes['aria-invalid'];
  /** Abre la lista al montar (modal "Elegir laboratorio"). */
  defaultOpen?: boolean;
}

/**
 * Selector de laboratorio: solo proveedores que pertenecen a alguna categoría de laboratorio
 * (grupos de proveedores marcados como tales). El alta crea el proveedor y lo asigna a las
 * categorías elegidas, así queda como laboratorio.
 */
export function LabSelector({
  value,
  selectedName,
  onValueChange,
  categoryIds,
  allowCreate = true,
  clearable = false,
  placeholder,
  triggerText,
  className,
  disabled = false,
  'aria-invalid': ariaInvalid,
  defaultOpen = false,
}: LabSelectorProps) {
  const t = useTranslations('LabOrdersPage.labSelector');
  const tEntity = useTranslations('EntitySelectors');
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const canCreate = allowCreate && hasPermission(PURCHASES_PERMISSIONS.SUPPLIERS_CREATE);

  const orderCategory = categoryIds && categoryIds.length === 1 ? categoryIds[0] : null;

  const [open, setOpen] = React.useState(defaultOpen);
  const [categories, setCategories] = React.useState<LabCategory[] | null>(null);
  const [category, setCategory] = React.useState<string>(orderCategory ?? ALL);
  const [search, setSearch] = React.useState('');
  const [labs, setLabs] = React.useState<Laboratory[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState(false);
  const [selectedCache, setSelectedCache] = React.useState<Laboratory | null>(null);

  const [isCreating, setIsCreating] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [createName, setCreateName] = React.useState('');
  const [createPhone, setCreatePhone] = React.useState('');
  const [createEmail, setCreateEmail] = React.useState('');
  const [createCategories, setCreateCategories] = React.useState<string[]>([]);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [duplicateOwners, setDuplicateOwners] = React.useState<DuplicateContactOwners | null>(null);
  const [uniqueConflict, setUniqueConflict] = React.useState<UniqueConflict | null>(null);

  // La categoría de la orden puede llegar después (servicios agregados): se respeta mientras esté cerrado.
  React.useEffect(() => {
    if (!open) setCategory(orderCategory ?? ALL);
  }, [orderCategory, open]);

  // Categorías: una vez, al abrir por primera vez.
  React.useEffect(() => {
    if (!open || categories !== null) return;
    let active = true;
    fetchLabCategories({ timeoutMs: REQUEST_TIMEOUT_MS.mutation })
      .then((list) => { if (active) setCategories(list); })
      .catch(() => { if (active) setCategories([]); });
    return () => { active = false; };
  }, [open, categories]);

  // Búsqueda con debounce; solo la última respuesta escribe la lista.
  React.useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const handler = setTimeout(async () => {
      setIsLoading(true);
      setLoadError(false);
      try {
        const result = await searchLaboratories(
          { search, categoryId: category === ALL ? null : category, limit: 30 },
          { signal: controller.signal, timeoutMs: REQUEST_TIMEOUT_MS.mutation },
        );
        if (!controller.signal.aborted) setLabs(result);
      } catch {
        if (!controller.signal.aborted) { setLabs([]); setLoadError(true); }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 250);
    return () => { clearTimeout(handler); controller.abort(); };
  }, [open, search, category]);

  React.useEffect(() => { setIsCreating(false); }, [search]);

  const selected = React.useMemo<Laboratory | null>(() => {
    if (!value) return null;
    const fromResults = labs.find((lab) => lab.id === value);
    if (fromResults) return fromResults;
    if (selectedCache?.id === value) return selectedCache;
    return selectedName ? { id: value, name: selectedName, phone_number: null, email: null, categories: [] } : null;
  }, [labs, selectedCache, selectedName, value]);

  const resetCreate = () => {
    setIsCreating(false);
    setCreateName('');
    setCreatePhone('');
    setCreateEmail('');
    setCreateCategories([]);
    setCreateError(null);
  };

  const handleOpenChange = (next: boolean) => {
    // Los avisos de contacto repetido se abren encima: no perder lo tecleado.
    if (!next && (duplicateOwners || uniqueConflict || isSaving)) return;
    if (!next) { resetCreate(); setSearch(''); }
    setOpen(next);
  };

  const handleSelect = (lab: Laboratory | null) => {
    if (lab) setSelectedCache(lab);
    onValueChange?.(lab?.id ?? '', lab ?? undefined);
    setOpen(false);
    setSearch('');
    resetCreate();
  };

  const startCreate = () => {
    setCreateName(search.trim());
    setCreatePhone('');
    setCreateEmail('');
    // Arranca en la categoría que se está mirando (o la de la orden).
    setCreateCategories(category !== ALL ? [category] : orderCategory ? [orderCategory] : []);
    setCreateError(null);
    setIsCreating(true);
  };

  const toggleCreateCategory = (id: string) => {
    setCreateCategories((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
    setCreateError(null);
  };

  /** Busca el proveedor recién creado cuando el upsert no devuelve el id. */
  const findCreatedProvider = async (name: string): Promise<string | null> => {
    const data = await api.get(API_ROUTES.USERS, { filter_type: 'PROVEEDOR', search: name });
    const first = Array.isArray(data) ? data[0] : data;
    const rows: any[] = first?.json?.data || first?.data || [];
    const match = rows.find((u) => String(u.name ?? '').toLowerCase() === name.toLowerCase());
    return match?.id != null ? String(match.id) : null;
  };

  const handleCreate = async (confirmDuplicates = false) => {
    const name = normalizePersonName(createName);
    if (!name || isSaving) return;
    if (createCategories.length === 0) {
      setCreateError(t('categoriesRequired'));
      return;
    }
    setIsSaving(true);
    setCreateError(null);
    try {
      const response = await api.post(API_ROUTES.USERS_UPSERT, {
        name,
        phone: createPhone.trim() || '',
        email: createEmail.trim() || '',
        filter_type: 'PROVEEDOR',
        is_sales: false,
        is_active: true,
        ...(confirmDuplicates ? { confirm_duplicates: true } : {}),
      }, undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.mutation });

      const errPayload = response?.error;
      if (errPayload?.code === 'duplicate_contact' && errPayload.owners) { setDuplicateOwners(errPayload.owners); return; }
      if (errPayload?.code === 'unique_conflict') {
        setUniqueConflict({ conflictedFields: errPayload.conflictedFields ?? [], owners: errPayload.owners ?? {} });
        return;
      }
      if (errPayload) { setCreateError(tEntity('invalidData')); return; }

      const id = extractCreatedUserId(response) ?? await findCreatedProvider(name);
      if (!id) { setCreateError(t('createError')); return; }

      const chosen = (categories ?? []).filter((c) => createCategories.includes(c.id));
      try {
        await saveProviderGroups(id, createCategories);
      } catch {
        // El proveedor ya existe: se elige igual (el backend acepta cualquier proveedor) y se avisa.
        toast({ variant: 'destructive', title: t('categoriesFailedTitle'), description: t('categoriesFailedDescription', { name }) });
      }
      handleSelect({
        id,
        name,
        phone_number: createPhone.trim() || null,
        email: createEmail.trim() || null,
        categories: chosen.map((c) => ({ id: c.id, name: c.name })),
      });
    } catch (error: any) {
      const errPayload = error?.data?.error || error?.error;
      if (errPayload?.code === 'duplicate_contact' && errPayload.owners) setDuplicateOwners(errPayload.owners);
      else if (errPayload?.code === 'unique_conflict') {
        setUniqueConflict({ conflictedFields: errPayload.conflictedFields ?? [], owners: errPayload.owners ?? {} });
      } else setCreateError(t('createError'));
    } finally {
      setIsSaving(false);
    }
  };

  const noCategories = categories !== null && categories.length === 0;

  return (
    <>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-invalid={ariaInvalid}
            className={cn('w-full justify-between', !value && 'text-muted-foreground', className)}
            disabled={disabled}
          >
            {value && selected ? <span className="block truncate">{selected.name}</span> : (triggerText ?? t('select'))}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[18rem] p-0" align="start">
          {/* Categorías: filtran la lista. Arranca en la de la orden si hay una sola. */}
          {categories && categories.length > 0 && (
            <div className="flex flex-wrap gap-1 border-b p-2" role="group" aria-label={t('categoryFilter')}>
              {[{ id: ALL, name: t('allCategories') }, ...categories].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  aria-pressed={category === c.id}
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-xs transition-colors',
                    category === c.id ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent',
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
          <Command shouldFilter={false}>
            <CommandInput placeholder={placeholder ?? t('search')} value={search} onValueChange={setSearch} />
            <CommandList>
              {isLoading ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">{tEntity('searching')}</span>
                </div>
              ) : (
                <>
                  {clearable && value && (
                    <CommandGroup>
                      <CommandItem value="__clear__" onSelect={() => handleSelect(null)}>
                        <span className="text-muted-foreground">{t('clear')}</span>
                      </CommandItem>
                    </CommandGroup>
                  )}
                  {labs.length > 0 && (
                    <CommandGroup>
                      {labs.map((lab) => (
                        <CommandItem key={lab.id} value={lab.id} onSelect={() => handleSelect(lab)}>
                          <Check className={cn('mr-2 h-4 w-4 shrink-0', value === lab.id ? 'opacity-100' : 'opacity-0')} />
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate">{lab.name}</span>
                            <div className="flex flex-wrap items-center gap-1">
                              {lab.categories.map((c) => (
                                <Badge key={c.id} variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">{c.name}</Badge>
                              ))}
                              {lab.phone_number && (
                                <span className="truncate text-xs text-muted-foreground">{formatPhoneNumber(lab.phone_number)}</span>
                              )}
                            </div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                  {labs.length === 0 && !isCreating && (
                    <p className="px-3 py-5 text-center text-sm text-muted-foreground">
                      {loadError ? t('loadError') : noCategories ? t('noCategories') : t('noResults')}
                    </p>
                  )}
                  {canCreate && !noCategories && categories !== null && (search.trim() || isCreating || labs.length === 0) && (
                    <div className={cn('border-t', labs.length === 0 && !isCreating && 'border-t-0')}>
                      {isCreating ? (
                        <div className="space-y-1.5 p-2">
                          <p className="px-1 text-xs text-muted-foreground">{t('newLab')}</p>
                          <Input
                            value={createName}
                            onChange={(e) => { setCreateName(e.target.value); setCreateError(null); }}
                            placeholder={tEntity('namePlaceholder')}
                            className="h-7 text-sm"
                            autoFocus
                          />
                          {/* Las teclas del selector de país no deben llegar al Command de afuera. */}
                          <div onKeyDown={(e) => e.stopPropagation()}>
                            <PhoneInput
                              value={createPhone}
                              onChange={(phone) => { setCreatePhone(phone); setCreateError(null); }}
                              aria-label={tEntity('phonePlaceholder')}
                              className="[&>div]:min-h-7 [&_[role=combobox]]:px-2 [&_input]:h-7"
                            />
                          </div>
                          <Input
                            value={createEmail}
                            onChange={(e) => { setCreateEmail(e.target.value); setCreateError(null); }}
                            placeholder={tEntity('emailPlaceholder')}
                            className="h-7 text-sm"
                          />
                          <div className="space-y-1 px-1 pt-0.5">
                            <p className="text-xs text-muted-foreground">{t('categoriesLabel')}</p>
                            <div className="flex flex-wrap gap-1">
                              {(categories ?? []).map((c) => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => toggleCreateCategory(c.id)}
                                  aria-pressed={createCategories.includes(c.id)}
                                  className={cn(
                                    'rounded-full border px-2 py-0.5 text-xs transition-colors',
                                    createCategories.includes(c.id) ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent',
                                  )}
                                >
                                  {c.name}
                                </button>
                              ))}
                            </div>
                          </div>
                          {createError && <p className="px-1 text-xs text-destructive">{createError}</p>}
                          <div className="flex justify-end pt-0.5">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => void handleCreate()}
                              disabled={!createName.trim()}
                              loading={isSaving}
                            >
                              {tEntity('save')}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                          onClick={startCreate}
                        >
                          <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">
                            {search.trim() ? tEntity('createNamed', { name: search.trim() }) : t('create')}
                          </span>
                        </button>
                      )}
                    </div>
                  )}
                  {noCategories && (
                    <div className="flex items-start gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
                      <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{t('noCategoriesHint')}</span>
                    </div>
                  )}
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <DuplicateContactDialog
        owners={duplicateOwners}
        onCancel={() => setDuplicateOwners(null)}
        onConfirm={() => { setDuplicateOwners(null); void handleCreate(true); }}
      />
      <UniqueConflictDialog conflict={uniqueConflict} onClose={() => setUniqueConflict(null)} />
    </>
  );
}
