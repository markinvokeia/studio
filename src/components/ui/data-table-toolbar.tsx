
'use client';

import { Table } from '@tanstack/react-table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PlusCircle, RefreshCw, SlidersHorizontal, Filter, Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  filterColumnId: string;
  filterPlaceholder: string;
  onCreate?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  columnTranslations?: { [key: string]: string };
  extraButtons?: React.ReactNode;
  createButtonLabel?: string;
  filterOptions?: { label: string; value: string }[];
  onFilterChange?: (value: string) => void;
  filterValue?: string;
  createButtonIconOnly?: boolean;
}

export function DataTableToolbar<TData>({
  table,
  filterColumnId,
  filterPlaceholder,
  onCreate,
  onRefresh,
  isRefreshing,
  columnTranslations = {},
  extraButtons,
  createButtonLabel,
  filterOptions,
  onFilterChange,
  filterValue,
  createButtonIconOnly,
}: DataTableToolbarProps<TData>) {
  const t = useTranslations('DataTableToolbar');
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center space-x-2">
        <div className="relative flex items-center">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={filterPlaceholder}
            value={(table.getColumn(filterColumnId)?.getFilterValue() as string) ?? ''}
            onChange={(event) => {
              const column = table.getColumn(filterColumnId);
              if (column) {
                column.setFilterValue(event.target.value);
              }
            }}
            className="h-9 w-[180px] sm:w-[200px] lg:w-[300px] pl-9 pr-9"
          />
          {((table.getColumn(filterColumnId)?.getFilterValue() as string) ?? '').length > 0 && (
            <Button
              variant="ghost"
              onClick={() => {
                const column = table.getColumn(filterColumnId);
                if (column) {
                  column.setFilterValue('');
                }
              }}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 hover:bg-transparent text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Clear</span>
            </Button>
          )}
        </div>
        {filterOptions && onFilterChange && (
          <Select value={filterValue || 'all'} onValueChange={onFilterChange}>
            <SelectTrigger className="h-9 w-[150px]">
              <div className="flex items-center">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder={t('filter')} />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('all')}</SelectItem>
              {filterOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {extraButtons}
      </div>
      <div className="flex items-center space-x-2">
        {onCreate && (
          <div className="shrink-0">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="default" size={createButtonIconOnly ? "icon" : "sm"} className={createButtonIconOnly ? "h-9 w-9" : "h-9"} onClick={onCreate}>
                    <PlusCircle className="h-4 w-4" />
                    {createButtonIconOnly ? <span className="sr-only">{createButtonLabel || t('create')}</span> : (createButtonLabel || t('create'))}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{createButtonLabel || t('create')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
        {onRefresh && (
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="sr-only">{t('refresh')}</span>
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="h-9 w-9 lg:flex shrink-0">
              <SlidersHorizontal className="h-4 w-4" />
              <span className="sr-only">{t('view')}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t('toggleColumns')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table
              .getAllColumns()
              .filter(
                (column) =>
                  typeof column.accessorFn !== 'undefined' && column.getCanHide()
              )
              .map((column) => {
                const translatedHeader = columnTranslations[column.id] || column.id;
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  >
                    {translatedHeader}
                  </DropdownMenuCheckboxItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
