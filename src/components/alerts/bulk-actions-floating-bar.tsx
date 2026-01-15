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
    XCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface BulkActionsFloatingBarProps {
    selectedCount: number
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
            <div className="flex items-center gap-2 px-3 py-2 bg-primary rounded-lg border border-primary/20 min-w-fit shadow-sm">
                <div className="w-2 h-2 bg-primary-foreground rounded-full animate-pulse" />
                <span className="text-sm font-semibold text-primary-foreground">
                    {selectedCount} {selectedCount === 1 ? 'seleccionado' : 'seleccionados'}
                </span>
            </div>
            
            {/* Action buttons */}
            <div className="flex items-center gap-1">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onMarkAsCompleted}
                    title="Marcar como completado"
                    className="h-9 w-9 p-0 hover:bg-green-100 hover:text-green-700 dark:hover:bg-green-900/20 dark:hover:text-green-400 transition-colors"
                >
                    <CheckCircle className="h-4 w-4" />
                </Button>
                
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onSendEmail}
                    title="Enviar email"
                    className="h-9 w-9 p-0 hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-900/20 dark:hover:text-blue-400 transition-colors"
                >
                    <Mail className="h-4 w-4" />
                </Button>
                
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onSendSms}
                    title="Enviar SMS"
                    className="h-9 w-9 p-0 hover:bg-purple-100 hover:text-purple-700 dark:hover:bg-purple-900/20 dark:hover:text-purple-400 transition-colors"
                >
                    <MessageSquare className="h-4 w-4" />
                </Button>
                
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onSendWhatsApp}
                    title="Enviar WhatsApp"
                    className="h-9 w-9 p-0 hover:bg-green-100 hover:text-green-700 dark:hover:bg-green-900/20 dark:hover:text-green-400 transition-colors"
                >
                    <MessageCircle className="h-4 w-4" />
                </Button>
                
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onIgnore}
                    title="Ignorar alertas"
                    className="h-9 w-9 p-0 hover:bg-orange-100 hover:text-orange-700 dark:hover:bg-orange-900/20 dark:hover:text-orange-400 transition-colors"
                >
                    <XCircle className="h-4 w-4" />
                </Button>
                
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onSnooze}
                    title="Posponer alertas"
                    className="h-9 w-9 p-0 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800/50 dark:hover:text-gray-400 transition-colors"
                >
                    <Clock className="h-4 w-4" />
                </Button>
                
                <div className="h-6 w-px bg-border mx-1" />
                
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onDeselectAll}
                    title="Deseleccionar todo"
                    className="h-9 w-9 p-0 hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>
        </div>
    )
}