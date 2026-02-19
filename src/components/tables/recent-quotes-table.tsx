'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { Quote } from '@/lib/types';
import { cn, formatDateTime, getDocumentFileName } from '@/lib/utils';
import { api } from '@/services/api';
import { ColumnDef, ColumnFiltersState, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, RowSelectionState, SortingState, useReactTable } from '@tanstack/react-table';
import { MoreHorizontal, Printer, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { DocumentTextIcon } from '../icons/document-text-icon';
import { DataTableAdvancedToolbar } from '../ui/data-table-advanced-toolbar';
import { DataTablePagination } from '../ui/data-table-pagination';
import { DataTableToolbar } from '../ui/data-table-toolbar';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

const getColumns = (
  t: (key: string) => string,
  onEdit: (quote: Quote) => void,
  onDelete: (quote: Quote) => void,
  onQuoteAction: (quote: Quote, action: 'confirm' | 'reject') => void,
  onPrint: (quote: Quote) => void,
  onSendEmail: (quote: Quote) => void
): ColumnDef<Quote>[] => [
    {
      accessorKey: 'doc_no',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('OrderColumns.orderId')} />
      ),
      size: 50,
    },
    {
      id: 'select',
      header: () => null,
      cell: ({ row, table }) => {
        const isSelected = row.getIsSelected();
        return (
          <RadioGroup
            value={isSelected ? row.id : ''}
            onValueChange={() => {
              table.toggleAllPageRowsSelected(false);
              row.toggleSelected(true);
            }}
          >
            <RadioGroupItem value={row.id} id={row.id} aria-label="Select row" />
          </RadioGroup>
        );
      },
      enableSorting: false,
      enableHiding: false,
      size: 20,
    },
    {
      accessorKey: 'user_name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('UserColumns.name')} />
      ),
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('QuoteColumns.createdAt')} />
      ),
      cell: ({ row }) => formatDateTime(row.original.createdAt),
    },
    {
      accessorKey: 'total',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('QuoteColumns.total')} />
      ),
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue('total'));
        const roundedAmount = Math.round(amount * 100) / 100;
        const formatted = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: row.original.currency || 'USD',
        }).format(roundedAmount);
        return <div className="font-medium">{formatted}</div>;
      },
    },
    {
      accessorKey: 'currency',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('QuoteColumns.currency')} />
      ),
      cell: ({ row }) => row.original.currency || 'N/A',
    },
    {
      accessorKey: 'exchange_rate',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('QuoteColumns.exchangeRate')} />
      ),
      cell: ({ row }) => {
        const rate = row.original.exchange_rate;
        return rate ? <div className="font-medium">{rate.toFixed(4)}</div> : <div className="text-muted-foreground">-</div>;
      },
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('UserColumns.status')} />
      ),
      cell: ({ row }) => {
        const status = (row.getValue('status') as string) || '';
        const variant = {
          accepted: 'success',
          confirmed: 'success',
          sent: 'default',
          pending: 'info',
          draft: 'outline',
          rejected: 'destructive',
        }[status.toLowerCase()] ?? ('default' as any);

        const translationKey = `QuotesPage.quoteDialog.${status.toLowerCase()}`;
        const translatedStatus = t(translationKey as any);

        return (
          <Badge variant={variant} className="capitalize">
            {translatedStatus === translationKey ? status : translatedStatus}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'billing_status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('QuoteColumns.billingStatus')} />
      ),
      cell: ({ row }) => {
        const status = (row.getValue('billing_status') as string) || '';

        const statusKeyMap: { [key: string]: string } = {
          'invoiced': 'invoiced',
          'partially invoiced': 'partiallyInvoiced',
          'not invoiced': 'notInvoiced',
          'partially_invoiced': 'partially_invoiced',
          'not_invoiced': 'not_invoiced',
        };
        const variantMap: { [key: string]: any } = {
          'invoiced': 'success',
          'partially invoiced': 'info',
          'not invoiced': 'outline',
          'partially_invoiced': 'info',
          'not_invoiced': 'outline',
        };

        const normalizedStatus = status.toLowerCase();
        const translationKey = `QuotesPage.quoteDialog.${statusKeyMap[normalizedStatus] || normalizedStatus.replace(/\s+/g, '_')}`;
        const translatedStatus = t(translationKey as any);

        return (
          <Badge variant={variantMap[normalizedStatus] ?? 'default'} className="capitalize">
            {translatedStatus === translationKey ? status : translatedStatus}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'payment_status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Navigation.Payments')} />
      ),
      cell: ({ row }) => {
        const status = (row.getValue('payment_status') as string) || '';
        const variant = {
          paid: 'success',
          partial: 'info',
          unpaid: 'outline',
          partially_paid: 'info',
          'not invoiced': 'outline',
          'not_invoiced': 'outline',
        }[status.toLowerCase()] ?? ('default' as any);

        const statusKeyMap: { [key: string]: string } = {
          'partially_paid': 'partiallyPaid',
          'unpaid': 'unpaid',
          'not_paid': 'not_paid',
          'paid': 'paid',
          'partial': 'partial',
          'not invoiced': 'notInvoiced',
          'not_invoiced': 'not_invoiced',
        };

        const normalizedStatus = status.toLowerCase();
        const translationKey = `QuotesPage.quoteDialog.${statusKeyMap[normalizedStatus] || normalizedStatus.replace(/\s+/g, '_')}`;
        const translatedStatus = t(translationKey as any);

        return (
          <Badge variant={variant} className="capitalize">
            {translatedStatus === translationKey ? status : translatedStatus}
          </Badge>
        );
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const t = useTranslations('UserColumns');
        const tQuotes = useTranslations('QuotesPage');
        const quote = row.original;
        const status = (quote.status || '').toLowerCase();
        const isDraft = status === 'draft';
        const isPending = status === 'pending';

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{tQuotes('itemDialog.actions')}</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onPrint(quote)}>
                <Printer className="mr-2 h-4 w-4" />
                <span>{tQuotes('print')}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSendEmail(quote)}>
                <Send className="mr-2 h-4 w-4" />
                <span>{tQuotes('sendEmail')}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onEdit(quote)} disabled={!isDraft}>
                {tQuotes('edit')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete(quote)} className="text-destructive" disabled={!isDraft}>
                {tQuotes('delete')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onQuoteAction(quote, 'confirm')} disabled={!isDraft && !isPending}>
                {tQuotes('confirm')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onQuoteAction(quote, 'reject')} className="text-destructive" disabled={!isDraft && !isPending}>
                {tQuotes('reject')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];


interface RecentQuotesTableProps {
  quotes: Quote[];
  onRowSelectionChange?: (selectedRows: Quote[]) => void;
  onCreate?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  rowSelection?: RowSelectionState;
  setRowSelection?: React.Dispatch<React.SetStateAction<RowSelectionState>>;
  onEdit?: (quote: Quote) => void;
  onDelete?: (quote: Quote) => void;
  onQuoteAction?: (quote: Quote, action: 'confirm' | 'reject') => void;
  className?: string;
  isCompact?: boolean;
  title?: string;
  description?: string;
  standalone?: boolean;
}

export function RecentQuotesTable({
  quotes,
  onRowSelectionChange,
  onCreate,
  onRefresh,
  isRefreshing,
  rowSelection,
  setRowSelection,
  onEdit = () => { },
  onDelete = () => { },
  onQuoteAction = () => { },
  className,
  isCompact = false,
  title,
  description,
  standalone = false,
}: RecentQuotesTableProps) {
  const t = useTranslations();
  const { toast } = useToast();
  const [isSendEmailDialogOpen, setIsSendEmailDialogOpen] = React.useState(false);
  const [selectedQuoteForEmail, setSelectedQuoteForEmail] = React.useState<Quote | null>(null);
  const [emailRecipients, setEmailRecipients] = React.useState('');

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

  const handlePrintQuote = async (quote: Quote) => {
    const fileName = getDocumentFileName(quote, 'quote');
    toast({
      title: t('QuotesPage.generatingPdf'),
      description: t('QuotesPage.pleaseWait', { id: fileName }),
    });

    try {
      const blob = await api.getBlob(API_ROUTES.PURCHASES.QUOTES_PRINT, { quoteId: quote.id.toString() });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      toast({
        title: t('QuotesPage.downloadStarted'),
        description: t('QuotesPage.pdfDownloading', { id: fileName }),
      });

    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('QuotesPage.printError'),
        description: error instanceof Error ? error.message : t('QuotesPage.couldNotPrint'),
      });
    }
  };

  const handleSendEmailClick = (quote: Quote) => {
    setSelectedQuoteForEmail(quote);
    setEmailRecipients(quote.userEmail || '');
    setIsSendEmailDialogOpen(true);
  };

  const handleConfirmSendEmail = async () => {
    if (!selectedQuoteForEmail) return;

    const emails = emailRecipients.split(',').map(email => email.trim()).filter(email => email);
    if (emails.length === 0) {
      toast({ variant: 'destructive', title: t('QuotesPage.emailError'), description: t('QuotesPage.atLeastOneEmail') });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = emails.filter(email => !emailRegex.test(email));

    if (invalidEmails.length > 0) {
      toast({
        variant: 'destructive',
        title: t('QuotesPage.invalidEmail'),
        description: t('QuotesPage.invalidEmails', { emails: invalidEmails.join(', ') }),
      });
      return;
    }


    try {
      await api.post(API_ROUTES.PURCHASES.QUOTES_SEND, { quoteId: selectedQuoteForEmail.id, emails });

      toast({
        title: t('QuotesPage.emailSent'),
        description: t('QuotesPage.emailSentSuccess', { emails: emails.join(', ') }),
      });

      setIsSendEmailDialogOpen(false);

    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('QuotesPage.emailError'),
        description: error instanceof Error ? error.message : t('QuotesPage.unexpectedError'),
      });
    }
  };

  const columns = React.useMemo(() => getColumns(t, onEdit, onDelete, onQuoteAction, handlePrintQuote, handleSendEmailClick), [t, onEdit, onDelete, onQuoteAction]);

  const table = useReactTable({
    data: quotes,
    columns,
    state: {
      sorting,
      columnFilters,
      rowSelection: rowSelection ?? {},
    },
    enableRowSelection: true,
    enableMultiRowSelection: !true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  React.useEffect(() => {
    if (onRowSelectionChange) {
      const selectedRows = table.getFilteredSelectedRowModel().rows.map(row => row.original);
      onRowSelectionChange(selectedRows);
    }
  }, [rowSelection, table, onRowSelectionChange]);


  const columnTranslations = {
    id: t('QuoteColumns.quoteId'),
    user_name: t('UserColumns.name'),
    createdAt: t('QuoteColumns.createdAt'),
    total: t('QuoteColumns.total'),
    currency: t('QuoteColumns.currency'),
    exchange_rate: t('QuoteColumns.exchangeRate'),
    status: t('UserColumns.status'),
    billing_status: t('QuoteColumns.billingStatus'),
    payment_status: t('Navigation.Payments'),
  };

  return (
    <>
      <Card className={cn("h-full flex-1 flex flex-col min-h-0", className)}>
        {title && (
          <CardHeader className="flex-none p-6 pb-0">
            <div className="flex items-center gap-2">
              <DocumentTextIcon className="h-6 w-6 text-amber-500" />
              <CardTitle className="text-lg lg:text-xl">{title}</CardTitle>
            </div>
            {description && <CardDescription className="text-xs">{description}</CardDescription>}
          </CardHeader>
        )}
        <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden pt-4">
          <div className="flex flex-col flex-1 min-h-0 space-y-4 overflow-hidden">
            {standalone ? (
              <DataTableAdvancedToolbar
                table={table}
                isCompact={isCompact}
                filterPlaceholder={t('RecentQuotesTable.filterPlaceholder')}
                searchQuery={(columnFilters.find(f => f.id === 'user_name')?.value as string) || ''}
                onSearchChange={(value) => {
                  setColumnFilters((prev) => {
                    const newFilters = prev.filter((f) => f.id !== 'user_name');
                    if (value) {
                      newFilters.push({ id: 'user_name', value });
                    }
                    return newFilters;
                  });
                }}
                onCreate={onCreate}
                onRefresh={onRefresh}
                isRefreshing={isRefreshing}
                columnTranslations={columnTranslations}
              />
            ) : (
              <DataTableToolbar
                table={table}
                filterColumnId="user_name"
                filterPlaceholder={t('RecentQuotesTable.filterPlaceholder')}
                onRefresh={onRefresh}
                isRefreshing={isRefreshing}
                onCreate={onCreate}
                columnTranslations={columnTranslations}
              />
            )}
            <div className="rounded-md border overflow-auto flex-1 min-h-0 relative">
              <table className={cn("w-full caption-bottom text-sm")}>
                <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_hsl(var(--border))]">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => {
                        return (
                          <TableHead key={header.id} style={{ width: header.getSize() !== 150 ? `${header.getSize()}px` : undefined }}>
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                          </TableHead>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() && 'selected'}
                        onClick={() => {
                          if (onRowSelectionChange) {
                            table.toggleAllPageRowsSelected(false);
                            row.toggleSelected(true);
                          }
                        }}
                        className={onRowSelectionChange ? 'cursor-pointer' : ''}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length}
                        className="h-24 text-center"
                      >
                        {t('General.noResults')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </table>
            </div>
            <div className="flex-none">
              <DataTablePagination table={table} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isSendEmailDialogOpen} onOpenChange={setIsSendEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('QuotesPage.sendEmailDialog.title')}</DialogTitle>
            <DialogDescription>{t('QuotesPage.sendEmailDialog.description', { id: selectedQuoteForEmail?.doc_no || selectedQuoteForEmail?.id })}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="email-recipients">{t('QuotesPage.sendEmailDialog.recipients')}</Label>
            <Input
              id="email-recipients"
              value={emailRecipients}
              onChange={(e) => setEmailRecipients(e.target.value)}
              placeholder={t('QuotesPage.sendEmailDialog.placeholder')}
            />
            <p className="text-sm text-muted-foreground mt-1">{t('QuotesPage.sendEmailDialog.helperText')}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSendEmailDialogOpen(false)}>{t('QuotesPage.quoteDialog.cancel')}</Button>
            <Button onClick={handleConfirmSendEmail}>{t('QuotesPage.sendEmail')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
