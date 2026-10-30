'use client';

import * as React from 'react';

/**
 * Modo solo-lectura para los paneles de detalle de paciente reutilizados por el
 * portal (/my-profile).
 *
 * Se resuelve por contexto y no por props porque los paneles (`PatientInfoTab`,
 * `ClinicHistoryViewer`, `PatientFinanceSection`, …) tienen disparadores de
 * acción *internos*, varios niveles por debajo del punto de montaje; pasarlo
 * como prop obligaría a atravesar 4 niveles de componentes.
 *
 * El valor por defecto es `false`, así que **ningún uso actual cambia de
 * comportamiento**: sólo lo que se monte dentro de `<ReadOnlyProvider>` oculta
 * sus acciones de crear/editar/borrar.
 */
const ReadOnlyContext = React.createContext(false);

export function ReadOnlyProvider({
  children,
  value = true,
}: {
  children: React.ReactNode;
  value?: boolean;
}) {
  return <ReadOnlyContext.Provider value={value}>{children}</ReadOnlyContext.Provider>;
}

/** `true` sólo dentro de un `ReadOnlyProvider`. Fuera del portal siempre es `false`. */
export function useReadOnly(): boolean {
  return React.useContext(ReadOnlyContext);
}
