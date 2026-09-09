/**
 * Listing-wizard features that exist in code but are not offered right now.
 *
 * The AI background remover (`/api/ai/remove-background`, the STUDIO MODE
 * button on each photo in `PhotosStep`) was withdrawn from the live site on
 * 2026-09-09. One flag, read wherever the feature is offered or described —
 * the photo step's copy and button, the Help Centre and the assistant's
 * knowledge — so nothing advertises a button that is not there. Flip it to
 * bring all of it back; the flow and the route are untouched.
 */
export const BACKGROUND_REMOVER_ENABLED = false;
