'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SignatureUploader } from '@/components/users/signature-uploader';
import { UserCommunicationPreferences } from '@/components/users/user-communication-preferences';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { GLOBAL_PERMISSIONS } from '@/constants/permissions';
import { hasDoctorWorkspaceAccess } from '@/lib/permissions';
import { useNotifications } from '@/context/notifications-context';
import { useFinanceViewPreference } from '@/hooks/use-finance-view-preference';
import { TOAST_POSITIONS, useToastPosition } from '@/hooks/use-toast-position';
import { toast } from '@/hooks/use-toast';
import type { DoctorAlertStyle, PatientFinanceView, ToastPosition } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Bell, BellRing, Columns3, LayoutGrid, PenLine, Receipt, Rows3, Settings2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

// Posición de la barrita dentro de la mini-pantalla de cada opción.
const TOAST_POSITION_MARKS: Record<ToastPosition, string> = {
    'top-center': 'left-1/2 top-1 w-6 -translate-x-1/2',
    'top-right': 'right-1 top-1 w-5',
    'bottom-center': 'bottom-1 left-1/2 w-6 -translate-x-1/2',
    'bottom-right': 'bottom-1 right-1 w-5',
};

export default function UserPreferencesPage() {
    const t = useTranslations('PreferencesPage');
    const { user } = useAuth();
    const { permissions, hasPermission } = usePermissions();
    const isDoctor = React.useMemo(() => hasDoctorWorkspaceAccess(permissions), [permissions]);
    const canUploadSignature = hasPermission(GLOBAL_PERMISSIONS.PROFILE_UPLOAD_SIGNATURE);
    const { alertStyle, setAlertStyle, refreshAlertStyle } = useNotifications();
    const [financeView, setFinanceView] = useFinanceViewPreference(user?.id);
    const [toastPosition, setToastPosition, refreshToastPosition] = useToastPosition(user?.id);

    // The alert-style value in context is only as fresh as its last fetch
    // (usually app login). An admin may have changed it from another session
    // since then, so force a refetch every time this page is opened. Same
    // reasoning for the toast position, which lives in a module store.
    React.useEffect(() => {
        refreshAlertStyle();
        refreshToastPosition();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Firing a sample toast on select makes the choice self-demonstrating: the module
    // store re-renders the already-mounted <Toaster/>, so it lands in the new spot.
    const handleToastPositionChange = (position: ToastPosition) => {
        setToastPosition(position);
        toast({ variant: 'info', title: t('toastPositionPreview') });
    };

    if (!user) {
        return null;
    }

    return (
        <div className="flex-1 overflow-y-auto space-y-4 p-4 pb-6 min-h-0">
            {/* Page header card */}
            <Card className="shadow-sm border-0">
                <CardHeader className="p-4">
                    <div className="flex items-start gap-3">
                        <div className="header-icon-circle mt-0.5">
                            <Settings2 className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col">
                            <CardTitle className="text-lg">{t('title')}</CardTitle>
                            <CardDescription className="text-xs">{t('description')}</CardDescription>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* Notifications section */}
            <Card className="shadow-sm border-0">
                <CardHeader className="p-4">
                    <div className="flex items-start gap-3">
                        <div className="header-icon-circle mt-0.5">
                            <Bell className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col">
                            <CardTitle className="text-lg">{t('notificationsSection')}</CardTitle>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                    <UserCommunicationPreferences user={user as any} />

                    <div className="space-y-3 border-t pt-4">
                        <div>
                            <p className="text-sm font-medium text-foreground">{t('toastPositionLabel')}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{t('toastPositionDescription')}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {TOAST_POSITIONS.map((position) => (
                                <button
                                    key={position}
                                    type="button"
                                    onClick={() => handleToastPositionChange(position)}
                                    className={cn(
                                        'flex flex-col items-center gap-2 rounded-xl border-2 px-3 py-3 text-sm font-medium transition-all',
                                        toastPosition === position
                                            ? 'border-primary bg-primary/8 text-primary'
                                            : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/40 hover:text-foreground',
                                    )}
                                >
                                    {/* Mini-pantalla en vez de un icono: comunica la posición mucho
                                        mejor que una flecha. `bg-current` hereda el color del botón. */}
                                    <span className="relative h-8 w-12 rounded-[4px] border border-current/40">
                                        <span
                                            className={cn(
                                                'absolute h-1.5 rounded-[2px] bg-current',
                                                TOAST_POSITION_MARKS[position],
                                            )}
                                        />
                                    </span>
                                    {t(`toastPosition.${position}` as any)}
                                </button>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Patient finance view */}
            <Card className="shadow-sm border-0">
                <CardHeader className="p-4">
                    <div className="flex items-start gap-3">
                        <div className="header-icon-circle mt-0.5">
                            <Receipt className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col">
                            <CardTitle className="text-lg">{t('financeViewSection')}</CardTitle>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-3">
                    <div>
                        <p className="text-sm font-medium text-foreground">{t('financeViewLabel')}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{t('financeViewDescription')}</p>
                    </div>
                    <div className="flex gap-2">
                        {(['tabs', 'unified'] as PatientFinanceView[]).map((view) => (
                            <button
                                key={view}
                                type="button"
                                onClick={() => setFinanceView(view)}
                                className={cn(
                                    'flex flex-1 flex-col items-center gap-2 rounded-xl border-2 px-3 py-3 text-sm font-medium transition-all',
                                    financeView === view
                                        ? 'border-primary bg-primary/8 text-primary'
                                        : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/40 hover:text-foreground',
                                )}
                            >
                                {view === 'unified'
                                    ? <Rows3 className="h-5 w-5" />
                                    : <Columns3 className="h-5 w-5" />}
                                {t(`financeView.${view}` as any)}
                            </button>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Signature — used on printed prescriptions */}
            {canUploadSignature && (
                <Card className="shadow-sm border-0">
                    <CardHeader className="p-4">
                        <div className="flex items-start gap-3">
                            <div className="header-icon-circle mt-0.5">
                                <PenLine className="h-5 w-5" />
                            </div>
                            <div className="flex flex-col">
                                <CardTitle className="text-lg">{t('signatureSection')}</CardTitle>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <SignatureUploader userId={user.id} canManage />
                    </CardContent>
                </Card>
            )}

            {/* Workspace section — doctors only */}
            {isDoctor && (
                <Card className="shadow-sm border-0">
                    <CardHeader className="p-4">
                        <div className="flex items-start gap-3">
                            <div className="header-icon-circle mt-0.5">
                                <LayoutGrid className="h-5 w-5" />
                            </div>
                            <div className="flex flex-col">
                                <CardTitle className="text-lg">{t('workspaceSection')}</CardTitle>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 space-y-3">
                        <div>
                            <p className="text-sm font-medium text-foreground">{t('alertStyleLabel')}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{t('alertStyleDescription')}</p>
                        </div>
                        <div className="flex gap-2">
                            {(['modal', 'toast'] as DoctorAlertStyle[]).map((style) => (
                                <button
                                    key={style}
                                    type="button"
                                    onClick={() => setAlertStyle(style)}
                                    className={cn(
                                        'flex flex-1 flex-col items-center gap-2 rounded-xl border-2 px-3 py-3 text-sm font-medium transition-all',
                                        alertStyle === style
                                            ? 'border-primary bg-primary/8 text-primary'
                                            : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/40 hover:text-foreground',
                                    )}
                                >
                                    {style === 'modal'
                                        ? <BellRing className="h-5 w-5" />
                                        : <Bell className="h-5 w-5" />}
                                    {t(`alertStyle.${style}` as any)}
                                </button>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
