'use client';

import * as React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { CalendarPlus, Inbox, Pencil, Send, Trash2, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { createSelectColumn } from '@/components/ui/table-select-column';

import { StudyOrderStatusBadge } from '@/components/study-orders/study-order-status-badge';

import { formatDisplayDate } from '@/lib/utils';
import type { StudyOrderListItem } from '@/lib/types';

/**
 * Columnas de la bandeja. Las dos pantallas (Mis Órdenes y Órdenes) comparten
 * la definición: la única diferencia es la columna del derivador, que sólo tiene
 * sentido cuando se ven órdenes de varios doctores.
 *
 * Se llama como función, no como componente — es la convención del repo para
 * los `*ColumnsWrapper`, y por eso el archivo lleva 'use client' (usa hooks).
 */

export interface StudyOrderColumnsProps {
    /** `clinic` agrega la columna del derivador y las acciones de la clínica. */
    scope: 'mine' | 'clinic';
    onEdit?: (order: StudyOrderListItem) => void;
    onSubmit?: (order: StudyOrderListItem) => void;
    onDelete?: (order: StudyOrderListItem) => void;
    onAcknowledge?: (order: StudyOrderListItem) => void;
    onSchedule?: (order: StudyOrderListItem) => void;
    onCancel?: (order: StudyOrderListItem) => void;
}

interface RowActionProps {
    label: string;
    icon: React.ElementType;
    onClick: () => void;
    destructive?: boolean;
    /** Motivo por el que no se puede usar. Presente = botón gris con explicación. */
    disabledReason?: string;
}

function RowAction({ label, icon: Icon, onClick, destructive, disabledReason }: RowActionProps) {
    const isDisabled = !!disabledReason;
    return (
        <button
            type="button"
            // `title` alcanza acá: en una celda de tabla un tooltip de Radix por
            // fila serían decenas de proveedores montados a la vez.
            title={disabledReason ?? label}
            aria-label={label}
            disabled={isDisabled}
            onClick={isDisabled ? undefined : onClick}
            className={
                'flex flex-col items-center gap-0.5 rounded px-1.5 py-1 transition-colors ' +
                (isDisabled ? 'cursor-not-allowed opacity-40 ' : 'hover:bg-accent ') +
                (destructive ? 'text-destructive' : 'text-muted-foreground')
            }
        >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="text-[9px] leading-none">{label}</span>
        </button>
    );
}

export const StudyOrderColumnsWrapper = ({
    scope,
    onEdit,
    onSubmit,
    onDelete,
    onAcknowledge,
    onSchedule,
    onCancel,
}: StudyOrderColumnsProps): ColumnDef<StudyOrderListItem>[] => {
    const t = useTranslations('StudyOrdersPage.columns');
    const tActions = useTranslations('StudyOrdersPage.actions');

    const columns: ColumnDef<StudyOrderListItem>[] = [
        createSelectColumn<StudyOrderListItem>(),
        {
            accessorKey: 'order_number',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('orderNumber')} />,
            cell: ({ row }) => (
                <span className="font-mono text-xs tabular-nums">{row.original.order_number}</span>
            ),
        },
        {
            accessorKey: 'patient_name',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('patient')} />,
            cell: ({ row }) => (
                <div className="min-w-0">
                    <div className="truncate font-medium">{row.original.patient_name}</div>
                    {row.original.patient_document && (
                        <div className="truncate text-xs text-muted-foreground">{row.original.patient_document}</div>
                    )}
                </div>
            ),
        },
    ];

    if (scope === 'clinic') {
        columns.push({
            accessorKey: 'doctor_name',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('doctor')} />,
            cell: ({ row }) => (
                <span className="truncate text-sm">{row.original.doctor_name ?? '—'}</span>
            ),
        });
    }

    columns.push(
        {
            id: 'items',
            accessorKey: 'items_summary',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('items')} />,
            enableSorting: false,
            cell: ({ row }) => {
                const { items_summary, items_total } = row.original;
                if (!items_summary) {
                    return <span className="text-xs text-muted-foreground tabular-nums">{items_total}</span>;
                }
                return <span className="truncate text-sm">{items_summary}</span>;
            },
        },
        {
            id: 'status',
            accessorKey: 'board_status',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('status')} />,
            cell: ({ row }) => (
                <StudyOrderStatusBadge
                    status={row.original.board_status}
                    isOverdue={row.original.is_overdue}
                    itemsScheduled={row.original.items_scheduled}
                    itemsTotal={row.original.items_total}
                />
            ),
        },
        {
            accessorKey: 'submitted_at',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('submittedAt')} />,
            cell: ({ row }) => (
                <span className="whitespace-nowrap text-sm text-muted-foreground">
                    {row.original.submitted_at ? formatDisplayDate(row.original.submitted_at) : '—'}
                </span>
            ),
        },
        {
            accessorKey: 'preferred_sede_name',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('sede')} />,
            enableSorting: false,
            cell: ({ row }) => (
                <span className="truncate text-sm text-muted-foreground">
                    {row.original.preferred_sede_name ?? '—'}
                </span>
            ),
        },
        {
            id: 'actions',
            enableSorting: false,
            enableHiding: false,
            header: () => <span className="sr-only">{t('actions')}</span>,
            cell: ({ row }) => {
                const order = row.original;
                const isDraft = order.status === 'draft';
                const isSubmitted = order.status === 'submitted';
                const isClinic = scope === 'clinic';

                return (
                    // stopPropagation para que tocar una acción no abra el detalle.
                    <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                        {isDraft && onEdit && (
                            <RowAction label={tActions('edit')} icon={Pencil} onClick={() => onEdit(order)} />
                        )}
                        {isDraft && onSubmit && (
                            <RowAction label={tActions('submit')} icon={Send} onClick={() => onSubmit(order)} />
                        )}
                        {isClinic && isSubmitted && !order.acknowledged_at && onAcknowledge && (
                            <RowAction label={tActions('acknowledge')} icon={Inbox} onClick={() => onAcknowledge(order)} />
                        )}
                        {isClinic && isSubmitted && onSchedule && (
                            <RowAction label={tActions('schedule')} icon={CalendarPlus} onClick={() => onSchedule(order)} />
                        )}
                        {isDraft && onDelete && (
                            <RowAction label={tActions('delete')} icon={Trash2} onClick={() => onDelete(order)} destructive />
                        )}
                        {isSubmitted && onCancel && (
                            <RowAction
                                label={tActions('cancel')}
                                icon={XCircle}
                                onClick={() => onCancel(order)}
                                destructive
                                // El derivador no puede anular una orden que la
                                // clínica ya tomó; la regla también está en el SQL.
                                disabledReason={!isClinic && order.acknowledged_at
                                    ? tActions('cancelBlocked')
                                    : undefined}
                            />
                        )}
                    </div>
                );
            },
        },
    );

    return columns;
};

export default StudyOrderColumnsWrapper;
