'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { OrderFileGallery, type OrderFile } from './order-file-gallery';

import { useClinicHistory } from '@/hooks/useClinicHistory';
import type { AttachedFile } from '@/lib/types';

/**
 * Los adjuntos de la sesión clínica: las radiografías y fotos que tomó el
 * técnico, que son el resultado de la orden.
 *
 * Las imágenes se ven como miniatura sin abrir nada — el derivador entra a esta
 * pestaña justamente a mirarlas. La carga, las miniaturas y el visor los
 * resuelve `OrderFileGallery`.
 */

export interface StudyOrderSessionAttachmentsProps {
    sessionId: string;
    attachments: AttachedFile[];
}

function fileLabel(file: AttachedFile): string {
    return file.file_name || file.ruta?.split('/').pop() || '—';
}

export function StudyOrderSessionAttachments({ sessionId, attachments }: StudyOrderSessionAttachmentsProps) {
    const t = useTranslations('StudyOrdersPage.sessionTab');
    const { getSessionAttachment } = useClinicHistory();

    // Un adjunto se identifica por id o, en los viejos, por su ruta.
    const galleryFiles = React.useMemo<OrderFile[]>(
        () => attachments.flatMap((f) => {
            const id = f.id || f.ruta;
            return id ? [{ id, name: fileLabel(f), mimeType: f.mime_type || f.tipo }] : [];
        }),
        [attachments],
    );
    const loadFile = React.useCallback(
        (id: string, signal: AbortSignal) => getSessionAttachment(sessionId, id, signal),
        [sessionId, getSessionAttachment],
    );

    if (attachments.length === 0) return null;

    return (
        <OrderFileGallery
            files={galleryFiles}
            loadFile={loadFile}
            label={t('attachments', { count: attachments.length })}
        />
    );
}

export default StudyOrderSessionAttachments;
