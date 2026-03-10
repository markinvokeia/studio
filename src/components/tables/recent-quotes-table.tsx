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
import { checkPreferencesByEmails, getDisabledEmails } from '@/hooks/use-communication-preferences';
import { Quote } from '@/lib/types';
import { cn, formatDateTime, getDocumentFileName } from '@/lib/utils';
import { api } from '@/services/api';
import { ColumnDef, ColumnFiltersState, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, RowSelectionState, SortingState, useReactTable } from '@tanstack/react-table';
import { Loader2, MoreHorizontal, Printer, Send, Edit3, Trash2, Check, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { DocumentTextIcon } from '../icons/document-text-icon';
import { DataTableAdvancedToolbar } from '../ui/data-table-advanced-toolbar';
import { DataTablePagination } from '../ui/data-table-pagination';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { CommunicationWarningDialog } from '@/components/communication-warning-dialog';

const getColumns = (
  t: any,
  tQuotes: any,
  onRowSelectionChange?: (selectedRows: Quote[]) => void,
  onPrint?: (quote: Quote) => void,
  onSendEmail?: (quote: Quote) => void
): ColumnDef<Quote>[] => [
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
              if (onRowSelectionChange) {
                onRowSelectionChange([row.original]);
              }
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
      accessorKey: 'doc_no',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('OrderColumns.orderId')} />
      ),
      size: 50,
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

        const translatedStatus = tQuotes(`quoteDialog.${status.toLowerCase()}` as any);

        return (
          <Badge variant={variant} className="capitalize">
            {translatedStatus}
          </Badge>
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
  isSendingEmail?: boolean;
  setIsSendingEmail?: (sending: boolean) => void;
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
  isSendingEmail = false,
  setIsSendingEmail,
}: RecentQuotesTableProps) {
  const t = useTranslations();
  const tQuotes = useTranslations('QuotesPage');
  const { toast } = useToast();
  const [isSendEmailDialogOpen, setIsSendEmailDialogOpen] = React.useState(false);
  const [selectedQuoteForEmail, setSelectedQuoteForEmail] = React.useState<Quote | null>(null);
  const [emailRecipients, setEmailRecipients] = React.useState('');
  const [isWarningDialogOpen, setIsWarningDialogOpen] = React.useState(false);
  const [disabledEmails, setDisabledEmails] = React.useState<string[]>([]);

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

  const handlePrintQuote = React.useCallback(async (quote: Quote) => {
    const fileName = getDocumentFileName(quote, 'quote');
    toast({
      title: tQuotes('generatingPdf'),
      description: tQuotes('pleaseWait', { id: fileName }),
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
        title: tQuotes('downloadStarted'),
        description: tQuotes('pdfDownloading', { id: fileName }),
      });

    } catch (error) {
      toast({
        variant: 'destructive',
        title: tQuotes('printError'),
        description: error instanceof Error ? error.message : tQuotes('couldNotPrint'),
      });
    }
  }, [tQuotes, toast]);

  const handleSendEmailClick = React.useCallback((quote: Quote) => {
    setSelectedQuoteForEmail(quote);
    setEmailRecipients(quote.userEmail || '');
    setIsSendEmailDialogOpen(true);
  }, []);

  const columns = React.useMemo(() => getColumns(t, tQuotes, onRowSelectionChange, handlePrintQuote, handleSendEmailClick), [t, tQuotes, onRowSelectionChange, handlePrintQuote, handleSendEmailClick]);

  const table = useReactTable({
    data: quotes,
    columns,
    state: {
      sorting,
      columnFilters,
      rowSelection: rowSelection ?? {},
    },
    enableRowSelection: true,
    enableMultiRowSelection: false,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const selectedQuote = React.useMemo(() => {
    const rows = table.getFilteredSelectedRowModel().rows;
    return rows.length > 0 ? rows[0].original : null;
  }, [rowSelection, quotes]);

  const handleConfirmSendEmail = async () => {
    if (!selectedQuoteForEmail) return;

    const emails = emailRecipients.split(',').map(email => email.trim()).filter(email => email);
    if (emails.length === 0) {
      toast({ variant: 'destructive', title: tQuotes('emailError'), description: tQuotes('atLeastOneEmail') });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = emails.filter(email => !emailRegex.test(email));

    if (invalidEmails.length > 0) {
      toast({
        variant: 'destructive',
        title: tQuotes('invalidEmail'),
        description: tQuotes('invalidEmails', { emails: invalidEmails.join(', ') }),
      });
      return;
    }

    const preferences = await checkPreferencesByEmails(emails, 'email', 'billing');
    const disabled = getDisabledEmails(preferences);

    if (disabled.length > 0) {
      setDisabledEmails(disabled);
      setIsWarningDialogOpen(true);
      return;
    }

    await sendEmail(emails);
  };

  const sendEmail = async (emails: string[]) => {
    if (!selectedQuoteForEmail) return;

    if (setIsSendingEmail) setIsSendingEmail(true);
    try {
      await api.post(API_ROUTES.PURCHASES.QUOTES_SEND, { quoteId: selectedQuoteForEmail.id, emails });
      toast({
        title: tQuotes('emailSent'),
        description: tQuotes('emailSentSuccess', { emails: emails.join(', ') }),
      });
      setIsSendEmailDialogOpen(false);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: tQuotes('emailError'),
        description: error instanceof Error ? error.message : tQuotes('unexpectedError'),
      });
    } finally {
      if (setIsSendingEmail) setIsSendingEmail(false);
    }
  };

  const handleWarningConfirm = async () => {
    if (!selectedQuoteForEmail) return;
    const emails = emailRecipients.split(',').map(email => email.trim()).filter(email => email);
    await sendEmail(emails);
    setIsWarningDialogOpen(false);
  };

  const columnTranslations = {
    id: t('QuoteColumns.quoteId'),
    user_name: t('UserColumns.name'),
    createdAt: t('QuoteColumns.createdAt'),
    total: t('QuoteColumns.total'),
    currency: t('QuoteColumns.currency'),
    status: t('UserColumns.status'),
  };

  return (
    <>
      <Card className={cn("h-full flex-1 flex flex-col min-h-0", className)}>
        {title && (
          <CardHeader className="flex-none p-4 pb-2">
            <div className="flex items-start gap-3">
              <div className="header-icon-circle mt-0.5">
                <DocumentTextIcon className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <CardTitle className="text-lg">{title}</CardTitle>
                {description && <CardDescription className="text-xs">{description}</CardDescription>}
              </div>
            </div>
          </CardHeader>
        )}
        <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden pt-2">
          <div className="flex flex-col flex-1 min-h-0 space-y-4 overflow-hidden">
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
              extraButtons={selectedQuote && (
                <div className="flex items-center gap-1 mr-2 px-2 border-r">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(selectedQuote)}
                    disabled={selectedQuote.status.toLowerCase() !== 'draft'}
                    className="h-8 px-2 gap-1 text-xs font-bold text-primary hover:text-primary hover:bg-primary/10"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    {tQuotes('edit')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(selectedQuote)}
                    disabled={selectedQuote.status.toLowerCase() !== 'draft'}
                    className="h-8 px-2 gap-1 text-xs font-bold text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {tQuotes('delete')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onQuoteAction(selectedQuote, 'confirm')}
                    disabled={selectedQuote.status.toLowerCase() !== 'draft' && selectedQuote.status.toLowerCase() !== 'pending'}
                    className="h-8 px-2 gap-1 text-xs font-bold text-green-600 hover:text-green-600 hover:bg-green-50"
                  >
                    <Check className="h-3.5 w-3.5" />
                    {tQuotes('confirm')}
                  </Button>
                </div>
              )}
            />
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
                        className="cursor-pointer"
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
            <DialogTitle>{tQuotes('sendEmailDialog.title')}</DialogTitle>
            <DialogDescription>{tQuotes('sendEmailDialog.description', { id: selectedQuoteForEmail?.doc_no || selectedQuoteForEmail?.id })}</DialogDescription>
          </DialogHeader>
          <div className="py-4 px-6">
            <Label htmlFor="email-recipients">{tQuotes('sendEmailDialog.recipients')}</Label>
            <Input
              id="email-recipients"
              value={emailRecipients}
              onChange={(e) => setEmailRecipients(e.target.value)}
              placeholder={tQuotes('sendEmailDialog.placeholder')}
            />
            <p className="text-sm text-muted-foreground mt-1">{tQuotes('sendEmailDialog.helperText')}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSendEmailDialogOpen(false)} disabled={isSendingEmail}>{tQuotes('quoteDialog.cancel')}</Button>
            <Button onClick={handleConfirmSendEmail} disabled={isSendingEmail}>
              {isSendingEmail ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {tQuotes('sendEmailDialog.sending')}
                </>
              ) : (
                tQuotes('sendEmail')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CommunicationWarningDialog
        open={isWarningDialogOpen}
        onOpenChange={setIsWarningDialogOpen}
        disabledItems={disabledEmails}
        onConfirm={handleWarningConfirm}
      />
    </>
  );
}
