'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import {
    CheckCircle,
    Mail,
    MessageSquare,
    MessageCircle,
    X,
    Clock,
    XCircle,
    Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface BulkActionsFloatingBarProps {
    selectedCount: number
    loadingAction?: 'complete' | 'email' | 'sms' | 'whatsapp' | 'ignore' | 'snooze' | null
    onMarkAsCompleted: () => void
    onSendEmail: () => void
    onSendSms: () => void
    onSendWhatsApp: () => void
    onIgnore: () => void
    onSnooze: () => void
    onDeselectAll: () => void
    className?: string
}

export function BulkActionsFloatingBar({
    selectedCount,
    loadingAction = null,
    onMarkAsCompleted,
    onSendEmail,
    onSendSms,
    onSendWhatsApp,
    onIgnore,
    onSnooze,
    onDeselectAll,
    className
}: BulkActionsFloatingBarProps) {
    if (selectedCount === 0) {
        return null
    }

    return (
        <div className={cn(
            "fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50",
            "bg-background/95 backdrop-blur-sm border border-border rounded-xl shadow-2xl",
            "p-3 flex items-center gap-3",
            "animate-in slide-in-from-bottom-4 fade-in-0 duration-300 ease-out",
            "max-w-[calc(100vw-2rem)] overflow-x-auto",
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
                
<Button
                    variant={loadingAction === 'email' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={onSendEmail}
                    disabled={loadingAction !== null}
                    title="Enviar email"
                    className={cn(
                        "h-9 w-9 p-0 transition-all duration-200",
                        loadingAction === 'email' 
                            ? "bg-blue-500 hover:bg-blue-600 text-white animate-pulse" 
                            : "hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-900/20 dark:hover:text-blue-400",
                        loadingAction && loadingAction !== 'email' ? "opacity-50 cursor-not-allowed" : ""
                    )}
                >
                    {loadingAction === 'email' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Mail className="h-4 w-4" />
                    )}
                </Button>
                
                <Button
                    variant={loadingAction === 'whatsapp' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={onSendWhatsApp}
                    disabled={true}
                    title="Enviar WhatsApp (deshabilitado)"
                    className={cn(
                        "h-9 w-9 p-0 transition-all duration-200 opacity-50 cursor-not-allowed",
                        loadingAction === 'whatsapp' 
                            ? "bg-green-500 hover:bg-green-600 text-white animate-pulse" 
                            : "hover:bg-green-100 hover:text-green-700 dark:hover:bg-green-900/20 dark:hover:text-green-400",
                        loadingAction && loadingAction !== 'whatsapp' ? "opacity-50 cursor-not-allowed" : ""
                    )}
                >
                    {loadingAction === 'whatsapp' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <MessageCircle className="h-4 w-4" />
                    )}
                </Button>
                
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