
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
import { PlusCircle, RefreshCw, SlidersHorizontal, Filter, Search } from 'lucide-react';
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
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2">
        <div className="relative flex items-center">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={filterPlaceholder}
            value={(table.getColumn(filterColumnId)?.getFilterValue() as string) ?? ''}
            onChange={(event) =>
              table.getColumn(filterColumnId)?.setFilterValue(event.target.value)
            }
            className="h-9 w-[150px] lg:w-[250px] pl-9"
          />
        </div>
        {filterOptions && onFilterChange && (
          <Select value={filterValue || 'all'} onValueChange={onFilterChange}>
            <SelectTrigger className="h-9 w-[150px]">
              <div className="flex items-center">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
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
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size={createButtonIconOnly ? "icon" : "sm"} className={createButtonIconOnly ? "h-9 w-9" : "h-9"} onClick={onCreate}>
                  <PlusCircle className={createButtonIconOnly ? "h-4 w-4" : "mr-2 h-4 w-4"} />
                  {createButtonIconOnly ? <span className="sr-only">{createButtonLabel || 'Create'}</span> : (createButtonLabel || 'Create')}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{createButtonLabel || 'Create'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {onRefresh && (
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="sr-only">Refresh</span>
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="ml-auto h-9 w-9 lg:flex">
              <SlidersHorizontal className="h-4 w-4" />
              <span className="sr-only">View</span>
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
