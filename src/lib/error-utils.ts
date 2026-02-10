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

/**
 * Enhanced error detection for API responses
 * Provides backwards compatibility while improving error handling
 */
export interface ApiError {
  _isError?: boolean;
  _status?: number;
  error?: string;
  message?: string;
  code?: number;
  status?: number;
}

export interface StructuredError {
  status: number;
  data: any;
  message: string;
}

/**
 * Enhanced error detection for API responses
 * Works with both legacy and new error formats
 */
export function detectApiError(response: any): StructuredError | null {
  if (!response) return null;

  // New format: has metadata indicating error
  if (response._isError || (Array.isArray(response) && (response as any)._isError)) {
    return {
      status: response._status || 400,
      data: response,
      message: extractErrorMessage(response)
    };
  }

  // Legacy format: array with error codes
  if (Array.isArray(response)) {
    const errorItem = response.find(item => 
      item?.code >= 400 || item?.error || item?.message
    );
    if (errorItem) {
      return {
        status: errorItem.code || errorItem.status || 400,
        data: response,
        message: errorItem.message || errorItem.error || 'API Error'
      };
    }
  }

  // Legacy format: object with error fields
  if (typeof response === 'object' && response !== null) {
    if (response.error || (response.code && response.code >= 400)) {
      return {
        status: response.code || response.status || 400,
        data: response,
        message: response.message || response.error || 'API Error'
      };
    }

    // Check for error indicators in message field
    if (response.message && typeof response.message === 'string') {
      const hasErrorIndicators = 
        response.message.toLowerCase().includes('error') ||
        response.message.toLowerCase().includes('failed') ||
        response.message.toLowerCase().includes('invalid') ||
        (response.status && response.status >= 400);
      
      if (hasErrorIndicators) {
        return {
          status: response.status || 400,
          data: response,
          message: response.message
        };
      }
    }
  }

  // No error detected
  return null;
}

/**
 * Extract error message from various response formats
 */
function extractErrorMessage(response: any): string {
  if (Array.isArray(response)) {
    const errorItem = response.find(item => item?.message || item?.error);
    return errorItem?.message || errorItem?.error || 'API Error';
  }
  
  if (typeof response === 'object' && response !== null) {
    return response.message || response.error || 'API Error';
  }
  
  return 'API Error';
}

/**
 * Handle API errors and throw appropriate Error objects
 * Enhanced version for sequences and other critical operations
 */
export function handleApiErrorEnhanced(response: any): void {
  const detectedError = detectApiError(response);
  
  if (detectedError) {
    throw new Error(detectedError.message);
  }
  
  // If no structured error is found but response has error indicators
  if (response && typeof response === 'object' && 'error' in response) {
    throw new Error(response.error || 'Unknown error');
  }
}

/**
 * Enhanced API service response handler
 * Returns both detected error and the original response
 */
export function processApiResponse(response: any): { hasError: boolean; error?: StructuredError; data: any } {
  const detectedError = detectApiError(response);
  
  if (detectedError) {
    return {
      hasError: true,
      error: detectedError,
      data: response
    };
  }
  
  return {
    hasError: false,
    data: response
  };
}