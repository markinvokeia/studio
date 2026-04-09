export const SHEET_TAB_CLASS =
  'text-xs px-3 py-2 rounded-none border-b-2 border-transparent -mb-px whitespace-nowrap data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none hover:text-foreground';

export function hasValidPayments(raw: any[]): boolean {
  if (!Array.isArray(raw) || raw.length === 0) return false;
  const first = raw[0];
  return (
    first != null &&
    typeof first === 'object' &&
    (first.amount_applied !== undefined || first.amount !== undefined || first.converted_amount !== undefined)
  );
}
