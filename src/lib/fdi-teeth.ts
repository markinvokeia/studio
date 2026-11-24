/** Numeración FDI válida: permanentes 11–48 y temporales 51–85. */
export function isValidFdiTooth(n: number): boolean {
  const quadrant = Math.floor(n / 10);
  const tooth = n % 10;
  if (quadrant >= 1 && quadrant <= 4) return tooth >= 1 && tooth <= 8;
  if (quadrant >= 5 && quadrant <= 8) return tooth >= 1 && tooth <= 5;
  return false;
}

/** "16, 21 36" → [16, 21, 36]. null si algún valor no es una pieza FDI. */
export function parseTeeth(text: string): number[] | null {
  const parts = text.split(/[\s,;]+/).filter(Boolean);
  const teeth: number[] = [];
  for (const part of parts) {
    if (!/^\d{2}$/.test(part)) return null;
    const n = Number(part);
    if (!isValidFdiTooth(n)) return null;
    if (!teeth.includes(n)) teeth.push(n);
  }
  return teeth.sort((a, b) => a - b);
}
