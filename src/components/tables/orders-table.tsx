'use client';

import * as React from 'react';
import { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Order } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '../ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { MoreHorizontal } from 'lucide-react';
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

interface OrdersTableProps {
  orders: Order[];
  isLoading?: boolean;
  onRowSelectionChange?: (selectedRows: Order[]) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  title?: string;
  description?: string;
  rowSelection?: RowSelectionState;
  setRowSelection?: (selection: RowSelectionState) => void;
}

export function OrdersTable({ orders, isLoading = false, onRowSelectionChange, onRefresh, isRefreshing, title, description, rowSelection, setRowSelection }: OrdersTableProps) {
    const { toast } = useToast();
    const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = React.useState(false);
    const [selectedOrderForInvoice, setSelectedOrderForInvoice] = React.useState<Order | null>(null);
    const [invoiceDate, setInvoiceDate] = React.useState<Date | undefined>(new Date());

    const handleInvoiceClick = (order: Order) => {
        setSelectedOrderForInvoice(order);
        setInvoiceDate(new Date());
        setIsInvoiceDialogOpen(true);
    };

    const handleConfirmInvoice = async () => {
        if (!selectedOrderForInvoice || !invoiceDate) return;

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

            if (!response.ok) {
                throw new Error('Failed to create invoice.');
            }

            toast({
                title: 'Invoice Created',
                description: `Invoice for order #${selectedOrderForInvoice.id} has been created.`,
            });
            
            if (onRefresh) {
                onRefresh();
            }

        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error instanceof Error ? error.message : 'Could not create the invoice.',
            });
        } finally {
            setIsInvoiceDialogOpen(false);
            setSelectedOrderForInvoice(null);
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
          <DataTableColumnHeader column={column} title="Order ID" />
        ),
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
            pending: 'info',
            processing: 'default',
            cancelled: 'destructive',
          }[status?.toLowerCase() ?? ''] ?? ('default' as any);
    
          return (
            <Badge variant={variant} className="capitalize">
              {status}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'createdAt',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Created At" />
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
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => handleInvoiceClick(order)}>
                            Invoice
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
          filterColumnId="id"
          filterPlaceholder="Filter by order ID..."
          onRowSelectionChange={onRowSelectionChange}
          enableSingleRowSelection={onRowSelectionChange ? true : false}
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
          rowSelection={rowSelection}
          setRowSelection={setRowSelection}
        />
      </CardContent>
    </Card>

    <Dialog open={isInvoiceDialogOpen} onOpenChange={setIsInvoiceDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
                <DialogTitle>Create Invoice</DialogTitle>
                <DialogDescription>
                    Select a date for the invoice for order #{selectedOrderForInvoice?.id}.
                </DialogDescription>
            </DialogHeader>
            <div className="flex justify-center py-4">
                <Calendar
                    mode="single"
                    selected={invoiceDate}
                    onSelect={setInvoiceDate}
                    initialFocus
                />
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsInvoiceDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleConfirmInvoice}>Create Invoice</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}