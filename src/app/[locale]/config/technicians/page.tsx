'use client';

import { StaffDirectory, TECHNICIANS_CONFIG } from '@/components/config/staff-directory';

/**
 * Técnicos y operadores: la misma pantalla que Doctores, listando los usuarios
 * con rol `operador`. Desde acá se les asignan los calendarios cuyas citas van a
 * ver en su panel de tareas.
 */
export default function TechniciansPage() {
    return <StaffDirectory config={TECHNICIANS_CONFIG} />;
}
