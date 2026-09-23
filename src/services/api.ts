import { getWebhookBaseUrl } from '@/lib/runtime-config';

interface ApiRequestError extends Error {
    status?: number;
    data?: unknown;
    isHttpError?: boolean;
    isTimeout?: boolean;
}

/** Suggested `timeoutMs` values: CRUD mutations vs. AI flows, exports and bulk operations. */
export const REQUEST_TIMEOUT_MS = {
    mutation: 30_000,
    longRunning: 300_000,
} as const;

export interface ApiRequestOptions {
    /** Aborts the request and throws a timeout error (`isTimeoutError`) after this many ms. */
    timeoutMs?: number;
    /** Caller-controlled cancellation (e.g. component unmount, superseded search). */
    signal?: AbortSignal;
}

/**
 * True when the request was aborted by `timeoutMs`. The backend may still have processed it,
 * so after a timeout on a mutation, refresh data instead of blindly retrying.
 */
export const isTimeoutError = (error: unknown): boolean =>
    !!error && typeof error === 'object' && (error as ApiRequestError).isTimeout === true;

/** True when the request was cancelled through the caller's `signal`. Usually safe to ignore. */
export const isAbortError = (error: unknown): boolean =>
    error instanceof DOMException && error.name === 'AbortError';

const getToken = (): string | null => {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('token');
    }
    return null;
};

const buildUrl = (endpoint: string, params?: Record<string, string>, query?: Record<string, string>): string => {
    let url = endpoint;
    if (params) {
        Object.keys(params).forEach(key => {
            url = url.replace(`:${key}`, params[key]);
        });
    }
    url = getWebhookBaseUrl() + url;
    if (query) {
        const searchParams = new URLSearchParams(query);
        url += '?' + searchParams.toString();
    }
    return url;
};

const createApiRequestError = (message: string, status: number, data: unknown): ApiRequestError => {
    const error = new Error(message) as ApiRequestError;
    error.status = status;
    error.data = data;
    error.isHttpError = true;
    return error;
};

const createTimeoutError = (timeoutMs: number): ApiRequestError => {
    const error = new Error(`Request timed out after ${timeoutMs}ms`) as ApiRequestError;
    error.isTimeout = true;
    return error;
};

const apiRequest = async (
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    endpoint: string,
    data?: any,
    params?: Record<string, string>,
    query?: Record<string, string>,
    responseType: 'json' | 'blob' = 'json',
    options: ApiRequestOptions = {}
): Promise<any> => {
    const token = getToken();
    const url = buildUrl(endpoint, params, query);

    const headers: Record<string, string> = {
        'Accept': 'application/json',
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const { timeoutMs, signal } = options;
    const controller = timeoutMs || signal ? new AbortController() : null;
    let timedOut = false;
    const timeoutId = timeoutMs
        ? setTimeout(() => {
            timedOut = true;
            controller?.abort();
        }, timeoutMs)
        : undefined;
    const abortFromCaller = () => controller?.abort();
    if (signal) {
        if (signal.aborted) controller?.abort();
        else signal.addEventListener('abort', abortFromCaller, { once: true });
    }

    const config: RequestInit = {
        method,
        headers,
        mode: 'cors',
        cache: 'no-store',
        signal: controller?.signal,
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'DELETE' || method === 'PATCH')) {
        if (data instanceof FormData) {
            config.body = data;
        } else {
            headers['Content-Type'] = 'application/json';
            config.body = JSON.stringify(data);
        }
    }

    try {
        const response = await fetch(url, config);
        if (!response.ok) {
            // For 400 status codes, throw error with data for proper handling
            if (response.status === 400) {
                const text = await response.text();
                let errorData;
                try {
                    errorData = text.trim() ? JSON.parse(text) : {};
                } catch {
                    errorData = {};
                }
                throw createApiRequestError(errorData?.message || errorData?.error || 'Validation error', response.status, errorData);
            }
            // For other status codes (401, 403, 404, 500+), throw errors as before
            const text = await response.text();
            let errorData;
            try {
                errorData = text.trim() ? JSON.parse(text) : {};
            } catch {
                errorData = {};
            }

            // Create detailed error message
            let errorMessage = `HTTP error! status: ${response.status}`;

            // Extract error message from different response formats
            if (errorData.message) {
                errorMessage = errorData.message;
            } else if (errorData.error) {
                errorMessage = errorData.error;
            } else if (Array.isArray(errorData) && errorData[0]?.message) {
                errorMessage = errorData[0].message;
            } else if (Array.isArray(errorData) && errorData[0]?.error) {
                errorMessage = errorData[0].error;
            }

            // Create error object with additional context
            throw createApiRequestError(errorMessage, response.status, errorData);
        }
        if (responseType === 'blob') {
            return await response.blob();
        }
        // Check if response has content before parsing as JSON
        const text = await response.text();
        if (!text.trim()) {
            return null; // Return null for empty responses
        }
        try {
            return JSON.parse(text);
        } catch (jsonError) {
            console.error('Failed to parse JSON response:', jsonError, 'Response text:', text);
            throw new Error('Invalid JSON response from server');
        }
    } catch (error) {
        if (timedOut && timeoutMs) {
            console.error('API request timed out:', method, endpoint);
            throw createTimeoutError(timeoutMs);
        }
        if (isAbortError(error)) {
            throw error;
        }
        const apiError = error as ApiRequestError;
        if (!apiError.isHttpError || (apiError.status !== undefined && apiError.status >= 500)) {
            console.error('API request failed:', error);
        }
        throw error;
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
        signal?.removeEventListener('abort', abortFromCaller);
    }
};

export const api = {
    get: (endpoint: string, query?: Record<string, string>, params?: Record<string, string>, options?: ApiRequestOptions) =>
        apiRequest('GET', endpoint, undefined, params, query, 'json', options),

    getBlob: (endpoint: string, query?: Record<string, string>, params?: Record<string, string>, options?: ApiRequestOptions) =>
        apiRequest('GET', endpoint, undefined, params, query, 'blob', options),

    post: (endpoint: string, data: any, params?: Record<string, string>, query?: Record<string, string>, options?: ApiRequestOptions) =>
        apiRequest('POST', endpoint, data, params, query, 'json', options),

    postBlob: (endpoint: string, data: any, params?: Record<string, string>, query?: Record<string, string>, options?: ApiRequestOptions) =>
        apiRequest('POST', endpoint, data, params, query, 'blob', options),

    put: (endpoint: string, data: any, params?: Record<string, string>, query?: Record<string, string>, options?: ApiRequestOptions) =>
        apiRequest('PUT', endpoint, data, params, query, 'json', options),

    patch: (endpoint: string, data: any, params?: Record<string, string>, query?: Record<string, string>, options?: ApiRequestOptions) =>
        apiRequest('PATCH', endpoint, data, params, query, 'json', options),

    delete: (endpoint: string, data?: any, params?: Record<string, string>, query?: Record<string, string>, options?: ApiRequestOptions) =>
        apiRequest('DELETE', endpoint, data, params, query, 'json', options),

    getExchangeRateHistory: (query?: {
        start_date?: string;
        end_date?: string;
        page?: number;
        limit?: number;
    }) => {
        const queryParams: Record<string, string> = {};
        if (query?.start_date) queryParams.start_date = query.start_date;
        if (query?.end_date) queryParams.end_date = query.end_date;
        if (query?.page !== undefined) queryParams.page = query.page.toString();
        if (query?.limit !== undefined) queryParams.limit = query.limit.toString();

        return apiRequest('GET', '/cotizaciones-history', undefined, undefined, Object.keys(queryParams).length > 0 ? queryParams : undefined);
    },
};

export default api;
