'use client';

import * as React from 'react';

import type { NormalizedBox, StudyOrderReviewItem } from '@/lib/types';

/**
 * "Ver en el original": cada punto a revisar sabe dónde leyó el asistente el dato
 * (`source`, desde so-extraction-v4). Quien muestra los originales (el asistente de órdenes)
 * provee `locate`; la marca ámbar sobre el dato y la lista de puntos lo usan sin que haya que
 * pasarlo por cada sección del formulario.
 */

/** Lo que el panel de originales tiene que mostrar al ir a un dato. */
export interface OriginalFocus {
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

/** El punto trae algo con qué encontrar el dato en el original. */
export function hasSource(item: StudyOrderReviewItem): boolean {
    const s = item.source;
    return !!s && !!(s.attachment_id || s.box || s.zone || s.quote);
}

export function toOriginalFocus(item: StudyOrderReviewItem, key: number): OriginalFocus {
    const s = item.source ?? {};
    const page = Number(s.page);
    return {
        fileId: s.attachment_id ? String(s.attachment_id) : null,
        page: Number.isInteger(page) && page >= 1 ? page : 1,
        box: s.box ?? null,
        zone: s.zone ?? null,
        quote: s.quote ?? null,
        label: item.value_read ? `${item.label}: ${item.value_read}` : item.label,
        key,
    };
}
