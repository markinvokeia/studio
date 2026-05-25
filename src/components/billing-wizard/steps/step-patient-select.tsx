'use client';

import * as React from 'react';
import { UserIcon } from 'lucide-react';
import { UserSelector } from '@/components/ui/user-selector';
import type { User } from '@/lib/types';

interface StepPatientSelectProps {
  selectedPatient: User | null;
  onPatientChange: (patient: User) => void;
  // Read-only mode: patient already known from context
  readonlyPatient?: { id: string; name: string; phone?: string; email?: string } | null;
}

export function StepPatientSelect({
  selectedPatient,
  onPatientChange,
  readonlyPatient,
}: StepPatientSelectProps) {
  if (readonlyPatient) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-1">
          <p className="text-xs text-muted-foreground">Paciente para este cobro</p>
        </div>
        <div className="rounded-lg border bg-background px-4 py-3 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 shrink-0">
            <UserIcon className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{readonlyPatient.name}</p>
            {readonlyPatient.phone && (
              <p className="text-xs text-muted-foreground">{readonlyPatient.phone}</p>
            )}
            {readonlyPatient.email && (
              <p className="text-xs text-muted-foreground">{readonlyPatient.email}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/30 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          Selecciona el paciente al que deseas facturar. Si no existe, puedes crearlo directamente desde el selector.
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Paciente
        </label>
        <UserSelector
          filterType="PACIENTE"
          isSales={true}
          value={selectedPatient?.id}
          selectedUserName={selectedPatient?.name}
          onValueChange={(_, user) => { if (user) onPatientChange(user); }}
          placeholder="Buscar o crear paciente..."
          triggerText="Seleccionar paciente"
        />
      </div>

      {selectedPatient && (
        <div className="rounded-lg border bg-background px-4 py-3 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 shrink-0">
            <UserIcon className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{selectedPatient.name}</p>
            {selectedPatient.phone_number && (
              <p className="text-xs text-muted-foreground">{selectedPatient.phone_number}</p>
            )}
            {selectedPatient.email && (
              <p className="text-xs text-muted-foreground">{selectedPatient.email}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
