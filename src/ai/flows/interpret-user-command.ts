'use server';

/**
 * @fileOverview Interprets user commands and executes actions based on the interpreted intent.
 *
 * - interpretUserCommand - A function that interprets the user's command and returns the actions to be executed.
 * - InterpretUserCommandInput - The input type for the interpretUserCommand function.
 * - InterpretUserCommandOutput - The return type for the interpretUserCommand function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const InterpretUserCommandInputSchema = z.object({
  command: z.string().describe('The natural language command entered by the user.'),
  availableActions: z.array(z.string()).describe('A list of available actions that can be performed.'),
});
export type InterpretUserCommandInput = z.infer<typeof InterpretUserCommandInputSchema>;

const InterpretUserCommandOutputSchema = z.object({
  actions: z.array(z.string()).describe('The actions to be executed based on the user command.'),
  parameters: z.record(z.string()).describe('The parameters for the actions to be executed.'),
});
export type InterpretUserCommandOutput = z.infer<typeof InterpretUserCommandOutputSchema>;

export async function interpretUserCommand(input: InterpretUserCommandInput): Promise<InterpretUserCommandOutput> {
  return interpretUserCommandFlow(input);
}

const prompt = ai.definePrompt({
  name: 'interpretUserCommandPrompt',
  input: {schema: InterpretUserCommandInputSchema},
  output: {schema: InterpretUserCommandOutputSchema},
  prompt: `You are an AI assistant that interprets user commands and determines the appropriate actions to be executed. You have access to the following actions: {{{availableActions}}}.

  Interpret the following command:
  {{{command}}}

  Determine the actions to be executed and any parameters required for those actions. Return your response as a JSON object. The JSON object should contain an 'actions' array containing string values, and a 'parameters' object containing string key/value pairs representing the parameter values.
  {
    "actions": ["action1", "action2"],
    "parameters": {"param1": "value1", "param2": "value2"}
  }
`,
});

const interpretUserCommandFlow = ai.defineFlow(
  {
    name: 'interpretUserCommandFlow',
    inputSchema: InterpretUserCommandInputSchema,
    outputSchema: InterpretUserCommandOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
