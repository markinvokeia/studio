'use client';

import * as React from 'react';
import { AlertTriangle, CheckCircle2, MessageCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { WhatsappIntakeFiles } from './whatsapp-intake-files';

import { formatDateTime } from '@/lib/utils';
import type { StudyOrder } from '@/lib/types';

/**
 * Pestaña "Original" de una orden que entró por WhatsApp: los archivos que
 * mandó el usuario junto a lo que el asistente leyó de ellos, para poder
 * comprobar que no hubo errores de lectura (el motivo por el que se guardan).
 *
 * El resumen de la orden (estudios, paciente, opciones) ya está en la pestaña
 * Orden; acá va solo lo que no cabe ahí: el origen, el doctor tal como figura en
 * el papel (sin vincular) y las advertencias de la revisión.
 */

const KNOWN_WARNINGS = new Set(['no_signature', 'old_order', 'unplaced_details', 'unreadable_fields', 'modifier_without_service']);

export interface StudyOrderWhatsappTabProps {
    order: StudyOrder;
}

export function StudyOrderWhatsappTab({ order }: StudyOrderWhatsappTabProps) {
    const t = useTranslations('StudyOrdersPage.whatsapp');
    const info = order.whatsapp;

    if (!info) return null;

    const model = typeof info.extraction_meta?.model === 'string' ? info.extraction_meta.model : null;

    return (
        <div className="space-y-5">
            <div className="flex items-start gap-2 text-sm">
                <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                <div className="min-w-0 space-y-0.5">
                    <p>{t('original.receivedVia', { date: formatDateTime(info.received_at) })}</p>
                    {info.phone && <p className="text-muted-foreground">{t('original.from', { phone: info.phone })}</p>}
                    {model && <p className="text-xs text-muted-foreground">{t('original.model', { model })}</p>}
                </div>
            </div>

            <WhatsappIntakeFiles intakeId={info.intake_id} files={info.files} />

            <section className="space-y-2">
                <h3 className="text-sm font-medium">{t('original.readByAssistant')}</h3>
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                        <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {t('original.doctorAsWritten')}
                        </dt>
                        <dd className="text-sm">{order.referring_doctor_name || '—'}</dd>
                    </div>
                </dl>
            </section>

            <section className="space-y-2">
                <h3 className="text-sm font-medium">{t('original.warningsTitle')}</h3>
                {info.warnings.length === 0 ? (
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                        {t('original.noWarnings')}
                    </p>
                ) : (
                    <ul className="space-y-1.5">
                        {info.warnings.map((warning, i) => (
                            <li key={`${warning.code}-${i}`} className="flex items-start gap-1.5 text-sm">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
                                <span>
                                    {KNOWN_WARNINGS.has(warning.code) ? t(`warning.${warning.code}`) : warning.code}
                                    {warning.detail && warning.code !== 'no_signature' && (
                                        <span className="text-muted-foreground">: {warning.detail}</span>
                                    )}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}

export default StudyOrderWhatsappTab;
