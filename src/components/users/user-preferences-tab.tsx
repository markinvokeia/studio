'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Bell, BellRing, CalendarClock, Columns3, Receipt, Rows3 } from 'lucide-react';

import { CalendarSettingsForm } from '@/components/calendar/calendar-settings-form';
import { UserCommunicationPreferences } from '@/components/users/user-communication-preferences';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/notifications-context';
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

/** Small section label — icon + uppercase title, no card chrome (matches calendar-settings-form). */
function SectionHeading({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
    </div>
  );
}

/**
 * Preferences editor for an arbitrary user (not necessarily the one logged in).
 * Mirrors `/preferences` (the "my preferences" page) but targets `user.id` by
 * sending `user_id` on every request, matching the backend fallback: omitted
 * `user_id` resolves to the JWT user, present `user_id` targets that user.
 */
export function UserPreferencesTab({ user, showFinanceView = false, showAlertStyle = false, sedes = [] }: UserPreferencesTabProps) {
  const t = useTranslations('PreferencesPage');
  const { user: authUser } = useAuth();
  // Editing our own alert style? Route through the shared notifications context
  // (the same source NotificationsProvider reads from) instead of local state,
  // so the change takes effect immediately without a page reload.
  const isSelf = authUser?.id != null && String(authUser.id) === String(user.id);
  const notificationsCtx = useNotifications();

  const [financeView, setFinanceViewState] = React.useState<PatientFinanceView>('unified');
  const [alertStyleState, setAlertStyleState] = React.useState<DoctorAlertStyle>('modal');
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
        if (!isSelf && (prefs?.alert_style === 'modal' || prefs?.alert_style === 'toast')) {
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
  }, [user.id, showFinanceView, showAlertStyle, isSelf]);

  const savePreferences = (updates: UserPreferences) => {
    api.post(API_ROUTES.USER_PREFERENCES, { ...updates, user_id: user.id }).catch(() => {});
  };

  const setFinanceView = (view: PatientFinanceView) => {
    setFinanceViewState(view);
    savePreferences({ finance_view: view });
  };

  const alertStyle = isSelf ? notificationsCtx.alertStyle : alertStyleState;

  const setAlertStyle = (style: DoctorAlertStyle) => {
    if (isSelf) {
      notificationsCtx.setAlertStyle(style);
      return;
    }
    setAlertStyleState(style);
    savePreferences({ alert_style: style });
  };

  return (
    <div className="space-y-5 divide-y divide-border/50">
      <div>
        <SectionHeading icon={Bell} label={t('notificationsSection')} />
        <UserCommunicationPreferences user={user} autoSave compact />
      </div>

      {showFinanceView && (
        <div className="pt-5">
          <SectionHeading icon={Receipt} label={t('financeViewSection')} />
          <p className="text-xs text-muted-foreground mb-2">{t('financeViewDescription')}</p>
          <div className="flex gap-2">
            {(['tabs', 'unified'] as PatientFinanceView[]).map((view) => (
              <button
                key={view}
                type="button"
                disabled={isLoading}
                onClick={() => setFinanceView(view)}
                className={cn(
                  'flex flex-1 flex-col items-center gap-1.5 rounded-lg border px-3 py-2.5 text-xs font-medium transition-all',
                  financeView === view
                    ? 'border-primary bg-primary/8 text-primary'
                    : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/40 hover:text-foreground',
                )}
              >
                {view === 'unified' ? <Rows3 className="h-4 w-4" /> : <Columns3 className="h-4 w-4" />}
                {t(`financeView.${view}` as any)}
              </button>
            ))}
          </div>
        </div>
      )}

      {showAlertStyle && (
        <div className="pt-5">
          <SectionHeading icon={BellRing} label={t('workspaceSection')} />
          <p className="text-xs text-muted-foreground mb-2">{t('alertStyleDescription')}</p>
          <div className="flex gap-2">
            {(['modal', 'toast'] as DoctorAlertStyle[]).map((style) => (
              <button
                key={style}
                type="button"
                disabled={isLoading}
                onClick={() => setAlertStyle(style)}
                className={cn(
                  'flex flex-1 flex-col items-center gap-1.5 rounded-lg border px-3 py-2.5 text-xs font-medium transition-all',
                  alertStyle === style
                    ? 'border-primary bg-primary/8 text-primary'
                    : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/40 hover:text-foreground',
                )}
              >
                {style === 'modal' ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                {t(`alertStyle.${style}` as any)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="pt-5">
        <SectionHeading icon={CalendarClock} label={t('calendarSection')} />
        <CalendarSettingsForm userId={user.id} sedes={sedes} />
      </div>
    </div>
  );
}
