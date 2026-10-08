import type { StudyOrderFormOptions, StudyOrderReviewItem } from '@/lib/types';

/**
 * Dónde va cada punto a revisar dentro del asistente de órdenes: en qué paso (los datos del
 * paciente o una sección del formulario) y sobre qué elemento (un estudio, una opción, un campo de
 * texto, el odontograma o un dato del paciente). Así quien corrige la orden ve la advertencia en el
 * lugar donde está el dato, no solo en una lista general.
 *
 * Solo cuenta los pendientes: lo ya revisado no se marca.
 *
 * Los puntos nuevos traen `section_code`; los anteriores se ubican por el campo (`regions.<sección>`,
 * el código de la opción) o, para un estudio, por su nombre en el catálogo.
 */

/** Paso de los datos del paciente (el primero). Las secciones usan su propio código. */
export const PATIENT_STEP = '__patient__';

export type ReviewPatientField = 'name' | 'document' | 'phone' | 'doctor' | 'delivery';

export interface ReviewTargets {
    /** Puntos pendientes por paso: `PATIENT_STEP` o el código de la sección. */
    byStep: Map<string, StudyOrderReviewItem[]>;
    /** Por id de servicio del catálogo. */
    services: Map<string, StudyOrderReviewItem[]>;
    /** Por `<sección>|<código de opción>`. */
    options: Map<string, StudyOrderReviewItem[]>;
    /** Por código del campo de texto. */
    texts: Map<string, StudyOrderReviewItem[]>;
    /** Piezas dudosas, por sección. */
    teeth: Map<string, StudyOrderReviewItem[]>;
    patientFields: Map<ReviewPatientField, StudyOrderReviewItem[]>;
}

const push = <K>(map: Map<K, StudyOrderReviewItem[]>, key: K, item: StudyOrderReviewItem) => {
    const bucket = map.get(key);
    if (bucket) bucket.push(item);
    else map.set(key, [item]);
};

export function optionTargetKey(sectionCode: string, optionCode: string): string {
    return `${sectionCode}|${optionCode}`;
}

export function resolveReviewTargets(
    items: StudyOrderReviewItem[] | null | undefined,
    options: StudyOrderFormOptions | null,
): ReviewTargets {
    const targets: ReviewTargets = {
        byStep: new Map(), services: new Map(), options: new Map(),
        texts: new Map(), teeth: new Map(), patientFields: new Map(),
    };
    const sections = options?.sections ?? [];
    const sectionOfService = new Map<string, string>();
    for (const section of sections) {
        for (const service of section.services) sectionOfService.set(service.id, section.code);
    }
    const hasSection = (code: string | null | undefined): code is string =>
        !!code && sections.some((s) => s.code === code);

    for (const item of items ?? []) {
        if (item.status !== 'pending') continue;
        const field = item.field ?? '';
        let step: string = PATIENT_STEP;

        if (field.startsWith('items.')) {
            // El estudio, por la sección que trae el punto o por el nombre que figura en la etiqueta.
            const name = (item.label ?? '').replace(/^Estudio:\s*/, '').trim().toLowerCase();
            const candidates = sections
                .filter((s) => !item.section_code || s.code === item.section_code)
                .flatMap((s) => s.services.map((service) => ({ section: s.code, service })));
            const match = candidates.find((c) => c.service.name.trim().toLowerCase() === name);
            if (match) {
                step = match.section;
                push(targets.services, match.service.id, item);
            } else if (hasSection(item.section_code)) {
                step = item.section_code;
            }
        } else if (field.startsWith('modifiers.')) {
            const code = field.slice('modifiers.'.length);
            const option = (options?.modifiers ?? []).find((o) => o.code === code
                && (!item.section_code || o.section_code === item.section_code
                    || (o.service_id && sectionOfService.get(o.service_id) === item.section_code)));
            const section = item.section_code
                || option?.section_code
                || (option?.service_id ? sectionOfService.get(option.service_id) : undefined);
            if (hasSection(section)) {
                step = section;
                push(targets.options, optionTargetKey(section, code), item);
            }
        } else if (field.startsWith('regions.')) {
            const section = item.section_code || field.split('.')[1];
            if (hasSection(section)) {
                step = section;
                push(targets.teeth, section, item);
            }
        } else if (field.startsWith('texts.')) {
            const code = field.slice('texts.'.length);
            const option = (options?.texts ?? []).find((o) => o.code === code);
            const section = item.section_code || option?.section_code;
            if (hasSection(section)) {
                step = section;
                push(targets.texts, code, item);
            }
        } else if (field === 'patient.name') {
            push(targets.patientFields, 'name', item);
        } else if (field === 'patient.document') {
            push(targets.patientFields, 'document', item);
        } else if (field === 'patient.phone') {
            push(targets.patientFields, 'phone', item);
        } else if (field.startsWith('doctor.')) {
            push(targets.patientFields, 'doctor', item);
        } else if (field.startsWith('delivery_methods.')) {
            push(targets.patientFields, 'delivery', item);
        }

        push(targets.byStep, step, item);
    }
    return targets;
}
