
'use client';

import * as React from 'react';
import Image from 'next/image';
import { Skeleton } from './ui/skeleton';

interface ExchangeRateData {
  buy: number;
  sell: number;
}

// Mock data, as we cannot fetch from external URL directly.
const MOCK_EXCHANGE_RATE: ExchangeRateData = {
  buy: 38.90,
  sell: 41.30,
};

interface ExchangeRateProps {
  onRateChange?: (rates: ExchangeRateData) => void;
}

export function ExchangeRate({ onRateChange }: ExchangeRateProps) {
  const [rate, setRate] = React.useState<ExchangeRateData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    // In a real implementation, you would fetch this data from a backend endpoint
    // that scrapes the BROU website.
    const timer = setTimeout(() => {
      setRate(MOCK_EXCHANGE_RATE);
      if (onRateChange) {
        onRateChange(MOCK_EXCHANGE_RATE);
      }
      setIsLoading(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, [onRateChange]);

  if (isLoading) {
    return (
      <div className="flex h-10 w-auto items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium">
        <Skeleton className="h-5 w-5 rounded-full" />
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
      <Image src="https://www.brou.com.uy/brou-tmf-portlet/images/USD.png" width={20} height={20} alt="USD Flag" />
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
