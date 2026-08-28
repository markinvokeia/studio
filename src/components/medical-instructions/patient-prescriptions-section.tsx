'use client';

import * as React from 'react';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';

import { PrescriptionDialog } from '@/components/medical-instructions/prescription-dialog';
import { usePrescriptionPrint } from '@/components/medical-instructions/prescription-print-view';
import { fetchPatientById } from '@/components/patients/patient-form-utils';

import { TIMELINE_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import type { PrescriptionPatientInfo } from '@/lib/prescription-render';
import { PatientPrescription, PrescriptionItem } from '@/lib/types';
import api from '@/services/api';

import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { MoreHorizontal, Pill, Plus, Printer } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

/** El backend puede devolver `items` como array o como JSON string (json_agg). */
function normalizeItems(raw: any): PrescriptionItem[] {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return [];
}

interface PatientPrescriptionsSectionProps {
    userId: string;
    userName?: string;
    createTrigger?: number;
    readOnly?: boolean;
    /** Fija el doctor al usuario de la sesión (workspace del doctor). */
    lockDoctor?: boolean;
}

export function PatientPrescriptionsSection({ userId, userName, createTrigger = 0, readOnly = false, lockDoctor = false }: PatientPrescriptionsSectionProps) {
    const t = useTranslations('PatientPrescriptionsSection');
    const locale = useLocale();
    const dateLocale = locale === 'es' ? es : enUS;
    const { toast } = useToast();
    const { hasPermission } = usePermissions();

    const canView = hasPermission(TIMELINE_PERMISSIONS.PRESCRIPTIONS_VIEW);
    const canCreate = hasPermission(TIMELINE_PERMISSIONS.PRESCRIPTIONS_CREATE) && !readOnly;
    const canUpdate = hasPermission(TIMELINE_PERMISSIONS.PRESCRIPTIONS_UPDATE) && !readOnly;
    const canDelete = hasPermission(TIMELINE_PERMISSIONS.PRESCRIPTIONS_DELETE) && !readOnly;

    const [prescriptions, setPrescriptions] = React.useState<PatientPrescription[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingPrescription, setEditingPrescription] = React.useState<PatientPrescription | null>(null);
    const [deletingPrescription, setDeletingPrescription] = React.useState<PatientPrescription | null>(null);
    // C.I., nacimiento y domicilio: la receta impresa los lleva en el membrete,
    // así que hay que resolverlos también al imprimir desde la lista.
    const [patient, setPatient] = React.useState<PrescriptionPatientInfo | null>(null);

    const { printPrescription, PrintContainer } = usePrescriptionPrint();

    const loadPrescriptions = React.useCallback(async () => {
        if (!userId || !canView) return;
        setIsLoading(true);
        try {
            const data = await api.get(API_ROUTES.PATIENT_PRESCRIPTIONS, { patient_id: userId });
            const list: any[] = Array.isArray(data)
                ? data
                : (data?.rows || data?.data || data?.result || []);
            setPrescriptions(
                list
                    .filter((prescription) => Object.keys(prescription).length > 0)
                    .map((prescription) => ({ ...prescription, items: normalizeItems(prescription.items) })),
            );
        } catch (error) {
            console.error('Failed to fetch patient prescriptions:', error);
            setPrescriptions([]);
        } finally {
            setIsLoading(false);
        }
    }, [userId, canView]);

    React.useEffect(() => {
        loadPrescriptions();
    }, [loadPrescriptions]);

    React.useEffect(() => {
        if (!userId || !canView) return;
        let active = true;
        fetchPatientById(userId).then((found) => {
            if (!active) return;
            // Sólo el id exacto: `fetchPatientById` cae al primer resultado si la
            // búsqueda no coincide, y eso pondría datos de otro paciente en la receta.
            setPatient(found && String(found.id) === String(userId) ? {
                name: found.name,
                identity_document: found.identity_document,
                birth_date: found.birth_date,
                address: found.address,
                mutual_society_name: found.mutual_society_name,
            } : null);
        });
        return () => { active = false; };
    }, [userId, canView]);

    React.useEffect(() => {
        if (createTrigger > 0) {
            setEditingPrescription(null);
            setIsDialogOpen(true);
        }
    }, [createTrigger]);

    const handleCreate = () => {
        setEditingPrescription(null);
        setIsDialogOpen(true);
    };

    const handleEdit = (prescription: PatientPrescription) => {
        setEditingPrescription(prescription);
        setIsDialogOpen(true);
    };

    const handleDelete = async () => {
        if (!deletingPrescription?.id) return;
        try {
            await api.delete(API_ROUTES.PATIENT_PRESCRIPTIONS_DELETE, { id: deletingPrescription.id });
            toast({ title: t('toast.deleteSuccess') });
            setDeletingPrescription(null);
            loadPrescriptions();
        } catch {
            toast({ title: t('toast.error'), variant: 'destructive' });
        }
    };

    if (!canView) return null;

    return (
        <Card className="shadow-sm border">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center">
                        <Pill className="mr-2 h-5 w-5 text-primary" />
                        <CardTitle className="text-base font-semibold">{t('title')}</CardTitle>
                    </div>
                    {canCreate && (
                        <Button variant="default" size="sm" onClick={handleCreate}>
                            <Plus className="mr-1 h-4 w-4" />
                            {t('newPrescription')}
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
                ) : prescriptions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('noData')}</p>
                ) : (
                    <div className="space-y-2">
                        {prescriptions.map((prescription, index) => {
                            const medicationNames = (prescription.items || [])
                                .map((item) => item.medicamento_texto)
                                .filter(Boolean);
                            const preview = medicationNames.slice(0, 3).join(', ');
                            const rest = medicationNames.length - 3;

                            return (
                                <div key={prescription.id ?? index} className="flex items-start justify-between border-l-4 border-primary/30 py-2 pl-4">
                                    <div className="min-w-0">
                                        <div className="text-sm font-semibold text-foreground">
                                            {prescription.fecha ? format(new Date(prescription.fecha.split('T')[0] + 'T00:00:00'), 'dd/MM/yyyy', { locale: dateLocale }) : ''}
                                            {prescription.template_name ? ` — ${prescription.template_name}` : ''}
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            {prescription.doctor_name}
                                            {medicationNames.length > 0 ? ` · ${t('medicationCount', { count: medicationNames.length })}` : ''}
                                        </div>
                                        {preview && (
                                            <p className="truncate text-xs text-muted-foreground">
                                                {preview}{rest > 0 ? ` +${rest}` : ''}
                                            </p>
                                        )}
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => printPrescription(prescription, userName, patient)}>
                                                <Printer className="mr-2 h-4 w-4" />{t('print')}
                                            </DropdownMenuItem>
                                            {canUpdate && (
                                                <DropdownMenuItem onClick={() => handleEdit(prescription)}>{t('edit')}</DropdownMenuItem>
                                            )}
                                            {canDelete && (
                                                <DropdownMenuItem onClick={() => setDeletingPrescription(prescription)} className="text-destructive">{t('delete')}</DropdownMenuItem>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>

            <PrescriptionDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                patientId={userId}
                patientName={userName}
                existingPrescription={editingPrescription}
                onSaved={loadPrescriptions}
                lockDoctor={lockDoctor}
            />

            <AlertDialog open={!!deletingPrescription} onOpenChange={(open) => !open && setDeletingPrescription(null)}>
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
