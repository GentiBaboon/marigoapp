import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Firestore: capture what would be written instead of writing it.
const mockAddDoc = vi.fn().mockResolvedValue({ id: 'new-address' });
const mockUpdateDoc = vi.fn().mockResolvedValue(undefined);
vi.mock('firebase/firestore', () => ({
  collection: (...args: any[]) => ({ __collection: args.slice(1).join('/') }),
  doc: (_c: any, id: string) => ({ __doc: id }),
  addDoc: (...args: any[]) => mockAddDoc(...args),
  updateDoc: (...args: any[]) => mockUpdateDoc(...args),
}));

vi.mock('@/firebase', () => ({ useFirestore: () => ({}) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

import { AddressForm } from '@/components/profile/address-form';

const EXISTING = {
  id: 'a1',
  isDefault: false,
  fullName: 'Ana Maria Lekaj',
  phone: '+355692345678',
  address: 'Rruga Sami Frashëri 12',
  city: 'Tirana',
  postal: '1001',
  country: 'Albania',
} as any;

const type = (placeholder: string, value: string) =>
  fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } });

/**
 * `fullName` is a required schema field with no input of its own — it is
 * composed from the two visible name fields. That makes it the thing worth
 * testing here: if the composition ever breaks, zod rejects the submit and the
 * save button goes dead with nothing on screen to explain why, because the
 * field it complains about is not rendered.
 */
describe('AddressForm', () => {
  beforeEach(() => {
    mockAddDoc.mockClear();
    mockUpdateDoc.mockClear();
  });

  it('splits a legacy address that only stored fullName back into both inputs', () => {
    render(<AddressForm userId="u1" onSave={vi.fn()} addressToEdit={EXISTING} />);

    // Everything before the last space is the first name, so a middle name
    // stays with it rather than being read as the surname.
    expect(screen.getByPlaceholderText('e.g. Sara')).toHaveValue('Ana Maria');
    expect(screen.getByPlaceholderText('e.g. Lekaj')).toHaveValue('Lekaj');
  });

  it('recomposes fullName from the two name inputs on save', async () => {
    render(<AddressForm userId="u1" onSave={vi.fn()} addressToEdit={EXISTING} />);

    type('e.g. Sara', 'Sara');
    type('e.g. Lekaj', 'Lekaj');
    fireEvent.click(screen.getByRole('button', { name: /save address/i }));

    await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalled());
    const written = mockUpdateDoc.mock.calls[0][1];
    expect(written.fullName).toBe('Sara Lekaj');
    expect(written.firstName).toBe('Sara');
    expect(written.surname).toBe('Lekaj');
  });

  it('keeps the new optional fields on the saved address', async () => {
    render(<AddressForm userId="u1" onSave={vi.fn()} addressToEdit={EXISTING} />);

    type('e.g. Marigo sh.p.k.', 'Marigo sh.p.k.');
    type('e.g. Pallati 12, Shkalla 2, Ap. 7', 'Ap. 7');
    fireEvent.click(screen.getByRole('button', { name: /save address/i }));

    await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalled());
    const written = mockUpdateDoc.mock.calls[0][1];
    expect(written.company).toBe('Marigo sh.p.k.');
    expect(written.apartment).toBe('Ap. 7');
    // The rest of the address must survive an edit that only touched the
    // optional fields.
    expect(written.fullName).toBe('Ana Maria Lekaj');
    expect(written.city).toBe('Tirana');
  });

  it('refuses to save when a name half is missing, and says so on screen', async () => {
    render(<AddressForm userId="u1" onSave={vi.fn()} addressToEdit={EXISTING} />);

    type('e.g. Lekaj', '');
    fireEvent.click(screen.getByRole('button', { name: /save address/i }));

    // The failure must be visible: a hidden fullName error would read to the
    // user as a button that simply does nothing.
    expect(await screen.findByText('Surname is required')).toBeInTheDocument();
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });
});
