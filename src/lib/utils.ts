import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, parseISO } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return 'N/A';

  try {
    const d = typeof date === 'string' ? parseISO(date) : date;
    if (isNaN(d.getTime())) return 'Invalid Date';
    return format(d, 'yyyy-MM-dd HH:mm');
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid Date';
  }
}
