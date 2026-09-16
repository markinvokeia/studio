'use client';

import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

import { API_ROUTES } from '@/constants/routes';
import { AuditLog } from '@/lib/types';
import { cn, formatDateTime } from '@/lib/utils';
import { api } from '@/services/api';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';

const OPERATION_BADGE_VARIANT: Record<string, 'success' | 'secondary' | 'destructive'> = {
    INSERT: 'success',
    UPDATE: 'secondary',
    DELETE: 'destructive',
};

// Columns of `appointments` that carry a datetime and should be formatted as such
// when they show up in a diff (the row itself gives no type info to lean on).
const DATETIME_FIELDS = new Set(['start_datetime', 'end_datetime', 'created_at', 'updated_at']);

function formatFieldValue(field: string, value: any): string {
    if (value === null || value === undefined || value === '') return '—';
    if (DATETIME_FIELDS.has(field)) return formatDateTime(String(value));
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    return String(value);
}

function parseJsonValue(value: any): Record<string, any> | null {
    if (!value) return null;
    if (typeof value === 'object') return value;
    try {
        const parsed = JSON.parse(value);
        return typeof parsed === 'object' && parsed !== null ? parsed : null;
    } catch {
        return null;
    }
}

async function fetchAppointmentHistory(appointmentId: string): Promise<AuditLog[]> {
    try {
        const responseData = await api.get(API_ROUTES.SYSTEM.AUDIT_LOG_ENTITY_HISTORY, {
            table_name: 'appointments',
            record_id: appointmentId,
            limit: '50',
            page: '1',
        });
        const data = Array.isArray(responseData) && responseData.length > 0 ? responseData[0] : responseData;
        const rows = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
        return rows.map((row: any) => ({
            id: row.id ? String(row.id) : `aud_${Math.random().toString(36).slice(2, 9)}`,
            changed_at: row.changed_at,
            changed_by: row.changed_by,
            changed_by_name: row.changed_by_name,
            table_name: row.table_name,
            record_id: String(row.record_id),
            operation: row.operation,
            old_value: row.old_value,
            new_value: row.new_value,
        }));
    } catch (error) {
        console.error('Failed to fetch appointment history:', error);
        return [];
    }
}

interface HistoryEntryProps {
    entry: AuditLog;
    fieldLabel: (field: string) => string;
    operationLabel: (operation: string) => string;
}

function HistoryEntry({ entry, fieldLabel, operationLabel }: HistoryEntryProps) {
    const [expanded, setExpanded] = React.useState(false);
    const oldValues = parseJsonValue(entry.old_value);
    const newValues = parseJsonValue(entry.new_value);
    const changedFields = entry.operation === 'UPDATE'
        ? Array.from(new Set([...(oldValues ? Object.keys(oldValues) : []), ...(newValues ? Object.keys(newValues) : [])]))
        : [];
    const canExpand = entry.operation === 'UPDATE' && changedFields.length > 0;

    return (
        <div className="rounded-lg border border-border/70 px-3 py-2.5">
            <button
                type="button"
                onClick={() => canExpand && setExpanded((v) => !v)}
                className={cn('flex w-full items-center gap-2 text-left', canExpand ? 'cursor-pointer' : 'cursor-default')}
                disabled={!canExpand}
            >
                <Badge variant={OPERATION_BADGE_VARIANT[entry.operation] || 'secondary'} className="shrink-0">
                    {operationLabel(entry.operation)}
                </Badge>
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {formatDateTime(entry.changed_at)}
                    {entry.changed_by_name ? ` · ${entry.changed_by_name}` : ''}
                </span>
                {canExpand && (
                    <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
                )}
            </button>
            {expanded && canExpand && (
                <div className="mt-2 space-y-1.5 border-t border-dashed border-border/70 pt-2">
                    {changedFields.map((field) => (
                        <div key={field} className="grid grid-cols-[auto_1fr] gap-x-2 text-xs">
                            <span className="font-medium text-muted-foreground">{fieldLabel(field)}</span>
                            <span className="min-w-0 truncate">
                                <span className="text-muted-foreground line-through">{formatFieldValue(field, oldValues?.[field])}</span>
                                {' → '}
                                <span className="font-medium text-foreground">{formatFieldValue(field, newValues?.[field])}</span>
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

interface AppointmentHistorySectionProps {
    appointmentId: string;
    /** Only fetch while the panel holding this section is actually open/visible. */
    active: boolean;
}

export function AppointmentHistorySection({ appointmentId, active }: AppointmentHistorySectionProps) {
    const t = useTranslations('AppointmentPanel.history');
    const tAudit = useTranslations('AuditLog');
    const [entries, setEntries] = React.useState<AuditLog[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);

    React.useEffect(() => {
        if (!active || !appointmentId) return;
        let alive = true;
        setIsLoading(true);
        fetchAppointmentHistory(appointmentId).then((rows) => {
            if (alive) setEntries(rows);
        }).finally(() => {
            if (alive) setIsLoading(false);
        });
        return () => { alive = false; };
    }, [active, appointmentId]);

    const operationLabel = React.useCallback((operation: string) => {
        return ['INSERT', 'UPDATE', 'DELETE'].includes(operation)
            ? tAudit(`operations.${operation}` as 'operations.INSERT' | 'operations.UPDATE' | 'operations.DELETE')
            : operation;
    }, [tAudit]);

    const fieldLabel = React.useCallback((field: string) => {
        const key = `fields.${field}`;
        const translated = t(key as any);
        // next-intl returns the key itself when there's no translation for it.
        if (translated === key) {
            return field.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
        }
        return translated;
    }, [t]);

    return (
        <div className="space-y-3">
            {isLoading ? (
                <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
            ) : entries.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('empty')}</p>
            ) : (
                <div className="space-y-2">
                    {entries.map((entry) => (
                        <HistoryEntry key={entry.id} entry={entry} fieldLabel={fieldLabel} operationLabel={operationLabel} />
                    ))}
                </div>
            )}
        </div>
    );
}

export default AppointmentHistorySection;
