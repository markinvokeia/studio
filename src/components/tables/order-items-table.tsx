
'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { OrderItem } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Calendar as CalendarIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

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
            order_item_id: selectedItem.id,
            schedule_date_time: selectedDate.toISOString(),
        };

        const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/quote/lines/schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: JSON.stringify(queryPayload),
                quote_number: quoteId,
                schedule_complete: 'schedule'
            }),
        });

        if (!response.ok) throw new Error(`Failed to ${actionType} item.`);
        
        toast({
            title: `Item ${actionType === 'schedule' ? 'Scheduled' : 'Completed'}`,
            description: `The order item has been updated successfully.`,
        });

        if(onItemsUpdate) {
            onItemsUpdate();
        }

    } catch (error) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: error instanceof Error ? error.message : `Could not update the item.`,
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
        <DataTableColumnHeader column={column} title="ID" />
      ),
    },
    {
      accessorKey: 'service_name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Service" />
      ),
    },
    {
      accessorKey: 'quantity',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Qty" />
      ),
    },
    {
      accessorKey: 'unit_price',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Unit Price" />
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
        <DataTableColumnHeader column={column} title="Total" />
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
        <DataTableColumnHeader column={column} title="Status" />
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
            {status}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'scheduled_date',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Scheduled" />
      ),
       cell: ({ row }) => <DateCell dateValue={row.getValue('scheduled_date')} />,
    },
    {
      accessorKey: 'completed_date',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Completed" />
      ),
      cell: ({ row }) => <DateCell dateValue={row.getValue('completed_date')} />,
    },
    {
      accessorKey: 'invoiced_date',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Invoiced" />
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
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        {!item.scheduled_date && <DropdownMenuItem onClick={() => handleActionClick(item, 'schedule')}>Schedule</DropdownMenuItem>}
                        {!item.completed_date && <DropdownMenuItem onClick={() => handleActionClick(item, 'complete')}>Complete</DropdownMenuItem>}
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
          filterPlaceholder="Filter by service..."
        />
      </CardContent>
    </Card>

    <Dialog open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
                <DialogTitle className="capitalize">{actionType} Item</DialogTitle>
                <DialogDescription>
                    Select a date to mark this item as {actionType}.
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
                <Button variant="outline" onClick={() => setIsDatePickerOpen(false)}>Cancel</Button>
                <Button onClick={handleDateSave}>Save Date</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}
