'use client';

import { Button, ButtonProps } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import * as React from 'react';

export interface ActionButtonProps extends Omit<ButtonProps, 'children'> {
    icon: LucideIcon;
    label: string;
    tooltip: string;
    /** If true, shows only icon even without hover (for use in tight spaces) */
    iconOnly?: boolean;
    /** If true, expands to show label on hover/focus */
    expandOnHover?: boolean;
    /** Show destructive style */
    destructive?: boolean;
}

export const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
    ({ className, icon: Icon, label, tooltip, iconOnly = false, expandOnHover = false, destructive = false, disabled, ...props }, ref) => {
        // Always show icon and label together (expanded mode)
        // expandOnHover is kept for backward compatibility but label always shows
        const showLabel = !iconOnly;

        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            ref={ref}
                            className={cn(
                                'transition-all duration-200 px-3',
                                destructive && 'text-destructive hover:text-destructive',
                                className
                            )}
                            disabled={disabled}
                            size="sm"
                            variant={disabled ? 'ghost' : (destructive ? 'ghost' : 'outline')}
                            {...props}
                        >
                            <Icon className="h-4 w-4 shrink-0" />
                            {showLabel && (
                                <span className={cn('ml-2 whitespace-nowrap')}>
                                    {label}
                                </span>
                            )}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[200px]">
                        <p>{tooltip}</p>
                        {disabled && <p className="text-destructive text-xs mt-1">No tiene permiso</p>}
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }
);

ActionButton.displayName = 'ActionButton';

// Compact version for use in toolbars - always icon only with tooltip
export interface CompactActionButtonProps extends Omit<ButtonProps, 'children'> {
    icon: LucideIcon;
    tooltip: string;
    /** Show a destructive variant */
    destructive?: boolean;
}

export const CompactActionButton = React.forwardRef<HTMLButtonElement, CompactActionButtonProps>(
    ({ className, icon: Icon, tooltip, destructive = false, disabled, ...props }, ref) => {
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            ref={ref}
                            className={cn('h-8 w-8 p-0', destructive && 'text-destructive hover:text-destructive', className)}
                            disabled={disabled}
                            size="icon"
                            variant="ghost"
                            {...props}
                        >
                            <Icon className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                        <p>{tooltip}</p>
                        {disabled && <p className="text-destructive text-xs mt-1">No tiene permiso</p>}
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }
);

CompactActionButton.displayName = 'CompactActionButton';
