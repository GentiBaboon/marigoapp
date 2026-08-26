import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGet = vi.fn();
const mockUpdate = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/firebase-admin', () => ({
  firestoreGet: (...a: any[]) => mockGet(...a),
  firestoreUpdate: (...a: any[]) => mockUpdate(...a),
}));

import { decrementStockForItems } from '@/lib/inventory-server';

const writeFor = (id: string) => mockUpdate.mock.calls.find(c => c[1] === id)?.[2];

describe('decrementStockForItems', () => {
  beforeEach(() => { mockGet.mockReset(); mockUpdate.mockClear(); });

  it('flips a listing to reserved once its last unit goes', () => {
    mockGet.mockResolvedValue({ quantity: 1 });
    return decrementStockForItems([{ id: 'p1', quantity: 1 }], 'tok').then(() => {
      expect(writeFor('p1')).toEqual({ quantity: 0, status: 'reserved' });
    });
  });

  it('leaves a listing active while stock remains', async () => {
    mockGet.mockResolvedValue({ quantity: 3 });
    await decrementStockForItems([{ id: 'p1', quantity: 1 }], 'tok');
    expect(writeFor('p1')).toEqual({ quantity: 2 });
    expect(writeFor('p1')).not.toHaveProperty('status');
  });

  it('treats a listing with no quantity field as one unit', async () => {
    mockGet.mockResolvedValue({ title: 'legacy listing' });
    await decrementStockForItems([{ id: 'p1', quantity: 1 }], 'tok');
    expect(writeFor('p1')).toEqual({ quantity: 0, status: 'reserved' });
  });

  it('takes the unit off the matching size as well', async () => {
    mockGet.mockResolvedValue({
      quantity: 2,
      variants: [{ size: 'S', quantity: 1 }, { size: 'M', quantity: 1 }],
    });
    await decrementStockForItems([{ id: 'p1', quantity: 1, selectedSize: 'M' }], 'tok');
    expect(writeFor('p1')).toMatchObject({
      quantity: 1,
      variants: [{ size: 'S', quantity: 1 }, { size: 'M', quantity: 0 }],
    });
  });

  it('never writes a negative quantity', async () => {
    mockGet.mockResolvedValue({ quantity: 1 });
    await decrementStockForItems([{ id: 'p1', quantity: 5 }], 'tok');
    expect(writeFor('p1')).toEqual({ quantity: 0, status: 'reserved' });
  });

  it('skips a product that no longer exists rather than throwing', async () => {
    mockGet.mockResolvedValue(null);
    await decrementStockForItems([{ id: 'gone', quantity: 1 }], 'tok');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('reads productId when the line carries both', async () => {
    mockGet.mockResolvedValue({ quantity: 1 });
    await decrementStockForItems([{ id: 'cartline__M', productId: 'realId', quantity: 1 }], 'tok');
    expect(mockGet).toHaveBeenCalledWith('products', 'realId', 'tok');
  });
});
