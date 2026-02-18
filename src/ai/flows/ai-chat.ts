'use server';
/**
 * @fileOverview An AI chatbot flow for customer support.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';

export const MessageSchema = z.object({
    role: z.enum(['user', 'model']),
    content: z.string(),
});

export const ChatInputSchema = z.object({
  history: z.array(MessageSchema),
  message: z.string(),
  language: z.string().default('English'),
});

export type ChatInput = z.infer<typeof ChatInputSchema>;

export const ChatOutputSchema = z.object({
  response: z.string(),
});

export type ChatOutput = z.infer<typeof ChatOutputSchema>;

export async function chatWithAI(input: ChatInput): Promise<ChatOutput> {
  return aiChatFlow(input);
}

const knowledgeBase = `
MarigoApp Knowledge Base:
- How to Buy: Browse items, add to cart, proceed to checkout. We offer secure payments via Stripe and Cash on Delivery.
- How to Sell: Click "Sell", fill out the item details, upload photos, set a price, and list your item.
- Payments: We use Stripe for secure card processing. All transactions are in EUR. We also offer Cash on Delivery (COD) in supported areas.
- Shipping: Sellers ship items directly to buyers. For high-value items, we offer an optional authentication service where items are shipped to us first. Shipping costs are calculated at checkout.
- Returns: Returns are accepted within 7 days of delivery for items that are not as described. The buyer is responsible for return shipping.
- Safety Tips: Never share personal information like your phone number or bank details in the chat. All transactions must happen on the MarigoApp platform.
`;

const aiChatFlow = ai.defineFlow(
  {
    name: 'aiChatFlow',
    inputSchema: ChatInputSchema,
    outputSchema: ChatOutputSchema,
  },
  async ({ history, message, language }) => {
    const prompt = `You are a friendly and helpful customer support agent for MarigoApp, a luxury fashion marketplace.
Your goal is to answer user questions based on the provided knowledge base.
If the user's question cannot be answered using the knowledge base, politely inform them that you can't help with that and offer to connect them with a human agent.
Keep your answers concise and clear.
Always respond in the user's specified language: ${language}.

Here is the knowledge base:
${knowledgeBase}

Here is the conversation history:
${history.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

New user message:
${message}
`;

    const llmResponse = await ai.generate({
      prompt: prompt,
      model: 'gemini-1.5-flash',
      config: {
        temperature: 0.3,
      },
    });

    return { response: llmResponse.text };
  }
);
