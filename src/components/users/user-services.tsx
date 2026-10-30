'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import {
  Dialog,
  DialogCancelButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { API_ROUTES } from '@/constants/routes';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useDataLoader } from '@/hooks/use-data-loader';
import { useToast } from '@/hooks/use-toast';
import { Service } from '@/lib/types';
import { formatServicePrice } from '@/lib/utils';
import { api, isTimeoutError, REQUEST_TIMEOUT_MS } from '@/services/api';
import { getPurchaseServices, getSalesServices } from '@/services/services';
import { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { getClinicCurrency } from '@/stores/clinic-info-store';

type UserServiceAssignment = {
  service_id: string;
  is_active: boolean;
  duration_minutes?: number;
};


const getColumns = (t: (key: string) => string): ColumnDef<Service>[] => [
  {
    accessorKey: 'name',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('ServicesColumns.name')} />,
  },
  {
    accessorKey: 'category',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('ServicesColumns.category')} />,
  },
  {
    accessorKey: 'price',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('ServicesColumns.price')} />,
    cell: ({ row }) => {
      return <div className="font-medium">{formatServicePrice(row.original.price, row.original.currency, t('General.free'))}</div>;
    },
  },
  {
    accessorKey: 'duration_minutes',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('ServicesColumns.duration')} />,
  },
  {
    accessorKey: 'is_active',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('UserRoles.columns.status')} />,
    cell: ({ row }) => {
      const isActive = row.getValue('is_active');
      return (
        <Badge variant={isActive ? 'success' : 'outline'}>
          {isActive ? t('UserRoles.status.active') : t('UserRoles.status.inactive')}
        </Badge>
      );
    }
  },
];

// Throws on failure: an empty list here would make the next "assign" (a full replace) wipe the real assignments.
async function getServicesForUser(userId: string, t: any, isSalesUser: boolean, signal?: AbortSignal): Promise<Service[]> {
  if (!userId) return [];
    const data = await api.get(API_ROUTES.USER_SERVICES, { user_id: userId, is_sales: String(isSalesUser) }, undefined, { signal });
    const userServicesData = Array.isArray(data) ? data : (data?.user_services || data?.data || data?.result || []);

    if (userServicesData.length === 0 || (userServicesData.length === 1 && Object.keys(userServicesData[0]).length === 0)) {
      return [];
    }

    const mapped = userServicesData.map((apiService: any) => ({
      id: apiService.id ? String(apiService.id) : `srv_${Math.random().toString(36).substr(2, 9)}`,
      name: apiService.name || t('General.unknown'),
      category: apiService.category || t('General.notAvailable'),
      price: apiService.price || 0,
      currency: apiService.currency || getClinicCurrency(),
      duration_minutes: apiService.duration_minutes || 0,
      is_active: apiService.is_active,
      is_sales: apiService.is_sales as boolean | undefined,
    }));
    // Filter client-side when the backend returns is_sales in the response
    return mapped.filter((s: { is_sales?: boolean }) => s.is_sales === undefined || s.is_sales === isSalesUser);
}

async function getAllServices(isSalesUser: boolean): Promise<Service[]> {
    const result = isSalesUser ? await getSalesServices({ limit: 100 }) : await getPurchaseServices({ limit: 100 });
    return result.items.map((service: any) => ({ id: String(service.id), name: service.name, category: service.category, price: service.price, currency: service.currency || getClinicCurrency(), duration_minutes: service.duration_minutes, is_active: service.is_active, is_sales: service.is_sales as boolean | undefined }));
}

async function assignServicesToUser(userId: string, services: UserServiceAssignment[]): Promise<any> {
  const response = await api.patch(API_ROUTES.USER_SERVICES_ASSIGN, { user_id: userId, services: services }, undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.mutation });
  const first = Array.isArray(response) ? response[0] : response;
  if (first?.error || (first?.code && Number(first.code) >= 400)) {
    throw new Error(first?.message || (typeof first?.error === 'string' ? first.error : '') || 'Failed to assign services');
  }
  return response;
}

interface UserServicesProps {
  userId: string;
  isSalesUser: boolean;
}

export function UserServices({ userId, isSalesUser }: UserServicesProps) {
  const t = useTranslations();
  const [allServices, setAllServices] = React.useState<Service[]>([]);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [selectedServices, setSelectedServices] = React.useState<UserServiceAssignment[]>([]);
  const { toast } = useToast();
  const columns = React.useMemo(() => getColumns(t), [t]);

  // Switching users quickly can't show another user's services: only the latest load writes.
  const {
    data: userServices,
    isLoading,
    isRefreshing,
    error: loadError,
    reload: loadUserServices,
  } = useDataLoader(
    (signal) => getServicesForUser(userId, t, isSalesUser, signal),
    [] as Service[],
    [userId, isSalesUser]
  );

  // Opening the dialog fetches the catalog; a failed fetch must not open an empty picker.
  const openAssignDialog = useAsyncAction(
    () => getAllServices(isSalesUser),
    {
      onSuccess: (services) => {
        setAllServices(services);
        const assignedServices: UserServiceAssignment[] = userServices.map(service => ({
          service_id: service.id,
          is_active: service.is_active,
          duration_minutes: service.duration_minutes,
        }));
        setSelectedServices(assignedServices);
        setIsDialogOpen(true);
      },
      errorTitle: t('Common.loadError'),
    }
  );

  const assign = useAsyncAction(
    () => assignServicesToUser(userId, selectedServices),
    {
      onSuccess: async () => {
        toast({
          title: t('UserServices.toast.success'),
          description: t('UserServices.toast.servicesAssigned'),
        });
        await loadUserServices();
        setIsDialogOpen(false);
      },
      // The assignment may have been applied before the timeout: show the real state.
      onError: (error) => { if (isTimeoutError(error)) loadUserServices(); },
      errorTitle: t('UserServices.toast.servicesAssignFailed'),
    }
  );

  const handleServiceSelection = (serviceId: string, checked: boolean | 'indeterminate') => {
    setSelectedServices(prev => {
      if (checked) {
        const service = allServices.find(s => s.id === serviceId);
        return [...prev, { service_id: serviceId, is_active: true, duration_minutes: service?.duration_minutes }];
      } else {
        return prev.filter(s => s.service_id !== serviceId);
      }
    });
  };

  const handleServiceActiveChange = (serviceId: string, active: boolean) => {
    setSelectedServices(prev => prev.map(s =>
      s.service_id === serviceId ? { ...s, is_active: active } : s
    ));
  };

  const handleDurationChange = (serviceId: string, duration: string) => {
    setSelectedServices(prev => prev.map(s =>
      s.service_id === serviceId ? { ...s, duration_minutes: Number(duration) || 0 } : s
    ));
  };

  const handleSelectAll = () => {
    const allServiceAssignments: UserServiceAssignment[] = allServices.map(service => ({
      service_id: service.id,
      is_active: true,
      duration_minutes: service.duration_minutes
    }));
    setSelectedServices(allServiceAssignments);
  };

  const handleDeselectAll = () => {
    setSelectedServices([]);
  };


  if (isLoading) {
    return (
      <div className="space-y-2 pt-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={userServices}
        filterColumnId='name'
        filterPlaceholder={t('ServicesPage.filterPlaceholder')}
        onCreate={loadError || openAssignDialog.isPending ? undefined : () => openAssignDialog.run()}
        createButtonLabel={t('UserServices.addServices')}
        onRefresh={loadUserServices}
        isRefreshing={isRefreshing || openAssignDialog.isPending}
        loadError={loadError}
        columnTranslations={{
          name: t('ServicesColumns.name'),
          category: t('ServicesColumns.category'),
          price: t('ServicesColumns.price'),
          duration_minutes: t('ServicesColumns.duration'),
          is_active: t('UserRoles.columns.status'),
        }}
      />
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open && assign.isPending) return;
          setIsDialogOpen(open);
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('UserServices.dialog.title')}</DialogTitle>
            <DialogDescription>{t('UserServices.dialog.description')}</DialogDescription>
          </DialogHeader>
          {/* Native fieldset disables every control while the request is in flight */}
          <fieldset disabled={assign.isPending} className="min-w-0 py-4 px-6">
            <div className="flex justify-between items-center mb-4">
              <Label>{t('UserServices.dialog.availableServices')}</Label>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleSelectAll}>{t('UserServices.dialog.selectAll')}</Button>
                <Button variant="outline" size="sm" onClick={handleDeselectAll}>{t('UserServices.dialog.deselectAll')}</Button>
              </div>
            </div>
            <ScrollArea className="h-72 mt-2 border rounded-md p-4">
              <div className="space-y-4">
                {allServices.map(service => {
                  const isSelected = selectedServices.some(s => s.service_id === service.id);
                  const serviceData = selectedServices.find(s => s.service_id === service.id);
                  return (
                    <div key={service.id} className="flex items-center justify-between space-x-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`service-${service.id}`}
                          onCheckedChange={(checked) => handleServiceSelection(service.id, checked)}
                          checked={isSelected}
                        />
                        <Label htmlFor={`service-${service.id}`}>{service.name}</Label>
                      </div>
                      {isSelected && (
                        <div className="flex items-center space-x-8">
                          <div className="flex items-center space-x-2 w-32">
                            <Label htmlFor={`duration-${service.id}`} className="text-sm whitespace-nowrap">{t('UserServices.dialog.duration')}</Label>
                            <Input
                              id={`duration-${service.id}`}
                              type="number"
                              value={serviceData?.duration_minutes ?? ''}
                              onChange={(e) => handleDurationChange(service.id, e.target.value)}
                              className="h-8 w-20"
                            />
                          </div>
                          <div className="flex items-center space-x-2">
                            <Label htmlFor={`active-switch-${service.id}`} className="text-sm">{t('UserServices.dialog.activeLabel')}</Label>
                            <Switch
                              id={`active-switch-${service.id}`}
                              checked={serviceData?.is_active}
                              onCheckedChange={(checked) => handleServiceActiveChange(service.id, checked)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </fieldset>
          <DialogFooter>
            <Button onClick={() => assign.run()} loading={assign.isPending}>{t('UserServices.dialog.assign')}</Button>
            <DialogCancelButton disabled={assign.isPending}>{t('UserServices.dialog.cancel')}</DialogCancelButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
