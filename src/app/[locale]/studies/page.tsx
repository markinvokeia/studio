
'use client';

import { Card, CardContent } from '@/components/ui/card';

export default function StudiesPage() {
  return (
    <Card className="h-[calc(100vh-10rem)] w-full overflow-hidden">
      <CardContent className="h-full w-full p-0">
        <iframe
          src="https://viewer.invokeia.com/"
          className="h-full w-full border-0"
          title="DICOM Viewer"
          allowFullScreen
        ></iframe>
      </CardContent>
    </Card>
  );
}
