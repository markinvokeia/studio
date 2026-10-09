import type { StudyOrderCatalogService, StudyOrderFormOptions, StudyOrderOption, StudyOrderReviewItem } from '@/lib/types';

/**
 * Dónde va cada punto a revisar dentro del asistente de órdenes: en qué paso (los datos del
 * paciente o una sección del formulario) y sobre qué elemento (un estudio, una opción, un campo de
 * texto, el odontograma o un dato del paciente). Así quien corrige la orden ve la advertencia en el
 * lugar donde está el dato, no solo en una lista general.
 *
 * `resolveReviewTargets` solo cuenta los pendientes: lo ya revisado no se marca.
 * `resolveReviewTarget` resuelve un punto suelto, en cualquier estado (para corregirlo desde la
 * tarjeta sobre el original).
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

/** El elemento del formulario que corresponde a un punto. */
export type ReviewTarget =
    | { kind: 'service'; section: string; service: StudyOrderCatalogService }
    | { kind: 'option'; section: string; code: string; option: StudyOrderOption | null }
    | { kind: 'teeth'; section: string }
    | { kind: 'text'; section: string; code: string; option: StudyOrderOption | null }
    | { kind: 'patient'; field: ReviewPatientField };

export interface ResolvedReviewTarget {
    /** `PATIENT_STEP` o el código de la sección. */
    step: string;
    /** Null si el punto no corresponde a un elemento del formulario (firma, fecha de la orden...). */
    target: ReviewTarget | null;
}

export function resolveReviewTarget(
    item: StudyOrderReviewItem,
    options: StudyOrderFormOptions | null,
): ResolvedReviewTarget {
    const sections = options?.sections ?? [];
    const hasSection = (code: string | null | undefined): code is string =>
        !!code && sections.some((s) => s.code === code);
    const sectionOfService = (serviceId: string) =>
        sections.find((s) => s.services.some((service) => service.id === serviceId))?.code;
    const field = item.field ?? '';

    if (field.startsWith('items.')) {
        // El estudio, por la sección que trae el punto o por el nombre que figura en la etiqueta.
        const name = (item.label ?? '').replace(/^Estudio:\s*/, '').trim().toLowerCase();
        const candidates = sections
            .filter((s) => !item.section_code || s.code === item.section_code)
            .flatMap((s) => s.services.map((service) => ({ section: s.code, service })));
        const match = candidates.find((c) => c.service.name.trim().toLowerCase() === name);
        if (match) return { step: match.section, target: { kind: 'service', section: match.section, service: match.service } };
        return { step: hasSection(item.section_code) ? item.section_code : PATIENT_STEP, target: null };
    }
    if (field.startsWith('modifiers.')) {
        const code = field.slice('modifiers.'.length);
        const option = (options?.modifiers ?? []).find((o) => o.code === code
            && (!item.section_code || o.section_code === item.section_code
                || (o.service_id && sectionOfService(o.service_id) === item.section_code))) ?? null;
        const section = item.section_code
            || option?.section_code
            || (option?.service_id ? sectionOfService(option.service_id) : undefined);
        if (hasSection(section)) return { step: section, target: { kind: 'option', section, code, option } };
        return { step: PATIENT_STEP, target: null };
    }
    if (field.startsWith('regions.')) {
        const section = item.section_code || field.split('.')[1];
        if (hasSection(section)) return { step: section, target: { kind: 'teeth', section } };
        return { step: PATIENT_STEP, target: null };
    }
    if (field.startsWith('texts.')) {
        const code = field.slice('texts.'.length);
        const option = (options?.texts ?? []).find((o) => o.code === code) ?? null;
        const section = item.section_code || option?.section_code;
        if (hasSection(section)) return { step: section, target: { kind: 'text', section, code, option } };
        return { step: PATIENT_STEP, target: null };
    }
    const patientField: ReviewPatientField | null =
        field === 'patient.name' ? 'name'
            : field === 'patient.document' ? 'document'
                : field === 'patient.phone' ? 'phone'
                    : field.startsWith('doctor.') ? 'doctor'
                        : field.startsWith('delivery_methods.') ? 'delivery'
                            : null;
    return { step: PATIENT_STEP, target: patientField ? { kind: 'patient', field: patientField } : null };
}

export function resolveReviewTargets(
    items: StudyOrderReviewItem[] | null | undefined,
    options: StudyOrderFormOptions | null,
): ReviewTargets {
    const targets: ReviewTargets = {
        byStep: new Map(), services: new Map(), options: new Map(),
        texts: new Map(), teeth: new Map(), patientFields: new Map(),
    };
    for (const item of items ?? []) {
        if (item.status !== 'pending') continue;
        const { step, target } = resolveReviewTarget(item, options);
        switch (target?.kind) {
            case 'service': push(targets.services, target.service.id, item); break;
            case 'option': push(targets.options, optionTargetKey(target.section, target.code), item); break;
            case 'teeth': push(targets.teeth, target.section, item); break;
            case 'text': push(targets.texts, target.code, item); break;
            case 'patient': push(targets.patientFields, target.field, item); break;
        }
        push(targets.byStep, step, item);
    }
    return targets;
}
