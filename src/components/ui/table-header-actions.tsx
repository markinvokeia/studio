'use client';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { LucideIcon, PlusCircle, RefreshCw, Settings2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

export interface TableAction {
    /** Unique identifier */
    id: string;
    /** Icon to display */
    icon: LucideIcon;
    /** Label for the action (shown on hover) */
    label: string;
    /** Whether the action is enabled */
    disabled?: boolean;
    /** Callback when clicked */
    onClick: () => void;
    /** If true, shows destructive style */
    destructive?: boolean;
}

export interface TableHeaderActionsProps {
    /** Create button configuration */
    onCreate?: () => void;
    createLabel?: string;
    canCreate?: boolean;
    /** Refresh button configuration */
    onRefresh?: () => void;
    isRefreshing?: boolean;
    canRefresh?: boolean;
    /** Table actions (edit, delete, etc.) */
    actions?: TableAction[];
    /** Show column settings */
    showColumnSettings?: boolean;
    onColumnSettingsClick?: () => void;
    /** Additional buttons */
    extraButtons?: React.ReactNode;
    /** Custom className */
    className?: string;
}

export function TableHeaderActions({
    onCreate,
    createLabel,
    canCreate = true,
    onRefresh,
    isRefreshing,
    canRefresh = true,
    actions = [],
    showColumnSettings = false,
    onColumnSettingsClick,
    extraButtons,
    className,
}: TableHeaderActionsProps) {
    const t = useTranslations('DataTableToolbar');

    return (
        <div className={cn('flex items-center gap-2 shrink-0', className)}>
            {/* Actions - shown before Create button */}
            {actions.length > 0 && (
                <>
                    <div className="flex items-center gap-1">
                        {actions.map((action) => (
                            <Button
                                key={action.id}
                                variant="ghost"
                                size="icon"
                                className={cn(
                                    'h-8 w-8',
                                    action.destructive && 'text-destructive hover:text-destructive'
                                )}
                                onClick={action.onClick}
                                disabled={action.disabled}
                                title={action.label}
                            >
                                <action.icon className="h-4 w-4" />
                            </Button>
                        ))}
                    </div>
                    <Separator orientation="vertical" className="h-6" />
                </>
            )}

            {/* Create button */}
            {onCreate && canCreate && (
                <Button size="sm" className="h-9" onClick={onCreate}>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    {createLabel || t('create')}
                </Button>
            )}

            {/* Refresh button */}
            {onRefresh && (
                <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={onRefresh}
                    disabled={isRefreshing || !canRefresh}
                    title={t('refresh')}
                >
                    <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
                </Button>
            )}

            {/* Column settings */}
            {showColumnSettings && onColumnSettingsClick && (
                <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={onColumnSettingsClick}
                    title={t('view')}
                >
                    <Settings2 className="h-4 w-4" />
                </Button>
            )}

            {/* Extra buttons */}
            {extraButtons}
        </div>
    );
}
