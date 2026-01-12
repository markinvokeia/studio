
'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertScheduleRun } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { AlertCircle, CheckCircle, Clock, Database, Mail, MessageSquare, Play, Terminal } from 'lucide-react';

interface ExecutionDetailDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    run: AlertScheduleRun | null;
}

export function ExecutionDetailDialog({ open, onOpenChange, run }: ExecutionDetailDialogProps) {
    const t = useTranslations('ExecutionHistoryPage.detailDialog');

    if (!run) return null;

    const getStatusVariant = (status: string) => {
        const s = status.toLowerCase();
        return s === 'completed' || s === 'success' || s === 'sent' || s === 'delivered' ? 'success' :
            s === 'failed' || s === 'error' || s === 'bounced' ? 'destructive' : 'secondary';
    };

    const parseExecutionLog = (log: any): string => {
        if (!log) return t('noExecutionLog');
        if (typeof log === 'string') {
            try {
                const parsed = JSON.parse(log);
                return JSON.stringify(parsed, null, 2);
            } catch {
                return log;
            }
        }
        return JSON.stringify(log, null, 2);
    };

    const parseErrorDetails = (details: any): any[] => {
        if (!details) return [];
        if (Array.isArray(details)) return details;
        if (typeof details === 'string') {
            try {
                return JSON.parse(details);
            } catch {
                return [];
            }
        }
        if (details.error_details && Array.isArray(details.error_details)) {
            return details.error_details;
        }
        return [];
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[80vh]">
                <DialogHeader>
                    <DialogTitle>{t('title')}</DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[calc(80vh-100px)] pr-4">
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">{t('runDate')}</p>
                                <p className="font-medium">{format(new Date(run.run_date), 'yyyy-MM-dd HH:mm')}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">{t('startedAt')}</p>
                                <p className="font-medium">{format(new Date(run.started_at), 'yyyy-MM-dd HH:mm:ss')}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">{t('completedAt')}</p>
                                <p className="font-medium">{run.completed_at ? format(new Date(run.completed_at), 'yyyy-MM-dd HH:mm:ss') : 'N/A'}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">{t('triggeredBy')}</p>
                                <p className="font-medium">{run.triggered_by}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <div className="bg-muted p-3 rounded-lg text-center">
                                <Database className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                                <p className="text-2xl font-bold">{run.rules_processed}</p>
                                <p className="text-xs text-muted-foreground">{t('rulesProcessed')}</p>
                            </div>
                            <div className="bg-muted p-3 rounded-lg text-center">
                                <Play className="h-5 w-5 mx-auto mb-1 text-blue-500" />
                                <p className="text-2xl font-bold">{run.alerts_created}</p>
                                <p className="text-xs text-muted-foreground">{t('alertsCreated')}</p>
                            </div>
                            <div className="bg-muted p-3 rounded-lg text-center">
                                <Play className="h-5 w-5 mx-auto mb-1 text-orange-500" />
                                <p className="text-2xl font-bold">{run.alerts_skipped}</p>
                                <p className="text-xs text-muted-foreground">{t('alertsSkipped')}</p>
                            </div>
                            <div className="bg-muted p-3 rounded-lg text-center">
                                <Mail className="h-5 w-5 mx-auto mb-1 text-green-500" />
                                <p className="text-2xl font-bold">{run.emails_sent}</p>
                                <p className="text-xs text-muted-foreground">{t('emailsSent')}</p>
                            </div>
                            <div className="bg-muted p-3 rounded-lg text-center">
                                <MessageSquare className="h-5 w-5 mx-auto mb-1 text-purple-500" />
                                <p className="text-2xl font-bold">{run.sms_sent}</p>
                                <p className="text-xs text-muted-foreground">{t('smsSent')}</p>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                                <Terminal className="h-5 w-5" />
                                {t('executionLog')}
                            </h3>
                            <div className="bg-black rounded-lg p-4 max-h-64 overflow-auto">
                                <pre className="text-green-400 text-xs font-mono whitespace-pre-wrap">
                                    {parseExecutionLog(run.execution_log)}
                                </pre>
                            </div>
                        </div>

                        {run.errors_count > 0 && (
                            <div>
                                <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                                    <AlertCircle className="h-5 w-5 text-destructive" />
                                    {t('errorDetails')}
                                    <Badge variant="destructive">{run.errors_count}</Badge>
                                </h3>
                                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 max-h-64 overflow-auto">
                                    {(() => {
                                        const errors = parseErrorDetails(run.error_details);
                                        if (errors.length === 0) {
                                            return <p className="text-muted-foreground">{t('noErrors')}</p>;
                                        }
                                        return (
                                            <div className="space-y-3">
                                                {errors.map((error: any, index: number) => (
                                                    <div key={index} className="bg-background/50 p-3 rounded border border-destructive/20">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <AlertCircle className="h-4 w-4 text-destructive" />
                                                            <span className="font-medium">{error.rule_name || error.rule || error.id || `Error ${index + 1}`}</span>
                                                        </div>
                                                        <p className="text-sm text-muted-foreground">{error.message || error.error || JSON.stringify(error)}</p>
                                                        {error.timestamp && (
                                                            <p className="text-xs text-muted-foreground mt-1">{format(new Date(error.timestamp), 'yyyy-MM-dd HH:mm:ss')}</p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">{t('status')}:</span>
                            <Badge variant={getStatusVariant(run.status)} className="capitalize">{run.status}</Badge>
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
