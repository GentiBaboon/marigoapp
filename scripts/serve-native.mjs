#!/usr/bin/env node
/**
 * Static server for the native bundle (`npm run build:native` → `.next-native`).
 *
 * Lets you open exactly what ships inside the iOS and Android shells in a normal
 * browser — no Xcode, no simulator, no device. Useful for checking that the flat
 * `/products/view/?id=…` routes render and that nothing in the export depends on
 * a server that will not be there.
 *
 * What it cannot show you is anything gated on `isNativeApp()`: the link bridge
 * and the API rewrite stay dormant because `window.Capacitor` is absent. Pass
 * `--simulate-native` to inject a stub so those paths run too.
 *
 *   node scripts/serve-native.mjs [--port 3002] [--simulate-native]
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.next-native');

const argv = process.argv.slice(2);
const portArg = argv.indexOf('--port');
const PORT = Number(portArg !== -1 ? argv[portArg + 1] : process.env.PORT || 3002);
const SIMULATE_NATIVE = argv.includes('--simulate-native');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

/**
 * Mirrors how Capacitor's WebView resolves a path against the bundle, so a route
 * that works here works on device: exact file, then directory index.
 */
function resolveFile(pathname) {
  const clean = decodeURIComponent(pathname.split('?')[0]).replace(/^\/+/, '');
  const candidates = [
    path.join(ROOT, clean),
    path.join(ROOT, clean, 'index.html'),
    path.join(ROOT, `${clean}.html`),
  ];
  for (const candidate of candidates) {
    // Never serve outside the bundle, whatever the request path claims.
    if (!candidate.startsWith(ROOT)) continue;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** Stub of the object Capacitor injects natively, for `--simulate-native`. */
const CAPACITOR_STUB = `<script>
  window.Capacitor = {
    isNativePlatform: function () { return true; },
    getPlatform: function () { return 'ios'; },
    Plugins: {},
  };
  console.info('[serve-native] simulating a native platform');
</script>`;

const server = http.createServer((req, res) => {
  const file = resolveFile(req.url || '/');

  if (!file) {
    const notFound = path.join(ROOT, '404.html');
    if (fs.existsSync(notFound)) {
      res.writeHead(404, { 'Content-Type': TYPES['.html'] });
      res.end(fs.readFileSync(notFound));
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end(`Not found: ${req.url}`);
    return;
  }

  const ext = path.extname(file).toLowerCase();
  const type = TYPES[ext] || 'application/octet-stream';

  if (SIMULATE_NATIVE && ext === '.html') {
    const html = fs
      .readFileSync(file, 'utf8')
      .replace('<head>', `<head>${CAPACITOR_STUB}`);
    res.writeHead(200, { 'Content-Type': type });
    res.end(html);
    return;
  }

  res.writeHead(200, { 'Content-Type': type });
  fs.createReadStream(file).pipe(res);
});

if (!fs.existsSync(ROOT)) {
  console.error(`No native bundle at ${ROOT}\nRun: npm run build:native`);
  process.exit(1);
}

server.listen(PORT, () => {
  console.log(`Native bundle on http://localhost:${PORT}`);
  console.log(`  serving ${ROOT}`);
  if (SIMULATE_NATIVE) console.log('  window.Capacitor stubbed (native code paths active)');
});
