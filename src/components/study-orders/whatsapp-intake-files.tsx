'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { OrderFileGallery } from './order-file-gallery';

import { getWhatsappIntakeFile } from '@/services/study-orders';
import type { WhatsappIntakeFile } from '@/lib/types';

/**
 * Los originales (fotos y PDF) que el usuario mandó por WhatsApp junto con su
 * orden. Sirven para auditar: comprobar contra el papel que el asistente leyó
 * bien.
 *
 * Los archivos se piden con la sesión del usuario a n8n (que los baja de Drive):
 * el navegador nunca habla con Drive. La carga, las miniaturas y el visor los
 * resuelve `OrderFileGallery`.
 */

export interface WhatsappIntakeFilesProps {
    intakeId: string;
    files: WhatsappIntakeFile[];
}

export function WhatsappIntakeFiles({ intakeId, files }: WhatsappIntakeFilesProps) {
    const t = useTranslations('StudyOrdersPage.whatsapp');

    const galleryFiles = React.useMemo(
        () => files.map((f) => ({ id: f.id, name: f.file_name, mimeType: f.mime_type })),
        [files],
    );
    const loadFile = React.useCallback(
        (id: string, signal: AbortSignal) => getWhatsappIntakeFile(intakeId, id, signal),
        [intakeId],
    );

    if (files.length === 0) {
        return <p className="text-xs text-muted-foreground">{t('noFiles')}</p>;
    }

    return <OrderFileGallery files={galleryFiles} loadFile={loadFile} label={`${t('originals')} (${files.length})`} />;
}

export default WhatsappIntakeFiles;
