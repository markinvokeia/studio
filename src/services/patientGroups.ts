import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';

export interface GroupOption {
  id: string;
  name: string;
}

function normalizeCollectionResponse(data: any): any[] {
  if (Array.isArray(data)) {
    if (data.length > 0 && data[0]?.json && typeof data[0].json === 'object') {
      const nested = data[0].json?.data;
      if (Array.isArray(nested)) return nested;
      return data.map((item) => item?.json ?? item).filter(Boolean);
    }

    if (data.length > 0 && data[0]?.data) {
      return Array.isArray(data[0].data) ? data[0].data : [data[0].data];
    }

    return data;
  }

  if (Array.isArray(data?.data)) return data.data;

  return [];
}

function mapGroupOption(raw: any): GroupOption | null {
  const id = raw?.id;
  if (id === undefined || id === null || id === '') return null;
  return { id: String(id), name: String(raw?.name ?? '').trim() };
}

export function normalizeGroupOptions(data: any): GroupOption[] {
  return normalizeCollectionResponse(data)
    .filter((g: any) => g?.is_active !== false)
    .map(mapGroupOption)
    .filter((group): group is GroupOption => Boolean(group?.id));
}

export async function ensureGroupOption(
  groups: GroupOption[],
  selected: GroupOption[],
): Promise<GroupOption[]> {
  const missing = selected.filter((s) => !groups.some((g) => g.id === s.id));
  return missing.length > 0 ? [...groups, ...missing] : groups;
}
