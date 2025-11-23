
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useTranslations } from 'next-intl';

export default function MiscellaneousCategoriesPage() {
  const t = useTranslations('Navigation');
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('MiscellaneousCategories')}</CardTitle>
        <CardDescription>
          Manage the categories for your miscellaneous transactions.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p>Content for miscellaneous categories will go here.</p>
      </CardContent>
    </Card>
  );
}
