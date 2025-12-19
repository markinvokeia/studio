
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertInstance } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, DollarSign, Stethoscope, AlertTriangle, ChevronDown, Filter, User } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useTranslations } from 'next-intl';

const mockAlerts: AlertInstance[] = [
    { id: '1', rule_id: '1', reference_table: 'appointments', reference_id: '101', alert_date: '2024-07-30', title: 'Cita de Mañana - Juan Pérez', summary: 'Recordatorio 24h para consulta general.', status: 'PENDING', priority: 'HIGH', rule_name: 'APPT_REMINDER_24H', patient_name: 'Juan Pérez' },
    { id: '2', rule_id: '2', reference_table: 'invoices', reference_id: 'INV-002', alert_date: '2024-07-30', title: 'Factura Vencida - Ana Gómez', summary: 'Factura #INV-002 venció hace 5 días.', status: 'PENDING', priority: 'CRITICAL', rule_name: 'INV_OVERDUE', patient_name: 'Ana Gómez' },
    { id: '3', rule_id: '3', reference_table: 'patients', reference_id: '303', alert_date: '2024-07-30', title: 'Cumpleaños de Carlos Ruiz', summary: 'Hoy es el cumpleaños de Carlos Ruiz.', status: 'PENDING', priority: 'LOW', rule_name: 'PATIENT_BIRTHDAY', patient_name: 'Carlos Ruiz' },
    { id: '4', rule_id: '1', reference_table: 'appointments', reference_id: '102', alert_date: '2024-07-30', title: 'Cita de Mañana - Luisa Martin', summary: 'Recordatorio 24h para limpieza dental.', status: 'COMPLETED', priority: 'HIGH', rule_name: 'APPT_REMINDER_24H', patient_name: 'Luisa Martin' },
    { id: '5', rule_id: '4', reference_table: 'appointments', reference_id: '103', alert_date: '2024-07-30', title: 'Seguimiento Post-Consulta - Juan Pérez', summary: 'Contactar 1 semana después de la extracción.', status: 'IN_PROGRESS', priority: 'MEDIUM', rule_name: 'APPT_FOLLOWUP', patient_name: 'Juan Pérez' },
];

const priorityConfig = {
    CRITICAL: { color: 'bg-red-500', text: 'text-red-500', label: 'Critical' },
    HIGH: { color: 'bg-orange-500', text: 'text-orange-500', label: 'High' },
    MEDIUM: { color: 'bg-yellow-500', text: 'text-yellow-500', label: 'Medium' },
    LOW: { color: 'bg-blue-500', text: 'text-blue-500', label: 'Low' },
};

const categoryIcons = {
    APPOINTMENTS: <Calendar className="h-5 w-5" />,
    BILLING: <DollarSign className="h-5 w-5" />,
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
    const [alerts, setAlerts] = React.useState<AlertInstance[]>(mockAlerts);
    const [openCategories, setOpenCategories] = React.useState<string[]>([]);

    const groupedAlerts = React.useMemo(() => {
        return alerts.reduce((acc, alert) => {
            const category = getCategoryFromRule(alert.rule_name || '');
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(alert);
            return acc;
        }, {} as Record<string, AlertInstance[]>);
    }, [alerts]);

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
        <div className="space-y-4">
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
                           {/* Filter components will go here */}
                           <Button variant="outline" size="sm"><Filter className="mr-2 h-4 w-4"/> {t('filters.title')}</Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {Object.entries(groupedAlerts).map(([category, categoryAlerts]) => (
                        <Collapsible 
                            key={category}
                            open={openCategories.includes(category)}
                            onOpenChange={() => toggleCategory(category)}
                        >
                            <CollapsibleTrigger className="w-full">
                                <div className="flex items-center gap-3 rounded-lg bg-muted px-4 py-3 text-left font-semibold">
                                    {categoryIcons[category as keyof typeof categoryIcons] || categoryIcons.DEFAULT}
                                    <span>{category}</span>
                                    <Badge className="ml-auto">{categoryAlerts.length}</Badge>
                                    <ChevronDown className={`h-5 w-5 transition-transform ${openCategories.includes(category) ? 'rotate-180' : ''}`} />
                                </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                                <div className="divide-y divide-border">
                                {categoryAlerts.map(alert => (
                                    <div key={alert.id} className="flex items-center gap-4 p-4 hover:bg-muted/50">
                                        <div className={`w-1.5 h-10 rounded-full ${priorityConfig[alert.priority as keyof typeof priorityConfig].color}`}></div>
                                        <div className="flex-1">
                                            <p className="font-semibold">{alert.title}</p>
                                            <p className="text-sm text-muted-foreground">{alert.summary}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant={alert.status === 'COMPLETED' ? 'default' : 'outline'}>{alert.status}</Badge>
                                            <User className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-sm text-muted-foreground">{alert.patient_name}</span>
                                        </div>
                                    </div>
                                ))}
                                </div>
                            </CollapsibleContent>
                        </Collapsible>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}
