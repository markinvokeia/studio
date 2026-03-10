'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardDescription, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { LucideIcon, X } from 'lucide-react';
import * as React from 'react';

export interface DetailField {
    label: string;
    value: React.ReactNode;
    variant?: 'default' | 'success' | 'destructive' | 'outline' | 'secondary' | 'info';
}

export interface DetailHeaderProps {
    /** Icon to display in the header */
    icon: LucideIcon;
    /** Main title (e.g., patient name) */
    title: string;
    /** Subtitle (e.g., quote ID) */
    subtitle?: string;
    /** Fields to display in the header */
    fields?: DetailField[];
    /** Actions to show in the header */
    actions?: React.ReactNode;
    /** Callback to close the detail panel */
    onClose?: () => void;
    /** Custom className */
    className?: string;
}

export function DetailHeader({
    icon: Icon,
    title,
    subtitle,
    fields = [],
    actions,
    onClose,
    className,
}: DetailHeaderProps) {
    return (
        <div className={cn('flex flex-col gap-3', className)}>
            {/* Main header row with icon, title, and close button */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="header-icon-circle mt-0.5 shrink-0">
                        <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col truncate text-left min-w-0">
                        <CardTitle className="text-lg truncate">{title}</CardTitle>
                        {subtitle && (
                            <CardDescription className="text-xs truncate">{subtitle}</CardDescription>
                        )}
                    </div>
                </div>
                {onClose && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="ml-2 shrink-0"
                    >
                        <X className="h-5 w-5" />
                        <span className="sr-only">Cerrar detalles</span>
                    </Button>
                )}
            </div>

            {/* Key info fields - displayed inline in a row */}
            {fields.length > 0 && (
                <>
                    <Separator className="my-1" />
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                        {fields.map((field, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">{field.label}:</span>
                                {typeof field.value === 'string' || typeof field.value === 'number' ? (
                                    <Badge variant={field.variant || 'default'} className="text-xs font-normal">
                                        {field.value}
                                    </Badge>
                                ) : (
                                    field.value
                                )}
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* Actions row */}
            {actions && (
                <>
                    <Separator className="my-1" />
                    <div className="flex items-center gap-2 flex-wrap">
                        {actions}
                    </div>
                </>
            )}
        </div>
    );
}
