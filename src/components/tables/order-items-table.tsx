
'use client';

import { AppointmentFormDialog } from '@/components/appointments/AppointmentFormDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { Calendar as CalendarType, OrderItem, Service, User as UserType } from '@/lib/types';
import { formatDateTime, toLocalISOString } from '@/lib/utils';
import { api } from '@/services/api';
import { getPurchaseServices, getSalesServices, getUsersServicesBatch } from '@/services/services';
import { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { CalendarCheck, CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { ClinicSessionDialog, ClinicSessionFormData } from '@/components/clinic-session-dialog';

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
  quoteDocNo?: string;
  isSales?: boolean;
  userId?: string;
  patient?: UserType;
  canSchedule?: boolean;
  canComplete?: boolean;
}

export function OrderItemsTable({ items, isLoading = false, onItemsUpdate, quoteId, quoteDocNo, isSales = true, userId, patient, canSchedule = true, canComplete = true }: OrderItemsTableProps) {
  const t = useTranslations('OrderItemsTable');
  const { toast } = useToast();
  const [isDatePickerOpen, setIsDatePickerOpen] = React.useState(false);
  const [isClinicSessionDialogOpen, setIsClinicSessionDialogOpen] = React.useState(false);
  const [isAppointmentDialogOpen, setIsAppointmentDialogOpen] = React.useState(false);
  const [selectedItem, setSelectedItem] = React.useState<OrderItem | null>(null);
  const [actionType, setActionType] = React.useState<ActionType | null>(null);
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(new Date());
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

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
          isSales ? getSalesServices({ limit: 100 }) : getPurchaseServices({ limit: 100 }),
          api.get(API_ROUTES.SYSTEM.CONFIGS).catch(() => [])
        ]);

        if (Array.isArray(configData)) {
          const calConfig = configData.find((c: any) => c.key === 'CHECK_CALENDAR_AVAILABILITY');
          const docConfig = configData.find((c: any) => c.key === 'CHECK_DOCTOR_AVAILABILITY');
          if (calConfig) setCheckCalendarAvailability(String(calConfig.value).toLowerCase() === 'true');
          if (docConfig) setCheckDoctorAvailability(String(docConfig.value).toLowerCase() === 'true');
        }

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

        // Fetch services for all doctors in a single batch request
        const doctorIds = doctorsMapped.map(d => d.id).filter(Boolean);
        const serviceMap = await getUsersServicesBatch(doctorIds);
        setDoctorServiceMap(serviceMap);

        const servicesList = srvData.items || [];
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
      setIsClinicSessionDialogOpen(true);
    }
  };

  const handleRowSelectionChange = React.useCallback((selectedRows: OrderItem[]) => {
    const item = selectedRows[0] ?? null;
    setSelectedItem(item);
  }, []);

  const handleDateSave = async () => {
    if (!selectedItem || !actionType || !selectedDate || !quoteId) return;

    try {
      const queryPayload: any = {
        action: actionType,
        order_item_id: parseInt(selectedItem.id, 10),
        schedule_date_time: toLocalISOString(selectedDate),
        user_id: userId,
      };

      const apiRoute = isSales
        ? API_ROUTES.SALES.QUOTES_LINES_SCHEDULE
        : API_ROUTES.PURCHASES.QUOTES_LINES_SCHEDULE;

      await api.post(apiRoute, {
        query: queryPayload,
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

  const handleClinicSessionSave = async (data: ClinicSessionFormData) => {
    if (!selectedItem || !quoteId || !userId) return;

    try {
      const { archivos_adjuntos, deletedAttachmentIds, ...sessionData } = data;
      const formData = new FormData();

      // Skip fields handled separately to avoid double-appending
      const skipKeys = new Set(['tratamientos']);
      (Object.keys(sessionData) as Array<keyof typeof sessionData>).forEach(key => {
        if (skipKeys.has(key as string)) return;
        const value = sessionData[key];
        if (value !== undefined && value !== null) {
          formData.append(key, String(value));
        }
      });

      formData.append('paciente_id', userId);

      if (data.sesion_id) {
        formData.append('sesion_id', String(data.sesion_id));
        formData.append('deleted_attachment_ids', JSON.stringify(deletedAttachmentIds || []));
      }

      if (sessionData.tratamientos && sessionData.tratamientos.length > 0) {
        formData.append('tratamientos', JSON.stringify(sessionData.tratamientos));
      }

      if (archivos_adjuntos && archivos_adjuntos.length > 0) {
        archivos_adjuntos.forEach((file: File) => formData.append('newly_added_files', file));
      }

      await api.post(API_ROUTES.CLINIC_HISTORY.SESSIONS_UPSERT, formData);

      // Use the session date from the form for the completion timestamp
      const completionDate = data.fecha_sesion ? new Date(data.fecha_sesion) : new Date();

      // Now complete the order item
      const queryPayload: any = {
        action: 'complete',
        order_item_id: parseInt(selectedItem.id, 10),
        schedule_date_time: toLocalISOString(completionDate),
        user_id: userId,
      };

      const apiRoute = isSales
        ? API_ROUTES.SALES.QUOTES_LINES_SCHEDULE
        : API_ROUTES.PURCHASES.QUOTES_LINES_SCHEDULE;

      await api.post(apiRoute, {
        query: queryPayload,
        quote_number: parseInt(quoteId, 10),
        order_item_id: parseInt(selectedItem.id, 10),
        schedule_complete: 'complete',
        is_sales: isSales,
      });

      toast({
        title: t('toast.completedTitle'),
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
      throw error;
    }
  };

  const handleAppointmentSaveSuccess = async (appointment: any, selectedDate: Date) => {
    if (!selectedItem || !quoteId) return;

    try {
      const queryPayload = {
        action: 'schedule',
        order_item_id: parseInt(selectedItem.id, 10),
        schedule_date_time: toLocalISOString(selectedDate),
        user_id: userId,
        appointment_id: appointment.appointment_id || appointment.appointmentId || appointment.id,
      };

      const apiRoute = isSales
        ? API_ROUTES.SALES.QUOTES_LINES_SCHEDULE
        : API_ROUTES.PURCHASES.QUOTES_LINES_SCHEDULE;

      await api.post(apiRoute, {
        query: queryPayload,
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
      id: 'select',
      header: () => null,
      cell: ({ row, table }) => {
        const isSelected = row.getIsSelected();
        return (
          <input
            type="radio"
            name="order-item-selection"
            checked={isSelected}
            onChange={() => {
              table.toggleAllPageRowsSelected(false);
              row.toggleSelected(true);
            }}
            className="h-4 w-4 cursor-pointer"
          />
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
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
  const toolbarActions = selectedItem ? (
    <div className="ml-auto flex items-center gap-1.5">
      {canSchedule && !selectedItem.scheduled_date && (
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => handleActionClick(selectedItem, 'schedule')}
        >
          <CalendarCheck className="h-3.5 w-3.5" />
          {t('actions.schedule')}
        </Button>
      )}
      {canComplete && !selectedItem.completed_date && (
        <Button
          variant="default"
          size="sm"
          className="h-8 gap-1.5 text-xs bg-green-600 hover:bg-green-700 text-white"
          onClick={() => handleActionClick(selectedItem, 'complete')}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {t('actions.complete')}
        </Button>
      )}
    </div>
  ) : null;

  return (
    <>
      <Card className="h-full flex flex-col min-h-0">
        <CardContent className="flex-1 flex flex-col min-h-0 p-4">
          <DataTable
            columns={columns}
            data={items}
            filterColumnId="service_name"
            filterPlaceholder={t('filterPlaceholder')}
            onRowSelectionChange={handleRowSelectionChange}
            enableSingleRowSelection
            rowSelection={rowSelection}
            setRowSelection={setRowSelection}
            extraButtons={toolbarActions}
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

      <ClinicSessionDialog
        open={isClinicSessionDialogOpen}
        onOpenChange={(open) => {
          setIsClinicSessionDialogOpen(open);
          if (!open) {
            setSelectedItem(null);
            setActionType(null);
          }
        }}
        onSave={handleClinicSessionSave}
        userId={userId || ''}
        quoteId={quoteId || ''}
        appointmentId={selectedItem?.appointment_id}
        defaultDate={selectedDate}
        serviceName={selectedItem?.service_name}
        showTreatments={true}
        showAttachments={true}
      />

      <AppointmentFormDialog
        open={isAppointmentDialogOpen}
        onOpenChange={setIsAppointmentDialogOpen}
        initialData={{
          user: patient || patientUser || undefined,
          summary: selectedItem?.service_name || '',
          description: selectedItem?.service_name || '',
          services: selectedItem ? allServices.filter(s => String(s.id) === String(selectedItem.service_id)) : [],
          quote: quoteId ? { id: quoteId, doc_no: quoteDocNo || '', user_id: '', total: 0, status: 'draft', payment_status: 'unpaid', billing_status: 'not_invoiced', currency: 'USD', exchange_rate: 1, notes: '', createdAt: '' } : undefined,
        }}
        readOnlyFields={{ user: true, services: true, quote: true }}
        onSaveSuccess={handleAppointmentSaveSuccess}
        calendars={calendars}
        doctors={doctors}
        doctorServiceMap={doctorServiceMap}
        checkCalendarAvailability={checkCalendarAvailability}
        checkDoctorAvailability={checkDoctorAvailability}
      />
    </>
  );
}
