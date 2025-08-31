'use server';

/**
 * @fileOverview Generates insights from a conversation by summarizing the content.
 *
 * - generateInsightsFromConversation - A function that takes a conversation as input and returns a summary of the insights.
 * - GenerateInsightsFromConversationInput - The input type for the generateInsightsFromConversation function.
 * - GenerateInsightsFromConversationOutput - The return type for the generateInsightsFromConversation function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateInsightsFromConversationInputSchema = z.object({
  conversationText: z.string().describe('The complete text of the conversation to summarize.'),
});
export type GenerateInsightsFromConversationInput = z.infer<typeof GenerateInsightsFromConversationInputSchema>;

const GenerateInsightsFromConversationOutputSchema = z.object({
  summary: z.string().describe('A concise summary of the key insights from the conversation.'),
});
export type GenerateInsightsFromConversationOutput = z.infer<typeof GenerateInsightsFromConversationOutputSchema>;

export async function generateInsightsFromConversation(input: GenerateInsightsFromConversationInput): Promise<GenerateInsightsFromConversationOutput> {
  return generateInsightsFromConversationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateInsightsFromConversationPrompt',
  input: {schema: GenerateInsightsFromConversationInputSchema},
  output: {schema: GenerateInsightsFromConversationOutputSchema},
  prompt: `You are an AI assistant tasked with summarizing conversations to extract key business insights, customer issues, and trends. Please provide a concise summary of the following conversation, highlighting customer issues, trends, and any other relevant information for business decision-making.\n\nConversation:\n{{{conversationText}}}\n\nSummary: `,
});

const generateInsightsFromConversationFlow = ai.defineFlow(
  {
    name: 'generateInsightsFromConversationFlow',
    inputSchema: GenerateInsightsFromConversationInputSchema,
    outputSchema: GenerateInsightsFromConversationOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
