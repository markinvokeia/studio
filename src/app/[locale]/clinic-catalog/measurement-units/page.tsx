'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Pencil, Plus, Ruler, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogBody, DialogCancelButton, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { useAsyncAction } from '@/hooks/use-async-action';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/error-utils';
import { deleteMeasurementUnit, fetchMeasurementUnits, saveMeasurementUnit } from '@/services/aesthetic-record';

import { CLINIC_CATALOG_PERMISSIONS } from '@/constants/permissions';
import type { MeasurementUnit } from '@/lib/types';

const unitFormSchema = (t: (key: string) => string) => z.object({
  code: z.string().trim().min(1, { message: t('validation.codeRequired') }).max(20).regex(/^[a-zA-Z0-9_-]+$/, { message: t('validation.codeFormat') }),
  name: z.string().trim().min(1, { message: t('validation.nameRequired') }).max(100),
  symbol: z.string().trim().min(1, { message: t('validation.symbolRequired') }).max(20),
  step: z.coerce.number({ invalid_type_error: t('validation.stepInvalid') }).positive({ message: t('validation.stepInvalid') }),
  isActive: z.boolean(),
});

type UnitFormValues = z.infer<ReturnType<typeof unitFormSchema>>;

const EMPTY_FORM: UnitFormValues = { code: '', name: '', symbol: '', step: 1, isActive: true };

/** Dose units used by the aesthetic services (Catálogo de la Clínica → Unidades de medida) */
export default function MeasurementUnitsPage() {
  const t = useTranslations('MeasurementUnitsPage');
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission(CLINIC_CATALOG_PERMISSIONS.UNITS_CREATE);
  const canUpdate = hasPermission(CLINIC_CATALOG_PERMISSIONS.UNITS_UPDATE);
  const canDelete = hasPermission(CLINIC_CATALOG_PERMISSIONS.UNITS_DELETE);

  const [units, setUnits] = React.useState<MeasurementUnit[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<MeasurementUnit | 'new' | null>(null);
  const [deleting, setDeleting] = React.useState<MeasurementUnit | null>(null);
  const [submissionError, setSubmissionError] = React.useState<string | null>(null);

  const form = useForm<UnitFormValues>({ resolver: zodResolver(unitFormSchema(t)), defaultValues: EMPTY_FORM });

  const load = React.useCallback(async () => {
    setLoadError(null);
    try {
      setUnits(await fetchMeasurementUnits());
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  function openForm(unit: MeasurementUnit | 'new') {
    setSubmissionError(null);
    form.reset(unit === 'new' ? EMPTY_FORM : { code: unit.code, name: unit.name, symbol: unit.symbol, step: unit.step, isActive: unit.isActive });
    setEditing(unit);
  }

  const save = useAsyncAction(
    (values: UnitFormValues) => saveMeasurementUnit({ id: editing && editing !== 'new' ? editing.id : undefined, ...values }),
    {
      onSuccess: () => {
        toast({ title: editing === 'new' ? t('toast.created') : t('toast.updated') });
        setEditing(null);
        load();
      },
      onError: (error) => setSubmissionError(getErrorMessage(error)),
      showErrorToast: false,
    },
  );

  const remove = useAsyncAction(
    (unit: MeasurementUnit) => deleteMeasurementUnit(unit.id),
    {
      onSuccess: ({ deactivated }) => {
        toast({ title: deactivated ? t('toast.deactivated') : t('toast.deleted') });
        setDeleting(null);
        load();
      },
      errorTitle: t('toast.deleteError'),
    },
  );

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6">
      <Card className="mx-auto max-w-4xl">
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Ruler className="h-4 w-4" /></div>
            <div className="min-w-0">
              <CardTitle>{t('title')}</CardTitle>
              <CardDescription>{t('description')}</CardDescription>
            </div>
          </div>
          {canCreate && (
            <Button size="sm" onClick={() => openForm('new')}>
              <Plus className="mr-1.5 h-4 w-4" />
              {t('add')}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : loadError ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{t('loadError')}</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center gap-2">
                {loadError}
                <Button size="sm" variant="outline" onClick={() => { setIsLoading(true); load(); }}>{t('retry')}</Button>
              </AlertDescription>
            </Alert>
          ) : units.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{t('empty')}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('columns.name')}</TableHead>
                    <TableHead>{t('columns.symbol')}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t('columns.code')}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t('columns.step')}</TableHead>
                    <TableHead>{t('columns.status')}</TableHead>
                    {(canUpdate || canDelete) && <TableHead className="w-24" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {units.map((unit) => (
                    <TableRow key={unit.id}>
                      <TableCell className="font-medium">{unit.name}</TableCell>
                      <TableCell>{unit.symbol}</TableCell>
                      <TableCell className="hidden font-mono text-xs text-muted-foreground sm:table-cell">{unit.code}</TableCell>
                      <TableCell className="hidden tabular-nums sm:table-cell">{unit.step}</TableCell>
                      <TableCell>
                        <Badge variant={unit.isActive ? 'secondary' : 'outline'}>{unit.isActive ? t('status.active') : t('status.inactive')}</Badge>
                      </TableCell>
                      {(canUpdate || canDelete) && (
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {canUpdate && (
                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openForm(unit)} aria-label={t('edit')} title={t('edit')}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {canDelete && (unit.isActive || !unit.inUse) && (
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleting(unit)} aria-label={t('delete')} title={t('delete')}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editing !== null} onOpenChange={(open) => { if (!open && !save.isPending) setEditing(null); }}>
        <DialogContent maxWidth="md" confirmOnClose isDirty={form.formState.isDirty}>
          <DialogHeader>
            <DialogTitle>{editing === 'new' ? t('form.createTitle') : t('form.editTitle')}</DialogTitle>
            <DialogDescription>{t('form.description')}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((values) => save.run(values))} className="flex min-h-0 flex-col">
              <DialogBody className="space-y-4 px-6 py-4">
                {submissionError && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>{t('toast.saveError')}</AlertTitle>
                    <AlertDescription>{submissionError}</AlertDescription>
                  </Alert>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('form.name')}</FormLabel>
                      <FormControl><Input {...field} placeholder={t('form.namePlaceholder')} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="symbol" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('form.symbol')}</FormLabel>
                      <FormControl><Input {...field} placeholder={t('form.symbolPlaceholder')} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="code" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('form.code')}</FormLabel>
                      <FormControl><Input {...field} placeholder="ml" /></FormControl>
                      <FormDescription>{t('form.codeHint')}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="step" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('form.step')}</FormLabel>
                      <FormControl><Input {...field} type="number" inputMode="decimal" min={0} step="any" /></FormControl>
                      <FormDescription>{t('form.stepHint')}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="isActive" render={({ field }) => (
                  <FormItem className="flex items-center justify-between gap-4 rounded-lg border p-3">
                    <div>
                      <FormLabel>{t('form.active')}</FormLabel>
                      <FormDescription>{t('form.activeHint')}</FormDescription>
                    </div>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  </FormItem>
                )} />
              </DialogBody>
              <DialogFooter>
                <DialogCancelButton disabled={save.isPending}>{t('form.cancel')}</DialogCancelButton>
                <Button type="submit" loading={save.isPending}>{t('form.save')}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleting !== null} onOpenChange={(open) => { if (!open && !remove.isPending) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteDialog.title', { name: deleting?.name ?? '' })}</AlertDialogTitle>
            <AlertDialogDescription>{deleting?.inUse ? t('deleteDialog.inUse') : t('deleteDialog.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>{t('deleteDialog.cancel')}</AlertDialogCancel>
            <Button variant="destructive" loading={remove.isPending} onClick={() => deleting && remove.run(deleting)}>
              {deleting?.inUse ? t('deleteDialog.deactivate') : t('deleteDialog.confirm')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
