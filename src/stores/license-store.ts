import { create } from 'zustand';
import type { CreateLicenseInput, LicensePayload } from '@/lib/types';
import { decryptLicense, encryptLicense } from '@/lib/license-crypto';
import api from '@/services/api';
import { API_ROUTES } from '@/constants/routes';

const RUNTIME_KEY = process.env.NEXT_PUBLIC_LICENSE_KEY ?? '';
const WARN_DAYS = 5;
const LS_KEY = 'license_key';

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

interface LicenseStore {
  licenseKey: string | null;
  license: LicensePayload | null;
  isValid: boolean;
  isExpired: boolean;
  isExpiringSoon: boolean;
  daysLeft: number;
  isLoading: boolean;

  loadLicense: (key: string, decryptionKeyOverride?: string) => Promise<boolean>;
  fetchAndLoadLicense: () => Promise<void>;
  generateLicense: (input: CreateLicenseInput, masterKey: string) => Promise<string>;
  verifyLicenseIntegrity: (key: string, masterKey: string) => Promise<boolean>;
  clearLicense: () => void;

  canAddUserByRole: (
    role: 'doctor' | 'receptionist' | 'admin' | 'super_admin',
    currentCount: number,
  ) => boolean;
  canAddMonthlyPatient: (currentMonthlyCount: number) => boolean;
  hasAIAccess: (userRole?: string) => boolean;
}

export const useLicenseStore = create<LicenseStore>((set, get) => ({
  licenseKey: null,
  license: null,
  isValid: false,
  isExpired: false,
  isExpiringSoon: false,
  daysLeft: 0,
  isLoading: false,

  loadLicense: async (key: string, decryptionKeyOverride?: string): Promise<boolean> => {
    const keyToUse = decryptionKeyOverride ?? RUNTIME_KEY;
    if (!key || !keyToUse) return false;
    try {
      const payload = await decryptLicense(key, keyToUse);
      const days = daysUntil(payload.endDate);
      const expired = days <= 0;
      set({
        licenseKey: key,
        license: payload,
        isValid: !expired,
        isExpired: expired,
        isExpiringSoon: !expired && days <= WARN_DAYS,
        daysLeft: expired ? 0 : days,
      });
      localStorage.setItem(LS_KEY, key);
      return !expired;
    } catch {
      set({ licenseKey: null, license: null, isValid: false, isExpired: false, isExpiringSoon: false });
      return false;
    }
  },

  fetchAndLoadLicense: async (): Promise<void> => {
    set({ isLoading: true });
    try {
      const data = await api.get(API_ROUTES.LICENSE.GET);
      const backendKey: string | null = data?.license_key ?? null;
      if (backendKey) {
        await get().loadLicense(backendKey);
        return;
      }
    } catch {
      // backend unavailable, try localStorage
    } finally {
      // check localStorage regardless if backend returned nothing
      const { licenseKey } = get();
      if (!licenseKey) {
        const localKey = localStorage.getItem(LS_KEY);
        if (localKey) await get().loadLicense(localKey);
      }
      set({ isLoading: false });
    }
  },

  generateLicense: async (input: CreateLicenseInput, masterKey: string): Promise<string> => {
    const payload: LicensePayload = {
      ...input,
      licenseId: crypto.randomUUID(),
      version: 1,
      issuedAt: new Date().toISOString(),
    };
    return encryptLicense(payload, masterKey);
  },

  verifyLicenseIntegrity: async (key: string, masterKey: string): Promise<boolean> => {
    try {
      await decryptLicense(key, masterKey);
      return true;
    } catch {
      return false;
    }
  },

  clearLicense: () => {
    localStorage.removeItem(LS_KEY);
    set({ licenseKey: null, license: null, isValid: false, isExpired: false, isExpiringSoon: false, daysLeft: 0 });
  },

  canAddUserByRole: (role, currentCount) => {
    const { license } = get();
    if (!license) return false;
    const maxMap: Record<string, number> = {
      doctor: license.maxDoctors,
      receptionist: license.maxReceptionists,
      admin: license.maxAdmins,
      super_admin: license.maxSuperAdmins,
    };
    return currentCount < (maxMap[role] ?? 0);
  },

  canAddMonthlyPatient: (currentMonthlyCount: number) => {
    const { license } = get();
    return !!license && currentMonthlyCount < license.maxMonthlyNewPatients;
  },

  hasAIAccess: (userRole?: string) => {
    const { license } = get();
    if (!license || license.aiAccess === 'none') return false;
    if (license.aiAccess === 'full') return true;
    return (
      license.aiAccess === 'doctors_only' &&
      !!userRole &&
      ['doctor', 'medico'].includes(userRole.toLowerCase())
    );
  },
}));
