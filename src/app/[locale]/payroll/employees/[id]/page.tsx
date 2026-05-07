import { LegajoTabs } from '@/components/payroll/LegajoTabs';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PayrollEmployeeLegajoPage({ params }: Props) {
  const { id } = await params;
  return <LegajoTabs employeeId={id} />;
}
