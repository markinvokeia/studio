
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function ExecutionHistoryPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Execution History</CardTitle>
        <CardDescription>View log of scheduler runs.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Execution history log will be implemented here.</p>
      </CardContent>
    </Card>
  );
}
