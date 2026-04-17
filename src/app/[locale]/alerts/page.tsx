'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CommunicationWarningDialog } from '@/components/communication-warning-dialog';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Can } from '@/components/auth/Can';
import { useAlertNotifications, AlertNotificationsProvider } from '@/context/alert-notifications-context';
import { API_ROUTES } from '@/constants/routes';
import { ALERT_CENTER_PERMISSIONS } from '@/constants/permissions';
import { toast } from '@/hooks/use-toast';
import { checkPreferencesByUserId } from '@/hooks/use-communication-preferences';
import { usePermissions } from '@/hooks/usePermissions';
import { AlertInstance, AlertAction, AlertCategory } from '@/lib/types';
import { api } from '@/services/api';
import { BulkActionsFloatingBar } from '@/components/alerts/bulk-actions-floating-bar';
import { cn } from '@/lib/utils';
import {
    AlertTriangle,
    Calendar,
    CheckCircle,
    ChevronDown,
    Clock,
    DollarSign,
    FileText,
    Filter,
    Mail, MessageSquare,
    MoreHorizontal,
    Phone, Printer,
    RefreshCw,
    Stethoscope,
    User,
    UserPlus,
    XCircle,
    MessageCircle,
    BellRing
} from 'lucide-react';
import { ChevronLeftIcon, ChevronRightIcon, DoubleArrowLeftIcon, DoubleArrowRightIcon } from '@radix-ui/react-icons';
import { useTranslations } from 'next-intl';
import React from 'react';

type DisplayField = {
    label: string;
    source_column: string;
    type: 'text' | 'datetime' | 'number' | 'boolean';
};

const getFieldValue = (alert: AlertInstance, sourceColumn: string): any => {
    const dataSource = alert.details_json?.data;
    if (dataSource && sourceColumn in dataSource) {
        return dataSource[sourceColumn];
    }
    const parts = sourceColumn.split('.');
    let value: any = alert.details_json;
    for (const part of parts) {
        value = value?.[part];
    }
    return value;
};

const formatFieldValue = (value: any, type: string): string => {
    if (value === null || value === undefined) return '-';

    if (type === 'datetime' || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value))) {
        const date = value instanceof Date ? value : new Date(value);
        if (!isNaN(date.getTime())) {
            return date.toLocaleString('es-UY', { dateStyle: 'medium', timeStyle: 'short' });
        }
    }

    switch (type) {
        case 'number':
            if (typeof value === 'number') {
                return value.toLocaleString('es-UY');
            }
            return String(value);
        case 'boolean':
            return value ? 'Sí' : 'No';
        default:
            return String(value ?? '-');
    }
};

const renderDisplayFields = (alert: AlertInstance, fields: DisplayField[]) => {
    if (!fields || fields.length === 0) return null;
    
    return (
        <div className="mt-1 flex items-center gap-3 flex-wrap text-xs">
            {fields.map((field, idx) => {
                const value = getFieldValue(alert, field.source_column);
                const formattedValue = formatFieldValue(value, field.type);
                return (
                    <span key={idx} className="flex items-center gap-1">
                        <span className="text-muted-foreground">{field.label}:</span>
                        <span className="font-medium">{formattedValue}</span>
                    </span>
                );
            })}
        </div>
    );
};

const fetchAlerts = async (status?: string, priority?: string, page: number = 1, limit: number = 50) => {
    try {
        const query: Record<string, string> = {};
        if (status !== undefined) query.status = status;
        if (priority !== undefined) query.priority = priority;
        query.page = page.toString();
        query.limit = limit.toString();
        const response = await api.get(API_ROUTES.SYSTEM.ALERT_INSTANCES, query);
        if (!response || (Array.isArray(response) && response.length === 1 && Object.keys(response[0]).length === 0)) {
            return { alerts: [], totalRecords: 0 };
        }
        const alerts: AlertInstance[] = response.map((alert: any) => ({
            ...alert,
            rule_name: alert.rule_name || 'DEFAULT',
            patient_name: alert.details_json?.patient?.full_name || 'Unknown',
        }));
        const totalRecords = response[0]?.total_records || alerts.length;
        return { alerts, totalRecords };
    } catch (error) {
        console.error('Failed to fetch alerts:', error);
        return { alerts: [], totalRecords: 0 };
    }
};

const fetchAlertActions = async (page: number = 1, limit: number = 50): Promise<{ actions: AlertAction[], totalPages: number }> => {
    try {
        const query: Record<string, string> = {
            page: page.toString(),
            limit: limit.toString(),
        };
        const response = await api.get(API_ROUTES.SYSTEM.ALERT_ACTIONS, query);
        return response || { actions: [], totalPages: 1 };
    } catch (error) {
        console.error('Failed to fetch alert actions:', error);
        return { actions: [], totalPages: 1 };
    }
};

const fetchAlertCategories = async (): Promise<AlertCategory[]> => {
    try {
        const response = await api.get(API_ROUTES.SYSTEM.ALERT_CATEGORIES);
        // Handle null/empty responses
        return response || [];
    } catch (error) {
        console.error('Failed to fetch alert categories:', error);
        return [];
    }
};

const priorityConfig = {
    CRITICAL: { color: 'bg-red-500', text: 'text-red-500', label: 'Critical' },
    HIGH: { color: 'bg-orange-500', text: 'text-orange-500', label: 'High' },
    MEDIUM: { color: 'bg-yellow-500', text: 'text-yellow-500', label: 'Medium' },
    LOW: { color: 'bg-blue-500', text: 'text-blue-500', label: 'Low' },
};

const categoryIcons = {
    APPOINTMENTS: <Calendar className="h-5 w-5" />,
    BILLING: <DollarSign className="h-5 w-5" />,
    PATIENTS: <User className="h-5 w-5" />,
    FOLLOWUP: <Stethoscope className="h-5 w-5" />,
    DEFAULT: <AlertTriangle className="h-5 w-5" />
};

const getCategoryFromRule = (ruleName: string) => {
    if (ruleName.startsWith('APPT')) return 'APPOINTMENTS';
    if (ruleName.startsWith('INV')) return 'BILLING';
    if (ruleName.startsWith('PATIENT')) return 'PATIENTS';
    return 'DEFAULT';
};

const SummaryCard = ({ title, count, accentColor }: { title: string, count: number, accentColor: string }) => (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="h-[3px] w-full" style={{ background: accentColor }} />
        <div className="px-3 py-3 flex flex-col gap-1">
            <span className="text-[9px] uppercase tracking-wide text-muted-foreground font-medium truncate">{title}</span>
            <span className="text-3xl font-bold tracking-tight text-foreground">{count}</span>
        </div>
    </div>
);

function AlertsCenterPageContent() {
    const t = useTranslations('AlertsCenterPage');
    const { hasPermission } = usePermissions();
    const { refreshAlerts } = useAlertNotifications();
    const [alerts, setAlerts] = React.useState<AlertInstance[]>([]);
    const [alertActions, setAlertActions] = React.useState<AlertAction[]>([]);
    const [alertCategories, setAlertCategories] = React.useState<AlertCategory[]>([]);
    const [openCategories, setOpenCategories] = React.useState<string[]>([]);
    const [openActionCollapsibles, setOpenActionCollapsibles] = React.useState<string[]>([]);
    const [selectedAlerts, setSelectedAlerts] = React.useState<string[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [statusFilter, setStatusFilter] = React.useState<string>('PENDING');
    const [priorityFilter, setPriorityFilter] = React.useState<string>('');
    const [ignoreDialogOpen, setIgnoreDialogOpen] = React.useState(false);
    const [ignoreReason, setIgnoreReason] = React.useState('');
    const [alertsToIgnore, setAlertsToIgnore] = React.useState<string[]>([]);
    const [snoozeDialogOpen, setSnoozeDialogOpen] = React.useState(false);
    const [snoozeReason, setSnoozeReason] = React.useState('');
    const [alertsToSnooze, setAlertsToSnooze] = React.useState<string[]>([]);
    const [snoozeDate, setSnoozeDate] = React.useState<string>('');
    const [page, setPage] = React.useState<number>(1);
    const [limit, setLimit] = React.useState<number>(50);
    const [bulkActionLoading, setBulkActionLoading] = React.useState<'complete' | 'email' | 'sms' | 'whatsapp' | 'ignore' | 'snooze' | null>(null);
    const [totalPages, setTotalPages] = React.useState<number>(1);
    const [alertsPage, setAlertsPage] = React.useState<number>(1);
    const [alertsLimit, setAlertsLimit] = React.useState<number>(50);
    const [alertsTotalRecords, setAlertsTotalRecords] = React.useState<number>(0);
    const [registerCallDialogOpen, setRegisterCallDialogOpen] = React.useState(false);
    const [registerCallDate, setRegisterCallDate] = React.useState<string>('');
    const [registerCallNotes, setRegisterCallNotes] = React.useState<string>('');
    const [alertsToRegisterCall, setAlertsToRegisterCall] = React.useState<string[]>([]);
    const [addNoteDialogOpen, setAddNoteDialogOpen] = React.useState(false);
    const [noteContent, setNoteContent] = React.useState<string>('');
    const [alertsForNote, setAlertsForNote] = React.useState<string[]>([]);
    const [isWarningDialogOpen, setIsWarningDialogOpen] = React.useState(false);
    const [disabledItems, setDisabledItems] = React.useState<string[]>([]);
    const [pendingAlertIds, setPendingAlertIds] = React.useState<string[]>([]);


    const loadAlerts = async () => {
        setLoading(true);
        try {
            const [alertsData, { actions: actionsData, totalPages: actionsTotalPages }, categoriesData] = await Promise.all([
                fetchAlerts(statusFilter || undefined, priorityFilter || undefined, alertsPage, alertsLimit),
                fetchAlertActions(page, limit),
                fetchAlertCategories()
            ]);
            setAlerts(alertsData.alerts);
            setAlertsTotalRecords(alertsData.totalRecords);
            setAlertActions(actionsData);
            setTotalPages(actionsTotalPages);
            setAlertCategories(categoriesData);
        } catch (error) {
            console.error('Failed to load alerts:', error);
        } finally {
            setLoading(false);
        }
    };

    React.useEffect(() => {
        setAlertsPage(1);
    }, [statusFilter, priorityFilter]);

    React.useEffect(() => {
        loadAlerts();
    }, [alertsPage, alertsLimit]);

    React.useEffect(() => {
        loadAlerts();
    }, [statusFilter, priorityFilter]);

    React.useEffect(() => {
        const loadActions = async () => {
            const { actions, totalPages: actionsTotalPages } = await fetchAlertActions(page, limit);
            setAlertActions(actions);
            setTotalPages(actionsTotalPages);
        };
        loadActions();
    }, [page, limit]);

    const markAsCompleted = React.useCallback(async (alertIds: string[]) => {
        setBulkActionLoading('complete');
        try {
            await api.post(API_ROUTES.SYSTEM.ALERT_INSTANCES_COMPLETE, { ids: alertIds });
            setSelectedAlerts([]);
            refreshAlerts();
            await loadAlerts();
            toast({ title: t('toast.alertsUpdated'), description: t('toast.alertsMarkedCompleted', { count: alertIds.length }) });
        } catch (error) {
            console.error('Failed to mark alerts as completed:', error);
            toast({ title: t('toast.markCompletedFailed'), description: t('toast.markCompletedFailedDescription'), variant: 'destructive' });
        } finally {
            setBulkActionLoading(null);
        }
    }, []);

    const markAsIgnored = async (alertIds: string[], reason: string) => {
        setBulkActionLoading('ignore');
        try {
            await api.post(API_ROUTES.SYSTEM.ALERT_INSTANCES_IGNORE, { ids: alertIds, reason });
            setSelectedAlerts([]);
            refreshAlerts();
            await loadAlerts();
            toast({ title: t('toast.alertsUpdated'), description: t('toast.alertsMarkedIgnored', { count: alertIds.length }) });
        } catch (error) {
            console.error('Failed to mark alerts as ignored:', error);
            toast({ title: t('toast.markIgnoredFailed'), description: t('toast.markIgnoredFailedDescription'), variant: 'destructive' });
        } finally {
            setBulkActionLoading(null);
        }
    };

    const snoozeAlerts = async (alertIds: string[], snoozeUntil: string, reason: string) => {
        setBulkActionLoading('snooze');
        try {
            await api.post(API_ROUTES.SYSTEM.ALERT_INSTANCES_SNOOZE, { ids: alertIds, snooze_until: snoozeUntil, reason });
            setSelectedAlerts([]);
            refreshAlerts();
            await loadAlerts();
            toast({ title: t('toast.alertsUpdated'), description: t('toast.alertsSnoozed', { count: alertIds.length }) });
        } catch (error) {
            console.error('Failed to snooze alerts:', error);
            toast({ title: t('toast.snoozeFailed'), description: t('toast.snoozeFailedDescription'), variant: 'destructive' });
        } finally {
            setBulkActionLoading(null);
        }
    };

    const sendEmail = React.useCallback(async (alertIds: string[]) => {
        const alertsToCheck = alerts.filter(a => alertIds.includes(a.id));
        const userIds = alertsToCheck.map(a => a.patient_id).filter(Boolean) as string[];

        const uniqueUserIds = [...new Set(userIds)];

        if (uniqueUserIds.length > 0) {
            const disabledIds: string[] = [];
            for (const userId of uniqueUserIds) {
                const hasEnabled = await checkPreferencesByUserId(userId, 'email', 'billing');
                if (!hasEnabled) {
                    disabledIds.push(userId);
                }
            }

            if (disabledIds.length > 0) {
                setDisabledItems(disabledIds);
                setPendingAlertIds(alertIds);
                setIsWarningDialogOpen(true);
                return;
            }
        }

        await doSendEmail(alertIds);
    }, [alerts]);

    const doSendEmail = async (alertIds: string[]) => {
        setBulkActionLoading('email');
        try {
            await api.post(API_ROUTES.SYSTEM.ALERT_INSTANCES_SEND_EMAIL, { ids: alertIds });
            refreshAlerts();
            await loadAlerts();
            toast({ title: t('toast.emailSent'), description: t('toast.emailSentDescription', { count: alertIds.length }) });
        } catch (error) {
            console.error('Failed to send email:', error);
            toast({ title: t('toast.emailSendFailed'), description: t('toast.emailSendFailedDescription'), variant: 'destructive' });
        } finally {
            setBulkActionLoading(null);
        }
    };

    const handleWarningConfirm = async () => {
        await doSendEmail(pendingAlertIds);
        setIsWarningDialogOpen(false);
    };

    const sendWhatsApp = async (alertIds: string[]) => {
        setBulkActionLoading('whatsapp');
        try {
            await api.post(API_ROUTES.SYSTEM.ALERT_INSTANCES_SEND_WHATSAPP, { ids: alertIds });
            refreshAlerts();
            await loadAlerts();
            toast({ title: t('toast.whatsappSent'), description: t('toast.whatsappSentDescription', { count: alertIds.length }) });
        } catch (error) {
            console.error('Failed to send WhatsApp message:', error);
            toast({ title: t('toast.whatsappSendFailed'), description: t('toast.whatsappSendFailedDescription'), variant: 'destructive' });
        } finally {
            setBulkActionLoading(null);
        }
    };

    const sendSms = async (alertIds: string[]) => {
        setBulkActionLoading('sms');
        try {
            await api.post(API_ROUTES.SYSTEM.ALERT_INSTANCES_SEND_SMS, { ids: alertIds });
            refreshAlerts();
            await loadAlerts();
            toast({ title: t('toast.smsSent'), description: t('toast.smsSentDescription', { count: alertIds.length }) });
        } catch (error) {
            console.error('Failed to send SMS:', error);
            toast({ title: t('toast.smsSendFailed'), description: t('toast.smsSendFailedDescription'), variant: 'destructive' });
        } finally {
            setBulkActionLoading(null);
        }
    };

    const registerCall = async (alertIds: string[], scheduledAt: string, reason: string) => {
        try {
            await api.post(API_ROUTES.SYSTEM.ALERT_INSTANCES_CALL_REGISTER, {
                ids: alertIds,
                details_json: { scheduled_at: scheduledAt },
                reason
            });
            refreshAlerts();
            await loadAlerts();
            toast({ title: t('toast.callRegistered'), description: t('toast.callRegisteredDescription', { count: alertIds.length }) });
        } catch (error) {
            console.error('Failed to register call:', error);
            toast({ title: t('toast.callRegisterFailed'), description: t('toast.callRegisterFailedDescription'), variant: 'destructive' });
        }
    };

    const addNote = async (alertIds: string[], reason: string) => {
        try {
            await api.post(API_ROUTES.SYSTEM.ALERT_INSTANCES_NOTES, { ids: alertIds, reason });
            refreshAlerts();
            await loadAlerts();
            toast({ title: t('toast.noteAdded'), description: t('toast.noteAddedDescription', { count: alertIds.length }) });
        } catch (error) {
            console.error('Failed to add note:', error);
            toast({ title: t('toast.addNoteFailed'), description: t('toast.addNoteFailedDescription'), variant: 'destructive' });
        }
    };

    const handleSelectAlert = (alertId: string, checked: boolean) => {
        setSelectedAlerts(prev =>
            checked ? [...prev, alertId] : prev.filter(id => id !== alertId)
        );
    };

    const handleSelectCategory = (categoryAlerts: AlertInstance[], checked: boolean) => {
        const alertIds = categoryAlerts.map(a => a.id);
        if (checked) {
            setSelectedAlerts(prev => [...new Set([...prev, ...alertIds])]);
        } else {
            setSelectedAlerts(prev => prev.filter(id => !alertIds.includes(id)));
        };
    }

    const getCategoryName = (categoryId: string | undefined): string => {
        if (!categoryId) return 'DEFAULT';
        const category = alertCategories.find(cat => cat.id === categoryId);
        return category ? category.code : 'DEFAULT';
    };

    const groupedAlerts = React.useMemo(() => {
        return alerts.reduce((acc, alert) => {
            const category = getCategoryName(alert.category_id);
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(alert);
            return acc;
        }, {} as Record<string, AlertInstance[]>);
    }, [alerts, alertCategories]);

    React.useEffect(() => {
        setOpenCategories(Object.keys(groupedAlerts));
    }, [alerts]);

    const toggleCategory = (category: string) => {
        setOpenCategories(prev =>
            prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
        );
    };

    const summaryCounts = {
        total: (alerts || []).filter(a => a.status === 'PENDING').length,
        critical: (alerts || []).filter(a => a.priority === 'CRITICAL' && a.status === 'PENDING').length,
        high: (alerts || []).filter(a => a.priority === 'HIGH' && a.status === 'PENDING').length,
        medium: (alerts || []).filter(a => a.priority === 'MEDIUM' && a.status === 'PENDING').length,
    };

    return (
        <div className="flex-1 overflow-y-auto pr-2 space-y-4 pb-24 min-h-0">
            <Card className="shadow-sm border-0">
                <CardHeader className="p-4">
                    <div className="flex items-start gap-3">
                        <div className="header-icon-circle mt-0.5">
                            <BellRing className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col">
                            <CardTitle className="text-lg">{t('title')}</CardTitle>
                            <CardDescription className="text-xs">{t('description')}</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-card">
                    <Can permission={ALERT_CENTER_PERMISSIONS.VIEW_KPIS}>
                        <SummaryCard title={t('summary.total')} count={summaryCounts.total} accentColor="#6366f1" />
                        <SummaryCard title={t('summary.critical')} count={summaryCounts.critical} accentColor="#EF4444" />
                        <SummaryCard title={t('summary.high')} count={summaryCounts.high} accentColor="#F97316" />
                        <SummaryCard title={t('summary.medium')} count={summaryCounts.medium} accentColor="#EAB308" />
                    </Can>
                </CardContent>
            </Card>

            <Card className="shadow-sm border-0">
                <CardHeader className="p-4">
                    <div className="flex items-center justify-between w-full">
                        <div className="flex items-start gap-3">
                            <div className="header-icon-circle mt-0.5">
                                <FileText className="h-5 w-5" />
                            </div>
                            <div className="flex flex-col">
                                <CardTitle className="text-lg">{t('dailyAlerts')}</CardTitle>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => loadAlerts()} disabled={loading} title={t('reload')}>
                                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            </Button>
                            <Can permission={ALERT_CENTER_PERMISSIONS.FILTER}>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="icon" className="h-9 w-9" title={t('filters.title')}><Filter className="h-4 w-4" /></Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="w-80">
                                        <div className="space-y-4 p-4">
                                            <div>
                                                <Label htmlFor="status">{t('filters.status')}</Label>
                                                <Select value={statusFilter || 'all'} onValueChange={(value) => setStatusFilter(value === 'all' ? '' : value)}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder={t('filters.all')} />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="all">{t('filters.all')}</SelectItem>
                                                        <SelectItem value="PENDING">{t('filters.statusOptions.pending')}</SelectItem>
                                                        <SelectItem value="COMPLETED">{t('filters.statusOptions.completed')}</SelectItem>
                                                        <SelectItem value="ACTION_TAKEN">{t('filters.statusOptions.actionTaken')}</SelectItem>
                                                        <SelectItem value="IGNORED">{t('filters.statusOptions.ignored')}</SelectItem>
                                                        <SelectItem value="SUPPRESSED">{t('filters.statusOptions.suppressed')}</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <Label htmlFor="priority">{t('filters.priority')}</Label>
                                                <Select value={priorityFilter || 'all'} onValueChange={(value) => setPriorityFilter(value === 'all' ? '' : value)}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder={t('filters.all')} />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="all">{t('filters.all')}</SelectItem>
                                                        <SelectItem value="LOW">{t('filters.priorityOptions.low')}</SelectItem>
                                                        <SelectItem value="MEDIUM">{t('filters.priorityOptions.medium')}</SelectItem>
                                                        <SelectItem value="HIGH">{t('filters.priorityOptions.high')}</SelectItem>
                                                        <SelectItem value="CRITICAL">{t('filters.priorityOptions.critical')}</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </Can>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4 p-6 bg-card pb-24">
                    {Object.entries(groupedAlerts).map(([category, categoryAlerts]) => {
                        const allInCategorySelected = categoryAlerts.every(a => selectedAlerts.includes(a.id));
                        const someInCategorySelected = categoryAlerts.some(a => selectedAlerts.includes(a.id));

                        return (
                            <Collapsible
                                key={category}
                                open={openCategories.includes(category)}
                                onOpenChange={() => toggleCategory(category)}
                            >
                                <div className="flex items-center gap-3 rounded-lg bg-muted px-4 py-3 text-left font-semibold">
                                    <Checkbox
                                        checked={allInCategorySelected ? true : (someInCategorySelected ? "indeterminate" : false)}
                                        onCheckedChange={(checked) => handleSelectCategory(categoryAlerts, !!checked)}
                                    />
                                    <CollapsibleTrigger className="flex items-center gap-3 flex-1">
                                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary">
                                            {categoryIcons[category as keyof typeof categoryIcons] || categoryIcons.DEFAULT}
                                        </div>
                                        <span>{t(`categories.${category.toLowerCase()}` as any)}</span>
                                        <Badge className="ml-auto">{categoryAlerts.length}</Badge>
                                        <ChevronDown className={`h-5 w-5 transition-transform ${openCategories.includes(category) ? 'rotate-180' : ''}`} />
                                    </CollapsibleTrigger>
                                </div>
                                <CollapsibleContent>
                                    <div className="divide-y divide-border">
                                        {categoryAlerts.map(alert => (
                                            <div key={alert.id} className="flex items-start gap-3 p-4 hover:bg-muted/50">
                                                <Checkbox
                                                    className="mt-1 shrink-0"
                                                    checked={selectedAlerts.includes(alert.id)}
                                                    onCheckedChange={(checked) => handleSelectAlert(alert.id, !!checked)}
                                                />
                                                <div className={`w-1.5 self-stretch rounded-full shrink-0 ${priorityConfig[alert.priority as keyof typeof priorityConfig].color}`} />
                                                <div className="flex-1 min-w-0 flex flex-col gap-2">
                                                    {/* Row 1: title + details */}
                                                    <div>
                                                        <p className="font-semibold leading-snug">{alert.title}</p>
                                                        {renderDisplayFields(alert, (alert as any).ui_display_config?.fields || [])}
                                                        {(() => {
                                                            const actions = alert.actions || [];
                                                            return actions.length > 0 ? (
                                                                <div className="mt-1 flex items-center gap-1 flex-wrap">
                                                                    <span className="text-xs text-muted-foreground">{t('actionHistory.title')}:</span>
                                                                    {actions.map(action => (
                                                                        <span key={action.id} className="text-xs px-2 py-0.5 bg-muted rounded-full">
                                                                            {action.action_type === 'SEND_EMAIL' && t('actionHistory.sendEmail')}
                                                                            {action.action_type === 'SEND_SMS' && t('actionHistory.sendSms')}
                                                                            {action.action_type === 'SEND_WHATSAPP' && t('actionHistory.sendWhatsApp')}
                                                                            {action.action_type !== 'SEND_EMAIL' && action.action_type !== 'SEND_SMS' && action.action_type !== 'SEND_WHATSAPP' && action.action_type}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            ) : null;
                                                        })()}
                                                    </div>
                                                    {/* Row 2: status badge */}
                                                    <div>
                                                        <div className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${alert.status === 'COMPLETED'
                                                            ? 'bg-primary text-primary-foreground'
                                                            : 'border border-input bg-background text-foreground'
                                                            }`}>
                                                            {t(`status.${alert.status.toLowerCase()}` as any)}
                                                        </div>
                                                    </div>
                                                    {/* Row 3: action buttons — icon-only, same row */}
                                                    <div className="flex items-center gap-1 border-t border-border/50 pt-2">
                                                        <Can permission={ALERT_CENTER_PERMISSIONS.SEND_EMAIL}>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8" title={t('actions.sendEmail')} onClick={() => sendEmail([alert.id])}><Mail className="h-4 w-4" /></Button>
                                                        </Can>
                                                        <Can permission={ALERT_CENTER_PERMISSIONS.COMPLETE}>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8" title={t('actions.markCompleted')} onClick={() => markAsCompleted([alert.id])}><CheckCircle className="h-4 w-4" /></Button>
                                                        </Can>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent>
                                                                <Can permission={ALERT_CENTER_PERMISSIONS.SEND_WHATSAPP}>
                                                                    <DropdownMenuLabel>{t('actionsGroups.communication')}</DropdownMenuLabel>
                                                                    <DropdownMenuItem onClick={() => sendWhatsApp([alert.id])} disabled><MessageCircle className="mr-2 h-4 w-4" />{t('actions.sendWhatsApp')}</DropdownMenuItem>
                                                                </Can>
                                                                <Can permission={ALERT_CENTER_PERMISSIONS.REGISTER_CALL}>
                                                                    <DropdownMenuItem onClick={() => { setAlertsToRegisterCall([alert.id]); setRegisterCallDialogOpen(true); }}><Phone className="mr-2 h-4 w-4" />{t('actions.registerCall')}</DropdownMenuItem>
                                                                </Can>
                                                                <Can permission={ALERT_CENTER_PERMISSIONS.SNOOZE}>
                                                                    <DropdownMenuSeparator />
                                                                    <DropdownMenuLabel>{t('actionsGroups.management')}</DropdownMenuLabel>
                                                                    <DropdownMenuItem onClick={() => { setAlertsToSnooze([alert.id]); setSnoozeDialogOpen(true); }}><Clock className="mr-2 h-4 w-4" />{t('actions.snooze')}</DropdownMenuItem>
                                                                </Can>
                                                                <Can permission={ALERT_CENTER_PERMISSIONS.IGNORE}>
                                                                    <DropdownMenuItem onClick={() => { setAlertsToIgnore([alert.id]); setIgnoreDialogOpen(true); }}><XCircle className="mr-2 h-4 w-4" />{t('actions.ignore')}</DropdownMenuItem>
                                                                </Can>
                                                                <Can permission={ALERT_CENTER_PERMISSIONS.ADD_NOTES}>
                                                                    <DropdownMenuSeparator />
                                                                    <DropdownMenuLabel>{t('actionsGroups.other')}</DropdownMenuLabel>
                                                                    <DropdownMenuItem onClick={() => { setAlertsForNote([alert.id]); setAddNoteDialogOpen(true); }}><FileText className="mr-2 h-4 w-4" />{t('actions.addNote')}</DropdownMenuItem>
                                                                </Can>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                        )
                    })}
                    {Object.keys(groupedAlerts).length === 0 && <p className="text-center text-muted-foreground py-8">{t('noAlerts')}</p>}
                </CardContent>
            </Card>

            {Object.keys(groupedAlerts).length > 0 && alertsTotalRecords > 0 && (
                <div className={cn(
                    "fixed bottom-6 left-1/2 -translate-x-1/2 z-40",
                    "bg-background/95 backdrop-blur-sm border border-border rounded-xl shadow-lg",
                    "p-2 flex flex-wrap items-center justify-center gap-2",
                    "w-[calc(100vw-2rem)] sm:w-auto",
                    selectedAlerts.length > 0 ? "mb-20" : "",
                    "animate-in slide-in-from-bottom-4 fade-in-0 duration-300 ease-out"
                )}>
                    <div className="flex items-center gap-2">
                        <Select value={alertsLimit.toString()} onValueChange={(val) => { setAlertsLimit(Number(val)); setAlertsPage(1); }}>
                            <SelectTrigger className="h-8 w-[80px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent side="top">
                                <SelectItem value="10">10</SelectItem>
                                <SelectItem value="25">25</SelectItem>
                                <SelectItem value="50">50</SelectItem>
                                <SelectItem value="100">100</SelectItem>
                            </SelectContent>
                        </Select>
                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                            {t('pagination.showing')} {alerts.length} {t('pagination.of')} {alertsTotalRecords}
                        </span>
                    </div>
                    <div className="hidden sm:block h-6 w-px bg-border" />
                    <div className="flex items-center gap-1">
                        <Button
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={() => setAlertsPage(1)}
                            disabled={alertsPage === 1}
                        >
                            <DoubleArrowLeftIcon className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={() => setAlertsPage(p => Math.max(1, p - 1))}
                            disabled={alertsPage === 1}
                        >
                            <ChevronLeftIcon className="h-4 w-4" />
                        </Button>
                        <span className="text-sm font-medium min-w-[80px] text-center">
                            {t('pagination.page', { current: alertsPage, total: Math.ceil(alertsTotalRecords / alertsLimit) || 1 })}
                        </span>
                        <Button
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={() => setAlertsPage(p => Math.min(Math.ceil(alertsTotalRecords / alertsLimit), p + 1))}
                            disabled={alertsPage >= Math.ceil(alertsTotalRecords / alertsLimit)}
                        >
                            <ChevronRightIcon className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={() => setAlertsPage(Math.ceil(alertsTotalRecords / alertsLimit))}
                            disabled={alertsPage >= Math.ceil(alertsTotalRecords / alertsLimit)}
                        >
                            <DoubleArrowRightIcon className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            <Dialog open={ignoreDialogOpen} onOpenChange={setIgnoreDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('ignoreAlert.title')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 px-6 py-4">
                        <Label htmlFor="reason">{t('ignoreAlert.reason')}</Label>
                        <Textarea
                            id="reason"
                            value={ignoreReason}
                            onChange={(e) => setIgnoreReason(e.target.value)}
                            placeholder={t('ignoreAlert.placeholder')}
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            onClick={() => {
                                markAsIgnored(alertsToIgnore, ignoreReason);
                                setIgnoreDialogOpen(false);
                                setIgnoreReason('');
                                setAlertsToIgnore([]);
                            }}
                        >
                            {t('ignoreAlert.submit')}
                        </Button>
                        <Button variant="outline" type="button" onClick={() => setIgnoreDialogOpen(false)}>{t('cancel')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={snoozeDialogOpen} onOpenChange={setSnoozeDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{t('snoozeAlert.title')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 px-6 py-4">
                        <div>
                            <Label htmlFor="snoozeDate">{t('snoozeAlert.date')}</Label>
                            <Input
                                type="datetime-local"
                                id="snoozeDate"
                                value={snoozeDate}
                                onChange={(e) => setSnoozeDate(e.target.value)}
                            />
                        </div>
                        <div>
                            <Label>{t('snoozeAlert.quickOptions')}</Label>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => setSnoozeDate(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16))}>1 {t('snoozeAlert.day')}</Button>
                                <Button variant="outline" size="sm" onClick={() => setSnoozeDate(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16))}>3 {t('snoozeAlert.days')}</Button>
                                <Button variant="outline" size="sm" onClick={() => setSnoozeDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16))}>1 {t('snoozeAlert.week')}</Button>
                            </div>
                        </div>
                        <div>
                            <Label htmlFor="reason">{t('snoozeAlert.reason')}</Label>
                            <Textarea
                                id="reason"
                                value={snoozeReason}
                                onChange={(e) => setSnoozeReason(e.target.value)}
                                placeholder={t('snoozeAlert.placeholder')}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            onClick={() => {
                                snoozeAlerts(alertsToSnooze, snoozeDate, snoozeReason);
                                setSnoozeDialogOpen(false);
                                setSnoozeReason('');
                                setSnoozeDate('');
                                setAlertsToSnooze([]);
                            }}
                            disabled={!snoozeDate}
                        >
                            {t('snoozeAlert.submit')}
                        </Button>
                        <Button variant="outline" type="button" onClick={() => setSnoozeDialogOpen(false)}>{t('cancel')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={registerCallDialogOpen} onOpenChange={setRegisterCallDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('registerCall.title')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 px-6 py-4">
                        <div>
                            <Label htmlFor="registerCallDate">{t('registerCall.date')}</Label>
                            <Input
                                type="datetime-local"
                                id="registerCallDate"
                                value={registerCallDate}
                                onChange={(e) => setRegisterCallDate(e.target.value)}
                            />
                        </div>
                        <div>
                            <Label htmlFor="registerCallNotes">{t('registerCall.notes')}</Label>
                            <Textarea
                                id="registerCallNotes"
                                value={registerCallNotes}
                                onChange={(e) => setRegisterCallNotes(e.target.value)}
                                placeholder={t('registerCall.notesPlaceholder')}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            onClick={() => {
                                registerCall(alertsToRegisterCall, registerCallDate, registerCallNotes);
                                setRegisterCallDialogOpen(false);
                                setRegisterCallDate('');
                                setRegisterCallNotes('');
                                setAlertsToRegisterCall([]);
                            }}
                            disabled={!registerCallDate}
                        >
                            {t('registerCall.submit')}
                        </Button>
                        <Button variant="outline" type="button" onClick={() => setRegisterCallDialogOpen(false)}>{t('cancel')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={addNoteDialogOpen} onOpenChange={setAddNoteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('addNote.title')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 px-6 py-4">
                        <div>
                            <Label htmlFor="noteContent">{t('addNote.note')}</Label>
                            <Textarea
                                id="noteContent"
                                value={noteContent}
                                onChange={(e) => setNoteContent(e.target.value)}
                                placeholder={t('addNote.notePlaceholder')}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            onClick={() => {
                                addNote(alertsForNote, noteContent);
                                setAddNoteDialogOpen(false);
                                setNoteContent('');
                                setAlertsForNote([]);
                            }}
                            disabled={!noteContent}
                        >
                            {t('addNote.submit')}
                        </Button>
                        <Button variant="outline" type="button" onClick={() => setAddNoteDialogOpen(false)}>{t('cancel')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Communication Warning Dialog */}
            <CommunicationWarningDialog
                open={isWarningDialogOpen}
                onOpenChange={setIsWarningDialogOpen}
                disabledItems={disabledItems}
                itemLabel="User ID"
                onConfirm={handleWarningConfirm}
            />

            {/* Floating Bulk Actions Bar */}
            <Can permission={ALERT_CENTER_PERMISSIONS.BULK_ACTIONS}>
                <BulkActionsFloatingBar
                    selectedCount={selectedAlerts.length}
                    loadingAction={bulkActionLoading}
                    onMarkAsCompleted={() => markAsCompleted(selectedAlerts)}
                    onSendEmail={() => sendEmail(selectedAlerts)}
                    onSendSms={() => sendSms(selectedAlerts)}
                    onSendWhatsApp={() => sendWhatsApp(selectedAlerts)}
                    onIgnore={() => { if (!bulkActionLoading) { setAlertsToIgnore(selectedAlerts); setIgnoreDialogOpen(true); } }}
                    onSnooze={() => { if (!bulkActionLoading) { setAlertsToSnooze(selectedAlerts); setSnoozeDialogOpen(true); } }}
                    onDeselectAll={() => setSelectedAlerts([])}
                    canComplete={hasPermission(ALERT_CENTER_PERMISSIONS.COMPLETE)}
                    canSendEmail={hasPermission(ALERT_CENTER_PERMISSIONS.SEND_EMAIL)}
                    canSendSms={hasPermission(ALERT_CENTER_PERMISSIONS.SEND_SMS)}
                    canSendWhatsApp={hasPermission(ALERT_CENTER_PERMISSIONS.SEND_WHATSAPP)}
                    canSnooze={hasPermission(ALERT_CENTER_PERMISSIONS.SNOOZE)}
                    canIgnore={hasPermission(ALERT_CENTER_PERMISSIONS.IGNORE)}
                />
            </Can>

        </div>
    );
}

export default AlertsCenterPageContent;
