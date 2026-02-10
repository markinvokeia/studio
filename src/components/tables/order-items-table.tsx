
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
import { Appointment, Calendar as CalendarType, OrderItem, Service, User as UserType } from '@/lib/types';
import { cn, formatDateTime } from '@/lib/utils';
import { api } from '@/services/api';
import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { AppointmentFormDialog } from '@/components/appointments/AppointmentFormDialog';

type ActionType = 'schedule' | 'complete';

const DateCell = ({ dateValue }: { dateValue: string | null }) => {
  const tGeneral = useTranslations('General');
  const notAvailable = tGeneral('notAvailable');

  if (!dateValue || dateValue === notAvailable) {
    return <Badge variant="destructive">{notAvailable}</Badge>;
  }

  const date = new Date(dateValue);
  const now = new Date();

  date.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);

  if (date < now) {
    return <Badge variant="success">{formatDateTime(dateValue)}</Badge>;
  }
  return <Badge variant="info">{formatDateTime(dateValue)}</Badge>;
};

interface OrderItemsTableProps {
  items: OrderItem[];
  isLoading?: boolean;
  onItemsUpdate?: () => void;
  quoteId?: string;
  isSales?: boolean;
  userId?: string;
  patient?: UserType;
}

export function OrderItemsTable({ items, isLoading = false, onItemsUpdate, quoteId, isSales = true, userId, patient }: OrderItemsTableProps) {
  const t = useTranslations('OrderItemsTable');
  const { toast } = useToast();
  const [isDatePickerOpen, setIsDatePickerOpen] = React.useState(false);
  const [isAppointmentDialogOpen, setIsAppointmentDialogOpen] = React.useState(false);
  const [selectedItem, setSelectedItem] = React.useState<OrderItem | null>(null);
  const [actionType, setActionType] = React.useState<ActionType | null>(null);
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(new Date());

  const [calendars, setCalendars] = React.useState<CalendarType[]>([]);
  const [doctors, setDoctors] = React.useState<UserType[]>([]);
  const [allServices, setAllServices] = React.useState<Service[]>([]);
  const [doctorServiceMap, setDoctorServiceMap] = React.useState<Map<string, Service[]>>(new Map());
  const [patientUser, setPatientUser] = React.useState<UserType | null>(null);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const [calData, docData, srvData] = await Promise.all([
          api.get(API_ROUTES.CALENDARS),
          api.get(API_ROUTES.USERS, { filter_type: 'DOCTOR' }),
          api.get(API_ROUTES.SERVICES, { is_sales: isSales ? 'true' : 'false' })
        ]);

        const cals = Array.isArray(calData) ? calData : (calData.calendars || []);
        setCalendars(cals.map((c: any) => ({ ...c, id: c.id || c.google_calendar_id })));

        let doctorsList: UserType[] = [];
        if (Array.isArray(docData) && docData.length > 0) {
          const firstElement = docData[0];
          if (firstElement.json && typeof firstElement.json === 'object') {
            doctorsList = firstElement.json.data || [];
          } else if (firstElement.data) {
            doctorsList = firstElement.data;
          } else {
            doctorsList = docData;
          }
        } else if (docData?.data) {
          doctorsList = Array.isArray(docData.data) ? docData.data : [docData.data];
        } else if (Array.isArray(docData)) {
          doctorsList = docData;
        }

        const doctorsMapped = doctorsList.map((d: any) => ({
          ...d,
          id: String(d.id),
          name: d.name || 'Doctor',
          email: d.email || '',
        }));
        setDoctors(doctorsMapped);

        // Fetch services for each doctor to populate doctorServiceMap
        const serviceMap = new Map<string, Service[]>();
        await Promise.all(doctorsMapped.map(async (doctor) => {
          if (doctor.id) {
            try {
              const data = await api.get(API_ROUTES.USER_SERVICES, { user_id: doctor.id });
              const doctorServices = Array.isArray(data) ? data : (data.user_services || data.data || []);
              serviceMap.set(doctor.id, doctorServices.map((s: any) => ({
                ...s,
                id: String(s.id),
                duration_minutes: s.duration_minutes || 30
              })));
            } catch (e) {
              console.error(`Error fetching services for doctor ${doctor.id}:`, e);
            }
          }
        }));
        setDoctorServiceMap(serviceMap);

        const servicesList = Array.isArray(srvData) ? srvData : (srvData.services || srvData.data || srvData.result || []);
        setAllServices(servicesList.map((s: any) => ({
          ...s,
          id: String(s.id),
          duration_minutes: s.duration_minutes || 30
        })));

        // Fetch user details for the patient if userId is provided and patient prop is not
        if (userId && !patient) {
          try {
            const userData = await api.get(API_ROUTES.USERS, { id: userId });
            let user: UserType | null = null;
            if (Array.isArray(userData) && userData.length > 0) {
              user = userData[0].json?.data?.[0] || userData[0].data?.[0] || userData[0] || null;
            } else if (userData?.data) {
              user = Array.isArray(userData.data) ? userData.data[0] : userData.data;
            } else if (userData?.json?.data) {
              user = Array.isArray(userData.json.data) ? userData.json.data[0] : userData.json.data;
            }

            if (user) {
              setPatientUser({
                id: String(user.id),
                name: user.name || 'Unknown',
                email: user.email || '',
                phone_number: user.phone_number || '',
                is_active: user.is_active !== undefined ? user.is_active : true,
                avatar: user.avatar || '',
              });
            }
          } catch (e) {
            console.error("Error fetching patient user:", e);
          }
        }
      } catch (error) {
        console.error("Error fetching data for AppointmentFormDialog in OrderItemsTable:", error);
      }
    };

    fetchData();
  }, [userId, isSales]);

  const handleActionClick = (item: OrderItem, type: ActionType) => {
    setSelectedItem(item);
    setActionType(type);
    if (type === 'schedule') {
      setIsAppointmentDialogOpen(true);
    } else {
      setSelectedDate(new Date());
      setIsDatePickerOpen(true);
    }
  };

  const handleDateSave = async () => {
    if (!selectedItem || !actionType || !selectedDate || !quoteId) return;

    try {
      const queryPayload = {
        action: actionType,
        order_item_id: parseInt(selectedItem.id, 10),
        schedule_date_time: selectedDate.toISOString(),
        user_id: userId,
      };

      const apiRoute = isSales
        ? API_ROUTES.SALES.QUOTES_LINES_SCHEDULE
        : API_ROUTES.PURCHASES.QUOTES_LINES_SCHEDULE;

      await api.post(apiRoute, {
        query: JSON.stringify(queryPayload),
        quote_number: parseInt(quoteId, 10),
        order_item_id: parseInt(selectedItem.id, 10),
        schedule_complete: actionType,
        is_sales: isSales,
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

  const handleAppointmentSaveSuccess = async (appointment: any, selectedDate: Date) => {
    if (!selectedItem || !quoteId) return;

    try {
      const queryPayload = {
        action: 'schedule',
        order_item_id: parseInt(selectedItem.id, 10),
        schedule_date_time: selectedDate.toISOString(),
        user_id: userId,
        appointment_id: appointment.id,
      };

      const apiRoute = isSales
        ? API_ROUTES.SALES.QUOTES_LINES_SCHEDULE
        : API_ROUTES.PURCHASES.QUOTES_LINES_SCHEDULE;

      await api.post(apiRoute, {
        query: JSON.stringify(queryPayload),
        quote_number: parseInt(quoteId, 10),
        order_item_id: parseInt(selectedItem.id, 10),
        schedule_complete: 'schedule',
        is_sales: isSales,
      });

      toast({
        title: t('toast.scheduledTitle'),
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
      setIsAppointmentDialogOpen(false);
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
      accessorKey: 'tooth_number',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('columns.toothNumber')} />
      ),
      cell: ({ row }) => {
        const toothNumber = row.getValue('tooth_number') as number;
        return toothNumber ? <div className="font-medium">{toothNumber}</div> : <div className="text-muted-foreground">-</div>;
      },
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
      <Card className="h-full flex flex-col min-h-0">
        <CardContent className="flex-1 flex flex-col min-h-0 p-4">
          <DataTable
            columns={columns}
            data={items}
            filterColumnId="service_name"
            filterPlaceholder={t('filterPlaceholder')}
            columnTranslations={{
              id: t('columns.id'),
              service_name: t('columns.service'),
              tooth_number: t('columns.toothNumber'),
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
          <DialogHeader>
            <DialogTitle>
              {actionType === 'schedule' ? t('dialog.scheduleTitle') : t('dialog.completeTitle')}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'schedule' ? t('dialog.scheduleDescription') : t('dialog.completeDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md border shadow"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDatePickerOpen(false)}>
              {t('actions.cancel')}
            </Button>
            <Button onClick={handleDateSave}>{t('actions.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AppointmentFormDialog
        open={isAppointmentDialogOpen}
        onOpenChange={setIsAppointmentDialogOpen}
        initialData={{
          user: patient || patientUser || undefined,
          description: selectedItem?.service_name || '',
          services: selectedItem ? allServices.filter(s => String(s.id) === String(selectedItem.service_id)) : []
        }}
        onSaveSuccess={handleAppointmentSaveSuccess}
        calendars={calendars}
        doctors={doctors}
        doctorServiceMap={doctorServiceMap}
      />
    </>
  );
}
