'use client';

import { PrintReportHeader } from '@/components/reports/print-report-header';

interface PrintDocumentLayoutProps {
  children: React.ReactNode;
}

export function PrintDocumentLayout({ children }: PrintDocumentLayoutProps) {
  return (
    <div className="print-template-root font-sans text-gray-900">
      <PrintReportHeader />
      <div className="print-template-body">{children}</div>
    </div>
  );
}
