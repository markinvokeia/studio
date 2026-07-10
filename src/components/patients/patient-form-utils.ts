import { isValidPhoneNumber } from 'libphonenumber-js';
import * as z from 'zod';

import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import type { MutualSociety, User } from '@/lib/types';

// ── Patient form schema ──────────────────────────────────────────────────────
export const userFormSchema = (t: (key: string) => string) => z.object({
  id: z.string().optional(),
  name: z.string().min(1, { message: t('UsersPage.createDialog.validation.nameRequired') }),
  email: z.string().optional().refine((val) => {
    if (!val || val.trim() === '') return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  }, { message: t('UsersPage.createDialog.validation.emailInvalid') }),
  phone: z.string().optional().refine((val) => {
    if (!val || val.trim() === '') return true;
    return isValidPhoneNumber(val);
  }, { message: t('UsersPage.createDialog.validation.phoneInvalid') }),
  identity_document: z.string()
    .regex(/^\d*$/, { message: t('UsersPage.createDialog.validation.identityInvalid') })
    .max(10, { message: t('UsersPage.createDialog.validation.identityMaxLength') }),
  birth_date: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  is_active: z.boolean().default(false),
  mutual_society_id: z.string().optional(),
  is_dependent: z.boolean().default(false),
  responsible_contact_id: z.string().nullable().optional(),
  doctor_id: z.string().nullable().optional(),
  sex: z.enum(['male', 'female']).nullable().optional(),
}).refine((data) => {
  if (data.is_dependent) return true;
  const hasEmail = data.email && data.email.trim() !== '';
  const hasPhone = data.phone && data.phone.trim() !== '';
  return hasEmail || hasPhone;
}, {
  message: t('UsersPage.createDialog.validation.emailOrPhoneRequired'),
  path: ['email'],
});

export type UserFormValues = z.infer<ReturnType<typeof userFormSchema>>;

export type DependantContactInfo = {
  id: string;
  name: string;
  address?: string | null;
  email?: string | null;
  phone_number?: string | null;
};

// ── Data helpers ─────────────────────────────────────────────────────────────
export async function upsertUser(userData: UserFormValues) {
  const payload = {
    ...userData,
    mutual_society_id: userData.mutual_society_id && userData.mutual_society_id !== 'none'
      ? userData.mutual_society_id
      : null,
    responsible_contact_id: userData.responsible_contact_id || null,
    doctor_id: userData.doctor_id || null,
    sex: userData.sex || null,
    filter_type: 'PACIENTE',
    is_sales: true,
  };
  const responseData = await api.post(API_ROUTES.USERS_UPSERT, payload);

  if (responseData.error && (responseData.error.error || responseData.code > 200)) {
    const error = new Error('API Error') as any;
    error.status = responseData.code || 500;
    error.data = responseData;
    throw error;
  }

  return responseData;
}

export async function getDependantContactInfo(userId: string): Promise<DependantContactInfo | null> {
  try {
    const responseData = await api.get(API_ROUTES.USER_DEPENDANT, { user_id: userId });

    let dependantData: any[] = [];
    if (Array.isArray(responseData)) {
      dependantData = responseData;
    } else if (responseData?.data && Array.isArray(responseData.data)) {
      dependantData = responseData.data;
    }

    const dependant = dependantData[0];
    if (!dependant) return null;

    return {
      id: String(dependant.id),
      name: dependant.name || '',
      address: dependant.address ?? null,
      email: dependant.email ?? null,
      phone_number: dependant.phone_number ?? null,
    };
  } catch (error) {
    console.error('Failed to fetch dependant contact info:', error);
    return null;
  }
}

export async function getMutualSocietiesList(): Promise<MutualSociety[]> {
  try {
    const data = await api.get(API_ROUTES.MUTUAL_SOCIETIES, { page: '1', limit: '1000' });

    let mutualSocietiesData: any[] = [];
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && 'id' in data[0] && !('json' in data[0])) {
      mutualSocietiesData = data;
    } else if (Array.isArray(data) && data.length > 0) {
      const firstElement = data[0];
      if (firstElement.json && typeof firstElement.json === 'object') {
        mutualSocietiesData = firstElement.json.data || [];
      } else if (firstElement.data) {
        mutualSocietiesData = firstElement.data;
      }
    } else if (typeof data === 'object' && data !== null) {
      const responseObj = data[0]?.json || data;
      mutualSocietiesData = responseObj.data || [];
    }

    return mutualSocietiesData.map((ms: any) => ({
      id: ms.id,
      name: ms.name,
      description: ms.description,
      code: ms.code,
      is_active: ms.is_active ?? true,
      created_at: ms.created_at,
      updated_at: ms.updated_at,
    })).filter((ms: MutualSociety) => ms.id !== undefined && ms.id !== null && ms.is_active);
  } catch (error) {
    console.error('Failed to fetch mutual societies:', error);
    return [];
  }
}

// Maps a user from the FILTER_USERS / USERS search response into a partial User.
function mapSearchUser(apiUser: any): User {
  return {
    id: String(apiUser.user_id ?? apiUser.id ?? ''),
    name: apiUser.name || '',
    email: apiUser.email || '',
    phone_number: apiUser.phone_number || '',
    is_active: apiUser.is_active ?? true,
    avatar: '',
    identity_document: apiUser.identity_document || '',
    birth_date: apiUser.birth_date || '',
    address: apiUser.address || '',
    notes: apiUser.notes || '',
    mutual_society_id: apiUser.mutual_society_id ?? undefined,
    mutual_society_name: apiUser.mutual_society_name ?? undefined,
    is_dependent: apiUser.is_dependent ?? false,
    responsible_contact_id: apiUser.responsible_contact_id || undefined,
    responsible_contact_name: apiUser.responsible_contact_name || undefined,
    doctor_id: apiUser.doctor_id ? String(apiUser.doctor_id) : null,
    doctor_name: apiUser.doctor_name || undefined,
    sex: apiUser.sex ?? null,
  };
}

/** Fetches a single patient's full record by id (used to prefill the form). */
export async function fetchPatientById(userId: string): Promise<User | null> {
  try {
    const data = await api.get(API_ROUTES.FILTER_USERS, { search: userId });
    const usersData = (Array.isArray(data) && data.length > 0) ? (data[0].data ?? data[0].json?.data ?? []) : (data?.data ?? []);
    const match = usersData.find((u: any) => String(u.user_id ?? u.id) === String(userId)) ?? usersData[0];
    return match ? mapSearchUser(match) : null;
  } catch (error) {
    console.error('Failed to fetch patient:', error);
    return null;
  }
}

/** Searches potential guardian patients (non-dependents) for the responsible-contact picker. */
export async function searchGuardianPatients(searchQuery: string, currentUserId?: string): Promise<User[]> {
  try {
    const responseData = await api.get(API_ROUTES.USERS, { search: searchQuery, filter_type: 'PACIENTE' });
    let usersData: any[] = [];
    if (Array.isArray(responseData) && responseData.length > 0) {
      const first = responseData[0];
      usersData = first.json?.data || first.data || [];
    } else if (responseData?.data) {
      usersData = responseData.data;
    }
    return usersData.map(mapSearchUser).filter((u: User) => u.id !== currentUserId && !u.is_dependent);
  } catch (error) {
    console.error('Failed to search guardian patients:', error);
    return [];
  }
}
