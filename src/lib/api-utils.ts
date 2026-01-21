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

  let itemsData: any[] = [];
  let total = 0;

  if (Array.isArray(data)) {
    if (data.length > 0 && data[0]?.data) {
      // Format: [{ data: [...], total: X }]
      itemsData = data[0].data || [];
      total = Number(data[0].total) || itemsData.length;
    } else {
      // Format: Direct array [{...}, {...}]
      itemsData = data;
      total = data.length;
    }
  } else if (data?.data) {
    // Format: { data: [...], total: X }
    itemsData = data.data;
    total = Number(data.total) || itemsData.length;
  } else {
    // Unknown format, return empty
    return { items: [], total: 0 };
  }

  return {
    items: itemsData,
    total
  };
}