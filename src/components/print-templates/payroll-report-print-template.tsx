'use client';

import type { PayrollReportPrintData } from '@/stores/print-document-store';

interface Props {
  data: PayrollReportPrintData;
}

export function PayrollReportPrintTemplate({ data }: Props) {
  const { title, subtitle, columns, rows } = data;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-4 pb-2 border-b border-gray-300">
        <h1 className="text-xl font-bold uppercase tracking-tight">{title}</h1>
        {subtitle && <span className="text-sm text-gray-600">{subtitle}</span>}
      </div>
      <table className="w-full text-[10px] border-collapse">
        <thead>
          <tr className="border-b-2 border-gray-400 text-left">
            {columns.map((c, i) => (
              <th key={i} className={i === 0 ? 'py-1 pr-2' : 'py-1 px-1 text-right'}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length} className="py-3 text-center text-gray-400">—</td></tr>
          ) : rows.map((r, ri) => (
            <tr key={ri} className="border-b border-gray-200">
              {r.map((v, ci) => (
                <td key={ci} className={ci === 0 ? 'py-1 pr-2' : 'py-1 px-1 text-right font-mono'}>{String(v)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
