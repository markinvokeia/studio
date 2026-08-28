'use client';

import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogCancelButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DoctorSelector } from '@/components/ui/doctor-selector';
import { MedicationSelector } from '@/components/ui/medication-selector';

import { InstructionRichTextEditor } from '@/components/medical-instructions/instruction-rich-text-editor';
import { PrescriptionDocument, PrescriptionDocumentEmpty } from '@/components/medical-instructions/prescription-document';
import { usePrescriptionPrint } from '@/components/medical-instructions/prescription-print-view';
import { fetchPatientById } from '@/components/patients/patient-form-utils';
import { SignatureUploader } from '@/components/users/signature-uploader';

import { API_ROUTES } from '@/constants/routes';
import { GLOBAL_PERMISSIONS, SYSTEM_PERMISSIONS } from '@/constants/permissions';
import { useAuth } from '@/context/AuthContext';
import { useClinicInfo } from '@/hooks/useClinicInfo';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import {
    PRESCRIPTION_TEMPLATE_VARIABLES,
    PRESCRIPTION_TEMPLATE_VARIABLE_GROUP_ORDER,
} from '@/lib/prescription-template-variables';
import type { PrescriptionPatientInfo } from '@/lib/prescription-render';
import { PatientPrescription, PrescriptionItem, PrescriptionTemplate } from '@/lib/types';
import { cn, formatDate, formatDisplayDate } from '@/lib/utils';
import api from '@/services/api';

import { addDays } from 'date-fns';
import { Calendar as CalendarIcon, Eye, FileText, Loader2, Pencil, PenLine, Plus, Printer, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

function emptyItem(fecha: string): PrescriptionItem {
    return {
        medicamento_id: null,
        medicamento_texto: '',
        presentacion: '',
        dosis: '',
        via_administracion: '',
        frecuencia: '',
        duracion_dias: null,
        cantidad: '',
        fecha_inicio: fecha,
        fecha_fin: null,
        indicaciones: '',
        registrar_en_anamnesis: true,
    };
}

/**
 * `fecha_fin` inclusiva: un tratamiento de 7 días que arranca el 1 termina el 7.
 * Devuelve null si falta el inicio o la duración, para no inventar un período.
 */
function computeEndDate(fechaInicio?: string, duracionDias?: number | null): string | null {
    if (!fechaInicio || duracionDias == null || duracionDias < 1) return null;
    const start = new Date(fechaInicio + 'T00:00:00');
    if (isNaN(start.getTime())) return null;
    return formatDate(addDays(start, duracionDias - 1));
}

interface PrescriptionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    patientId: string;
    patientName?: string;
    existingPrescription?: PatientPrescription | null;
    onSaved?: () => void;
    /**
     * Fija el doctor al usuario de la sesión y deja el campo en sólo lectura.
     * Se usa desde el workspace del doctor: quien receta es siempre quien está
     * logueado, para que nadie pueda firmar como otro profesional.
     */
    lockDoctor?: boolean;
}

export function PrescriptionDialog({
    open,
    onOpenChange,
    patientId,
    patientName,
    existingPrescription,
    onSaved,
    lockDoctor = false,
}: PrescriptionDialogProps) {
    const t = useTranslations('PrescriptionDialog');
    const tPrint = useTranslations('PrescriptionPrint');
    const { toast } = useToast();
    const { user } = useAuth();
    const { hasPermission } = usePermissions();
    const clinic = useClinicInfo();

    // Sin usuario en sesión no hay a quién fijar: se cae al selector normal
    // en vez de dejar el campo bloqueado y vacío.
    const isDoctorLocked = lockDoctor && !!user?.id;
    const lockedDoctorId = isDoctorLocked ? String(user!.id) : '';
    const lockedDoctorName = isDoctorLocked ? (user!.name || '') : '';
    const { printPrescription, PrintContainer } = usePrescriptionPrint();

    const [templates, setTemplates] = React.useState<PrescriptionTemplate[]>([]);
    const [isLoadingTemplates, setIsLoadingTemplates] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isPrinting, setIsPrinting] = React.useState(false);
    const [savedPrescription, setSavedPrescription] = React.useState<PatientPrescription | null>(null);
    const [patient, setPatient] = React.useState<PrescriptionPatientInfo | null>(null);
    /** null mientras se comprueba; true/false una vez resuelto. */
    const [hasSignature, setHasSignature] = React.useState<boolean | null>(null);
    const [isSignatureDialogOpen, setIsSignatureDialogOpen] = React.useState(false);
    /** Se incrementa al guardar una firma, para saltarse la caché del navegador. */
    const [signatureVersion, setSignatureVersion] = React.useState(0);

    const [fecha, setFecha] = React.useState('');
    const [doctorId, setDoctorId] = React.useState('');
    const [doctorName, setDoctorName] = React.useState('');
    const [templateId, setTemplateId] = React.useState('');
    const [templateName, setTemplateName] = React.useState('');
    const [diagnostico, setDiagnostico] = React.useState('');
    const [notas, setNotas] = React.useState('');
    const [items, setItems] = React.useState<PrescriptionItem[]>([]);
    const [contentHtml, setContentHtml] = React.useState('');

    /** Índice del medicamento desplegado. El resto se muestra como tarjeta. */
    const [editingItemIndex, setEditingItemIndex] = React.useState<number | null>(0);
    /** Sólo por debajo de `lg`, donde no caben las dos columnas a la vez. */
    const [mobilePane, setMobilePane] = React.useState<'form' | 'preview'>('form');
    /** El editor de contenido está plegado: la plantilla ya define el formato. */
    const [isEditorOpen, setIsEditorOpen] = React.useState(false);

    const groupLabels = {
        patient: t('variables.groups.patient'),
        clinic: t('variables.groups.clinic'),
        document: t('variables.groups.document'),
        tables: t('variables.groups.tables'),
    };

    React.useEffect(() => {
        if (!open) return;

        const initialFecha = existingPrescription?.fecha ? formatDate(existingPrescription.fecha) : formatDate(new Date());

        setFecha(initialFecha);
        // Una receta ya emitida conserva su autor aunque el campo esté fijado:
        // bloquearlo no debe reasignar en silencio quién la firmó.
        setDoctorId(existingPrescription?.doctor_id || lockedDoctorId);
        setDoctorName(existingPrescription?.doctor_name || lockedDoctorName);
        setTemplateId(existingPrescription?.template_id || '');
        setTemplateName(existingPrescription?.template_name || '');
        setDiagnostico(existingPrescription?.diagnostico || '');
        setNotas(existingPrescription?.notas || '');
        setItems(existingPrescription?.items?.length ? existingPrescription.items : [emptyItem(initialFecha)]);
        setContentHtml(existingPrescription?.content_html || '');
        setSavedPrescription(existingPrescription || null);
        setEditingItemIndex(existingPrescription?.items?.length ? null : 0);
        setMobilePane('form');
        setIsEditorOpen(false);

        const fetchTemplates = async () => {
            setIsLoadingTemplates(true);
            try {
                const data = await api.get(API_ROUTES.PRESCRIPTION_TEMPLATES);
                const list: PrescriptionTemplate[] = Array.isArray(data)
                    ? data
                    : (data?.rows || data?.data || data?.result || []);
                const active = list.filter((tpl) => tpl.is_active);
                setTemplates(active);

                // Receta nueva: se precarga la primera plantilla activa para que la
                // vista previa muestre la hoja desde el arranque, en vez de un vacío.
                if (!existingPrescription && active.length > 0) {
                    setTemplateId(String(active[0].id));
                    setTemplateName(active[0].name);
                    setContentHtml(active[0].content_html);
                }
            } catch (error) {
                console.error('Failed to fetch prescription templates:', error);
                setTemplates([]);
            } finally {
                setIsLoadingTemplates(false);
            }
        };

        fetchTemplates();
        // El doctor fijado se omite a propósito: sólo importa su valor al abrir,
        // y si llega más tarde lo completa el efecto de abajo.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, existingPrescription]);

    // La sesión puede resolver después de abrir el diálogo. Como el campo queda
    // en sólo lectura, nadie podría rellenarlo a mano: se completa acá en cuanto
    // el usuario esté disponible, sin pisar el autor de una receta ya emitida.
    React.useEffect(() => {
        if (!open || !lockedDoctorId) return;
        setDoctorId((prev) => prev || lockedDoctorId);
        setDoctorName((prev) => prev || lockedDoctorName);
    }, [open, lockedDoctorId, lockedDoctorName]);

    // Datos del paciente que la receta necesita y que las superficies que abren
    // el diálogo no conocen (C.I., nacimiento, domicilio, mutualista).
    React.useEffect(() => {
        if (!open || !patientId) return;
        let active = true;
        fetchPatientById(patientId).then((found) => {
            if (!active) return;
            // `fetchPatientById` busca por texto y, si no encuentra coincidencia
            // exacta, devuelve el primer resultado. En una receta eso sería
            // imprimir la C.I. de otra persona: sólo se acepta el id exacto.
            setPatient(found && String(found.id) === String(patientId) ? {
                name: found.name,
                identity_document: found.identity_document,
                birth_date: found.birth_date,
                address: found.address,
                mutual_society_name: found.mutual_society_name,
            } : null);
        });
        return () => { active = false; };
    }, [open, patientId]);

    // ¿Tiene firma el doctor elegido? Se pregunta al mismo webhook que usa la
    // receta, así la comprobación y lo que se imprime no pueden discrepar.
    React.useEffect(() => {
        if (!open || !doctorId) { setHasSignature(null); return; }
        let active = true;
        setHasSignature(null);
        api.getBlob(API_ROUTES.USER_SIGNATURE, { user_id: doctorId })
            .then((blob) => { if (active) setHasSignature(((blob as unknown as Blob)?.size ?? 0) > 0); })
            .catch(() => { if (active) setHasSignature(false); });
        return () => { active = false; };
    }, [open, doctorId, signatureVersion]);

    // Firmar por uno mismo es un permiso distinto de gestionar la firma ajena.
    const canDefineSignature = doctorId === String(user?.id ?? '')
        ? hasPermission(GLOBAL_PERMISSIONS.PROFILE_UPLOAD_SIGNATURE)
        : hasPermission(SYSTEM_PERMISSIONS.USERS_MANAGE_SIGNATURE);

    /** Fuente de variables de la vista previa — refleja el formulario en vivo. */
    const previewSource = React.useMemo(() => ({
        patient: { ...(patient ?? {}), name: patientName || patient?.name || '' },
        doctorId,
        doctorName,
        fecha,
        diagnostico,
        notas,
        items,
        clinic,
        signatureCacheKey: signatureVersion,
    }), [clinic, diagnostico, doctorId, doctorName, fecha, items, notas, patient, patientName, signatureVersion]);

    const handleSelectTemplate = (id: string) => {
        const template = templates.find((tpl) => String(tpl.id) === id);
        if (!template) return;
        setTemplateId(id);
        setTemplateName(template.name);
        setContentHtml(template.content_html);
    };

    const updateItem = (index: number, patch: Partial<PrescriptionItem>) => {
        setItems((prev) => prev.map((item, i) => {
            if (i !== index) return item;
            const next = { ...item, ...patch };
            // El período depende del inicio y la duración: recalcular en cuanto cambie alguno.
            if ('duracion_dias' in patch || 'fecha_inicio' in patch) {
                next.fecha_fin = computeEndDate(next.fecha_inicio, next.duracion_dias);
            }
            return next;
        }));
    };

    const handleAddItem = () => {
        setEditingItemIndex(items.length);
        setItems((prev) => [...prev, emptyItem(fecha)]);
    };

    const handleRemoveItem = (index: number) => {
        setItems((prev) => (prev.length === 1 ? [emptyItem(fecha)] : prev.filter((_, i) => i !== index)));
        setEditingItemIndex((current) => {
            if (current == null) return null;
            if (current === index) return null;
            return current > index ? current - 1 : current;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!doctorId) {
            toast({ title: t('validation.doctorRequired'), variant: 'destructive' });
            return;
        }
        const usableItems = items.filter((item) => item.medicamento_texto?.trim());
        if (usableItems.length === 0) {
            toast({ title: t('validation.itemsRequired'), variant: 'destructive' });
            return;
        }
        if (!contentHtml.trim()) {
            toast({ title: t('validation.contentRequired'), variant: 'destructive' });
            return;
        }

        setIsSubmitting(true);
        try {
            const payload: PatientPrescription = {
                id: savedPrescription?.id,
                patient_id: patientId,
                fecha,
                doctor_id: doctorId,
                doctor_name: doctorName,
                template_id: templateId || undefined,
                template_name: templateName || undefined,
                diagnostico: diagnostico || undefined,
                notas: notas || undefined,
                items: usableItems.map((item, index) => ({
                    ...item,
                    orden: index,
                    fecha_inicio: item.fecha_inicio || fecha,
                    fecha_fin: item.fecha_fin ?? computeEndDate(item.fecha_inicio || fecha, item.duracion_dias),
                })),
                // Se guarda el contenido CON sus tokens. Las variables se resuelven
                // al renderizar, con el mismo código en la vista previa y en la
                // impresión, así el papel no puede salir distinto de la pantalla.
                content_html: contentHtml,
            };
            const response = await api.post(API_ROUTES.PATIENT_PRESCRIPTIONS_UPSERT, payload);
            const record = Array.isArray(response)
                ? response[0]
                : (response?.rows?.[0] || response?.data || response?.result || response);
            // Del backend sólo se confía el id (necesario para editar después);
            // el resto del estado del formulario ya está validado.
            const saved: PatientPrescription = { ...payload, id: record?.id ?? payload.id };
            setSavedPrescription(saved);
            toast({ title: savedPrescription ? t('toast.editSuccess') : t('toast.createSuccess') });
            onSaved?.();
        } catch (error) {
            toast({
                title: t('toast.error'),
                description: error instanceof Error ? error.message : '',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePrint = async () => {
        if (!savedPrescription) return;
        setIsPrinting(true);
        try {
            await printPrescription(savedPrescription, patientName, patient);
        } finally {
            setIsPrinting(false);
        }
    };

    // ── Panel izquierdo: formulario ──────────────────────────────────────────
    const formPane = (
        <div className="space-y-5 p-4 sm:p-5">
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label>{t('template')}</Label>
                    <Select value={templateId} onValueChange={handleSelectTemplate}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder={t('selectTemplate')} />
                        </SelectTrigger>
                        <SelectContent>
                            {isLoadingTemplates ? (
                                <div className="flex items-center justify-center p-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                </div>
                            ) : (
                                templates.map((tpl) => (
                                    <SelectItem key={tpl.id} value={String(tpl.id)}>{tpl.name}</SelectItem>
                                ))
                            )}
                        </SelectContent>
                    </Select>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label>{t('date')}</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className={cn('h-10 w-full justify-start text-left font-normal', !fecha && 'text-muted-foreground')}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                                    {fecha ? formatDisplayDate(fecha) : t('date')}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={fecha ? new Date(fecha + 'T00:00:00') : undefined}
                                    onSelect={(date) => setFecha(date ? formatDate(date) : '')}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                    <div className="space-y-2">
                        <Label>{t('doctor')}</Label>
                        {isDoctorLocked ? (
                            <div className="flex h-10 items-center rounded-md border border-input bg-muted/50 px-3 text-sm text-foreground">
                                <span className="truncate">{doctorName || lockedDoctorName}</span>
                            </div>
                        ) : (
                            <DoctorSelector
                                value={doctorId}
                                selectedDoctorName={doctorName}
                                onValueChange={(id, doctor) => {
                                    setDoctorId(id);
                                    setDoctorName(doctor?.name || '');
                                }}
                                placeholder={t('searchDoctor')}
                                triggerText={t('selectDoctor')}
                                emptyText={t('noDoctor')}
                            />
                        )}
                    </div>
                </div>

                {hasSignature === false && (
                    <Alert>
                        <PenLine className="h-4 w-4" />
                        <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs">{t('signature.missing')}</span>
                            {canDefineSignature && (
                                <Button type="button" variant="outline" size="sm" onClick={() => setIsSignatureDialogOpen(true)}>
                                    {t('signature.define')}
                                </Button>
                            )}
                        </AlertDescription>
                    </Alert>
                )}

                <div className="space-y-2">
                    <Label>{t('diagnosis')}</Label>
                    <Textarea rows={2} value={diagnostico} onChange={(e) => setDiagnostico(e.target.value)} placeholder={t('diagnosisPlaceholder')} />
                </div>
                <div className="space-y-2">
                    <Label>{t('notes')}</Label>
                    <Textarea rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder={t('notesPlaceholder')} />
                </div>
            </div>

            {/* Medicamentos: los ya completados se pliegan a tarjeta */}
            <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                    <Label className="text-base">{t('medications')}</Label>
                    <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        {t('addMedication')}
                    </Button>
                </div>

                {items.map((item, index) => {
                    const isComplete = !!item.medicamento_texto?.trim();
                    const isExpanded = editingItemIndex === index || !isComplete;

                    if (!isExpanded) {
                        const posology = [
                            item.dosis,
                            item.frecuencia,
                            item.duracion_dias != null && String(item.duracion_dias) !== ''
                                ? `${item.duracion_dias} ${tPrint('table.days')}`
                                : '',
                            item.via_administracion,
                        ].filter(Boolean).join(' · ');

                        return (
                            <div key={index} className="flex items-start gap-2 rounded-lg border bg-muted/20 p-2.5">
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold">{item.medicamento_texto}</p>
                                    {item.presentacion && (
                                        <p className="truncate text-xs text-muted-foreground">{item.presentacion}</p>
                                    )}
                                    {posology && <p className="truncate text-xs text-muted-foreground">{posology}</p>}
                                    {item.registrar_en_anamnesis && (
                                        <Badge variant="secondary" className="mt-1 text-[10px] font-normal">
                                            {t('item.inAnamnesis')}
                                        </Badge>
                                    )}
                                </div>
                                <div className="flex shrink-0 items-center gap-0.5">
                                    <Button
                                        type="button" variant="ghost" size="icon" className="h-7 w-7"
                                        onClick={() => setEditingItemIndex(index)}
                                        aria-label={t('item.edit')}
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                        type="button" variant="ghost" size="icon"
                                        className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                        onClick={() => handleRemoveItem(index)}
                                        aria-label={t('item.remove')}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        );
                    }

                    return (
                        <div key={index} className="space-y-3 rounded-lg border p-3">
                            <div className="flex items-start gap-2">
                                <div className="min-w-0 flex-1 space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">{t('item.medication')}</Label>
                                    <MedicationSelector
                                        value={item.medicamento_id || undefined}
                                        selectedMedicationName={item.medicamento_texto}
                                        onValueChange={(id, medication) => updateItem(index, {
                                            medicamento_id: id,
                                            medicamento_texto: medication?.nombre_generico || '',
                                            presentacion: item.presentacion || medication?.nombre_comercial || '',
                                        })}
                                    />
                                </div>
                                <Button
                                    type="button" variant="ghost" size="icon"
                                    className="mt-6 h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                    onClick={() => handleRemoveItem(index)}
                                    aria-label={t('item.remove')}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">{t('item.presentation')}</Label>
                                    <Input value={item.presentacion || ''} onChange={(e) => updateItem(index, { presentacion: e.target.value })} placeholder={t('item.presentationPlaceholder')} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">{t('item.dosage')}</Label>
                                    <Input value={item.dosis || ''} onChange={(e) => updateItem(index, { dosis: e.target.value })} placeholder={t('item.dosagePlaceholder')} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">{t('item.route')}</Label>
                                    <Input value={item.via_administracion || ''} onChange={(e) => updateItem(index, { via_administracion: e.target.value })} placeholder={t('item.routePlaceholder')} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">{t('item.frequency')}</Label>
                                    <Input value={item.frecuencia || ''} onChange={(e) => updateItem(index, { frecuencia: e.target.value })} placeholder={t('item.frequencyPlaceholder')} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">{t('item.durationDays')}</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        value={item.duracion_dias ?? ''}
                                        onChange={(e) => updateItem(index, { duracion_dias: e.target.value ? parseInt(e.target.value, 10) : null })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">{t('item.quantity')}</Label>
                                    <Input value={item.cantidad || ''} onChange={(e) => updateItem(index, { cantidad: e.target.value })} placeholder={t('item.quantityPlaceholder')} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">{t('item.startDate')}</Label>
                                    <Input
                                        type="date"
                                        value={item.fecha_inicio || ''}
                                        onChange={(e) => updateItem(index, { fecha_inicio: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">{t('item.endDate')}</Label>
                                    <Input
                                        type="date"
                                        value={item.fecha_fin || ''}
                                        onChange={(e) => setItems((prev) => prev.map((it, i) => i === index ? { ...it, fecha_fin: e.target.value || null } : it))}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">{t('item.instructions')}</Label>
                                <Textarea rows={2} value={item.indicaciones || ''} onChange={(e) => updateItem(index, { indicaciones: e.target.value })} placeholder={t('item.instructionsPlaceholder')} />
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <label className="flex cursor-pointer items-center gap-2">
                                    <Checkbox
                                        checked={item.registrar_en_anamnesis}
                                        onCheckedChange={(checked) => updateItem(index, { registrar_en_anamnesis: checked === true })}
                                    />
                                    <span className="text-sm">{t('item.registerInAnamnesis')}</span>
                                </label>
                                {isComplete && (
                                    <Button type="button" variant="secondary" size="sm" onClick={() => setEditingItemIndex(null)}>
                                        {t('item.done')}
                                    </Button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Contenido de la receta — plegado: la plantilla ya define el formato */}
            <div className="space-y-2 border-t pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <Button
                        type="button" variant="ghost" size="sm" className="px-1"
                        onClick={() => setIsEditorOpen((prev) => !prev)}
                    >
                        <FileText className="mr-1.5 h-3.5 w-3.5" />
                        {isEditorOpen ? t('hideEditor') : t('showEditor')}
                    </Button>
                </div>
                {isEditorOpen && (
                    <>
                        <p className="text-xs text-muted-foreground">{t('contentHint')}</p>
                        <InstructionRichTextEditor
                            value={contentHtml}
                            onChange={setContentHtml}
                            variables={PRESCRIPTION_TEMPLATE_VARIABLES}
                            groupOrder={PRESCRIPTION_TEMPLATE_VARIABLE_GROUP_ORDER}
                            groupLabels={groupLabels}
                            variablesLabel={t('variables.title')}
                            minHeight="18rem"
                        />
                    </>
                )}
            </div>
        </div>
    );

    // ── Panel derecho: la hoja tal como se va a imprimir ─────────────────────
    const previewPane = (
        <div className="p-4 sm:p-6">
            {contentHtml.trim() ? (
                <div className="mx-auto w-full max-w-[820px] overflow-x-auto rounded-lg border shadow-sm">
                    <PrescriptionDocument
                        contentHtml={contentHtml}
                        source={previewSource}
                        className="min-w-[340px] p-5 sm:p-8"
                    />
                </div>
            ) : (
                <PrescriptionDocumentEmpty message={t('previewEmpty')} />
            )}
        </div>
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent maxWidth="7xl" className="h-full max-h-[95vh] p-0">
                <DialogHeader className="border-b px-4 py-3 sm:px-6 sm:py-4">
                    <DialogTitle>{savedPrescription ? t('editTitle') : t('createTitle')}</DialogTitle>
                </DialogHeader>

                {/* Conmutador Datos / Vista previa — sólo donde no caben las dos columnas */}
                <div className="flex-none border-b px-4 py-2 lg:hidden">
                    <div className="inline-flex w-full gap-1 rounded-xl border border-border bg-muted/30 p-1">
                        {([
                            { id: 'form', label: t('paneForm'), icon: FileText },
                            { id: 'preview', label: t('panePreview'), icon: Eye },
                        ] as const).map((pane) => (
                            <button
                                key={pane.id}
                                type="button"
                                onClick={() => setMobilePane(pane.id)}
                                className={cn(
                                    'flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                                    mobilePane === pane.id
                                        ? 'border-border bg-background text-foreground shadow-sm'
                                        : 'border-transparent text-muted-foreground hover:bg-background/60 hover:text-foreground',
                                )}
                            >
                                <pane.icon className="h-3.5 w-3.5" />
                                {pane.label}
                            </button>
                        ))}
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
                        <div className={cn(
                            'min-h-0 flex-1 overflow-y-auto lg:w-1/2 lg:flex-none',
                            mobilePane !== 'form' && 'hidden lg:block',
                        )}>
                            {formPane}
                        </div>
                        <div className={cn(
                            'min-h-0 flex-1 overflow-y-auto bg-muted/30 lg:w-1/2 lg:flex-none lg:border-l',
                            mobilePane !== 'preview' && 'hidden lg:block',
                        )}>
                            {previewPane}
                        </div>
                    </div>

                    <DialogFooter className="shrink-0 border-t px-4 py-3 sm:px-6 sm:py-4">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={!savedPrescription || isPrinting}
                            onClick={handlePrint}
                        >
                            {isPrinting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Printer className="mr-1.5 h-4 w-4" />}
                            {t('print')}
                        </Button>
                        <DialogCancelButton variant="outline">{t('close')}</DialogCancelButton>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isSubmitting ? t('saving') : t('save')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
            {PrintContainer}

            {/* Definir la firma sin salir de la receta: mismo componente que
                Preferencias, así subir un archivo o dibujarla se guarda igual. */}
            <Dialog open={isSignatureDialogOpen} onOpenChange={setIsSignatureDialogOpen}>
                <DialogContent maxWidth="2xl">
                    <DialogHeader>
                        <DialogTitle>{t('signature.dialogTitle')}</DialogTitle>
                        <DialogDescription>{t('signature.dialogDescription')}</DialogDescription>
                    </DialogHeader>
                    <div className="px-6 py-4">
                        {doctorId && (
                            <SignatureUploader
                                userId={doctorId}
                                canManage={canDefineSignature}
                                onSignatureChange={() => {
                                    // Re-dispara la comprobación y rompe la caché del
                                    // <img> de la vista previa y de la impresión.
                                    setSignatureVersion((v) => v + 1);
                                    setIsSignatureDialogOpen(false);
                                }}
                            />
                        )}
                    </div>
                    <DialogFooter>
                        <DialogCancelButton variant="outline">{t('close')}</DialogCancelButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Dialog>
    );
}
