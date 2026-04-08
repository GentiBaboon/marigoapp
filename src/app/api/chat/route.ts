import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';
import { ChatInputSchema } from '@/ai/flows/ai-chat';

const SEARCH_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!;
const SEARCH_BASE = `https://firestore.googleapis.com/v1/projects/${SEARCH_PROJECT_ID}/databases/(default)/documents`;

async function searchProducts(searchTerms: string) {
  try {
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    const body = {
      structuredQuery: {
        from: [{ collectionId: 'products' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'status' },
            op: 'EQUAL',
            value: { stringValue: 'active' },
          },
        },
        orderBy: [{ field: { fieldPath: 'views' }, direction: 'DESCENDING' }],
        limit: { value: 50 },
      },
    };

    const res = await fetch(`${SEARCH_BASE}:runQuery?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) return [];
    const results = await res.json();

    const terms = searchTerms.toLowerCase().split(/\s+/).filter(t => t.length > 1);

    return (results as any[])
      .filter((r: any) => r.document)
      .map((r: any) => {
        const fields = r.document.fields || {};
        const id = r.document.name.split('/').pop();
        const title = fields.title?.stringValue || '';
        const brandId = fields.brandId?.stringValue || '';
        const description = fields.description?.stringValue || '';
        const price = Number(fields.price?.doubleValue || fields.price?.integerValue || 0);
        const images = fields.images?.arrayValue?.values || [];
        const image = images[0]?.mapValue?.fields?.url?.stringValue || '';
        const sellerId = fields.sellerId?.stringValue || '';
        return { id, title, brandId, description, price, image, sellerId };
      })
      .filter(p => terms.some(t =>
        p.title.toLowerCase().includes(t) ||
        p.brandId.toLowerCase().includes(t) ||
        p.description.toLowerCase().includes(t)
      ))
      .slice(0, 4)
      .map(({ description, ...rest }) => rest);
  } catch (error) {
    console.error('Product search error:', error);
    return [];
  }
}

const knowledgeBase = `
MarigoApp Knowledge Base:
- How to Buy: Browse items, add to cart, proceed to checkout. We offer secure payments via Stripe and Cash on Delivery.
- How to Sell: Click "Sell", fill out the item details, upload photos, set a price, and list your item.
- Payments: We use Stripe for secure card processing. All transactions are in EUR. We also offer Cash on Delivery (COD) in supported areas.
- Shipping: Sellers ship items directly to buyers. For high-value items, we offer an optional authentication service where items are shipped to us first. Shipping costs are calculated at checkout.
- Returns: Returns are accepted within 7 days of delivery for items that are not as described. The buyer is responsible for return shipping.
- Safety Tips: Never share personal information like your phone number or bank details in the chat. All transactions must happen on the MarigoApp platform.

## Shopping Assistant
You can help users find and buy products. When a user asks to find, search for, browse, or shop for products (e.g., "show me bags", "I want a Gucci purse", "what do you have under 500€"), include [SEARCH: relevant keywords] at the END of your response.
When you include a search, keep your text response brief and helpful, like "Here are some options I found for you:".
Users can click "Add to Cart" on product cards and proceed to checkout.
`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ChatInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { history, message } = parsed.data;

    const prompt = `You are a friendly and helpful customer support agent for MarigoApp, a luxury fashion marketplace.
Your goal is to answer user questions based on the provided knowledge base.
If the user's question cannot be answered using the knowledge base, politely inform them that you can't help with that and offer to connect them with a human agent.
Keep your answers concise and clear.
Always respond in English.

Here is the knowledge base:
${knowledgeBase}

Here is the conversation history:
${history.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

New user message:
${message}
`;

    const llmResponse = await ai.generate({
      prompt,
      model: 'googleai/gemini-2.0-flash',
      config: { temperature: 0.3 },
    });

    const responseText = llmResponse.text;
    const searchMatch = responseText.match(/\[SEARCH:\s*(.+?)\]/);
    let products: Array<{ id: string; title: string; price: number; image: string; brandId: string; sellerId: string }> | undefined;
    let cleanedResponse = responseText;

    if (searchMatch) {
      cleanedResponse = responseText.replace(/\[SEARCH:\s*.+?\]/g, '').trim();
      products = await searchProducts(searchMatch[1]);
      if (products.length === 0) {
        cleanedResponse += "\n\nI couldn't find any matching products right now. Try different keywords or browse our catalog.";
      }
    }

    return NextResponse.json({ response: cleanedResponse, products });
  } catch (error: any) {
    console.error('AI chat API error:', error);
    const isQuota = error?.status === 'RESOURCE_EXHAUSTED' || error?.code === 429;
    return NextResponse.json(
      { error: isQuota ? 'AI service is temporarily unavailable. Please try again in a moment.' : 'Failed to generate AI response' },
      { status: isQuota ? 429 : 500 }
    );
  }
}
