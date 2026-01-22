/**
 * Standardized error handling utilities
 */

export interface ErrorInfo {
  message: string;
  type: 'network' | 'validation' | 'server' | 'unknown';
  details?: any;
}

/**
 * Extracts a user-friendly error message from an error object
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  
  if (error && typeof error === 'object') {
    // Handle API error responses
    if ('message' in error) {
      return String(error.message);
    }
    
    // Handle structured error responses
    if ('error' in error) {
      if (typeof error.error === 'string') {
        return error.error;
      }
      if (error.error && typeof error.error === 'object' && 'message' in error.error) {
        return String(error.error.message);
      }
    }
    
    // Handle validation errors
    if ('errors' in error && Array.isArray(error.errors)) {
      return error.errors.map((e: any) => e.message || e).join(', ');
    }
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  return 'An unexpected error occurred';
}

/**
 * Categorizes error type for better handling
 */
export function getErrorType(error: unknown): ErrorInfo['type'] {
  if (!navigator.onLine) {
    return 'network';
  }
  
  if (error instanceof Error) {
    if (error.message.includes('Network Error') || error.message.includes('fetch')) {
      return 'network';
    }
    
    if (error.message.includes('422') || error.message.includes('validation')) {
      return 'validation';
    }
    
    if (error.message.includes('500') || error.message.includes('server')) {
      return 'server';
    }
  }
  
  return 'unknown';
}

/**
 * Gets comprehensive error information
 */
export function getErrorInfo(error: unknown): ErrorInfo {
  return {
    message: getErrorMessage(error),
    type: getErrorType(error),
    details: error
  };
}

/**
 * Standard error toast configuration
 */
export function createErrorToast(error: unknown, context?: string) {
  const errorInfo = getErrorInfo(error);
  const title = context ? `Error in ${context}` : 'Error';
  
  return {
    variant: 'destructive' as const,
    title,
    description: errorInfo.message
  };
}