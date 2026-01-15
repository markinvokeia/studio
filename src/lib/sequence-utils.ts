import { Sequence, SequencePatternValidation, SequenceVariable } from '@/lib/types';

export const SEQUENCE_VARIABLES: SequenceVariable[] = [
  {
    key: 'YYYY',
    description: 'Full year (e.g., 2024)',
    example: '2024'
  },
  {
    key: 'YY',
    description: 'Short year (e.g., 24)',
    example: '24'
  },
  {
    key: 'MM',
    description: 'Month with padding (01-12)',
    example: '01'
  },
  {
    key: 'DD',
    description: 'Day with padding (01-31)',
    example: '15'
  },
  {
    key: 'COUNTER:N',
    description: 'Sequential number with N digits',
    example: 'COUNTER:4 = 0001'
  },
  {
    key: 'CLINIC',
    description: 'Clinic code',
    example: 'CLINIC01'
  },
  {
    key: 'DOCTYPE',
    description: 'Document type code',
    example: 'INV'
  }
];

export const DOCUMENT_TYPE_CODES = {
  invoice: 'INV',
  quote: 'QUO',
  order: 'ORD',
  payment: 'PAY',
  credit_note: 'CRD',
  purchase_order: 'PO'
};

export function generateSequenceNumber(
  pattern: string,
  counter: number,
  documentType: string,
  date: Date = new Date()
): string {
  let result = pattern;

  // Date variables
  const year = date.getFullYear();
  const shortYear = year.toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  // Replace basic variables
  result = result.replace(/{YYYY}/g, year.toString());
  result = result.replace(/{YY}/g, shortYear);
  result = result.replace(/{MM}/g, month);
  result = result.replace(/{DD}/g, day);
  result = result.replace(/{CLINIC}/g, 'CLINIC01'); // TODO: Get from clinic settings
  result = result.replace(/{DOCTYPE}/g, DOCUMENT_TYPE_CODES[documentType as keyof typeof DOCUMENT_TYPE_CODES] || 'DOC');

  // Handle COUNTER variable with padding
  const counterRegex = /{COUNTER:(\d+)}/g;
  result = result.replace(counterRegex, (match, padding) => {
    const padLength = parseInt(padding, 10);
    return String(counter).padStart(padLength, '0');
  });

  return result;
}

export function validatePattern(pattern: string): SequencePatternValidation {
  const errors: string[] = [];

  if (!pattern || pattern.trim() === '') {
    errors.push('Pattern is required');
    return {
      is_valid: false,
      errors,
      preview: ''
    };
  }

  // Check for invalid variables
  const validVariables = ['YYYY', 'YY', 'MM', 'DD', 'COUNTER', 'CLINIC', 'DOCTYPE'];
  const variableRegex = /{([^}]+)}/g;
  let match;
  const foundVariables: string[] = [];

  while ((match = variableRegex.exec(pattern)) !== null) {
    const variable = match[1];
    
    if (variable.startsWith('COUNTER:')) {
      const padding = parseInt(variable.split(':')[1], 10);
      if (isNaN(padding) || padding < 1 || padding > 10) {
        errors.push('Counter padding must be between 1 and 10 digits');
      }
    } else if (!validVariables.includes(variable)) {
      errors.push(`Invalid variable: {${variable}}`);
    }
    
    foundVariables.push(variable);
  }

  // Check if pattern has at least one variable
  if (foundVariables.length === 0) {
    errors.push('Pattern must contain at least one variable');
  }

  // Check for COUNTER variable (required for uniqueness)
  const hasCounter = foundVariables.some(v => v.startsWith('COUNTER'));
  if (!hasCounter) {
    errors.push('Pattern must include a {COUNTER:N} variable for unique numbering');
  }

  const preview = errors.length === 0 ? generateSequenceNumber(pattern, 1, 'invoice') : '';

  return {
    is_valid: errors.length === 0,
    errors,
    preview
  };
}

export function previewPattern(pattern: string, documentType: string = 'invoice'): string {
  const validation = validatePattern(pattern);
  if (!validation.is_valid) {
    return 'Invalid pattern';
  }

  // Generate a preview with current date and counter = 1
  return generateSequenceNumber(pattern, 1, documentType);
}

export function getNextCounter(sequence: Sequence): number {
  const today = new Date();
  
  switch (sequence.reset_period) {
    case 'yearly':
      // Reset counter on January 1st
      const currentYear = today.getFullYear();
      const sequenceDate = new Date(sequence.updated_at || sequence.created_at || today);
      const sequenceYear = sequenceDate.getFullYear();
      
      if (currentYear > sequenceYear) {
        return 1;
      }
      break;
      
    case 'monthly':
      // Reset counter on first day of each month
      const currentMonth = today.getFullYear() * 12 + today.getMonth();
      const sequenceMonth = new Date(sequence.updated_at || sequence.created_at || today).getFullYear() * 12 + 
                           new Date(sequence.updated_at || sequence.created_at || today).getMonth();
      
      if (currentMonth > sequenceMonth) {
        return 1;
      }
      break;
      
    case 'never':
    default:
      // Never reset, continue incrementing
      break;
  }
  
  return sequence.current_counter + 1;
}

export function resetCounterIfNeeded(sequence: Sequence): { shouldReset: boolean; newCounter: number } {
  const shouldReset = getNextCounter(sequence) === 1;
  return {
    shouldReset,
    newCounter: shouldReset ? 1 : sequence.current_counter + 1
  };
}