
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import {
  Dialog,
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
import { useToast } from '@/hooks/use-toast';
import { Service } from '@/lib/types';
import { api } from '@/services/api';
import { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';

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
      const amount = parseFloat(row.getValue('price'));
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amount);
      return <div className="font-medium">{formatted}</div>;
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

async function getServicesForUser(userId: string, t: any): Promise<Service[]> {
  if (!userId) return [];
  try {
    const data = await api.get(API_ROUTES.USER_SERVICES, { user_id: userId });
    const userServicesData = Array.isArray(data) ? data : (data.user_services || data.data || data.result || []);

    if (userServicesData.length === 0 || (userServicesData.length === 1 && Object.keys(userServicesData[0]).length === 0)) {
      return [];
    }

    return userServicesData.map((apiService: any) => ({
      id: apiService.id ? String(apiService.id) : `srv_${Math.random().toString(36).substr(2, 9)}`,
      name: apiService.name || t('General.unknown'),
      category: apiService.category || t('General.notAvailable'),
      price: apiService.price || 0,
      duration_minutes: apiService.duration_minutes || 0,
      is_active: apiService.is_active,
    }));
  } catch (error) {
    console.error("Failed to fetch user services:", error);
    return [];
  }
}

async function getAllServices(isSalesUser: boolean): Promise<Service[]> {
  try {
    const data = await api.get(API_ROUTES.SERVICES, { is_sales: String(isSalesUser) });
    const servicesData = Array.isArray(data) ? data : (data.services || data.data || []);
    return servicesData.map((service: any) => ({ id: String(service.id), name: service.name, category: service.category, price: service.price, duration_minutes: service.duration_minutes, is_active: service.is_active }));
  } catch (error) {
    console.error("Failed to fetch all services:", error);
    return [];
  }
}

async function assignServicesToUser(userId: string, services: UserServiceAssignment[]): Promise<any> {
  return await api.patch(API_ROUTES.USER_SERVICES_ASSIGN, { user_id: userId, services: services });
}

interface UserServicesProps {
  userId: string;
  isSalesUser: boolean;
}

export function UserServices({ userId, isSalesUser }: UserServicesProps) {
  const t = useTranslations();
  const [userServices, setUserServices] = React.useState<Service[]>([]);
  const [allServices, setAllServices] = React.useState<Service[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [selectedServices, setSelectedServices] = React.useState<UserServiceAssignment[]>([]);
  const { toast } = useToast();
  const columns = React.useMemo(() => getColumns(t), [t]);

  const loadUserServices = React.useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    const fetchedUserServices = await getServicesForUser(userId, t);
    setUserServices(fetchedUserServices);
    setIsLoading(false);
  }, [userId]);

  React.useEffect(() => {
    loadUserServices();
  }, [loadUserServices]);

  const handleAddService = async () => {
    const services = await getAllServices(isSalesUser);
    setAllServices(services);
    const assignedServices: UserServiceAssignment[] = userServices.map(service => ({
      service_id: service.id,
      is_active: service.is_active,
      duration_minutes: service.duration_minutes,
    }));
    setSelectedServices(assignedServices);
    setIsDialogOpen(true);
  };

  const handleAssignServices = async () => {
    try {
      await assignServicesToUser(userId, selectedServices);
      toast({
        title: t('UserServices.toast.success'),
        description: t('UserServices.toast.servicesAssigned'),
      });
      setIsDialogOpen(false);
      loadUserServices();
    } catch (error) {
      toast({
        variant: "destructive",
        title: t('UserServices.toast.error'),
        description: error instanceof Error ? error.message : t('UserServices.toast.servicesAssignFailed'),
      });
    }
  };

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
        onCreate={handleAddService}
        columnTranslations={{
          name: t('ServicesColumns.name'),
          category: t('ServicesColumns.category'),
          price: t('ServicesColumns.price'),
          duration_minutes: t('ServicesColumns.duration'),
          is_active: t('UserRoles.columns.status'),
        }}
      />
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('UserServices.dialog.title')}</DialogTitle>
            <DialogDescription>{t('UserServices.dialog.description')}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>{t('UserServices.dialog.cancel')}</Button>
            <Button onClick={handleAssignServices}>{t('UserServices.dialog.assign')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
