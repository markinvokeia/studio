import { MapPin, Minus, Shapes, type LucideIcon } from 'lucide-react';

import type {
  AestheticLayer,
  AestheticMark,
  AestheticMarkKind,
  AestheticSharedAttributes,
  ServiceAestheticConfig,
} from '@/lib/types';
import { newLocalId } from '@/services/aesthetic-record';

/** Colors for layers whose service has none in the catalog, by layer position */
const FALLBACK_COLORS = ['#7c3aed', '#0d9488', '#e11d48', '#d97706', '#2563eb', '#65a30d', '#db2777', '#0891b2'];

export function layerColor(layer: Pick<AestheticLayer, 'color'>, index: number): string {
  return layer.color || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

export const MARK_KIND_ICONS: Record<AestheticMarkKind, LucideIcon> = { point: MapPin, area: Shapes, line: Minus };

/** A line drawn with the axis snap has its ends on the same x or y */
export function lineOrientation(mark: Pick<AestheticMark, 'kind' | 'polygon'>): 'vertical' | 'horizontal' | 'oblique' | null {
  if (mark.kind !== 'line' || mark.polygon?.length !== 2) return null;
  const [[x0, y0], [x1, y1]] = mark.polygon;
  if (Math.abs(x0 - x1) < 1e-6) return 'vertical';
  if (Math.abs(y0 - y1) < 1e-6) return 'horizontal';
  return 'oblique';
}

export const SHARED_ATTRIBUTES = ['lot', 'lotExpiry', 'depth', 'technique', 'notes'] as const satisfies readonly (keyof AestheticSharedAttributes)[];

/** What applies to the mark: its own value when it set one, the layer's otherwise */
export function resolveMark(layer: AestheticLayer, mark: AestheticMark): AestheticSharedAttributes {
  return {
    lot: mark.lot || layer.lot,
    lotExpiry: mark.lotExpiry || layer.lotExpiry,
    depth: mark.depth ?? layer.depth,
    technique: mark.technique ?? layer.technique,
    notes: mark.notes || layer.notes,
  };
}

/** The mark changes at least one of the layer's attributes */
export const hasOverrides = (mark: AestheticMark) => SHARED_ATTRIBUTES.some((key) => !!mark[key]);

/** Name a layer is shown with: the product when there is one, else the service */
export const layerTitle = (layer: AestheticLayer) => layer.productName.trim() || layer.serviceName;

/** A mark placed on the map, with the layer it belongs to and its number in the session */
export interface PlacedMark {
  mark: AestheticMark;
  layer: AestheticLayer;
  layerIndex: number;
  color: string;
  number: number;
}

/** Marks of every layer, numbered in order (layer by layer) */
export function placeMarks(layers: AestheticLayer[]): PlacedMark[] {
  let number = 0;
  return layers.flatMap((layer, layerIndex) =>
    layer.marks.map((mark) => ({ mark, layer, layerIndex, color: layerColor(layer, layerIndex), number: ++number })),
  );
}

export const isMarkIncomplete = (mark: AestheticMark) => mark.quantity == null || mark.quantity <= 0;

/** Total dose per unit ("24 U", "1.5 ml"), for the one-line session summaries */
export function unitTotals(layers: AestheticLayer[]): { unit: string; quantity: number }[] {
  const totals = new Map<string, number>();
  for (const layer of layers) {
    for (const mark of layer.marks) totals.set(layer.unitSymbol, (totals.get(layer.unitSymbol) ?? 0) + (mark.quantity ?? 0));
  }
  return [...totals.entries()].filter(([, quantity]) => quantity > 0).map(([unit, quantity]) => ({ unit, quantity }));
}

export const layerQuantity = (layer: AestheticLayer) => layer.marks.reduce((sum, mark) => sum + (mark.quantity ?? 0), 0);

export const formatQuantity = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, ''));

export function newLayer(config: ServiceAestheticConfig): AestheticLayer {
  return {
    id: newLocalId('layer'),
    serviceId: config.serviceId,
    serviceName: config.serviceName,
    color: config.serviceColor,
    productName: '',
    unitId: config.unitId,
    unitSymbol: config.unitSymbol,
    unitStep: config.unitStep,
    markingTool: config.markingTool,
    depth: config.defaultDepth,
    technique: config.defaultTechnique,
    marks: [],
  };
}

/** Area centroid (where its number goes); falls back to the vertex average for degenerate outlines */
export function polygonCentroid(polygon: [number, number][]): [number, number] {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < polygon.length; i++) {
    const [x0, y0] = polygon[i];
    const [x1, y1] = polygon[(i + 1) % polygon.length];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  if (Math.abs(area) < 1e-9) {
    const n = polygon.length || 1;
    return [polygon.reduce((s, p) => s + p[0], 0) / n, polygon.reduce((s, p) => s + p[1], 0) / n];
  }
  return [cx / (3 * area), cy / (3 * area)];
}
