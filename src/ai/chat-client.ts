/**
 * @fileOverview The browser side of the AI assistant — with no zod.
 *
 * `flows/ai-chat.ts` defines the request/response schemas the `/api/chat`
 * route validates with, and defining them means importing zod at load. The
 * chat widget only needs the fetch helper and the *types*, so it imports
 * this module instead: the types come through `import type` (erased at
 * build), and zod stays out of the layout's chunks — it was 55 KB of
 * JavaScript loaded on every page for a schema the browser never ran.
 */
import type { z } from 'zod';
import type { ChatInput, ChatOutput, ChatLink, MessageSchema } from './flows/ai-chat';

export type { ChatInput, ChatOutput, ChatLink };

/** One turn of the transcript, as the route and the widget both shape it. */
export type ChatMessage = z.infer<typeof MessageSchema>;

export async function chatWithAI(input: ChatInput): Promise<ChatOutput> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  const data = await res.json().catch(() => ({} as any));

  if (!res.ok) {
    // The route still returns a usable `response` (and sometimes links) on
    // failure — prefer showing that over a generic client-side error bubble.
    if (typeof data?.response === 'string' && data.response) {
      return { response: data.response, products: data.products, links: data.links };
    }
    throw new Error(data?.error || `AI chat request failed with status ${res.status}`);
  }

  return data;
}
