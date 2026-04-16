'use client';

import { ResizableSheet, SheetTitle, SheetDescription } from '@/components/ui/resizable-sheet';
import { VerticalTabStrip } from '@/components/ui/vertical-tab-strip';
import type { VerticalTab } from '@/components/ui/vertical-tab-strip';
import { UserServices } from '@/components/users/user-services';
import { UserMessages } from '@/components/users/user-messages';
import { UserLogs } from '@/components/users/user-logs';
import { DoctorAppointments } from '@/components/appointments/DoctorAppointments';
import { Mail, Phone, UserSquare, CalendarDays, Wrench, MessageSquare, History } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

interface DoctorDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctorId: string;
  doctorName: string;
  doctorEmail?: string;
  doctorPhone?: string;
  doctorColor?: string;
}

export function DoctorDetailSheet({
  open,
  onOpenChange,
  doctorId,
  doctorName,
  doctorEmail,
  doctorPhone,
  doctorColor,
}: DoctorDetailSheetProps) {
  const tUsers = useTranslations('UsersPage');
  const tAppts = useTranslations('AppointmentsPage');
  const [activeTab, setActiveTab] = React.useState('appointments');

  const tabs: VerticalTab[] = [
    { id: 'appointments', icon: CalendarDays, label: tAppts('title') },
    { id: 'services', icon: Wrench, label: tUsers('tabs.services') },
    { id: 'messages', icon: MessageSquare, label: tUsers('tabs.messages') },
    { id: 'logs', icon: History, label: tUsers('tabs.logs') },
  ];

  return (
    <ResizableSheet
      open={open}
      onOpenChange={onOpenChange}
      defaultWidth={900}
      minWidth={520}
      maxWidth={1300}
      storageKey="doctor-detail-sheet-width"
    >
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex-none border-b border-border bg-card px-6 py-4 pr-14">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full shrink-0"
              style={doctorColor ? { backgroundColor: doctorColor + '22', color: doctorColor } : { backgroundColor: 'hsl(var(--muted))' }}
            >
              <UserSquare className="h-4 w-4" style={doctorColor ? { color: doctorColor } : { color: 'hsl(var(--muted-foreground))' }} />
            </div>
            <div className="min-w-0">
              <SheetTitle className="text-base font-semibold truncate leading-tight">{doctorName}</SheetTitle>
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                {doctorEmail && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    {doctorEmail}
                  </span>
                )}
                {doctorPhone && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {doctorPhone}
                  </span>
                )}
              </div>
              <SheetDescription className="sr-only">{tUsers('detailsFor', { name: doctorName })}</SheetDescription>
            </div>
          </div>
        </div>

        {/* Body: horizontal tabs + content */}
        <div className="flex flex-col flex-1 overflow-hidden min-h-0">
          <VerticalTabStrip
            tabs={tabs}
            activeTabId={activeTab}
            onTabClick={(tab) => setActiveTab(tab.id)}
          />
          <div className="flex-1 overflow-hidden min-h-0 flex flex-col p-3">
            {activeTab === 'appointments' && <DoctorAppointments doctorId={doctorId} />}
            {activeTab === 'services' && <UserServices userId={doctorId} isSalesUser={true} />}
            {activeTab === 'messages' && <UserMessages userId={doctorId} />}
            {activeTab === 'logs' && <UserLogs userId={doctorId} />}
          </div>
        </div>
      </div>
    </ResizableSheet>
  );
}
