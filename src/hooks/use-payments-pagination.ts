'use client';

import { useToast } from '@/hooks/use-toast';
import { Payment, PaymentListResponse, PaymentSearchParams } from '@/services/payments-service';
import { PaginationState } from '@tanstack/react-table';
import { useCallback, useEffect, useRef, useState } from 'react';

interface UsePaymentsPaginationOptions {
  fetchFunction: (params: PaymentSearchParams) => Promise<PaymentListResponse>;
  initialPageSize?: number;
  onError?: (error: any) => void;
}

interface UsePaymentsPaginationReturn {
  payments: Payment[];
  isLoading: boolean;
  pagination: PaginationState;
  totalPages: number;
  loadPayments: (pageIndex?: number, pageSize?: number, search?: string) => Promise<void>;
  handlePaginationChange: (updater: any) => void;
  handleSearchChange: (search: string) => void;
  refreshPayments: () => Promise<void>;
}

export function usePaymentsPagination({
  fetchFunction,
  initialPageSize = 10,
  onError
}: UsePaymentsPaginationOptions): UsePaymentsPaginationReturn {
  const { toast } = useToast();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: initialPageSize
  });
  const [totalPages, setTotalPages] = useState(0);

  // Keep a ref in sync with the latest pagination so loadPayments never needs
  // pagination in its own deps (avoiding cascading function recreations on every
  // page-state change).
  const paginationRef = useRef(pagination);
  paginationRef.current = pagination;

  // Keep the active search term in a ref so page changes and refreshes always
  // re-send it to the backend instead of dropping it.
  const searchRef = useRef('');

  const loadPayments = useCallback(async (
    pageIndex?: number,
    pageSize?: number,
    search?: string
  ) => {
    setIsLoading(true);
    try {
      const currentPage = (pageIndex !== undefined ? pageIndex : paginationRef.current.pageIndex) + 1;
      const currentPageSize = pageSize !== undefined ? pageSize : paginationRef.current.pageSize;
      const currentSearch = search !== undefined ? search : searchRef.current;
      searchRef.current = currentSearch;

      const result = await fetchFunction({
        page: currentPage,
        limit: currentPageSize,
        search: currentSearch
      });

      setPayments(result.payments);
      setTotalPages(result.totalPages);
    } catch (error) {
      console.error("Failed to fetch payments:", error);

      if (onError) {
        onError(error);
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to load payments',
        });
      }

      setPayments([]);
      setTotalPages(0);
    } finally {
      setIsLoading(false);
    }
  }, [fetchFunction, toast, onError]);

  const handlePaginationChange = useCallback((updater: any) => {
    const newPagination = typeof updater === 'function' ? updater(paginationRef.current) : updater;
    setPagination(newPagination);
    loadPayments(newPagination.pageIndex, newPagination.pageSize, searchRef.current);
  }, [loadPayments]);

  // Apply a new search term: reset to the first page and re-query the backend.
  const handleSearchChange = useCallback((search: string) => {
    searchRef.current = search;
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    loadPayments(0, paginationRef.current.pageSize, search);
  }, [loadPayments]);

  const refreshPayments = useCallback(async () => {
    await loadPayments(paginationRef.current.pageIndex, paginationRef.current.pageSize, searchRef.current);
  }, [loadPayments]);

  useEffect(() => {
    loadPayments(0, initialPageSize, '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    payments,
    isLoading,
    pagination,
    totalPages,
    loadPayments,
    handlePaginationChange,
    handleSearchChange,
    refreshPayments
  };
}