
'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { Order, Quote, User } from '@/lib/types';
import { cn, formatDateTime } from '@/lib/utils';
import { api } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { AlertTriangle, Check, ChevronsUpDown, MoreHorizontal } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import * as React from 'react';
import { DataTableAdvancedToolbar } from '../ui/data-table-advanced-toolbar';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Calendar } from '../ui/calendar';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Skeleton } from '../ui/skeleton';

const orderFormSchema = (t: (key: string) => string) => z.object({
  user_id: z.string().min(1, 'User is required'),
  quote_id: z.string().min(1, 'Quote is required'),
  status: z.enum(['pending', 'processing', 'completed', 'cancelled']),
});

type OrderFormValues = z.infer<ReturnType<typeof orderFormSchema>>;

interface OrdersTableProps {
  orders: Order[];
  isLoading?: boolean;
  onRowSelectionChange?: (selectedRows: Order[]) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onCreate?: () => void;
  rowSelection?: RowSelectionState;
  setRowSelection?: React.Dispatch<React.SetStateAction<RowSelectionState>>;
  columnTranslations?: { [key: string]: string };
  columnsToHide?: string[];
  isSales?: boolean;
  className?: string;
  isCompact?: boolean;
  title?: string;
  description?: string;
  standalone?: boolean;
}

export function OrdersTable({ orders, isLoading = false, onRowSelectionChange, onRefresh, isRefreshing, onCreate, rowSelection, setRowSelection, columnTranslations, columnsToHide = [], isSales = true, className, isCompact = false, title, description, standalone = false }: OrdersTableProps) {
  const t = useTranslations();
  const tOrderColumns = useTranslations('OrderColumns');
  const tUserColumns = useTranslations('UserColumns');
  const tQuoteColumns = useTranslations('QuoteColumns');
  const tOrdersPage = useTranslations('OrdersPage');
  const { toast } = useToast();
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = React.useState(false);
  const [selectedOrderForInvoice, setSelectedOrderForInvoice] = React.useState<Order | null>(null);
  const [invoiceDate, setInvoiceDate] = React.useState<Date | undefined>(new Date());
  const [invoiceSubmissionError, setInvoiceSubmissionError] = React.useState<string | null>(null);
  const locale = useLocale();

  const handleInvoiceClick = (order: Order) => {
    setSelectedOrderForInvoice(order);
    setInvoiceDate(new Date());
    setInvoiceSubmissionError(null);
    setIsInvoiceDialogOpen(true);
  };

  const handleConfirmInvoice = async () => {
    if (!selectedOrderForInvoice || !invoiceDate) return;
    setInvoiceSubmissionError(null);
    try {
      const payload = {
        order_id: selectedOrderForInvoice.id,
        is_sales: isSales,
        query: JSON.stringify({
          order_id: parseInt(selectedOrderForInvoice.id, 10),
          invoice_date: invoiceDate.toISOString(),
          is_sales: isSales,
          user_id: selectedOrderForInvoice.user_id,
        }),
      };

      const apiRoute = isSales ? API_ROUTES.SALES.ORDER_INVOICE : API_ROUTES.PURCHASES.ORDER_INVOICE;
      const responseData = await api.post(apiRoute, payload);
      if (responseData.error || (responseData.code && responseData.code >= 400)) {
        if (responseData.message) {
          setInvoiceSubmissionError(responseData.message);
          return;
        }
        throw new Error(tOrdersPage('invoiceDialog.createError'));
      }

      toast({
        title: tOrdersPage('invoiceDialog.invoiceSuccess'),
        description: tOrdersPage('invoiceDialog.invoiceSuccessDesc', { orderId: selectedOrderForInvoice.doc_no }),
      });

      if (onRefresh) {
        onRefresh();
      }
      setIsInvoiceDialogOpen(false);
      setSelectedOrderForInvoice(null);

    } catch (error) {
      setInvoiceSubmissionError(error instanceof Error ? error.message : tOrdersPage('invoiceDialog.createError'));
    }
  };

  const columns: ColumnDef<Order>[] = [
    {
      id: 'select',
      header: () => null,
      cell: ({ row, table }) => {
        const isSelected = row.getIsSelected();
        return (
          <RadioGroup
            value={isSelected ? row.id : ''}
            onValueChange={() => {
              if (onRowSelectionChange) {
                table.toggleAllPageRowsSelected(false);
                row.toggleSelected(true);
              }
            }}
          >
            <RadioGroupItem value={row.id} id={row.id} aria-label="Select row" />
          </RadioGroup>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'doc_no',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={tOrderColumns('orderId')} />
      ),
      cell: ({ row }) => row.original.doc_no || `ORD-${row.original.id}`,
    },
    {
      accessorKey: 'user_name',
      header: ({ column }) => <DataTableColumnHeader column={column} title={tUserColumns('name')} />,
    },
    {
      accessorKey: 'quote_doc_no',
      header: ({ column }) => <DataTableColumnHeader column={column} title={tQuoteColumns('quoteDocNo')} />,
    },
    {
      accessorKey: 'currency',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('QuoteColumns.currency')} />
      ),
      cell: ({ row }) => row.original.currency || 'N/A',
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={tUserColumns('status')} />
      ),
      cell: ({ row }) => {
        const status = (row.getValue('status') as string) || '';
        let normalizedStatus = status.toLowerCase();
        if (normalizedStatus === 'in progress') {
          normalizedStatus = 'processing';
        }
        const variant = {
          completed: 'success',
          pending: 'info',
          processing: 'default',
          cancelled: 'destructive',
        }[normalizedStatus] ?? ('default' as any);

        return (
          <Badge variant={variant} className="capitalize">
            {tOrdersPage(`status.${normalizedStatus}` as any)}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={tOrderColumns('createdAt')} />
      ),
      cell: ({ row }) => formatDateTime(row.original.createdAt),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const order = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{tUserColumns('actions')}</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleInvoiceClick(order)}>
                {t('Navigation.Invoices')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      }
    }
  ];

  if (isLoading) {
    return (
      <div className="space-y-4 pt-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }
  const filteredColumns = columns.filter(col => {
    const key = (col as any).accessorKey;
    return !key || !columnsToHide.includes(key);
  });

  // Check if doc_no column exists in filtered columns, otherwise use the first available column
  const availableFilterColumns = filteredColumns
    .map(col => (col as any).accessorKey)
    .filter(key => key);
  const filterColumnId = availableFilterColumns.includes('doc_no') ? 'doc_no' : (availableFilterColumns[0] || '');

  return (
    <div className={cn("h-full flex-1 flex flex-col min-h-0", className)}>
      <Card className="h-full flex-1 flex flex-col min-h-0">
        {title && (
          <CardHeader className="flex-none p-4 pb-0">
            <CardTitle className="text-lg lg:text-xl">{title}</CardTitle>
            {description && <CardDescription className="text-xs">{description}</CardDescription>}
          </CardHeader>
        )}
        <CardContent className="flex-1 flex flex-col min-h-0 p-4 overflow-hidden">
          <DataTable
            columns={filteredColumns}
            data={orders}
            filterColumnId={filterColumnId}
            onRowSelectionChange={onRowSelectionChange}
            enableSingleRowSelection={onRowSelectionChange ? true : false}
            onRefresh={onRefresh}
            isRefreshing={isRefreshing}
            onCreate={onCreate}
            rowSelection={rowSelection}
            setRowSelection={setRowSelection}
            customToolbar={standalone ? (table) => (
              <DataTableAdvancedToolbar
                table={table}
                isCompact={isCompact}
                filterPlaceholder={tOrdersPage('filterPlaceholder')}
                searchQuery={(table.getState().columnFilters.find((f: any) => f.id === filterColumnId)?.value as string) || ''}
                onSearchChange={(value) => {
                  table.setColumnFilters((prev: any) => {
                    const newFilters = prev.filter((f: any) => f.id !== filterColumnId);
                    if (value) {
                      newFilters.push({ id: filterColumnId, value });
                    }
                    return newFilters;
                  });
                }}
                onCreate={onCreate}
                onRefresh={onRefresh}
                isRefreshing={isRefreshing}
                columnTranslations={{
                  doc_no: tOrderColumns('orderId'),
                  user_name: tUserColumns('name'),
                  quote_id: tQuoteColumns('quoteId'),
                  currency: t('QuoteColumns.currency'),
                  status: tUserColumns('status'),
                  createdAt: tOrderColumns('createdAt'),
                }}
              />
            ) : undefined}
            columnTranslations={{
              doc_no: tOrderColumns('orderId'),
              user_name: tUserColumns('name'),
              quote_id: tQuoteColumns('quoteId'),
              currency: t('QuoteColumns.currency'),
              status: tUserColumns('status'),
              createdAt: tOrderColumns('createdAt'),
            }}
          />
        </CardContent>
      </Card>

      <Dialog open={isInvoiceDialogOpen} onOpenChange={setIsInvoiceDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{tOrdersPage('invoiceDialog.title')}</DialogTitle>
            <DialogDescription>
              {tOrdersPage('invoiceDialog.description', { orderId: selectedOrderForInvoice?.doc_no })}
            </DialogDescription>
          </DialogHeader>
          {invoiceSubmissionError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{tOrdersPage('invoiceDialog.error')}</AlertTitle>
              <AlertDescription>{invoiceSubmissionError}</AlertDescription>
            </Alert>
          )}
          <div className="flex justify-center py-4">
            <Calendar
              mode="single"
              selected={invoiceDate}
              onSelect={setInvoiceDate}
              initialFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInvoiceDialogOpen(false)}>{tOrdersPage('cancel')}</Button>
            <Button onClick={handleConfirmInvoice}>{tOrdersPage('invoiceDialog.confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface CreateOrderDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onOrderCreated: () => void;
  isSales?: boolean;
}

export function CreateOrderDialog({ isOpen, onOpenChange, onOrderCreated, isSales = true }: CreateOrderDialogProps) {
  const t = useTranslations('OrdersPage');
  const [users, setUsers] = React.useState<User[]>([]);
  const [quotes, setQuotes] = React.useState<Quote[]>([]);
  const [selectedUserId, setSelectedUserId] = React.useState<string | null>(null);
  const [isUserSearchOpen, setUserSearchOpen] = React.useState(false);
  const [isQuoteSearchOpen, setQuoteSearchOpen] = React.useState(false);
  const { toast } = useToast();

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema(t)),
    defaultValues: {
      status: 'pending',
    },
  });

  React.useEffect(() => {
    if (isOpen) {
      const fetchUsers = async () => {
        try {
          const data = await api.get(API_ROUTES.USERS);
          const usersData = (Array.isArray(data) && data.length > 0) ? data[0].data : (data.data || []);
          setUsers(usersData);
        } catch (error) {
          console.error('Failed to fetch users', error);
        }
      };
      fetchUsers();
    }
  }, [isOpen]);

  React.useEffect(() => {
    if (selectedUserId) {
      const fetchQuotes = async () => {
        try {
          const data = await api.get(API_ROUTES.USER_QUOTES, { user_id: selectedUserId });
          setQuotes(data || []);
        } catch (error) {
          console.error('Failed to fetch quotes', error);
          setQuotes([]);
        }
      };
      fetchQuotes();
      form.setValue('user_id', selectedUserId || '');
      form.setValue('quote_id', '');
    }
  }, [selectedUserId, form]);

  const onSubmit = async (values: OrderFormValues) => {
    try {
      const apiRoute = isSales ? API_ROUTES.SALES.ORDERS_UPSERT : API_ROUTES.PURCHASES.ORDERS_UPSERT;
      await api.post(apiRoute, values);
      toast({ title: t('createSuccess'), description: t('createSuccessDesc') });
      onOrderCreated();
      onOpenChange(false);
    } catch (error) {
      toast({ variant: 'destructive', title: t('createError'), description: error instanceof Error ? error.message : t('createErrorDesc') });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('createTitle')}</DialogTitle>
          <DialogDescription>{t('createDescription')}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="user_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('selectUser')}</FormLabel>
                  <Popover open={isUserSearchOpen} onOpenChange={setUserSearchOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")}>
                          {field.value ? users.find((user) => String(user.id) === field.value)?.name : t('selectUser')}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command>
                        <CommandInput placeholder={t('searchUser')} />
                        <CommandList>
                          <CommandEmpty>{t('noUserFound')}</CommandEmpty>
                          <CommandGroup>
                            {users.map((user) => (
                              <CommandItem
                                value={user.name}
                                key={String(user.id)}
                                onSelect={() => {
                                  setSelectedUserId(String(user.id));
                                  setUserSearchOpen(false);
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", String(user.id) === field.value ? "opacity-100" : "opacity-0")} />
                                {user.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="quote_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('selectQuote')}</FormLabel>
                  <Popover open={isQuoteSearchOpen} onOpenChange={setQuoteSearchOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant="outline" role="combobox" disabled={!selectedUserId} className={cn("w-full justify-between", !field.value && "text-muted-foreground")}>
                          {field.value ? quotes.find((quote) => String(quote.id) === field.value)?.doc_no || `Quote #${field.value}` : t('selectQuote')}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command>
                        <CommandInput placeholder={t('searchQuote')} />
                        <CommandList>
                          <CommandEmpty>{t('noQuoteFound')}</CommandEmpty>
                          <CommandGroup>
                            {quotes.map((quote) => (
                              <CommandItem
                                value={String(quote.id)}
                                key={String(quote.id)}
                                onSelect={() => {
                                  form.setValue('quote_id', String(quote.id));
                                  setQuoteSearchOpen(false);
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", String(quote.id) === field.value ? "opacity-100" : "opacity-0")} />
                                {`${quote.doc_no || `Quote #${quote.id}`} - $${quote.total}`}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('status.label')}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('status.select')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="pending">{t('status.pending')}</SelectItem>
                      <SelectItem value="processing">{t('status.processing')}</SelectItem>
                      <SelectItem value="completed">{t('status.completed')}</SelectItem>
                      <SelectItem value="cancelled">{t('status.cancelled')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('cancel')}</Button>
              <Button type="submit">{t('create')}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
