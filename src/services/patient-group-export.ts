import { API_ROUTES } from '@/constants/routes';
import { autoColWidths, sanitizeSheetName } from '@/lib/xlsx-export';
import { api } from '@/services/api';

export interface ExportPatientGroup {
  id: string;
  name: string;
}

interface GroupPatient {
  name: string;
  phone: string;
}

const PAGE_SIZE = 200;
const GROUP_FETCH_CONCURRENCY = 4;

/**
 * Tolerant extractor for the paginated `{ data, total }` envelope, whether it
 * arrives bare, wrapped in `[{ json: ... }]`, or as a plain array of rows.
 * Mirrors the shapes already handled across the patient-groups screens.
 */
function parseEnvelope(raw: any): { list: any[]; total: number } {
  const fromEnvelope = (o: any) => ({
    list: Array.isArray(o?.data) ? o.data : [],
    total: Number(o?.total ?? o?.total_items ?? (Array.isArray(o?.data) ? o.data.length : 0)),
  });

  if (Array.isArray(raw)) {
    const first = raw[0];
    if (first?.json && typeof first.json === 'object') {
      const inner = first.json;
      if (inner.data !== undefined || inner.total !== undefined || inner.total_items !== undefined) {
        return fromEnvelope(inner);
      }
      return { list: raw.map((i: any) => i.json).filter(Boolean), total: raw.length };
    }
    if (first && (first.data !== undefined || first.total !== undefined)) return fromEnvelope(first);
    if (first && 'id' in first) return { list: raw, total: raw.length };
    return { list: raw, total: raw.length };
  }
  if (raw && typeof raw === 'object') return fromEnvelope(raw);
  return { list: [], total: 0 };
}

/** Fetches every active patient group, paging until the reported total is reached. */
export async function fetchAllPatientGroups(): Promise<ExportPatientGroup[]> {
  const groups: ExportPatientGroup[] = [];
  let page = 1;
  let total = Infinity;

  while (groups.length < total) {
    const { list, total: reported } = parseEnvelope(
      await api.get(API_ROUTES.PATIENT_GROUPS, {
        search: '',
        page: String(page),
        limit: String(PAGE_SIZE),
      }),
    );
    total = Number.isFinite(reported) && reported > 0 ? reported : list.length;

    for (const g of list) {
      if (g?.id == null || g?.id === '') continue;
      if (g?.is_active === false) continue;
      groups.push({ id: String(g.id), name: String(g.name ?? '').trim() || String(g.id) });
    }

    if (!list.length || list.length < PAGE_SIZE) break;
    page += 1;
  }

  return groups;
}

/** Fetches every patient in a group (name + phone), paging until complete. */
export async function fetchAllGroupPatients(groupId: string): Promise<GroupPatient[]> {
  const patients: GroupPatient[] = [];
  let page = 1;
  let total = Infinity;

  while (patients.length < total) {
    const { list, total: reported } = parseEnvelope(
      await api.get(API_ROUTES.PATIENT_GROUP_PATIENTS, {
        group_id: groupId,
        page: String(page),
        limit: String(PAGE_SIZE),
        search: '',
      }),
    );
    total = Number.isFinite(reported) && reported > 0 ? reported : list.length;

    for (const p of list) {
      patients.push({
        name: String(p?.name ?? '').trim(),
        phone: String(p?.phone_number ?? '').trim(),
      });
    }

    if (!list.length || list.length < PAGE_SIZE) break;
    page += 1;
  }

  patients.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  return patients;
}

interface SheetHeaders {
  name: string;
  phone: string;
}

function buildSheet(utils: typeof import('xlsx').utils, headers: SheetHeaders, patients: GroupPatient[]) {
  const aoa: unknown[][] = [
    [headers.name, headers.phone],
    ...patients.map((p) => [p.name, p.phone]),
  ];
  const ws = utils.aoa_to_sheet(aoa);
  ws['!cols'] = autoColWidths(aoa, 2);
  // Keep phone numbers as text so a leading "+" / leading zeros survive.
  for (let r = 1; r <= patients.length; r++) {
    const ref = utils.encode_cell({ c: 1, r });
    if (ws[ref]) ws[ref].t = 's';
  }
  return ws;
}

/** Exports a single group's patients to one `.xlsx` file (one sheet). */
export async function exportPatientGroupToExcel(
  group: ExportPatientGroup,
  headers: SheetHeaders,
): Promise<{ patientCount: number }> {
  const { utils, writeFile } = await import('xlsx');
  const patients = await fetchAllGroupPatients(group.id);

  const wb = utils.book_new();
  utils.book_append_sheet(wb, buildSheet(utils, headers, patients), sanitizeSheetName(group.name, new Set()));
  writeFile(wb, `${sanitizeFilePart(group.name)}.xlsx`);

  return { patientCount: patients.length };
}

export interface ExportAllProgress {
  done: number;
  totalGroups: number;
}

/**
 * Exports every active group to a single `.xlsx` with one sheet per group.
 * Patient lists are fetched with bounded concurrency to avoid hammering the API.
 */
export async function exportAllPatientGroupsToExcel(
  headers: SheetHeaders,
  fileName: string,
  onProgress?: (p: ExportAllProgress) => void,
): Promise<{ groupCount: number; patientCount: number }> {
  const { utils, writeFile } = await import('xlsx');
  const groups = await fetchAllPatientGroups();

  if (!groups.length) return { groupCount: 0, patientCount: 0 };

  const results: GroupPatient[][] = new Array(groups.length);
  let cursor = 0;
  let done = 0;

  async function worker() {
    while (cursor < groups.length) {
      const index = cursor++;
      results[index] = await fetchAllGroupPatients(groups[index].id);
      done += 1;
      onProgress?.({ done, totalGroups: groups.length });
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(GROUP_FETCH_CONCURRENCY, groups.length) }, worker),
  );

  const wb = utils.book_new();
  const usedNames = new Set<string>();
  let patientCount = 0;
  groups.forEach((group, i) => {
    const patients = results[i] ?? [];
    patientCount += patients.length;
    utils.book_append_sheet(wb, buildSheet(utils, headers, patients), sanitizeSheetName(group.name, usedNames));
  });

  writeFile(wb, `${sanitizeFilePart(fileName)}.xlsx`);
  return { groupCount: groups.length, patientCount };
}

function sanitizeFilePart(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, ' ').trim() || 'export';
}
