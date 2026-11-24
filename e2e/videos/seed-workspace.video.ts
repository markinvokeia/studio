import { test } from '@playwright/test';

import { driveGuide, openForGuide } from '../utils/help';

/**
 * Temporal: las guías de Mi Consultorio necesitan una cita de hoy del usuario de prueba.
 * La crea con la guía de alta de citas (sin video) a la hora de HELP_SEED_TIME.
 * Sólo con HELP_SEED=1: comparte la carpeta de los videos y si no se colaría en cada grabación.
 */
test('seed · cita de hoy para Mi Consultorio', async ({ page }) => {
  test.skip(process.env.HELP_SEED !== '1', 'sólo con HELP_SEED=1');
  test.setTimeout(180_000);
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  await openForGuide(page, '/appointments');
  await driveGuide(page, 'appointments.create', {
    confirm: true,
    values: {
      patient: process.env.HELP_SEED_PATIENT ?? 'Carlos Delgado',
      doctor: process.env.HELP_SEED_DOCTOR ?? 'Raidel Martínez',
      calendar: process.env.HELP_SEED_CALENDAR ?? 'Consultorio Centro',
      date,
      time: process.env.HELP_SEED_TIME ?? '16:00',
      notes: 'Control de rutina',
    },
  });
});
