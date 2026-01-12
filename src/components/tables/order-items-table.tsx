
'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { OrderItem } from '@/lib/types';
import { api } from '@/services/api';
import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

type ActionType = 'schedule' | 'complete';

const DateCell = ({ dateValue }: { dateValue: string | null }) => {
  if (!dateValue || dateValue === 'N/A') {
    return <Badge variant="destructive">N/A</Badge>;
  }

  const date = new Date(dateValue);
  const now = new Date();

  date.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);

  if (date < now) {
    return <Badge variant="success">{dateValue}</Badge>;
  }
  return <Badge variant="info">{dateValue}</Badge>;
};

interface OrderItemsTableProps {
  items: OrderItem[];
  isLoading?: boolean;
  onItemsUpdate?: () => void;
  quoteId?: string;
}

export function OrderItemsTable({ items, isLoading = false, onItemsUpdate, quoteId }: OrderItemsTableProps) {
  const t = useTranslations('OrderItemsTable');
  const { toast } = useToast();
  const [isDatePickerOpen, setIsDatePickerOpen] = React.useState(false);
  const [selectedItem, setSelectedItem] = React.useState<OrderItem | null>(null);
  const [actionType, setActionType] = React.useState<ActionType | null>(null);
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(new Date());

  const handleActionClick = (item: OrderItem, type: ActionType) => {
    setSelectedItem(item);
    setActionType(type);
    setSelectedDate(new Date());
    setIsDatePickerOpen(true);
  };

  const handleDateSave = async () => {
    if (!selectedItem || !actionType || !selectedDate || !quoteId) return;

    try {
      const queryPayload = {
        action: actionType,
        order_item_id: parseInt(selectedItem.id, 10),
        schedule_date_time: selectedDate.toISOString(),
      };

      await api.post(API_ROUTES.QUOTES_LINES_SCHEDULE, {
        query: JSON.stringify(queryPayload),
        quote_number: parseInt(quoteId, 10),
        order_item_id: parseInt(selectedItem.id, 10),
        schedule_complete: actionType,
        is_sales: true,
      });

      toast({
        title: t(actionType === 'schedule' ? 'toast.scheduledTitle' : 'toast.completedTitle'),
        description: t('toast.updateSuccess'),
      });

      if (onItemsUpdate) {
        onItemsUpdate();
      }

    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('toast.error'),
        description: error instanceof Error ? error.message : t('toast.updateError'),
      });
    } finally {
      setIsDatePickerOpen(false);
      setSelectedItem(null);
      setActionType(null);
    }
  };

  const columns: ColumnDef<OrderItem>[] = [
    {
      accessorKey: 'id',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('columns.id')} />
      ),
    },
    {
      accessorKey: 'service_name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('columns.service')} />
      ),
    },
    {
      accessorKey: 'quantity',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('columns.quantity')} />
      ),
    },
    {
      accessorKey: 'unit_price',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('columns.unitPrice')} />
      ),
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue('unit_price'));
        const formatted = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(amount);
        return <div className="font-medium">{formatted}</div>;
      },
    },
    {
      accessorKey: 'total',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('columns.total')} />
      ),
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue('total'));
        const formatted = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(amount);
        return <div className="font-medium">{formatted}</div>;
      },
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('columns.status')} />
      ),
      cell: ({ row }) => {
        const status = row.getValue('status') as string;
        const variant = {
          completed: 'success',
          scheduled: 'info',
          cancelled: 'destructive',
        }[status.toLowerCase()] ?? ('default' as any);

        return (
          <Badge variant={variant} className="capitalize">
            {t(`status.${status.toLowerCase()}`)}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'scheduled_date',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('columns.scheduled')} />
      ),
      cell: ({ row }) => <DateCell dateValue={row.getValue('scheduled_date')} />,
    },
    {
      accessorKey: 'completed_date',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('columns.completed')} />
      ),
      cell: ({ row }) => <DateCell dateValue={row.getValue('completed_date')} />,
    },
    {
      accessorKey: 'invoiced_date',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('columns.invoiced')} />
      ),
      cell: ({ row }) => <DateCell dateValue={row.getValue('invoiced_date')} />,
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const item = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">{t('actions.openMenu')}</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t('actions.title')}</DropdownMenuLabel>
              {!item.scheduled_date && <DropdownMenuItem onClick={() => handleActionClick(item, 'schedule')}>{t('actions.schedule')}</DropdownMenuItem>}
              {!item.completed_date && <DropdownMenuItem onClick={() => handleActionClick(item, 'complete')}>{t('actions.complete')}</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
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
            data={items}
            filterColumnId="service_name"
            filterPlaceholder={t('filterPlaceholder')}
            columnTranslations={{
              id: t('columns.id'),
              service_name: t('columns.service'),
              quantity: t('columns.quantity'),
              unit_price: t('columns.unitPrice'),
              total: t('columns.total'),
              status: t('columns.status'),
              scheduled_date: t('columns.scheduled'),
              completed_date: t('columns.completed'),
              invoiced_date: t('columns.invoiced'),
            }}
          />
        </CardContent>
      </Card>

      <Dialog open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
        <DialogContent className="sm:max-w-[425px]">
          {actionType && (
            <>
              <DialogHeader>
                <DialogTitle className="capitalize">{t(`dateDialog.title.${actionType}`)}</DialogTitle>
                <DialogDescription>
                  {t(`dateDialog.description.${actionType}`)}
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-center py-4">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  initialFocus
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDatePickerOpen(false)}>{t('dateDialog.cancel')}</Button>
                <Button onClick={handleDateSave}>{t('dateDialog.save')}</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
