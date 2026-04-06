'use client';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/services/api';
import { TreatmentDetail, AttachedFile, PatientSession } from '@/lib/types';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { Calendar as CalendarIcon, Loader2, Plus, Trash2, Upload, File, X, Eye } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import * as React from 'react';
import { API_ROUTES } from '@/constants/routes';
import { cn } from '@/lib/utils';

interface ClinicSessionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (data: ClinicSessionFormData) => Promise<void>;
    userId: string;
    quoteId?: string;
    appointmentId?: string;
    defaultDate?: Date;
    serviceName?: string;
    // NUEVOS:
    showTreatments?: boolean;      // Mostrar sección de tratamientos por diente
    showAttachments?: boolean;      // Mostrar sección de adjuntos
    prefillData?: {
        doctor_id?: string;
        doctor_name?: string;
        procedimiento_realizado?: string;
    };
    existingSession?: PatientSession;  // Para edición de sesión existente
}

export interface ClinicSessionFormData {
    doctor_id: string;
    doctor_name: string;
    fecha_sesion: string;
    procedimiento_realizado: string;
    notas_clinicas?: string;
    plan_proxima_cita?: string;
    fecha_proxima_cita?: string;
    quote_id?: string;
    appointment_id?: string;
    // NUEVOS:
    tratamientos?: TreatmentDetail[];
    archivos_adjuntos?: File[];
    deletedAttachmentIds?: string[];
    // For editing existing sessions:
    sesion_id?: number;
}

interface Doctor {
    id: string;
    name: string;
}

// File upload constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
];

export function ClinicSessionDialog({
    open,
    onOpenChange,
    onSave,
    userId,
    quoteId,
    appointmentId,
    defaultDate,
    serviceName,
    showTreatments = false,
    showAttachments = false,
    prefillData,
    existingSession,
}: ClinicSessionDialogProps) {
    const t = useTranslations('ClinicSessionDialog');
    const locale = useLocale();
    const { toast } = useToast();

    const [isLoadingDoctors, setIsLoadingDoctors] = React.useState(false);
    const [doctors, setDoctors] = React.useState<Doctor[]>([]);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [doctorError, setDoctorError] = React.useState(false);

    // Treatments state
    const [treatments, setTreatments] = React.useState<{ numero_diente: string; descripcion: string }[]>([]);
    const [newToothNumber, setNewToothNumber] = React.useState('');
    const [newTreatmentDescription, setNewTreatmentDescription] = React.useState('');

    // Attachments state
    const [attachedFiles, setAttachedFiles] = React.useState<File[]>([]);
    const [existingAttachments, setExistingAttachments] = React.useState<AttachedFile[]>([]);
    const [deletedAttachmentIds, setDeletedAttachmentIds] = React.useState<string[]>([]);
    const [isDragOver, setIsDragOver] = React.useState(false);

    const [form, setForm] = React.useState<ClinicSessionFormData>({
        doctor_id: '',
        doctor_name: '',
        fecha_sesion: defaultDate ? defaultDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        procedimiento_realizado: serviceName || '',
        notas_clinicas: '',
        plan_proxima_cita: '',
        fecha_proxima_cita: '',
        quote_id: quoteId,
        appointment_id: appointmentId,
    });

    // Fetch doctors when dialog opens
    React.useEffect(() => {
        if (open) {
            fetchDoctors();
        }
    }, [open]);

    // Reset form when dialog opens with new props
    React.useEffect(() => {
        if (open) {
            // Reset form
            setForm({
                doctor_id: existingSession?.doctor_id || prefillData?.doctor_id || '',
                doctor_name: existingSession?.doctor_name || prefillData?.doctor_name || '',
                fecha_sesion: existingSession?.fecha_sesion 
                    ? existingSession.fecha_sesion.split('T')[0] 
                    : (defaultDate ? defaultDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
                procedimiento_realizado: existingSession?.procedimiento_realizado || prefillData?.procedimiento_realizado || serviceName || '',
                notas_clinicas: existingSession?.notas_clinicas || '',
                plan_proxima_cita: existingSession?.plan_proxima_cita || '',
                fecha_proxima_cita: existingSession?.fecha_proxima_cita || '',
                quote_id: existingSession?.quote_id || quoteId,
                appointment_id: existingSession?.appointment_id || appointmentId,
                sesion_id: existingSession?.sesion_id,
            });

            // Reset treatments
            if (existingSession?.tratamientos && existingSession.tratamientos.length > 0) {
                setTreatments(existingSession.tratamientos.map(t => ({
                    numero_diente: t.numero_diente ? String(t.numero_diente) : '',
                    descripcion: t.descripcion || '',
                })));
            } else {
                setTreatments([]);
            }

            // Reset attachments
            if (existingSession?.archivos_adjuntos && existingSession.archivos_adjuntos.length > 0) {
                setExistingAttachments(existingSession.archivos_adjuntos);
            } else {
                setExistingAttachments([]);
            }
            setAttachedFiles([]);
            setDeletedAttachmentIds([]);

            setDoctorError(false);
        }
    }, [open, defaultDate, serviceName, quoteId, appointmentId, existingSession, prefillData]);

    const fetchDoctors = async () => {
        setIsLoadingDoctors(true);
        try {
            const data = await api.get(API_ROUTES.USERS_DOCTORS);
            setDoctors(data.map((doc: any) => ({ id: String(doc.id), name: doc.name })));
        } catch (error) {
            console.error("Failed to fetch doctors:", error);
            setDoctors([]);
        } finally {
            setIsLoadingDoctors(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!form.doctor_id) {
            setDoctorError(true);
            toast({ title: t('doctorRequired'), variant: 'destructive' });
            return;
        }

        setIsSubmitting(true);
        try {
            const dataToSave: ClinicSessionFormData = {
                ...form,
                tratamientos: treatments.length > 0 ? treatments.map(t => ({
                    numero_diente: t.numero_diente ? parseInt(t.numero_diente, 10) : null,
                    descripcion: t.descripcion,
                })) : undefined,
                ...(showAttachments ? {
                    archivos_adjuntos: attachedFiles,
                    deletedAttachmentIds,
                } : {}),
            };

            await onSave(dataToSave);
            toast({ title: t('save') });
            onOpenChange(false);
        } catch (error) {
            toast({ title: t('fileUploadError'), variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Treatment handlers
    const handleAddTreatment = () => {
        if (!newTreatmentDescription.trim()) return;
        
        setTreatments([
            ...treatments,
            { numero_diente: newToothNumber, descripcion: newTreatmentDescription }
        ]);
        setNewToothNumber('');
        setNewTreatmentDescription('');
    };

    const handleRemoveTreatment = (index: number) => {
        setTreatments(treatments.filter((_, i) => i !== index));
    };

    // File handlers
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files || []);
            const validFiles: File[] = [];
            const errors: string[] = [];

            for (const file of files) {
                if (file.size > MAX_FILE_SIZE) {
                    errors.push(`${file.name}: ${t('fileTooBig', { size: MAX_FILE_SIZE / (1024 * 1024) })}`);
                } else if (!ALLOWED_FILE_TYPES.includes(file.type)) {
                    errors.push(`${file.name}: ${t('fileTypeNotAllowed')}`);
                } else {
                    validFiles.push(file);
                }
            }

            if (errors.length > 0) {
                toast({
                    title: t('fileUploadError'),
                    description: errors.join('\n'),
                    variant: 'destructive',
                });
            }

            if (validFiles.length > 0) {
                setAttachedFiles(prev => [...prev, ...validFiles]);
            }
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = () => {
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        
        if (e.dataTransfer.files?.length) {
            const files = Array.from(e.dataTransfer.files);
            const validFiles: File[] = [];
            const errors: string[] = [];

            for (const file of files) {
                if (file.size > MAX_FILE_SIZE) {
                    errors.push(`${file.name}: ${t('fileTooBig', { size: MAX_FILE_SIZE / (1024 * 1024) })}`);
                } else if (!ALLOWED_FILE_TYPES.includes(file.type)) {
                    errors.push(`${file.name}: ${t('fileTypeNotAllowed')}`);
                } else {
                    validFiles.push(file);
                }
            }

            if (errors.length > 0) {
                toast({
                    title: t('fileUploadError'),
                    description: errors.join('\n'),
                    variant: 'destructive',
                });
            }

            if (validFiles.length > 0) {
                setAttachedFiles(prev => [...prev, ...validFiles]);
            }
        }
    };

    const handleRemoveNewFile = (index: number) => {
        setAttachedFiles(attachedFiles.filter((_, i) => i !== index));
    };

    const handleDeleteExistingAttachment = (attachmentId: string) => {
        setDeletedAttachmentIds(prev => [...prev, attachmentId]);
        setExistingAttachments(existingAttachments.filter((a) => a.id !== attachmentId));
    };

    const dateLocale = locale === 'es' ? es : enUS;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent maxWidth="4xl" className="max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader className="px-6 py-4 border-b">
                    <DialogTitle>
                        {existingSession ? t('editTitle') : t('createTitle')}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                    <DialogBody className="p-6 overflow-y-auto flex-1">
                        <div className={cn(
                            "gap-6",
                            (showTreatments || showAttachments) ? "grid grid-cols-2" : "flex flex-col space-y-5"
                        )}>
                            {/* LEFT column — form fields */}
                            <div className="space-y-5">
                                {/* Date */}
                                <div className="space-y-2">
                                    <Label>{t('date')}</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className={cn(
                                                    "w-full justify-start text-left font-normal h-10 border-input",
                                                    !form.fecha_sesion && "text-muted-foreground"
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {form.fecha_sesion
                                                    ? format(new Date(form.fecha_sesion + 'T00:00:00'), 'dd/MM/yyyy', { locale: dateLocale })
                                                    : t('date')}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={form.fecha_sesion ? new Date(form.fecha_sesion + 'T00:00:00') : undefined}
                                                onSelect={(date) => setForm({ ...form, fecha_sesion: date ? date.toISOString().split('T')[0] : '' })}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                {/* Doctor */}
                                <div className="space-y-2">
                                    <Label>{t('doctor')}</Label>
                                    <Select
                                        value={form.doctor_id}
                                        onValueChange={(value) => {
                                            const selectedDoc = doctors.find(d => d.id === value);
                                            setForm({
                                                ...form,
                                                doctor_id: value,
                                                doctor_name: selectedDoc?.name || ''
                                            });
                                            setDoctorError(false);
                                        }}
                                    >
                                        <SelectTrigger className={cn("w-full", doctorError && "border-destructive")}>
                                            <SelectValue placeholder={t('selectDoctor')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {isLoadingDoctors ? (
                                                <div className="flex items-center justify-center p-2">
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                </div>
                                            ) : (
                                                doctors.map((doc) => (
                                                    <SelectItem key={doc.id} value={doc.id}>{doc.name}</SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Procedure */}
                                <div className="space-y-2">
                                    <Label>{t('procedure')}</Label>
                                    <Textarea
                                        value={form.procedimiento_realizado}
                                        onChange={(e) => setForm({ ...form, procedimiento_realizado: e.target.value })}
                                        placeholder={t('procedurePlaceholder')}
                                        className="min-h-[100px] resize-y"
                                    />
                                </div>

                                {/* Clinical Notes */}
                                <div className="space-y-2">
                                    <Label>{t('notes')}</Label>
                                    <Textarea
                                        value={form.notas_clinicas || ''}
                                        onChange={(e) => setForm({ ...form, notas_clinicas: e.target.value })}
                                        placeholder={t('notesPlaceholder')}
                                        className="min-h-[80px] resize-y"
                                    />
                                </div>

                                {/* Next Appointment Plan */}
                                <div className="space-y-2">
                                    <Label>{t('nextSessionPlan')}</Label>
                                    <Textarea
                                        value={form.plan_proxima_cita || ''}
                                        onChange={(e) => setForm({ ...form, plan_proxima_cita: e.target.value })}
                                        placeholder={t('nextSessionPlanPlaceholder')}
                                        className="min-h-[80px] resize-y"
                                    />
                                </div>
                            </div>

                            {/* RIGHT column — treatments + attachments (only rendered when enabled) */}
                            {(showTreatments || showAttachments) && (
                                <div className="space-y-5">
                                    {/* Treatments */}
                                    {showTreatments && (
                                        <div className="space-y-3">
                                            <Label className="text-base font-semibold">{t('treatments.title')}</Label>
                                            <Card className="bg-muted/5">
                                                <CardContent className="p-4">
                                                    <div className="flex gap-2 items-start mb-4">
                                                        <div className="w-24 shrink-0">
                                                            <Input
                                                                type="number"
                                                                placeholder={t('treatments.toothNumber')}
                                                                value={newToothNumber}
                                                                onChange={(e) => setNewToothNumber(e.target.value)}
                                                                className="h-9"
                                                                min="1"
                                                                max="85"
                                                            />
                                                        </div>
                                                        <Textarea
                                                            placeholder={t('treatments.treatmentPlaceholder')}
                                                            value={newTreatmentDescription}
                                                            onChange={(e) => setNewTreatmentDescription(e.target.value)}
                                                            className="flex-1 h-9 min-h-[unset] resize-none"
                                                        />
                                                        <Button
                                                            type="button"
                                                            onClick={handleAddTreatment}
                                                            disabled={!newTreatmentDescription.trim()}
                                                            size="icon"
                                                            className="h-9 w-9 shrink-0"
                                                        >
                                                            <Plus className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                                        {treatments.length === 0 ? (
                                                            <div className="text-center py-6 text-sm text-muted-foreground italic border border-dashed rounded-md">
                                                                {t('treatments.noTreatments')}
                                                            </div>
                                                        ) : (
                                                            treatments.map((treatment, index) => (
                                                                <div
                                                                    key={index}
                                                                    className="flex gap-2 items-start p-2 bg-background border rounded-md"
                                                                >
                                                                    <div className="w-16 text-center font-medium text-sm">
                                                                        {treatment.numero_diente || '-'}
                                                                    </div>
                                                                    <div className="flex-1 text-sm">
                                                                        {treatment.descripcion}
                                                                    </div>
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-7 w-7 text-destructive shrink-0"
                                                                        onClick={() => handleRemoveTreatment(index)}
                                                                    >
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </div>
                                    )}

                                    {/* Attachments */}
                                    {showAttachments && (
                                        <div className="space-y-3">
                                            <Label className="text-base font-semibold">{t('attachments.title')}</Label>
                                            <Card className="bg-muted/5">
                                                <CardContent className="p-4">
                                                    <div
                                                        className={cn(
                                                            "border-2 border-dashed rounded-lg p-6 transition-colors text-center",
                                                            isDragOver ? "border-primary bg-primary/10" : "border-muted-foreground/25"
                                                        )}
                                                        onDragOver={handleDragOver}
                                                        onDragLeave={handleDragLeave}
                                                        onDrop={handleDrop}
                                                    >
                                                        <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                                                        <p className="text-sm text-muted-foreground mb-2">
                                                            {t('attachments.dropzone')}
                                                        </p>
                                                        <Input
                                                            type="file"
                                                            multiple
                                                            className="hidden"
                                                            id="session-file-upload"
                                                            onChange={handleFileChange}
                                                            accept={ALLOWED_FILE_TYPES.join(',')}
                                                        />
                                                        <Label
                                                            htmlFor="session-file-upload"
                                                            className="cursor-pointer text-sm font-semibold text-primary hover:underline"
                                                        >
                                                            {t('attachments.browseFiles')}
                                                        </Label>
                                                    </div>

                                                    {existingAttachments.length > 0 && (
                                                        <div className="mt-4 space-y-2">
                                                            <Label className="text-xs uppercase font-bold text-muted-foreground">
                                                                {t('attachments.existing')}
                                                            </Label>
                                                            <div className="flex flex-wrap gap-2">
                                                                {existingAttachments.map((attachment: AttachedFile, idx: number) => (
                                                                    <div
                                                                        key={idx}
                                                                        className="flex items-center gap-1 bg-muted rounded-md px-2 py-1 text-xs"
                                                                    >
                                                                        <File className="w-3 h-3" />
                                                                        <span className="truncate max-w-[160px]">
                                                                            {attachment.file_name || attachment.ruta || 'File'}
                                                                        </span>
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-4 w-4 text-destructive"
                                                                            onClick={() => attachment.id && handleDeleteExistingAttachment(attachment.id)}
                                                                        >
                                                                            <X className="h-3 w-3" />
                                                                        </Button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {attachedFiles.length > 0 && (
                                                        <div className="mt-4 space-y-2">
                                                            <Label className="text-xs uppercase font-bold text-muted-foreground">
                                                                {t('attachments.new')}
                                                            </Label>
                                                            <div className="flex flex-wrap gap-2">
                                                                {attachedFiles.map((file, idx) => (
                                                                    <div
                                                                        key={idx}
                                                                        className="flex items-center gap-1 bg-primary/10 rounded-md px-2 py-1 text-xs"
                                                                    >
                                                                        <File className="w-3 h-3" />
                                                                        <span className="truncate max-w-[160px]">{file.name}</span>
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-4 w-4"
                                                                            onClick={() => handleRemoveNewFile(idx)}
                                                                        >
                                                                            <X className="h-3 w-3" />
                                                                        </Button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {existingAttachments.length === 0 && attachedFiles.length === 0 && (
                                                        <div className="mt-4 text-center text-sm text-muted-foreground italic">
                                                            {t('attachments.noFiles')}
                                                        </div>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </DialogBody>
                    <DialogFooter className="px-6 py-4 border-t shrink-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            {t('cancel')}
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isSubmitting ? t('saving') : t('save')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
