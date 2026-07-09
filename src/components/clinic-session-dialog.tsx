'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
    Dialog,
    DialogCancelButton,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
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
import { AttachedFile, PatientSession, Quote, Service, TreatmentDetail } from '@/lib/types';
import { addMonths, format, isValid, parseISO } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { Calendar as CalendarIcon, Check, ChevronsUpDown, File, FilePlus, Link2, Loader2, Palette, Plus, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import * as React from 'react';
import { API_ROUTES } from '@/constants/routes';
import { cn, formatDate } from '@/lib/utils';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { getSalesServices } from '@/services/services';
import { ensureDoctorOption } from '@/services/doctors';
import { QuoteFormDialog } from '@/components/sales/quotes/QuoteFormDialog';
import { GOOGLE_CALENDAR_COLORS } from '@/components/calendar/calendar-constants';

interface ClinicSessionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (data: ClinicSessionFormData) => Promise<void>;
    userId: string;
    patientName?: string;
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
        plan_proxima_cita?: string;
        fecha_proxima_cita?: string;
    };
    prefillTreatments?: { numero_diente: number | null; descripcion: string }[];
    existingSession?: PatientSession;  // Para edición de sesión existente
    lockDoctor?: boolean;
    showPatient?: boolean;           // Show read-only patient name field
    showQuoteSelector?: boolean;     // Show quote picker + "Nuevo" button
    showDiagnosticFields?: boolean;  // Show diagnostico + notas_clinicas fields
    // Simplified "annotation" variant (custom calendar mode): adds pieza/color
    // fields, relabels procedure/plan, and fully disables the AI treatment
    // generation (no /ai/treatments calls, no badges, no manual service add).
    annotationMode?: boolean;
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
    diagnostico?: string;
    notas_clinicas?: string;
    plan_proxima_cita?: string;
    fecha_proxima_cita?: string;
    pieza?: string;
    color?: string;
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
    patientName,
    quoteId,
    appointmentId,
    defaultDate,
    serviceName,
    showTreatments = false,
    showAttachments = false,
    showPatient = false,
    showQuoteSelector = false,
    showDiagnosticFields = false,
    annotationMode = false,
    prefillData,
    prefillTreatments,
    existingSession,
    lockDoctor = false,
    pendingAppointmentData,
}: ClinicSessionDialogProps) {
    const t = useTranslations('ClinicSessionDialog');
    const tCommon = useTranslations('ClinicHistoryPage');
    const locale = useLocale();
    const { toast } = useToast();
    const [isDirty, setIsDirty] = React.useState(false);

    const [isLoadingDoctors, setIsLoadingDoctors] = React.useState(false);
    const [doctors, setDoctors] = React.useState<Doctor[]>([]);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [doctorError, setDoctorError] = React.useState(false);
    const [shouldDischargePatient, setShouldDischargePatient] = React.useState(false);
    const [dischargeDate, setDischargeDate] = React.useState('');

    // Treatments state
    const [treatments, setTreatments] = React.useState<{ numero_diente: number | null; descripcion: string }[]>([]);

    // AI-generated treatments (fetched per-field via debounce or button)
    const [aiTreatments, setAiTreatments] = React.useState<TreatmentDetail[]>([]);
    const [isFetchingProcedure, setIsFetchingProcedure] = React.useState(false);
    const [isFetchingPlan, setIsFetchingPlan] = React.useState(false);
    const [isProcedureDebouncing, setIsProcedureDebouncing] = React.useState(false);
    const [isPlanDebouncing, setIsPlanDebouncing] = React.useState(false);
    const isFetchingAiTreatments = isFetchingProcedure || isFetchingPlan;

    // Refs for debounce timers, in-flight fetch guards, and pending-value queue
    const procedureTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const planTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const isFetchingProcedureRef = React.useRef(false);
    const isFetchingPlanRef = React.useRef(false);
    // Pending slot: stores the last value typed while a fetch was in flight
    const pendingProcedureRef = React.useRef<string | null>(null);
    const pendingPlanRef = React.useRef<string | null>(null);
    // Track last prefill values to avoid re-triggering AI generation on unrelated re-renders
    const prevPrefillProcedureRef = React.useRef<string | undefined>(undefined);
    const prevPrefillPlanRef = React.useRef<string | undefined>(undefined);
    // Service catalog for manual add
    const [services, setServices] = React.useState<Service[]>([]);
    const [isLoadingServices, setIsLoadingServices] = React.useState(false);
    // Manual add: which field is adding ('current' | 'next' | null)
    const [addingManualFor, setAddingManualFor] = React.useState<'current' | 'next' | null>(null);
    const [selectedServiceId, setSelectedServiceId] = React.useState('');
    const [servicePopoverOpen, setServicePopoverOpen] = React.useState(false);

    // Quote selector state (used when showQuoteSelector=true)
    const [userQuotes, setUserQuotes] = React.useState<Quote[]>([]);
    const [isLoadingQuotes, setIsLoadingQuotes] = React.useState(false);
    const [isQuoteSearchOpen, setIsQuoteSearchOpen] = React.useState(false);
    const [isQuickQuoteOpen, setIsQuickQuoteOpen] = React.useState(false);
    const [selectedQuote, setSelectedQuote] = React.useState<Quote | null>(null);

    // Attachments state
    const [attachedFiles, setAttachedFiles] = React.useState<File[]>([]);
    const [existingAttachments, setExistingAttachments] = React.useState<AttachedFile[]>([]);
    const [deletedAttachmentIds, setDeletedAttachmentIds] = React.useState<string[]>([]);
    const [isDragOver, setIsDragOver] = React.useState(false);

    const [form, setForm] = React.useState<ClinicSessionFormData>({
        doctor_id: '',
        doctor_name: '',
        fecha_sesion: defaultDate ? formatDate(defaultDate) : formatDate(new Date()),
        procedimiento_realizado: serviceName || '',
        diagnostico: '',
        notas_clinicas: '',
        plan_proxima_cita: '',
        fecha_proxima_cita: '',
        ...(annotationMode ? { pieza: '', color: '' } : {}),
        quote_id: quoteId,
        appointment_id: appointmentId,
    });
    const [isColorPickerOpen, setIsColorPickerOpen] = React.useState(false);

    const doctorOptions = React.useMemo(() => {
        if (!form.doctor_id || !form.doctor_name) return doctors;
        if (doctors.some((doctor) => doctor.id === form.doctor_id)) return doctors;
        return [{ id: form.doctor_id, name: form.doctor_name }, ...doctors];
    }, [doctors, form.doctor_id, form.doctor_name]);

    // Fetch doctors and services catalog when dialog opens
    React.useEffect(() => {
        if (open) {
            fetchDoctors();
            if (services.length === 0) fetchServices();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // Fetch user quotes when showQuoteSelector is true and dialog opens
    React.useEffect(() => {
        if (!open || !showQuoteSelector || !userId) return;
        const loadQuotes = async () => {
            setIsLoadingQuotes(true);
            try {
                const data = await api.get(API_ROUTES.USER_QUOTES, { user_id: userId });
                const raw = Array.isArray(data) ? data : (data.user_quotes || data.data || data.result || []);
                const quotes: Quote[] = raw.map((q: any) => ({
                    id: q.id ? String(q.id) : `qt_${Math.random().toString(36).substr(2, 9)}`,
                    doc_no: q.doc_no || 'N/A',
                    user_id: q.user_id || userId,
                    total: q.total || 0,
                    status: q.status || 'draft',
                    payment_status: q.payment_status || 'unpaid',
                    billing_status: q.billing_status || 'not invoiced',
                    currency: q.currency || 'USD',
                    exchange_rate: q.exchange_rate || 1,
                    notes: q.notes || '',
                    createdAt: q.createdAt || q.created_at || new Date().toISOString().split('T')[0],
                }));
                setUserQuotes(quotes);
            } catch (error) {
                console.error('Failed to load user quotes:', error);
                setUserQuotes([]);
            } finally {
                setIsLoadingQuotes(false);
            }
        };
        loadQuotes();
    }, [open, showQuoteSelector, userId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Sync selectedQuote from form.quote_id once quotes are loaded
    React.useEffect(() => {
        if (!showQuoteSelector || userQuotes.length === 0) return;
        const currentQuoteId = form.quote_id;
        if (currentQuoteId) {
            const match = userQuotes.find(q => q.id === String(currentQuoteId));
            if (match) setSelectedQuote(match);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userQuotes]);

    // Reset form when dialog opens; apply partial updates from agent while already open
    const prevOpenRef = React.useRef(false);
    React.useEffect(() => {
        const justOpened = open && !prevOpenRef.current;
        prevOpenRef.current = open;

        if (!open) {
            if (procedureTimerRef.current) clearTimeout(procedureTimerRef.current);
            if (planTimerRef.current) clearTimeout(planTimerRef.current);
            procedureTimerRef.current = null;
            planTimerRef.current = null;
            return;
        }

        if (justOpened) {
            setForm({
                doctor_id: existingSession?.doctor_id || prefillData?.doctor_id || '',
                doctor_name: existingSession?.doctor_name || prefillData?.doctor_name || '',
                fecha_sesion: existingSession?.fecha_sesion
                    ? formatDate(existingSession.fecha_sesion)
                    : (defaultDate ? formatDate(defaultDate) : formatDate(new Date())),
                procedimiento_realizado: existingSession?.procedimiento_realizado || prefillData?.procedimiento_realizado || serviceName || '',
                diagnostico: existingSession?.diagnostico || '',
                notas_clinicas: existingSession?.notas_clinicas || '',
                plan_proxima_cita: existingSession?.plan_proxima_cita || prefillData?.plan_proxima_cita || '',
                fecha_proxima_cita: existingSession?.fecha_proxima_cita
                    ? formatDate(existingSession.fecha_proxima_cita)
                    : (prefillData?.fecha_proxima_cita ? formatDate(prefillData.fecha_proxima_cita) : ''),
                ...(annotationMode ? {
                    pieza: existingSession?.pieza || '',
                    color: existingSession?.color || '',
                } : {}),
                quote_id: existingSession?.quote_id || quoteId,
                appointment_id: existingSession?.appointment_id || appointmentId,
                sesion_id: existingSession?.sesion_id,
            });

            // For existing sessions: existing treatments go into aiTreatments (badges).
            // For new sessions with prefill: use the tooth-based treatments panel.
            if (existingSession?.tratamientos && existingSession.tratamientos.length > 0) {
                setTreatments([]);
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
            setIsDirty(false);
            setDoctorError(false);
            setShouldDischargePatient(false);
            setDischargeDate('');
            const rawTreatments = existingSession?.tratamientos ?? [];
            setAiTreatments(rawTreatments);
            if (rawTreatments.length > 0) {
                enrichTreatmentsWithServiceNames(rawTreatments).then(enriched => {
                    setAiTreatments(enriched);
                });
            }
            setIsFetchingProcedure(false);
            setIsFetchingPlan(false);
            setIsProcedureDebouncing(false);
            setIsPlanDebouncing(false);
            isFetchingProcedureRef.current = false;
            isFetchingPlanRef.current = false;
            pendingProcedureRef.current = null;
            pendingPlanRef.current = null;
            setAddingManualFor(null);
            setSelectedServiceId('');
            setServicePopoverOpen(false);
            // Reset quote state
            setUserQuotes([]);
            setIsLoadingQuotes(false);
            setIsQuoteSearchOpen(false);
            setIsQuickQuoteOpen(false);
            setSelectedQuote(null);
            return;
        }

        // Dialog already open — agent pushed live updates to prefillData/prefillTreatments
        setForm(prev => ({
            ...prev,
            ...(prefillData?.procedimiento_realizado != null && { procedimiento_realizado: prefillData.procedimiento_realizado }),
            ...(prefillData?.plan_proxima_cita != null && { plan_proxima_cita: prefillData.plan_proxima_cita }),
            ...(prefillData?.fecha_proxima_cita != null && { fecha_proxima_cita: prefillData.fecha_proxima_cita }),
        }));
        if (prefillTreatments && prefillTreatments.length > 0) {
            setTreatments(prefillTreatments.map(t => ({ ...t })));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, prefillData, prefillTreatments]);

    // When the agent prefills procedimiento/plan, auto-generate AI treatment badges
    // (same path as the textarea debounce, but triggered by agent prefill changes)
    React.useEffect(() => {
        if (!open) {
            prevPrefillProcedureRef.current = undefined;
            prevPrefillPlanRef.current = undefined;
            return;
        }
        if (existingSession || annotationMode) return;

        const procedure = prefillData?.procedimiento_realizado;
        const plan = prefillData?.plan_proxima_cita;

        if (procedure && procedure !== prevPrefillProcedureRef.current) {
            prevPrefillProcedureRef.current = procedure;
            handleGenerateForProcedure(procedure);
        }
        if (plan && plan !== prevPrefillPlanRef.current) {
            prevPrefillPlanRef.current = plan;
            handleGenerateForPlan(plan);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, prefillData?.procedimiento_realizado, prefillData?.plan_proxima_cita]);

    const fetchDoctors = async () => {
        setIsLoadingDoctors(true);
        try {
            const data = await api.get(API_ROUTES.USERS_DOCTORS);
            const rawDoctors = Array.isArray(data)
                ? data
                : (data?.doctors || data?.data || data?.result || []);
            let nextDoctors: Doctor[] = rawDoctors.map((doc: any) => ({
                id: String(doc.id),
                name: doc.name ?? doc.nombre ?? '',
            }));

            const currentDoctorId = existingSession?.doctor_id
                ? String(existingSession.doctor_id)
                : (prefillData?.doctor_id || form.doctor_id || '');
            const currentDoctorName = existingSession?.doctor_name
                || existingSession?.nombre_doctor
                || prefillData?.doctor_name
                || form.doctor_name
                || '';

            nextDoctors = await ensureDoctorOption(nextDoctors, currentDoctorId, currentDoctorName);
            setDoctors(nextDoctors);

            if (currentDoctorId) {
                const resolvedDoctor = nextDoctors.find((doctor) => doctor.id === currentDoctorId);
                if (resolvedDoctor?.name && form.doctor_name !== resolvedDoctor.name) {
                    setForm((prev) => ({
                        ...prev,
                        doctor_id: prev.doctor_id || resolvedDoctor.id,
                        doctor_name: resolvedDoctor.name,
                    }));
                }
            }
        } catch (error) {
            console.error("Failed to fetch doctors:", error);
            setDoctors([]);
        } finally {
            setIsLoadingDoctors(false);
        }
    };

    React.useEffect(() => {
        return () => {
            if (procedureTimerRef.current) clearTimeout(procedureTimerRef.current);
            if (planTimerRef.current) clearTimeout(planTimerRef.current);
        };
    }, []);

    const fetchServices = async () => {
        setIsLoadingServices(true);
        try {
            const { items } = await getSalesServices({ limit: 200 });
            setServices(items);
        } catch (error) {
            console.error("Failed to fetch services:", error);
        } finally {
            setIsLoadingServices(false);
        }
    };

    const enrichTreatmentsWithServiceNames = async (
        inputTreatments: TreatmentDetail[]
    ): Promise<TreatmentDetail[]> => {
        return Promise.all(
            inputTreatments.map(async (treatment) => {
                if (treatment.service_name) return treatment;
                const id = treatment.service_id
                    ?? (treatment.service_catalog_id != null ? String(treatment.service_catalog_id) : null);
                if (!id) return treatment;
                try {
                    const data = await api.get(API_ROUTES.SERVICE, { id });
                    const item = Array.isArray(data) ? data[0] : data;
                    const name = item?.name || item?.nombre || item?.service_name;
                    if (name) return { ...treatment, service_name: name };
                } catch {
                    // fall back to descripcion silently
                }
                return treatment;
            })
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!form.doctor_id) {
            setDoctorError(true);
            toast({ title: t('doctorRequired'), variant: 'destructive' });
            return;
        }

        if (shouldDischargePatient && !dischargeDate) {
            toast({ title: t('discharge.dateRequired'), variant: 'destructive' });
            return;
        }

        setIsSubmitting(true);
        try {
            const mergedTreatments: TreatmentDetail[] = [
                ...treatments.map(t => ({
                    numero_diente: t.numero_diente,
                    descripcion: t.descripcion,
                })),
                // Strip the frontend-only `is_manual` flag before sending to backend
                ...aiTreatments.map(({ is_manual: _m, ...rest }) => rest),
            ];

            const dataToSave: ClinicSessionFormData = {
                ...form,
                tratamientos: mergedTreatments,   // always present (may be [])
                ...(showAttachments ? {
                    archivos_adjuntos: attachedFiles,
                    deletedAttachmentIds,
                } : {}),
            };

            // If there's pending appointment data, the parent handles creating both appointment and session
            // Otherwise, just save the session normally
            await onSave(dataToSave);

            if (shouldDischargePatient && dischargeDate) {
                await api.post(API_ROUTES.PATIENT_DISCHARGE, {
                    id: userId,
                    appointment_date: dischargeDate,
                });
                toast({ title: tCommon('discharge.toast.success') });
            }

            toast({ title: t('save') });
            onOpenChange(false);
        } catch (error: any) {
            toast({
                title: shouldDischargePatient ? tCommon('discharge.toast.error') : t('fileUploadError'),
                description: error?.message || '',
                variant: 'destructive'
            });
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

    const handleRemoveAiTreatment = (index: number) => {
        setAiTreatments(prev => prev.filter((_, i) => i !== index));
    };

    const handleAddServiceTreatment = (serviceId: string, forSession: 'current' | 'next') => {
        const svc = services.find(s => s.id === serviceId);
        if (!svc) return;
        setAiTreatments(prev => [...prev, {
            service_id: svc.id,
            service_name: svc.name,
            descripcion: svc.name,
            quantity: 1,
            numero_diente: null,
            is_for_next_session: forSession === 'next',
            is_manual: true,
        }]);
        setSelectedServiceId('');
        setAddingManualFor(null);
        setServicePopoverOpen(false);
    };

    React.useEffect(() => {
        if (addingManualFor !== null) setServicePopoverOpen(true);
    }, [addingManualFor]);

    const parseAiResponse = (aiResponse: any): TreatmentDetail[] => {
        const responseData = Array.isArray(aiResponse) ? aiResponse[0] : aiResponse;
        if (Array.isArray(responseData?.tratamientos)) return responseData.tratamientos as TreatmentDetail[];
        if (Array.isArray(aiResponse) && aiResponse[0]?.service_id !== undefined) return aiResponse as TreatmentDetail[];
        return [];
    };

    const handleGenerateForProcedure = async (text: string) => {
        if (annotationMode || !text.trim()) return;
        // If a fetch is already in flight, queue this value — only the last one will be processed
        if (isFetchingProcedureRef.current) {
            pendingProcedureRef.current = text;
            return;
        }
        pendingProcedureRef.current = null;
        if (procedureTimerRef.current) { clearTimeout(procedureTimerRef.current); procedureTimerRef.current = null; }
        setIsProcedureDebouncing(false);
        setIsFetchingProcedure(true);
        isFetchingProcedureRef.current = true;
        try {
            const aiResponse = await Promise.race([
                api.post(API_ROUTES.AI.TREATMENTS, { procedimiento: text, proxima_sesion_clinica: null }),
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 15_000)),
            ]);
            const parsed = parseAiResponse(aiResponse);
            // Keep: all next-session treatments + manually-added current-session ones
            setAiTreatments(prev => [
                ...prev.filter(tr => tr.is_for_next_session === true || tr.is_manual === true),
                ...parsed,
            ]);
        } catch (err) {
            console.warn('[ClinicSessionDialog] AI treatments (procedure) failed:', err);
            toast({ title: t('aiTreatments.error'), variant: 'destructive' });
        } finally {
            setIsFetchingProcedure(false);
            isFetchingProcedureRef.current = false;
            // Process the latest queued value, ignoring all intermediate ones
            const pending = pendingProcedureRef.current;
            if (pending) { pendingProcedureRef.current = null; handleGenerateForProcedure(pending); }
        }
    };

    const handleGenerateForPlan = async (text: string) => {
        if (annotationMode || !text.trim()) return;
        if (isFetchingPlanRef.current) {
            pendingPlanRef.current = text;
            return;
        }
        pendingPlanRef.current = null;
        if (planTimerRef.current) { clearTimeout(planTimerRef.current); planTimerRef.current = null; }
        setIsPlanDebouncing(false);
        setIsFetchingPlan(true);
        isFetchingPlanRef.current = true;
        try {
            const aiResponse = await Promise.race([
                api.post(API_ROUTES.AI.TREATMENTS, { procedimiento: null, proxima_sesion_clinica: text }),
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 15_000)),
            ]);
            const parsed = parseAiResponse(aiResponse);
            // Keep: all current-session treatments + manually-added next-session ones
            setAiTreatments(prev => [
                ...prev.filter(tr => tr.is_for_next_session !== true || tr.is_manual === true),
                ...parsed,
            ]);
        } catch (err) {
            console.warn('[ClinicSessionDialog] AI treatments (plan) failed:', err);
            toast({ title: t('aiTreatments.error'), variant: 'destructive' });
        } finally {
            setIsFetchingPlan(false);
            isFetchingPlanRef.current = false;
            const pending = pendingPlanRef.current;
            if (pending) { pendingPlanRef.current = null; handleGenerateForPlan(pending); }
        }
    };

    const DEBOUNCE_MS = 1500;

    const handleProcedureChange = (value: string) => {
        setIsDirty(true);
        setForm(prev => ({ ...prev, procedimiento_realizado: value }));
        if (annotationMode) return;
        if (procedureTimerRef.current) clearTimeout(procedureTimerRef.current);
        if (value.trim()) {
            setIsProcedureDebouncing(true);
            procedureTimerRef.current = setTimeout(() => {
                setIsProcedureDebouncing(false);
                handleGenerateForProcedure(value);
            }, DEBOUNCE_MS);
        } else {
            setIsProcedureDebouncing(false);
        }
    };

    const handlePlanChange = (value: string) => {
        setIsDirty(true);
        setForm(prev => ({ ...prev, plan_proxima_cita: value }));
        if (annotationMode) return;
        if (planTimerRef.current) clearTimeout(planTimerRef.current);
        if (value.trim()) {
            setIsPlanDebouncing(true);
            planTimerRef.current = setTimeout(() => {
                setIsPlanDebouncing(false);
                handleGenerateForPlan(value);
            }, DEBOUNCE_MS);
        } else {
            setIsPlanDebouncing(false);
        }
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
                maxWidth="2xl"
                showMaximize
                maximizeLabel={tCommon('viewer.maximize')}
                restoreLabel={tCommon('viewer.restore')}
                className="h-full max-h-[90vh] max-w-2xl p-0"
                confirmOnClose
                isDirty={isDirty}
            >
                <DialogHeader className="border-b px-6 py-4">
                    <DialogTitle>
                        {annotationMode
                            ? (existingSession ? t('annotation.editTitle') : t('annotation.createTitle'))
                            : (existingSession ? t('editTitle') : t('createTitle'))}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                    <div className="flex-1 min-h-0 w-full overflow-y-auto overscroll-contain px-6 py-4" style={{ WebkitOverflowScrolling: 'touch' }}>
                        <div className="grid content-start gap-4 md:grid-cols-2">
                                {/* Patient (read-only) */}
                                {showPatient && (
                                    <div className="space-y-2 md:col-span-2">
                                        <Label>{t('patientLabel')}</Label>
                                        <Input
                                            value={patientName || ''}
                                            readOnly
                                            disabled
                                            className="bg-muted text-muted-foreground cursor-not-allowed"
                                        />
                                    </div>
                                )}
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
                                                onSelect={(date) => setForm({ ...form, fecha_sesion: date ? formatDate(date) : '' })}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                {/* Pieza (annotation mode only) */}
                                {annotationMode && (
                                    <div className="space-y-2">
                                        <Label>{t('annotation.piece')}</Label>
                                        <Input
                                            value={form.pieza || ''}
                                            onChange={(e) => {
                                                setIsDirty(true);
                                                setForm(prev => ({ ...prev, pieza: e.target.value }));
                                            }}
                                            placeholder={t('annotation.piecePlaceholder')}
                                        />
                                    </div>
                                )}

                                {/* Doctor */}
                                <div className="space-y-2">
                                    <Label>{t('doctor')}</Label>
                                    <Select
                                        value={form.doctor_id}
                                        onValueChange={(value) => {
                                            if (lockDoctor) return;
                                            const selectedDoc = doctorOptions.find(d => d.id === value);
                                            setIsDirty(true);
                                            setForm({
                                                ...form,
                                                doctor_id: value,
                                                doctor_name: selectedDoc?.name || ''
                                            });
                                            setDoctorError(false);
                                        }}
                                        disabled={lockDoctor}
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
                                                doctorOptions.map((doc) => (
                                                    <SelectItem key={doc.id} value={doc.id}>{doc.name}</SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Color (annotation mode only) — same palette as the calendar */}
                                {annotationMode && (
                                    <div className="space-y-2">
                                        <Label>{t('annotation.color')}</Label>
                                        <Popover open={isColorPickerOpen} onOpenChange={setIsColorPickerOpen}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="h-10 w-full justify-start gap-2 font-normal"
                                                >
                                                    {form.color ? (
                                                        <span
                                                            className="h-4 w-4 shrink-0 rounded-full border"
                                                            style={{ backgroundColor: form.color }}
                                                        />
                                                    ) : (
                                                        <Palette className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                    )}
                                                    <span className={cn(!form.color && 'text-muted-foreground')}>
                                                        {form.color || t('annotation.selectColor')}
                                                    </span>
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-2" align="start">
                                                <div className="grid grid-cols-4 gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setIsDirty(true);
                                                            setForm(prev => ({ ...prev, color: '' }));
                                                            setIsColorPickerOpen(false);
                                                        }}
                                                        className="flex h-6 w-6 items-center justify-center rounded-full border text-muted-foreground transition-transform hover:scale-110"
                                                        aria-label={t('annotation.noColor')}
                                                        title={t('annotation.noColor')}
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                    {GOOGLE_CALENDAR_COLORS.map((color) => (
                                                        <button
                                                            key={color.id}
                                                            type="button"
                                                            onClick={() => {
                                                                setIsDirty(true);
                                                                setForm(prev => ({ ...prev, color: color.hex }));
                                                                setIsColorPickerOpen(false);
                                                            }}
                                                            className={cn(
                                                                'h-6 w-6 rounded-full transition-transform hover:scale-110',
                                                                form.color === color.hex && 'ring-2 ring-ring ring-offset-2'
                                                            )}
                                                            style={{ backgroundColor: color.hex }}
                                                            aria-label={color.hex}
                                                        />
                                                    ))}
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                )}

                                {/* Quote Selector */}
                                {showQuoteSelector && (
                                    <div className="space-y-2 md:col-span-2">
                                        <div className="flex items-center justify-between">
                                            <Label className="flex items-center gap-1">
                                                <Link2 className="h-3.5 w-3.5" />
                                                {t('quoteLabel')}
                                            </Label>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 px-2 text-xs"
                                                onClick={() => setIsQuickQuoteOpen(true)}
                                            >
                                                <FilePlus className="h-3 w-3 mr-1" />
                                                {t('newQuote')}
                                            </Button>
                                        </div>
                                        <Popover open={isQuoteSearchOpen} onOpenChange={setIsQuoteSearchOpen}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="w-full justify-start h-10"
                                                    disabled={isLoadingQuotes}
                                                >
                                                    {isLoadingQuotes ? (
                                                        t('loadingQuotes')
                                                    ) : selectedQuote ? (
                                                        <span className="flex items-center gap-2 text-sm">
                                                            <span className="font-medium">{selectedQuote.doc_no}</span>
                                                            <span className="text-muted-foreground">
                                                                {selectedQuote.createdAt && isValid(parseISO(selectedQuote.createdAt)) ? format(parseISO(selectedQuote.createdAt), 'dd/MM/yyyy') : ''}
                                                            </span>
                                                            <span className="text-muted-foreground">
                                                                ({new Intl.NumberFormat('en-US', { style: 'currency', currency: selectedQuote.currency || 'USD' }).format(selectedQuote.total)})
                                                            </span>
                                                        </span>
                                                    ) : (
                                                        t('selectQuote')
                                                    )}
                                                    <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                                <Command>
                                                    <CommandInput placeholder={t('searchQuotePlaceholder')} />
                                                    <CommandList>
                                                        <CommandEmpty>{t('noQuotes')}</CommandEmpty>
                                                        <CommandGroup>
                                                            <CommandItem
                                                                onSelect={() => {
                                                                    setSelectedQuote(null);
                                                                    setForm(prev => ({ ...prev, quote_id: '' }));
                                                                    setIsQuoteSearchOpen(false);
                                                                }}
                                                            >
                                                                <Check className={cn("mr-2 h-4 w-4", !selectedQuote ? "opacity-100" : "opacity-0")} />
                                                                {t('noQuote')}
                                                            </CommandItem>
                                                            {userQuotes.map(quote => (
                                                                <CommandItem
                                                                    key={quote.id}
                                                                    value={quote.doc_no || quote.id}
                                                                    onSelect={() => {
                                                                        setSelectedQuote(quote);
                                                                        setForm(prev => ({ ...prev, quote_id: quote.id }));
                                                                        setIsQuoteSearchOpen(false);
                                                                    }}
                                                                >
                                                                    <Check className={cn("mr-2 h-4 w-4", selectedQuote?.id === quote.id ? "opacity-100" : "opacity-0")} />
                                                                    <div className="flex flex-col">
                                                                        <span className="font-medium">{quote.doc_no}</span>
                                                                        <span className="text-xs text-muted-foreground">
                                                                            {quote.createdAt ? format(parseISO(quote.createdAt), 'dd/MM/yyyy') : ''} • {new Intl.NumberFormat('en-US', { style: 'currency', currency: quote.currency || 'USD' }).format(quote.total)}
                                                                        </span>
                                                                    </div>
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                )}

                                {/* Procedure + current-session treatment badges */}
                                <div className="space-y-2 md:col-span-2">
                                    <Label>{annotationMode ? t('annotation.annotationLabel') : t('procedure')}</Label>
                                    <Textarea
                                        value={form.procedimiento_realizado}
                                        onChange={(e) => handleProcedureChange(e.target.value)}
                                        placeholder={annotationMode ? t('annotation.annotationPlaceholder') : t('procedurePlaceholder')}
                                        className="min-h-[80px] xl:min-h-[100px] resize-y"
                                    />
                                    {/* Current-session badges + loading + Añadir */}
                                    {!annotationMode && (
                                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                        {(isFetchingProcedure || isProcedureDebouncing) ? (
                                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground italic">
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                {t('aiTreatments.generating')}
                                            </span>
                                        ) : (
                                            aiTreatments
                                                .map((treatment, originalIdx) => ({ treatment, originalIdx }))
                                                .filter(({ treatment }) => treatment.is_for_next_session !== true)
                                                .map(({ treatment, originalIdx }) => (
                                                    <span
                                                        key={originalIdx}
                                                        title={treatment.is_manual ? t('treatments.add') : t('aiTreatments.currentSession')}
                                                        className={cn(
                                                            "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                                                            treatment.is_manual
                                                                ? "border border-amber-300 bg-amber-50 text-amber-600 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                                                                : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                                                        )}
                                                    >
                                                        {!treatment.is_manual && <Sparkles className="h-3 w-3 opacity-70" />}
                                                        {treatment.service_name || treatment.descripcion}
                                                        {treatment.quantity && treatment.quantity > 1 && (
                                                            <span className="opacity-70">×{treatment.quantity}</span>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveAiTreatment(originalIdx)}
                                                            className="ml-0.5 rounded-full p-0.5 hover:bg-amber-200 dark:hover:bg-amber-800/60 transition-colors"
                                                            aria-label={t('aiTreatments.remove')}
                                                        >
                                                            <X className="h-2.5 w-2.5" />
                                                        </button>
                                                    </span>
                                                ))
                                        )}
                                        {addingManualFor !== 'current' && !isFetchingProcedure && !isProcedureDebouncing && (
                                            <button
                                                type="button"
                                                onClick={() => { setAddingManualFor('current'); setSelectedServiceId(''); }}
                                                className="inline-flex items-center gap-0.5 rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
                                            >
                                                <Plus className="h-2.5 w-2.5" />
                                                {t('treatments.add')}
                                            </button>
                                        )}
                                    </div>
                                    )}
                                    {/* Manual add panel for current-session treatments */}
                                    {addingManualFor === 'current' && (
                                        <div className="flex items-center gap-2 rounded-md border bg-muted/20 p-2">
                                            <Popover open={servicePopoverOpen} onOpenChange={setServicePopoverOpen}>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        role="combobox"
                                                        aria-expanded={servicePopoverOpen}
                                                        className="h-7 text-xs flex-1 min-w-[180px] justify-between font-normal"
                                                    >
                                                        <span className="truncate">{t('aiTreatments.selectService')}</span>
                                                        <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[280px] p-0" align="start">
                                                    <Command>
                                                        <CommandInput placeholder={t('aiTreatments.searchService')} className="h-8 text-xs" />
                                                        <CommandList>
                                                            {isLoadingServices ? (
                                                                <div className="flex items-center justify-center py-4">
                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">
                                                                        {t('aiTreatments.noServices')}
                                                                    </CommandEmpty>
                                                                    <CommandGroup>
                                                                        {services.map(svc => (
                                                                            <CommandItem
                                                                                key={svc.id}
                                                                                value={svc.name}
                                                                                onSelect={() => handleAddServiceTreatment(svc.id, 'current')}
                                                                                className="text-xs"
                                                                            >
                                                                                {svc.name}
                                                                            </CommandItem>
                                                                        ))}
                                                                    </CommandGroup>
                                                                </>
                                                            )}
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                            <button
                                                type="button"
                                                onClick={() => { setAddingManualFor(null); setSelectedServiceId(''); setServicePopoverOpen(false); }}
                                                className="inline-flex h-7 items-center justify-center rounded-md hover:bg-destructive/10 transition-colors px-2 text-muted-foreground"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Diagnosis + Clinical Notes (optional) */}
                                {showDiagnosticFields && (
                                    <>
                                        <div className="space-y-2 md:col-span-2">
                                            <Label>{t('diagnosis')}</Label>
                                            <Textarea
                                                value={form.diagnostico || ''}
                                                onChange={(e) => setForm(prev => ({ ...prev, diagnostico: e.target.value }))}
                                                placeholder={t('diagnosisPlaceholder')}
                                                className="min-h-[80px] resize-y"
                                            />
                                        </div>
                                        <div className="space-y-2 md:col-span-2">
                                            <Label>{t('notes')}</Label>
                                            <Textarea
                                                value={form.notas_clinicas || ''}
                                                onChange={(e) => setForm(prev => ({ ...prev, notas_clinicas: e.target.value }))}
                                                placeholder={t('notesPlaceholder')}
                                                className="min-h-[80px] resize-y"
                                            />
                                        </div>
                                    </>
                                )}

                                {/* Next Appointment Plan + next-session treatment badges */}
                                <div className="space-y-2 md:col-span-2">
                                    <Label>{annotationMode ? t('annotation.nextLabel') : t('nextSessionPlan')}</Label>
                                    <Textarea
                                        value={form.plan_proxima_cita || ''}
                                        onChange={(e) => handlePlanChange(e.target.value)}
                                        placeholder={annotationMode ? t('annotation.nextPlaceholder') : t('nextSessionPlanPlaceholder')}
                                        className="min-h-[60px] xl:min-h-[80px] resize-y"
                                    />
                                    {/* Next-session badges + loading + Añadir */}
                                    {!annotationMode && (
                                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                        {(isFetchingPlan || isPlanDebouncing) ? (
                                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground italic">
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                {t('aiTreatments.generating')}
                                            </span>
                                        ) : (
                                            aiTreatments
                                                .map((treatment, originalIdx) => ({ treatment, originalIdx }))
                                                .filter(({ treatment }) => treatment.is_for_next_session === true)
                                                .map(({ treatment, originalIdx }) => (
                                                    <span
                                                        key={originalIdx}
                                                        title={treatment.is_manual ? t('treatments.add') : t('aiTreatments.nextSession')}
                                                        className={cn(
                                                            "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                                                            treatment.is_manual
                                                                ? "border border-blue-300 bg-blue-50 text-blue-600 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-400"
                                                                : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                                                        )}
                                                    >
                                                        {!treatment.is_manual && <Sparkles className="h-3 w-3 opacity-70" />}
                                                        {treatment.service_name || treatment.descripcion}
                                                        {treatment.quantity && treatment.quantity > 1 && (
                                                            <span className="opacity-70">×{treatment.quantity}</span>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveAiTreatment(originalIdx)}
                                                            className="ml-0.5 rounded-full p-0.5 hover:bg-blue-200 dark:hover:bg-blue-800/60 transition-colors"
                                                            aria-label={t('aiTreatments.remove')}
                                                        >
                                                            <X className="h-2.5 w-2.5" />
                                                        </button>
                                                    </span>
                                                ))
                                        )}
                                        {addingManualFor !== 'next' && !isFetchingPlan && !isPlanDebouncing && (
                                            <button
                                                type="button"
                                                onClick={() => { setAddingManualFor('next'); setSelectedServiceId(''); }}
                                                className="inline-flex items-center gap-0.5 rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
                                            >
                                                <Plus className="h-2.5 w-2.5" />
                                                {t('treatments.add')}
                                            </button>
                                        )}
                                    </div>
                                    )}
                                    {/* Manual add panel for next-session treatments */}
                                    {addingManualFor === 'next' && (
                                        <div className="flex items-center gap-2 rounded-md border bg-muted/20 p-2">
                                            <Popover open={servicePopoverOpen} onOpenChange={setServicePopoverOpen}>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        role="combobox"
                                                        aria-expanded={servicePopoverOpen}
                                                        className="h-7 text-xs flex-1 min-w-[180px] justify-between font-normal"
                                                    >
                                                        <span className="truncate">{t('aiTreatments.selectService')}</span>
                                                        <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[280px] p-0" align="start">
                                                    <Command>
                                                        <CommandInput placeholder={t('aiTreatments.searchService')} className="h-8 text-xs" />
                                                        <CommandList>
                                                            {isLoadingServices ? (
                                                                <div className="flex items-center justify-center py-4">
                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">
                                                                        {t('aiTreatments.noServices')}
                                                                    </CommandEmpty>
                                                                    <CommandGroup>
                                                                        {services.map(svc => (
                                                                            <CommandItem
                                                                                key={svc.id}
                                                                                value={svc.name}
                                                                                onSelect={() => handleAddServiceTreatment(svc.id, 'next')}
                                                                                className="text-xs"
                                                                            >
                                                                                {svc.name}
                                                                            </CommandItem>
                                                                        ))}
                                                                    </CommandGroup>
                                                                </>
                                                            )}
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                            <button
                                                type="button"
                                                onClick={() => { setAddingManualFor(null); setSelectedServiceId(''); setServicePopoverOpen(false); }}
                                                className="inline-flex h-7 items-center justify-center rounded-md hover:bg-destructive/10 transition-colors px-2 text-muted-foreground"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {!annotationMode && (
                                <div className="space-y-3 md:col-span-2">
                                    <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
                                        <Checkbox
                                            id="discharge-patient"
                                            checked={shouldDischargePatient}
                                            onCheckedChange={(checked) => {
                                                const enabled = Boolean(checked);
                                                setShouldDischargePatient(enabled);
                                                if (!enabled) {
                                                    setDischargeDate('');
                                                }
                                            }}
                                            className="mt-0.5"
                                        />
                                        <div className="space-y-1">
                                            <Label htmlFor="discharge-patient" className="cursor-pointer text-sm font-medium">
                                                {t('discharge.checkboxLabel')}
                                            </Label>
                                            <p className="text-xs text-muted-foreground">
                                                {t('discharge.checkboxDescription')}
                                            </p>
                                        </div>
                                    </div>

                                    {shouldDischargePatient && (
                                        <div className="space-y-3 rounded-xl border border-border/70 bg-card p-4">
                                            <div className="space-y-3">
                                                <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                                                    {tCommon('discharge.optionsLabel')}
                                                </Label>
                                                <div className="flex flex-wrap gap-2">
                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        size="sm"
                                                        className="rounded-full"
                                                        onClick={() => setDischargeDate(format(addMonths(new Date(), 1), 'yyyy-MM-dd'))}
                                                    >
                                                        {tCommon('discharge.option1Month')}
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        size="sm"
                                                        className="rounded-full"
                                                        onClick={() => setDischargeDate(format(addMonths(new Date(), 3), 'yyyy-MM-dd'))}
                                                    >
                                                        {tCommon('discharge.option3Months')}
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        size="sm"
                                                        className="rounded-full"
                                                        onClick={() => setDischargeDate(format(addMonths(new Date(), 6), 'yyyy-MM-dd'))}
                                                    >
                                                        {tCommon('discharge.option6Months')}
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        size="sm"
                                                        className="rounded-full"
                                                        onClick={() => setDischargeDate(format(addMonths(new Date(), 12), 'yyyy-MM-dd'))}
                                                    >
                                                        {tCommon('discharge.option1Year')}
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label>{tCommon('discharge.dateLabel')}</Label>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            className={cn(
                                                                "w-full justify-start text-left font-normal h-10 border-input",
                                                                !dischargeDate && "text-muted-foreground"
                                                            )}
                                                        >
                                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                                            {dischargeDate
                                                                ? format(new Date(dischargeDate + 'T00:00:00'), 'dd/MM/yyyy', { locale: dateLocale })
                                                                : tCommon('discharge.datePlaceholder')}
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0" align="start">
                                                        <Calendar
                                                            mode="single"
                                                            selected={dischargeDate ? new Date(dischargeDate + 'T00:00:00') : undefined}
                                                            onSelect={(date) => setDischargeDate(date ? formatDate(date) : '')}
                                                            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                                                            initialFocus
                                                        />
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                )}

                                {/* Inline Treatments panel */}
                                {showTreatments && (
                                    <div className="space-y-2 md:col-span-2">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs font-semibold">{t('treatments.title')}</Label>
                                            <Button type="button" variant="ghost" size="sm" onClick={handleAddTreatment} className="h-7 px-2 text-xs">
                                                <Plus className="h-3 w-3 mr-1" />
                                                {t('treatments.add') || 'Añadir'}
                                            </Button>
                                        </div>
                                        <div className="min-h-[80px] max-h-[200px] overflow-y-auto space-y-2 rounded-lg border bg-muted/5 p-2">
                                            {treatments.length === 0 ? (
                                                <div className="flex min-h-[60px] items-center justify-center text-xs text-muted-foreground italic">
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
                                    </div>
                                )}

                                {/* Compact inline attachments section */}
                                {showAttachments && (
                                    <div className="space-y-2 md:col-span-2">
                                        <Label className="text-xs font-semibold">{t('attachments.title')}</Label>
                                        {/* Compact horizontal dropzone */}
                                        <div
                                            className={cn(
                                                "flex items-center gap-3 rounded-lg border-2 border-dashed px-4 py-2.5 transition-colors",
                                                isDragOver ? "border-primary bg-primary/10" : "border-muted-foreground/25 hover:border-muted-foreground/40 bg-muted/30"
                                            )}
                                            onDragOver={handleDragOver}
                                            onDragLeave={handleDragLeave}
                                            onDrop={handleDrop}
                                        >
                                            <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
                                            <p className="text-xs text-muted-foreground flex-1">{t('attachments.dropzone')}</p>
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
                                                className="cursor-pointer text-xs font-semibold text-primary hover:underline shrink-0"
                                            >
                                                {t('attachments.browseFiles')}
                                            </Label>
                                        </div>
                                        {/* File chips */}
                                        {(existingAttachments.length > 0 || attachedFiles.length > 0) && (
                                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                                                {existingAttachments.map((attachment: AttachedFile, idx: number) => (
                                                    <div
                                                        key={`ex-${idx}`}
                                                        className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs"
                                                    >
                                                        <File className="h-3 w-3 shrink-0" />
                                                        <span className="truncate max-w-[160px]">{attachment.file_name || attachment.ruta || 'File'}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => attachment.id && handleDeleteExistingAttachment(attachment.id)}
                                                            className="ml-0.5 text-muted-foreground hover:text-destructive transition-colors"
                                                        >
                                                            <X className="h-2.5 w-2.5" />
                                                        </button>
                                                    </div>
                                                ))}
                                                {attachedFiles.map((file, idx) => (
                                                    <div
                                                        key={`new-${idx}`}
                                                        className="flex items-center gap-1 rounded-md bg-primary/10 text-primary px-2 py-1 text-xs"
                                                    >
                                                        <File className="h-3 w-3 shrink-0" />
                                                        <span className="truncate max-w-[160px]">{file.name}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveNewFile(idx)}
                                                            className="ml-0.5 hover:text-destructive transition-colors"
                                                        >
                                                            <X className="h-2.5 w-2.5" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                        </div>
                    </div>
                    <DialogFooter className="px-6 py-4 border-t shrink-0">
                        <DialogCancelButton variant="outline">
                            {t('cancel')}
                        </DialogCancelButton>
                        <Button type="submit" disabled={isSubmitting || isFetchingProcedure || isFetchingPlan || isProcedureDebouncing || isPlanDebouncing}>
                            {(isSubmitting || isFetchingProcedure || isFetchingPlan || isProcedureDebouncing || isPlanDebouncing) && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            {isSubmitting ? t('saving') : t('save')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>

            {/* Quick Quote Dialog — only rendered when showQuoteSelector is true */}
            {showQuoteSelector && (
                <QuoteFormDialog
                    open={isQuickQuoteOpen}
                    onOpenChange={setIsQuickQuoteOpen}
                    initialData={{ user: { id: userId, name: patientName || '', email: '', phone_number: '', is_active: true, avatar: '' } }}
                    onQuoteCreated={(newQuote) => {
                        setUserQuotes(prev => [newQuote, ...prev]);
                        setSelectedQuote(newQuote);
                        setForm(prev => ({ ...prev, quote_id: newQuote.id }));
                    }}
                />
            )}
        </Dialog>
    );
}
