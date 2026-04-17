'use client';

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { ColumnDef } from '@tanstack/react-table';

/**
 * Returns a typed radio-select column to prepend to any data table.
 * Clicking a radio deselects all other rows (single-select behaviour).
 */
export function createSelectColumn<T>(): ColumnDef<T> {
  return {
    id: 'select',
    header: () => null,
    cell: ({ row, table }) => {
      const isSelected = row.getIsSelected();
      return (
        <RadioGroup
          value={isSelected ? row.id : ''}
          onValueChange={() => {
            table.toggleAllPageRowsSelected(false);
            row.toggleSelected(true);
          }}
        >
          <RadioGroupItem value={row.id} id={`radio-${row.id}`} aria-label="Select row" />
        </RadioGroup>
      );
    },
    enableSorting: false,
    enableHiding: false,
    size: 36,
  } as ColumnDef<T>;
}
