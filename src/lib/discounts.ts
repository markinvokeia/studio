import type { DiscountMode, DiscountScope, DocumentDiscountFields, LineDiscountFields } from '@/lib/types';

/**
 * Aritmética de descuentos manuales. Único lugar donde vive esta cuenta: hasta
 * ahora cada formulario de presupuesto/factura calculaba `unit_price * quantity`
 * inline, y meter el descuento en cada uno por separado era la forma segura de
 * que se desincronizaran.
 *
 * INVARIANTES (las asume también el backend):
 *
 *   1. `total` de una línea es SIEMPRE el importe NETO, ya descontado. Los flujos
 *      n8n recalculan el total del documento como `SUM(items.total)`, así que si
 *      la línea no viajara neta el descuento se perdería en el siguiente guardado.
 *   2. `gross_total` es el bruto (`unit_price × quantity`). Existe para poder
 *      imprimir la línea a precio de lista.
 *   3. Un descuento sobre el total del documento se PRORRATEA entre las líneas
 *      antes de guardar (ver `prorateDocumentDiscount`). La cabecera conserva el
 *      valor tecleado sólo para mostrarlo e imprimirlo.
 */

/** Descuento tal como lo introduce el usuario: un modo y un valor. */
export interface DiscountInput {
  mode: DiscountMode | null | undefined;
  value: number | null | undefined;
}

/** Importes resultantes de aplicar un descuento sobre una base. */
export interface DiscountTotals {
  gross_total: number;
  discount_amount: number;
  total: number;
}

/**
 * Redondeo monetario del proyecto. El `Number.EPSILON` evita que 1.005 caiga a
 * 1.00 por la representación binaria; es el mismo criterio que ya usaban
 * `quote-financials.ts` y `patient-ledger.ts`.
 */
export function roundCurrency(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Bruto de una línea: precio unitario por cantidad. */
export function computeGrossTotal(unitPrice: number, quantity: number): number {
  return roundCurrency(Number(unitPrice || 0) * Number(quantity || 0));
}

/** `true` si el descuento introducido llega a mover el importe. */
export function hasDiscount(d: DiscountInput | null | undefined): boolean {
  return !!d && !!d.mode && Number(d.value || 0) > 0;
}

/**
 * Dinero descontado sobre `base`, acotado a `[0, base]`: un descuento nunca
 * puede dejar una línea en negativo, ni siquiera si alguien teclea un importe
 * fijo mayor que el precio.
 */
export function computeDiscountAmount(base: number, d: DiscountInput | null | undefined): number {
  if (!hasDiscount(d)) return 0;

  const safeBase = Math.max(0, Number(base || 0));
  const value = Number(d!.value || 0);
  const raw = d!.mode === 'percent' ? (safeBase * value) / 100 : value;

  return roundCurrency(Math.min(Math.max(raw, 0), safeBase));
}

/** Importes de una línea a partir de precio, cantidad y su descuento. */
export function computeLineTotals(
  unitPrice: number,
  quantity: number,
  d?: DiscountInput | null,
): DiscountTotals {
  const gross = computeGrossTotal(unitPrice, quantity);
  const discount = computeDiscountAmount(gross, d);
  return { gross_total: gross, discount_amount: discount, total: roundCurrency(gross - discount) };
}

/**
 * Campos que se persisten en una línea. Se pasa por acá antes de enviar al
 * backend para no repetir en cada formulario la decisión de qué mandar cuando
 * no hay descuento (NULL, no 0: así se distingue "sin descuento" de "0 %").
 */
export function buildLineDiscountFields(
  unitPrice: number,
  quantity: number,
  d?: DiscountInput | null,
): LineDiscountFields & { total: number } {
  const { gross_total, discount_amount, total } = computeLineTotals(unitPrice, quantity, d);

  if (!hasDiscount(d)) {
    return { gross_total, discount_mode: null, discount_value: null, discount_amount: null, total };
  }

  return {
    gross_total,
    discount_mode: d!.mode!,
    discount_value: roundCurrency(Number(d!.value || 0)),
    discount_amount,
    total,
  };
}

/**
 * Bruto de una línea ya guardada. Las filas anteriores a los descuentos tienen
 * `gross_total` a NULL, y ahí el bruto es el propio total.
 */
export function readGrossTotal(line: { gross_total?: number | null; total?: number | null }): number {
  const gross = Number(line.gross_total ?? NaN);
  return Number.isFinite(gross) ? gross : Number(line.total || 0);
}

/** Descuento efectivo de una línea ya guardada. */
export function readDiscountAmount(line: LineDiscountFields & { total?: number | null }): number {
  const amount = Number(line.discount_amount ?? NaN);
  return Number.isFinite(amount) ? amount : 0;
}

/**
 * Reparte un descuento de documento entre sus líneas, proporcional al bruto de
 * cada una.
 *
 * El residuo del redondeo va a la última línea con importe, de forma que
 * `SUM(total)` cuadre EXACTAMENTE con `bruto - descuento`. Sin ese ajuste el
 * backend recalcularía un total distinto al que se mostró e imprimió, con una
 * diferencia de céntimos imposible de explicar al paciente.
 */
export function prorateDocumentDiscount<T extends { gross_total: number }>(
  lines: T[],
  discountAmount: number,
): Array<T & { discount_amount: number; total: number }> {
  const grossSum = roundCurrency(lines.reduce((sum, l) => sum + Number(l.gross_total || 0), 0));
  const toShare = roundCurrency(Math.min(Math.max(Number(discountAmount || 0), 0), Math.max(grossSum, 0)));

  if (lines.length === 0) return [];

  if (toShare <= 0 || grossSum <= 0) {
    return lines.map((l) => ({ ...l, discount_amount: 0, total: roundCurrency(Number(l.gross_total || 0)) }));
  }

  // Índice de la última línea con importe: es la que absorbe el residuo. Una
  // línea a 0 no puede recibirlo sin quedar en negativo.
  let lastPaidIndex = -1;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (Number(lines[i].gross_total || 0) > 0) {
      lastPaidIndex = i;
      break;
    }
  }

  let assigned = 0;
  return lines.map((line, index) => {
    const gross = roundCurrency(Number(line.gross_total || 0));

    if (index === lastPaidIndex) {
      const remainder = roundCurrency(Math.min(Math.max(toShare - assigned, 0), gross));
      return { ...line, discount_amount: remainder, total: roundCurrency(gross - remainder) };
    }

    const share = gross > 0 ? roundCurrency(Math.min((toShare * gross) / grossSum, gross)) : 0;
    assigned = roundCurrency(assigned + share);
    return { ...line, discount_amount: share, total: roundCurrency(gross - share) };
  });
}

/**
 * Importes de la cabecera.
 *
 * - Con `d` (ámbito `'total'`): el descuento sale del valor tecleado sobre el bruto.
 * - Sin `d` (ámbito `'line'`): se agrega lo que ya traen las líneas.
 */
export function computeDocumentTotals(
  lines: Array<{ gross_total?: number | null; total?: number | null }>,
  d?: DiscountInput | null,
): DiscountTotals {
  const gross = roundCurrency(lines.reduce((sum, l) => sum + readGrossTotal(l), 0));

  if (hasDiscount(d)) {
    const discount = computeDiscountAmount(gross, d);
    return { gross_total: gross, discount_amount: discount, total: roundCurrency(gross - discount) };
  }

  const total = roundCurrency(lines.reduce((sum, l) => sum + Number(l.total ?? readGrossTotal(l)), 0));
  return { gross_total: gross, discount_amount: roundCurrency(gross - total), total };
}

/** Lo mínimo que necesita una línea para entrar en `buildDiscountedDocument`. */
export interface DiscountableLine {
  unit_price: number;
  quantity: number;
  discount_mode?: DiscountMode | null;
  discount_value?: number | null;
}

export interface BuildDiscountedDocumentOptions {
  /** `discounts_enabled` de la clínica. FALSE ⇒ no se persiste ningún descuento. */
  enabled: boolean;
  scope: DiscountScope;
  /** Descuento tecleado sobre el total. Se ignora con ámbito `'line'`. */
  documentDiscount?: DiscountInput | null;
}

/**
 * Traduce lo que hay en un formulario al payload que espera el backend, con los
 * tres casos resueltos en un solo sitio:
 *
 * - Descuentos apagados → sólo se rellena `gross_total`; todo lo demás va NULL.
 * - Ámbito `'line'`     → cada línea lleva su propio descuento y la cabecera agrega.
 * - Ámbito `'total'`    → el descuento se PRORRATEA entre las líneas (para que
 *   `SUM(items.total)` siga siendo el neto, que es lo que recalcula n8n) y la
 *   cabecera conserva el valor tecleado para poder imprimirlo.
 *
 * Lo usan todos los formularios de presupuesto y factura: es lo que evita que
 * cada pantalla invente su propia forma de guardar el descuento.
 */
export function buildDiscountedDocument<T extends DiscountableLine>(
  items: T[],
  { enabled, scope, documentDiscount }: BuildDiscountedDocumentOptions,
): {
  items: Array<Omit<T, 'discount_mode' | 'discount_value'> & LineDiscountFields & { total: number }>;
  document: DocumentDiscountFields & { gross_total: number; total: number };
} {
  const withGross = items.map((item) => ({
    ...item,
    gross_total: computeGrossTotal(item.unit_price, item.quantity),
  }));
  const grossTotal = roundCurrency(withGross.reduce((sum, i) => sum + i.gross_total, 0));

  // Sin descuentos habilitados el documento se guarda como siempre; `gross_total`
  // se rellena igual porque no cuesta nada y deja la fila coherente.
  if (!enabled) {
    return {
      items: withGross.map(({ discount_mode: _m, discount_value: _v, ...rest }) => ({
        ...rest,
        discount_mode: null,
        discount_value: null,
        discount_amount: null,
        total: rest.gross_total,
      })),
      document: {
        gross_total: grossTotal,
        discount_scope: null,
        discount_mode: null,
        discount_value: null,
        discount_amount: null,
        total: grossTotal,
      },
    };
  }

  if (scope === 'line') {
    const built = withGross.map(({ discount_mode, discount_value, ...rest }) => ({
      ...rest,
      ...buildLineDiscountFields(rest.unit_price, rest.quantity, { mode: discount_mode, value: discount_value }),
    }));
    const total = roundCurrency(built.reduce((sum, i) => sum + i.total, 0));
    return {
      items: built,
      document: {
        gross_total: grossTotal,
        discount_scope: 'line',
        // El descuento de cabecera con ámbito 'line' es informativo: la suma de
        // lo rebajado en las líneas. No hay un "valor tecleado" que guardar.
        discount_mode: null,
        discount_value: null,
        discount_amount: roundCurrency(grossTotal - total),
        total,
      },
    };
  }

  const discountAmount = computeDiscountAmount(grossTotal, documentDiscount);
  const prorated = prorateDocumentDiscount(withGross, discountAmount);
  const total = roundCurrency(prorated.reduce((sum, i) => sum + i.total, 0));

  return {
    items: prorated.map(({ discount_mode: _m, discount_value: _v, ...rest }) => ({
      ...rest,
      // El descuento vive en la cabecera; en la línea sólo queda su parte
      // prorrateada, sin modo ni valor propios.
      discount_mode: null,
      discount_value: null,
    })),
    document: {
      gross_total: grossTotal,
      discount_scope: 'total',
      discount_mode: hasDiscount(documentDiscount) ? documentDiscount!.mode! : null,
      discount_value: hasDiscount(documentDiscount) ? roundCurrency(Number(documentDiscount!.value)) : null,
      discount_amount: discountAmount > 0 ? discountAmount : null,
      total,
    },
  };
}

export interface DocumentDiscountView {
  /** `false` ⇒ el documento se imprime exactamente como antes de esta feature. */
  hasDiscount: boolean;
  /** Cómo se aplicó en ESTE documento. `null` ⇒ sin descuento. */
  scope: DiscountScope | null;
  /** Con ámbito `'line'` la tabla lleva una columna «Dto.» por línea. */
  showLineColumn: boolean;
  /** Importe a mostrar en cada línea: bruto con ámbito `'total'`, neto con `'line'`. */
  lineAmount: (line: LineDiscountFields & { total?: number | null }) => number;
  grossTotal: number;
  discountAmount: number;
  total: number;
}

/**
 * Resuelve cómo presentar los descuentos de un documento ya guardado (impresión
 * y vistas de solo lectura).
 *
 * El ámbito sale del propio documento, no de la preferencia vigente de la
 * clínica: un presupuesto impreso hoy tiene que verse como cuando se emitió,
 * aunque entretanto la clínica haya cambiado de política.
 *
 * - `'line'`  → cada línea muestra su importe neto y su descuento en una columna.
 * - `'total'` → las líneas se muestran a precio de lista y el descuento aparece
 *   una sola vez en el pie. Es lo que espera ver un paciente.
 */
export function buildDocumentDiscountView(
  document: DocumentDiscountFields & { total?: number | null },
  lines: Array<LineDiscountFields & { total?: number | null }>,
): DocumentDiscountView {
  const grossTotal = roundCurrency(lines.reduce((sum, l) => sum + readGrossTotal(l), 0));
  const netTotal = roundCurrency(lines.reduce((sum, l) => sum + Number(l.total ?? readGrossTotal(l)), 0));
  const lineDiscounts = roundCurrency(lines.reduce((sum, l) => sum + readDiscountAmount(l), 0));
  const headerDiscount = roundCurrency(Number(document.discount_amount ?? 0));

  // Documentos anteriores a los descuentos no traen `discount_scope`: se deduce
  // de dónde hay importe rebajado.
  const scope: DiscountScope | null =
    document.discount_scope ?? (lineDiscounts > 0 ? 'line' : headerDiscount > 0 ? 'total' : null);

  if (!scope || (lineDiscounts <= 0 && headerDiscount <= 0)) {
    return {
      hasDiscount: false,
      scope: null,
      showLineColumn: false,
      lineAmount: (l) => Number(l.total ?? readGrossTotal(l)),
      grossTotal: netTotal,
      discountAmount: 0,
      total: netTotal,
    };
  }

  if (scope === 'line') {
    return {
      hasDiscount: true,
      scope: 'line',
      showLineColumn: true,
      lineAmount: (l) => Number(l.total ?? readGrossTotal(l)),
      grossTotal,
      discountAmount: lineDiscounts,
      total: netTotal,
    };
  }

  return {
    hasDiscount: true,
    scope: 'total',
    showLineColumn: false,
    // Con ámbito 'total' el descuento está prorrateado en las líneas, pero se
    // imprime a precio de lista y se descuenta una sola vez abajo.
    lineAmount: (l) => readGrossTotal(l),
    grossTotal,
    discountAmount: headerDiscount || roundCurrency(grossTotal - netTotal),
    total: netTotal,
  };
}

/**
 * Porcentaje que representa el descuento sobre la base, sea cual sea el modo en
 * que se introdujo. Es lo que se compara contra el tope de la clínica.
 */
export function effectiveDiscountPct(base: number, d: DiscountInput | null | undefined): number {
  if (!hasDiscount(d)) return 0;

  const value = Number(d!.value || 0);
  if (d!.mode === 'percent') return value;

  const safeBase = Number(base || 0);
  // Un importe fijo sobre una base de 0 es siempre excesivo: no hay nada que rebajar.
  if (safeBase <= 0) return value > 0 ? Number.POSITIVE_INFINITY : 0;
  return (value / safeBase) * 100;
}

/** `false` si el descuento supera `max_discount_pct`. Un 100 de tope no limita nada. */
export function isDiscountWithinLimit(
  base: number,
  d: DiscountInput | null | undefined,
  maxPct: number,
): boolean {
  if (!hasDiscount(d)) return true;
  if (maxPct >= 100) return true;
  // Margen para el redondeo: un 10 % expresado como importe puede dar 10.000001.
  return effectiveDiscountPct(base, d) <= maxPct + 1e-6;
}
