
'use client';

import * as React from 'react';
import { DollarSign } from 'lucide-react';
import { Skeleton } from './ui/skeleton';

// Mock data, as we cannot fetch from external URL directly.
const MOCK_EXCHANGE_RATE = {
  buy: 38.90,
  sell: 41.30,
};

export function ExchangeRate() {
  const [rate, setRate] = React.useState<{ buy: number, sell: number } | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    // In a real implementation, you would fetch this data from a backend endpoint
    // that scrapes the BROU website.
    const timer = setTimeout(() => {
      setRate(MOCK_EXCHANGE_RATE);
      setIsLoading(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-10 w-auto items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium">
        <DollarSign className="h-5 w-5 text-muted-foreground" />
        <Skeleton className="h-4 w-12" />
        <span className="text-muted-foreground">/</span>
        <Skeleton className="h-4 w-12" />
      </div>
    );
  }

  if (!rate) {
    return null;
  }

  return (
    <div className="flex h-10 w-auto items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium">
      <DollarSign className="h-5 w-5 text-muted-foreground" />
      <div className="flex items-baseline">
        <span className="text-xs text-muted-foreground mr-1">C:</span>
        <span className="font-semibold">{rate.buy.toFixed(2)}</span>
      </div>
      <span className="text-muted-foreground">/</span>
      <div className="flex items-baseline">
        <span className="text-xs text-muted-foreground mr-1">V:</span>
        <span className="font-semibold">{rate.sell.toFixed(2)}</span>
      </div>
    </div>
  );
}
