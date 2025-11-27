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

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  filterColumnId: string;
  filterPlaceholder: string;
  onCreate?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  columnTranslations?: { [key: string]: string };
  extraButtons?: React.ReactNode;
  filterOptions?: { label: string; value: string }[];
  onFilterChange?: (value: string) => void;
  filterValue?: string;
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
  filterOptions,
  onFilterChange,
  filterValue
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
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9">
                    <Filter className="mr-2 h-4 w-4" />
                    Filter
                </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                <DropdownMenuLabel>Filter by Type</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                    checked={filterValue === 'all'}
                    onCheckedChange={() => onFilterChange('all')}
                >
                    All
                </DropdownMenuCheckboxItem>
                {filterOptions.map((option) => (
                    <DropdownMenuCheckboxItem
                    key={option.value}
                    checked={filterValue === option.value}
                    onCheckedChange={() => onFilterChange(option.value)}
                    >
                    {option.label}
                    </DropdownMenuCheckboxItem>
                ))}
                </DropdownMenuContent>
            </DropdownMenu>
            )}
      </div>
      <div className="flex items-center space-x-2">
        {onCreate && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" className="h-9" onClick={onCreate}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Create
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Create</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {extraButtons}
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