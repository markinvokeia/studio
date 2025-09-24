
'use client';

import { Card, CardContent } from '@/components/ui/card';

export default function SharedStudiesPage() {
  return (
    <Card className="h-[calc(100vh-10rem)] w-full overflow-hidden">
      <CardContent className="h-full w-full p-0">
        <iframe
          src="https://viewer.invokeia.com/local"
          className="h-full w-full border-0"
          title="DICOM Viewer Local"
          allowFullScreen
        ></iframe>
      </CardContent>
    </Card>
  );
}
