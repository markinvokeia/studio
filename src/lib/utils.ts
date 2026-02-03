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

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return 'N/A';

  try {
    // Handle string dates without timezone conversion to prevent day shifting
    if (typeof date === 'string') {
      // If it's an ISO string with time component, extract just the date part
      if (date.includes('T')) {
        return date.split('T')[0];
      }
      // If it's already a date string, return as-is
      return date;
    }
    
    // Handle Date objects
    if (isNaN(date.getTime())) return 'Invalid Date';
    return format(date, 'yyyy-MM-dd');
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid Date';
  }
}

// Specialized function for holiday dates to ensure consistent handling
export function formatHolidayDate(date: string | Date | null | undefined): string {
  if (!date) return 'N/A';

  try {
    // Convert to string and extract date part without timezone conversion
    const dateStr = typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');
    
    // If it's an ISO string with time component, extract just the date part
    if (dateStr.includes('T')) {
      return dateStr.split('T')[0];
    }
    
    return dateStr;
  } catch (error) {
    console.error('Error formatting holiday date:', error);
    return 'Invalid Date';
  }
}
