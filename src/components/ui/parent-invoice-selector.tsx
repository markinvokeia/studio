'use client';

import { Button } from '@/components/ui/button';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Invoice } from '@/lib/types';
import { cn } from '@/lib/utils';
import { getBookedInvoices } from '@/services/invoices';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

const PAGE_SIZE = 10;

interface ParentInvoiceSelectorProps {
    /** true = sales (clínica/pacientes), false = purchase (proveedores) */
    isSales?: boolean;
    /** Usuario (paciente/proveedor) seleccionado; sin él, el selector se deshabilita */
    userId?: string;
    /** ID de la factura seleccionada */
    value?: string;
    /** Etiqueta de la factura ya seleccionada, para mostrarla sin depender de la página cargada */
    selectedInvoiceLabel?: string;
    /** Callback al seleccionar una factura */
    onValueChange?: (invoiceId: string, invoice?: Invoice) => void;
    placeholder?: string;
    triggerText?: string;
    noResultsText?: string;
    loadMoreText?: string;
    loadingText?: string;
    className?: string;
    disabled?: boolean;
}

function invoiceLabel(inv: Invoice): string {
    return `${inv.doc_no} - ${inv.user_name} - $${inv.total}`;
}

export function ParentInvoiceSelector({
    isSales = true,
    userId,
    value,
    selectedInvoiceLabel,
    onValueChange,
    placeholder = 'Buscar factura...',
    triggerText = 'Seleccionar factura',
    noResultsText = 'No se encontraron facturas.',
    loadMoreText = 'Cargar más',
    loadingText = 'Cargando...',
    className,
    disabled = false,
}: ParentInvoiceSelectorProps) {
    const t = useTranslations('General');
    const [open, setOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [invoices, setInvoices] = React.useState<Invoice[]>([]);
    const [page, setPage] = React.useState(1);
    const [total, setTotal] = React.useState(0);
    // Si la última página vino completa, asumimos que puede haber más (heurística
    // independiente del campo `total`, que el backend no siempre devuelve).
    const [lastBatchFull, setLastBatchFull] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(false);
    const [isLoadingMore, setIsLoadingMore] = React.useState(false);
    const [selectedCache, setSelectedCache] = React.useState<Invoice | null>(null);

    const noResultsMessage = noResultsText || t('noResults');

    // Carga de la primera página (al abrir, al buscar o al cambiar de usuario)
    React.useEffect(() => {
        if (!open || !userId) return;

        const handler = setTimeout(async () => {
            setIsLoading(true);
            try {
                const result = await getBookedInvoices({
                    isSales,
                    userId,
                    search: searchQuery,
                    page: 1,
                    limit: PAGE_SIZE,
                });
                setInvoices(result.items);
                setTotal(result.total);
                setLastBatchFull(result.items.length >= PAGE_SIZE);
                setPage(1);
            } catch (error) {
                console.error('Failed to fetch invoices:', error);
                setInvoices([]);
                setTotal(0);
                setLastBatchFull(false);
            } finally {
                setIsLoading(false);
            }
        }, 300);

        return () => clearTimeout(handler);
    }, [open, userId, isSales, searchQuery]);

    const handleLoadMore = async () => {
        if (!userId || isLoadingMore) return;
        const nextPage = page + 1;
        setIsLoadingMore(true);
        try {
            const result = await getBookedInvoices({
                isSales,
                userId,
                search: searchQuery,
                page: nextPage,
                limit: PAGE_SIZE,
            });
            setInvoices(prev => {
                const existingIds = new Set(prev.map(inv => inv.id));
                const merged = [...prev];
                for (const inv of result.items) {
                    if (!existingIds.has(inv.id)) merged.push(inv);
                }
                return merged;
            });
            setTotal(result.total);
            setLastBatchFull(result.items.length >= PAGE_SIZE);
            setPage(nextPage);
        } catch (error) {
            console.error('Failed to load more invoices:', error);
        } finally {
            setIsLoadingMore(false);
        }
    };

    const selectedLabel = React.useMemo(() => {
        const fromResults = invoices.find(inv => inv.id === value);
        if (fromResults) return invoiceLabel(fromResults);
        if (selectedCache && selectedCache.id === value) return invoiceLabel(selectedCache);
        return selectedInvoiceLabel;
    }, [invoices, value, selectedCache, selectedInvoiceLabel]);

    const handleSelect = (invoice: Invoice) => {
        setSelectedCache(invoice);
        onValueChange?.(invoice.id, invoice);
        setOpen(false);
        setSearchQuery('');
    };

    // Hay más si el backend reporta un total mayor a lo cargado, o (cuando no
    // hay un total fiable) si la última página vino completa.
    const hasMore = (total > invoices.length) || lastBatchFull;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    className={cn('w-full justify-between', !value && 'text-muted-foreground', className)}
                    disabled={disabled}
                >
                    {value && selectedLabel
                        ? <span className="truncate block">{selectedLabel}</span>
                        : triggerText}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder={placeholder}
                        value={searchQuery}
                        onValueChange={setSearchQuery}
                    />
                    <CommandList>
                        {isLoading ? (
                            <div className="flex items-center justify-center p-4">
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                <span className="text-sm text-muted-foreground">{loadingText}</span>
                            </div>
                        ) : (
                            <>
                                {invoices.length > 0 && (
                                    <CommandGroup>
                                        {invoices.map((invoice) => (
                                            <CommandItem
                                                value={invoice.id}
                                                key={invoice.id}
                                                onSelect={() => handleSelect(invoice)}
                                            >
                                                <Check className={cn('mr-2 h-4 w-4', value === invoice.id ? 'opacity-100' : 'opacity-0')} />
                                                <span className="truncate">{invoiceLabel(invoice)}</span>
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                )}

                                {invoices.length === 0 && (
                                    <p className="py-5 text-center text-sm text-muted-foreground">
                                        {noResultsMessage}
                                    </p>
                                )}

                                {hasMore && (
                                    <div className="border-t p-1">
                                        <button
                                            type="button"
                                            className="flex w-full items-center justify-center gap-2 rounded-sm px-3 py-2 text-sm text-muted-foreground hover:bg-accent cursor-pointer disabled:opacity-50"
                                            onClick={handleLoadMore}
                                            disabled={isLoadingMore}
                                        >
                                            {isLoadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                            {loadMoreText}
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

export default ParentInvoiceSelector;
