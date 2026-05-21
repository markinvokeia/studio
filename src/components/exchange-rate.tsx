'use client';

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

  if (!rate) return null;

  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl h-10 w-10 bg-[hsl(var(--exchange-rate-text))]/10 select-none cursor-default"
      title={`Tipo de cambio: USD ${rate.toFixed(2)}`}
    >
      <span className="text-[8px] font-bold leading-none text-[hsl(var(--exchange-rate-text))] uppercase tracking-wide">
        USD
      </span>
      <span className="text-[10px] font-bold leading-none text-[hsl(var(--exchange-rate-text))] mt-0.5">
        {rate.toFixed(2)}
      </span>
    </div>
  );
}
