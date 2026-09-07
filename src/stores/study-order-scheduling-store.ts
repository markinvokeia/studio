import { create } from 'zustand';

/**
 * Operación de agendado en curso para una orden de estudio.
 *
 * Vive fuera del diálogo de cita a propósito. El operario entra desde la orden,
 * abre el diálogo, lo cierra, cambia de sede, se mueve por el calendario y
 * vuelve a abrirlo: durante todo eso tiene que seguir viendo que está agendando
 * para esa orden, y la cita que finalmente cree tiene que quedar atada a ella.
 * Guardarlo en el estado del diálogo lo perdería en el primer cierre.
 *
 * Mismo patrón que `billing-wizard-store`: un contexto global chico que sobrevive
 * a la navegación y se limpia explícitamente.
 */

export interface StudyOrderSchedulingContext {
    orderId: string;
    orderNumber: string;
    patientId?: string | null;
    patientName: string;
    /**
     * Derivador de la orden. Viaja en el contexto porque la cita tiene que
     * quedar a nombre de quien derivó — en Clínica Imagen el doctor de la cita
     * es el derivador, no el técnico que ejecuta. Se precarga y se bloquea para
     * que no se cambie por accidente al agendar.
     */
    doctorId?: string | null;
    doctorName?: string | null;
    /** Servicios pendientes de agendar, para precargarlos en la cita. */
    serviceIds: string[];
}

interface StudyOrderSchedulingStore {
    context: StudyOrderSchedulingContext | null;
    /** Arranca la operación: el aviso aparece y la cita que se cree se atará. */
    start: (context: StudyOrderSchedulingContext) => void;
    /**
     * Termina la operación. La llama el botón "Cancelar operación" del aviso y
     * también el guardado exitoso, una vez que la cita ya quedó atada.
     */
    clear: () => void;
}

export const useStudyOrderScheduling = create<StudyOrderSchedulingStore>((set) => ({
    context: null,
    start: (context) => set({ context }),
    clear: () => set({ context: null }),
}));
