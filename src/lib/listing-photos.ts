/**
 * How many photos a listing must have, and may have.
 *
 * One place, because the numbers had drifted apart: the photo step said
 * "at least 3" in its caption and let a seller continue with one, the publish
 * guard refused only zero, the AI assistant allowed nine while the manual
 * step allowed eight, and the edit page eight while the admin page allowed
 * ten. Two one-photo listings from a real seller (2026-09-11) were the
 * result. Every seller-facing path now imports these; a test checks that.
 *
 * Admins are not bound by the maximum on their own product page (they fix
 * listings, they do not create them), but the minimum is shown to them as a
 * warning so moderation sees a thin listing before approving it.
 */
export const MIN_LISTING_PHOTOS = 3;
export const MAX_LISTING_PHOTOS = 9;

/** `null` when the count is acceptable, otherwise the sentence to show. */
export function photoCountProblem(count: number): string | null {
  if (count < MIN_LISTING_PHOTOS) {
    const missing = MIN_LISTING_PHOTOS - count;
    return count === 0
      ? `Add at least ${MIN_LISTING_PHOTOS} photos to publish.`
      : `Add ${missing} more photo${missing === 1 ? '' : 's'} — listings need at least ${MIN_LISTING_PHOTOS}.`;
  }
  if (count > MAX_LISTING_PHOTOS) {
    return `You can add up to ${MAX_LISTING_PHOTOS} photos.`;
  }
  return null;
}

/** How many more may be added from `count`, never negative. */
export function photoRoom(count: number): number {
  return Math.max(0, MAX_LISTING_PHOTOS - count);
}
