'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import {
    CheckCircle,
    Mail,
    MessageCircle,
    X,
    Clock,
    Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface BulkActionsFloatingBarProps {
    selectedCount: number
    loadingAction?: 'complete' | 'email' | 'snooze' | 'whatsapp' | null
    onMarkAsCompleted: () => void
    onSendEmail: () => void
    onSnooze: () => void
    onSendWhatsApp: () => void
    onDeselectAll: () => void
    className?: string
    canComplete?: boolean
    canSendEmail?: boolean
    canSnooze?: boolean
    canSendWhatsApp?: boolean
    /** How many of the currently selected alerts have a phone + WhatsApp template available. */
    whatsAppEligibleCount?: number
}

export function BulkActionsFloatingBar({
    selectedCount,
    loadingAction = null,
    onMarkAsCompleted,
    onSendEmail,
    onSnooze,
    onSendWhatsApp,
    onDeselectAll,
    className,
    canComplete = true,
    canSendEmail = true,
    canSnooze = true,
    canSendWhatsApp = true,
    whatsAppEligibleCount = 0,
}: BulkActionsFloatingBarProps) {
    if (selectedCount === 0) {
        return null
    }

    return (
        <div className={cn(
            "fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50",
            "bg-background/95 backdrop-blur-sm border border-border rounded-xl shadow-2xl",
            "p-3 flex flex-wrap items-center justify-center gap-2",
            "w-[calc(100vw-2rem)] sm:w-auto",
            "animate-in slide-in-from-bottom-4 fade-in-0 duration-300 ease-out",
            "transition-all duration-200 hover:shadow-3xl",
            className
        )}>
            {/* Selected count indicator */}
            <div className={cn(
                "flex items-center gap-2 px-3 py-2 bg-primary rounded-lg border border-primary/20 min-w-fit shadow-sm",
                loadingAction && "animate-pulse"
            )}>
                {loadingAction ? (
                    <Loader2 className="w-4 h-4 text-primary-foreground animate-spin" />
                ) : (
                    <div className="w-2 h-2 bg-primary-foreground rounded-full animate-pulse" />
                )}
                <span className="text-sm font-semibold text-primary-foreground">
                    {loadingAction ? 
                        `Procesando ${selectedCount} ${selectedCount === 1 ? 'alerta...' : 'alertas...'}` : 
                        `${selectedCount} ${selectedCount === 1 ? 'seleccionado' : 'seleccionados'}`
                    }
                </span>
            </div>
            
            {/* Action buttons */}
            <div className="flex items-center gap-1">
                {canComplete && (
                <Button
                    variant={loadingAction === 'complete' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={onMarkAsCompleted}
                    disabled={loadingAction !== null}
                    title="Marcar como completado"
                    className={cn(
                        "h-9 w-9 p-0 transition-all duration-200",
                        loadingAction === 'complete' 
                            ? "bg-green-500 hover:bg-green-600 text-white animate-pulse" 
                            : "hover:bg-green-100 hover:text-green-700 dark:hover:bg-green-900/20 dark:hover:text-green-400",
                        loadingAction && loadingAction !== 'complete' ? "opacity-50 cursor-not-allowed" : ""
                    )}
                >
                    {loadingAction === 'complete' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <CheckCircle className="h-4 w-4" />
                    )}
                </Button>
                )}
                
                {canSendEmail && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onSendEmail}
                    disabled={loadingAction !== null || selectedCount !== 1}
                    title={selectedCount !== 1 ? 'Seleccioná exactamente 1 alerta para enviar email' : 'Enviar email'}
                    className={cn(
                        "h-9 w-9 p-0 transition-all duration-200",
                        "hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-900/20 dark:hover:text-blue-400",
                        (loadingAction !== null || selectedCount !== 1) ? "opacity-50 cursor-not-allowed" : ""
                    )}
                >
                    <Mail className="h-4 w-4" />
                </Button>
                )}

                {canSnooze && (
                <Button
                    variant={loadingAction === 'snooze' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={onSnooze}
                    disabled={loadingAction !== null}
                    title="Posponer alertas"
                    className={cn(
                        "h-9 w-9 p-0 transition-all duration-200",
                        loadingAction === 'snooze'
                            ? "bg-gray-500 hover:bg-gray-600 text-white animate-pulse"
                            : "hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800/50 dark:hover:text-gray-400",
                        loadingAction && loadingAction !== 'snooze' ? "opacity-50 cursor-not-allowed" : ""
                    )}
                >
                    {loadingAction === 'snooze' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Clock className="h-4 w-4" />
                    )}
                </Button>
                )}

                {canSendWhatsApp && (
                <Button
                    variant={loadingAction === 'whatsapp' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={onSendWhatsApp}
                    disabled={loadingAction !== null || whatsAppEligibleCount === 0}
                    title={whatsAppEligibleCount === 0 ? 'Ninguna alerta seleccionada tiene WhatsApp disponible' : `Enviar WhatsApp (${whatsAppEligibleCount} disponible${whatsAppEligibleCount === 1 ? '' : 's'})`}
                    className={cn(
                        "h-9 w-9 p-0 transition-all duration-200",
                        loadingAction === 'whatsapp'
                            ? "bg-emerald-500 hover:bg-emerald-600 text-white animate-pulse"
                            : "hover:bg-emerald-100 hover:text-emerald-700 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400",
                        (loadingAction && loadingAction !== 'whatsapp') || whatsAppEligibleCount === 0 ? "opacity-50 cursor-not-allowed" : ""
                    )}
                >
                    {loadingAction === 'whatsapp' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <MessageCircle className="h-4 w-4" />
                    )}
                </Button>
                )}

                <div className="h-6 w-px bg-border mx-1" />
                
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onDeselectAll}
                    disabled={loadingAction !== null}
                    title="Deseleccionar todo"
                    className="h-9 w-9 p-0 hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>
        </div>
    )
}