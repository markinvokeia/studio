'use client';

import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';

export interface EmailPreferenceResult {
  email: string;
  hasChannelEnabled: boolean;
}

export async function checkPreferencesByEmails(
  emails: string[],
  channel: string = 'email',
  category: string = 'billing'
): Promise<EmailPreferenceResult[]> {
  if (emails.length === 0) {
    return [];
  }

  try {
    const response = await api.get(
      API_ROUTES.SYSTEM.USER_COMMUNICATION_PREFERENCES_BY_EMAIL,
      {
        emails: emails.join(','),
        channel,
        category,
      }
    );

    if (Array.isArray(response)) {
      return response.map((item: { email: string; can_send_notification: boolean }) => ({
        email: item.email,
        hasChannelEnabled: item.can_send_notification,
      }));
    }

    return emails.map((email) => ({ email, hasChannelEnabled: true }));
  } catch (error) {
    console.error('Failed to check preferences by emails:', error);
    return emails.map((email) => ({ email, hasChannelEnabled: true }));
  }
}

export async function checkPreferencesByUserId(
  userId: string,
  channel: string = 'email',
  category: string = 'billing'
): Promise<boolean> {
  if (!userId) {
    return true;
  }

  try {
    const response = await api.get(
      API_ROUTES.SYSTEM.USER_COMMUNICATION_PREFERENCES_BY_ID,
      {
        user_id: userId,
        channel,
        category,
      }
    );

    if (Array.isArray(response) && response.length > 0) {
      return response[0].can_send_notification === true;
    }

    if (response && typeof response.can_send_notification === 'boolean') {
      return response.can_send_notification;
    }

    return true;
  } catch (error) {
    console.error('Failed to check preferences by user id:', error);
    return true;
  }
}

export function getDisabledEmails(
  preferences: EmailPreferenceResult[]
): string[] {
  return preferences
    .filter((pref) => !pref.hasChannelEnabled)
    .map((pref) => pref.email);
}
