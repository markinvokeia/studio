'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';

import { PrescriptionDocument } from '@/components/medical-instructions/prescription-document';
import { PatientPrescription } from '@/lib/types';
import type { PrescriptionPatientInfo } from '@/lib/prescription-render';

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
    prescription: PatientPrescription;
    patientName?: string;
    patient?: PrescriptionPatientInfo | null;
}

export function usePrescriptionPrint() {
    const [target, setTarget] = React.useState<PrintTarget | null>(null);

    React.useEffect(() => {
        if (!target) return;
        document.documentElement.classList.add('printing-multipage');
        return () => document.documentElement.classList.remove('printing-multipage');
    }, [target]);

    const printPrescription = async (
        prescription: PatientPrescription,
        patientName?: string,
        patient?: PrescriptionPatientInfo | null,
    ) => {
        setTarget({ prescription, patientName, patient });
        await waitForFrame();
        await waitForImages();
        triggerPrint(() => setTarget(null));
    };

    const PrintContainer = (target && typeof document !== 'undefined')
        ? createPortal(<PrescriptionPrintContent {...target} />, document.body)
        : null;

    return { printPrescription, PrintContainer };
}

function PrescriptionPrintContent({ prescription, patientName, patient }: PrintTarget) {
    // El membrete, la tabla y la firma los aporta la plantilla guardada en
    // `content_html`; acá sólo se le da la hoja y se dispara la impresión.
    const source = React.useMemo(() => ({
        patient: { ...(patient ?? {}), name: patientName || patient?.name || '' },
        doctorId: prescription.doctor_id,
        doctorName: prescription.doctor_name,
        fecha: prescription.fecha,
        diagnostico: prescription.diagnostico,
        notas: prescription.notas,
        items: prescription.items || [],
    }), [patient, patientName, prescription]);

    return (
        <div data-print-container className="z-[9999] hidden w-full bg-white p-8 text-black print:block">
            <PrescriptionDocument contentHtml={prescription.content_html} source={source} />
        </div>
    );
}
