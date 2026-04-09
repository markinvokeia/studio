'use client';

import { ResizableSheet, SheetTitle, SheetDescription } from '@/components/ui/resizable-sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { UserFinancialSummaryStats } from '@/components/users/user-financial-summary-stats';
import { ClinicHistoryViewer } from '@/components/users/clinic-history-viewer';
import { UserQuotes } from '@/components/users/user-quotes';
import { UserOrders } from '@/components/users/user-orders';
import { UserInvoices } from '@/components/users/user-invoices';
import { UserPayments } from '@/components/users/user-payments';
import { UserAppointments } from '@/components/users/user-appointments';
import { UserMessages } from '@/components/users/user-messages';
import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import { UserFinancial, User } from '@/lib/types';
import { SHEET_TAB_CLASS } from '@/components/appointments/sheet-utils';
import { Mail, Phone, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

interface PatientDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  userEmail?: string;
  userPhone?: string;
}

export function PatientDetailSheet({
  open,
  onOpenChange,
  userId,
  userName,
  userEmail,
  userPhone,
}: PatientDetailSheetProps) {
  const t = useTranslations('UsersPage');
  const [financialData, setFinancialData] = React.useState<UserFinancial | null>(null);
  const [isStatsOpen, setIsStatsOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('clinical-history');

  React.useEffect(() => {
    if (!open || !userId) return;
    let active = true;
    api.get(API_ROUTES.USER_FINANCIAL, { user_id: userId })
      .then((data: any) => {
        if (!active) return;
        if (Array.isArray(data) && data.length > 0) setFinancialData(data[0] as UserFinancial);
        else setFinancialData(null);
      })
      .catch(() => { if (active) setFinancialData(null); });
    return () => { active = false; };
  }, [open, userId]);

  // Minimal User object for components that require it
  const user: User = React.useMemo(() => ({
    id: userId,
    name: userName,
    email: userEmail || '',
    phone_number: userPhone || '',
    is_active: true,
    avatar: '',
  }), [userId, userName, userEmail, userPhone]);

  return (
    <ResizableSheet
      open={open}
      onOpenChange={onOpenChange}
      defaultWidth={900}
      minWidth={520}
      maxWidth={1300}
      storageKey="patient-detail-sheet-width"
    >
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex-none border-b border-border bg-card px-6 py-5 pr-14">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted shrink-0">
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <SheetTitle className="text-lg font-semibold truncate">{userName}</SheetTitle>
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                {userEmail && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    {userEmail}
                  </span>
                )}
                {userPhone && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {userPhone}
                  </span>
                )}
              </div>
              <SheetDescription className="sr-only">{t('detailsFor', { name: userName })}</SheetDescription>
            </div>
          </div>
        </div>

        {/* Financial stats */}
        <div className="flex-none px-6 pt-3 pb-0">
          <UserFinancialSummaryStats
            financialData={financialData}
            isOpen={isStatsOpen}
            onToggle={() => setIsStatsOpen(v => !v)}
            onPrint={() => {}}
          />
        </div>

        {/* Tabs */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0 px-6 pb-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <TabsList className="bg-transparent p-0 border-b border-border rounded-none gap-0 overflow-x-auto overflow-y-hidden flex-nowrap shrink-0 justify-start h-auto">
              <TabsTrigger value="clinical-history" className={SHEET_TAB_CLASS}>{t('tabs.clinicalHistory')}</TabsTrigger>
              <TabsTrigger value="quotes" className={SHEET_TAB_CLASS}>{t('tabs.quotes')}</TabsTrigger>
              <TabsTrigger value="orders" className={SHEET_TAB_CLASS}>{t('tabs.orders')}</TabsTrigger>
              <TabsTrigger value="invoices" className={SHEET_TAB_CLASS}>{t('tabs.invoices')}</TabsTrigger>
              <TabsTrigger value="payments" className={SHEET_TAB_CLASS}>{t('tabs.payments')}</TabsTrigger>
              <TabsTrigger value="appointments" className={SHEET_TAB_CLASS}>{t('tabs.appointments')}</TabsTrigger>
              <TabsTrigger value="messages" className={SHEET_TAB_CLASS}>{t('tabs.messages')}</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-hidden flex flex-col min-h-0 mt-3">
              <TabsContent value="clinical-history" className="m-0 flex-1 min-h-0 data-[state=active]:flex data-[state=active]:flex-col rounded-lg bg-muted/30 p-3">
                <ClinicHistoryViewer userId={userId} userName={userName} />
              </TabsContent>
              <TabsContent value="quotes" className="m-0 flex-1 min-h-0 data-[state=active]:flex data-[state=active]:flex-col rounded-lg bg-muted/30 p-3">
                <UserQuotes userId={userId} />
              </TabsContent>
              <TabsContent value="orders" className="m-0 flex-1 min-h-0 data-[state=active]:flex data-[state=active]:flex-col rounded-lg bg-muted/30 p-3">
                <UserOrders userId={userId} patient={user} />
              </TabsContent>
              <TabsContent value="invoices" className="m-0 flex-1 min-h-0 data-[state=active]:flex data-[state=active]:flex-col rounded-lg bg-muted/30 p-3">
                <UserInvoices userId={userId} />
              </TabsContent>
              <TabsContent value="payments" className="m-0 flex-1 min-h-0 data-[state=active]:flex data-[state=active]:flex-col rounded-lg bg-muted/30 p-3">
                <UserPayments userId={userId} />
              </TabsContent>
              <TabsContent value="appointments" className="m-0 flex-1 min-h-0 data-[state=active]:flex data-[state=active]:flex-col rounded-lg bg-muted/30 p-3">
                <UserAppointments user={user} />
              </TabsContent>
              <TabsContent value="messages" className="m-0 flex-1 min-h-0 data-[state=active]:flex data-[state=active]:flex-col rounded-lg bg-muted/30 p-3">
                <UserMessages userId={userId} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </ResizableSheet>
  );
}
