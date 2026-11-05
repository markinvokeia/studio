'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Fallback of the periodontogram's dictation: when the local parser (src/lib/perio/voice.ts) does
// not understand a phrase, this rewrites it in the closed command language the parser knows. The
// model only reformulates: the parser still decides what is written, and nothing is saved
// without the professional (dictated values stay pending until confirmed).

const InputSchema = z.object({
  text: z.string().describe('What the professional dictated, as the browser transcribed it.'),
});
const OutputSchema = z.object({
  phrase: z.string().describe('The same instruction in the command language, or an empty string.'),
});

export async function rewritePerioDictation(input: z.infer<typeof InputSchema>): Promise<z.infer<typeof OutputSchema>> {
  return perioDictationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'perioDictationPrompt',
  input: { schema: InputSchema },
  output: { schema: OutputSchema },
  prompt: `Reescribís dictados de un periodontograma al lenguaje de comandos de abajo. Solo reformulás:
no agregás valores, piezas ni marcas que no estén en el dictado. Si no hay nada que se pueda expresar,
devolvés una cadena vacía. Sin explicaciones.

Lenguaje (en español; números en cifras; piezas en notación FDI de dos dígitos, 11 a 48):
- Valores en la línea actual: "3 2 4" (tres sitios seguidos), "menos 2" (agrandamiento).
- Pieza y cara, después valores: "38 lingual 3 2 4", "16 vestibular 2 3 2". Caras: vestibular, lingual, palatino.
- Líneas: "PS 23 vestibular", "MG 16", "SS 23 lingual", "placa 23".
- Marcas: "sangra", "sangra distal", "sangra 16 mesial", "supura 46 distal", "placa", "no sangra".
- Margen: "margen gingival" y después los valores; "recesión" equivale a margen.
- Movilidad y furcas: "46 movilidad 1", "furca vestibular 2".
- Moverse: "siguiente", "anterior", "diente 23".
- Vista y pasadas: "arcada superior", "arcada inferior", "ver ambas", "profundidad", "furcas y movilidad".
- Edición: "deshacer", "confirmar", "parar dictado".
Los tres valores de una cara van en orden distal, centro, mesial. Separá las instrucciones con comas.

Ejemplos:
"en el treinta y ocho por lingual tengo tres, dos y cuatro y le sangra el distal" → "38 lingual 3 2 4, sangra distal"
"the lower left first molar buccal is four three five" → "36 vestibular 4 3 5"
"bueno, ahora pasemos al margen" → "margen gingival"

Dictado: {{{text}}}`,
});

const perioDictationFlow = ai.defineFlow(
  { name: 'perioDictationFlow', inputSchema: InputSchema, outputSchema: OutputSchema },
  async (input) => {
    const { output } = await prompt(input);
    return { phrase: output?.phrase?.trim() ?? '' };
  },
);
