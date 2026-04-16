'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataCard } from '@/components/ui/data-card';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { DatePickerInput } from '@/components/ui/date-picker';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { TwoPanelLayout } from '@/components/layout/two-panel-layout';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { handleApiErrorEnhanced } from '@/lib/error-utils';
import { SEQUENCE_VARIABLES, previewPattern, validatePattern } from '@/lib/sequence-utils';
import { Sequence } from '@/lib/types';
import api from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Filter, List, Pencil, PlusCircle, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { ColumnDef, RowSelectionState } from '@tanstack/react-table';

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
        (responseData.status && responseData.status >= 400);

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
  const isNarrow = useViewportNarrow();
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

  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [selectedSequence, setSelectedSequence] = React.useState<Sequence | null>(null);

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

  const handleRowSelection = (rows: Sequence[]) => {
    setSelectedSequence(rows[0] ?? null);
  };

  const handleBack = () => {
    setSelectedSequence(null);
    setRowSelection({});
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
      if (selectedSequence?.id === deletingSequence.id) {
        setSelectedSequence(null);
        setRowSelection({});
      }
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

  const inlineColumns: ColumnDef<Sequence>[] = React.useMemo(() => [
    { accessorKey: 'id', header: ({ column }) => <DataTableColumnHeader column={column} title="ID" />, enableHiding: true },
    { accessorKey: 'name', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.name')} /> },
    { accessorKey: 'document_type', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.documentType')} /> },
    { accessorKey: 'pattern', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.pattern')} /> },
    { accessorKey: 'current_counter', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.currentCounter')} /> },
    { accessorKey: 'reset_period', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.resetPeriod')} /> },
    {
      accessorKey: 'is_active',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.isActive')} />,
      cell: ({ row }) => <Badge variant={row.original.is_active ? 'success' : 'secondary'}>{row.original.is_active ? 'Activo' : 'Inactivo'}</Badge>,
    },
  ], [t]);

  const leftPanel = (
    <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
      <CardHeader className="flex-none p-4">
        <div className="flex items-start gap-3">
          <div className="header-icon-circle mt-0.5">
            <List className="h-5 w-5" />
          </div>
          <div className="flex flex-col text-left">
            <CardTitle className="text-lg">{t('title')}</CardTitle>
            <CardDescription className="text-xs">{t('description')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 bg-card">
        <DataTable
          columns={inlineColumns}
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
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 hover:bg-transparent text-muted-foreground hover:text-foreground mr-1"
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
                            <DatePickerInput
                              value={dateRange.start_date || ''}
                              onChange={(value) => setDateRange(prev => ({ ...prev, start_date: value || null }))}
                              className="h-8"
                            />
                          </div>
                          <div>
                            <Label htmlFor="end-date" className="text-xs">{t('filters.endDate')}</Label>
                            <DatePickerInput
                              value={dateRange.end_date || ''}
                              onChange={(value) => setDateRange(prev => ({ ...prev, end_date: value || null }))}
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
            columnTranslations={{
              name: t('columns.name'),
              document_type: t('columns.documentType'),
              pattern: t('columns.pattern'),
              current_counter: t('columns.currentCounter'),
              reset_period: t('columns.resetPeriod'),
              is_active: t('columns.isActive'),
            }}
            isNarrow={isNarrow || !!selectedSequence}
            renderCard={(row: Sequence) => (
              <DataCard
                title={row.name}
                subtitle={row.pattern}
                badge={<span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">{row.document_type}</span>}
                showArrow
              />
            )}
            enableSingleRowSelection
            rowSelection={rowSelection}
            setRowSelection={setRowSelection}
            onRowSelectionChange={handleRowSelection}
            columnVisibility={{ id: false }}
          />
        </CardContent>
      </Card>
  );

  const rightPanel = selectedSequence ? (
    <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
      <CardHeader className="flex-none p-4 pb-2 space-y-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="header-icon-circle flex-none"><List className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base lg:text-lg truncate">{selectedSequence.name}</CardTitle>
            <p className="text-xs text-muted-foreground truncate">{selectedSequence.document_type}</p>
          </div>
          <div className="flex gap-1 flex-none">
            <Button size="sm" variant="outline" onClick={() => handleEdit(selectedSequence)}>
              <Pencil className="h-4 w-4 mr-1" />Editar
            </Button>
            <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => handleDelete(selectedSequence)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="flex-1 overflow-auto p-4">
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{t('columns.name')}</dt>
            <dd className="text-foreground">{selectedSequence.name || '-'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{t('columns.documentType')}</dt>
            <dd><Badge variant="outline">{selectedSequence.document_type}</Badge></dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{t('columns.pattern')}</dt>
            <dd><code className="text-xs bg-muted px-2 py-1 rounded font-mono">{selectedSequence.pattern || '-'}</code></dd>
          </div>
          {selectedSequence.preview_example && (
            <div>
              <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{t('createDialog.previewExample')}</dt>
              <dd><code className="text-xs bg-muted px-2 py-1 rounded font-mono font-bold">{selectedSequence.preview_example}</code></dd>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{t('columns.currentCounter')}</dt>
              <dd className="text-foreground">{selectedSequence.current_counter}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{t('columns.resetPeriod')}</dt>
              <dd className="text-foreground">{selectedSequence.reset_period}</dd>
            </div>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{t('columns.isActive')}</dt>
            <dd><Badge variant={selectedSequence.is_active ? 'success' : 'secondary'}>{selectedSequence.is_active ? 'Activo' : 'Inactivo'}</Badge></dd>
          </div>
          {selectedSequence.created_at && (
            <div>
              <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">Creado</dt>
              <dd className="text-foreground text-xs">{selectedSequence.created_at}</dd>
            </div>
          )}
        </dl>
      </CardContent>
    </Card>
  ) : <div />;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <TwoPanelLayout
        leftPanel={leftPanel}
        rightPanel={rightPanel}
        isRightPanelOpen={!!selectedSequence}
        onBack={handleBack}
        leftPanelDefaultSize={50}
        rightPanelDefaultSize={50}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingSequence ? t('createDialog.editTitle') : t('createDialog.title')}</DialogTitle>
            <DialogDescription>
              {editingSequence ? t('createDialog.editDescription') : t('createDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
              <DialogBody className="space-y-4 py-4 px-6">

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="mb-0">
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
                      <FormItem className="mb-0">
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
                    <FormItem className="mb-0">
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

                {preview && (
                  <Alert className="py-2 flex items-center justify-center">
                    <AlertDescription className="text-xs p-0 pl-0 translate-y-0">
                      {t('createDialog.previewExample')}
                      <code className="bg-muted px-2 py-0.5 rounded mx-1 font-bold">{preview}</code>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('createDialog.variables')}</Label>
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
                        <div className="flex flex-col items-start text-left">
                          <div className="font-mono font-bold text-primary">{'{' + variable.key + '}'}</div>
                          <div className="text-[10px] text-muted-foreground leading-tight">
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

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="current_counter"
                    render={({ field }) => (
                      <FormItem className="mb-0">
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
                      <FormItem className="mb-0">
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
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 mb-0">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm font-bold">{t('createDialog.isActive')}</FormLabel>
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
              </DialogBody>

              <DialogFooter>
                <Button type="submit">
                  {editingSequence ? t('createDialog.editSave') : t('createDialog.save')}
                </Button>
                <Button variant="outline" type="button" onClick={() => setIsDialogOpen(false)}>
                  {t('createDialog.cancel')}
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
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
              {t('deleteDialog.confirm')}
            </AlertDialogAction>
            <AlertDialogCancel>{t('deleteDialog.cancel')}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
