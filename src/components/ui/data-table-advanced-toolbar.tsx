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
} from '@/components/ui/dropdown-menu';
import { Filter, X, Search, ChevronDown, Check, PlusCircle, RefreshCw, SlidersHorizontal, Settings2 } from 'lucide-react';
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
    isCompact?: boolean;
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
    isCompact = false,
}: DataTableAdvancedToolbarProps<TData>) {
    const t = useTranslations('DataTableToolbar');
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [showSearch, setShowSearch] = React.useState(false);

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

    const SearchBar = (
        <div
            className="flex h-9 w-full items-center rounded-md border border-input bg-background ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1 overflow-hidden"
            onClick={() => inputRef.current?.focus()}
        >


            <div className="flex items-center px-3 flex-none">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            </div>

            <div className="flex flex-1 items-center gap-1.5 min-w-0 overflow-hidden">
{/* Active Filter Chips - moved outside search bar */}

                <Input
                    ref={inputRef}
                    placeholder={filterPlaceholder}
                    value={searchQuery}
                    onChange={(event) => onSearchChange?.(event.target.value)}
                    className="flex-1 min-w-[80px] border-0 bg-transparent py-0 px-1 text-sm placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 outline-none h-full"
                />
            </div>

            {/* Actions Group inside Input */}
            <div className="flex items-center shrink-0 h-full pr-1.5">
                {searchQuery && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                            e.stopPropagation();
                            onSearchChange?.('');
                        }}
                        className="h-7 w-7 p-0 hover:bg-muted text-muted-foreground hover:text-foreground mr-1"
                    >
                        <X className="h-3.5 w-3.5" />
                        <span className="sr-only">Clear Search</span>
                    </Button>
                )}

                <div className="h-4 w-[1px] bg-border mx-1" />

                {filters.length > 0 && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <SlidersHorizontal className="h-3.5 w-3.5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[200px] z-50">
                            <DropdownMenuLabel className="text-xs">{t('advancedFilters') || 'Advanced Filters'}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {Object.entries(groupedFilters).map(([group, groupFilters], index) => (
                                <React.Fragment key={group}>
                                    {group !== 'Other' && (
                                        <>
                                            {index > 0 && <DropdownMenuSeparator />}
                                            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold pb-1">
                                                {group}
                                            </DropdownMenuLabel>
                                        </>
                                    )}
                                    {groupFilters.map((filter) => (
                                        <DropdownMenuItem
                                            key={filter.value}
                                            className="flex items-center justify-between text-sm py-1.5"
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
                                        className="justify-center text-center text-destructive focus:text-destructive text-sm"
                                    >
                                        {t('clear')}
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
        </div>
    );

    return (
        <div className="flex flex-col gap-y-2 w-full">
            <div className="flex items-center justify-between gap-x-4 w-full">
                <div className="flex items-center gap-2 flex-grow min-w-0">
                    {isCompact ? (
                        <div className="flex items-center gap-2">
                            <Button
                                variant={showSearch ? "secondary" : "outline"}
                                size="icon"
                                className="h-9 w-9 shrink-0"
                                onClick={() => setShowSearch(!showSearch)}
                            >
                                <Search className="h-4 w-4" />
                                <span className="sr-only">Toggle Search</span>
                            </Button>
                            {hasActiveFilters && !showSearch && (
                                <div className="flex -space-x-1 overflow-hidden">
                                    {activeFilters.slice(0, 3).map((f) => (
                                        <div key={f.value} className="h-5 w-5 rounded-full border bg-primary/20 text-[8px] flex items-center justify-center font-bold text-primary ring-2 ring-background uppercase">
                                            {f.label.charAt(0)}
                                        </div>
                                    ))}
                                    {activeFilters.length > 3 && (
                                        <div className="h-5 w-5 rounded-full border bg-muted text-[8px] flex items-center justify-center font-bold ring-2 ring-background">
                                            +{activeFilters.length - 3}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="w-full sm:max-w-[724px]">
                            {SearchBar}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
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
                                <Button variant="outline" size="icon" className="h-9 w-9">
                                    <Settings2 className="h-4 w-4" />
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

            

            {isCompact && showSearch && (
                <div className="w-full animate-in fade-in slide-in-from-top-2 duration-200">
                    {SearchBar}
                </div>
            )}
        </div>
    );
}
