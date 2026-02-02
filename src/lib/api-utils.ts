interface ApiResponse<T> {
  data?: T[];
  total?: number;
}

interface NormalizedResponse<T> {
  items: T[];
  total: number;
}

/**
 * Normalizes API responses that may come in different formats:
 * 1. Direct object: { data: [...], total: X }
 * 2. Array with object: [{ data: [...], total: X }]
 * 3. Direct array: [{...}, {...}]
 */
export function normalizeApiResponse<T>(data: any): NormalizedResponse<T> {
  // Handle null/undefined
  if (!data) {
    return { items: [], total: 0 };
  }

  // If it's the specific format reported: [{ data: [...] }]
  if (Array.isArray(data) && data.length > 0 && data[0] && Array.isArray(data[0].data)) {
    return {
      items: data[0].data,
      total: Number(data[0].total) || data[0].data.length
    };
  }

  // Direct array: [{...}, {...}]
  if (Array.isArray(data)) {
    return {
      items: data,
      total: data.length
    };
  }

  // Object with data/items property
  if (data && typeof data === 'object') {
    const items = data.items || data.data || data.result || [];
    const total = Number(data.total) || (Array.isArray(items) ? items.length : 0);
    return {
      items: Array.isArray(items) ? items : [],
      total
    };
  }

  return { items: [], total: 0 };
}