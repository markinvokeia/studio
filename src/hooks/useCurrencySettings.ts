'use client';

import { useMemo } from 'react';

import { AUTO_RATE_PAIR, type CurrencyDef, getCurrency, normalizeCurrencyCode } from '@/constants/currencies';
import { useClinicCurrencies } from '@/stores/clinic-info-store';

export interface CurrencySettings {
  /** Moneda de trabajo principal. Código ISO de 3 letras. */
  code: string;
  /** Definición completa (símbolo, decimales, locale, denominaciones). */
  def: CurrencyDef;
  /** Segunda moneda configurada, o `undefined` si la clínica opera con una. */
  secondaryCode?: string;
  /**
   * La clínica opera con dos monedas. Se deriva de que haya una secundaria
   * configurada en Datos de la Clínica — no de que la moneda sea una concreta.
   */
  isDual: boolean;
  /** Monedas que la UI ofrece al crear un registro nuevo. */
  options: string[];
  /**
   * Monedas a ofrecer al **editar** un registro existente. Si el registro se
   * guardó en una moneda con la que la clínica ya no opera, se incluye de
   * todas formas: si no, el Select no podría representar su valor y al guardar
   * se le cambiaría la moneda a la factura en silencio.
   */
  optionsFor: (saved?: string | null) => string[];
  /** Mostrar el widget de cotización y los campos de conversión. */
  showExchangeRate: boolean;
  /**
   * El par configurado es UYU/USD, el único con feed automático de cotización
   * (BROU). Con cualquier otro par el tipo de cambio se carga a mano.
   */
  hasAutoRate: boolean;
}

/**
 * Única puerta de entrada de la UI a las monedas de la clínica. Nunca dispara
 * una petición: lee los valores que `ClinicPreferencesInitializer` dejó en el
 * store tras el login.
 */
export function useCurrencySettings(): CurrencySettings {
  const { code, secondaryCode } = useClinicCurrencies();

  return useMemo(() => {
    // Una secundaria igual a la principal es una configuración sin sentido:
    // se ignora en vez de ofrecer la misma moneda dos veces en el desplegable.
    const secondary = secondaryCode && secondaryCode !== code ? secondaryCode : undefined;
    const isDual = !!secondary;
    const options = isDual ? [code, secondary] : [code];

    return {
      code,
      def: getCurrency(code),
      secondaryCode: secondary,
      isDual,
      options,
      optionsFor: (saved?: string | null) => {
        const normalized = normalizeCurrencyCode(saved);
        if (!normalized || options.includes(normalized)) return options;
        return [...options, normalized];
      },
      showExchangeRate: isDual,
      hasAutoRate:
        isDual
        && ((code === AUTO_RATE_PAIR.base && secondary === AUTO_RATE_PAIR.quote)
          || (code === AUTO_RATE_PAIR.quote && secondary === AUTO_RATE_PAIR.base)),
    };
  }, [code, secondaryCode]);
}
