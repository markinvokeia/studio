
'use client';

import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Timeline, TimelineConnector, TimelineContent, TimelineHeader, TimelineIcon, TimelineItem, TimelineTitle } from '@/components/ui/timeline';
import { API_ROUTES } from '@/constants/routes';
import { PatientSession, User } from '@/lib/types';
import { cn } from '@/lib/utils';
import api from '@/services/api';
import { format, parseISO } from 'date-fns';
import { enUS, es } from 'date-fns/locale';
import { ArrowRight, ChevronDown, FileText, Microscope, Pill, Stethoscope, UserPlus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import * as React from 'react';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Skeleton } from '../ui/skeleton';

interface MedicalHistoryProps {
    user: User;
}

const eventIcons: { [key: string]: React.ElementType } = {
    appointment: UserPlus,
    procedure: Stethoscope,
    test: Microscope,
    prescription: Pill,
    note: FileText,
};

async function getPatientSessions(userId: string): Promise<PatientSession[]> {
    if (!userId) return [];
    try {
        const data = await api.get(API_ROUTES.CLINIC_HISTORY.PATIENT_SESSIONS, { user_id: userId });
        const sessionsData = Array.isArray(data) ? data : (data.patient_sessions || data.data || []);

        return sessionsData.map((session: any) => ({
            ...session,
            sesion_id: String(session.sesion_id),
        }));
    } catch (error) {
        console.error("Failed to fetch patient sessions:", error);
        return [];
    }
}

export function MedicalHistory({ user }: MedicalHistoryProps) {
    const t = useTranslations('ClinicHistoryPage.MedicalHistory');
    const [openItems, setOpenItems] = React.useState<string[]>([]);
    const [sessions, setSessions] = React.useState<PatientSession[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const locale = useLocale();
    const dateFnsLocale = locale === 'es' ? es : enUS;

    React.useEffect(() => {
        const fetchSessions = async () => {
            if (user?.id) {
                setIsLoading(true);
                const fetchedSessions = await getPatientSessions(user.id);
                setSessions(fetchedSessions.slice(0, 5)); // show only latest 5 for summary
                setIsLoading(false);
            }
        };
        fetchSessions();
    }, [user]);

    const toggleItem = (id: string) => {
        setOpenItems(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
    };

    if (isLoading) {
        return (
            <div className="flex-1 flex flex-col min-h-0 space-y-2 pt-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col min-h-0">
            <ScrollArea className="flex-1 w-full p-4">
                {sessions.length > 0 ? (
                    <Timeline>
                        {sessions.map((session) => {
                            const Icon = eventIcons['procedure']; // Default icon
                            const isOpen = openItems.includes(String(session.sesion_id));
                            return (
                                <TimelineItem key={session.sesion_id}>
                                    <TimelineConnector />
                                    <TimelineHeader>
                                        <TimelineIcon>
                                            <Icon size={16} />
                                        </TimelineIcon>
                                        <div className="flex flex-col flex-grow ml-5">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-baseline gap-2">
                                                    <p className='text-sm font-medium text-muted-foreground'>{format(parseISO(session.fecha_sesion), 'PPP', { locale: dateFnsLocale })}</p>
                                                    <TimelineTitle>{session.procedimiento_realizado}</TimelineTitle>
                                                </div>
                                            </div>
                                            <p className="text-sm text-muted-foreground">{session.diagnostico}</p>
                                        </div>
                                    </TimelineHeader>
                                    <TimelineContent>
                                        <Collapsible open={isOpen} onOpenChange={() => toggleItem(String(session.sesion_id))}>
                                            <CollapsibleTrigger asChild>
                                                <Button variant="link" className="p-0 h-auto text-sm flex items-center gap-1">
                                                    {isOpen ? t('showLess') : t('showMore', { count: '' })}
                                                    <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
                                                </Button>
                                            </CollapsibleTrigger>
                                            <CollapsibleContent>
                                                <div className="mt-2 text-sm text-muted-foreground space-y-2">
                                                    <p><strong>{t('notes')}</strong> {session.notas_clinicas}</p>
                                                    {session.tratamientos && session.tratamientos.length > 0 && (
                                                        <div>
                                                            <strong>{t('treatments')}</strong>
                                                            <ul className="list-disc pl-5">
                                                                {session.tratamientos.map((treatment, i) => (
                                                                    <li key={i}>{treatment.descripcion} {treatment.numero_diente && `(${t('tooth', { tooth: treatment.numero_diente })})`}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                    {session.archivos_adjuntos && session.archivos_adjuntos.length > 0 && (
                                                        <div>
                                                            <strong>{t('attachments')}</strong>
                                                            <ul className="list-disc pl-5">
                                                                {session.archivos_adjuntos.map((file, i) => (
                                                                    <li key={i}>
                                                                        <a href={file.ruta} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                                                            {file.tipo} {file.diente_asociado && `(${t('tooth', { tooth: file.diente_asociado })})`}
                                                                        </a>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </div>
                                            </CollapsibleContent>
                                        </Collapsible>
                                    </TimelineContent>
                                </TimelineItem>
                            );
                        })}
                    </Timeline>
                ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground min-h-[200px]">
                        {t('noHistory')}
                    </div>
                )}
            </ScrollArea>
            <div className="p-4 border-t mt-auto">
                <div className="w-full">
                    <Link href={`/${locale}/clinic-history/${user.id}`} passHref>
                        <Button variant="outline" className="w-full">
                            {t('viewFullHistory')}
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
