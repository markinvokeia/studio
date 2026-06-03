'use client';

import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLicenseStore } from '@/stores/license-store';

export function LicenseInitializer() {
  const { user } = useAuth();
  const fetchAndLoadLicense = useLicenseStore(s => s.fetchAndLoadLicense);

  useEffect(() => {
    if (user) fetchAndLoadLicense();
  }, [user, fetchAndLoadLicense]);

  return null;
}
