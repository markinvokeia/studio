import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';

const E164_REGEX = /^\+[1-9]\d{7,14}$/;

export function toE164(phone: string): string | null {
  const trimmed = phone.trim().replace(/[\s()-]/g, '');
  const candidate = trimmed.startsWith('+') ? trimmed : `+${trimmed.replace(/\D/g, '')}`;
  return E164_REGEX.test(candidate) ? candidate : null;
}

export interface SendWhatsAppTemplatePayload {
  phone: string;
  meta_template_name: string;
  meta_language: string;
  parameters: string[];
  alert_instance_id?: number;
  performed_by?: string;
}

export type SendWhatsAppTemplateResult =
  | { success: true; messageId: string | null }
  | { success: false; code: number; message: string };

export async function sendWhatsAppTemplate(payload: SendWhatsAppTemplatePayload): Promise<SendWhatsAppTemplateResult> {
  try {
    const response = await api.post(API_ROUTES.WHATSAPP.SEND, payload);
    return { success: true, messageId: response?.message_id ?? null };
  } catch (error: any) {
    const code = error?.status ?? 500;
    const message = error?.data?.message || error?.message || 'Failed to send WhatsApp message';
    return { success: false, code, message };
  }
}
