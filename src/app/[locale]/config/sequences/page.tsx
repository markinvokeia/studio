'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { Sequence } from '@/lib/types';
import { SEQUENCE_VARIABLES, previewPattern, validatePattern } from '@/lib/sequence-utils';
import api from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Info } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { SequencesColumnsWrapper } from './columns';

const sequenceFormSchema = (t: (key: string) => string) => z.object({
  id: z.string().optional(),
  name: z.string().min(1, t('nameRequired')),
  document_type: z.enum(['invoice', 'quote', 'order', 'payment', 'credit_note', 'purchase_order'], {
    required_error: t('documentTypeRequired')
  }),
  pattern: z.string().min(1, t('patternRequired')).refine(
    (pattern) => validatePattern(pattern).is_valid,
    t('patternInvalid')
  ),
  current_counter: z.number().min(1, t('counterMin')),
  reset_period: z.enum(['never', 'yearly', 'monthly'], {
    required_error: t('resetPeriodRequired')
  }),
  is_active: z.boolean(),
});

type SequenceFormValues = z.infer<ReturnType<typeof sequenceFormSchema>>;

async function getSequences(): Promise<Sequence[]> {
  try {
    const data = await api.get(API_ROUTES.CONFIG.SEQUENCES);
    const sequencesData = Array.isArray(data) ? data : (data.sequences || data.data || data.result || []);

    return sequencesData.map((apiSequence: any) => ({
      id: String(apiSequence.id),
      name: apiSequence.name,
      document_type: apiSequence.document_type,
      pattern: apiSequence.pattern,
      current_counter: Number(apiSequence.current_counter),
      reset_period: apiSequence.reset_period,
      is_active: Boolean(apiSequence.is_active),
      preview_example: apiSequence.preview_example,
      created_at: apiSequence.created_at,
      updated_at: apiSequence.updated_at,
    }));
  } catch (error) {
    console.error("Failed to fetch sequences:", error);
    return [];
  }
}

async function upsertSequence(sequenceData: SequenceFormValues) {
  const responseData = await api.post(API_ROUTES.CONFIG.SEQUENCES_UPSERT, sequenceData);
  if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
    const message = responseData[0]?.message ? responseData[0].message : 'Failed to save sequence';
    throw new Error(message);
  }
  return responseData;
}

async function deleteSequence(id: string) {
  const responseData = await api.delete(API_ROUTES.CONFIG.SEQUENCES_DELETE, { id });
  if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
    const message = responseData[0]?.message ? responseData[0].message : 'Failed to delete sequence';
    throw new Error(message);
  }
  return responseData;
}

export default function SequencesPage() {
  const t = useTranslations('SequencesPage');
  const tValidation = useTranslations('SequencesPage.validation');
  const { toast } = useToast();
  const [sequences, setSequences] = React.useState<Sequence[]>([]);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingSequence, setEditingSequence] = React.useState<Sequence | null>(null);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [deletingSequence, setDeletingSequence] = React.useState<Sequence | null>(null);
  const [submissionError, setSubmissionError] = React.useState<string | null>(null);

  const form = useForm<SequenceFormValues>({
    resolver: zodResolver(sequenceFormSchema(tValidation)),
    defaultValues: {
      name: '',
      document_type: 'invoice',
      pattern: 'INV-{YYYY}-{MM}-{COUNTER:4}',
      current_counter: 1,
      reset_period: 'never',
      is_active: true
    },
  });

  const loadSequences = React.useCallback(async () => {
    setIsRefreshing(true);
    const fetchedSequences = await getSequences();
    setSequences(fetchedSequences);
    setIsRefreshing(false);
  }, []);

  React.useEffect(() => {
    loadSequences();
  }, [loadSequences]);

  const handleCreate = () => {
    setEditingSequence(null);
    form.reset({
      name: '',
      document_type: 'invoice',
      pattern: 'INV-{YYYY}-{MM}-{COUNTER:4}',
      current_counter: 1,
      reset_period: 'never',
      is_active: true
    });
    setSubmissionError(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (sequence: Sequence) => {
    setEditingSequence(sequence);
    form.reset({
      id: sequence.id,
      name: sequence.name,
      document_type: sequence.document_type,
      pattern: sequence.pattern,
      current_counter: sequence.current_counter,
      reset_period: sequence.reset_period,
      is_active: sequence.is_active,
    });
    setSubmissionError(null);
    setIsDialogOpen(true);
  };

  const handleDelete = (sequence: Sequence) => {
    setDeletingSequence(sequence);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingSequence) return;
    try {
      await deleteSequence(deletingSequence.id);
      toast({
        title: t('toast.deleteSuccessTitle'),
        description: t('toast.deleteSuccessDescription'),
      });
      setIsDeleteDialogOpen(false);
      setDeletingSequence(null);
      loadSequences();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('toast.errorTitle'),
        description: t('toast.deleteErrorDescription'),
      });
    }
  };

  const onSubmit = async (values: SequenceFormValues) => {
    setSubmissionError(null);
    try {
      await upsertSequence(values);
      toast({
        title: editingSequence ? t('toast.editSuccessTitle') : t('toast.createSuccessTitle'),
        description: t('toast.successDescription'),
      });
      setIsDialogOpen(false);
      loadSequences();
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : t('toast.genericError'));
    }
  };

  const addToPattern = (variable: string) => {
    const currentPattern = form.getValues('pattern');
    const newPattern = currentPattern + variable;
    form.setValue('pattern', newPattern);
  };

  const documentType = form.watch('document_type');
  const pattern = form.watch('pattern');
  const preview = pattern ? previewPattern(pattern, documentType) : '';

  const sequencesColumns = SequencesColumnsWrapper({ onEdit: handleEdit, onDelete: handleDelete });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={sequencesColumns}
            data={sequences}
            filterColumnId="name"
            filterPlaceholder={t('filterPlaceholder')}
            onCreate={handleCreate}
            onRefresh={loadSequences}
            isRefreshing={isRefreshing}
          />
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingSequence ? t('createDialog.editTitle') : t('createDialog.title')}</DialogTitle>
            <DialogDescription>
              {editingSequence ? t('createDialog.editDescription') : t('createDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
              {submissionError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{t('toast.errorTitle')}</AlertTitle>
                  <AlertDescription>{submissionError}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('createDialog.name')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('createDialog.namePlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="document_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('createDialog.documentType')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('createDialog.selectDocumentType')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="invoice">{t('documentTypes.invoice')}</SelectItem>
                          <SelectItem value="quote">{t('documentTypes.quote')}</SelectItem>
                          <SelectItem value="order">{t('documentTypes.order')}</SelectItem>
                          <SelectItem value="payment">{t('documentTypes.payment')}</SelectItem>
                          <SelectItem value="credit_note">{t('documentTypes.credit_note')}</SelectItem>
                          <SelectItem value="purchase_order">{t('documentTypes.purchase_order')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="pattern"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('createDialog.pattern')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('createDialog.patternPlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-3">
                <Label>{t('createDialog.variables')}</Label>
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>{t('createDialog.variableDescription')}</AlertDescription>
                </Alert>
                <div className="grid grid-cols-2 gap-2">
                  {SEQUENCE_VARIABLES.map((variable) => (
                    <Button
                      key={variable.key}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addToPattern(`{${variable.key}}`)}
                      className="justify-start text-xs h-auto p-2"
                    >
                      <div>
                        <div className="font-mono">{'{'}{variable.key}{'}'}</div>
                        <div className="text-muted-foreground">{t(`variables.${variable.key}`)}</div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>

              {preview && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>{t('createDialog.preview')}</AlertTitle>
                  <AlertDescription>
                    {t('createDialog.previewExample')}
                    <code className="bg-muted px-2 py-1 rounded mx-1">{preview}</code>
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="current_counter"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('createDialog.currentCounter')}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="reset_period"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('createDialog.resetPeriod')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('createDialog.selectResetPeriod')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="never">{t('resetPeriods.never')}</SelectItem>
                          <SelectItem value="yearly">{t('resetPeriods.yearly')}</SelectItem>
                          <SelectItem value="monthly">{t('resetPeriods.monthly')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">{t('createDialog.isActive')}</FormLabel>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setIsDialogOpen(false)}>
                  {t('createDialog.cancel')}
                </Button>
                <Button type="submit">
                  {editingSequence ? t('createDialog.editSave') : t('createDialog.save')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('deleteDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
              {t('deleteDialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}