'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';

import { PrintReportHeader } from '@/components/reports/print-report-header';
import { useClinicInfo } from '@/hooks/useClinicInfo';
import { PatientMedicalInstruction } from '@/lib/types';

import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { useLocale, useTranslations } from 'next-intl';

function substituteTokens(text: string, vars: Record<string, string>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}

function waitForFrame(): Promise<void> {
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

function waitForImages(): Promise<void> {
    return new Promise((resolve) => {
        const container = document.querySelector('[data-print-container]');
        if (!container) { resolve(); return; }
        const images = Array.from(container.querySelectorAll<HTMLImageElement>('img'));
        const unloaded = images.filter((img) => !img.complete);
        if (unloaded.length === 0) { resolve(); return; }
        let pending = unloaded.length;
        const done = () => { if (--pending <= 0) resolve(); };
        unloaded.forEach((img) => {
            img.addEventListener('load', done, { once: true });
            img.addEventListener('error', done, { once: true });
        });
        setTimeout(resolve, 4000);
    });
}

function triggerPrint(onDone: () => void): void {
    const restore = () => {
        onDone();
        window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    window.print();
}

interface PrintTarget {
    instruction: PatientMedicalInstruction;
    patientName?: string;
}

export function usePatientInstructionPrint() {
    const [target, setTarget] = React.useState<PrintTarget | null>(null);

    React.useEffect(() => {
        if (!target) return;
        document.documentElement.classList.add('printing-multipage');
        return () => document.documentElement.classList.remove('printing-multipage');
    }, [target]);

    const printInstruction = async (instruction: PatientMedicalInstruction, patientName?: string) => {
        setTarget({ instruction, patientName });
        await waitForFrame();
        await waitForImages();
        triggerPrint(() => setTarget(null));
    };

    const PrintContainer = (target && typeof document !== 'undefined')
        ? createPortal(
            <PatientInstructionPrintContent instruction={target.instruction} patientName={target.patientName} />,
            document.body,
        )
        : null;

    return { printInstruction, PrintContainer };
}

function PatientInstructionPrintContent({ instruction, patientName }: PrintTarget) {
    const t = useTranslations('PatientInstructionPrint');
    const locale = useLocale();
    const dateLocale = locale === 'es' ? es : enUS;
    const clinic = useClinicInfo();

    const parsedDate = instruction.fecha ? new Date(instruction.fecha.split('T')[0] + 'T00:00:00') : null;
    const formattedDate = parsedDate && !isNaN(parsedDate.getTime())
        ? format(parsedDate, 'dd/MM/yyyy', { locale: dateLocale })
        : '';

    // Defensive: resolve any {{tokens}} still left in the saved content_html
    // (e.g. instructions saved before the dialog auto-resolved on edit).
    const resolvedContentHtml = substituteTokens(instruction.content_html, {
        patient_name: patientName || '',
        doctor_name: instruction.doctor_name || '',
        clinic_name: clinic?.name || '',
        clinic_address: clinic?.address || '',
        clinic_phone: clinic?.phone || '',
        tooth_number: instruction.numero_diente != null ? String(instruction.numero_diente) : '',
        date: formattedDate,
    });

    return (
        <div
            data-print-container
            className="hidden print:block bg-white z-[9999] p-8 w-full text-black"
        >
            <div className="print-template-root font-sans text-gray-900">
                <PrintReportHeader />
                <div className="print-template-body">
                    <div className="mb-6 grid grid-cols-2 gap-2 text-sm">
                        <p><span className="font-semibold">{t('patient')}:</span> {patientName || ''}</p>
                        <p><span className="font-semibold">{t('date')}:</span> {formattedDate}</p>
                        <p><span className="font-semibold">{t('doctor')}:</span> {instruction.doctor_name || ''}</p>
                        {instruction.numero_diente != null && (
                            <p><span className="font-semibold">{t('tooth')}:</span> {instruction.numero_diente}</p>
                        )}
                    </div>
                    <div
                        className="text-sm leading-relaxed whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{ __html: resolvedContentHtml }}
                    />
                </div>
            </div>
        </div>
    );
}
