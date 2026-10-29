'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Bell, BellRing, CalendarClock, Columns3, Loader2, Receipt, Rows3 } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { CalendarSettingsForm } from '@/components/calendar/calendar-settings-form';
import { UserCommunicationPreferences } from '@/components/users/user-communication-preferences';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/notifications-context';
import { API_ROUTES } from '@/constants/routes';
import { useKeyedAsyncAction } from '@/hooks/use-async-action';
import { getErrorMessage } from '@/lib/error-utils';
import { api, isAbortError, REQUEST_TIMEOUT_MS } from '@/services/api';
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
  const tCommon = useTranslations('Common');
  const { user: authUser } = useAuth();
  // Editing our own alert style? Route through the shared notifications context
  // (the same source NotificationsProvider reads from) instead of local state,
  // so the change takes effect immediately without a page reload.
  const isSelf = authUser?.id != null && String(authUser.id) === String(user.id);
  const notificationsCtx = useNotifications();

  const [financeView, setFinanceViewState] = React.useState<PatientFinanceView>('unified');
  const [alertStyleState, setAlertStyleState] = React.useState<DoctorAlertStyle>('modal');
  const [isLoading, setIsLoading] = React.useState(showFinanceView || showAlertStyle);
  // A failed load leaves the toggles disabled: showing the defaults as if they were stored and
  // letting a click save them would silently overwrite the user's real preference.
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = React.useState(0);

  React.useEffect(() => {
    if (!showFinanceView && !showAlertStyle) return;
    const controller = new AbortController();

    // Switching to another user: fall back to defaults until this user's own
    // preferences arrive. Otherwise a user with nothing stored keeps showing
    // the value that belonged to the previously selected user.
    setFinanceViewState('unified');
    setAlertStyleState('modal');
    setIsLoading(true);
    setLoadError(null);

    api.get(API_ROUTES.USER_PREFERENCES, { user_id: user.id }, undefined, { signal: controller.signal })
      .then((res: unknown) => {
        const prefs = (res as UserPreferencesResponse | null)?.preferences;
        if (prefs?.finance_view === 'unified' || prefs?.finance_view === 'tabs') {
          setFinanceViewState(prefs.finance_view);
        }
        if (!isSelf && (prefs?.alert_style === 'modal' || prefs?.alert_style === 'toast')) {
          setAlertStyleState(prefs.alert_style);
        }
      })
      .catch((error) => {
        if (!isAbortError(error)) setLoadError(getErrorMessage(error) || tCommon('loadError'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [user.id, showFinanceView, showAlertStyle, isSelf, loadAttempt, tCommon]);

  // Optimistic toggle with rollback: on failure the control goes back to the stored value.
  const savePreference = useKeyedAsyncAction(
    async (updates: UserPreferences, rollback: () => void) => {
      try {
        await api.post(API_ROUTES.USER_PREFERENCES, { ...updates, user_id: user.id }, undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.mutation });
      } catch (error) {
        rollback();
        throw error;
      }
    },
    { errorTitle: tCommon('errorTitle') }
  );

  const setFinanceView = (view: PatientFinanceView) => {
    if (view === financeView) return;
    const previous = financeView;
    setFinanceViewState(view);
    savePreference.run('finance_view', { finance_view: view }, () => setFinanceViewState(previous));
  };

  const alertStyle = isSelf ? notificationsCtx.alertStyle : alertStyleState;

  const setAlertStyle = (style: DoctorAlertStyle) => {
    if (isSelf) {
      notificationsCtx.setAlertStyle(style);
      return;
    }
    if (style === alertStyleState) return;
    const previous = alertStyleState;
    setAlertStyleState(style);
    savePreference.run('alert_style', { alert_style: style }, () => setAlertStyleState(previous));
  };

  const loadErrorNotice = loadError ? (
    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-destructive" role="alert">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <span>{tCommon('loadError')}</span>
      <Button type="button" size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => setLoadAttempt((n) => n + 1)}>
        {tCommon('retry')}
      </Button>
    </div>
  ) : null;

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
          {loadErrorNotice}
          <div className="flex gap-2">
            {(['tabs', 'unified'] as PatientFinanceView[]).map((view) => (
              <button
                key={view}
                type="button"
                disabled={isLoading || !!loadError || savePreference.isPending('finance_view')}
                aria-pressed={financeView === view}
                onClick={() => setFinanceView(view)}
                className={cn(
                  'flex flex-1 flex-col items-center gap-1.5 rounded-lg border px-3 py-2.5 text-xs font-medium transition-all',
                  financeView === view
                    ? 'border-primary bg-primary/8 text-primary'
                    : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/40 hover:text-foreground',
                )}
              >
                {savePreference.isPending('finance_view') && financeView === view
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : view === 'unified' ? <Rows3 className="h-4 w-4" /> : <Columns3 className="h-4 w-4" />}
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
          {!showFinanceView && !isSelf && loadErrorNotice}
          <div className="flex gap-2">
            {(['modal', 'toast'] as DoctorAlertStyle[]).map((style) => (
              <button
                key={style}
                type="button"
                disabled={isLoading || (!isSelf && !!loadError) || savePreference.isPending('alert_style')}
                aria-pressed={alertStyle === style}
                onClick={() => setAlertStyle(style)}
                className={cn(
                  'flex flex-1 flex-col items-center gap-1.5 rounded-lg border px-3 py-2.5 text-xs font-medium transition-all',
                  alertStyle === style
                    ? 'border-primary bg-primary/8 text-primary'
                    : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/40 hover:text-foreground',
                )}
              >
                {savePreference.isPending('alert_style') && alertStyle === style
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : style === 'modal' ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
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
