'use client';

import * as React from 'react';
import { Building2, Check, FlaskConical, ListChecks, Loader2, Plus, Search, Settings2, Workflow } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogCancelButton, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PhoneInput } from '@/components/ui/phone-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';

import { useLaboratoryCreator } from '@/components/lab-orders/lab-create';

import { useAsyncAction, useKeyedAsyncAction } from '@/hooks/use-async-action';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { api, isAbortError, REQUEST_TIMEOUT_MS } from '@/services/api';
import { fetchLabCategories, searchLaboratories } from '@/services/lab-orders';
import { getSalesServices, setServiceIsLab } from '@/services/services';

import { BUSINESS_CONFIG_PERMISSIONS, LAB_ORDERS_PERMISSIONS, PURCHASES_PERMISSIONS, SALES_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import type { LabCategory, Service } from '@/lib/types';

export type LabSetupDialog = 'laboratory' | 'services';

/** Sin especialidad (Select no admite el valor vacío). */
const NO_CATEGORY = 'none';

/**
 * Qué falta para usar el módulo: algún laboratorio y algún servicio marcado como trabajo de
 * laboratorio. `null` mientras se consulta (o si falla: no se insiste con la tarjeta).
 */
export function useLabSetupStatus(reloadKey: number) {
  const [status, setStatus] = React.useState<{ hasLabs: boolean; hasLabServices: boolean } | null>(null);
  React.useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      searchLaboratories({ limit: 1 }, { signal: controller.signal }),
      getSalesServices({ is_lab: true, limit: 1 }),
    ])
      .then(([labs, services]) => {
        if (controller.signal.aborted) return;
        // El filtro is_lab lo aplica el backend; por las dudas se mira el flag.
        setStatus({ hasLabs: labs.length > 0, hasLabServices: services.items.some((s) => s.is_lab !== false) });
      })
      .catch((error) => { if (!isAbortError(error) && !controller.signal.aborted) setStatus(null); });
    return () => controller.abort();
  }, [reloadKey]);
  return status;
}

/** Puede abrir cada paso: los mismos permisos que la pantalla original de cada cosa. */
function useSetupPermissions() {
  const { hasPermission } = usePermissions();
  return {
    laboratory: hasPermission(PURCHASES_PERMISSIONS.SUPPLIERS_CREATE),
    services: hasPermission(SALES_PERMISSIONS.SERVICES_UPDATE),
    stages: hasPermission(LAB_ORDERS_PERMISSIONS.STAGES_CONFIG),
  };
}

/**
 * Primeros pasos, dentro del módulo: laboratorios, trabajos de laboratorio y etapas. Cada
 * paso se resuelve acá mismo (abre su ventana) sin ir a Compras, Ventas o Configuración.
 * Se ve mientras falte algo; las etapas ya vienen listas.
 */
export function LabOrdersSetupCard({ status, onOpen, className }: {
  status: { hasLabs: boolean; hasLabServices: boolean };
  onOpen: (dialog: LabSetupDialog) => void;
  className?: string;
}) {
  const t = useTranslations('LabOrdersPage.setup');
  const locale = useLocale();
  const can = useSetupPermissions();
  const steps = [
    { key: 'laboratory' as const, done: status.hasLabs, icon: Building2, allowed: can.laboratory },
    { key: 'services' as const, done: status.hasLabServices, icon: ListChecks, allowed: can.services },
  ];
  const doneCount = steps.filter((s) => s.done).length + 1;

  return (
    <section data-help-id="lab-orders.section.setup" className={cn('rounded-xl border border-primary/30 bg-primary/5 p-3', className)}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">{t('title')}</p>
        <span className="text-xs text-muted-foreground">{t('progress', { done: doneCount, total: steps.length + 1 })}</span>
      </div>
      <ol className="space-y-1.5">
        {steps.map((step, index) => (
          <li key={step.key} className="flex flex-wrap items-center gap-2 rounded-lg bg-background/70 px-2.5 py-2">
            <StepMark done={step.done} number={index + 1} />
            <div className="min-w-0 flex-1">
              <p className={cn('text-sm font-medium', step.done && 'text-muted-foreground line-through')}>{t(`${step.key}.title`)}</p>
              {!step.done && <p className="text-xs text-muted-foreground">{t(`${step.key}.hint`)}</p>}
            </div>
            {step.allowed ? (
              <Button
                data-help-id={`lab-orders.btn.setup-${step.key}`}
                size="sm"
                variant={step.done ? 'ghost' : 'default'}
                className="h-8 gap-1.5"
                onClick={() => onOpen(step.key)}
              >
                <step.icon className="h-4 w-4" />
                {t(step.done ? `${step.key}.again` : `${step.key}.action`)}
              </Button>
            ) : !step.done && (
              <span className="text-xs text-muted-foreground">{t('askAdmin')}</span>
            )}
          </li>
        ))}
        <li className="flex flex-wrap items-center gap-2 rounded-lg bg-background/70 px-2.5 py-2">
          <StepMark done number={3} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-muted-foreground">{t('stages.title')}</p>
            <p className="text-xs text-muted-foreground">{t('stages.hint')}</p>
          </div>
          {can.stages && (
            <Button asChild size="sm" variant="ghost" className="h-8 gap-1.5">
              <Link data-help-id="lab-orders.btn.setup-stages" href={`/${locale}/config/lab-stages`}>
                <Workflow className="h-4 w-4" />
                {t('stages.action')}
              </Link>
            </Button>
          )}
        </li>
      </ol>
    </section>
  );
}

function StepMark({ done, number }: { done: boolean; number: number }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold',
        done ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-primary text-primary-foreground',
      )}
    >
      {done ? <Check className="h-3.5 w-3.5" /> : number}
    </span>
  );
}

/** Menú "Configurar" del encabezado: los mismos pasos, para después de la puesta en marcha. */
export function LabOrdersSetupMenu({ onOpen, compact = false }: { onOpen: (dialog: LabSetupDialog) => void; compact?: boolean }) {
  const t = useTranslations('LabOrdersPage.setup');
  const locale = useLocale();
  const can = useSetupPermissions();
  if (!can.laboratory && !can.services && !can.stages) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button data-help-id="lab-orders.btn.setup-menu" variant="outline" size="sm" className="h-9 gap-1.5" aria-label={t('menu')}>
          <Settings2 className="h-4 w-4" />
          <span className={cn('hidden', !compact && 'xl:inline')}>{t('menu')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" data-help-id="lab-orders.section.setup-menu">
        {can.laboratory && (
          <DropdownMenuItem data-help-id="lab-orders.btn.menu-laboratory" onSelect={() => onOpen('laboratory')}>
            <Building2 className="mr-2 h-4 w-4" />
            {t('laboratory.action')}
          </DropdownMenuItem>
        )}
        {can.services && (
          <DropdownMenuItem data-help-id="lab-orders.btn.menu-services" onSelect={() => onOpen('services')}>
            <ListChecks className="mr-2 h-4 w-4" />
            {t('services.menu')}
          </DropdownMenuItem>
        )}
        {can.stages && (
          <DropdownMenuItem asChild>
            <Link data-help-id="lab-orders.btn.menu-stages" href={`/${locale}/config/lab-stages`}>
              <Workflow className="mr-2 h-4 w-4" />
              {t('stages.menu')}
            </Link>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ──── Especialidades ────

/** Especialidades de laboratorio (grupos de proveedores marcados como categoría de laboratorio). */
function useLabCategories(open: boolean) {
  const [categories, setCategories] = React.useState<LabCategory[] | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);
  React.useEffect(() => {
    if (!open) return;
    let active = true;
    fetchLabCategories({ timeoutMs: REQUEST_TIMEOUT_MS.mutation })
      .then((list) => { if (active) setCategories(list); })
      .catch(() => { if (active) setCategories((prev) => prev ?? []); });
    return () => { active = false; };
  }, [open, reloadKey]);
  const reload = React.useCallback(async () => {
    const list = await fetchLabCategories({ timeoutMs: REQUEST_TIMEOUT_MS.mutation });
    setCategories(list);
    setReloadKey((k) => k + 1);
    return list;
  }, []);
  return { categories, reload };
}

/**
 * Crea una especialidad: un grupo de proveedores marcado como categoría de laboratorio (lo
 * mismo que Configuración → Grupos de proveedores, sin salir del módulo). Devuelve su id.
 */
function useCreateLabCategory(reload: () => Promise<LabCategory[]>) {
  const t = useTranslations('LabOrdersPage.setup');
  return useAsyncAction(async (name: string) => {
    const response = await api.post(
      API_ROUTES.PROVIDER_GROUP_UPSERT,
      { name, description: '', is_active: true, is_lab_category: true },
      undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.mutation },
    );
    if (Array.isArray(response) && response[0]?.code >= 400) throw new Error(response[0]?.message || t('specialtyError'));
    const list = await reload();
    const created = list.find((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (!created) throw new Error(t('specialtyError'));
    return created;
  }, { errorTitle: t('specialtyErrorTitle') });
}

/** Chips de especialidades + "Nueva especialidad" escribiendo el nombre. */
function SpecialtyPicker({ categories, selected, onToggle, onCreated, disabled, reload }: {
  categories: LabCategory[] | null;
  selected: string[];
  onToggle: (id: string) => void;
  onCreated: (category: LabCategory) => void;
  disabled?: boolean;
  reload: () => Promise<LabCategory[]>;
}) {
  const t = useTranslations('LabOrdersPage.setup');
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission(BUSINESS_CONFIG_PERMISSIONS.PROVIDER_GROUPS_CREATE);
  const [adding, setAdding] = React.useState(false);
  const [name, setName] = React.useState('');
  const create = useCreateLabCategory(reload);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const existing = categories?.find((c) => c.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      if (!selected.includes(existing.id)) onToggle(existing.id);
    } else {
      const created = await create.run(trimmed);
      if (!created) return;
      onCreated(created);
    }
    setName('');
    setAdding(false);
  };

  if (categories === null) return <Skeleton className="h-7 w-full" />;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('specialties')}>
        {categories.map((c) => {
          const on = selected.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onToggle(c.id)}
              aria-pressed={on}
              disabled={disabled}
              className={cn(
                'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-60',
                on ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted',
              )}
            >
              {c.name}
            </button>
          );
        })}
        {canCreate && !adding && (
          <button
            type="button"
            data-help-id="lab-orders.btn.new-specialty"
            onClick={() => setAdding(true)}
            disabled={disabled}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
          >
            <Plus className="h-3 w-3" />
            {t('newSpecialty')}
          </button>
        )}
      </div>
      {categories.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground">{canCreate ? t('noSpecialties') : t('noSpecialtiesAsk')}</p>
      )}
      {adding && (
        <div className="flex gap-2">
          <Input
            data-help-id="lab-orders.field.new-specialty"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); void submit(); }
              if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setAdding(false); }
            }}
            placeholder={t('specialtyPlaceholder')}
            className="h-8"
            maxLength={100}
            autoFocus
            disabled={create.isPending}
          />
          <Button type="button" size="sm" className="h-8" onClick={() => void submit()} loading={create.isPending} disabled={!name.trim()}>
            {t('addSpecialty')}
          </Button>
        </div>
      )}
    </div>
  );
}

// ──── Nuevo laboratorio ────

/**
 * Alta de un laboratorio en un solo formulario: nombre, contacto y qué hace (especialidades,
 * que se pueden crear acá mismo). Por detrás es un proveedor asignado a esos grupos.
 */
export function LabCreateDialog({ open, onOpenChange, onCreated }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const t = useTranslations('LabOrdersPage.setup');
  const tEntity = useTranslations('EntitySelectors');
  const { toast } = useToast();
  const { categories, reload } = useLabCategories(open);
  const [name, setName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [selected, setSelected] = React.useState<string[]>([]);

  const creator = useLaboratoryCreator({
    categories,
    onCreated: (lab) => {
      toast({ title: t('laboratory.created', { name: lab.name }) });
      onCreated();
      onOpenChange(false);
    },
  });

  React.useEffect(() => {
    if (!open) return;
    setName(''); setPhone(''); setEmail(''); setSelected([]); creator.setError(null);
    // Solo al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Una sola especialidad: viene marcada.
  React.useEffect(() => {
    if (open && categories?.length === 1 && selected.length === 0) setSelected([categories[0].id]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, categories]);

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
    creator.setError(null);
  };

  const busy = creator.isSaving;
  const isDirty = Boolean(name || phone || email);

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => { if (!next && (busy || creator.isAsking)) return; onOpenChange(next); }}>
        <DialogContent className="sm:max-w-md" confirmOnClose isDirty={isDirty} data-help-id="lab-orders.section.new-laboratory">
          <DialogHeader>
            <DialogTitle>{t('laboratory.dialogTitle')}</DialogTitle>
            <DialogDescription>{t('laboratory.dialogDescription')}</DialogDescription>
          </DialogHeader>
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(e) => {
              e.preventDefault();
              void creator.create({ name, phone, email, categoryIds: selected });
            }}
          >
            <DialogBody className="space-y-4 px-6 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="lab-create-name">{t('laboratory.name')}</Label>
                <Input
                  id="lab-create-name"
                  data-help-id="lab-orders.field.laboratory-name"
                  value={name}
                  onChange={(e) => { setName(e.target.value); creator.setError(null); }}
                  placeholder={t('laboratory.namePlaceholder')}
                  maxLength={150}
                  autoFocus
                  disabled={busy}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{tEntity('phonePlaceholder')}</Label>
                  <PhoneInput value={phone} onChange={setPhone} aria-label={tEntity('phonePlaceholder')} disabled={busy} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lab-create-email">{tEntity('emailPlaceholder')}</Label>
                  <Input id="lab-create-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} />
                </div>
              </div>
              <div className="space-y-1.5" data-help-id="lab-orders.field.laboratory-specialties">
                <Label>{t('specialties')}</Label>
                <p className="text-xs text-muted-foreground">{t('specialtiesHint')}</p>
                <SpecialtyPicker
                  categories={categories}
                  selected={selected}
                  onToggle={toggle}
                  onCreated={(category) => setSelected((prev) => [...prev, category.id])}
                  disabled={busy}
                  reload={reload}
                />
              </div>
              {creator.error && <p role="alert" className="text-sm text-destructive">{creator.error}</p>}
            </DialogBody>
            <DialogFooter>
              <DialogCancelButton disabled={busy}>{t('cancel')}</DialogCancelButton>
              <Button type="submit" data-help-id="lab-orders.btn.save-laboratory" loading={busy} disabled={!name.trim()}>
                {t('laboratory.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {creator.dialogs}
    </>
  );
}

// ──── Trabajos de laboratorio ────

/**
 * Qué servicios del catálogo se mandan a un laboratorio, con un interruptor por servicio (y
 * su especialidad, opcional). Guarda al instante: es lo mismo que "Trabajo de laboratorio"
 * en Ventas → Servicios, sin abrir cada servicio.
 */
export function LabServicesDialog({ open, onOpenChange, onChanged }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const t = useTranslations('LabOrdersPage.setup');
  const { categories } = useLabCategories(open);
  const [services, setServices] = React.useState<Service[] | null>(null);
  const [loadError, setLoadError] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [reloadKey, setReloadKey] = React.useState(0);
  const changedRef = React.useRef(false);

  React.useEffect(() => {
    if (!open) return;
    let active = true;
    setLoadError(false);
    setSearch('');
    changedRef.current = false;
    getSalesServices({ limit: 500 })
      .then(({ items }) => {
        if (!active) return;
        // Los que ya son de laboratorio arriba; el resto por nombre.
        setServices(items
          .filter((s) => s.is_active !== false)
          .sort((a, b) => Number(!!b.is_lab) - Number(!!a.is_lab) || a.name.localeCompare(b.name)));
      })
      .catch(() => { if (active) { setServices([]); setLoadError(true); } });
    return () => { active = false; };
  }, [open, reloadKey]);

  const patch = (id: string, changes: Partial<Service>) => {
    setServices((prev) => prev?.map((s) => (String(s.id) === id ? { ...s, ...changes } : s)) ?? prev);
  };

  // Optimista con vuelta atrás: el interruptor nunca queda en un estado que el backend rechazó.
  const update = useKeyedAsyncAction(
    async (service: Service, isLab: boolean, categoryId: string | null) => {
      const id = String(service.id);
      const before = { is_lab: service.is_lab, lab_category_id: service.lab_category_id ?? null };
      patch(id, { is_lab: isLab, lab_category_id: isLab ? categoryId : null });
      const ok = await setServiceIsLab(id, isLab, isLab ? categoryId : null);
      if (!ok) {
        patch(id, before);
        throw new Error(t('services.saveError', { name: service.name }));
      }
      changedRef.current = true;
    },
    { errorTitle: t('services.saveErrorTitle') },
  );

  const close = (next: boolean) => {
    if (next) return;
    if (update.hasPending) return;
    if (changedRef.current) onChanged();
    onOpenChange(false);
  };

  const query = search.trim().toLowerCase();
  const visible = (services ?? []).filter((s) => !query || s.name.toLowerCase().includes(query));
  const labCount = (services ?? []).filter((s) => s.is_lab).length;

  return (
    <Dialog open={open} onOpenChange={close}>
        <DialogContent maxWidth="xl" data-help-id="lab-orders.section.lab-services">
          <DialogHeader>
            <DialogTitle>{t('services.dialogTitle')}</DialogTitle>
            <DialogDescription>{t('services.dialogDescription')}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3 px-6 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[12rem] flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  data-help-id="lab-orders.filter.lab-services-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('services.search')}
                  aria-label={t('services.search')}
                  className="h-9 pl-8"
                />
              </div>
              <span className="text-xs text-muted-foreground">{t('services.count', { count: labCount })}</span>
            </div>

            {services === null ? (
              <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : loadError ? (
              <div className="flex flex-col items-center gap-2 py-6 text-sm text-muted-foreground">
                <p>{t('services.loadError')}</p>
                <Button size="sm" variant="outline" onClick={() => { setServices(null); setReloadKey((k) => k + 1); }}>{t('retry')}</Button>
              </div>
            ) : visible.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{services.length === 0 ? t('services.empty') : t('services.noResults')}</p>
            ) : (
              <ul className="max-h-[50vh] divide-y divide-border overflow-y-auto rounded-lg border border-border">
                {visible.map((service, index) => {
                  const id = String(service.id);
                  const pending = update.isPending(id);
                  return (
                    <li
                      key={id}
                      data-help-id={index === 0 ? 'lab-orders.section.lab-service-first' : undefined}
                      className={cn('flex flex-wrap items-center gap-3 px-3 py-2', service.is_lab && 'bg-primary/5')}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{service.name}</p>
                        {service.category_name && <p className="truncate text-xs text-muted-foreground">{service.category_name}</p>}
                      </div>
                      {service.is_lab && categories && categories.length > 0 && (
                        <Select
                          value={service.lab_category_id ?? NO_CATEGORY}
                          onValueChange={(value) => void update.run(id, service, true, value === NO_CATEGORY ? null : value)}
                          disabled={pending}
                        >
                          <SelectTrigger className="h-8 w-44 text-xs" aria-label={t('services.specialtyFor', { name: service.name })}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_CATEGORY}>{t('services.anySpecialty')}</SelectItem>
                            {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                      <div className="flex w-6 justify-center">
                        {pending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />}
                      </div>
                      <Switch
                        data-help-id={index === 0 ? 'lab-orders.toggle.lab-service' : undefined}
                        checked={!!service.is_lab}
                        disabled={pending}
                        aria-label={t('services.toggle', { name: service.name })}
                        onCheckedChange={(checked) => void update.run(
                          id, service, checked,
                          // Con una sola especialidad, se asigna sola.
                          checked ? service.lab_category_id ?? (categories?.length === 1 ? categories[0].id : null) : null,
                        )}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {t('services.footerHint')}
            </p>
          </DialogBody>
          <DialogFooter>
            <Button type="button" data-help-id="lab-orders.btn.lab-services-done" onClick={() => close(false)} disabled={update.hasPending}>
              {t('done')}
            </Button>
          </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}
