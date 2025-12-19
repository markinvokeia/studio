'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useTranslations } from 'next-intl';

export default function ExecutionHistoryPage() {
  const t = useTranslations('ExecutionHistoryPage');
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <p>{t('content')}</p>
      </CardContent>
    </Card>
  );
}
