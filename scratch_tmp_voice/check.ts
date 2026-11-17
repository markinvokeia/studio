import { normalizeSpeech } from '@/lib/voice/parse';
import { parseLabOrderEdit, parseLabOrderStatus, parseLabOrdersList, parseLabOrderVoice } from '@/lib/voice/commands/lab-orders-parse';
const today = new Date(2026, 10, 17);
const cases = [
  '¿Dónde está la orden 45?', 'en qué etapa anda la orden cuarenta y cinco',
  'la orden 45 la entregan el lunes', 'cambiá la entrega de la orden 45 al viernes', 'la orden 45 es urgente',
  'la orden 45 ya no es urgente', 'marcá la orden 45 como urgente', 'Anotale a la orden 45 que el color es A2',
  'agregá una nota a la orden 45: color A2, hombro cerámico', 'nota en la orden 45', 'la orden 45 se envió ayer, entrega el viernes',
  'pasá la orden 45 a prueba en boca', 'mostrame las órdenes atrasadas', '¿cuántas órdenes urgentes hay?', 'mostrame las órdenes de Ana Pérez',
  'mostrame las órdenes del laboratorio Dental Sur', 'ver las órdenes que vencen hoy en el tablero', 'sacá los filtros', 'creá una orden para Ana',
  'mostrame el tablero de laboratorio', 'show overdue orders', 'la orden 45 entrega el 2 de diciembre',
];
for (const p of cases) {
  const n = normalizeSpeech(p);
  const r = parseLabOrderStatus(n) ? ['status', parseLabOrderStatus(n)] : parseLabOrderEdit(n, p, today) ? ['edit', parseLabOrderEdit(n, p, today)] : parseLabOrdersList(n) ? ['list', parseLabOrdersList(n)] : parseLabOrderVoice(n) ? ['stage', parseLabOrderVoice(n)?.intent] : ['-'];
  console.log(p.padEnd(58), JSON.stringify(r));
}
