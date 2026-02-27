'use client';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import Image from 'next/image';
import * as React from 'react';

interface ExchangeRateData {
  buy: number;
  sell: number;
}

interface ExchangeRateProps {
  activeCashSession?: any;
  onRateChange?: (rates: ExchangeRateData) => void;
}

export function ExchangeRate({ activeCashSession, onRateChange }: ExchangeRateProps) {
  const rate = React.useMemo(() => {
    if (!activeCashSession || !activeCashSession.data?.opening_details?.date_rate) return null;
    return activeCashSession.data.opening_details.date_rate;
  }, [activeCashSession]);

  React.useEffect(() => {
    if (rate && onRateChange) {
      onRateChange({ buy: rate, sell: rate });
    }
  }, [rate, onRateChange]);

  if (!rate) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex h-10 w-auto items-center justify-center gap-2 rounded-md border border-primary-foreground/20 bg-primary-foreground/10 px-3 text-sm font-medium text-primary-foreground">
            <Image src="https://www.brou.com.uy/brou-tmf-portlet/images/USD.png" width={20} height={20} alt="USD Flag" />
            <div className="flex items-baseline">
              <span className="font-semibold">{rate.toFixed(2)}</span>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Session exchange rate</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
