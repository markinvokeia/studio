'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Bell, BellRing, CalendarClock, Columns3, Receipt, Rows3 } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarSettingsForm } from '@/components/calendar/calendar-settings-form';
import { UserCommunicationPreferences } from '@/components/users/user-communication-preferences';
import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import { cn } from '@/lib/utils';
import type { DoctorAlertStyle, PatientFinanceView, Sede, User, UserPreferences, UserPreferencesResponse } from '@/lib/types';

interface UserPreferencesTabProps {
  user: User;
  /** Show the patient finance-tab layout toggle (patients only). */
  showFinanceView?: boolean;
  /** Show the appointment alert style toggle (doctors only). */
  showAlertStyle?: boolean;
  sedes?: Sede[];
}

/**
 * Preferences editor for an arbitrary user (not necessarily the one logged in).
 * Mirrors `/preferences` (the "my preferences" page) but targets `user.id` by
 * sending `user_id` on every request, matching the backend fallback: omitted
 * `user_id` resolves to the JWT user, present `user_id` targets that user.
 */
export function UserPreferencesTab({ user, showFinanceView = false, showAlertStyle = false, sedes = [] }: UserPreferencesTabProps) {
  const t = useTranslations('PreferencesPage');
  const [financeView, setFinanceViewState] = React.useState<PatientFinanceView>('unified');
  const [alertStyle, setAlertStyleState] = React.useState<DoctorAlertStyle>('modal');
  const [isLoading, setIsLoading] = React.useState(showFinanceView || showAlertStyle);

  React.useEffect(() => {
    if (!showFinanceView && !showAlertStyle) return;
    let isMounted = true;

    api.get(API_ROUTES.USER_PREFERENCES, { user_id: user.id })
      .then((res: unknown) => {
        if (!isMounted) return;
        const prefs = (res as UserPreferencesResponse | null)?.preferences;
        if (prefs?.finance_view === 'unified' || prefs?.finance_view === 'tabs') {
          setFinanceViewState(prefs.finance_view);
        }
        if (prefs?.alert_style === 'modal' || prefs?.alert_style === 'toast') {
          setAlertStyleState(prefs.alert_style);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [user.id, showFinanceView, showAlertStyle]);

  const savePreferences = (updates: UserPreferences) => {
    api.post(API_ROUTES.USER_PREFERENCES, { ...updates, user_id: user.id }).catch(() => {});
  };

  const setFinanceView = (view: PatientFinanceView) => {
    setFinanceViewState(view);
    savePreferences({ finance_view: view });
  };

  const setAlertStyle = (style: DoctorAlertStyle) => {
    setAlertStyleState(style);
    savePreferences({ alert_style: style });
  };

  return (
    <div className="space-y-4">
      <Card className="shadow-sm border-0">
        <CardHeader className="p-4">
          <div className="flex items-start gap-3">
            <div className="header-icon-circle mt-0.5">
              <Bell className="h-5 w-5" />
            </div>
            <CardTitle className="text-lg">{t('notificationsSection')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <UserCommunicationPreferences user={user} autoSave />
        </CardContent>
      </Card>

      {showFinanceView && (
        <Card className="shadow-sm border-0">
          <CardHeader className="p-4">
            <div className="flex items-start gap-3">
              <div className="header-icon-circle mt-0.5">
                <Receipt className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg">{t('financeViewSection')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            <div>
              <p className="text-sm font-medium text-foreground">{t('financeViewLabel')}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t('financeViewDescription')}</p>
            </div>
            <div className="flex gap-2">
              {(['tabs', 'unified'] as PatientFinanceView[]).map((view) => (
                <button
                  key={view}
                  type="button"
                  disabled={isLoading}
                  onClick={() => setFinanceView(view)}
                  className={cn(
                    'flex flex-1 flex-col items-center gap-2 rounded-xl border-2 px-3 py-3 text-sm font-medium transition-all',
                    financeView === view
                      ? 'border-primary bg-primary/8 text-primary'
                      : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/40 hover:text-foreground',
                  )}
                >
                  {view === 'unified' ? <Rows3 className="h-5 w-5" /> : <Columns3 className="h-5 w-5" />}
                  {t(`financeView.${view}` as any)}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {showAlertStyle && (
        <Card className="shadow-sm border-0">
          <CardHeader className="p-4">
            <div className="flex items-start gap-3">
              <div className="header-icon-circle mt-0.5">
                <BellRing className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg">{t('workspaceSection')}</CardTitle>
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
                  disabled={isLoading}
                  onClick={() => setAlertStyle(style)}
                  className={cn(
                    'flex flex-1 flex-col items-center gap-2 rounded-xl border-2 px-3 py-3 text-sm font-medium transition-all',
                    alertStyle === style
                      ? 'border-primary bg-primary/8 text-primary'
                      : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/40 hover:text-foreground',
                  )}
                >
                  {style === 'modal' ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
                  {t(`alertStyle.${style}` as any)}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-sm border-0">
        <CardHeader className="p-4">
          <div className="flex items-start gap-3">
            <div className="header-icon-circle mt-0.5">
              <CalendarClock className="h-5 w-5" />
            </div>
            <CardTitle className="text-lg">{t('calendarSection')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <CalendarSettingsForm userId={user.id} sedes={sedes} />
        </CardContent>
      </Card>
    </div>
  );
}
