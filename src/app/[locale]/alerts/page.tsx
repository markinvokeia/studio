
'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { API_ROUTES } from '@/constants/routes';
import { toast } from '@/hooks/use-toast';
import { AlertInstance, AlertAction, AlertCategory } from '@/lib/types';
import { api } from '@/services/api';
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
    XCircle
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';

const fetchAlerts = async (status?: string, priority?: string) => {
    try {
        const query: Record<string, string> = {};
        if (status !== undefined) query.status = status;
        if (priority !== undefined) query.priority = priority;
        const response = await api.get(API_ROUTES.SYSTEM.ALERT_INSTANCES, query);
        // Handle null/empty responses
        if (!response || (Array.isArray(response) && response.length === 1 && Object.keys(response[0]).length === 0)) {
            return [];
        }
        // Assuming response is array of alert instances
        const alerts: AlertInstance[] = response.map((alert: any) => ({
            ...alert,
            rule_name: alert.rule_name || 'DEFAULT',
            patient_name: alert.details_json?.patient?.full_name || 'Unknown',
        }));
        return alerts;
    } catch (error) {
        console.error('Failed to fetch alerts:', error);
        return [];
    }
};

const fetchAlertActions = async (): Promise<AlertAction[]> => {
    try {
        const response = await api.get(API_ROUTES.SYSTEM.ALERT_ACTIONS);
        // Handle null/empty responses
        return response || [];
    } catch (error) {
        console.error('Failed to fetch alert actions:', error);
        return [];
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

const SummaryCard = ({ title, count, color }: { title: string, count: number, color: string }) => (
    <Card className={`bg-opacity-10 border-l-4 ${color}`}>
        <CardHeader className="p-4">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <p className="text-2xl font-bold">{count}</p>
        </CardHeader>
    </Card>
);

export default function AlertsCenterPage() {
    const t = useTranslations('AlertsCenterPage');
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


    const loadAlerts = async () => {
        setLoading(true);
        try {
            const [alertsData, actionsData, categoriesData] = await Promise.all([
                fetchAlerts(statusFilter || undefined, priorityFilter || undefined),
                fetchAlertActions(),
                fetchAlertCategories()
            ]);
            setAlerts(alertsData);
            setAlertActions(actionsData);
            setAlertCategories(categoriesData);
        } catch (error) {
            console.error('Failed to load alerts:', error);
        } finally {
            setLoading(false);
        }
    };

    React.useEffect(() => {
        loadAlerts();
    }, [statusFilter, priorityFilter]);

    const markAsCompleted = async (alertIds: string[]) => {
        try {
            await api.post(API_ROUTES.SYSTEM.ALERT_INSTANCES_COMPLETE, { ids: alertIds });
            setAlerts(prev => prev.map(a => alertIds.includes(a.id) ? { ...a, status: 'COMPLETED' } : a));
            setSelectedAlerts([]);
            toast({ title: t('toast.alertsUpdated'), description: t('toast.alertsMarkedCompleted', { count: alertIds.length }) });
        } catch (error) {
            console.error('Failed to mark alerts as completed:', error);
            toast({ title: t('toast.markCompletedFailed'), description: t('toast.markCompletedFailedDescription'), variant: 'destructive' });
        }
    };

    const markAsIgnored = async (alertIds: string[], reason: string) => {
        try {
            await api.post(API_ROUTES.SYSTEM.ALERT_INSTANCES_IGNORE, { ids: alertIds, reason });
            setAlerts(prev => prev.map(a => alertIds.includes(a.id) ? { ...a, status: 'IGNORED' } : a));
            setSelectedAlerts([]);
            toast({ title: t('toast.alertsUpdated'), description: t('toast.alertsMarkedIgnored', { count: alertIds.length }) });
        } catch (error) {
            console.error('Failed to mark alerts as ignored:', error);
            toast({ title: t('toast.markIgnoredFailed'), description: t('toast.markIgnoredFailedDescription'), variant: 'destructive' });
        }
    };

    const snoozeAlerts = async (alertIds: string[], snoozeUntil: string, reason: string) => {
        try {
            await api.post(API_ROUTES.SYSTEM.ALERT_INSTANCES_SNOOZE, { ids: alertIds, snooze_until: snoozeUntil, reason });
            setAlerts(prev => prev.map(a => alertIds.includes(a.id) ? { ...a, status: 'SNOOZED' } : a));
            setSelectedAlerts([]);
            toast({ title: t('toast.alertsUpdated'), description: t('toast.alertsSnoozed', { count: alertIds.length }) });
        } catch (error) {
            console.error('Failed to snooze alerts:', error);
            toast({ title: t('toast.snoozeFailed'), description: t('toast.snoozeFailedDescription'), variant: 'destructive' });
        }
    };

    const sendEmail = async (alertIds: string[]) => {
        try {
            await api.post(API_ROUTES.SYSTEM.ALERT_INSTANCES_SEND_EMAIL, { ids: alertIds });
            toast({ title: t('toast.emailSent'), description: t('toast.emailSentDescription', { count: alertIds.length }) });
        } catch (error) {
            console.error('Failed to send email:', error);
            toast({ title: t('toast.emailSendFailed'), description: t('toast.emailSendFailedDescription'), variant: 'destructive' });
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
        }
    };

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
        total: alerts.filter(a => a.status === 'PENDING').length,
        critical: alerts.filter(a => a.priority === 'CRITICAL' && a.status === 'PENDING').length,
        high: alerts.filter(a => a.priority === 'HIGH' && a.status === 'PENDING').length,
        medium: alerts.filter(a => a.priority === 'MEDIUM' && a.status === 'PENDING').length,
    };

    return (
        <div className="space-y-4 pb-20">
            <Card>
                <CardHeader>
                    <CardTitle>{t('title')}</CardTitle>
                    <CardDescription>{t('description')}</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <SummaryCard title={t('summary.total')} count={summaryCounts.total} color="border-primary" />
                    <SummaryCard title={t('summary.critical')} count={summaryCounts.critical} color="border-red-500" />
                    <SummaryCard title={t('summary.high')} count={summaryCounts.high} color="border-orange-500" />
                    <SummaryCard title={t('summary.medium')} count={summaryCounts.medium} color="border-yellow-500" />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>{t('dailyAlerts')}</CardTitle>
                        <div className="flex items-center gap-2">
                            {selectedAlerts.length > 0 && (
                                <>
                                    <Button variant="ghost" size="sm" onClick={() => markAsCompleted(selectedAlerts)} title={t('bulkActions.markAllCompleted')}>
                                        <CheckCircle className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => sendEmail(selectedAlerts)} title={t('bulkActions.sendEmailToAll')}>
                                        <Mail className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => { setAlertsToIgnore(selectedAlerts); setIgnoreDialogOpen(true); }} title={t('bulkActions.ignoreAll')}>
                                        <XCircle className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => { setAlertsToSnooze(selectedAlerts); setSnoozeDialogOpen(true); }} title={t('bulkActions.snoozeAll')}>
                                        <Clock className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => setSelectedAlerts([])} title={t('bulkActions.deselectAll')}>
                                        <XCircle className="h-4 w-4" />
                                    </Button>
                                    <div className="h-6 w-px bg-border" />
                                </>
                            )}
                            <Button variant="outline" size="sm" onClick={() => loadAlerts()} disabled={loading}>
                                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                {t('reload')}
                            </Button>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm"><Filter className="mr-2 h-4 w-4" /> {t('filters.title')}</Button>
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
                                                    <SelectItem value="IN_PROGRESS">{t('filters.statusOptions.inProgress')}</SelectItem>
                                                    <SelectItem value="IGNORED">{t('filters.statusOptions.ignored')}</SelectItem>
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
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
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
                                        {categoryIcons[category as keyof typeof categoryIcons] || categoryIcons.DEFAULT}
                                        <span>{t(`categories.${category.toLowerCase()}` as any)}</span>
                                        <Badge className="ml-auto">{categoryAlerts.length}</Badge>
                                        <ChevronDown className={`h-5 w-5 transition-transform ${openCategories.includes(category) ? 'rotate-180' : ''}`} />
                                    </CollapsibleTrigger>
                                </div>
                                <CollapsibleContent>
                                    <div className="divide-y divide-border">
                                        {categoryAlerts.map(alert => (
                                            <div key={alert.id} className="flex items-center gap-4 p-4 hover:bg-muted/50">
                                                <Checkbox
                                                    checked={selectedAlerts.includes(alert.id)}
                                                    onCheckedChange={(checked) => handleSelectAlert(alert.id, !!checked)}
                                                />
                                                <div className={`w-1.5 h-10 rounded-full ${priorityConfig[alert.priority as keyof typeof priorityConfig].color}`}></div>
                                                <div className="flex-1">
                                                    <p className="font-semibold">{alert.title}</p>
                                                    <p className="text-sm text-muted-foreground">{alert.summary}</p>
                                                    {(() => {
                                                        const actions = alertActions.filter(action => action.alert_instance_id === parseInt(alert.id));
                                                        const isOpen = openActionCollapsibles.includes(alert.id);
                                                        return actions.length > 0 ? (
                                                            <Collapsible
                                                                className="mt-2"
                                                                open={isOpen}
                                                                onOpenChange={(open) => setOpenActionCollapsibles(prev =>
                                                                    open ? [...prev, alert.id] : prev.filter(id => id !== alert.id)
                                                                )}
                                                            >
                                                                <CollapsibleTrigger className="text-xs text-muted-foreground hover:text-foreground">
                                                                    Actions taken ({actions.length}) <ChevronDown className={`inline h-3 w-3 ml-1 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                                                                </CollapsibleTrigger>
                                                                <CollapsibleContent>
                                                                    <div className="mt-1 space-y-1">
                                                                        {actions.map(action => (
                                                                            <div key={action.id} className="text-xs bg-muted p-2 rounded">
                                                                                <strong>{action.action_type}</strong> - {action.result_status} ({new Date(action.performed_at).toLocaleString()})
                                                                                {action.action_data?.data?.title && <p><strong>Title:</strong> {action.action_data.data.title}</p>}
                                                                                {action.action_data?.data?.summary && <p><strong>Summary:</strong> {action.action_data.data.summary}</p>}
                                                                                {(action.action_data?.patient?.email || action.action_data?.clinic?.email) && (
                                                                                    <p><strong>Recipient:</strong> {action.action_data.patient?.email || action.action_data.clinic?.email}</p>
                                                                                )}
                                                                                {action.result_message && <p><strong>Message:</strong> {action.result_message}</p>}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </CollapsibleContent>
                                                            </Collapsible>
                                                        ) : null;
                                                    })()}
                                                </div>
                                                <div className="flex items-center gap-4 text-muted-foreground">
                                                    <Badge variant={alert.status === 'COMPLETED' ? 'default' : 'outline'}>{t(`status.${alert.status.toLowerCase()}` as any)}</Badge>
                                                    <User className="h-4 w-4" />
                                                    <span className="text-sm">{alert.patient_name}</span>
                                                    <div className="flex items-center gap-1">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => sendEmail([alert.id])}><Mail className="h-4 w-4" /></Button>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => markAsCompleted([alert.id])}><CheckCircle className="h-4 w-4" /></Button>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent>
                                                                <DropdownMenuItem><MessageSquare className="mr-2 h-4 w-4" />{t('actions.sendSms')}</DropdownMenuItem>
                                                                <DropdownMenuItem><Phone className="mr-2 h-4 w-4" />{t('actions.registerCall')}</DropdownMenuItem>
                                                                <DropdownMenuItem><Printer className="mr-2 h-4 w-4" />{t('actions.print')}</DropdownMenuItem>
                                                                <DropdownMenuItem><Clock className="mr-2 h-4 w-4" />{t('actions.snooze')}</DropdownMenuItem>
                                                                <DropdownMenuItem><UserPlus className="mr-2 h-4 w-4" />{t('actions.assign')}</DropdownMenuItem>
                                                                <DropdownMenuItem><FileText className="mr-2 h-4 w-4" />{t('actions.addNote')}</DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => { setAlertsToIgnore([alert.id]); setIgnoreDialogOpen(true); }}><XCircle className="mr-2 h-4 w-4" />{t('actions.ignore')}</DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => { setAlertsToSnooze([alert.id]); setSnoozeDialogOpen(true); }}><Clock className="mr-2 h-4 w-4" />{t('actions.snooze')}</DropdownMenuItem>
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

            <Dialog open={ignoreDialogOpen} onOpenChange={setIgnoreDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('ignoreAlert.title')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
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
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={snoozeDialogOpen} onOpenChange={setSnoozeDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{t('snoozeAlert.title')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
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
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
