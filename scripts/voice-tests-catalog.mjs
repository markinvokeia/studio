#!/usr/bin/env node
/**
 * Genera docs/voz-agenda-pruebas.md (el catálogo de pruebas del agente de voz de la agenda) desde
 * las pruebas de e2e/tests/voice-agent: cada archivo, sus grupos y cada caso con su nombre (que es
 * la frase dicha y lo esperado). Correr después de agregar o cambiar pruebas:
 *
 *   pnpm test:voice:catalog
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const json = execFileSync('npx', ['playwright', 'test', '-c', 'playwright.voice.config.ts', '--list', '--reporter=json'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const report = JSON.parse(json.slice(json.indexOf('{')));

const FILE_INTRO = {
  '01-wake.spec.ts': 'Escucha sin palabra de activación («Invoke» se tolera): cómo la transcribe el reconocedor, retomar y cancelar.',
  '03-dialogs-close-stop.spec.ts': 'AV · Avisos (elegir el botón por texto, posición o sí/no), cerrar lo que esté abierto, dejar de escuchar, buscar huecos.',
  '02-mic.spec.ts': 'Micrófono permanente: pausa blanda (no se oye a sí mismo, no reinicia), juntar los pedazos de una frase.',
  '04-popups-selection.spec.ts': 'AV · Avisos y ventanas: elegir por número, posición («la última», «la de abajo»), hora o texto; apretar botones por nombre; sí/no.',
  '05-core-overlay.spec.ts': 'G · General (cualquier página): desplazarse, prioridad de la ventana o panel abierto (sus botones y campos), cambio de contexto que cierra lo abierto y suelta el foco.',
  '06-navigation.spec.ts': 'NV · Menú principal desde cualquier página: «andá a…», «abrí…», «go to…»; cada destino en es/es-ES/en; permisos; ambigüedad; ir y seguir en la página nueva; cambio de contexto; IA solo si no se nombró tal cual.',
  '07-screen.spec.ts': 'UI · Cualquier pantalla sin voz propia: tocar botones y pestañas, escribir en campos, prender/apagar, elegir en listas, buscar, abrir filas, «¿qué puedo hacer acá?»; lo abierto primero; lo propio de la pantalla gana.',
  '08-rail.spec.ts': 'RL · Panel derecho desde cualquier página: ficha/historia/cuenta de un paciente, cobro rápido, sede, caja, pantalla de la sala, alertas, bandeja, tipo de cambio, notas, asistente, mostrar/ocultar el panel.',
  '10-atomic-es.spec.ts': 'N1 · Atómicos en español: escucha, navegación, vistas, zoom.',
  '11-toolbar-settings-es.spec.ts': 'N1 · Atómicos en español: agendas, doctores, sedes, agrupar, panel, buscar, huecos, actualizar y todo el engranaje.',
  '12-appointments-es.spec.ts': 'N1 · Atómicos en español sobre una cita: encontrar, estados, cancelar con motivo, borrar, color, doctor, consultorio, duración, mover, abrir.',
  '13-form-export-patients-es.spec.ts': 'N1 · Atómicos en español: editor de la cita campo por campo, nueva cita, exportar, pacientes y agente clínico.',
  '20-chained-es.spec.ts': 'N2 · Encadenados: foco, herramientas en el medio, cambio de tema, cancelar, elegir de muchas formas.',
  '30-ai-plans-es.spec.ts': 'N3 · Con IA: solo cuando hace falta, sinónimos, planes de varios pasos, relación con la tarea, formulario con IA.',
  '40-incomplete-es.spec.ts': 'N4 · Incompletos o mal dichos: pregunta lo que falta, nombres mal transcriptos, regla de oro (nunca se traba).',
  '50-english.spec.ts': 'EN · La batería en inglés (app en inglés): atómicos, encadenados, IA, incompletos.',
  '60-patient-info.spec.ts': 'N5 · Información del paciente (estadísticas, deuda, pagos, presupuestos, tratamientos) y acciones (presupuesto, factura, tratamiento, sesión, cobro), es y en.',
  '70-variants-es.spec.ts': 'V · Variantes en español: la misma acción pedida de muchas formas.',
  '71-variants-en.spec.ts': 'V · Variantes en inglés.',
  '72-variants-more.spec.ts': 'V · Más variantes es/en: menú de la cita, recordatorios, bloqueos, exportar y cada corrección del editor.',
  '80-routines.spec.ts': 'R · Rutinas reales de recepción y doctores: conversaciones largas que combinan todo, es y en.',
  '90-ai-understanding.spec.ts': 'AI · Adjetivos y formas indirectas con IA, ambigüedad y confianza (pregunta con confianza media), es y en.',
};

const lines = [];
let total = 0;
const walk = (suite, depth, out) => {
  for (const spec of suite.specs ?? []) out.push({ depth, title: spec.title });
  for (const child of suite.suites ?? []) {
    out.push({ depth, group: child.title });
    walk(child, depth + 1, out);
  }
};
for (const file of report.suites ?? []) {
  const items = [];
  walk(file, 0, items);
  const count = items.filter((i) => i.title).length;
  total += count;
  lines.push(`## ${file.title} (${count})`, '', FILE_INTRO[file.title] ?? '', '');
  for (const item of items) {
    if (item.group) lines.push(`${'  '.repeat(item.depth)}- **${item.group}**`);
    else lines.push(`${'  '.repeat(item.depth)}- ${item.title}`);
  }
  lines.push('');
}

const header = `# Voz en Invoke IA · Catálogo de pruebas

Generado por \`pnpm test:voice:catalog\` desde \`e2e/tests/voice-agent/\` — no editar a mano. **${total} casos.**
Reglas y levantamiento del feature: [voz-agenda.md](voz-agenda.md).

## Cómo se prueba

- \`pnpm test:voice\` corre todo en Node, sin navegador, sin servidor y sin tocar DEV (unos minutos).
- **Se simula que se habla**: cada frase entra por el micrófono permanente falso (el botón Voz prendido) como la entregaría el
  reconocedor del navegador. Pasa por la sesión (escucha sin palabra de activación, pila, foco, herramientas, cambio de tema), los
  comandos y los textos reales del idioma de la prueba (\`es\` o \`en\`: para inglés la app se pone en inglés).
- **La agenda es simulada** (\`sim/calendar.ts\`): el mismo estado y las mismas acciones que publica la pantalla de citas, con
  datos fijos y un registro de cada acción que pidió la voz. Cada caso verifica lo que quedó (vista, zoom, preferencias,
  estado de la cita, formulario guardado, diálogo abierto…).
- **La IA**: el modelo se reemplaza por lo que contestaría; el prompt y la validación son los nodos reales del flujo de n8n
  \`n8n-workflows/help-voice-interpret.json\`, y después la revalidación del navegador. Las pruebas sin IA verifican además que
  no se llamó a la IA (lo local tiene que alcanzar).
- Niveles: atómicos (N1) → encadenados (N2) → con IA (N3) → incompletos (N4) → información del paciente (N5) → variantes (V) →
  rutinas reales (R) → comprensión con IA (AI). Español primero; el mismo recorrido en inglés.

### Datos de prueba

Hoy: 09:00 Ana Gómez (Dr. Martín Pérez, Sillón 1) · 10:00 Juan Pérez (Dra. Laura Ruiz, Sillón 2, confirmada) ·
10:30 Ana Martínez (Dr. Pérez, Sillón 1) · 15:00 Carlos López (Dr. Pablo Gómez, Ortodoncia). Mañana: 11:00 María Rodríguez ·
16:00 Lucía Fernández. En una semana: Pedro Sánchez. Hace dos años: Roberto Díaz (doc. 12345678). Sin citas: Sofía Castro
(tel. 099123456, sofia@gmail.com). Sedes Centro (Sillón 1, Sillón 2) y Pocitos (Ortodoncia). Registros de Juan Pérez: vino 5
veces, faltó 2 (última 10/9/2026), canceló 1 tarde, debe 1.200 UYU, último pago 500 UYU el 5/10/2026, 2 presupuestos (1 sin
facturar), 2 facturas (1 sin pagar), ortodoncia 3 de 10 sesiones.

`;
writeFileSync(join(root, 'docs/voz-agenda-pruebas.md'), header + lines.join('\n'));
console.log(`docs/voz-agenda-pruebas.md · ${total} casos`);
