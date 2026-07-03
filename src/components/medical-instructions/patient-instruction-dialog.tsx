'use client';

import * as React from 'react';

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
import { DoctorSelector } from '@/components/ui/doctor-selector';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { InstructionRichTextEditor } from '@/components/medical-instructions/instruction-rich-text-editor';

import { API_ROUTES } from '@/constants/routes';
import { useClinicInfo } from '@/hooks/useClinicInfo';
import { useToast } from '@/hooks/use-toast';
import {
    MEDICAL_INSTRUCTION_TEMPLATE_VARIABLES,
    MEDICAL_INSTRUCTION_TEMPLATE_VARIABLE_GROUP_ORDER,
} from '@/lib/medical-instruction-template-variables';
import { MedicalInstructionTemplate, PatientMedicalInstruction } from '@/lib/types';
import { cn, formatDate } from '@/lib/utils';
import api from '@/services/api';

import { format } from 'date-fns';
import { es, enUS, type Locale } from 'date-fns/locale';
import { Calendar as CalendarIcon, Loader2, RefreshCw } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

function substituteTokens(text: string, vars: Record<string, string>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}

function buildVars(opts: {
    patientName?: string;
    doctorName?: string;
    toothNumber?: string;
    fecha?: string;
    clinicName?: string;
    clinicAddress?: string;
    clinicPhone?: string;
    dateLocale: Locale;
}): Record<string, string> {
    return {
        patient_name: opts.patientName || '',
        doctor_name: opts.doctorName || '',
        clinic_name: opts.clinicName || '',
        clinic_address: opts.clinicAddress || '',
        clinic_phone: opts.clinicPhone || '',
        tooth_number: opts.toothNumber || '',
        date: opts.fecha ? format(new Date(opts.fecha + 'T00:00:00'), 'dd/MM/yyyy', { locale: opts.dateLocale }) : '',
    };
}

interface PatientInstructionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    patientId: string;
    patientName?: string;
    existingInstruction?: PatientMedicalInstruction | null;
    onSaved: () => void;
}

export function PatientInstructionDialog({
    open,
    onOpenChange,
    patientId,
    patientName,
    existingInstruction,
    onSaved,
}: PatientInstructionDialogProps) {
    const t = useTranslations('PatientInstructionDialog');
    const locale = useLocale();
    const dateLocale = locale === 'es' ? es : enUS;
    const { toast } = useToast();
    const clinic = useClinicInfo();

    const [templates, setTemplates] = React.useState<MedicalInstructionTemplate[]>([]);
    const [isLoadingTemplates, setIsLoadingTemplates] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const [fecha, setFecha] = React.useState('');
    const [toothNumber, setToothNumber] = React.useState('');
    const [doctorId, setDoctorId] = React.useState('');
    const [doctorName, setDoctorName] = React.useState('');
    const [templateId, setTemplateId] = React.useState('');
    const [templateName, setTemplateName] = React.useState('');
    const [contentHtml, setContentHtml] = React.useState('');

    const groupLabels = {
        patient: t('variables.groups.patient'),
        clinic: t('variables.groups.clinic'),
        document: t('variables.groups.document'),
        tables: t('variables.groups.tables'),
    };

    React.useEffect(() => {
        if (!open) return;

        const initialFecha = existingInstruction?.fecha ? formatDate(existingInstruction.fecha) : formatDate(new Date());
        const initialTooth = existingInstruction?.numero_diente != null ? String(existingInstruction.numero_diente) : '';
        const initialDoctorName = existingInstruction?.doctor_name || '';

        setFecha(initialFecha);
        setToothNumber(initialTooth);
        setDoctorId(existingInstruction?.doctor_id || '');
        setDoctorName(initialDoctorName);
        setTemplateId(existingInstruction?.template_id || '');
        setTemplateName(existingInstruction?.template_name || '');

        // Re-apply variables in case the saved content still has unresolved {{tokens}}
        // (e.g. inserted manually, or saved before all fields were filled in).
        const initialVars = buildVars({
            patientName,
            doctorName: initialDoctorName,
            toothNumber: initialTooth,
            fecha: initialFecha,
            clinicName: clinic?.name,
            clinicAddress: clinic?.address,
            clinicPhone: clinic?.phone,
            dateLocale,
        });
        setContentHtml(existingInstruction?.content_html ? substituteTokens(existingInstruction.content_html, initialVars) : '');

        const fetchTemplates = async () => {
            setIsLoadingTemplates(true);
            try {
                const data = await api.get(API_ROUTES.MEDICAL_INSTRUCTION_TEMPLATES);
                const list: MedicalInstructionTemplate[] = Array.isArray(data)
                    ? data
                    : (data?.rows || data?.data || data?.result || []);
                setTemplates(list.filter((tpl) => tpl.is_active));
            } catch (error) {
                console.error('Failed to fetch medical instruction templates:', error);
                setTemplates([]);
            } finally {
                setIsLoadingTemplates(false);
            }
        };

        fetchTemplates();
    }, [open, existingInstruction]);

    const currentVars = () => buildVars({
        patientName,
        doctorName,
        toothNumber,
        fecha,
        clinicName: clinic?.name,
        clinicAddress: clinic?.address,
        clinicPhone: clinic?.phone,
        dateLocale,
    });

    const handleSelectTemplate = (id: string) => {
        const template = templates.find((tpl) => String(tpl.id) === id);
        if (!template) return;
        setTemplateId(id);
        setTemplateName(template.name);
        setContentHtml(substituteTokens(template.content_html, currentVars()));
    };

    const handleRefreshVariables = () => {
        setContentHtml((prev) => substituteTokens(prev, currentVars()));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!doctorId) {
            toast({ title: t('validation.doctorRequired'), variant: 'destructive' });
            return;
        }
        if (!contentHtml.trim()) {
            toast({ title: t('validation.contentRequired'), variant: 'destructive' });
            return;
        }

        setIsSubmitting(true);
        try {
            const payload: PatientMedicalInstruction = {
                id: existingInstruction?.id,
                patient_id: patientId,
                fecha,
                numero_diente: toothNumber ? parseInt(toothNumber, 10) : null,
                doctor_id: doctorId,
                doctor_name: doctorName,
                template_id: templateId || undefined,
                template_name: templateName || undefined,
                content_html: contentHtml,
            };
            await api.post(API_ROUTES.PATIENT_MEDICAL_INSTRUCTIONS_UPSERT, payload);
            toast({ title: existingInstruction ? t('toast.editSuccess') : t('toast.createSuccess') });
            onOpenChange(false);
            onSaved();
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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent maxWidth="5xl" className="h-full max-h-[90vh] p-0">
                <DialogHeader className="border-b px-6 py-4">
                    <DialogTitle>{existingInstruction ? t('editTitle') : t('createTitle')}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                                <Label>{t('date')}</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className={cn('w-full justify-start text-left font-normal h-10', !fecha && 'text-muted-foreground')}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {fecha ? format(new Date(fecha + 'T00:00:00'), 'dd/MM/yyyy', { locale: dateLocale }) : t('date')}
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
                                <Label>{t('tooth')}</Label>
                                <Input
                                    type="number"
                                    min={11}
                                    max={85}
                                    placeholder={t('toothPlaceholder')}
                                    value={toothNumber}
                                    onChange={(e) => setToothNumber(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>{t('doctor')}</Label>
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
                            </div>
                        </div>

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

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>{t('content')}</Label>
                                <Button type="button" variant="ghost" size="sm" onClick={handleRefreshVariables}>
                                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                                    {t('refreshVariables')}
                                </Button>
                            </div>
                            <InstructionRichTextEditor
                                value={contentHtml}
                                onChange={setContentHtml}
                                variables={MEDICAL_INSTRUCTION_TEMPLATE_VARIABLES}
                                groupOrder={MEDICAL_INSTRUCTION_TEMPLATE_VARIABLE_GROUP_ORDER}
                                groupLabels={groupLabels}
                                variablesLabel={t('variables.title')}
                                minHeight="24rem"
                            />
                        </div>
                    </div>
                    <DialogFooter className="px-6 py-4 border-t shrink-0">
                        <DialogCancelButton variant="outline">{t('cancel')}</DialogCancelButton>
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
