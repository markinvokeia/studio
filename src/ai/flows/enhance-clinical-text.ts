'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const EnhanceClinicalTextInputSchema = z.object({
  text: z.string().describe('The text to enhance.'),
  context: z.string().optional().describe('Optional context hint.'),
});
export type EnhanceClinicalTextInput = z.infer<typeof EnhanceClinicalTextInputSchema>;

// LLM produces texto_mejorado + acciones + redirects — processed_by is added by the flow handler
const LLMOutputSchema = z.object({
  texto_mejorado: z.string().describe('El texto corregido. Misma longitud y tono que la entrada.'),
  acciones: z.array(z.enum(['CALENDAR', 'QUOTE', 'INVOICE', 'PURCHASE'])).describe('Intenciones detectadas en el texto.'),
  redirects: z.array(z.string()).describe('URLs de redirección en el mismo orden que acciones.'),
});

export interface EnhanceClinicalTextOutput {
  enhanced_text: string;
  processed_by: 'backend';
  actions: ('CALENDAR' | 'QUOTE' | 'INVOICE' | 'PURCHASE')[];
  redirects: string[];
}

export async function enhanceClinicalText(
  input: EnhanceClinicalTextInput,
): Promise<EnhanceClinicalTextOutput> {
  return enhanceClinicalTextFlow(input);
}

const prompt = ai.definePrompt({
  name: 'enhanceClinicalTextPrompt',
  input: { schema: EnhanceClinicalTextInputSchema },
  output: { schema: LLMOutputSchema },
  prompt: `Actúa como un procesador de texto automatizado. Tu única función es corregir el texto recibido y detectar intenciones clave.

REGLAS ESTRICTAS E INQUEBRANTABLES:
1. NO agregues saludos, introducciones, explicaciones ni despedidas.
2. NO agregues información nueva, no des contexto, ni respondas a preguntas que el texto haga.
3. Mantén la longitud original: si el texto es corto, la mejora debe ser igualmente corta.
4. Devuelve los campos texto_mejorado y acciones. Nada más.

INTENCIONES A DETECTAR:
- "cita", "turno", "agendar", "consulta" → Agrega "CALENDAR"
- "presupuesto", "cotización", "tratamiento" → Agrega "QUOTE"
- "factura", "cobrar", "pendiente de pago", "pago" → Agrega "INVOICE"
- Sin coincidencia → acciones vacío []

EJEMPLOS:
Entrada: "nesesito un turno para mañana y tmb q me pasen el presupuesto"
→ texto_mejorado: "Necesito un turno para mañana y también que me pasen el presupuesto."
→ acciones: ["CALENDAR", "QUOTE"]

Entrada: "quiero cobrar la factura de juan perez q esta pendiente de pago"
→ texto_mejorado: "Quiero cobrar la factura de Juan Pérez que está pendiente de pago."
→ acciones: ["INVOICE"]

Entrada: "¿Como se hace una torta de chocolate?"
→ texto_mejorado: "¿Cómo se hace una torta de chocolate?"
→ acciones: []

Texto a procesar:
{{{text}}}`,
});

const enhanceClinicalTextFlow = ai.defineFlow(
  {
    name: 'enhanceClinicalTextFlow',
    inputSchema: EnhanceClinicalTextInputSchema,
    outputSchema: z.object({
      enhanced_text: z.string(),
      processed_by: z.literal('backend'),
      actions: z.array(z.enum(['CALENDAR', 'QUOTE', 'INVOICE', 'PURCHASE'])),
      redirects: z.array(z.string()),
    }),
  },
  async (input) => {
    const { output } = await prompt(input);
    return {
      enhanced_text: (output?.texto_mejorado ?? '').trim() || input.text,
      processed_by: 'backend' as const,
      actions: output?.acciones ?? [],
      redirects: output?.redirects ?? [],
    };
  },
);
