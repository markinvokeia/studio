'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function OldPrintTemplatesPage() {
  const router = useRouter();
  useEffect(() => { router.replace('../templates'); }, [router]);
  return null;
}
