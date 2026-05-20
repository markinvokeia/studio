'use client';

import { Loader2, Wand2 } from 'lucide-react';
import * as React from 'react';

import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface MagicWandButtonProps {
    onEnhance: () => Promise<void>;
    disabled?: boolean;
    tooltipText?: string;
    className?: string;
}

export function MagicWandButton({
    onEnhance,
    disabled = false,
    tooltipText,
    className,
}: MagicWandButtonProps) {
    const [isLoading, setIsLoading] = React.useState(false);

    const handleClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isLoading || disabled) return;
        setIsLoading(true);
        try {
            await onEnhance();
        } finally {
            setIsLoading(false);
        }
    };

    const button = (
        <button
            type="button"
            onClick={handleClick}
            disabled={disabled || isLoading}
            className={cn(
                'relative flex items-center justify-center h-6 w-6 rounded-md',
                'text-purple-500 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/40',
                'transition-colors duration-150',
                'disabled:cursor-not-allowed disabled:opacity-40',
                className,
            )}
        >
            {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
                <Wand2 className="h-3.5 w-3.5" />
            )}
        </button>
    );

    if (!tooltipText) return button;

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px] text-xs">
                    <p>{tooltipText}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
