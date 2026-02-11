'use client';

import { useToast } from '@/hooks/use-toast';
import { Payment, PaymentListResponse, PaymentSearchParams } from '@/services/payments-service';
import { PaginationState } from '@tanstack/react-table';
import { useCallback, useEffect, useState } from 'react';

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

  const loadPayments = useCallback(async (
    pageIndex?: number,
    pageSize?: number,
    search?: string
  ) => {
    setIsLoading(true);
    try {
      const currentPage = (pageIndex !== undefined ? pageIndex : pagination.pageIndex) + 1;
      const currentPageSize = pageSize !== undefined ? pageSize : pagination.pageSize;
      const currentSearch = search || '';

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
  }, [fetchFunction, pagination.pageIndex, pagination.pageSize, toast, onError]);

  const handlePaginationChange = useCallback((updater: any) => {
    const newPagination = typeof updater === 'function' ? updater(pagination) : updater;
    setPagination(newPagination);
    loadPayments(newPagination.pageIndex, newPagination.pageSize);
  }, [loadPayments, pagination]);

  const refreshPayments = useCallback(async () => {
    await loadPayments();
  }, [loadPayments]);

  useEffect(() => {
    loadPayments(0, initialPageSize, '');
  }, []);

  return {
    payments,
    isLoading,
    pagination,
    totalPages,
    loadPayments,
    handlePaginationChange,
    refreshPayments
  };
}