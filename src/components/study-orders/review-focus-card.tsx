'use client';

import * as React from 'react';
import { Check, ChevronLeft, ChevronRight, MessageSquarePlus, Pencil, RotateCcw, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { useReviewActions, type OriginalFocus } from './review-locate';
import { confidencePercent } from './study-order-review-list';

import { cn } from '@/lib/utils';
import type { StudyOrderReviewItem, StudyOrderReviewStatus } from '@/lib/types';

/**
 * El punto a revisar que se está mirando en el original: qué leyó el asistente, con qué confianza
 * y las acciones para marcarlo (solo íconos), sin volver a la lista. `floating` va sobre el
 * recuadro de la imagen; `inline` en la franja de arriba del panel, cuando no hay recuadro (PDF,
 * imagen sin ubicación exacta o archivo desconocido).
 *
 * Con `navigation` se pasa al punto anterior o al siguiente sin volver a la lista, y con
 * `renderEditor` el dato se corrige ahí mismo (el campo del formulario, en chico).
 */

/** Dónde está el punto entre los que se pueden ver en el original, y cómo ir a los vecinos. */
export interface ReviewFocusNavigation {
    /** Desde 0. */
    index: number;
    total: number;
    /** Ausente en el primero / el último. */
    onPrev?: () => void;
    onNext?: () => void;
}
export interface ReviewFocusCardProps {
    focus: OriginalFocus;
    /** El punto con su estado actual; null si ya no está entre los puntos de la orden. */
    item: StudyOrderReviewItem | null;
    variant: 'floating' | 'inline';
    onClose?: () => void;
    /** Después de confirmarlo, corregirlo o descartarlo desde acá (para ir al siguiente). */
    onResolved?: (item: StudyOrderReviewItem) => void;
    /** Debajo del dato: por qué no hay recuadro (solo en `inline`). */
    hint?: React.ReactNode;
    navigation?: ReviewFocusNavigation | null;
    /**
     * El campo del formulario del punto, para corregirlo desde la tarjeta. `markEdited` avisa que
     * se cambió: "Corregido" pasa a ser la acción destacada. Null si el punto no tiene un campo.
     */
    renderEditor?: (item: StudyOrderReviewItem, markEdited: () => void) => React.ReactNode;
    className?: string;
}

/** Con el dedo (celular, tablet) los íconos necesitan más superficie que con el mouse. */
const ICON_BUTTON = 'h-7 w-7 [@media(pointer:coarse)]:h-9 [@media(pointer:coarse)]:w-9';

/** Confianza baja en rojo, media en ámbar, alta en verde: lo primero que mira quien revisa. */
function confidenceClass(value: number): string {
    if (value < 50) return 'border-destructive/50 text-destructive';
    if (value < 80) return 'border-amber-500/50 text-amber-700 dark:text-amber-400';
    return 'border-emerald-500/50 text-emerald-700 dark:text-emerald-400';
}

export function ReviewFocusCard({ focus, item, variant, onClose, onResolved, hint, navigation, renderEditor, className }: ReviewFocusCardProps) {
    const t = useTranslations('StudyOrdersPage.review');
    const tViewer = useTranslations('FileViewer');
    const actions = useReviewActions();
    const [note, setNote] = React.useState('');
    /** Se cambió el dato desde la tarjeta (la tarjeta se arma de nuevo por punto). */
    const [edited, setEdited] = React.useState(false);
    const markEdited = React.useCallback(() => setEdited(true), []);

    const confidence = item ? confidencePercent(item.confidence) : null;
    const isPending = item?.status === 'pending';
    const busy = !!item && !!actions?.isPending(item.id);
    const quote = focus.quote && focus.quote !== item?.value_read ? focus.quote : null;
    const canAct = !!item && !!actions;
    const showNavigation = !!navigation && navigation.total > 1;
    const editor = item && renderEditor ? renderEditor(item, markEdited) : null;

    const act = async (status: StudyOrderReviewStatus) => {
        if (!item || !actions) return;
        const result = await actions.mark(item, status, note);
        if (!result) return;
        setNote('');
        if (status !== 'pending') onResolved?.(item);
    };

    /** Solo el primero muestra el spinner: los demás quedan deshabilitados mientras se guarda. */
    const iconButton = (label: string, icon: React.ReactNode, status: StudyOrderReviewStatus, extra?: string, spinner = false) => (
        <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(ICON_BUTTON, extra)}
            loading={spinner && busy}
            disabled={busy}
            onClick={() => void act(status)}
            aria-label={label}
            title={label}
        >
            {icon}
        </Button>
    );

    return (
        <div
            className={cn(
                'space-y-1.5 text-xs',
                variant === 'floating' && 'rounded-lg border border-amber-400 bg-popover p-2.5 text-popover-foreground shadow-lg',
                className,
            )}
            role="group"
            aria-label={item?.label ?? focus.label}
        >
            <div className="flex items-start gap-1.5">
                <p className="min-w-0 flex-1 break-words font-medium text-muted-foreground">{item?.label ?? focus.label}</p>
                {confidence !== null && (
                    <Badge variant="outline" className={cn('shrink-0 px-1.5 py-0 text-[10px] tabular-nums', confidenceClass(confidence))}>
                        {t('confidence', { value: confidence })}
                    </Badge>
                )}
                {onClose && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="-mr-1 -mt-1 h-6 w-6 shrink-0 [@media(pointer:coarse)]:h-8 [@media(pointer:coarse)]:w-8"
                        onClick={onClose}
                        aria-label={tViewer('focus.clear')}
                        title={tViewer('focus.clear')}
                    >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                )}
            </div>

            {item?.value_read && (
                <p className="break-words text-sm">
                    {/* Con el campo abajo hay que distinguir lo que leyó del valor actual. */}
                    <span className={cn(editor ? 'text-xs text-muted-foreground' : 'sr-only')}>{t('focus.read')}: </span>
                    <span className="font-mono font-medium">{item.value_read}</span>
                </p>
            )}
            {(quote || (variant === 'inline' && focus.zone)) && (
                <p className="break-words text-muted-foreground">
                    {t('sourceWhere')}{' '}
                    {variant === 'inline' && focus.zone}
                    {variant === 'inline' && focus.zone && quote && ' · '}
                    {quote && <span className="italic">“{quote}”</span>}
                </p>
            )}
            {hint && <p className="text-muted-foreground">{hint}</p>}

            {editor && <div className="border-t pt-1.5">{editor}</div>}

            {item && !isPending && (
                <p className="text-muted-foreground">
                    {t(`status.${item.status}` as never)}
                    {item.reviewed_by_name && ` · ${item.reviewed_by_name}`}
                </p>
            )}

            {(canAct || showNavigation) && (
                // `flex-wrap`: con íconos táctiles (más grandes) la navegación baja a otra línea.
                <div className="flex flex-wrap items-center gap-0.5 border-t pt-1.5">
                    {!item || !actions ? null : isPending ? (
                        <>
                            {iconButton(
                                t('actions.confirm'),
                                <Check className="h-4 w-4" aria-hidden="true" />,
                                'confirmed',
                                'text-emerald-700 hover:text-emerald-700 dark:text-emerald-400',
                                true,
                            )}
                            {iconButton(
                                t('actions.corrected'),
                                <Pencil className="h-4 w-4" aria-hidden="true" />,
                                'corrected',
                                edited ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground' : undefined,
                            )}
                            {iconButton(t('actions.dismiss'), <X className="h-4 w-4" aria-hidden="true" />, 'dismissed', 'text-muted-foreground')}
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className={cn(ICON_BUTTON, 'relative text-muted-foreground', note.trim() && 'text-primary')}
                                        disabled={busy}
                                        aria-label={t('actions.addNote')}
                                        title={t('actions.addNote')}
                                    >
                                        <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
                                        {note.trim() && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent align="end" className="w-64 space-y-1.5 p-2">
                                    <Input
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                        placeholder={t('notePlaceholder')}
                                        maxLength={500}
                                        className="h-8 text-sm"
                                        aria-label={t('notePlaceholder')}
                                        autoFocus
                                    />
                                    <p className="text-[11px] text-muted-foreground">{t('focus.noteHint')}</p>
                                </PopoverContent>
                            </Popover>
                        </>
                    ) : (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={cn(ICON_BUTTON, 'text-muted-foreground')}
                            loading={busy}
                            onClick={() => void act('pending')}
                            aria-label={t('actions.reopen')}
                            title={t('actions.reopen')}
                        >
                            <RotateCcw className="h-4 w-4" aria-hidden="true" />
                        </Button>
                    )}

                    {showNavigation && (
                        <div className="ml-auto flex items-center">
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className={ICON_BUTTON}
                                disabled={!navigation.onPrev}
                                onClick={navigation.onPrev}
                                aria-label={t('focus.prev')}
                                title={t('focus.prev')}
                            >
                                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                            </Button>
                            <span className="min-w-[2.5rem] text-center text-[11px] tabular-nums text-muted-foreground">
                                {t('focus.position', { index: navigation.index + 1, total: navigation.total })}
                            </span>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className={ICON_BUTTON}
                                disabled={!navigation.onNext}
                                onClick={navigation.onNext}
                                aria-label={t('focus.next')}
                                title={t('focus.next')}
                            >
                                <ChevronRight className="h-4 w-4" aria-hidden="true" />
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default ReviewFocusCard;
