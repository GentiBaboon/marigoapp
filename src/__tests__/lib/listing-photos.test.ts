import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { MAX_LISTING_PHOTOS, MIN_LISTING_PHOTOS, photoCountProblem, photoRoom } from '@/lib/listing-photos';

const ROOT = resolve(__dirname, '../../..');

describe('listing photo limits', () => {
  it('are 3 to 9', () => {
    expect(MIN_LISTING_PHOTOS).toBe(3);
    expect(MAX_LISTING_PHOTOS).toBe(9);
  });

  it('photoCountProblem names what is missing, and nothing when fine', () => {
    expect(photoCountProblem(0)).toMatch(/at least 3/);
    expect(photoCountProblem(1)).toMatch(/2 more photos/);
    expect(photoCountProblem(2)).toMatch(/1 more photo —/);
    expect(photoCountProblem(3)).toBeNull();
    expect(photoCountProblem(9)).toBeNull();
    expect(photoCountProblem(10)).toMatch(/up to 9/);
  });

  it('photoRoom never goes negative', () => {
    expect(photoRoom(0)).toBe(9);
    expect(photoRoom(9)).toBe(0);
    expect(photoRoom(12)).toBe(0);
  });
});

describe('every seller path uses the shared limits', () => {
  // The numbers drifted once (caption 3, button 1, AI 9, manual 8, edit 8).
  // Each seller-facing file must import the module and carry no literal
  // limit of its own.
  const FILES = [
    'src/components/sell/steps/PhotosStep.tsx',
    'src/components/sell/AiListingAssistant.tsx',
    'src/components/sell/steps/ReviewStep.tsx',
    'src/app/products/[id]/edit/client-page.tsx',
  ];
  it.each(FILES)('%s imports @/lib/listing-photos and hardcodes no limit', (file) => {
    const src = readFileSync(join(ROOT, file), 'utf8');
    expect(src).toMatch(/from '@\/lib\/listing-photos'/);
    // A photo array's length compared with a non-zero literal (`> 8`,
    // `< 8`), `8 - localImages.length`, `/8)`, `MAX_IMAGES = 9`, and the
    // copy: "at least 3 photos", "up to 9 photos", "Maximum 8 photos".
    expect(src).not.toMatch(/(?:images|localImages)\.length\s*[<>]=?\s*[1-9]/);
    expect(src).not.toMatch(/\b[0-9] - localImages\.length/);
    expect(src).not.toMatch(/\/[0-9]\)/);
    expect(src).not.toMatch(/MAX_IMAGES = [0-9]/);
    expect(src).not.toMatch(/at least [0-9] photo/i);
    expect(src).not.toMatch(/max(?:imum)? [0-9] photos/i);
    expect(src).not.toMatch(/up to [0-9] photos/i);
  });
});
