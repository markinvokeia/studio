'use client';

import { ResizableSheet, SheetTitle, SheetDescription } from '@/components/ui/resizable-sheet';
import { VerticalTabStrip } from '@/components/ui/vertical-tab-strip';
import type { VerticalTab } from '@/components/ui/vertical-tab-strip';
import { Skeleton } from '@/components/ui/skeleton';
import { UserFinancialSummaryStats } from '@/components/users/user-financial-summary-stats';
import { ClinicHistoryViewer } from '@/components/users/clinic-history-viewer';
import { UserQuotes } from '@/components/users/user-quotes';
import { UserInvoices } from '@/components/users/user-invoices';
import { UserPayments } from '@/components/users/user-payments';
import { UserAppointments } from '@/components/users/user-appointments';
import { UserMessages } from '@/components/users/user-messages';
import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import { UserFinancial, User } from '@/lib/types';
import {
  Mail, Phone, Users,
  Stethoscope, FileText, Receipt, CreditCard, Calendar, MessageSquare,
} from 'lucide-react';
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

  const tabs: VerticalTab[] = [
    { id: 'clinical-history', icon: Stethoscope, label: t('tabs.clinicalHistory') },
    { id: 'quotes', icon: FileText, label: t('tabs.quotes') },
    { id: 'invoices', icon: Receipt, label: t('tabs.invoices') },
    { id: 'payments', icon: CreditCard, label: t('tabs.payments') },
    { id: 'appointments', icon: Calendar, label: t('tabs.appointments') },
    { id: 'messages', icon: MessageSquare, label: t('tabs.messages') },
  ];

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
        <div className="flex-none border-b border-border bg-card px-6 py-4 pr-14">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/8 shrink-0">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <SheetTitle className="text-base font-semibold truncate leading-tight">{userName}</SheetTitle>
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
          <div className="mt-3">
            <UserFinancialSummaryStats
              financialData={financialData}
              isOpen={isStatsOpen}
              onToggle={() => setIsStatsOpen(v => !v)}
              onPrint={() => {}}
            />
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
            {activeTab === 'clinical-history' && (
              <ClinicHistoryViewer userId={userId} userName={userName} />
            )}
            {activeTab === 'quotes' && <UserQuotes userId={userId} />}
            {activeTab === 'invoices' && <UserInvoices userId={userId} />}
            {activeTab === 'payments' && <UserPayments userId={userId} />}
            {activeTab === 'appointments' && <UserAppointments user={user} />}
            {activeTab === 'messages' && <UserMessages userId={userId} />}
          </div>
        </div>
      </div>
    </ResizableSheet>
  );
}
