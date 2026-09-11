import { HomeClient } from './client-page';
import { fetchHomepageBlocks } from '@/lib/homepage-blocks';
import { fetchMacroFilters } from '@/lib/macro-filters';

/**
 * `/home` — the same page as `/` (see `src/app/page.tsx`), kept because the
 * navigation, the native shells and inbound links all point here. Its
 * canonical is `/` (`layout.tsx`).
 *
 * A server component so the hero can be read before the HTML is sent; the
 * body is the client tree in `client-page.tsx`.
 */
export default async function HomePage() {
  const [initialBlocks, initialFilters] = await Promise.all([fetchHomepageBlocks(), fetchMacroFilters()]);
  return <HomeClient initialBlocks={initialBlocks} initialFilters={initialFilters} />;
}
