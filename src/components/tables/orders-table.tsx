
'use client';

import * as React from 'react';
import { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Order, User, Quote } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '../ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { MoreHorizontal, AlertTriangle, ChevronsUpDown, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Calendar } from '../ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem, CommandList } from '../ui/command';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useTranslations } from 'next-intl';

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
  setRowSelection?: (selection: RowSelectionState) => void;
}

export function OrdersTable({ orders, isLoading = false, onRowSelectionChange, onRefresh, isRefreshing, onCreate, rowSelection, setRowSelection }: OrdersTableProps) {
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
                query: JSON.stringify({
                    order_id: parseInt(selectedOrderForInvoice.id, 10),
                    invoice_date: invoiceDate.toISOString(),
                }),
            };

            const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/order/invoice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const responseData = await response.json();
            if (!response.ok || responseData.error || (responseData.code && responseData.code >= 400)) {
                if (responseData.message) {
                     setInvoiceSubmissionError(responseData.message);
                     return;
                }
                throw new Error(responseData.message || tOrdersPage('invoiceDialog.createError'));
            }

            toast({
                title: tOrdersPage('invoiceDialog.invoiceSuccess'),
                description: tOrdersPage('invoiceDialog.invoiceSuccessDesc', { orderId: selectedOrderForInvoice.id }),
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
                if(onRowSelectionChange) {
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
        accessorKey: 'id',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={tOrderColumns('orderId')} />
        ),
      },
      {
        accessorKey: 'user_name',
        header: ({ column }) => <DataTableColumnHeader column={column} title={tUserColumns('name')} />,
      },
      {
        accessorKey: 'quote_id',
        header: ({ column }) => <DataTableColumnHeader column={column} title={tQuoteColumns('quoteId')} />,
      },
      {
        accessorKey: 'status',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={tUserColumns('status')} />
        ),
        cell: ({ row }) => {
          const status = row.getValue('status') as string;
          const variant = {
            completed: 'success',
            pending: 'info',
            processing: 'default',
            cancelled: 'destructive',
          }[status?.toLowerCase() ?? ''] ?? ('default' as any);
    
          return (
            <Badge variant={variant} className="capitalize">
              {tOrdersPage(status.toLowerCase() as any)}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'createdAt',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={tOrderColumns('createdAt')} />
        ),
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
  return (
    <>
    <Card>
      <CardContent className="p-4">
        <DataTable
          columns={columns}
          data={orders}
          filterColumnId="user_name"
          filterPlaceholder={tOrdersPage('filterPlaceholder')}
          onRowSelectionChange={onRowSelectionChange}
          enableSingleRowSelection={onRowSelectionChange ? true : false}
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
          onCreate={onCreate}
          rowSelection={rowSelection}
          setRowSelection={setRowSelection}
        />
      </CardContent>
    </Card>

    <Dialog open={isInvoiceDialogOpen} onOpenChange={setIsInvoiceDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
                <DialogTitle>{tOrdersPage('invoiceDialog.title')}</DialogTitle>
                <DialogDescription>
                   {tOrdersPage('invoiceDialog.description', { orderId: selectedOrderForInvoice?.id })}
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
    </>
  );
}

interface CreateOrderDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onOrderCreated: () => void;
}

export function CreateOrderDialog({ isOpen, onOpenChange, onOrderCreated }: CreateOrderDialogProps) {
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
          const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/users');
          if (response.ok) {
            const data = await response.json();
            const usersData = (Array.isArray(data) && data.length > 0) ? data[0].data : (data.data || []);
            setUsers(usersData);
          }
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
          const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/user_quotes?user_id=${selectedUserId}`);
          if (response.ok) {
            const data = await response.json();
            setQuotes(data || []);
          } else {
            setQuotes([]);
          }
        } catch (error) {
          console.error('Failed to fetch quotes', error);
          setQuotes([]);
        }
      };
      fetchQuotes();
      form.setValue('user_id', selectedUserId);
      form.setValue('quote_id', '');
    }
  }, [selectedUserId, form]);

  const onSubmit = async (values: OrderFormValues) => {
    try {
      const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/orders/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        throw new Error('Failed to create order');
      }
      toast({ title: 'Order Created', description: 'The new order has been created successfully.' });
      onOrderCreated();
      onOpenChange(false);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: error instanceof Error ? error.message : 'An error occurred.' });
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
                          {field.value ? users.find((user) => user.id === field.value)?.name : t('selectUser')}
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
                                key={user.id}
                                onSelect={() => {
                                  setSelectedUserId(user.id);
                                  setUserSearchOpen(false);
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", user.id === field.value ? "opacity-100" : "opacity-0")} />
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
                          {field.value ? `Quote #${field.value}` : t('selectQuote')}
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
                                value={quote.id}
                                key={quote.id}
                                onSelect={() => {
                                  form.setValue('quote_id', quote.id);
                                  setQuoteSearchOpen(false);
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", quote.id === field.value ? "opacity-100" : "opacity-0")} />
                                {`Quote #${quote.id} - $${quote.total}`}
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
