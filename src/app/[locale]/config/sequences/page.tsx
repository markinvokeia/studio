'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { handleApiErrorEnhanced } from '@/lib/error-utils';
import { SEQUENCE_VARIABLES, previewPattern, validatePattern } from '@/lib/sequence-utils';
import { Sequence } from '@/lib/types';
import api from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Filter, Info, PlusCircle, RefreshCw, Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { SequencesColumnsWrapper } from './columns';

const sequenceFormSchema = (t: (key: string) => string) => z.object({
  id: z.number().optional(),
  name: z.string().min(1, t('nameRequired')),
  document_type: z.enum(['invoice', 'quote', 'order', 'payment', 'credit_note', 'purchase_order', 'miscellaneous'], {
    required_error: t('documentTypeRequired')
  }),
  pattern: z.string().min(1, t('patternRequired')).refine(
    (pattern) => {
      if (!pattern || typeof pattern !== 'string') {
        return false;
      }
      try {
        const validation = validatePattern(pattern);
        return validation.is_valid;
      } catch (error) {
        console.error('Pattern validation error:', error);
        return false;
      }
    },
    {
      message: t('patternInvalid'),
    }
  ).transform((val) => val || ''),
  current_counter: z.number().min(1, t('counterMin')),
  reset_period: z.enum(['never', 'yearly', 'monthly', 'daily'], {
    required_error: t('resetPeriodRequired')
  }),
  is_active: z.boolean(),
});

type SequenceFormValues = z.infer<ReturnType<typeof sequenceFormSchema>>;

async function getSequences(params?: {
  page?: number;
  limit?: number;
  search_term?: string;
  active_only?: boolean;
  start_date?: string | null;
  end_date?: string | null;
}): Promise<{ sequences: Sequence[]; total: number }> {
  try {
    const queryParams: Record<string, any> = {};

    if (params?.page !== undefined) queryParams.page = params.page;
    if (params?.limit !== undefined) queryParams.limit = params.limit;
    if (params?.search_term) queryParams.search_term = params.search_term;
    if (params?.active_only !== undefined) queryParams.active_only = params.active_only;
    if (params?.start_date !== null && params?.start_date !== undefined) queryParams.start_date = params.start_date;
    if (params?.end_date !== null && params?.end_date !== undefined) queryParams.end_date = params.end_date;

    const data = await api.get(API_ROUTES.CONFIG.SEQUENCES, queryParams);

    // Handle paginated response
    const sequencesData = Array.isArray(data) ? data : (data.sequences || data.data || data.result || []);
    const total = data.total || data.total_count || sequencesData.length;

    // Filter out empty objects and map valid sequences
    const sequences = sequencesData
      .filter((apiSequence: any) => {
        // Filter out empty objects or objects without required fields
        return apiSequence &&
          typeof apiSequence === 'object' &&
          !Array.isArray(apiSequence) &&
          Object.keys(apiSequence).length > 0 &&
          apiSequence.id; // Ensure we have at least an id
      })
      .map((apiSequence: any) => ({
        id: Number(apiSequence.id),
        name: apiSequence.name || '',
        document_type: apiSequence.document_type || 'invoice',
        pattern: apiSequence.pattern || '',
        current_counter: Number(apiSequence.current_counter) || 1,
        reset_period: apiSequence.reset_period || 'never',
        is_active: Boolean(apiSequence.is_active ?? true),
        preview_example: apiSequence.preview_example,
        created_at: apiSequence.created_at,
        updated_at: apiSequence.updated_at,
      }));

    return { sequences, total };
  } catch (error) {
    console.error("Failed to fetch sequences:", error);
    return { sequences: [], total: 0 };
  }
}

async function upsertSequence(sequenceData: SequenceFormValues) {
  const responseData = await api.post(API_ROUTES.CONFIG.SEQUENCES_UPSERT, sequenceData);

  // Use enhanced error detection
  handleApiErrorEnhanced(responseData);

  return responseData;
}

async function deleteSequence(id: number) {
  const responseData = await api.delete(API_ROUTES.CONFIG.SEQUENCES_DELETE, { id });

  // Handle various error response formats
  if (responseData && typeof responseData === 'object') {
    // Handle array-based error responses
    if (Array.isArray(responseData)) {
      const errorItem = responseData.find(item =>
        item?.code >= 400 || item?.error || item?.message
      );
      if (errorItem) {
        const message = errorItem.message || errorItem.error || 'Failed to delete sequence';
        throw new Error(message);
      }
    }

    // Handle object-based error responses
    if ('error' in responseData) {
      throw new Error(responseData.error || 'Failed to delete sequence');
    }

    if ('message' in responseData && typeof responseData.message === 'string') {
      // Check if it's actually an error message by looking at context
      const hasErrorIndicators =
        responseData.message.toLowerCase().includes('error') ||
        responseData.message.toLowerCase().includes('failed') ||
        responseData.message.toLowerCase().includes('invalid') ||
        responseData.status >= 400;

      if (hasErrorIndicators) {
        throw new Error(responseData.message);
      }
    }
  }

  return responseData;
}

export default function SequencesPage() {
  const t = useTranslations('SequencesPage');
  const tValidation = useTranslations('SequencesPage.validation');
  const { toast } = useToast();
  const [sequences, setSequences] = React.useState<Sequence[]>([]);
  const [total, setTotal] = React.useState(0);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  });
  const [searchTerm, setSearchTerm] = React.useState('');
  const [activeOnly, setActiveOnly] = React.useState(true);
  const [dateRange, setDateRange] = React.useState<{
    start_date: string | null;
    end_date: string | null;
  }>({
    start_date: null,
    end_date: null,
  });


  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingSequence, setEditingSequence] = React.useState<Sequence | null>(null);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [deletingSequence, setDeletingSequence] = React.useState<Sequence | null>(null);

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
    const result = await getSequences({
      page: pagination.pageIndex + 1, // API uses 1-based pagination
      limit: pagination.pageSize,
      search_term: searchTerm || undefined,
      active_only: activeOnly,
      start_date: dateRange.start_date,
      end_date: dateRange.end_date,
    });
    setSequences(result.sequences);
    setTotal(result.total);
    setIsRefreshing(false);
  }, [pagination, searchTerm, activeOnly, dateRange]);

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
    setIsDialogOpen(true);
  };

  const handleEdit = (sequence: Sequence) => {
    setEditingSequence(sequence);
    form.reset({
      id: sequence.id,
      name: sequence.name || '',
      document_type: sequence.document_type || 'invoice',
      pattern: sequence.pattern || '',
      current_counter: sequence.current_counter || 1,
      reset_period: sequence.reset_period || 'never',
      is_active: sequence.is_active ?? true,
    });
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
    try {
      await upsertSequence(values);
      toast({
        title: editingSequence ? t('toast.editSuccessTitle') : t('toast.createSuccessTitle'),
        description: t('toast.successDescription'),
      });
      setIsDialogOpen(false);
      loadSequences();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('toast.genericError');
      toast({
        variant: 'destructive',
        title: t('toast.errorTitle'),
        description: errorMessage,
      });
    }
  };

  const addToPattern = (variable: string) => {
    const currentPattern = form.getValues('pattern');
    const newPattern = currentPattern + variable;
    form.setValue('pattern', newPattern);
  };

  const documentType = form.watch('document_type');
  const pattern = form.watch('pattern');
  const preview = pattern && documentType ? previewPattern(pattern, documentType) : '';

  const sequencesColumns = SequencesColumnsWrapper({ onEdit: handleEdit, onDelete: handleDelete });

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <CardHeader className="flex-none">
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <DataTable
            columns={sequencesColumns}
            data={sequences}
            onCreate={handleCreate}
            onRefresh={loadSequences}
            isRefreshing={isRefreshing}
            manualPagination={true}
            pageCount={Math.ceil(total / pagination.pageSize)}
            pagination={pagination}
            onPaginationChange={setPagination}
            customToolbar={(table) => (
              <div className="flex flex-wrap items-center justify-between gap-4 w-full">
                {/* Search and Filters Section */}
                <div className="flex items-center space-x-2">
                  <div className="relative flex items-center">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t('filters.searchTermPlaceholder')}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="h-9 w-[200px] pl-9 pr-9"
                    />
                    {searchTerm.length > 0 && (
                      <Button
                        variant="ghost"
                        onClick={() => setSearchTerm('')}
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 hover:bg-transparent text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                        <span className="sr-only">Clear</span>
                      </Button>
                    )}
                  </div>

                  {/* Advanced Filters Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="flex items-center gap-2 h-9">
                        <Filter className="h-4 w-4" />
                        {t('filters.advancedFilters')}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-80">
                      <DropdownMenuLabel>{t('filters.advancedFilters')}</DropdownMenuLabel>
                      <DropdownMenuSeparator />

                      {/* Active Only Filter */}
                      <DropdownMenuCheckboxItem
                        checked={activeOnly}
                        onCheckedChange={setActiveOnly}
                      >
                        <div className="flex items-center space-x-2">
                          {activeOnly && <Check className="h-4 w-4" />}
                          <span>{t('filters.activeOnly')}</span>
                        </div>
                      </DropdownMenuCheckboxItem>

                      <DropdownMenuSeparator />

                      {/* Date Range Section */}
                      <div className="px-2 py-1">
                        <div className="text-xs font-medium text-muted-foreground mb-2">
                          {t('filters.dateRange')}
                        </div>
                        <div className="space-y-2">
                          <div>
                            <Label htmlFor="start-date" className="text-xs">{t('filters.startDate')}</Label>
                            <Input
                              id="start-date"
                              type="date"
                              value={dateRange.start_date || ''}
                              onChange={(e) => setDateRange(prev => ({ ...prev, start_date: e.target.value || null }))}
                              className="h-8"
                            />
                          </div>
                          <div>
                            <Label htmlFor="end-date" className="text-xs">{t('filters.endDate')}</Label>
                            <Input
                              id="end-date"
                              type="date"
                              value={dateRange.end_date || ''}
                              onChange={(e) => setDateRange(prev => ({ ...prev, end_date: e.target.value || null }))}
                              className="h-8"
                            />
                          </div>
                        </div>
                      </div>

                      <DropdownMenuSeparator />

                      {/* Apply Filters Button */}
                      <DropdownMenuItem asChild>
                        <Button onClick={loadSequences} className="w-full" size="sm">
                          {t('filters.applyFilters')}
                        </Button>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Buttons Section */}
                <div className="flex items-center gap-2">
                  <Button onClick={handleCreate} className="h-9">
                    <PlusCircle className="h-4 w-4" />
                    {t('createNew')}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={loadSequences}
                    disabled={isRefreshing}
                  >
                    <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    <span className="sr-only">{t('refresh')}</span>
                  </Button>
                </div>
              </div>
            )}
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
                          <SelectItem value="miscellaneous">{t('documentTypes.miscellaneous')}</SelectItem>
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
                      <Input
                        placeholder={t('createDialog.patternPlaceholder')}
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
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
                      onClick={() => addToPattern('{' + variable.key + '}')}
                      className="justify-start text-xs h-auto p-2"
                    >
                      <div>
                        <div className="font-mono">{'{' + variable.key + '}'}</div>
                        <div className="text-muted-foreground">
                          {variable.key.startsWith('COUNTER:')
                            ? t(`variables.COUNTER:${variable.key.split(':')[1]}`) || t(`variables.COUNTER:N`)
                            : t(`variables.${variable.key}`)
                          }
                        </div>
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
                          <SelectItem value="daily">{t('resetPeriods.daily')}</SelectItem>
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
    </div>
  );
}