import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { subscribeToNewsletter, newsletterListId } from '@/lib/newsletter';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  vi.stubEnv('SENDGRID_API_KEY', 'SG.test');
  vi.stubEnv('SENDGRID_NEWSLETTER_LIST_ID', '');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('subscribeToNewsletter', () => {
  it('reports not_configured without a key and makes no request', async () => {
    vi.stubEnv('SENDGRID_API_KEY', '');
    expect(await subscribeToNewsletter('a@b.com')).toEqual({ ok: false, reason: 'not_configured' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('upserts the normalised address as a marketing contact', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 202 });
    expect(await subscribeToNewsletter('  Elira@Example.com ')).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.sendgrid.com/v3/marketing/contacts');
    expect(init.method).toBe('PUT');
    expect(init.headers.Authorization).toBe('Bearer SG.test');
    expect(JSON.parse(init.body)).toEqual({ contacts: [{ email: 'elira@example.com' }] });
  });

  it('files the contact under the configured list', async () => {
    vi.stubEnv('SENDGRID_NEWSLETTER_LIST_ID', 'list-1');
    fetchMock.mockResolvedValue({ ok: true, status: 202 });
    await subscribeToNewsletter('a@b.com');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ list_ids: ['list-1'], contacts: [{ email: 'a@b.com' }] });
  });

  it('names a permissions problem so the operator can fix the key', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403, text: async () => 'access forbidden' });
    const r = await subscribeToNewsletter('a@b.com');
    expect(r).toMatchObject({ ok: false, reason: 'forbidden', status: 403 });
  });

  it('never throws', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    expect(await subscribeToNewsletter('a@b.com')).toMatchObject({ ok: false, reason: 'failed' });
    fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' });
    expect(await subscribeToNewsletter('a@b.com')).toMatchObject({ ok: false, reason: 'failed', status: 500 });
  });
});

describe('newsletterListId', () => {
  it('treats blank as unset', () => {
    vi.stubEnv('SENDGRID_NEWSLETTER_LIST_ID', '   ');
    expect(newsletterListId()).toBeUndefined();
    vi.stubEnv('SENDGRID_NEWSLETTER_LIST_ID', 'abc');
    expect(newsletterListId()).toBe('abc');
  });
});
