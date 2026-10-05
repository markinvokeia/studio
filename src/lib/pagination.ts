import type { PaginationState } from '@tanstack/react-table';

import { BREAKPOINT_MOBILE } from '@/lib/design-tokens';

/** Default page size for tablet and desktop viewports. */
export const PAGE_SIZE_DEFAULT = 25;

/** Default page size for mobile viewports (below BREAKPOINT_MOBILE). */
export const PAGE_SIZE_MOBILE = 10;

/**
 * Page size a paginated table starts with on the current device:
 * 10 below the mobile breakpoint (<768px), 25 on tablet/desktop.
 *
 * Dashboard content mounts on the client (PrivateRoute renders a loading
 * placeholder during SSR), so `window` is available when a table's initial
 * state is created. The SSR fallback keeps this safe for any server-rendered
 * use. Evaluated once per mount — later resizes don't change the default; the
 * user's choice from the page-size selector always wins.
 */
export function getDefaultPageSize(): number {
  if (typeof window === 'undefined') return PAGE_SIZE_DEFAULT;
  return window.innerWidth < BREAKPOINT_MOBILE ? PAGE_SIZE_MOBILE : PAGE_SIZE_DEFAULT;
}

/** Initial pagination state for a server-paginated table (page 1, responsive size). */
export function createDefaultPagination(): PaginationState {
  return { pageIndex: 0, pageSize: getDefaultPageSize() };
}
