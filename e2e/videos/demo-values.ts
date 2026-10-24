/**
 * Datos sintéticos para los videos demo. Nunca datos reales: los videos se
 * graban sólo contra el tenant demo (HELP_VIDEO_DEMO_TENANT=1).
 */
export const DEMO_VALUES: Record<string, Record<string, unknown>> = {
  'onboarding.business': { name: 'Clínica Sonrisas', email: 'hola@clinicasonrisas.demo', phone: '+59829001234', rut: '211234560018' },
  'onboarding.sede': { name: 'Sede Centro', address: 'Av. 18 de Julio 1234', phone: '+59829001234', email: 'centro@clinicasonrisas.demo' },
  'onboarding.schedules': { days_of_week: [1, 2, 3, 4, 5], start_time: '09:00', end_time: '18:00' },
  'onboarding.calendar': { name: 'Consultorio 1', sede: 'Sede Centro' },
  'onboarding.doctor': { name: 'Dra. Lucía Pereira', email: 'lucia.pereira@clinicasonrisas.demo', phone: '+59899111222' },
  'onboarding.availability': { doctor: 'Lucía Pereira', days_of_week: [1, 3, 5], start_time: '09:00', end_time: '13:00' },
  'onboarding.service': { name: 'Limpieza dental', price: 1800, duration_minutes: 30 },
  'onboarding.staff': { name: 'Martina Gómez', email: 'recepcion@clinicasonrisas.demo', role: 'Recepcionista' },
  'onboarding.payment-method': { name: 'Tarjeta de débito', code: 'DEB' },
  'patients.create': { name: 'Juan Rodríguez', phone: '+59899333444', email: 'juan.rodriguez@paciente.demo' },
};
