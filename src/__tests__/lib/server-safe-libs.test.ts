import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * A module that starts with `'use client'` becomes a bundle of *client
 * reference proxies* when a server route imports it: every export — a
 * constant, a function, a Zod schema — arrives as an empty object. Vitest and
 * the browser never notice. `src/lib/types.ts` carried the directive from the
 * project scaffold, so `DEFAULT_SHIPPING_FEE_EUR` was `{}` inside
 * /api/create-order, the delivery fee became "0[object Object]", the total
 * NaN, and Firestore rejected every cash order with "Value with type unset".
 *
 * This walks the import graph from every API route through `@/lib/*` and
 * fails on any module in that graph that opts into the client bundle.
 */
const ROOT = resolve(__dirname, '../../..');
const API_DIR = join(ROOT, 'src/app/api');
const LIB_DIR = join(ROOT, 'src/lib');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

function libImports(file: string): string[] {
  const src = readFileSync(file, 'utf8');
  const out: string[] = [];
  // `import type` is erased at compile time and cannot pull a module in.
  const re = /^import\s+(?!type\s)[^;]*?from\s+['"]@\/lib\/([^'"]+)['"]/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out.push(m[1]);
  return out;
}

function resolveLib(spec: string): string | null {
  for (const cand of [`${spec}.ts`, `${spec}.tsx`, `${spec}/index.ts`]) {
    const p = join(LIB_DIR, cand);
    if (existsSync(p)) return p;
  }
  return null;
}

function isClientModule(file: string): boolean {
  const head = readFileSync(file, 'utf8').slice(0, 400);
  return /^\s*['"]use client['"]\s*;?/m.test(head);
}

describe('server-safe libs', () => {
  it('no module reachable from an API route is marked "use client"', () => {
    const offenders = new Map<string, string[]>();
    const seen = new Set<string>();
    const queue: Array<{ file: string; via: string }> = walk(API_DIR).map((f) => ({ file: f, via: f }));
    while (queue.length) {
      const { file, via } = queue.shift()!;
      for (const spec of libImports(file)) {
        const target = resolveLib(spec);
        if (!target) continue;
        if (isClientModule(target)) {
          const list = offenders.get(target) ?? [];
          list.push(via.replace(ROOT + '/', ''));
          offenders.set(target, list);
        }
        if (!seen.has(target)) {
          seen.add(target);
          queue.push({ file: target, via: target });
        }
      }
    }
    const report = [...offenders].map(([lib, routes]) => `${lib.replace(ROOT + '/', '')} ← ${[...new Set(routes)].slice(0, 3).join(', ')}`);
    expect(report, report.join('\n')).toEqual([]);
  });

  it('src/lib/types.ts is not a client module', () => {
    expect(isClientModule(join(LIB_DIR, 'types.ts'))).toBe(false);
  });
});
