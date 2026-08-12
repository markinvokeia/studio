'use client';

import * as React from 'react';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';

import { PatientInstructionDialog } from '@/components/medical-instructions/patient-instruction-dialog';
import { usePatientInstructionPrint } from '@/components/medical-instructions/patient-instruction-print-view';

import { TIMELINE_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { PatientMedicalInstruction } from '@/lib/types';
import api from '@/services/api';

import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { ClipboardList, MoreHorizontal, Plus, Printer } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

interface PatientInstructionsSectionProps {
    userId: string;
    userName?: string;
    createTrigger?: number;
    readOnly?: boolean;
}

export function PatientInstructionsSection({ userId, userName, createTrigger = 0, readOnly = false }: PatientInstructionsSectionProps) {
    const t = useTranslations('PatientInstructionsSection');
    const locale = useLocale();
    const dateLocale = locale === 'es' ? es : enUS;
    const { toast } = useToast();
    const { hasPermission } = usePermissions();

    const canView = hasPermission(TIMELINE_PERMISSIONS.MEDICAL_INSTRUCTIONS_VIEW);
    const canCreate = hasPermission(TIMELINE_PERMISSIONS.MEDICAL_INSTRUCTIONS_CREATE) && !readOnly;
    const canUpdate = hasPermission(TIMELINE_PERMISSIONS.MEDICAL_INSTRUCTIONS_UPDATE) && !readOnly;
    const canDelete = hasPermission(TIMELINE_PERMISSIONS.MEDICAL_INSTRUCTIONS_DELETE) && !readOnly;

    const [instructions, setInstructions] = React.useState<PatientMedicalInstruction[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingInstruction, setEditingInstruction] = React.useState<PatientMedicalInstruction | null>(null);
    const [deletingInstruction, setDeletingInstruction] = React.useState<PatientMedicalInstruction | null>(null);

    const { printInstruction, PrintContainer } = usePatientInstructionPrint();

    const loadInstructions = React.useCallback(async () => {
        if (!userId || !canView) return;
        setIsLoading(true);
        try {
            const data = await api.get(API_ROUTES.PATIENT_MEDICAL_INSTRUCTIONS, { patient_id: userId });
            const list: PatientMedicalInstruction[] = Array.isArray(data)
                ? data
                : (data?.rows || data?.data || data?.result || []);
            setInstructions(list.filter((instruction) => Object.keys(instruction).length > 0));
        } catch (error) {
            console.error('Failed to fetch patient medical instructions:', error);
            setInstructions([]);
        } finally {
            setIsLoading(false);
        }
    }, [userId, canView]);

    React.useEffect(() => {
        loadInstructions();
    }, [loadInstructions]);

    React.useEffect(() => {
        if (createTrigger > 0) {
            setEditingInstruction(null);
            setIsDialogOpen(true);
        }
    }, [createTrigger]);

    const handleCreate = () => {
        setEditingInstruction(null);
        setIsDialogOpen(true);
    };

    const handleEdit = (instruction: PatientMedicalInstruction) => {
        setEditingInstruction(instruction);
        setIsDialogOpen(true);
    };

    const handleDelete = async () => {
        if (!deletingInstruction?.id) return;
        try {
            await api.delete(API_ROUTES.PATIENT_MEDICAL_INSTRUCTIONS_DELETE, { id: deletingInstruction.id });
            toast({ title: t('toast.deleteSuccess') });
            setDeletingInstruction(null);
            loadInstructions();
        } catch (error) {
            toast({ title: t('toast.error'), variant: 'destructive' });
        }
    };

    if (!canView) return null;

    return (
        <Card className="shadow-sm border">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center">
                        <ClipboardList className="w-5 h-5 text-primary mr-2" />
                        <CardTitle className="text-base font-semibold">{t('title')}</CardTitle>
                    </div>
                    {canCreate && (
                        <Button variant="default" size="sm" onClick={handleCreate}>
                            <Plus className="h-4 w-4 mr-1" />
                            {t('newInstruction')}
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="space-y-2">
                        <Skeleton className="h-16 w-full" />
                        <Skeleton className="h-16 w-full" />
                    </div>
                ) : instructions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('noData')}</p>
                ) : (
                    <div className="space-y-2">
                        {instructions.map((instruction, index) => (
                            <div key={instruction.id ?? index} className="border-l-4 border-primary/30 pl-4 py-2 flex justify-between items-start">
                                <div>
                                    <div className="text-sm font-semibold text-foreground">
                                        {instruction.fecha ? format(new Date(instruction.fecha + 'T00:00:00'), 'dd/MM/yyyy', { locale: dateLocale }) : ''}
                                        {instruction.template_name ? ` — ${instruction.template_name}` : ''}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        {instruction.doctor_name}
                                        {instruction.numero_diente != null ? ` · ${t('tooth')} ${instruction.numero_diente}` : ''}
                                    </div>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => printInstruction(instruction, userName)}>
                                            <Printer className="h-4 w-4 mr-2" />{t('print')}
                                        </DropdownMenuItem>
                                        {canUpdate && (
                                            <DropdownMenuItem onClick={() => handleEdit(instruction)}>{t('edit')}</DropdownMenuItem>
                                        )}
                                        {canDelete && (
                                            <DropdownMenuItem onClick={() => setDeletingInstruction(instruction)} className="text-destructive">{t('delete')}</DropdownMenuItem>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>

            <PatientInstructionDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                patientId={userId}
                patientName={userName}
                existingInstruction={editingInstruction}
                onSaved={loadInstructions}
            />

            <AlertDialog open={!!deletingInstruction} onOpenChange={(open) => !open && setDeletingInstruction(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
                        <AlertDialogDescription>{t('deleteDialog.description')}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">{t('deleteDialog.confirm')}</AlertDialogAction>
                        <AlertDialogCancel>{t('deleteDialog.cancel')}</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {PrintContainer}
        </Card>
    );
}
