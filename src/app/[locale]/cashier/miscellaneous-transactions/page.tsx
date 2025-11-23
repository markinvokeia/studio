'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useTranslations } from 'next-intl';

export default function MiscellaneousTransactionsPage() {
  const t = useTranslations('Navigation');
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('MiscellaneousTransactions')}</CardTitle>
        <CardDescription>
          Manage your miscellaneous income and expenses here.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p>This page is under construction.</p>
      </CardContent>
    </Card>
  );
}
