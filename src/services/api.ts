const BASE_URL = process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}/webhook` : 'https://n8n-project-n8n.7ig1i3.easypanel.host/webhook';

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
    url = BASE_URL + url;
    if (query) {
        const searchParams = new URLSearchParams(query);
        url += '?' + searchParams.toString();
    }
    return url;
};

const apiRequest = async (
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    endpoint: string,
    data?: any,
    params?: Record<string, string>,
    query?: Record<string, string>,
    responseType: 'json' | 'blob' = 'json'
): Promise<any> => {
    const token = getToken();
    const url = buildUrl(endpoint, params, query);

    const headers: Record<string, string> = {
        'Accept': 'application/json',
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config: RequestInit = {
        method,
        headers,
        mode: 'cors',
        cache: 'no-store',
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
            // For 400 status codes, maintain backwards compatibility
            // Return error data but add metadata for enhanced detection
            if (response.status === 400) {
                const text = await response.text();
                if (text.trim()) {
                    try {
                        const errorData = JSON.parse(text);
                        // Add metadata for enhanced error detection without breaking existing code
                        if (Array.isArray(errorData)) {
                            (errorData as any)._isError = true;
                            (errorData as any)._status = response.status;
                        } else if (typeof errorData === 'object' && errorData !== null) {
                            (errorData as any)._isError = true;
                            (errorData as any)._status = response.status;
                        }
                        return errorData;
                    } catch (jsonError) {
                        throw new Error('Bad request');
                    }
                }
                throw new Error('Bad request');
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
            const error = new Error(errorMessage);
            (error as any).status = response.status;
            (error as any).data = errorData;
            throw error;
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
        console.error('API request failed:', error);
        throw error;
    }
};

export const api = {
    get: (endpoint: string, query?: Record<string, string>, params?: Record<string, string>) =>
        apiRequest('GET', endpoint, undefined, params, query),

    getBlob: (endpoint: string, query?: Record<string, string>, params?: Record<string, string>) =>
        apiRequest('GET', endpoint, undefined, params, query, 'blob'),

    post: (endpoint: string, data: any, params?: Record<string, string>, query?: Record<string, string>) =>
        apiRequest('POST', endpoint, data, params, query),

    postBlob: (endpoint: string, data: any, params?: Record<string, string>, query?: Record<string, string>) =>
        apiRequest('POST', endpoint, data, params, query, 'blob'),

    put: (endpoint: string, data: any, params?: Record<string, string>, query?: Record<string, string>) =>
        apiRequest('PUT', endpoint, data, params, query),

    patch: (endpoint: string, data: any, params?: Record<string, string>, query?: Record<string, string>) =>
        apiRequest('PATCH', endpoint, data, params, query),

    delete: (endpoint: string, data?: any, params?: Record<string, string>, query?: Record<string, string>) =>
        apiRequest('DELETE', endpoint, data, params, query),

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