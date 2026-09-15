import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { PackingInstructionsDialog } from '@/components/profile/packing-instructions-dialog';

/**
 * The dialog only ever appears on a seller's own sale page, which makes it
 * awkward to check by hand — hence these. They guard the two things that
 * actually matter about it: that opening the trigger shows the guidance at
 * all (it used to be an `href="#"` that scrolled the page), and that the
 * steps stay in order, since step 4 only makes sense after step 3.
 */
describe('PackingInstructionsDialog', () => {
  const open = () => {
    render(
      <PackingInstructionsDialog>
        <button type="button">instructions</button>
      </PackingInstructionsDialog>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'instructions' }));
  };

  it('shows nothing until the trigger is used', () => {
    render(
      <PackingInstructionsDialog>
        <button type="button">instructions</button>
      </PackingInstructionsDialog>,
    );
    expect(screen.queryByText('How to pack your order')).not.toBeInTheDocument();
  });

  it('opens on the trigger', () => {
    open();
    expect(screen.getByText('How to pack your order')).toBeInTheDocument();
  });

  it('lists the four steps in the order they have to be done', () => {
    open();
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringContaining('Prepare your item'),
      expect.stringContaining('Find an appropriate packing bag'),
      expect.stringContaining('Include everything in the product details'),
      expect.stringContaining('Seal it, then attach the shipping label'),
    ]);
  });

  it('is an ordered list, not a bulleted one — the sequence is the instruction', () => {
    open();
    expect(screen.getByRole('list').tagName).toBe('OL');
  });

  it('keeps the detail a seller needs while standing over the box', () => {
    open();
    expect(screen.getByText(/Clean it, iron or polish it, and fold it/)).toBeInTheDocument();
    expect(screen.getByText(/Label, certificate, dustbag/)).toBeInTheDocument();
    expect(screen.getByText(/Once the package is sealed/)).toBeInTheDocument();
  });

  // There is no drop-off network, so the closing line must not send a seller
  // out to find one.
  it('ends by telling the seller to mark it prepared', () => {
    open();
    expect(screen.getByText(/mark the order as prepared/)).toBeInTheDocument();
  });
});
