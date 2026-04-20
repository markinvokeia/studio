'use client';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
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
    prefillTreatments?: { numero_diente: number | null; descripcion: string }[];
    existingSession?: PatientSession;  // Para edición de sesión existente
    // Datos de cita pendiente para crear junto con la sesión
    pendingAppointmentData?: {
        start: string;
        end: string;
        doctor_id: string;
        doctor_name: string;
        patient_id: string;
        patient_name: string;
        service_ids: string[];
        service_names: string;
        notes?: string;
        calendar_source_id: string;
        quote_id?: string;
    };
}

export interface ClinicSessionFormData {
    doctor_id: string;
    doctor_name: string;
    fecha_sesion: string;
    procedimiento_realizado: string;
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
    prefillTreatments,
    existingSession,
    pendingAppointmentData,
}: ClinicSessionDialogProps) {
    const t = useTranslations('ClinicSessionDialog');
    const tCommon = useTranslations('ClinicHistoryPage');
    const locale = useLocale();
    const { toast } = useToast();

    const [isLoadingDoctors, setIsLoadingDoctors] = React.useState(false);
    const [doctors, setDoctors] = React.useState<Doctor[]>([]);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [doctorError, setDoctorError] = React.useState(false);

    // Treatments state
    const [treatments, setTreatments] = React.useState<{ numero_diente: number | null; descripcion: string }[]>([]);

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

    // Reset form only when the dialog transitions from closed to open
    const prevOpenRef = React.useRef(false);
    React.useEffect(() => {
        const justOpened = open && !prevOpenRef.current;
        prevOpenRef.current = open;
        if (!justOpened) return;

        setForm({
            doctor_id: existingSession?.doctor_id || prefillData?.doctor_id || '',
            doctor_name: existingSession?.doctor_name || prefillData?.doctor_name || '',
            fecha_sesion: existingSession?.fecha_sesion
                ? existingSession.fecha_sesion.split('T')[0]
                : (defaultDate ? defaultDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
            procedimiento_realizado: existingSession?.procedimiento_realizado || prefillData?.procedimiento_realizado || serviceName || '',
            plan_proxima_cita: existingSession?.plan_proxima_cita || '',
            fecha_proxima_cita: existingSession?.fecha_proxima_cita
                ? existingSession.fecha_proxima_cita.split('T')[0]
                : '',
            quote_id: existingSession?.quote_id || quoteId,
            appointment_id: existingSession?.appointment_id || appointmentId,
            sesion_id: existingSession?.sesion_id,
        });

        if (existingSession?.tratamientos && existingSession.tratamientos.length > 0) {
            setTreatments(existingSession.tratamientos.map(t => ({
                numero_diente: t.numero_diente,
                descripcion: t.descripcion || '',
            })));
        } else if (prefillTreatments && prefillTreatments.length > 0) {
            setTreatments(prefillTreatments.map(t => ({ ...t })));
        } else {
            setTreatments([]);
        }

        if (existingSession?.archivos_adjuntos && existingSession.archivos_adjuntos.length > 0) {
            setExistingAttachments(existingSession.archivos_adjuntos);
        } else {
            setExistingAttachments([]);
        }
        setAttachedFiles([]);
        setDeletedAttachmentIds([]);
        setDoctorError(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

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
                    numero_diente: t.numero_diente,
                    descripcion: t.descripcion,
                })) : undefined,
                ...(showAttachments ? {
                    archivos_adjuntos: attachedFiles,
                    deletedAttachmentIds,
                } : {}),
            };

            // If there's pending appointment data, the parent handles creating both appointment and session
            // Otherwise, just save the session normally
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
        setTreatments([...treatments, { numero_diente: null, descripcion: '' }]);
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
            <DialogContent
                maxWidth="4xl"
                showMaximize
                maximizeLabel={tCommon('viewer.maximize')}
                restoreLabel={tCommon('viewer.restore')}
                className="h-full max-h-[90vh] max-w-[95vw] p-0"
            >
                <DialogHeader className="border-b px-6 py-4">
                    <DialogTitle>
                        {existingSession ? t('editTitle') : t('createTitle')}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                    <div className="flex-1 min-h-0 w-full overflow-y-auto overscroll-contain px-6 py-4" style={{ WebkitOverflowScrolling: 'touch' }}>
                        <div className="space-y-6 xl:flex xl:flex-row xl:gap-6 xl:space-y-0">
                            {/* LEFT column — form fields */}
                            <div className="grid content-start gap-4 md:grid-cols-2 xl:flex-1">
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
                                <div className="space-y-2 md:col-span-2">
                                    <Label>{t('procedure')}</Label>
                                    <Textarea
                                        value={form.procedimiento_realizado}
                                        onChange={(e) => setForm({ ...form, procedimiento_realizado: e.target.value })}
                                        placeholder={t('procedurePlaceholder')}
                                        className="min-h-[80px] xl:min-h-[100px] resize-y"
                                    />
                                </div>

                                {/* Next Appointment Plan */}
                                <div className="space-y-2 md:col-span-2">
                                    <Label>{t('nextSessionPlan')}</Label>
                                    <Textarea
                                        value={form.plan_proxima_cita || ''}
                                        onChange={(e) => setForm({ ...form, plan_proxima_cita: e.target.value })}
                                        placeholder={t('nextSessionPlanPlaceholder')}
                                        className="min-h-[60px] xl:min-h-[80px] resize-y"
                                    />
                                </div>

                                {/* Next Appointment Date */}
                                <div className="space-y-2">
                                    <Label>{t('nextAppointmentDate')}</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className={cn(
                                                    "w-full justify-start text-left font-normal h-10 border-input",
                                                    !form.fecha_proxima_cita && "text-muted-foreground"
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {form.fecha_proxima_cita
                                                    ? format(new Date(form.fecha_proxima_cita + 'T00:00:00'), 'dd/MM/yyyy', { locale: dateLocale })
                                                    : t('selectNextAppointmentDate')}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={form.fecha_proxima_cita ? new Date(form.fecha_proxima_cita + 'T00:00:00') : undefined}
                                                onSelect={(date) => setForm({ ...form, fecha_proxima_cita: date ? date.toISOString().split('T')[0] : '' })}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>

                            {/* RIGHT column — treatments + attachments (only rendered when enabled) */}
                            {(showTreatments || showAttachments) && (
                                <div className="flex flex-col gap-4 xl:w-[340px] xl:flex-shrink-0">
                                    {/* Treatments */}
                                    {showTreatments && (
                                        <Card className="flex flex-col shadow-none border bg-muted/5">
                                            <CardHeader className="py-2 px-3 flex flex-row items-center justify-between space-y-0">
                                                <CardTitle className="text-sm font-bold">{t('treatments.title')}</CardTitle>
                                                <Button type="button" variant="ghost" size="sm" onClick={handleAddTreatment} className="h-7 px-2 text-xs">
                                                    <Plus className="h-3 w-3 mr-1" />
                                                    {t('treatments.add') || 'Añadir'}
                                                </Button>
                                            </CardHeader>
                                            <CardContent className="flex-1 p-2 pt-0">
                                                <div className="min-h-[120px] max-h-[300px] overflow-y-auto pr-2 space-y-2 xl:min-h-[180px] xl:max-h-[400px]">
                                                    {treatments.length === 0 ? (
                                                        <div className="flex min-h-[100px] items-center justify-center py-4 text-xs text-muted-foreground italic border border-dashed rounded-md xl:min-h-[160px]">
                                                            {t('treatments.noTreatments')}
                                                        </div>
                                                    ) : treatments.map((treatment, index) => (
                                                        <div key={index} className="flex gap-2 items-start p-2 bg-background border rounded-md">
                                                            <Input
                                                                type="number"
                                                                placeholder={t('treatments.toothNumber')}
                                                                value={treatment.numero_diente ?? ''}
                                                                onChange={(e) => {
                                                                    setTreatments(prev => prev.map((t, i) =>
                                                                        i === index ? { ...t, numero_diente: e.target.value ? parseInt(e.target.value, 10) : null } : t
                                                                    ));
                                                                }}
                                                                className="h-7 text-xs px-2 w-16"
                                                            />
                                                            <Textarea
                                                                placeholder={t('treatments.treatmentPlaceholder')}
                                                                value={treatment.descripcion}
                                                                onChange={(e) => {
                                                                    setTreatments(prev => prev.map((t, i) =>
                                                                        i === index ? { ...t, descripcion: e.target.value } : t
                                                                    ));
                                                                }}
                                                                className="min-h-[28px] h-7 text-xs p-1 flex-1 resize-none"
                                                            />
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7 text-destructive"
                                                                onClick={() => handleRemoveTreatment(index)}
                                                            >
                                                                <Trash2 className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )}

                                    {/* Attachments */}
                                    {showAttachments && (
                                        <Card className="flex flex-col shadow-none border bg-muted/5 xl:flex-[1.15]">
                                            <CardHeader className="py-2 px-3">
                                                <CardTitle className="text-sm font-bold">{t('attachments.title')}</CardTitle>
                                            </CardHeader>
                                            <CardContent className="flex flex-1 flex-col p-3">
                                                {/* Drag and Drop Area */}
                                                <div
                                                    className={cn(
                                                        "border-2 border-dashed rounded-lg p-4 transition-colors shrink-0",
                                                        isDragOver ? "border-primary bg-primary/10" : "border-muted-foreground/25"
                                                    )}
                                                    onDragOver={handleDragOver}
                                                    onDragLeave={handleDragLeave}
                                                    onDrop={handleDrop}
                                                >
                                                    <div className="flex flex-col items-center text-center">
                                                        <Upload className="w-6 h-6 text-muted-foreground mb-2" />
                                                        <p className="text-xs text-muted-foreground mb-2">
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
                                                            className="cursor-pointer text-xs font-semibold text-primary hover:underline"
                                                        >
                                                            {t('attachments.browseFiles')}
                                                        </Label>
                                                    </div>
                                                </div>

                                                <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
                                                    {existingAttachments.length > 0 && (
                                                        <div className="min-h-0 flex-1 space-y-2">
                                                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                                                                {t('attachments.existing')}
                                                            </Label>
                                                            <div className="max-h-full overflow-y-auto">
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
                                                        </div>
                                                    )}

                                                    {attachedFiles.length > 0 && (
                                                        <div className="min-h-0 flex-1 space-y-2">
                                                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                                                                {t('attachments.new')}
                                                            </Label>
                                                            <div className="max-h-full overflow-y-auto">
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
                                                        </div>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
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
