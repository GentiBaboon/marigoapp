/**
 * @fileOverview AI chatbot types and client helper.
 * The actual AI logic runs in /api/chat/route.ts (server-side).
 */
import { z } from 'zod';

export const MessageSchema = z.object({
  role: z.enum(['user', 'model']),
  content: z.string(),
});

export const ChatInputSchema = z.object({
  history: z.array(MessageSchema),
  message: z.string(),
});

export type ChatInput = z.infer<typeof ChatInputSchema>;

export const ChatOutputSchema = z.object({
  response: z.string(),
  products: z.array(z.object({
    id: z.string(),
    title: z.string(),
    price: z.number(),
    image: z.string(),
    brandId: z.string(),
    sellerId: z.string(),
  })).optional(),
});

export type ChatOutput = z.infer<typeof ChatOutputSchema>;

export async function chatWithAI(input: ChatInput): Promise<ChatOutput> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `AI chat request failed with status ${res.status}`);
  }

  return res.json();
}
