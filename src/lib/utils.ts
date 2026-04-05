import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, parseISO } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return 'N/A';

  try {
    const dateString = typeof date === 'string' ? date.replace('Z', '') : String(date);
    const d = typeof date === 'string' ? parseISO(dateString) : date;
    if (isNaN(d.getTime())) return 'Invalid Date';
    return format(d, 'dd/MM/yyyy HH:mm');
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

/**
 * Converts a Date to a local ISO string without timezone conversion.
 * Returns format: "2026-04-02T14:00:00" (no 'Z' suffix)
 * Use this instead of toISOString() when sending dates to the backend
 * to avoid UTC conversion that causes 3-hour shifts in GMT-3.
 */
export function toLocalISOString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

type DocumentWithDocNo = {
  doc_no?: string;
  invoice_doc_no?: string;
  quote_doc_no?: string;
  payment_doc_no?: string;
  id: string;
};

type DocumentType = 'invoice' | 'quote' | 'payment';

export function getDocumentFileName(doc: DocumentWithDocNo, type: DocumentType): string {
  if (doc.doc_no) return doc.doc_no;
  if (type === 'invoice' && doc.invoice_doc_no) return doc.invoice_doc_no;
  if (type === 'quote' && doc.quote_doc_no) return doc.quote_doc_no;
  if (type === 'payment' && doc.payment_doc_no) return doc.payment_doc_no;
  return doc.id;
}

/**
 * Validates that a value is a non-empty string (excluding 'null' string)
 */
export function isValidString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '' && value !== 'null';
}
