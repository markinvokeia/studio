'use client';

import * as React from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useAlertNotifications } from '@/context/alert-notifications-context';
import { usePermissions } from '@/hooks/usePermissions';
import { GLOBAL_PERMISSIONS } from '@/constants/permissions';
import { api } from '@/services/api';
import { API_ROUTES } from '@/constants/routes';
import type { AlertInstance, AlertCategory } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
    AlertTriangle,
    ArrowRight,
    Bell,
    Calendar,
    DollarSign,
    Stethoscope,
    User,
} from 'lucide-react';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
    APPOINTMENTS: <Calendar className="h-4 w-4" />,
    BILLING:      <DollarSign className="h-4 w-4" />,
    PATIENTS:     <User className="h-4 w-4" />,
    FOLLOWUP:     <Stethoscope className="h-4 w-4" />,
    DEFAULT:      <AlertTriangle className="h-4 w-4" />,
};

const PRIORITY_DOT: Record<string, string> = {
    CRITICAL: 'bg-red-500',
    HIGH:     'bg-orange-500',
    MEDIUM:   'bg-yellow-500',
    LOW:      'bg-blue-400',
};

type GroupedCategory = { code: string; name: string; count: number; topPriority: string };

export function AlertsWidget() {
    const t = useTranslations('AlertsWidget');
    const locale = useLocale();
    const { hasPermission } = usePermissions();
    const { pendingCount } = useAlertNotifications();
    const [open, setOpen] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(false);
    const [groups, setGroups] = React.useState<GroupedCategory[]>([]);

    const canView = hasPermission(GLOBAL_PERMISSIONS.GLOBAL_VIEW_NOTIFICATIONS_BADGE);

    const fetchData = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const [alertsRes, catsRes] = await Promise.all([
                api.get(API_ROUTES.SYSTEM.ALERT_INSTANCES, { status: 'PENDING' }),
                api.get(API_ROUTES.SYSTEM.ALERT_CATEGORIES),
            ]);

            const alerts: AlertInstance[] = Array.isArray(alertsRes)
                ? (alertsRes as AlertInstance[]).filter((a) => !!a.id)
                : [];
            const categories: AlertCategory[] = Array.isArray(catsRes) ? (catsRes as AlertCategory[]) : [];

            const catMap = new Map(categories.map((c) => [c.id, c]));

            const acc: Record<string, GroupedCategory> = {};
            const PRIORITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
            for (const alert of alerts) {
                const cat = alert.category_id ? catMap.get(alert.category_id) : undefined;
                const code = cat?.code ?? 'DEFAULT';
                const name = cat?.name ?? t('defaultCategory');
                if (!acc[code]) acc[code] = { code, name, count: 0, topPriority: 'LOW' };
                acc[code].count++;
                if (
                    PRIORITY_ORDER.indexOf(alert.priority) <
                    PRIORITY_ORDER.indexOf(acc[code].topPriority)
                ) {
                    acc[code].topPriority = alert.priority;
                }
            }

            setGroups(Object.values(acc).sort((a, b) => b.count - a.count));
        } catch {
            setGroups([]);
        } finally {
            setIsLoading(false);
        }
    }, [t]);

    React.useEffect(() => {
        if (open && canView) fetchData();
    }, [open, canView, fetchData]);

    if (!canView) return null;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                        'relative rounded-xl h-10 w-10',
                        pendingCount > 0
                            ? 'bg-red-500/10 text-red-600'
                            : 'bg-muted/60 text-muted-foreground',
                    )}
                    title={t('title')}
                >
                    <Bell className="h-5 w-5" />
                    {pendingCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white bg-red-600 ring-2 ring-background">
                            {pendingCount > 99 ? '99+' : pendingCount}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>

            <PopoverContent side="left" align="center" className="w-60 p-3 rounded-xl">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                    {t('title')}
                </p>

                {isLoading ? (
                    <div className="flex flex-col gap-1.5">
                        <Skeleton className="h-8 w-full rounded-lg" />
                        <Skeleton className="h-8 w-full rounded-lg" />
                        <Skeleton className="h-8 w-3/4 rounded-lg" />
                    </div>
                ) : groups.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">{t('empty')}</p>
                ) : (
                    <div className="flex flex-col gap-0.5">
                        {groups.map((g) => (
                            <div
                                key={g.code}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors"
                            >
                                <span className={cn('shrink-0', pendingCount > 0 ? 'text-red-500' : 'text-muted-foreground')}>
                                    {CATEGORY_ICONS[g.code] ?? CATEGORY_ICONS.DEFAULT}
                                </span>
                                <span className="flex-1 text-xs truncate">{g.name}</span>
                                <div className="flex items-center gap-1 shrink-0">
                                    <span className={cn('h-1.5 w-1.5 rounded-full', PRIORITY_DOT[g.topPriority])} />
                                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-semibold">
                                        {g.count}
                                    </Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <Link href={`/${locale}/alerts`} passHref>
                    <Button variant="outline" size="sm" className="w-full mt-3 h-7 text-xs rounded-lg" onClick={() => setOpen(false)}>
                        {t('viewAll')} <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                </Link>
            </PopoverContent>
        </Popover>
    );
}
