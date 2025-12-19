
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CommunicationTemplate, AlertCategory } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, MoreHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const templateFormSchema = (t: (key: string) => string) => z.object({
  id: z.string().optional(),
  code: z.string().min(1, t('CommunicationTemplatesPage.validation.codeRequired')),
  name: z.string().min(1, t('CommunicationTemplatesPage.validation.nameRequired')),
  type: z.enum(['EMAIL', 'SMS', 'DOCUMENT', 'WHATSAPP']),
  category_id: z.string().optional(),
  subject: z.string().optional(),
  body_html: z.string().optional(),
  body_text: z.string().optional(),
  is_active: z.boolean().default(true),
  version: z.coerce.number().optional(),
});

type TemplateFormValues = z.infer<ReturnType<typeof templateFormSchema>>;

// MOCK DATA
async function getTemplates(): Promise<CommunicationTemplate[]> {
    return [
        { id: '1', code: 'APPT_REMINDER_24H_EMAIL', name: 'Appointment Reminder 24h (Email)', type: 'EMAIL', category_id: '1', subject: 'Recordatorio de su cita en {{clinic.name}}', body_html: 'Estimado/a {{patient.first_name}}, le recordamos su cita para mañana a las {{appointment.time}}.', is_active: true, version: 1 },
        { id: '2', code: 'INV_OVERDUE_SMS', name: 'Invoice Overdue (SMS)', type: 'SMS', category_id: '2', body_text: '{{clinic.name}}: Su factura #{{invoice.number}} ha vencido. Total: {{invoice.total}}.', is_active: true, version: 1 },
        { id: '3', code: 'WELCOME_PATIENT', name: 'Welcome New Patient', type: 'EMAIL', category_id: '1', subject: 'Bienvenido/a a {{clinic.name}}', body_html: 'Gracias por elegirnos, {{patient.first_name}}!', is_active: false, version: 2 },
    ];
}
async function getCategories(): Promise<AlertCategory[]> {
    return [
        { id: '1', code: 'APPOINTMENTS', name: 'Appointments', is_active: true },
        { id: '2', code: 'BILLING', name: 'Billing', is_active: true },
    ];
}
// END MOCK DATA

export default function CommunicationTemplatesPage() {
    const t = useTranslations('CommunicationTemplatesPage');
    const { toast } = useToast();
    const [templates, setTemplates] = React.useState<CommunicationTemplate[]>([]);
    const [categories, setCategories] = React.useState<AlertCategory[]>([]);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingTemplate, setEditingTemplate] = React.useState<CommunicationTemplate | null>(null);

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [deletingTemplate, setDeletingTemplate] = React.useState<CommunicationTemplate | null>(null);

    const [submissionError, setSubmissionError] = React.useState<string | null>(null);

    const form = useForm<TemplateFormValues>({
        resolver: zodResolver(templateFormSchema(t)),
    });

    const watchedBodyHtml = form.watch('body_html');

    const loadData = React.useCallback(async () => {
        setIsRefreshing(true);
        const [fetchedTemplates, fetchedCategories] = await Promise.all([getTemplates(), getCategories()]);
        setTemplates(fetchedTemplates);
        setCategories(fetchedCategories);
        setIsRefreshing(false);
    }, []);

    React.useEffect(() => {
        loadData();
    }, [loadData]);

    const handleCreate = () => {
        setEditingTemplate(null);
        form.reset({ code: '', name: '', type: 'EMAIL', is_active: true, subject: '', body_html: '' });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };
    
    const handleEdit = (template: CommunicationTemplate) => {
        setEditingTemplate(template);
        form.reset({ ...template, category_id: String(template.category_id) });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleDelete = (template: CommunicationTemplate) => {
        setDeletingTemplate(template);
        setIsDeleteDialogOpen(true);
    };
    
    const confirmDelete = async () => {
        if (!deletingTemplate) return;
        toast({ title: t('toast.deleteSuccessTitle'), description: t('toast.deleteSuccessDescription', { name: deletingTemplate.name }) });
        setIsDeleteDialogOpen(false);
        setDeletingTemplate(null);
        loadData();
    };

    const onSubmit = async (values: TemplateFormValues) => {
        setSubmissionError(null);
        toast({ title: editingTemplate ? t('toast.editSuccessTitle') : t('toast.createSuccessTitle'), description: t('toast.successDescription', { name: values.name }) });
        setIsDialogOpen(false);
        loadData();
    };
    
    const columns: ColumnDef<CommunicationTemplate>[] = [
        { accessorKey: 'name', header: ({column}) => <DataTableColumnHeader column={column} title={t('columns.name')} /> },
        { accessorKey: 'type', header: ({column}) => <DataTableColumnHeader column={column} title={t('columns.type')} />,
            cell: ({ row }) => <Badge variant="secondary">{row.original.type}</Badge>
        },
        { accessorKey: 'category_id', header: ({column}) => <DataTableColumnHeader column={column} title={t('columns.category')} />,
            cell: ({ row }) => categories.find(c => c.id === row.original.category_id)?.name || 'N/A'
        },
        { accessorKey: 'is_active', header: ({column}) => <DataTableColumnHeader column={column} title={t('columns.isActive')} />,
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
                        <DropdownMenuItem>{t('columns.duplicate')}</DropdownMenuItem>
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
        <Card>
            <CardHeader>
                <CardTitle>{t('title')}</CardTitle>
                <CardDescription>{t('description')}</CardDescription>
            </CardHeader>
            <CardContent>
                <DataTable 
                    columns={columns} 
                    data={templates}
                    filterColumnId="name" 
                    filterPlaceholder={t('filterPlaceholder')}
                    onCreate={handleCreate}
                    onRefresh={loadData}
                    isRefreshing={isRefreshing}
                />
            </CardContent>
        </Card>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="max-w-5xl">
                <DialogHeader>
                    <DialogTitle>{editingTemplate ? t('dialog.editTitle') : t('dialog.createTitle')}</DialogTitle>
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>{t('dialog.name')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="code" render={({ field }) => (<FormItem><FormLabel>{t('dialog.code')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="type" render={({ field }) => (<FormItem><FormLabel>{t('dialog.type')}</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder={t('dialog.selectType')} /></SelectTrigger></FormControl><SelectContent><SelectItem value="EMAIL">Email</SelectItem><SelectItem value="SMS">SMS</SelectItem><SelectItem value="DOCUMENT">Document</SelectItem><SelectItem value="WHATSAPP">WhatsApp</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="category_id" render={({ field }) => (<FormItem><FormLabel>{t('dialog.category')}</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder={t('dialog.selectCategory')} /></SelectTrigger></FormControl><SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="subject" render={({ field }) => (<FormItem><FormLabel>{t('dialog.subject')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="body_html" render={({ field }) => (<FormItem><FormLabel>{t('dialog.body')}</FormLabel><FormControl><Textarea {...field} rows={12} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="is_active" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>{t('dialog.isActive')}</FormLabel></FormItem>)} />
                            </div>
                            <div className="space-y-4">
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base">{t('dialog.preview.title')}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="h-96 rounded-md border bg-muted p-4 overflow-y-auto" dangerouslySetInnerHTML={{ __html: watchedBodyHtml || '' }} />
                                    </CardContent>
                                </Card>
                                <Card>
                                     <CardHeader className="pb-2">
                                        <CardTitle className="text-base">{t('dialog.variables.title')}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-muted-foreground">{t('dialog.variables.description')}</p>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>

                        <DialogFooter>
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
