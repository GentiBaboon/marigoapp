import { describe, expect, it } from 'vitest';
import {
  APP_STORE_URL,
  APP_STORE_WEB_URL,
  PLAY_STORE_URL,
  detectStorePlatform,
  downloadRedirectTarget,
  isDownloadHost,
} from '@/lib/app-download';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const INSTAGRAM_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 340.0.0';
const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15';
const SITE = 'https://www.marigoapp.com';

describe('detectStorePlatform', () => {
  it('places phones and in-app browsers', () => {
    expect(detectStorePlatform(IPHONE)).toBe('ios');
    expect(detectStorePlatform(INSTAGRAM_IOS)).toBe('ios');
    expect(detectStorePlatform(ANDROID)).toBe('android');
  });
  it('leaves desktops and missing agents unplaced', () => {
    expect(detectStorePlatform(MAC)).toBeNull();
    expect(detectStorePlatform('')).toBeNull();
    expect(detectStorePlatform(null)).toBeNull();
  });
});

describe('isDownloadHost', () => {
  it('matches the download subdomain with or without a port', () => {
    expect(isDownloadHost('download.marigoapp.com')).toBe(true);
    expect(isDownloadHost('DOWNLOAD.marigoapp.com')).toBe(true);
    expect(isDownloadHost('download.localhost:3001')).toBe(true);
  });
  it('does not match the main site', () => {
    expect(isDownloadHost('www.marigoapp.com')).toBe(false);
    expect(isDownloadHost('marigoapp.com')).toBe(false);
    expect(isDownloadHost(null)).toBe(false);
  });
});

describe('downloadRedirectTarget', () => {
  const on = (host: string, pathname: string, userAgent: string | null) =>
    downloadRedirectTarget({ host, pathname, userAgent, siteUrl: SITE });

  it('sends phones on the download host to their store, from any path', () => {
    expect(on('download.marigoapp.com', '/', IPHONE)).toBe(APP_STORE_URL);
    expect(on('download.marigoapp.com', '/anything', ANDROID)).toBe(PLAY_STORE_URL);
  });

  it('sends a desktop on the download host to the page with both buttons', () => {
    expect(on('download.marigoapp.com', '/', MAC)).toBe(`${SITE}/download`);
    expect(on('download.marigoapp.com', '/', null)).toBe(`${SITE}/download`);
  });

  it('redirects phones on /download but shows desktops the page', () => {
    expect(on('www.marigoapp.com', '/download', IPHONE)).toBe(APP_STORE_URL);
    expect(on('www.marigoapp.com', '/download/', ANDROID)).toBe(PLAY_STORE_URL);
    expect(on('www.marigoapp.com', '/download', MAC)).toBeNull();
  });

  it('never touches the rest of the main site', () => {
    expect(on('www.marigoapp.com', '/', IPHONE)).toBeNull();
    expect(on('www.marigoapp.com', '/downloads', ANDROID)).toBeNull();
    expect(on('www.marigoapp.com', '/products/abc', IPHONE)).toBeNull();
  });
});

describe('APP_STORE_WEB_URL', () => {
  it('is the full iPhone web listing, not the bare link a Mac hands to its App Store', () => {
    expect(APP_STORE_WEB_URL).toMatch(/^https:\/\/apps\.apple\.com\/[a-z]{2}\/app\/[a-z-]+\/id6826849847\?platform=iphone$/);
    expect(APP_STORE_WEB_URL).not.toBe(APP_STORE_URL);
  });
});
