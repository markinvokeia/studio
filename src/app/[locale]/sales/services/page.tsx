'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataCard } from '@/components/ui/data-card';
import { DataTable } from '@/components/ui/data-table';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { FormattedNumberInput } from '@/components/ui/formatted-number-input';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { TwoPanelLayout, useNarrowMode } from '@/components/layout/two-panel-layout';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { SALES_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { normalizeApiResponse } from '@/lib/api-utils';
import { MiscellaneousCategory, Service } from '@/lib/types';
import api from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Briefcase, PlusCircle, Trash2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { ColumnFiltersState, PaginationState, RowSelectionState } from '@tanstack/react-table';
import { useFieldArray, useForm } from 'react-hook-form';
import * as z from 'zod';
import { ServicesColumnsWrapper } from './columns';
import { useDeepLink } from '@/hooks/use-deep-link';

console.log("Services Page Loaded. API_ROUTES.SERVICES:", API_ROUTES.SERVICES);

const serviceFormSchema = (t: (key: string) => string) => z.object({
  id: z.string().optional(),
  name: z.string().min(1, t('nameRequired')),
  category_id: z.string().min(1, t('categoryRequired')),
  category: z.string().optional(),
  price: z.coerce.number().positive(t('pricePositive')),
  currency: z.enum(['UYU', 'USD']).default('USD'),
  duration_minutes: z.coerce.number().int().positive(t('durationInteger')),
  description: z.string().optional(),
  indications: z.string().optional(),
  color: z.string().optional(),
  is_active: z.boolean().default(true),
  service_type: z.enum(['single', 'workflow']).default('single'),
  treatment_steps: z.array(z.object({
    position: z.number(),
    name: z.string().min(1),
    offset_days_from_prev: z.coerce.number().int().min(0),
    duration_minutes: z.coerce.number().int().positive(),
    notes: z.string().optional(),
  })).optional(),
});

type ServiceFormValues = z.infer<ReturnType<typeof serviceFormSchema>>;

const DEFAULT_SERVICE_FORM_VALUES: ServiceFormValues = {
  id: undefined,
  name: '',
  category_id: '',
  category: '',
  price: 0,
  currency: 'USD',
  duration_minutes: 60,
  description: '',
  indications: '',
  color: '',
  is_active: true,
  service_type: 'single',
  treatment_steps: [],
};

const PAGE_SIZE = 10;

async function getServices(params: { page: number; limit: number; search: string }): Promise<{ items: Service[]; total: number }> {
  try {
    const query: Record<string, string> = { is_sales: 'true', page: String(params.page), limit: String(params.limit) };
    if (params.search) query.search = params.search;
    const data = await api.get(API_ROUTES.SERVICES, query);
    // Response: [{ items: [...], total: N, total_pages: N }]
    const normalized = normalizeApiResponse<any>(data);
    const total = normalized.total;
    const items = normalized.items.map((apiService: any) => ({
      id: apiService.id ? String(apiService.id) : `srv_${Math.random().toString(36).substr(2, 9)}`,
      name: apiService.name || 'No Name',
      category: apiService.category_name || apiService.category || 'No Category',
      category_id: apiService.category_id ? String(apiService.category_id) : undefined,
      price: apiService.price || 0,
      currency: apiService.currency || 'USD',
      duration_minutes: apiService.duration_minutes || 0,
      description: apiService.description,
      indications: apiService.indications,
      color: apiService.color || null,
      is_active: apiService.is_active,
      service_type: apiService.service_type || 'single',
      treatment_steps: apiService.treatment_steps || [],
    }));
    return { items, total };
  } catch (error) {
    console.error("Failed to fetch services:", error);
    return { items: [], total: 0 };
  }
}

async function getMiscellaneousCategories(): Promise<MiscellaneousCategory[]> {
  try {
    const data = await api.get(API_ROUTES.PURCHASES.MISC_CATEGORIES, { limit: '1000', type: 'income' });
    const normalized = normalizeApiResponse(data);
    return normalized.items.map((c: any) => ({ ...c, id: String(c.id), type: c.category_type || c.type }));
  } catch (error) {
    console.error("Failed to fetch miscellaneous categories:", error);
    return [];
  }
}

async function upsertService(serviceData: ServiceFormValues, categories: MiscellaneousCategory[]) {
  const category = categories.find(cat => cat.id === serviceData.category_id)?.name || '';
  const responseData = await api.post(API_ROUTES.PURCHASES.SERVICES_UPSERT, { ...serviceData, category, is_sales: true });
  if (Array.isArray(responseData) && responseData.length > 0) {
    const firstItem = responseData[0];
    if (firstItem && (firstItem.code >= 400 || firstItem.error)) throw new Error(firstItem.message || firstItem.error || 'Failed to save service');
  }
  if (responseData && typeof responseData === 'object' && !Array.isArray(responseData)) {
    if (responseData.error || responseData.code >= 400) throw new Error(responseData.message || responseData.error || 'Failed to save service');
  }
  return responseData;
}

async function deleteService(id: string) {
  const responseData = await api.delete(API_ROUTES.SERVICES_DELETE, { id, is_sales: true });
  if (Array.isArray(responseData) && responseData.length > 0) {
    const firstItem = responseData[0];
    if (firstItem && (firstItem.code >= 400 || firstItem.error)) throw new Error(firstItem.message || firstItem.error || 'Failed to delete service');
  }
  if (responseData && typeof responseData === 'object' && !Array.isArray(responseData)) {
    if (responseData.error || responseData.code >= 400) throw new Error(responseData.message || responseData.error || 'Failed to delete service');
  }
  return responseData;
}

function ServiceFormFields({ form, categories, t }: { form: any; categories: MiscellaneousCategory[]; t: (key: string) => string }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem><FormLabel>{t('createDialog.name')}</FormLabel><FormControl><Input placeholder={t('createDialog.namePlaceholder')} {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="category_id" render={({ field }) => (
          <FormItem><FormLabel>{t('createDialog.category')}</FormLabel>
            <Select onValueChange={field.onChange} value={field.value || ''}>
              <FormControl><SelectTrigger><SelectValue placeholder={t('createDialog.categoryPlaceholder')} /></SelectTrigger></FormControl>
              <SelectContent>{categories.map((cat) => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}</SelectContent>
            </Select><FormMessage /></FormItem>
        )} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField control={form.control} name="price" render={({ field: { onChange, value } }) => (
          <FormItem><FormLabel>{t('createDialog.price')}</FormLabel><FormControl><FormattedNumberInput value={value} onChange={onChange} placeholder="0.00" /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="currency" render={({ field }) => (
          <FormItem><FormLabel>{t('createDialog.currency')}</FormLabel>
            <Select onValueChange={field.onChange} value={field.value || 'USD'}>
              <FormControl><SelectTrigger><SelectValue placeholder={t('createDialog.selectCurrency')} /></SelectTrigger></FormControl>
              <SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="UYU">UYU</SelectItem></SelectContent>
            </Select><FormMessage /></FormItem>
        )} />
      </div>
      <FormField control={form.control} name="description" render={({ field }) => (
        <FormItem><FormLabel>{t('createDialog.descriptionLabel')}</FormLabel><FormControl><Textarea placeholder={t('createDialog.descriptionPlaceholder')} className="resize-none" rows={2} {...field} /></FormControl><FormMessage /></FormItem>
      )} />
      <FormField control={form.control} name="indications" render={({ field }) => (
        <FormItem><FormLabel>{t('createDialog.indicationsLabel')}</FormLabel><FormControl><Textarea placeholder={t('createDialog.indicationsPlaceholder')} className="resize-none" rows={2} {...field} /></FormControl><FormMessage /></FormItem>
      )} />
      <div className="grid grid-cols-2 gap-3">
        <FormField control={form.control} name="duration_minutes" render={({ field }) => (
          <FormItem><FormLabel>{t('createDialog.duration')}</FormLabel><FormControl><Input type="number" placeholder="60" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="color" render={({ field }) => (
          <FormItem><FormLabel>{t('createDialog.colorLabel')}</FormLabel><FormControl><Input type="color" className="h-10 w-full cursor-pointer" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
      </div>
      <FormField control={form.control} name="is_active" render={({ field }) => (
        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
          <div className="space-y-0.5"><FormLabel className="text-base">{t('createDialog.activeLabel')}</FormLabel></div>
          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
        </FormItem>
      )} />
      {/* Workflow service toggle */}
      <FormField control={form.control} name="service_type" render={({ field }) => (
        <FormItem className="flex items-center justify-between rounded-lg border p-3">
          <div className="space-y-0.5">
            <FormLabel className="text-sm">{t('serviceType.label')}</FormLabel>
            <p className="text-xs text-muted-foreground">{t('serviceType.description')}</p>
          </div>
          <FormControl>
            <Switch
              checked={field.value === 'workflow'}
              onCheckedChange={(v) => {
                field.onChange(v ? 'workflow' : 'single');
                if (!v) form.setValue('treatment_steps', []);
              }}
            />
          </FormControl>
        </FormItem>
      )} />
    </>
  );
}

// ── Types for the steps tab ──────────────────────────────────────────────────

interface ServiceStep {
  id?: string | number;
  service_id?: string | number;
  position: number;
  step_name: string;
  offset_min_days: number;
  offset_max_days: number;
  is_lab_dependent: boolean;
  notes?: string;
}

const stepSchema = z.object({
  step_name: z.string().min(1),
  position: z.coerce.number().int().positive(),
  offset_min_days: z.coerce.number().int().min(0),
  offset_max_days: z.coerce.number().int().min(0),
  is_lab_dependent: z.boolean().default(false),
  notes: z.string().optional(),
});
type StepFormValues = z.infer<typeof stepSchema>;

// ── StepRow — inline edit row ────────────────────────────────────────────────

function StepRow({
  step, index, serviceId, onSaved, onDeleted, t,
}: {
  step: ServiceStep;
  index: number;
  serviceId: string;
  onSaved: () => void;
  onDeleted: (id: string | number) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = React.useState(!step.id);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [nameError, setNameError] = React.useState('');

  const [draft, setDraft] = React.useState<StepFormValues>({
    step_name: step.step_name,
    position: step.position,
    offset_min_days: step.offset_min_days,
    offset_max_days: step.offset_max_days,
    is_lab_dependent: step.is_lab_dependent,
    notes: step.notes ?? '',
  });

  const handleSave = async () => {
    if (!draft.step_name.trim()) {
      setNameError(t('serviceType.stepNameRequired'));
      return;
    }
    setNameError('');
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        service_id: serviceId,
        position: draft.position,
        step_name: draft.step_name,
        offset_min_days: draft.offset_min_days,
        offset_max_days: draft.offset_max_days,
        is_lab_dependent: draft.is_lab_dependent,
        notes: draft.notes || '',
      };
      if (step.id) body.id = step.id;

      const res = await api.post(API_ROUTES.SERVICES_STEPS_UPSERT, body);
      const result = Array.isArray(res) ? res[0] : res;
      const code = result?.code ?? result?.status ?? 200;
      if (code >= 400 || result?.error) {
        throw new Error(result?.message || result?.error || t('serviceType.stepSaveError'));
      }
      toast({ title: t('serviceType.stepSaved') });
      onSaved();
      setEditing(false);
    } catch (err) {
      toast({ variant: 'destructive', title: t('toast.errorTitle'), description: err instanceof Error ? err.message : t('serviceType.stepSaveError') });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!step.id) { onDeleted(''); return; }
    setDeleting(true);
    try {
      const res = await api.delete(API_ROUTES.SERVICES_STEPS_DELETE, { id: step.id, service_id: serviceId });
      const result = Array.isArray(res) ? res[0] : res;
      const code = result?.code ?? result?.status ?? 200;
      if (code >= 400 || result?.error) {
        throw new Error(result?.message || result?.error || t('serviceType.stepDeleteError'));
      }
      toast({ title: t('serviceType.stepDeleted') });
      onDeleted(step.id);
    } catch (err) {
      toast({ variant: 'destructive', title: t('toast.errorTitle'), description: err instanceof Error ? err.message : t('serviceType.stepDeleteError') });
    } finally {
      setDeleting(false);
    }
  };

  // ── Card view (not editing) ──
  if (!editing) {
    const offsetRange = step.offset_min_days === step.offset_max_days
      ? (step.offset_min_days > 0 ? `+${step.offset_min_days}d` : null)
      : `+${step.offset_min_days}–${step.offset_max_days}d`;

    return (
      <div className="border rounded-md bg-background overflow-hidden">
        <div className="flex items-start gap-3 px-3 py-2.5">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-snug">{step.step_name}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
              {offsetRange && (
                <span className="text-xs text-muted-foreground">{t('serviceType.offsetRange')}: {offsetRange}</span>
              )}
              {step.is_lab_dependent && (
                <span className="inline-flex items-center text-xs text-amber-600 dark:text-amber-400 font-medium">
                  {t('serviceType.labDependent')}
                </span>
              )}
              {step.notes && (
                <span className="text-xs text-muted-foreground italic truncate max-w-full">{step.notes}</span>
              )}
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setEditing(true)}>
              <span className="text-xs">✏️</span>
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={handleDelete} disabled={deleting}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Edit form ──
  return (
    <div className="border rounded-md p-3 space-y-3 bg-muted/20">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">{t('serviceType.stepLabel')} {index + 1}</span>
        {step.id && (
          <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => setEditing(false)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Name — required, full width */}
      <div className="space-y-1">
        <label className="text-xs font-medium">{t('serviceType.stepName')} <span className="text-destructive">*</span></label>
        <Input
          value={draft.step_name}
          onChange={e => { setDraft(d => ({ ...d, step_name: e.target.value })); setNameError(''); }}
          placeholder={t('serviceType.stepNamePlaceholder')}
          className={`h-8 text-sm ${nameError ? 'border-destructive' : ''}`}
        />
        {nameError && <p className="text-[11px] text-destructive">{nameError}</p>}
      </div>

      {/* Position + offset range — 3-col grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <label className="text-xs font-medium">{t('serviceType.position')}</label>
          <Input type="number" min={1} value={draft.position}
            onChange={e => setDraft(d => ({ ...d, position: Number(e.target.value) }))}
            className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">{t('serviceType.offsetMinDays')}</label>
          <Input type="number" min={0} value={draft.offset_min_days}
            onChange={e => setDraft(d => ({ ...d, offset_min_days: Number(e.target.value) }))}
            className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">{t('serviceType.offsetMaxDays')}</label>
          <Input type="number" min={0} value={draft.offset_max_days}
            onChange={e => setDraft(d => ({ ...d, offset_max_days: Number(e.target.value) }))}
            className="h-8 text-sm" />
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1">
        <label className="text-xs font-medium">{t('serviceType.stepNotes')}</label>
        <Input value={draft.notes ?? ''}
          onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
          placeholder={t('serviceType.stepNotesPlaceholder')}
          className="h-8 text-sm" />
      </div>

      {/* Lab dependent toggle */}
      <div className="flex items-center gap-2 pt-0.5">
        <Switch
          id={`lab-dep-${index}`}
          checked={draft.is_lab_dependent}
          onCheckedChange={v => setDraft(d => ({ ...d, is_lab_dependent: v }))}
          className="scale-90"
        />
        <label htmlFor={`lab-dep-${index}`} className="text-xs font-medium cursor-pointer">
          {t('serviceType.isLabDependent')}
        </label>
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="button" size="sm" className="h-7 text-xs" onClick={handleSave} disabled={saving}>
          {saving ? t('serviceType.stepSaving') : t('serviceType.stepSaveBtn')}
        </Button>
        {step.id && (
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditing(false)}>
            {t('serviceType.stepCancel')}
          </Button>
        )}
      </div>
    </div>
  );
}

// ── TreatmentStepsTab — standalone CRUD tab ──────────────────────────────────

function TreatmentStepsTab({ serviceId, t }: { serviceId: string; t: (key: string, values?: Record<string, string | number>) => string }) {
  const [steps, setSteps] = React.useState<ServiceStep[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState('');
  const { toast } = useToast();

  const load = React.useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await api.get(API_ROUTES.SERVICES_STEPS, { service_id: serviceId });
      const normalized = normalizeApiResponse<any>(res);
      setSteps(
        normalized.items.map((s: any) => ({
          id: s.id,
          service_id: s.service_id,
          position: s.position ?? 1,
          step_name: s.step_name ?? '',
          offset_min_days: s.offset_min_days ?? 0,
          offset_max_days: s.offset_max_days ?? 0,
          is_lab_dependent: s.is_lab_dependent ?? false,
          notes: s.notes ?? '',
        }))
      );
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : t('serviceType.stepLoadError'));
    } finally {
      setLoading(false);
    }
  }, [serviceId, t]);

  React.useEffect(() => { load(); }, [load]);

  const addNew = () => {
    setSteps(prev => [...prev, {
      position: (prev.length > 0 ? Math.max(...prev.map(s => s.position)) : 0) + 1,
      step_name: '',
      offset_min_days: 0,
      offset_max_days: 0,
      is_lab_dependent: false,
      notes: '',
    }]);
  };

  // After save/delete always reload from API so cards reflect latest data
  const handleSaved = React.useCallback(() => { load(); }, [load]);
  const handleDeleted = React.useCallback((id: string | number) => {
    if (!id) {
      // unsaved new step — just remove from local list
      setSteps(prev => prev.filter(s => s.id));
    } else {
      load();
    }
  }, [load]);

  if (loading) {
    return <p className="text-xs text-muted-foreground text-center py-8">{t('serviceType.stepLoading')}</p>;
  }

  if (loadError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>{t('toast.errorTitle')}</AlertTitle>
        <AlertDescription>{loadError}</AlertDescription>
      </Alert>
    );
  }

  const savedSteps = steps.filter(s => s.id).slice().sort((a, b) => a.position - b.position);
  const newSteps = steps.filter(s => !s.id);
  const orderedSteps = [...savedSteps, ...newSteps];

  return (
    <div className="space-y-0">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-muted-foreground">{t('serviceType.stepsTabDescription')}</p>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addNew}>
          <PlusCircle className="h-3.5 w-3.5 mr-1" />
          {t('serviceType.addStep')}
        </Button>
      </div>

      {orderedSteps.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-6 border rounded-lg">{t('serviceType.noSteps')}</p>
      )}

      {/* Workflow list with connector lines */}
      <div className="relative">
        {orderedSteps.map((step, idx) => (
          <div key={step.id ?? `new-${idx}`} className="relative flex gap-3">
            {/* Timeline column */}
            <div className="flex flex-col items-center shrink-0 w-6">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary z-10 mt-3">
                {step.id ? step.position : '·'}
              </div>
              {idx < orderedSteps.length - 1 && (
                <div className="flex-1 w-px bg-border min-h-[0.75rem]" />
              )}
            </div>
            {/* Card */}
            <div className="flex-1 min-w-0 pb-2">
              <StepRow
                step={step}
                index={idx}
                serviceId={serviceId}
                onSaved={handleSaved}
                onDeleted={handleDeleted}
                t={t}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── TreatmentStepsFields — used inside create dialog (form-based) ─────────────

function TreatmentStepsFields({ form, t }: { form: any; t: (key: string, values?: Record<string, string | number>) => string }) {
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'treatment_steps' });
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{t('serviceType.description')}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => append({ position: fields.length + 1, name: '', offset_days_from_prev: 0, duration_minutes: 30 })}
        >
          <PlusCircle className="h-3.5 w-3.5 mr-1" />
          {t('serviceType.addStep')}
        </Button>
      </div>
      {fields.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-6 border rounded-lg">{t('serviceType.noSteps')}</p>
      )}
      {fields.map((field, index) => (
        <div key={field.id} className="border rounded-md p-3 space-y-2 bg-muted/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">{t('serviceType.stepLabel')} {index + 1}</span>
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => remove(index)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">{t('serviceType.stepName')} <span className="text-destructive">*</span></label>
            <Input
              {...form.register(`treatment_steps.${index}.name`, { required: true })}
              placeholder={t('serviceType.stepNamePlaceholder')}
              className="h-8 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('serviceType.offsetDays')}</label>
              <Input type="number" min={0} {...form.register(`treatment_steps.${index}.offset_days_from_prev`)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('serviceType.duration')}</label>
              <Input type="number" min={1} {...form.register(`treatment_steps.${index}.duration_minutes`)} className="h-8 text-sm" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">{t('serviceType.stepNotes')}</label>
            <Input {...form.register(`treatment_steps.${index}.notes`)} placeholder={t('serviceType.stepNotesPlaceholder')} className="h-8 text-sm" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Inner component — reads NarrowModeContext
function ServicesTableWithCards({
  services, columns, selectedService, onRowSelect, onRefresh, isRefreshing, onCreate, rowSelection, setRowSelection,
  pagination, onPaginationChange, pageCount, columnFilters, onColumnFiltersChange, t,
}: {
  services: Service[];
  columns: any[];
  selectedService: Service | null;
  onRowSelect: (rows: Service[]) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  onCreate?: () => void;
  rowSelection: RowSelectionState;
  setRowSelection: React.Dispatch<React.SetStateAction<RowSelectionState>>;
  pagination: PaginationState;
  onPaginationChange: React.Dispatch<React.SetStateAction<PaginationState>>;
  pageCount: number;
  columnFilters: ColumnFiltersState;
  onColumnFiltersChange: React.Dispatch<React.SetStateAction<ColumnFiltersState>>;
  t: (key: string) => string;
}) {
  const { isNarrow: panelNarrow } = useNarrowMode();
  const isViewportNarrow = useViewportNarrow();
  const isNarrow = !!selectedService || panelNarrow || isViewportNarrow;
  return (
    <DataTable
      columns={columns}
      data={services}
      filterColumnId="name"
      filterPlaceholder={t('filterPlaceholder')}
      onCreate={onCreate}
      onRefresh={onRefresh}
      isRefreshing={isRefreshing}
      onRowSelectionChange={onRowSelect}
      enableSingleRowSelection={true}
      rowSelection={rowSelection}
      setRowSelection={setRowSelection}
      isNarrow={isNarrow}
      manualPagination={true}
      pagination={pagination}
      onPaginationChange={onPaginationChange}
      pageCount={pageCount}
      columnFilters={columnFilters}
      onColumnFiltersChange={onColumnFiltersChange}
      renderCard={(service: Service, _isSelected: boolean) => (
        <DataCard isSelected={_isSelected}
          title={service.name}
          subtitle={`${service.category} · ${service.currency} ${service.price}`}
          accentColor={service.color || undefined}
          showArrow
          onClick={() => onRowSelect([service])}
          badge={service.is_active
            ? undefined
            : <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium bg-muted text-muted-foreground">Inactivo</span>
          }
        />
      )}
    />
  );
}

export default function ServicesPage() {
  const t = useTranslations('ServicesPage');
  const tValidation = useTranslations('ServicesPage.validation');
  const tColumns = useTranslations('ServicesColumns');
  const { hasPermission } = usePermissions();
  const [services, setServices] = React.useState<Service[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: PAGE_SIZE });
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [categories, setCategories] = React.useState<MiscellaneousCategory[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [deletingService, setDeletingService] = React.useState<Service | null>(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [detailError, setDetailError] = React.useState<string | null>(null);
  const [isSavingDetail, setIsSavingDetail] = React.useState(false);
  const [selectedService, setSelectedService] = React.useState<Service | null>(null);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  const canCreate = hasPermission(SALES_PERMISSIONS.SERVICES_CREATE);
  const canUpdate = hasPermission(SALES_PERMISSIONS.SERVICES_UPDATE);
  const canDelete = hasPermission(SALES_PERMISSIONS.SERVICES_DELETE);

  const { toast } = useToast();

  const createForm = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceFormSchema(tValidation)),
    defaultValues: DEFAULT_SERVICE_FORM_VALUES,
  });

  const detailForm = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceFormSchema(tValidation)),
    defaultValues: DEFAULT_SERVICE_FORM_VALUES,
  });

  const searchValue = (columnFilters.find(f => f.id === 'name')?.value as string) ?? '';
  const pageCount = totalCount > 0 ? Math.ceil(totalCount / pagination.pageSize) : 1;

  const loadServices = React.useCallback(async () => {
    setIsRefreshing(true);
    const result = await getServices({
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      search: searchValue,
    });
    setServices(result.items);
    setTotalCount(result.total);
    setIsRefreshing(false);
  }, [pagination.pageIndex, pagination.pageSize, searchValue]);

  React.useEffect(() => { loadServices(); }, [loadServices]);

  // Reset to page 0 when search filter changes
  const handleColumnFiltersChange: React.Dispatch<React.SetStateAction<ColumnFiltersState>> = React.useCallback((updater) => {
    setColumnFilters(updater);
    setPagination(p => ({ ...p, pageIndex: 0 }));
  }, []);

  // Load categories and populate detail form when selection changes
  React.useEffect(() => {
    if (selectedService) {
      getMiscellaneousCategories().then(setCategories);
      detailForm.reset({
        id: selectedService.id,
        name: selectedService.name,
        category_id: selectedService.category_id || '',
        price: selectedService.price,
        currency: (selectedService.currency as 'USD' | 'UYU') || 'USD',
        duration_minutes: selectedService.duration_minutes,
        description: selectedService.description || '',
        indications: selectedService.indications || '',
        color: selectedService.color || '',
        is_active: selectedService.is_active ?? true,
        service_type: selectedService.service_type || 'single',
        treatment_steps: selectedService.treatment_steps || [],
      });
      setDetailError(null);
    }
  }, [selectedService, detailForm]);

  const handleCreate = () => {
    if (!canCreate) return;
    getMiscellaneousCategories().then(setCategories);
    createForm.reset(DEFAULT_SERVICE_FORM_VALUES);
    setCreateError(null);
    setIsCreateDialogOpen(true);
  };

  const handleDelete = (service: Service) => {
    setDeletingService(service);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingService) return;
    try {
      await deleteService(deletingService.id);
      toast({ title: t('toast.deleteSuccessTitle'), description: t('toast.deleteSuccessDescription', { name: deletingService.name }) });
      setIsDeleteDialogOpen(false);
      setDeletingService(null);
      if (selectedService?.id === deletingService.id) { setSelectedService(null); setRowSelection({}); }
      loadServices();
    } catch (error) {
      toast({ variant: 'destructive', title: t('toast.errorTitle'), description: error instanceof Error ? error.message : t('toast.deleteErrorDescription') });
    }
  };

  const onCreateSubmit = async (values: ServiceFormValues) => {
    setCreateError(null);
    try {
      await upsertService(values, categories);
      toast({ title: t('toast.createSuccessTitle'), description: t('toast.successDescription', { name: values.name }) });
      setIsCreateDialogOpen(false);
      loadServices();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : t('toast.genericError'));
    }
  };

  const onDetailSubmit = async (values: ServiceFormValues) => {
    setDetailError(null);
    setIsSavingDetail(true);
    try {
      await upsertService(values, categories);
      toast({ title: t('toast.editSuccessTitle'), description: t('toast.successDescription', { name: values.name }) });
      const updatedService: Service = {
        ...selectedService!,
        name: values.name,
        price: values.price,
        currency: values.currency,
        duration_minutes: values.duration_minutes,
        description: values.description,
        indications: values.indications,
        color: values.color || null,
        is_active: values.is_active,
        category_id: values.category_id,
        service_type: values.service_type,
        treatment_steps: values.treatment_steps,
      };
      setServices(prev => prev.map(s => s.id === values.id ? updatedService : s));
      setSelectedService(updatedService);
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : t('toast.genericError'));
    } finally {
      setIsSavingDetail(false);
    }
  };

  const handleRowSelect = (rows: Service[]) => {
    setSelectedService(rows.length > 0 ? rows[0] : null);
  };

  const handleCloseDetail = () => {
    setSelectedService(null);
    setRowSelection({});
  };

  const servicesColumns = ServicesColumnsWrapper({
    onDelete: canDelete ? handleDelete : undefined,
  });

  const [activeTab, setActiveTab] = React.useState('details');

  useDeepLink<Service>({
    tabMap: { 'Detalles': 'details', 'Info': 'info' },
    onFilter: () => {},
    items: services,
    allItems: services,
    isLoading: isRefreshing,
    onAutoSelect: (svc) => handleRowSelect([svc]),
    setRowSelection,
    onTabChange: (id) => setActiveTab(id),
    actionMap: { 'Crear': () => setIsCreateDialogOpen(true) },
    filterDelay: 300,
  });

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <TwoPanelLayout
        isRightPanelOpen={!!selectedService}
        onBack={handleCloseDetail}
        leftPanel={
          <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
            <CardHeader className="flex-none p-4">
              <div className="flex items-start gap-3">
                <div className="header-icon-circle mt-0.5"><Briefcase className="h-5 w-5" /></div>
                <div className="flex flex-col">
                  <CardTitle className="text-lg">{t('title')}</CardTitle>
                  <CardDescription className="text-xs">{t('description')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 bg-card">
              <ServicesTableWithCards
                services={services}
                columns={servicesColumns}
                selectedService={selectedService}
                onRowSelect={handleRowSelect}
                onRefresh={loadServices}
                isRefreshing={isRefreshing}
                onCreate={canCreate ? handleCreate : undefined}
                rowSelection={rowSelection}
                setRowSelection={setRowSelection}
                pagination={pagination}
                onPaginationChange={setPagination}
                pageCount={pageCount}
                columnFilters={columnFilters}
                onColumnFiltersChange={handleColumnFiltersChange}
                t={t}
              />
            </CardContent>
          </Card>
        }
        rightPanel={
          selectedService && (
            <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
              <CardHeader className="flex-none p-4 pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {selectedService.color
                      ? <div className="h-9 w-9 rounded-full border-2 border-white shadow flex-none" style={{ backgroundColor: selectedService.color }} />
                      : <div className="header-icon-circle flex-none"><Briefcase className="h-5 w-5" /></div>
                    }
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-lg truncate">{selectedService.name}</CardTitle>
                      <CardDescription className="text-xs">{selectedService.category}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 ml-2 flex-none">
                    {canDelete && (
                      <button type="button" title={tColumns('delete')} onClick={() => handleDelete(selectedService)} className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    <button type="button" onClick={handleCloseDetail} className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto p-4 pt-0">
                <Form {...detailForm}>
                  <form onSubmit={detailForm.handleSubmit(onDetailSubmit)} className="h-full flex flex-col">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
                      <TabsList>
                        <TabsTrigger value="details">{t('tabs.details')}</TabsTrigger>
                        <TabsTrigger value="info">{t('tabs.info')}</TabsTrigger>
                        {detailForm.watch('service_type') === 'workflow' && (
                          <TabsTrigger value="steps">{t('tabs.steps')}</TabsTrigger>
                        )}
                      </TabsList>
                      <div className="flex-1 overflow-auto mt-4">
                        <TabsContent value="details" className="m-0 space-y-3">
                          {detailError && (
                            <Alert variant="destructive">
                              <AlertTriangle className="h-4 w-4" />
                              <AlertTitle>{t('toast.errorTitle')}</AlertTitle>
                              <AlertDescription>{detailError}</AlertDescription>
                            </Alert>
                          )}
                          <ServiceFormFields form={detailForm} categories={categories} t={t} />
                          {canUpdate && (
                            <div className="flex gap-2 pt-2">
                              <Button type="submit" disabled={isSavingDetail}>
                                {isSavingDetail ? t('createDialog.editSave') + '...' : t('createDialog.editSave')}
                              </Button>
                            </div>
                          )}
                        </TabsContent>
                        <TabsContent value="info" className="m-0 space-y-4">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-lg border border-border bg-muted/30 p-3">
                              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">{tColumns('price')}</p>
                              <p className="text-xl font-bold text-foreground">{selectedService.currency} {selectedService.price}</p>
                            </div>
                            <div className="rounded-lg border border-border bg-muted/30 p-3">
                              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">{tColumns('duration')}</p>
                              <p className="text-xl font-bold text-foreground">{selectedService.duration_minutes} min</p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between py-2 border-b border-border/50">
                              <span className="text-xs text-muted-foreground">{tColumns('category')}</span>
                              <span className="text-xs font-medium">{selectedService.category}</span>
                            </div>
                            <div className="flex items-center justify-between py-2 border-b border-border/50">
                              <span className="text-xs text-muted-foreground">{tColumns('isActive')}</span>
                              <Badge variant={selectedService.is_active ? 'success' : 'outline'}>
                                {selectedService.is_active ? tColumns('active') : tColumns('inactive')}
                              </Badge>
                            </div>
                          </div>
                          {selectedService.description && (
                            <div>
                              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">{t('createDialog.descriptionLabel')}</p>
                              <p className="text-sm text-foreground whitespace-pre-wrap">{selectedService.description}</p>
                            </div>
                          )}
                          {selectedService.indications && (
                            <div>
                              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">{t('createDialog.indicationsLabel')}</p>
                              <p className="text-sm text-foreground whitespace-pre-wrap">{selectedService.indications}</p>
                            </div>
                          )}
                        </TabsContent>
                        <TabsContent value="steps" className="m-0 space-y-3">
                          <TreatmentStepsTab serviceId={selectedService.id} t={t} />
                        </TabsContent>
                      </div>
                    </Tabs>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )
        }
      />

      {/* Create dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('createDialog.title')}</DialogTitle>
            <DialogDescription>{t('createDialog.description')}</DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="flex flex-col flex-1 overflow-hidden">
              <DialogBody className="space-y-3 py-4 px-6">
                {createError && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>{t('toast.errorTitle')}</AlertTitle>
                    <AlertDescription>{createError}</AlertDescription>
                  </Alert>
                )}
                <ServiceFormFields form={createForm} categories={categories} t={t} />
                {createForm.watch('service_type') === 'workflow' && (
                  <TreatmentStepsFields form={createForm} t={t} />
                )}
              </DialogBody>
              <DialogFooter>
                <Button type="submit">{t('createDialog.save')}</Button>
                <Button variant="outline" type="button" onClick={() => setIsCreateDialogOpen(false)}>{t('createDialog.cancel')}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteDialog.description', { name: deletingService?.name })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">{t('deleteDialog.confirm')}</AlertDialogAction>
            <AlertDialogCancel>{t('deleteDialog.cancel')}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
