'use client';

import * as React from 'react';
import { Images } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

import { OrderFilesPanel } from './order-files-panel';
import type { OrderFile } from './order-file-gallery';
import { OriginalsSplit } from './originals-split';
import { ReviewActionsProvider, ReviewLocateProvider, useOriginalFocus } from './review-locate';
import { StudyOrderReviewList } from './study-order-review-list';
import { useReviewItemActions } from './use-review-item-actions';

import type { StudyOrder } from '@/lib/types';
import { getWhatsappIntakeFile } from '@/services/study-orders';

/**
 * Pestaña "Revisión" del detalle: los puntos a revisar con los originales de la orden al lado,
 * igual que en el asistente al editarla. "Ver en el original" (o elegir el punto) lleva al lugar
 * donde el asistente leyó el dato, y el punto se puede marcar desde la tarjeta sobre la imagen.
 *
 * Sin originales (o sin permiso para verlos) queda solo la lista.
 */

export interface StudyOrderReviewTabProps {
    order: StudyOrder;
    canReview: boolean;
    /** Se pueden mostrar los originales (vinieron por WhatsApp o importados y hay permiso). */
    canSeeOriginals: boolean;
    /** Después de marcar un punto: el padre recarga la orden. */
    onChanged: () => void | Promise<void>;
}

/** Los originales arrancan abiertos donde hay lugar para ellos al lado de la lista. */
const isWideScreen = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;

export function StudyOrderReviewTab({ order, canReview, canSeeOriginals, onChanged }: StudyOrderReviewTabProps) {
    const t = useTranslations('StudyOrdersPage');
    const items = React.useMemo(() => order.review_items ?? [], [order.review_items]);
    const info = canSeeOriginals ? order.whatsapp : null;
    const intakeId = info?.intake_id ?? '';
    const files = React.useMemo<OrderFile[]>(
        () => (info?.files ?? []).map((f) => ({ id: f.id, name: f.file_name, mimeType: f.mime_type })),
        [info?.files],
    );
    const hasOriginals = files.length > 0;

    const [showOriginals, setShowOriginals] = React.useState(isWideScreen);
    const openOriginals = React.useCallback(() => setShowOriginals(true), []);
    const { focus, focusItem, locate, clear, navigation, focusNextPending } = useOriginalFocus(items, openOriginals);
    /** Una sola instancia: la lista y la tarjeta sobre el original ven el mismo punto guardándose. */
    const actions = useReviewItemActions(order.id, onChanged);

    const loadFile = React.useCallback(
        (id: string, signal: AbortSignal) => getWhatsappIntakeFile(intakeId, id, signal),
        [intakeId],
    );

    /** Mostrar u ocultar: con los originales a la vista va en la cabecera del visor; si no, junto al título. */
    const toggleOriginals = (
        <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 shrink-0 text-xs"
            aria-pressed={showOriginals}
            onClick={() => setShowOriginals((v) => !v)}
        >
            <Images className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {showOriginals ? t('wizard.hideOriginals') : t('wizard.showOriginals')}
        </Button>
    );

    const list = (
        <StudyOrderReviewList
            orderId={order.id}
            items={items}
            canReview={canReview}
            onChanged={onChanged}
            headerActions={hasOriginals && !showOriginals ? toggleOriginals : null}
        />
    );

    if (!hasOriginals) {
        return <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">{list}</div>;
    }

    return (
        <ReviewLocateProvider value={locate}>
            <ReviewActionsProvider value={canReview ? actions : null}>
                <OriginalsSplit
                    label={t('wizard.originals')}
                    storageKey="study-order-review-originals"
                    originals={showOriginals ? (maximizeButton) => (
                        <OrderFilesPanel
                            files={files}
                            loadFile={loadFile}
                            focus={focus}
                            focusItem={focusItem}
                            onClearFocus={clear}
                            onFocusResolved={focusNextPending}
                            focusNavigation={navigation}
                            headerStartActions={toggleOriginals}
                            headerActions={maximizeButton}
                            className="h-full"
                        />
                    ) : null}
                >
                    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-4">{list}</div>
                </OriginalsSplit>
            </ReviewActionsProvider>
        </ReviewLocateProvider>
    );
}

export default StudyOrderReviewTab;
