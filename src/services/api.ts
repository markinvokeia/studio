const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://n8n-project-n8n.7ig1i3.easypanel.host/webhook';

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
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
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

    if (data && (method === 'POST' || method === 'PUT' || method === 'DELETE')) {
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
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        if (responseType === 'blob') {
            return await response.blob();
        }
        return await response.json();
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

    put: (endpoint: string, data: any, params?: Record<string, string>, query?: Record<string, string>) =>
        apiRequest('PUT', endpoint, data, params, query),

    delete: (endpoint: string, data?: any, params?: Record<string, string>, query?: Record<string, string>) =>
        apiRequest('DELETE', endpoint, data, params, query),
};

export default api;