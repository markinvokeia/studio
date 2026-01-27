'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { AlertCategory, CommunicationTemplate } from '@/lib/types';
import api from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef, ColumnFiltersState, PaginationState } from '@tanstack/react-table';
import { AlertTriangle, Bold, Code2, Italic, List, MoreHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

const templateFormSchema = (t: (key: string) => string) => z.object({
    id: z.union([z.string(), z.number()]).optional(),
    code: z.string().min(1, t('validation.codeRequired')),
    name: z.string().min(1, t('validation.nameRequired')),
    type: z.enum(['EMAIL', 'SMS', 'DOCUMENT', 'WHATSAPP']),
    category_id: z.coerce.number().optional(),
    subject: z.string().optional(),
    body_html: z.string().optional(),
    body_text: z.string().optional(),
    variables_schema: z.any().optional(),
    default_sender: z.string().optional(),
    attachments_config: z.any().optional(),
    is_active: z.boolean().default(true),
    version: z.coerce.number().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
});

type TemplateFormValues = z.infer<ReturnType<typeof templateFormSchema>>;

const upsertTemplate = async (data: any) => {
    try {
        return await api.post(API_ROUTES.SYSTEM.COMMUNICATION_TEMPLATES, data);
    }
    catch (error) {
        console.error('Failed to upsert communication template', error);
        throw error;
    }
};

const deleteTemplate = async (id: string) => {
    try {
        return await api.delete(API_ROUTES.SYSTEM.COMMUNICATION_TEMPLATES, { id });
    }
    catch (error) {
        console.error('Failed to delete communication template', error);
        throw error;
    }
};


async function getTemplates(params: { search?: string; is_active?: boolean; page?: number; limit?: number } = {}): Promise<{ data: CommunicationTemplate[]; total: number; page: number; limit: number }> {
    try {
        const query: Record<string, string> = {};
        if (params.search) query.search = params.search;
        if (params.is_active !== undefined) query.is_active = params.is_active.toString();
        if (params.page) query.page = params.page.toString();
        if (params.limit) query.limit = params.limit.toString();
        const response = await api.get(API_ROUTES.SYSTEM.COMMUNICATION_TEMPLATES, query);
        return {
            data: response,
            total: response.length,
            page: params.page || 1,
            limit: params.limit || 10
        };
    } catch (error) {
        console.error('Failed to fetch templates:', error);
        throw error;
    }
};

async function getCategories(params: { search?: string; is_active?: boolean; page?: number; limit?: number } = {}): Promise<{ data: AlertCategory[]; total: number; page: number; limit: number }> {
    try {
        const query: Record<string, string> = {};
        if (params.search) query.search = params.search;
        if (params.is_active !== undefined) query.is_active = params.is_active.toString();
        if (params.page) query.page = params.page.toString();
        if (params.limit) query.limit = params.limit.toString();
        const response = await api.get(API_ROUTES.SYSTEM.ALERT_CATEGORIES, query);
        return {
            data: response,
            total: response.length,
            page: params.page || 1,
            limit: params.limit || 10
        };
    } catch (error) {
        console.error('Failed to fetch categories:', error);
        throw error;
    }
};

const availableVariables = {
    'patient': ['full_name', 'first_name', 'last_name', 'email', 'phone', 'document_id'],
    'appointment': ['date', 'time', 'doctor_name', 'specialty', 'location'],
    'invoice': ['number', 'total', 'due_date', 'balance'],
    'payment': ['amount'],
    'clinic': ['name', 'phone', 'address', 'email'],
    'system': ['current_date'],
};

export default function CommunicationTemplatesPage() {
    const t = useTranslations('CommunicationTemplatesPage');
    const { toast } = useToast();
    const [templates, setTemplates] = React.useState<CommunicationTemplate[]>([]);
    const [categories, setCategories] = React.useState<AlertCategory[]>([]);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [templatesPagination, setTemplatesPagination] = React.useState({ total: 0, page: 1, limit: 10 });

    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingTemplate, setEditingTemplate] = React.useState<CommunicationTemplate | null>(null);

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [deletingTemplate, setDeletingTemplate] = React.useState<CommunicationTemplate | null>(null);

    const [submissionError, setSubmissionError] = React.useState<string | null>(null);
    const [showPreview, setShowPreview] = React.useState(false);

    const form = useForm<TemplateFormValues>({
        resolver: zodResolver(templateFormSchema(t)),
    });

    const watchedBodyHtml = form.watch('body_html');
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    const insertText = (text: string) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const currentText = textarea.value;
        const newText = currentText.substring(0, start) + text + currentText.substring(end);

        form.setValue('body_html', newText, { shouldValidate: true });

        setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = start + text.length;
            textarea.focus();
        }, 0);
    };

    const wrapText = (wrapper: [string, string]) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end);
        const newText = `${textarea.value.substring(0, start)}${wrapper[0]}${selectedText}${wrapper[1]}${textarea.value.substring(end)}`;

        form.setValue('body_html', newText, { shouldValidate: true });

        setTimeout(() => {
            textarea.selectionStart = start + wrapper[0].length;
            textarea.selectionEnd = end + wrapper[0].length;
            textarea.focus();
        }, 0);
    };

    const loadData = React.useCallback(async () => {
        setIsRefreshing(true);
        const searchQuery = (columnFilters.find(f => f.id === 'name')?.value as string) || '';
        const templatesResponse = await getTemplates({
            search: searchQuery || undefined,
            page: pagination.pageIndex + 1,
            limit: pagination.pageSize
        });
        const categoriesResponse = await getCategories({
            search: searchQuery || undefined,
            page: 1,
            limit: 100
        });
        setTemplates(templatesResponse.data.filter(template => Object.keys(template).length > 0));
        setTemplatesPagination({
            total: templatesResponse.total,
            page: templatesResponse.page,
            limit: templatesResponse.limit
        });
        setCategories(categoriesResponse.data);
        setIsRefreshing(false);
    }, [pagination, columnFilters]);

    React.useEffect(() => {
        loadData();
    }, [loadData]);

    const handleCreate = () => {
        setEditingTemplate(null);
        form.reset({
            code: '',
            name: '',
            type: 'EMAIL',
            is_active: true,
            subject: '',
            body_html: '',
            body_text: '',
            default_sender: '',
            variables_schema: {},
            attachments_config: {},
            version: 1
        });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleEdit = (template: CommunicationTemplate) => {
        setEditingTemplate(template);
        form.reset({
            ...template,
            version: (template.version || 1) + 1
        });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleDelete = (template: CommunicationTemplate) => {
        setDeletingTemplate(template);
        setIsDeleteDialogOpen(true);
    };

    const handleDuplicate = (template: CommunicationTemplate) => {
        setEditingTemplate(null);
        form.reset({
            ...template,
            id: undefined,
            version: 1,
            name: template.name + ' (Copy)',
        });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!deletingTemplate?.id) return;
        try {
            await deleteTemplate(deletingTemplate.id);
            toast({ title: t('toast.deleteSuccessTitle'), description: t('toast.deleteSuccessDescription', { name: deletingTemplate.name }) });
            setIsDeleteDialogOpen(false);
            setDeletingTemplate(null);
            loadData();
        } catch (error) {
            toast({ title: t('toast.errorTitle'), description: error instanceof Error ? error.message : 'Failed to delete template', variant: 'destructive' });
        }
    };

    const onSubmit = async (values: TemplateFormValues) => {
        try {
            setSubmissionError(null);
            await upsertTemplate(values);
            toast({ title: editingTemplate ? t('toast.editSuccessTitle') : t('toast.createSuccessTitle'), description: t('toast.successDescription', { name: values.name }) });
            setIsDialogOpen(false);
            loadData();
        } catch (error) {
            setSubmissionError(error instanceof Error ? error.message : 'An error occurred');
        }
    };

    const columns: ColumnDef<CommunicationTemplate>[] = [
        { accessorKey: 'name', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.name')} /> },
        {
            accessorKey: 'type', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.type')} />,
            cell: ({ row }) => <Badge variant="secondary">{row.original.type}</Badge>
        },
        {
            accessorKey: 'version', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.version')} />,
            cell: ({ row }) => <Badge variant="outline">v{row.original.version || 1}</Badge>
        },
        {
            accessorKey: 'category_id', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.category')} />,
            cell: ({ row }) => categories.find(c => String(c.id) === String(row.original.category_id))?.name || 'N/A'
        },
        {
            accessorKey: 'is_active',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.isActive')} />,
            cell: ({ row }) => <Badge variant={row.original.is_active ? 'success' : 'outline'}>{row.original.is_active ? t('columns.yes') : t('columns.no')}</Badge>
        },
        {
            id: 'actions',
            cell: ({ row }) => {
                const template = row.original;
                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>{t('columns.actions')}</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleEdit(template)}>{t('columns.edit')}</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicate(template)}>{t('columns.duplicate')}</DropdownMenuItem>
                            <DropdownMenuItem>{t('columns.preview')}</DropdownMenuItem>
                            <DropdownMenuItem>{t('columns.history')}</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDelete(template)} className="text-destructive">{t('columns.delete')}</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
        },
    ];

    return (
        <>
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <CardHeader className="flex-none">
                        <CardTitle>{t('title')}</CardTitle>
                        <CardDescription>{t('description')}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden">
                        <DataTable
                            columns={columns}
                            data={templates}
                            filterColumnId="name"
                            filterPlaceholder={t('filterPlaceholder')}
                            onCreate={handleCreate}
                            onRefresh={loadData}
                            isRefreshing={isRefreshing}
                            pageCount={Math.ceil(templatesPagination.total / pagination.pageSize)}
                            pagination={pagination}
                            onPaginationChange={setPagination}
                            columnFilters={columnFilters}
                            onColumnFiltersChange={setColumnFilters}
                            manualPagination={true}
                        />
                    </CardContent>
                </Card>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>{editingTemplate ? t('dialog.editTitle') : t('dialog.createTitle')}</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
                            {submissionError && (
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>{t('toast.errorTitle')}</AlertTitle>
                                    <AlertDescription>{submissionError}</AlertDescription>
                                </Alert>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>{t('dialog.name')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="code" render={({ field }) => (<FormItem><FormLabel>{t('dialog.code')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="version" render={({ field }) => (<FormItem><FormLabel>{t('dialog.version')}</FormLabel><FormControl><Input {...field} value={field.value || (editingTemplate ? (editingTemplate.version || 1) + 1 : 1)} readOnly className="bg-muted" /></FormControl><FormMessage /></FormItem>)} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="type" render={({ field }) => (<FormItem><FormLabel>{t('dialog.type')}</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder={t('dialog.selectType')} /></SelectTrigger></FormControl><SelectContent><SelectItem value="EMAIL">Email</SelectItem><SelectItem value="SMS">SMS</SelectItem><SelectItem value="DOCUMENT">Document</SelectItem><SelectItem value="WHATSAPP">WhatsApp</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="category_id" render={({ field }) => (<FormItem><FormLabel>{t('dialog.category')}</FormLabel><Select onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)} value={field.value?.toString()}><FormControl><SelectTrigger><SelectValue placeholder={t('dialog.selectCategory')} /></SelectTrigger></FormControl><SelectContent>{categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                            </div>
                            <FormField control={form.control} name="subject" render={({ field }) => (<FormItem><FormLabel>{t('dialog.subject')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="default_sender" render={({ field }) => (<FormItem><FormLabel>{t('dialog.defaultSender')}</FormLabel><FormControl><Input {...field} placeholder="sender@example.com" /></FormControl><FormMessage /></FormItem>)} />

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <FormLabel>{t('dialog.body')}</FormLabel>
                                    <div className="flex items-center gap-2">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline" size="sm"><Code2 className="mr-2 h-4 w-4" /> {t('dialog.variables.title')}</Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent>
                                                {Object.entries(availableVariables).map(([group, vars]) => (
                                                    <React.Fragment key={group}>
                                                        <DropdownMenuLabel className="capitalize">{group}</DropdownMenuLabel>
                                                        {vars.map(variable => (
                                                            <DropdownMenuItem key={variable} onSelect={() => insertText(`{{${group}.${variable}}}`)}>
                                                                {`{{${group}.${variable}}}`}
                                                            </DropdownMenuItem>
                                                        ))}
                                                        <DropdownMenuSeparator />
                                                    </React.Fragment>
                                                ))}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                        <div className="flex items-center space-x-1 border rounded-md p-1">
                                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => wrapText(['<strong>', '</strong>'])}><Bold className="h-4 w-4" /></Button>
                                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => wrapText(['<em>', '</em>'])}><Italic className="h-4 w-4" /></Button>
                                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertText('<ul>\n  <li>Item 1</li>\n</ul>')}><List className="h-4 w-4" /></Button>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Switch id="preview-mode" checked={showPreview} onCheckedChange={setShowPreview} />
                                            <Label htmlFor="preview-mode">{t('dialog.preview.title')}</Label>
                                        </div>
                                    </div>
                                </div>
                                {showPreview ? (
                                    <div className="h-64 rounded-md border bg-muted p-4 overflow-y-auto" dangerouslySetInnerHTML={{ __html: watchedBodyHtml?.replace(/{{(.*?)}}/g, (match, p1) => `<span class="bg-primary/20 text-primary-foreground rounded px-1">${p1.trim()}</span>`) || '' }} />
                                ) : (
                                    <FormField control={form.control} name="body_html" render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <Textarea
                                                    {...field}
                                                    ref={textareaRef}
                                                    rows={12}
                                                    className="font-mono"
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                )}
                            </div>

                            <FormField control={form.control} name="is_active" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0 pt-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>{t('dialog.isActive')}</FormLabel></FormItem>)} />

                            <DialogFooter className="sticky bottom-0 bg-background pt-4">
                                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>{t('dialog.cancel')}</Button>
                                <Button type="submit">{editingTemplate ? t('dialog.save') : t('dialog.create')}</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
                        <AlertDialogDescription>{t('deleteDialog.description', { name: deletingTemplate?.name })}</AlertDialogDescription>
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
