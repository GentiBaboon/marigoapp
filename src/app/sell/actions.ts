/**
 * @fileOverview Listing validation shared by the web and native builds.
 *
 * This was a `'use server'` module, but static export — the native build —
 * cannot carry Server Actions at all, and neither function was doing anything
 * that needed a server: one is a Zod parse, the other logs a line. Running them
 * in the caller keeps behaviour identical on web and makes the same code work
 * inside the iOS and Android shells.
 *
 * Nothing here is a security boundary and nothing here ever was — a Server
 * Action is called by the client and can be called with anything the client
 * likes. Publishing is actually gated by `firestore.rules`. If real server-side
 * work lands here later it belongs in an API route under `src/app/api/`, which
 * the native app can reach over the network; a Server Action it could not.
 */

import { z } from 'zod';

const PublishListingSchema = z.object({
  productId: z.string(),
  sellerId: z.string(),
  title: z.string().min(5),
  price: z.number().positive(),
  status: z.string(),
});

/**
 * Shape-checks a listing before the client writes it to Firestore, so an
 * obviously malformed draft fails with a readable message instead of a rules
 * rejection.
 */
export async function validateListingData(data: any) {
  const result = PublishListingSchema.safeParse(data);
  if (!result.success) {
    return { success: false, errors: result.error.flatten() };
  }

  return { success: true };
}

/**
 * Placeholder for admin notification on a new listing.
 *
 * Still a no-op, as it was as a Server Action. Wire it to an API route rather
 * than back to a Server Action when it does real work, or it will build on web
 * and break the moment it is called from a device.
 */
export async function notifyNewListing(title: string, sellerName: string) {
  return { success: true };
}
