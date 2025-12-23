
'use client';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import Image from 'next/image';
import * as React from 'react';
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
        const data = await api.get(API_ROUTES.CASHIER.COTIZACIONES, { rendered: 'false' });
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

  const averageRate = React.useMemo(() => {
    if (!rate) return 0;
    return (rate.buy + rate.sell) / 2;
  }, [rate]);

  if (isLoading) {
    return (
      <div className="flex h-10 w-auto items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium">
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-4 w-12" />
      </div>
    );
  }

  if (!rate) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex h-10 w-auto items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium">
            <Image src="https://www.brou.com.uy/brou-tmf-portlet/images/USD.png" width={20} height={20} alt="USD Flag" />
            <div className="flex items-baseline">
              <span className="font-semibold">{averageRate.toFixed(2)}</span>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Average USD to UYU exchange rate</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
