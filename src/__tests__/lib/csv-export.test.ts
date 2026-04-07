import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportToCSV } from '@/lib/csv-export';

describe('csv-export', () => {
  let clickSpy: ReturnType<typeof vi.fn>;
  let createdBlobContent: string;
  let originalCreateElement: typeof document.createElement;

  beforeEach(() => {
    clickSpy = vi.fn();
    createdBlobContent = '';

    // Mock URL.createObjectURL / revokeObjectURL
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn(),
    });

    // Mock document.createElement to capture the link click
    originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string, options?: any) => {
      const el = originalCreateElement(tag, options);
      if (tag === 'a') {
        el.click = clickSpy;
      }
      return el;
    }) as typeof document.createElement);

    // Capture Blob content
    const OriginalBlob = Blob;
    vi.stubGlobal('Blob', class MockBlob extends OriginalBlob {
      constructor(parts?: BlobPart[], options?: BlobPropertyBag) {
        super(parts, options);
        if (parts) {
          createdBlobContent = parts.map(p => String(p)).join('');
        }
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates correct CSV content with headers and rows', () => {
    const data = [
      { name: 'Widget', price: 10 },
      { name: 'Gadget', price: 25 },
    ];
    const columns = [
      { key: 'name', header: 'Name' },
      { key: 'price', header: 'Price' },
    ];

    exportToCSV(data, columns, 'test-export');

    expect(createdBlobContent).toContain('Name,Price');
    expect(createdBlobContent).toContain('"Widget"');
    expect(createdBlobContent).toContain('"Gadget"');
    expect(createdBlobContent).toContain('"10"');
    expect(createdBlobContent).toContain('"25"');
    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it('handles empty data array', () => {
    const columns = [
      { key: 'name', header: 'Name' },
    ];

    exportToCSV([], columns, 'empty');

    // Should have header row only
    expect(createdBlobContent).toBe('Name');
    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it('handles special characters (quotes and commas) in values', () => {
    const data = [
      { desc: 'He said "hello"' },
      { desc: 'one, two, three' },
    ];
    const columns = [
      { key: 'desc', header: 'Description' },
    ];

    exportToCSV(data, columns, 'special');

    // Quotes should be escaped as double-quotes within CSV
    expect(createdBlobContent).toContain('"He said ""hello"""');
    expect(createdBlobContent).toContain('"one, two, three"');
  });

  it('uses transform function when provided', () => {
    const data = [
      { amount: 1999, currency: 'EUR' },
    ];
    const columns = [
      {
        key: 'amount',
        header: 'Amount',
        transform: (val: number, row: { amount: number; currency: string }) =>
          `${(val / 100).toFixed(2)} ${row.currency}`,
      },
    ];

    exportToCSV(data, columns, 'transformed');

    expect(createdBlobContent).toContain('"19.99 EUR"');
  });

  it('handles null/undefined values gracefully', () => {
    const data = [
      { name: null, price: undefined },
    ] as any[];
    const columns = [
      { key: 'name', header: 'Name' },
      { key: 'price', header: 'Price' },
    ];

    exportToCSV(data, columns, 'nulls');

    // The implementation uses String(val ?? '') which produces ''
    expect(createdBlobContent).toContain('""');
    expect(clickSpy).toHaveBeenCalledOnce();
  });
});
