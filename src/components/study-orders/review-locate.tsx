'use client';

import * as React from 'react';

import type { ReviewItemActions } from './use-review-item-actions';

import type { NormalizedBox, StudyOrderReviewItem } from '@/lib/types';

/**
 * "Ver en el original": cada punto a revisar sabe dónde leyó el asistente el dato
 * (`source`, desde so-extraction-v4). Quien muestra los originales (el asistente de órdenes)
 * provee `locate`; la marca ámbar sobre el dato y la lista de puntos lo usan sin que haya que
 * pasarlo por cada sección del formulario.
 */

/** Lo que el panel de originales tiene que mostrar al ir a un dato. */
export interface OriginalFocus {
    /** El punto a revisar: la tarjeta sobre el original lo busca entre los puntos actuales. */
    itemId: string;
    /** Original donde está (attachments.id). Nulo si el asistente solo dio la zona o la cita. */
    fileId: string | null;
    page: number;
    box: NormalizedBox | null;
    zone: string | null;
    quote: string | null;
    /** Qué dato es (el texto del punto a revisar). */
    label: string;
    /** Cambia en cada pedido: volver a tocar el mismo punto vuelve a centrarlo. */
    key: number;
}

type LocateFn = (item: StudyOrderReviewItem) => void;

const ReviewLocateContext = React.createContext<LocateFn | null>(null);

export const ReviewLocateProvider = ReviewLocateContext.Provider;

/** `locate` si hay originales a la vista; null si no (no se ofrece "ver en el original"). */
export function useReviewLocate(): LocateFn | null {
    return React.useContext(ReviewLocateContext);
}

const ReviewActionsContext = React.createContext<ReviewItemActions | null>(null);

/** Acciones compartidas entre la lista de puntos y la tarjeta sobre el original (misma orden). */
export const ReviewActionsProvider = ReviewActionsContext.Provider;

/** Las acciones compartidas, o null si nadie las provee (cada lista usa las suyas). */
export function useReviewActions(): ReviewItemActions | null {
    return React.useContext(ReviewActionsContext);
}

/** El punto trae algo con qué encontrar el dato en el original. */
export function hasSource(item: StudyOrderReviewItem): boolean {
    const s = item.source;
    return !!s && !!(s.attachment_id || s.box || s.zone || s.quote);
}

export function toOriginalFocus(item: StudyOrderReviewItem, key: number): OriginalFocus {
    const s = item.source ?? {};
    const page = Number(s.page);
    return {
        itemId: item.id,
        fileId: s.attachment_id ? String(s.attachment_id) : null,
        page: Number.isInteger(page) && page >= 1 ? page : 1,
        box: s.box ?? null,
        zone: s.zone ?? null,
        quote: s.quote ?? null,
        label: item.value_read ? `${item.label}: ${item.value_read}` : item.label,
        key,
    };
}

/**
 * El foco sobre los originales de quien los muestra (el asistente de órdenes o la pestaña
 * Revisión): qué punto se está señalando, ir al anterior o al siguiente y, al marcarlo, seguir con
 * el próximo pendiente. `onLocate` corre cada vez que se pide ir a un dato (p. ej. para abrir el
 * panel de originales si estaba cerrado); tiene que ser estable.
 */
export function useOriginalFocus(items: StudyOrderReviewItem[], onLocate?: () => void) {
    const [focus, setFocus] = React.useState<OriginalFocus | null>(null);

    const locate = React.useCallback((item: StudyOrderReviewItem) => {
        setFocus(toOriginalFocus(item, Date.now()));
        onLocate?.();
    }, [onLocate]);
    const clear = React.useCallback(() => setFocus(null), []);

    /** El punto del foco con su estado actual (se relee después de marcarlo). */
    const focusItem = React.useMemo(
        () => (focus ? items.find((i) => i.id === focus.itemId) ?? null : null),
        [focus, items],
    );

    /**
     * Anterior / siguiente desde la tarjeta: entre los puntos que dicen dónde están, en el orden de
     * la lista, pendientes o ya revisados (se puede volver a mirar uno ya marcado).
     */
    const navigation = React.useMemo(() => {
        if (!focus) return null;
        const locatable = items.filter(hasSource);
        const index = locatable.findIndex((i) => i.id === focus.itemId);
        if (index < 0) return null;
        const prev = locatable[index - 1];
        const next = locatable[index + 1];
        return {
            index,
            total: locatable.length,
            onPrev: prev ? () => locate(prev) : undefined,
            onNext: next ? () => locate(next) : undefined,
        };
    }, [focus, items, locate]);

    /**
     * Marcado un punto desde la tarjeta, sigue con el próximo pendiente que diga dónde está (en el
     * orden de la lista, volviendo al principio). Sin más, deja de señalar.
     */
    const focusNextPending = React.useCallback((done: StudyOrderReviewItem) => {
        const start = items.findIndex((i) => i.id === done.id);
        const ordered = [...items.slice(start + 1), ...items.slice(0, Math.max(start, 0))];
        const next = ordered.find((i) => i.id !== done.id && i.status === 'pending' && hasSource(i));
        if (next) locate(next);
        else setFocus(null);
    }, [items, locate]);

    return { focus, focusItem, locate, clear, navigation, focusNextPending };
}
