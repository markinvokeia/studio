'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status: string;
}

export function StatusBadge({ status, className, ...props }: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase();

  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'confirmado':
      case 'pagado':
      case 'facturado':
      case 'completado':
      case 'accepted':
      case 'confirmed':
      case 'paid':
      case 'invoiced':
      case 'completed':
        return 'bg-green-100 text-green-700 border-transparent';
      
      case 'rechazado':
      case 'impago':
      case 'no pagado':
      case 'rejected':
      case 'unpaid':
      case 'no_pagado':
      case 'debt':
        return 'bg-red-100 text-red-700 border-transparent';
      
      case 'pendiente':
      case 'contabilizado':
      case 'pending':
      case 'recorded':
      case 'processing':
        return 'bg-purple-100 text-purple-700 border-transparent';
      
      case 'borrador':
      case 'sin facturar':
      case 'draft':
      case 'not invoiced':
      case 'not_invoiced':
        return 'bg-gray-100 text-gray-600 border-gray-300 border';
      
      default:
        return 'bg-gray-100 text-gray-600 border-transparent';
    }
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        getStatusStyles(normalizedStatus),
        className
      )}
      {...props}
    >
      {status}
    </div>
  );
}
