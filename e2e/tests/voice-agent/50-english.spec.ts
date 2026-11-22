import { expect, test } from '@playwright/test';
import { addDays, format, startOfToday, startOfWeek } from 'date-fns';

import { configureVoiceTiming } from '@/lib/voice/session';

import { createVoiceSim, type VoiceSim } from './sim/harness';

/**
 * EN · The same battery in English, with the app in English (locale en): docs/voz-agenda-pruebas.md
 * §EN. Atomic → chained → AI plans → incomplete. Same simulated calendar and n8n flow.
 */

let sim: VoiceSim;
test.beforeEach(async () => { sim = await createVoiceSim({ locale: 'en' }); });
test.afterEach(() => sim.dispose());

const day = (d: Date) => format(d, 'yyyy-MM-dd');
const lastGoTo = () => { const c = sim.cal.calls('goToDate'); return c.length ? day(c[c.length - 1][0] as Date) : null; };
const status = (id: string) => (sim.cal.appointments.find((a) => a.id === id) as unknown as { status: string }).status;
const settings = () => sim.cal.state.settings!;
const tomorrow = day(addDays(startOfToday(), 1));

test.describe('EN-N1.1 · Listening', () => {
  test('VZ-EN-001 with Voice on it hears everything, no wake word', async () => {
    await sim.say('go to tomorrow');
    expect(lastGoTo()).toBe(tomorrow);
  });
  test('VZ-EN-002 «Invoke» alone says it is listening', async () => {
    await sim.say('Invoke');
    expect(sim.card().message).toMatch(/listening/i);
  });
  test('VZ-EN-003 tapping Voice turns it off', async () => {
    await sim.toggle();
    expect(sim.store().alwaysOn).toBe(false);
  });
  test('VZ-EN-004 falls asleep with an open question and resumes it', async () => {
    configureVoiceTiming({ awakePendingMs: 60 });
    await sim.say("Ana's appointment");
    await sim.wait(150);
    configureVoiceTiming({ awakePendingMs: 60_000 });
    expect(sim.store().suspended).toBe(true);
    await sim.toggle();
    await sim.say('the second one');
    expect(sim.cal.calls('focusAppointment')).toEqual([['a3']]);
  });
});

test.describe('EN-N1.2 · Navigation and views', () => {
  test('VZ-EN-010 today', async () => { await sim.say('today'); expect(lastGoTo()).toBe(day(startOfToday())); });
  test('VZ-EN-011 next (week view → +1 week)', async () => {
    const before = sim.cal.state.range!.start;
    await sim.say('next');
    expect(lastGoTo()).toBe(day(addDays(before, 7)));
  });
  test('VZ-EN-012 previous in day view', async () => {
    await sim.say('day view');
    const before = sim.cal.state.range!.start;
    await sim.say('previous');
    expect(lastGoTo()).toBe(day(addDays(before, -1)));
  });
  test('VZ-EN-013 next week (lands on next week)', async () => {
    await sim.say('next week');
    const target = sim.cal.calls('goToDate')[0][0] as Date;
    expect(startOfWeek(target, { weekStartsOn: 1 }).getTime()).toBe(startOfWeek(addDays(startOfToday(), 7), { weekStartsOn: 1 }).getTime());
  });
  test('VZ-EN-014 go to December 3rd', async () => { await sim.say('go to December 3'); expect(lastGoTo()).toMatch(/-12-03$/); });
  for (const [said, view] of [['day view', 'day'], ['week view', 'week'], ['3 day view', '3-day'], ['month view', 'month'], ['list view', 'schedule']] as const) {
    test(`VZ-EN-02x «${said}» → ${view}`, async () => { await sim.say(said); expect(sim.cal.state.view).toBe(view); });
  }
  test('VZ-EN-026 «which views are there» + «the last one»', async () => {
    await sim.say('which views are there');
    await sim.say('the last one');
    expect(sim.cal.state.view).toBe('schedule');
  });
});

test.describe('EN-N1.3 · Zoom', () => {
  for (const [said, zoom] of [['zoom in', 1.1], ['zoom out', 0.9], ['max zoom', 2.5], ['zoom all the way out', 0.3], ['zoom to 150 percent', 1.5], ['bigger', 1.1], ['smaller', 0.9]] as const) {
    test(`VZ-EN-03x «${said}» → ${zoom}`, async () => { await sim.say(said); expect(sim.cal.state.zoom).toBe(zoom); });
  }
  test('VZ-EN-037 reset zoom', async () => { await sim.say('max zoom'); await sim.say('reset zoom'); expect(sim.cal.state.zoom).toBe(1); });
});

test.describe('EN-N1.4 · Calendars, doctors, panel, search', () => {
  test('VZ-EN-040 «which calendars are there» + «the second one»', async () => {
    await sim.say('which calendars are there');
    await sim.say('the second one');
    expect(sim.cal.state.activeCalendarId).toBe('c2');
  });
  test('VZ-EN-041 «only Dr. Pérez»', async () => { await sim.say('only doctor Pérez'); expect(sim.cal.state.selectedDoctorIds).toEqual(['d1']); });
  test('VZ-EN-042 open the calendars panel', async () => { await sim.say('open the calendars panel'); expect(sim.cal.state.agendasPanel.open).toBe(true); });
  test('VZ-EN-043 pin the panel', async () => { await sim.say('pin the panel'); expect(sim.cal.state.agendasPanel).toEqual({ open: true, pinned: true }); });
  test('VZ-EN-044 unpin the sidebar', async () => { await sim.say('pin the panel'); await sim.say('unpin the sidebar'); expect(sim.cal.state.agendasPanel.pinned).toBe(false); });
  test('VZ-EN-045 search Ana Gómez', async () => { await sim.say('search Ana Gómez'); expect(sim.cal.calls('openSearch')).toHaveLength(1); });
  test('VZ-EN-046 refresh', async () => { await sim.say('refresh'); expect(sim.cal.calls('refresh')).toHaveLength(1); });
  test('VZ-EN-047 what do I have today', async () => { await sim.say('what do I have today'); expect(sim.card().message).toMatch(/4 appointments/i); });
});

test.describe('EN-N1.5 · Settings', () => {
  test('VZ-EN-050 open the settings', async () => { await sim.say('open the settings'); expect(sim.cal.state.settingsOpen).toBe(true); });
  test('VZ-EN-051 Invoke mode', async () => { await sim.say('switch to invoke mode'); expect(settings().mode).toBe('invoke'); });
  test('VZ-EN-052 custom mode', async () => { await sim.say('switch to invoke mode'); await sim.say('custom mode'); expect(settings().mode).toBe('custom'); });
  test('VZ-EN-053 default view week', async () => { await sim.say('default view month'); expect(settings().default_view).toBe('month'); });
  test('VZ-EN-054 hour height 120', async () => { await sim.say('hour height 120'); expect(settings().hour_height).toBe(120); });
  test('VZ-EN-055 taller hours', async () => { await sim.say('taller hours'); expect(settings().hour_height).toBe(100); });
  test('VZ-EN-056 10 minute slots', async () => { await sim.say('10 minute slots'); expect(settings().slot_duration).toBe(10); });
  test('VZ-EN-057 default site Pocitos', async () => { await sim.say('default site Pocitos'); expect(settings().default_sede).toBe('s2'); });
  test('VZ-EN-058 label time, patient and notes', async () => { await sim.say('label time patient and notes'); expect(settings().event_label_format).toBe('time_patient_notes'); });
  test('VZ-EN-059 hide weekends', async () => { await sim.say('hide weekends'); expect([...settings().hidden_weekdays!].sort()).toEqual([0, 6]); });
  test('VZ-EN-060 show Saturdays', async () => { await sim.say('hide weekends'); await sim.say('show saturdays'); expect(settings().hidden_weekdays).toEqual([0]); });
  test('VZ-EN-061 clinic hours', async () => { await sim.say('show clinic hours'); expect(settings().visible_hours_mode).toBe('clinic'); });
  test('VZ-EN-062 visible hours from 8 to 6', async () => { await sim.say('visible hours from 8 to 6'); expect(settings()).toMatchObject({ visible_hours_mode: 'custom', visible_hours_start: '08:00', visible_hours_end: '18:00' }); });
  test('VZ-EN-063 full day', async () => { await sim.say('show clinic hours'); await sim.say('visible hours full day'); expect(settings().visible_hours_mode).toBe('full'); });
  for (const [said, key, value] of [
    ['turn off color by status', 'color_by_status', false], ['turn on availability check', 'check_availability', true],
    ['block out of hours', 'block_unavailable', true], ['filter doctors by service', 'filter_doctors_by_service', true],
    ['turn on inline creation', 'inline_appointment_creation', true], ['turn on live preview', 'inline_draft_live_preview', true],
  ] as const) {
    test(`VZ-EN-064 «${said}» → ${key} ${value}`, async () => { await sim.say(said); expect(settings()[key]).toBe(value); });
  }
});

test.describe('EN-N1.6 · Appointments', () => {
  test("VZ-EN-070 «Juan Pérez's appointment» selects it", async () => {
    await sim.say("show me Juan Pérez's appointment");
    expect(sim.cal.calls('focusAppointment')).toEqual([['a2']]);
  });
  test('VZ-EN-071 «the appointment at 3» by time', async () => {
    await sim.say('go to the appointment at 3');
    expect(sim.cal.calls('focusAppointment')).toEqual([['a4']]);
  });
  for (const [said, id, next] of [['Juan Pérez arrived', 'a2', 'arrived'], ['Carlos López confirmed', 'a4', 'confirmed'], ['Carlos López is a no show', 'a4', 'no_show'], ['mark Carlos López as completed', 'a4', 'completed']] as const) {
    test(`VZ-EN-07x «${said}» → ${next}`, async () => { await sim.say(said); await sim.say('yes'); expect(status(id)).toBe(next); });
  }
  test('VZ-EN-076 «no» keeps it', async () => { await sim.say('Juan Pérez arrived'); await sim.say('no'); expect(status('a2')).toBe('confirmed'); });
  test("VZ-EN-077 delete Carlos López's appointment", async () => { await sim.say("delete Carlos López's appointment"); await sim.say('yes'); expect(sim.cal.calls('deleteAppointment')).toEqual([['a4']]); });
  test("VZ-EN-078 make Juan's appointment red", async () => { await sim.say("make Juan Pérez's appointment red"); await sim.say('yes'); expect(sim.cal.calls('changeColor')).toEqual([['a2', '11']]); });
  test("VZ-EN-079 open Juan Pérez's account", async () => { await sim.say("open Juan Pérez's account"); expect(sim.cal.calls('openAppointmentTool')).toEqual([['a2', 'accounts']]); });
});

test.describe('EN-N1.7 · Form, export, patients', () => {
  const editJuan = async () => { await sim.say("edit Juan Pérez's appointment"); expect(sim.cal.calls('openAppointmentForm')[0]).toEqual(['edit', 'a2']); };
  test('VZ-EN-080 edit opens the form', editJuan);
  test('VZ-EN-081 with Dr. Gómez', async () => { await editJuan(); await sim.say('with doctor Gómez'); expect(sim.cal.form?.doctor?.id).toBe('d3'); });
  test('VZ-EN-082 at 11:30', async () => { await editJuan(); await sim.say('at 11 30'); expect(sim.cal.form?.start?.getHours()).toBe(11); });
  test('VZ-EN-083 ends at 11', async () => { await editJuan(); await sim.say('ends at 11'); expect(sim.cal.form?.endTime).toBe('11:00'); });
  test('VZ-EN-084 in chair 1', async () => { await editJuan(); await sim.say('in chair 1'); expect(sim.cal.form?.calendar?.id).toBe('c1'); });
  test('VZ-EN-085 note: bring X-rays', async () => { await editJuan(); await sim.say('note: bring X-rays'); expect(sim.cal.form?.notes).toBe('Bring X-rays'); });
  test('VZ-EN-086 patient is Sofía Castro', async () => { await editJuan(); await sim.say('patient is Sofía Castro'); expect(sim.cal.form?.patient?.name).toBe('Sofía Castro'); });
  test('VZ-EN-087 save', async () => { await editJuan(); await sim.say('save'); expect(sim.cal.savedForms).toHaveLength(1); });
  test('VZ-EN-088 cancel closes without saving', async () => { await editJuan(); await sim.say('cancel'); expect(sim.cal.savedForms).toHaveLength(0); expect(sim.cal.calls('closeAppointmentForm')).toHaveLength(1); });
  test('VZ-EN-090 export next week schedule', async () => { await sim.say('export the schedule for next week'); expect(sim.cal.state.exportDialog?.preset).toBe('week'); await sim.say('yes'); expect(sim.cal.state.exportDialog).toBeNull(); });
  test('VZ-EN-091 export all calendars', async () => { await sim.say('export the schedule for all calendars'); expect(sim.cal.state.exportDialog?.calendarIds).toEqual(['c1', 'c2', 'c3']); });
  test('VZ-EN-092 find patient Juan Pérez', async () => { await sim.say('find patient Juan Pérez'); expect(sim.store().focusLabel).toBe('Juan Pérez'); });
  test('VZ-EN-093 find patient with no appointments (widget)', async () => { await sim.say('find patient Sofía Castro'); expect(sim.cal.calls('openPatient')).toEqual([['p9']]); });
  test('VZ-EN-094 not found by name → asks ID/email/phone', async () => {
    await sim.say('find patient Ernest Valverde');
    expect(sim.card().message).toMatch(/ID number|email|phone/i);
    await sim.say('phone 099 123 456');
    expect(sim.cal.calls('openPatient')).toEqual([['p9']]);
  });
  test('VZ-EN-095 summarize this patient (focus) from their records', async () => {
    await sim.say("Juan Pérez's appointment");
    await sim.say('summarize this patient');
    expect(sim.cal.calls('getPatientFacts')[0]?.[0]).toBe('p2');
    expect(sim.card().rows.join(' ')).toMatch(/No-shows: 2/);
  });
});

test.describe('EN-N2 · Chained', () => {
  test('VZ-EN-100 select → «mark it as arrived» → yes', async () => {
    await sim.say("Carlos López's appointment");
    await sim.say('mark it as arrived');
    await sim.say('yes');
    expect(status('a4')).toBe('arrived');
  });
  test('VZ-EN-101 two «Ana»: «the one at 10 30»', async () => {
    await sim.say("Ana's appointment");
    await sim.say('the one at 10 30');
    expect(sim.cal.calls('focusAppointment')).toEqual([['a3']]);
  });
  test('VZ-EN-102 a tool in the middle does not cancel the question', async () => {
    await sim.say("Ana's appointment");
    await sim.say('zoom in please');
    expect(sim.cal.state.zoom).toBe(1.1);
    await sim.say('the first one');
    expect(sim.cal.calls('focusAppointment')).toEqual([['a1']]);
  });
  test('VZ-EN-103 a new request asks whether to drop the task; «yes» does it', async () => {
    await sim.say("Ana's appointment");
    await sim.say('export the schedule for next week');
    expect(sim.card().title).toMatch(/switch/i);
    await sim.say('yes');
    expect(sim.cal.state.exportDialog?.preset).toBe('week');
  });
  test('VZ-EN-104 «never mind» cancels', async () => {
    await sim.say("Ana's appointment");
    await sim.say('never mind');
    expect(sim.card().choices).toEqual([]);
  });
});

test.describe('EN-N3 · AI plans', () => {
  test("VZ-EN-110 «Juan's appointment, mark him arrived and open his account»", async () => {
    sim.ai.reply(/open his account/, { relation: 'new', confidence: 0.9, steps: [{ intent: 'calendar.select', patient: 'Juan' }, { intent: 'calendar.status', status: 'arrived' }, { intent: 'calendar.open', target: 'accounts' }] });
    await sim.say("Juan's appointment, mark him arrived and open his account");
    await sim.say('yes');
    expect(status('a2')).toBe('arrived');
    expect(sim.cal.calls('openAppointmentTool')).toEqual([['a2', 'accounts']]);
  });
  test('VZ-EN-111 «make everything way bigger, I can barely see» → zoom ×3', async () => {
    sim.ai.reply(/barely see/, { relation: 'new', confidence: 0.85, steps: [{ intent: 'calendar.zoom', zoom_op: 'in', amount: 3 }] });
    await sim.say('make everything way bigger I can barely see');
    expect(sim.cal.state.zoom).toBe(1.3);
  });
  test('VZ-EN-112 the AI answers an open question («the later one»)', async () => {
    sim.ai.reply(/later one/, { relation: 'answer', answer: '2', confidence: 0.85, steps: [] });
    await sim.say("Ana's appointment");
    await sim.say('I would say the later one of the two');
    expect(sim.cal.calls('focusAppointment')).toEqual([['a3']]);
  });
  test('VZ-EN-113 room small talk is ignored', async () => {
    sim.ai.reply(/coffee/, { relation: 'ignore', confidence: 0.9, steps: [] });
    await sim.say("Ana's appointment");
    await sim.say('could you bring me a coffee when you can');
    expect(sim.card().choices).toHaveLength(2);
  });
});

test.describe('EN-N4 · Incomplete or misheard', () => {
  test('VZ-EN-120 «edit the appointment» without saying which: asks', async () => {
    await sim.say('edit the appointment');
    await sim.say("Carlos López's");
    expect(sim.cal.calls('openAppointmentForm')[0]).toEqual(['edit', 'a4']);
  });
  test('VZ-EN-121 nonsense: shows examples and keeps working', async () => {
    await sim.say('blah blah tralala');
    expect(sim.cal.log).toEqual([]);
    await sim.say('day view');
    expect(sim.cal.state.view).toBe('day');
  });
  test('VZ-EN-122 «Juan Peres arrived» (misspelled) still finds him', async () => {
    await sim.say('Juan Peres arrived');
    await sim.say('yes');
    expect(status('a2')).toBe('arrived');
  });
});

test.describe('EN-SERVICE · English dental terms with a Spanish catalog', () => {
  test('«cleaning» is «Limpieza»; «change the time to 11 am» corrects; «yes» saves', async () => {
    await sim.say('new appointment for Sofía Castro tomorrow at 10 with doctor Pérez, cleaning');
    expect(sim.card().rows.join(' ')).toContain('Limpieza');
    await sim.say('change the time to 11 am');
    expect(sim.card().rows.join(' ')).toContain('11:00');
    await sim.say('yes');
    expect(sim.cal.savedForms).toHaveLength(1);
  });
});
