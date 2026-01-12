'use client';

import * as React from 'react';
import { Table } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuCheckboxItem,
    DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';
import { Filter, X, Search, ChevronDown, Check, PlusCircle, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export interface FilterOption {
    value: string;
    label: string;
    group?: string;
    onSelect?: () => void;
    isActive?: boolean;
}

interface DataTableAdvancedToolbarProps<TData> {
    table?: Table<TData>;
    filterPlaceholder?: string;
    searchQuery?: string;
    onSearchChange?: (value: string) => void;
    filters?: FilterOption[];
    onClearFilters?: () => void;
    onCreate?: () => void;
    onRefresh?: () => void;
    isRefreshing?: boolean;
    createButtonLabel?: string;
    createButtonIconOnly?: boolean;
    extraButtons?: React.ReactNode;
    columnTranslations?: { [key: string]: string };
}

export function DataTableAdvancedToolbar<TData>({
    table,
    filterPlaceholder,
    searchQuery = '',
    onSearchChange,
    filters = [],
    onClearFilters,
    onCreate,
    onRefresh,
    isRefreshing,
    createButtonLabel,
    createButtonIconOnly,
    extraButtons,
    columnTranslations = {},
}: DataTableAdvancedToolbarProps<TData>) {
    const t = useTranslations('DataTableToolbar');
    const inputRef = React.useRef<HTMLInputElement>(null);

    const activeFilters = filters.filter((f) => f.isActive);
    const hasActiveFilters = activeFilters.length > 0;

    // Group filters by their 'group' property
    const groupedFilters = filters.reduce((acc, filter) => {
        const groupName = filter.group || 'Other';
        if (!acc[groupName]) {
            acc[groupName] = [];
        }
        acc[groupName].push(filter);
        return acc;
    }, {} as Record<string, FilterOption[]>);

    return (
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 items-center space-x-2 w-full overflow-x-auto">
                {/* Advanced Search Input Wrapper */}
                <div
                    className="flex h-10 w-full max-w-[600px] min-w-0 items-center rounded-md border border-input bg-background px-3 py-1 ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
                    onClick={() => inputRef.current?.focus()}
                >
                    <Search className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />

                    {/* Active Filter Chips */}
                    <div className="flex flex-wrap gap-1 mr-2">
                        {activeFilters.map((filter) => (
                            <div
                                key={filter.value}
                                className="flex items-center rounded-sm bg-primary/20 text-primary px-2 py-0.5 text-xs font-medium"
                            >
                                {filter.group ? <span className="mr-1 opacity-70">{filter.group}:</span> : null}
                                {filter.label}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="ml-1 h-3 w-3 p-0 hover:bg-transparent"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        filter.onSelect?.();
                                    }}
                                >
                                    <X className="h-3 w-3" />
                                    <span className="sr-only">Remove {filter.label}</span>
                                </Button>
                            </div>
                        ))}
                    </div>

                    <Input
                        ref={inputRef}
                        placeholder={filterPlaceholder}
                        value={searchQuery}
                        onChange={(event) => onSearchChange?.(event.target.value)}
                        className="flex-1 border-0 bg-transparent p-0 text-sm placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 outline-none h-auto"
                    />

                    {/* Filter Dropdown Trigger inside Input */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="ml-2 h-6 px-2 text-muted-foreground hover:text-foreground shrink-0"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <Filter className="h-4 w-4" />
                                <ChevronDown className="ml-1 h-3 w-3" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-[200px]">
                            <DropdownMenuLabel>{t('filter')}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {Object.entries(groupedFilters).map(([group, groupFilters], index) => (
                                <React.Fragment key={group}>
                                    {group !== 'Other' && (
                                        <>
                                            {index > 0 && <DropdownMenuSeparator />}
                                            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal pb-1">
                                                {group}
                                            </DropdownMenuLabel>
                                        </>
                                    )}
                                    {groupFilters.map((filter) => (
                                        <DropdownMenuItem
                                            key={filter.value}
                                            className="flex items-center justify-between"
                                            onSelect={(e) => {
                                                e.preventDefault();
                                                filter.onSelect?.();
                                            }}
                                        >
                                            <span className={cn(filter.isActive && "font-medium")}>{filter.label}</span>
                                            {filter.isActive && <Check className="h-4 w-4" />}
                                        </DropdownMenuItem>
                                    ))}
                                </React.Fragment>
                            ))}
                            {hasActiveFilters && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        onSelect={() => onClearFilters?.()}
                                        className="justify-center text-center text-destructive focus:text-destructive"
                                    >
                                        {t('clear')}
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {searchQuery && (
                        <Button
                            variant="ghost"
                            onClick={(e) => {
                                e.stopPropagation();
                                onSearchChange?.('');
                            }}
                            className="h-6 w-6 p-0 hover:bg-transparent text-muted-foreground hover:text-foreground ml-1"
                        >
                            <X className="h-4 w-4" />
                            <span className="sr-only">Clear Search</span>
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex items-center space-x-2 w-full md:w-auto justify-end">
                {onCreate && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="outline" size={createButtonIconOnly ? "icon" : "sm"} className={createButtonIconOnly ? "h-9 w-9" : "h-9"} onClick={onCreate}>
                                    <PlusCircle className={createButtonIconOnly ? "h-4 w-4" : "mr-2 h-4 w-4"} />
                                    {createButtonIconOnly ? <span className="sr-only">{createButtonLabel || t('create')}</span> : (createButtonLabel || t('create'))}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{createButtonLabel || t('create')}</p>
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
                        <span className="sr-only">{t('refresh')}</span>
                    </Button>
                )}
                {table && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="ml-auto h-9 w-9 lg:flex">
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
                )}
                {extraButtons}
            </div>
        </div>
    );
}
