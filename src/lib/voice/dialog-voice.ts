/**
 * Control por voz de los diálogos de la agenda (bloquear / habilitar horario, recordatorios):
 * la voz manda un pedido numerado (`seq`) y el diálogo hace lo mismo que su botón, con las
 * mismas condiciones. El diálogo avisa su estado para que la voz sepa qué decir.
 */

export interface SlotDialogVoiceControl {
  seq: number;
  /** Nuevas horas de la franja (minutos desde las 00:00). */
  startMin?: number;
  endMin?: number;
  /** Motivo (campo Nota). */
  notes?: string;
  /** El botón de confirmar (solo si estaría habilitado; espera a que termine de revisar las citas). */
  submit?: boolean;
}

export interface SlotDialogVoiceStatus {
  /** El botón de confirmar está habilitado. */
  canSubmit: boolean;
  /** Todavía revisa qué citas caen en la franja. */
  checking: boolean;
  saving: boolean;
  /** No cambiaría nada (ya está así). */
  noChange: boolean;
  missingPermission: boolean;
  /** Cierres que no se pueden tocar desde acá. */
  locked: number;
  /** Citas activas dentro de la franja (solo al bloquear). */
  affected: number;
  /** Horas de la franja que quedaron en el formulario. */
  startMin: number | null;
  endMin: number | null;
  /** Error del último guardado (queda en el diálogo). */
  error: string | null;
}

export interface FormVoiceControl {
  seq: number;
  submit?: boolean;
}
