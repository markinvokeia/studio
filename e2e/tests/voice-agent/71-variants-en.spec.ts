import { expect, test } from '@playwright/test';
import { addDays, addMonths, format, startOfToday, startOfWeek } from 'date-fns';

import { createVoiceSim, type VoiceSim } from './sim/harness';

/**
 * V · English variants (docs/voz-agenda-pruebas.md §V-EN): the same action asked many different
 * ways, as a front-desk person or a doctor would say it, with the app in English. Each row:
 * phrase → result. No AI (the local interpreter must understand all of them).
 */

let sim: VoiceSim;
test.beforeEach(async () => { sim = await createVoiceSim({ locale: 'en' }); });
test.afterEach(() => sim.dispose());

const day = (d: Date) => format(d, 'yyyy-MM-dd');
const week = (d: Date) => day(startOfWeek(d, { weekStartsOn: 1 }));
const lastGoTo = () => { const c = sim.cal.calls('goToDate'); return c.length ? (c[c.length - 1][0] as Date) : null; };
const status = (id: string) => (sim.cal.appointments.find((a) => a.id === id) as unknown as { status: string }).status;
const noAi = () => expect(sim.aiCalls.map((c) => c.text), 'should not call the AI').toEqual([]);
const today = startOfToday();

const table = <T>(name: string, rows: Array<[string, T]>, check: (expected: T, said: string) => Promise<void> | void, before?: () => Promise<void>) => {
  test.describe(name, () => {
    for (const [said, expected] of rows) {
      test(`«${said}»`, async () => {
        if (before) await before();
        await sim.say(said);
        await check(expected, said);
        noAi();
      });
    }
  });
};

// ── Navigation ────────────────────────────────────────────────────────────────

table('V-EN-NAV · today / tomorrow / yesterday', [
  ['today', 0], ['go to today', 0], ['back to today', 0], ['show me today', 0], ['jump to today', 0], ["take me to today", 0],
  ['tomorrow', 1], ['go to tomorrow', 1], ['show me tomorrow', 1], ["what about tomorrow", 1],
  ['yesterday', -1], ['go to yesterday', -1], ['show me yesterday', -1],
], (offset) => { expect(day(lastGoTo()!)).toBe(day(addDays(today, offset))); });
table('V-EN-NAV · next / previous (week view)', [
  ['next', 7], ['forward', 7], ['go forward', 7], ['next one', 7], ['move ahead', 7],
  ['previous', -7], ['back', -7], ['go back', -7], ['backward', -7], ['previous one', -7],
], (offset) => { expect(week(lastGoTo()!)).toBe(week(addDays(today, offset))); });
table('V-EN-NAV · weeks and months', [
  ['next week', 7], ['go to next week', 7], ['show me next week', 7], ['last week', -7], ['previous week', -7],
], (offset) => { expect(week(lastGoTo()!)).toBe(week(addDays(today, offset))); });
table('V-EN-NAV · months', [['next month', 1], ['go to next month', 1], ['last month', -1], ['previous month', -1]],
  (offset) => { expect(format(lastGoTo()!, 'yyyy-MM')).toBe(format(addMonths(today, offset), 'yyyy-MM')); });
table('V-EN-NAV · weekdays', [['go to Thursday', 4], ['Monday', 1], ['show me Friday', 5], ['jump to Tuesday', 2], ['on Wednesday', 3], ['this Saturday', 6]],
  (weekday) => { expect(lastGoTo()!.getDay()).toBe(weekday); });
table('V-EN-NAV · dates', [['go to December 3', '-12-03'], ['December 3rd', '-12-03'], ['the 15th', '-15'], ['jump to January 20', '-01-20'], ['show me March 1st', '-03-01']],
  (suffix) => { expect(day(lastGoTo()!)).toMatch(new RegExp(`${suffix}$`)); });

// ── Views ─────────────────────────────────────────────────────────────────────

table('V-EN-VIEW', [
  ['day view', 'day'], ['daily view', 'day'], ['switch to day view', 'day'], ['show the day', 'day'], ['one day view', 'day'],
  ['week view', 'week'], ['weekly view', 'week'], ['switch to week view', 'week'], ['show the whole week', 'week'],
  ['month view', 'month'], ['monthly view', 'month'], ['switch to month', 'month'],
  ['list view', 'schedule'], ['agenda view', 'schedule'], ['show it as a list', 'schedule'],
  ['2 day view', '2-day'], ['three day view', '3-day'], ['4 day view', '4-day'], ['5 days view', '5-day'], ['six day view', '6-day'],
], (view) => { expect(sim.cal.state.view).toBe(view); });

// ── Zoom ──────────────────────────────────────────────────────────────────────

table('V-EN-ZOOM', [
  ['zoom in', 1.1], ['zoom', 1.1], ['bigger', 1.1], ['make it bigger', 1.1], ['enlarge', 1.1], ['closer', 1.1], ['increase the zoom', 1.1],
  ['zoom out', 0.9], ['smaller', 0.9], ['make it smaller', 0.9], ['shrink it', 0.9], ['decrease the zoom', 0.9],
  ['max zoom', 2.5], ['zoom all the way in', 2.5], ['as big as possible', 2.5], ['maximum zoom', 2.5],
  ['min zoom', 0.3], ['zoom all the way out', 0.3], ['as small as possible', 0.3], ['minimum zoom', 0.3],
  ['zoom to 80', 0.8], ['zoom 120 percent', 1.2], ['zoom to 200 percent', 2], ['reset zoom', 1], ['normal zoom', 1], ['zoom back to normal', 1],
  ['zoom in a lot', 1.3], ['zoom out a lot', 0.7],
], (zoom) => { expect(sim.cal.state.zoom).toBe(zoom); });

// ── Calendars panel ───────────────────────────────────────────────────────────

table('V-EN-PANEL', [
  ['open the calendars panel', { open: true, pinned: false }], ['show the sidebar', { open: true, pinned: false }], ['open the side panel', { open: true, pinned: false }],
  ['pin the panel', { open: true, pinned: true }], ['keep the panel open', { open: true, pinned: true }], ['pin the sidebar', { open: true, pinned: true }],
], (expected) => { expect(sim.cal.state.agendasPanel).toEqual(expected); });
table('V-EN-PANEL · close and unpin', [
  ['close the panel', { open: false, pinned: true }], ['hide the sidebar', { open: false, pinned: true }],
  ['unpin the panel', { open: true, pinned: false }], ['let the sidebar auto hide', { open: true, pinned: false }],
], (expected) => { expect(sim.cal.state.agendasPanel).toEqual(expected); }, async () => { await sim.say('pin the panel'); });

// ── Calendars ─────────────────────────────────────────────────────────────────

table('V-EN-CALENDAR', [
  ['only calendar Ortodoncia', 'c3'], ['show calendar Ortodoncia', 'c3'], ['switch to Sillón 2', 'c2'], ['go to chair 2', 'c2'], ['open calendar Sillón 1', 'c1'],
], (id) => { const calls = sim.cal.calls('setActiveCalendar'); expect(calls[calls.length - 1]?.[0]).toBe(id); });

// ── Statuses ──────────────────────────────────────────────────────────────────

const statusTable = (name: string, rows: Array<[string, [string, string]]>) => table(name, rows, async ([id, next]) => {
  expect(sim.card().awaiting).toBe('confirm');
  await sim.say('yes');
  expect(status(id)).toBe(next);
});
statusTable('V-EN-STATUS · arrived', [
  ['Juan Pérez arrived', ['a2', 'arrived']], ['Juan Pérez is here', ['a2', 'arrived']], ['Juan Pérez just arrived', ['a2', 'arrived']], ['check in Juan Pérez', ['a2', 'arrived']],
  ['mark Juan Pérez as arrived', ['a2', 'arrived']], ['Juan Pérez is in the waiting room', ['a2', 'arrived']], ['the 10 o clock arrived', ['a2', 'arrived']],
]);
statusTable('V-EN-STATUS · confirmed', [
  ['Carlos López confirmed', ['a4', 'confirmed']], ['confirm Carlos López', ['a4', 'confirmed']], ["confirm Carlos López's appointment", ['a4', 'confirmed']], ['mark Carlos López as confirmed', ['a4', 'confirmed']],
]);
statusTable('V-EN-STATUS · no show', [
  ['Carlos López is a no show', ['a4', 'no_show']], ["Carlos López didn't show up", ['a4', 'no_show']], ['Carlos López did not come', ['a4', 'no_show']], ['mark Carlos López as no show', ['a4', 'no_show']],
]);
statusTable('V-EN-STATUS · in progress / completed / late', [
  ['Juan Pérez is in progress', ['a2', 'in_progress']], ['start Juan Pérez', ['a2', 'in_progress']], ["start Juan Pérez's appointment", ['a2', 'in_progress']],
  ['Juan Pérez is done', ['a2', 'completed']], ['Juan Pérez finished', ['a2', 'completed']], ["complete Juan Pérez's appointment", ['a2', 'completed']], ['mark Juan Pérez as completed', ['a2', 'completed']],
  ['Juan Pérez arrived late', ['a2', 'arrived_late']],
]);

// ── Patient information ───────────────────────────────────────────────────────

const infoTable = (name: string, rows: Array<[string, RegExp]>) => table(name, rows, (pattern) => {
  expect(sim.card().choices).toEqual([]);
  expect(sim.card().rows.join(' | ')).toMatch(pattern);
});
infoTable('V-EN-INFO · visits', [
  ['how many times has Juan Pérez come', /Visits: 5/], ['how many visits does Juan Pérez have', /Visits: 5/], ['how many times did Juan Pérez visit', /Visits: 5/], ['how often has Juan Pérez come', /Visits: 5/],
]);
infoTable('V-EN-INFO · no-shows', [
  ['how many no shows does Juan Pérez have', /No-shows: 2/], ['how many times has Juan Pérez missed', /No-shows: 2/], ["how many times didn't Juan Pérez show up", /No-shows: 2/],
  ["when was Juan Pérez's last no show", /September 10/],
]);
infoTable('V-EN-INFO · cancellations', [
  ['how many cancellations does Juan Pérez have', /Cancelled: 1/], ['how many times has Juan Pérez cancelled', /Cancelled: 1/],
]);
infoTable('V-EN-INFO · money', [
  ['how much does Juan Pérez owe', /Owes/], ['does Juan Pérez owe anything', /Owes/], ["what's Juan Pérez's balance", /Owes/], ['is Juan Pérez up to date with payments', /Owes|Last payment/],
  ["what was Juan Pérez's last payment", /Last payment/], ['when did Juan Pérez last pay', /Last payment/], ['how much has Juan Pérez paid', /Paid/],
]);
infoTable('V-EN-INFO · quotes, invoices, treatments', [
  ['what quotes does Juan Pérez have', /Quotes: 2/], ["what's the status of Juan Pérez's quotes", /Quotes: 2/],
  ['what invoices does Juan Pérez have', /Invoices: 2/], ['how many invoices does Juan Pérez have', /Invoices: 2/],
  ['what treatments does Juan Pérez have in progress', /Ortodoncia/], ["how is Juan Pérez's treatment going", /Ortodoncia/],
]);
infoTable('V-EN-INFO · summary', [
  ['summarize Juan Pérez', /Visits.*No-shows.*Owes/], ['give me a summary of Juan Pérez', /Visits.*No-shows.*Owes/], ['stats for Juan Pérez', /Visits.*No-shows.*Owes/],
  ['what do we know about Juan Pérez', /Visits.*No-shows.*Owes/], ['tell me about Juan Pérez', /Visits.*No-shows.*Owes/],
]);

// ── Patient actions ───────────────────────────────────────────────────────────

table('V-EN-ACTION', [
  ['create a quote for Juan Pérez', 'quote'], ['make a quote for Juan Pérez', 'quote'], ['new quote for Juan Pérez', 'quote'], ['new estimate for Juan Pérez', 'quote'],
  ['create an invoice for Juan Pérez', 'invoice'], ['new invoice for Juan Pérez', 'invoice'], ['invoice Juan Pérez', 'invoice'],
  ['create a treatment for Juan Pérez', 'treatment'], ['new treatment for Juan Pérez', 'treatment'], ['add a treatment for Juan Pérez', 'treatment'],
  ['quick charge for Juan Pérez', 'bill'], ['charge Juan Pérez', 'bill'], ['quick bill Juan Pérez', 'bill'],
  ["record Juan Pérez's clinical session", 'session'], ['new session for Juan Pérez', 'session'], ["start Juan Pérez's clinical session", 'session'],
], (action) => { expect(sim.cal.calls('openPatientAction')[0]?.slice(0, 2)).toEqual(['p2', action]); });

// ── Settings ──────────────────────────────────────────────────────────────────

table('V-EN-SETTINGS', [
  ['15 minute slots', { slot_duration: 15 }], ['slots of 10 minutes', { slot_duration: 10 }], ['half hour slots', { slot_duration: 30 }], ['one hour slots', { slot_duration: 60 }],
  ['default view day', { default_view: 'day' }], ['start in week view by default', { default_view: 'week' }], ['make month the default view', { default_view: 'month' }],
  ['hide sundays', { hidden_weekdays: [0] }], ["don't show saturdays", { hidden_weekdays: [6] }], ['hide the weekend', { hidden_weekdays: [6, 0] }],
  ['only show clinic hours', { visible_hours_mode: 'clinic' }], ['show the full day', { visible_hours_mode: 'full' }], ['visible hours from 9 to 6', { visible_hours_mode: 'custom', visible_hours_start: '09:00', visible_hours_end: '18:00' }],
  ['hour height 140', { hour_height: 140 }], ['shorter hours', { hour_height: 60 }],
  ['custom mode', { mode: 'custom' }], ['invoke mode', { mode: 'invoke' }],
  ['turn on color by status', { color_by_status: true }], ['turn off color by status', { color_by_status: false }],
], (patch) => { expect(sim.cal.state.settings).toMatchObject(patch); });
