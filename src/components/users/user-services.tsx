'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Service, UserRoleAssignment } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from 'next-intl';

const columns: ColumnDef<Service>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Service" />,
  },
  {
    accessorKey: 'category',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Category" />,
  },
  {
    accessorKey: 'price',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Price" />,
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('price'));
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amount);
      return <div className="font-medium">{formatted}</div>;
    },
  },
];

async function getServicesForUser(userId: string): Promise<Service[]> {
  if (!userId) return [];
  try {
    const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/user_services?user_id=${userId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    const userServicesData = Array.isArray(data) ? data : (data.user_services || data.data || data.result || []);

    return userServicesData.map((apiService: any) => ({
      id: apiService.id ? String(apiService.id) : `srv_${Math.random().toString(36).substr(2, 9)}`,
      name: apiService.name || 'Unknown Service',
      category: apiService.category || 'N/A',
      price: apiService.price || 0,
      duration_minutes: apiService.duration_minutes || 0,
    }));
  } catch (error) {
    console.error("Failed to fetch user services:", error);
    return [];
  }
}

async function getAllServices(): Promise<Service[]> {
  try {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/services', {
      method: 'GET',
      mode: 'cors',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Failed to fetch services');
    const data = await response.json();
    const servicesData = Array.isArray(data) ? data : (data.services || data.data || []);
    return servicesData.map((service: any) => ({ id: String(service.id), name: service.name, category: service.category, price: service.price, duration_minutes: service.duration_minutes }));
  } catch (error) {
    console.error("Failed to fetch all services:", error);
    return [];
  }
}

async function assignServicesToUser(userId: string, serviceIds: string[]): Promise<any> {
    const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/user_services/assign`, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, service_ids: serviceIds }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to assign services' }));
        throw new Error(errorData.message || `Error HTTP: ${response.status}`);
    }
    return response.json();
}

interface UserServicesProps {
  userId: string;
}

export function UserServices({ userId }: UserServicesProps) {
  const t = useTranslations('UserServices');
  const [userServices, setUserServices] = React.useState<Service[]>([]);
  const [allServices, setAllServices] = React.useState<Service[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [selectedServiceIds, setSelectedServiceIds] = React.useState<string[]>([]);
  const { toast } = useToast();

  const loadUserServices = React.useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    const fetchedUserServices = await getServicesForUser(userId);
    setUserServices(fetchedUserServices);
    setIsLoading(false);
  }, [userId]);

  React.useEffect(() => {
    loadUserServices();
  }, [loadUserServices]);

  const handleAddService = async () => {
    const services = await getAllServices();
    setAllServices(services);
    setSelectedServiceIds(userServices.map(s => s.id));
    setIsDialogOpen(true);
  };
  
  const handleAssignServices = async () => {
    try {
        await assignServicesToUser(userId, selectedServiceIds);
        toast({
            title: t('toast.success'),
            description: t('toast.servicesAssigned'),
        });
        setIsDialogOpen(false);
        loadUserServices();
    } catch (error) {
         toast({
            variant: "destructive",
            title: t('toast.error'),
            description: error instanceof Error ? error.message : t('toast.servicesAssignFailed'),
        });
    }
  };

  const handleServiceSelection = (serviceId: string, checked: boolean | 'indeterminate') => {
      setSelectedServiceIds(prev => {
          if (checked) {
              return [...prev, serviceId];
          } else {
              return prev.filter(id => id !== serviceId);
          }
      });
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
    <Card>
      <CardContent className="p-4">
        <DataTable
          columns={columns}
          data={userServices}
          filterColumnId='name'
          filterPlaceholder='Filter by service...'
          onCreate={handleAddService}
        />
      </CardContent>
    </Card>
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{t('dialog.title')}</DialogTitle>
                <DialogDescription>{t('dialog.description')}</DialogDescription>
            </DialogHeader>
            <div className="py-4">
                <Label>{t('dialog.availableServices')}</Label>
                <ScrollArea className="h-64 mt-2 border rounded-md p-4">
                   <div className="space-y-2">
                        {allServices.map(service => {
                            const isSelected = selectedServiceIds.includes(service.id);
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
                                </div>
                            );
                        })}
                    </div>
                </ScrollArea>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>{t('dialog.cancel')}</Button>
                <Button onClick={handleAssignServices}>{t('dialog.assign')}</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}
