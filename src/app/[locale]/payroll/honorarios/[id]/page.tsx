import { HonorariosDetail } from '@/components/payroll/HonorariosDetail';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PayrollHonorariosDetailPage({ params }: Props) {
  const { id } = await params;
  return <HonorariosDetail id={id} />;
}
