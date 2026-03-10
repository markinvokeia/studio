'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Card, CardContent } from '@/components/ui/card';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { Appointment, Calendar as CalendarType, OrderItem, Service, User as UserType } from '@/lib/types';
import { cn, formatDateTime } from '@/lib/utils';
import { api } from '@/services/api';
import { ColumnDef, RowSelectionState, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table';
import { CalendarIcon, CheckCircle, RefreshCw, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { AppointmentFormDialog } from '@/components/appointments/AppointmentFormDialog';
import { DataTableAdvancedToolbar } from '../ui/data-table-advanced-toolbar';
import { DataTablePagination } from '../ui/data-table-pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

const getColumns = (
  t: any,
  onRowSelectionChange?: (selectedRows: OrderItem[]) => void
): ColumnDef<OrderItem>[] => [
    {
      id: 'select',
      header: () => null,
      cell: ({ row, table }) => (
        <RadioGroup
          value={row.getIsSelected() ? row.id : ''}
          onValueChange={() => {
            table.toggleAllPageRowsSelected(false);
            row.toggleSelected(true);
            if (onRowSelectionChange) {
              onRowSelectionChange([row.original]);
            }
          }}
        >
          <RadioGroupItem value={row.id} />
        </RadioGroup>
      ),
      size: 40,
    },
    {
      accessorKey: 'service_name',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.service')} />,
    },
    {
      accessorKey: 'tooth_number',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.toothNumber')} />,
      cell: ({ row }) => row.original.tooth_number || '-',
    },
    {
      accessorKey: 'quantity',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.quantity')} />,
    },
    {
      accessorKey: 'unit_price',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.unitPrice')} />,
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue('unit_price'));
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
      },
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.status')} />,
      cell: ({ row }) => {
        const status = row.original.status?.toLowerCase() || '';
        const variant = { completed: 'success', scheduled: 'info' }[status] ?? ('default' as any);
        return <Badge variant={variant} className="capitalize">{t(`status.${status}`)}</Badge>;
      }
    },
  ];

export function OrderItemsTable({ items, isLoading = false, onItemsUpdate, quoteId, isSales = true, userId, patient }: OrderItemsTableProps) {
  const t = useTranslations('OrderItemsTable');
  const { toast } = useToast();
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [isDatePickerOpen, setIsDatePickerOpen] = React.useState(false);
  const [isAppointmentDialogOpen, setIsAppointmentDialogOpen] = React.useState(false);
  const [selectedItem, setSelectedItem] = React.useState<OrderItem | null>(null);
  const [actionType, setActionType] = React.useState<'schedule' | 'complete' | null>(null);
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(new Date());

  const columns = React.useMemo(() => getColumns(t), [t]);

  const table = useReactTable({
    data: items,
    columns,
    state: { rowSelection },
    enableRowSelection: true,
    enableMultiRowSelection: false,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const selectedRowItem = React.useMemo(() => {
    const rows = table.getFilteredSelectedRowModel().rows;
    return rows.length > 0 ? rows[0].original : null;
  }, [rowSelection, items]);

  const [calendars, setCalendars] = React.useState<CalendarType[]>([]);
  const [doctors, setDoctors] = React.useState<UserType[]>([]);
  const [allServices, setAllServices] = React.useState<Service[]>([]);
  const [doctorServiceMap, setDoctorServiceMap] = React.useState<Map<string, Service[]>>(new Map());
  const [patientUser, setPatientUser] = React.useState<UserType | null>(null);
  const [checkCalendarAvailability, setCheckCalendarAvailability] = React.useState(true);
  const [checkDoctorAvailability, setCheckDoctorAvailability] = React.useState(true);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const [calData, docData, srvData, configData] = await Promise.all([
          api.get(API_ROUTES.CALENDARS),
          api.get(API_ROUTES.USERS, { filter_type: 'DOCTOR' }),
          api.get(API_ROUTES.SERVICES, { is_sales: isSales ? 'true' : 'false' }),
          api.get(API_ROUTES.SYSTEM.CONFIGS).catch(() => [])
        ]);
        if (Array.isArray(configData)) {
          const calConfig = configData.find((c: any) => c.key === 'CHECK_CALENDAR_AVAILABILITY');
          const docConfig = configData.find((c: any) => c.key === 'CHECK_DOCTOR_AVAILABILITY');
          if (calConfig) setCheckCalendarAvailability(String(calConfig.value).toLowerCase() === 'true');
          if (docConfig) setCheckDoctorAvailability(String(docConfig.value).toLowerCase() === 'true');
        }
        setCalendars(calData.calendars || calData || []);
        const docs = docData.data || docData || [];
        setDoctors(docs.map((d: any) => ({ ...d, id: String(d.id) })));
        setAllServices(srvData.items || srvData || []);
      } catch (e) { console.error(e); }
    };
    fetchData();
  }, [isSales]);

  const handleActionClick = (item: OrderItem, type: 'schedule' | 'complete') => {
    setSelectedItem(item);
    setActionType(type);
    if (type === 'schedule') setIsAppointmentDialogOpen(true);
    else { setSelectedDate(new Date()); setIsDatePickerOpen(true); }
  };

  const handleDateSave = async () => {
    if (!selectedItem || !actionType || !selectedDate || !quoteId) return;
    try {
      const payload = {
        action: actionType,
        order_item_id: parseInt(selectedItem.id, 10),
        schedule_date_time: selectedDate.toISOString(),
        user_id: userId,
      };
      await api.post(isSales ? API_ROUTES.SALES.QUOTES_LINES_SCHEDULE : API_ROUTES.PURCHASES.QUOTES_LINES_SCHEDULE, {
        query: JSON.stringify(payload),
        quote_number: parseInt(quoteId, 10),
        order_item_id: parseInt(selectedItem.id, 10),
        schedule_complete: actionType,
        is_sales: isSales,
      });
      toast({ title: t(actionType === 'schedule' ? 'toast.scheduledTitle' : 'toast.completedTitle') });
      if (onItemsUpdate) onItemsUpdate();
      setIsDatePickerOpen(false);
    } catch (e) { console.error(e); }
  };

  if (isLoading) return <div className="space-y-4 pt-4"><Skeleton className="h-8 w-full" /><Skeleton className="h-12 w-full" /></div>;

  return (
    <>
      <Card className="h-full flex flex-col min-h-0 rounded-t-none shadow-none border-t-0">
        <CardContent className="flex-1 flex flex-col min-h-0 p-4 bg-card">
          <DataTableAdvancedToolbar
            table={table}
            filterPlaceholder={t('filterPlaceholder')}
            searchQuery={(table.getState().columnFilters.find((f: any) => f.id === 'service_name')?.value as string) || ''}
            onSearchChange={(value) => table.getColumn('service_name')?.setFilterValue(value)}
            onRefresh={onItemsUpdate}
            isRefreshing={isLoading}
            extraButtons={selectedRowItem && (
              <div className="flex items-center gap-1 mr-2 px-2 border-r">
                {!selectedRowItem.scheduled_date && (
                  <Button variant="ghost" size="sm" onClick={() => handleActionClick(selectedRowItem, 'schedule')} className="h-8 px-2 gap-1 text-xs font-bold text-primary">
                    <CalendarIcon className="h-3.5 w-3.5" /> {t('actions.schedule')}
                  </Button>
                )}
                {!selectedRowItem.completed_date && (
                  <Button variant="ghost" size="sm" onClick={() => handleActionClick(selectedRowItem, 'complete')} className="h-8 px-2 gap-1 text-xs font-bold text-green-600">
                    <CheckCircle className="h-3.5 w-3.5" /> {t('actions.complete')}
                  </Button>
                )}
              </div>
            )}
          />
          <div className="rounded-md border overflow-auto flex-1 min-h-0 relative mt-4">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_hsl(var(--border))]">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'} className="cursor-pointer">
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={columns.length} className="h-24 text-center">No results.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <DataTablePagination table={table} />
        </CardContent>
      </Card>
      <Dialog open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>{t(`dialog.${actionType === 'schedule' ? 'scheduleTitle' : 'completeTitle'}`)}</DialogTitle></DialogHeader>
          <div className="flex justify-center py-4"><DatePicker mode="single" selected={selectedDate} onSelect={setSelectedDate} initialFocus /></div>
          <DialogFooter><Button onClick={handleDateSave}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <AppointmentFormDialog
        open={isAppointmentDialogOpen}
        onOpenChange={setIsAppointmentDialogOpen}
        initialData={{
          user: patient || patientUser || undefined,
          services: selectedItem ? allServices.filter(s => String(s.id) === String(selectedItem.service_id)) : []
        }}
        onSaveSuccess={() => { if (onItemsUpdate) onItemsUpdate(); setIsAppointmentDialogOpen(false); }}
        calendars={calendars}
        doctors={doctors}
        doctorServiceMap={doctorServiceMap}
        checkCalendarAvailability={checkCalendarAvailability}
        checkDoctorAvailability={checkDoctorAvailability}
      />
    </>
  );
}
