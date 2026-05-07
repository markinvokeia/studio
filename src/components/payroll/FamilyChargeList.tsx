'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataCard } from '@/components/ui/data-card';
import { DataTable } from '@/components/ui/data-table';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNarrowMode } from '@/components/layout/two-panel-layout';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { PayrollListToolbar } from '@/components/payroll/PayrollListToolbar';
import type { PayrollFamilyCharge } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatDate } from '@/components/payroll/payroll-utils';
import type { ColumnDef } from '@tanstack/react-table';
import { Filter, Plus, Settings2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

type FamilyType = PayrollFamilyCharge['tipo'];

const FAMILY_TYPE_COLORS: Record<FamilyType, string> = {
  conyuge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  hijo: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  hijo_discapacidad: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

const FAMILY_TYPES: FamilyType[] = ['conyuge', 'hijo', 'hijo_discapacidad'];

interface FamilyChargeListProps {
  charges: PayrollFamilyCharge[];
  loading?: boolean;
  selectedId?: string;
  onSelect?: (id: string) => void;
  onNew?: () => void;
}

export function FamilyChargeList({ charges, loading, selectedId, onSelect, onNew }: FamilyChargeListProps) {
  const t = useTranslations('PayrollPage.legajo.familia');
  const { isNarrow } = useNarrowMode();
  const isViewportNarrow = useViewportNarrow();
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState<FamilyType | 'all'>('all');
  const [isCardMode, setIsCardMode] = useState(false);

  const filtered = useMemo(() => charges.filter((c) => {
    const fullName = `${c.nombres ?? ''} ${c.apellidos ?? ''} ${c.cedula ?? ''}`.toLowerCase();
    const matchSearch = !search || fullName.includes(search.toLowerCase());
    const matchTipo = filterTipo === 'all' || c.tipo === filterTipo;
    return matchSearch && matchTipo;
  }), [charges, search, filterTipo]);

  const showCardMode = isCardMode || isNarrow || isViewportNarrow || !!selectedId;

  const columns = useMemo<ColumnDef<PayrollFamilyCharge>[]>(() => [
    {
      id: 'nombre',
      header: t('nombre'),
      accessorFn: (c) => `${c.nombres} ${c.apellidos}`,
      cell: ({ row }) => (
        <span className="font-medium">{row.original.nombres} {row.original.apellidos}</span>
      ),
    },
    {
      id: 'tipo',
      header: t('tipo'),
      accessorKey: 'tipo',
      cell: ({ row }) => (
        <Badge className={cn('text-xs', FAMILY_TYPE_COLORS[row.original.tipo] ?? '')}>
          {t(`tipos.${row.original.tipo}`)}
        </Badge>
      ),
    },
    {
      id: 'cedula',
      header: t('cedula'),
      accessorKey: 'cedula',
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">{row.original.cedula || '—'}</span>
      ),
    },
    {
      id: 'desde',
      header: t('desde'),
      accessorKey: 'vigente_desde',
      cell: ({ row }) => <span className="text-muted-foreground text-xs">{formatDate(row.original.vigente_desde)}</span>,
    },
  ], [t]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <DataTable
        columns={columns}
        data={filtered}
        isLoading={loading}
        isNarrow={showCardMode}
        compact
        enableSingleRowSelection
        onRowSelectionChange={(rows) => { if (rows[0]) onSelect?.(rows[0].id); }}
        onRowClick={(c) => onSelect?.(c.id)}
        getRowClassName={(c) =>
          cn('cursor-pointer transition-colors', c.id === selectedId ? 'bg-primary/5' : '')
        }
        renderCard={(charge, isSelected) => (
          <DataCard
            isSelected={isSelected || charge.id === selectedId}
            title={`${charge.nombres} ${charge.apellidos}`}
            subtitle={`${charge.cedula ? `${charge.cedula} · ` : ''}${formatDate(charge.vigente_desde)}`}
            avatar={`${charge.nombres ?? '?'}`.slice(0, 2).toUpperCase()}
            showArrow
            onClick={() => onSelect?.(charge.id)}
            badge={
              <Badge className={cn('text-[9px]', FAMILY_TYPE_COLORS[charge.tipo] ?? '')}>
                {t(`tipos.${charge.tipo}`)}
              </Badge>
            }
          />
        )}
        customToolbar={(table, paginationNode) => (
          <PayrollListToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder={t('searchPlaceholder')}
            viewMode={isCardMode ? 'card' : 'table'}
            onViewModeChange={(m) => setIsCardMode(m === 'card')}
            showViewToggle={!isViewportNarrow && !isNarrow}
            filterSlot={
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={filterTipo !== 'all' ? 'secondary' : 'outline'}
                    size="icon"
                    className="h-8 w-8 shrink-0 relative"
                    title={t('filters')}
                  >
                    <Filter className="h-3.5 w-3.5" />
                    {filterTipo !== 'all' && (
                      <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[160px]">
                  <DropdownMenuCheckboxItem
                    checked={filterTipo === 'all'}
                    onCheckedChange={() => setFilterTipo('all')}
                  >
                    {t('filterAll')}
                  </DropdownMenuCheckboxItem>
                  {FAMILY_TYPES.map((ft) => (
                    <DropdownMenuCheckboxItem
                      key={ft}
                      checked={filterTipo === ft}
                      onCheckedChange={() => setFilterTipo(ft)}
                    >
                      {t(`tipos.${ft}`)}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            }
            columnsSlot={!showCardMode && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8 shrink-0">
                    <Settings2 className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {(table as any).getAllColumns()
                    .filter((col: any) => col.getCanHide())
                    .map((col: any) => (
                      <DropdownMenuCheckboxItem
                        key={col.id}
                        checked={col.getIsVisible()}
                        onCheckedChange={(val) => col.toggleVisibility(!!val)}
                      >
                        {typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id}
                      </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            actions={onNew && (
              <Button size="sm" className="h-8 text-xs" onClick={onNew} title={t('create')}>
                <Plus className="h-3 w-3 sm:mr-1" />
                <span className="hidden sm:inline">{t('create')}</span>
              </Button>
            )}
            paginationNode={paginationNode}
          />
        )}
      />
    </div>
  );
}
