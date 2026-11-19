import { expect, test } from '@playwright/test';

import {
  editAppointmentRef,
  extractCreateEntities,
  extractSpokenDate,
  extractSpokenTime,
  findDoctorMention,
  findServiceMentions,
  isNoneAnswer,
  parseCalendarAssignDoctor,
  parseCalendarColor,
  parseCalendarCreate,
  parseCalendarDelete,
  parseCalendarDuration,
  parseCalendarEdit,
  parseCalendarFilter,
  parseCalendarGroup,
  parseCalendarMove,
  parseCalendarNavigate,
  parseCalendarOpen,
  parseCalendarPanel,
  parseCalendarQuery,
  parseCalendarReminder,
  parseCalendarReminderAction,
  parseCalendarReschedule,
  parseCalendarSlot,
  parseCalendarStatus,
  parseCalendarToolbar,
  parseCalendarView,
  parseTimeAnswer,
  rawPhrase,
  serviceEditMode,
  splitCreateRest,
} from '@/lib/voice/commands/calendar-parse';
import { sanitizeCalendarAiResult } from '@/lib/voice/commands/calendar-ai';
import { normalizeSpeech } from '@/lib/voice/parse';

/**
 * Calendario por voz, sin navegador: el intérprete local (fechas, horas, filtros, estados, nueva
 * cita, reprogramar) y la revalidación de lo que devuelve la IA. "Hoy" fijo: jueves 19/11/2026.
 */
const TODAY = new Date(2026, 10, 19);
const n = (text: string) => normalizeSpeech(text);

test.describe('Calendario — voz (lógica)', () => {
  test('horas: a las 10, y media, de la tarde, la una, 1 a 6 sin aclarar es de tarde', () => {
    expect(extractSpokenTime(n('a las diez'))?.time).toEqual({ hour: 10, minute: 0 });
    expect(extractSpokenTime(n('a las 10:30'))?.time).toEqual({ hour: 10, minute: 30 });
    expect(extractSpokenTime(n('a las diez y media'))?.time).toEqual({ hour: 10, minute: 30 });
    expect(extractSpokenTime(n('a las once menos cuarto'))?.time).toEqual({ hour: 10, minute: 45 });
    expect(extractSpokenTime(n('a las 3 de la tarde'))?.time).toEqual({ hour: 15, minute: 0 });
    expect(extractSpokenTime(n('a las 3'))?.time).toEqual({ hour: 15, minute: 0 });
    expect(extractSpokenTime(n('a las 8'))?.time).toEqual({ hour: 8, minute: 0 });
    expect(extractSpokenTime(n('a la una y media'))?.time).toEqual({ hour: 13, minute: 30 });
    expect(extractSpokenTime(n('at 9 30 am'))?.time).toEqual({ hour: 9, minute: 30 });
    // "de la mañana" es la hora, no "mañana".
    const morning = extractSpokenTime(n('el jueves a las 10 de la mañana'));
    expect(morning?.time).toEqual({ hour: 10, minute: 0 });
    expect(morning?.rest).toBe('el jueves');
    expect(parseTimeAnswer(n('diez y media'))).toEqual({ hour: 10, minute: 30 });
    expect(parseTimeAnswer(n('a las 4'))).toEqual({ hour: 16, minute: 0 });
  });

  test('fechas: hoy, mañana, el jueves (hoy), el lunes, el 14, semana que viene, diciembre', () => {
    const d = (text: string, prefer: 'nearest' | 'future' = 'nearest') => extractSpokenDate(n(text), prefer, TODAY)?.date ?? null;
    expect(d('hoy')).toBe('2026-11-19');
    expect(d('mañana')).toBe('2026-11-20');
    expect(d('pasado mañana')).toBe('2026-11-21');
    expect(d('el jueves')).toBe('2026-11-19');
    expect(d('el jueves que viene')).toBe('2026-11-26');
    expect(d('el lunes')).toBe('2026-11-23');
    expect(d('el lunes pasado')).toBe('2026-11-16');
    expect(d('el 14')).toBe('2026-11-14');
    expect(d('el 14', 'future')).toBe('2026-12-14');
    expect(d('el 3 de diciembre')).toBe('2026-12-03');
    expect(d('el viernes 27')).toBe('2026-11-27');
    expect(d('25/12')).toBe('2026-12-25');
    expect(d('la semana que viene')).toBe('2026-11-26');
    expect(extractSpokenDate(n('la semana que viene'), 'nearest', TODAY)?.unit).toBe('week');
    expect(d('en 2 semanas')).toBe('2026-12-03');
    expect(d('diciembre')).toBe('2026-12-01');
    expect(d('ayer')).toBe('2026-11-18');
    expect(d('la doctora pérez')).toBeNull();
  });

  test('ir a una fecha, avanzar y cambiar la vista', () => {
    expect(parseCalendarNavigate(n('andá a mañana'), TODAY)).toEqual({ kind: 'date', date: '2026-11-20', unit: undefined });
    expect(parseCalendarNavigate(n('el lunes'), TODAY)).toMatchObject({ kind: 'date', date: '2026-11-23' });
    expect(parseCalendarNavigate(n('volvé a hoy'), TODAY)).toMatchObject({ kind: 'date', date: '2026-11-19' });
    expect(parseCalendarNavigate(n('mostrame la semana que viene'), TODAY)).toMatchObject({ kind: 'date', unit: 'week' });
    expect(parseCalendarNavigate(n('siguiente'), TODAY)).toEqual({ kind: 'step', dir: 1, unit: undefined });
    expect(parseCalendarNavigate(n('semana anterior'), TODAY)).toEqual({ kind: 'step', dir: -1, unit: 'week' });
    expect(parseCalendarNavigate(n('Ana Gómez llegó'), TODAY)).toBeNull();

    expect(parseCalendarView(n('vista semanal'), TODAY)).toEqual({ view: 'week' });
    expect(parseCalendarView(n('poné la vista de mes'), TODAY)).toEqual({ view: 'month' });
    expect(parseCalendarView(n('vista de 3 días'), TODAY)).toEqual({ view: '3-day' });
    expect(parseCalendarView(n('vista agenda'), TODAY)).toEqual({ view: 'schedule' });
    expect(parseCalendarView(n('mostrame el día de mañana'), TODAY)).toEqual({ view: 'day', date: '2026-11-20' });
    expect(parseCalendarView(n('qué tengo mañana'), TODAY)).toBeNull();
  });

  test('filtros, agrupar, buscar y huecos', () => {
    expect(parseCalendarFilter(n('solo el doctor Pérez'))).toEqual({ op: 'only', target: 'doctor', name: 'perez' });
    expect(parseCalendarFilter(n('mostrame solo la sede Centro'))).toEqual({ op: 'only', target: 'sede', name: 'centro' });
    expect(parseCalendarFilter(n('agregá la agenda del sillón 2'))).toMatchObject({ op: 'add', target: 'calendar' });
    expect(parseCalendarFilter(n('sacá a la doctora López'))).toEqual({ op: 'remove', target: 'doctor', name: 'lopez' });
    expect(parseCalendarFilter(n('todos los doctores'))).toMatchObject({ op: 'all', target: 'doctor' });
    expect(parseCalendarFilter(n('sacá los filtros'))).toMatchObject({ op: 'all' });
    expect(parseCalendarFilter(n('sacá los huecos'))).toBeNull();

    expect(parseCalendarGroup(n('agrupá por doctor'))).toEqual({ groupBy: 'doctor' });
    expect(parseCalendarGroup(n('agrupar por consultorio'))).toEqual({ groupBy: 'calendar' });
    expect(parseCalendarGroup(n('sin agrupar'))).toEqual({ groupBy: 'none' });

    expect(parseCalendarPanel(n('buscá la cita de Ana Gómez'))).toEqual({ kind: 'search', query: 'ana gomez' });
    expect(parseCalendarPanel(n('cerrá la búsqueda'))).toEqual({ kind: 'closeSearch' });
    expect(parseCalendarPanel(n('ocultá los huecos'))).toEqual({ kind: 'hideGaps' });
    expect(parseCalendarPanel(n('buscá huecos el jueves'))).toBeNull();
  });

  test('consultas: agenda de un día, quién sigue, próxima cita de un paciente, huecos', () => {
    expect(parseCalendarQuery(n('¿Qué tengo mañana?'), TODAY)).toEqual({ kind: 'agenda', date: '2026-11-20', doctor: null });
    expect(parseCalendarQuery(n('cuántas citas hay hoy'), TODAY)).toEqual({ kind: 'agenda', date: '2026-11-19', doctor: null });
    expect(parseCalendarQuery(n('qué tiene el doctor Pérez el lunes'), TODAY)).toEqual({ kind: 'agenda', date: '2026-11-23', doctor: 'perez' });
    expect(parseCalendarQuery(n('la agenda del viernes'), TODAY)).toMatchObject({ kind: 'agenda', date: '2026-11-20' });
    expect(parseCalendarQuery(n('¿quién sigue?'), TODAY)).toEqual({ kind: 'next' });
    expect(parseCalendarQuery(n('próximo paciente'), TODAY)).toEqual({ kind: 'next' });
    expect(parseCalendarQuery(n('¿cuándo viene Ana Gómez?'), TODAY)).toEqual({ kind: 'patient_next', patient: 'ana gomez' });
    expect(parseCalendarQuery(n('próxima cita de Juan Pérez'), TODAY)).toEqual({ kind: 'patient_next', patient: 'juan perez' });
    expect(parseCalendarQuery(n('¿hay huecos el jueves a la tarde?'), TODAY)).toEqual({ kind: 'gaps', date: '2026-11-19', period: 'afternoon' });
    expect(parseCalendarQuery(n('horarios libres mañana por la mañana'), TODAY)).toEqual({ kind: 'gaps', date: '2026-11-20', period: 'morning' });
    expect(parseCalendarQuery(n('Ana llegó'), TODAY)).toBeNull();
  });

  test('estados: llegó, no vino, confirmá, cancelá con motivo; sin a quién no es un comando', () => {
    expect(parseCalendarStatus(n('Ana Gómez llegó'), TODAY)).toEqual({ status: 'arrived', reason: null, patient: 'ana gomez', time: null, date: null });
    expect(parseCalendarStatus(n('llegó tarde la de las 10'), TODAY)).toMatchObject({ status: 'arrived_late', time: { hour: 10, minute: 0 }, patient: null });
    expect(parseCalendarStatus(n('el paciente de las 11 no vino'), TODAY)).toMatchObject({ status: 'no_show', time: { hour: 11, minute: 0 } });
    expect(parseCalendarStatus(n('confirmá la cita de Juan Pérez del lunes'), TODAY)).toMatchObject({ status: 'confirmed', patient: 'juan perez', date: '2026-11-23' });
    expect(parseCalendarStatus(n('cancelá la cita de Ana del martes, avisó con tiempo'), TODAY)).toMatchObject({ status: 'cancelled', reason: 'in_time', patient: 'ana' });
    expect(parseCalendarStatus(n('cancelá la de las 3 sin aviso'), TODAY)).toMatchObject({ status: 'cancelled', reason: 'no_notice', time: { hour: 15, minute: 0 } });
    expect(parseCalendarStatus(n('marcá a María como en atención'), TODAY)).toMatchObject({ status: 'in_progress', patient: 'maria' });
    expect(parseCalendarStatus(n('llegó'), TODAY)).toBeNull();
  });

  test('reprogramar: de dónde a dónde', () => {
    expect(parseCalendarReschedule(n('pasá la cita de Ana del martes al viernes a las 11'), TODAY)).toEqual({
      from: { patient: 'ana', time: null, date: '2026-11-24' },
      date: '2026-11-20',
      time: { hour: 11, minute: 0 },
    });
    expect(parseCalendarReschedule(n('mové la de las 10 a las 12'), TODAY)).toEqual({
      from: { patient: null, time: { hour: 10, minute: 0 }, date: null },
      date: null,
      time: { hour: 12, minute: 0 },
    });
    expect(parseCalendarReschedule(n('reprogramá a Juan Pérez para el lunes'), TODAY)).toMatchObject({ from: { patient: 'juan perez' }, date: '2026-11-23', time: null });
    expect(parseCalendarReschedule(n('pasá a consulta a Ana'), TODAY)).toBeNull();
  });

  test('nueva cita: fecha, hora y lo demás para separar con las listas', () => {
    const parsed = parseCalendarCreate(n('nueva cita para Ana Gómez el lunes a las 10 con el doctor Pérez para una limpieza'), TODAY);
    expect(parsed).toMatchObject({ date: '2026-11-23', time: { hour: 10, minute: 0 } });
    expect(splitCreateRest(parsed!.rest)).toEqual({ doctor: 'perez', calendar: null, parts: [{ via: 'para', text: 'ana gomez' }, { via: 'para', text: 'limpieza' }] });
    expect(parseCalendarCreate(n('agendá a Juan mañana a las 9 y media'), TODAY)).toMatchObject({ date: '2026-11-20', time: { hour: 9, minute: 30 }, rest: 'juan' });
    expect(parseCalendarCreate(n('dame un turno para María López'), TODAY)).toMatchObject({ date: null, time: null });
    expect(splitCreateRest('para maria lopez en el consultorio 2')).toEqual({ doctor: null, calendar: '2', parts: [{ via: 'para', text: 'maria lopez' }] });
    expect(splitCreateRest('juan con perez')).toEqual({ doctor: null, calendar: null, parts: [{ via: null, text: 'juan' }, { via: 'con', text: 'perez' }] });
    expect(parseCalendarCreate(n('qué tengo mañana'), TODAY)).toBeNull();
  });

  test('nueva cita: doctor y tratamientos contra las listas, el resto es el paciente', () => {
    const doctors = [{ id: 'd1', name: 'Dr. Juan Pérez' }, { id: 'd2', name: 'María López' }, { id: 'd3', name: 'Pedro Pérez' }];
    const services = [{ id: 's1', name: 'Limpieza dental' }, { id: 's2', name: 'Blanqueamiento' }, { id: 's3', name: 'Consulta' }, { id: 's4', name: 'Consulta de urgencia' }, { id: 's5', name: 'Limpieza profunda' }];
    const entities = (text: string) => extractCreateEntities(parseCalendarCreate(n(text), TODAY)!.rest, doctors, services);
    expect(entities('agendá una cita para Ana Gómez mañana a las 10 con el doctor Juan Pérez para una limpieza dental'))
      .toEqual({ doctorIds: ['d1'], doctorSaid: null, serviceGroups: [['s1']], calendarSaid: null, patient: 'ana gomez' });
    // El nombre del doctor ya no se come lo que sigue; "limpieza" sola calza con dos → preguntar.
    expect(entities('nueva cita para Ana Gómez el lunes a las 10 con el doctor Juan Pérez, limpieza'))
      .toMatchObject({ doctorIds: ['d1'], serviceGroups: [['s1', 's5']], patient: 'ana gomez' });
    expect(entities('agendame a Ana Gómez mañana a las 3 con la doctora María López de limpieza dental y blanqueamiento'))
      .toMatchObject({ doctorIds: ['d2'], serviceGroups: [['s1'], ['s2']], patient: 'ana gomez' });
    // "con María" sin decir doctora; "por una consulta" ya no se pierde y es "Consulta", no "de urgencia".
    expect(entities('dale una cita a Ana Gómez con María mañana a las 10 por una consulta'))
      .toMatchObject({ doctorIds: ['d2'], serviceGroups: [['s3']], patient: 'ana gomez' });
    // Un doctor que no existe no se come el tratamiento.
    expect(entities('agenda una cita para mañana a las 10 de Ana Gómez con el dr Gonzalez servicio blanqueamiento'))
      .toMatchObject({ doctorIds: [], doctorSaid: 'gonzalez', serviceGroups: [['s2']], patient: 'ana gomez' });
    expect(entities('nueva cita para Ana Gómez mañana a las 10')).toMatchObject({ doctorIds: [], serviceGroups: [], patient: 'ana gomez' });

    // Respuestas y correcciones.
    expect(findDoctorMention(n('Pérez'), doctors, { bare: true })?.ids).toEqual(['d1', 'd3']);
    expect(findDoctorMention(n('cambiá el doctor a Pedro Pérez'), doctors)?.ids).toEqual(['d3']);
    expect(findDoctorMention(n('agregá limpieza'), doctors)).toBeNull();
    expect(findServiceMentions(n('agregale limpieza dental y blanqueamiento'), services).map((m) => m.ids)).toEqual([['s1'], ['s2']]);
    expect(serviceEditMode(n('agregá blanqueamiento'))).toBe('add');
    expect(serviceEditMode(n('sacale la consulta'))).toBe('remove');
    expect(serviceEditMode(n('cambiá el tratamiento a limpieza dental'))).toBe('replace');
    expect(isNoneAnswer(n('sin doctor'))).toBe(true);
    expect(isNoneAnswer(n('ninguno'))).toBe(true);
    expect(isNoneAnswer(n('María López'))).toBe(false);
  });

  test('editar una cita: cuál es y qué cambiarle', () => {
    const edit = (text: string) => parseCalendarEdit(n(text), TODAY);
    const ref = (text: string) => editAppointmentRef(edit(text)!.body, TODAY);
    expect(ref('edita la cita de Luis Rodríguez')).toEqual({ patient: 'luis rodriguez', time: null, date: null });
    expect(ref('editá la cita de Luis Rodríguez del jueves')).toMatchObject({ patient: 'luis rodriguez', date: '2026-11-19' });
    expect(ref('abrí el turno de las 10')).toMatchObject({ patient: null, time: { hour: 10, minute: 0 } });
    expect(ref('modificá la cita de Ana Gómez')).toMatchObject({ patient: 'ana gomez' });
    // Lo que sigue al doctor y al tratamiento lo saca el comando con las listas; acá queda el paciente.
    const doctors = [{ id: 'd1', name: 'Juan Pérez' }];
    const body = edit('a la cita de Ana ponele el doctor Pérez')!.body;
    const doctor = findDoctorMention(body, doctors)!;
    expect(doctor.ids).toEqual(['d1']);
    const rest = body.trim().split(' ').filter((_, i) => i < doctor.start || i >= doctor.end).join(' ');
    expect(editAppointmentRef(rest, TODAY).patient).toBe('ana');
    // No son ediciones: un estado, una cita nueva, algo sin cita.
    expect(edit('poné la cita de Ana como confirmada')).toBeNull();
    expect(edit('agregá una cita para Ana mañana a las 10')).toBeNull();
    expect(edit('cambiá la vista a semana')).toBeNull();
  });

  test('la IA: solo ids de las listas, fechas y horas válidas; sin paciente ni hora no hay cita', () => {
    const context = {
      doctors: [{ id: 'd1', name: 'Juan Pérez' }],
      calendars: [{ id: 'c1', name: 'Sillón 1', sede: 'Centro' }],
      sedes: [{ id: 's1', name: 'Centro' }],
      services: [{ id: 'sv1', name: 'Limpieza' }],
    };
    const ok = sanitizeCalendarAiResult({
      intent: 'calendar.create', date: '2026-11-23', time: '10:00', patient: 'Ana Gómez',
      doctor_id: 'd1', calendar_id: 'zz', service_ids: ['sv1', 'nope'], confidence: 0.9,
    }, context);
    expect(ok).toMatchObject({ intent: 'calendar.create', date: '2026-11-23', time: '10:00', doctor_id: 'd1', calendar_id: null, service_ids: ['sv1'] });

    expect(sanitizeCalendarAiResult({ intent: 'calendar.status', status: 'arrived', confidence: 0.9 }, context).intent).toBe('unknown');
    expect(sanitizeCalendarAiResult({ intent: 'calendar.status', status: 'deleted', patient: 'Ana', confidence: 0.9 }, context).intent).toBe('unknown');
    expect(sanitizeCalendarAiResult({ intent: 'calendar.navigate', date: '2026-13-40', time: '25:00', confidence: 0.9 }, context)).toMatchObject({ intent: 'unknown', date: null, time: null });
    expect(sanitizeCalendarAiResult({ intent: 'calendar.filter', filter_op: 'only', doctor_ids: ['d1', 'x'], confidence: 2 }, context)).toMatchObject({ doctor_ids: ['d1'], confidence: 1 });
    expect(sanitizeCalendarAiResult('basura', context).intent).toBe('unknown');
  });

  test('menú de la cita: color, agenda, doctor, duración, borrar, abrir', () => {
    const color = (s: string) => parseCalendarColor(n(s), TODAY);
    expect(color('Poné la cita de Ana Gómez en rojo')).toMatchObject({ colorId: '11', patient: 'ana gomez' });
    expect(color('pintá de verde la de las 10')).toMatchObject({ colorId: '10', time: { hour: 10, minute: 0 } });
    // El color más a la derecha: "Rosa" es la paciente.
    expect(color('cambiá el color de la cita de Rosa a azul')).toMatchObject({ colorId: '9', patient: 'rosa' });
    expect(color('sacale el color a la cita de Juan')).toMatchObject({ colorId: '', patient: 'juan' });
    expect(color('poneme la cita de Marcela en celeste')).toMatchObject({ colorId: '7', patient: 'marcela' });
    expect(color('poné la cita de Ana como confirmada')).toBeNull();

    const move = (s: string) => parseCalendarMove(n(s), TODAY);
    expect(move('pasá la cita de Ana al consultorio 2')).toMatchObject({ calendarSaid: 'consultorio 2', patient: 'ana' });
    expect(move('mové la de las 10 a la agenda Centro')).toMatchObject({ calendarSaid: 'agenda centro', time: { hour: 10, minute: 0 } });
    expect(move('cambiá la agenda de la cita de Juan a Box 3')).toMatchObject({ calendarSaid: 'box 3', patient: 'juan' });
    expect(move('pasá al consultorio 1 la cita de Ana')).toMatchObject({ calendarSaid: 'consultorio 1', patient: 'ana' });
    expect(move('pasá la cita de Ana al viernes a las 11')).toBeNull();

    const doctors = [{ id: 'd1', name: 'Dr. Juan Pérez' }, { id: 'd2', name: 'Dra. Laura López' }];
    const services = [{ id: 's1', name: 'Limpieza dental' }];
    const doctor = (s: string) => parseCalendarAssignDoctor(n(s), doctors, services, TODAY);
    expect(doctor('pasá la cita de Ana al doctor Pérez')).toMatchObject({ ref: { patient: 'ana' }, doctorIds: ['d1'] });
    expect(doctor('asignale la de las 10 a la doctora López')).toMatchObject({ ref: { time: { hour: 10, minute: 0 } }, doctorIds: ['d2'] });
    expect(doctor('cambiá el doctor de la cita de Juan a López')).toMatchObject({ ref: { patient: 'juan' }, doctorIds: ['d2'] });
    // Con tratamientos es una edición.
    expect(doctor('pasá la cita de Ana al doctor Pérez con limpieza')).toBeNull();

    const duration = (s: string) => parseCalendarDuration(n(s), TODAY);
    expect(duration('que la cita de Ana dure 45 minutos')).toMatchObject({ minutes: 45, patient: 'ana' });
    expect(duration('alargá la de las 10 a una hora')).toMatchObject({ minutes: 60, time: { hour: 10, minute: 0 } });
    expect(duration('la cita de Juan duración media hora')).toMatchObject({ minutes: 30, patient: 'juan' });
    expect(duration('que la de las 3 dure una hora y media')).toMatchObject({ minutes: 90, time: { hour: 15, minute: 0 } });

    expect(parseCalendarDelete(n('borrá la cita de Ana'), TODAY)).toMatchObject({ patient: 'ana' });
    expect(parseCalendarDelete(n('eliminá el turno de las 10'), TODAY)).toMatchObject({ time: { hour: 10, minute: 0 } });
    expect(parseCalendarDelete(n('sacale la limpieza a la cita de Ana'), TODAY)).toBeNull();
    expect(parseCalendarDelete(n('borrá el recordatorio de las 10'), TODAY)).toBeNull();

    const open = (s: string) => parseCalendarOpen(n(s), TODAY);
    expect(open('abrí la historia clínica de Ana')).toMatchObject({ target: 'history', patient: 'ana' });
    expect(open('abrí el historial de citas de Ana')).toMatchObject({ target: 'appointments', patient: 'ana' });
    expect(open('mostrame la cuenta de la de las 10')).toMatchObject({ target: 'accounts', time: { hour: 10, minute: 0 } });
    expect(open('abrí los documentos de Ana Gómez')).toMatchObject({ target: 'documents', patient: 'ana gomez' });
    expect(open('abrí la sesión de la cita de Juan')).toMatchObject({ target: 'session', patient: 'juan' });
    expect(open('cobrale a Juan Pérez')).toMatchObject({ target: 'bill', patient: 'juan perez' });
    expect(open('abrí la cita de Ana')).toBeNull();
  });

  test('bloquear / habilitar horario: día, franja, sede y motivo', () => {
    const slot = (s: string) => parseCalendarSlot(n(s), TODAY);
    expect(slot('bloqueá el lunes de 14 a 16')).toMatchObject({ kind: 'block', date: '2026-11-23', startMin: 840, endMin: 960 });
    expect(slot('cerrá mañana desde las 15 por reunión')).toMatchObject({ kind: 'block', date: '2026-11-20', startMin: 900, endMin: null, note: 'reunion' });
    expect(slot('bloqueá todo el día del 24 en la sede Centro')).toMatchObject({ date: '2026-11-24', startMin: 0, endMin: 1440, sedeSaid: 'centro' });
    expect(slot('habilitá el sábado de 9 a 13')).toMatchObject({ kind: 'enable', date: '2026-11-21', startMin: 540, endMin: 780 });
    expect(slot('bloqueá de 9 a 12 de la mañana')).toMatchObject({ startMin: 540, endMin: 720 });
    expect(slot('bloqueá el horario de 11 a 1')).toMatchObject({ startMin: 660, endMin: 780 });
    // "abrí" sin franja ni horario es otra cosa.
    expect(slot('abrí la cita de Ana')).toBeNull();
    expect(slot('abrí la historia clínica de Ana')).toBeNull();
  });

  test('recordatorios y notas: crear, marcar hecho, borrar; título con tildes de la frase', () => {
    const reminder = (s: string) => parseCalendarReminder(n(s), TODAY);
    expect(reminder('Recordame el lunes a las 9 pagar la luz')).toMatchObject({ type: 'reminder', date: '2026-11-23', time: { hour: 9, minute: 0 }, title: 'pagar la luz' });
    expect(reminder('nota para hoy a las 15: revisar stock')).toMatchObject({ type: 'note', date: '2026-11-19', time: { hour: 15, minute: 0 }, title: 'revisar stock' });
    expect(reminder('nuevo recordatorio mañana')).toMatchObject({ date: '2026-11-20', time: null, title: null });
    expect(reminder('creá un recordatorio para mañana a las 10 que diga llamar al laboratorio')).toMatchObject({ title: 'llamar al laboratorio' });
    expect(rawPhrase('nota para hoy a las 15: Revisar stock de anestesia.', n('revisar stock de anestesia'))).toBe('Revisar stock de anestesia');

    const action = (s: string) => parseCalendarReminderAction(n(s), TODAY);
    expect(action('marcá como hecho el recordatorio de las 10')).toMatchObject({ action: 'done', time: { hour: 10, minute: 0 }, text: null });
    expect(action('borrá la nota de mañana de llamar al laboratorio')).toMatchObject({ action: 'delete', date: '2026-11-20', text: 'llamar laboratorio' });
    expect(action('el recordatorio de pagar la luz está listo')).toMatchObject({ action: 'done', text: 'pagar luz' });

    expect(parseCalendarToolbar(n('imprimí la agenda'))).toEqual({ action: 'print' });
    expect(parseCalendarToolbar(n('actualizá el calendario'))).toEqual({ action: 'refresh' });
    expect(parseCalendarToolbar(n('imprimí la historia de Ana'))).toBeNull();
  });

  test('la IA: color, franja, recordatorio y abrir con sus listas cerradas', () => {
    const context = { doctors: [{ id: 'd1', name: 'Juan Pérez' }], calendars: [{ id: 'c1', name: 'Sillón 1' }], sedes: [{ id: 's1', name: 'Centro' }], services: [] };
    expect(sanitizeCalendarAiResult({ intent: 'calendar.color', color: 11, patient: 'Ana', confidence: 0.9 }, context)).toMatchObject({ intent: 'calendar.color', color: '11' });
    expect(sanitizeCalendarAiResult({ intent: 'calendar.color', color: 'fucsia', patient: 'Ana', confidence: 0.9 }, context).intent).toBe('unknown');
    expect(sanitizeCalendarAiResult({ intent: 'calendar.move_calendar', calendar_id: 'zz', patient: 'Ana', confidence: 0.9 }, context).intent).toBe('unknown');
    expect(sanitizeCalendarAiResult({ intent: 'calendar.duration', minutes: 2000, patient: 'Ana', confidence: 0.9 }, context).intent).toBe('unknown');
    expect(sanitizeCalendarAiResult({ intent: 'calendar.block', date: '2026-11-23', time: '14:00', end_time: '16:00', sede_ids: ['s1', 'x'], confidence: 0.9 }, context))
      .toMatchObject({ intent: 'calendar.block', end_time: '16:00', sede_ids: ['s1'] });
    expect(sanitizeCalendarAiResult({ intent: 'calendar.open', target: 'history', from_time: '10:00', confidence: 0.9 }, context)).toMatchObject({ intent: 'calendar.open', target: 'history' });
    expect(sanitizeCalendarAiResult({ intent: 'calendar.reminder', reminder_type: 'note', title: 'Llamar', confidence: 0.9 }, context)).toMatchObject({ intent: 'calendar.reminder', reminder_type: 'note', title: 'Llamar' });
    expect(sanitizeCalendarAiResult({ intent: 'calendar.delete', confidence: 0.9 }, context).intent).toBe('unknown');
  });
});
