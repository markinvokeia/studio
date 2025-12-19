'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useTranslations } from 'next-intl';

export default function CommunicationHistoryPage() {
  const t = useTranslations('CommunicationHistoryPage');

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
