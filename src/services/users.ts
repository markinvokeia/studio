import { API_ROUTES } from '@/constants/routes';
import api, { type ApiRequestOptions } from '@/services/api';

export function extractCreatedUserId(response: unknown): string | null {
  const responseRecord = response as {
    data?: { id?: string | number };
    id?: string | number;
    user_id?: string | number;
  } | null;
  const firstArrayItem = Array.isArray(response)
    ? (response[0] as { data?: { id?: string | number } } | undefined)
    : undefined;
  const userId =
    firstArrayItem?.data?.id ??
    responseRecord?.data?.id ??
    responseRecord?.id ??
    responseRecord?.user_id;

  return userId === undefined || userId === null ? null : String(userId);
}

export async function sendFirstTimePasswordToken(userId: string, options?: ApiRequestOptions): Promise<void> {
  await api.post(API_ROUTES.SYSTEM.API_AUTH_FIRST_TIME_PASSWORD_TOKEN, { user_id: userId }, undefined, undefined, options);
}
