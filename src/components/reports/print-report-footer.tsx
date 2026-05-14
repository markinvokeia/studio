'use client';

import { format } from 'date-fns';

interface PrintReportFooterProps {
  generatedAt?: Date | null;
}

export function PrintReportFooter({ generatedAt }: PrintReportFooterProps) {
  const ts = generatedAt ?? null;

  return (
    <div className="hidden print:flex items-center justify-between mt-10 pt-3 border-t border-gray-300 text-[10px] text-gray-400">
      <span>© {new Date().getFullYear()} InvokeIA · www.invokeia.com</span>
      {ts && (
        <span>Generado: {format(ts, 'dd/MM/yyyy HH:mm')}</span>
      )}
    </div>
  );
}
