'use client';

import { PURCHASES_PERMISSIONS } from '@/constants/permissions';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import * as React from 'react';

export default function PurchasesLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, isLoading } = useAuth();
    const { hasPermission } = usePermissions();

    if (isLoading) {
        return (
            <div className="flex h-screen w-screen items-center justify-center">
                <p>Loading...</p>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    const hasAccess = 
        hasPermission(PURCHASES_PERMISSIONS.QUOTES_VIEW_MENU) || 
        hasPermission(PURCHASES_PERMISSIONS.ORDERS_VIEW_MENU) ||
        hasPermission(PURCHASES_PERMISSIONS.INVOICES_VIEW_MENU) ||
        hasPermission(PURCHASES_PERMISSIONS.PAYMENTS_VIEW_MENU) ||
        hasPermission(PURCHASES_PERMISSIONS.SUPPLIERS_VIEW_MENU) ||
        hasPermission(PURCHASES_PERMISSIONS.PRODUCTS_VIEW_MENU);

    if (!hasAccess) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <h2 className="text-2xl font-bold">Acceso Denegado</h2>
                    <p className="text-muted-foreground mt-2">No tienes permisos para acceder a esta página.</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
