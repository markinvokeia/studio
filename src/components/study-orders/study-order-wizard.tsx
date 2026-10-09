'use client';

import * as React from 'react';
import { ArrowLeft, ArrowRight, Check, ClipboardList, Images, ListChecks, Loader2, PanelLeft, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DoctorSelector } from '@/components/ui/doctor-selector';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ResizableSheet, SheetDescription, SheetTitle } from '@/components/ui/resizable-sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { UserSelector } from '@/components/ui/user-selector';

import { OrderFilesPanel } from './order-files-panel';
import type { OrderFile } from './order-file-gallery';
import { ReviewFlag } from './review-flag';
import { ReviewActionsProvider, ReviewLocateProvider, hasSource, toOriginalFocus, type OriginalFocus } from './review-locate';
import { ReviewFieldEditor, type ReviewFieldEditorProps } from './review-field-editor';
import { PATIENT_STEP, resolveReviewTarget, resolveReviewTargets } from './review-targets';
import { StudyOrderReviewList, countPendingBlocking } from './study-order-review-list';
import { useReviewItemActions } from './use-review-item-actions';
import { StudyOrderSection } from './study-order-section';
import {
    StudyOrderSummary, labelForDelivery, labelForModifier,
    type StudyOrderSummarySection,
} from './study-order-summary';

import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import { fetchBookingSedes, type BookingSede } from '@/services/patient-booking';
import {
    getStudyOrder,
    getStudyOrderFormOptions,
    getWhatsappIntakeFile,
    submitStudyOrder,
    upsertStudyOrder,
} from '@/services/study-orders';
import { STUDY_ORDERS_PERMISSIONS } from '@/constants/permissions';
import type {
    StudyOrderCatalogService,
    StudyOrderFormOptions,
    StudyOrderOption,
    StudyOrderReviewItem,
    StudyOrderSection as Section,
    StudyOrderUpsertPayload,
    User,
    WhatsappIntakeFile,
} from '@/lib/types';

/**
 * Alta y edición de una orden de estudio, como asistente paso a paso.
 *
 * Abre en un panel de ancho completo (el mismo `ResizableSheet` del Estado de
 * Cuenta) porque las 12 secciones de la orden no entran cómodas en un modal.
 *
 * El recorrido es: paciente → una pantalla por sección con contenido → resumen.
 * Sólo se muestran las secciones del formulario, en su orden original, y el
 * último paso deja ver todo lo pedido antes de guardar o enviar.
 */

export interface StudyOrderWizardProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Sin id = alta. Con id = edición de un borrador. */
    orderId?: string | null;
    orderNumber?: string | null;
    onSaved?: () => void;
}

/** Originales de WhatsApp que se muestran al lado del formulario. */
interface OriginalsSource {
    intakeId: string;
    files: WhatsappIntakeFile[];
}

/** Archivos de WhatsApp en la forma del panel de originales. */
const toOrderFiles = (files: WhatsappIntakeFile[]): OrderFile[] =>
    files.map((f) => ({ id: f.id, name: f.file_name, mimeType: f.mime_type }));

/** El panel de originales arranca abierto donde hay lugar para él al lado del formulario. */
const isWideScreen = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;

interface SelectionState {
    services: Map<string, StudyOrderCatalogService>;
    itemModifiers: Record<string, Record<string, string[]>>;
    itemNotes: Record<string, string>;
    sectionModifiers: Record<string, Record<string, string[]>>;
    teeth: Record<string, string[]>;
}

const EMPTY_SELECTION: SelectionState = {
    services: new Map(),
    itemModifiers: {},
    itemNotes: {},
    sectionModifiers: {},
    teeth: {},
};

function toggleInGroup(
    current: Record<string, Record<string, string[]>>,
    outerKey: string,
    groupCode: string,
    code: string,
): Record<string, Record<string, string[]>> {
    const groups = current[outerKey] ?? {};
    const values = groups[groupCode] ?? [];
    const next = values.includes(code) ? values.filter((v) => v !== code) : [...values, code];
    return { ...current, [outerKey]: { ...groups, [groupCode]: next } };
}

/** Un paso del asistente: la portada del paciente, cada sección, y el resumen. */
type Step =
    | { kind: 'patient' }
    | { kind: 'section'; section: Section }
    | { kind: 'review' };

export function StudyOrderWizard({
    open,
    onOpenChange,
    orderId,
    orderNumber,
    onSaved,
}: StudyOrderWizardProps) {
    const t = useTranslations('StudyOrdersPage');
    const { toast } = useToast();
    const { hasPermission } = usePermissions();
    // Quien puede crear órdenes para otros (recepción, administración) elige el doctor derivador
    // o la deja sin doctor. Sin el permiso la orden es siempre de quien la crea (el doctor).
    const canChooseDoctor = hasPermission(STUDY_ORDERS_PERMISSIONS.CREATE_FOR_DOCTOR);
    const isCreating = !orderId;

    const [options, setOptions] = React.useState<StudyOrderFormOptions | null>(null);
    const [sedes, setSedes] = React.useState<BookingSede[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);
    const [stepIndex, setStepIndex] = React.useState(0);
    const [confirmSubmit, setConfirmSubmit] = React.useState(false);
    // En mobile el riel es un cajón: ocupa toda la pantalla y tapa el contenido,
    // así que se cierra solo al elegir una sección.
    const [isRailOpen, setIsRailOpen] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const [patientId, setPatientId] = React.useState('');
    const [patientName, setPatientName] = React.useState('');
    const [patientDocument, setPatientDocument] = React.useState('');
    const [patientPhone, setPatientPhone] = React.useState('');
    const [patientEmail, setPatientEmail] = React.useState('');
    /**
     * Qué campos vienen de la ficha del paciente y no de la mano del derivador.
     *
     * Hace falta para no arrastrar datos entre pacientes: si se elige a uno con
     * teléfono y después se cambia a otro que no tiene, el teléfono del primero
     * se quedaría en el formulario y terminaría guardado en la orden del
     * segundo. Al cambiar de paciente se limpia lo autocompletado y se rellena
     * con lo del nuevo.
     *
     * Lo que el derivador escribió a mano no se toca: si se tomó el trabajo de
     * cargar un teléfono que la ficha no tiene, es dato bueno.
     */
    const [autoFilled, setAutoFilled] = React.useState<Record<'document' | 'phone' | 'email', boolean>>({
        document: false, phone: false, email: false,
    });
    const markManual = React.useCallback((field: 'document' | 'phone' | 'email') => {
        setAutoFilled((prev) => (prev[field] ? { ...prev, [field]: false } : prev));
    }, []);
    const [sedeId, setSedeId] = React.useState('');
    const [deliveryMethods, setDeliveryMethods] = React.useState<string[]>([]);
    const [clinicalNotes, setClinicalNotes] = React.useState('');
    const [texts, setTexts] = React.useState<Record<string, string>>({});
    const [loadedNumber, setLoadedNumber] = React.useState('');
    const [selection, setSelection] = React.useState<SelectionState>(EMPTY_SELECTION);

    // Doctor derivador (solo al crear y con permiso): uno del sistema o "sin doctor".
    const [doctorId, setDoctorId] = React.useState('');
    const [doctorName, setDoctorName] = React.useState('');
    const [withoutDoctor, setWithoutDoctor] = React.useState(false);
    /** Doctor tal como figura en el papel: texto de referencia, sin vincular a un usuario. */
    const [referringDoctorName, setReferringDoctorName] = React.useState('');
    /** Derivación de WhatsApp de la que sale la orden (al crear) o salió (al editar su borrador). */
    const [sourceIntakeId, setSourceIntakeId] = React.useState('');
    const [originals, setOriginals] = React.useState<OriginalsSource | null>(null);
    const [showOriginals, setShowOriginals] = React.useState(false);
    /** Dato que se está buscando en los originales ("Ver en el original" de un punto a revisar). */
    const [originalFocus, setOriginalFocus] = React.useState<OriginalFocus | null>(null);
    /**
     * Puntos que el agente de WhatsApp no tuvo claros (borrador creado al derivar). Se marcan desde
     * acá mismo, mirando los originales; los bloqueantes pendientes impiden enviar.
     */
    const [reviewItems, setReviewItems] = React.useState<StudyOrderReviewItem[]>([]);
    /** Orden del agente que este borrador reemplaza al enviarse (derivación por "la orden cambió"). */
    const [replacesOrderNumber, setReplacesOrderNumber] = React.useState<string | null>(null);
    const blockingPending = countPendingBlocking(reviewItems);

    const scrollRef = React.useRef<HTMLDivElement>(null);
    /** Bloqueo síncrono del guardado: el estado tarda un render y un doble clic duplicaría la orden. */
    const savingRef = React.useRef(false);

    const resetForm = React.useCallback(() => {
        setAutoFilled({ document: false, phone: false, email: false });
        setPatientId(''); setPatientName(''); setPatientDocument('');
        setPatientPhone(''); setPatientEmail(''); setSedeId('');
        setDeliveryMethods([]); setClinicalNotes(''); setTexts({});
        setSelection({ ...EMPTY_SELECTION, services: new Map() });
        setLoadedNumber(''); setError(null); setStepIndex(0);
        setDoctorId(''); setDoctorName(''); setWithoutDoctor(false); setReferringDoctorName('');
        setSourceIntakeId(''); setOriginals(null); setShowOriginals(false); setOriginalFocus(null);
        setReviewItems([]); setReplacesOrderNumber(null);
    }, []);

    React.useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setIsLoading(true);
        resetForm();

        void (async () => {
            const [formOptions, sedeList] = await Promise.all([
                getStudyOrderFormOptions(),
                fetchBookingSedes(),
            ]);
            if (cancelled) return;
            setOptions(formOptions);
            setSedes(sedeList);

            if (orderId) {
                const order = await getStudyOrder(orderId);
                if (cancelled) return;
                if (order) {
                    setLoadedNumber(order.order_number);
                    setPatientId(order.patient_id ?? '');
                    setPatientName(order.patient_name);
                    setPatientDocument(order.patient_document ?? '');
                    setPatientPhone(order.patient_phone ?? '');
                    setPatientEmail(order.patient_email ?? '');
                    setSedeId(order.preferred_sede_id ?? '');
                    setDeliveryMethods(order.delivery_methods ?? []);
                    setClinicalNotes(order.clinical_notes ?? '');
                    setTexts(order.texts ?? {});

                    const services = new Map<string, StudyOrderCatalogService>();
                    const itemModifiers: Record<string, Record<string, string[]>> = {};
                    const itemNotes: Record<string, string> = {};
                    for (const item of order.items) {
                        services.set(item.service_id, {
                            id: item.service_id,
                            name: item.service_name,
                            section_code: item.section_code,
                        });
                        if (item.modifiers) itemModifiers[item.service_id] = item.modifiers;
                        if (item.notes) itemNotes[item.service_id] = item.notes;
                    }
                    setSelection({
                        services, itemModifiers, itemNotes,
                        sectionModifiers: order.section_modifiers ?? {},
                        teeth: order.regions ?? {},
                    });
                    // Borrador que salió de una derivación de WhatsApp: los originales siguen a mano.
                    setReferringDoctorName(order.referring_doctor_name ?? '');
                    setSourceIntakeId(order.source_intake_id ?? '');
                    setReviewItems(order.review_items ?? []);
                    setReplacesOrderNumber(order.whatsapp?.replaces_order_number ?? null);
                    if (order.whatsapp && order.whatsapp.files.length > 0) {
                        setOriginals({ intakeId: order.whatsapp.intake_id, files: order.whatsapp.files });
                        setShowOriginals(isWideScreen());
                    }
                }
            }
            setIsLoading(false);
        })();

        return () => { cancelled = true; };
    }, [open, orderId, resetForm]);

    /** Cada punto pendiente, en su paso y sobre el elemento donde está el dato. */
    const reviewTargets = React.useMemo(() => resolveReviewTargets(reviewItems, options), [reviewItems, options]);
    const pendingReviewTotal = React.useMemo(
        () => reviewItems.filter((i) => i.status === 'pending').length,
        [reviewItems],
    );

    /** Tras marcar un punto se relee solo la revisión: lo que se editó en el formulario no se pisa. */
    const reloadReviewItems = React.useCallback(async () => {
        if (!orderId) return;
        const fresh = await getStudyOrder(orderId);
        if (fresh) setReviewItems(fresh.review_items ?? []);
    }, [orderId]);

    const originalFiles = React.useMemo(() => toOrderFiles(originals?.files ?? []), [originals]);

    /** Abre los originales en el lugar donde el asistente leyó el dato. Solo si hay originales. */
    const locateOriginal = React.useCallback((item: StudyOrderReviewItem) => {
        setOriginalFocus(toOriginalFocus(item, Date.now()));
        setShowOriginals(true);
    }, []);
    const clearOriginalFocus = React.useCallback(() => setOriginalFocus(null), []);
    /** Una sola instancia: la lista y la tarjeta sobre el original ven el mismo punto guardándose. */
    const reviewActions = useReviewItemActions(orderId ?? '', reloadReviewItems);
    /** El punto del foco con su estado actual (se relee después de marcarlo). */
    const focusItem = React.useMemo(
        () => (originalFocus ? reviewItems.find((i) => i.id === originalFocus.itemId) ?? null : null),
        [originalFocus, reviewItems],
    );
    /**
     * Anterior / siguiente desde la tarjeta: entre los puntos que dicen dónde están, en el orden de
     * la lista, pendientes o ya revisados (se puede volver a mirar uno ya marcado).
     */
    const focusNavigation = React.useMemo(() => {
        if (!originalFocus) return null;
        const locatable = reviewItems.filter(hasSource);
        const index = locatable.findIndex((i) => i.id === originalFocus.itemId);
        if (index < 0) return null;
        const prev = locatable[index - 1];
        const next = locatable[index + 1];
        return {
            index,
            total: locatable.length,
            onPrev: prev ? () => locateOriginal(prev) : undefined,
            onNext: next ? () => locateOriginal(next) : undefined,
        };
    }, [originalFocus, reviewItems, locateOriginal]);
    /**
     * Marcado un punto desde la tarjeta, sigue con el próximo pendiente que diga dónde está (en el
     * orden de la lista, volviendo al principio). Sin más, deja de señalar.
     */
    const focusNextPending = React.useCallback((done: StudyOrderReviewItem) => {
        const start = reviewItems.findIndex((i) => i.id === done.id);
        const ordered = [...reviewItems.slice(start + 1), ...reviewItems.slice(0, Math.max(start, 0))];
        const next = ordered.find((i) => i.id !== done.id && i.status === 'pending' && hasSource(i));
        if (next) locateOriginal(next);
        else setOriginalFocus(null);
    }, [reviewItems, locateOriginal]);
    const originalsIntakeId = originals?.intakeId ?? '';
    const loadOriginal = React.useCallback(
        (id: string, signal: AbortSignal) => getWhatsappIntakeFile(originalsIntakeId, id, signal),
        [originalsIntakeId],
    );

    // ── Índices del catálogo ─────────────────────────────────────────────────
    const modifiersBySection = React.useMemo(() => {
        const map = new Map<string, { service: StudyOrderOption[]; section: StudyOrderOption[] }>();
        for (const option of options?.modifiers ?? []) {
            const key = option.section_code ?? '';
            const bucket = map.get(key) ?? { service: [], section: [] };
            if (option.service_id) bucket.service.push(option);
            else bucket.section.push(option);
            map.set(key, bucket);
        }
        return map;
    }, [options]);

    const textsBySection = React.useMemo(() => {
        const map = new Map<string, StudyOrderOption[]>();
        for (const option of options?.texts ?? []) {
            if (!option.section_code) continue;
            const bucket = map.get(option.section_code) ?? [];
            bucket.push(option);
            map.set(option.section_code, bucket);
        }
        return map;
    }, [options]);

    const regionGroupBySection = React.useMemo(() => {
        const map = new Map<string, StudyOrderOption>();
        for (const group of options?.region_groups ?? []) {
            if (group.section_code) map.set(group.section_code, group);
        }
        return map;
    }, [options]);

    const selectedIdsBySection = React.useMemo(() => {
        const map = new Map<string, string[]>();
        for (const service of selection.services.values()) {
            const bucket = map.get(service.section_code) ?? [];
            bucket.push(service.id);
            map.set(service.section_code, bucket);
        }
        return map;
    }, [selection.services]);

    /**
     * La selección en curso, en la forma que entiende el resumen compartido.
     * Traducir acá los códigos a etiquetas es lo que permite que el asistente y
     * el detalle de la orden dibujen exactamente lo mismo desde datos distintos.
     */
    const summarySections = React.useMemo<StudyOrderSummarySection[]>(
        () => (options?.sections ?? []).map((section) => ({
            code: section.code,
            name: section.name,
            color: section.color,
            teeth: selection.teeth[section.code] ?? [],
            items: (selectedIdsBySection.get(section.code) ?? []).flatMap((id) => {
                const service = selection.services.get(id);
                if (!service) return [];
                return [{
                    id,
                    name: service.name,
                    modifiers: Object.values(selection.itemModifiers[id] ?? {}).flat()
                        .map((code) => labelForModifier(options, code)),
                    notes: selection.itemNotes[id],
                }];
            }),
        })),
        [options, selectedIdsBySection, selection.services, selection.itemModifiers, selection.itemNotes, selection.teeth],
    );

    const summaryTexts = React.useMemo(
        () => (options?.texts ?? [])
            .filter((option) => (texts[option.code] ?? '').trim())
            .map((option) => ({ label: option.label, value: texts[option.code] })),
        [options, texts],
    );

    /** Sólo entran al recorrido las secciones que tienen algo para elegir. */
    const steps = React.useMemo<Step[]>(() => {
        const sectionSteps: Step[] = (options?.sections ?? [])
            .filter((section) => section.services.length > 0)
            .map((section) => ({ kind: 'section', section }));
        return [{ kind: 'patient' }, ...sectionSteps, { kind: 'review' }];
    }, [options]);

    const step = steps[Math.min(stepIndex, steps.length - 1)];
    const isFirst = stepIndex === 0;
    const isLast = stepIndex >= steps.length - 1;
    const totalSelected = selection.services.size;

    /**
     * Estado de un paso, para pintar el riel de la izquierda.
     *
     *   done       verde  — la sección tiene al menos un estudio elegido
     *   incomplete rojo   — hay datos huérfanos: piezas, modificadores o texto
     *                       cargados pero ningún estudio en esa sección. Es
     *                       decirle a la clínica dónde mirar sin decirle qué
     *                       hacer, y el backend guardaría la región sin línea.
     *   empty      gris   — todavía no se tocó
     */
    const stepState = React.useCallback((s: Step): 'done' | 'incomplete' | 'empty' => {
        if (s.kind === 'patient') {
            if (patientName.trim()) return 'done';
            // Sólo se marca en rojo cuando ya hay algo pedido: si no, todo el
            // riel arrancaría en rojo apenas se abre el asistente.
            return totalSelected > 0 ? 'incomplete' : 'empty';
        }
        if (s.kind === 'review') {
            if (totalSelected === 0) return 'empty';
            return patientName.trim() ? 'done' : 'incomplete';
        }
        const code = s.section.code;
        if ((selectedIdsBySection.get(code) ?? []).length > 0) return 'done';
        const hasTeeth = (selection.teeth[code] ?? []).length > 0;
        const hasSectionMods = Object.values(selection.sectionModifiers[code] ?? {}).some((v) => v.length > 0);
        const hasTexts = (textsBySection.get(code) ?? []).some((o) => (texts[o.code] ?? '').trim());
        return hasTeeth || hasSectionMods || hasTexts ? 'incomplete' : 'empty';
    }, [patientName, totalSelected, selectedIdsBySection, selection.teeth, selection.sectionModifiers, textsBySection, texts]);


    const goTo = React.useCallback((index: number) => {
        setStepIndex(Math.max(0, Math.min(index, steps.length - 1)));
        setIsRailOpen(false);
        // Cada paso arranca arriba: si no, se entra a la sección siguiente a
        // media altura y parece que faltan opciones.
        scrollRef.current?.scrollTo({ top: 0 });
    }, [steps.length]);

    // ── Handlers de selección ────────────────────────────────────────────────
    const handleToggleService = React.useCallback((service: StudyOrderCatalogService) => {
        setSelection((prev) => {
            const services = new Map(prev.services);
            if (services.has(service.id)) {
                services.delete(service.id);
                const { [service.id]: _mods, ...itemModifiers } = prev.itemModifiers;
                const { [service.id]: _note, ...itemNotes } = prev.itemNotes;
                return { ...prev, services, itemModifiers, itemNotes };
            }
            services.set(service.id, service);
            return { ...prev, services };
        });
    }, []);

    const handleToggleItemModifier = React.useCallback((serviceId: string, groupCode: string, code: string) => {
        setSelection((prev) => ({ ...prev, itemModifiers: toggleInGroup(prev.itemModifiers, serviceId, groupCode, code) }));
    }, []);

    const handleToggleSectionModifier = React.useCallback((sectionCode: string, groupCode: string, code: string) => {
        setSelection((prev) => ({ ...prev, sectionModifiers: toggleInGroup(prev.sectionModifiers, sectionCode, groupCode, code) }));
    }, []);

    const handleTeethChange = React.useCallback((sectionCode: string, teeth: string[]) => {
        setSelection((prev) => ({ ...prev, teeth: { ...prev.teeth, [sectionCode]: teeth } }));
    }, []);

    const handleItemNoteChange = React.useCallback((serviceId: string, note: string) => {
        setSelection((prev) => ({ ...prev, itemNotes: { ...prev.itemNotes, [serviceId]: note } }));
    }, []);

    const handleTextChange = React.useCallback((code: string, value: string) => {
        setTexts((prev) => ({ ...prev, [code]: value }));
    }, []);

    // ── Guardado ─────────────────────────────────────────────────────────────
    const buildPayload = React.useCallback((): StudyOrderUpsertPayload => {
        let position = 0;
        const items = Array.from(selection.services.values()).map((service) => ({
            service_id: service.id,
            service_name: service.name,
            section_code: service.section_code,
            sort_order: position++,
            modifiers: selection.itemModifiers[service.id] ?? {},
            notes: selection.itemNotes[service.id] || undefined,
        }));

        return {
            id: orderId ?? undefined,
            patient_id: patientId || null,
            patient_name: patientName.trim(),
            patient_document: patientDocument.trim(),
            patient_email: patientEmail.trim(),
            patient_phone: patientPhone.trim(),
            regions: selection.teeth,
            section_modifiers: selection.sectionModifiers,
            texts,
            delivery_methods: deliveryMethods,
            clinical_notes: clinicalNotes.trim(),
            preferred_sede_id: sedeId || null,
            items,
            // Doctor derivador: solo al crear. Al editar un borrador el backend conserva el suyo.
            ...(isCreating && canChooseDoctor
                ? (withoutDoctor ? { without_doctor: true } : { doctor_id: doctorId })
                : {}),
            ...(referringDoctorName.trim() ? { referring_doctor_name: referringDoctorName.trim() } : {}),
        };
    }, [orderId, patientId, patientName, patientDocument, patientEmail, patientPhone,
        selection, texts, deliveryMethods, clinicalNotes, sedeId,
        isCreating, canChooseDoctor, withoutDoctor, doctorId, referringDoctorName]);

    const handleSave = React.useCallback(async (submitAfterSave: boolean) => {
        if (savingRef.current) return;
        setError(null);
        if (!patientName.trim()) {
            setError(t('validation.patientNameRequired'));
            goTo(0);
            return;
        }
        // Sin esto la orden quedaría a nombre de quien la carga, como si fuera el derivador.
        if (isCreating && canChooseDoctor && !withoutDoctor && !doctorId) {
            setError(t('validation.doctorRequired'));
            goTo(0);
            return;
        }
        if (totalSelected === 0) {
            setError(t('validation.itemsRequired'));
            return;
        }

        savingRef.current = true;
        setIsSaving(true);
        try {
            const saved = await upsertStudyOrder(buildPayload());
            if (submitAfterSave) {
                // Guardar primero y enviar después: el envío nunca se hace sobre
                // una versión vieja de lo que el doctor tiene en pantalla.
                const submitted = await submitStudyOrder(saved.id);
                const moved = Number(submitted.moved_appointments ?? 0);
                const extra = [
                    submitted.resolved_handoff ? t('toast.handoffResolved') : '',
                    submitted.replaced_order_number
                        ? t('toast.orderReplaced', { number: submitted.replaced_order_number, count: moved })
                        : '',
                ].filter(Boolean).join(' ');
                toast({
                    title: t('toast.submittedTitle'),
                    description: [t('toast.submittedDescription', { number: submitted.order_number }), extra].filter(Boolean).join(' '),
                });
            } else {
                toast({ title: t('toast.savedTitle') });
            }
            onSaved?.();
            onOpenChange(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : t('toast.genericError'));
        } finally {
            savingRef.current = false;
            setIsSaving(false);
        }
    }, [patientName, totalSelected, buildPayload, toast, t, onSaved, onOpenChange, goTo,
        isCreating, canChooseDoctor, withoutDoctor, doctorId]);

    /** Puntos pendientes de un paso, arriba de su contenido, para marcarlos ahí mismo. */
    const renderStepReview = (stepKey: string) => {
        const stepItems = reviewTargets.byStep.get(stepKey) ?? [];
        if (!orderId || stepItems.length === 0) return null;
        return (
            <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                    <ListChecks className="h-4 w-4 text-amber-600" aria-hidden="true" />
                    {t('review.stepTitle', { count: stepItems.length })}
                </p>
                <StudyOrderReviewList
                    orderId={orderId}
                    items={stepItems}
                    canReview
                    variant="plain"
                    onChanged={reloadReviewItems}
                />
            </div>
        );
    };

    /**
     * Con los originales abiertos en una tablet no entran el riel, el formulario y los originales
     * lado a lado: el riel pasa a ser cajón (como en el celular) hasta lg.
     */
    const railIsDrawerUpToLg = !!originals && showOriginals;

    /** Elegir el paciente: desde el formulario o desde la tarjeta sobre el original. */
    const handlePatientChange = (id: string, user?: User) => {
        setPatientId(id);
        if (!user) return;
        setPatientName(user.name);

        // Cada campo se resuelve igual: si lo había puesto el paciente anterior, se reemplaza por
        // el del nuevo —vacío incluido, para no arrastrar un dato ajeno—; si lo escribió el
        // derivador, se respeta.
        //
        // Se decide todo primero y recién después se aplica: poner los setters dentro del updater
        // de `setAutoFilled` los ejecutaría dos veces en modo estricto.
        const resolve = (wasAuto: boolean, current: string, incoming: string) =>
            (!wasAuto && current.trim())
                ? { value: current, auto: false }
                : { value: incoming, auto: !!incoming };

        const doc = resolve(autoFilled.document, patientDocument, user.identity_document || '');
        const tel = resolve(autoFilled.phone, patientPhone, user.phone_number || '');
        const mail = resolve(autoFilled.email, patientEmail, user.email || '');

        setPatientDocument(doc.value);
        setPatientPhone(tel.value);
        setPatientEmail(mail.value);
        setAutoFilled({ document: doc.auto, phone: tel.auto, email: mail.auto });
    };

    /**
     * El campo del punto que se está mirando en el original, para corregirlo desde la tarjeta
     * (sobre todo en el celular, donde el formulario queda tapado). Usa el mismo estado y los
     * mismos handlers que el formulario. Null si el punto no corresponde a un campo.
     */
    const editorPropsFor = (item: StudyOrderReviewItem, markEdited: () => void): ReviewFieldEditorProps | null => {
        const { target } = resolveReviewTarget(item, options);
        if (!target) return null;
        const edited = <A extends unknown[]>(fn: (...args: A) => void) => (...args: A) => { fn(...args); markEdited(); };

        switch (target.kind) {
            case 'patient':
                switch (target.field) {
                    case 'document':
                        return {
                            kind: 'text', label: t('form.patientDocument'), value: patientDocument,
                            onChange: edited((v: string) => { setPatientDocument(v); markManual('document'); }),
                        };
                    case 'phone':
                        return {
                            kind: 'text', label: t('form.patientPhone'), value: patientPhone,
                            onChange: edited((v: string) => { setPatientPhone(v); markManual('phone'); }),
                        };
                    case 'doctor':
                        return { kind: 'text', label: t('form.referringDoctorName'), value: referringDoctorName, onChange: edited(setReferringDoctorName) };
                    case 'delivery':
                        return {
                            kind: 'toggles',
                            label: t('form.deliverySection'),
                            options: (options?.delivery ?? []).map((o) => ({ code: o.code, label: o.label, checked: deliveryMethods.includes(o.code) })),
                            onToggle: edited((code: string) => setDeliveryMethods((prev) => prev.includes(code)
                                ? prev.filter((c) => c !== code)
                                : [...prev, code])),
                        };
                    case 'name':
                        return {
                            kind: 'custom',
                            label: t('form.patientName'),
                            children: (
                                <UserSelector
                                    filterType="PACIENTE"
                                    value={patientId}
                                    selectedUserName={patientName}
                                    showIdentityDocument
                                    placeholder={t('filterPlaceholder')}
                                    triggerText={t('form.patientName')}
                                    className="h-8 w-full text-sm"
                                    onValueChange={edited(handlePatientChange)}
                                />
                            ),
                        };
                }
                return null;
            case 'text': {
                const option = target.option;
                return {
                    kind: 'text',
                    label: option?.label ?? item.label,
                    value: texts[target.code] ?? '',
                    multiline: option?.input_type === 'textarea',
                    type: option?.input_type === 'date' ? 'date' : 'text',
                    onChange: edited((v: string) => handleTextChange(target.code, v)),
                };
            }
            case 'service': {
                const { service } = target;
                return {
                    kind: 'service',
                    name: service.name,
                    checked: selection.services.has(service.id),
                    onToggle: edited(() => handleToggleService(service)),
                    note: selection.itemNotes[service.id] ?? '',
                    onNoteChange: edited((note: string) => handleItemNoteChange(service.id, note)),
                };
            }
            case 'option': {
                // Se muestra el grupo entero: la duda suele ser cuál de las opciones estaba marcada.
                const option = target.option;
                if (!option) return null;
                const groupCode = option.group_code ?? '';
                const group = (options?.modifiers ?? []).filter((o) => (o.group_code ?? '') === groupCode
                    && (option.service_id ? o.service_id === option.service_id : !o.service_id && o.section_code === target.section));
                const checkedCodes = option.service_id
                    ? selection.itemModifiers[option.service_id]?.[groupCode] ?? []
                    : selection.sectionModifiers[target.section]?.[groupCode] ?? [];
                return {
                    kind: 'toggles',
                    label: option.label,
                    options: group.map((o) => ({ code: o.code, label: o.label, checked: checkedCodes.includes(o.code) })),
                    onToggle: edited((code: string) => option.service_id
                        ? handleToggleItemModifier(option.service_id, groupCode, code)
                        : handleToggleSectionModifier(target.section, groupCode, code)),
                };
            }
            case 'teeth':
                return {
                    kind: 'teeth',
                    label: regionGroupBySection.get(target.section)?.label ?? item.label,
                    value: selection.teeth[target.section] ?? [],
                    onChange: edited((teeth: string[]) => handleTeethChange(target.section, teeth)),
                };
        }
    };
    const renderFocusEditor = (item: StudyOrderReviewItem, markEdited: () => void) => {
        const props = editorPropsFor(item, markEdited);
        return props ? <ReviewFieldEditor {...props} /> : null;
    };

    const title = orderId
        ? t('form.editTitle', { number: orderNumber || loadedNumber })
        : t('form.title');

    return (
        <ReviewLocateProvider value={originals ? locateOriginal : null}>
        <ReviewActionsProvider value={orderId ? reviewActions : null}>
        <ResizableSheet
            open={open}
            onOpenChange={onOpenChange}
            defaultWidth={980}
            minWidth={560}
            maxWidth={1400}
            storageKey="study-order-wizard-width"
            defaultFullscreen
        >
            <div className="flex h-full flex-col overflow-hidden bg-card">
                {/* Cabecera */}
                {/* A la derecha quedan la X de la hoja y, desde md, el botón de pantalla completa. */}
                <div className="flex flex-none items-center gap-3 border-b px-4 py-3 pr-14 sm:px-5 sm:py-4 md:pr-28">
                    <span className="hidden h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary sm:grid">
                        <ClipboardList className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <SheetTitle className="truncate text-base font-semibold text-foreground">
                            {title}
                        </SheetTitle>
                        <SheetDescription className="truncate text-sm text-muted-foreground">
                            {totalSelected > 0
                                ? t('form.selectedCount', { count: totalSelected })
                                : t('form.noServicesSelected')}
                        </SheetDescription>
                    </div>
                    {originals && (
                        <Button
                            type="button"
                            variant={showOriginals ? 'secondary' : 'outline'}
                            size="sm"
                            className="shrink-0"
                            aria-pressed={showOriginals}
                            onClick={() => setShowOriginals((v) => !v)}
                        >
                            <Images className="h-4 w-4 sm:mr-1.5" aria-hidden="true" />
                            <span className="hidden sm:inline">
                                {showOriginals ? t('wizard.hideOriginals') : t('wizard.showOriginals')}
                            </span>
                        </Button>
                    )}
                </div>

                {/* Cuerpo: riel de secciones a la izquierda, contenido a la derecha */}
                <div className="relative flex min-h-0 flex-1 overflow-hidden">
                    {!isLoading && steps.length > 2 && (
                        <>
                        {/* Fondo que cierra el cajón al tocar fuera. Sólo en mobile. */}
                        {isRailOpen && (
                            <button
                                type="button"
                                aria-label={t('wizard.closeSteps')}
                                onClick={() => setIsRailOpen(false)}
                                className={cn(
                                    'absolute inset-0 z-20 bg-background/70 backdrop-blur-[1px]',
                                    railIsDrawerUpToLg ? 'lg:hidden' : 'sm:hidden',
                                )}
                            />
                        )}
                        {/* Botón flotante del cajón. Vive acá y no en el pie para
                            quedar sobre el contenido, al alcance del pulgar, y
                            desaparece mientras el cajón está abierto: ahí lo que
                            hace falta es cerrarlo tocando fuera. */}
                        {!isRailOpen && (
                            <Button
                                type="button"
                                size="icon"
                                onClick={() => setIsRailOpen(true)}
                                aria-label={t('wizard.steps')}
                                className={cn(
                                    'absolute bottom-4 left-4 z-20 h-12 w-12 rounded-full shadow-lg',
                                    railIsDrawerUpToLg ? 'lg:hidden' : 'sm:hidden',
                                )}
                            >
                                <PanelLeft className="h-5 w-5" />
                            </Button>
                        )}
                        <nav
                            aria-label={t('wizard.steps')}
                            className={cn(
                                'w-64 flex-none overflow-y-auto border-r p-2',
                                // Violeta claro: separa el riel del contenido sin
                                // competir con los colores de estado de cada paso
                                // (verde/rojo/gris). En oscuro se baja mucho la
                                // luminosidad para que siga siendo un fondo.
                                'bg-violet-50 dark:bg-violet-950/30',
                                // Mobile: cajón que entra desde la izquierda por encima
                                // del contenido. Escritorio: columna fija de siempre.
                                'absolute inset-y-0 left-0 z-30 shadow-xl transition-transform duration-200',
                                railIsDrawerUpToLg
                                    ? 'lg:static lg:z-auto lg:translate-x-0 lg:shadow-none'
                                    : 'sm:static sm:z-auto sm:translate-x-0 sm:shadow-none',
                                isRailOpen ? 'translate-x-0' : '-translate-x-full',
                            )}
                        >
                            {steps.map((s, index) => {
                                const label = s.kind === 'patient' ? t('form.patientSection')
                                    : s.kind === 'review' ? t('wizard.review')
                                        : s.section.name;
                                const count = s.kind === 'section'
                                    ? (selectedIdsBySection.get(s.section.code) ?? []).length
                                    : 0;
                                const reviewCount = s.kind === 'review'
                                    ? pendingReviewTotal
                                    : (reviewTargets.byStep.get(s.kind === 'patient' ? PATIENT_STEP : s.section.code) ?? []).length;
                                const state = stepState(s);
                                const isCurrent = index === stepIndex;
                                return (
                                    <button
                                        key={label}
                                        type="button"
                                        onClick={() => goTo(index)}
                                        aria-current={isCurrent ? 'step' : undefined}
                                        className={cn(
                                            'group flex w-full items-start gap-2.5 rounded-md px-2.5 py-2.5 text-left transition-colors',
                                            // Más marcado que antes: sobre el riel violeta,
                                            // un 10% del primary —que en este tema TAMBIÉN es
                                            // violeta— quedaba casi invisible.
                                            isCurrent
                                                ? 'bg-primary/20 ring-1 ring-primary/40'
                                                : 'hover:bg-primary/10',
                                        )}
                                    >
                                        {/* Punto de estado: verde hecho, rojo incompleto, gris sin tocar */}
                                        <span
                                            className={cn(
                                                'mt-1.5 h-2.5 w-2.5 flex-none rounded-full',
                                                state === 'done' && 'bg-emerald-500',
                                                state === 'incomplete' && 'bg-destructive',
                                                state === 'empty' && 'bg-muted-foreground/30',
                                            )}
                                            aria-hidden="true"
                                        />
                                        <span
                                            className={cn(
                                                // Dos líneas: entra el nombre completo sin recortar.
                                                'line-clamp-2 flex-1 text-sm leading-snug',
                                                isCurrent && 'font-semibold',
                                                state === 'done' && 'text-emerald-600 dark:text-emerald-400',
                                                state === 'incomplete' && 'text-destructive',
                                                state === 'empty' && 'text-muted-foreground',
                                            )}
                                        >
                                            {label}
                                        </span>
                                        {reviewCount > 0 && (
                                            <span
                                                className="mt-0.5 flex h-4 flex-none items-center gap-0.5 rounded-full bg-amber-500/15 px-1 text-[10px] font-medium tabular-nums text-amber-700 dark:text-amber-400"
                                                title={t('review.pendingCount', { count: reviewCount })}
                                            >
                                                <ListChecks className="h-3 w-3" aria-hidden="true" />
                                                {reviewCount}
                                                <span className="sr-only">{t('review.pendingCount', { count: reviewCount })}</span>
                                            </span>
                                        )}
                                        {count > 0 && (
                                            <span className="mt-0.5 grid h-4 min-w-4 flex-none place-items-center rounded-full bg-emerald-500/15 px-1 text-[10px] font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                                                {count}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </nav>
                        </>
                    )}

                {/* Abajo deja lugar para el botón flotante del riel mientras se muestra. */}
                <div
                    ref={scrollRef}
                    className={cn(
                        'min-h-0 flex-1 overflow-y-auto px-4 pt-4 sm:px-5 sm:pt-5',
                        steps.length > 2
                            ? (railIsDrawerUpToLg ? 'pb-20 lg:pb-5' : 'pb-20 sm:pb-5')
                            : 'pb-4 sm:pb-5',
                    )}
                >
                    {isLoading ? (
                        <div className="mx-auto max-w-5xl space-y-3">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-24 w-full" />
                            <Skeleton className="h-40 w-full" />
                        </div>
                    ) : steps.length <= 2 ? (
                        // Sin secciones no hay nada que pedir: pasa cuando el catálogo
                        // de la clínica todavía no está cargado.
                        <div className="mx-auto max-w-md py-16 text-center">
                            <p className="text-sm text-muted-foreground">{t('wizard.noCatalog')}</p>
                        </div>
                    ) : step.kind === 'patient' ? (
                        <div className="mx-auto max-w-5xl space-y-6">
                            {sourceIntakeId && (
                                <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                                    <p>{t('wizard.fromHandoff')}</p>
                                    {replacesOrderNumber && (
                                        <p className="font-medium">
                                            {t('wizard.replacesOrder', { number: replacesOrderNumber })}
                                        </p>
                                    )}
                                </div>
                            )}
                            {blockingPending > 0 && (
                                <button
                                    type="button"
                                    onClick={() => goTo(steps.length - 1)}
                                    className="flex w-full items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-left text-sm transition-colors hover:bg-amber-500/15"
                                >
                                    <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                                    <span>{t('review.wizardBanner', { count: blockingPending })}</span>
                                </button>
                            )}
                            {renderStepReview(PATIENT_STEP)}

                            {isCreating && canChooseDoctor && (
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold">{t('form.referringDoctor')}</Label>
                                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                                        <DoctorSelector
                                            value={doctorId}
                                            selectedDoctorName={doctorName}
                                            disabled={withoutDoctor}
                                            className="w-full sm:w-80"
                                            placeholder={t('form.doctorSearch')}
                                            triggerText={t('form.doctorPick')}
                                            onValueChange={(id, doctor) => {
                                                setDoctorId(id);
                                                setDoctorName(doctor?.name ?? '');
                                            }}
                                        />
                                        <div className="flex items-center gap-2">
                                            <Checkbox
                                                id="so-without-doctor"
                                                checked={withoutDoctor}
                                                onCheckedChange={(checked) => {
                                                    setWithoutDoctor(checked === true);
                                                    if (checked === true) { setDoctorId(''); setDoctorName(''); }
                                                }}
                                            />
                                            <Label htmlFor="so-without-doctor" className="cursor-pointer text-sm font-normal">
                                                {t('form.withoutDoctor')}
                                            </Label>
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground">{t('form.referringDoctorHelp')}</p>
                                </div>
                            )}

                            {(withoutDoctor || referringDoctorName || sourceIntakeId) && (
                                <div className="space-y-1.5">
                                    <Label htmlFor="so-referring-name" className="flex items-center gap-1.5">
                                        {t('form.referringDoctorName')}
                                        <ReviewFlag items={reviewTargets.patientFields.get('doctor')} />
                                    </Label>
                                    <Input
                                        id="so-referring-name"
                                        value={referringDoctorName}
                                        maxLength={200}
                                        onChange={(e) => setReferringDoctorName(e.target.value)}
                                    />
                                    <p className="text-xs text-muted-foreground">{t('form.referringDoctorNameHelp')}</p>
                                </div>
                            )}

                            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                <div className="space-y-1.5 sm:col-span-2">
                                    <Label className="flex items-center gap-1.5">
                                        {t('form.patientName')}
                                        <ReviewFlag items={reviewTargets.patientFields.get('name')} />
                                    </Label>
                                    <UserSelector
                                        filterType="PACIENTE"
                                        value={patientId}
                                        selectedUserName={patientName}
                                        showIdentityDocument
                                        placeholder={t('filterPlaceholder')}
                                        triggerText={t('form.patientName')}
                                        onValueChange={handlePatientChange}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="so-doc" className="flex items-center gap-1.5">
                                        {t('form.patientDocument')}
                                        <ReviewFlag items={reviewTargets.patientFields.get('document')} />
                                    </Label>
                                    <Input id="so-doc" value={patientDocument} onChange={(e) => { setPatientDocument(e.target.value); markManual('document'); }} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="so-phone" className="flex items-center gap-1.5">
                                        {t('form.patientPhone')}
                                        <ReviewFlag items={reviewTargets.patientFields.get('phone')} />
                                    </Label>
                                    <Input id="so-phone" value={patientPhone} onChange={(e) => { setPatientPhone(e.target.value); markManual('phone'); }} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="so-email">{t('form.patientEmail')}</Label>
                                    <Input id="so-email" type="email" value={patientEmail} onChange={(e) => { setPatientEmail(e.target.value); markManual('email'); }} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>{t('form.preferredSede')}</Label>
                                    <Select value={sedeId} onValueChange={setSedeId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder={t('form.preferredSedePlaceholder')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {sedes.map((sede) => (
                                                <SelectItem key={sede.id} value={String(sede.id)}>{sede.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {(options?.delivery.length ?? 0) > 0 && (
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-1.5 text-sm font-semibold">
                                        {t('form.deliverySection')}
                                        <ReviewFlag items={reviewTargets.patientFields.get('delivery')} />
                                    </Label>
                                    <div className="flex flex-wrap gap-x-5 gap-y-2">
                                        {options?.delivery.map((option) => (
                                            <div key={option.id} className="flex items-center gap-2">
                                                <Checkbox
                                                    id={`delivery-${option.code}`}
                                                    checked={deliveryMethods.includes(option.code)}
                                                    onCheckedChange={() =>
                                                        setDeliveryMethods((prev) => prev.includes(option.code)
                                                            ? prev.filter((c) => c !== option.code)
                                                            : [...prev, option.code])}
                                                />
                                                <Label htmlFor={`delivery-${option.code}`} className="cursor-pointer text-sm font-normal">
                                                    {option.label}
                                                </Label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <Label htmlFor="so-notes">{t('form.clinicalNotes')}</Label>
                                <Textarea
                                    id="so-notes"
                                    rows={3}
                                    value={clinicalNotes}
                                    placeholder={t('form.clinicalNotesPlaceholder')}
                                    onChange={(e) => setClinicalNotes(e.target.value)}
                                />
                            </div>
                        </div>
                    ) : step.kind === 'section' ? (
                        <div className="w-full space-y-4">
                            {renderStepReview(step.section.code)}
                            <StudyOrderSection
                                section={step.section}
                                serviceModifiers={modifiersBySection.get(step.section.code)?.service ?? []}
                                sectionModifiers={modifiersBySection.get(step.section.code)?.section ?? []}
                                regionGroup={regionGroupBySection.get(step.section.code)}
                                textOptions={textsBySection.get(step.section.code) ?? []}
                                textValues={texts}
                                onTextChange={handleTextChange}
                                selectedServiceIds={selectedIdsBySection.get(step.section.code) ?? []}
                                onToggleService={handleToggleService}
                                itemModifiers={selection.itemModifiers}
                                onToggleItemModifier={handleToggleItemModifier}
                                sectionModifierValues={selection.sectionModifiers[step.section.code] ?? {}}
                                onToggleSectionModifier={(groupCode, code) =>
                                    handleToggleSectionModifier(step.section.code, groupCode, code)}
                                teeth={selection.teeth[step.section.code] ?? []}
                                onTeethChange={(teeth) => handleTeethChange(step.section.code, teeth)}
                                itemNotes={selection.itemNotes}
                                onItemNoteChange={handleItemNoteChange}
                                defaultOpen
                                hideHeader
                                reviewTargets={reviewTargets}
                            />
                        </div>
                    ) : (
                        <div className="mx-auto max-w-5xl space-y-6">
                            {orderId && reviewItems.length > 0 && (
                                <StudyOrderReviewList
                                    orderId={orderId}
                                    items={reviewItems}
                                    canReview
                                    onChanged={reloadReviewItems}
                                    className="rounded-lg border p-3 sm:p-4"
                                />
                            )}
                            <StudyOrderSummary
                                patientName={patientName}
                                patientDocument={patientDocument}
                                patientPhone={patientPhone}
                                patientEmail={patientEmail}
                                deliveryLabels={deliveryMethods.map((code) => labelForDelivery(options, code))}
                                sections={summarySections}
                                texts={summaryTexts}
                                clinicalNotes={clinicalNotes}
                            />
                        </div>
                    )}

                    {error && (
                        <p className="mx-auto mt-4 max-w-5xl text-sm text-destructive" role="alert">{error}</p>
                    )}
                </div>

                {/* Originales de WhatsApp al lado del formulario: en tablet y escritorio es una
                    columna; en el celular ocupan todo el cuerpo (se cierran con el botón de arriba). */}
                {originals && showOriginals && (
                    <aside
                        aria-label={t('wizard.originals')}
                        className={cn(
                            'flex flex-col bg-card',
                            'absolute inset-0 z-30',
                            'md:static md:z-auto md:w-1/2 md:shrink-0 md:border-l',
                            'lg:w-[420px] xl:w-[500px]',
                        )}
                    >
                        <OrderFilesPanel
                            files={originalFiles}
                            loadFile={loadOriginal}
                            focus={originalFocus}
                            focusItem={focusItem}
                            onClearFocus={clearOriginalFocus}
                            onFocusResolved={focusNextPending}
                            focusNavigation={focusNavigation}
                            renderFocusEditor={renderFocusEditor}
                            className="h-full"
                        />
                    </aside>
                )}

                </div>

                {/* Pie de navegación */}
                {/* En el celular las acciones secundarias quedan solo con ícono y los textos se acortan. */}
                <div className="flex flex-none items-center justify-between gap-2 border-t px-3 py-3 sm:px-5">
                    <Button
                        variant="ghost"
                        className="shrink-0 px-3 sm:px-4"
                        onClick={() => goTo(stepIndex - 1)}
                        disabled={isFirst || isSaving}
                        title={t('wizard.back')}
                    >
                        <ArrowLeft className="h-4 w-4 sm:mr-2" aria-hidden="true" />
                        <span className="sr-only sm:not-sr-only">{t('wizard.back')}</span>
                    </Button>

                    <span className="hidden text-xs text-muted-foreground tabular-nums sm:inline">
                        {stepIndex + 1} / {steps.length}
                    </span>

                    <div className="flex items-center gap-2">
                        {isLast ? (
                            <>
                                <Button variant="outline" onClick={() => void handleSave(false)} disabled={isSaving}>
                                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    <span className="sm:hidden">{t('form.saveDraftShort')}</span>
                                    <span className="hidden sm:inline">{t('form.saveDraft')}</span>
                                </Button>
                                <Button
                                    onClick={() => setConfirmSubmit(true)}
                                    disabled={isSaving || totalSelected === 0 || blockingPending > 0}
                                    title={blockingPending > 0 ? t('review.submitBlocked', { count: blockingPending }) : undefined}
                                >
                                    <Send className="mr-2 h-4 w-4" />
                                    <span className="sm:hidden">{t('form.submitShort')}</span>
                                    <span className="hidden sm:inline">{t('form.submit')}</span>
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button
                                    variant="ghost"
                                    className="px-3 sm:px-4"
                                    onClick={() => goTo(steps.length - 1)}
                                    disabled={isSaving}
                                    title={t('wizard.skipToReview')}
                                >
                                    <Check className="h-4 w-4 sm:mr-2" aria-hidden="true" />
                                    <span className="sr-only sm:not-sr-only">{t('wizard.skipToReview')}</span>
                                </Button>
                                <Button onClick={() => goTo(stepIndex + 1)} disabled={isSaving}>
                                    {t('wizard.next')}
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <AlertDialog open={confirmSubmit} onOpenChange={setConfirmSubmit}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('submitDialog.title')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('submitDialog.description')}
                            {replacesOrderNumber && (
                                <>
                                    {' '}
                                    {t('submitDialog.replaces', { number: replacesOrderNumber })}
                                </>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('submitDialog.cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => { setConfirmSubmit(false); void handleSave(true); }}>
                            {t('submitDialog.confirm')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </ResizableSheet>
        </ReviewActionsProvider>
        </ReviewLocateProvider>
    );
}

export default StudyOrderWizard;
