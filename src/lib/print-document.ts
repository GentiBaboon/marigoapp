'use client';

/**
 * Print a self-contained HTML document without disturbing the page.
 *
 * The document is written into a blank same-origin iframe and printed from
 * there, so the app's stylesheets never reach it — no Tailwind preflight, no
 * dark mode, no fixed mobile nav across the page, no Radix portal. The
 * alternative, a print stylesheet over the live DOM, means hiding the whole
 * application by hand and hoping nothing new escapes it.
 *
 * Two details that are easy to get wrong:
 *
 * - **The iframe is laid out off-screen, not hidden.** `display:none` or
 *   `visibility:hidden` can leave the document unrendered, and an unrendered
 *   document prints blank.
 * - **Images must finish loading before `print()`.** The logo is a network
 *   request; firing the dialog first prints the label with a gap where it
 *   should be.
 */
const REMOVE_FALLBACK_MS = 60_000;

function waitForImages(win: Window, timeoutMs: number): Promise<void> {
  const images = Array.from(win.document.images);
  const pending = images.filter((img) => !img.complete);
  if (pending.length === 0) return Promise.resolve();

  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve();
    };
    // A broken image must not block the dialog — print the label without it.
    let left = pending.length;
    const one = () => {
      left -= 1;
      if (left <= 0) finish();
    };
    pending.forEach((img) => {
      img.addEventListener('load', one, { once: true });
      img.addEventListener('error', one, { once: true });
    });
    const timer = setTimeout(finish, timeoutMs);
  });
}

export async function printHtmlDocument(
  html: string,
  opts: { imageTimeoutMs?: number } = {},
): Promise<void> {
  if (typeof document === 'undefined') return;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.setAttribute('title', 'Print');
  iframe.style.cssText =
    'position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0;opacity:0;';
  document.body.appendChild(iframe);

  let removed = false;
  const remove = () => {
    if (removed) return;
    removed = true;
    iframe.remove();
  };

  try {
    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    if (!doc || !win) throw new Error('Could not open a print document.');

    doc.open();
    doc.write(html);
    doc.close();

    await waitForImages(win, opts.imageTimeoutMs ?? 4000);

    // Chrome blocks on print(); Safari does not, so the iframe is cleared by
    // afterprint, with a long fallback for browsers that never fire it.
    win.addEventListener('afterprint', remove, { once: true });
    setTimeout(remove, REMOVE_FALLBACK_MS);

    win.focus();
    win.print();
  } catch (err) {
    remove();
    throw err;
  }
}
