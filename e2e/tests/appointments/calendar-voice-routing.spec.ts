import { expect, test } from '@playwright/test';

import '@/lib/voice/commands/calendar';
import '@/lib/voice/commands/calendar-query';
import '@/lib/voice/commands/calendar-manage';
import '@/lib/voice/commands/calendar-actions';
import { normalizeSpeech } from '@/lib/voice/parse';
import { matchVoiceCommand } from '@/lib/voice/registry';

/**
 * Calendario por voz, sin navegador: con todos los comandos registrados, cada frase va al comando
 * que corresponde (los nuevos no se comen frases de los que ya estaban, y al revés). Sin pantalla
 * no hay listas de doctores, así que "pasá la cita al doctor X" no se prueba acá.
 */

const route = (text: string) => matchVoiceCommand(['calendar'], normalizeSpeech(text), text)?.command.id ?? null;

const CASES: Array<[string, string | null]> = [
  // Lo que ya estaba
  ['andá al jueves', 'calendar.navigate'],
  ['vista semanal', 'calendar.view'],
  ['¿qué tengo mañana?', 'calendar.query'],
  ['Ana Gómez llegó', 'calendar.status'],
  ['poné la cita de Rosa como confirmada', 'calendar.status'],
  ['cancelá la de las 3 sin aviso', 'calendar.status'],
  ['nueva cita para Ana Gómez el lunes a las 10', 'calendar.create'],
  ['pasá la cita de Ana al viernes a las 11', 'calendar.reschedule'],
  ['editá la cita de Luis Rodríguez', 'calendar.edit'],
  // Menú de la cita
  ['poné la cita de Ana Gómez en rojo', 'calendar.color'],
  ['cambiá el color de la cita de Rosa a azul', 'calendar.color'],
  ['pasá la cita de Ana al consultorio 2', 'calendar.move_calendar'],
  ['que la cita de Ana dure 45 minutos', 'calendar.duration'],
  ['borrá la cita de Ana', 'calendar.delete'],
  ['abrí la historia clínica de Ana', 'calendar.open'],
  ['cobrale a Juan Pérez', 'calendar.open'],
  // Horarios
  ['bloqueá el lunes de 14 a 16', 'calendar.slot'],
  ['habilitá el sábado de 9 a 13', 'calendar.slot'],
  ['abrí el horario del sábado de 9 a 12', 'calendar.slot'],
  // Recordatorios
  ['recordame mañana a las 9 llamar al laboratorio', 'calendar.reminder'],
  ['nueva nota hoy a las 15 revisar stock', 'calendar.reminder'],
  ['marcá como hecho el recordatorio de las 10', 'calendar.reminder_action'],
  ['borrá la nota de mañana', 'calendar.reminder_action'],
  // Barra
  ['imprimí la agenda', 'calendar.toolbar'],
  ['actualizá el calendario', 'calendar.toolbar'],
];

test.describe('Calendario — voz (qué comando toma cada frase)', () => {
  for (const [text, id] of CASES) {
    test(`${text} → ${id}`, () => {
      expect(route(text)).toBe(id);
    });
  }

  test('"abrí la agenda de Pérez" no es habilitar horario', () => {
    expect(route('abrí la agenda de Pérez')).not.toBe('calendar.slot');
  });
});
