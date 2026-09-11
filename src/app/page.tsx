import { HomeClient } from './home/client-page';
import { fetchHomepageBlocks } from '@/lib/homepage-blocks';

/**
 * `/` serves the homepage directly.
 *
 * It used to be a splash screen — the logo and a spinner — that
 * `router.replace('/home')`d once React had hydrated. `/` is the URL Google
 * measures, the one in the sitemap and the one on every business card, and
 * that splash meant its HTML held no content at all: PageSpeed timed the hero
 * image at 11.8 s on mobile because it could only be requested after the
 * splash had loaded, hydrated, navigated client-side to `/home`, fetched that
 * page, mounted it, and opened a Firestore listener. Serving the page here
 * removes every one of those steps.
 *
 * The homepage itself still lives in `src/app/home/` — this file only mounts
 * it. `/home` remains for the navigation and the native shells, canonical
 * to `/`.
 */
export default async function RootPage() {
  const initialBlocks = await fetchHomepageBlocks();
  return <HomeClient initialBlocks={initialBlocks} />;
}
