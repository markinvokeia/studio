'use client';

import { AlertTriangle, BookOpenCheck, Check, CircleDot, LifeBuoy, MessageCircleQuestion, RefreshCw, ThumbsDown, ThumbsUp, Video, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import * as React from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { PageHeader } from '@/components/ui/page-header';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

import { useKeyedAsyncAction } from '@/hooks/use-async-action';
import { useDataLoader } from '@/hooks/use-data-loader';
import { useToast } from '@/hooks/use-toast';
import { loadHelpCatalog } from '@/lib/help/catalog';
import { cn, formatDateTime, formatDisplayDate } from '@/lib/utils';
import { getHelpInsights, updateHelpQuestion, updateHelpTicket } from '@/services/help-assistant';

import type { HelpInsights, HelpInsightsTicket, HelpTicketStatus } from '@/lib/types';

const RANGES = [7, 30, 90] as const;

const chartConfig = {
  total: { label: 'Total', color: 'hsl(var(--primary))' },
  escalated: { label: 'Escaladas', color: 'hsl(var(--destructive))' },
};

const PRIORITY_VARIANT: Record<HelpInsightsTicket['priority'], 'destructive' | 'warning' | 'secondary' | 'outline'> = {
  critical: 'destructive',
  high: 'warning',
  normal: 'secondary',
  low: 'outline',
};

function pct(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : 0;
}

function Kpi({ icon: Icon, label, value, hint, tone }: { icon: React.ElementType; label: string; value: React.ReactNode; hint?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
      <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <p className={cn('mt-1 text-2xl font-bold', tone === 'good' && 'text-green-600', tone === 'bad' && 'text-destructive')}>{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Panel del asistente (Fase 4): cuánto resuelve solo, qué se escala, dónde se
 * traba la gente y el estado del catálogo, los videos y el onboarding.
 */
export default function HelpInsightsPage() {
  const t = useTranslations('HelpInsightsPage');
  const locale = useLocale();
  const tSteps = useTranslations('HelpInsightsPage.steps');
  const { toast } = useToast();
  const [days, setDays] = React.useState<number>(30);
  // Nombre visible de cada pantalla (el backend devuelve el scope: `config.sedes`).
  const [screenTitles, setScreenTitles] = React.useState<Record<string, string>>({});
  React.useEffect(() => {
    let cancelled = false;
    loadHelpCatalog(locale)
      .then((c) => { if (!cancelled) setScreenTitles(Object.fromEntries(c.screens.map((sc) => [sc.id, sc.title]))); })
      .catch(() => { /* se muestra el scope */ });
    return () => { cancelled = true; };
  }, [locale]);

  const { data, isLoading, isRefreshing, error, reload } = useDataLoader<HelpInsights | null>(
    (signal) => getHelpInsights(days, signal),
    null,
    [days],
  );

  const resolveQuestion = useKeyedAsyncAction(
    (id: string, status: 'resolved' | 'ignored') => updateHelpQuestion(id, status),
    { onSuccess: async () => { toast({ title: t('toast.questionUpdated') }); await reload(); }, errorTitle: t('toast.error') },
  );
  const updateTicket = useKeyedAsyncAction(
    (id: number, status: HelpTicketStatus) => updateHelpTicket(id, status),
    { onSuccess: async () => { toast({ title: t('toast.ticketUpdated') }); await reload(); }, errorTitle: t('toast.error') },
  );

  const totals = data?.totals;
  const resolvedPct = totals ? pct(totals.resolved, totals.total) : 0;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="space-y-4 p-4">
        <PageHeader
          icon={<LifeBuoy className="h-5 w-5" />}
          title={t('title')}
          description={t('description')}
          actions={
            <div className="flex items-center gap-2">
              <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
                <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RANGES.map((r) => <SelectItem key={r} value={String(r)}>{t('range', { days: r })}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => reload()} loading={isRefreshing} aria-label={t('refresh')}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          }
        />

        {error && !data && (
          <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />
            <span className="flex-1">{error}</span>
            <Button size="sm" variant="outline" onClick={() => reload()} loading={isRefreshing}>{t('retry')}</Button>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
        ) : data && totals && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
              <Kpi icon={MessageCircleQuestion} label={t('kpi.questions')} value={totals.total} />
              <Kpi icon={Check} label={t('kpi.resolved')} value={`${resolvedPct}%`} hint={t('kpi.resolvedGoal')} tone={resolvedPct >= 85 ? 'good' : totals.total ? 'bad' : undefined} />
              <Kpi icon={LifeBuoy} label={t('kpi.escalated')} value={totals.escalated} />
              <Kpi icon={ThumbsUp} label={t('kpi.feedback')} value={<span>{totals.positive} <span className="text-base text-muted-foreground">/</span> <span className="text-destructive">{totals.negative}</span></span>} />
              <Kpi icon={CircleDot} label={t('kpi.confidence')} value={totals.avg_confidence === null ? '—' : `${Math.round(totals.avg_confidence * 100)}%`} />
              <Kpi icon={AlertTriangle} label={t('kpi.weekend')} value={totals.weekend_human} hint={t('kpi.weekendGoal')} tone={totals.weekend_human === 0 ? 'good' : 'bad'} />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card data-help-id="system.help-insights.section.by-week" className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{t('byWeek.title')}</CardTitle>
                  <CardDescription className="text-xs">{t('byWeek.description')}</CardDescription>
                </CardHeader>
                <CardContent>
                  {data.by_week.length === 0 ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">{t('empty')}</p>
                  ) : (
                    <ChartContainer config={chartConfig} className="aspect-auto h-[220px] w-full">
                      <BarChart data={data.by_week.map((w) => ({ ...w, label: formatDisplayDate(w.week) }))} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} allowDecimals={false} width={30} />
                        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                        <Bar dataKey="total" fill="var(--color-total)" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="escalated" fill="var(--color-escalated)" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>

              <Card data-help-id="system.help-insights.section.by-screen">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{t('byScreen.title')}</CardTitle>
                  <CardDescription className="text-xs">{t('byScreen.description')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {data.by_screen.length === 0 && <p className="text-sm text-muted-foreground">{t('empty')}</p>}
                  {data.by_screen.map((s) => (
                    <div key={s.screen_id || 'none'} className="flex items-center gap-2 text-sm">
                      <span className="flex-1 truncate" title={s.screen_id}>{s.screen_id ? screenTitles[s.screen_id] ?? s.screen_id : t('byScreen.none')}</span>
                      <span className="tabular-nums">{s.total}</span>
                      {s.unresolved > 0 && <Badge variant="destructive" className="text-[10px]">{s.unresolved}</Badge>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card data-help-id="system.help-insights.section.open">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{t('open.title', { count: data.open_questions.length })}</CardTitle>
                  <CardDescription className="text-xs">{t('open.description')}</CardDescription>
                </CardHeader>
                <CardContent className="max-h-[420px] space-y-2 overflow-y-auto">
                  {data.open_questions.length === 0 && <p className="text-sm text-muted-foreground">{t('open.empty')}</p>}
                  {data.open_questions.map((q) => (
                    <div key={q.id} className="rounded-lg border p-2.5">
                      <div className="flex items-start gap-2">
                        <p className="flex-1 text-sm font-medium">{q.question}</p>
                        {q.rating === -1 && <ThumbsDown className="h-3.5 w-3.5 flex-none text-destructive" />}
                      </div>
                      {q.answer && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{q.answer}</p>}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{q.user_name ?? '—'}</span>
                        <span>·</span>
                        <span>{formatDateTime(q.created_at)}</span>
                        {q.route && <span className="font-mono">{q.route}</span>}
                        {q.confidence !== null && <span>{t('open.confidence', { value: Math.round(Number(q.confidence) * 100) })}</span>}
                        <span className="ml-auto flex gap-1">
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" loading={resolveQuestion.isPending(q.id)} onClick={() => resolveQuestion.run(q.id, q.id, 'resolved')}>
                            <BookOpenCheck className="h-3.5 w-3.5" />
                            {t('open.resolve')}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={resolveQuestion.isPending(q.id)} onClick={() => resolveQuestion.run(q.id, q.id, 'ignored')}>
                            <X className="h-3.5 w-3.5" />
                            {t('open.ignore')}
                          </Button>
                        </span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card data-help-id="system.help-insights.section.tickets">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{t('tickets.title', { count: data.tickets.length })}</CardTitle>
                  <CardDescription className="text-xs">{t('tickets.description')}</CardDescription>
                </CardHeader>
                <CardContent className="max-h-[420px] space-y-2 overflow-y-auto">
                  {data.tickets.length === 0 && <p className="text-sm text-muted-foreground">{t('tickets.empty')}</p>}
                  {data.tickets.map((tk) => (
                    <div key={tk.id} className="rounded-lg border p-2.5">
                      <div className="flex items-start gap-2">
                        <span className="font-mono text-xs text-muted-foreground">#{tk.id}</span>
                        <p className="flex-1 text-sm font-medium">{tk.subject}</p>
                        <Badge variant={PRIORITY_VARIANT[tk.priority]} className="text-[10px]">{t(`tickets.priority.${tk.priority}`)}</Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{tk.user_name ?? '—'}</span>
                        <span>·</span>
                        <span>{formatDateTime(tk.created_at)}</span>
                        <Badge variant="outline" className="text-[10px]">{t(`tickets.status.${tk.status}`)}</Badge>
                        <span className="ml-auto flex gap-1">
                          {tk.status === 'open' && (
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" loading={updateTicket.isPending(String(tk.id))} onClick={() => updateTicket.run(String(tk.id), tk.id, 'in_progress')}>
                              {t('tickets.take')}
                            </Button>
                          )}
                          <Button size="sm" className="h-7 px-2 text-xs" disabled={updateTicket.isPending(String(tk.id))} onClick={() => updateTicket.run(String(tk.id), tk.id, 'resolved')}>
                            <Check className="h-3.5 w-3.5" />
                            {t('tickets.resolve')}
                          </Button>
                        </span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card data-help-id="system.help-insights.section.catalog">
                <CardHeader className="pb-2"><CardTitle className="text-base">{t('catalog.title')}</CardTitle></CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <p>{t('catalog.screens', { validated: data.catalog?.validated ?? 0, total: data.catalog?.screens ?? 0 })}</p>
                  <p>{t('catalog.tables', { count: data.catalog?.tables ?? 0 })}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('catalog.version', { version: data.catalog?.version ?? '—', date: data.catalog?.synced_at ? formatDateTime(data.catalog.synced_at) : '—' })}
                  </p>
                </CardContent>
              </Card>
              <Card data-help-id="system.help-insights.section.videos">
                <CardHeader className="pb-2"><CardTitle className="flex items-center gap-1.5 text-base"><Video className="h-4 w-4" />{t('videos.title')}</CardTitle></CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <p>{t('videos.ready', { count: data.videos?.ready ?? 0 })}</p>
                  <p>{t('videos.requests', { count: data.videos?.requests_open ?? 0 })}</p>
                  {(data.videos?.stale ?? 0) > 0 && <p className="text-amber-600">{t('videos.stale', { count: data.videos?.stale ?? 0 })}</p>}
                  {(data.videos?.requests_failed ?? 0) > 0 && <p className="text-destructive">{t('videos.failed', { count: data.videos?.requests_failed ?? 0 })}</p>}
                </CardContent>
              </Card>
              <Card data-help-id="system.help-insights.section.onboarding">
                <CardHeader className="pb-2"><CardTitle className="text-base">{t('onboarding.title')}</CardTitle></CardHeader>
                <CardContent className="space-y-1 text-sm">
                  {data.onboarding.length === 0 && <p className="text-muted-foreground">{t('empty')}</p>}
                  {data.onboarding.map((o) => (
                    <div key={o.step_id} className="flex items-center gap-2">
                      {o.status === 'done' ? <Check className="h-3.5 w-3.5 text-green-600" /> : <CircleDot className="h-3.5 w-3.5 text-muted-foreground" />}
                      <span className="flex-1">{tSteps.has(o.step_id) ? tSteps(o.step_id) : o.step_id}</span>
                      <span className="text-xs text-muted-foreground">{o.completed_at ? formatDisplayDate(o.completed_at) : t(`onboarding.${o.status}`)}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
