'use server';

/**
 * @fileOverview Executes database operations based on natural language commands.
 *
 * - executeDatabaseOperation - A function that executes database operations based on natural language commands.
 * - ExecuteDatabaseOperationInput - The input type for the executeDatabaseOperation function.
 * - ExecuteDatabaseOperationOutput - The return type for the executeDatabaseOperation function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExecuteDatabaseOperationInputSchema = z.object({
  command: z.string().describe('The natural language command to execute a database operation.'),
  databaseSchema: z.string().describe('The schema of the database to operate on.'),
});
export type ExecuteDatabaseOperationInput = z.infer<typeof ExecuteDatabaseOperationInputSchema>;

const ExecuteDatabaseOperationOutputSchema = z.object({
  success: z.boolean().describe('Whether the database operation was successful.'),
  message: z.string().describe('A message indicating the result of the operation.'),
  query: z.string().optional().describe('The generated SQL query, if applicable.'),
});
export type ExecuteDatabaseOperationOutput = z.infer<typeof ExecuteDatabaseOperationOutputSchema>;

export async function executeDatabaseOperation(input: ExecuteDatabaseOperationInput): Promise<ExecuteDatabaseOperationOutput> {
  return executeDatabaseOperationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'executeDatabaseOperationPrompt',
  input: {schema: ExecuteDatabaseOperationInputSchema},
  output: {schema: ExecuteDatabaseOperationOutputSchema},
  prompt: `You are an AI database assistant that translates natural language commands into SQL queries and executes them. You will be given a database schema and a command, and you will respond with whether the query was successful, a message indicating the result, and the generated SQL query.\n\nDatabase Schema:\n{{{databaseSchema}}}\n\nCommand:\n{{{command}}}\n\nRespond in JSON format:\n{
  "success": true|false,
  "message": "",
  "query": ""
}
`,
});

const executeDatabaseOperationFlow = ai.defineFlow(
  {
    name: 'executeDatabaseOperationFlow',
    inputSchema: ExecuteDatabaseOperationInputSchema,
    outputSchema: ExecuteDatabaseOperationOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
