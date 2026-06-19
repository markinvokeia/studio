export type WhatsappTemplateType =
  | 'whatsapp_patient_general'
  | 'whatsapp_alert_followup'
  | 'whatsapp_treatment_interrupted';

export const WHATSAPP_CODE_MAP: Record<WhatsappTemplateType, string> = {
  whatsapp_patient_general:      'PATIENT_GENERAL_WHATSAPP',
  whatsapp_alert_followup:       'ALERT_FOLLOWUP_WHATSAPP',
  whatsapp_treatment_interrupted: 'TREATMENT_INTERRUPTED_WHATSAPP',
};

export const WHATSAPP_TEMPLATE_DEFAULTS: Record<WhatsappTemplateType, string> = {
  whatsapp_patient_general: [
    'Hola {{patient_name}}, te contactamos desde *{{clinic_name}}*.',
    '',
    'Consultas: {{clinic_phone}}',
  ].join('\n'),
  whatsapp_alert_followup: [
    'Hola {{patient_name}}, nos comunicamos desde *{{clinic_name}}* en relación a: *{{alert_title}}*.',
    '',
    '{{alert_summary}}',
    '',
    'Consultas: {{clinic_phone}}',
  ].join('\n'),
  whatsapp_treatment_interrupted: [
    'Hola {{patient_name}}, te contactamos desde *{{clinic_name}}*.',
    '',
    'Notamos que tu tratamiento *{{service_name}}* quedó interrumpido — el paso "{{missed_step}}" estaba agendado para el {{missed_date}} y no pudimos completarlo.',
    '',
    'Nos gustaría reprogramarlo cuando te sea posible. Contactanos:',
    '{{clinic_phone}}',
  ].join('\n'),
};
