'use client';

import * as React from 'react';
import { Check, Copy, Link2, Loader2, Mail, MessageCircle, TriangleAlert } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { useToast } from '@/hooks/use-toast';
import { formatDateTime } from '@/lib/utils';
import type { StudyOrder } from '@/lib/types';
import { createStudyOrderBookingLink } from '@/services/study-orders';

/**
 * Genera el link con el que el paciente elige horario sin tener cuenta.
 *
 * El token en claro existe **una sola vez**: el backend lo devuelve al crearlo y
 * guarda sólo su sha256. Por eso la pantalla no puede "volver a mostrar" el link
 * de una orden — si se cerró el panel sin copiarlo, hay que generar otro. Y
 * generar otro revoca el anterior, así que el link viejo que ya circula por
 * WhatsApp deja de servir. Las dos cosas se avisan en la UI antes de generar.
 */

/** Días de validez y usos. Fijos por ahora: nadie pidió configurarlos. */
const DAYS_VALID = 7;

export interface StudyOrderBookingLinkTabProps {
    order: StudyOrder;
}

export function StudyOrderBookingLinkTab({ order }: StudyOrderBookingLinkTabProps) {
    const t = useTranslations('StudyOrdersPage.bookingLink');
    const locale = useLocale();
    const { toast } = useToast();

    const [link, setLink] = React.useState<{ url: string; expiresAt: string } | null>(null);
    const [isGenerating, setIsGenerating] = React.useState(false);
    const [copied, setCopied] = React.useState(false);

    /**
     * Una orden ya agendada del todo no necesita link, y sin ficha de paciente el
     * backend lo rechaza: sin ella no hay a nombre de quién crear la cita.
     */
    const activeItems = order.items.filter((i) => !i.is_cancelled);
    const isFullyScheduled = activeItems.length > 0 && activeItems.every((i) => i.is_scheduled);
    const blockedReason = order.status !== 'submitted' ? t('blockedNotSubmitted')
        : !order.patient_id ? t('blockedNoPatient')
        : isFullyScheduled ? t('blockedScheduled')
        : null;

    /**
     * A dónde mandar el link. Se prefiere la ficha del paciente sobre lo que el
     * derivador escribió a mano en la orden: la ficha es el dato que la clínica
     * mantiene, el de la orden se cargó una vez y puede estar viejo.
     */
    const phone = (order.patient?.phone_number || order.patient_phone || '').trim();
    const email = (order.patient?.email || order.patient_email || '').trim();

    const message = link
        ? t('shareMessage', { patient: order.patient_name, order: order.order_number, url: link.url })
        : '';

    // wa.me quiere el número sin signos ni el más inicial.
    const whatsappHref = `https://wa.me/${phone.replace(/^\+/, '').replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    const mailtoHref = `mailto:${encodeURIComponent(email)}`
        + `?subject=${encodeURIComponent(t('shareSubject', { order: order.order_number }))}`
        + `&body=${encodeURIComponent(message)}`;

    const handleGenerate = React.useCallback(async () => {
        setIsGenerating(true);
        try {
            const created = await createStudyOrderBookingLink(order.id, { expiresInDays: DAYS_VALID });
            // La URL se arma acá: el backend no conoce el dominio del front.
            const url = `${window.location.origin}/${locale}/orden/${created.token}`;
            setLink({ url, expiresAt: created.expires_at });
            setCopied(false);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: t('error'),
                description: error instanceof Error ? error.message : undefined,
            });
        } finally {
            setIsGenerating(false);
        }
    }, [order.id, locale, toast, t]);

    const handleCopy = React.useCallback(async () => {
        if (!link) return;
        try {
            await navigator.clipboard.writeText(link.url);
            setCopied(true);
            toast({ title: t('copied') });
            window.setTimeout(() => setCopied(false), 2000);
        } catch {
            // Sin permiso de portapapeles el input queda igual para copiar a mano.
            toast({ variant: 'destructive', title: t('copyFailed') });
        }
    }, [link, toast, t]);

    if (blockedReason) {
        return (
            <div className="flex items-start gap-2.5 rounded-lg border border-dashed p-3">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">{blockedReason}</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-start gap-2.5">
                <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">{t('description', { days: DAYS_VALID })}</p>
            </div>

            {link ? (
                <div className="space-y-3">
                    <div className="flex gap-2">
                        <Input readOnly value={link.url} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
                        <Button variant="outline" size="icon" onClick={() => void handleCopy()} aria-label={t('copy')}>
                            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                        </Button>
                    </div>

                    {/* Enviar por WhatsApp o por mail. Los dos abren la app del
                        usuario con el mensaje ya escrito — no mandan nada desde
                        el servidor, así que no hace falta backend ni quedan
                        envíos a medias si algo falla.

                        El botón sólo aparece si hay a dónde mandar: un WhatsApp
                        sin teléfono abriría la app en blanco. */}
                    <div className="flex flex-wrap gap-2">
                        {phone && (
                            <Button variant="outline" size="sm" asChild>
                                <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                                    <MessageCircle className="mr-2 h-4 w-4" />
                                    {t('sendWhatsapp')}
                                </a>
                            </Button>
                        )}
                        {email && (
                            <Button variant="outline" size="sm" asChild>
                                <a href={mailtoHref}>
                                    <Mail className="mr-2 h-4 w-4" />
                                    {t('sendEmail')}
                                </a>
                            </Button>
                        )}
                    </div>
                    {!phone && !email && (
                        <p className="text-xs text-muted-foreground">{t('noContact')}</p>
                    )}

                    <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">
                            {t('expiresAt', { date: formatDateTime(link.expiresAt) })}
                        </p>
                        <p className="text-xs text-muted-foreground">{t('showOnce')}</p>
                    </div>
                </div>
            ) : (
                <Button onClick={() => void handleGenerate()} disabled={isGenerating}>
                    {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
                    {t('generate')}
                </Button>
            )}

            <p className="text-xs text-muted-foreground">{t('revokesPrevious')}</p>
        </div>
    );
}

export default StudyOrderBookingLinkTab;
