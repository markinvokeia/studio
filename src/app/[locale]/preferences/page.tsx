'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserCommunicationPreferences } from '@/components/users/user-communication-preferences';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { hasDoctorWorkspaceAccess } from '@/lib/permissions';
import { useDoctorAlertStyle, type DoctorAlertStyle } from '@/hooks/use-doctor-alert-style';
import { cn } from '@/lib/utils';
import { Bell, BellRing, LayoutGrid, Settings2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

export default function UserPreferencesPage() {
    const t = useTranslations('PreferencesPage');
    const { user } = useAuth();
    const { permissions } = usePermissions();
    const isDoctor = React.useMemo(() => hasDoctorWorkspaceAccess(permissions), [permissions]);
    const [alertStyle, setAlertStyle] = useDoctorAlertStyle(isDoctor ? user?.id : undefined);

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
                <CardContent className="p-4 pt-0">
                    <UserCommunicationPreferences user={user as any} />
                </CardContent>
            </Card>

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
