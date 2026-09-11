import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// These two modules exist so the chat widget and the homepage rail can call
// the AI routes without loading zod (55 KB) into every page's chunks. A value
// import of zod or of the schema-defining flow files would silently undo that.
describe('zod-free AI client modules', () => {
  for (const file of ['src/ai/chat-client.ts', 'src/ai/recommendations-client.ts']) {
    it(`${file} has only type imports`, () => {
      const src = readFileSync(file, 'utf8');
      const valueImports = [...src.matchAll(/^import (?!type )[^;]+from '([^']+)'/gm)].map((m) => m[1]);
      expect(valueImports).toEqual([]);
    });
  }

  it('the chat widget and personalized picks import the client modules, not the flows', () => {
    expect(readFileSync('src/components/ai/ChatbotWidget.tsx', 'utf8')).not.toMatch(/from '(zod|@\/ai\/flows\/ai-chat)'/);
    expect(readFileSync('src/components/home/PersonalizedPicks.tsx', 'utf8')).not.toMatch(/from '@\/ai\/flows\/get-recommendations'/);
  });
});
