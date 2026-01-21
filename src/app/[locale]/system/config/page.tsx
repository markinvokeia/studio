
'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTable } from '@/components/ui/data-table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { SystemConfiguration } from '@/lib/types';
import api from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { ConfigsColumnsWrapper } from './columns';

const configFormSchema = (t: (key: string) => string) => z.object({
    id: z.string().optional(),
    key: z.string().min(1, t('validation.keyRequired')),
    value: z.string().min(1, t('validation.valueRequired')),
    description: z.string().optional(),
    data_type: z.enum(['string', 'number', 'boolean', 'json'], {
        required_error: t('validation.dataTypeRequired'),
    }),
    is_public: z.boolean().default(false),
});

type ConfigFormValues = z.infer<ReturnType<typeof configFormSchema>>;

async function getConfigs(): Promise<SystemConfiguration[]> {
    try {
        const data = await api.get(API_ROUTES.SYSTEM.CONFIGS);
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
    const responseData = await api.post(API_ROUTES.SYSTEM.CONFIGS_UPSERT, configData);
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        const message = responseData[0]?.message ? responseData[0].message : 'Failed to save configuration';
        throw new Error(message);
    }
    return responseData;
}

async function deleteConfig(id: string) {
    const responseData = await api.delete(API_ROUTES.SYSTEM.CONFIGS_DELETE, { id });
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        const message = responseData[0]?.message ? responseData[0].message : 'Failed to delete configuration';
        throw new Error(message);
    }
    return responseData;
}

export default function SystemConfigPage() {
    const t = useTranslations('ConfigurationsPage');
    const tValidation = useTranslations('ConfigurationsPage');
    const { toast } = useToast();
    const [configs, setConfigs] = React.useState<SystemConfiguration[]>([]);
    const [isRefreshing, setIsRefreshing] = React.useState(false);

    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingConfig, setEditingConfig] = React.useState<SystemConfiguration | null>(null);

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [deletingConfig, setDeletingConfig] = React.useState<SystemConfiguration | null>(null);
    const [submissionError, setSubmissionError] = React.useState<string | null>(null);

    const form = useForm<ConfigFormValues>({
        resolver: zodResolver(configFormSchema(tValidation)),
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
                title: t('toast.deleteTitle'),
                description: t('toast.deleteDescription', { key: deletingConfig.key }),
            });
            setIsDeleteDialogOpen(false);
            setDeletingConfig(null);
            loadConfigs();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: t('toast.errorTitle'),
                description: error instanceof Error ? error.message : t('toast.deleteError'),
            });
        }
    };

    const onSubmit = async (values: ConfigFormValues) => {
        setSubmissionError(null);
        try {
            await upsertConfig(values);
            toast({
                title: editingConfig ? t('toast.editTitle') : t('toast.createTitle'),
                description: t('toast.successDescription', { key: values.key }),
            });
            setIsDialogOpen(false);
            loadConfigs();
        } catch (error) {
            setSubmissionError(error instanceof Error ? error.message : t('toast.genericError'));
        }
    };

    const configsColumns = ConfigsColumnsWrapper({ onEdit: handleEdit, onDelete: handleDelete });

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>{t('title')}</CardTitle>
                    <CardDescription>{t('description')}</CardDescription>
                </CardHeader>
                <CardContent>
                    <DataTable
                        columns={configsColumns}
                        data={configs}
                        filterColumnId="key"
                        filterPlaceholder={t('filterPlaceholder')}
                        onCreate={handleCreate}
                        onRefresh={loadConfigs}
                        isRefreshing={isRefreshing}
                        columnTranslations={{
                            id: t('columns.id'),
                            key: t('columns.key'),
                            value: t('columns.value'),
                            description: t('columns.description'),
                            data_type: t('columns.type'),
                            is_public: t('columns.isPublic'),
                            updated_by: t('columns.updatedBy'),
                        }}
                    />
                </CardContent>
            </Card>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingConfig ? t('dialog.editTitle') : t('dialog.createTitle')}</DialogTitle>
                        <DialogDescription>
                            {editingConfig ? t('dialog.editDescription') : t('dialog.createDescription')}
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                            {submissionError && (
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>{t('toast.errorTitle')}</AlertTitle>
                                    <AlertDescription>{submissionError}</AlertDescription>
                                </Alert>
                            )}
                            <FormField
                                control={form.control}
                                name="key"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('dialog.key')}</FormLabel>
                                        <FormControl>
                                            <Input placeholder={t('dialog.keyPlaceholder')} {...field} />
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
                                        <FormLabel>{t('dialog.value')}</FormLabel>
                                        <FormControl>
                                            <Input placeholder={t('dialog.valuePlaceholder')} {...field} />
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
                                        <FormLabel>{t('dialog.description')}</FormLabel>
                                        <FormControl>
                                            <Textarea placeholder={t('dialog.descriptionPlaceholder')} {...field} />
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
                                        <FormLabel>{t('dialog.dataType')}</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder={t('dialog.selectDataType')} />
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
                                            <FormLabel>{t('dialog.isPublic')}</FormLabel>
                                            <FormDescription>
                                                {t('dialog.isPublicDescription')}
                                            </FormDescription>
                                        </div>
                                    </FormItem>
                                )}
                            />
                            <DialogFooter>
                                <Button variant="outline" type="button" onClick={() => setIsDialogOpen(false)}>{t('dialog.cancel')}</Button>
                                <Button type="submit">{editingConfig ? t('dialog.save') : t('dialog.create')}</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('deleteDialog.description', { key: deletingConfig?.key })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('deleteDialog.cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">{t('deleteDialog.confirm')}</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
