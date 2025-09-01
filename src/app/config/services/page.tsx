'use client';

import * as React from 'react';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { servicesColumns } from './columns';
import { Service } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

async function getServices(): Promise<Service[]> {
  try {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/services', {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    const servicesData = Array.isArray(data) ? data : (data.services || data.data || data.result || []);

    return servicesData.map((apiService: any) => ({
      id: apiService.id ? String(apiService.id) : `srv_${Math.random().toString(36).substr(2, 9)}`,
      name: apiService.name || 'No Name',
      category: apiService.category || 'No Category',
      price: apiService.price || 0,
      duration_minutes: apiService.duration_minutes || 0,
    }));
  } catch (error) {
    console.error("Failed to fetch services:", error);
    return [];
  }
}

export default function ServicesPage() {
  const [services, setServices] = React.useState<Service[]>([]);
  const [isCreateOpen, setCreateOpen] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const loadServices = React.useCallback(async () => {
    setIsRefreshing(true);
    const fetchedServices = await getServices();
    setServices(fetchedServices);
    setIsRefreshing(false);
  }, []);

  React.useEffect(() => {
    loadServices();
  }, [loadServices]);


  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>Service Catalog</CardTitle>
        <CardDescription>Manage business services.</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable 
          columns={servicesColumns} 
          data={services} 
          filterColumnId="name" 
          filterPlaceholder="Filter services by name..." 
          onCreate={() => setCreateOpen(true)}
          onRefresh={loadServices}
          isRefreshing={isRefreshing}
        />
      </CardContent>
    </Card>

    <Dialog open={isCreateOpen} onOpenChange={setCreateOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Service</DialogTitle>
          <DialogDescription>
            Fill in the details below to add a new service.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input id="name" placeholder="e.g., Initial Consultation" className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="category" className="text-right">
              Category
            </Label>
            <Input id="category" placeholder="e.g., Consulting" className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="price" className="text-right">
              Price
            </Label>
            <Input id="price" type="number" placeholder="0.00" className="col-span-3" />
          </div>
           <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="duration" className="text-right">
              Duration (min)
            </Label>
            <Input id="duration" type="number" placeholder="60" className="col-span-3" />
          </div>
        </div>
         <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit">Create Service</Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
