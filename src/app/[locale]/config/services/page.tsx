
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ServicesColumnsWrapper } from './columns';
import { Service } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

const serviceFormSchema = z.object({
  id: z.string().optional(),
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
      is_active: apiService.is_active,
    }));
  } catch (error) {
    console.error("Failed to fetch services:", error);
    return [];
  }
}

async function upsertService(serviceData: ServiceFormValues) {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/catalogoservicios/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serviceData),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to save service' }));
        throw new Error(errorData.message);
    }
    return response.json();
}

async function deleteService(id: string) {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/catalogoservicios/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
    });
     if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to delete service' }));
        throw new Error(errorData.message);
    }
    return response.json();
}

export default function ServicesPage() {
  const [services, setServices] = React.useState<Service[]>([]);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingService, setEditingService] = React.useState<Service | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [deletingService, setDeletingService] = React.useState<Service | null>(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [submissionError, setSubmissionError] = React.useState<string | null>(null);

  const { toast } = useToast();

  const form = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceFormSchema),
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

  const handleCreate = () => {
    setEditingService(null);
    form.reset({
      name: '',
      category: '',
      price: 0,
      duration_minutes: 60,
      description: '',
      indications: '',
    });
    setSubmissionError(null);
    setIsDialogOpen(true);
  };
  
  const handleEdit = (service: Service) => {
    setEditingService(service);
    form.reset({
        id: service.id,
        name: service.name,
        category: service.category,
        price: service.price,
        duration_minutes: service.duration_minutes,
        description: service.description,
        indications: service.indications,
    });
    setSubmissionError(null);
    setIsDialogOpen(true);
  };

  const handleDelete = (service: Service) => {
    setDeletingService(service);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingService) return;
    try {
        await deleteService(deletingService.id);
        toast({
            title: "Service Deleted",
            description: `Service "${deletingService.name}" has been deleted.`,
        });
        setIsDeleteDialogOpen(false);
        setDeletingService(null);
        loadServices();
    } catch (error) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: error instanceof Error ? error.message : "Could not delete the service.",
        });
    }
  };

  const onSubmit = async (values: ServiceFormValues) => {
    setSubmissionError(null);
    try {
        await upsertService(values);
        toast({
            title: editingService ? "Service Updated" : "Service Created",
            description: `Service "${values.name}" has been saved successfully.`,
        });
        setIsDialogOpen(false);
        loadServices();
    } catch (error) {
        setSubmissionError(error instanceof Error ? error.message : "An unexpected error occurred.");
    }
  };
  
  const servicesColumns = ServicesColumnsWrapper({ onEdit: handleEdit, onDelete: handleDelete });


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
          onCreate={handleCreate}
          onRefresh={loadServices}
          isRefreshing={isRefreshing}
        />
      </CardContent>
    </Card>

    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingService ? 'Edit Service' : 'Create New Service'}</DialogTitle>
          <DialogDescription>
            {editingService ? 'Update the details for this service.' : 'Fill in the details below to add a new service.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                {submissionError && (
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{submissionError}</AlertDescription>
                    </Alert>
                )}
                 <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g., Initial Consultation" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Category</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g., Consulting" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Price</FormLabel>
                        <FormControl>
                            <Input type="number" placeholder="0.00" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="duration_minutes"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Duration (min)</FormLabel>
                        <FormControl>
                            <Input type="number" placeholder="60" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                            <Textarea placeholder="Describe the service" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="indications"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Indications</FormLabel>
                        <FormControl>
                            <Textarea placeholder="Enter indications for this service" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <DialogFooter>
                    <Button variant="outline" type="button" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                    <Button type="submit">{editingService ? 'Save Changes' : 'Create Service'}</Button>
                </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>

    <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will permanently delete the service "{deletingService?.name}". This action cannot be undone.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
