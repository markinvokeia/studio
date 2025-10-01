
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const serviceFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  category: z.string().min(1, 'Category is required'),
  price: z.coerce.number().positive('Price must be a positive number'),
  duration_minutes: z.coerce.number().int().positive('Duration must be a positive integer'),
  description: z.string().optional(),
  indications: z.string().optional(),
});

type ServiceFormValues = z.infer<typeof serviceFormSchema>;

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
      description: apiService.description,
      indications: apiService.indications,
    }));
  } catch (error) {
    console.error("Failed to fetch services:", error);
    return [];
  }
}

async function createService(serviceData: ServiceFormValues): Promise<any> {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/services', {
        method: 'POST',
        mode: 'cors',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(serviceData),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to create service' }));
        throw new Error(errorData.message || `Error HTTP: ${response.status}`);
    }

    return response.json();
}

export default function ServicesPage() {
  const [services, setServices] = React.useState<Service[]>([]);
  const [isCreateOpen, setCreateOpen] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const { toast } = useToast();

  const form = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: {
      name: '',
      category: '',
      price: 0,
      duration_minutes: 60,
      description: '',
      indications: '',
    },
  });

  const loadServices = React.useCallback(async () => {
    setIsRefreshing(true);
    const fetchedServices = await getServices();
    setServices(fetchedServices);
    setIsRefreshing(false);
  }, []);

  React.useEffect(() => {
    loadServices();
  }, [loadServices]);

  const onSubmit = async (values: ServiceFormValues) => {
    try {
        await createService(values);
        toast({
            title: "Service Created",
            description: `${values.name} has been successfully created.`,
        });
        setCreateOpen(false);
        form.reset();
        loadServices();
    } catch (error) {
        toast({
            variant: "destructive",
            title: "Error",
            description: error instanceof Error ? error.message : "An unexpected error occurred.",
        });
    }
  };


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
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
                 <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem className="grid grid-cols-4 items-center gap-4">
                        <FormLabel className="text-right">Name</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g., Initial Consultation" className="col-span-3" {...field} />
                        </FormControl>
                        <FormMessage className="col-span-4" />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                        <FormItem className="grid grid-cols-4 items-center gap-4">
                        <FormLabel className="text-right">Category</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g., Consulting" className="col-span-3" {...field} />
                        </FormControl>
                        <FormMessage className="col-span-4" />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                        <FormItem className="grid grid-cols-4 items-center gap-4">
                        <FormLabel className="text-right">Price</FormLabel>
                        <FormControl>
                            <Input type="number" placeholder="0.00" className="col-span-3" {...field} />
                        </FormControl>
                        <FormMessage className="col-span-4" />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="duration_minutes"
                    render={({ field }) => (
                        <FormItem className="grid grid-cols-4 items-center gap-4">
                        <FormLabel className="text-right">Duration (min)</FormLabel>
                        <FormControl>
                            <Input type="number" placeholder="60" className="col-span-3" {...field} />
                        </FormControl>
                        <FormMessage className="col-span-4" />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem className="grid grid-cols-4 items-start gap-4">
                        <FormLabel className="text-right pt-2">Description</FormLabel>
                        <FormControl>
                            <Textarea placeholder="Describe the service" className="col-span-3" {...field} />
                        </FormControl>
                        <FormMessage className="col-span-4" />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="indications"
                    render={({ field }) => (
                        <FormItem className="grid grid-cols-4 items-start gap-4">
                        <FormLabel className="text-right pt-2">Indications</FormLabel>
                        <FormControl>
                            <Textarea placeholder="Enter indications for this service" className="col-span-3" {...field} />
                        </FormControl>
                        <FormMessage className="col-span-4" />
                        </FormItem>
                    )}
                />
                <div className="flex justify-end space-x-2">
                    <Button variant="outline" type="button" onClick={() => setCreateOpen(false)}>Cancel</Button>
                    <Button type="submit">Create Service</Button>
                </div>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
    </>
  );
}
