/**
 *   node --test scripts/n8n/study-order-intake/slots-lib.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computeSlots, mergeWindows, pickSlots } from './slots-lib.mjs';

// 2026-10-05 es lunes. clinic_schedules usa day_of_week 0 = domingo.
const schedules = [
    { day_of_week: 1, start_time: '09:00:00', end_time: '13:00:00' },
    { day_of_week: 1, start_time: '09:00:00', end_time: '13:00:00' }, // fila repetida (pasa en la base real)
    { day_of_week: 1, start_time: '15:00:00', end_time: '19:00:00' },
    { day_of_week: 2, start_time: '09:00:00', end_time: '12:00:00' },
];
const base = {
    now: '2026-10-05T07:00:00',
    schedules,
    calendars: [{ id: 11 }, { id: 12 }],
    appointments: [],
    durationMinutes: 40,
};

test('une ventanas repetidas o solapadas', () => {
    assert.deepEqual(mergeWindows([[540, 780], [540, 780], [900, 1140]]), [[540, 780], [900, 1140]]);
    assert.deepEqual(mergeWindows([[540, 700], [650, 780]]), [[540, 780]]);
});

test('respeta el horario de la sede, el paso y la duración', () => {
    const slots = computeSlots({ ...base, fromDate: '2026-10-05', toDate: '2026-10-05', leadHours: 0 });
    assert.equal(slots[0].start, '2026-10-05T09:00:00');
    assert.equal(slots[0].end, '2026-10-05T09:40:00');
    // último inicio de la mañana: 12:00 + 40 min = 12:40 ≤ 13:00; 12:30 + 40 = 13:10 no entra
    const morning = slots.filter((s) => s.time < '13:00').map((s) => s.time);
    assert.equal(morning.at(-1), '12:00');
    assert.ok(!slots.some((s) => s.time === '13:00' || s.time === '14:00'), 'no ofrece el mediodía cerrado');
    assert.equal(slots.at(-1).time, '18:00');
});

test('antelación mínima', () => {
    const slots = computeSlots({ ...base, fromDate: '2026-10-05', toDate: '2026-10-05', leadHours: 4 });
    assert.equal(slots[0].time, '11:00'); // ahora 07:00 + 4 h
});

test('un calendario ocupado pasa al siguiente; si todos están ocupados, no hay hueco', () => {
    const appointments = [{ calendar_source_id: 11, start: '2026-10-05T09:00:00', end: '2026-10-05T10:00:00' }];
    const s1 = computeSlots({ ...base, appointments, fromDate: '2026-10-05', toDate: '2026-10-05', leadHours: 0 });
    assert.equal(s1[0].time, '09:00');
    assert.equal(s1[0].calendar_source_id, 12);

    const both = [
        { calendar_source_id: 11, start: '2026-10-05T09:00:00', end: '2026-10-05T10:30:00' },
        { calendar_source_id: 12, start: '2026-10-05T09:00:00', end: '2026-10-05T10:30:00' },
    ];
    const s2 = computeSlots({ ...base, appointments: both, fromDate: '2026-10-05', toDate: '2026-10-05', leadHours: 0 });
    assert.equal(s2[0].time, '10:30');
});

test('una cita que solo roza el borde no bloquea', () => {
    const appointments = [{ calendar_source_id: 11, start: '2026-10-05T08:00:00', end: '2026-10-05T09:00:00' }];
    const s = computeSlots({ ...base, calendars: [{ id: 11 }], appointments, fromDate: '2026-10-05', toDate: '2026-10-05', leadHours: 0 });
    assert.equal(s[0].time, '09:00');
});

test('una orden más larga que cualquier ventana no tiene huecos', () => {
    assert.deepEqual(computeSlots({ ...base, durationMinutes: 300 }), []);
});

test('días sin atención no ofrecen nada y el domingo respeta day_of_week = 0', () => {
    const sun = computeSlots({ ...base, schedules: [{ day_of_week: 0, start_time: '09:00', end_time: '12:00' }], fromDate: '2026-10-11', toDate: '2026-10-11', leadHours: 0 });
    assert.equal(sun[0].start, '2026-10-11T09:00:00'); // 2026-10-11 es domingo
    const wed = computeSlots({ ...base, fromDate: '2026-10-07', toDate: '2026-10-07', leadHours: 0 });
    assert.deepEqual(wed, []);
});

test('respeta el horizonte y sin calendarios no hay huecos', () => {
    const slots = computeSlots({ ...base, horizonDays: 1, leadHours: 0 });
    assert.ok(slots.every((s) => s.date <= '2026-10-06'));
    assert.deepEqual(computeSlots({ ...base, calendars: [] }), []);
});

test('pickSlots: sin preferencia, máximo 2 por día', () => {
    const slots = computeSlots({ ...base, leadHours: 0 });
    const picked = pickSlots(slots, { limit: 6 });
    assert.equal(picked.length, 6);
    const perDay = {};
    for (const s of picked) perDay[s.date] = (perDay[s.date] || 0) + 1;
    assert.ok(Object.values(perDay).every((n) => n <= 2));
});

test('pickSlots: con fecha y hora, los más cercanos a esa hora', () => {
    const slots = computeSlots({ ...base, leadHours: 0, fromDate: '2026-10-05', toDate: '2026-10-05' });
    const picked = pickSlots(slots, { desiredDate: '2026-10-05', desiredTime: '16:00', limit: 3 });
    assert.equal(picked.length, 3);
    assert.ok(picked.some((s) => s.time === '16:00'));
    assert.ok(picked.every((s) => s.time >= '15:00' && s.time <= '17:00'));
});

test('pickSlots: si ese día no hay lugar, ofrece lo más próximo', () => {
    const slots = computeSlots({ ...base, leadHours: 0 });
    const picked = pickSlots(slots, { desiredDate: '2026-10-07', limit: 4 }); // miércoles: cerrado
    assert.ok(picked.length > 0);
    assert.ok(picked.every((s) => s.date > '2026-10-07'));
});
