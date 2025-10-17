
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SystemConfiguration } from '@/lib/types';
import { ConfigsColumnsWrapper } from './columns';
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
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

const configFormSchema = z.object({
  id: z.string().optional(),
  key: z.string().min(1, 'Key is required'),
  value: z.string().min(1, 'Value is required'),
  description: z.string().optional(),
  data_type: z.enum(['string', 'number', 'boolean', 'json'], {
    required_error: 'Data type is required',
  }),
  is_public: z.boolean().default(false),
});

type ConfigFormValues = z.infer<typeof configFormSchema>;

async function getConfigs(): Promise<SystemConfiguration[]> {
    try {
        const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/configs', {
            method: 'GET',
            mode: 'cors',
            headers: { 'Accept': 'application/json' },
            cache: 'no-store',
        });

        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        const configsData = Array.isArray(data) ? data : (data.configs || data.data || data.result || []);

        return configsData.map((apiConfig: any) => ({
            id: String(apiConfig.id),
            key: apiConfig.key,
            value: apiConfig.value,
            data_type: apiConfig.data_type,
            updated_by: apiConfig.updated_by,
            description: apiConfig.description,
            is_public: apiConfig.is_public,
        }));
    } catch (error) {
        console.error("Failed to fetch configurations:", error);
        return [];
    }
}

async function upsertConfig(configData: ConfigFormValues) {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/configs/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configData),
    });
    const responseData = await response.json();
    if (!response.ok || (Array.isArray(responseData) && responseData[0]?.code >= 400)) {
        const message = Array.isArray(responseData) && responseData[0]?.message ? responseData[0].message : 'Failed to save configuration';
        throw new Error(message);
    }
    return responseData;
}

async function deleteConfig(id: string) {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/configs/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
    });
    const responseData = await response.json();
     if (!response.ok || (Array.isArray(responseData) && responseData[0]?.code >= 400)) {
        const message = Array.isArray(responseData) && responseData[0]?.message ? responseData[0].message : 'Failed to delete configuration';
        throw new Error(message);
    }
    return responseData;
}

export default function SystemConfigPage() {
    const t = useTranslations('Navigation');
    const { toast } = useToast();
    const [configs, setConfigs] = React.useState<SystemConfiguration[]>([]);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingConfig, setEditingConfig] = React.useState<SystemConfiguration | null>(null);

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [deletingConfig, setDeletingConfig] = React.useState<SystemConfiguration | null>(null);
    const [submissionError, setSubmissionError] = React.useState<string | null>(null);

    const form = useForm<ConfigFormValues>({
        resolver: zodResolver(configFormSchema),
    });

    const loadConfigs = React.useCallback(async () => {
        setIsRefreshing(true);
        const fetchedConfigs = await getConfigs();
        setConfigs(fetchedConfigs);
        setIsRefreshing(false);
    }, []);

    React.useEffect(() => {
        loadConfigs();
    }, [loadConfigs]);
    
    const handleCreate = () => {
        setEditingConfig(null);
        form.reset({ key: '', value: '', description: '', data_type: 'string', is_public: false });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleEdit = (config: SystemConfiguration) => {
        setEditingConfig(config);
        form.reset({
          id: config.id,
          key: config.key,
          value: config.value,
          description: config.description,
          data_type: config.data_type,
          is_public: config.is_public,
        });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleDelete = (config: SystemConfiguration) => {
        setDeletingConfig(config);
        setIsDeleteDialogOpen(true);
    };
    
    const confirmDelete = async () => {
        if (!deletingConfig) return;
        try {
            await deleteConfig(deletingConfig.id);
            toast({
                title: "Configuration Deleted",
                description: `Configuration "${deletingConfig.key}" has been deleted.`,
            });
            setIsDeleteDialogOpen(false);
            setDeletingConfig(null);
            loadConfigs();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error instanceof Error ? error.message : "Could not delete the configuration.",
            });
        }
    };

    const onSubmit = async (values: ConfigFormValues) => {
        setSubmissionError(null);
        try {
            await upsertConfig(values);
            toast({
                title: editingConfig ? "Configuration Updated" : "Configuration Created",
                description: `The configuration "${values.key}" has been saved successfully.`,
            });
            setIsDialogOpen(false);
            loadConfigs();
        } catch (error) {
            setSubmissionError(error instanceof Error ? error.message : "An unexpected error occurred.");
        }
    };

    const configsColumns = ConfigsColumnsWrapper({ onEdit: handleEdit, onDelete: handleDelete });

    return (
        <>
        <Card>
            <CardHeader>
                <CardTitle>{t('Configurations')}</CardTitle>
                <CardDescription>Manage system-wide settings.</CardDescription>
            </CardHeader>
            <CardContent>
                <DataTable 
                    columns={configsColumns} 
                    data={configs} 
                    filterColumnId="key" 
                    filterPlaceholder="Filter configurations by key..."
                    onCreate={handleCreate}
                    onRefresh={loadConfigs}
                    isRefreshing={isRefreshing}
                />
            </CardContent>
        </Card>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{editingConfig ? 'Edit Configuration' : 'Create New Configuration'}</DialogTitle>
                    <DialogDescription>
                        {editingConfig ? 'Update the details for this configuration.' : 'Fill in the details below to add a new system configuration.'}
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
                            name="key"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Key</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g., API_ENDPOINT" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="value"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Value</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g., https://api.example.com" {...field} />
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
                                        <Textarea placeholder="Describe what this configuration is for." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="data_type"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Data Type</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a data type" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="string">String</SelectItem>
                                        <SelectItem value="number">Number</SelectItem>
                                        <SelectItem value="boolean">Boolean</SelectItem>
                                        <SelectItem value="json">JSON</SelectItem>
                                    </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="is_public"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                                    <FormControl>
                                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                        <FormLabel>Is Public</FormLabel>
                                        <FormDescription>
                                            Allow this configuration to be accessed from the client-side.
                                        </FormDescription>
                                    </div>
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button variant="outline" type="button" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                            <Button type="submit">{editingConfig ? 'Save Changes' : 'Create Configuration'}</Button>
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
                    This will permanently delete the configuration "{deletingConfig?.key}". This action cannot be undone.
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
