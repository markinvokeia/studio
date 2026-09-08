'use client';

import { useTranslations } from 'next-intl';

import { formatDateTime, formatDisplayDate } from '@/lib/utils';
import type { StudyOrder } from '@/lib/types';
import type { StudyOrderPrintData } from '@/stores/print-document-store';

/**
 * La orden de estudio en papel.
 *
 * Reproduce lo que el derivador llenó, en el mismo orden en que lo llenó:
 * secciones, servicios, piezas y modificadores. Es la versión imprimible de la
 * pestaña "Orden" del detalle, no un resumen — el papel viaja con el paciente y
 * tiene que alcanzar para que el técnico sepa qué hacer sin abrir el sistema.
 *
 * Es un print React-only: el cuerpo son secciones anidadas con listas de piezas
 * y modificadores, que no se dejan describir con las variables planas del editor
 * de plantillas. Mismo criterio que la historia clínica y el estado de cuenta.
 */

interface StudyOrderPrintTemplateProps {
    data: StudyOrderPrintData;
}

/** Las piezas se imprimen como texto: un odontograma en blanco y negro no se lee. */
function teethLabel(teeth: string[]): string {
    return [...teeth].sort().join('  ');
}

function modifiersLabel(item: StudyOrder['items'][number]): string {
    return Object.values(item.modifiers ?? {}).flat().join(' · ');
}

export function StudyOrderPrintTemplate({ data }: StudyOrderPrintTemplateProps) {
    const t = useTranslations('StudyOrdersPage');
    const { order } = data;

    // Se agrupan por sección respetando el orden en que vienen, que es el del
    // formulario: el técnico lee el papel en el mismo orden en que fue llenado.
    const sections: Array<[string, StudyOrder['items']]> = [];
    for (const item of order.items) {
        const last = sections[sections.length - 1];
        if (last && last[0] === item.section_code) last[1].push(item);
        else sections.push([item.section_code, [item]]);
    }

    const texts = Object.entries(order.texts ?? {}).filter(([, value]) => value?.trim());

    return (
        <div className="text-[11pt] leading-snug text-black">
            <header className="mb-4 border-b-2 border-black pb-2">
                <div className="flex items-baseline justify-between gap-4">
                    <h1 className="text-[15pt] font-bold uppercase tracking-wide">{t('printTitle')}</h1>
                    <span className="font-mono text-[13pt] font-bold">{order.order_number}</span>
                </div>
                <p className="mt-0.5 text-[9pt]">
                    {order.submitted_at
                        ? t('columns.submittedAt') + ': ' + formatDisplayDate(order.submitted_at)
                        : formatDisplayDate(order.created_at)}
                </p>
            </header>

            <section className="mb-4 grid grid-cols-2 gap-x-6 gap-y-1.5">
                <Row label={t('columns.patient')} value={order.patient_name} strong />
                <Row label={t('form.patientDocument')} value={order.patient_document} />
                <Row label={t('columns.doctor')} value={order.doctor_name} />
                <Row label={t('form.patientPhone')} value={order.patient_phone} />
                <Row label={t('form.preferredSede')} value={order.preferred_sede_name} />
            </section>

            {order.delivery_methods.length > 0 && (
                <section className="mb-4">
                    <SectionTitle>{t('form.deliverySection')}</SectionTitle>
                    <p>{order.delivery_methods.join(' · ')}</p>
                </section>
            )}

            {sections.map(([sectionCode, items]) => (
                <section key={sectionCode} className="mb-3 break-inside-avoid">
                    <SectionTitle>{sectionCode}</SectionTitle>
                    <ul className="ml-4 list-disc space-y-1">
                        {items.map((item) => (
                            <li key={item.id} className={item.is_cancelled ? 'line-through' : undefined}>
                                <span className="font-medium">{item.service_name}</span>
                                {modifiersLabel(item) && (
                                    <span className="text-[9.5pt]"> — {modifiersLabel(item)}</span>
                                )}
                                {item.notes && <div className="text-[9.5pt] italic">{item.notes}</div>}
                            </li>
                        ))}
                    </ul>
                    {order.regions?.[sectionCode]?.length > 0 && (
                        <p className="mt-1 text-[9.5pt]">
                            <span className="font-semibold">{t('form.regionsLabel')}:</span>{' '}
                            <span className="font-mono">{teethLabel(order.regions[sectionCode])}</span>
                        </p>
                    )}
                </section>
            ))}

            {texts.length > 0 && (
                <section className="mb-3 break-inside-avoid">
                    <SectionTitle>{t('form.textsSection')}</SectionTitle>
                    <dl className="space-y-0.5">
                        {texts.map(([code, value]) => (
                            <div key={code} className="flex gap-2">
                                <dt className="font-semibold">{code}:</dt>
                                <dd>{value}</dd>
                            </div>
                        ))}
                    </dl>
                </section>
            )}

            {order.clinical_notes && (
                <section className="mb-3 break-inside-avoid">
                    <SectionTitle>{t('form.clinicalNotes')}</SectionTitle>
                    <p className="whitespace-pre-wrap">{order.clinical_notes}</p>
                </section>
            )}

            <footer className="mt-8 flex items-end justify-between gap-8 text-[9pt]">
                <div className="flex-1 border-t border-black pt-1 text-center">
                    {order.doctor_name ?? t('columns.doctor')}
                </div>
                <span className="shrink-0">{formatDateTime(data.emittedAt)}</span>
            </footer>
        </div>
    );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
    return (
        <h2 className="mb-1 border-b border-black text-[10pt] font-bold uppercase tracking-wide">
            {children}
        </h2>
    );
}

function Row({ label, value, strong }: { label: string; value?: string | null; strong?: boolean }) {
    if (!value) return null;
    return (
        <p>
            <span className="text-[9pt] uppercase">{label}: </span>
            <span className={strong ? 'font-bold' : undefined}>{value}</span>
        </p>
    );
}

export default StudyOrderPrintTemplate;
