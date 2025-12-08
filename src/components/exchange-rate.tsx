'use client';

import * as React from 'react';
import Image from 'next/image';
import { Skeleton } from './ui/skeleton';

interface ExchangeRateData {
  buy: number;
  sell: number;
}

interface ExchangeRateProps {
  onRateChange?: (rates: ExchangeRateData) => void;
}

export function ExchangeRate({ onRateChange }: ExchangeRateProps) {
  const [rate, setRate] = React.useState<ExchangeRateData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchRates = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/cotizaciones?rendered=false');
            if (!response.ok) {
                throw new Error('Failed to fetch exchange rates');
            }
            const data = await response.json();
            const rates = {
                buy: data.compra,
                sell: data.venta,
            };
            setRate(rates);
            if (onRateChange) {
                onRateChange(rates);
            }
        } catch (error) {
            console.error("Failed to fetch exchange rates:", error);
            setRate(null);
        } finally {
            setIsLoading(false);
        }
    };

    fetchRates();
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
