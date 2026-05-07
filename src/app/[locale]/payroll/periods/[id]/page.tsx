'use client';

import { PeriodDetail } from '@/components/payroll/PeriodDetail';
import { use } from 'react';

export default function PeriodDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <PeriodDetail periodId={id} />;
}
