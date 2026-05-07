'use client';

import { HonorariosDetail } from '@/components/payroll/HonorariosDetail';
import { Skeleton } from '@/components/ui/skeleton';
import type { PayrollHonorario } from '@/lib/types';
import api from '@/services/api';
import { API_ROUTES } from '@/constants/routes';
import { use, useEffect, useState } from 'react';

interface Props {
  params: Promise<{ id: string }>;
}

export default function PayrollHonorariosDetailPage({ params }: Props) {
  const { id } = use(params);
  const [honorario, setHonorario] = useState<PayrollHonorario | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(API_ROUTES.PAYROLL.HONORARIOS, { id })
      .then((data) => setHonorario((data as { honorario?: PayrollHonorario })?.honorario ?? (data as PayrollHonorario)))
      .catch(() => setHonorario(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-6"><Skeleton className="h-64 w-full" /></div>;
  if (!honorario) return <div className="p-6 text-muted-foreground">No encontrado.</div>;
  return <HonorariosDetail honorario={honorario} />;
}
