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
  /** Lets the assistant say "sign in first" instead of describing a dead end. */
  isSignedIn: z.boolean().optional(),
  /** The visitor's shopping department, so results skew to what they browse. */
  gender: z.enum(['women', 'men', 'children']).nullable().optional(),
  /** UI language. Only breaks ties when the message itself gives no signal. */
  locale: z.enum(['en', 'sq']).optional(),
  /** First name / shop name, so the assistant can address them personally. */
  userName: z.string().max(60).optional(),
});

export type ChatInput = z.infer<typeof ChatInputSchema>;

export const ChatLinkSchema = z.object({
  label: z.string(),
  href: z.string(),
});

export type ChatLink = z.infer<typeof ChatLinkSchema>;

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
  /** Places to send the visitor, rendered as buttons under the reply. */
  links: z.array(ChatLinkSchema).optional(),
});

export type ChatOutput = z.infer<typeof ChatOutputSchema>;

// The fetch helper lives in `src/ai/chat-client.ts` (zod-free) so the widget
// can import it without this module's schemas; re-exported for callers that
// still reach it here.
export { chatWithAI } from '../chat-client';
