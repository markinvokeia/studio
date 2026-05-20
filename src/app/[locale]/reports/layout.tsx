import type { ReactNode } from 'react';

export default function ReportsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-4 md:p-6">
        {children}
      </div>
    </div>
  );
}
