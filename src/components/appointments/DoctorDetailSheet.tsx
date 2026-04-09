'use client';

import { ResizableSheet, SheetTitle, SheetDescription } from '@/components/ui/resizable-sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserServices } from '@/components/users/user-services';
import { UserMessages } from '@/components/users/user-messages';
import { UserLogs } from '@/components/users/user-logs';
import { DoctorAppointments } from '@/components/appointments/DoctorAppointments';
import { SHEET_TAB_CLASS } from '@/components/appointments/sheet-utils';
import { Mail, Phone, UserSquare } from 'lucide-react';
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
  const t = useTranslations('DoctorsPage');
  const tUsers = useTranslations('UsersPage');
  const tAppts = useTranslations('AppointmentsPage');
  const [activeTab, setActiveTab] = React.useState('appointments');

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
        <div className="flex-none border-b border-border bg-card px-6 py-5 pr-14">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full shrink-0"
              style={doctorColor ? { backgroundColor: doctorColor + '33', color: doctorColor } : undefined}
            >
              <UserSquare className={`h-5 w-5 ${doctorColor ? '' : 'text-muted-foreground'}`} style={doctorColor ? { color: doctorColor } : undefined} />
            </div>
            <div className="min-w-0">
              <SheetTitle className="text-lg font-semibold truncate">{doctorName}</SheetTitle>
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

        {/* Tabs */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0 px-6 pb-6 pt-3">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <TabsList className="bg-transparent p-0 border-b border-border rounded-none gap-0 overflow-x-auto overflow-y-hidden flex-nowrap shrink-0 justify-start h-auto">
              <TabsTrigger value="appointments" className={SHEET_TAB_CLASS}>{tAppts('title')}</TabsTrigger>
              <TabsTrigger value="services" className={SHEET_TAB_CLASS}>{tUsers('tabs.services')}</TabsTrigger>
              <TabsTrigger value="messages" className={SHEET_TAB_CLASS}>{tUsers('tabs.messages')}</TabsTrigger>
              <TabsTrigger value="logs" className={SHEET_TAB_CLASS}>{tUsers('tabs.logs')}</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-hidden flex flex-col min-h-0 mt-3">
              <TabsContent value="appointments" className="m-0 flex-1 min-h-0 data-[state=active]:flex data-[state=active]:flex-col rounded-lg bg-muted/30 p-3">
                <DoctorAppointments doctorId={doctorId} />
              </TabsContent>
              <TabsContent value="services" className="m-0 flex-1 min-h-0 data-[state=active]:flex data-[state=active]:flex-col rounded-lg bg-muted/30 p-3">
                <UserServices userId={doctorId} isSalesUser={true} />
              </TabsContent>
              <TabsContent value="messages" className="m-0 flex-1 min-h-0 data-[state=active]:flex data-[state=active]:flex-col rounded-lg bg-muted/30 p-3">
                <UserMessages userId={doctorId} />
              </TabsContent>
              <TabsContent value="logs" className="m-0 flex-1 min-h-0 data-[state=active]:flex data-[state=active]:flex-col rounded-lg bg-muted/30 p-3">
                <UserLogs userId={doctorId} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </ResizableSheet>
  );
}
