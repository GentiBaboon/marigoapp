/**
 * Load a set of documents once per distinct id.
 *
 * Admin screens join people and listings onto rows: a buyer who bid on ten
 * items, or a shopper with six assistant chats, is looked up once rather than
 * per row. Failed or missing lookups are simply absent from the map, so a
 * deleted account never takes the whole screen down.
 */
export async function fetchMap<T>(
  ids: Iterable<string | null | undefined>,
  load: (id: string) => Promise<T | null>,
): Promise<Map<string, T>> {
  const unique = Array.from(new Set(ids)).filter((id): id is string => Boolean(id));
  const entries = await Promise.all(
    unique.map(async (id) => [id, await load(id).catch(() => null)] as const),
  );
  const map = new Map<string, T>();
  for (const [id, value] of entries) if (value) map.set(id, value);
  return map;
}
